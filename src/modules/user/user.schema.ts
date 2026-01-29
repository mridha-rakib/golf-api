// file: src/modules/user/user.schema.ts

import { z } from "zod";

const optionalTrimmedString = (options?: { min?: number; max?: number }) =>
  z.preprocess(
    (val) => (typeof val === "string" && val.trim() === "" ? undefined : val),
    z
      .string()
      .trim()
      .min(options?.min ?? 0)
      .max(options?.max ?? 250)
      .optional(),
  );

export const updateUserSchema = z.object({
  body: z.object({
    fullName: optionalTrimmedString({ min: 2, max: 100 }),
    phoneNumber: optionalTrimmedString({ max: 20 }),
    address: optionalTrimmedString({ min: 2, max: 250 }),
    bio: optionalTrimmedString({ max: 500 }),
    userName: optionalTrimmedString({ min: 2, max: 50 }),
    profileImageUrl: optionalTrimmedString({ max: 2048 }),
    coverImageUrl: optionalTrimmedString({ max: 2048 }),
  }),
});
