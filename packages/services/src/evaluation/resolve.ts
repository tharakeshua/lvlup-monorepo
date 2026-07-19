/**
 * Config-triad resolution (AI-EVALUATION-CORE-PLAN.md D2/D3/D4).
 *
 *   agent    : item.meta.evaluatorAgentId → space.defaultEvaluatorAgentId → null
 *   rubric   : item.effectiveRubric → item.rubric → space.defaultRubric → null
 *   settings : space.evaluationSettingsId → tenant default (isDefault) → null
 *
 * Settings live in the dedicated `evaluationSettings` collection (the
 * `saveEvaluationSettings` writer); the legacy tenants-repo `_kind` location is
 * read as a fallback for pre-migration docs.
 */
import type { AuthContext } from "../shared/context.js";
import { xrepos } from "../shared/extended-repos.js";
import type {
  Doc,
  FrozenEvaluationConfig,
  ResolvedEvaluationConfig,
  SourceVersion,
} from "./types.js";

/**
 * Read one EvaluationSettings doc by id (dedicated collection, tenants-repo
 * fallback for pre-migration docs). Each leg is independently fault-tolerant —
 * a twin/emulator without the dedicated repo must still reach the fallback.
 */
export async function getEvaluationSettings(
  ctx: AuthContext,
  tenantId: string,
  settingsId: string
): Promise<Doc | null> {
  try {
    const dedicated = await xrepos(ctx).evaluationSettings.get(tenantId, settingsId);
    if (dedicated) return dedicated;
  } catch {
    /* dedicated repo unavailable — fall through */
  }
  try {
    return await ctx.repos.tenants.get(tenantId, settingsId);
  } catch {
    return null;
  }
}

/** The tenant's default EvaluationSettings (`isDefault: true`), or null. */
export async function getDefaultEvaluationSettings(
  ctx: AuthContext,
  tenantId: string
): Promise<Doc | null> {
  try {
    const page = await xrepos(ctx).evaluationSettings.list(tenantId, {
      where: { isDefault: true },
      limit: 1,
    });
    return (page.items[0] as Doc | undefined) ?? null;
  } catch {
    return null;
  }
}

/** Resolve the full config triad for one levelup item. Never throws — every leg
 *  degrades to null (the core evaluates with whatever config exists). */
export async function resolveLevelupEvaluationConfig(
  ctx: AuthContext,
  tenantId: string,
  spaceId: string | undefined,
  item: Doc
): Promise<ResolvedEvaluationConfig> {
  let space: Doc | null = null;
  if (spaceId) {
    try {
      space = await ctx.repos.spaces.get(tenantId, spaceId);
    } catch {
      space = null;
    }
  }

  // Agent: item override → space default. Inactive agents are skipped.
  let agent: Doc | null = null;
  const meta = (item["meta"] as Doc | undefined) ?? {};
  const itemAgentId = meta["evaluatorAgentId"] as string | undefined;
  const agentId = itemAgentId ?? (space?.["defaultEvaluatorAgentId"] as string | undefined);
  if (agentId) {
    try {
      const a = await xrepos(ctx).agents.get(tenantId, agentId);
      if (a && a["isActive"] !== false) agent = a;
    } catch {
      agent = null;
    }
  }
  const agentSource = agent ? (itemAgentId ? "item" : "space") : "none";

  const itemRubric =
    (item["effectiveRubric"] as Doc | undefined) ?? (item["rubric"] as Doc | undefined);
  const rubric = itemRubric ?? (space?.["defaultRubric"] as Doc | undefined) ?? null;
  const rubricSource = itemRubric ? "item" : rubric ? "space" : "none";

  let settings: Doc | null = null;
  let settingsSource: "space" | "tenant_default" | "none" = "none";
  try {
    const settingsId = space?.["evaluationSettingsId"] as string | undefined;
    if (settingsId) {
      settings = await getEvaluationSettings(ctx, tenantId, settingsId);
      if (settings) settingsSource = "space";
    }
    if (!settings) {
      settings = await getDefaultEvaluationSettings(ctx, tenantId);
      if (settings) settingsSource = "tenant_default";
    }
  } catch {
    settings = null;
  }

  return {
    agent,
    rubric,
    settings,
    provenance: { agentSource, rubricSource, settingsSource },
  };
}

/**
 * Deep-copy the resolved configuration at the start boundary. Evaluation Core
 * itself remains persistence-agnostic; callers persist this return value inside
 * their own immutable snapshot and must never resolve mutable config at finish.
 */
export function freezeLevelupEvaluationConfig(
  resolved: ResolvedEvaluationConfig,
  sourceVersions: SourceVersion[]
): FrozenEvaluationConfig {
  return {
    agent: cloneDocOrNull(resolved.agent),
    rubric: cloneDocOrNull(resolved.rubric),
    settings: cloneDocOrNull(resolved.settings),
    provenance: { ...resolved.provenance },
    sourceVersions: sourceVersions.map((source) => ({ ...source })),
  };
}

function cloneDocOrNull(value: Doc | null): Doc | null {
  if (value === null) return null;
  return cloneJson(value) as Doc;
}

/** Documents crossing repository seams are JSON; reject accidental non-JSON values. */
function cloneJson(value: unknown): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value))
      throw new TypeError("evaluation configuration contains a non-finite number");
    return value;
  }
  if (Array.isArray(value)) return value.map(cloneJson);
  if (typeof value === "object") {
    const output: Doc = {};
    for (const [key, nested] of Object.entries(value as Doc)) {
      if (nested !== undefined) output[key] = cloneJson(nested);
    }
    return output;
  }
  throw new TypeError("evaluation configuration must be JSON-serializable");
}
