/**
 * Parent profile within a tenant.
 * Collection: /tenants/{tenantId}/parents/{parentId}
 */

import type { FirestoreTimestamp } from "../identity/user";

export interface Parent {
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
  studentIds: string[];
  /** @deprecated Use studentIds instead */
  childStudentIds?: string[];
  linkedStudentNames?: string[];
  status: "active" | "archived";
  lastLogin?: FirestoreTimestamp;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}
