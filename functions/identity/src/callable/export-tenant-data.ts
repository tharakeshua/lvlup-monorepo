import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { toTimestamp } from "@levelup/domain";
import type { TimestampInput } from "@levelup/domain";
import { ExportTenantDataRequestSchema } from "../contracts/wire";
import type { ExportTenantDataResponse } from "../contracts/wire";
import { getUser, assertTenantAdminOrSuperAdmin, parseRequest, logTenantAction } from "../utils";
import { enforceRateLimit } from "../utils/rate-limit";

/**
 * exportTenantData — Export tenant subcollection data as JSON or CSV.
 * Generates a file in Cloud Storage and returns a signed download URL.
 */
export const exportTenantData = onCall(
  {
    region: "asia-south1",
    timeoutSeconds: 300,
    memory: "512MiB",
    cors: true,
  },
  async (request) => {
    const callerUid = request.auth?.uid;
    if (!callerUid) throw new HttpsError("unauthenticated", "Must be logged in");

    const data = parseRequest(request.data, ExportTenantDataRequestSchema);

    await assertTenantAdminOrSuperAdmin(callerUid, data.tenantId);
    await enforceRateLimit(data.tenantId, callerUid, "write", 5);

    if (data.collections.length === 0) {
      throw new HttpsError("invalid-argument", "At least one collection must be specified");
    }

    const db = admin.firestore();
    const exportData: Record<string, unknown[]> = {};
    let totalRecords = 0;

    for (const collectionName of data.collections) {
      const snap = await db.collection(`tenants/${data.tenantId}/${collectionName}`).get();

      exportData[collectionName] = snap.docs.map((doc) => {
        const docData = doc.data();
        // Convert Firestore timestamps to ISO strings for export
        return convertTimestamps(docData);
      });
      totalRecords += snap.size;
    }

    // Generate file content
    let fileContent: string;
    let contentType: string;
    let extension: string;

    if (data.format === "json") {
      fileContent = JSON.stringify(exportData, null, 2);
      contentType = "application/json";
      extension = "json";
    } else {
      // CSV: flatten each collection into a separate CSV section
      const csvSections: string[] = [];
      for (const [collectionName, records] of Object.entries(exportData)) {
        if (records.length === 0) continue;
        const headers = Object.keys(records[0] as Record<string, unknown>);
        const rows = records.map((record) =>
          headers
            .map((h) => {
              const val = (record as Record<string, unknown>)[h];
              const str = typeof val === "object" ? JSON.stringify(val) : String(val ?? "");
              return `"${str.replace(/"/g, '""')}"`;
            })
            .join(",")
        );
        csvSections.push(`# ${collectionName}\n${headers.join(",")}\n${rows.join("\n")}`);
      }
      fileContent = csvSections.join("\n\n");
      contentType = "text/csv";
      extension = "csv";
    }

    // Upload to Cloud Storage
    const bucket = admin.storage().bucket();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filePath = `exports/${data.tenantId}/export-${timestamp}.${extension}`;
    const file = bucket.file(filePath);

    await file.save(fileContent, {
      contentType,
      metadata: {
        tenantId: data.tenantId,
        exportedBy: callerUid,
        collections: data.collections.join(","),
      },
    });

    // Generate signed URL (expires in 1 hour)
    const [signedUrl] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + 60 * 60 * 1000,
    });

    logger.info(`Exported ${totalRecords} records for tenant ${data.tenantId}`);

    await logTenantAction(data.tenantId, callerUid, "exportTenantData", {
      format: data.format,
      collections: data.collections,
      totalRecords,
    });

    return {
      downloadUrl: signedUrl,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      recordCount: totalRecords,
    } satisfies ExportTenantDataResponse;
  }
);

/**
 * B8: exported timestamps are canonical ISO strings. Collapse every timestamp
 * encoding at rest — old-format Firestore `Timestamp` objects, serialized
 * `{_seconds,_nanoseconds}`, plain `{seconds,nanoseconds}` — through domain
 * `toTimestamp()`. New-format docs already hold ISO strings and pass through.
 */
function convertTimestamps(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value && typeof value === "object" && !Array.isArray(value) && isTimestampLike(value)) {
      result[key] = toTimestamp(value as TimestampInput);
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      result[key] = convertTimestamps(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/** Detect any Firestore-timestamp encoding (admin object, serialized, or plain). */
function isTimestampLike(value: object): boolean {
  return (
    typeof (value as { toDate?: unknown }).toDate === "function" ||
    ("_seconds" in value && "_nanoseconds" in value) ||
    ("seconds" in value && "nanoseconds" in value) ||
    typeof (value as { toMillis?: unknown }).toMillis === "function"
  );
}
