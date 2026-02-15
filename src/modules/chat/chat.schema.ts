import { z } from "zod";

export const createGroupSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(100),
    clubId: z.string().min(1).optional(),
    avatarUrl: z.string().url().optional(),
    memberUserIds: z.array(z.string().min(1)).default([]),
  }),
});

export const createDirectSchema = z.object({
  body: z.object({
    golferUserId: z.string().min(1),
  }),
});

export const reactToMessageSchema = z.object({
  params: z.object({
    messageId: z.string().min(1),
  }),
  body: z
    .object({
      emoji: z.string().trim().max(16).optional(),
    })
    .default({}),
});

export const messageIdParamSchema = z.object({
  params: z.object({
    messageId: z.string().min(1),
  }),
});
