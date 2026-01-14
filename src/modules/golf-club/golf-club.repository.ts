import { BaseRepository } from "@/modules/base/base.repository";
import type { IGolfClub, IGolfClubMember } from "./golf-club.interface";
import { GolfClub, GolfClubMember } from "./golf-club.model";

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
