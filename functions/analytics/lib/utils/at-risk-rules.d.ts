/**
 * Rule-based at-risk detection engine (no LLM).
 *
 * Rules:
 * 1. Average exam score < 0.4
 * 2. No activity streak for 7+ days (streakDays === 0 and no recent activity)
 * 3. Average space completion < 25%
 * 4. Declining performance (latest exam scores trending downward)
 */
import type { AtRiskReason } from "@levelup/domain";
import type { StudentProgressSummary } from "../contracts/legacy-docs";
interface AtRiskResult {
  isAtRisk: boolean;
  reasons: AtRiskReason[];
}
/**
 * Evaluate all at-risk rules for a student.
 */
export declare function evaluateAtRiskRules(summary: StudentProgressSummary): AtRiskResult;
export {};
