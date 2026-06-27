/**
 * Single-source deployment config (server-shared.md §2.10). Region, queue names,
 * and the per-tenant secret name pattern that were previously hardcoded per file.
 */
import type { TenantId } from "@levelup/domain";

/** The one deploy region (was hardcoded per-function). */
export const REGION = "asia-south1" as const;

/** Cloud Tasks queue names (single-writer pipelines + reliable drains). */
export const QUEUES = {
  gradingPipeline: "grading-pipeline",
  studentRollup: "student-rollup",
  outboxDrain: "outbox-drain",
} as const;
export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

/** GCP project id (emulator/runtime resolved; env override for local). */
export function projectId(): string {
  return (
    process.env.GCLOUD_PROJECT ??
    process.env.GOOGLE_CLOUD_PROJECT ??
    process.env.FIREBASE_PROJECT_ID ??
    "levelup-local"
  );
}

/** Per-tenant Gemini secret name (Secret Manager). Never bundled to clients. */
export const secretNameFor = (tenantId: TenantId | string): string =>
  `tenant-${String(tenantId)}-gemini`;

/** Dev-only contract gate: validate every callable response against its schema. */
export const VALIDATE_RESPONSES =
  process.env.VALIDATE_RESPONSES === "1" || process.env.VALIDATE_RESPONSES === "true";
