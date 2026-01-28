import { BaseRepository } from "@/modules/base/base.repository";
import type { ChatThreadType } from "./chat.interface";
import { ChatMessage, ChatThread } from "./chat.model";
import type { IChatMessage, IChatThread } from "./chat.interface";

export class ChatThreadRepository extends BaseRepository<IChatThread> {
  constructor() {
    super(ChatThread);
  }

  async findDirectThreadBetween(
    userA: string,
    userB: string
  ): Promise<IChatThread | null> {
    const directKey = this.buildDirectKey(userA, userB);
    return this.model.findOne({ type: "direct", directKey }).exec();
  }

  buildDirectKey(userA: string, userB: string) {
    return [userA, userB].sort().join("|");
  }

  async findThreadsForUser(userId: string): Promise<IChatThread[]> {
    return this.model
      .find({ memberUserIds: userId })
      .sort({ updatedAt: -1 })
      .exec();
  }

  async addMembers(threadId: string, memberIds: string[]): Promise<IChatThread | null> {
    return this.model
      .findByIdAndUpdate(
        threadId,
        { $addToSet: { memberUserIds: { $each: memberIds } } },
        { new: true }
      )
      .exec();
  }

  async removeMember(threadId: string, memberId: string): Promise<IChatThread | null> {
    return this.model
      .findByIdAndUpdate(
        threadId,
        { $pull: { memberUserIds: memberId } },
        { new: true }
      )
      .exec();
  }

  async touch(threadId: string): Promise<void> {
    await this.model
      .findByIdAndUpdate(threadId, { updatedAt: new Date() })
      .lean()
      .exec();
  }
}

export class ChatMessageRepository extends BaseRepository<IChatMessage> {
  constructor() {
    super(ChatMessage);
  }

  async findByThread(
    threadId: string,
    page = 1,
    limit = 50
  ): Promise<IChatMessage[]> {
    const skip = Math.max(0, (page - 1) * limit);
    return this.model
      .find({ threadId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();
  }

  async findLastByThread(threadId: string): Promise<IChatMessage | null> {
    return this.model.findOne({ threadId }).sort({ createdAt: -1 }).exec();
  }
}
