import { ROLES } from "@/constants/app.constants";
import { asyncHandler } from "@/middlewares/async-handler.middleware";
import { UnauthorizedException } from "@/utils/app-error.utils";
import { PaginationHelper } from "@/utils/pagination-helper";
import { ApiResponse } from "@/utils/response.utils";
import { zParse } from "@/utils/validators.utils";
import type { Request, Response } from "express";
import { UserService } from "../user/user.service";
import { SocialCommentService } from "./social-comment.service";
import { SocialAccessService } from "./social-feed.access.service";
import {
  addCommentSchema,
  createPostSchema,
  followGolferSchema,
  incrementViewSchema,
  listGolfersSchema,
  postDetailsSchema,
  profileSchema,
  replyCommentSchema,
  sharePostSchema,
  toggleReactionSchema,
} from "./social-feed.schema";
import type {
  SocialCommentResponse,
  SocialFeedCommentResponse,
  SocialFeedItemResponse,
  SocialFeedPostResponse,
  SocialPostCommentsGroupWithCommenter,
  SocialPostDetailsResponse,
  SocialPostMediaGroup,
  SocialPostResponse,
} from "./social-feed.type";
import { SocialFollowService } from "./social-follow.service";
import { SocialGolferService } from "./social-golfer.service";
import { SocialPostService } from "./social-post.service";
import { SocialProfileService } from "./social-profile.service";
import { SocialReactionService } from "./social-reaction.service";

export class SocialFeedController {
  private accessService: SocialAccessService;
  private followService: SocialFollowService;
  private golferService: SocialGolferService;
  private postService: SocialPostService;
  private reactionService: SocialReactionService;
  private commentService: SocialCommentService;
  private profileService: SocialProfileService;
  private userService: UserService;

  constructor() {
    this.accessService = new SocialAccessService();
    this.postService = new SocialPostService(this.accessService);
    this.followService = new SocialFollowService(this.accessService);
    this.reactionService = new SocialReactionService(this.accessService);
    this.commentService = new SocialCommentService(this.accessService);
    this.profileService = new SocialProfileService(
      this.accessService,
      this.postService,
    );
    this.golferService = new SocialGolferService(this.accessService);
    this.userService = new UserService();
  }

  toggleFollow = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException("Unauthorized access.");
    }

    const validated = await zParse(followGolferSchema, req);
    const result = await this.followService.toggleFollow(
      userId,
      validated.params.golferUserId,
    );

    ApiResponse.success(res, result, "Follow status updated successfully");
  });

  listGolfers = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException("Unauthorized access.");
    }

    const validated = await zParse(listGolfersSchema, req);
    const result = await this.golferService.listGolfers(
      userId,
      validated.query,
    );

    ApiResponse.paginated(
      res,
      result.data,
      result.pagination,
      "Golfers fetched successfully",
    );
  });

  listFollowingGolfers = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException("Unauthorized access.");
    }

    const validated = await zParse(listGolfersSchema, req);
    const result = await this.golferService.listFollowingGolfers(
      userId,
      validated.query,
    );

    ApiResponse.paginated(
      res,
      result.data,
      result.pagination,
      "Following golfers fetched successfully",
    );
  });

  createPost = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException("Unauthorized access.");
    }

    const uploadedFiles = (req.files ?? []) as Express.MulterS3.File[];
    const uploadedUrls = uploadedFiles
      .map((file) => file.location)
      .filter((location): location is string => Boolean(location));

    const mediaUrls = Array.from(
      new Set([
        ...uploadedUrls,
        ...this.normalizeMediaInput(req.body.mediaUrls),
        ...this.normalizeMediaInput(req.body.mediaUrl),
        ...this.normalizeMediaInput(req.body.media),
      ]),
    );

    if (mediaUrls.length > 0) {
      req.body.mediaUrls = mediaUrls;
    }

    const validated = await zParse(createPostSchema, req);
    const result = await this.postService.createPost(userId, validated.body);

    ApiResponse.created(res, result, "Post created successfully");
  });

  sharePost = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException("Unauthorized access.");
    }

    const validated = await zParse(sharePostSchema, req);
    const result = await this.postService.sharePost(
      userId,
      validated.params.postId,
      validated.body,
    );

    if (result.action === "shared") {
      return ApiResponse.created(res, result, result.shareMessage);
    }

    return ApiResponse.success(res, result, result.shareMessage);
  });

  toggleReaction = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException("Unauthorized access.");
    }

    const validated = await zParse(toggleReactionSchema, req);
    const result = await this.reactionService.toggleLoveReaction(
      userId,
      validated.params.postId,
    );

    ApiResponse.success(res, result, "Reaction updated successfully");
  });

  incrementView = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException("Unauthorized access.");
    }

    const validated = await zParse(incrementViewSchema, req);
    const result = await this.postService.incrementViewCount(
      userId,
      validated.params.postId,
    );

    ApiResponse.success(res, result, "View count updated successfully");
  });

  addComment = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException("Unauthorized access.");
    }

    const validated = await zParse(addCommentSchema, req);
    const result = await this.commentService.addComment(
      userId,
      validated.params.postId,
      validated.body,
    );

    ApiResponse.created(res, result, "Comment added successfully");
  });

  replyToComment = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException("Unauthorized access.");
    }

    const validated = await zParse(replyCommentSchema, req);
    const result = await this.commentService.replyToComment(
      userId,
      validated.params.commentId,
      validated.body,
    );

    ApiResponse.created(res, result, "Reply added successfully");
  });

  getGolferProfile = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException("Unauthorized access.");
    }

    const validated = await zParse(profileSchema, req);
    const targetUserId = validated.params.golferUserId;
    const viewerRole = req.user?.role;
    const baseResult =
      viewerRole === ROLES.GOLF_CLUB
        ? await this.profileService.getProfileForClub(userId, targetUserId)
        : await this.profileService.getGolferProfile(userId, targetUserId);
    const detailedPosts = await this.enrichPostsWithDetails(
      userId,
      baseResult.posts,
    );
    const result = {
      ...baseResult,
      posts: detailedPosts,
    };

    ApiResponse.success(res, result, "Profile fetched successfully");
  });

  getMyProfile = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException("Unauthorized access.");
    }

    const profile = await this.profileService.getProfile(userId, userId);
    ApiResponse.success(res, profile, "Profile fetched successfully");
  });

  listMyPosts = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException("Unauthorized access.");
    }

    const posts = await this.postService.listPostsByGolfer(userId, userId);
    const enriched = await this.enrichPostsWithDetails(userId, posts);

    ApiResponse.success(res, enriched, "Posts fetched successfully");
  });

  listFeed = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException("Unauthorized access.");
    }

    const { page = 1, limit = 10 } = PaginationHelper.parsePaginationParams(
      req.query,
    );
    const result = await this.postService.listFeedPosts(
      userId,
      page,
      limit,
      req.user?.role,
    );
    const feed = await this.enrichPostsWithDetails(userId, result.posts);
    const response = PaginationHelper.buildResponse(
      feed,
      result.total,
      page,
      limit,
    );

    ApiResponse.paginated(
      res,
      response.data,
      response.pagination,
      "Feed fetched successfully",
    );
  });

  private async attachCommenters(
    comments: SocialCommentResponse[],
  ): Promise<SocialFeedCommentResponse[]> {
    const golferIds = new Set<string>();
    const collectGolferIds = (items: SocialCommentResponse[]) => {
      items.forEach((comment) => {
        golferIds.add(comment.golferUserId);
        if (comment.replies?.length) {
          collectGolferIds(comment.replies);
        }
      });
    };

    collectGolferIds(comments);

    const profiles = await Promise.all(
      Array.from(golferIds).map(async (golferUserId) => {
        try {
          const profile = await this.userService.getProfile(golferUserId);
          return {
            golferUserId,
            summary: {
              _id: profile._id,
              name: profile.fullName,
              fullName: profile.fullName,
              profileImage: profile.profileImage,
            },
          };
        } catch {
          return { golferUserId, summary: null };
        }
      }),
    );
    const profileMap = new Map(
      profiles.map(({ golferUserId, summary }) => [golferUserId, summary]),
    );

    const mapComment = (
      comment: SocialCommentResponse,
    ): SocialFeedCommentResponse => {
      const replies = comment.replies.map(mapComment);
      const rawCommenter = profileMap.get(comment.golferUserId) ?? null;
      const commenter =
        rawCommenter === null
          ? null
          : {
              ...rawCommenter,
              profileImage: rawCommenter.profileImage ?? undefined,
            };
      return {
        ...comment,
        replies,
        commenter,
      };
    };

    return comments.map(mapComment);
  }

  private countComments(comments: SocialFeedCommentResponse[]): number {
    return comments.reduce(
      (total, comment) => total + 1 + this.countComments(comment.replies),
      0,
    );
  }

  private async enrichPostsWithDetails(
    userId: string,
    posts: SocialFeedPostResponse[],
  ): Promise<SocialFeedItemResponse[]> {
    const reactionsByPostId = await this.reactionService.listReactionsWithUsers(
      userId,
      posts.map((post) => post._id),
    );

    return Promise.all(
      posts.map(async (post) => {
        const [comments, reaction] = await Promise.all([
          this.commentService.getPostComments(userId, post._id),
          this.reactionService.getReactionState(userId, post._id),
        ]);
        const commentsWithGolfer = await this.attachCommenters(comments);

        return {
          ...post,
          comments: commentsWithGolfer,
          reactCount: reaction.reactionCount,
          commentCount: this.countComments(commentsWithGolfer),
          reactions: reactionsByPostId[post._id] ?? [],
        };
      }),
    );
  }

  private normalizeMediaInput(input: unknown): string[] {
    const urls: string[] = [];

    const addIfValid = (value: unknown) => {
      if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed.length > 0) {
          urls.push(trimmed);
        }
        return;
      }

      if (
        value &&
        typeof value === "object" &&
        "uri" in value &&
        typeof (value as any).uri === "string"
      ) {
        const uri = (value as any).uri.trim();
        if (uri.length > 0) {
          urls.push(uri);
        }
      }
    };

    if (Array.isArray(input)) {
      input.forEach(addIfValid);
      return urls;
    }

    if (typeof input === "string") {
      const trimmed = input.trim();
      if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
        try {
          const parsed = JSON.parse(trimmed);
          return this.normalizeMediaInput(parsed);
        } catch {
          // ignore parse errors and treat as plain string
        }
      }
      addIfValid(trimmed);
      return urls;
    }

    addIfValid(input);
    return urls;
  }

  private extractMediaFromPosts(posts: SocialPostResponse[]) {
    return posts
      .map<SocialPostMediaGroup>((post) => {
        const mediaUrls =
          (post.mediaUrls ?? []).filter(
            (url) => typeof url === "string" && url.trim().length > 0,
          ) || [];

        return {
          postId: post._id,
          mediaUrls,
          createdAt: post.createdAt,
          updatedAt: post.updatedAt,
        };
      })
      .filter((group) => group.mediaUrls.length > 0);
  }

  listMyMedia = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException("Unauthorized access.");
    }

    const posts = await this.postService.listMediaByGolfer(userId, userId);
    const media = this.extractMediaFromPosts(posts);
    ApiResponse.success(res, media, "Media fetched successfully");
  });

  listGolferMedia = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException("Unauthorized access.");
    }

    const validated = await zParse(profileSchema, req);
    const posts = await this.postService.listMediaByGolfer(
      userId,
      validated.params.golferUserId,
    );

    const media = this.extractMediaFromPosts(posts);
    ApiResponse.success(res, media, "Media fetched successfully");
  });

  listMyComments = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException("Unauthorized access.");
    }

    const groups = await this.commentService.listCommentsByGolferPosts(
      userId,
      userId,
    );

    const withCommenters: SocialPostCommentsGroupWithCommenter[] =
      await Promise.all(
        groups.map(async (group) => ({
          postId: group.postId,
          comments: await this.attachCommenters(group.comments),
        })),
      );

    ApiResponse.success(
      res,
      withCommenters,
      "Comments for your posts fetched successfully",
    );
  });

  getPostDetails = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException("Unauthorized access.");
    }

    const validated = await zParse(postDetailsSchema, req);
    const post = await this.postService.getPostById(
      userId,
      validated.params.postId,
    );
    const comments = await this.commentService.getPostComments(
      userId,
      validated.params.postId,
    );
    const commentsWithGolfer = await this.attachCommenters(comments);
    const reaction = await this.reactionService.getReactionState(
      userId,
      validated.params.postId,
    );

    const result: SocialPostDetailsResponse = {
      ...post,
      comments: commentsWithGolfer,
      reacted: reaction.reacted,
      reactionCount: reaction.reactionCount,
    };

    ApiResponse.success(res, result, "Post fetched successfully");
  });
}
