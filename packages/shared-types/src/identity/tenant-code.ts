/**
 * Tenant code uniqueness index.
 * Collection: /tenantCodes/{code}
 * Document ID = the tenant code itself (e.g., "SPR001").
 */

import type { FirestoreTimestamp } from "./user";

export interface TenantCodeIndex {
  tenantId: string;
  createdAt: FirestoreTimestamp;
}
