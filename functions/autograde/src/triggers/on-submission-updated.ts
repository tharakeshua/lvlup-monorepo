/**
 * onSubmissionUpdated — Firestore trigger for pipeline state machine transitions.
 *
 * Watches for pipelineStatus changes and triggers the next pipeline step.
 */

import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { processAnswerMapping } from "../pipeline/process-answer-mapping";
import { processAnswerGrading } from "../pipeline/process-answer-grading";
import { finalizeSubmission } from "../pipeline/finalize-submission";

const MAX_RETRIES = 3;

export const onSubmissionUpdated = onDocumentUpdated(
  {
    document: "tenants/{tenantId}/submissions/{submissionId}",
    region: "asia-south1",
    memory: "4GiB",
    timeoutSeconds: 540,
  },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return;

    const { tenantId, submissionId } = event.params;
    const prevStatus = before.pipelineStatus;
    const newStatus = after.pipelineStatus;

    // Only act on status changes
    if (prevStatus === newStatus) return;

    console.log(`Submission ${submissionId}: ${prevStatus} → ${newStatus}`);

    const db = admin.firestore();
    const now = FieldValue.serverTimestamp();

    try {
      switch (newStatus) {
        case "scouting": {
          // Run Panopticon scouting
          await processAnswerMapping(tenantId, submissionId);
          break;
        }

        case "scouting_failed": {
          // Retry scouting if retries left
          const retryCount = after.retryCount ?? 0;
          if (retryCount < MAX_RETRIES) {
            console.log(`Retrying scouting for ${submissionId} (attempt ${retryCount + 1})`);
            await db.doc(`tenants/${tenantId}/submissions/${submissionId}`).update({
              pipelineStatus: "scouting",
              retryCount: retryCount + 1,
              updatedAt: now,
            });
          } else {
            console.error(`Scouting failed permanently for ${submissionId}`);
            await db.doc(`tenants/${tenantId}/submissions/${submissionId}`).update({
              pipelineStatus: "manual_review_needed",
              updatedAt: now,
            });
            // Create DLQ entry
            await createDeadLetterEntry(
              db,
              tenantId,
              submissionId,
              "scouting",
              after.pipelineError ?? "Max retries exceeded"
            );
          }
          break;
        }

        case "scouting_complete": {
          // Start grading phase
          await db.doc(`tenants/${tenantId}/submissions/${submissionId}`).update({
            pipelineStatus: "grading",
            updatedAt: now,
          });
          break;
        }

        case "grading": {
          // Run RELMS grading for all pending questions
          await processAnswerGrading(tenantId, submissionId);
          break;
        }

        case "grading_complete": {
          // Finalize submission
          await finalizeSubmission(tenantId, submissionId);
          break;
        }

        default:
          // No automated action for other states
          break;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`Pipeline error for ${submissionId} at ${newStatus}:`, errorMsg);

      // Handle errors by status
      if (newStatus === "scouting") {
        await db.doc(`tenants/${tenantId}/submissions/${submissionId}`).update({
          pipelineStatus: "scouting_failed",
          pipelineError: errorMsg,
          updatedAt: now,
        });
      } else if (newStatus === "grading") {
        await db.doc(`tenants/${tenantId}/submissions/${submissionId}`).update({
          pipelineStatus: "grading_failed",
          pipelineError: errorMsg,
          updatedAt: now,
        });
        await createDeadLetterEntry(db, tenantId, submissionId, "grading", errorMsg);
      } else if (newStatus === "grading_complete") {
        await db.doc(`tenants/${tenantId}/submissions/${submissionId}`).update({
          pipelineStatus: "finalization_failed",
          pipelineError: errorMsg,
          updatedAt: now,
        });
        await createDeadLetterEntry(db, tenantId, submissionId, "grading", errorMsg);
      }
    }
  }
);

async function createDeadLetterEntry(
  db: admin.firestore.Firestore,
  tenantId: string,
  submissionId: string,
  step: "ocr" | "scouting" | "grading",
  error: string
): Promise<void> {
  const dlqRef = db.collection(`tenants/${tenantId}/gradingDeadLetter`).doc();
  await dlqRef.set({
    id: dlqRef.id,
    submissionId,
    pipelineStep: step,
    error,
    attempts: MAX_RETRIES,
    lastAttemptAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
  });
}
