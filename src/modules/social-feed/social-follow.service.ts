import { BadRequestException } from "@/utils/app-error.utils";
import { SocialAccessService } from "./social-feed.access.service";
import { SocialFollowRepository } from "./social-feed.repository";
import { NotificationService } from "@/modules/notification/notification.service";
import { logger } from "@/middlewares/pino-logger";

export class SocialFollowService {
  private accessService: SocialAccessService;
  private followRepository: SocialFollowRepository;
  private notificationService: NotificationService;

  constructor(accessService: SocialAccessService) {
    this.accessService = accessService;
    this.followRepository = new SocialFollowRepository();
    this.notificationService = new NotificationService();
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

    try {
      await this.notificationService.notifyFollow(
        followerUserId,
        followingUserId,
      );
    } catch (error) {
      logger.warn(
        { followerUserId, followingUserId, error },
        "Failed to create follow notification",
      );
    }

    return { following: true };
  }

}
