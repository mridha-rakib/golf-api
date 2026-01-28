import { BaseSchemaUtil } from "@/utils/base-schema.utils";
import { model, Schema } from "mongoose";
import type {
  ISocialFollow,
  ISocialPost,
  ISocialPostView,
  ISocialPostComment,
  ISocialPostReaction,
} from "./social-feed.interface";

const socialPostSchema = BaseSchemaUtil.createSchema<ISocialPost>({
  golferUserId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  text: {
    type: String,
    required: function (this: ISocialPost) {
      return !this.sharedFromPostId;
    },
    trim: true,
  },
  mediaUrls: {
    type: [{ type: String, trim: true }],
    default: [],
  },
  mediaUrl: {
    type: String,
    default: null,
    trim: true,
  },
  viewCount: {
    type: Number,
    default: 0,
    min: 0,
  },
  sharedFromPostId: {
    type: Schema.Types.ObjectId,
    ref: "SocialPost",
    default: null,
    index: true,
  },
});

socialPostSchema.index({ golferUserId: 1, createdAt: -1 });

const socialPostReactionSchema = BaseSchemaUtil.createSchema<ISocialPostReaction>(
  {
    postId: {
      type: Schema.Types.ObjectId,
      ref: "SocialPost",
      required: true,
      index: true,
    },
    golferUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    reaction: {
      type: String,
      enum: ["love"],
      default: "love",
    },
  }
);

socialPostReactionSchema.index(
  { postId: 1, golferUserId: 1 },
  { unique: true }
);

const socialPostCommentSchema = BaseSchemaUtil.createSchema<ISocialPostComment>({
  postId: {
    type: Schema.Types.ObjectId,
    ref: "SocialPost",
    required: true,
    index: true,
  },
  golferUserId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  text: {
    type: String,
    required: true,
    trim: true,
  },
  parentCommentId: {
    type: Schema.Types.ObjectId,
    ref: "SocialPostComment",
    default: null,
    index: true,
  },
});

socialPostCommentSchema.index({ postId: 1, parentCommentId: 1, createdAt: 1 });

const socialFollowSchema = BaseSchemaUtil.createSchema<ISocialFollow>({
  followerUserId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  followingUserId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
});

socialFollowSchema.index(
  { followerUserId: 1, followingUserId: 1 },
  { unique: true }
);

const socialPostViewSchema = BaseSchemaUtil.createSchema<ISocialPostView>({
  postId: {
    type: Schema.Types.ObjectId,
    ref: "SocialPost",
    required: true,
    index: true,
  },
  viewerEmail: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true,
  },
  viewerUserId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
});

socialPostViewSchema.index(
  { postId: 1, viewerEmail: 1 },
  { unique: true }
);

export const SocialPost = model<ISocialPost>("SocialPost", socialPostSchema);
export const SocialPostReaction = model<ISocialPostReaction>(
  "SocialPostReaction",
  socialPostReactionSchema
);
export const SocialPostComment = model<ISocialPostComment>(
  "SocialPostComment",
  socialPostCommentSchema
);
export const SocialFollow = model<ISocialFollow>(
  "SocialFollow",
  socialFollowSchema
);
export const SocialPostView = model<ISocialPostView>(
  "SocialPostView",
  socialPostViewSchema
);
