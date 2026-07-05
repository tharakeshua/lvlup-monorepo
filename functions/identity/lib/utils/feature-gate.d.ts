import type { TenantFeatures } from "../contracts/legacy-docs";
/**
 * Assert a tenant has the given feature enabled.
 * Throws `permission-denied` if the feature is disabled.
 */
export declare function assertFeatureEnabled(
  tenantId: string,
  feature: keyof TenantFeatures
): Promise<void>;
