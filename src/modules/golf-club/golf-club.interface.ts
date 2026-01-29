import type { Document, Types } from "mongoose";

export interface IGolfClub extends Document {
  _id: Types.ObjectId;
  name: string;
  clubUserId: Types.ObjectId;
  managerUserId?: Types.ObjectId | null;
  coverImageUrl?: string | null;
  profileImageUrl?: string | null;
  country?: string;
  city?: string;
  address?: string;
  ghinNumber?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IGolfClubMember extends Document {
  _id: Types.ObjectId;
  clubId: Types.ObjectId | string;
  golferUserId: Types.ObjectId | string;
  createdAt: Date;
  updatedAt: Date;
}
