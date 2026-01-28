import { MESSAGES } from "@/constants/app.constants";
import { asyncHandler } from "@/middlewares/async-handler.middleware";
import { UnauthorizedException } from "@/utils/app-error.utils";
import { ApiResponse } from "@/utils/response.utils";
import { zParse } from "@/utils/validators.utils";
import type { Request, Response } from "express";
import {
  addClubMemberSchema,
  assignClubManagerSchema,
  createGolfClubSchema,
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
}
