import type { Document, Types } from "mongoose";

export type ChatThreadType = "direct" | "group";

export interface IChatThread extends Document {
  type: ChatThreadType;
  clubId?: Types.ObjectId | null;
  memberUserIds: Types.ObjectId[];
  ownerUserId?: Types.ObjectId | null;
  name?: string | null;
  avatarUrl?: string | null;
  directKey?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type ChatMessageType = "text" | "image";

export interface IChatMessage extends Document {
  threadId: Types.ObjectId;
  senderUserId: Types.ObjectId;
  type: ChatMessageType;
  text?: string | null;
  imageUrl?: string | null;
  mentionedUserIds?: Types.ObjectId[];
  reactions?: Array<{
    userId: Types.ObjectId;
    emoji: string;
    reactedAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}
