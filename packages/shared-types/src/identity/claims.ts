/**
 * Firebase Auth custom claims for the platform.
 * Kept minimal to stay within the 1000-byte JWT limit.
 */

import type { TenantRole } from "./membership";

/** Maximum classIds stored in claims before overflow flag is set. */
export const MAX_CLAIM_CLASS_IDS = 15;

/**
 * Custom claims set on the Firebase Auth JWT.
 * These are the "hot path" fields checked by Firestore security rules.
 */
export interface PlatformClaims {
  role?: TenantRole;
  tenantId?: string;
  tenantCode?: string;
  teacherId?: string;
  studentId?: string;
  parentId?: string;
  scannerId?: string;
  staffId?: string;
  classIds?: string[];
  classIdsOverflow?: boolean;
  studentIds?: string[];
  permissions?: Record<string, boolean>;
  staffPermissions?: Record<string, boolean>;
}
