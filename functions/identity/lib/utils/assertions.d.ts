import type { Tenant } from "../contracts/legacy-docs";
/**
 * Assert a tenant is accessible for the given operation type.
 * - 'write': only active tenants (creating users, importing, etc.)
 * - 'access': active or trial tenants (switching, reading data, etc.)
 */
export declare function assertTenantAccessible(
  tenant: Tenant | null,
  operation: "write" | "access"
): void;
/** Assert the caller is a TenantAdmin for the given tenant, or a SuperAdmin. */
export declare function assertTenantAdminOrSuperAdmin(
  callerUid: string | undefined,
  tenantId: string
): Promise<void>;
