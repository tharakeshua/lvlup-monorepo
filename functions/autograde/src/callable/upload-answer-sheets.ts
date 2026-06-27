import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { UploadAnswerSheetsRequestSchema } from "@levelup/shared-types";
import { getCallerMembership, assertAutogradePermission } from "../utils/assertions";
import { getExam } from "../utils/firestore-helpers";
import { parseRequest } from "../utils";
import { enforceRateLimit } from "../utils/rate-limit";

interface UploadAnswerSheetsRequest {
  tenantId: string;
  examId: string;
  studentId: string;
  classId: string;
  imageUrls: string[];
}

export const uploadAnswerSheets = onCall(
  { region: "asia-south1", timeoutSeconds: 300, memory: "256MiB", cors: true },
  async (request) => {
    const caller = getCallerMembership(request);
    const data = parseRequest(request.data, UploadAnswerSheetsRequestSchema);

    if (
      !data.tenantId ||
      !data.examId ||
      !data.studentId ||
      !data.classId ||
      !data.imageUrls?.length
    ) {
      throw new HttpsError("invalid-argument", "Missing required fields.");
    }

    // Validate imageUrls are within the tenant's storage namespace
    const expectedPrefix = `tenants/${data.tenantId}/`;
    for (const url of data.imageUrls) {
      if (!url.startsWith(expectedPrefix)) {
        throw new HttpsError(
          "invalid-argument",
          `Invalid image URL: must be within tenant storage (${expectedPrefix}).`
        );
      }
    }

    // Scanner, teacher, or admin can upload
    assertAutogradePermission(caller, data.tenantId, undefined, { allowScanner: true });

    await enforceRateLimit(data.tenantId, caller.uid, "ai", 10);

    const exam = await getExam(data.tenantId, data.examId);
    if (!exam) {
      throw new HttpsError("not-found", `Exam ${data.examId} not found.`);
    }

    if (exam.status !== "published" && exam.status !== "grading") {
      throw new HttpsError(
        "failed-precondition",
        `Exam must be 'published' to accept submissions. Current: '${exam.status}'.`
      );
    }

    // Verify student's class is part of this exam
    if (!exam.classIds.includes(data.classId)) {
      throw new HttpsError(
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
      throw new HttpsError(
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

    const now = FieldValue.serverTimestamp();
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
        "stats.totalSubmissions": FieldValue.increment(1),
        updatedAt: now,
      });
    } else {
      await db.doc(`tenants/${data.tenantId}/exams/${data.examId}`).update({
        "stats.totalSubmissions": FieldValue.increment(1),
        updatedAt: now,
      });
    }

    return { submissionId: subRef.id };
  }
);
