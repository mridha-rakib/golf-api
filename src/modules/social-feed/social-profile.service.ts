import { UserService } from "@/modules/user/user.service";
import type { UserResponse } from "@/modules/user/user.type";
import { SocialAccessService } from "./social-feed.access.service";
import type { SocialProfileBaseResponse } from "./social-feed.type";
import { SocialPostService } from "./social-post.service";

export class SocialProfileService {
  private accessService: SocialAccessService;
  private postService: SocialPostService;
  private userService: UserService;

  constructor(
    accessService: SocialAccessService,
    postService: SocialPostService,
  ) {
    this.accessService = accessService;
    this.postService = postService;
    this.userService = new UserService();
  }

  async getGolferProfile(
    viewerUserId: string,
    golferUserId: string,
  ): Promise<SocialProfileBaseResponse> {
    await this.accessService.getGolferOrFail(golferUserId);
    const [profile, followers, following] = await Promise.all([
      this.userService.getProfile(golferUserId),
      this.userService.listFollowers(golferUserId),
      this.userService.listFollowing(golferUserId),
    ]);
    const canViewPosts = await this.accessService.canViewGolfer(
      viewerUserId,
      golferUserId,
    );
    const postResponses = canViewPosts
      ? await this.postService.listPostsByGolfer(viewerUserId, golferUserId)
      : [];

    return {
      profile,
      posts: postResponses,
      followers,
      following,
    };
  }

  async getProfileForClub(
    viewerUserId: string,
    targetUserId: string,
  ): Promise<SocialProfileBaseResponse> {
    const [profile, followers, following] = await Promise.all([
      this.userService.getProfile(targetUserId),
      this.userService.listFollowers(targetUserId),
      this.userService.listFollowing(targetUserId),
    ]);
    const postResponses = await this.postService.listPostsByGolfer(
      viewerUserId,
      targetUserId,
      { skipAccessCheck: true },
    );

    return {
      profile,
      posts: postResponses,
      followers,
      following,
    };
  }

  async getProfile(
    viewerUserId: string,
    golferUserId: string,
  ): Promise<UserResponse> {
    await this.accessService.assertCanViewGolfer(viewerUserId, golferUserId);
    return this.userService.getProfile(golferUserId);
  }
}
