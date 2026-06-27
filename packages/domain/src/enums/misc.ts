import { zEnum } from "./enum.js";

// ---------------------------------------------------------------------------
// Auth / ingestion
// ---------------------------------------------------------------------------
export const AUTH_PROVIDERS = ["email", "phone", "google", "apple"] as const;
export type AuthProvider = (typeof AUTH_PROVIDERS)[number];
export const zAuthProvider = zEnum(AUTH_PROVIDERS);

// 'gcs' DROPPED (single ingestion path — REVIEW D12 / autograde rec #2).
export const UPLOAD_SOURCES = ["web", "scanner", "rn"] as const;
export type UploadSource = (typeof UPLOAD_SOURCES)[number];
export const zUploadSource = zEnum(UPLOAD_SOURCES);

// ---------------------------------------------------------------------------
// Announcements (identity + notification)
// ---------------------------------------------------------------------------
export const ANNOUNCEMENT_SCOPES = ["platform", "tenant"] as const;
export type AnnouncementScope = (typeof ANNOUNCEMENT_SCOPES)[number];
export const zAnnouncementScope = zEnum(ANNOUNCEMENT_SCOPES);

export const ANNOUNCEMENT_STATUSES = ["draft", "published", "archived"] as const;
export type AnnouncementStatus = (typeof ANNOUNCEMENT_STATUSES)[number];
export const zAnnouncementStatus = zEnum(ANNOUNCEMENT_STATUSES);
