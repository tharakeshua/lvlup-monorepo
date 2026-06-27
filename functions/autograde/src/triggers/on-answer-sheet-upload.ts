/**
 * onAnswerSheetUpload — Cloud Storage trigger.
 *
 * Fires when answer sheet images are uploaded to:
 *   tenants/{tenantId}/exams/{examId}/answer-sheets/{studentId}/{filename}
 *
 * Collects uploaded images and creates a submission document if one doesn't
 * already exist. The submission creation then triggers the grading pipeline
 * via the existing onSubmissionCreated Firestore trigger.
 *
 * Note: For the primary upload flow (web/scanner), the uploadAnswerSheets
 * callable is preferred. This Storage trigger serves as an alternative path
 * for bulk file uploads via GCS or automated scanning pipelines.
 */

import { onObjectFinalized } from "firebase-functions/v2/storage";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

/** Expected path: tenants/{tenantId}/exams/{examId}/answer-sheets/{studentId}/{filename} */
const AS_PATH_REGEX = /^tenants\/([^/]+)\/exams\/([^/]+)\/answer-sheets\/([^/]+)\/(.+)$/;

export const onAnswerSheetUpload = onObjectFinalized(
  {
    region: "asia-south1",
    memory: "256MiB",
    bucket: undefined, // default bucket
  },
  async (event) => {
    const filePath = event.data.name;
    if (!filePath) return;

    const match = filePath.match(AS_PATH_REGEX);
    if (!match) return; // Not an answer sheet upload

    const [, tenantId, examId, studentId] = match;
    const contentType = event.data.contentType ?? "";

    // Only process image files
    if (!contentType.startsWith("image/")) {
      console.warn(`Ignoring non-image file in answer-sheets path: ${filePath} (${contentType})`);
      return;
    }

    console.log(`Answer sheet uploaded: ${filePath} for student ${studentId}, exam ${examId}`);

    const db = admin.firestore();
    const now = FieldValue.serverTimestamp();

    // Verify exam exists and is in a valid state
    const examDoc = await db.doc(`tenants/${tenantId}/exams/${examId}`).get();
    if (!examDoc.exists) {
      console.error(`Exam ${examId} not found in tenant ${tenantId}. Ignoring upload.`);
      return;
    }

    const exam = examDoc.data()!;
    if (exam.status !== "published" && exam.status !== "grading") {
      console.warn(`Exam ${examId} is in '${exam.status}' status. Answer sheet upload ignored.`);
      return;
    }

    // Check if a submission already exists for this student + exam
    const existingSnap = await db
      .collection(`tenants/${tenantId}/submissions`)
      .where("examId", "==", examId)
      .where("studentId", "==", studentId)
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      // Append the new image to the existing submission's answer sheets
      const existingDoc = existingSnap.docs[0];
      const existingData = existingDoc.data();
      const existingImages: string[] = existingData.answerSheets?.images ?? [];

      if (!existingImages.includes(filePath)) {
        await existingDoc.ref.update({
          "answerSheets.images": [...existingImages, filePath],
          updatedAt: now,
        });
        console.log(`Appended image to existing submission ${existingDoc.id}`);
      }
      return;
    }

    // Resolve student metadata for denormalization
    const studentDoc = await db.doc(`tenants/${tenantId}/students/${studentId}`).get();
    const student = studentDoc.data();
    const studentName = student
      ? `${student.firstName ?? ""} ${student.lastName ?? ""}`.trim()
      : studentId;
    const rollNumber = student?.rollNumber ?? "";
    const classId = student?.classIds?.[0] ?? "";

    // Create a new submission document. This will trigger onSubmissionCreated
    // which starts the grading pipeline.
    const subRef = db.collection(`tenants/${tenantId}/submissions`).doc();
    await subRef.set({
      id: subRef.id,
      tenantId,
      examId,
      studentId,
      studentName,
      rollNumber,
      classId,
      answerSheets: {
        images: [filePath],
        uploadedAt: now,
        uploadedBy: "storage-trigger",
        uploadSource: "gcs",
      },
      summary: {
        totalScore: 0,
        maxScore: exam.totalMarks ?? 0,
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

    // Update exam stats
    const examRef = db.doc(`tenants/${tenantId}/exams/${examId}`);
    const updateData: Record<string, unknown> = {
      "stats.totalSubmissions": FieldValue.increment(1),
      updatedAt: now,
    };

    if (exam.status === "published") {
      updateData.status = "grading";
    }

    await examRef.update(updateData);

    console.log(`Created submission ${subRef.id} from storage upload for student ${studentId}`);
  }
);
