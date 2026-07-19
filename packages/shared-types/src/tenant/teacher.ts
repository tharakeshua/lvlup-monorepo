/**
 * Teacher profile within a tenant.
 * Collection: /tenants/{tenantId}/teachers/{teacherId}
 */

import type { FirestoreTimestamp } from "../identity/user";

export interface Teacher {
  id: string;
  tenantId: string;
  authUid?: string;
  /** @deprecated Use authUid instead */
  uid?: string;
  email?: string;
  phone?: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  employeeId?: string;
  department?: string;
  subjects: string[];
  designation?: string;
  classIds: string[];
  sectionIds?: string[];
  status: "active" | "archived";
  lastLogin?: FirestoreTimestamp;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}
