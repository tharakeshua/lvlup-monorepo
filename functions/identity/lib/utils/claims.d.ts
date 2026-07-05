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
export declare function buildClaimsForMembership(
  membership: MembershipClaimsInput,
  opts?: {
    isSuperAdmin?: boolean;
  }
): PlatformClaims;
