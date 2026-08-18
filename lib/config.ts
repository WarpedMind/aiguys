export const ALLOWED_EXTENSIONS = [".csv", ".txt"] as const;

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB per file
export const MAX_TOTAL_SIZE_BYTES = 20 * 1024 * 1024; // 20MB per batch
export const MAX_FILES_PER_BATCH = 10;

export const DEFAULT_EMAIL_TO =
  process.env.DEFAULT_SUMMARY_EMAIL_TO || "tomknowsai@gmail.com";

export const DEFAULT_SLACK_WEBHOOK_URL =
  process.env.DEFAULT_SLACK_WEBHOOK_URL || "";

export const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
export const RESEND_FROM_ADDRESS =
  process.env.RESEND_FROM_ADDRESS || "onboarding@resend.dev";
