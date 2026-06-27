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
exports.uploadAnswerSheets = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const shared_types_1 = require("@levelup/shared-types");
const assertions_1 = require("../utils/assertions");
const firestore_helpers_1 = require("../utils/firestore-helpers");
const utils_1 = require("../utils");
const rate_limit_1 = require("../utils/rate-limit");
exports.uploadAnswerSheets = (0, https_1.onCall)(
  { region: "asia-south1", timeoutSeconds: 300, memory: "256MiB", cors: true },
  async (request) => {
    const caller = (0, assertions_1.getCallerMembership)(request);
    const data = (0, utils_1.parseRequest)(
      request.data,
      shared_types_1.UploadAnswerSheetsRequestSchema
    );
    if (
      !data.tenantId ||
      !data.examId ||
      !data.studentId ||
      !data.classId ||
      !data.imageUrls?.length
    ) {
      throw new https_1.HttpsError("invalid-argument", "Missing required fields.");
    }
    // Validate imageUrls are within the tenant's storage namespace
    const expectedPrefix = `tenants/${data.tenantId}/`;
    for (const url of data.imageUrls) {
      if (!url.startsWith(expectedPrefix)) {
        throw new https_1.HttpsError(
          "invalid-argument",
          `Invalid image URL: must be within tenant storage (${expectedPrefix}).`
        );
      }
    }
    // Scanner, teacher, or admin can upload
    (0, assertions_1.assertAutogradePermission)(caller, data.tenantId, undefined, {
      allowScanner: true,
    });
    await (0, rate_limit_1.enforceRateLimit)(data.tenantId, caller.uid, "ai", 10);
    const exam = await (0, firestore_helpers_1.getExam)(data.tenantId, data.examId);
    if (!exam) {
      throw new https_1.HttpsError("not-found", `Exam ${data.examId} not found.`);
    }
    if (exam.status !== "published" && exam.status !== "grading") {
      throw new https_1.HttpsError(
        "failed-precondition",
        `Exam must be 'published' to accept submissions. Current: '${exam.status}'.`
      );
    }
    // Verify student's class is part of this exam
    if (!exam.classIds.includes(data.classId)) {
      throw new https_1.HttpsError(
        "failed-precondition",
        `Class ${data.classId} is not assigned to this exam.`
      );
    }
    // Check for duplicate submission
    const db = admin.firestore();
    const existingSnap = await db
      .collection(`tenants/${data.tenantId}/submissions`)
      .where("examId", "==", data.examId)
      .where("studentId", "==", data.studentId)
      .limit(1)
      .get();
    if (!existingSnap.empty) {
      throw new https_1.HttpsError(
        "already-exists",
        `Submission already exists for student ${data.studentId} on exam ${data.examId}.`
      );
    }
    // Load student name and roll number for denormalization
    const studentDoc = await db.doc(`tenants/${data.tenantId}/students/${data.studentId}`).get();
    const student = studentDoc.data();
    const studentName = student
      ? `${student.firstName ?? ""} ${student.lastName ?? ""}`.trim()
      : data.studentId;
    const rollNumber = student?.rollNumber ?? "";
    const now = firestore_1.FieldValue.serverTimestamp();
    const subRef = db.collection(`tenants/${data.tenantId}/submissions`).doc();
    const uploadSource = caller.role === "scanner" ? "scanner" : "web";
    await subRef.set({
      id: subRef.id,
      tenantId: data.tenantId,
      examId: data.examId,
      studentId: data.studentId,
      studentName,
      rollNumber,
      classId: data.classId,
      answerSheets: {
        images: data.imageUrls,
        uploadedAt: now,
        uploadedBy: caller.uid,
        uploadSource,
      },
      summary: {
        totalScore: 0,
        maxScore: exam.totalMarks,
        percentage: 0,
        grade: "",
        questionsGraded: 0,
        totalQuestions: exam.questionPaper?.questionCount ?? 0,
      },
      pipelineStatus: "uploaded",
      retryCount: 0,
      resultsReleased: false,
      createdAt: now,
      updatedAt: now,
    });
    // Update exam status to grading if first submission
    if (exam.status === "published") {
      await db.doc(`tenants/${data.tenantId}/exams/${data.examId}`).update({
        status: "grading",
        "stats.totalSubmissions": firestore_1.FieldValue.increment(1),
        updatedAt: now,
      });
    } else {
      await db.doc(`tenants/${data.tenantId}/exams/${data.examId}`).update({
        "stats.totalSubmissions": firestore_1.FieldValue.increment(1),
        updatedAt: now,
      });
    }
    return { submissionId: subRef.id };
  }
);
//# sourceMappingURL=upload-answer-sheets.js.map
