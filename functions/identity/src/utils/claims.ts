import type { PlatformClaims } from "@levelup/domain";
import { MAX_CLAIM_CLASS_IDS } from "@levelup/domain";
import type { MembershipClaimsInput } from "../contracts/legacy-docs";

export { MAX_CLAIM_CLASS_IDS };

/**
 * Build the custom-claims payload for a membership — CONVERGED with the v1
 * claim mint (`packages/services/src/identity/sync-membership-claims.ts
 * buildClaimsFromMembership`, RR-T2-A): flat per-role id fields, record-based
 * permissions, `classIdsOverflow`/`isSuperAdmin` present-or-absent (never
 * false), undefined keys dropped so the JWT stays compact. Output parses
 * against domain `PlatformClaimsSchema`.
 *
 * Divergences this kills (the DEP-1 bug class):
 * - the legacy path could never mint `isSuperAdmin` — callers that REPLACE
 *   claims (joinTenant/switchActiveTenant) silently stripped it from
 *   super-admin users. Callers now pass `opts.isSuperAdmin` through.
 * - permission keys pass through UNTRANSLATED (legacy vocabulary, RR-T2-B is
 *   blocked on product); only boolean entries are lifted — the legacy
 *   `managedClassIds`/`managedSpaceIds` arrays never leak into the claim.
 *
 * classIds source: v1 memberships carry top-level `classIds`; legacy docs
 * carry `permissions.managedClassIds` — widen-on-read across both.
 */
export function buildClaimsForMembership(
  membership: MembershipClaimsInput,
  opts: { isSuperAdmin?: boolean } = {}
): PlatformClaims {
  const classIds = membership.classIds ?? membership.permissions?.managedClassIds ?? [];
  const overflow = classIds.length > MAX_CLAIM_CLASS_IDS;

  const claims: PlatformClaims = {
    role: membership.role as PlatformClaims["role"],
    tenantId: membership.tenantId as PlatformClaims["tenantId"],
    tenantCode: membership.tenantCode as PlatformClaims["tenantCode"],
    teacherId: membership.teacherId as PlatformClaims["teacherId"],
    studentId: membership.studentId as PlatformClaims["studentId"],
    parentId: membership.parentId as PlatformClaims["parentId"],
    staffId: membership.staffId as PlatformClaims["staffId"],
    scannerId: membership.scannerId as PlatformClaims["scannerId"],
    classIds: (overflow
      ? classIds.slice(0, MAX_CLAIM_CLASS_IDS)
      : classIds) as PlatformClaims["classIds"],
    classIdsOverflow: overflow || undefined,
    studentIds: membership.parentLinkedStudentIds as PlatformClaims["studentIds"],
    permissions: booleanEntries(membership.permissions) as PlatformClaims["permissions"],
    staffPermissions: booleanEntries(
      membership.staffPermissions
    ) as PlatformClaims["staffPermissions"],
    isSuperAdmin: opts.isSuperAdmin || undefined,
  };

  for (const k of Object.keys(claims) as (keyof PlatformClaims)[]) {
    if (claims[k] === undefined) delete claims[k];
  }
  return claims;
}

/**
 * Lift only boolean-valued permission entries (drops legacy managed*Ids arrays).
 * Also unwraps the domain nested shape `{ permissions: { canX: true }, managedClassIds }`
 * so claim JWTs stay a flat `Record<string, boolean>` (PlatformClaimsSchema).
 */
function booleanEntries(source: object | undefined): Record<string, boolean> | undefined {
  if (!source) return undefined;
  const out: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(source)) {
    if (typeof v === "boolean") out[k] = v;
  }
  const nested = (source as { permissions?: unknown }).permissions;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    for (const [k, v] of Object.entries(nested as Record<string, unknown>)) {
      if (typeof v === "boolean") out[k] = v;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
