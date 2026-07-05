/**
 * Aggregation helper utilities for progress computations.
 */
import type { Timestamp } from "@levelup/domain";
/**
 * Collapse a legacy timestamp field (Firestore Timestamp object, ISO string,
 * epoch millis, …) to epoch millis for sorting/date math (B8 boundary,
 * MIGRATION-PATTERN rule 3). Returns 0 for null/undefined/unparseable values,
 * matching the legacy `?.toMillis?.() ?? 0` sort fallback.
 */
export declare function legacyMillis(v: unknown): number;
/**
 * Collapse a legacy timestamp field to a canonical ISO `Timestamp` for wire
 * responses (B8: never serialize Firestore Timestamp objects over the wire).
 * Returns null for null/undefined/unparseable values.
 */
export declare function legacyIso(v: unknown): Timestamp | null;
/**
 * Compute the weighted overall score from AutoGrade and LevelUp metrics.
 * AutoGrade (exam performance) weighted 60%, LevelUp (space completion) 40%.
 *
 * @param autogradeAvgScore - Normalised 0-1 scale (totalMarksObtained / totalMarksAvailable)
 * @param levelupAvgCompletion - 0-100 percentage scale (totalPercentage / totalSpaces)
 * @returns Overall score on a 0-1 scale
 */
export declare function computeOverallScore(
  autogradeAvgScore: number,
  levelupAvgCompletion: number
): number;
/**
 * Calculate the median of an array of numbers.
 */
export declare function median(values: number[]): number;
/**
 * Calculate the standard deviation of an array of numbers.
 */
export declare function standardDeviation(values: number[]): number;
/**
 * Identify strength and weakness areas from subject breakdowns.
 * Strengths: subjects with above-average performance.
 * Weaknesses: subjects with below-average performance.
 */
export declare function identifyStrengthsAndWeaknesses(
  autogradeBreakdown: Record<
    string,
    {
      avgScore: number;
      examCount: number;
    }
  >,
  levelupBreakdown: Record<
    string,
    {
      avgCompletion: number;
      spaceCount: number;
    }
  >
): {
  strengths: string[];
  weaknesses: string[];
};
/**
 * Cap an array to the top N entries, sorted by a key descending.
 */
export declare function topN<T>(items: T[], n: number, key: (item: T) => number): T[];
/**
 * Cap an array to the bottom N entries, sorted by a key ascending.
 */
export declare function bottomN<T>(items: T[], n: number, key: (item: T) => number): T[];
