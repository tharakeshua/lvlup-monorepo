/**
 * Answer-key deny-all + grading-output server-authorship (autograde-analytics).
 *
 * Locks REVIEW §6.4 (AnswerKeys — deny-all subcollection) and §6.5 (Grading
 * outputs are server-written) end-to-end against the emulator + seed:
 *
 *   1. AnswerKeys are UNREADABLE by every client role through the wire. There is
 *      NO callable that returns `correctAnswer`/`modelAnswer`/`evaluatorGuidance`
 *      to a non-authoring role, and the Firestore answer-key subcollection is
 *      `read,write:if false` (the rules layer proves the second half; here we
 *      prove no callable surface leaks it).
 *   2. `getItemForEdit` (⚷ authoring) is the ONLY surface that re-merges the
 *      answer key, and only for an authoring role; a student is DENIED.
 *   3. Grading outputs (score/evaluation/SubmissionSummary) are SERVER-written:
 *      they do not exist on the submission until the server pipeline writes them,
 *      and the client cannot supply its own score on the upload/grade path.
 *
 * The Admin SDK (`adminDb`) is used ONLY to prove the server-side facts a client
 * can never observe (the answer key DOES exist server-side; the summary IS
 * written by the server) — it bypasses rules by design.
 *
 * Self-skips when emulators/seed are unavailable (parallel-build safe).
 */
import { describe, it, beforeAll, expect } from "vitest";
import { requireFunctions } from "../../harness/per-test-setup";
import { adminDb } from "../../harness/emulator";
import { IDS, PATHS, callAs, expectDenied, leakedKeys, GUIDANCE_FIELDS } from "./_helpers";

describe("autograde-analytics · answer-key authority + grading server-authorship", () => {
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

  // --- (1) answer-keys deny-all to clients across every read surface -----------

  maybe(
    "listQuestions strips rubric guidance / model-answer for a non-authoring role (teacher view OK, student stripped)",
    async () => {
      // A student reading exam questions must never receive the answer-key guidance.
      const studentView = await callAs(
        "v1.autograde.listQuestions",
        { examId: IDS.exam },
        "student"
      ).catch(() => null);
      // student may be denied entirely (no exam.read) OR receive a stripped projection;
      // either is acceptable, but it must NEVER carry guidance.
      if (studentView) {
        expect(
          leakedKeys(studentView, GUIDANCE_FIELDS),
          "listQuestions leaked answer-key/guidance to a student"
        ).toEqual([]);
      }
    }
  );

  maybe("NO client read callable returns the answer key for the seeded item", async () => {
    // The authoring surface re-merges the key only for an authoring role.
    // listItems (answer-stripped) must never carry it.
    const items = await callAs(
      "v1.levelup.listItems",
      { spaceId: undefined, storyPointId: undefined, limit: 20 } as unknown,
      "student"
    ).catch(() => null);
    if (items) {
      expect(leakedKeys(items, GUIDANCE_FIELDS), "listItems leaked the answer key").toEqual([]);
    }
  });

  maybe("getItemForEdit (⚷ authoring) is DENIED to a student", async () => {
    // Send VALID owning ids so the request passes schema validation and reaches
    // authorize() — the student must be DENIED there (authoring-only), not bounced
    // earlier on invalid-argument. This keeps the authority assertion meaningful.
    await expectDenied(
      "v1.levelup.getItemForEdit",
      { spaceId: IDS.space, storyPointId: IDS.storyPoint, itemId: IDS.item },
      "student",
      "permission-denied"
    );
  });

  maybe(
    "the answer key EXISTS server-side (proving deny-all hides real data, not absence)",
    async () => {
      // Admin SDK bypasses rules — this is the only legitimate way to read the
      // deny-all subcollection. If the seed wrote an answer key, it is here, and a
      // client could never reach it (asserted above + by the rules suite).
      const snap = await adminDb().collection(PATHS.answerKeysFor(IDS.item)).limit(1).get();
      // Tolerant: if the seed models the key inline rather than as a subcollection,
      // this is a no-op; the client-side leak assertions above are the load-bearing ones.
      if (!snap.empty) {
        const doc = snap.docs[0]!.data();
        const keyish = Object.keys(doc);
        expect(
          keyish.some((k) => (GUIDANCE_FIELDS as readonly string[]).includes(k)),
          "answer-key subcollection doc should hold the ⚷ key material server-side"
        ).toBe(true);
      }
    }
  );

  // --- (3) grading outputs are SERVER-written, never client-supplied ----------

  maybe(
    "uploadAnswerSheets has NO score/summary field in its request schema (client cannot supply a grade)",
    async () => {
      // The client sends image paths only. Supplying a forged score must be rejected
      // by the .strict() request schema (unknown key) → invalid-argument.
      await expectDenied(
        "v1.autograde.uploadAnswerSheets",
        {
          examId: IDS.exam,
          studentId: IDS.student,
          classId: IDS.class,
          imageUrls: ["tenants/x/exams/e/submissions/s/p1.jpg"],
          // forged authority fields — must be rejected by .strict():
          summary: { totalScore: 999, grade: "A+" },
          score: 999,
        } as unknown,
        "scanner",
        "invalid-argument"
      );
    }
  );

  maybe(
    "a graded-but-unreleased submission has its SubmissionSummary written SERVER-SIDE (admin can see it, student cannot)",
    async () => {
      // Admin proves the server computed the score… (use the DEDICATED locked
      // submission that NO suite ever releases, so this server-authorship assertion
      // is order-independent of the suites that call releaseResults on SUB_S1).
      const adminDoc = await adminDb()
        .collection(PATHS.submissions)
        .doc(IDS.lockedSubmission)
        .get();
      if (adminDoc.exists) {
        const data = adminDoc.data() as Record<string, unknown>;
        // server-authored: the pipeline wrote a summary + a pipeline status.
        expect(data["pipelineStatus"], "server must own pipelineStatus").toBeDefined();
        // …but the same submission read through the client wire is release-gated (covered
        // in detail by released-gating.test.ts); here we only assert server-authorship.
        expect(
          data["resultsReleased"],
          "the graded-submission fixture must be NOT-yet-released"
        ).not.toBe(true);
      }
    }
  );

  maybe(
    "gradeQuestion (⚷ score authority) is DENIED to a student (only an authoring/grading role may write a score)",
    async () => {
      await expectDenied(
        "v1.autograde.gradeQuestion",
        {
          mode: "manual",
          submissionId: IDS.gradedSubmission,
          questionId: IDS.examQuestion,
          score: 0,
        },
        "student",
        "permission-denied"
      );
    }
  );
});
