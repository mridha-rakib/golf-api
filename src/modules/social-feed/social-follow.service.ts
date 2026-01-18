import { BadRequestException } from "@/utils/app-error.utils";
import { SocialAccessService } from "./social-feed.access.service";
import { SocialFollowRepository } from "./social-feed.repository";

export class SocialFollowService {
  private accessService: SocialAccessService;
  private followRepository: SocialFollowRepository;

  constructor(accessService: SocialAccessService) {
    this.accessService = accessService;
    this.followRepository = new SocialFollowRepository();
  }

  async toggleFollow(
    followerUserId: string,
    followingUserId: string
  ): Promise<{ following: boolean }> {
    if (followerUserId === followingUserId) {
      throw new BadRequestException("You cannot follow yourself.");
    }

    await this.accessService.getGolferOrFail(followerUserId);
    await this.accessService.getGolferOrFail(followingUserId);

    const existing = await this.followRepository.findByFollowerAndFollowing(
      followerUserId,
      followingUserId
    );

    if (existing) {
      await this.followRepository.deleteById(existing._id.toString());
      return { following: false };
    }

    await this.followRepository.create({
      followerUserId,
      followingUserId,
    });

    return { following: true };
  }

}
