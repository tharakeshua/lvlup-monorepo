/**
 * uploadTenantAsset — Generates a signed upload URL for tenant branding assets.
 *
 * Accepts { tenantId, assetType, contentType } and returns { uploadUrl, publicUrl }.
 * The client uploads directly to Cloud Storage using the signed URL.
 */

import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { assertTenantAdminOrSuperAdmin, parseRequest } from "../utils";
import { enforceRateLimit } from "../utils/rate-limit";
import { z } from "zod";

const ALLOWED_CONTENT_TYPES = new Set(["image/png", "image/jpeg", "image/svg+xml", "image/webp"]);

const CONTENT_TYPE_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/svg+xml": "svg",
  "image/webp": "webp",
};

const UploadTenantAssetSchema = z.object({
  tenantId: z.string().min(1),
  assetType: z.enum(["logo", "banner", "favicon"]),
  contentType: z.string().min(1),
});

export const uploadTenantAsset = onCall({ region: "asia-south1", cors: true }, async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError("unauthenticated", "Must be logged in");

  const data = parseRequest(request.data, UploadTenantAssetSchema);

  await assertTenantAdminOrSuperAdmin(callerUid, data.tenantId);
  await enforceRateLimit(data.tenantId, callerUid, "write", 10);

  if (!ALLOWED_CONTENT_TYPES.has(data.contentType)) {
    throw new HttpsError(
      "invalid-argument",
      `Invalid content type: ${data.contentType}. Allowed: ${Array.from(ALLOWED_CONTENT_TYPES).join(", ")}`
    );
  }

  const ext = CONTENT_TYPE_TO_EXT[data.contentType] ?? "png";
  const timestamp = Date.now();
  const filePath = `tenants/${data.tenantId}/branding/${data.assetType}-${timestamp}.${ext}`;

  const bucket = admin.storage().bucket();
  const file = bucket.file(filePath);

  // Generate signed URL for upload (15 min expiry)
  const [uploadUrl] = await file.getSignedUrl({
    version: "v4",
    action: "write",
    expires: Date.now() + 15 * 60 * 1000,
    contentType: data.contentType,
  });

  // The public URL (assumes default bucket with public access or Firebase Storage URL)
  const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;

  return { uploadUrl, publicUrl };
});
