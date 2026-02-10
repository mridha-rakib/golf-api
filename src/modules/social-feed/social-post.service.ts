import { UserService } from "@/modules/user/user.service";
import { ROLES } from "@/constants/app.constants";
import {
  BadRequestException,
  NotFoundException,
} from "@/utils/app-error.utils";
import { SocialAccessService } from "./social-feed.access.service";
import type { ISocialPost } from "./social-feed.interface";
import { SocialPostRepository, SocialPostViewRepository } from "./social-feed.repository";
import type {
  CreatePostPayload,
  SharePostPayload,
  SharePostResult,
  SocialFeedPostResponse,
  SocialPostResponse,
  SocialPostSummary,
  ViewCountResponse,
} from "./social-feed.type";

export class SocialPostService {
  private accessService: SocialAccessService;
  private postRepository: SocialPostRepository;
  private postViewRepository: SocialPostViewRepository;
  private userService: UserService;

  constructor(accessService: SocialAccessService) {
    this.accessService = accessService;
    this.postRepository = new SocialPostRepository();
    this.postViewRepository = new SocialPostViewRepository();
    this.userService = new UserService();
  }

  async createPost(
    golferUserId: string,
    payload: CreatePostPayload,
  ): Promise<SocialPostResponse> {
    await this.accessService.getGolferOrFail(golferUserId);

    const text = payload.text.trim();
    const mediaUrls = (payload.mediaUrls ?? [])
      .map((url) => url.trim())
      .filter((url) => url.length > 0);

    if (!text) {
      throw new BadRequestException("Post text is required.");
    }

    const post = await this.postRepository.create({
      golferUserId,
      text,
      mediaUrls,
      mediaUrl: mediaUrls[0] ?? null,
      viewCount: 0,
      sharedFromPostId: null,
    });

    return this.toPostResponse(post, golferUserId);
  }

  async sharePost(
    golferUserId: string,
    postId: string,
    payload: SharePostPayload,
  ): Promise<SharePostResult> {
    const originalPost = await this.accessService.getAccessiblePost(
      golferUserId,
      postId,
    );

    const shareText = payload.text?.trim() ?? "";
    const hasText = payload.text !== undefined;
    const existingShare = await this.postRepository.findShareByGolferAndPost(
      golferUserId,
      originalPost._id.toString(),
    );

    if (existingShare) {
      const updated = hasText
        ? ((await this.postRepository.updateById(existingShare._id.toString(), {
            text: shareText,
          })) ?? existingShare)
        : existingShare;

      const shareMessage = hasText
        ? "Post share successfully"
        : "Post already shared";

      return {
        action: "updated",
        shareMessage,
        postId: updated._id.toString(),
        sharedFromPostId: originalPost._id.toString(),
        post: await this.toPostResponse(updated, golferUserId),
      };
    }

    const post = await this.postRepository.create({
      golferUserId,
      text: shareText,
      mediaUrls: [],
      mediaUrl: null,
      viewCount: 0,
      sharedFromPostId: originalPost._id,
    });

    return {
      action: "shared",
      shareMessage: "Post shared successfully",
      postId: post._id.toString(),
      sharedFromPostId: originalPost._id.toString(),
      post: await this.toPostResponse(post, golferUserId),
    };
  }

  async getPostById(
    viewerUserId: string,
    postId: string,
  ): Promise<SocialPostResponse> {
    const post = await this.accessService.getAccessiblePost(
      viewerUserId,
      postId,
    );
    return this.toPostResponse(post, viewerUserId);
  }

  async listPostsByGolfer(
    viewerUserId: string,
    golferUserId: string,
    options: { skipAccessCheck?: boolean } = {},
  ): Promise<SocialFeedPostResponse[]> {
    if (options.skipAccessCheck) {
      await this.accessService.getGolferOrClubOrFail(golferUserId);
    } else {
      const isOwner = viewerUserId === golferUserId;
      if (isOwner) {
        await this.accessService.getGolferOrClubOrFail(golferUserId);
      } else {
        await this.accessService.assertCanViewGolfer(viewerUserId, golferUserId);
      }
    }
    const posts = await this.postRepository.findByGolferUserId(golferUserId);

    const summaries = await Promise.all(
      posts.map((post) => this.toPostResponse(post, viewerUserId)),
    );

    const profile = await this.userService.getProfile(golferUserId);

    // Preload shared-from golfer profiles to attach
    const sharedGolferIds = Array.from(
      new Set(
        summaries
          .map((p) => p.sharedFromPost?.golferUserId)
          .filter((id): id is string => Boolean(id)),
      ),
    );
    const sharedProfiles = await Promise.all(
      sharedGolferIds.map(async (id) => ({
        golferUserId: id,
        profile: await this.userService.getProfileOrNull(id, {
          includeDeleted: true,
        }),
      })),
    );
    const sharedMap = new Map(
      sharedProfiles
        .filter((entry) => entry.profile)
        .map((entry) => [entry.golferUserId, entry.profile!]),
    );

    return summaries.map((summary) => ({
      ...summary,
      golfer: profile,
      sharedFromPost:
        summary.sharedFromPost &&
        sharedMap.get(summary.sharedFromPost.golferUserId)
          ? {
              ...summary.sharedFromPost,
              golfer: sharedMap.get(summary.sharedFromPost.golferUserId)!,
            }
          : null,
      sharedBy: summary.sharedFromPostId ? profile : null,
    }));
  }

  async listFeedPosts(
    viewerUserId: string,
    page: number,
    limit: number,
    viewerRole?: string,
  ): Promise<{ posts: SocialFeedPostResponse[]; total: number }> {
    let golferUserIds: string[] = [];
    if (viewerRole === ROLES.GOLFER) {
      const followingIds = await this.accessService.listFollowingIds(
        viewerUserId,
      );
      golferUserIds = Array.from(new Set([viewerUserId, ...followingIds]));
    }

    const [posts, total] = await Promise.all([
      this.postRepository.findFeedPosts(golferUserIds, page, limit),
      this.postRepository.countFeedPosts(golferUserIds),
    ]);

    const baseResponses = await Promise.all(
      posts.map((post) => this.toPostResponse(post, viewerUserId)),
    );
    const golferIds = new Set<string>();

    baseResponses.forEach((response) => {
      golferIds.add(response.golferUserId);
      if (response.sharedFromPost) {
        golferIds.add(response.sharedFromPost.golferUserId);
      }
    });
    const golferProfiles = await Promise.all(
      Array.from(golferIds).map(async (golferUserId) => ({
        golferUserId,
        profile: await this.userService.getProfileOrNull(golferUserId, {
          includeDeleted: true,
        }),
      })),
    );
    const golferMap = new Map(
      golferProfiles
        .filter((entry) => entry.profile !== null)
        .map((entry) => [entry.golferUserId, entry.profile as any]),
    );
    const responses: SocialFeedPostResponse[] = [];

    for (const response of baseResponses) {
      const golfer = golferMap.get(response.golferUserId);
      if (!golfer) {
        continue; // skip posts whose golfer no longer exists
      }

      let sharedFromPost: SocialFeedPostResponse["sharedFromPost"] = null;

      if (response.sharedFromPost) {
        const sharedFromGolfer = golferMap.get(
          response.sharedFromPost.golferUserId,
        );
        if (!sharedFromGolfer) {
          // skip if shared-from golfer missing
          continue;
        }
        sharedFromPost = {
          ...response.sharedFromPost,
          golfer: sharedFromGolfer,
        };
      }

      responses.push({
        ...response,
        golfer,
        sharedFromPost,
        sharedBy: response.sharedFromPostId ? golfer : null,
      });
    }

    return { posts: responses, total };
  }

  async listMediaByGolfer(
    viewerUserId: string,
    golferUserId: string,
  ): Promise<SocialPostResponse[]> {
    await this.accessService.assertCanViewGolfer(viewerUserId, golferUserId);
    const posts =
      await this.postRepository.findMediaByGolferUserId(golferUserId);

    return Promise.all(
      posts.map((post) => this.toPostResponse(post, viewerUserId)),
    );
  }

  async incrementViewCount(
    viewerUserId: string,
    postId: string,
  ): Promise<ViewCountResponse> {
    const post = await this.accessService.getAccessiblePost(viewerUserId, postId);

    const viewer = await this.userService.getById(viewerUserId);
    if (!viewer) {
      throw new NotFoundException("Viewer not found.");
    }

    const viewerEmail = (viewer.email ?? "").trim().toLowerCase();
    if (!viewerEmail) {
      throw new BadRequestException("Viewer email is required to record views.");
    }

    const alreadyViewed = await this.postViewRepository.existsByPostAndEmail(
      post._id.toString(),
      viewerEmail
    );

    if (alreadyViewed) {
      return {
        postId,
        viewCount: post.viewCount,
      };
    }

    try {
      await this.postViewRepository.create({
        postId: post._id,
        viewerEmail,
        viewerUserId,
      } as any);
    } catch (err: any) {
      if (err?.code === 11000) {
        // duplicate key -> already counted for this email
        const fresh = await this.postRepository.findById(postId);
        return {
          postId,
          viewCount: fresh?.viewCount ?? post.viewCount,
        };
      }
      throw err;
    }

    const updated = await this.postRepository.incrementViewCount(postId);
    if (!updated) {
      throw new NotFoundException("Post not found.");
    }

    return {
      postId,
      viewCount: updated.viewCount,
    };
  }

  async toPostResponse(
    post: ISocialPost,
    viewerUserId: string,
  ): Promise<SocialPostResponse> {
    const summary = await this.toPostSummary(post);
    const sharedFromPostId = post.sharedFromPostId?.toString() ?? null;

    if (!post.sharedFromPostId) {
      return {
        ...summary,
        sharedFromPostId,
        sharedFromPost: null,
      };
    }

    const sharedFromPost = await this.postRepository.findById(
      post.sharedFromPostId.toString(),
    );

    if (!sharedFromPost) {
      return {
        ...summary,
        sharedFromPostId,
        sharedFromPost: null,
      };
    }

    const canViewShared = await this.accessService.canViewGolferPublic(
      sharedFromPost.golferUserId.toString(),
    );

    return {
      ...summary,
      sharedFromPostId: sharedFromPost._id.toString(),
      sharedFromPost: canViewShared
        ? await this.toPostSummary(sharedFromPost)
        : null,
    };
  }

  private async toPostSummary(post: ISocialPost): Promise<SocialPostSummary> {
    const mediaUrls = Array.isArray(post.mediaUrls)
      ? post.mediaUrls.filter((url) => url && url.trim().length > 0)
      : post.mediaUrl
        ? [post.mediaUrl]
        : [];
    const shareCount = await this.postRepository.countSharesByPostId(
      post._id.toString(),
    );

    return {
      _id: post._id.toString(),
      golferUserId: post.golferUserId.toString(),
      text: post.text,
      mediaUrls,
      mediaUrl: mediaUrls[0] ?? null,
      shareCount,
      viewCount: post.viewCount,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    };
  }
}
