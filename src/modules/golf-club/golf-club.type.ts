export type CreateGolfClubPayload = {
  clubName: string;
  email: string;
};

export type AssignClubManagerPayload = {
  clubId: string;
  golferUserId: string;
};

export type AddClubMemberPayload = {
  clubId: string;
  golferUserId: string;
};

export type GolfClubResponse = {
  _id: string;
  name: string;
  clubUserId: string;
  clubEmail: string;
  managerUserId?: string | null;
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
