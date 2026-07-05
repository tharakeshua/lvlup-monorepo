/**
 * Legacy enum READ-ADAPTERS — U1.1 (DATA-MODEL-FIX-PLAN §4, AD-4/AD-10).
 *
 * Locks the widen-on-read contract for every drifted enum:
 *   - each legacy value maps to its canonical target,
 *   - canonical values pass through unchanged,
 *   - junk is rejected,
 * plus a round-trip proving a legacy-shaped autograde submission doc parses via
 * the read schemas and re-serializes with canonical values only (a strict
 * canonical re-parse succeeds).
 */
import { describe, it, expect } from "vitest";
import { z } from "zod";
import { EXAM_STATUSES } from "../enums/exam.js";
import { SUBMISSION_PIPELINE_STATUSES } from "../enums/submission.js";
import { UPLOAD_SOURCES } from "../enums/misc.js";
import { STORY_POINT_TYPES } from "../enums/content.js";
import { TEST_SESSION_TYPES } from "../enums/test-session.js";
import { GRADE_LETTERS } from "../enums/grading.js";
import { GRADING_PIPELINE_STEPS } from "../entities/autograde/evaluation-settings.js";
import {
  normalizeExamStatus,
  zLegacyExamStatusRead,
  normalizeSubmissionPipelineStatus,
  zLegacySubmissionPipelineStatusRead,
  normalizeGradingPipelineStep,
  zLegacyGradingPipelineStepRead,
  normalizeUploadSource,
  zLegacyUploadSourceRead,
  normalizeStoryPointType,
  zLegacyStoryPointTypeRead,
  normalizeTestSessionType,
  zLegacyTestSessionTypeRead,
  normalizeGradeLetter,
  zLegacyGradeLetterRead,
} from "../enums/legacy.js";
import {
  SubmissionSchema,
  SubmissionSummarySchema,
  AnswerSheetDataSchema,
} from "../entities/autograde/submission.js";

describe("ExamStatus read-adapter (B1 — 'completed' → 'grading', AD-10)", () => {
  it("maps legacy 'completed' to 'grading' (NEVER 'results_released')", () => {
    expect(normalizeExamStatus("completed")).toBe("grading");
    expect(zLegacyExamStatusRead.parse("completed")).toBe("grading");
    expect(normalizeExamStatus("completed")).not.toBe("results_released");
  });
  it("passes every canonical status through unchanged", () => {
    for (const s of EXAM_STATUSES) expect(zLegacyExamStatusRead.parse(s)).toBe(s);
  });
  it("rejects junk", () => {
    expect(zLegacyExamStatusRead.safeParse("bogus").success).toBe(false);
  });
});

describe("SubmissionPipelineStatus read-adapter (B2 — 'ocr_*')", () => {
  it("maps ocr_processing → scouting, ocr_failed → scouting_failed", () => {
    expect(normalizeSubmissionPipelineStatus("ocr_processing")).toBe("scouting");
    expect(normalizeSubmissionPipelineStatus("ocr_failed")).toBe("scouting_failed");
    expect(zLegacySubmissionPipelineStatusRead.parse("ocr_processing")).toBe("scouting");
    expect(zLegacySubmissionPipelineStatusRead.parse("ocr_failed")).toBe("scouting_failed");
  });
  it("passes every canonical status through unchanged", () => {
    for (const s of SUBMISSION_PIPELINE_STATUSES)
      expect(zLegacySubmissionPipelineStatusRead.parse(s)).toBe(s);
  });
  it("rejects junk", () => {
    expect(zLegacySubmissionPipelineStatusRead.safeParse("ocr").success).toBe(false);
  });
});

describe("Grading/DLQ pipeline step read-adapter (B3 — 'ocr' → 'scouting')", () => {
  it("maps legacy 'ocr' to 'scouting'", () => {
    expect(normalizeGradingPipelineStep("ocr")).toBe("scouting");
    expect(zLegacyGradingPipelineStepRead.parse("ocr")).toBe("scouting");
  });
  it("passes every canonical step through unchanged", () => {
    for (const s of GRADING_PIPELINE_STEPS) expect(zLegacyGradingPipelineStepRead.parse(s)).toBe(s);
  });
  it("rejects junk", () => {
    expect(zLegacyGradingPipelineStepRead.safeParse("finalize").success).toBe(false);
  });
});

describe("UploadSource read-adapter (B4 — 'gcs' → 'scanner', keep 'rn')", () => {
  it("maps legacy 'gcs' to 'scanner'", () => {
    expect(normalizeUploadSource("gcs")).toBe("scanner");
    expect(zLegacyUploadSourceRead.parse("gcs")).toBe("scanner");
  });
  it("keeps 'rn' (mobile writes it) and every canonical source", () => {
    for (const s of UPLOAD_SOURCES) expect(zLegacyUploadSourceRead.parse(s)).toBe(s);
    expect(zLegacyUploadSourceRead.parse("rn")).toBe("rn");
  });
  it("rejects junk", () => {
    expect(zLegacyUploadSourceRead.safeParse("s3").success).toBe(false);
  });
});

describe("StoryPointType read-adapter (B6 — 'test' → 'timed_test')", () => {
  it("maps legacy 'test' to 'timed_test'", () => {
    expect(normalizeStoryPointType("test")).toBe("timed_test");
    expect(zLegacyStoryPointTypeRead.parse("test")).toBe("timed_test");
  });
  it("passes every canonical type through unchanged", () => {
    for (const s of STORY_POINT_TYPES) expect(zLegacyStoryPointTypeRead.parse(s)).toBe(s);
  });
  it("rejects junk", () => {
    expect(zLegacyStoryPointTypeRead.safeParse("quizz").success).toBe(false);
  });
});

describe("TestSessionType read-adapter (LVL-1 — 'test'/'exam' → 'timed_test')", () => {
  it("maps legacy 'test' AND 'exam' to 'timed_test' (never quiz/practice)", () => {
    expect(normalizeTestSessionType("test")).toBe("timed_test");
    expect(normalizeTestSessionType("exam")).toBe("timed_test");
    expect(zLegacyTestSessionTypeRead.parse("test")).toBe("timed_test");
    expect(zLegacyTestSessionTypeRead.parse("exam")).toBe("timed_test");
  });
  it("passes every canonical session type through unchanged", () => {
    for (const s of TEST_SESSION_TYPES) expect(zLegacyTestSessionTypeRead.parse(s)).toBe(s);
  });
  it("rejects junk", () => {
    expect(zLegacyTestSessionTypeRead.safeParse("mock").success).toBe(false);
  });
});

describe("GradeLetter read-adapter (B7 — string → typed 8-letter enum)", () => {
  it("validates a plain string into the enum (incl. 'C+')", () => {
    expect(normalizeGradeLetter("C+")).toBe("C+");
    expect(zLegacyGradeLetterRead.parse("A+")).toBe("A+");
  });
  it("accepts every canonical letter", () => {
    for (const g of GRADE_LETTERS) expect(zLegacyGradeLetterRead.parse(g)).toBe(g);
  });
  it("FAILS on an unknown letter — never guesses", () => {
    expect(zLegacyGradeLetterRead.safeParse("E").success).toBe(false);
    expect(zLegacyGradeLetterRead.safeParse("G").success).toBe(false);
    expect(() => normalizeGradeLetter("Z")).toThrow();
  });
});

describe("round-trip — a legacy-shaped autograde submission doc", () => {
  // A read schema for a whole legacy submission doc: canonical SubmissionSchema
  // with the drifted fields swapped for their widen-on-read adapters. Downstream
  // consumers (repositories, Phase-3 migrations) compose exactly this way.
  const LegacySubmissionReadSchema = SubmissionSchema.extend({
    pipelineStatus: zLegacySubmissionPipelineStatusRead,
    answerSheets: AnswerSheetDataSchema.extend({ uploadSource: zLegacyUploadSourceRead }),
    summary: SubmissionSummarySchema.extend({ grade: zLegacyGradeLetterRead }),
  });

  const legacyDoc = {
    id: "submission_sub1",
    examId: "exam_e1",
    studentId: "student_s1",
    studentName: "Ada Lovelace",
    rollNumber: "SUB001",
    classId: "class_c1",
    answerSheets: {
      images: ["gs://bucket/page1.png"],
      uploadedAt: "2026-01-01T00:00:00.000Z",
      uploadedBy: "user_u1",
      uploadSource: "gcs", // legacy
    },
    summary: {
      totalScore: 88,
      maxScore: 100,
      percentage: 88,
      grade: "A", // legacy stored as free string
      questionsGraded: 5,
      totalQuestions: 5,
      completedAt: "2026-01-01T00:05:00.000Z",
    },
    pipelineStatus: "ocr_processing", // legacy
    resultsReleased: false,
    resultsReleasedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:05:00.000Z",
  };

  it("parses via the read schema and normalizes legacy values", () => {
    const parsed = LegacySubmissionReadSchema.parse(legacyDoc);
    expect(parsed.pipelineStatus).toBe("scouting");
    expect(parsed.answerSheets.uploadSource).toBe("scanner");
    expect(parsed.summary.grade).toBe("A");
  });

  it("re-serializes with canonical values only (strict canonical re-parse succeeds)", () => {
    const parsed = LegacySubmissionReadSchema.parse(legacyDoc);
    // The normalized object must satisfy the strict write schema — no legacy leaks.
    expect(() => SubmissionSchema.parse(parsed)).not.toThrow();
    // And a strict re-parse of the ORIGINAL legacy doc must FAIL (proves the
    // strict schema still guards the write path — we never widened it).
    expect(SubmissionSchema.safeParse(legacyDoc).success).toBe(false);
  });
});

// Guard: the module exports NO lenient write schema — read adapters only.
describe("no lenient write schema is exported", () => {
  it("canonical write schemas still reject legacy values (unchanged)", () => {
    expect(z.enum(EXAM_STATUSES).safeParse("completed").success).toBe(false);
    expect(z.enum(SUBMISSION_PIPELINE_STATUSES).safeParse("ocr_processing").success).toBe(false);
    expect(z.enum(UPLOAD_SOURCES).safeParse("gcs").success).toBe(false);
    expect(z.enum(STORY_POINT_TYPES).safeParse("test").success).toBe(false);
  });
});
