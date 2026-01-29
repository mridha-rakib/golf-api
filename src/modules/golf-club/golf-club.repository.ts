import { BaseRepository } from "@/modules/base/base.repository";
import type {
  IGolfClub,
  IGolfClubMember,
} from "./golf-club.interface";
import { GolfClub, GolfClubMember } from "./golf-club.model";
import type { IGolfClubRoleAssignment } from "./golf-club-role.interface";
import { CLUB_ROLES, GolfClubRoleAssignment } from "./golf-club-role.model";
import { Types } from "mongoose";

export class GolfClubRepository extends BaseRepository<IGolfClub> {
  constructor() {
    super(GolfClub);
  }

  async findByClubUserId(clubUserId: string): Promise<IGolfClub | null> {
    return this.model.findOne({ clubUserId }).exec();
  }
}

export class GolfClubMemberRepository extends BaseRepository<IGolfClubMember> {
  constructor() {
    super(GolfClubMember);
  }

  async findByClubAndGolfer(
    clubId: string,
    golferUserId: string
  ): Promise<IGolfClubMember | null> {
    return this.model.findOne({ clubId, golferUserId }).exec();
  }
}

export class GolfClubRoleRepository extends BaseRepository<IGolfClubRoleAssignment> {
  constructor() {
    super(GolfClubRoleAssignment);
  }

  async findByClubId(clubId: string): Promise<IGolfClubRoleAssignment[]> {
    return this.model
      .find({ clubId })
      .sort({ updatedAt: -1 })
      .exec();
  }

  async deleteByClubId(clubId: string): Promise<number> {
    const result = await this.model.deleteMany({ clubId }).exec();
    return result.deletedCount || 0;
  }

  async countByClubIds(clubIds: string[]): Promise<Map<string, number>> {
    if (clubIds.length === 0) {
      return new Map();
    }

    const memberRoleValue = CLUB_ROLES.CLUB_MEMBER;
    const results = await this.model
      .aggregate([
        {
          $match: {
            clubId: { $in: clubIds.map((id) => new Types.ObjectId(id)) },
            roles: memberRoleValue,
          },
        },
        { $group: { _id: "$clubId", memberCount: { $sum: 1 } } },
      ])
      .exec();

    const map = new Map<string, number>();
    results.forEach((record) => {
      map.set(record._id.toString(), record.memberCount);
    });
    return map;
  }
}
