"use strict";
/**
 * Rule-based Insight Engine — generates personalized LearningInsight objects
 * for students by analyzing their StudentProgressSummary, available exams, and spaces.
 *
 * No LLM involved — pure rule evaluation.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateInsightsForStudent = generateInsightsForStudent;
const aggregation_helpers_1 = require("./aggregation-helpers");
// ── Thresholds ─────────────────────────────────────────────────────────────
const WEAK_TOPIC_SCORE_THRESHOLD = 0.4;
const EXAM_PREP_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const STREAK_ENCOURAGEMENT_MIN = 3;
const IMPROVEMENT_PERCENT_THRESHOLD = 20;
const NO_ACTIVITY_DAYS = 7;
const CORRELATION_GAP_THRESHOLD = 0.15; // 15% score gap
// ── Rule implementations ───────────────────────────────────────────────────
function ruleWeakTopicRecommendation(summary, spaces) {
  const seeds = [];
  const weakAreas = summary.weaknessAreas ?? [];
  for (const topic of weakAreas) {
    const matchingSpace = spaces.find(
      (s) => s.status === "published" && s.subject?.toLowerCase() === topic.toLowerCase()
    );
    if (matchingSpace) {
      seeds.push({
        type: "weak_topic_recommendation",
        priority: "high",
        title: `Improve in ${topic}`,
        description: `You scored low in ${topic}. Practice with "${matchingSpace.title}" to strengthen your skills.`,
        actionType: "practice_space",
        actionEntityId: matchingSpace.id,
        actionEntityTitle: matchingSpace.title,
      });
    }
  }
  return seeds;
}
function ruleExamPreparation(summary, exams, spaceCompletion) {
  const seeds = [];
  const now = Date.now();
  for (const exam of exams) {
    if (!exam.linkedSpaceId || !exam.linkedSpaceTitle) continue;
    if (!exam.examDate) continue;
    // B8: examDate may be a Firestore Timestamp object OR an ISO string.
    const examTime = (0, aggregation_helpers_1.legacyMillis)(exam.examDate);
    if (examTime <= 0) continue;
    if (examTime < now || examTime > now + EXAM_PREP_WINDOW_MS) continue;
    const completion = spaceCompletion[exam.linkedSpaceId] ?? 0;
    if (completion >= 100) continue;
    seeds.push({
      type: "exam_preparation",
      priority: "high",
      title: `Prepare for ${exam.title}`,
      description: `Your exam "${exam.title}" is coming up. Practice with "${exam.linkedSpaceTitle}" to be ready.`,
      actionType: "practice_space",
      actionEntityId: exam.linkedSpaceId,
      actionEntityTitle: exam.linkedSpaceTitle,
    });
  }
  return seeds;
}
function ruleStreakEncouragement(summary) {
  if (summary.levelup.streakDays >= STREAK_ENCOURAGEMENT_MIN) {
    return [
      {
        type: "streak_encouragement",
        priority: "low",
        title: `${summary.levelup.streakDays}-day streak!`,
        description: `You're on a ${summary.levelup.streakDays}-day learning streak. Keep it up!`,
        actionType: "celebrate",
      },
    ];
  }
  return [];
}
function ruleImprovementCelebration(summary) {
  const recent = summary.autograde.recentExams;
  if (recent.length < 2) return [];
  const latest = recent[0];
  const previousAvg =
    recent.slice(1).reduce((sum, e) => sum + e.percentage, 0) / (recent.length - 1);
  if (latest.percentage > previousAvg + IMPROVEMENT_PERCENT_THRESHOLD) {
    return [
      {
        type: "improvement_celebration",
        priority: "medium",
        title: "Great improvement!",
        description: `Your score improved by ${Math.round(latest.percentage - previousAvg)}% on "${latest.examTitle}". Keep up the great work!`,
        actionType: "celebrate",
      },
    ];
  }
  return [];
}
function ruleAtRiskIntervention(summary) {
  if (!summary.isAtRisk) return [];
  const daysSinceActivity = summary.levelup.streakDays === 0 ? NO_ACTIVITY_DAYS : 0;
  if (daysSinceActivity < NO_ACTIVITY_DAYS && summary.levelup.streakDays > 0) return [];
  return [
    {
      type: "at_risk_intervention",
      priority: "high",
      title: "Let's get back on track",
      description:
        "You haven't been active recently. Even a few minutes of practice each day can make a big difference.",
      actionType: "seek_help",
    },
  ];
}
function ruleCrossSystemCorrelation(summary, correlationData, spaceCompletion, spaces) {
  const seeds = [];
  for (const [spaceId, corr] of Object.entries(correlationData)) {
    if (corr.gap < CORRELATION_GAP_THRESHOLD) continue;
    const studentCompletion = spaceCompletion[spaceId] ?? 0;
    if (studentCompletion >= 100) continue;
    const space = spaces.find((s) => s.id === spaceId);
    if (!space) continue;
    const gapPct = Math.round(corr.gap * 100);
    seeds.push({
      type: "cross_system_correlation",
      priority: "medium",
      title: `Complete "${space.title}" for better scores`,
      description: `Students who completed "${space.title}" scored ${gapPct}% higher on linked exams.`,
      actionType: "practice_space",
      actionEntityId: spaceId,
      actionEntityTitle: space.title,
    });
  }
  return seeds;
}
const MAX_INSIGHTS_PER_STUDENT = 5;
/**
 * Generate all applicable insights for a student. Returns at most MAX_INSIGHTS_PER_STUDENT
 * seeds, prioritised high → medium → low.
 */
function generateInsightsForStudent(ctx) {
  const all = [
    ...ruleWeakTopicRecommendation(ctx.summary, ctx.spaces),
    ...ruleExamPreparation(ctx.summary, ctx.exams, ctx.spaceCompletion),
    ...ruleStreakEncouragement(ctx.summary),
    ...ruleImprovementCelebration(ctx.summary),
    ...ruleAtRiskIntervention(ctx.summary),
    ...ruleCrossSystemCorrelation(
      ctx.summary,
      ctx.correlationData,
      ctx.spaceCompletion,
      ctx.spaces
    ),
  ];
  // Sort by priority: high > medium > low
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  all.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  return all.slice(0, MAX_INSIGHTS_PER_STUDENT);
}
//# sourceMappingURL=insight-rules.js.map
