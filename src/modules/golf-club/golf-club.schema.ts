import { MESSAGES } from "@/constants/app.constants";
import { z } from "zod";

export const createGolfClubSchema = z.object({
  body: z.object({
    clubName: z.string().min(2).max(100),
    email: z.string().email(MESSAGES.VALIDATION.INVALID_EMAIL),
    password: z.string().min(8, "Password must be at least 8 characters"),
    address: z.string().trim().max(250).optional(),
    managerIds: z.array(z.string().min(1)).optional(),
  }),
});

export const assignClubManagerSchema = z.object({
  params: z.object({
    clubId: z.string().min(1),
  }),
  body: z.object({
    golferUserId: z.string().min(1),
    clubPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .optional(),
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

export const clubRolesParamsSchema = z.object({
  params: z.object({
    clubId: z.string().min(1),
  }),
});

export const clubRolesSchema = z.object({
  params: z.object({
    clubId: z.string().min(1),
  }),
  body: z.object({
    managerIds: z.array(z.string().min(1)).optional(),
    memberIds: z.array(z.string().min(1)).optional(),
    clubPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .optional(),
  }),
});

export const clubImageParamsSchema = z.object({
  params: z.object({
    clubId: z.string().min(1),
  }),
});

const optionalTrimmedText = (max = 250) =>
  z.string().trim().max(max).optional();

export const updateGolfClubSchema = z.object({
  params: z.object({
    clubId: z.string().min(1),
  }),
  body: z.object({
    country: optionalTrimmedText(100),
    city: optionalTrimmedText(100),
    address: optionalTrimmedText(250),
    ghinNumber: optionalTrimmedText(50),
  }),
});
