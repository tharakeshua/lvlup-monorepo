"use strict";
/**
 * onSubmissionCreated — Firestore trigger to kick off the grading pipeline.
 *
 * Uses Firestore triggers (not Cloud Tasks) for pipeline chaining so it
 * works seamlessly with the Firebase emulator.
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
exports.onSubmissionCreated = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const admin = __importStar(require("firebase-admin"));
const firestore_2 = require("firebase-admin/firestore");
const process_answer_mapping_1 = require("../pipeline/process-answer-mapping");
exports.onSubmissionCreated = (0, firestore_1.onDocumentCreated)(
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
    const now = firestore_2.FieldValue.serverTimestamp();
    // Transition to scouting and run answer mapping directly
    await db.doc(`tenants/${tenantId}/submissions/${submissionId}`).update({
      pipelineStatus: "scouting",
      updatedAt: now,
    });
    try {
      await (0, process_answer_mapping_1.processAnswerMapping)(tenantId, submissionId);
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
//# sourceMappingURL=on-submission-created.js.map
