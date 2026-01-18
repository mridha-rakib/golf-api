import { SocialAccessService } from "./social-feed.access.service";
import { SocialPostReactionRepository } from "./social-feed.repository";
import type { ReactionToggleResponse } from "./social-feed.type";

export class SocialReactionService {
  private accessService: SocialAccessService;
  private reactionRepository: SocialPostReactionRepository;

  constructor(accessService: SocialAccessService) {
    this.accessService = accessService;
    this.reactionRepository = new SocialPostReactionRepository();
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
}
