/**
 * Canonical Storage transport-edge capability (DP-1 / transport-realtime §3.7).
 *
 * The ONE home for the client Storage seam types. The only implementer
 * (`@levelup/transport-firebase`) and the api-client (which re-exposes it on the
 * `ApiClient.storage` surface) reference these shapes — no hand-copied drift.
 *
 * api-contract is DOM/Node-lib-free (`lib: ES2020`), so the blob variant is a
 * minimal STRUCTURAL stand-in: a DOM/Node `Blob` (and `File`) satisfies it
 * without pulling the DOM lib into the wire contract.
 */
import type { ReqOf, ResOf } from "../registry.js";

/** Structural stand-in for a binary blob (a DOM/Node `Blob`/`File` satisfies it). */
export interface BinaryBlobLike {
  readonly size: number;
  readonly type: string;
  arrayBuffer(): Promise<ArrayBuffer>;
}

/** Signed-PUT upload input (the only client Storage write mechanism, §3.7). */
export interface UploadBytesInput {
  /** The signed PUT URL returned by `v1.autograde.requestUploadUrl` et al. */
  uploadUrl: string;
  /** The raw bytes to PUT (Blob/File in browsers, Uint8Array/ArrayBuffer elsewhere). */
  bytes: BinaryBlobLike | ArrayBuffer | Uint8Array;
  /** Content-Type the signed URL was minted for (must match the sign-time pin). */
  contentType: string;
}

/**
 * Storage capability — the ONLY client Storage site (§3.7). `requestUploadUrl` is
 * a thin alias over the `v1.autograde.requestUploadUrl` callable (so it rides the
 * same `invoke` path / ID-token forwarding); `uploadImage` consumes the signed
 * PUT URL with a direct `fetch`.
 */
export interface StorageTransport {
  /** Request a signed PUT URL via the `requestUploadUrl` callable (no `tenantId`). */
  requestUploadUrl(
    data: ReqOf<"v1.autograde.requestUploadUrl">
  ): Promise<ResOf<"v1.autograde.requestUploadUrl">>;
  /** Consume a signed PUT URL: uploads bytes, resolves once the object is stored. */
  uploadImage(input: UploadBytesInput): Promise<void>;
}
