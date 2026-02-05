import upload from "@/config/multer.config";
import { ROLES } from "@/constants/app.constants";
import { authMiddleware } from "@/middlewares/auth.middleware";
import { Router, type RequestHandler } from "express";
import { SocialFeedController } from "./social-feed.controller";

const router = Router();
const controller = new SocialFeedController();

const optionalMediaUpload: RequestHandler = (req, res, next) => {
  const contentType = req.headers["content-type"] || "";

  if (contentType.includes("multipart/form-data")) {
    return upload.array("media", 10)(req, res, next);
  }

  (req as any).files = [];
  return next();
};

router.use(authMiddleware.verifyToken);
const golferOnly = authMiddleware.authorize(ROLES.GOLFER);
const golferOrClub = authMiddleware.authorize(ROLES.GOLFER, ROLES.GOLF_CLUB);

router.post("/follow/:golferUserId", golferOnly, controller.toggleFollow);
router.get("/golfers/following", controller.listFollowingGolfers);
router.get("/golfers", golferOrClub, controller.listGolfers);

router.post("/posts", golferOrClub, optionalMediaUpload, controller.createPost);
router.post("/posts/:postId/share", golferOrClub, controller.sharePost);
router.post("/posts/:postId/react", golferOrClub, controller.toggleReaction);
router.post("/posts/:postId/view", golferOrClub, controller.incrementView);
router.post("/posts/:postId/comments", golferOrClub, controller.addComment);
router.post(
  "/comments/:commentId/replies",
  golferOrClub,
  controller.replyToComment,
);

router.get("/profile", golferOrClub, controller.getMyProfile);
router.get("/feed", golferOrClub, controller.listFeed);
router.get("/posts", golferOrClub, controller.listMyPosts);
router.get("/media", golferOrClub, controller.listMyMedia);
router.get("/comments", golferOrClub, controller.listMyComments);
router.get(
  "/golfers/:golferUserId/profile",
  golferOrClub,
  controller.getGolferProfile,
);
router.get(
  "/golfers/:golferUserId/media",
  golferOrClub,
  controller.listGolferMedia,
);
router.get("/posts/:postId", golferOrClub, controller.getPostDetails);

export default router;
