/**
 * `toTransportError` — wraps a raw firebase/zod stream error into the typed
 * `ApiErrorDetails` envelope surfaced through `cb.error` (transport-realtime.md
 * §2.2). This layer does NOT *map* domain error codes the way api-client's
 * `normalizeError` does; it performs the minimal firebase-listener-code →
 * `AppErrorCode` coercion so the realtime layer + UI receive one error type at the
 * wire edge regardless of transport, then api-client can re-normalize if needed.
 */
import type { ApiErrorDetails, AppErrorCode } from "@levelup/api-contract";

/** Firebase listener `.code` (e.g. 'permission-denied') → transport-neutral code. */
function coerceCode(raw: unknown): AppErrorCode {
  if (typeof raw !== "string") return "INTERNAL_ERROR";
  switch (raw) {
    case "permission-denied":
      return "PERMISSION_DENIED";
    case "unauthenticated":
      return "UNAUTHENTICATED";
    case "not-found":
      return "NOT_FOUND";
    case "resource-exhausted":
      return "RATE_LIMITED";
    case "failed-precondition":
      return "PRECONDITION_FAILED";
    default:
      return "INTERNAL_ERROR";
  }
}

export function toTransportError(err: unknown): ApiErrorDetails {
  const message =
    err && typeof err === "object" && "message" in err
      ? String((err as { message?: unknown }).message)
      : "realtime stream error";
  const code = coerceCode(
    err && typeof err === "object" && "code" in err ? (err as { code?: unknown }).code : undefined
  );
  return { code, message, retryable: false };
}
