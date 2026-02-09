import type { UserResponse } from "@/modules/user/user.type";
import type { NotificationType } from "./notification.interface";

export type NotificationResponse = {
  _id: string;
  type: NotificationType;
  message: string;
  recipientUserId: string;
  actorUserId?: string | null;
  actor?: UserResponse | null;
  metadata?: Record<string, any> | null;
  isRead: boolean;
  readAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
