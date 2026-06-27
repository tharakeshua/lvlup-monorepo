/**
 * Result release-gating (autograde-analytics).
 *
 * Locks REVIEW §6.10 (`resultsReleased` visibility gate) + the autograde
 * domain plan's read-projection services (`listQuestionSubmissionsService`,
 * `getSubmissionService`: "enforces resultsReleased gate for student/parent;
 * full for teacher"):
 *
 *   • TEACHER (authoring role over the class) sees the FULL projection — score,
 *     evaluation, summary — for a graded submission EVEN BEFORE release.
 *   • STUDENT (owner) reading their OWN graded-but-unreleased submission gets a
 *     stripped projection: NO totalScore / grade / percentage / summary /
 *     per-question evaluation.
 *   • PARENT (linked to the owning student) gets the SAME stripped projection
 *     before release (parent-gate × released-gate intersection — MERGE-PARENT-GATE).
 *   • After `releaseResults` flips the gate, the owner/parent projection DOES
 *     carry the score (the gate is the only thing that was withholding it).
 *   • `listQuestionSubmissions` carries the SAME gate AND never returns the
 *     answer key, for every role.
 *
 * These assert the SERVER projection (the authority side), not a client filter:
 * the score is withheld by the server even though the caller owns the row.
 *
 * Self-skips when emulators/seed are unavailable.
 */
import { describe, it, beforeAll, beforeEach, afterAll, expect } from "vitest";
import { requireFunctions } from "../../harness/per-test-setup";
import { adminDb } from "../../harness/emulator";
import { localSeedId } from "../../harness/fixtures-ids";
import { IDS, PATHS, callAs, leakedKeys, RELEASE_GATED_FIELDS, GUIDANCE_FIELDS } from "./_helpers";

// DEDICATED exam + submissions owned by THIS suite alone (seeded by contract-seed).
// Because this file is the ONLY one that calls `releaseResults` on / reads these ids,
// it cannot be poisoned by — nor poison — the sibling autograde suites (which release
// & re-grade EXAM_MID/SUB_S1) or the async analytics triggers that fire on release.
const RG = {
  exam: localSeedId("exam", "rg"),
  /** A graded-but-unreleased submission this file flips via `releaseResults`. */
  gradedSubmission: localSeedId("submission", "rg"),
  /** A permanently-locked graded submission for the pre-release strip assertions. */
  lockedSubmission: `${localSeedId("submission", "rg")}_locked`,
} as const;

describe("autograde-analytics · resultsReleased gating", () => {
  let skip: string | null = null;
  beforeAll(() => {
    skip = requireFunctions();
  });

  // This file's last case calls `releaseResults`, which flips the dedicated exam +
  // submission to released. Restore the UNRELEASED state of EVERY entity this file
  // reads before each test so the cases are fully order-independent.
  const resetUnreleased = async () => {
    const db = adminDb();
    // Exam → RELEASABLE state (`grading`, unreleased) so `after releaseResults` works.
    await db
      .doc(`${PATHS.exams}/${RG.exam}`)
      .set({ status: "grading", resultsReleased: false }, { merge: true });
    // BOTH submissions the file reads (graded + locked) → unreleased, terminal
    // 'ready_for_review' (a RELEASABLE status whose state-machine trigger is a
    // no-op, so this reset never re-fires `finalizeSubmission`).
    for (const id of [RG.gradedSubmission, RG.lockedSubmission]) {
      await db
        .doc(`${PATHS.submissions}/${id}`)
        .set(
          { resultsReleased: false, resultsReleasedAt: null, pipelineStatus: "ready_for_review" },
          { merge: true }
        );
    }
  };

  beforeEach(async () => {
    if (skip) return;
    await resetUnreleased();
  });

  // Belt-and-suspenders: leave the dedicated entities unreleased when the file ends.
  afterAll(async () => {
    if (skip) return;
    await resetUnreleased();
  });
  const maybe = (name: string, fn: () => Promise<void> | void) =>
    it(name, async (c) => {
      if (skip) {
        c.skip();
        return;
      }
      await fn();
    });

  // --- getSubmission projection by role, BEFORE release -----------------------

  maybe("teacher sees the FULL submission (score/summary present) before release", async () => {
    const full = await callAs("v1.autograde.getSubmission", { id: RG.gradedSubmission }, "teacher");
    // The teacher view is the authoritative full view: at least one score-bearing
    // field must be present (otherwise the gate is over-stripping for the grader).
    const present = leakedKeys(full, RELEASE_GATED_FIELDS);
    expect(
      present.length,
      "teacher must see the full graded projection (summary/score) pre-release"
    ).toBeGreaterThan(0);
  });

  maybe(
    "student (owner) gets a STRIPPED projection before release — no score/grade/summary",
    async () => {
      const view = await callAs(
        "v1.autograde.getSubmission",
        { id: RG.lockedSubmission },
        "student"
      );
      expect(
        leakedKeys(view, RELEASE_GATED_FIELDS),
        "getSubmission leaked release-gated score/grade to the owning student pre-release"
      ).toEqual([]);
    }
  );

  maybe(
    "parent (linked) gets the SAME stripped projection before release (parent-gate × released-gate)",
    async () => {
      const view = await callAs(
        "v1.autograde.getSubmission",
        { id: RG.lockedSubmission },
        "parent"
      );
      expect(
        leakedKeys(view, RELEASE_GATED_FIELDS),
        "getSubmission leaked release-gated fields to a linked parent pre-release"
      ).toEqual([]);
    }
  );

  // --- listQuestionSubmissions: released-gate + answer-key strip, every role --

  maybe(
    "listQuestionSubmissions strips per-question evaluation/score for the student pre-release",
    async () => {
      const view = await callAs(
        "v1.autograde.listQuestionSubmissions",
        { submissionId: RG.lockedSubmission },
        "student"
      );
      expect(
        leakedKeys(view, RELEASE_GATED_FIELDS),
        "listQuestionSubmissions leaked evaluation/score to a student pre-release"
      ).toEqual([]);
    }
  );

  maybe(
    "listQuestionSubmissions NEVER returns the answer key / rubric guidance to ANY role",
    async () => {
      for (const role of ["teacher", "student", "parent"] as const) {
        const view = await callAs(
          "v1.autograde.listQuestionSubmissions",
          { submissionId: RG.gradedSubmission },
          role
        ).catch(() => null);
        if (view) {
          expect(
            leakedKeys(view, GUIDANCE_FIELDS),
            `listQuestionSubmissions leaked answer-key/guidance to ${role}`
          ).toEqual([]);
        }
      }
    }
  );

  maybe(
    "teacher sees per-question evaluation in listQuestionSubmissions (full grader view)",
    async () => {
      const view = await callAs(
        "v1.autograde.listQuestionSubmissions",
        { submissionId: RG.gradedSubmission },
        "teacher"
      );
      // The grader must see the evaluation it is reviewing.
      expect(
        leakedKeys(view, ["evaluation", "score"]),
        "teacher (grader) should see per-question evaluation/score"
      ).not.toEqual([]);
    }
  );

  // --- the gate is the ONLY thing withholding the score (release flips it) -----

  maybe(
    "after releaseResults, the owning student CAN see the score (gate was the only withholder)",
    async () => {
      // Release as the teacher (authoritative lifecycle write — never optimistic).
      await callAs(
        "v1.autograde.releaseResults",
        { examId: RG.exam, classIds: [IDS.class] },
        "teacher"
      );
      const afterRelease = await callAs(
        "v1.autograde.getSubmission",
        { id: RG.gradedSubmission },
        "student"
      );
      // Now the owner's projection carries the score that was previously stripped.
      expect(
        leakedKeys(afterRelease, RELEASE_GATED_FIELDS).length,
        "after release the owning student should see the previously-gated score"
      ).toBeGreaterThan(0);
      // …but STILL never the answer-key guidance.
      expect(
        leakedKeys(afterRelease, GUIDANCE_FIELDS),
        "release must NOT also leak the answer key"
      ).toEqual([]);
    }
  );

  // --- cross-ownership denial: a student cannot read a DIFFERENT student's row -

  maybe(
    "a student is DENIED reading another student-scoped submission via filter (cross-ownership)",
    async () => {
      // listSubmissions filtered to a submission the caller does not own must not
      // return it (server scopes student→own). We assert via an empty / scoped page.
      const page = (await callAs(
        "v1.autograde.listSubmissions",
        { limit: 20, filter: { examId: RG.exam, studentId: IDS.studentOther } },
        "student"
      ).catch(() => ({ items: [] }))) as { items?: unknown[] };
      expect(
        (page.items ?? []).length,
        "a student must not list another student’s submissions"
      ).toBe(0);
    }
  );
});
