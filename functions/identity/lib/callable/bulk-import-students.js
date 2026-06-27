"use strict";
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
exports.bulkImportStudents = void 0;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const v2_1 = require("firebase-functions/v2");
const shared_types_1 = require("@levelup/shared-types");
const utils_1 = require("../utils");
const rate_limit_1 = require("../utils/rate-limit");
const usage_1 = require("../utils/usage");
/**
 * Callable: Bulk-imports students from parsed CSV data.
 * Supports dry-run validation and parent auto-creation.
 *
 * Config: 540s timeout, 1GiB memory for large imports.
 */
exports.bulkImportStudents = (0, https_1.onCall)(
  {
    region: "asia-south1",
    timeoutSeconds: 540,
    memory: "1GiB",
    cors: true,
  },
  async (request) => {
    const callerUid = request.auth?.uid;
    const data = (0, utils_1.parseRequest)(
      request.data,
      shared_types_1.BulkImportStudentsRequestSchema
    );
    await (0, utils_1.assertTenantAdminOrSuperAdmin)(callerUid, data.tenantId);
    await (0, rate_limit_1.enforceRateLimit)(data.tenantId, callerUid, "write", 5);
    // Check that bulk import feature is enabled for this tenant
    await (0, utils_1.assertFeatureEnabled)(data.tenantId, "bulkImportEnabled");
    const tenant = await (0, utils_1.getTenant)(data.tenantId);
    if (!tenant || tenant.status !== "active") {
      throw new https_1.HttpsError("not-found", "Tenant not found or inactive");
    }
    if (data.students.length > 500) {
      throw new https_1.HttpsError("invalid-argument", "Maximum 500 rows per import");
    }
    // Validate all rows
    const errors = [];
    const seenRollNumbers = new Set();
    for (let i = 0; i < data.students.length; i++) {
      const row = data.students[i];
      if (!row.firstName || !row.lastName) {
        errors.push({
          rowIndex: i,
          rollNumber: row.rollNumber ?? "",
          error: "firstName and lastName required",
        });
        continue;
      }
      if (!row.rollNumber) {
        errors.push({ rowIndex: i, rollNumber: "", error: "rollNumber required" });
        continue;
      }
      if (seenRollNumbers.has(row.rollNumber.toLowerCase())) {
        errors.push({
          rowIndex: i,
          rollNumber: row.rollNumber,
          error: "Duplicate rollNumber in batch",
        });
        continue;
      }
      seenRollNumbers.add(row.rollNumber.toLowerCase());
    }
    // Check subscription limit using centralized quota enforcement
    const validRowCount = data.students.length - errors.length;
    if (validRowCount > 0) {
      await (0, utils_1.assertQuota)(data.tenantId, "student", validRowCount);
    }
    if (data.dryRun) {
      return {
        totalRows: data.students.length,
        created: 0,
        skipped: errors.length,
        errors,
      };
    }
    // Process in batches of 50
    const credentials = [];
    let created = 0;
    const BATCH_SIZE = 50;
    for (let batchStart = 0; batchStart < data.students.length; batchStart += BATCH_SIZE) {
      const batch = data.students.slice(batchStart, batchStart + BATCH_SIZE);
      for (let i = 0; i < batch.length; i++) {
        const rowIndex = batchStart + i;
        const row = batch[i];
        // Skip rows that failed validation
        if (errors.some((e) => e.rowIndex === rowIndex)) continue;
        try {
          const password = (0, utils_1.generateTempPassword)();
          const email =
            row.email ??
            `${(0, utils_1.sanitizeRollNumber)(row.rollNumber)}@${data.tenantId}.levelup.internal`;
          // Create Auth account
          let userRecord;
          try {
            userRecord = await admin.auth().createUser({
              email,
              password,
              displayName: `${row.firstName} ${row.lastName}`,
            });
          } catch (err) {
            const firebaseErr = err;
            if (firebaseErr.code === "auth/email-already-exists") {
              userRecord = await admin.auth().getUserByEmail(email);
            } else {
              throw err;
            }
          }
          // Create student entity
          const studentRef = admin
            .firestore()
            .collection(`tenants/${data.tenantId}/students`)
            .doc();
          await studentRef.set({
            id: studentRef.id,
            tenantId: data.tenantId,
            uid: userRecord.uid,
            firstName: row.firstName,
            lastName: row.lastName,
            displayName: `${row.firstName} ${row.lastName}`,
            email: row.email ?? null,
            phone: row.phone ?? null,
            rollNumber: row.rollNumber,
            classIds: row.classId ? [row.classId] : [],
            sectionIds: row.section ? [row.section] : [],
            status: "active",
            createdAt: firestore_1.FieldValue.serverTimestamp(),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
          });
          // Create membership
          const membershipId = `${userRecord.uid}_${data.tenantId}`;
          const membership = {
            id: membershipId,
            uid: userRecord.uid,
            tenantId: data.tenantId,
            tenantCode: tenant.tenantCode,
            role: "student",
            status: "active",
            joinSource: "bulk_import",
            studentId: studentRef.id,
            permissions: {
              managedClassIds: row.classId ? [row.classId] : [],
            },
            createdAt: firestore_1.FieldValue.serverTimestamp(),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
          };
          await admin.firestore().doc(`userMemberships/${membershipId}`).set(membership);
          // Keep the class document's denormalized roster in sync. saveStudent
          // does this too; bulk-import previously skipped it, which caused
          // class.studentCount to diverge from useStudents({ classId }).
          if (row.classId) {
            await admin
              .firestore()
              .doc(`tenants/${data.tenantId}/classes/${row.classId}`)
              .update({
                studentIds: firestore_1.FieldValue.arrayUnion(studentRef.id),
                studentCount: firestore_1.FieldValue.increment(1),
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
              });
          }
          // Set claims
          const claims = (0, utils_1.buildClaimsForMembership)(membership);
          await admin.auth().setCustomUserClaims(userRecord.uid, claims);
          // SECURITY: Password is returned in plaintext to the caller. The caller
          // MUST NOT log or persist this response. Credentials should be distributed
          // securely and the response discarded immediately after use.
          credentials.push({ rollNumber: row.rollNumber, password });
          created++;
          // Handle parent if provided
          if (row.parentEmail) {
            await createParentForStudent(data.tenantId, tenant.tenantCode, studentRef.id, row);
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          errors.push({ rowIndex, rollNumber: row.rollNumber, error: errorMsg });
        }
      }
    }
    // Update tenant stats and usage counters
    if (created > 0) {
      await admin
        .firestore()
        .doc(`tenants/${data.tenantId}`)
        .update({
          "stats.totalStudents": firestore_1.FieldValue.increment(created),
          updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
      await (0, usage_1.incrementUsage)(data.tenantId, "currentStudents", created);
    }
    v2_1.logger.info(
      `Bulk import for tenant ${data.tenantId}: ${created} created, ${errors.length} errors`
    );
    await (0, utils_1.logTenantAction)(data.tenantId, callerUid, "bulkImportStudents", {
      totalRows: data.students.length,
      created,
      errors: errors.length,
    });
    await (0, utils_1.writePlatformActivity)(
      "users_bulk_imported",
      callerUid,
      {
        totalRows: data.students.length,
        created,
        errors: errors.length,
      },
      data.tenantId
    );
    // Send notification to the admin who triggered the import
    try {
      const { sendNotification } = await Promise.resolve().then(() =>
        __importStar(require("../notifications/notification-sender"))
      );
      await sendNotification({
        tenantId: data.tenantId,
        recipientId: callerUid,
        recipientRole: "tenantAdmin",
        type: "bulk_import_complete",
        title: "Bulk Import Complete",
        body: `Imported ${created} students successfully${errors.length > 0 ? ` with ${errors.length} errors` : ""}.`,
        actionUrl: "/users",
      });
    } catch (err) {
      v2_1.logger.warn("Failed to send bulk import notification:", err);
    }
    // Upload credentials to Cloud Storage with a short-lived signed URL
    // instead of returning plaintext credentials in the response body
    let credentialsUrl;
    let credentialsExpiresAt;
    if (credentials.length > 0) {
      try {
        const bucket = admin.storage().bucket();
        const timestamp = Date.now();
        const filePath = `exports/${data.tenantId}/credentials-${timestamp}.csv`;
        const file = bucket.file(filePath);
        // Build CSV content
        const csvHeader = "rollNumber,password\n";
        const csvRows = credentials.map((c) => `${c.rollNumber},${c.password}`).join("\n");
        const deleteAfter = new Date(Date.now() + 10 * 60 * 1000).toISOString();
        await file.save(csvHeader + csvRows, {
          contentType: "text/csv",
          metadata: {
            cacheControl: "no-store",
            metadata: { deleteAfter },
          },
        });
        // Generate signed URL that expires in 5 minutes
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
        const [signedUrl] = await file.getSignedUrl({
          action: "read",
          expires: expiresAt,
        });
        credentialsUrl = signedUrl;
        credentialsExpiresAt = expiresAt.toISOString();
        v2_1.logger.info(
          `Bulk import credentials for tenant ${data.tenantId} uploaded to Cloud Storage (${credentials.length} entries, expires ${expiresAt.toISOString()})`
        );
      } catch (storageErr) {
        v2_1.logger.error("Failed to upload credentials to Cloud Storage:", storageErr);
        // Fallback: warn but don't fail the import
      }
    }
    return {
      totalRows: data.students.length,
      created,
      skipped: errors.length,
      errors,
      credentialsUrl,
      credentialsExpiresAt,
    };
  }
);
async function createParentForStudent(tenantId, tenantCode, studentId, row) {
  if (!row.parentEmail) return;
  // Find or create parent Auth account
  let parentRecord;
  try {
    parentRecord = await admin.auth().getUserByEmail(row.parentEmail);
  } catch {
    parentRecord = await admin.auth().createUser({
      email: row.parentEmail,
      displayName: `${row.parentFirstName ?? ""} ${row.parentLastName ?? ""}`.trim(),
    });
  }
  // Check if parent membership already exists
  const parentMembershipId = `${parentRecord.uid}_${tenantId}`;
  const existingMembership = await admin
    .firestore()
    .doc(`userMemberships/${parentMembershipId}`)
    .get();
  if (existingMembership.exists) {
    // Add student to existing parent's linked students
    await existingMembership.ref.update({
      parentLinkedStudentIds: firestore_1.FieldValue.arrayUnion(studentId),
      updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    return;
  }
  // Create parent entity
  const parentRef = admin.firestore().collection(`tenants/${tenantId}/parents`).doc();
  await parentRef.set({
    id: parentRef.id,
    tenantId,
    authUid: parentRecord.uid,
    firstName: row.parentFirstName ?? "",
    lastName: row.parentLastName ?? "",
    email: row.parentEmail,
    phone: row.parentPhone ?? null,
    linkedStudentIds: [studentId],
    status: "active",
    createdAt: firestore_1.FieldValue.serverTimestamp(),
    updatedAt: firestore_1.FieldValue.serverTimestamp(),
  });
  // Create parent membership
  await admin
    .firestore()
    .doc(`userMemberships/${parentMembershipId}`)
    .set({
      id: parentMembershipId,
      uid: parentRecord.uid,
      tenantId,
      tenantCode,
      role: "parent",
      status: "active",
      joinSource: "bulk_import",
      parentId: parentRef.id,
      parentLinkedStudentIds: [studentId],
      createdAt: firestore_1.FieldValue.serverTimestamp(),
      updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
  await (0, utils_1.updateTenantStats)(tenantId, "parent", "increment");
}
//# sourceMappingURL=bulk-import-students.js.map
