/**
 * The storage→bytes seam for AI vision calls (server-shared.md §4 / FIX-1 P0-B).
 *
 * Services reference stored images by STORAGE PATH (`{ storagePath }`) — they
 * never download or base64-encode bytes themselves. The GATEWAY resolves every
 * ref to inline base64 via the injected `AiImageStore` immediately before the
 * provider call, so image bytes exist only for the lifetime of one `generate()`
 * and never transit the services layer.
 *
 * The concrete store lives at the composition root (bootstrap) and wraps the
 * Admin SDK: `getStorage().bucket().file(path).download()`. Paths are used
 * VERBATIM — whatever the upload service wrote (v2_ prefix included) — so this
 * seam is prefix-agnostic. `@levelup/ai` never imports `firebase-admin`.
 *
 * Inline-size budget: Gemini's `generateContent` request cap is 20MB and base64
 * inflates raw bytes by 4/3, so we refuse requests whose summed RAW bytes exceed
 * `maxTotalBytes` (default 14MB) with a clear, non-retryable error instead of an
 * opaque provider 4xx. The Gemini Files API is a deliberate NON-goal here: the
 * pinned `@google/generative-ai@0.21` file manager only uploads from filesystem
 * paths (tmp-file writes inside Functions), so oversize batches must be chunked
 * or downscaled by the CALLER (upload-time compression / per-page batching).
 */
import { AiGatewayError } from "../errors.js";
import type { ProviderImage } from "../provider/provider.js";

/** An image as services may pass it: pre-encoded bytes OR a storage path. */
export type AiImageRef = ProviderImage | { storagePath: string; mimeType?: string };

/** Read side of the storage bucket the gateway resolves image paths against. */
export interface AiImageStore {
  /** Download the object at `path` (verbatim) and return its raw bytes. */
  read(path: string): Promise<{ bytes: Uint8Array; contentType?: string }>;
}

/** Raw-byte budget for one request (≈ 20MB Gemini cap ÷ 4/3 base64, w/ headroom). */
export const DEFAULT_MAX_TOTAL_IMAGE_BYTES = 14 * 1024 * 1024;

const EXTENSION_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  gif: "image/gif",
  pdf: "application/pdf",
};

/** Infer a mime type from the path extension; JPEG is the scan-pipeline default. */
export function inferMimeType(path: string): string {
  const ext = path.split("?")[0]?.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_MIME[ext] ?? "image/jpeg";
}

const imageError = (message: string, meta?: Record<string, unknown>): AiGatewayError =>
  new AiGatewayError("PRECONDITION_FAILED", message, { retryable: false, meta });

export interface ResolveImagesOptions {
  store?: AiImageStore;
  maxTotalBytes?: number;
}

/**
 * Resolve mixed image refs into inline `ProviderImage`s. Storage paths are
 * downloaded SEQUENTIALLY (bounded memory growth — never N parallel downloads
 * on top of the accumulating payload) and the summed raw size is enforced
 * against the inline budget so the provider never sees an over-cap request.
 */
export async function resolveImages(
  refs: AiImageRef[] | undefined,
  opts: ResolveImagesOptions = {}
): Promise<ProviderImage[] | undefined> {
  if (!refs || refs.length === 0) return undefined;
  const maxTotal = opts.maxTotalBytes ?? DEFAULT_MAX_TOTAL_IMAGE_BYTES;

  const out: ProviderImage[] = [];
  let totalBytes = 0;

  for (const ref of refs) {
    if ("base64" in ref) {
      // Pre-encoded inline bytes: count the raw size (base64 → ×3/4) toward the budget.
      totalBytes += Math.floor((ref.base64.length * 3) / 4);
      out.push(ref);
    } else {
      if (!opts.store) {
        throw imageError(
          "AI image store is not configured — cannot resolve storagePath image refs. " +
            "Wire `imageStore` into createAiGateway() at the composition root.",
          { storagePath: ref.storagePath }
        );
      }
      let bytes: Uint8Array;
      let contentType: string | undefined;
      try {
        ({ bytes, contentType } = await opts.store.read(ref.storagePath));
      } catch (err) {
        throw imageError(`Failed to read AI image from storage: ${ref.storagePath}`, {
          storagePath: ref.storagePath,
          cause: String((err as Error)?.message ?? err),
        });
      }
      totalBytes += bytes.byteLength;
      out.push({
        base64: Buffer.from(bytes).toString("base64"),
        mimeType: ref.mimeType ?? contentType ?? inferMimeType(ref.storagePath),
      });
    }
    if (totalBytes > maxTotal) {
      throw imageError(
        `Inline image payload exceeds the ${Math.floor(maxTotal / (1024 * 1024))}MB budget ` +
          `(${refs.length} images, ${totalBytes} bytes so far) — chunk the call into ` +
          "smaller page batches or compress/downscale images at upload.",
        { imageCount: refs.length, totalBytes, maxTotal }
      );
    }
  }
  return out;
}

/**
 * Deterministic in-memory store for the emulator/test runtime (the `imageStore`
 * counterpart of `createStubProvider`): every path resolves to a fixed 1×1 JPEG.
 * NO network / NO Admin SDK — so emulator suites never depend on the Storage
 * emulator having real objects behind the paths services pass.
 */
export function createStubImageStore(): AiImageStore {
  // Smallest well-formed JPEG header bytes — enough for a deterministic payload.
  const bytes = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
  return {
    async read(path: string) {
      return { bytes, contentType: inferMimeType(path) };
    },
  };
}
