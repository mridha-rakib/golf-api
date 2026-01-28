import { z } from "zod";

export const createGroupSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(100),
    avatarUrl: z.string().url().optional(),
    memberUserIds: z.array(z.string().min(1)).default([]),
  }),
});

export const createDirectSchema = z.object({
  body: z.object({
    golferUserId: z.string().min(1),
  }),
});
