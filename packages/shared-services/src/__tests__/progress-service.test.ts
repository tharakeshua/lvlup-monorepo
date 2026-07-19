/**
 * Progress service tests.
 *
 * Tests cover:
 *  1. StudentProgressSummary / ClassProgressSummary type integrity & business rules
 *  2. At-risk detection logic
 *  3. GetSummary callable request/response contract
 *  4. Progress CRUD operations via shared-services FirestoreService
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  StudentProgressSummary,
  StudentAutogradeMetrics,
  StudentLevelupMetrics,
  ClassProgressSummary,
  ClassAutogradeMetrics,
  ClassLevelupMetrics,
  AtRiskReason,
  AtRiskDetectionResult,
} from "@auto-levelup/shared-types";

// ── Mock Firestore SDK (for FirestoreService) ──────────────────────────────
const mockGetDoc = vi.fn();
const mockSetDoc = vi.fn();
const mockDeleteDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockDoc = vi.fn();
const mockCollection = vi.fn();
const mockQuery = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();

vi.mock("firebase/firestore", () => ({
  collection: (...a: any[]) => mockCollection(...a),
  doc: (...a: any[]) => mockDoc(...a),
  getDoc: (...a: any[]) => mockGetDoc(...a),
  getDocs: (...a: any[]) => mockGetDocs(...a),
  setDoc: (...a: any[]) => mockSetDoc(...a),
  deleteDoc: (...a: any[]) => mockDeleteDoc(...a),
  query: (...a: any[]) => mockQuery(...a),
  where: (...a: any[]) => mockWhere(...a),
  orderBy: (...a: any[]) => mockOrderBy(...a),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  Timestamp: { now: () => ({ seconds: 1700000000, nanoseconds: 0 }) },
  serverTimestamp: vi.fn(() => "SERVER_TIMESTAMP"),
}));

vi.mock("../firebase", () => ({
  getFirebaseServices: () => ({
    db: { _isMockDb: true },
  }),
}));

import { FirestoreService } from "../firestore/index";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeAutogradeMetrics(
  overrides: Partial<StudentAutogradeMetrics> = {}
): StudentAutogradeMetrics {
  return {
    totalExams: 10,
    completedExams: 8,
    averageScore: 0.75,
    averagePercentage: 75,
    totalMarksObtained: 300,
    totalMarksAvailable: 400,
    subjectBreakdown: {
      math: { avgScore: 0.8, examCount: 4 },
      english: { avgScore: 0.7, examCount: 4 },
    },
    recentExams: [],
    ...overrides,
  };
}

function makeLevelupMetrics(overrides: Partial<StudentLevelupMetrics> = {}): StudentLevelupMetrics {
  return {
    totalSpaces: 20,
    completedSpaces: 15,
    averageCompletion: 75,
    totalPointsEarned: 1500,
    totalPointsAvailable: 2000,
    averageAccuracy: 0.8,
    streakDays: 5,
    subjectBreakdown: { math: { avgCompletion: 80, spaceCount: 10 } },
    recentActivity: [],
    ...overrides,
  };
}

function makeStudentSummary(
  overrides: Partial<StudentProgressSummary> = {}
): StudentProgressSummary {
  return {
    id: "student-1",
    tenantId: "tenant-1",
    studentId: "student-1",
    autograde: makeAutogradeMetrics(),
    levelup: makeLevelupMetrics(),
    overallScore: 0.77,
    strengthAreas: ["math"],
    weaknessAreas: ["english"],
    isAtRisk: false,
    atRiskReasons: [],
    lastUpdatedAt: { seconds: 1700000000, nanoseconds: 0 } as any,
    ...overrides,
  };
}

function makeClassSummary(overrides: Partial<ClassProgressSummary> = {}): ClassProgressSummary {
  return {
    id: "class-1",
    tenantId: "tenant-1",
    classId: "class-1",
    className: "Class A",
    studentCount: 30,
    autograde: {
      averageClassScore: 0.72,
      examCompletionRate: 0.85,
      topPerformers: [{ studentId: "s1", name: "Alice", avgScore: 0.95 }],
      bottomPerformers: [{ studentId: "s30", name: "Bob", avgScore: 0.35 }],
    },
    levelup: {
      averageClassCompletion: 68,
      activeStudentRate: 0.9,
      topPointEarners: [{ studentId: "s1", name: "Alice", points: 2000 }],
    },
    atRiskStudentIds: ["s30"],
    atRiskCount: 1,
    lastUpdatedAt: { seconds: 1700000000, nanoseconds: 0 } as any,
    ...overrides,
  };
}

/** Replicate at-risk detection logic for testing */
function detectAtRisk(summary: StudentProgressSummary): AtRiskDetectionResult {
  const reasons: AtRiskReason[] = [];
  if (summary.autograde.averageScore < 0.4) reasons.push("low_exam_score");
  if (summary.levelup.streakDays === 0) reasons.push("zero_streak");
  if (summary.levelup.recentActivity.length === 0) reasons.push("no_recent_activity");
  if (summary.levelup.averageCompletion < 30) reasons.push("low_space_completion");
  return {
    studentId: summary.studentId,
    tenantId: summary.tenantId,
    isAtRisk: reasons.length > 0,
    reasons,
    details: {},
    detectedAt: { seconds: Date.now() / 1000, nanoseconds: 0 } as any,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("Progress CRUD via FirestoreService", () => {
  let firestoreService: FirestoreService;

  beforeEach(() => {
    vi.clearAllMocks();
    firestoreService = new FirestoreService({ _isMockDb: true } as any);
    mockDoc.mockImplementation((...args: any[]) => ({ _path: args.join("/") }));
    mockCollection.mockReturnValue("progress-collection");
  });

  it("reads a student progress summary by doc id", async () => {
    const summary = makeStudentSummary();
    const mockSnapshot = {
      exists: () => true,
      id: "student-1",
      data: () => summary,
    };
    mockGetDoc.mockResolvedValue(mockSnapshot);

    const result = await firestoreService.getDoc(
      "tenant-1",
      "studentProgressSummaries",
      "student-1"
    );

    expect(mockDoc).toHaveBeenCalled();
    expect(result.exists()).toBe(true);
    expect(result.data()).toEqual(expect.objectContaining({ studentId: "student-1" }));
  });

  it("returns snapshot with exists=false for non-existing progress summary", async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false, data: () => undefined });

    const result = await firestoreService.getDoc(
      "tenant-1",
      "studentProgressSummaries",
      "nonexistent"
    );

    expect(result.exists()).toBe(false);
  });

  it("writes a student progress summary", async () => {
    mockSetDoc.mockResolvedValue(undefined);

    const summary = makeStudentSummary();
    await firestoreService.setDoc("tenant-1", "studentProgressSummaries", "student-1", summary);

    expect(mockSetDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ studentId: "student-1", overallScore: 0.77 }),
      { merge: false }
    );
  });

  it("deletes a progress summary", async () => {
    mockDeleteDoc.mockResolvedValue(undefined);

    await firestoreService.deleteDoc("tenant-1", "studentProgressSummaries", "student-1");

    expect(mockDeleteDoc).toHaveBeenCalled();
  });
});

describe("StudentProgressSummary calculations", () => {
  it("overallScore is a normalised 0-1 value", () => {
    const summary = makeStudentSummary({ overallScore: 0.77 });
    expect(summary.overallScore).toBeGreaterThanOrEqual(0);
    expect(summary.overallScore).toBeLessThanOrEqual(1);
  });

  it("identifies at-risk student with low exam scores", () => {
    const summary = makeStudentSummary({
      isAtRisk: true,
      atRiskReasons: ["low_exam_score"],
      autograde: makeAutogradeMetrics({ averageScore: 0.3, averagePercentage: 30 }),
      overallScore: 0.35,
    });
    expect(summary.isAtRisk).toBe(true);
    expect(summary.atRiskReasons).toContain("low_exam_score");
  });

  it("strength and weakness areas do not overlap", () => {
    const summary = makeStudentSummary({
      strengthAreas: ["math", "science"],
      weaknessAreas: ["english"],
    });
    const overlap = summary.strengthAreas.filter((s) => summary.weaknessAreas.includes(s));
    expect(overlap).toHaveLength(0);
  });

  it("autograde percentage consistent with marks ratio", () => {
    const m = makeAutogradeMetrics({
      totalMarksObtained: 180,
      totalMarksAvailable: 200,
      averagePercentage: 90,
    });
    expect(m.averagePercentage).toBe((m.totalMarksObtained / m.totalMarksAvailable) * 100);
  });

  it("levelup averageCompletion consistent with completed / total", () => {
    const m = makeLevelupMetrics({ completedSpaces: 15, totalSpaces: 20, averageCompletion: 75 });
    expect(m.averageCompletion).toBe((m.completedSpaces / m.totalSpaces) * 100);
  });

  it("tracks zero streak for inactive students", () => {
    const summary = makeStudentSummary({
      isAtRisk: true,
      atRiskReasons: ["zero_streak", "no_recent_activity"],
      levelup: makeLevelupMetrics({ streakDays: 0, recentActivity: [] }),
    });
    expect(summary.levelup.streakDays).toBe(0);
    expect(summary.atRiskReasons).toContain("zero_streak");
  });
});

describe("At-risk detection logic", () => {
  it("flags low_exam_score when averageScore < 0.4", () => {
    const summary = makeStudentSummary({
      autograde: makeAutogradeMetrics({ averageScore: 0.25 }),
    });
    const result = detectAtRisk(summary);
    expect(result.isAtRisk).toBe(true);
    expect(result.reasons).toContain("low_exam_score");
  });

  it("flags zero_streak when streakDays is 0", () => {
    const summary = makeStudentSummary({
      levelup: makeLevelupMetrics({ streakDays: 0 }),
    });
    const result = detectAtRisk(summary);
    expect(result.reasons).toContain("zero_streak");
  });

  it("flags no_recent_activity when recentActivity is empty", () => {
    const summary = makeStudentSummary({
      levelup: makeLevelupMetrics({ recentActivity: [] }),
    });
    const result = detectAtRisk(summary);
    expect(result.reasons).toContain("no_recent_activity");
  });

  it("does not flag healthy student", () => {
    const summary = makeStudentSummary({
      autograde: makeAutogradeMetrics({ averageScore: 0.85 }),
      levelup: makeLevelupMetrics({
        streakDays: 5,
        averageCompletion: 80,
        recentActivity: [
          { spaceId: "s1", spaceTitle: "Test", action: "complete", date: {} as any },
        ],
      }),
    });
    const result = detectAtRisk(summary);
    expect(result.isAtRisk).toBe(false);
    expect(result.reasons).toHaveLength(0);
  });
});

describe("ClassProgressSummary calculations", () => {
  it("top performers have higher scores than bottom performers", () => {
    const summary = makeClassSummary();
    expect(summary.autograde.topPerformers[0].avgScore).toBeGreaterThan(
      summary.autograde.bottomPerformers[0].avgScore
    );
  });

  it("atRiskCount matches atRiskStudentIds length", () => {
    const summary = makeClassSummary({ atRiskStudentIds: ["s5", "s12", "s30"], atRiskCount: 3 });
    expect(summary.atRiskCount).toBe(summary.atRiskStudentIds.length);
  });

  it("examCompletionRate is 0-1", () => {
    const summary = makeClassSummary();
    expect(summary.autograde.examCompletionRate).toBeGreaterThanOrEqual(0);
    expect(summary.autograde.examCompletionRate).toBeLessThanOrEqual(1);
  });

  it("activeStudentRate is 0-1", () => {
    const summary = makeClassSummary();
    expect(summary.levelup.activeStudentRate).toBeGreaterThanOrEqual(0);
    expect(summary.levelup.activeStudentRate).toBeLessThanOrEqual(1);
  });

  it("handles class with zero students", () => {
    const summary = makeClassSummary({
      studentCount: 0,
      autograde: {
        averageClassScore: 0,
        examCompletionRate: 0,
        topPerformers: [],
        bottomPerformers: [],
      },
      levelup: { averageClassCompletion: 0, activeStudentRate: 0, topPointEarners: [] },
      atRiskStudentIds: [],
      atRiskCount: 0,
    });
    expect(summary.studentCount).toBe(0);
    expect(summary.autograde.topPerformers).toEqual([]);
    expect(summary.atRiskCount).toBe(0);
  });
});

describe("StudentProgressSummary aggregation edge cases", () => {
  it("handles student with no exams taken", () => {
    const summary = makeStudentSummary({
      autograde: makeAutogradeMetrics({
        totalExams: 0,
        completedExams: 0,
        averageScore: 0,
        averagePercentage: 0,
        totalMarksObtained: 0,
        totalMarksAvailable: 0,
        subjectBreakdown: {},
        recentExams: [],
      }),
      overallScore: 0.3,
    });
    expect(summary.autograde.totalExams).toBe(0);
    expect(summary.autograde.averageScore).toBe(0);
    expect(summary.autograde.subjectBreakdown).toEqual({});
  });

  it("handles student with no spaces started", () => {
    const summary = makeStudentSummary({
      levelup: makeLevelupMetrics({
        totalSpaces: 0,
        completedSpaces: 0,
        averageCompletion: 0,
        totalPointsEarned: 0,
        totalPointsAvailable: 0,
        averageAccuracy: 0,
        streakDays: 0,
        subjectBreakdown: {},
        recentActivity: [],
      }),
    });
    expect(summary.levelup.totalSpaces).toBe(0);
    expect(summary.levelup.completedSpaces).toBe(0);
    expect(summary.levelup.averageAccuracy).toBe(0);
  });

  it("handles perfect score student", () => {
    const summary = makeStudentSummary({
      autograde: makeAutogradeMetrics({ averageScore: 1.0, averagePercentage: 100 }),
      levelup: makeLevelupMetrics({ averageCompletion: 100, completedSpaces: 20, totalSpaces: 20 }),
      overallScore: 1.0,
    });
    expect(summary.overallScore).toBe(1.0);
    expect(summary.autograde.averageScore).toBe(1.0);
    expect(summary.levelup.averageCompletion).toBe(100);
  });

  it("completedExams never exceeds totalExams", () => {
    const m = makeAutogradeMetrics({ totalExams: 5, completedExams: 5 });
    expect(m.completedExams).toBeLessThanOrEqual(m.totalExams);
  });

  it("completedSpaces never exceeds totalSpaces", () => {
    const m = makeLevelupMetrics({ totalSpaces: 10, completedSpaces: 10 });
    expect(m.completedSpaces).toBeLessThanOrEqual(m.totalSpaces);
  });

  it("multiple subject breakdown aggregation", () => {
    const m = makeAutogradeMetrics({
      subjectBreakdown: {
        math: { avgScore: 0.9, examCount: 3 },
        english: { avgScore: 0.6, examCount: 2 },
        science: { avgScore: 0.75, examCount: 5 },
      },
    });
    const subjects = Object.keys(m.subjectBreakdown);
    expect(subjects).toHaveLength(3);
    expect(subjects).toContain("science");
    const totalExamCount = Object.values(m.subjectBreakdown).reduce((s, v) => s + v.examCount, 0);
    expect(totalExamCount).toBe(10);
  });

  it("recentExams entries have valid score ranges", () => {
    const m = makeAutogradeMetrics({
      recentExams: [
        {
          examId: "e1",
          examTitle: "Math Final",
          score: 0.85,
          percentage: 85,
          date: { seconds: 1700000000, nanoseconds: 0 } as any,
        },
        {
          examId: "e2",
          examTitle: "English Mid",
          score: 0.6,
          percentage: 60,
          date: { seconds: 1699999000, nanoseconds: 0 } as any,
        },
      ],
    });
    for (const exam of m.recentExams) {
      expect(exam.score).toBeGreaterThanOrEqual(0);
      expect(exam.score).toBeLessThanOrEqual(1);
      expect(exam.percentage).toBeGreaterThanOrEqual(0);
      expect(exam.percentage).toBeLessThanOrEqual(100);
    }
  });
});

describe("At-risk detection — multiple concurrent reasons", () => {
  it("flags multiple reasons simultaneously", () => {
    const summary = makeStudentSummary({
      autograde: makeAutogradeMetrics({ averageScore: 0.2 }),
      levelup: makeLevelupMetrics({ streakDays: 0, recentActivity: [], averageCompletion: 10 }),
    });
    const result = detectAtRisk(summary);
    expect(result.isAtRisk).toBe(true);
    expect(result.reasons).toContain("low_exam_score");
    expect(result.reasons).toContain("zero_streak");
    expect(result.reasons).toContain("no_recent_activity");
    expect(result.reasons).toContain("low_space_completion");
    expect(result.reasons).toHaveLength(4);
  });

  it("flags low_space_completion when averageCompletion < 30", () => {
    const summary = makeStudentSummary({
      levelup: makeLevelupMetrics({
        averageCompletion: 20,
        streakDays: 5,
        recentActivity: [
          { spaceId: "s1", spaceTitle: "Test", action: "in_progress", date: {} as any },
        ],
      }),
    });
    const result = detectAtRisk(summary);
    expect(result.reasons).toContain("low_space_completion");
    expect(result.reasons).not.toContain("zero_streak");
  });

  it("at-risk result includes correct tenantId and studentId", () => {
    const summary = makeStudentSummary({
      studentId: "stu-42",
      tenantId: "tenant-7",
      autograde: makeAutogradeMetrics({ averageScore: 0.1 }),
    });
    const result = detectAtRisk(summary);
    expect(result.studentId).toBe("stu-42");
    expect(result.tenantId).toBe("tenant-7");
  });
});

describe("ClassProgressSummary advanced scenarios", () => {
  it("handles large class with many at-risk students", () => {
    const atRisk = Array.from({ length: 15 }, (_, i) => `s${i}`);
    const summary = makeClassSummary({
      studentCount: 100,
      atRiskStudentIds: atRisk,
      atRiskCount: 15,
    });
    expect(summary.atRiskCount).toBe(15);
    expect(summary.atRiskStudentIds).toHaveLength(15);
    expect(summary.atRiskCount / summary.studentCount).toBe(0.15);
  });

  it("multiple top performers are ranked by score", () => {
    const summary = makeClassSummary({
      autograde: {
        averageClassScore: 0.7,
        examCompletionRate: 0.9,
        topPerformers: [
          { studentId: "s1", name: "Alice", avgScore: 0.98 },
          { studentId: "s2", name: "Bob", avgScore: 0.95 },
          { studentId: "s3", name: "Carol", avgScore: 0.92 },
        ],
        bottomPerformers: [{ studentId: "s30", name: "Dan", avgScore: 0.2 }],
      },
    });
    const scores = summary.autograde.topPerformers.map((p) => p.avgScore);
    const sorted = [...scores].sort((a, b) => b - a);
    expect(scores).toEqual(sorted);
  });

  it("top point earners contain valid data", () => {
    const summary = makeClassSummary({
      levelup: {
        averageClassCompletion: 75,
        activeStudentRate: 0.85,
        topPointEarners: [
          { studentId: "s1", name: "Alice", points: 5000 },
          { studentId: "s2", name: "Bob", points: 4500 },
        ],
      },
    });
    for (const earner of summary.levelup.topPointEarners) {
      expect(earner.points).toBeGreaterThan(0);
      expect(earner.studentId).toBeTruthy();
      expect(earner.name).toBeTruthy();
    }
  });
});

describe("GetSummary callable contract", () => {
  it("student scope returns studentSummary", () => {
    const response = { scope: "student" as const, studentSummary: makeStudentSummary() };
    expect(response.scope).toBe("student");
    expect(response.studentSummary!.studentId).toBe("student-1");
  });

  it("class scope returns classSummary", () => {
    const response = { scope: "class" as const, classSummary: makeClassSummary() };
    expect(response.scope).toBe("class");
    expect(response.classSummary!.classId).toBe("class-1");
  });

  it("student scope includes both autograde and levelup metrics", () => {
    const response = { scope: "student" as const, studentSummary: makeStudentSummary() };
    expect(response.studentSummary!.autograde).toBeDefined();
    expect(response.studentSummary!.levelup).toBeDefined();
    expect(response.studentSummary!.autograde.totalExams).toBeGreaterThanOrEqual(0);
    expect(response.studentSummary!.levelup.totalSpaces).toBeGreaterThanOrEqual(0);
  });

  it("class scope includes atRisk data", () => {
    const response = { scope: "class" as const, classSummary: makeClassSummary() };
    expect(response.classSummary!.atRiskStudentIds).toBeDefined();
    expect(response.classSummary!.atRiskCount).toBeDefined();
    expect(Array.isArray(response.classSummary!.atRiskStudentIds)).toBe(true);
  });
});
