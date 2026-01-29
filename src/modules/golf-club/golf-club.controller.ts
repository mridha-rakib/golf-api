import { MESSAGES } from "@/constants/app.constants";
import { asyncHandler } from "@/middlewares/async-handler.middleware";
import {
  BadRequestException,
  UnauthorizedException,
} from "@/utils/app-error.utils";
import { ApiResponse } from "@/utils/response.utils";
import { zParse } from "@/utils/validators.utils";
import type { Request, Response } from "express";
import {
  addClubMemberSchema,
  assignClubManagerSchema,
  clubImageParamsSchema,
  clubRolesParamsSchema,
  clubRolesSchema,
  createGolfClubSchema,
  updateGolfClubSchema,
} from "./golf-club.schema";
import { GolfClubService } from "./golf-club.service";

export class GolfClubController {
  private golfClubService: GolfClubService;

  constructor() {
    this.golfClubService = new GolfClubService();
  }

  createGolfClub = asyncHandler(async (req: Request, res: Response) => {
    const validated = await zParse(createGolfClubSchema, req);
    const adminEmail = req.user?.email;
    if (!adminEmail) {
      throw new UnauthorizedException(MESSAGES.AUTH.UNAUTHORIZED_ACCESS);
    }

    const result = await this.golfClubService.createGolfClub(
      validated.body,
      adminEmail,
    );

    ApiResponse.created(res, result, "Golf club created successfully");
  });

  listGolfers = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.golfClubService.listGolfers();
    ApiResponse.success(res, result, "Golfers fetched successfully");
  });

  listGolfClubs = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.golfClubService.listGolfClubs();
    ApiResponse.success(res, result, "Golf clubs fetched successfully");
  });

  getClubRoles = asyncHandler(async (req: Request, res: Response) => {
    const validated = await zParse(clubRolesParamsSchema, req);
    const result = await this.golfClubService.getClubRoles(
      validated.params.clubId
    );
    ApiResponse.success(res, result, "Club roles fetched successfully");
  });

  updateClubRoles = asyncHandler(async (req: Request, res: Response) => {
    const validated = await zParse(clubRolesSchema, req);
    const result = await this.golfClubService.updateClubRoles({
      clubId: validated.params.clubId,
      managerIds: validated.body.managerIds,
      memberIds: validated.body.memberIds,
    });
    ApiResponse.success(res, result, "Club roles updated successfully");
  });

  assignManager = asyncHandler(async (req: Request, res: Response) => {
    const validated = await zParse(assignClubManagerSchema, req);
    const result = await this.golfClubService.assignManager({
      clubId: validated.params.clubId,
      golferUserId: validated.body.golferUserId,
    });

    ApiResponse.success(res, result, "Club manager assigned successfully");
  });

  addMember = asyncHandler(async (req: Request, res: Response) => {
    const validated = await zParse(addClubMemberSchema, req);
    const result = await this.golfClubService.addMember({
      clubId: validated.params.clubId,
      golferUserId: validated.body.golferUserId,
    });

    ApiResponse.created(res, result, "Club member added successfully");
  });

  updateClub = asyncHandler(async (req: Request, res: Response) => {
    const validated = await zParse(updateGolfClubSchema, req);
    const result = await this.golfClubService.updateClubDetails(
      validated.params.clubId,
      validated.body
    );
    ApiResponse.success(res, result, "Club profile updated successfully");
  });

  uploadProfileImage = asyncHandler(async (req: Request, res: Response) => {
    const validated = await zParse(clubImageParamsSchema, req);
    const file = req.file as Express.MulterS3.File | undefined;
    const imageUrl = file?.location || (file as any)?.path;
    if (!imageUrl) {
      throw new BadRequestException("Profile image file is required.");
    }
    const result = await this.golfClubService.updateProfileImage(
      validated.params.clubId,
      imageUrl
    );
    ApiResponse.success(res, result, "Club profile image updated successfully");
  });

  uploadCoverImage = asyncHandler(async (req: Request, res: Response) => {
    const validated = await zParse(clubImageParamsSchema, req);
    const file = req.file as Express.MulterS3.File | undefined;
    const imageUrl = file?.location || (file as any)?.path;
    if (!imageUrl) {
      throw new BadRequestException("Cover image file is required.");
    }
    const result = await this.golfClubService.updateCoverImage(
      validated.params.clubId,
      imageUrl
    );
    ApiResponse.success(res, result, "Club cover image updated successfully");
  });
}
