/**
 * Aggregation helper utilities for progress computations.
 */

import { toMillis, toTimestamp } from "@levelup/domain";
import type { Timestamp, TimestampInput } from "@levelup/domain";

/**
 * Collapse a legacy timestamp field (Firestore Timestamp object, ISO string,
 * epoch millis, …) to epoch millis for sorting/date math (B8 boundary,
 * MIGRATION-PATTERN rule 3). Returns 0 for null/undefined/unparseable values,
 * matching the legacy `?.toMillis?.() ?? 0` sort fallback.
 */
export function legacyMillis(v: unknown): number {
  if (v == null) return 0;
  try {
    return toMillis(toTimestamp(v as TimestampInput));
  } catch {
    return 0;
  }
}

/**
 * Collapse a legacy timestamp field to a canonical ISO `Timestamp` for wire
 * responses (B8: never serialize Firestore Timestamp objects over the wire).
 * Returns null for null/undefined/unparseable values.
 */
export function legacyIso(v: unknown): Timestamp | null {
  if (v == null) return null;
  try {
    return toTimestamp(v as TimestampInput);
  } catch {
    return null;
  }
}

/**
 * Compute the weighted overall score from AutoGrade and LevelUp metrics.
 * AutoGrade (exam performance) weighted 60%, LevelUp (space completion) 40%.
 *
 * @param autogradeAvgScore - Normalised 0-1 scale (totalMarksObtained / totalMarksAvailable)
 * @param levelupAvgCompletion - 0-100 percentage scale (totalPercentage / totalSpaces)
 * @returns Overall score on a 0-1 scale
 */
export function computeOverallScore(
  autogradeAvgScore: number,
  levelupAvgCompletion: number
): number {
  const AUTOGRADE_WEIGHT = 0.6;
  const LEVELUP_WEIGHT = 0.4;

  // Clamp inputs to expected ranges
  const clampedScore = Math.max(0, Math.min(1, autogradeAvgScore));
  // levelupAvgCompletion is 0-100, normalise to 0-1
  const normalisedCompletion = Math.max(0, Math.min(1, levelupAvgCompletion / 100));

  return clampedScore * AUTOGRADE_WEIGHT + normalisedCompletion * LEVELUP_WEIGHT;
}

/**
 * Calculate the median of an array of numbers.
 */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Calculate the standard deviation of an array of numbers.
 */
export function standardDeviation(values: number[]): number {
  if (values.length <= 1) return 0;
  const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
  const sqDiffs = values.map((v) => (v - avg) ** 2);
  return Math.sqrt(sqDiffs.reduce((sum, v) => sum + v, 0) / values.length);
}

/**
 * Identify strength and weakness areas from subject breakdowns.
 * Strengths: subjects with above-average performance.
 * Weaknesses: subjects with below-average performance.
 */
export function identifyStrengthsAndWeaknesses(
  autogradeBreakdown: Record<string, { avgScore: number; examCount: number }>,
  levelupBreakdown: Record<string, { avgCompletion: number; spaceCount: number }>
): { strengths: string[]; weaknesses: string[] } {
  const subjectScores: Record<string, number[]> = {};

  for (const [subject, data] of Object.entries(autogradeBreakdown)) {
    if (!subjectScores[subject]) subjectScores[subject] = [];
    subjectScores[subject].push(data.avgScore);
  }
  for (const [subject, data] of Object.entries(levelupBreakdown)) {
    if (!subjectScores[subject]) subjectScores[subject] = [];
    subjectScores[subject].push(data.avgCompletion / 100); // normalise to 0-1
  }

  const avgBySubject: Record<string, number> = {};
  for (const [subject, scores] of Object.entries(subjectScores)) {
    avgBySubject[subject] = scores.reduce((s, v) => s + v, 0) / scores.length;
  }

  const allScores = Object.values(avgBySubject);
  if (allScores.length === 0) return { strengths: [], weaknesses: [] };

  const globalAvg = allScores.reduce((s, v) => s + v, 0) / allScores.length;

  const strengths: string[] = [];
  const weaknesses: string[] = [];

  for (const [subject, score] of Object.entries(avgBySubject)) {
    if (score >= globalAvg + 0.1) strengths.push(subject);
    else if (score <= globalAvg - 0.1) weaknesses.push(subject);
  }

  return { strengths, weaknesses };
}

/**
 * Cap an array to the top N entries, sorted by a key descending.
 */
export function topN<T>(items: T[], n: number, key: (item: T) => number): T[] {
  return [...items].sort((a, b) => key(b) - key(a)).slice(0, n);
}

/**
 * Cap an array to the bottom N entries, sorted by a key ascending.
 */
export function bottomN<T>(items: T[], n: number, key: (item: T) => number): T[] {
  return [...items].sort((a, b) => key(a) - key(b)).slice(0, n);
}
