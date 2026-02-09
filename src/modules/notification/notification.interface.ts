import type { Document, Types } from "mongoose";

export type NotificationType =
  | "FOLLOW"
  | "CLUB_MEMBER_ASSIGNED"
  | "CLUB_MANAGER_ASSIGNED"
  | "NEW_USER_REGISTERED"
  | "CLUB_CREATED"
  | "DAILY_SUMMARY";

export interface INotification extends Document {
  recipientUserId: Types.ObjectId;
  actorUserId?: Types.ObjectId | null;
  type: NotificationType;
  message: string;
  metadata?: Record<string, any> | null;
  isRead: boolean;
  readAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
