/**
 * Academic session within a tenant.
 * Collection: /tenants/{tenantId}/academicSessions/{sessionId}
 */

import type { FirestoreTimestamp } from "../identity/user";

export interface AcademicSession {
  id: string;
  tenantId: string;
  name: string;
  startDate: FirestoreTimestamp;
  endDate: FirestoreTimestamp;
  isCurrent: boolean;
  status: "active" | "archived";
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}
