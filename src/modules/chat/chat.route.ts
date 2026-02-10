import upload from "@/config/multer.config";
import { ROLES } from "@/constants/app.constants";
import { asyncHandler } from "@/middlewares/async-handler.middleware";
import { authMiddleware } from "@/middlewares/auth.middleware";
import { BadRequestException } from "@/utils/app-error.utils";
import { ApiResponse } from "@/utils/response.utils";
import { zParse } from "@/utils/validators.utils";
import { Router, type RequestHandler } from "express";
import {
  createDirectSchema,
  createGroupSchema,
  reactToMessageSchema,
} from "./chat.schema";
import { ChatService } from "./chat.service";

const router = Router();
const service = new ChatService();

router.use(authMiddleware.verifyToken);
const golferOnly = authMiddleware.authorize(ROLES.GOLFER);
const golferOrClub = authMiddleware.authorize(ROLES.GOLFER, ROLES.GOLF_CLUB);

const normalizeGroupBody = (req: any) => {
  const body = req.body ?? {};

  if (typeof body.memberUserIds === "string") {
    const raw = body.memberUserIds.trim();
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        body.memberUserIds = Array.isArray(parsed)
          ? parsed
            : String(parsed)
              .split(",")
              .map((v: string) => v.trim())
              .filter(Boolean);
      } catch {
        body.memberUserIds = raw
          .split(",")
          .map((v: string) => v.trim())
          .filter(Boolean);
      }
    }
  }

  if (Array.isArray(body.memberUserIds)) {
    body.memberUserIds = body.memberUserIds
      .map((v: any) => String(v).trim())
      .filter(Boolean);
  }

  const file = req.file as Express.MulterS3.File | undefined;
  const avatarUrl = file?.location || (file as any)?.path;
  if (avatarUrl) {
    body.avatarUrl = avatarUrl;
  }

  req.body = body;
};

const optionalGroupUpload: RequestHandler = (req, res, next) => {
  const contentType = req.headers["content-type"] || "";
  if (contentType.includes("multipart/form-data")) {
    return upload.single("avatar")(req, res, (err) => {
      if (err) return next(err);
      normalizeGroupBody(req);
      next();
    });
  }

  normalizeGroupBody(req);
  return next();
};

router.get(
  "/threads",
  golferOrClub,
  asyncHandler(async (req, res) => {
    const userId = req.user!.userId;

    const typeRaw = typeof req.query.type === "string" ? req.query.type : "";
    const type = typeRaw.trim();
    if (type && type !== "direct" && type !== "group") {
      throw new BadRequestException(
        "Invalid thread type. Use `direct` or `group`.",
      );
    }

    const threads = await service.listThreadsForUserFiltered(userId, {
      type: (type as any) || undefined,
    });
    ApiResponse.success(res, threads, "Threads fetched successfully");
  }),
);

router.get(
  "/threads/club/:clubId",
  golferOrClub,
  asyncHandler(async (req, res) => {
    const userId = req.user!.userId;
    const threads = await service.listThreadsForClub(userId, req.params.clubId);
    ApiResponse.success(res, threads, "Club threads fetched");
  }),
);

router.get(
  "/threads/:threadId/messages",
  golferOrClub,
  asyncHandler(async (req, res) => {
    const userId = req.user!.userId;
    const messages = await service.listMessages(userId, req.params.threadId);
    ApiResponse.success(res, messages, "Messages fetched successfully");
  }),
);

router.patch(
  "/messages/:messageId/reaction",
  golferOrClub,
  asyncHandler(async (req, res) => {
    const userId = req.user!.userId;
    const validated = await zParse(reactToMessageSchema, req);
    const result = await service.reactToMessage(
      userId,
      validated.params.messageId,
      validated.body.emoji,
    );
    ApiResponse.success(res, result, "Reaction updated");
  }),
);

router.post(
  "/threads/direct",
  golferOnly,
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
  golferOrClub,
  optionalGroupUpload,
  asyncHandler(async (req, res) => {
    const userId = req.user!.userId;
    const validated = await zParse(createGroupSchema, req);
    const thread = await service.createGroup(userId, validated.body);
    ApiResponse.created(res, thread, "Group created successfully");
  }),
);

export default router;
