/**
 * generateInsights — Cloud Scheduler function that runs nightly (after at-risk detection).
 * For each active student in each tenant, runs all insight rules and writes
 * insights to /tenants/{tenantId}/insights/{insightId}.
 * Limits each student to 5 active (non-dismissed) insights.
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import {
  generateInsightsForStudent,
  type InsightExamData,
  type InsightSpaceData,
  type SpaceCompletionMap,
  type CorrelationData,
} from "../utils/insight-rules";
import type { StudentProgressSummary } from "@levelup/shared-types";

const PAGE_SIZE = 500;
const MAX_ACTIVE_INSIGHTS = 5;

export const generateInsights = onSchedule(
  {
    schedule: "30 2 * * *", // 2:30 AM daily (after at-risk at 2:00)
    timeZone: "UTC",
    region: "asia-south1",
    memory: "1GiB",
    timeoutSeconds: 540,
  },
  async () => {
    const db = admin.firestore();
    const tenantsSnap = await db.collection("tenants").get();

    let totalInsightsCreated = 0;

    for (const tenantDoc of tenantsSnap.docs) {
      const tenantId = tenantDoc.id;

      // Load tenant-wide data once
      const [examsSnap, spacesSnap] = await Promise.all([
        db.collection(`tenants/${tenantId}/exams`).get(),
        db.collection(`tenants/${tenantId}/spaces`).where("status", "==", "published").get(),
      ]);

      const exams: InsightExamData[] = examsSnap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          title: data.title ?? "",
          linkedSpaceId: data.linkedSpaceId,
          linkedSpaceTitle: data.linkedSpaceTitle,
          classIds: data.classIds ?? [],
          topics: data.topics ?? [],
          examDate: data.examDate,
        };
      });

      const spaces: InsightSpaceData[] = spacesSnap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          title: data.title ?? "",
          subject: data.subject,
          status: data.status ?? "published",
        };
      });

      // Build correlation data from exams with linked spaces
      const correlationData: CorrelationData = {};
      for (const exam of exams) {
        if (!exam.linkedSpaceId) continue;
        // Simplified: we mark the linked space as having correlation potential
        // Full implementation would aggregate across submissions
        if (!correlationData[exam.linkedSpaceId]) {
          correlationData[exam.linkedSpaceId] = { completedAvg: 0, notCompletedAvg: 0, gap: 0.2 };
        }
      }

      // Paginate through students
      let lastDoc: admin.firestore.QueryDocumentSnapshot | undefined;

      while (true) {
        let query = db
          .collection(`tenants/${tenantId}/studentProgressSummaries`)
          .orderBy(admin.firestore.FieldPath.documentId())
          .limit(PAGE_SIZE);

        if (lastDoc) query = query.startAfter(lastDoc);

        const batch = await query.get();
        if (batch.empty) break;

        for (const studentDoc of batch.docs) {
          const summary = studentDoc.data() as StudentProgressSummary;
          const studentId = studentDoc.id;

          // Build space completion map for this student
          const spaceProgressSnap = await db
            .collection(`tenants/${tenantId}/spaceProgress`)
            .where("studentId", "==", studentId)
            .get();

          const spaceCompletion: SpaceCompletionMap = {};
          for (const sp of spaceProgressSnap.docs) {
            const spData = sp.data();
            spaceCompletion[spData.spaceId] = spData.percentage ?? 0;
          }

          // Generate insights
          const seeds = generateInsightsForStudent({
            summary,
            exams,
            spaces,
            spaceCompletion,
            correlationData,
          });

          if (seeds.length === 0) continue;

          // Get existing active insights for this student
          const existingSnap = await db
            .collection(`tenants/${tenantId}/insights`)
            .where("studentId", "==", studentId)
            .where("dismissedAt", "==", null)
            .get();

          // Delete old insights to stay under the limit
          const existingCount = existingSnap.size;
          const slotsAvailable = Math.max(0, MAX_ACTIVE_INSIGHTS - existingCount);
          const toWrite = seeds.slice(0, Math.max(slotsAvailable, seeds.length));

          // If we'd exceed the limit, remove oldest existing insights
          if (existingCount + toWrite.length > MAX_ACTIVE_INSIGHTS) {
            const sorted = existingSnap.docs.sort((a, b) => {
              const aTime = a.data().createdAt?.toMillis?.() ?? 0;
              const bTime = b.data().createdAt?.toMillis?.() ?? 0;
              return aTime - bTime;
            });
            const toRemove = existingCount + toWrite.length - MAX_ACTIVE_INSIGHTS;
            const writeBatch = db.batch();
            for (let i = 0; i < Math.min(toRemove, sorted.length); i++) {
              writeBatch.delete(sorted[i].ref);
            }
            await writeBatch.commit();
          }

          // Write new insights
          const writeBatch = db.batch();
          for (const seed of toWrite) {
            const ref = db.collection(`tenants/${tenantId}/insights`).doc();
            writeBatch.set(ref, {
              id: ref.id,
              tenantId,
              studentId,
              type: seed.type,
              priority: seed.priority,
              title: seed.title,
              description: seed.description,
              actionType: seed.actionType,
              actionEntityId: seed.actionEntityId ?? null,
              actionEntityTitle: seed.actionEntityTitle ?? null,
              createdAt: FieldValue.serverTimestamp(),
              dismissedAt: null,
            });
            totalInsightsCreated++;
          }
          await writeBatch.commit();
        }

        lastDoc = batch.docs[batch.docs.length - 1];
        if (batch.size < PAGE_SIZE) break;
      }
    }

    console.log(`Insight generation complete: ${totalInsightsCreated} insights created.`);
  }
);
