import { BadRequestException, NotFoundException } from "@/utils/app-error.utils";
import type { ISocialPostComment } from "./social-feed.interface";
import { SocialAccessService } from "./social-feed.access.service";
import { SocialPostCommentRepository, SocialPostRepository } from "./social-feed.repository";
import type { CreateCommentPayload, SocialCommentResponse, SocialPostCommentsGroup } from "./social-feed.type";

export class SocialCommentService {
  private accessService: SocialAccessService;
  private commentRepository: SocialPostCommentRepository;
  private postRepository: SocialPostRepository;

  constructor(accessService: SocialAccessService) {
    this.accessService = accessService;
    this.commentRepository = new SocialPostCommentRepository();
    this.postRepository = new SocialPostRepository();
  }

  async addComment(
    golferUserId: string,
    postId: string,
    payload: CreateCommentPayload
  ): Promise<SocialCommentResponse> {
    await this.accessService.getAccessiblePost(golferUserId, postId);

    const text = payload.text.trim();
    if (!text) {
      throw new BadRequestException("Comment text is required.");
    }

    const comment = await this.commentRepository.create({
      postId,
      golferUserId,
      text,
      parentCommentId: null,
    });

    return this.toCommentResponse(comment);
  }

  async replyToComment(
    golferUserId: string,
    commentId: string,
    payload: CreateCommentPayload
  ): Promise<SocialCommentResponse> {
    const parentComment = await this.commentRepository.findById(commentId);
    if (!parentComment) {
      throw new NotFoundException("Comment not found.");
    }

    await this.accessService.getAccessiblePost(
      golferUserId,
      parentComment.postId.toString()
    );

    const text = payload.text.trim();
    if (!text) {
      throw new BadRequestException("Reply text is required.");
    }

    const reply = await this.commentRepository.create({
      postId: parentComment.postId,
      golferUserId,
      text,
      parentCommentId: parentComment._id,
    });

    return this.toCommentResponse(reply);
  }

  async getPostComments(
    golferUserId: string,
    postId: string
  ): Promise<SocialCommentResponse[]> {
    await this.accessService.getAccessiblePost(golferUserId, postId);

    const comments = await this.commentRepository.findByPostId(postId);
    return this.buildCommentTree(comments);
  }

  async listCommentsByGolferPosts(
    viewerUserId: string,
    golferUserId: string
  ): Promise<SocialPostCommentsGroup[]> {
    if (viewerUserId === golferUserId) {
      await this.accessService.getGolferOrClubOrFail(golferUserId);
    } else {
      await this.accessService.assertCanViewGolfer(viewerUserId, golferUserId);
    }

    const posts = await this.postRepository.findByGolferUserId(golferUserId);
    const postIds = posts.map((post) => post._id.toString());
    if (postIds.length === 0) {
      return [];
    }

    const comments = await this.commentRepository.findByPostIds(postIds);
    const commentsByPost = new Map<string, ISocialPostComment[]>();
    postIds.forEach((id) => commentsByPost.set(id, []));
    comments.forEach((comment) => {
      const postId = comment.postId.toString();
      const list = commentsByPost.get(postId);
      if (list) {
        list.push(comment);
      }
    });

    return posts.map((post) => ({
      postId: post._id.toString(),
      comments: this.buildCommentTree(commentsByPost.get(post._id.toString()) ?? []),
    }));
  }

  private buildCommentTree(
    comments: ISocialPostComment[]
  ): SocialCommentResponse[] {
    const commentMap = new Map<string, SocialCommentResponse>();
    const roots: SocialCommentResponse[] = [];

    comments.forEach((comment) => {
      const response = this.toCommentResponse(comment);
      commentMap.set(comment._id.toString(), response);
    });

    comments.forEach((comment) => {
      const response = commentMap.get(comment._id.toString());
      if (!response) {
        return;
      }

      const parentId = comment.parentCommentId?.toString();
      if (parentId && commentMap.has(parentId)) {
        const parent = commentMap.get(parentId);
        parent?.replies.push(response);
      } else {
        roots.push(response);
      }
    });

    return roots;
  }

  private toCommentResponse(
    comment: ISocialPostComment
  ): SocialCommentResponse {
    return {
      _id: comment._id.toString(),
      postId: comment.postId.toString(),
      golferUserId: comment.golferUserId.toString(),
      text: comment.text,
      parentCommentId: comment.parentCommentId?.toString() ?? null,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      replies: [],
    };
  }
}
