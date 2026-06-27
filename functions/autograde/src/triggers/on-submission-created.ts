/**
 * onSubmissionCreated — Firestore trigger to kick off the grading pipeline.
 *
 * Uses Firestore triggers (not Cloud Tasks) for pipeline chaining so it
 * works seamlessly with the Firebase emulator.
 */

import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { processAnswerMapping } from "../pipeline/process-answer-mapping";

export const onSubmissionCreated = onDocumentCreated(
  {
    document: "tenants/{tenantId}/submissions/{submissionId}",
    region: "asia-south1",
    memory: "4GiB",
    timeoutSeconds: 540,
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const data = snapshot.data();
    const { tenantId, submissionId } = event.params;

    // Only process new submissions with answer sheets
    if (!data.answerSheets?.images?.length) {
      console.warn(`Submission ${submissionId} has no answer sheet images. Skipping pipeline.`);
      return;
    }

    if (data.pipelineStatus !== "uploaded") {
      console.warn(`Submission ${submissionId} is not in 'uploaded' status. Skipping.`);
      return;
    }

    const db = admin.firestore();
    const now = FieldValue.serverTimestamp();

    // Transition to scouting and run answer mapping directly
    await db.doc(`tenants/${tenantId}/submissions/${submissionId}`).update({
      pipelineStatus: "scouting",
      updatedAt: now,
    });

    try {
      await processAnswerMapping(tenantId, submissionId);
      console.log(
        `Pipeline started for submission ${submissionId}: uploaded → scouting → mapping complete`
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`Pipeline scouting failed for submission ${submissionId}:`, errorMsg);
      await db.doc(`tenants/${tenantId}/submissions/${submissionId}`).update({
        pipelineStatus: "scouting_failed",
        pipelineError: errorMsg,
        updatedAt: now,
      });
    }
  }
);
