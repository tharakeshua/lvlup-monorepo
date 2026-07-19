/** Immutable agent-assessment submission and evaluation-lease authority. */
import {
  type DocumentReference,
  type Firestore,
  type Query,
  type Transaction,
} from "firebase-admin/firestore";
import type {
  ConversationLease,
  ConversationSessionDoc,
  ItemSubmissionDoc,
  ItemSubmissionEvaluationAttemptDoc,
} from "@levelup/domain";
import { canonicalHash, sameCanonical, sha256Base64Url } from "./canonical.js";
import { makeLeaseConflict, makeRepoError } from "./errors.js";
import { docFromFirestore, toFirestore } from "./firestore.js";
import {
  conversationSessionDoc,
  itemSubmissionAttemptDoc,
  itemSubmissionDoc,
  itemSubmissionsPath,
} from "./paths.js";
import type {
  AcquireEvaluationInput,
  CommitSubmissionEvaluationInput,
  EvaluationClaim,
  FailSubmissionEvaluationInput,
  ItemSubmissionRepo,
} from "./types.js";

type Doc = Record<string, unknown>;
const MAX_EVALUATION_ATTEMPTS = 3;

function readSnapshot<T>(snap: {
  exists: boolean;
  id: string;
  data: () => Doc | undefined;
}): T | null {
  return snap.exists ? (docFromFirestore({ ...(snap.data() ?? {}), id: snap.id }) as T) : null;
}

function write(tx: Transaction, ref: DocumentReference, value: Doc): void {
  tx.set(ref, toFirestore(value));
}

function expired(value: string | undefined, now: string): boolean {
  if (!value) return true;
  const expiry = Date.parse(value);
  const current = Date.parse(now);
  return !Number.isFinite(expiry) || !Number.isFinite(current) || expiry <= current;
}

function assertLease(lease: ConversationLease, now: string): void {
  if (!lease.token || !lease.ownerRequestId || expired(lease.expiresAt, now)) {
    throw makeRepoError("VALIDATION_ERROR", "A non-expired evaluation lease is required");
  }
}

function assertSubmissionLease(submission: ItemSubmissionDoc, token: string, now: string): void {
  const lease = submission.workflow.evaluationLease;
  if (!lease || lease.token !== token || expired(lease.expiresAt, now)) {
    throw makeRepoError("CONFLICT", "The evaluation lease no longer belongs to this request");
  }
}

function attemptId(attemptNumber: number): string {
  return `evaluation_${attemptNumber}`;
}

function leaseTokenHash(token: string): string {
  return sha256Base64Url(token);
}

function asSubmission(value: Doc): ItemSubmissionDoc {
  return value as unknown as ItemSubmissionDoc;
}

function asSession(value: Doc): ConversationSessionDoc {
  return value as unknown as ConversationSessionDoc;
}

function asAttempt(value: Doc): ItemSubmissionEvaluationAttemptDoc {
  return value as unknown as ItemSubmissionEvaluationAttemptDoc;
}

function validateEvaluation(evaluation: NonNullable<ItemSubmissionDoc["evaluation"]>): void {
  const result = evaluation.result;
  const finite = [
    result.score,
    result.maxScore,
    result.correctness,
    result.percentage,
    result.confidence,
  ].every(Number.isFinite);
  if (
    !finite ||
    result.score < 0 ||
    result.maxScore < 0 ||
    result.score > result.maxScore ||
    result.correctness < 0 ||
    result.correctness > 1 ||
    result.percentage < 0 ||
    result.percentage > 100
  ) {
    throw makeRepoError("VALIDATION_ERROR", "Evaluation result is outside accepted score bounds");
  }
  if (canonicalHash(result) !== evaluation.resultHash) {
    throw makeRepoError("CONFLICT", "Evaluation resultHash does not match its immutable result");
  }
}

export function makeItemSubmissionRepo(firestore: Firestore): ItemSubmissionRepo {
  return {
    async get(tenantId, submissionId) {
      const snap = await firestore.doc(itemSubmissionDoc(tenantId, submissionId)).get();
      return readSnapshot<ItemSubmissionDoc>(snap);
    },

    async acquireEvaluation(input: AcquireEvaluationInput): Promise<EvaluationClaim> {
      assertLease(input.lease, input.now);
      const submissionRef = firestore.doc(itemSubmissionDoc(input.tenantId, input.submissionId));
      return firestore.runTransaction(async (tx) => {
        const submissionSnap = await tx.get(submissionRef);
        const submission = readSnapshot<ItemSubmissionDoc>(submissionSnap);
        if (!submission) throw makeRepoError("NOT_FOUND", "Item submission was not found");
        const sessionRef = firestore.doc(
          conversationSessionDoc(input.tenantId, submission.sessionId)
        );
        const sessionSnap = await tx.get(sessionRef);
        const session = readSnapshot<ConversationSessionDoc>(sessionSnap);

        if (submission.evaluation) {
          return { outcome: "evaluated_replay", submission };
        }
        const currentLease = submission.workflow.evaluationLease;
        const currentAttemptNumber = submission.workflow.evaluationAttemptCount;
        const currentAttemptRef = currentLease
          ? firestore.doc(
              itemSubmissionAttemptDoc(
                input.tenantId,
                input.submissionId,
                attemptId(currentAttemptNumber)
              )
            )
          : undefined;
        const currentAttemptSnap = currentAttemptRef ? await tx.get(currentAttemptRef) : undefined;
        const currentAttempt = currentAttemptSnap
          ? readSnapshot<ItemSubmissionEvaluationAttemptDoc>(currentAttemptSnap)
          : null;

        if (currentLease && !expired(currentLease.expiresAt, input.now)) {
          if (currentLease.ownerRequestId !== input.ownerRequestId) {
            throw makeLeaseConflict("Another evaluator currently owns this submission");
          }
          if (!currentAttempt) {
            throw makeRepoError(
              "CONFLICT",
              "Evaluation lease exists without its deterministic attempt record"
            );
          }
          return { outcome: "claimed", submission, attempt: currentAttempt };
        }
        if (submission.workflow.evaluationAttemptCount >= MAX_EVALUATION_ATTEMPTS) {
          return { outcome: "terminal_failure", submission };
        }
        if (
          submission.workflow.status !== "frozen" &&
          submission.workflow.status !== "grading_pending" &&
          submission.workflow.status !== "grading_failed" &&
          submission.workflow.status !== "grading"
        ) {
          throw makeRepoError("INVALID_TRANSITION", "Submission is not ready for evaluation");
        }
        if (
          submission.workflow.status === "grading_failed" &&
          submission.workflow.nextRetryAt &&
          !expired(submission.workflow.nextRetryAt, input.now)
        ) {
          throw makeRepoError("PRECONDITION_FAILED", "Evaluation retry is not due yet");
        }

        const nextAttemptNumber = submission.workflow.evaluationAttemptCount + 1;
        const id = attemptId(nextAttemptNumber);
        const attemptRef = firestore.doc(
          itemSubmissionAttemptDoc(input.tenantId, input.submissionId, id)
        );
        const attemptSnap = await tx.get(attemptRef);
        const existingAttempt = readSnapshot<ItemSubmissionEvaluationAttemptDoc>(attemptSnap);
        if (existingAttempt) {
          throw makeRepoError("CONFLICT", "Deterministic evaluation attempt id already exists");
        }
        const attempt = asAttempt({
          id,
          submissionId: input.submissionId,
          attemptNumber: nextAttemptNumber,
          leaseTokenHash: leaseTokenHash(input.lease.token),
          status: "running",
          traceId: input.ownerRequestId,
          startedAt: input.now,
        });
        const nextSubmission = asSubmission({
          ...submission,
          workflow: {
            ...submission.workflow,
            status: "grading",
            evaluationLease: input.lease,
            evaluationAttemptCount: nextAttemptNumber,
            nextRetryAt: undefined,
            lastError: undefined,
          },
          updatedAt: input.now,
        });
        write(tx, submissionRef, nextSubmission as unknown as Doc);
        write(tx, attemptRef, attempt as unknown as Doc);
        if (session && session.status === "grading_failed") {
          write(tx, sessionRef, {
            ...session,
            status: "grading_pending",
            revision: session.revision + 1,
            updatedAt: input.now,
          });
        }
        return { outcome: "claimed", submission: nextSubmission, attempt };
      });
    },

    async commitEvaluation(input: CommitSubmissionEvaluationInput): Promise<ItemSubmissionDoc> {
      validateEvaluation(input.evaluation);
      const submissionRef = firestore.doc(itemSubmissionDoc(input.tenantId, input.submissionId));
      return firestore.runTransaction(async (tx) => {
        const submissionSnap = await tx.get(submissionRef);
        const submission = readSnapshot<ItemSubmissionDoc>(submissionSnap);
        if (!submission) throw makeRepoError("NOT_FOUND", "Item submission was not found");
        const sessionRef = firestore.doc(
          conversationSessionDoc(input.tenantId, submission.sessionId)
        );
        const attemptRef = firestore.doc(
          itemSubmissionAttemptDoc(input.tenantId, input.submissionId, input.attemptId)
        );
        const sessionSnap = await tx.get(sessionRef);
        const attemptSnap = await tx.get(attemptRef);
        const session = readSnapshot<ConversationSessionDoc>(sessionSnap);
        const attempt = readSnapshot<ItemSubmissionEvaluationAttemptDoc>(attemptSnap);

        if (submission.evaluation) {
          if (!sameCanonical(submission.evaluation, input.evaluation)) {
            throw makeRepoError("CONFLICT", "A different immutable evaluation already exists");
          }
          return submission;
        }
        assertSubmissionLease(submission, input.leaseToken, input.now);
        if (
          submission.workflow.status !== "grading" ||
          !attempt ||
          attempt.status !== "running" ||
          attempt.leaseTokenHash !== leaseTokenHash(input.leaseToken)
        ) {
          throw makeRepoError("CONFLICT", "Evaluation attempt no longer owns the submission");
        }
        const nextSubmission = asSubmission({
          ...submission,
          evaluation: input.evaluation,
          workflow: {
            ...submission.workflow,
            status: "evaluated",
            evaluationLease: undefined,
            nextRetryAt: undefined,
            lastError: undefined,
          },
          updatedAt: input.now,
        });
        const nextAttempt = asAttempt({
          ...attempt,
          status: "succeeded",
          completedAt: input.now,
        });
        write(tx, submissionRef, nextSubmission as unknown as Doc);
        write(tx, attemptRef, nextAttempt as unknown as Doc);
        if (session && session.status === "grading_failed") {
          write(tx, sessionRef, {
            ...session,
            status: "grading_pending",
            revision: session.revision + 1,
            updatedAt: input.now,
          });
        }
        return nextSubmission;
      });
    },

    async failEvaluation(input: FailSubmissionEvaluationInput): Promise<ItemSubmissionDoc> {
      const submissionRef = firestore.doc(itemSubmissionDoc(input.tenantId, input.submissionId));
      return firestore.runTransaction(async (tx) => {
        const submissionSnap = await tx.get(submissionRef);
        const submission = readSnapshot<ItemSubmissionDoc>(submissionSnap);
        if (!submission) throw makeRepoError("NOT_FOUND", "Item submission was not found");
        const sessionRef = firestore.doc(
          conversationSessionDoc(input.tenantId, submission.sessionId)
        );
        const attemptRef = firestore.doc(
          itemSubmissionAttemptDoc(input.tenantId, input.submissionId, input.attemptId)
        );
        const sessionSnap = await tx.get(sessionRef);
        const attemptSnap = await tx.get(attemptRef);
        const session = readSnapshot<ConversationSessionDoc>(sessionSnap);
        const attempt = readSnapshot<ItemSubmissionEvaluationAttemptDoc>(attemptSnap);
        assertSubmissionLease(submission, input.leaseToken, input.now);
        if (
          submission.workflow.status !== "grading" ||
          !attempt ||
          attempt.status !== "running" ||
          attempt.leaseTokenHash !== leaseTokenHash(input.leaseToken)
        ) {
          throw makeRepoError("CONFLICT", "Evaluation attempt no longer owns the submission");
        }
        const terminal = submission.workflow.evaluationAttemptCount >= MAX_EVALUATION_ATTEMPTS;
        const nextSubmission = asSubmission({
          ...submission,
          workflow: {
            ...submission.workflow,
            status: "grading_failed",
            evaluationLease: undefined,
            lastError: input.error,
            nextRetryAt: terminal ? undefined : input.nextRetryAt,
          },
          updatedAt: input.now,
        });
        const nextAttempt = asAttempt({
          ...attempt,
          status: "failed",
          errorCode: input.error.code,
          retryable: input.error.retryable && !terminal,
          completedAt: input.now,
        });
        write(tx, submissionRef, nextSubmission as unknown as Doc);
        write(tx, attemptRef, nextAttempt as unknown as Doc);
        if (session && session.status !== "completed") {
          write(tx, sessionRef, {
            ...session,
            status: "grading_failed",
            revision: session.revision + 1,
            updatedAt: input.now,
          });
        }
        return nextSubmission;
      });
    },

    async listRetryable(tenantId, now, limit) {
      const bounded = Math.max(1, Math.min(limit, 100));
      const snap = await firestore
        .collection(itemSubmissionsPath(tenantId))
        .where("workflow.status", "==", "grading_failed")
        .where("workflow.nextRetryAt", "<=", now)
        .orderBy("workflow.nextRetryAt", "asc")
        .orderBy("__name__", "asc")
        .limit(bounded)
        .get();
      return snap.docs.map((doc) => asSubmission(docFromFirestore({ ...doc.data(), id: doc.id })));
    },

    async listRecoveryCandidates(tenantId, now, limit) {
      const bounded = Math.max(1, Math.min(limit, 100));
      const collection = firestore.collection(itemSubmissionsPath(tenantId));
      const [frozen, pending, grading, failed] = await Promise.all([
        collection.where("workflow.status", "==", "frozen").limit(bounded).get(),
        collection.where("workflow.status", "==", "grading_pending").limit(bounded).get(),
        // The provided index covers retry scheduling, not nested lease expiry;
        // a bounded status query plus deterministic in-process filtering avoids
        // an unsupported cross-root or unbounded absence query.
        collection.where("workflow.status", "==", "grading").limit(bounded).get(),
        collection
          .where("workflow.status", "==", "grading_failed")
          .where("workflow.nextRetryAt", "<=", now)
          .orderBy("workflow.nextRetryAt", "asc")
          .orderBy("__name__", "asc")
          .limit(bounded)
          .get(),
      ]);
      const unique = new Map<string, ItemSubmissionDoc>();
      for (const snap of [frozen, pending, failed]) {
        for (const doc of snap.docs) {
          const submission = asSubmission(docFromFirestore({ ...doc.data(), id: doc.id }));
          unique.set(String(submission.id), submission);
        }
      }
      for (const doc of grading.docs) {
        const submission = asSubmission(docFromFirestore({ ...doc.data(), id: doc.id }));
        if (expired(submission.workflow.evaluationLease?.expiresAt, now)) {
          unique.set(String(submission.id), submission);
        }
      }
      return [...unique.values()]
        .sort(
          (a, b) =>
            a.updatedAt.localeCompare(b.updatedAt) || String(a.id).localeCompare(String(b.id))
        )
        .slice(0, bounded);
    },
  };
}
