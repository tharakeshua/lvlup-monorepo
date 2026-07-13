/**
 * Student profile within a tenant.
 * Collection: /tenants/{tenantId}/students/{studentId}
 */

import type { FirestoreTimestamp } from "../identity/user";

/** Student profile document within a tenant's student subcollection. */
export interface Student {
  /** Firestore document ID. */
  id: string;
  /** Parent tenant this student belongs to. */
  tenantId: string;
  /** Firebase Auth UID linking this profile to a login account. */
  uid: string;
  /** School-assigned roll number for attendance and grading. */
  rollNumber?: string;
  /** Class section identifier (e.g., 'A', 'B'). */
  section?: string;
  /** IDs of classes this student is enrolled in. */
  classIds: string[];
  /** IDs of linked parent profiles for the parent portal. */
  parentIds: string[];
  /** Grade level (e.g., '5', '10'). */
  grade?: string;
  /** School-issued admission number. */
  admissionNumber?: string;
  /** Date of birth in ISO format (YYYY-MM-DD). */
  dateOfBirth?: string;
  status: "active" | "archived";
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}
