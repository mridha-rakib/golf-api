import { BaseSchemaUtil } from "@/utils/base-schema.utils";
import { Schema, model } from "mongoose";
import type { INotification, NotificationType } from "./notification.interface";

const notificationSchema = BaseSchemaUtil.createSchema<INotification>({
  recipientUserId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  actorUserId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    default: null,
    index: true,
  },
  type: {
    type: String,
    enum: [
      "FOLLOW",
      "CHAT_MESSAGE",
      "CLUB_MEMBER_ASSIGNED",
      "CLUB_MANAGER_ASSIGNED",
      "NEW_USER_REGISTERED",
      "CLUB_CREATED",
      "DAILY_SUMMARY",
    ] satisfies NotificationType[],
    required: true,
    index: true,
  },
  message: {
    type: String,
    required: true,
    trim: true,
  },
  metadata: {
    type: Schema.Types.Mixed,
    default: null,
  },
  isRead: {
    type: Boolean,
    default: false,
    index: true,
  },
  readAt: {
    type: Date,
    default: null,
  },
});

notificationSchema.index({ recipientUserId: 1, createdAt: -1 });

export const Notification = model<INotification>(
  "Notification",
  notificationSchema,
);
