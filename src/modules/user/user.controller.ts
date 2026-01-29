// file: src/modules/user/user.controller.ts

import { MESSAGES, ROLES } from "@/constants/app.constants";
import { asyncHandler } from "@/middlewares/async-handler.middleware";
import {
  BadRequestException,
  UnauthorizedException,
} from "@/utils/app-error.utils";
import { ApiResponse } from "@/utils/response.utils";
import { zParse } from "@/utils/validators.utils";
import type { Request, Response } from "express";
import { updateUserSchema } from "./user.schema";
import { UserService } from "./user.service";

export class UserController {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  getProfile = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException(MESSAGES.AUTH.UNAUTHORIZED_ACCESS);
    }
    const profile = await this.userService.getProfile(userId);

    ApiResponse.success(res, profile, "Profile fetched successfully");
  });

  updateProfile = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException(MESSAGES.AUTH.UNAUTHORIZED_ACCESS);
    }

    if (req.user?.role !== ROLES.GOLFER) {
      throw new UnauthorizedException(MESSAGES.AUTH.UNAUTHORIZED_ACCESS);
    }

    const validated = await zParse(updateUserSchema, req);

    const files = req.files as
      | {
          profileImage?: Express.MulterS3.File[];
          coverImage?: Express.MulterS3.File[];
          profileImageUrl?: Express.MulterS3.File[];
          coverImageUrl?: Express.MulterS3.File[];
        }
      | undefined;

    const profileImageFile =
      files?.profileImage?.[0] || files?.profileImageUrl?.[0];
    const coverImageFile =
      files?.coverImage?.[0] || files?.coverImageUrl?.[0];

    const bodyProfileUrl =
      typeof validated.body.profileImageUrl === "string"
        ? validated.body.profileImageUrl
        : undefined;
    const bodyCoverUrl =
      typeof validated.body.coverImageUrl === "string"
        ? validated.body.coverImageUrl
        : undefined;

    const profileImageUrl =
      profileImageFile?.location ||
      (profileImageFile as any)?.path ||
      bodyProfileUrl;
    const coverImageUrl =
      coverImageFile?.location ||
      (coverImageFile as any)?.path ||
      bodyCoverUrl;

    const updated = await this.userService.updateProfile(userId, {
      ...validated.body,
      profileImageUrl,
      coverImageUrl,
    });

    ApiResponse.success(res, updated, MESSAGES.USER.USER_UPDATED);
  });

  uploadProfileImage = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException(MESSAGES.AUTH.UNAUTHORIZED_ACCESS);
    }

    if (req.user?.role !== ROLES.GOLFER) {
      throw new UnauthorizedException(MESSAGES.AUTH.UNAUTHORIZED_ACCESS);
    }

    const file = req.file as Express.MulterS3.File | undefined;
    const imageUrl = file?.location || (file as any)?.path;

    if (!imageUrl) {
      throw new BadRequestException("Profile image file is required.");
    }

    const updated = await this.userService.updateProfileImage(userId, imageUrl);

    ApiResponse.success(res, updated, "Profile image updated successfully");
  });

  uploadCoverImage = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException(MESSAGES.AUTH.UNAUTHORIZED_ACCESS);
    }

    if (req.user?.role !== ROLES.GOLFER) {
      throw new UnauthorizedException(MESSAGES.AUTH.UNAUTHORIZED_ACCESS);
    }

    const file = req.file as Express.MulterS3.File | undefined;
    const imageUrl = file?.location || (file as any)?.path;

    if (!imageUrl) {
      throw new BadRequestException("Cover image file is required.");
    }

    const updated = await this.userService.updateCoverImage(userId, imageUrl);

    ApiResponse.success(res, updated, "Cover image updated successfully");
  });

  getFollowers = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException(MESSAGES.AUTH.UNAUTHORIZED_ACCESS);
    }

    if (req.user?.role !== ROLES.GOLFER) {
      throw new UnauthorizedException(MESSAGES.AUTH.UNAUTHORIZED_ACCESS);
    }

    const followers = await this.userService.listFollowers(userId);
    ApiResponse.success(res, followers, "Followers fetched successfully");
  });

  getFollowing = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException(MESSAGES.AUTH.UNAUTHORIZED_ACCESS);
    }

    if (req.user?.role !== ROLES.GOLFER) {
      throw new UnauthorizedException(MESSAGES.AUTH.UNAUTHORIZED_ACCESS);
    }

    const following = await this.userService.listFollowing(userId);
    ApiResponse.success(res, following, "Following fetched successfully");
  });
}
