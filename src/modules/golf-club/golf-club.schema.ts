import { MESSAGES } from "@/constants/app.constants";
import { z } from "zod";

export const createGolfClubSchema = z.object({
  body: z.object({
    clubName: z.string().min(2).max(100),
    email: z.string().email(MESSAGES.VALIDATION.INVALID_EMAIL),
  }),
});

export const assignClubManagerSchema = z.object({
  params: z.object({
    clubId: z.string().min(1),
  }),
  body: z.object({
    golferUserId: z.string().min(1),
  }),
});

export const addClubMemberSchema = z.object({
  params: z.object({
    clubId: z.string().min(1),
  }),
  body: z.object({
    golferUserId: z.string().min(1),
  }),
});
