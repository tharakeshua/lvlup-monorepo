import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions/v2";
import { isoNow } from "@levelup/domain";
import type { Student } from "../contracts/legacy-docs";

/**
 * Firestore trigger: when a student status changes to 'archived',
 * remove studentId from parent.childStudentIds[] and class.studentIds[].
 */
export const onStudentArchived = onDocumentUpdated(
  {
    document: "tenants/{tenantId}/students/{studentId}",
    region: "asia-south1",
  },
  async (event) => {
    try {
      const before = event.data?.before.data() as Student | undefined;
      const after = event.data?.after.data() as Student | undefined;

      if (!before || !after) return;

      // Only trigger when status changes to 'archived'
      if (before.status === "archived" || after.status !== "archived") return;

      const tenantId = event.params.tenantId;
      const studentId = event.params.studentId;
      const db = admin.firestore();
      const BATCH_LIMIT = 450;

      // Collect all update operations as [ref, updateData] pairs
      const ops: [admin.firestore.DocumentReference, Record<string, unknown>][] = [];

      if (after.parentIds?.length) {
        for (const parentId of after.parentIds) {
          ops.push([
            db.doc(`tenants/${tenantId}/parents/${parentId}`),
            {
              childStudentIds: FieldValue.arrayRemove(studentId),
              // B8: timestamps at rest are canonical ISO strings.
              updatedAt: isoNow(),
            },
          ]);
        }
      }

      if (after.classIds?.length) {
        for (const classId of after.classIds) {
          ops.push([
            db.doc(`tenants/${tenantId}/classes/${classId}`),
            {
              studentIds: FieldValue.arrayRemove(studentId),
              studentCount: FieldValue.increment(-1),
              updatedAt: isoNow(),
            },
          ]);
        }
      }

      // Chunk into batches of BATCH_LIMIT to stay under Firestore's 500 op limit
      for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
        const chunk = ops.slice(i, i + BATCH_LIMIT);
        const batch = db.batch();
        for (const [ref, data] of chunk) {
          batch.update(ref, data);
        }
        await batch.commit();
      }

      logger.info(
        `Cleaned up references for archived student ${studentId} in tenant ${tenantId}: ` +
          `${after.parentIds?.length ?? 0} parents, ${after.classIds?.length ?? 0} classes`
      );
    } catch (error) {
      logger.error("Failed to clean up archived student references", error);
    }
  }
);
