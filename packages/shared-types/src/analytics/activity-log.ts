/**
 * Platform-wide activity log for super-admin visibility.
 * Collection: /platformActivityLog/{autoId}
 */

import type { FirestoreTimestamp } from "../identity/user";

export type PlatformActivityAction =
  | "tenant_created"
  | "tenant_updated"
  | "tenant_deactivated"
  | "tenant_reactivated"
  | "user_created"
  | "users_bulk_imported";

export interface PlatformActivityLog {
  id: string;
  action: PlatformActivityAction;
  actorUid: string;
  actorEmail: string;
  tenantId?: string;
  metadata: Record<string, unknown>;
  createdAt: FirestoreTimestamp;
}
