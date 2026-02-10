import { z } from "zod";

export const listNotificationsSchema = z.object({
  query: z
    .object({
      page: z.coerce.number().int().min(1).optional(),
      limit: z.coerce.number().int().min(1).max(100).optional(),
    })
    .optional()
    .default({}),
});

export const markNotificationsReadSchema = z.object({
  body: z
    .object({
      notificationId: z.string().min(1).optional(),
      notificationIds: z.array(z.string().min(1)).optional(),
      countOnly: z.coerce.boolean().optional(),
    })
    .optional()
    .default({}),
});
