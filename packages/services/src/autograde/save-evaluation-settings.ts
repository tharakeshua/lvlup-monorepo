/**
 * `saveEvaluationSettingsService` (autograde.md §"Command services"). Upsert an
 * EvaluationSettings doc with the single-default invariant (clears `isDefault` on
 * all others when this one is default). Thresholds (`confidenceConfig`) +
 * dimension `promptGuidance` are writable only by authoring roles. `tenantId` from
 * ctx. Settings are stored in the tenant-scoped `evaluationSettings` area (modeled
 * here on the `tenants` repo with an `_kind` discriminator for the testing twin).
 */
import type { ReqOf, ResOf } from "@levelup/api-contract";
import { authorize } from "@levelup/access";
import type { AuthContext } from "../shared/context.js";
import { requireTenant } from "../shared/context.js";
import { xrepos } from "../shared/extended-repos.js";

type Req = ReqOf<"v1.autograde.saveEvaluationSettings">;
type Res = ResOf<"v1.autograde.saveEvaluationSettings">;

export async function saveEvaluationSettingsService(input: Req, ctx: AuthContext): Promise<Res> {
  const tenantId = requireTenant(ctx);
  // evaluationSettings.manage maps to exam.write authority (authoring roles).
  authorize(ctx, "exam.write", { tenantId });

  const now = ctx.now();
  const payload: Record<string, unknown> = {
    ...(input.id ? { id: input.id } : {}),
    ...input.data,
    _kind: "evaluationSettings",
    createdBy: ctx.uid,
  };

  const { id, created } = await xrepos(ctx).evaluationSettings.upsert(tenantId, payload, now);

  // Single-default invariant: clear isDefault on every other settings doc.
  if (input.data.isDefault === true) {
    const all = await listEvaluationSettings(ctx, tenantId);
    for (const s of all) {
      if (s["id"] !== id && s["isDefault"] === true) {
        await xrepos(ctx).evaluationSettings.upsert(
          tenantId,
          { id: s["id"], isDefault: false, _kind: "evaluationSettings" },
          now
        );
      }
    }
  }

  return { id, created } as Res;
}

/** List the tenant's evaluation-settings docs (dedicated collection). */
export async function listEvaluationSettings(
  ctx: AuthContext,
  tenantId: string
): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  let cursor: string | undefined;
  do {
    const page = await xrepos(ctx).evaluationSettings.list(tenantId, { cursor, limit: 200 });
    out.push(...page.items);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return out;
}
