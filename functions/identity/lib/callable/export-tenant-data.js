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
exports.exportTenantData = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const v2_1 = require("firebase-functions/v2");
const domain_1 = require("@levelup/domain");
const wire_1 = require("../contracts/wire");
const utils_1 = require("../utils");
const rate_limit_1 = require("../utils/rate-limit");
/**
 * exportTenantData — Export tenant subcollection data as JSON or CSV.
 * Generates a file in Cloud Storage and returns a signed download URL.
 */
exports.exportTenantData = (0, https_1.onCall)(
  {
    region: "asia-south1",
    timeoutSeconds: 300,
    memory: "512MiB",
    cors: true,
  },
  async (request) => {
    const callerUid = request.auth?.uid;
    if (!callerUid) throw new https_1.HttpsError("unauthenticated", "Must be logged in");
    const data = (0, utils_1.parseRequest)(request.data, wire_1.ExportTenantDataRequestSchema);
    await (0, utils_1.assertTenantAdminOrSuperAdmin)(callerUid, data.tenantId);
    await (0, rate_limit_1.enforceRateLimit)(data.tenantId, callerUid, "write", 5);
    if (data.collections.length === 0) {
      throw new https_1.HttpsError("invalid-argument", "At least one collection must be specified");
    }
    const db = admin.firestore();
    const exportData = {};
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
    let fileContent;
    let contentType;
    let extension;
    if (data.format === "json") {
      fileContent = JSON.stringify(exportData, null, 2);
      contentType = "application/json";
      extension = "json";
    } else {
      // CSV: flatten each collection into a separate CSV section
      const csvSections = [];
      for (const [collectionName, records] of Object.entries(exportData)) {
        if (records.length === 0) continue;
        const headers = Object.keys(records[0]);
        const rows = records.map((record) =>
          headers
            .map((h) => {
              const val = record[h];
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
    v2_1.logger.info(`Exported ${totalRecords} records for tenant ${data.tenantId}`);
    await (0, utils_1.logTenantAction)(data.tenantId, callerUid, "exportTenantData", {
      format: data.format,
      collections: data.collections,
      totalRecords,
    });
    return {
      downloadUrl: signedUrl,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      recordCount: totalRecords,
    };
  }
);
/**
 * B8: exported timestamps are canonical ISO strings. Collapse every timestamp
 * encoding at rest — old-format Firestore `Timestamp` objects, serialized
 * `{_seconds,_nanoseconds}`, plain `{seconds,nanoseconds}` — through domain
 * `toTimestamp()`. New-format docs already hold ISO strings and pass through.
 */
function convertTimestamps(obj) {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value && typeof value === "object" && !Array.isArray(value) && isTimestampLike(value)) {
      result[key] = (0, domain_1.toTimestamp)(value);
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      result[key] = convertTimestamps(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}
/** Detect any Firestore-timestamp encoding (admin object, serialized, or plain). */
function isTimestampLike(value) {
  return (
    typeof value.toDate === "function" ||
    ("_seconds" in value && "_nanoseconds" in value) ||
    ("seconds" in value && "nanoseconds" in value) ||
    typeof value.toMillis === "function"
  );
}
//# sourceMappingURL=export-tenant-data.js.map
