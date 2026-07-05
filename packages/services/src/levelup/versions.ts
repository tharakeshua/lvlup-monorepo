/**
 * `listVersions` — paginated ContentVersion change-log for a space (authoring
 * read, `version.list`). Reads the legacy-compatible `spaces/{s}/versions`
 * subcollection (the SAME path `functions/levelup` wrote), so migrated tenants'
 * existing history is served as-is; v1 saves append via `recordVersion`
 * (content.ts). Rows are whitelist-projected to the strict ContentVersionSchema.
 */
import type { ReqOf, ResOf } from "@levelup/api-contract";
import { authorize } from "@levelup/access";
import type { AuthContext } from "../shared/context.js";
import { requireTenant } from "../shared/context.js";
import { tsRequired } from "../shared/projections.js";
import { xrepos } from "../shared/extended-repos.js";

type Doc = Record<string, unknown>;

const ENTITY_TYPES = new Set(["space", "storyPoint", "item"]);
const CHANGE_TYPES = new Set(["created", "updated", "published", "archived"]);

/** Whitelist a stored version row to the strict ContentVersionSchema view. */
function projectContentVersion(v: Doc): Doc {
  const entityType = String(v["entityType"] ?? "space");
  const changeType = String(v["changeType"] ?? "updated");
  return {
    id: String(v["id"] ?? ""),
    version: typeof v["version"] === "number" ? Math.trunc(v["version"]) : 0,
    entityType: ENTITY_TYPES.has(entityType) ? entityType : "space",
    entityId: String(v["entityId"] ?? ""),
    changeType: CHANGE_TYPES.has(changeType) ? changeType : "updated",
    changeSummary: String(v["changeSummary"] ?? ""),
    changedBy: String(v["changedBy"] ?? ""),
    changedAt: tsRequired(v["changedAt"]),
  };
}

export async function listVersionsService(
  input: ReqOf<"v1.levelup.listVersions">,
  ctx: AuthContext
): Promise<ResOf<"v1.levelup.listVersions">> {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "version.list", { spaceId: input.spaceId, tenantId });
  const filter = input as { spaceId: string; cursor?: string; limit?: number };

  const page = await xrepos(ctx).contentVersions.list(tenantId, filter.spaceId, {
    ...(filter.cursor ? { cursor: filter.cursor } : {}),
    limit: filter.limit ?? 20,
  });
  return {
    items: page.items.map((v) => projectContentVersion(v as Doc)),
    nextCursor: page.nextCursor,
  } as unknown as ResOf<"v1.levelup.listVersions">;
}
