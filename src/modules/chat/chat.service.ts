import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@/utils/app-error.utils";
import { SocialFollowRepository } from "../social-feed/social-feed.repository";
import { UserService } from "../user/user.service";
import type { IChatMessage, IChatThread } from "./chat.interface";
import { ChatMessageRepository, ChatThreadRepository } from "./chat.repository";
import type {
  ChatMessageResponse,
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

  constructor() {
    this.threadRepo = new ChatThreadRepository();
    this.messageRepo = new ChatMessageRepository();
    this.followRepo = new SocialFollowRepository();
    this.userService = new UserService();
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
    const name = payload.name?.trim();
    if (!name) {
      throw new BadRequestException("Group name is required.");
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
  ): Promise<ChatMessageResponse[]> {
    const thread = await this.threadRepo.findById(threadId);
    if (!thread) {
      throw new NotFoundException("Thread not found.");
    }
    if (!thread.memberUserIds.map(String).includes(userId)) {
      throw new ForbiddenException("You are not part of this conversation.");
    }

    const messages = await this.messageRepo.findByThread(threadId);
    return Promise.all(messages.map((m) => this.toMessageResponse(m)));
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
