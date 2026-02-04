import { BaseRepository } from "@/modules/base/base.repository";
import type { IChatMessage, IChatThread } from "./chat.interface";
import { ChatMessage, ChatThread } from "./chat.model";

export class ChatThreadRepository extends BaseRepository<IChatThread> {
  private static typeIndexChecked = false;

  constructor() {
    super(ChatThread);
  }

  async findDirectThreadBetween(
    userA: string,
    userB: string,
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
      .sort({ updatedAt: 1 })
      .exec();
  }

  async dropUniqueTypeIndexIfPresent(): Promise<void> {
    if (ChatThreadRepository.typeIndexChecked) {
      return;
    }

    ChatThreadRepository.typeIndexChecked = true;

    try {
      const indexes = await this.model.collection.indexes();
      const indexesToDrop = indexes.filter((index) => {
        if (!index.unique) return false;
        if (index.name === "_id_") return false;
        const keys = index.key ?? {};
        const keyNames = Object.keys(keys);

        if (keyNames.length === 1 && keyNames[0] === "type") {
          return true;
        }

        if (keyNames.includes("type") && keyNames.includes("directKey")) {
          const partial = index.partialFilterExpression as
            | Record<string, any>
            | undefined;
          if (partial && partial.type === "direct") {
            return false;
          }
          return true;
        }

        return false;
      });

      for (const index of indexesToDrop) {
        if (index.name) {
          await this.model.collection.dropIndex(index.name);
        }
      }
    } catch {
      ChatThreadRepository.typeIndexChecked = false;
    }
  }

  async addMembers(
    threadId: string,
    memberIds: string[],
  ): Promise<IChatThread | null> {
    return this.model
      .findByIdAndUpdate(
        threadId,
        { $addToSet: { memberUserIds: { $each: memberIds } } },
        { new: true },
      )
      .exec();
  }

  async findGroupThreadsByOwner(
    ownerUserId: string,
  ): Promise<IChatThread[]> {
    return this.model.find({ type: "group", ownerUserId }).exec();
  }

  async removeMember(
    threadId: string,
    memberId: string,
  ): Promise<IChatThread | null> {
    return this.model
      .findByIdAndUpdate(
        threadId,
        { $pull: { memberUserIds: memberId } },
        { new: true },
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

  async findByThread(threadId: string): Promise<IChatMessage[]> {
    return this.model.find({ threadId }).sort({ createdAt: 1 }).exec();
  }

  async findLastByThread(threadId: string): Promise<IChatMessage | null> {
    return this.model.findOne({ threadId }).sort({ createdAt: 1 }).exec();
  }
}
