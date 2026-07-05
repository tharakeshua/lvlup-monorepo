import type { TenantRole } from "@levelup/domain";
import type { UnifiedUser, UserMembership, Tenant } from "../contracts/legacy-docs";
/** Get a user document by UID. */
export declare function getUser(uid: string): Promise<UnifiedUser | null>;
/** Get a membership document. */
export declare function getMembership(
  uid: string,
  tenantId: string
): Promise<UserMembership | null>;
/** Get a tenant document. */
export declare function getTenant(tenantId: string): Promise<Tenant | null>;
/** Atomically increment or decrement a tenant stat counter. */
export declare function updateTenantStats(
  tenantId: string,
  role: TenantRole,
  operation: "increment" | "decrement"
): Promise<void>;
