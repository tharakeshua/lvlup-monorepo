/**
 * autograde-pipeline-waiter.ts
 *
 * Admin-SDK Firestore onSnapshot waiter for autograde pipeline states.
 * Replaces brittle page.reload() polling with a true reactive subscription.
 *
 * The autograde server pipeline mutates two doc shapes:
 *   tenants/{t}/submissions/{submissionId}.pipelineStatus
 *   tenants/{t}/submissions/{submissionId}/questionSubmissions/{qid}.gradingStatus
 *
 * Both are observed via onSnapshot and resolved when the watched value matches
 * a terminal state (or rejected on timeout).
 */

import admin from "firebase-admin";

export type SubmissionTerminalStatus =
  | "grading_complete"
  | "ready_for_review"
  | "reviewed"
  | "failed"
  | "manual_review_needed";

export interface WaitOptions {
  timeoutMs?: number;
  /** Optional progress callback per Firestore snapshot. */
  onProgress?: (currentStatus: string | undefined) => void;
}

const DEFAULT_TIMEOUT = 300_000;

/**
 * Wait until `tenants/{t}/submissions/{submissionId}.pipelineStatus` reaches
 * one of the supplied terminal states (default: a happy-path set).
 *
 * Returns the final pipelineStatus value observed.
 */
export async function waitForSubmissionStatus(
  tenantId: string,
  submissionId: string,
  terminalStates: SubmissionTerminalStatus[] = ["grading_complete", "ready_for_review", "reviewed"],
  opts: WaitOptions = {}
): Promise<string> {
  const { timeoutMs = DEFAULT_TIMEOUT, onProgress } = opts;
  const ref = admin.firestore().doc(`tenants/${tenantId}/submissions/${submissionId}`);

  return new Promise<string>((resolve, reject) => {
    let unsub: (() => void) | undefined;
    const timer = setTimeout(() => {
      unsub?.();
      reject(
        new Error(
          `waitForSubmissionStatus timed out after ${timeoutMs}ms; tenant=${tenantId} submission=${submissionId}`
        )
      );
    }, timeoutMs);

    unsub = ref.onSnapshot(
      (snap) => {
        const status = snap.data()?.["pipelineStatus"] as string | undefined;
        onProgress?.(status);
        if (status && terminalStates.includes(status as SubmissionTerminalStatus)) {
          clearTimeout(timer);
          unsub?.();
          resolve(status);
        }
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

/**
 * Wait until every question-submission under the given submissionId reaches
 * a non-pending gradingStatus (e.g. 'ai_graded' or 'manual'). Useful before
 * triggering Approve All.
 */
export async function waitForAllQuestionsGraded(
  tenantId: string,
  submissionId: string,
  opts: WaitOptions = {}
): Promise<void> {
  const { timeoutMs = DEFAULT_TIMEOUT, onProgress } = opts;
  const ref = admin
    .firestore()
    .collection(`tenants/${tenantId}/submissions/${submissionId}/questionSubmissions`);

  return new Promise<void>((resolve, reject) => {
    let unsub: (() => void) | undefined;
    const timer = setTimeout(() => {
      unsub?.();
      reject(new Error(`waitForAllQuestionsGraded timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    unsub = ref.onSnapshot(
      (snap) => {
        if (snap.empty) return;
        const pending = snap.docs.filter((d) => {
          const s = d.data()["gradingStatus"] as string | undefined;
          return !s || s === "pending";
        });
        onProgress?.(`pending=${pending.length}/${snap.size}`);
        if (pending.length === 0) {
          clearTimeout(timer);
          unsub?.();
          resolve();
        }
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

/**
 * Wait until the exam's questions sub-collection has at least one doc — used
 * after triggering `extractQuestions` from the UI.
 */
export async function waitForExtractedQuestions(
  tenantId: string,
  examId: string,
  opts: WaitOptions = {}
): Promise<number> {
  const { timeoutMs = DEFAULT_TIMEOUT, onProgress } = opts;
  const ref = admin.firestore().collection(`tenants/${tenantId}/exams/${examId}/questions`);

  return new Promise<number>((resolve, reject) => {
    let unsub: (() => void) | undefined;
    const timer = setTimeout(() => {
      unsub?.();
      reject(new Error(`waitForExtractedQuestions timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    unsub = ref.onSnapshot(
      (snap) => {
        onProgress?.(`questions=${snap.size}`);
        if (snap.size > 0) {
          clearTimeout(timer);
          unsub?.();
          resolve(snap.size);
        }
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}
