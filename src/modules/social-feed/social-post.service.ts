import {
  BadRequestException,
  NotFoundException,
} from "@/utils/app-error.utils";
import { SocialAccessService } from "./social-feed.access.service";
import type { ISocialPost } from "./social-feed.interface";
import { SocialPostRepository } from "./social-feed.repository";
import type {
  CreatePostPayload,
  SharePostPayload,
  SharePostResult,
  SocialPostResponse,
  SocialPostSummary,
  ViewCountResponse,
} from "./social-feed.type";

export class SocialPostService {
  private accessService: SocialAccessService;
  private postRepository: SocialPostRepository;

  constructor(accessService: SocialAccessService) {
    this.accessService = accessService;
    this.postRepository = new SocialPostRepository();
  }

  async createPost(
    golferUserId: string,
    payload: CreatePostPayload
  ): Promise<SocialPostResponse> {
    await this.accessService.getGolferOrFail(golferUserId);

    const text = payload.text.trim();
    const mediaUrls = payload.mediaUrls
      .map((url) => url.trim())
      .filter((url) => url.length > 0);

    if (!text) {
      throw new BadRequestException("Post text is required.");
    }

    if (mediaUrls.length === 0) {
      throw new BadRequestException("At least one media URL is required.");
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
    payload: SharePostPayload
  ): Promise<SharePostResult> {
    const originalPost = await this.accessService.getAccessiblePost(
      golferUserId,
      postId
    );

    const shareText = payload.text?.trim() ?? "";
    const hasText = payload.text !== undefined;
    const existingShare = await this.postRepository.findShareByGolferAndPost(
      golferUserId,
      originalPost._id.toString()
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
    postId: string
  ): Promise<SocialPostResponse> {
    const post = await this.accessService.getAccessiblePost(
      viewerUserId,
      postId
    );
    return this.toPostResponse(post, viewerUserId);
  }

  async listPostsByGolfer(
    viewerUserId: string,
    golferUserId: string
  ): Promise<SocialPostResponse[]> {
    await this.accessService.assertCanViewGolfer(viewerUserId, golferUserId);
    const posts = await this.postRepository.findByGolferUserId(golferUserId);

    return Promise.all(
      posts.map((post) => this.toPostResponse(post, viewerUserId))
    );
  }

  async listFeedPosts(
    viewerUserId: string,
    page: number,
    limit: number
  ): Promise<{ posts: SocialPostResponse[]; total: number }> {
    const [posts, total] = await Promise.all([
      this.postRepository.findFeedPosts([], page, limit),
      this.postRepository.countFeedPosts([]),
    ]);

    const responses = await Promise.all(
      posts.map((post) => this.toPostResponse(post, viewerUserId))
    );

    return { posts: responses, total };
  }

  async listMediaByGolfer(
    viewerUserId: string,
    golferUserId: string
  ): Promise<SocialPostResponse[]> {
    await this.accessService.assertCanViewGolfer(viewerUserId, golferUserId);
    const posts =
      await this.postRepository.findMediaByGolferUserId(golferUserId);

    return Promise.all(
      posts.map((post) => this.toPostResponse(post, viewerUserId))
    );
  }

  async incrementViewCount(
    viewerUserId: string,
    postId: string
  ): Promise<ViewCountResponse> {
    await this.accessService.getAccessiblePost(viewerUserId, postId);

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
    viewerUserId: string
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
      post.sharedFromPostId.toString()
    );

    if (!sharedFromPost) {
      return {
        ...summary,
        sharedFromPostId,
        sharedFromPost: null,
      };
    }

    const canViewShared = await this.accessService.canViewGolferPublic(
      sharedFromPost.golferUserId.toString()
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
      post._id.toString()
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
