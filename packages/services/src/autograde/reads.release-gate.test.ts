/**
 * AG-7 — listQuestionSubmissions release gate withholds EVERY score-bearing field.
 *
 * Live E2E evidence showed the pre-release projection deleted ONLY `evaluation`,
 * leaking `manualOverride` (per-question score + the teacher's override reason)
 * and `gradingError` to students before results were released. These lock the
 * §6.10 stripped projection for the question-submission path:
 *
 *   - PRE-release, a non-authoring owner (student / linked parent) sees NONE of
 *     `evaluation` / `manualOverride` / `gradingError` — but the read is NOT
 *     denied (`mapping` + `gradingStatus` remain so "results pending" renders).
 *   - POST-release, the owner sees all three.
 *   - A teacher sees all three regardless of release state.
 *   - ⚷ cost telemetry (`tokensUsed`/`costUsd`) inside `evaluation` never reaches
 *     ANY client view (the `stripEvaluationCost` helper only catches the legacy
 *     `tokenUsage` alias — the mapper must not emit the renamed field at all).
 */
import { describe, it, expect } from "vitest";
import { getCallable } from "@levelup/api-contract";
import { makeAuthContext } from "../../../../tests/sdk/harness/auth-context";
import { listQuestionSubmissionsService } from "./reads";

const TS = "2026-01-01T00:00:00.000Z";

/** Stored evaluation carrying ⚷ cost telemetry that must never leave the server. */
const EVALUATION = {
  score: 3,
  maxScore: 5,
  correctness: 0.6,
  percentage: 60,
  strengths: ["clear method"],
  weaknesses: ["arithmetic slip"],
  missingConcepts: [],
  summary: "Mostly correct working, minor slip.",
  confidence: 0.9,
  tokensUsed: 1234,
  costUsd: 0.004,
  gradedAt: TS,
};

/** The exact shape the live leak exposed: score + teacher reason, pre-release. */
const MANUAL_OVERRIDE = {
  score: 4,
  reason: "method credit for the correct setup",
  overriddenBy: "uid_teacher",
  overriddenAt: TS,
  originalScore: 3,
};

async function seedSubmission(released: boolean) {
  const teacher = makeAuthContext("teacher");
  const student = makeAuthContext("student", { repos: teacher.repos });
  const parent = makeAuthContext("parent", { repos: teacher.repos });
  const tenantId = teacher.tenantId!;
  await teacher.repos.submissions.upsert(tenantId, {
    id: "sub_gate",
    examId: "exam_gate",
    studentId: student.entityIds.studentId!,
    studentName: "Sam",
    rollNumber: "R1",
    classId: teacher.classIds[0],
    answerSheets: {
      images: ["tenants/t/exams/e/sheets/s1.jpg"],
      uploadedAt: TS,
      uploadedBy: "uid_uploader",
      uploadSource: "web",
    },
    summary: {
      totalScore: 3,
      maxScore: 5,
      percentage: 60,
      grade: "B",
      questionsGraded: 1,
      totalQuestions: 1,
      completedAt: TS,
    },
    pipelineStatus: "reviewed",
    retryCount: 0,
    resultsReleased: released,
    resultsReleasedAt: released ? TS : null,
    createdAt: TS,
    updatedAt: TS,
  });
  await teacher.repos.submissions.upsert(tenantId, {
    id: "qsub_gate_1",
    _kind: "questionSubmission",
    submissionId: "sub_gate",
    questionId: "q_1",
    examId: "exam_gate",
    mapping: { pageIndices: [0], imageUrls: ["p0.jpg"], scoutedAt: TS },
    evaluation: EVALUATION,
    gradingStatus: "overridden",
    gradingError: "gemini timeout on attempt 1",
    manualOverride: MANUAL_OVERRIDE,
    createdAt: TS,
    updatedAt: TS,
  });
  return { teacher, student, parent };
}

const RESPONSE_SCHEMA = () => getCallable("v1.autograde.listQuestionSubmissions").responseSchema;

describe("AG-7 — listQuestionSubmissions pre-release stripped projection (§6.10)", () => {
  it("PRE-release: the student owner sees NO evaluation/manualOverride/gradingError", async () => {
    const { student } = await seedSubmission(false);
    const res = await listQuestionSubmissionsService({ submissionId: "sub_gate" }, student);
    const qs = res.questionSubmissions.find((q) => q.id === "qsub_gate_1")! as Record<
      string,
      unknown
    >;
    expect(qs).toBeDefined();
    expect("evaluation" in qs).toBe(false);
    expect("manualOverride" in qs).toBe(false);
    expect("gradingError" in qs).toBe(false);
    // The read is stripped, NOT denied — process state still renders "pending".
    expect(qs["gradingStatus"]).toBe("overridden");
    expect((qs["mapping"] as Record<string, unknown>)["imageUrls"]).toEqual(["p0.jpg"]);
    expect(RESPONSE_SCHEMA().safeParse(res).success).toBe(true);
  });

  it("PRE-release: a linked parent is stripped the same way", async () => {
    const { parent } = await seedSubmission(false);
    const res = await listQuestionSubmissionsService({ submissionId: "sub_gate" }, parent);
    const qs = res.questionSubmissions[0] as Record<string, unknown>;
    expect("evaluation" in qs).toBe(false);
    expect("manualOverride" in qs).toBe(false);
    expect("gradingError" in qs).toBe(false);
    expect(RESPONSE_SCHEMA().safeParse(res).success).toBe(true);
  });

  it("POST-release: the student owner sees all three (evaluation cost-stripped)", async () => {
    const { student } = await seedSubmission(true);
    const res = await listQuestionSubmissionsService({ submissionId: "sub_gate" }, student);
    const qs = res.questionSubmissions.find((q) => q.id === "qsub_gate_1")! as Record<
      string,
      unknown
    >;
    const ev = qs["evaluation"] as Record<string, unknown>;
    expect(ev["score"]).toBe(3);
    expect((qs["manualOverride"] as Record<string, unknown>)["score"]).toBe(4);
    expect((qs["manualOverride"] as Record<string, unknown>)["reason"]).toBe(
      MANUAL_OVERRIDE.reason
    );
    expect(qs["gradingError"]).toBe("gemini timeout on attempt 1");
    // ⚷ cost telemetry never reaches a client view — released or not.
    expect("tokensUsed" in ev).toBe(false);
    expect("costUsd" in ev).toBe(false);
    expect(RESPONSE_SCHEMA().safeParse(res).success).toBe(true);
  });

  it("teacher ALWAYS sees all three, even pre-release (evaluation cost-stripped)", async () => {
    const { teacher } = await seedSubmission(false);
    const res = await listQuestionSubmissionsService({ submissionId: "sub_gate" }, teacher);
    const qs = res.questionSubmissions.find((q) => q.id === "qsub_gate_1")! as Record<
      string,
      unknown
    >;
    const ev = qs["evaluation"] as Record<string, unknown>;
    expect(ev["score"]).toBe(3);
    expect((qs["manualOverride"] as Record<string, unknown>)["originalScore"]).toBe(3);
    expect(qs["gradingError"]).toBe("gemini timeout on attempt 1");
    expect("tokensUsed" in ev).toBe(false);
    expect("costUsd" in ev).toBe(false);
    expect(RESPONSE_SCHEMA().safeParse(res).success).toBe(true);
  });
});
