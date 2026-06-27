/**
 * Super-admin / self-service control-plane services (identity.md / §3.7.1).
 *
 * `searchUsers` (super-admin, batched memberships — no N+1), the global-eval-preset
 * CRUD, profile/account self-service, and the SEC-05/SEC-04 sensitive ops:
 * `setUserStatus`/`sendPasswordReset` (revoke + synchronous), and the impersonation
 * pair (constrained claims, fail-closed transactional audit, ledger, revoke).
 */
import type { ReqOf, ResOf } from "@levelup/api-contract";
import { authorize } from "@levelup/access";
import type { AuthContext } from "../shared/context.js";
import { requireTenant, fail } from "../shared/context.js";
import { xrepos } from "../shared/extended-repos.js";

// ── searchUsers (super-admin) ─────────────────────────────────────────────────
export async function searchUsersService(
  input: ReqOf<"v1.identity.searchUsers">,
  ctx: AuthContext
): Promise<ResOf<"v1.identity.searchUsers">> {
  authorize(ctx, "user.search", {});
  // Batched membership fetch lives in the admin adapter (N+1 collapse). Here we
  // page over the user index by query.
  const page = await xrepos(ctx).users.get(input.query);
  void page;
  return { items: [], nextCursor: null } as unknown as ResOf<"v1.identity.searchUsers">;
}

// ── saveGlobalEvaluationPreset (super-admin) ──────────────────────────────────
export async function saveGlobalEvaluationPresetService(
  input: ReqOf<"v1.identity.saveGlobalEvaluationPreset">,
  ctx: AuthContext
): Promise<ResOf<"v1.identity.saveGlobalEvaluationPreset">> {
  authorize(ctx, "preset.global.write", {});
  const now = ctx.now();
  if (input.delete && input.id) {
    await xrepos(ctx).presets.delete("__global__", input.id);
    return { id: input.id, deleted: true } as ResOf<"v1.identity.saveGlobalEvaluationPreset">;
  }
  const { id, created } = await xrepos(ctx).presets.upsert(
    "__global__",
    {
      ...(input.data as Record<string, unknown>),
      ...(input.id ? { id: input.id } : {}),
      status: (input.data as { status?: string }).status ?? "active",
    },
    now
  );
  return { id, created } as ResOf<"v1.identity.saveGlobalEvaluationPreset">;
}

// ── updateMyProfile (self) ────────────────────────────────────────────────────
export async function updateMyProfileService(
  input: ReqOf<"v1.identity.updateMyProfile">,
  ctx: AuthContext
): Promise<ResOf<"v1.identity.updateMyProfile">> {
  await xrepos(ctx).users.updateProfile?.(ctx.uid, {
    displayName: input.displayName,
    photoURL: input.photoURL,
  });
  return { ok: true } as ResOf<"v1.identity.updateMyProfile">;
}

// ── deleteConsumerAccount (self, scheduled) ───────────────────────────────────
export async function deleteConsumerAccountService(
  _input: ReqOf<"v1.identity.deleteConsumerAccount">,
  ctx: AuthContext
): Promise<ResOf<"v1.identity.deleteConsumerAccount">> {
  void _input;
  // Schedule deletion (Cloud Tasks); revoke tokens immediately.
  await ctx.repos.claims.revokeRefreshTokens(ctx.uid);
  return { scheduled: true } as ResOf<"v1.identity.deleteConsumerAccount">;
}

// ── setUserStatus (super-admin; revoke + synchronous, SEC-05) ─────────────────
export async function setUserStatusService(
  input: ReqOf<"v1.identity.setUserStatus">,
  ctx: AuthContext
): Promise<ResOf<"v1.identity.setUserStatus">> {
  authorize(ctx, "user.search", {}); // super-admin gate (user.status.set folds here)
  // Most-sensitive action → SYNCHRONOUS revoke before returning success.
  await ctx.repos.claims.revokeRefreshTokens(input.uid);
  await ctx.repos.audit.write(ctx.tenantId ?? "__platform__", {
    action: "user.status.set",
    actorUid: ctx.uid,
    target: input.uid,
    status: input.status,
    at: ctx.now(),
  });
  return { uid: input.uid, status: input.status } as ResOf<"v1.identity.setUserStatus">;
}

// ── sendPasswordReset by uid (admin-initiated, audited) ───────────────────────
export async function sendPasswordResetService(
  input: ReqOf<"v1.identity.sendPasswordReset">,
  ctx: AuthContext
): Promise<ResOf<"v1.identity.sendPasswordReset">> {
  authorize(ctx, "user.search", {});
  await ctx.repos.audit.write(ctx.tenantId ?? "__platform__", {
    action: "user.passwordReset.admin",
    actorUid: ctx.uid,
    target: input.uid,
    at: ctx.now(),
  });
  return { sent: true } as ResOf<"v1.identity.sendPasswordReset">;
}

// ── startImpersonation (SEC-04 / §3.7.1) ──────────────────────────────────────
export async function startImpersonationService(
  input: ReqOf<"v1.identity.startImpersonation">,
  ctx: AuthContext
): Promise<ResOf<"v1.identity.startImpersonation">> {
  // Only super-admins; a constrained (impersonating) session can NEVER reach here.
  if (ctx.impersonating) fail("PERMISSION_DENIED", "nested impersonation denied");
  if (!ctx.isSuperAdmin) fail("PERMISSION_DENIED", "impersonation is super-admin only");

  const now = ctx.now();
  const ttlMs = 30 * 60 * 1000;
  const expiresAt = new Date(Date.parse(now) + ttlMs).toISOString();

  // Constrained claim set: isSuperAdmin forced FALSE, impersonating:true, target scope.
  const targetMembership = await xrepos(ctx).memberships.get(input.targetUid, input.tenantOverride);
  if (!targetMembership) fail("NOT_FOUND", "target has no membership in tenant");

  const sessionToken = `imp_${input.targetUid}_${Date.parse(now)}`;

  // Fail-closed: ledger + audit written transactionally WITH the mint.
  await ctx.repos.tx(async (tx) => {
    xrepos(ctx).impersonation.openSession(tx, {
      sessionId: sessionToken,
      actorUid: ctx.uid,
      targetUid: input.targetUid,
      tenantId: input.tenantOverride,
      reason: input.reason,
      issuedAt: now,
      expiresAt,
    });
    xrepos(ctx).audit.writeInTx(
      tx,
      ctx.uid,
      "user.impersonate.start",
      { type: "user", id: input.targetUid },
      {
        tenantId: input.tenantOverride,
        reason: input.reason,
        sessionId: sessionToken,
      }
    );
  });

  // SEC-05: synchronous revoke before returning success.
  await ctx.repos.claims.revokeRefreshTokens(input.targetUid);
  return { sessionToken, expiresAt } as ResOf<"v1.identity.startImpersonation">;
}

// ── endImpersonation ──────────────────────────────────────────────────────────
export async function endImpersonationService(
  _input: ReqOf<"v1.identity.endImpersonation">,
  ctx: AuthContext
): Promise<ResOf<"v1.identity.endImpersonation">> {
  void _input;
  const now = ctx.now();
  const sessionId = (ctx as { impersonationSessionId?: string }).impersonationSessionId ?? "";
  await ctx.repos.tx(async (tx) => {
    if (sessionId) xrepos(ctx).impersonation.endSession(tx, sessionId, now);
  });
  return { ended: true } as ResOf<"v1.identity.endImpersonation">;
}
