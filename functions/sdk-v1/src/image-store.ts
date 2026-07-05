/**
 * Concrete Admin-SDK `AiImageStore` (FIX-3 — the composition-root half of the
 * FIX-1 storagePath→bytes seam). Services pass `{ storagePath }` image refs;
 * the ai gateway resolves them to inline base64 through this store immediately
 * before the provider call. `@levelup/ai` never imports `firebase-admin`, so
 * the bucket wrap lives HERE, next to `createAdminStorageSigner` in spirit.
 *
 * Paths are used VERBATIM and are bucket-relative (`tenants/…` — the exact
 * shape `buildScopedPath` grants and `signUploadUrl` signs), read from the
 * DEFAULT bucket (`FIREBASE_CONFIG` in the Functions runtime — the same bucket
 * the signer writes to) unless an explicit bucket name is given. `contentType`
 * comes from object metadata (`getMetadata()`); when absent the gateway falls
 * back to extension inference (`inferMimeType`).
 */
import { getStorage } from "firebase-admin/storage";
import type { AiImageStore } from "@levelup/ai";

/**
 * Build the read-side store over the default bucket (or an explicit one),
 * symmetric with `createAdminStorageSigner(bucketName?)`.
 */
export function createAdminImageStore(bucketName?: string): AiImageStore {
  return {
    async read(path: string): Promise<{ bytes: Uint8Array; contentType?: string }> {
      const bucket = bucketName ? getStorage().bucket(bucketName) : getStorage().bucket();
      const file = bucket.file(path);
      // Bytes + metadata in one round-trip pair; a missing object rejects both,
      // and the gateway surfaces that as a non-retryable PRECONDITION_FAILED.
      const [[bytes], [metadata]] = await Promise.all([file.download(), file.getMetadata()]);
      const contentType = (metadata as { contentType?: string } | undefined)?.contentType;
      return contentType ? { bytes, contentType } : { bytes };
    },
  };
}
