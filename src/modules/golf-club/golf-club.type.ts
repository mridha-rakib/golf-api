import type { UserResponse } from "../user/user.type";

export type CreateGolfClubPayload = {
  clubName: string;
  email: string;
  password: string;
  address?: string;
  managerIds?: string[];
};

export type AssignClubManagerPayload = {
  clubId: string;
  golferUserId: string;
  clubPassword?: string;
  assignedByAdminId?: string;
};

export type AddClubMemberPayload = {
  clubId: string;
  golferUserId: string;
  assignedByAdminId?: string;
};

export type GolfClubResponse = {
  _id: string;
  name: string;
  clubUserId: string;
  clubEmail: string;
  managerUserId?: string | null;
  coverImageUrl?: string | null;
  profileImageUrl?: string | null;
  country?: string;
  city?: string;
  address?: string;
  ghinNumber?: string;
  memberCount?: number;
  createdAt: Date;
  updatedAt: Date;
};

export type GolfClubMemberResponse = {
  _id: string;
  clubId: string;
  golferUserId: string;
  createdAt: Date;
  updatedAt: Date;
};

export type ClubRole = "club_member" | "club_manager";

export type ClubRoleAssignmentPayload = {
  clubId: string;
  managerIds?: string[];
  memberIds?: string[];
  clubPassword?: string;
  assignedByAdminId?: string;
};

export type ClubRolesResponse = {
  clubId: string;
  managers: Array<{
    golferId: string;
    user: UserResponse;
  }>;
  members: Array<{
    golferId: string;
    user: UserResponse;
  }>;
  assignments: Array<{
    golferId: string;
    user: UserResponse;
    roles: ClubRole[];
  }>;
};
