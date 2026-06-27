"use strict";
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
exports.getSummary = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const v2_1 = require("firebase-functions/v2");
const shared_types_1 = require("@levelup/shared-types");
const parse_request_1 = require("../utils/parse-request");
const rate_limit_1 = require("../utils/rate-limit");
exports.getSummary = (0, https_1.onCall)(
  { region: "asia-south1", memory: "256MiB", cors: true },
  async (request) => {
    if (!request.auth) {
      throw new https_1.HttpsError("unauthenticated", "Authentication required.");
    }
    const data = (0, parse_request_1.parseRequest)(
      request.data,
      shared_types_1.GetSummaryRequestSchema
    );
    if (!data.scope) {
      throw new https_1.HttpsError("invalid-argument", "scope is required.");
    }
    const callerUid = request.auth.uid;
    const db = admin.firestore();
    // Platform and health scopes require superAdmin — no tenantId needed
    if (data.scope === "platform" || data.scope === "health") {
      await (0, rate_limit_1.enforceRateLimit)("global", callerUid, "read", 60);
      const callerDoc = await db.doc(`users/${callerUid}`).get();
      if (!callerDoc.exists || !callerDoc.data()?.isSuperAdmin) {
        throw new https_1.HttpsError("permission-denied", "SuperAdmin access required.");
      }
      if (data.scope === "platform") {
        return handlePlatformSummary(db);
      }
      return handleHealthSummary(db);
    }
    // Tenant-scoped queries require tenantId
    if (!data.tenantId) {
      throw new https_1.HttpsError(
        "invalid-argument",
        "tenantId is required for student/class scope."
      );
    }
    await (0, rate_limit_1.enforceRateLimit)(data.tenantId, callerUid, "read", 60);
    // Verify caller belongs to the tenant
    const membershipSnap = await db
      .collection("userMemberships")
      .where("uid", "==", callerUid)
      .where("tenantId", "==", data.tenantId)
      .where("status", "==", "active")
      .limit(1)
      .get();
    if (membershipSnap.empty) {
      throw new https_1.HttpsError("permission-denied", "You do not belong to this tenant.");
    }
    const callerRole = membershipSnap.docs[0].data().role;
    if (data.scope === "student") {
      return handleStudentSummary(db, data, callerUid, callerRole);
    }
    if (data.scope === "class") {
      return handleClassSummary(db, data, callerUid, callerRole);
    }
    throw new https_1.HttpsError("invalid-argument", "Invalid scope value.");
  }
);
// ── Student Summary ──────────────────────────────────────────────────────────
async function handleStudentSummary(db, data, callerUid, callerRole) {
  if (!data.studentId) {
    throw new https_1.HttpsError(
      "invalid-argument",
      'studentId is required when scope is "student".'
    );
  }
  // Students can only access their own summaries
  if (callerRole === "student" && data.studentId !== callerUid) {
    throw new https_1.HttpsError(
      "permission-denied",
      "Students can only access their own summary."
    );
  }
  const summaryRef = db.doc(`tenants/${data.tenantId}/studentProgressSummaries/${data.studentId}`);
  const snapshot = await summaryRef.get();
  if (!snapshot.exists) {
    throw new https_1.HttpsError("not-found", "Student progress summary not found.");
  }
  const result = shared_types_1.StudentProgressSummarySchema.safeParse({
    id: snapshot.id,
    ...snapshot.data(),
  });
  if (!result.success) {
    v2_1.logger.error("Invalid StudentProgressSummary document", {
      docId: snapshot.id,
      errors: result.error.flatten(),
    });
    throw new https_1.HttpsError("internal", "Data integrity error");
  }
  return {
    scope: "student",
    studentSummary: result.data,
  };
}
// ── Class Summary ────────────────────────────────────────────────────────────
async function handleClassSummary(db, data, callerUid, callerRole) {
  if (!data.classId) {
    throw new https_1.HttpsError("invalid-argument", 'classId is required when scope is "class".');
  }
  if (callerRole === "student") {
    throw new https_1.HttpsError("permission-denied", "Students cannot access class summaries.");
  }
  // Teachers can only access their assigned classes
  if (callerRole === "teacher") {
    const classDoc = await db.doc(`tenants/${data.tenantId}/classes/${data.classId}`).get();
    const teacherIds = classDoc.data()?.teacherIds ?? [];
    if (!teacherIds.includes(callerUid)) {
      throw new https_1.HttpsError("permission-denied", "You are not assigned to this class.");
    }
  }
  const summaryRef = db.doc(`tenants/${data.tenantId}/classProgressSummaries/${data.classId}`);
  const snapshot = await summaryRef.get();
  if (!snapshot.exists) {
    throw new https_1.HttpsError("not-found", "Class progress summary not found.");
  }
  const result = shared_types_1.ClassProgressSummarySchema.safeParse({
    id: snapshot.id,
    ...snapshot.data(),
  });
  if (!result.success) {
    v2_1.logger.error("Invalid ClassProgressSummary document", {
      docId: snapshot.id,
      errors: result.error.flatten(),
    });
    throw new https_1.HttpsError("internal", "Data integrity error");
  }
  return {
    scope: "class",
    classSummary: result.data,
  };
}
// ── Platform Summary ─────────────────────────────────────────────────────────
async function handlePlatformSummary(db) {
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
    .where("createdAt", ">=", firestore_1.Timestamp.fromDate(thisMonthStart))
    .get();
  const newTenantsThisMonth = tenantsThisMonthSnap.size;
  // Count tenants created last month
  const tenantsLastMonthSnap = await db
    .collection("tenants")
    .where("createdAt", ">=", firestore_1.Timestamp.fromDate(lastMonthStart))
    .where("createdAt", "<=", firestore_1.Timestamp.fromDate(lastMonthEnd))
    .get();
  const newTenantsLastMonth = tenantsLastMonthSnap.size;
  // Count users (memberships) created this week vs last week
  const usersThisWeekSnap = await db
    .collection("userMemberships")
    .where("createdAt", ">=", firestore_1.Timestamp.fromDate(thisWeekStart))
    .get();
  const newUsersThisWeek = usersThisWeekSnap.size;
  const usersLastWeekSnap = await db
    .collection("userMemberships")
    .where("createdAt", ">=", firestore_1.Timestamp.fromDate(lastWeekStart))
    .where("createdAt", "<=", firestore_1.Timestamp.fromDate(lastWeekEnd))
    .get();
  const newUsersLastWeek = usersLastWeekSnap.size;
  // Active users (users with lastLogin within 7 days)
  const activeUsersSnap = await db
    .collection("users")
    .where("lastLogin", ">=", firestore_1.Timestamp.fromDate(sevenDaysAgo))
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
      action: d.action,
      actorEmail: d.actorEmail ?? "",
      tenantId: d.tenantId,
      metadata: d.metadata ?? {},
      createdAt: d.createdAt,
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
async function handleHealthSummary(db) {
  // Read last 30 health snapshots
  const snapshotsSnap = await db
    .collection("platformHealthSnapshots")
    .orderBy("date", "desc")
    .limit(30)
    .get();
  const snapshots = snapshotsSnap.docs.map((doc) => {
    const d = doc.data();
    return {
      date: d.date ?? doc.id,
      status: d.status ?? "healthy",
    };
  });
  // Count errors in last 24h from gradingDeadLetter
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const cutoff = firestore_1.Timestamp.fromDate(twentyFourHoursAgo);
  let errorCount24h = 0;
  try {
    const deadLetterSnap = await db
      .collection("gradingDeadLetter")
      .where("createdAt", ">=", cutoff)
      .get();
    errorCount24h += deadLetterSnap.size;
  } catch (e) {
    v2_1.logger.warn("Failed to query gradingDeadLetter", { error: e });
  }
  try {
    const llmErrorsSnap = await db
      .collection("llmCallLogs")
      .where("status", "==", "error")
      .where("createdAt", ">=", cutoff)
      .get();
    errorCount24h += llmErrorsSnap.size;
  } catch (e) {
    v2_1.logger.warn("Failed to query llmCallLogs errors", { error: e });
  }
  return {
    scope: "health",
    healthSummary: {
      snapshots,
      errorCount24h,
    },
  };
}
//# sourceMappingURL=get-summary.js.map
