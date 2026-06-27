"use strict";
/**
 * onSubmissionUpdated — Firestore trigger for pipeline state machine transitions.
 *
 * Watches for pipelineStatus changes and triggers the next pipeline step.
 */
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k];
            },
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, "default", { enumerable: true, value: v });
      }
    : function (o, v) {
        o["default"] = v;
      });
var __importStar =
  (this && this.__importStar) ||
  (function () {
    var ownKeys = function (o) {
      ownKeys =
        Object.getOwnPropertyNames ||
        function (o) {
          var ar = [];
          for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
          return ar;
        };
      return ownKeys(o);
    };
    return function (mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null)
        for (var k = ownKeys(mod), i = 0; i < k.length; i++)
          if (k[i] !== "default") __createBinding(result, mod, k[i]);
      __setModuleDefault(result, mod);
      return result;
    };
  })();
Object.defineProperty(exports, "__esModule", { value: true });
exports.onSubmissionUpdated = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const admin = __importStar(require("firebase-admin"));
const firestore_2 = require("firebase-admin/firestore");
const process_answer_mapping_1 = require("../pipeline/process-answer-mapping");
const process_answer_grading_1 = require("../pipeline/process-answer-grading");
const finalize_submission_1 = require("../pipeline/finalize-submission");
const MAX_RETRIES = 3;
exports.onSubmissionUpdated = (0, firestore_1.onDocumentUpdated)(
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
    const now = firestore_2.FieldValue.serverTimestamp();
    try {
      switch (newStatus) {
        case "scouting": {
          // Run Panopticon scouting
          await (0, process_answer_mapping_1.processAnswerMapping)(tenantId, submissionId);
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
          await (0, process_answer_grading_1.processAnswerGrading)(tenantId, submissionId);
          break;
        }
        case "grading_complete": {
          // Finalize submission
          await (0, finalize_submission_1.finalizeSubmission)(tenantId, submissionId);
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
async function createDeadLetterEntry(db, tenantId, submissionId, step, error) {
  const dlqRef = db.collection(`tenants/${tenantId}/gradingDeadLetter`).doc();
  await dlqRef.set({
    id: dlqRef.id,
    submissionId,
    pipelineStep: step,
    error,
    attempts: MAX_RETRIES,
    lastAttemptAt: firestore_2.FieldValue.serverTimestamp(),
    createdAt: firestore_2.FieldValue.serverTimestamp(),
  });
}
//# sourceMappingURL=on-submission-updated.js.map
