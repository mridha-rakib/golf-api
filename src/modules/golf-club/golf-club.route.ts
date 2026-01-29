import { ROLES } from "@/constants/app.constants";
import { authMiddleware } from "@/middlewares/auth.middleware";
import { Router } from "express";
import upload from "@/config/multer.config";
import { GolfClubController } from "./golf-club.controller";

const router = Router();
const controller = new GolfClubController();

router.use(authMiddleware.verifyToken, authMiddleware.authorize(ROLES.ADMIN));

router.get("/", controller.listGolfClubs);
router.post("/", controller.createGolfClub);
router.put("/:clubId", controller.updateClub);
router.get("/golfers", controller.listGolfers);
router.get("/:clubId/roles", controller.getClubRoles);
router.put("/:clubId/roles", controller.updateClubRoles);
router.post(
  "/:clubId/profile-image",
  upload.single("profileImage"),
  controller.uploadProfileImage
);
router.post(
  "/:clubId/cover-image",
  upload.single("coverImage"),
  controller.uploadCoverImage
);
router.post("/:clubId/manager", controller.assignManager);
router.post("/:clubId/members", controller.addMember);

export default router;
