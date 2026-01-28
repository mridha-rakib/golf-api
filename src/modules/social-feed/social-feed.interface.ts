import type { Document, Types } from "mongoose";

export interface ISocialPost extends Document {
  _id: Types.ObjectId;
  golferUserId: Types.ObjectId | string;
  text: string;
  mediaUrls?: string[];
  mediaUrl?: string | null;
  viewCount: number;
  sharedFromPostId?: Types.ObjectId | string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISocialPostView extends Document {
  _id: Types.ObjectId;
  postId: Types.ObjectId | string;
  viewerEmail: string;
  viewerUserId: Types.ObjectId | string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISocialPostReaction extends Document {
  _id: Types.ObjectId;
  postId: Types.ObjectId | string;
  golferUserId: Types.ObjectId | string;
  reaction: "love";
  createdAt: Date;
  updatedAt: Date;
}

export interface ISocialPostComment extends Document {
  _id: Types.ObjectId;
  postId: Types.ObjectId | string;
  golferUserId: Types.ObjectId | string;
  text: string;
  parentCommentId?: Types.ObjectId | string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISocialFollow extends Document {
  _id: Types.ObjectId;
  followerUserId: Types.ObjectId | string;
  followingUserId: Types.ObjectId | string;
  createdAt: Date;
  updatedAt: Date;
}
