import { BaseRepository } from "@/modules/base/base.repository";
import type { IUser } from "@/modules/user/user.interface";
import { User } from "@/modules/user/user.model";
import type { FilterQuery, SortOrder } from "mongoose";

export class SocialGolferRepository extends BaseRepository<IUser> {
  constructor() {
    super(User);
  }

  async searchGolfers(
    filter: FilterQuery<IUser>,
    page: number,
    limit: number,
    sort: Record<string, SortOrder> = { createdAt: -1 },
  ): Promise<{ golfers: IUser[]; total: number }> {
    const skip = Math.max(0, (page - 1) * limit);

    const [golfers, total] = await Promise.all([
      this.model.find(filter).sort(sort).skip(skip).limit(limit).exec(),
      this.model.countDocuments(filter).exec(),
    ]);

    return { golfers, total };
  }
}
