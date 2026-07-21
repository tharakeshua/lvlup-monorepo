/**
 * Attempt-history model + pure builder.
 *
 * DATA REALITY (verified 2026-07-19 against packages/services):
 * The single progress writer `repo-admin/progress.ts applyUpdates()` persists per
 * item ONLY `{itemId, storyPointId, score, maxScore, correct, timeSpentMs,
 * updatedAt, evaluation}` with BEST-SCORE retention — it does NOT write an
 * `attempts[]` array, an `attemptsCount`, per-attempt timestamps/answers, or
 * `questionData`. The domain `ItemProgressEntry.attempts[]` field and the
 * `levelup/practice.ts` read projection DO support per-attempt history, so this
 * builder consumes `attempts[]` when present (forward-compatible) and otherwise
 * DEGRADES to a single "best result" row synthesised from the retained
 * `evaluation` + `score`/`maxScore` + `updatedAt`. When the backend starts
 * appending `attempts[]`, the full multi-attempt trail lights up automatically.
 *
 * Pure functions only — no React, no components.
 */
import type { FeedbackVerdict } from "../../lyceum";

/** A stored evaluation bag, read defensively (every field optional). */
export interface StoredEvaluationLike {
  score?: number;
  maxScore?: number;
  correctness?: number;
  percentage?: number;
  strengths?: unknown;
  weaknesses?: unknown;
  missingConcepts?: unknown;
  summary?: { keyTakeaway?: unknown; overallComment?: unknown } | string | null;
  feedback?: unknown;
}

/** One persisted attempt record (domain `AttemptRecord`, tolerant). */
export interface AttemptRecordLike {
  attemptNumber?: number;
  answer?: unknown;
  evaluation?: StoredEvaluationLike | null;
  score?: number;
  maxScore?: number;
  timestamp?: unknown;
}

/**
 * A per-item progress entry as read from `useStoryPointProgress` →
 * `progress.items[itemId]`. Superset of domain `ItemProgressEntry`; all optional.
 */
export interface ItemProgressEntryLike {
  itemId?: string;
  completed?: boolean;
  completedAt?: unknown;
  updatedAt?: unknown;
  lastUpdatedAt?: unknown;
  score?: number;
  maxScore?: number;
  correct?: boolean;
  // best-retained single evaluation (the field the writer actually persists)
  evaluation?: StoredEvaluationLike | null;
  // forward-compatible per-attempt fields (schema-supported, not yet written)
  attempts?: AttemptRecordLike[];
  lastEvaluation?: StoredEvaluationLike | null;
  lastAnswer?: unknown;
  questionData?: {
    attemptsCount?: number;
    bestScore?: number;
    latestScore?: number;
    percentage?: number;
    solved?: boolean;
    status?: string;
  };
}

/** A single row in the attempt-history surface. */
export interface AttemptRow {
  /** 1-based attempt index (falls back to array position). */
  attemptNumber: number;
  score: number | null;
  maxScore: number | null;
  percentage: number | null;
  verdict: FeedbackVerdict;
  /** ISO string, or null when the backend didn't record a per-attempt time. */
  timestamp: string | null;
  isBest: boolean;
  answer: unknown;
  evaluation: StoredEvaluationLike | null;
}

export interface AttemptHistoryModel {
  rows: AttemptRow[];
  /** True when rows came from a real `attempts[]` array (vs the degraded single row). */
  hasPerAttemptTrail: boolean;
  /** Improving-trend celebration copy, or null when not applicable (<2 rows or flat). */
  trend: { pointsGained: number; attempts: number } | null;
  /** The best row's index in `rows`, or -1 when empty. */
  bestIndex: number;
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

function isoOf(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v;
  // Firestore Timestamp-at-rest → {seconds} or {_seconds}
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    const secs = num(o.seconds) ?? num(o._seconds);
    if (secs != null) return new Date(secs * 1000).toISOString();
    if (typeof o.toDate === "function") {
      try {
        return (o.toDate as () => Date)().toISOString();
      } catch {
        return null;
      }
    }
  }
  return null;
}

/**
 * Derive a 3-band verdict from an evaluation. Prefers `correctness` (0..1), then
 * `percentage` (0..100), then the raw score ratio. Matches the design's language:
 * fully-right → correct, partway → partial ("you're close"), near-zero →
 * incorrect ("not quite yet").
 */
export function verdictOf(
  ev: StoredEvaluationLike | null | undefined,
  score: number | null,
  maxScore: number | null
): FeedbackVerdict {
  const correctness = ev ? num(ev.correctness) : null;
  let ratio: number | null = correctness;
  if (ratio == null) {
    const pctVal = ev ? num(ev.percentage) : null;
    if (pctVal != null) ratio = pctVal / 100;
    else if (score != null && maxScore != null && maxScore > 0) ratio = score / maxScore;
  }
  if (ratio == null) return "partial";
  if (ratio >= 1) return "correct";
  if (ratio >= 0.34) return "partial";
  return "incorrect";
}

function rowFromAttempt(a: AttemptRecordLike, index: number): AttemptRow {
  const ev = (a.evaluation ?? null) as StoredEvaluationLike | null;
  const score = num(a.score) ?? (ev ? num(ev.score) : null);
  const maxScore = num(a.maxScore) ?? (ev ? num(ev.maxScore) : null);
  const percentage =
    (ev ? num(ev.percentage) : null) ??
    (score != null && maxScore != null && maxScore > 0
      ? Math.round((score / maxScore) * 100)
      : null);
  return {
    attemptNumber: typeof a.attemptNumber === "number" ? a.attemptNumber : index + 1,
    score,
    maxScore,
    percentage,
    verdict: verdictOf(ev, score, maxScore),
    timestamp: isoOf(a.timestamp),
    isBest: false,
    answer: a.answer,
    evaluation: ev,
  };
}

/**
 * Build the history model from a per-item progress entry.
 * Returns an empty model (no rows) when nothing has been attempted.
 */
export function buildAttemptHistory(
  entry: ItemProgressEntryLike | null | undefined
): AttemptHistoryModel {
  const empty: AttemptHistoryModel = {
    rows: [],
    hasPerAttemptTrail: false,
    trend: null,
    bestIndex: -1,
  };
  if (!entry) return empty;

  const rawAttempts = Array.isArray(entry.attempts) ? entry.attempts : [];
  let rows: AttemptRow[];
  let hasPerAttemptTrail: boolean;

  if (rawAttempts.length > 0) {
    rows = rawAttempts.map(rowFromAttempt).sort((a, b) => a.attemptNumber - b.attemptNumber);
    hasPerAttemptTrail = true;
  } else {
    // Degraded path: synthesise a single "best result" row from what IS stored.
    const ev = (entry.evaluation ?? entry.lastEvaluation ?? null) as StoredEvaluationLike | null;
    const score = num(entry.score) ?? (ev ? num(ev.score) : null);
    const maxScore = num(entry.maxScore) ?? (ev ? num(ev.maxScore) : null);
    const hasAnyResult = ev != null || score != null || entry.completed === true;
    if (!hasAnyResult) return empty;
    const percentage =
      (ev ? num(ev.percentage) : null) ??
      (score != null && maxScore != null && maxScore > 0
        ? Math.round((score / maxScore) * 100)
        : null);
    rows = [
      {
        attemptNumber: entry.questionData?.attemptsCount ?? 1,
        score,
        maxScore,
        percentage,
        verdict: verdictOf(ev, score, maxScore),
        timestamp: isoOf(entry.updatedAt ?? entry.lastUpdatedAt ?? entry.completedAt),
        isBest: true,
        answer: entry.lastAnswer,
        evaluation: ev,
      },
    ];
    hasPerAttemptTrail = false;
  }

  if (rows.length === 0) return empty;

  // Mark the best row (highest score; ties → latest).
  let bestIndex = 0;
  for (let i = 1; i < rows.length; i += 1) {
    const best = rows[bestIndex];
    const cur = rows[i];
    const bestScore = best.score ?? -Infinity;
    const curScore = cur.score ?? -Infinity;
    if (curScore >= bestScore) bestIndex = i;
  }
  rows = rows.map((r, i) => ({ ...r, isBest: i === bestIndex }));

  // Improving trend: only with a real multi-attempt trail and a net gain.
  let trend: AttemptHistoryModel["trend"] = null;
  if (hasPerAttemptTrail && rows.length >= 2) {
    const first = rows[0].score;
    const best = rows[bestIndex].score;
    if (first != null && best != null && best > first) {
      trend = { pointsGained: best - first, attempts: rows.length };
    }
  }

  return { rows, hasPerAttemptTrail, trend, bestIndex };
}

/** Normalise a StoredEvaluation into the props FeedbackPanel needs (sans verdict). */
export function evaluationToFeedback(ev: StoredEvaluationLike | null | undefined): {
  score: number | null;
  maxScore: number | null;
  percentage: number | null;
  comment: string | null;
  strengths: string[];
  weaknesses: string[];
  missingConcepts: string[];
} {
  const e = (ev ?? {}) as StoredEvaluationLike;
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);
  const arr = (v: unknown) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  const summary =
    e.summary && typeof e.summary === "object"
      ? (e.summary as { keyTakeaway?: unknown; overallComment?: unknown })
      : null;
  const summaryStr = typeof e.summary === "string" ? e.summary : null;
  return {
    score: num(e.score),
    maxScore: num(e.maxScore),
    percentage: num(e.percentage),
    comment:
      (summary ? (str(summary.overallComment) ?? str(summary.keyTakeaway)) : null) ??
      summaryStr ??
      str(e.feedback),
    strengths: arr(e.strengths),
    weaknesses: arr(e.weaknesses),
    missingConcepts: arr(e.missingConcepts),
  };
}

/** Best-effort render of an attempt's answer payload to a display string. */
export function answerToText(answer: unknown): string | null {
  if (answer == null) return null;
  if (typeof answer === "string") return answer.trim() || null;
  if (typeof answer === "number" || typeof answer === "boolean") return String(answer);
  if (Array.isArray(answer)) {
    const parts = answer.map(answerToText).filter((x): x is string => !!x);
    return parts.length ? parts.join(", ") : null;
  }
  if (typeof answer === "object") {
    const o = answer as Record<string, unknown>;
    const text = o.text ?? o.answer ?? o.value ?? o.response;
    if (typeof text === "string" && text.trim()) return text.trim();
  }
  return null;
}
