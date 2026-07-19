/**
 * getEvaluationConfig — the resolved evaluation triad (agent / rubric /
 * settings) + provenance for one item, or the space defaults when `itemId` is
 * omitted. This is the UI-transparency read: every surface where grading is
 * about to happen shows this config. Role-projected (⚷ secrets authoring-only).
 */
import type { ReqOf, ResOf } from "@levelup/api-contract";
import { authorize } from "@levelup/access";
import type { AuthContext } from "../shared/context.js";
import { requireTenant, fail } from "../shared/context.js";
import { isAuthoringRole } from "../shared/projections.js";
import { resolveLevelupEvaluationConfig } from "../evaluation/resolve.js";
import { buildEvaluationConfigView } from "../evaluation/config-view.js";

type Doc = Record<string, unknown>;

export async function getEvaluationConfigService(
  input: ReqOf<"v1.levelup.getEvaluationConfig">,
  ctx: AuthContext
): Promise<ResOf<"v1.levelup.getEvaluationConfig">> {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "space.read", { spaceId: input.spaceId, tenantId });

  let item: Doc = {};
  if (input.itemId) {
    const found = await ctx.repos.items.get(tenantId, input.itemId);
    if (!found) fail("NOT_FOUND", "item not found");
    item = found;
  }

  const resolved = await resolveLevelupEvaluationConfig(ctx, tenantId, input.spaceId, item);
  const config = buildEvaluationConfigView({
    ...resolved,
    tenantId,
    spaceId: input.spaceId,
    authoring: isAuthoringRole(ctx),
  });
  return { config } as unknown as ResOf<"v1.levelup.getEvaluationConfig">;
}
