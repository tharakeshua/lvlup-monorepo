/**
 * AG-5 — autograde live-ticker RTDB projection producer tests (AD-12).
 *
 * Locks the two invariants the realtime authority design depends on:
 *   1. SLIM PAYLOAD: the per-submission `status` projection carries ONLY
 *      `{ pipelineStatus, gradingProgress?, updatedAt }` — never a score / grade /
 *      percentage / summary / answer-key / rubric-guidance field (release-gate).
 *      This is asserted even through `finalizeSubmissionService`, which DOES compute
 *      a full graded summary — none of it may leak onto the live channel.
 *   2. IDEMPOTENCY: re-applying the same transition yields identical projections
 *      (per-submission last-write-wins; exam aggregate reduced from the `_index`
 *      map, so a repeated `(submissionId, phase)` is a no-op).
 *
 * The RTDB writer port is injected as a spy on `ctx.repos.gradingProjections` (the
 * seam FIX-2 wires to the concrete Admin-RTDB adapter in prod) — so these are pure,
 * emulator-free service-unit tests.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { makeSystemContext } from "../../../../../tests/sdk/harness/auth-context";
import { createInMemoryRepos } from "../../../../../tests/sdk/fakes/in-memory-repos";
import {
  bucketForPhase,
  reduceExamCounts,
  projectSubmissionStatus,
  type GradingProjectionPort,
  type SubmissionStatusProjection,
  type ExamGradingAggregate,
} from "./grading-projection";
import { finalizeSubmissionService } from "./finalize-submission";

const TENANT = "tenant_contract";
const NOW = "2026-01-01T00:00:00.000Z";

/** The ONLY keys allowed on the per-submission `status` leaf (strict payload). */
const ALLOWED_STATUS_KEYS = new Set(["pipelineStatus", "gradingProgress", "updatedAt"]);
/** Keys that would be a release-gate / answer-key LEAK if they ever appeared. */
const FORBIDDEN_STATUS_KEYS = [
  "summary",
  "totalScore",
  "maxScore",
  "grade",
  "percentage",
  "score",
  "answerKey",
  "answerKeys",
  "rubric",
  "evaluation",
  "feedback",
  "studentId",
];

/**
 * In-memory spy implementing the RTDB projection port. Captures every
 * per-submission `status` write and maintains the exam `_index` map so the
 * aggregate is derived through the real `reduceExamCounts` (idempotency proof).
 */
function makeSpyPort() {
  const submissionWrites: Array<{
    submissionId: string;
    ownerStudentId: string;
    status: SubmissionStatusProjection;
  }> = [];
  const examIndex = new Map<string, Record<string, string>>();
  const examAgg = new Map<string, ExamGradingAggregate>();

  const port: GradingProjectionPort = {
    async setSubmissionStatus(_tenantId, submissionId, input) {
      submissionWrites.push({ submissionId, ...input });
    },
    async recordExamPhase(_tenantId, examId, submissionId, phase, now) {
      const idx = examIndex.get(examId) ?? {};
      idx[submissionId] = phase;
      examIndex.set(examId, idx);
      examAgg.set(examId, reduceExamCounts(examId, idx, now));
    },
  };
  return {
    port,
    submissionWrites,
    lastSubmissionWrite: () => submissionWrites[submissionWrites.length - 1],
    aggFor: (examId: string) => examAgg.get(examId),
  };
}

/** ctx whose repos carry the injected projection spy. */
function ctxWithPort(spy: ReturnType<typeof makeSpyPort>) {
  const repos = createInMemoryRepos({ now: () => NOW });
  (repos as unknown as { gradingProjections: GradingProjectionPort }).gradingProjections = spy.port;
  return makeSystemContext(TENANT, { repos, clockIso: NOW });
}

describe("AG-5 grading-projection — pure classification", () => {
  it("buckets phases into graded / failed / pending", () => {
    expect(bucketForPhase("grading_complete")).toBe("graded");
    expect(bucketForPhase("ready_for_review")).toBe("graded");
    expect(bucketForPhase("reviewed")).toBe("graded");
    expect(bucketForPhase("grading_failed")).toBe("failed");
    expect(bucketForPhase("manual_review_needed")).toBe("failed");
    expect(bucketForPhase("failed")).toBe("failed");
    expect(bucketForPhase("uploaded")).toBe("pending");
    expect(bucketForPhase("scouting")).toBe("pending");
    expect(bucketForPhase("grading")).toBe("pending");
    expect(bucketForPhase("grading_partial")).toBe("pending");
  });

  it("reduceExamCounts sums bounded counts and is idempotent on the same index", () => {
    const index = { s1: "ready_for_review", s2: "grading", s3: "grading_failed" };
    const a = reduceExamCounts("exam1", index, NOW);
    expect(a).toMatchObject({
      examId: "exam1",
      totalSubmissions: 3,
      gradedSubmissions: 1,
      failedSubmissions: 1,
      pendingSubmissions: 1,
      updatedAt: NOW,
    });
    // Recompute over the identical map → byte-identical aggregate (idempotent).
    expect(reduceExamCounts("exam1", { ...index }, NOW)).toEqual(a);
  });
});

describe("AG-5 grading-projection — projectSubmissionStatus (slim + gated)", () => {
  let spy: ReturnType<typeof makeSpyPort>;
  beforeEach(() => {
    spy = makeSpyPort();
  });

  it("writes ONLY the slim status fields + the ownerStudentId gate sibling", async () => {
    const ctx = ctxWithPort(spy);
    await projectSubmissionStatus(ctx, TENANT, {
      submissionId: "sub1",
      examId: "exam1",
      studentId: "student_amy",
      pipelineStatus: "grading",
      gradingProgress: { graded: 2, total: 5, batchIndex: 2 },
    });
    const w = spy.lastSubmissionWrite();
    expect(w.submissionId).toBe("sub1");
    // Gate metadata lives OUTSIDE the client-read status leaf.
    expect(w.ownerStudentId).toBe("student_amy");
    // The status leaf carries only the slim, release-safe fields.
    expect(new Set(Object.keys(w.status)).size).toBeLessThanOrEqual(3);
    for (const k of Object.keys(w.status)) expect(ALLOWED_STATUS_KEYS.has(k)).toBe(true);
    for (const k of FORBIDDEN_STATUS_KEYS) expect(k in w.status).toBe(false);
    expect(w.status.pipelineStatus).toBe("grading");
    expect(w.status.gradingProgress).toEqual({ graded: 2, total: 5, batchIndex: 2 });
    expect(w.status.updatedAt).toBe(NOW);
  });

  it("omits gradingProgress when none is supplied (status-only tick)", async () => {
    const ctx = ctxWithPort(spy);
    await projectSubmissionStatus(ctx, TENANT, {
      submissionId: "sub1",
      examId: "exam1",
      studentId: "student_amy",
      pipelineStatus: "scouting_complete",
    });
    const w = spy.lastSubmissionWrite();
    expect("gradingProgress" in w.status).toBe(false);
    expect(Object.keys(w.status).sort()).toEqual(["pipelineStatus", "updatedAt"]);
  });

  it("bumps the exam aggregate and is idempotent on a repeated transition", async () => {
    const ctx = ctxWithPort(spy);
    const tick = () =>
      projectSubmissionStatus(ctx, TENANT, {
        submissionId: "sub1",
        examId: "exam1",
        studentId: "student_amy",
        pipelineStatus: "ready_for_review",
      });
    await tick();
    const first = spy.aggFor("exam1");
    await tick(); // replay same transition
    expect(spy.aggFor("exam1")).toEqual(first);
    expect(first).toMatchObject({
      totalSubmissions: 1,
      gradedSubmissions: 1,
      pendingSubmissions: 0,
      failedSubmissions: 0,
    });
  });

  it("no-ops (never throws) when the projection port is not wired", async () => {
    const ctx = makeSystemContext(TENANT, { clockIso: NOW }); // no gradingProjections
    await expect(
      projectSubmissionStatus(ctx, TENANT, {
        submissionId: "sub1",
        examId: "exam1",
        studentId: "student_amy",
        pipelineStatus: "grading",
      })
    ).resolves.toBeUndefined();
  });
});

describe("AG-5 grading-projection — finalize never leaks the graded summary", () => {
  it("projects ready_for_review with NO score/grade even though finalize computed one", async () => {
    const spy = makeSpyPort();
    const ctx = ctxWithPort(spy);
    // Seed the exam + a submission ready to finalize + a confirmed graded question.
    await ctx.repos.exams.upsert(TENANT, { id: "exam1", totalMarks: 10, passingMarks: 4 }, NOW);
    await ctx.repos.submissions.upsert(
      TENANT,
      { id: "sub1", examId: "exam1", studentId: "student_amy", pipelineStatus: "grading_complete" },
      NOW
    );
    await ctx.repos.submissions.upsert(
      TENANT,
      {
        submissionId: "sub1",
        examId: "exam1",
        gradingStatus: "graded",
        evaluation: { score: 9, maxScore: 10 },
        _kind: "questionSubmission",
      },
      NOW
    );

    await finalizeSubmissionService({ submissionId: "sub1" }, ctx);

    const w = spy.lastSubmissionWrite();
    expect(w.status.pipelineStatus).toBe("ready_for_review");
    // The computed summary (score 9 / grade / percentage) MUST NOT ride the channel.
    for (const k of FORBIDDEN_STATUS_KEYS) expect(k in w.status).toBe(false);
    expect(Object.keys(w.status).sort()).toEqual(["pipelineStatus", "updatedAt"]);
    // Exam aggregate counts the now-graded submission.
    expect(spy.aggFor("exam1")).toMatchObject({ gradedSubmissions: 1, totalSubmissions: 1 });
  });
});
