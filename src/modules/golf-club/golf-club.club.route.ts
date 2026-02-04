import { ROLES } from "@/constants/app.constants";
import { authMiddleware } from "@/middlewares/auth.middleware";
import { Router } from "express";
import { GolfClubController } from "./golf-club.controller";

const router = Router();
const controller = new GolfClubController();

router.get(
  "/me/roles",
  authMiddleware.verifyToken,
  authMiddleware.authorize(ROLES.GOLF_CLUB),
  controller.getMyClubRoles,
);

export default router;
