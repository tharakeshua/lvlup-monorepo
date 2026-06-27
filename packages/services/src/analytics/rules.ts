/**
 * Pure rule engines (analytics.md §"services/shared" — no IO, no ctx). Lifted from
 * the live `utils/{at-risk,insight,aggregation}-helpers.ts` (the review's "keep"
 * list). Side-effect-free, unit-testable, REST/RN-portable. These back the
 * recompute/detect/insight services without touching Firestore.
 */

export type AtRiskReason =
  | "low_overall_score"
  | "declining_trend"
  | "zero_streak"
  | "failing_exams"
  | "low_completion";

export interface AtRiskInput {
  overallScore: number; // 0..1
  streakDays: number;
  recentExamPercentages: number[]; // most-recent-first
  completionPct: number; // 0..1
}

export interface AtRiskResult {
  isAtRisk: boolean;
  reasons: AtRiskReason[];
  details: Record<string, string>;
}

/** Evaluate the at-risk rules over a student summary slice. (drops `no_recent_activity`.) */
export function evaluateAtRiskRules(input: AtRiskInput): AtRiskResult {
  const reasons: AtRiskReason[] = [];
  const details: Record<string, string> = {};

  if (input.overallScore < 0.5) {
    reasons.push("low_overall_score");
    details["low_overall_score"] = `overallScore=${input.overallScore.toFixed(2)}`;
  }
  if (input.streakDays === 0) {
    reasons.push("zero_streak");
    details["zero_streak"] = "no active practice streak";
  }
  const recentFails = input.recentExamPercentages.filter((p) => p < 40).length;
  if (recentFails >= 2) {
    reasons.push("failing_exams");
    details["failing_exams"] = `${recentFails} recent exams below 40%`;
  }
  if (isDeclining(input.recentExamPercentages)) {
    reasons.push("declining_trend");
    details["declining_trend"] = "recent exam scores trending down";
  }
  if (input.completionPct < 0.3) {
    reasons.push("low_completion");
    details["low_completion"] = `completion=${(input.completionPct * 100).toFixed(0)}%`;
  }

  return { isAtRisk: reasons.length > 0, reasons, details };
}

/** True if the (most-recent-first) series shows a downward trend over ≥3 points. */
export function isDeclining(percentages: number[]): boolean {
  if (percentages.length < 3) return false;
  const chrono = [...percentages].reverse();
  let downs = 0;
  for (let i = 1; i < chrono.length; i++) if (chrono[i]! < chrono[i - 1]!) downs += 1;
  return downs >= chrono.length - 1;
}

/** Median of a numeric array (0 when empty). */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

/**
 * Composite 0..1 overall score from autograde + levelup signals (analytics.md
 * `computeOverallScore`). Weighted: 60% exam average, 40% practice accuracy.
 */
export function computeOverallScore(input: {
  examAverage?: number; // 0..1
  practiceAccuracy?: number; // 0..1
}): number {
  const exam = clamp01(input.examAverage ?? 0);
  const practice = clamp01(input.practiceAccuracy ?? 0);
  return clamp01(exam * 0.6 + practice * 0.4);
}

export type InsightType =
  | "weak_topic_recommendation"
  | "exam_preparation"
  | "streak_encouragement"
  | "improvement_celebration"
  | "at_risk_intervention";

export interface InsightSeed {
  type: InsightType;
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  actionType: "practice_space" | "review_exam" | "seek_help" | "celebrate";
  actionEntityId?: string;
  actionEntityTitle?: string;
}

export interface InsightContext {
  weakTopics: { id: string; title: string; score: number }[];
  upcomingExams: { id: string; title: string }[];
  streakDays: number;
  improved: boolean;
  isAtRisk: boolean;
}

/** Generate insight seeds for a student (deterministic, capped by the caller). */
export function generateInsightsForStudent(ctx: InsightContext): InsightSeed[] {
  const seeds: InsightSeed[] = [];
  if (ctx.isAtRisk) {
    seeds.push({
      type: "at_risk_intervention",
      priority: "high",
      title: "Let’s get back on track",
      description: "Your recent activity suggests you could use some support.",
      actionType: "seek_help",
    });
  }
  for (const t of ctx.weakTopics.slice(0, 3)) {
    seeds.push({
      type: "weak_topic_recommendation",
      priority: "medium",
      title: `Practice ${t.title}`,
      description: `Your mastery of ${t.title} is low — a focused session will help.`,
      actionType: "practice_space",
      actionEntityId: t.id,
      actionEntityTitle: t.title,
    });
  }
  for (const e of ctx.upcomingExams.slice(0, 2)) {
    seeds.push({
      type: "exam_preparation",
      priority: "medium",
      title: `Prepare for ${e.title}`,
      description: `${e.title} is coming up — review the linked material.`,
      actionType: "review_exam",
      actionEntityId: e.id,
      actionEntityTitle: e.title,
    });
  }
  if (ctx.streakDays > 0 && ctx.streakDays < 3) {
    seeds.push({
      type: "streak_encouragement",
      priority: "low",
      title: "Keep your streak going!",
      description: `You’re on a ${ctx.streakDays}-day streak — don’t break it.`,
      actionType: "practice_space",
    });
  }
  if (ctx.improved) {
    seeds.push({
      type: "improvement_celebration",
      priority: "low",
      title: "Great progress!",
      description: "Your scores are trending up. Keep it up!",
      actionType: "celebrate",
    });
  }
  return seeds;
}

export function topN<T>(items: T[], n: number, score: (t: T) => number): T[] {
  return [...items].sort((a, b) => score(b) - score(a)).slice(0, n);
}
export function bottomN<T>(items: T[], n: number, score: (t: T) => number): T[] {
  return [...items].sort((a, b) => score(a) - score(b)).slice(0, n);
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}
