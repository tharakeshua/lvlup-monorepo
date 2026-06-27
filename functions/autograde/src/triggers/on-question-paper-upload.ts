/**
 * onQuestionPaperUpload — Cloud Storage trigger.
 *
 * Fires when a file is uploaded to the question paper path:
 *   tenants/{tenantId}/exams/{examId}/question-paper/{filename}
 *
 * Updates the exam document with the uploaded image paths and transitions
 * status from 'draft' to 'question_paper_uploaded'.
 */

import { onObjectFinalized } from "firebase-functions/v2/storage";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

/** Expected path pattern: tenants/{tenantId}/exams/{examId}/question-paper/{filename} */
const QP_PATH_REGEX = /^tenants\/([^/]+)\/exams\/([^/]+)\/question-paper\/(.+)$/;

export const onQuestionPaperUpload = onObjectFinalized(
  {
    region: "asia-south1",
    memory: "256MiB",
    bucket: undefined, // default bucket
  },
  async (event) => {
    const filePath = event.data.name;
    if (!filePath) return;

    const match = filePath.match(QP_PATH_REGEX);
    if (!match) return; // Not a question paper upload

    const [, tenantId, examId] = match;
    const contentType = event.data.contentType ?? "";

    // Only process image files
    if (!contentType.startsWith("image/")) {
      console.warn(`Ignoring non-image file in question-paper path: ${filePath} (${contentType})`);
      return;
    }

    console.log(`Question paper image uploaded: ${filePath} for exam ${examId}`);

    const db = admin.firestore();
    const examRef = db.doc(`tenants/${tenantId}/exams/${examId}`);
    const now = FieldValue.serverTimestamp();

    await db.runTransaction(async (txn) => {
      const examDoc = await txn.get(examRef);
      if (!examDoc.exists) {
        console.error(`Exam ${examId} not found in tenant ${tenantId}. Ignoring upload.`);
        return;
      }

      const exam = examDoc.data()!;

      // Only process if exam is in draft or question_paper_uploaded status
      if (exam.status !== "draft" && exam.status !== "question_paper_uploaded") {
        console.warn(
          `Exam ${examId} is in '${exam.status}' status. Ignoring question paper upload.`
        );
        return;
      }

      // Append the new image path to the existing images array
      const existingImages: string[] = exam.questionPaper?.images ?? [];
      if (existingImages.includes(filePath)) {
        console.warn(`Image ${filePath} already recorded for exam ${examId}. Skipping.`);
        return;
      }

      const updatedImages = [...existingImages, filePath];

      txn.update(examRef, {
        "questionPaper.images": updatedImages,
        status: "question_paper_uploaded",
        updatedAt: now,
      });
    });

    console.log(`Exam ${examId} updated with question paper image: ${filePath}`);
  }
);
