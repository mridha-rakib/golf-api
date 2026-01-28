// file: src/modules/user/user.route.ts

import upload from "@/config/multer.config";
import { ROLES } from "@/constants/app.constants";
import { authMiddleware } from "@/middlewares/auth.middleware";
import { Router } from "express";
import { UserController } from "./user.controller";

const router = Router();
const userController = new UserController();

router.get("/profile", authMiddleware.verifyToken, userController.getProfile);
router.put(
  "/profile",
  authMiddleware.verifyToken,
  authMiddleware.authorize(ROLES.GOLFER),
  userController.updateProfile,
);

router.post(
  "/profile/image-upload",
  authMiddleware.verifyToken,
  authMiddleware.authorize(ROLES.GOLFER),
  upload.single("profileImage"),
  userController.uploadProfileImage,
);

router.post(
  "/profile/cover-upload",
  authMiddleware.verifyToken,
  authMiddleware.authorize(ROLES.GOLFER),
  upload.single("coverImage"),
  userController.uploadCoverImage,
);

router.get(
  "/profile/followers",
  authMiddleware.verifyToken,
  authMiddleware.authorize(ROLES.GOLFER),
  userController.getFollowers,
);

router.get(
  "/profile/following",
  authMiddleware.verifyToken,
  authMiddleware.authorize(ROLES.GOLFER),
  userController.getFollowing,
);

export default router;
