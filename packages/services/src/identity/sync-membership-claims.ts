/**
 * `syncMembershipClaims` — the SINGLE claim-mint primitive (common-api §4.5 /
 * REVIEW §6.2). Builds the `PlatformClaims` for `(uid, tenantId)` from the
 * authoritative membership doc and writes them via the Admin-Auth `claims.set`
 * (⚷ — the only claims writer in the system). Every role/status/class/permission
 * change funnels through here so claims can never drift from memberships.
 *
 * Called by: `provisionMembership`, every `save*` create branch, `createOrgUser`,
 * `joinTenant`, `switchActiveTenant`, bulk ops, and the `onMembershipWritten`
 * trigger (the single claim-sync writer).
 */
import type { PlatformClaims } from "@levelup/domain";
import type { AuthContext, SystemContext } from "../shared/context.js";
import { fail } from "../shared/context.js";
import { xrepos } from "../shared/extended-repos.js";

/** The claim-relevant subset of a membership doc (read from `ctx.repos.memberships`). */
interface MembershipLike {
  role?: string;
  tenantId?: string;
  tenantCode?: string;
  teacherId?: string;
  studentId?: string;
  parentId?: string;
  staffId?: string;
  scannerId?: string;
  classIds?: string[];
  permissions?: Record<string, boolean>;
  staffPermissions?: Record<string, boolean>;
  parentLinkedStudentIds?: string[];
  status?: string;
}

/** Above this, classIds spill to the membership doc and the claim sets `classIdsOverflow`. */
export const MAX_CLAIM_CLASS_IDS = 15;

/** Build the `PlatformClaims` object for a membership (pure; testable). */
export function buildClaimsFromMembership(
  membership: MembershipLike,
  opts: { isSuperAdmin?: boolean } = {}
): PlatformClaims {
  const classIds = membership.classIds ?? [];
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
    permissions: membership.permissions as PlatformClaims["permissions"],
    staffPermissions: membership.staffPermissions as PlatformClaims["staffPermissions"],
    isSuperAdmin: opts.isSuperAdmin || undefined,
  };
  // Drop undefined keys so the minted claim stays compact (token size matters).
  for (const k of Object.keys(claims) as (keyof PlatformClaims)[]) {
    if (claims[k] === undefined) delete claims[k];
  }
  return claims;
}

/**
 * Resync `(uid, tenantId)`'s custom claims from the authoritative membership.
 * When `status` is suspended/inactive the claim is minted but refresh tokens are
 * revoked (SEC-05 — a disabled membership cannot keep an old token). Idempotent.
 */
export async function syncMembershipClaims(
  uid: string,
  tenantId: string,
  ctx: AuthContext | SystemContext,
  opts: { revoke?: boolean; isSuperAdmin?: boolean } = {}
): Promise<PlatformClaims> {
  const membership = (await xrepos(ctx).memberships.get(uid, tenantId)) as MembershipLike | null;
  if (!membership) fail("NOT_FOUND", `membership ${uid}@${tenantId} not found`);

  const claims = buildClaimsFromMembership(membership, { isSuperAdmin: opts.isSuperAdmin });
  await ctx.repos.claims.set(uid, claims as unknown as Record<string, unknown>);

  const inactive = membership.status === "suspended" || membership.status === "inactive";
  if (opts.revoke || inactive) {
    await ctx.repos.claims.revokeRefreshTokens(uid);
  }
  return claims;
}
