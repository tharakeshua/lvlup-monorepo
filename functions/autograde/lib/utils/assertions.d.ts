import { CallableRequest } from "firebase-functions/v2/https";
export interface CallerMembership {
  uid: string;
  tenantId: string;
  role: string;
  permissions?: Record<string, boolean>;
}
/**
 * Extract and validate caller membership from custom claims.
 */
export declare function getCallerMembership(request: CallableRequest): CallerMembership;
/**
 * Assert caller has permission for AutoGrade operations.
 * Accepts tenantAdmin, superAdmin, or teacher with the specified permission.
 */
export declare function assertAutogradePermission(
  caller: CallerMembership,
  requiredTenantId: string,
  teacherPermission?: string,
  options?: {
    allowScanner?: boolean;
  }
): void;
