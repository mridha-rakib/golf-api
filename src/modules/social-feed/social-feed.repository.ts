import { BaseRepository } from "@/modules/base/base.repository";
import type {
  ISocialFollow,
  ISocialPost,
  ISocialPostComment,
  ISocialPostReaction,
} from "./social-feed.interface";
import {
  SocialFollow,
  SocialPost,
  SocialPostComment,
  SocialPostReaction,
} from "./social-feed.model";

export class SocialPostRepository extends BaseRepository<ISocialPost> {
  constructor() {
    super(SocialPost);
  }

  async findByGolferUserId(golferUserId: string): Promise<ISocialPost[]> {
    return this.model.find({ golferUserId }).sort({ createdAt: -1 }).exec();
  }

  async findMediaByGolferUserId(golferUserId: string): Promise<ISocialPost[]> {
    return this.model
      .find({
        golferUserId,
        $or: [
          { "mediaUrls.0": { $exists: true } },
          { mediaUrl: { $nin: [null, ""] } },
        ],
      })
      .sort({ createdAt: -1 })
      .exec();
  }

  async findShareByGolferAndPost(
    golferUserId: string,
    sharedFromPostId: string
  ): Promise<ISocialPost | null> {
    return this.model.findOne({ golferUserId, sharedFromPostId }).exec();
  }

  async countSharesByPostId(postId: string): Promise<number> {
    return this.model.countDocuments({ sharedFromPostId: postId }).exec();
  }

  async findFeedPosts(
    golferUserIds: string[],
    page: number,
    limit: number
  ): Promise<ISocialPost[]> {
    const skip = Math.max(0, (page - 1) * limit);
    const filter =
      golferUserIds.length > 0 ? { golferUserId: { $in: golferUserIds } } : {};

    return this.model
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();
  }

  async countFeedPosts(golferUserIds: string[]): Promise<number> {
    const filter =
      golferUserIds.length > 0 ? { golferUserId: { $in: golferUserIds } } : {};

    return this.model.countDocuments(filter).exec();
  }

  async incrementViewCount(postId: string): Promise<ISocialPost | null> {
    return this.model
      .findByIdAndUpdate(postId, { $inc: { viewCount: 1 } }, { new: true })
      .exec();
  }
}

export class SocialPostReactionRepository extends BaseRepository<ISocialPostReaction> {
  constructor() {
    super(SocialPostReaction);
  }

  async findByPostAndGolfer(
    postId: string,
    golferUserId: string
  ): Promise<ISocialPostReaction | null> {
    return this.model.findOne({ postId, golferUserId }).exec();
  }

  async countByPost(postId: string): Promise<number> {
    return this.model.countDocuments({ postId }).exec();
  }

  async deleteByPostAndGolfer(
    postId: string,
    golferUserId: string
  ): Promise<void> {
    await this.model.deleteOne({ postId, golferUserId }).exec();
  }
}

export class SocialPostCommentRepository extends BaseRepository<ISocialPostComment> {
  constructor() {
    super(SocialPostComment);
  }

  async findByPostId(postId: string): Promise<ISocialPostComment[]> {
    return this.model.find({ postId }).sort({ createdAt: 1 }).exec();
  }
}

export class SocialFollowRepository extends BaseRepository<ISocialFollow> {
  constructor() {
    super(SocialFollow);
  }

  async findByFollowerAndFollowing(
    followerUserId: string,
    followingUserId: string
  ): Promise<ISocialFollow | null> {
    return this.model.findOne({ followerUserId, followingUserId }).exec();
  }

  async findFollowingIds(followerUserId: string): Promise<string[]> {
    const follows = await this.model
      .find({ followerUserId })
      .select("followingUserId")
      .lean()
      .exec();

    return follows.map((follow) => follow.followingUserId.toString());
  }
}
