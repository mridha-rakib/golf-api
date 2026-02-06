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

export type SocialFeedPostResponse = SocialPostResponse & {
  golfer: UserResponse;
  sharedFromPost?: (SocialPostSummary & { golfer: UserResponse }) | null;
  sharedBy?: UserResponse | null;
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

export type CommentGolferSummary = {
  _id: string;
  fullName?: string;
  profileImage?: string;
};

export type SocialFeedCommentResponse = SocialCommentResponse & {
  commenter: CommentGolferSummary | null;
  golfer?: CommentGolferSummary | null;
  replies: SocialFeedCommentResponse[];
};

export type SocialFeedItemResponse = SocialFeedPostResponse & {
  comments: SocialFeedCommentResponse[];
  reactCount: number;
  commentCount: number;
  reactions?: ReactionWithUser[];
};

export type SocialPostDetailsResponse = SocialPostResponse & {
  comments: SocialFeedCommentResponse[];
  reacted: boolean;
  reactionCount: number;
};

export type SocialPostCommentsGroup = {
  postId: string;
  comments: SocialCommentResponse[];
};

export type SocialPostCommentsGroupWithCommenter = {
  postId: string;
  comments: SocialFeedCommentResponse[];
};

export type SocialPostMediaGroup = {
  postId: string;
  mediaUrls: string[];
  createdAt: Date;
  updatedAt: Date;
};

export type ReactionToggleResponse = {
  reacted: boolean;
  reactionCount: number;
};

export type ReactionWithUser = {
  golferUserId: string;
  reaction: string;
  createdAt: Date;
  user: UserResponse | null;
};

export type ViewCountResponse = {
  postId: string;
  viewCount: number;
};

export type SocialProfileResponse = {
  profile: UserResponse;
  posts: SocialFeedItemResponse[];
  followers: UserResponse[];
  following: UserResponse[];
};

export type SocialProfileBaseResponse = {
  profile: UserResponse;
  posts: SocialFeedPostResponse[];
  followers: UserResponse[];
  following: UserResponse[];
};

export type SocialGolferListItem = {
  golfer: UserResponse;
  isFollowing: boolean;
};
