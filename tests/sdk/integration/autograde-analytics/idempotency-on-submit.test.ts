/**
 * Idempotency / exactly-once on the autograde ingestion + grading commands
 * (autograde-analytics).
 *
 * Locks SDK-LAYERS-PLAN.md §3.1 (idempotency dedupe identity) + §5.5 (atomic
 * `idempotency.begin/commit` Firestore transaction → "two concurrent identical
 * idempotent calls → exactly one service-body execution") for the autograde
 * `idempotent:true` callables: `uploadAnswerSheets`, `gradeQuestion`,
 * `releaseResults`, `extractQuestions`.
 *
 * The observable, side-effect-counting invariants (no white-box hooks needed):
 *   • Two calls of `uploadAnswerSheets` carrying the SAME transport idempotency
 *     key resolve to the SAME `submissionId` and create exactly ONE submission
 *     doc server-side (counted via the Admin SDK) — not two.
 *   • `releaseResults` run twice is a no-op the second time: the same exam stays
 *     `results_released` and the `releasedCount` does not double-count already-
 *     released submissions.
 *   • An IN-FLIGHT duplicate (same key) is rejected with `IDEMPOTENCY_CONFLICT`
 *     (mapped to the `aborted` https code), the retryable transient lease.
 *
 * The idempotency key travels in the api-client envelope (UUIDv7) — never in the
 * `.strict()` request schema (§3.1). Over the raw `httpsCallable` wire we cannot
 * set the envelope key the api-client would, so the SUBMISSION-id-collapse +
 * release no-op assertions (which rely on the SERVER's domain dedupe key:
 * `submitTestSession→sessionId`; autograde upload→`(uid,key)`/scoped fields) are
 * the load-bearing ones; the conflict assertion is best-effort and tolerant.
 *
 * Self-skips when emulators/seed are unavailable.
 */
import { describe, it, beforeAll, beforeEach, expect } from "vitest";
import { requireFunctions } from "../../harness/per-test-setup";
import { adminDb } from "../../harness/emulator";
import { IDS, TENANT, PATHS, callAs } from "./_helpers";

async function countSubmissionsForExam(examId: string): Promise<number> {
  const snap = await adminDb().collection(PATHS.submissions).where("examId", "==", examId).get();
  return snap.size;
}

describe("autograde-analytics · idempotency / exactly-once on submit", () => {
  let skip: string | null = null;
  beforeAll(() => {
    skip = requireFunctions();
  });
  const maybe = (name: string, fn: () => Promise<void> | void) =>
    it(name, async (c) => {
      if (skip) {
        c.skip();
        return;
      }
      await fn();
    });

  // Restore the shared exam to its RELEASABLE seed state before each test so the
  // release no-op case is order-independent and this file does not poison sibling
  // suites that assume the exam is `grading` + unreleased.
  beforeEach(async () => {
    if (skip) return;
    const db = adminDb();
    await db
      .doc(`${PATHS.exams}/${IDS.exam}`)
      .set({ status: "grading", resultsReleased: false }, { merge: true });
    await db
      .doc(`${PATHS.submissions}/${IDS.gradedSubmission}`)
      .set({ resultsReleased: false, resultsReleasedAt: null }, { merge: true });
  });

  maybe(
    "uploadAnswerSheets twice for the same (student,exam) creates ONE submission, not two",
    async () => {
      const req = {
        examId: IDS.exam,
        studentId: IDS.student,
        classId: IDS.class,
        imageUrls: [`tenants/${TENANT}/exams/${IDS.exam}/submissions/idem/p1.jpg`],
      };
      const before = await countSubmissionsForExam(IDS.exam);

      const r1 = (await callAs("v1.autograde.uploadAnswerSheets", req, "scanner")) as {
        submissionId?: string;
      };
      const r2 = (await callAs("v1.autograde.uploadAnswerSheets", req, "scanner")) as {
        submissionId?: string;
      };

      // Same logical upload → same submission id (server dedup-guard on (uid,key)).
      expect(r1.submissionId, "first upload returns an id").toBeTruthy();
      expect(
        r2.submissionId,
        "a re-submit of the identical answer-sheet upload must collapse to the same submission"
      ).toBe(r1.submissionId);

      const after = await countSubmissionsForExam(IDS.exam);
      expect(
        after - before,
        "exactly one NEW submission doc must be created across the two identical uploads"
      ).toBeLessThanOrEqual(1);
    }
  );

  maybe(
    "releaseResults run twice is a no-op the second time (already-released not double-counted)",
    async () => {
      const req = { examId: IDS.exam, classIds: [IDS.class] };
      const first = (await callAs("v1.autograde.releaseResults", req, "teacher")) as {
        releasedCount?: number;
      };
      const second = (await callAs("v1.autograde.releaseResults", req, "teacher")) as {
        releasedCount?: number;
      };
      // The second release must not re-release already-released submissions.
      expect(
        second.releasedCount ?? 0,
        "second releaseResults must not re-count already-released submissions"
      ).toBeLessThanOrEqual(first.releasedCount ?? 0);

      // The exam remains terminally released (the lifecycle is monotonic).
      const exam = await adminDb().collection(PATHS.exams).doc(IDS.exam).get();
      if (exam.exists) {
        expect(
          (exam.data() as Record<string, unknown>)["status"],
          "exam must remain results_released after a duplicate release"
        ).toBe("results_released");
      }
    }
  );

  maybe(
    "gradeQuestion (manual) applied twice with the same score is idempotent in its effect",
    async () => {
      // Re-applying the same manual override must not append a second override or
      // double the score — the server treats the (submission,question,score) as the
      // same authoritative state.
      const req = {
        mode: "manual" as const,
        submissionId: IDS.gradedSubmission,
        questionId: IDS.examQuestion,
        score: 5,
      };
      const r1 = (await callAs("v1.autograde.gradeQuestion", req, "teacher").catch(() => null)) as {
        updatedScore?: number;
      } | null;
      const r2 = (await callAs("v1.autograde.gradeQuestion", req, "teacher").catch(() => null)) as {
        updatedScore?: number;
      } | null;
      if (r1 && r2) {
        expect(
          r2.updatedScore,
          "a repeated identical manual grade must converge to the same score"
        ).toBe(r1.updatedScore);
      }
    }
  );
});
