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
exports.bulkImportTeachers = void 0;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const v2_1 = require("firebase-functions/v2");
const domain_1 = require("@levelup/domain");
const legacy_docs_1 = require("../contracts/legacy-docs");
const utils_1 = require("../utils");
const rate_limit_1 = require("../utils/rate-limit");
const zod_1 = require("zod");
const MAX_SHORT_TEXT = 200;
const firestoreId = zod_1.z
  .string()
  .min(1)
  .max(1500)
  .regex(/^[^/]+$/);
const BulkImportTeachersRequestSchema = zod_1.z.object({
  tenantId: firestoreId,
  teachers: zod_1.z
    .array(
      zod_1.z.object({
        firstName: zod_1.z.string().min(1).max(MAX_SHORT_TEXT),
        lastName: zod_1.z.string().min(1).max(MAX_SHORT_TEXT),
        email: zod_1.z.string().email().max(MAX_SHORT_TEXT),
        subjects: zod_1.z.string().max(1000).optional(),
        designation: zod_1.z.string().max(MAX_SHORT_TEXT).optional(),
      })
    )
    .max(200, "Maximum 200 teachers per import"),
  dryRun: zod_1.z.boolean(),
});
/**
 * Callable: Bulk-imports teachers from parsed CSV data.
 * Supports dry-run validation.
 *
 * Config: 540s timeout, 1GiB memory for large imports.
 */
exports.bulkImportTeachers = (0, https_1.onCall)(
  {
    region: "asia-south1",
    timeoutSeconds: 540,
    memory: "1GiB",
    cors: true,
  },
  async (request) => {
    const callerUid = request.auth?.uid;
    const data = (0, utils_1.parseRequest)(request.data, BulkImportTeachersRequestSchema);
    await (0, utils_1.assertTenantAdminOrSuperAdmin)(callerUid, data.tenantId);
    await (0, rate_limit_1.enforceRateLimit)(data.tenantId, callerUid, "write", 5);
    // Check that bulk import feature is enabled for this tenant
    await (0, utils_1.assertFeatureEnabled)(data.tenantId, "bulkImportEnabled");
    const tenant = await (0, utils_1.getTenant)(data.tenantId);
    if (!tenant || tenant.status !== "active") {
      throw new https_1.HttpsError("not-found", "Tenant not found or inactive");
    }
    if (data.teachers.length > 200) {
      throw new https_1.HttpsError("invalid-argument", "Maximum 200 rows per import");
    }
    // Validate all rows
    const errors = [];
    const seenEmails = new Set();
    for (let i = 0; i < data.teachers.length; i++) {
      const row = data.teachers[i];
      if (!row.firstName || !row.lastName) {
        errors.push({
          rowIndex: i,
          email: row.email ?? "",
          error: "firstName and lastName required",
        });
        continue;
      }
      if (!row.email) {
        errors.push({ rowIndex: i, email: "", error: "email required" });
        continue;
      }
      if (seenEmails.has(row.email.toLowerCase())) {
        errors.push({ rowIndex: i, email: row.email, error: "Duplicate email in batch" });
        continue;
      }
      seenEmails.add(row.email.toLowerCase());
    }
    // Check subscription limit using centralized quota enforcement
    const validRowCount = data.teachers.length - errors.length;
    if (validRowCount > 0) {
      await (0, utils_1.assertQuota)(data.tenantId, "teacher", validRowCount);
    }
    if (data.dryRun) {
      return {
        totalRows: data.teachers.length,
        created: 0,
        skipped: errors.length,
        errors,
      };
    }
    // Process in batches of 50
    const credentials = [];
    let created = 0;
    const BATCH_SIZE = 50;
    for (let batchStart = 0; batchStart < data.teachers.length; batchStart += BATCH_SIZE) {
      const batch = data.teachers.slice(batchStart, batchStart + BATCH_SIZE);
      for (let i = 0; i < batch.length; i++) {
        const rowIndex = batchStart + i;
        const row = batch[i];
        // Skip rows that failed validation
        if (errors.some((e) => e.rowIndex === rowIndex)) continue;
        try {
          const password = (0, utils_1.generateTempPassword)();
          // Create Auth account
          let userRecord;
          try {
            userRecord = await admin.auth().createUser({
              email: row.email,
              password,
              displayName: `${row.firstName} ${row.lastName}`,
            });
          } catch (err) {
            const firebaseErr = err;
            if (firebaseErr.code === "auth/email-already-exists") {
              userRecord = await admin.auth().getUserByEmail(row.email);
            } else {
              throw err;
            }
          }
          // Parse subjects from comma-separated string
          const subjects = row.subjects
            ? row.subjects
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
            : [];
          // Create teacher entity
          const teacherRef = admin
            .firestore()
            .collection(`tenants/${data.tenantId}/teachers`)
            .doc();
          await teacherRef.set({
            id: teacherRef.id,
            tenantId: data.tenantId,
            uid: userRecord.uid,
            firstName: row.firstName,
            lastName: row.lastName,
            displayName: `${row.firstName} ${row.lastName}`,
            email: row.email,
            subjects,
            designation: row.designation ?? null,
            classIds: [],
            status: "active",
            // B8: timestamps at rest are canonical ISO strings.
            createdAt: (0, domain_1.isoNow)(),
            updatedAt: (0, domain_1.isoNow)(),
          });
          // Create membership
          const membershipId = `${userRecord.uid}_${data.tenantId}`;
          const membership = {
            id: membershipId,
            uid: userRecord.uid,
            tenantId: data.tenantId,
            tenantCode: tenant.tenantCode,
            role: "teacher",
            status: "active",
            joinSource: "bulk_import",
            teacherId: teacherRef.id,
            permissions: legacy_docs_1.DEFAULT_TEACHER_PERMISSIONS,
            createdAt: (0, domain_1.isoNow)(),
            updatedAt: (0, domain_1.isoNow)(),
          };
          await admin.firestore().doc(`userMemberships/${membershipId}`).set(membership);
          // Set claims
          const claims = (0, utils_1.buildClaimsForMembership)(membership);
          await admin.auth().setCustomUserClaims(userRecord.uid, claims);
          credentials.push({ email: row.email, password });
          created++;
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          errors.push({ rowIndex, email: row.email, error: errorMsg });
        }
      }
    }
    // Update tenant stats
    if (created > 0) {
      await admin
        .firestore()
        .doc(`tenants/${data.tenantId}`)
        .update({
          "stats.totalTeachers": firestore_1.FieldValue.increment(created),
          updatedAt: (0, domain_1.isoNow)(),
        });
    }
    v2_1.logger.info(
      `Bulk teacher import for tenant ${data.tenantId}: ${created} created, ${errors.length} errors`
    );
    await (0, utils_1.logTenantAction)(data.tenantId, callerUid, "bulkImportTeachers", {
      totalRows: data.teachers.length,
      created,
      errors: errors.length,
    });
    await (0, utils_1.writePlatformActivity)(
      "users_bulk_imported",
      callerUid,
      {
        totalRows: data.teachers.length,
        created,
        errors: errors.length,
        entityType: "teacher",
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
        title: "Bulk Teacher Import Complete",
        body: `Imported ${created} teachers successfully${errors.length > 0 ? ` with ${errors.length} errors` : ""}.`,
        actionUrl: "/users",
      });
    } catch (err) {
      v2_1.logger.warn("Failed to send bulk import notification:", err);
    }
    // Upload credentials to Cloud Storage with a short-lived signed URL
    let credentialsUrl;
    let credentialsExpiresAt;
    if (credentials.length > 0) {
      try {
        const bucket = admin.storage().bucket();
        const timestamp = Date.now();
        const filePath = `exports/${data.tenantId}/teacher-credentials-${timestamp}.csv`;
        const file = bucket.file(filePath);
        // Build CSV content
        const csvHeader = "email,password\n";
        const csvRows = credentials.map((c) => `${c.email},${c.password}`).join("\n");
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
          `Bulk teacher import credentials for tenant ${data.tenantId} uploaded to Cloud Storage (${credentials.length} entries, expires ${expiresAt.toISOString()})`
        );
      } catch (storageErr) {
        v2_1.logger.error("Failed to upload credentials to Cloud Storage:", storageErr);
      }
    }
    return {
      totalRows: data.teachers.length,
      created,
      skipped: errors.length,
      errors,
      credentialsUrl,
      credentialsExpiresAt,
    };
  }
);
//# sourceMappingURL=bulk-import-teachers.js.map
