/**
 * Best-effort audit writer (server-shared.md §2.10). Non-blocking; writes to ONE
 * collection `tenants/{t}/auditLogs` via `ctx.repos.audit` (fixing the
 * auditLogs/auditLog split — common-api §9).
 */
import type { JsonValue } from "@levelup/api-contract";
import type { AuthContext } from "../context/auth-context.js";

export async function writeAudit(
  ctx: AuthContext,
  action: string,
  target: { type: string; id: string },
  meta?: JsonValue
): Promise<void> {
  // Best-effort: never throw into the caller's happy path.
  await ctx.repos.audit
    .write({
      tenantId: ctx.tenantId,
      actorUid: ctx.uid,
      action,
      target,
      meta,
      at: ctx.now(),
    })
    .catch(() => undefined);
}
