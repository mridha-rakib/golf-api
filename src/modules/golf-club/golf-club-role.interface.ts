import type { Document, Types } from "mongoose";

export type ClubRole = "club_member" | "club_manager";

export interface IGolfClubRoleAssignment extends Document {
  _id: Types.ObjectId;
  clubId: Types.ObjectId;
  golferUserId: Types.ObjectId;
  roles: ClubRole[];
  createdAt: Date;
  updatedAt: Date;
}
