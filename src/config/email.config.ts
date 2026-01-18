// file: src/config/email.config.ts

import { env } from "@/env";

const gmailConfigured = Boolean(env.GMAIL_USER && env.GMAIL_PASS);

const smtpHost = env.SMTP_HOST ?? (gmailConfigured ? "smtp.gmail.com" : undefined);
const smtpPort =
  env.SMTP_PORT ?? (env.SMTP_HOST ? undefined : gmailConfigured ? 465 : undefined);
const smtpSecure =
  env.SMTP_SECURE ?? (gmailConfigured ? smtpPort === 465 : false);
const smtpUser = env.SMTP_USER || env.GMAIL_USER || "";
const smtpPass = env.SMTP_PASS || env.GMAIL_PASS || "";

const smtpConfigured = Boolean(smtpHost && smtpPort && smtpUser && smtpPass);

const provider = smtpConfigured ? "smtp" : "disabled";
const fromAddress =
  env.EMAIL_FROM_ADDRESS || env.SMTP_FROM || env.SMTP_USER || env.GMAIL_USER || "";

export const EMAIL_CONFIG = {
  provider,
  from: {
    name: env.EMAIL_FROM_NAME || "",
    address: fromAddress,
  },
  replyTo: env.EMAIL_REPLY_TO || "",
  branding: {
    logoUrl: env.EMAIL_LOGO_URL || "",
    brandColor: env.EMAIL_BRAND_COLOR || "",
  },
  retry: {
    maxRetries: env.EMAIL_MAX_RETRIES ?? 0,
    delayMs: env.EMAIL_RETRY_DELAY_MS ?? 0,
  },
  smtp: {
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  },
} as const;

export const EMAIL_ENABLED = provider !== "disabled";
