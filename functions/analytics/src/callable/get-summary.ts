/**
 * getSummary — Consolidated callable function.
 *
 * Replaces: getStudentSummary, getClassSummary
 * Extended with platform & health scopes for super-admin.
 *
 * scope: 'student'  → returns pre-computed student progress summary
 * scope: 'class'    → returns pre-computed class progress summary
 * scope: 'platform' → returns platform-wide metrics (superAdmin only)
 * scope: 'health'   → returns health snapshots & error counts (superAdmin only)
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";
import type { GetSummaryRequest, GetSummaryResponse } from "../contracts/wire";
import { GetSummaryRequestSchema } from "../contracts/wire";
import { StudentProgressSummarySchema, ClassProgressSummarySchema } from "../contracts/legacy-docs";
import { legacyIso } from "../utils/aggregation-helpers";
import { parseRequest } from "../utils/parse-request";
import { enforceRateLimit } from "../utils/rate-limit";

export const getSummary = onCall(
  { region: "asia-south1", memory: "256MiB", cors: true },
  async (request): Promise<GetSummaryResponse> => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    const data = parseRequest(request.data, GetSummaryRequestSchema);

    if (!data.scope) {
      throw new HttpsError("invalid-argument", "scope is required.");
    }

    const callerUid = request.auth.uid;
    const db = admin.firestore();

    // Platform and health scopes require superAdmin — no tenantId needed
    if (data.scope === "platform" || data.scope === "health") {
      await enforceRateLimit("global", callerUid, "read", 60);

      const callerDoc = await db.doc(`users/${callerUid}`).get();
      if (!callerDoc.exists || !callerDoc.data()?.isSuperAdmin) {
        throw new HttpsError("permission-denied", "SuperAdmin access required.");
      }

      if (data.scope === "platform") {
        return handlePlatformSummary(db);
      }
      return handleHealthSummary(db);
    }

    // Tenant-scoped queries require tenantId
    if (!data.tenantId) {
      throw new HttpsError("invalid-argument", "tenantId is required for student/class scope.");
    }

    await enforceRateLimit(data.tenantId, callerUid, "read", 60);

    // Verify caller belongs to the tenant
    const membershipSnap = await db
      .collection("userMemberships")
      .where("uid", "==", callerUid)
      .where("tenantId", "==", data.tenantId)
      .where("status", "==", "active")
      .limit(1)
      .get();

    if (membershipSnap.empty) {
      throw new HttpsError("permission-denied", "You do not belong to this tenant.");
    }

    const callerRole = membershipSnap.docs[0].data().role as string;

    if (data.scope === "student") {
      return handleStudentSummary(db, data, callerUid, callerRole);
    }

    if (data.scope === "class") {
      return handleClassSummary(db, data, callerUid, callerRole);
    }

    throw new HttpsError("invalid-argument", "Invalid scope value.");
  }
);

// ── Student Summary ──────────────────────────────────────────────────────────

async function handleStudentSummary(
  db: FirebaseFirestore.Firestore,
  data: GetSummaryRequest,
  callerUid: string,
  callerRole: string
): Promise<GetSummaryResponse> {
  if (!data.studentId) {
    throw new HttpsError("invalid-argument", 'studentId is required when scope is "student".');
  }

  // Students can only access their own summaries
  if (callerRole === "student" && data.studentId !== callerUid) {
    throw new HttpsError("permission-denied", "Students can only access their own summary.");
  }

  const summaryRef = db.doc(`tenants/${data.tenantId}/studentProgressSummaries/${data.studentId}`);

  const snapshot = await summaryRef.get();

  if (!snapshot.exists) {
    throw new HttpsError("not-found", "Student progress summary not found.");
  }

  const result = StudentProgressSummarySchema.safeParse({ id: snapshot.id, ...snapshot.data() });
  if (!result.success) {
    logger.error("Invalid StudentProgressSummary document", {
      docId: snapshot.id,
      errors: result.error.flatten(),
    });
    throw new HttpsError("internal", "Data integrity error");
  }

  return {
    scope: "student",
    studentSummary: result.data as unknown as GetSummaryResponse["studentSummary"],
  };
}

// ── Class Summary ────────────────────────────────────────────────────────────

async function handleClassSummary(
  db: FirebaseFirestore.Firestore,
  data: GetSummaryRequest,
  callerUid: string,
  callerRole: string
): Promise<GetSummaryResponse> {
  if (!data.classId) {
    throw new HttpsError("invalid-argument", 'classId is required when scope is "class".');
  }

  if (callerRole === "student") {
    throw new HttpsError("permission-denied", "Students cannot access class summaries.");
  }

  // Teachers can only access their assigned classes
  if (callerRole === "teacher") {
    const classDoc = await db.doc(`tenants/${data.tenantId}/classes/${data.classId}`).get();
    const teacherIds: string[] = classDoc.data()?.teacherIds ?? [];
    if (!teacherIds.includes(callerUid)) {
      throw new HttpsError("permission-denied", "You are not assigned to this class.");
    }
  }

  const summaryRef = db.doc(`tenants/${data.tenantId}/classProgressSummaries/${data.classId}`);

  const snapshot = await summaryRef.get();

  if (!snapshot.exists) {
    throw new HttpsError("not-found", "Class progress summary not found.");
  }

  const result = ClassProgressSummarySchema.safeParse({ id: snapshot.id, ...snapshot.data() });
  if (!result.success) {
    logger.error("Invalid ClassProgressSummary document", {
      docId: snapshot.id,
      errors: result.error.flatten(),
    });
    throw new HttpsError("internal", "Data integrity error");
  }

  return {
    scope: "class",
    classSummary: result.data as unknown as GetSummaryResponse["classSummary"],
  };
}

// ── Platform Summary ─────────────────────────────────────────────────────────

async function handlePlatformSummary(db: FirebaseFirestore.Firestore): Promise<GetSummaryResponse> {
  const now = new Date();

  // Start of this month and last month
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

  // Start of this week (Monday) and last week
  const dayOfWeek = now.getDay();
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const thisWeekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysToMonday);
  thisWeekStart.setHours(0, 0, 0, 0);
  const lastWeekStart = new Date(thisWeekStart.getTime() - 7 * 24 * 60 * 60 * 1000);
  const lastWeekEnd = new Date(thisWeekStart.getTime() - 1);

  // 7 days ago for active users
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Count tenants created this month
  const tenantsThisMonthSnap = await db
    .collection("tenants")
    .where("createdAt", ">=", Timestamp.fromDate(thisMonthStart))
    .get();
  const newTenantsThisMonth = tenantsThisMonthSnap.size;

  // Count tenants created last month
  const tenantsLastMonthSnap = await db
    .collection("tenants")
    .where("createdAt", ">=", Timestamp.fromDate(lastMonthStart))
    .where("createdAt", "<=", Timestamp.fromDate(lastMonthEnd))
    .get();
  const newTenantsLastMonth = tenantsLastMonthSnap.size;

  // Count users (memberships) created this week vs last week
  const usersThisWeekSnap = await db
    .collection("userMemberships")
    .where("createdAt", ">=", Timestamp.fromDate(thisWeekStart))
    .get();
  const newUsersThisWeek = usersThisWeekSnap.size;

  const usersLastWeekSnap = await db
    .collection("userMemberships")
    .where("createdAt", ">=", Timestamp.fromDate(lastWeekStart))
    .where("createdAt", "<=", Timestamp.fromDate(lastWeekEnd))
    .get();
  const newUsersLastWeek = usersLastWeekSnap.size;

  // Active users (users with lastLogin within 7 days)
  const activeUsersSnap = await db
    .collection("users")
    .where("lastLogin", ">=", Timestamp.fromDate(sevenDaysAgo))
    .get();
  const activeUsersLast7d = activeUsersSnap.size;

  // Recent activity log entries
  const activitySnap = await db
    .collection("platformActivityLog")
    .orderBy("createdAt", "desc")
    .limit(10)
    .get();

  const recentActivity = activitySnap.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      action: d.action as string,
      actorEmail: (d.actorEmail as string) ?? "",
      tenantId: d.tenantId as string | undefined,
      metadata: (d.metadata as Record<string, unknown>) ?? {},
      // B8: ISO over the wire, never a Firestore Timestamp serialization.
      createdAt: legacyIso(d.createdAt),
    };
  });

  return {
    scope: "platform",
    platformSummary: {
      newTenantsThisMonth,
      newTenantsLastMonth,
      newUsersThisWeek,
      newUsersLastWeek,
      activeUsersLast7d,
      recentActivity,
    },
  };
}

// ── Health Summary ───────────────────────────────────────────────────────────

async function handleHealthSummary(db: FirebaseFirestore.Firestore): Promise<GetSummaryResponse> {
  // Read last 30 health snapshots
  const snapshotsSnap = await db
    .collection("platformHealthSnapshots")
    .orderBy("date", "desc")
    .limit(30)
    .get();

  const snapshots = snapshotsSnap.docs.map((doc) => {
    const d = doc.data();
    return {
      date: (d.date as string) ?? doc.id,
      status: (d.status as string) ?? "healthy",
    };
  });

  // Count errors in last 24h from gradingDeadLetter
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const cutoff = Timestamp.fromDate(twentyFourHoursAgo);

  let errorCount24h = 0;

  try {
    const deadLetterSnap = await db
      .collection("gradingDeadLetter")
      .where("createdAt", ">=", cutoff)
      .get();
    errorCount24h += deadLetterSnap.size;
  } catch (e) {
    logger.warn("Failed to query gradingDeadLetter", { error: e });
  }

  try {
    const llmErrorsSnap = await db
      .collection("llmCallLogs")
      .where("status", "==", "error")
      .where("createdAt", ">=", cutoff)
      .get();
    errorCount24h += llmErrorsSnap.size;
  } catch (e) {
    logger.warn("Failed to query llmCallLogs errors", { error: e });
  }

  return {
    scope: "health",
    healthSummary: {
      snapshots,
      errorCount24h,
    },
  };
}
