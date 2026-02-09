import authRouter from "@/modules/auth/auth.route";
import golfClubClubRouter from "@/modules/golf-club/golf-club.club.route";
import golfClubRouter from "@/modules/golf-club/golf-club.route";
import chatRouter from "@/modules/chat/chat.route";
import notificationRouter from "@/modules/notification/notification.route";
import socialFeedRouter from "@/modules/social-feed/social-feed.route";
import userRouter from "@/modules/user/user.route";

import { Router } from "express";

const router = Router();

const moduleRoutes = [
  {
    path: "/auth",
    route: authRouter,
  },
  {
    path: "/golf-clubs",
    route: golfClubClubRouter,
  },
  {
    path: "/golf-clubs",
    route: golfClubRouter,
  },
  {
    path: "/chat",
    route: chatRouter,
  },
  {
    path: "/notifications",
    route: notificationRouter,
  },
  {
    path: "/social-feed",
    route: socialFeedRouter,
  },
  {
    path: "/user",
    route: userRouter,
  },
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));

export default router;
