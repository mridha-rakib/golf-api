import authRouter from "@/modules/auth/auth.route";
import golfClubRouter from "@/modules/golf-club/golf-club.route";
import chatRouter from "@/modules/chat/chat.route";
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
    route: golfClubRouter,
  },
  {
    path: "/chat",
    route: chatRouter,
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
