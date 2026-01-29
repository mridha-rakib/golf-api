import { BaseSchemaUtil } from "@/utils/base-schema.utils";
import { model, Schema } from "mongoose";
import type { ClubRole, IGolfClubRoleAssignment } from "./golf-club-role.interface";

export const CLUB_ROLES: Record<string, ClubRole> = {
  CLUB_MEMBER: "club_member",
  CLUB_MANAGER: "club_manager",
};

export const CLUB_ROLE_VALUES = Object.values(CLUB_ROLES);

const golfClubRoleAssignmentSchema =
  BaseSchemaUtil.createSchema<IGolfClubRoleAssignment>({
    clubId: {
      type: Schema.Types.ObjectId,
      ref: "GolfClub",
      required: true,
      index: true,
    },
    golferUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    roles: {
      type: [String],
      enum: CLUB_ROLE_VALUES,
      required: true,
      validate: { validator: (val: string[]) => val.length > 0 },
    },
  });

golfClubRoleAssignmentSchema.index({ clubId: 1, golferUserId: 1 }, {
  unique: true,
});

export const GolfClubRoleAssignment = model<IGolfClubRoleAssignment>(
  "GolfClubRoleAssignment",
  golfClubRoleAssignmentSchema,
);
