/**
 * `createStorageTransport` (PLAN §3.7 Storage seam C1 — MERGE-C9-ORPHANED).
 *
 * The ONLY client Storage site. Canonical mechanism: **signed PUT URL** (server-
 * enforced path scope, REST-ready). Two operations:
 *
 *   1. `requestUploadUrl(input)` — a thin alias over the `v1.autograde.requestUploadUrl`
 *      callable, so it rides the same `invoke` path (ID-token forwarded, NO tenantId
 *      in the body; the server validates `studentId/classId ∈ ctx` / `uid===ctx.uid`
 *      and pins TTL ≤10 min + contentType + max-bytes at sign time).
 *   2. `uploadImage({uploadUrl, bytes, contentType})` — consumes the signed PUT URL
 *      with a direct `PUT`. A signed PUT is a plain HTTP upload (no firebase/storage
 *      SDK round-trip), but the `FirebaseStorage` service is wired so emulator/host
 *      resolution stays single-sourced through this package (principle 3).
 *
 * The byte-upload precedes `uploadAnswerSheets`, sharing one `idempotencyKey`; orphan
 * paths are swept server-side. Never optimistic.
 */
import type { FirebaseStorage } from "firebase/storage";
import type { Functions } from "firebase/functions";
import type { ResOf } from "@levelup/api-contract";
import type { StorageTransport, UploadBytesInput } from "../transport-contract.js";
import { invokeViaCallable } from "../invoke/invoke-via-callable.js";

export interface StorageTransportDeps {
  functions: Functions;
  /** Reserved for emulator/host resolution + future resumable uploads. */
  storage: FirebaseStorage;
}

function toBodyInit(bytes: Blob | ArrayBuffer | Uint8Array): BodyInit {
  // Blob and ArrayBuffer are valid BodyInit; a Uint8Array view is forwarded as-is
  // (its underlying buffer is the wire payload for the signed PUT).
  if (bytes instanceof Uint8Array) return bytes as unknown as BodyInit;
  return bytes as BodyInit;
}

export function createStorageTransport(deps: StorageTransportDeps): StorageTransport {
  return {
    requestUploadUrl(data): Promise<ResOf<"v1.autograde.requestUploadUrl">> {
      // Rides the callable path: ID token forwarded, no tenantId in the body.
      return invokeViaCallable(deps.functions, "v1.autograde.requestUploadUrl", data);
    },

    async uploadImage(input: UploadBytesInput): Promise<void> {
      const res = await fetch(input.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": input.contentType },
        body: toBodyInit(input.bytes),
      });
      if (!res.ok) {
        throw new Error(
          `[transport-firebase] signed-PUT upload failed: ${res.status} ${res.statusText}`
        );
      }
    },
  };
}
