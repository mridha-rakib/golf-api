import { MESSAGES, ROLES } from "@/constants/app.constants";
import { asyncHandler } from "@/middlewares/async-handler.middleware";
import { UnauthorizedException } from "@/utils/app-error.utils";
import { ApiResponse } from "@/utils/response.utils";
import { zParse } from "@/utils/validators.utils";
import type { Request, Response } from "express";
import { listNotificationsSchema } from "./notification.schema";
import { NotificationService } from "./notification.service";

export class NotificationController {
  private notificationService: NotificationService;

  constructor() {
    this.notificationService = new NotificationService();
  }

  listMyNotifications = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException(MESSAGES.AUTH.UNAUTHORIZED_ACCESS);
    }

    if (
      ![
        ROLES.ADMIN,
        ROLES.GOLF_CLUB,
        ROLES.GOLFER,
      ].includes(req.user?.role as any)
    ) {
      throw new UnauthorizedException(MESSAGES.AUTH.UNAUTHORIZED_ACCESS);
    }

    const validated = await zParse(listNotificationsSchema, req);
    const result = await this.notificationService.listForUser(
      userId,
      validated.query,
    );

    ApiResponse.paginated(
      res,
      result.data,
      result.pagination,
      "Notifications fetched successfully",
    );
  });
}
