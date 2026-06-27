/**
 * `storageRepo` (C1 — SDK-LAYERS-PLAN §3.7, §4.1, §9.1 C1). The client Storage
 * brain: it never touches `firebase/storage` directly — it drives the
 * api-client's `storage` capability (whose only impl, `transport-firebase`, is
 * the sole client firebase/storage site).
 *
 * Canonical mechanism: **signed PUT URL**. `requestUploadUrl` invokes the
 * server signing op (server pins path scope ⊂ `tenants/{ctx.tenantId}/…`,
 * TTL ≤10 min, `contentType` + max-bytes — §3.7); `uploadImage` performs the
 * two-step grant→PUT, returning the server-scoped `StoragePath` callers persist
 * (e.g. `Exam.questionPaperImages`, `Submission.imageUrls`). **Never optimistic.**
 *
 * `resolveStoragePath` derives the persisted path from a grant once (the one
 * derived field). `canUpload` is a pure pre-check (non-empty contentType) for
 * button-disable UX — the server is authoritative.
 */
import type {
  ApiClientSeam,
  RequestUploadUrlInput,
  UploadUrlGrant,
  UploadBody,
  StoragePath,
} from "./seam.js";

/** `uploadImage` input — the signing request plus the bytes to PUT. */
export interface UploadImageInput extends RequestUploadUrlInput {
  body: UploadBody;
}

export interface StorageRepo {
  /** Step 1: ask the server for a scoped signed-PUT grant (no bytes yet). */
  requestUploadUrl(input: RequestUploadUrlInput): Promise<UploadUrlGrant>;
  /** Steps 1+2: request a grant then PUT bytes; resolves the persisted path. */
  uploadImage(input: UploadImageInput): Promise<StoragePath>;
  /** Derived: the server-scoped path to persist from a grant (computed once). */
  resolveStoragePath(grant: UploadUrlGrant): StoragePath;
  /** Pure UX pre-check — a non-empty contentType is required (no wire call). */
  canUpload(input: Pick<RequestUploadUrlInput, "contentType">): boolean;
}

export function createStorageRepo(api: ApiClientSeam): StorageRepo {
  return {
    requestUploadUrl: (input) => api.storage.requestUploadUrl(input),
    async uploadImage(input) {
      const { body, ...signing } = input;
      const grant = await api.storage.requestUploadUrl(signing);
      await api.storage.upload(grant.uploadUrl, body, signing.contentType);
      return grant.path;
    },
    resolveStoragePath: (grant) => grant.path,
    canUpload: (input) => input.contentType.trim().length > 0,
  };
}
