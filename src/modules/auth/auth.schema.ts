// file: src/modules/auth/auth.schema.ts

import { MESSAGES, ROLES } from "@/constants/app.constants";
import { z } from "zod";

/**
 * Register schema with conditional password validation
 */
export const registerSchema = z.object({
  body: z.object({
    email: z.string().email(MESSAGES.VALIDATION.INVALID_EMAIL),
    password: z.string().min(8, MESSAGES.VALIDATION.PASSWORD_TOO_SHORT),
    fullName: z.string().min(2).max(100),
  }),
});

export const loginSchema = z.object({
  body: z.preprocess(
    (value) => {
      if (!value || typeof value !== "object") return value;
      const body = value as Record<string, unknown>;

      const pick = (v: unknown) =>
        typeof v === "string" && v.trim().length > 0 ? v.trim() : undefined;

      // Backward/forward compatible: accept email OR username OR identifier.
      const identifier =
        pick(body.email) ?? pick(body.username) ?? pick(body.identifier);

      if (!identifier) return body;

      return {
        ...body,
        email: identifier,
      };
    },
    z.object({
      email: z.string().min(1, "Email or username is required"),
      password: z.string().min(1, "Password is required"),
    }),
  ),
});

export const verifyEmailSchema = z.object({
  body: z.object({
    email: z.string().email(MESSAGES.VALIDATION.INVALID_EMAIL),
    code: z.string().length(4, "Verification code must be 4 digits"),
  }),
});

export const requestPasswordResetSchema = z.object({
  body: z.object({
    email: z.string().email(MESSAGES.VALIDATION.INVALID_EMAIL),
  }),
});

export const verifyOTPSchema = z.object({
  body: z.object({
    email: z.string().email(MESSAGES.VALIDATION.INVALID_EMAIL),
    otp: z.string().length(4, "OTP must be 4 digits"),
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    email: z.string().email(MESSAGES.VALIDATION.INVALID_EMAIL),
    otp: z.string().length(4, "OTP must be 4 digits"),
    newPassword: z.string().min(8, MESSAGES.VALIDATION.PASSWORD_TOO_SHORT),
  }),
});

export const refreshTokenSchema = z.object({
  body: z.object({}).optional(),
});

export const resendVerificationCodeSchema = z.object({
  body: z.object({
    email: z.string().email(MESSAGES.VALIDATION.INVALID_EMAIL),
    userType: z
      .enum([ROLES.ADMIN, ROLES.GOLF_CLUB, ROLES.GOLFER])
      .optional(),
    userName: z.string().optional(),
  }),
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, MESSAGES.VALIDATION.PASSWORD_TOO_SHORT),
  }),
});
