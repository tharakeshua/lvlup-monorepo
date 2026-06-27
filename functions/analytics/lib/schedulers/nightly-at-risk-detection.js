"use strict";
/**
 * nightlyAtRiskDetection — Cloud Scheduler function that runs at 2:00 AM daily.
 * Scans all StudentProgressSummary documents, applies at-risk rules, and
 * updates the isAtRisk and atRiskReasons fields.
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
exports.nightlyAtRiskDetection = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const at_risk_rules_1 = require("../utils/at-risk-rules");
const shared_types_1 = require("@levelup/shared-types");
exports.nightlyAtRiskDetection = (0, scheduler_1.onSchedule)(
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
    const newlyAtRisk = [];
    for (const tenantDoc of tenantsSnap.docs) {
      const tenantId = tenantDoc.id;
      // Paginate through all student summaries in this tenant
      let lastDoc;
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
          const summaryResult = shared_types_1.StudentProgressSummarySchema.safeParse({
            id: doc.id,
            ...doc.data(),
          });
          if (!summaryResult.success) {
            // Skip invalid documents
            totalProcessed++;
            continue;
          }
          const summary = summaryResult.data;
          const result = (0, at_risk_rules_1.evaluateAtRiskRules)(summary);
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
              lastUpdatedAt: firestore_1.FieldValue.serverTimestamp(),
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
          const classIds = sData.classIds ?? [];
          const parentIds = sData.parentIds ?? [];
          // Resolve student display name from user profile
          const authUid = sData.authUid;
          if (authUid) {
            const userDoc = await db.doc(`users/${authUid}`).get();
            if (userDoc.exists) {
              entry.studentName = userDoc.data()?.displayName ?? entry.studentName;
            }
          }
          // Get teacher UIDs from classes
          for (const classId of classIds) {
            const classDoc = await db.doc(`tenants/${entry.tenantId}/classes/${classId}`).get();
            if (classDoc.exists) {
              const teacherIds = classDoc.data()?.teacherIds ?? [];
              for (const tid of teacherIds) {
                const teacherDoc = await db.doc(`tenants/${entry.tenantId}/teachers/${tid}`).get();
                if (teacherDoc.exists && teacherDoc.data()?.authUid) {
                  entry.teacherUids.push(teacherDoc.data().authUid);
                }
              }
            }
          }
          // Get parent UIDs
          for (const pid of parentIds) {
            const parentDoc = await db.doc(`tenants/${entry.tenantId}/parents/${pid}`).get();
            if (parentDoc.exists && parentDoc.data()?.authUid) {
              entry.parentUids.push(parentDoc.data().authUid);
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
        const { sendNotification } = await Promise.resolve().then(() =>
          __importStar(require("../utils/notification-sender"))
        );
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
//# sourceMappingURL=nightly-at-risk-detection.js.map
