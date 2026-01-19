import type { UserResponse } from "@/modules/user/user.type";

export type CreatePostPayload = {
  text: string;
  mediaUrls?: string[];
};

export type SharePostPayload = {
  text?: string;
};

export type SharePostResult = {
  action: "shared" | "updated";
  shareMessage: string;
  postId: string;
  sharedFromPostId: string;
  post?: SocialPostResponse;
};

export type CreateCommentPayload = {
  text: string;
};

export type FollowResponse = {
  _id: string;
  followerUserId: string;
  followingUserId: string;
  createdAt: Date;
  updatedAt: Date;
};

export type SocialPostSummary = {
  _id: string;
  golferUserId: string;
  text: string;
  mediaUrls: string[];
  mediaUrl?: string | null;
  shareCount: number;
  viewCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type SocialPostResponse = SocialPostSummary & {
  sharedFromPostId?: string | null;
  sharedFromPost?: SocialPostSummary | null;
};

export type SocialCommentResponse = {
  _id: string;
  postId: string;
  golferUserId: string;
  text: string;
  parentCommentId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  replies: SocialCommentResponse[];
};

export type SocialPostDetailsResponse = SocialPostResponse & {
  comments: SocialCommentResponse[];
  reacted: boolean;
  reactionCount: number;
};

export type ReactionToggleResponse = {
  reacted: boolean;
  reactionCount: number;
};

export type ViewCountResponse = {
  postId: string;
  viewCount: number;
};

export type SocialProfileResponse = {
  profile: UserResponse;
  posts: SocialPostResponse[];
};
