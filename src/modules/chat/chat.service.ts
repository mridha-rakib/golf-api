import { ROLES } from "@/constants/app.constants";
import { CLUB_ROLES } from "@/modules/golf-club/golf-club-role.model";
import {
  GolfClubMemberRepository,
  GolfClubRepository,
  GolfClubRoleRepository,
} from "@/modules/golf-club/golf-club.repository";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@/utils/app-error.utils";
import { Types } from "mongoose";
import { SocialFollowRepository } from "../social-feed/social-feed.repository";
import { UserService } from "../user/user.service";
import type { IChatMessage, IChatThread } from "./chat.interface";
import { ChatMessageRepository, ChatThreadRepository } from "./chat.repository";
import type {
  ChatMessageResponse,
  ChatThreadMessagesResponse,
  ChatThreadSummary,
  CreateGroupPayload,
  SendDirectMessagePayload,
  SendGroupMessagePayload,
  SendThreadMessagePayload,
} from "./chat.type";

export class ChatService {
  private threadRepo: ChatThreadRepository;
  private messageRepo: ChatMessageRepository;
  private followRepo: SocialFollowRepository;
  private userService: UserService;
  private golfClubRepository: GolfClubRepository;
  private golfClubRoleRepository: GolfClubRoleRepository;
  private golfClubMemberRepository: GolfClubMemberRepository;
  private static groupIndexChecked = false;

  constructor() {
    this.threadRepo = new ChatThreadRepository();
    this.messageRepo = new ChatMessageRepository();
    this.followRepo = new SocialFollowRepository();
    this.userService = new UserService();
    this.golfClubRepository = new GolfClubRepository();
    this.golfClubRoleRepository = new GolfClubRoleRepository();
    this.golfClubMemberRepository = new GolfClubMemberRepository();
  }

  private async assertCanDm(senderUserId: string, targetUserId: string) {
    const [senderFollowsTarget, targetFollowsSender] = await Promise.all([
      this.followRepo.findOne({
        followerUserId: senderUserId,
        followingUserId: targetUserId,
      }),
      this.followRepo.findOne({
        followerUserId: targetUserId,
        followingUserId: senderUserId,
      }),
    ]);

    if (!senderFollowsTarget && !targetFollowsSender) {
      throw new ForbiddenException(
        "Chat allowed only when at least one golfer follows the other.",
      );
    }
  }

  private validateMessagePayload(
    type: string,
    text?: string,
    imageUrl?: string,
  ) {
    if (type === "text") {
      if (!text || text.trim().length === 0) {
        throw new BadRequestException("Text message requires non-empty text.");
      }
    }

    if (type === "image") {
      if (!imageUrl || imageUrl.trim().length === 0) {
        throw new BadRequestException("Image message requires imageUrl.");
      }
    }
  }

  private async resolveClubMembers(clubUserId: string): Promise<{
    clubName: string;
    memberUserIds: string[];
  }> {
    const club = await this.golfClubRepository.findByClubUserId(clubUserId);
    if (!club) {
      throw new NotFoundException("Golf club not found.");
    }

    const [assignments, clubMembers] = await Promise.all([
      this.golfClubRoleRepository.findByClubId(club._id.toString()),
      this.golfClubMemberRepository.find({ clubId: club._id } as any),
    ]);

    const roleMemberIds = assignments
      .filter((assignment) =>
        (assignment.roles ?? []).some(
          (role) =>
            role === CLUB_ROLES.CLUB_MANAGER || role === CLUB_ROLES.CLUB_MEMBER,
        ),
      )
      .map((assignment) => assignment.golferUserId.toString());

    const memberIdsFromClub = clubMembers.map((member) =>
      member.golferUserId.toString(),
    );

    const managerId = club.managerUserId?.toString();

    const memberUserIds = Array.from(
      new Set([
        ...roleMemberIds,
        ...memberIdsFromClub,
        ...(managerId ? [managerId] : []),
      ]),
    );

    return { clubName: club.name, memberUserIds };
  }

  private async ensureGroupThreadIndexes() {
    if (ChatService.groupIndexChecked) {
      return;
    }

    ChatService.groupIndexChecked = true;
    try {
      await this.threadRepo.dropUniqueTypeIndexIfPresent();
    } catch {
      ChatService.groupIndexChecked = false;
    }
  }

  private async ensureClubGroupThreadId(clubId: string): Promise<string> {
    const club = await this.golfClubRepository.findById(clubId);
    if (!club) {
      throw new NotFoundException("Golf club not found.");
    }

    const clubUserId = club.clubUserId.toString();
    const defaultName = `${club.name} Club`;

    let threadId = club.groupThreadId?.toString() ?? null;
    if (threadId) {
      const existing = await this.threadRepo.findById(threadId);
      if (!existing) {
        threadId = null;
      }
    }

    if (!threadId) {
      const namedThread = await this.threadRepo.findOne({
        type: "group",
        ownerUserId: clubUserId,
        name: defaultName,
      });
      if (namedThread) {
        threadId = (namedThread._id as any).toString();
      }
    }

    if (!threadId) {
      const anyThread = await this.threadRepo.findOne({
        type: "group",
        ownerUserId: clubUserId,
      });
      if (anyThread) {
        threadId = (anyThread._id as any).toString();
      }
    }

    if (!threadId) {
      const created = await this.createClubGroupThread(clubUserId, defaultName);
      threadId = created._id;
    }

    if (!club.groupThreadId || club.groupThreadId.toString() !== threadId) {
      await this.golfClubRepository.updateById(clubId, {
        groupThreadId: new Types.ObjectId(threadId),
      } as any);
    }

    return threadId;
  }

  async addMembersToClubGroupThreads(
    clubId: string,
    memberUserIds: string[],
  ): Promise<void> {
    const uniqueMemberIds = Array.from(new Set(memberUserIds)).filter(Boolean);
    if (uniqueMemberIds.length === 0) {
      return;
    }
    const club = await this.golfClubRepository.findById(clubId);
    if (!club) {
      throw new NotFoundException("Golf club not found.");
    }

    await this.ensureClubGroupThreadId(clubId);

    const threads = await this.threadRepo.findGroupThreadsByOwner(
      club.clubUserId.toString(),
    );

    if (threads.length === 0) {
      return;
    }

    await Promise.all(
      threads.map((thread) =>
        this.threadRepo.addMembers(
          (thread._id as any).toString(),
          uniqueMemberIds,
        ),
      ),
    );
  }

  async sendDirectMessage(
    senderUserId: string,
    payload: SendDirectMessagePayload,
  ): Promise<{ thread: ChatThreadSummary; message: ChatMessageResponse }> {
    await this.assertCanDm(senderUserId, payload.toGolferUserId);
    this.validateMessagePayload(payload.type, payload.text, payload.imageUrl);

    let thread = await this.threadRepo.findDirectThreadBetween(
      senderUserId,
      payload.toGolferUserId,
    );

    if (!thread) {
      thread = await this.threadRepo.create({
        type: "direct",
        memberUserIds: [senderUserId, payload.toGolferUserId],
        directKey: this.threadRepo.buildDirectKey(
          senderUserId,
          payload.toGolferUserId,
        ),
        ownerUserId: null,
      } as any);
    }

    const message = await this.messageRepo.create({
      threadId: thread._id,
      senderUserId,
      type: payload.type,
      text: payload.text,
      imageUrl: payload.imageUrl,
    } as any);
    await this.threadRepo.touch((thread._id as any).toString());

    const fullThread = await this.toThreadSummary(
      thread,
      message,
      senderUserId,
    );
    const responseMessage = await this.toMessageResponse(message);

    return { thread: fullThread, message: responseMessage };
  }

  async ensureDirectThread(
    ownerUserId: string,
    targetUserId: string,
  ): Promise<ChatThreadSummary> {
    await this.assertCanDm(ownerUserId, targetUserId);

    let thread = await this.threadRepo.findDirectThreadBetween(
      ownerUserId,
      targetUserId,
    );

    if (!thread) {
      thread = await this.threadRepo.create({
        type: "direct",
        memberUserIds: [ownerUserId, targetUserId],
        directKey: this.threadRepo.buildDirectKey(ownerUserId, targetUserId),
        ownerUserId: null,
      } as any);
    }

    return this.toThreadSummary(thread, null, ownerUserId);
  }

  async sendGroupMessage(
    senderUserId: string,
    payload: SendGroupMessagePayload,
  ): Promise<{ thread: ChatThreadSummary; message: ChatMessageResponse }> {
    const thread = await this.threadRepo.findById(payload.threadId);
    if (!thread || thread.type !== "group") {
      throw new NotFoundException("Group not found.");
    }

    if (!thread.memberUserIds.map(String).includes(senderUserId)) {
      throw new ForbiddenException("You are not a member of this group.");
    }

    this.validateMessagePayload(payload.type, payload.text, payload.imageUrl);

    const message = await this.messageRepo.create({
      threadId: thread._id,
      senderUserId,
      type: payload.type,
      text: payload.text,
      imageUrl: payload.imageUrl,
    } as any);
    await this.threadRepo.touch((thread._id as any).toString());

    const fullThread = await this.toThreadSummary(
      thread,
      message,
      senderUserId,
    );
    const responseMessage = await this.toMessageResponse(message);

    return { thread: fullThread, message: responseMessage };
  }

  async sendMessageToThread(
    senderUserId: string,
    payload: SendThreadMessagePayload,
  ): Promise<{ thread: ChatThreadSummary; message: ChatMessageResponse }> {
    const thread = await this.threadRepo.findById(payload.threadId);
    if (!thread) {
      throw new NotFoundException("Thread not found.");
    }

    if (!thread.memberUserIds.map(String).includes(senderUserId)) {
      throw new ForbiddenException("You are not a member of this thread.");
    }

    if (thread.type === "direct") {
      const peerId =
        thread.memberUserIds.map(String).find((id) => id !== senderUserId) ??
        null;
      if (!peerId) {
        throw new BadRequestException("Direct thread is missing a peer.");
      }
      await this.assertCanDm(senderUserId, peerId);
    }

    this.validateMessagePayload(payload.type, payload.text, payload.imageUrl);

    const message = await this.messageRepo.create({
      threadId: thread._id,
      senderUserId,
      type: payload.type,
      text: payload.text,
      imageUrl: payload.imageUrl,
    } as any);
    await this.threadRepo.touch((thread._id as any).toString());

    const fullThread = await this.toThreadSummary(
      thread,
      message,
      senderUserId,
    );
    const responseMessage = await this.toMessageResponse(message);

    return { thread: fullThread, message: responseMessage };
  }

  async createGroup(
    ownerUserId: string,
    payload: CreateGroupPayload,
  ): Promise<ChatThreadSummary> {
    const owner = await this.userService.getById(ownerUserId);
    if (!owner) {
      throw new NotFoundException("User not found.");
    }

    const name = payload.name?.trim();
    if (!name) {
      throw new BadRequestException("Group name is required.");
    }

    await this.ensureGroupThreadIndexes();

    if (owner.role === ROLES.GOLF_CLUB) {
      const { clubName, memberUserIds } =
        await this.resolveClubMembers(ownerUserId);
      const members = Array.from(new Set([ownerUserId, ...memberUserIds]));

      const thread = await this.threadRepo.create({
        type: "group",
        name: name || `${clubName} Club`,
        avatarUrl: payload.avatarUrl,
        ownerUserId,
        memberUserIds: members,
      } as any);

      return this.toThreadSummary(thread, null, ownerUserId);
    }

    const requested = Array.from(new Set(payload.memberUserIds ?? []));

    const followingIds = await this.followRepo.findFollowingIds(ownerUserId);
    const invalid = requested.filter((id) => !followingIds.includes(id));
    if (invalid.length > 0) {
      throw new ForbiddenException(
        "You can only add golfers you follow to a group.",
      );
    }

    const members = Array.from(new Set([ownerUserId, ...requested]));
    if (members.length < 2) {
      throw new BadRequestException(
        "Add at least one other golfer to create a group.",
      );
    }

    const thread = await this.threadRepo.create({
      type: "group",
      name,
      avatarUrl: payload.avatarUrl,
      ownerUserId,
      memberUserIds: members,
    } as any);

    return this.toThreadSummary(thread, null, ownerUserId);
  }

  async createClubGroupThread(
    clubUserId: string,
    threadName?: string,
  ): Promise<ChatThreadSummary> {
    await this.ensureGroupThreadIndexes();
    const { clubName, memberUserIds } =
      await this.resolveClubMembers(clubUserId);
    const members = Array.from(new Set([clubUserId, ...memberUserIds]));
    const name = (threadName ?? "").trim() || `${clubName} Club`;

    const thread = await this.threadRepo.create({
      type: "group",
      name,
      ownerUserId: clubUserId,
      memberUserIds: members,
    } as any);

    return this.toThreadSummary(thread, null, clubUserId);
  }

  async addGroupMembers(
    ownerUserId: string,
    threadId: string,
    memberUserIds: string[],
  ): Promise<ChatThreadSummary> {
    const thread = await this.threadRepo.findById(threadId);
    if (!thread || thread.type !== "group") {
      throw new NotFoundException("Group not found.");
    }
    if (String(thread.ownerUserId) !== ownerUserId) {
      throw new ForbiddenException("Only group owner can add members.");
    }

    const updated = await this.threadRepo.addMembers(threadId, memberUserIds);
    if (!updated) {
      throw new NotFoundException("Group not found.");
    }

    return this.toThreadSummary(updated, null, ownerUserId);
  }

  async removeGroupMember(
    ownerUserId: string,
    threadId: string,
    memberUserId: string,
  ): Promise<ChatThreadSummary> {
    const thread = await this.threadRepo.findById(threadId);
    if (!thread || thread.type !== "group") {
      throw new NotFoundException("Group not found.");
    }
    if (String(thread.ownerUserId) !== ownerUserId) {
      throw new ForbiddenException("Only group owner can remove members.");
    }
    if (memberUserId === ownerUserId) {
      throw new BadRequestException("Owner cannot be removed.");
    }

    const updated = await this.threadRepo.removeMember(threadId, memberUserId);
    if (!updated) {
      throw new NotFoundException("Group not found.");
    }

    return this.toThreadSummary(updated, null, ownerUserId);
  }

  async listThreadsForUser(userId: string): Promise<ChatThreadSummary[]> {
    const threads = await this.threadRepo.findThreadsForUser(userId);
    const summaries = await Promise.all(
      threads.map((thread) => this.toThreadSummary(thread, null, userId)),
    );
    return summaries;
  }

  async listMessages(
    userId: string,
    threadId: string,
  ): Promise<ChatThreadMessagesResponse> {
    const thread = await this.threadRepo.findById(threadId);
    if (!thread) {
      throw new NotFoundException("Thread not found.");
    }
    if (!thread.memberUserIds.map(String).includes(userId)) {
      throw new ForbiddenException("You are not part of this conversation.");
    }

    const messages = await this.messageRepo.findByThread(threadId);
    const mapped = await Promise.all(
      messages.map((m) => this.toMessageResponse(m)),
    );

    return {
      threadId,
      threadName: thread.name ?? null,
      messages: mapped,
    };
  }

  private async toThreadSummary(
    thread: IChatThread,
    newMessage: IChatMessage | null,
    viewerUserId?: string,
  ): Promise<ChatThreadSummary> {
    const threadId = (thread._id as any).toString();

    let lastMessage = newMessage;
    if (!lastMessage) {
      lastMessage = await this.messageRepo.findLastByThread(threadId);
    }

    const last = lastMessage ? await this.toMessageResponse(lastMessage) : null;

    let directPeer: ChatThreadSummary["directPeer"] = null;
    if (thread.type === "direct" && viewerUserId) {
      const peerId =
        thread.memberUserIds.map(String).find((id) => id !== viewerUserId) ||
        thread.memberUserIds.map(String)[0];
      if (peerId) {
        try {
          directPeer = await this.userService.getProfile(peerId);
        } catch {
          directPeer = null;
        }
      }
    }

    return {
      _id: threadId,
      type: thread.type,
      name: thread.name ?? null,
      avatarUrl: thread.avatarUrl ?? null,
      ownerUserId: thread.ownerUserId ? thread.ownerUserId.toString() : null,
      memberUserIds: thread.memberUserIds.map((m) => m.toString()),
      memberCount: thread.memberUserIds.length,
      directPeer,
      lastMessage: last,
      updatedAt: thread.updatedAt,
      createdAt: thread.createdAt,
    };
  }

  private async toMessageResponse(
    message: IChatMessage,
  ): Promise<ChatMessageResponse> {
    const messageId = (message._id as any).toString();
    const threadId = (message.threadId as any).toString();
    const senderId = (message.senderUserId as any).toString();

    let sender = null;
    try {
      sender = await this.userService.getProfile(senderId);
    } catch {
      sender = null;
    }

    return {
      _id: messageId,
      threadId,
      senderUserId: senderId,
      type: message.type,
      text: message.text ?? null,
      imageUrl: message.imageUrl ?? null,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
      sender,
    };
  }
}
