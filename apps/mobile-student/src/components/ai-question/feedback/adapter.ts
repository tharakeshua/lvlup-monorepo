/**
 * Normalise a StoredEvaluation (+ its evaluation config) into the flattened view
 * the feedback components render. Everything is read defensively — a missing or
 * malformed field just hides its section, never throws. This is the ONE place
 * that joins the scored payload back to the up-front "How you'll be evaluated"
 * identities so the loop visibly closes.
 */
import type {
  DimensionBreakdownItem,
  EvaluationConfigInput,
  FeedbackSeverity,
  HyeCriterion,
  HyeDimension,
  StoredEvaluationInput,
  StoredFeedbackItem,
  Verdict,
} from "./types";

const SEVERITIES: FeedbackSeverity[] = ["critical", "major", "minor"];

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const strArr = (v: unknown): string[] =>
  Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    : [];
const severityOf = (v: unknown): FeedbackSeverity =>
  SEVERITIES.includes(v as FeedbackSeverity) ? (v as FeedbackSeverity) : "minor";

/** Pull the authoritative StoredEvaluation out of a raw recordItemAttempt result. */
export function toStoredEvaluation(raw: unknown): StoredEvaluationInput | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as { progress?: { evaluation?: unknown; solved?: boolean; percentage?: number } };
  const p = d.progress;
  if (!p) return (raw as StoredEvaluationInput) ?? null;
  const ev = (p.evaluation ?? null) as StoredEvaluationInput | null;
  if (!ev) return null;
  // Fold the top-level roll-ups the server puts on `progress` (they aren't on
  // the StoredEvaluation itself) so verdict/percentage stay authoritative.
  return {
    ...ev,
    solved: ev.solved ?? p.solved ?? null,
    percentage: num(ev.percentage) ?? num(p.percentage) ?? null,
  };
}

/** "clarity_of_reasoning" → "Clarity of reasoning" (fallback dim label). */
function prettifyId(id: string): string {
  const s = id.replace(/[_-]+/g, " ").trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : id;
}

export type ScoreState = "ok" | "mid" | "low";
/** success ≥67% · warning ≥34% · error below (design scorebar thresholds). */
export function scoreStateFor(pct: number | null): ScoreState {
  if (pct == null) return "mid";
  if (pct >= 67) return "ok";
  if (pct >= 34) return "mid";
  return "low";
}

export type ConfidenceLevel = "high" | "med" | "low";
/** high >0.9 · med 0.7–0.9 · low <0.7 (→ human-review banner). Tolerates 0–100. */
export function confidenceLevelFor(raw: number | null): ConfidenceLevel | null {
  if (raw == null) return null;
  const c = raw > 1 ? raw / 100 : raw;
  if (c >= 0.9) return "high";
  if (c >= 0.7) return "med";
  return "low";
}

export interface RubricRowView {
  key: string;
  name: string;
  score: number | null;
  maxScore: number | null;
  pct: number | null;
  state: ScoreState;
  comment: string | null;
  levels: { label: string; description?: string; score: number; achieved: boolean }[];
}

export interface DimensionGroupView {
  key: string;
  name: string;
  /** Pending D3 — a number only when dimensionBreakdown provides one. */
  score: number | null;
  scale: number | null;
  worstSeverity: FeedbackSeverity;
  items: { severity: FeedbackSeverity; message: string; suggestion: string | null }[];
}

export interface ScoredChipView {
  key: string;
  label: string;
  kind: "criterion" | "dimension";
  /** criterion: `${score}/${max}`. dimension: null until D3. */
  scoreLabel: string | null;
  state: ScoreState;
}

export interface EvaluationView {
  verdict: Verdict;
  score: number | null;
  maxScore: number | null;
  percentage: number | null;
  confidence: ConfidenceLevel | null;
  needsReview: boolean;
  keyTakeaway: string | null;
  overallComment: string | null;
  mistake: string | null;
  strengths: string[];
  weaknesses: string[];
  missingConcepts: string[];
  rubric: RubricRowView[];
  dimensions: DimensionGroupView[];
  scoredChips: ScoredChipView[];
  passingPercentage: number | null;
  passed: boolean | null;
  scoringMode: string | null;
}

/**
 * Growth-framed verdict from the score band (independent of the passing bar,
 * which is surfaced separately): Got it! ≥90% or solved · You're close 40–89% ·
 * Not quite yet <40% or no score. W1 can override with the authoritative
 * progress roll-up via the `verdict` prop.
 */
function deriveVerdict(ev: StoredEvaluationInput, override?: Verdict): Verdict {
  if (override) return override;
  const correctness = num(ev.correctness);
  const percentage = num(ev.percentage);
  const pct = percentage ?? (correctness != null ? correctness * 100 : null);
  if (ev.solved === true || (correctness != null && correctness >= 1) || (pct != null && pct >= 90))
    return "correct";
  if (pct == null || pct < 40) return "incorrect";
  return "partial";
}

function normalizeSummary(summary: StoredEvaluationInput["summary"]): {
  keyTakeaway: string | null;
  overallComment: string | null;
} {
  if (!summary) return { keyTakeaway: null, overallComment: null };
  if (typeof summary === "string") {
    const s = str(summary);
    return { keyTakeaway: s, overallComment: null };
  }
  return { keyTakeaway: str(summary.keyTakeaway), overallComment: str(summary.overallComment) };
}

/** The last level whose threshold the score reaches = the achieved step. */
function markAchieved(
  levels: HyeCriterion["levels"],
  score: number | null
): RubricRowView["levels"] {
  const sorted = (levels ?? []).slice().sort((a, b) => a.score - b.score);
  if (!sorted.length) return [];
  let achievedScore = -Infinity;
  if (score != null) {
    for (const l of sorted) if (l.score <= score) achievedScore = l.score;
    // nothing reached (score below the lowest rung) → mark the lowest rung.
    if (achievedScore === -Infinity) achievedScore = sorted[0].score;
  }
  return sorted.map((l) => ({
    label: l.label,
    description: l.description,
    score: l.score,
    achieved: score != null && l.score === achievedScore,
  }));
}

function dimLabel(id: string, dims: HyeDimension[], items: StoredFeedbackItem[]): string {
  const byId = dims.find((d) => d.id === id);
  if (byId?.name) return byId.name;
  const tagged = items.find((i) => str(i.dimension));
  return str(tagged?.dimension) ?? prettifyId(id);
}

function configDimensions(config?: EvaluationConfigInput | null): HyeDimension[] {
  const enabled = config?.settings?.enabledDimensions ?? [];
  const fromRubric = config?.rubric?.dimensions ?? [];
  const seen = new Set<string>();
  const out: HyeDimension[] = [];
  for (const d of [...enabled, ...fromRubric]) {
    if (d?.id && !seen.has(d.id)) {
      seen.add(d.id);
      out.push(d);
    }
  }
  return out;
}

const WORST_ORDER: Record<FeedbackSeverity, number> = { critical: 0, major: 1, minor: 2 };

export function buildEvaluationView(
  evaluation: StoredEvaluationInput,
  config?: EvaluationConfigInput | null,
  verdictOverride?: Verdict
): EvaluationView {
  const ev = evaluation ?? {};
  const criteria = config?.rubric?.criteria ?? [];
  const dims = configDimensions(config);
  const dimBreakdown = new Map<string, DimensionBreakdownItem>();
  for (const d of ev.dimensionBreakdown ?? [])
    if (d?.dimensionId) dimBreakdown.set(d.dimensionId, d);

  const { keyTakeaway, overallComment } = normalizeSummary(ev.summary);
  const score = num(ev.score);
  const maxScore = num(ev.maxScore);
  const percentage =
    num(ev.percentage) ?? (score != null && maxScore ? Math.round((score / maxScore) * 100) : null);
  const confidence = confidenceLevelFor(num(ev.confidence));

  // ── Rubric rows (scored) — join to config criteria for the level ladder ──
  const rubric: RubricRowView[] = (ev.rubricBreakdown ?? []).map((row, i) => {
    const match =
      (row.criterionId && criteria.find((c) => c.id === row.criterionId)) ||
      criteria.find((c) => c.name === row.criterionName);
    const rScore = num(row.score);
    const rMax = num(row.maxScore) ?? num(match?.maxScore);
    const pct = rScore != null && rMax ? Math.round((rScore / rMax) * 100) : null;
    return {
      key: row.criterionId ?? row.criterionName ?? `crit-${i}`,
      name: str(row.criterionName) ?? match?.name ?? `Criterion ${i + 1}`,
      score: rScore,
      maxScore: rMax,
      pct,
      state: scoreStateFor(pct),
      comment: str(row.comment),
      levels: markAchieved(match?.levels, rScore),
    };
  });

  // ── Per-dimension qualitative feedback (severity, no fabricated score) ──
  const structured = ev.structuredFeedback ?? {};
  const dimensions: DimensionGroupView[] = Object.entries(structured)
    .map(([id, rawItems]) => {
      const items = (Array.isArray(rawItems) ? rawItems : [])
        .map((it) => ({
          severity: severityOf(it?.severity),
          message: str(it?.message) ?? "",
          suggestion: str(it?.suggestion),
        }))
        .filter((it) => it.message.length > 0);
      const worstSeverity = items.reduce<FeedbackSeverity>(
        (worst, it) => (WORST_ORDER[it.severity] < WORST_ORDER[worst] ? it.severity : worst),
        "minor"
      );
      const bd = dimBreakdown.get(id);
      return {
        key: id,
        name: dimLabel(id, dims, Array.isArray(rawItems) ? rawItems : []),
        score: bd ? num(bd.score) : null,
        scale: bd ? num(bd.scale) : null,
        worstSeverity,
        items,
      };
    })
    .filter((g) => g.items.length > 0);

  // ── Scored HYE chips — the loop-closing re-render of the up-front chips ──
  const critChips: ScoredChipView[] = rubric.map((r) => ({
    key: `c-${r.key}`,
    label: r.name,
    kind: "criterion" as const,
    scoreLabel: r.score != null && r.maxScore != null ? `${r.score}/${r.maxScore}` : null,
    state: r.state,
  }));
  const dimChips: ScoredChipView[] = dimensions.map((d) => ({
    key: `d-${d.key}`,
    label: d.name,
    kind: "dimension" as const,
    scoreLabel: d.score != null && d.scale != null ? `${d.score}/${d.scale}` : null,
    // no score yet → colour by whether the dimension flagged anything serious.
    state: d.worstSeverity === "critical" ? "low" : d.worstSeverity === "major" ? "mid" : "ok",
  }));

  const passingPercentage = num(config?.rubric?.passingPercentage);
  const passed =
    passingPercentage != null && percentage != null ? percentage >= passingPercentage : null;
  const mistake = str(ev.mistakeClassification);

  return {
    verdict: deriveVerdict(ev, verdictOverride),
    score,
    maxScore,
    percentage,
    confidence,
    needsReview: confidence === "low",
    keyTakeaway,
    overallComment,
    mistake: mistake && mistake !== "None" ? mistake : null,
    strengths: strArr(ev.strengths),
    weaknesses: strArr(ev.weaknesses),
    missingConcepts: strArr(ev.missingConcepts),
    rubric,
    dimensions,
    scoredChips: [...critChips, ...dimChips],
    passingPercentage,
    passed,
    scoringMode: str(config?.rubric?.scoringMode),
  };
}
