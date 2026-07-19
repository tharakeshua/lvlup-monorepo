import type { FirestoreTimestamp } from "../identity/user";

export type AnnouncementScope = "platform" | "tenant";
export type AnnouncementStatus = "draft" | "published" | "archived";

export interface Announcement {
  id: string;
  tenantId?: string;
  title: string;
  body: string;
  authorUid: string;
  authorName: string;
  scope: AnnouncementScope;
  targetRoles?: string[];
  targetClassIds?: string[];
  status: AnnouncementStatus;
  publishedAt?: FirestoreTimestamp;
  archivedAt?: FirestoreTimestamp;
  expiresAt?: FirestoreTimestamp;
  readBy: string[];
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}
