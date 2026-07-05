/**
 * Agent + rubric-preset services (LVL-2):
 *   • listAgents       — space-scoped agent list; `systemPrompt`/`rules`/
 *                        `evaluationObjectives` are ⚷ authoring-only and are
 *                        stripped server-side for non-authoring callers
 *   • saveAgent        — strict-canonical upsert (`agent.write`)
 *   • listRubricPresets — authoring read; a preset embeds the FULL UnifiedRubric
 *                        (incl. guidance), so the read rides the
 *                        `rubric.guidance.read` leak gate (REVIEW §6.7)
 *   • saveRubricPreset — strict-canonical upsert (`rubricPreset.write`)
 */
import type { ReqOf, ResOf } from "@levelup/api-contract";
import { AGENT_TYPES, RUBRIC_PRESET_CATEGORIES } from "@levelup/domain";
import { authorize } from "@levelup/access";
import type { AuthContext } from "../shared/context.js";
import { requireTenant, fail } from "../shared/context.js";
import { isAuthoringRole, tsRequired } from "../shared/projections.js";
import { xrepos } from "../shared/extended-repos.js";

type Doc = Record<string, unknown>;

const AGENT_TYPE_SET = new Set<string>(AGENT_TYPES);
const PRESET_CATEGORY_SET = new Set<string>(RUBRIC_PRESET_CATEGORIES);

const optStr = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
const optNum = (v: unknown): number | undefined => (typeof v === "number" ? v : undefined);
const optStrArr = (v: unknown): string[] | undefined =>
  Array.isArray(v) ? (v as unknown[]).map(String) : undefined;

function compact(o: Doc): Doc {
  const out: Doc = {};
  for (const [k, v] of Object.entries(o)) if (v !== undefined) out[k] = v;
  return out;
}

/** Whitelist a stored agent doc to the strict AgentSchema view; ⚷ prompt/rules
 *  fields survive ONLY for authoring callers. */
function projectAgent(a: Doc, tenantId: string, spaceId: string, authoring: boolean): Doc {
  const type = String(a["type"] ?? "tutor");
  return compact({
    id: String(a["id"] ?? ""),
    spaceId: String(a["spaceId"] ?? spaceId),
    tenantId: String(a["tenantId"] ?? tenantId),
    type: AGENT_TYPE_SET.has(type) ? type : "tutor",
    name: String(a["name"] ?? ""),
    identity: optStr(a["identity"]),
    isActive: typeof a["isActive"] === "boolean" ? a["isActive"] : true,
    ...(authoring ? { systemPrompt: optStr(a["systemPrompt"]) } : {}),
    supportedLanguages: optStrArr(a["supportedLanguages"]),
    defaultLanguage: optStr(a["defaultLanguage"]),
    maxConversationTurns:
      typeof a["maxConversationTurns"] === "number"
        ? Math.trunc(a["maxConversationTurns"])
        : undefined,
    ...(authoring
      ? {
          rules: optStrArr(a["rules"]),
          evaluationObjectives: optStrArr(a["evaluationObjectives"]),
        }
      : {}),
    strictness: optNum(a["strictness"]),
    feedbackStyle: optStr(a["feedbackStyle"]),
    modelOverride: optStr(a["modelOverride"]),
    temperatureOverride: optNum(a["temperatureOverride"]),
    createdAt: tsRequired(a["createdAt"], a["updatedAt"]),
    updatedAt: tsRequired(a["updatedAt"], a["createdAt"]),
    createdBy: String(a["createdBy"] ?? ""),
    updatedBy: String(a["updatedBy"] ?? a["createdBy"] ?? ""),
  });
}

// ── listAgents ───────────────────────────────────────────────────────────────
export async function listAgentsService(
  input: ReqOf<"v1.levelup.listAgents">,
  ctx: AuthContext
): Promise<ResOf<"v1.levelup.listAgents">> {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "space.read", { spaceId: input.spaceId, tenantId });

  const page = await xrepos(ctx).agents.list(tenantId, {
    where: { spaceId: input.spaceId },
    limit: 100,
  });
  const authoring = isAuthoringRole(ctx);
  return {
    items: page.items.map((a) => projectAgent(a as Doc, tenantId, input.spaceId, authoring)),
  } as unknown as ResOf<"v1.levelup.listAgents">;
}

// ── saveAgent ────────────────────────────────────────────────────────────────
export async function saveAgentService(
  input: ReqOf<"v1.levelup.saveAgent">,
  ctx: AuthContext
): Promise<ResOf<"v1.levelup.saveAgent">> {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "agent.write", { spaceId: input.spaceId, tenantId });

  const data = input.data as Doc;
  if (data["deleted"] === true) {
    // AgentSchema carries no tombstone field (strict) → delete is a hard delete.
    if (!input.id) fail("VALIDATION_ERROR", "id is required to delete an agent");
    await xrepos(ctx).agents.delete(tenantId, input.id);
    return { id: input.id, deleted: true } as unknown as ResOf<"v1.levelup.saveAgent">;
  }

  const existing = input.id ? await xrepos(ctx).agents.get(tenantId, input.id) : null;
  if (input.id && !existing) fail("NOT_FOUND", "agent not found");

  const { deleted: _drop, ...rest } = data;
  void _drop;
  const { id, created } = await xrepos(ctx).agents.upsert(tenantId, {
    ...(input.id ? { id: input.id } : {}),
    ...rest,
    spaceId: input.spaceId,
    isActive:
      (data["isActive"] as boolean | undefined) ??
      (existing?.["isActive"] as boolean | undefined) ??
      true,
    createdBy: (existing?.["createdBy"] as string | undefined) ?? ctx.uid,
    updatedBy: ctx.uid,
  });
  return { id, created } as unknown as ResOf<"v1.levelup.saveAgent">;
}

// ── listRubricPresets ────────────────────────────────────────────────────────

/** Whitelist a stored preset to the strict RubricPresetSchema view (full rubric —
 *  the read itself is gated behind `rubric.guidance.read`). */
function projectRubricPreset(p: Doc, tenantId: string): Doc {
  const category = String(p["category"] ?? "general");
  return compact({
    id: String(p["id"] ?? ""),
    tenantId: String(p["tenantId"] ?? tenantId),
    name: String(p["name"] ?? ""),
    description: optStr(p["description"]),
    rubric: (p["rubric"] as Doc | undefined) ?? {},
    category: PRESET_CATEGORY_SET.has(category) ? category : "general",
    questionTypes: optStrArr(p["questionTypes"]),
    isDefault: p["isDefault"] === true,
    createdAt: tsRequired(p["createdAt"], p["updatedAt"]),
    updatedAt: tsRequired(p["updatedAt"], p["createdAt"]),
  });
}

export async function listRubricPresetsService(
  input: ReqOf<"v1.levelup.listRubricPresets">,
  ctx: AuthContext
): Promise<ResOf<"v1.levelup.listRubricPresets">> {
  const tenantId = requireTenant(ctx);
  // Presets embed the full UnifiedRubric (incl. ⚷ guidance) → authoring-only read.
  authorize(ctx, "rubric.guidance.read", { tenantId });

  const page = await xrepos(ctx).rubricPresets.list(tenantId, {
    ...(input.category ? { where: { category: input.category } } : {}),
    limit: 100,
    ...(input.questionType
      ? {
          filter: (d: Doc) =>
            !Array.isArray(d["questionTypes"]) ||
            d["questionTypes"].length === 0 ||
            d["questionTypes"].includes(input.questionType),
        }
      : {}),
  });
  return {
    items: page.items.map((p) => projectRubricPreset(p as Doc, tenantId)),
  } as unknown as ResOf<"v1.levelup.listRubricPresets">;
}

// ── saveRubricPreset ─────────────────────────────────────────────────────────
export async function saveRubricPresetService(
  input: ReqOf<"v1.levelup.saveRubricPreset">,
  ctx: AuthContext
): Promise<ResOf<"v1.levelup.saveRubricPreset">> {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "rubricPreset.write", { tenantId });

  const data = input.data as Doc;
  if (data["deleted"] === true) {
    if (!input.id) fail("VALIDATION_ERROR", "id is required to delete a rubric preset");
    await xrepos(ctx).rubricPresets.delete(tenantId, input.id);
    return { id: input.id, deleted: true } as unknown as ResOf<"v1.levelup.saveRubricPreset">;
  }

  const existing = input.id ? await xrepos(ctx).rubricPresets.get(tenantId, input.id) : null;
  if (input.id && !existing) fail("NOT_FOUND", "rubric preset not found");

  const { deleted: _drop, ...rest } = data;
  void _drop;
  const { id, created } = await xrepos(ctx).rubricPresets.upsert(tenantId, {
    ...(input.id ? { id: input.id } : {}),
    ...rest,
    isDefault:
      (data["isDefault"] as boolean | undefined) ??
      (existing?.["isDefault"] as boolean | undefined) ??
      false,
    createdBy: (existing?.["createdBy"] as string | undefined) ?? ctx.uid,
    updatedBy: ctx.uid,
  });
  return { id, created } as unknown as ResOf<"v1.levelup.saveRubricPreset">;
}
