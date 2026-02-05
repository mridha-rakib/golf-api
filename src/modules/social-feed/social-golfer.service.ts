import { ROLES } from "@/constants/app.constants";
import { UserService } from "@/modules/user/user.service";
import type { PaginatedResponse, PaginationQuery } from "@/ts/pagination.types";
import { PaginationHelper } from "@/utils/pagination-helper";
import type { SortOrder } from "mongoose";
import { SocialAccessService } from "./social-feed.access.service";
import { SocialFollowRepository } from "./social-feed.repository";
import type { SocialGolferListItem } from "./social-feed.type";
import { SocialGolferRepository } from "./social-golfer.repository";

export class SocialGolferService {
  private accessService: SocialAccessService;
  private followRepository: SocialFollowRepository;
  private golferRepository: SocialGolferRepository;
  private userService: UserService;
  private readonly searchFields = ["fullName", "email", "phoneNumber"];

  constructor(accessService: SocialAccessService) {
    this.accessService = accessService;
    this.followRepository = new SocialFollowRepository();
    this.golferRepository = new SocialGolferRepository();
    this.userService = new UserService();
  }

  async listGolfers(
    viewerUserId: string,
    query: PaginationQuery,
  ): Promise<PaginatedResponse<SocialGolferListItem>> {
    const viewer = await this.accessService.getGolferOrClubOrFail(viewerUserId);

    const {
      page = 1,
      limit = 10,
      sort = { createdAt: -1 },
    } = PaginationHelper.parsePaginationParams(query);
    const sortOptionRaw =
      typeof sort === "string"
        ? PaginationHelper.parseSortString(sort)
        : ((sort as Record<string, number | "asc" | "desc"> | undefined) ?? {
            createdAt: -1,
          });
    const sortOption = sortOptionRaw as Record<string, SortOrder>;

    const filter = PaginationHelper.createSearchFilter(
      query,
      this.searchFields,
    );
    filter.role = ROLES.GOLFER;
    filter._id = { $ne: viewerUserId };

    const { golfers, total } = await this.golferRepository.searchGolfers(
      filter,
      page,
      limit,
      sortOption,
    );

    const targetIds = golfers.map((golfer) => golfer._id.toString());
    const followingIds =
      viewer.role === ROLES.GOLFER && targetIds.length > 0
        ? await this.followRepository.findFollowingIdsForTargets(
            viewerUserId,
            targetIds,
          )
        : [];
    const followingSet = new Set(followingIds);

    const data = golfers.map<SocialGolferListItem>((golfer) => ({
      golfer: this.userService.toUserResponse(golfer),
      isFollowing: followingSet.has(golfer._id.toString()),
    }));

    return PaginationHelper.buildResponse(data, total, page, limit);
  }

  async listFollowingGolfers(
    viewerUserId: string,
    query: PaginationQuery,
  ): Promise<PaginatedResponse<SocialGolferListItem>> {
    await this.accessService.getGolferOrFail(viewerUserId);

    const {
      page = 1,
      limit = 10,
      sort = { createdAt: -1 },
    } = PaginationHelper.parsePaginationParams(query);
    const sortOptionRaw =
      typeof sort === "string"
        ? PaginationHelper.parseSortString(sort)
        : ((sort as Record<string, number | "asc" | "desc"> | undefined) ?? {
            createdAt: -1,
          });
    const sortOption = sortOptionRaw as Record<string, SortOrder>;

    const followingIds =
      await this.followRepository.findFollowingIds(viewerUserId);
    if (followingIds.length === 0) {
      return PaginationHelper.buildResponse([], 0, page, limit);
    }

    const filter = PaginationHelper.createSearchFilter(
      query,
      this.searchFields,
    );
    filter._id = { $in: followingIds };

    const { golfers, total } = await this.golferRepository.searchGolfers(
      filter,
      page,
      limit,
      sortOption,
    );

    const data = golfers.map<SocialGolferListItem>((golfer) => ({
      golfer: this.userService.toUserResponse(golfer),
      isFollowing: true,
    }));

    return PaginationHelper.buildResponse(data, total, page, limit);
  }
}
