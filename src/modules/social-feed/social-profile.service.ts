import { UserService } from "@/modules/user/user.service";
import { SocialAccessService } from "./social-feed.access.service";
import { SocialPostRepository } from "./social-feed.repository";
import { SocialPostService } from "./social-post.service";
import type { SocialProfileResponse } from "./social-feed.type";
import type { UserResponse } from "@/modules/user/user.type";

export class SocialProfileService {
  private accessService: SocialAccessService;
  private postRepository: SocialPostRepository;
  private postService: SocialPostService;
  private userService: UserService;

  constructor(accessService: SocialAccessService, postService: SocialPostService) {
    this.accessService = accessService;
    this.postRepository = new SocialPostRepository();
    this.postService = postService;
    this.userService = new UserService();
  }

  async getGolferProfile(
    viewerUserId: string,
    golferUserId: string
  ): Promise<SocialProfileResponse> {
    await this.accessService.assertCanViewGolfer(viewerUserId, golferUserId);

    const profile = await this.userService.getProfile(golferUserId);
    const posts = await this.postRepository.findByGolferUserId(golferUserId);
    const postResponses = await Promise.all(
      posts.map((post) => this.postService.toPostResponse(post, viewerUserId))
    );

    return {
      profile,
      posts: postResponses,
    };
  }

  async getProfile(
    viewerUserId: string,
    golferUserId: string
  ): Promise<UserResponse> {
    await this.accessService.assertCanViewGolfer(viewerUserId, golferUserId);
    return this.userService.getProfile(golferUserId);
  }
}
