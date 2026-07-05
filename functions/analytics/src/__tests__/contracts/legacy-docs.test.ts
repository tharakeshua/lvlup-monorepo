/**
 * U3.3 contracts coverage (MIGRATION-PATTERN test rules):
 * - B8 timestamp round-trip per migrated read path: Firestore-Timestamp-object
 *   in → canonical ISO string out (and ISO in → ISO out).
 * - Legacy enum widen-on-read via domain zLegacy*Read adapters (AD-4/AD-10).
 * - legacyMillis()/legacyIso() boundary helpers.
 */
import { describe, it, expect } from "vitest";
import {
  StudentProgressSummarySchema,
  ClassProgressSummarySchema,
  SubmissionSchema,
  ExamSchema,
  ExamQuestionSchema,
} from "../../contracts/legacy-docs";
import { legacyMillis, legacyIso } from "../../utils/aggregation-helpers";

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/** 2026-07-05T00:00:00.000Z as a Firestore Timestamp-like object. */
const FS_TS = { seconds: 1783209600, nanoseconds: 0 };
const FS_TS_ISO = "2026-07-05T00:00:00.000Z";

// ── StudentProgressSummary ──────────────────────────────────────────────────

function makeStudentSummary(ts: unknown) {
  return {
    id: "stu-1",
    tenantId: "tenant-1",
    studentId: "stu-1",
    autograde: {
      totalExams: 2,
      completedExams: 2,
      averageScore: 0.7,
      averagePercentage: 70,
      totalMarksObtained: 70,
      totalMarksAvailable: 100,
      subjectBreakdown: { Math: { avgScore: 0.7, examCount: 2 } },
      recentExams: [{ examId: "e1", examTitle: "Algebra", score: 0.7, percentage: 70, date: ts }],
    },
    levelup: {
      totalSpaces: 1,
      completedSpaces: 0,
      averageCompletion: 40,
      totalPointsEarned: 10,
      totalPointsAvailable: 50,
      averageAccuracy: 0.2,
      streakDays: 3,
      subjectBreakdown: { Math: { avgCompletion: 40, spaceCount: 1 } },
      recentActivity: [
        { spaceId: "sp1", spaceTitle: "Fractions", action: "in_progress", date: ts },
      ],
    },
    overallScore: 0.58,
    strengthAreas: [],
    weaknessAreas: ["Math"],
    isAtRisk: false,
    atRiskReasons: [],
    lastUpdatedAt: ts,
  };
}

describe("StudentProgressSummarySchema — B8 timestamp round-trip", () => {
  it("collapses Firestore Timestamp objects to canonical ISO strings", () => {
    const parsed = StudentProgressSummarySchema.parse(makeStudentSummary(FS_TS));
    expect(parsed.lastUpdatedAt).toBe(FS_TS_ISO);
    expect(parsed.autograde.recentExams[0].date).toBe(FS_TS_ISO);
    expect(parsed.levelup.recentActivity[0].date).toBe(FS_TS_ISO);
  });

  it("passes canonical ISO strings through unchanged", () => {
    const parsed = StudentProgressSummarySchema.parse(makeStudentSummary(FS_TS_ISO));
    expect(parsed.lastUpdatedAt).toBe(FS_TS_ISO);
    expect(parsed.autograde.recentExams[0].date).toMatch(ISO_RE);
  });

  it("preserves unknown legacy fields (loose/passthrough — wire compat)", () => {
    const doc = { ...makeStudentSummary(FS_TS_ISO), legacyExtra: "keep-me" };
    const parsed = StudentProgressSummarySchema.parse(doc) as Record<string, unknown>;
    expect(parsed.legacyExtra).toBe("keep-me");
  });
});

describe("ClassProgressSummarySchema — B8 timestamp round-trip", () => {
  it("collapses Firestore Timestamp objects to canonical ISO strings", () => {
    const parsed = ClassProgressSummarySchema.parse({
      id: "class-1",
      tenantId: "tenant-1",
      classId: "class-1",
      className: "Grade 10A",
      studentCount: 2,
      autograde: {
        averageClassScore: 61,
        examCompletionRate: 80,
        topPerformers: [{ studentId: "s1", name: "Alice", avgScore: 90 }],
        bottomPerformers: [{ studentId: "s2", name: "Bob", avgScore: 40 }],
      },
      levelup: {
        averageClassCompletion: 55,
        activeStudentRate: 100,
        topPointEarners: [{ studentId: "s1", name: "Alice", points: 200 }],
      },
      atRiskStudentIds: ["s2"],
      atRiskCount: 1,
      lastUpdatedAt: FS_TS,
    });
    expect(parsed.lastUpdatedAt).toBe(FS_TS_ISO);
  });
});

// ── Submission / Exam — legacy enum widen-on-read (AD-4 / AD-10) ────────────

function makeSubmission(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub-1",
    tenantId: "tenant-1",
    examId: "exam-1",
    studentId: "stu-1",
    studentName: "Alice",
    rollNumber: "R-01",
    classId: "class-1",
    answerSheets: {
      images: ["a.png"],
      uploadedAt: FS_TS,
      uploadedBy: "teacher-1",
      uploadSource: "gcs",
    },
    summary: {
      totalScore: 35,
      maxScore: 100,
      percentage: 35,
      grade: "D",
      questionsGraded: 5,
      totalQuestions: 5,
    },
    pipelineStatus: "ocr_processing",
    retryCount: 0,
    resultsReleased: false,
    createdAt: FS_TS,
    updatedAt: FS_TS_ISO,
    ...overrides,
  };
}

describe("SubmissionSchema — legacy reads", () => {
  it("widens legacy pipeline/upload values and collapses timestamps", () => {
    const parsed = SubmissionSchema.parse(makeSubmission());
    expect(parsed.pipelineStatus).toBe("scouting"); // ocr_processing → scouting
    expect(parsed.answerSheets.uploadSource).toBe("scanner"); // gcs → scanner
    expect(parsed.createdAt).toBe(FS_TS_ISO); // Timestamp object in
    expect(parsed.updatedAt).toBe(FS_TS_ISO); // ISO in — unchanged
  });

  it("accepts canonical grade letters and empty (pre-grading) grades", () => {
    expect(SubmissionSchema.parse(makeSubmission()).summary.grade).toBe("D");
    expect(
      SubmissionSchema.parse(
        makeSubmission({
          summary: {
            totalScore: 0,
            maxScore: 100,
            percentage: 0,
            grade: "",
            questionsGraded: 0,
            totalQuestions: 5,
          },
        })
      ).summary.grade
    ).toBe("");
  });

  it("rejects a non-letter grade value (never widen a write vocabulary)", () => {
    const result = SubmissionSchema.safeParse(
      makeSubmission({
        summary: {
          totalScore: 1,
          maxScore: 100,
          percentage: 1,
          grade: "Ungraded",
          questionsGraded: 5,
          totalQuestions: 5,
        },
      })
    );
    expect(result.success).toBe(false);
  });
});

describe("ExamSchema — legacy reads", () => {
  const exam = {
    id: "exam-1",
    tenantId: "tenant-1",
    title: "Algebra",
    subject: "Math",
    examDate: null,
    status: "completed",
    createdAt: FS_TS,
    updatedAt: FS_TS,
  };

  it("maps legacy 'completed' exam status to 'grading' on read (AD-10)", () => {
    expect(ExamSchema.parse(exam).status).toBe("grading");
  });

  it("keeps null examDate null", () => {
    expect(ExamSchema.parse(exam).examDate).toBeNull();
  });
});

describe("ExamQuestionSchema — B8 timestamps", () => {
  it("collapses timestamps to ISO", () => {
    const parsed = ExamQuestionSchema.parse({
      id: "q1",
      examId: "exam-1",
      text: "2+2?",
      maxMarks: 5,
      order: 1,
      createdAt: FS_TS,
      updatedAt: FS_TS,
    });
    expect(parsed.createdAt).toBe(FS_TS_ISO);
  });
});

// ── Boundary helpers ────────────────────────────────────────────────────────

describe("legacyMillis / legacyIso", () => {
  const ms = 1783209600000;

  it("collapses every legacy encoding to the same epoch millis", () => {
    expect(legacyMillis(FS_TS)).toBe(ms);
    expect(legacyMillis(FS_TS_ISO)).toBe(ms);
    expect(legacyMillis({ toMillis: () => ms })).toBe(ms);
    expect(legacyMillis(ms)).toBe(ms);
  });

  it("returns 0 for null/undefined/garbage (legacy sort fallback)", () => {
    expect(legacyMillis(null)).toBe(0);
    expect(legacyMillis(undefined)).toBe(0);
    expect(legacyMillis("not-a-date")).toBe(0);
    expect(legacyMillis({})).toBe(0);
  });

  it("legacyIso emits canonical ISO or null (wire responses)", () => {
    expect(legacyIso(FS_TS)).toBe(FS_TS_ISO);
    expect(legacyIso(FS_TS_ISO)).toBe(FS_TS_ISO);
    expect(legacyIso(null)).toBeNull();
    expect(legacyIso({})).toBeNull();
  });
});
