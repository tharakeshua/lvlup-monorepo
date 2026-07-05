import type { TenantRole } from "@levelup/domain";
import type { UserMembership } from "../contracts/legacy-docs";
/**
 * Assert the caller is authenticated. Returns the caller UID.
 */
export declare function assertAuth(
  auth:
    | {
        uid: string;
      }
    | undefined
): string;
/**
 * Assert the caller is a teacher/admin for the tenant.
 * Checks the userMemberships collection.
 */
export declare function assertTeacherOrAdmin(
  callerUid: string,
  tenantId: string
): Promise<{
  role: TenantRole;
  membership: UserMembership;
}>;
/**
 * Assert the caller is a member of the tenant (any role).
 */
export declare function assertTenantMember(
  callerUid: string,
  tenantId: string
): Promise<{
  role: TenantRole;
  membership: UserMembership;
}>;
