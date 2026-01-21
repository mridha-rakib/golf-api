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
  SocialPostDetailsResponse,
} from "./social-feed.type";
import { SocialFollowService } from "./social-follow.service";
import { SocialPostService } from "./social-post.service";
import { SocialProfileService } from "./social-profile.service";
import { SocialReactionService } from "./social-reaction.service";

export class SocialFeedController {
  private accessService: SocialAccessService;
  private followService: SocialFollowService;
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

  createPost = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException("Unauthorized access.");
    }

    const uploadedFiles = (req.files ?? []) as Express.MulterS3.File[];
    const uploadedUrls = uploadedFiles
      .map((file) => file.location)
      .filter((location): location is string => Boolean(location));

    if (uploadedUrls.length > 0) {
      req.body.mediaUrls = uploadedUrls;
    } else if (req.body.mediaUrls) {
      req.body.mediaUrls = Array.isArray(req.body.mediaUrls)
        ? req.body.mediaUrls
        : [req.body.mediaUrls];
    } else if (req.body.mediaUrl) {
      req.body.mediaUrls = Array.isArray(req.body.mediaUrl)
        ? req.body.mediaUrl
        : [req.body.mediaUrl];
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
    const result = await this.profileService.getGolferProfile(
      userId,
      validated.params.golferUserId,
    );

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
    ApiResponse.success(res, posts, "Posts fetched successfully");
  });

  listFeed = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException("Unauthorized access.");
    }

    const { page = 1, limit = 10 } = PaginationHelper.parsePaginationParams(
      req.query,
    );
    const result = await this.postService.listFeedPosts(userId, page, limit);
    const feed: SocialFeedItemResponse[] = await Promise.all(
      result.posts.map(async (post) => {
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
        };
      }),
    );
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
      return {
        ...comment,
        replies,
        commenter: profileMap.get(comment.golferUserId) ?? null,
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

  listMyMedia = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException("Unauthorized access.");
    }

    const media = await this.postService.listMediaByGolfer(userId, userId);
    ApiResponse.success(res, media, "Media fetched successfully");
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
