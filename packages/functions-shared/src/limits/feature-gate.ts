/**
 * Feature gate (server-shared.md §2.6). Reads tenant features via
 * `ctx.repos.tenants.get(...)` — NOT direct Firestore. Throws FEATURE_DISABLED.
 */
import type { TenantFeatures } from "@levelup/domain";
import type { AuthContext } from "../context/auth-context.js";
import { fail } from "../request/fail.js";

export async function assertFeatureEnabled(
  ctx: AuthContext,
  feature: keyof TenantFeatures
): Promise<void> {
  if (ctx.uid === "<system>") return; // system actor not feature-gated
  if (!ctx.tenantId) {
    fail("FEATURE_DISABLED", `feature ${String(feature)} requires a tenant`, {
      meta: { feature: String(feature) },
    });
  }
  const tenant = await ctx.repos.tenants.get(ctx.tenantId);
  if (
    tenant?.status === "deactivated" ||
    tenant?.status === "expired" ||
    tenant?.status === "suspended"
  ) {
    fail("TENANT_SUSPENDED", `tenant is ${tenant.status}`, { meta: { status: tenant.status } });
  }
  const enabled = tenant?.features?.[feature];
  if (enabled === false) {
    fail("FEATURE_DISABLED", `feature ${String(feature)} is disabled for this tenant`, {
      meta: { feature: String(feature) },
    });
  }
}
