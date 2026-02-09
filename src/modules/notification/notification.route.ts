import { ROLES } from "@/constants/app.constants";
import { authMiddleware } from "@/middlewares/auth.middleware";
import { Router } from "express";
import { NotificationController } from "./notification.controller";

const router = Router();
const controller = new NotificationController();

router.use(authMiddleware.verifyToken);

router.get(
  "/",
  authMiddleware.authorize(ROLES.ADMIN, ROLES.GOLF_CLUB, ROLES.GOLFER),
  controller.listMyNotifications,
);

export default router;
