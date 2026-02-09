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
}
