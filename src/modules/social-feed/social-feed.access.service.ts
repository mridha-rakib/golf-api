import { ROLES } from "@/constants/app.constants";
import { UserService } from "@/modules/user/user.service";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@/utils/app-error.utils";
import type { ISocialPost } from "./social-feed.interface";
import {
  SocialFollowRepository,
  SocialPostRepository,
} from "./social-feed.repository";

export class SocialAccessService {
  private followRepository: SocialFollowRepository;
  private postRepository: SocialPostRepository;
  private userService: UserService;

  constructor() {
    this.followRepository = new SocialFollowRepository();
    this.postRepository = new SocialPostRepository();
    this.userService = new UserService();
  }

  async getGolferOrFail(userId: string) {
    const user = await this.userService.getById(userId);
    if (!user) {
      throw new NotFoundException("User not found.");
    }

    if (user.role !== ROLES.GOLFER) {
      throw new BadRequestException("User is not a golfer.");
    }

    return user;
  }

  async canViewGolfer(
    viewerUserId: string,
    targetUserId: string
  ): Promise<boolean> {
    if (viewerUserId === targetUserId) {
      return true;
    }

    const targetUser = await this.userService.getById(targetUserId);
    if (!targetUser || targetUser.role !== ROLES.GOLFER) {
      return false;
    }

    return this.followRepository.exists({
      followerUserId: viewerUserId,
      followingUserId: targetUserId,
    });
  }

  async canViewGolferPublic(targetUserId: string): Promise<boolean> {
    const targetUser = await this.userService.getById(targetUserId);
    return Boolean(targetUser && targetUser.role === ROLES.GOLFER);
  }

  async assertCanViewGolfer(
    viewerUserId: string,
    targetUserId: string
  ): Promise<void> {
    await this.getGolferOrFail(targetUserId);

    if (viewerUserId === targetUserId) {
      return;
    }

    const isFollowing = await this.followRepository.exists({
      followerUserId: viewerUserId,
      followingUserId: targetUserId,
    });

    if (!isFollowing) {
      throw new ForbiddenException(
        "Follow this golfer to view their profile or posts."
      );
    }
  }

  async getAccessiblePost(
    viewerUserId: string,
    postId: string
  ): Promise<ISocialPost> {
    const post = await this.postRepository.findById(postId);
    if (!post) {
      throw new NotFoundException("Post not found.");
    }

    await this.getGolferOrFail(post.golferUserId.toString());

    return post;
  }

  async listFollowingIds(followerUserId: string): Promise<string[]> {
    await this.getGolferOrFail(followerUserId);
    return this.followRepository.findFollowingIds(followerUserId);
  }
}
