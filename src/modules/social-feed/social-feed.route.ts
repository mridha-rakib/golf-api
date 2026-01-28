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

router.use(authMiddleware.verifyToken, authMiddleware.authorize(ROLES.GOLFER));

router.post("/follow/:golferUserId", controller.toggleFollow);
router.get("/golfers/following", controller.listFollowingGolfers);
router.get("/golfers", controller.listGolfers);

router.post("/posts", optionalMediaUpload, controller.createPost);
router.post("/posts/:postId/share", controller.sharePost);
router.post("/posts/:postId/react", controller.toggleReaction);
router.post("/posts/:postId/view", controller.incrementView);
router.post("/posts/:postId/comments", controller.addComment);
router.post("/comments/:commentId/replies", controller.replyToComment);

router.get("/profile", controller.getMyProfile);
router.get("/feed", controller.listFeed);
router.get("/posts", controller.listMyPosts);
router.get("/media", controller.listMyMedia);
router.get("/comments", controller.listMyComments);
router.get("/golfers/:golferUserId/profile", controller.getGolferProfile);
router.get("/golfers/:golferUserId/media", controller.listGolferMedia);
router.get("/posts/:postId", controller.getPostDetails);

export default router;
