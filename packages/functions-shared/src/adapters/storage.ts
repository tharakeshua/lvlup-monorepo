/**
 * Admin-SDK signed-upload-URL signer (SDK-LAYERS-PLAN §3.7 Storage seam C1) —
 * the concrete `StorageSignerPort` behind `ctx.storage.signUploadUrl`. The
 * service (`requestUploadUrlService`) computes the tenant-scoped path
 * (`buildScopedPath`) and enforces authorization; this adapter ONLY signs.
 *
 * V4 signed PUT, contentType-bound (the client MUST send the same Content-Type
 * header or GCS rejects the upload), short TTL (the service passes 15 min; V4
 * caps at 7 days). Signing uses the IAM signBlob flow under the runtime service
 * account, which therefore needs `roles/iam.serviceAccountTokenCreator` on
 * itself plus object-write access on the bucket.
 */
import { getStorage } from "firebase-admin/storage";
import type { StorageSignerPort } from "../context/ports.js";

/**
 * Build the signer over the DEFAULT bucket (from `FIREBASE_CONFIG` in the
 * Functions runtime — the same bucket the legacy upload callables use), or an
 * explicit bucket name.
 */
export function createAdminStorageSigner(bucketName?: string): StorageSignerPort {
  return {
    async signUploadUrl(path: string, contentType: string, ttlMs: number): Promise<string> {
      const bucket = bucketName ? getStorage().bucket(bucketName) : getStorage().bucket();
      const [url] = await bucket.file(path).getSignedUrl({
        version: "v4",
        action: "write",
        expires: Date.now() + ttlMs,
        contentType,
      });
      return url;
    },
  };
}
