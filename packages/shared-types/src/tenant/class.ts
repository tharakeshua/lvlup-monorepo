/**
 * Class entity within a tenant.
 * Collection: /tenants/{tenantId}/classes/{classId}
 */

import type { FirestoreTimestamp } from "../identity/user";

export interface Class {
  id: string;
  tenantId: string;
  name: string;
  grade: string;
  section?: string;
  academicSessionId?: string;
  teacherIds: string[];
  studentIds: string[];
  studentCount: number;
  status: "active" | "archived";
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}
