import { SocialAccessService } from "./social-feed.access.service";
import { SocialPostReactionRepository } from "./social-feed.repository";
import type { ReactionToggleResponse, ReactionWithUser } from "./social-feed.type";
import { UserService } from "../user/user.service";

export class SocialReactionService {
  private accessService: SocialAccessService;
  private reactionRepository: SocialPostReactionRepository;
  private userService: UserService;

  constructor(accessService: SocialAccessService) {
    this.accessService = accessService;
    this.reactionRepository = new SocialPostReactionRepository();
    this.userService = new UserService();
  }

  async toggleLoveReaction(
    golferUserId: string,
    postId: string
  ): Promise<ReactionToggleResponse> {
    await this.accessService.getAccessiblePost(golferUserId, postId);

    const existing = await this.reactionRepository.findByPostAndGolfer(
      postId,
      golferUserId
    );

    let reacted = false;

    if (existing) {
      await this.reactionRepository.deleteByPostAndGolfer(
        postId,
        golferUserId
      );
    } else {
      await this.reactionRepository.create({
        postId,
        golferUserId,
        reaction: "love",
      });
      reacted = true;
    }

    const reactionCount = await this.reactionRepository.countByPost(postId);

    return {
      reacted,
      reactionCount,
    };
  }

  async getReactionState(
    golferUserId: string,
    postId: string
  ): Promise<ReactionToggleResponse> {
    await this.accessService.getAccessiblePost(golferUserId, postId);

    const existing = await this.reactionRepository.findByPostAndGolfer(
      postId,
      golferUserId
    );
    const reactionCount = await this.reactionRepository.countByPost(postId);

    return {
      reacted: Boolean(existing),
      reactionCount,
    };
  }

  async listReactionsWithUsers(
    viewerUserId: string,
    postIds: string[]
  ): Promise<Record<string, ReactionWithUser[]>> {
    if (postIds.length === 0) {
      return {};
    }

    // Ensure viewer can see posts (basic existence and golfer validation)
    await Promise.all(
      postIds.map((postId) => this.accessService.getAccessiblePost(viewerUserId, postId))
    );

    const reactions = await this.reactionRepository.findByPostIds(postIds);
    const uniqueGolferIds = Array.from(
      new Set(reactions.map((r) => r.golferUserId.toString()))
    );

    const profiles = await Promise.all(
      uniqueGolferIds.map(async (golferUserId) => {
        try {
          const profile = await this.userService.getProfile(golferUserId);
          return { golferUserId, profile };
        } catch {
          return { golferUserId, profile: null };
        }
      })
    );

    const profileMap = new Map(
      profiles.map(({ golferUserId, profile }) => [golferUserId, profile])
    );

    const grouped: Record<string, ReactionWithUser[]> = {};

    reactions.forEach((reaction) => {
      const postId = reaction.postId.toString();
      if (!grouped[postId]) {
        grouped[postId] = [];
      }
      grouped[postId].push({
        golferUserId: reaction.golferUserId.toString(),
        reaction: reaction.reaction,
        createdAt: reaction.createdAt,
        user: profileMap.get(reaction.golferUserId.toString()) ?? null,
      });
    });

    return grouped;
  }
}
