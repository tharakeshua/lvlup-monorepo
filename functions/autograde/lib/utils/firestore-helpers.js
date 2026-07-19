"use strict";
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
exports.getExam = getExam;
exports.getExamQuestions = getExamQuestions;
exports.getSubmission = getSubmission;
exports.getQuestionSubmissions = getQuestionSubmissions;
exports.getEvaluationSettings = getEvaluationSettings;
const admin = __importStar(require("firebase-admin"));
const v2_1 = require("firebase-functions/v2");
const shared_types_1 = require("@levelup/shared-types");
const db = () => admin.firestore();
async function getExam(tenantId, examId) {
  const doc = await db().doc(`tenants/${tenantId}/exams/${examId}`).get();
  if (!doc.exists) return null;
  const result = shared_types_1.ExamSchema.safeParse({ id: doc.id, ...doc.data() });
  if (!result.success) {
    v2_1.logger.error("Invalid Exam document", { docId: doc.id, errors: result.error.flatten() });
    return null;
  }
  return result.data;
}
async function getExamQuestions(tenantId, examId) {
  const snap = await db()
    .collection(`tenants/${tenantId}/exams/${examId}/questions`)
    .orderBy("order", "asc")
    .get();
  return snap.docs.map((d) => {
    const result = shared_types_1.ExamQuestionSchema.safeParse({ id: d.id, ...d.data() });
    if (!result.success) {
      v2_1.logger.error("Invalid ExamQuestion document", {
        docId: d.id,
        errors: result.error.flatten(),
      });
      throw new Error("Data integrity error");
    }
    return result.data;
  });
}
async function getSubmission(tenantId, submissionId) {
  const doc = await db().doc(`tenants/${tenantId}/submissions/${submissionId}`).get();
  if (!doc.exists) return null;
  const result = shared_types_1.SubmissionSchema.safeParse({ id: doc.id, ...doc.data() });
  if (!result.success) {
    v2_1.logger.error("Invalid Submission document", {
      docId: doc.id,
      errors: result.error.flatten(),
    });
    return null;
  }
  return result.data;
}
async function getQuestionSubmissions(tenantId, submissionId) {
  const snap = await db()
    .collection(`tenants/${tenantId}/submissions/${submissionId}/questionSubmissions`)
    .get();
  return snap.docs.map((d) => {
    const result = shared_types_1.QuestionSubmissionSchema.safeParse({ id: d.id, ...d.data() });
    if (!result.success) {
      v2_1.logger.error("Invalid QuestionSubmission document", {
        docId: d.id,
        errors: result.error.flatten(),
      });
      throw new Error("Data integrity error");
    }
    return result.data;
  });
}
async function getEvaluationSettings(tenantId, settingsId) {
  const doc = await db().doc(`tenants/${tenantId}/evaluationSettings/${settingsId}`).get();
  if (!doc.exists) return null;
  const result = shared_types_1.EvaluationSettingsSchema.safeParse({ id: doc.id, ...doc.data() });
  if (!result.success) {
    v2_1.logger.error("Invalid EvaluationSettings document", {
      docId: doc.id,
      errors: result.error.flatten(),
    });
    return null;
  }
  return result.data;
}
//# sourceMappingURL=firestore-helpers.js.map
