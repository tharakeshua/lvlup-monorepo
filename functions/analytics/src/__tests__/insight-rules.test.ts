/**
 * Tests for generateInsightsForStudent — rule-based insight generation engine.
 *
 * Covers:
 *  1. No insights for fully-engaged student
 *  2. ruleWeakTopicRecommendation — matching published space
 *  3. ruleWeakTopicRecommendation — no matching space
 *  4. ruleExamPreparation — upcoming exam with incomplete linked space
 *  5. ruleExamPreparation — exam > 7 days away (no alert)
 *  6. ruleStreakEncouragement — streak >= 3 days
 *  7. ruleStreakEncouragement — streak < 3 days (no encouragement)
 *  8. ruleImprovementCelebration — 20%+ improvement
 *  9. ruleAtRiskIntervention — inactive at-risk student
 * 10. ruleCrossSystemCorrelation — gap > 15%
 * 11. Max 5 insights with priority ordering (high > medium > low)
 */

import { describe, it, expect } from "vitest";
import {
  generateInsightsForStudent,
  type InsightGenerationContext,
  type InsightExamData,
  type InsightSpaceData,
  type SpaceCompletionMap,
  type CorrelationData,
} from "../utils/insight-rules";

// ── Helpers ──────────────────────────────────────────────────────────────

function makeContext(overrides: Partial<InsightGenerationContext> = {}): InsightGenerationContext {
  return {
    summary: {
      autograde: {
        completedExams: 5,
        averageScore: 0.85,
        recentExams: [
          { score: 0.85, percentage: 85, examTitle: "Exam A" },
          { score: 0.8, percentage: 80, examTitle: "Exam B" },
        ],
      },
      levelup: {
        streakDays: 2,
        totalSpaces: 3,
        averageCompletion: 70,
        recentActivity: [{ date: { toMillis: () => Date.now() - 1000 } }],
      },
      isAtRisk: false,
      weaknessAreas: [],
    } as any,
    exams: [],
    spaces: [],
    spaceCompletion: {},
    correlationData: {},
    ...overrides,
  };
}

function daysFromNowMillis(days: number): number {
  return Date.now() + days * 24 * 60 * 60 * 1000;
}

// ── Tests ────────────────────────────────────────────────────────────────

describe("generateInsightsForStudent", () => {
  // ── No insights for engaged student ─────────────────────────────────

  it("returns no insights for a fully-engaged student with no triggers", () => {
    const ctx = makeContext();
    const insights = generateInsightsForStudent(ctx);
    expect(insights).toEqual([]);
  });

  // ── Weak topic recommendation ───────────────────────────────────────

  describe("ruleWeakTopicRecommendation", () => {
    it("generates insight when weakness area matches a published space subject", () => {
      const ctx = makeContext({
        summary: {
          ...makeContext().summary,
          weaknessAreas: ["Algebra"],
        } as any,
        spaces: [
          { id: "space-1", title: "Algebra Practice", subject: "Algebra", status: "published" },
        ],
      });

      const insights = generateInsightsForStudent(ctx);
      const weakTopicInsights = insights.filter((i) => i.type === "weak_topic_recommendation");
      expect(weakTopicInsights).toHaveLength(1);
      expect(weakTopicInsights[0].priority).toBe("high");
      expect(weakTopicInsights[0].actionEntityId).toBe("space-1");
      expect(weakTopicInsights[0].title).toContain("Algebra");
    });

    it("does NOT generate insight when no matching published space exists", () => {
      const ctx = makeContext({
        summary: {
          ...makeContext().summary,
          weaknessAreas: ["Calculus"],
        } as any,
        spaces: [
          { id: "space-1", title: "Algebra Practice", subject: "Algebra", status: "published" },
        ],
      });

      const insights = generateInsightsForStudent(ctx);
      const weakTopicInsights = insights.filter((i) => i.type === "weak_topic_recommendation");
      expect(weakTopicInsights).toHaveLength(0);
    });

    it("does NOT match unpublished spaces", () => {
      const ctx = makeContext({
        summary: {
          ...makeContext().summary,
          weaknessAreas: ["Algebra"],
        } as any,
        spaces: [{ id: "space-1", title: "Algebra Practice", subject: "Algebra", status: "draft" }],
      });

      const insights = generateInsightsForStudent(ctx);
      const weakTopicInsights = insights.filter((i) => i.type === "weak_topic_recommendation");
      expect(weakTopicInsights).toHaveLength(0);
    });

    it("matches case-insensitively", () => {
      const ctx = makeContext({
        summary: {
          ...makeContext().summary,
          weaknessAreas: ["algebra"],
        } as any,
        spaces: [
          { id: "space-1", title: "Algebra Practice", subject: "Algebra", status: "published" },
        ],
      });

      const insights = generateInsightsForStudent(ctx);
      const weakTopicInsights = insights.filter((i) => i.type === "weak_topic_recommendation");
      expect(weakTopicInsights).toHaveLength(1);
    });
  });

  // ── Exam preparation ────────────────────────────────────────────────

  describe("ruleExamPreparation", () => {
    it("generates alert when upcoming exam within 7 days has incomplete linked space", () => {
      const ctx = makeContext({
        exams: [
          {
            id: "exam-1",
            title: "Midterm",
            linkedSpaceId: "space-1",
            linkedSpaceTitle: "Midterm Prep",
            classIds: ["class-1"],
            topics: ["math"],
            examDate: { toMillis: () => daysFromNowMillis(3) },
          },
        ],
        spaceCompletion: { "space-1": 50 },
      });

      const insights = generateInsightsForStudent(ctx);
      const examInsights = insights.filter((i) => i.type === "exam_preparation");
      expect(examInsights).toHaveLength(1);
      expect(examInsights[0].priority).toBe("high");
      expect(examInsights[0].title).toContain("Midterm");
      expect(examInsights[0].actionEntityId).toBe("space-1");
    });

    it("does NOT generate alert when exam is > 7 days away", () => {
      const ctx = makeContext({
        exams: [
          {
            id: "exam-1",
            title: "Final",
            linkedSpaceId: "space-1",
            linkedSpaceTitle: "Final Prep",
            classIds: ["class-1"],
            topics: ["math"],
            examDate: { toMillis: () => daysFromNowMillis(10) },
          },
        ],
        spaceCompletion: { "space-1": 50 },
      });

      const insights = generateInsightsForStudent(ctx);
      const examInsights = insights.filter((i) => i.type === "exam_preparation");
      expect(examInsights).toHaveLength(0);
    });

    it("does NOT generate alert when linked space is 100% complete", () => {
      const ctx = makeContext({
        exams: [
          {
            id: "exam-1",
            title: "Midterm",
            linkedSpaceId: "space-1",
            linkedSpaceTitle: "Midterm Prep",
            classIds: ["class-1"],
            topics: ["math"],
            examDate: { toMillis: () => daysFromNowMillis(3) },
          },
        ],
        spaceCompletion: { "space-1": 100 },
      });

      const insights = generateInsightsForStudent(ctx);
      const examInsights = insights.filter((i) => i.type === "exam_preparation");
      expect(examInsights).toHaveLength(0);
    });

    it("does NOT generate alert when exam has no linked space", () => {
      const ctx = makeContext({
        exams: [
          {
            id: "exam-1",
            title: "Pop Quiz",
            classIds: ["class-1"],
            topics: ["math"],
            examDate: { toMillis: () => daysFromNowMillis(3) },
          },
        ],
      });

      const insights = generateInsightsForStudent(ctx);
      const examInsights = insights.filter((i) => i.type === "exam_preparation");
      expect(examInsights).toHaveLength(0);
    });

    it("does NOT generate alert when exam date is in the past", () => {
      const ctx = makeContext({
        exams: [
          {
            id: "exam-1",
            title: "Old Exam",
            linkedSpaceId: "space-1",
            linkedSpaceTitle: "Old Prep",
            classIds: ["class-1"],
            topics: ["math"],
            examDate: { toMillis: () => daysFromNowMillis(-2) },
          },
        ],
        spaceCompletion: { "space-1": 50 },
      });

      const insights = generateInsightsForStudent(ctx);
      const examInsights = insights.filter((i) => i.type === "exam_preparation");
      expect(examInsights).toHaveLength(0);
    });
  });

  // ── Streak encouragement ────────────────────────────────────────────

  describe("ruleStreakEncouragement", () => {
    it("generates encouragement at streak >= 3 days", () => {
      const ctx = makeContext({
        summary: {
          ...makeContext().summary,
          levelup: { ...(makeContext().summary.levelup as any), streakDays: 5 },
        } as any,
      });

      const insights = generateInsightsForStudent(ctx);
      const streakInsights = insights.filter((i) => i.type === "streak_encouragement");
      expect(streakInsights).toHaveLength(1);
      expect(streakInsights[0].priority).toBe("low");
      expect(streakInsights[0].title).toContain("5-day streak");
    });

    it("generates encouragement at exactly 3 days (boundary)", () => {
      const ctx = makeContext({
        summary: {
          ...makeContext().summary,
          levelup: { ...(makeContext().summary.levelup as any), streakDays: 3 },
        } as any,
      });

      const insights = generateInsightsForStudent(ctx);
      const streakInsights = insights.filter((i) => i.type === "streak_encouragement");
      expect(streakInsights).toHaveLength(1);
      expect(streakInsights[0].title).toContain("3-day streak");
    });

    it("does NOT generate encouragement below 3 days", () => {
      const ctx = makeContext({
        summary: {
          ...makeContext().summary,
          levelup: { ...(makeContext().summary.levelup as any), streakDays: 2 },
        } as any,
      });

      const insights = generateInsightsForStudent(ctx);
      const streakInsights = insights.filter((i) => i.type === "streak_encouragement");
      expect(streakInsights).toHaveLength(0);
    });

    it("does NOT generate encouragement at 0 days", () => {
      const ctx = makeContext({
        summary: {
          ...makeContext().summary,
          levelup: { ...(makeContext().summary.levelup as any), streakDays: 0 },
        } as any,
      });

      const insights = generateInsightsForStudent(ctx);
      const streakInsights = insights.filter((i) => i.type === "streak_encouragement");
      expect(streakInsights).toHaveLength(0);
    });
  });

  // ── Improvement celebration ─────────────────────────────────────────

  describe("ruleImprovementCelebration", () => {
    it("generates celebration when latest exam > previous avg + 20%", () => {
      const ctx = makeContext({
        summary: {
          ...makeContext().summary,
          autograde: {
            ...(makeContext().summary.autograde as any),
            recentExams: [
              { score: 0.9, percentage: 90, examTitle: "Latest Exam" }, // latest
              { score: 0.5, percentage: 50, examTitle: "Exam B" }, // prev avg = 50
            ],
          },
        } as any,
      });

      const insights = generateInsightsForStudent(ctx);
      const celebrationInsights = insights.filter((i) => i.type === "improvement_celebration");
      expect(celebrationInsights).toHaveLength(1);
      expect(celebrationInsights[0].priority).toBe("medium");
      expect(celebrationInsights[0].title).toBe("Great improvement!");
    });

    it("does NOT celebrate when improvement is exactly 20% (boundary)", () => {
      const ctx = makeContext({
        summary: {
          ...makeContext().summary,
          autograde: {
            ...(makeContext().summary.autograde as any),
            recentExams: [
              { score: 0.7, percentage: 70, examTitle: "Latest" }, // latest
              { score: 0.5, percentage: 50, examTitle: "Previous" }, // prev avg = 50
              // 70 - 50 = 20, not > 20
            ],
          },
        } as any,
      });

      const insights = generateInsightsForStudent(ctx);
      const celebrationInsights = insights.filter((i) => i.type === "improvement_celebration");
      expect(celebrationInsights).toHaveLength(0);
    });

    it("does NOT celebrate with only 1 exam (not enough data)", () => {
      const ctx = makeContext({
        summary: {
          ...makeContext().summary,
          autograde: {
            ...(makeContext().summary.autograde as any),
            recentExams: [{ score: 0.9, percentage: 90, examTitle: "Only Exam" }],
          },
        } as any,
      });

      const insights = generateInsightsForStudent(ctx);
      const celebrationInsights = insights.filter((i) => i.type === "improvement_celebration");
      expect(celebrationInsights).toHaveLength(0);
    });

    it("celebrates when improvement is 21% (just above threshold)", () => {
      const ctx = makeContext({
        summary: {
          ...makeContext().summary,
          autograde: {
            ...(makeContext().summary.autograde as any),
            recentExams: [
              { score: 0.71, percentage: 71, examTitle: "Latest" },
              { score: 0.5, percentage: 50, examTitle: "Previous" },
              // 71 - 50 = 21, > 20
            ],
          },
        } as any,
      });

      const insights = generateInsightsForStudent(ctx);
      const celebrationInsights = insights.filter((i) => i.type === "improvement_celebration");
      expect(celebrationInsights).toHaveLength(1);
    });
  });

  // ── At-risk intervention ────────────────────────────────────────────

  describe("ruleAtRiskIntervention", () => {
    it("generates intervention for at-risk student with zero streak (no activity)", () => {
      const ctx = makeContext({
        summary: {
          ...makeContext().summary,
          isAtRisk: true,
          levelup: { ...(makeContext().summary.levelup as any), streakDays: 0 },
        } as any,
      });

      const insights = generateInsightsForStudent(ctx);
      const interventionInsights = insights.filter((i) => i.type === "at_risk_intervention");
      expect(interventionInsights).toHaveLength(1);
      expect(interventionInsights[0].priority).toBe("high");
      expect(interventionInsights[0].actionType).toBe("seek_help");
    });

    it("does NOT generate intervention when student is NOT at risk", () => {
      const ctx = makeContext({
        summary: {
          ...makeContext().summary,
          isAtRisk: false,
          levelup: { ...(makeContext().summary.levelup as any), streakDays: 0 },
        } as any,
      });

      const insights = generateInsightsForStudent(ctx);
      const interventionInsights = insights.filter((i) => i.type === "at_risk_intervention");
      expect(interventionInsights).toHaveLength(0);
    });

    it("does NOT generate intervention when at-risk but has active streak", () => {
      const ctx = makeContext({
        summary: {
          ...makeContext().summary,
          isAtRisk: true,
          levelup: { ...(makeContext().summary.levelup as any), streakDays: 3 },
        } as any,
      });

      const insights = generateInsightsForStudent(ctx);
      const interventionInsights = insights.filter((i) => i.type === "at_risk_intervention");
      expect(interventionInsights).toHaveLength(0);
    });
  });

  // ── Cross-system correlation ────────────────────────────────────────

  describe("ruleCrossSystemCorrelation", () => {
    it("generates insight when correlation gap > 15% and space incomplete", () => {
      const ctx = makeContext({
        correlationData: {
          "space-1": { completedAvg: 0.85, notCompletedAvg: 0.65, gap: 0.2 },
        },
        spaceCompletion: { "space-1": 50 },
        spaces: [{ id: "space-1", title: "Algebra Basics", subject: "Math", status: "published" }],
      });

      const insights = generateInsightsForStudent(ctx);
      const corrInsights = insights.filter((i) => i.type === "cross_system_correlation");
      expect(corrInsights).toHaveLength(1);
      expect(corrInsights[0].priority).toBe("medium");
      expect(corrInsights[0].actionEntityId).toBe("space-1");
      expect(corrInsights[0].description).toContain("20%");
    });

    it("does NOT generate insight when gap < 15%", () => {
      const ctx = makeContext({
        correlationData: {
          "space-1": { completedAvg: 0.8, notCompletedAvg: 0.7, gap: 0.1 },
        },
        spaceCompletion: { "space-1": 50 },
        spaces: [{ id: "space-1", title: "Algebra Basics", subject: "Math", status: "published" }],
      });

      const insights = generateInsightsForStudent(ctx);
      const corrInsights = insights.filter((i) => i.type === "cross_system_correlation");
      expect(corrInsights).toHaveLength(0);
    });

    it("does NOT generate insight when space is 100% complete", () => {
      const ctx = makeContext({
        correlationData: {
          "space-1": { completedAvg: 0.85, notCompletedAvg: 0.65, gap: 0.2 },
        },
        spaceCompletion: { "space-1": 100 },
        spaces: [{ id: "space-1", title: "Algebra Basics", subject: "Math", status: "published" }],
      });

      const insights = generateInsightsForStudent(ctx);
      const corrInsights = insights.filter((i) => i.type === "cross_system_correlation");
      expect(corrInsights).toHaveLength(0);
    });

    it("does NOT generate insight when space not found in spaces array", () => {
      const ctx = makeContext({
        correlationData: {
          "space-99": { completedAvg: 0.85, notCompletedAvg: 0.65, gap: 0.2 },
        },
        spaceCompletion: { "space-99": 50 },
        spaces: [], // no matching space
      });

      const insights = generateInsightsForStudent(ctx);
      const corrInsights = insights.filter((i) => i.type === "cross_system_correlation");
      expect(corrInsights).toHaveLength(0);
    });
  });

  // ── Priority ordering and max cap ───────────────────────────────────

  describe("Priority ordering and max insights cap", () => {
    it("returns at most 5 insights prioritized high > medium > low", () => {
      const ctx = makeContext({
        summary: {
          autograde: {
            completedExams: 10,
            averageScore: 0.3,
            recentExams: [
              { score: 0.9, percentage: 90, examTitle: "Latest" },
              { score: 0.5, percentage: 50, examTitle: "Previous 1" },
              { score: 0.5, percentage: 50, examTitle: "Previous 2" },
            ],
          },
          levelup: {
            streakDays: 5,
            totalSpaces: 3,
            averageCompletion: 70,
            recentActivity: [{ date: { toMillis: () => Date.now() } }],
          },
          isAtRisk: true,
          weaknessAreas: ["Math", "Science", "English"],
        } as any,
        spaces: [
          { id: "s-1", title: "Math Space", subject: "Math", status: "published" },
          { id: "s-2", title: "Science Space", subject: "Science", status: "published" },
          { id: "s-3", title: "English Space", subject: "English", status: "published" },
        ],
        exams: [
          {
            id: "exam-1",
            title: "Upcoming Exam",
            linkedSpaceId: "s-1",
            linkedSpaceTitle: "Math Space",
            classIds: ["c-1"],
            topics: ["math"],
            examDate: { toMillis: () => daysFromNowMillis(2) },
          },
        ],
        spaceCompletion: { "s-1": 30 },
        correlationData: {
          "s-2": { completedAvg: 0.9, notCompletedAvg: 0.6, gap: 0.3 },
        },
      });

      const insights = generateInsightsForStudent(ctx);

      // Should be capped at 5
      expect(insights.length).toBeLessThanOrEqual(5);

      // High priority should come first
      const highPriority = insights.filter((i) => i.priority === "high");
      const mediumPriority = insights.filter((i) => i.priority === "medium");
      const lowPriority = insights.filter((i) => i.priority === "low");

      // All high-priority insights should appear before medium, medium before low
      if (highPriority.length > 0 && mediumPriority.length > 0) {
        const lastHighIdx = insights.findIndex((i) => i === highPriority[highPriority.length - 1]);
        const firstMedIdx = insights.findIndex((i) => i === mediumPriority[0]);
        expect(lastHighIdx).toBeLessThan(firstMedIdx);
      }

      if (mediumPriority.length > 0 && lowPriority.length > 0) {
        const lastMedIdx = insights.findIndex(
          (i) => i === mediumPriority[mediumPriority.length - 1]
        );
        const firstLowIdx = insights.findIndex((i) => i === lowPriority[0]);
        expect(lastMedIdx).toBeLessThan(firstLowIdx);
      }
    });

    it("returns fewer than 5 when fewer rules fire", () => {
      // Only streak encouragement fires (streak = 3)
      const ctx = makeContext({
        summary: {
          ...makeContext().summary,
          levelup: { ...(makeContext().summary.levelup as any), streakDays: 3 },
        } as any,
      });

      const insights = generateInsightsForStudent(ctx);
      expect(insights).toHaveLength(1);
      expect(insights[0].type).toBe("streak_encouragement");
    });
  });
});
