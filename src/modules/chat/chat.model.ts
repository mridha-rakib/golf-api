import { Schema, model, Types } from "mongoose";
import type { ChatMessageType, ChatThreadType, IChatMessage, IChatThread } from "./chat.interface";

const chatThreadSchema = new Schema<IChatThread>(
  {
    type: {
      type: String,
      enum: ["direct", "group"] satisfies ChatThreadType[],
      required: true,
      index: true,
    },
    memberUserIds: {
      type: [Schema.Types.ObjectId],
      required: true,
      ref: "User",
      index: true,
    },
    ownerUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    name: {
      type: String,
      trim: true,
    },
    avatarUrl: {
      type: String,
      trim: true,
    },
    directKey: {
      type: String,
      index: true,
      sparse: true,
      unique: true,
    },
  },
  { timestamps: true }
);

// ensure direct threads are unique through directKey (see directKey unique index)
chatThreadSchema.index({ type: 1, memberUserIds: 1 });

const chatMessageSchema = new Schema<IChatMessage>(
  {
    threadId: {
      type: Schema.Types.ObjectId,
      ref: "ChatThread",
      required: true,
      index: true,
    },
    senderUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["text", "image"] satisfies ChatMessageType[],
      required: true,
    },
    text: {
      type: String,
      trim: true,
    },
    imageUrl: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

chatMessageSchema.index({ threadId: 1, createdAt: -1 });

export const ChatThread = model<IChatThread>("ChatThread", chatThreadSchema);
export const ChatMessage = model<IChatMessage>("ChatMessage", chatMessageSchema);
