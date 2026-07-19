/**
 * EXAM-SPACE-INTEGRATION MVP §D — practice-from-mistakes assignment (STUB).
 *
 * Future verb: after results are released and reconciled into the linked space,
 * auto-assign a filtered practice set (wrong / below-threshold questions only)
 * and optionally attach a per-student results PDF when the payload is small enough.
 *
 * TODO(exam-space-integration):
 *   - `v1.autograde.assignPracticeFromMistakes` callable + Zod contract
 *   - filter questionSubmissions by score/correctness thresholds
 *   - enqueue PDF generation via analytics `generateReport` when under size cap
 *   - skip PDF with a teacher-visible "report too large" flag when over cap
 *
 * Not wired in sdk-v1 yet — reconciliation + manual reattempt in the linked
 * practice space is the shipped MVP path.
 */
export type PracticeFromMistakesStub = {
  examId: string;
  studentId: string;
  /** Linked practice space from `createSpaceFromExamService`. */
  spaceId: string;
};

/** Placeholder export so the stub module is discoverable in the services barrel. */
export const PRACTICE_FROM_MISTAKES_TODO =
  "assignPracticeFromMistakes callable not implemented — use linked practice space reattempt";
