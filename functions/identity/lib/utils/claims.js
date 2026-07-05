"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_CLAIM_CLASS_IDS = void 0;
exports.buildClaimsForMembership = buildClaimsForMembership;
const domain_1 = require("@levelup/domain");
Object.defineProperty(exports, "MAX_CLAIM_CLASS_IDS", {
  enumerable: true,
  get: function () {
    return domain_1.MAX_CLAIM_CLASS_IDS;
  },
});
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
function buildClaimsForMembership(membership, opts = {}) {
  const classIds = membership.classIds ?? membership.permissions?.managedClassIds ?? [];
  const overflow = classIds.length > domain_1.MAX_CLAIM_CLASS_IDS;
  const claims = {
    role: membership.role,
    tenantId: membership.tenantId,
    tenantCode: membership.tenantCode,
    teacherId: membership.teacherId,
    studentId: membership.studentId,
    parentId: membership.parentId,
    staffId: membership.staffId,
    scannerId: membership.scannerId,
    classIds: overflow ? classIds.slice(0, domain_1.MAX_CLAIM_CLASS_IDS) : classIds,
    classIdsOverflow: overflow || undefined,
    studentIds: membership.parentLinkedStudentIds,
    permissions: booleanEntries(membership.permissions),
    staffPermissions: booleanEntries(membership.staffPermissions),
    isSuperAdmin: opts.isSuperAdmin || undefined,
  };
  for (const k of Object.keys(claims)) {
    if (claims[k] === undefined) delete claims[k];
  }
  return claims;
}
/** Lift only boolean-valued entries (drops legacy managed*Ids arrays). */
function booleanEntries(source) {
  if (!source) return undefined;
  const out = {};
  for (const [k, v] of Object.entries(source)) {
    if (typeof v === "boolean") out[k] = v;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
//# sourceMappingURL=claims.js.map
