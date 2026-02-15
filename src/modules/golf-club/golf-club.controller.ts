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
import { logger } from "@/middlewares/pino-logger";
import { UserService } from "@/modules/user/user.service";
import type { MyClubListItem, MyClubsResponse } from "./golf-club.type";

export class GolfClubController {
  private golfClubService: GolfClubService;
  private userService: UserService;

  constructor() {
    this.golfClubService = new GolfClubService();
    this.userService = new UserService();
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

  listMyClubs = asyncHandler(async (req: Request, res: Response) => {
    const golferUserId = req.user?.userId;
    if (!golferUserId) {
      throw new UnauthorizedException(MESSAGES.AUTH.UNAUTHORIZED_ACCESS);
    }

    const [clubsOnly, profile] = await Promise.all([
      this.golfClubService.listClubsForGolfer(golferUserId),
      this.userService.getProfile(golferUserId),
    ]);

    // For the chat UI header, the client can render a single list of "club-like"
    // items by using this synthetic entry for the logged-in golfer.
    const meAsClub: MyClubListItem = {
      _id: profile._id,
      name: profile.userName || profile.fullName,
      clubUserId: profile._id,
      clubEmail: profile.email,
      managerUserId: null,
      coverImageUrl: profile.coverImageUrl ?? null,
      profileImageUrl: profile.profileImageUrl ?? null,
      country: "",
      city: "",
      address: profile.address ?? "",
      ghinNumber: "",
      memberCount: 0,
      isSelfProfile: true,
      chatMode: "direct",
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };

    const clubs: MyClubListItem[] = [
      meAsClub,
      ...clubsOnly.map((club) => ({
        ...club,
        isSelfProfile: false,
        chatMode: "group" as const,
      })),
    ];

    const payload: MyClubsResponse = { clubs };
    ApiResponse.success(res, payload, "Your clubs fetched successfully");
  });

  getClubRoles = asyncHandler(async (req: Request, res: Response) => {
    const validated = await zParse(clubRolesParamsSchema, req);
    const result = await this.golfClubService.getClubRoles(
      validated.params.clubId,
    );
    ApiResponse.success(res, result, "Club roles fetched successfully");
  });

  getMyClubRoles = asyncHandler(async (req: Request, res: Response) => {
    const clubUserId = req.user?.userId;
    if (!clubUserId) {
      throw new UnauthorizedException(MESSAGES.AUTH.UNAUTHORIZED_ACCESS);
    }

    const result = await this.golfClubService.getClubRolesByClubUserId(
      clubUserId,
    );

    ApiResponse.success(res, result, "Club roles fetched successfully");
  });

  updateClubRoles = asyncHandler(async (req: Request, res: Response) => {
    const validated = await zParse(clubRolesSchema, req);
    const adminUserId = req.user?.userId;
    if (!adminUserId) {
      throw new UnauthorizedException(MESSAGES.AUTH.UNAUTHORIZED_ACCESS);
    }
    const result = await this.golfClubService.updateClubRoles({
      clubId: validated.params.clubId,
      managerIds: validated.body.managerIds,
      memberIds: validated.body.memberIds,
      assignedByAdminId: adminUserId,
    });
    ApiResponse.success(res, result, "Club roles updated successfully");
  });

  assignManager = asyncHandler(async (req: Request, res: Response) => {
    const validated = await zParse(assignClubManagerSchema, req);
    const adminUserId = req.user?.userId;
    if (!adminUserId) {
      throw new UnauthorizedException(MESSAGES.AUTH.UNAUTHORIZED_ACCESS);
    }
    logger.info(
      {
        route: "assignManager",
        clubId: validated.params.clubId,
        golferUserId: validated.body.golferUserId,
      },
      "Assign manager request received"
    );
    const result = await this.golfClubService.assignManager({
      clubId: validated.params.clubId,
      golferUserId: validated.body.golferUserId,
      clubPassword: validated.body.clubPassword,
      assignedByAdminId: adminUserId,
    });

    ApiResponse.success(res, result, "Club manager assigned successfully");
  });

  addMember = asyncHandler(async (req: Request, res: Response) => {
    const validated = await zParse(addClubMemberSchema, req);
    const adminUserId = req.user?.userId;
    if (!adminUserId) {
      throw new UnauthorizedException(MESSAGES.AUTH.UNAUTHORIZED_ACCESS);
    }
    const result = await this.golfClubService.addMember({
      clubId: validated.params.clubId,
      golferUserId: validated.body.golferUserId,
      assignedByAdminId: adminUserId,
    });

    ApiResponse.created(res, result, "Club member added successfully");
  });

  updateClub = asyncHandler(async (req: Request, res: Response) => {
    const validated = await zParse(updateGolfClubSchema, req);
    const result = await this.golfClubService.updateClubDetails(
      validated.params.clubId,
      validated.body,
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
      imageUrl,
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
      imageUrl,
    );
    ApiResponse.success(res, result, "Club cover image updated successfully");
  });

  deleteClub = asyncHandler(async (req: Request, res: Response) => {
    const validated = await zParse(clubRolesParamsSchema, req);
    await this.golfClubService.deleteClubHard(validated.params.clubId);
    ApiResponse.success(res, null, "Golf club deleted successfully");
  });
}
