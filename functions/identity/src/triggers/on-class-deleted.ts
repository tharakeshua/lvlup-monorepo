import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions/v2";
import { isoNow } from "@levelup/domain";
import type { Class } from "../contracts/legacy-docs";

/**
 * Firestore trigger: when a class status changes to 'archived',
 * remove classId from all linked students' and teachers' classIds[].
 */
export const onClassArchived = onDocumentUpdated(
  {
    document: "tenants/{tenantId}/classes/{classId}",
    region: "asia-south1",
  },
  async (event) => {
    try {
      const before = event.data?.before.data() as Class | undefined;
      const after = event.data?.after.data() as Class | undefined;

      if (!before || !after) return;

      // Only trigger when status changes to 'archived'
      if (before.status === "archived" || after.status !== "archived") return;

      const tenantId = event.params.tenantId;
      const classId = event.params.classId;
      const db = admin.firestore();
      const BATCH_LIMIT = 450;

      // Collect all update operations
      const refs: admin.firestore.DocumentReference[] = [];

      if (after.studentIds?.length) {
        for (const studentId of after.studentIds) {
          refs.push(db.doc(`tenants/${tenantId}/students/${studentId}`));
        }
      }

      if (after.teacherIds?.length) {
        for (const teacherId of after.teacherIds) {
          refs.push(db.doc(`tenants/${tenantId}/teachers/${teacherId}`));
        }
      }

      // Chunk into batches of BATCH_LIMIT to stay under Firestore's 500 op limit
      for (let i = 0; i < refs.length; i += BATCH_LIMIT) {
        const chunk = refs.slice(i, i + BATCH_LIMIT);
        const batch = db.batch();
        for (const ref of chunk) {
          batch.update(ref, {
            classIds: FieldValue.arrayRemove(classId),
            // B8: timestamps at rest are canonical ISO strings.
            updatedAt: isoNow(),
          });
        }
        await batch.commit();
      }

      logger.info(
        `Cleaned up references for archived class ${classId} in tenant ${tenantId}: ` +
          `${after.studentIds?.length ?? 0} students, ${after.teacherIds?.length ?? 0} teachers`
      );
    } catch (error) {
      logger.error("Failed to clean up archived class references", error);
    }
  }
);
