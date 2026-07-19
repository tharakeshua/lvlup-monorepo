/**
 * Evaluation-config VIEW builders (getEvaluationConfig — UI transparency:
 * "show me exactly how this will be graded"). One builder shared by the levelup
 * and autograde callables so both render through one UI component.
 *
 * ⚷ Role projection is applied HERE: non-authoring callers get the rubric
 * without modelAnswer/evaluatorGuidance/promptGuidance (projectRubric), the
 * agent without systemPrompt/rules/evaluationObjectives (projectAgent), and the
 * settings without confidenceConfig/promptGuidance (projectEvaluationSettings).
 */
import { projectRubric, projectEvaluationSettings } from "../shared/projections.js";
import { projectAgent } from "../levelup/agents-presets.js";
import { toEvaluationSettingsView } from "../autograde/reads.js";
import type { Doc, EvaluationConfigProvenance } from "./types.js";

const num = (v: unknown): number | undefined => (typeof v === "number" ? v : undefined);
const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);

function compact(o: Doc): Doc {
  const out: Doc = {};
  for (const [k, v] of Object.entries(o)) if (v !== undefined) out[k] = v;
  return out;
}

/**
 * Whitelist a stored rubric bag → the strict UnifiedRubric view shape (stored
 * snapshots can carry stray at-rest keys that would fail the strict response
 * schema client-side). Secrets are stripped separately by `projectRubric`.
 */
export function toRubricView(rubric: Doc | null): Doc | null {
  if (!rubric) return null;
  const criteria = Array.isArray(rubric["criteria"])
    ? (rubric["criteria"] as Doc[]).map((c) =>
        compact({
          id: str(c["id"]),
          name: String(c["name"] ?? ""),
          description: str(c["description"]),
          // canonical field is maxScore; legacy docs carried maxPoints.
          maxScore: num(c["maxScore"]) ?? num(c["maxPoints"]) ?? 0,
          weight: num(c["weight"]),
          levels: Array.isArray(c["levels"])
            ? (c["levels"] as Doc[]).map((l) =>
                compact({
                  label: String(l["label"] ?? ""),
                  description: str(l["description"]),
                  score: num(l["score"]) ?? 0,
                })
              )
            : undefined,
        })
      )
    : undefined;
  const dimensions = Array.isArray(rubric["dimensions"])
    ? (rubric["dimensions"] as Doc[]).map((d) =>
        compact({
          id: String(d["id"] ?? ""),
          name: String(d["name"] ?? ""),
          description: str(d["description"]),
          priority: ["HIGH", "MEDIUM", "LOW"].includes(String(d["priority"]))
            ? String(d["priority"])
            : "MEDIUM",
          weight: num(d["weight"]),
          scoringScale: num(d["scoringScale"]),
          promptGuidance: str(d["promptGuidance"]),
        })
      )
    : undefined;
  return compact({
    scoringMode: ["criteria_based", "dimension_based", "holistic", "hybrid"].includes(
      String(rubric["scoringMode"])
    )
      ? String(rubric["scoringMode"])
      : "criteria_based",
    criteria,
    dimensions,
    holisticGuidance: str(rubric["holisticGuidance"]),
    holisticMaxScore: num(rubric["holisticMaxScore"]),
    passingPercentage: num(rubric["passingPercentage"]),
    showModelAnswer:
      typeof rubric["showModelAnswer"] === "boolean" ? rubric["showModelAnswer"] : undefined,
    modelAnswer: str(rubric["modelAnswer"]),
    evaluatorGuidance: str(rubric["evaluatorGuidance"]),
  });
}

export interface EvaluationConfigViewInput {
  agent: Doc | null;
  rubric: Doc | null;
  settings: Doc | null;
  provenance: EvaluationConfigProvenance;
  tenantId: string;
  spaceId: string;
  authoring: boolean;
}

/** Build the role-projected EvaluationConfigView both callables return. */
export function buildEvaluationConfigView(input: EvaluationConfigViewInput): Doc {
  const { authoring } = input;
  return {
    agent: input.agent ? projectAgent(input.agent, input.tenantId, input.spaceId, authoring) : null,
    rubric: projectRubric(toRubricView(input.rubric), authoring) as Doc | null,
    settings: input.settings
      ? projectEvaluationSettings(toEvaluationSettingsView(input.settings), authoring)
      : null,
    provenance: input.provenance,
  };
}
