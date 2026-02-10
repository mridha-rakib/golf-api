import { BaseRepository } from "@/modules/base/base.repository";
import type { INotification } from "./notification.interface";
import { Notification } from "./notification.model";

export class NotificationRepository extends BaseRepository<INotification> {
  constructor() {
    super(Notification);
  }

  async countByRecipient(recipientUserId: string): Promise<number> {
    return this.countDocuments({ recipientUserId });
  }

  async countUnreadByRecipient(recipientUserId: string): Promise<number> {
    return this.countDocuments({ recipientUserId, isRead: false });
  }

  async markReadByIdsForRecipient(
    recipientUserId: string,
    notificationIds: string[],
  ): Promise<{ matchedCount: number; modifiedCount: number }> {
    const result = await this.model.updateMany(
      {
        _id: { $in: notificationIds },
        recipientUserId,
        isRead: false,
      },
      {
        $set: { isRead: true, readAt: new Date() },
      },
    );

    return {
      matchedCount: result.matchedCount ?? 0,
      modifiedCount: result.modifiedCount ?? 0,
    };
  }
}
