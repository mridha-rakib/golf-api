import { BaseSchemaUtil } from "@/utils/base-schema.utils";
import { model, Schema } from "mongoose";
import type { IGolfClub, IGolfClubMember } from "./golf-club.interface";

const golfClubSchema = BaseSchemaUtil.createSchema<IGolfClub>({
  name: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },
  clubUserId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
    index: true,
  },
  managerUserId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    default: null,
    index: true,
  },
  coverImageUrl: {
    type: String,
    default: null,
  },
  profileImageUrl: {
    type: String,
    default: null,
  },
  country: {
    type: String,
    trim: true,
    index: true,
    default: "",
  },
  city: {
    type: String,
    trim: true,
    index: true,
    default: "",
  },
  address: {
    type: String,
    trim: true,
    default: "",
  },
  ghinNumber: {
    type: String,
    trim: true,
    default: "",
  },
});

const golfClubMemberSchema = BaseSchemaUtil.createSchema<IGolfClubMember>({
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
});

golfClubMemberSchema.index({ clubId: 1, golferUserId: 1 }, { unique: true });

export const GolfClub = model<IGolfClub>("GolfClub", golfClubSchema);
export const GolfClubMember = model<IGolfClubMember>(
  "GolfClubMember",
  golfClubMemberSchema
);
