"use strict";
/**
 * Rule-based at-risk detection engine (no LLM).
 *
 * Rules:
 * 1. Average exam score < 0.4
 * 2. No activity streak for 7+ days (streakDays === 0 and no recent activity)
 * 3. Average space completion < 25%
 * 4. Declining performance (latest exam scores trending downward)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateAtRiskRules = evaluateAtRiskRules;
const aggregation_helpers_1 = require("./aggregation-helpers");
const LOW_EXAM_SCORE_THRESHOLD = 0.4;
const LOW_COMPLETION_THRESHOLD = 25;
const STREAK_DAYS_THRESHOLD = 0; // 0 means no streak
const MIN_EXAMS_FOR_DECLINING = 3;
/**
 * Evaluate all at-risk rules for a student.
 */
function evaluateAtRiskRules(summary) {
  const reasons = [];
  // Rule 1: Low exam score
  if (
    summary.autograde.completedExams > 0 &&
    summary.autograde.averageScore < LOW_EXAM_SCORE_THRESHOLD
  ) {
    reasons.push("low_exam_score");
  }
  // Rule 2: No activity / zero streak
  // Only flag if streakDays is actually computed (non-zero value or explicitly tracked).
  // streakDays defaults to 0 when uncomputed, so skip to avoid false positives.
  if (
    summary.levelup.streakDays !== undefined &&
    summary.levelup.streakDays > 0 === false &&
    summary.levelup.totalSpaces > 0 &&
    summary.levelup.recentActivity?.length > 0
  ) {
    // Check if the most recent activity is older than 7 days.
    // B8: the date may be a Firestore Timestamp object OR an ISO string.
    const lastActivityMs = (0, aggregation_helpers_1.legacyMillis)(
      summary.levelup.recentActivity[0]?.date
    );
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    if (lastActivityMs > 0 && lastActivityMs < sevenDaysAgo) {
      reasons.push("zero_streak");
    }
  }
  // Rule 3: Low space completion
  if (
    summary.levelup.totalSpaces > 0 &&
    summary.levelup.averageCompletion < LOW_COMPLETION_THRESHOLD
  ) {
    reasons.push("low_space_completion");
  }
  // Rule 4: Declining performance (check last 3+ exams for downward trend)
  if (summary.autograde.recentExams.length >= MIN_EXAMS_FOR_DECLINING) {
    const recent = summary.autograde.recentExams.slice(0, MIN_EXAMS_FOR_DECLINING);
    const isDeclining = recent.every((exam, i) => i === 0 || exam.score <= recent[i - 1].score);
    if (isDeclining && recent[0].score > recent[recent.length - 1].score) {
      reasons.push("declining_performance");
    }
  }
  return {
    isAtRisk: reasons.length > 0,
    reasons,
  };
}
//# sourceMappingURL=at-risk-rules.js.map
