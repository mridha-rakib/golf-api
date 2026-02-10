import type { UserResponse } from "@/modules/user/user.type";
import type { ChatMessageType, ChatThreadType } from "./chat.interface";

export type ChatThreadSummary = {
  _id: string;
  type: ChatThreadType;
  clubId?: string | null;
  name?: string | null;
  avatarUrl?: string | null;
  ownerUserId?: string | null;
  memberUserIds: string[];
  memberCount?: number;
  directPeer?: UserResponse | null;
  lastMessage?: ChatMessageResponse | null;
  updatedAt: Date;
  createdAt: Date;
};

export type ChatMessageResponse = {
  _id: string;
  threadId: string;
  senderUserId: string;
  type: ChatMessageType;
  text?: string | null;
  imageUrl?: string | null;
  mentionedUserIds?: string[];
  reactions?: Array<{
    userId: string;
    emoji: string;
    reactedAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
  sender?: UserResponse | null;
};

export type ChatThreadMessagesResponse = {
  threadId: string;
  threadName?: string | null;
  messages: ChatMessageResponse[];
};

export type SendDirectMessagePayload = {
  toGolferUserId: string;
  type: ChatMessageType;
  text?: string;
  imageUrl?: string;
};

export type SendGroupMessagePayload = {
  threadId: string;
  type: ChatMessageType;
  text?: string;
  imageUrl?: string;
};

export type SendThreadMessagePayload = {
  threadId: string;
  type: ChatMessageType;
  text?: string;
  imageUrl?: string;
};

export type CreateGroupPayload = {
  name: string;
  clubId?: string;
  avatarUrl?: string;
  memberUserIds?: string[];
};

export type ReactToMessagePayload = {
  emoji: string;
};
