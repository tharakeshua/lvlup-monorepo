import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { isoNow } from "@levelup/domain";
import { DEFAULT_TEACHER_PERMISSIONS } from "../contracts/legacy-docs";
import {
  assertTenantAdminOrSuperAdmin,
  getTenant,
  generateTempPassword,
  buildClaimsForMembership,
  updateTenantStats,
  parseRequest,
  assertQuota,
  assertFeatureEnabled,
  logTenantAction,
  writePlatformActivity,
} from "../utils";
import { enforceRateLimit } from "../utils/rate-limit";
import { z } from "zod";
import type { UserMembership } from "../contracts/legacy-docs";

const MAX_SHORT_TEXT = 200;
const firestoreId = z
  .string()
  .min(1)
  .max(1500)
  .regex(/^[^/]+$/);

const BulkImportTeachersRequestSchema = z.object({
  tenantId: firestoreId,
  teachers: z
    .array(
      z.object({
        firstName: z.string().min(1).max(MAX_SHORT_TEXT),
        lastName: z.string().min(1).max(MAX_SHORT_TEXT),
        email: z.string().email().max(MAX_SHORT_TEXT),
        subjects: z.string().max(1000).optional(),
        designation: z.string().max(MAX_SHORT_TEXT).optional(),
      })
    )
    .max(200, "Maximum 200 teachers per import"),
  dryRun: z.boolean(),
});

interface TeacherImportRow {
  firstName: string;
  lastName: string;
  email: string;
  subjects?: string;
  designation?: string;
}

interface ImportError {
  rowIndex: number;
  email: string;
  error: string;
}

interface BulkImportResult {
  totalRows: number;
  created: number;
  skipped: number;
  errors: ImportError[];
  credentialsUrl?: string;
  credentialsExpiresAt?: string;
}

/**
 * Callable: Bulk-imports teachers from parsed CSV data.
 * Supports dry-run validation.
 *
 * Config: 540s timeout, 1GiB memory for large imports.
 */
export const bulkImportTeachers = onCall(
  {
    region: "asia-south1",
    timeoutSeconds: 540,
    memory: "1GiB",
    cors: true,
  },
  async (request) => {
    const callerUid = request.auth?.uid;
    const data = parseRequest(request.data, BulkImportTeachersRequestSchema);

    await assertTenantAdminOrSuperAdmin(callerUid, data.tenantId);

    await enforceRateLimit(data.tenantId, callerUid!, "write", 5);

    // Check that bulk import feature is enabled for this tenant
    await assertFeatureEnabled(data.tenantId, "bulkImportEnabled");

    const tenant = await getTenant(data.tenantId);
    if (!tenant || tenant.status !== "active") {
      throw new HttpsError("not-found", "Tenant not found or inactive");
    }

    if (data.teachers.length > 200) {
      throw new HttpsError("invalid-argument", "Maximum 200 rows per import");
    }

    // Validate all rows
    const errors: ImportError[] = [];
    const seenEmails = new Set<string>();

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
      await assertQuota(data.tenantId, "teacher", validRowCount);
    }

    if (data.dryRun) {
      return {
        totalRows: data.teachers.length,
        created: 0,
        skipped: errors.length,
        errors,
      } satisfies BulkImportResult;
    }

    // Process in batches of 50
    const credentials: { email: string; password: string }[] = [];
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
          const password = generateTempPassword();

          // Create Auth account
          let userRecord: admin.auth.UserRecord;
          try {
            userRecord = await admin.auth().createUser({
              email: row.email,
              password,
              displayName: `${row.firstName} ${row.lastName}`,
            });
          } catch (err: unknown) {
            const firebaseErr = err as { code?: string };
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
            createdAt: isoNow(),
            updatedAt: isoNow(),
          });

          // Create membership
          const membershipId = `${userRecord.uid}_${data.tenantId}`;
          const membership: Omit<UserMembership, "createdAt" | "updatedAt"> &
            Record<string, unknown> = {
            id: membershipId,
            uid: userRecord.uid,
            tenantId: data.tenantId,
            tenantCode: tenant.tenantCode,
            role: "teacher",
            status: "active",
            joinSource: "bulk_import",
            teacherId: teacherRef.id,
            permissions: DEFAULT_TEACHER_PERMISSIONS,
            createdAt: isoNow(),
            updatedAt: isoNow(),
          };

          await admin.firestore().doc(`userMemberships/${membershipId}`).set(membership);

          // Set claims
          const claims = buildClaimsForMembership(membership);
          await admin.auth().setCustomUserClaims(userRecord.uid, claims);

          credentials.push({ email: row.email, password });
          created++;
        } catch (err: unknown) {
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
          "stats.totalTeachers": FieldValue.increment(created),
          updatedAt: isoNow(),
        });
    }

    logger.info(
      `Bulk teacher import for tenant ${data.tenantId}: ${created} created, ${errors.length} errors`
    );

    await logTenantAction(data.tenantId, callerUid!, "bulkImportTeachers", {
      totalRows: data.teachers.length,
      created,
      errors: errors.length,
    });

    await writePlatformActivity(
      "users_bulk_imported",
      callerUid!,
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
      const { sendNotification } = await import("../notifications/notification-sender");
      await sendNotification({
        tenantId: data.tenantId,
        recipientId: callerUid!,
        recipientRole: "tenantAdmin",
        type: "bulk_import_complete",
        title: "Bulk Teacher Import Complete",
        body: `Imported ${created} teachers successfully${errors.length > 0 ? ` with ${errors.length} errors` : ""}.`,
        actionUrl: "/users",
      });
    } catch (err) {
      logger.warn("Failed to send bulk import notification:", err);
    }

    // Upload credentials to Cloud Storage with a short-lived signed URL
    let credentialsUrl: string | undefined;
    let credentialsExpiresAt: string | undefined;

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

        logger.info(
          `Bulk teacher import credentials for tenant ${data.tenantId} uploaded to Cloud Storage (${credentials.length} entries, expires ${expiresAt.toISOString()})`
        );
      } catch (storageErr) {
        logger.error("Failed to upload credentials to Cloud Storage:", storageErr);
      }
    }

    return {
      totalRows: data.teachers.length,
      created,
      skipped: errors.length,
      errors,
      credentialsUrl,
      credentialsExpiresAt,
    } satisfies BulkImportResult;
  }
);
