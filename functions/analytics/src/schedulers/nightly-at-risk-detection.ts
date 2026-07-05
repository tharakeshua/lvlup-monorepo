/**
 * nightlyAtRiskDetection — Cloud Scheduler function that runs at 2:00 AM daily.
 * Scans all StudentProgressSummary documents, applies at-risk rules, and
 * updates the isAtRisk and atRiskReasons fields.
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import { isoNow } from "@levelup/domain";
import { evaluateAtRiskRules } from "../utils/at-risk-rules";
import type { StudentProgressSummary } from "../contracts/legacy-docs";
import { StudentProgressSummarySchema } from "../contracts/legacy-docs";

export const nightlyAtRiskDetection = onSchedule(
  {
    schedule: "0 2 * * *", // 2:00 AM daily
    timeZone: "UTC",
    region: "asia-south1",
    memory: "1GiB",
    timeoutSeconds: 540, // 9 minutes max
  },
  async () => {
    const db = admin.firestore();

    // Get all tenants
    const tenantsSnap = await db.collection("tenants").get();

    let totalProcessed = 0;
    let totalAtRisk = 0;
    const newlyAtRisk: {
      tenantId: string;
      studentId: string;
      studentName: string;
      reasons: string[];
      teacherUids: string[];
      parentUids: string[];
    }[] = [];

    for (const tenantDoc of tenantsSnap.docs) {
      const tenantId = tenantDoc.id;

      // Paginate through all student summaries in this tenant
      let lastDoc: admin.firestore.QueryDocumentSnapshot | undefined;
      const PAGE_SIZE = 500;

      while (true) {
        let query = db
          .collection(`tenants/${tenantId}/studentProgressSummaries`)
          .orderBy(admin.firestore.FieldPath.documentId())
          .limit(PAGE_SIZE);

        if (lastDoc) {
          query = query.startAfter(lastDoc);
        }

        const batch = await query.get();
        if (batch.empty) break;

        const MAX_BATCH_OPS = 450;
        let writeBatch = db.batch();
        let batchWrites = 0;

        for (const doc of batch.docs) {
          const summaryResult = StudentProgressSummarySchema.safeParse({
            id: doc.id,
            ...doc.data(),
          });
          if (!summaryResult.success) {
            // Skip invalid documents
            totalProcessed++;
            continue;
          }
          const summary = summaryResult.data as unknown as StudentProgressSummary;
          const result = evaluateAtRiskRules(summary);

          // Only write if the at-risk status or reasons changed
          const currentReasons = summary.atRiskReasons ?? [];
          const reasonsChanged =
            result.isAtRisk !== summary.isAtRisk ||
            result.reasons.length !== currentReasons.length ||
            result.reasons.some((r, i) => r !== currentReasons[i]);

          if (reasonsChanged) {
            // Commit current batch and start a new one if approaching the 500-op limit
            if (batchWrites >= MAX_BATCH_OPS) {
              await writeBatch.commit();
              writeBatch = db.batch();
              batchWrites = 0;
            }

            writeBatch.update(doc.ref, {
              isAtRisk: result.isAtRisk,
              atRiskReasons: result.reasons,
              lastUpdatedAt: isoNow(), // B8: ISO strings are canonical at rest
            });
            batchWrites++;

            // Track newly flagged students for notification
            if (result.isAtRisk && !summary.isAtRisk) {
              newlyAtRisk.push({
                tenantId,
                studentId: summary.studentId ?? doc.id,
                studentName: "A student", // Resolved from student document below
                reasons: result.reasons,
                teacherUids: [], // Populated below
                parentUids: [],
              });
            }
          }

          if (result.isAtRisk) totalAtRisk++;
          totalProcessed++;
        }

        if (batchWrites > 0) {
          await writeBatch.commit();
        }

        lastDoc = batch.docs[batch.docs.length - 1];
        if (batch.size < PAGE_SIZE) break;
      }
    }

    // Resolve teacher and parent UIDs for newly at-risk students
    for (const entry of newlyAtRisk) {
      try {
        const studentSnap = await db
          .collection(`tenants/${entry.tenantId}/students`)
          .where("authUid", "!=", null)
          .limit(1000)
          .get();
        // Find this student's document to get classIds and parentIds
        const studentDoc = studentSnap.docs.find(
          (d) => d.id === entry.studentId || d.data().authUid === entry.studentId
        );
        if (studentDoc) {
          const sData = studentDoc.data();
          const classIds: string[] = sData.classIds ?? [];
          const parentIds: string[] = sData.parentIds ?? [];

          // Resolve student display name from user profile
          const authUid: string | undefined = sData.authUid;
          if (authUid) {
            const userDoc = await db.doc(`users/${authUid}`).get();
            if (userDoc.exists) {
              entry.studentName = (userDoc.data()?.displayName as string) ?? entry.studentName;
            }
          }

          // Get teacher UIDs from classes
          for (const classId of classIds) {
            const classDoc = await db.doc(`tenants/${entry.tenantId}/classes/${classId}`).get();
            if (classDoc.exists) {
              const teacherIds: string[] = classDoc.data()?.teacherIds ?? [];
              for (const tid of teacherIds) {
                const teacherDoc = await db.doc(`tenants/${entry.tenantId}/teachers/${tid}`).get();
                if (teacherDoc.exists && teacherDoc.data()?.authUid) {
                  entry.teacherUids.push(teacherDoc.data()!.authUid);
                }
              }
            }
          }

          // Get parent UIDs
          for (const pid of parentIds) {
            const parentDoc = await db.doc(`tenants/${entry.tenantId}/parents/${pid}`).get();
            if (parentDoc.exists && parentDoc.data()?.authUid) {
              entry.parentUids.push(parentDoc.data()!.authUid);
            }
          }
        }
      } catch {
        // Best-effort — skip if resolution fails
      }
    }

    // Send notifications for newly flagged at-risk students
    try {
      if (newlyAtRisk.length > 0) {
        const { sendNotification } = await import("../utils/notification-sender");

        for (const entry of newlyAtRisk) {
          // Notify teachers of the student's classes
          for (const teacherUid of entry.teacherUids) {
            await sendNotification({
              tenantId: entry.tenantId,
              recipientId: teacherUid,
              recipientRole: "teacher",
              type: "student_at_risk",
              title: "Student At Risk",
              body: `${entry.studentName} has been flagged as at-risk: ${entry.reasons[0]}.`,
              entityType: "student",
              entityId: entry.studentId,
              actionUrl: `/students`,
            });
          }

          // Notify parents
          for (const parentUid of entry.parentUids) {
            await sendNotification({
              tenantId: entry.tenantId,
              recipientId: parentUid,
              recipientRole: "parent",
              type: "student_at_risk",
              title: "Your Child Needs Attention",
              body: `${entry.studentName} may need additional support with their studies.`,
              entityType: "student",
              entityId: entry.studentId,
              actionUrl: `/children`,
            });
          }
        }
      }
    } catch (err) {
      console.warn("Failed to send at-risk notifications:", err);
    }

    console.log(
      `At-risk detection complete: ${totalProcessed} students processed, ${totalAtRisk} flagged at-risk`
    );
  }
);
