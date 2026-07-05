import { HttpsError } from "firebase-functions/v2/https";
import type { TenantFeatures } from "../contracts/legacy-docs";
import { getTenant } from "./firestore-helpers";

/**
 * Assert a tenant has the given feature enabled.
 * Throws `permission-denied` if the feature is disabled.
 */
export async function assertFeatureEnabled(
  tenantId: string,
  feature: keyof TenantFeatures
): Promise<void> {
  const tenant = await getTenant(tenantId);
  if (!tenant) {
    throw new HttpsError("not-found", "Tenant not found");
  }

  if (!tenant.features[feature]) {
    throw new HttpsError(
      "permission-denied",
      `Feature "${feature}" is not enabled for your plan. Contact your administrator.`
    );
  }
}
