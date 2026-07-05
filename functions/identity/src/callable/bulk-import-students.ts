import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { isoNow } from "@levelup/domain";
import { BulkImportStudentsRequestSchema } from "../contracts/wire";
import {
  assertTenantAdminOrSuperAdmin,
  getTenant,
  sanitizeRollNumber,
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
import { incrementUsage } from "../utils/usage";
import type { UserMembership } from "../contracts/legacy-docs";

interface StudentImportRow {
  firstName: string;
  lastName: string;
  rollNumber: string;
  email?: string;
  phone?: string;
  classId?: string;
  className?: string;
  section?: string;
  parentFirstName?: string;
  parentLastName?: string;
  parentEmail?: string;
  parentPhone?: string;
}

interface BulkImportRequest {
  tenantId: string;
  students: StudentImportRow[];
  dryRun: boolean;
}

interface ImportError {
  rowIndex: number;
  rollNumber: string;
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
 * Callable: Bulk-imports students from parsed CSV data.
 * Supports dry-run validation and parent auto-creation.
 *
 * Config: 540s timeout, 1GiB memory for large imports.
 */
export const bulkImportStudents = onCall(
  {
    region: "asia-south1",
    timeoutSeconds: 540,
    memory: "1GiB",
    cors: true,
  },
  async (request) => {
    const callerUid = request.auth?.uid;
    const data = parseRequest(request.data, BulkImportStudentsRequestSchema);

    await assertTenantAdminOrSuperAdmin(callerUid, data.tenantId);

    await enforceRateLimit(data.tenantId, callerUid!, "write", 5);

    // Check that bulk import feature is enabled for this tenant
    await assertFeatureEnabled(data.tenantId, "bulkImportEnabled");

    const tenant = await getTenant(data.tenantId);
    if (!tenant || tenant.status !== "active") {
      throw new HttpsError("not-found", "Tenant not found or inactive");
    }

    if (data.students.length > 500) {
      throw new HttpsError("invalid-argument", "Maximum 500 rows per import");
    }

    // Validate all rows
    const errors: ImportError[] = [];
    const seenRollNumbers = new Set<string>();

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
      await assertQuota(data.tenantId, "student", validRowCount);
    }

    if (data.dryRun) {
      return {
        totalRows: data.students.length,
        created: 0,
        skipped: errors.length,
        errors,
      } satisfies BulkImportResult;
    }

    // Process in batches of 50
    const credentials: { rollNumber: string; password: string }[] = [];
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
          const password = generateTempPassword();
          const email =
            row.email ?? `${sanitizeRollNumber(row.rollNumber)}@${data.tenantId}.levelup.internal`;

          // Create Auth account
          let userRecord: admin.auth.UserRecord;
          try {
            userRecord = await admin.auth().createUser({
              email,
              password,
              displayName: `${row.firstName} ${row.lastName}`,
            });
          } catch (err: unknown) {
            const firebaseErr = err as { code?: string };
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
            role: "student",
            status: "active",
            joinSource: "bulk_import",
            studentId: studentRef.id,
            permissions: {
              managedClassIds: row.classId ? [row.classId] : [],
            },
            createdAt: isoNow(),
            updatedAt: isoNow(),
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
                studentIds: FieldValue.arrayUnion(studentRef.id),
                studentCount: FieldValue.increment(1),
                updatedAt: isoNow(),
              });
          }

          // Set claims
          const claims = buildClaimsForMembership(membership);
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
        } catch (err: unknown) {
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
          "stats.totalStudents": FieldValue.increment(created),
          updatedAt: isoNow(),
        });
      await incrementUsage(data.tenantId, "currentStudents", created);
    }

    logger.info(
      `Bulk import for tenant ${data.tenantId}: ${created} created, ${errors.length} errors`
    );

    await logTenantAction(data.tenantId, callerUid!, "bulkImportStudents", {
      totalRows: data.students.length,
      created,
      errors: errors.length,
    });

    await writePlatformActivity(
      "users_bulk_imported",
      callerUid!,
      {
        totalRows: data.students.length,
        created,
        errors: errors.length,
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
        title: "Bulk Import Complete",
        body: `Imported ${created} students successfully${errors.length > 0 ? ` with ${errors.length} errors` : ""}.`,
        actionUrl: "/users",
      });
    } catch (err) {
      logger.warn("Failed to send bulk import notification:", err);
    }

    // Upload credentials to Cloud Storage with a short-lived signed URL
    // instead of returning plaintext credentials in the response body
    let credentialsUrl: string | undefined;
    let credentialsExpiresAt: string | undefined;

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

        logger.info(
          `Bulk import credentials for tenant ${data.tenantId} uploaded to Cloud Storage (${credentials.length} entries, expires ${expiresAt.toISOString()})`
        );
      } catch (storageErr) {
        logger.error("Failed to upload credentials to Cloud Storage:", storageErr);
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
    } satisfies BulkImportResult;
  }
);

async function createParentForStudent(
  tenantId: string,
  tenantCode: string,
  studentId: string,
  row: StudentImportRow
): Promise<void> {
  if (!row.parentEmail) return;

  // Find or create parent Auth account
  let parentRecord: admin.auth.UserRecord;
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
      parentLinkedStudentIds: FieldValue.arrayUnion(studentId),
      updatedAt: isoNow(),
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
    createdAt: isoNow(),
    updatedAt: isoNow(),
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
      createdAt: isoNow(),
      updatedAt: isoNow(),
    });

  await updateTenantStats(tenantId, "parent", "increment");
}
