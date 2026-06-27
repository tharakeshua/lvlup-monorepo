/**
 * `provisionMembership` — the SINGLE membership-write factory (REVIEW §1 / §6.3).
 *
 * Every path that creates org access (`createOrgUser`, `save*` create branches,
 * `joinTenant`, bulk imports) funnels through here so a membership doc is written
 * exactly one way and claims are synced exactly one way. The membership doc is the
 * source of truth; the claim is a projection minted by `syncMembershipClaims`.
 */
import type { AuthContext, SystemContext } from "../shared/context.js";
import { xrepos } from "../shared/extended-repos.js";
import { syncMembershipClaims } from "./sync-membership-claims.js";

export interface ProvisionMembershipInput {
  uid: string;
  tenantId: string;
  tenantCode: string;
  role: string;
  joinSource?: string;
  entityIds?: {
    teacherId?: string;
    studentId?: string;
    parentId?: string;
    staffId?: string;
    scannerId?: string;
  };
  classIds?: string[];
  permissions?: Record<string, boolean>;
  staffPermissions?: Record<string, boolean>;
  parentLinkedStudentIds?: string[];
}

export interface ProvisionMembershipResult {
  membershipId: string;
  created: boolean;
}

/**
 * Upsert the `(uid, tenantId)` membership and resync claims. Returns the
 * membership id. The caller decides whether to revoke refresh tokens (role/status
 * downgrade) by passing `opts.revoke` through; new memberships do not revoke.
 */
export async function provisionMembership(
  input: ProvisionMembershipInput,
  ctx: AuthContext | SystemContext,
  opts: { revoke?: boolean } = {}
): Promise<ProvisionMembershipResult> {
  const repos = xrepos(ctx);
  const now = ctx.now();

  const data: Record<string, unknown> = {
    uid: input.uid,
    tenantId: input.tenantId,
    tenantCode: input.tenantCode,
    role: input.role,
    status: "active",
    joinSource: input.joinSource ?? "admin_created",
    ...(input.entityIds ?? {}),
    classIds: input.classIds ?? [],
    permissions: input.permissions,
    staffPermissions: input.staffPermissions,
    parentLinkedStudentIds: input.parentLinkedStudentIds,
    updatedBy: ctx.uid,
  };
  for (const k of Object.keys(data)) {
    if (data[k] === undefined) delete data[k];
  }

  const { id, created } = await repos.memberships.upsert(input.uid, input.tenantId, data, now);

  // Single claim-sync path (no second claim builder anywhere).
  await syncMembershipClaims(input.uid, input.tenantId, ctx, { revoke: opts.revoke });

  return { membershipId: id, created };
}
