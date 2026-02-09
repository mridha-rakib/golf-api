import { PaginationHelper } from "@/utils/pagination-helper";
import type { PaginationQuery, PaginatedResponse } from "@/ts/pagination.types";
import { UserService } from "@/modules/user/user.service";
import { NotificationRepository } from "./notification.repository";
import type { NotificationType } from "./notification.interface";
import type { NotificationResponse } from "./notification.type";
import { ROLES } from "@/constants/app.constants";
import { logger } from "@/middlewares/pino-logger";

type CreateNotificationPayload = {
  recipientUserId: string;
  actorUserId?: string | null;
  type: NotificationType;
  message: string;
  metadata?: Record<string, any> | null;
};

export class NotificationService {
  private repository: NotificationRepository;
  private userService: UserService;

  constructor() {
    this.repository = new NotificationRepository();
    this.userService = new UserService();
  }

  async createNotification(payload: CreateNotificationPayload): Promise<void> {
    await this.repository.create({
      recipientUserId: payload.recipientUserId,
      actorUserId: payload.actorUserId ?? null,
      type: payload.type,
      message: payload.message,
      metadata: payload.metadata ?? null,
    } as any);
  }

  private async notifyAdmins(payload: {
    type: NotificationType;
    message: string;
    actorUserId?: string | null;
    metadata?: Record<string, any> | null;
  }): Promise<void> {
    const admins = await this.userService.getUsersByRole(ROLES.ADMIN);
    if (admins.length === 0) return;

    await Promise.all(
      admins.map((admin) =>
        this.createNotification({
          recipientUserId: admin._id.toString(),
          actorUserId: payload.actorUserId ?? null,
          type: payload.type,
          message: payload.message,
          metadata: payload.metadata ?? null,
        }),
      ),
    );
  }

  async notifyFollow(
    followerUserId: string,
    followingUserId: string,
  ): Promise<void> {
    const actor = await this.userService.getProfile(followerUserId);
    const actorName = actor.fullName || actor.email;
    const message = `${actorName} started following you.`;

    await this.createNotification({
      recipientUserId: followingUserId,
      actorUserId: followerUserId,
      type: "FOLLOW",
      message,
    });
  }

  async notifyClubAssignment(payload: {
    recipientUserId: string;
    clubId: string;
    clubName: string;
    assignedByAdminId: string;
    role: "member" | "manager";
  }): Promise<void> {
    const type =
      payload.role === "manager"
        ? "CLUB_MANAGER_ASSIGNED"
        : "CLUB_MEMBER_ASSIGNED";
    const message =
      payload.role === "manager"
        ? `You've been added as a manager of ${payload.clubName}.`
        : `You've been added as a member of ${payload.clubName}.`;

    await this.createNotification({
      recipientUserId: payload.recipientUserId,
      actorUserId: payload.assignedByAdminId,
      type,
      message,
      metadata: {
        clubId: payload.clubId,
        clubName: payload.clubName,
        assignedByAdminId: payload.assignedByAdminId,
      },
    });
  }

  async notifyAdminNewUser(payload: {
    userId: string;
    name?: string | null;
    email: string;
    role: string;
  }): Promise<void> {
    const nameOrEmail = payload.name?.trim() || payload.email;
    const roleLabel =
      payload.role === ROLES.GOLF_CLUB ? "club" : payload.role;
    const message = `New user registered: ${nameOrEmail} (role: ${roleLabel}).`;

    await this.notifyAdmins({
      type: "NEW_USER_REGISTERED",
      actorUserId: payload.userId,
      message,
      metadata: {
        userId: payload.userId,
        email: payload.email,
        role: payload.role,
      },
    });
  }

  async notifyAdminClubCreated(payload: {
    clubId: string;
    clubName: string;
    clubUserId?: string | null;
  }): Promise<void> {
    const message = `New club created: ${payload.clubName}.`;

    await this.notifyAdmins({
      type: "CLUB_CREATED",
      actorUserId: payload.clubUserId ?? null,
      message,
      metadata: {
        clubId: payload.clubId,
        clubName: payload.clubName,
        clubUserId: payload.clubUserId ?? null,
      },
    });
  }

  async notifyAdminDailySummary(payload: {
    date: Date;
    newUsers: number;
    activeUsers: number;
    clubsCreated: number;
    reports?: number;
  }): Promise<void> {
    const dateLabel = payload.date.toISOString().slice(0, 10);
    const reportsCount = payload.reports ?? 0;
    const message = `Daily summary (${dateLabel}): ${payload.newUsers} new users, ${payload.activeUsers} active users, ${payload.clubsCreated} clubs created, ${reportsCount} reports.`;

    try {
      await this.notifyAdmins({
        type: "DAILY_SUMMARY",
        message,
        metadata: {
          date: dateLabel,
          newUsers: payload.newUsers,
          activeUsers: payload.activeUsers,
          clubsCreated: payload.clubsCreated,
          reports: reportsCount,
        },
      });
    } catch (error) {
      logger.warn({ error }, "Failed to create daily summary notification");
    }
  }

  async listForUser(
    userId: string,
    query: PaginationQuery,
  ): Promise<PaginatedResponse<NotificationResponse>> {
    const { page = 1, limit = 10, sort } =
      PaginationHelper.parsePaginationParams(query);
    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      this.repository.find(
        { recipientUserId: userId },
        { skip, limit, sort: sort as any },
      ),
      this.repository.countByRecipient(userId),
    ]);

    const actorIds = Array.from(
      new Set(
        notifications
          .map((n) => n.actorUserId?.toString())
          .filter((id): id is string => Boolean(id)),
      ),
    );

    const actors = actorIds.length
      ? await this.userService.getUsersByIds(actorIds)
      : [];
    const actorMap = new Map(
      actors.map((actor) => [actor._id.toString(), actor]),
    );

    const data = notifications.map<NotificationResponse>((notification) => {
      const actorId = notification.actorUserId?.toString() ?? null;
      const actor = actorId ? actorMap.get(actorId) : null;

      return {
        _id: notification._id.toString(),
        type: notification.type,
        message: notification.message,
        recipientUserId: notification.recipientUserId.toString(),
        actorUserId: actorId,
        actor: actor ? this.userService.toUserResponse(actor) : null,
        metadata: (notification.metadata as any) ?? null,
        isRead: notification.isRead,
        readAt: notification.readAt ?? null,
        createdAt: notification.createdAt,
        updatedAt: notification.updatedAt,
      };
    });

    return PaginationHelper.buildResponse(data, total, page, limit);
  }
}
