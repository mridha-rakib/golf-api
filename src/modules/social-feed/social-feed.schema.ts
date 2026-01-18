import { z } from "zod";

const textSchema = z.string().trim().min(1).max(2000);
const idSchema = z.string().min(1);
const optionalTextSchema = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}, z.string().trim().min(1).max(2000).optional());

export const createPostSchema = z.object({
  body: z.object({
    text: textSchema,
    mediaUrls: z.array(z.string().trim().min(1).max(2048)).min(1),
  }),
});

export const sharePostSchema = z.object({
  params: z.object({
    postId: idSchema,
  }),
  body: z
    .object({
      text: optionalTextSchema,
    })
    .optional()
    .default({}),
});

export const toggleReactionSchema = z.object({
  params: z.object({
    postId: idSchema,
  }),
});

export const incrementViewSchema = z.object({
  params: z.object({
    postId: idSchema,
  }),
});

export const addCommentSchema = z.object({
  params: z.object({
    postId: idSchema,
  }),
  body: z.object({
    text: textSchema,
  }),
});

export const replyCommentSchema = z.object({
  params: z.object({
    commentId: idSchema,
  }),
  body: z.object({
    text: textSchema,
  }),
});

export const followGolferSchema = z.object({
  params: z.object({
    golferUserId: idSchema,
  }),
});

export const profileSchema = z.object({
  params: z.object({
    golferUserId: idSchema,
  }),
});

export const postDetailsSchema = z.object({
  params: z.object({
    postId: idSchema,
  }),
});
