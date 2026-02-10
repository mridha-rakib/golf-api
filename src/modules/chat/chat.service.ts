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
import type { ChatThreadType, IChatMessage, IChatThread } from "./chat.interface";
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

  private extractMentionHandles(text: string): string[] {
    const unique = new Set<string>();
    const raw = (text ?? "").trim();
    if (!raw) return [];

    // Match @username where @ is preceded by start or a non-word char to avoid emails like test@example.com.
    const mentionRegex = /(^|[^\w])@([A-Za-z0-9_.-]{1,50})/g;
    let match: RegExpExecArray | null = null;

    while ((match = mentionRegex.exec(raw)) !== null) {
      const handle = (match[2] || "").trim();
      if (!handle) continue;
      unique.add(handle);
      if (unique.size >= 25) break;
    }

    return Array.from(unique);
  }

  private async resolveMentionedUserIds(
    text: string | undefined,
    allowedUserIdSet: Set<string>,
  ): Promise<Types.ObjectId[]> {
    const handles = this.extractMentionHandles(text ?? "");
    if (handles.length === 0) return [];

    const golfers = await this.userService.findGolfersByMentionHandles(handles);
    return golfers
      .filter((golfer) => allowedUserIdSet.has(golfer._id.toString()))
      .map((golfer) => golfer._id);
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
    clubId: string;
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

    return { clubName: club.name, clubId: club._id.toString(), memberUserIds };
  }

  private async assertGolferInClub(
    clubId: string,
    golferUserId: string,
  ): Promise<{ clubName: string; clubUserId: string }> {
    const club = await this.golfClubRepository.findById(clubId);
    if (!club) {
      throw new NotFoundException("Golf club not found.");
    }

    const managerId = club.managerUserId?.toString();
    if (managerId && managerId === golferUserId) {
      return { clubName: club.name, clubUserId: club.clubUserId.toString() };
    }

    const [assignment, member] = await Promise.all([
      this.golfClubRoleRepository.findOne({
        clubId: club._id,
        golferUserId,
      } as any),
      this.golfClubMemberRepository.findByClubAndGolfer(
        clubId,
        golferUserId,
      ),
    ]);

    if (!assignment && !member) {
      throw new ForbiddenException("You are not a member of this club.");
    }

    return { clubName: club.name, clubUserId: club.clubUserId.toString() };
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

    const allowedMentionUsers = new Set([senderUserId, payload.toGolferUserId]);
    const mentionedUserIds = await this.resolveMentionedUserIds(
      payload.text,
      allowedMentionUsers,
    );

    const message = await this.messageRepo.create({
      threadId: thread._id,
      senderUserId,
      type: payload.type,
      text: payload.text,
      imageUrl: payload.imageUrl,
      mentionedUserIds,
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

    const allowedMentionUsers = new Set(thread.memberUserIds.map(String));
    const mentionedUserIds = await this.resolveMentionedUserIds(
      payload.text,
      allowedMentionUsers,
    );

    const message = await this.messageRepo.create({
      threadId: thread._id,
      senderUserId,
      type: payload.type,
      text: payload.text,
      imageUrl: payload.imageUrl,
      mentionedUserIds,
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

    const allowedMentionUsers = new Set(thread.memberUserIds.map(String));
    const mentionedUserIds = await this.resolveMentionedUserIds(
      payload.text,
      allowedMentionUsers,
    );

    const message = await this.messageRepo.create({
      threadId: thread._id,
      senderUserId,
      type: payload.type,
      text: payload.text,
      imageUrl: payload.imageUrl,
      mentionedUserIds,
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
      const { clubName, clubId, memberUserIds } =
        await this.resolveClubMembers(ownerUserId);
      const requested = Array.from(new Set(payload.memberUserIds ?? []));
      const allowed = new Set(memberUserIds);
      const filteredRequested = requested.filter((id) => allowed.has(id));
      const members = Array.from(
        new Set([ownerUserId, ...(filteredRequested.length > 0 ? filteredRequested : memberUserIds)]),
      );

      const thread = await this.threadRepo.create({
        type: "group",
        name: name || `${clubName} Club`,
        avatarUrl: payload.avatarUrl,
        ownerUserId,
        memberUserIds: members,
        clubId: new Types.ObjectId(clubId),
      } as any);

      return this.toThreadSummary(thread, null, ownerUserId);
    }

    if (!payload.clubId) {
      throw new BadRequestException("Club id is required for group chats.");
    }

    const { clubName, clubUserId } = await this.assertGolferInClub(
      payload.clubId,
      ownerUserId,
    );

    const { memberUserIds: clubMembers } =
      await this.resolveClubMembers(clubUserId);
    const allowed = new Set(clubMembers);

    const requested = Array.from(new Set(payload.memberUserIds ?? []));
    const invalidMembers = requested.filter((id) => !allowed.has(id));
    if (invalidMembers.length > 0) {
      throw new ForbiddenException(
        "You can only add golfers from the same club.",
      );
    }

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
      name: name || `${clubName} Group`,
      avatarUrl: payload.avatarUrl,
      ownerUserId,
      memberUserIds: members,
      clubId: new Types.ObjectId(payload.clubId),
    } as any);

    return this.toThreadSummary(thread, null, ownerUserId);
  }

  async createClubGroupThread(
    clubUserId: string,
    threadName?: string,
  ): Promise<ChatThreadSummary> {
    await this.ensureGroupThreadIndexes();
    const { clubName, clubId, memberUserIds } =
      await this.resolveClubMembers(clubUserId);
    const members = Array.from(new Set([clubUserId, ...memberUserIds]));
    const name = (threadName ?? "").trim() || `${clubName} Club`;

    const thread = await this.threadRepo.create({
      type: "group",
      name,
      ownerUserId: clubUserId,
      memberUserIds: members,
      clubId: new Types.ObjectId(clubId),
    } as any);

    return this.toThreadSummary(thread, null, clubUserId);
  }

  async listGroupThreadsForClub(
    viewerUserId: string,
    clubId: string,
  ): Promise<ChatThreadSummary[]> {
    const viewer = await this.userService.getById(viewerUserId);
    if (!viewer) {
      throw new NotFoundException("User not found.");
    }

    if (viewer.role === ROLES.GOLF_CLUB) {
      const club = await this.golfClubRepository.findById(clubId);
      if (!club || club.clubUserId.toString() !== viewerUserId) {
        throw new ForbiddenException("You do not have access to this club.");
      }
    } else if (viewer.role === ROLES.GOLFER) {
      await this.assertGolferInClub(clubId, viewerUserId);
    } else {
      throw new ForbiddenException("You do not have access to this club.");
    }

    const threads = await this.threadRepo.findGroupThreadsForUserByClub(
      viewerUserId,
      clubId,
    );
    return Promise.all(
      threads.map((thread) => this.toThreadSummary(thread, null, viewerUserId)),
    );
  }

  async listThreadsForClub(
    viewerUserId: string,
    clubId: string,
  ): Promise<ChatThreadSummary[]> {
    const viewer = await this.userService.getById(viewerUserId);
    if (!viewer) {
      throw new NotFoundException("User not found.");
    }

    let clubContext: { clubName: string; clubUserId: string } | null = null;

    if (viewer.role === ROLES.GOLF_CLUB) {
      const club = await this.golfClubRepository.findById(clubId);
      if (!club || club.clubUserId.toString() !== viewerUserId) {
        throw new ForbiddenException("You do not have access to this club.");
      }
    } else if (viewer.role === ROLES.GOLFER) {
      clubContext = await this.assertGolferInClub(clubId, viewerUserId);
    } else {
      throw new ForbiddenException("You do not have access to this club.");
    }

    const groupThreads = await this.threadRepo.findGroupThreadsForUserByClub(
      viewerUserId,
      clubId,
    );
    const groupSummaries = await Promise.all(
      groupThreads.map((thread) =>
        this.toThreadSummary(thread, null, viewerUserId),
      ),
    );

    // For clubs, this route returns only club group chats.
    if (viewer.role !== ROLES.GOLFER) {
      return groupSummaries;
    }

    // For golfers, also include 1:1 threads with other golfers in this club only.
    const { memberUserIds: clubMemberUserIds } = await this.resolveClubMembers(
      clubContext!.clubUserId,
    );
    const clubMemberSet = new Set(
      clubMemberUserIds.filter((id) => id !== viewerUserId),
    );

    const directThreads = await this.threadRepo.findThreadsForUserByType(
      viewerUserId,
      "direct",
    );
    const directForClub = directThreads.filter((thread) => {
      const members = (thread.memberUserIds ?? []).map(String);
      const peerId = members.find((id) => id !== viewerUserId) ?? null;
      return Boolean(peerId && clubMemberSet.has(peerId));
    });

    const directSummaries = await Promise.all(
      directForClub.map((thread) =>
        this.toThreadSummary(thread, null, viewerUserId),
      ),
    );

    return [...groupSummaries, ...directSummaries].sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
    );
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

  async listThreadsForUserFiltered(
    userId: string,
    filter: { type?: ChatThreadType } = {},
  ): Promise<ChatThreadSummary[]> {
    const threads = filter.type
      ? await this.threadRepo.findThreadsForUserByType(userId, filter.type)
      : await this.threadRepo.findThreadsForUser(userId);

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
      clubId: thread.clubId ? thread.clubId.toString() : null,
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
      mentionedUserIds: (message.mentionedUserIds ?? []).map((id) =>
        id.toString(),
      ),
      reactions: (message.reactions ?? []).map((reaction) => ({
        userId: reaction.userId.toString(),
        emoji: reaction.emoji,
        reactedAt: reaction.reactedAt,
      })),
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
      sender,
    };
  }

  async reactToMessage(
    userId: string,
    messageId: string,
    emojiRaw: string,
  ): Promise<{
    action: "set" | "removed";
    message: ChatMessageResponse;
  }> {
    const emoji = (emojiRaw ?? "").trim();
    if (!emoji) {
      throw new BadRequestException("Reaction emoji is required.");
    }
    if (emoji.length > 16) {
      throw new BadRequestException("Reaction emoji is too long.");
    }

    const message = await this.messageRepo.findById(messageId);
    if (!message) {
      throw new NotFoundException("Message not found.");
    }

    const thread = await this.threadRepo.findById(
      (message.threadId as any).toString(),
    );
    if (!thread) {
      throw new NotFoundException("Thread not found.");
    }

    if (!thread.memberUserIds.map(String).includes(userId)) {
      throw new ForbiddenException("You are not a member of this thread.");
    }

    const existing = (message.reactions ?? []).find(
      (r) => r.userId.toString() === userId,
    );

    const actorId = new Types.ObjectId(userId);
    let updated: IChatMessage | null = null;
    let action: "set" | "removed" = "set";

    if (existing && existing.emoji === emoji) {
      updated = await this.messageRepo.removeReaction(messageId, actorId);
      action = "removed";
    } else {
      updated = await this.messageRepo.upsertReaction(messageId, {
        userId: actorId,
        emoji,
        reactedAt: new Date(),
      });
      action = "set";
    }

    if (!updated) {
      throw new NotFoundException("Message not found.");
    }

    return {
      action,
      message: await this.toMessageResponse(updated),
    };
  }
}
