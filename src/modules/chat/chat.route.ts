import { ROLES } from "@/constants/app.constants";
import { asyncHandler } from "@/middlewares/async-handler.middleware";
import { authMiddleware } from "@/middlewares/auth.middleware";
import { PaginationHelper } from "@/utils/pagination-helper";
import { ApiResponse } from "@/utils/response.utils";
import { zParse } from "@/utils/validators.utils";
import { Router } from "express";
import { createDirectSchema, createGroupSchema } from "./chat.schema";
import { ChatService } from "./chat.service";

const router = Router();
const service = new ChatService();

router.use(authMiddleware.verifyToken, authMiddleware.authorize(ROLES.GOLFER));

router.get(
  "/threads",
  asyncHandler(async (req, res) => {
    const userId = req.user!.userId;
    const threads = await service.listThreadsForUser(userId);
    ApiResponse.success(res, threads, "Threads fetched successfully");
  }),
);

router.get(
  "/threads/:threadId/messages",
  asyncHandler(async (req, res) => {
    const userId = req.user!.userId;
    const { page = 1, limit = 50 } = PaginationHelper.parsePaginationParams(
      req.query,
    );
    const messages = await service.listMessages(
      userId,
      req.params.threadId,
      page,
      limit,
    );
    ApiResponse.paginated(
      res,
      messages,
      { page, limit, total: messages.length },
      "Messages fetched successfully",
    );
  }),
);

router.post(
  "/threads/direct",
  asyncHandler(async (req, res) => {
    const userId = req.user!.userId;
    const validated = await zParse(createDirectSchema, req);
    const thread = await service.ensureDirectThread(
      userId,
      validated.body.golferUserId,
    );
    ApiResponse.success(res, thread, "Direct thread ready");
  }),
);

router.post(
  "/threads/group",
  asyncHandler(async (req, res) => {
    const userId = req.user!.userId;
    const validated = await zParse(createGroupSchema, req);
    const thread = await service.createGroup(userId, validated.body);
    ApiResponse.created(res, thread, "Group created successfully");
  }),
);

export default router;
