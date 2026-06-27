/**
 * `unwrapCallableError` (transport-realtime.md §2.2 invoke/normalize-callable-error.ts).
 *
 * PASS-THROUGH marker only. Firebase's `FunctionsError` nests the server-thrown
 * `HttpsError`'s structured payload under `err.details`. The server side puts the
 * typed `ApiErrorDetails` envelope there. This helper *unwraps* that envelope so
 * api-client's `normalizeError` sees the typed details — it does NOT map codes,
 * does NOT construct an `ApiError`. Code→ApiError mapping is api-client's job
 * (single mapping owner). The invoke path rethrows the original error UNCHANGED;
 * this helper exists for the rare caller that wants the typed details directly.
 */
import { isApiErrorDetails, type ApiErrorDetails } from "@levelup/api-contract";

/**
 * If `err` is a FunctionsError carrying a typed `ApiErrorDetails` envelope under
 * `.details`, returns that envelope; otherwise returns the original `err` unchanged.
 */
export function unwrapCallableError(err: unknown): ApiErrorDetails | unknown {
  if (err && typeof err === "object" && "details" in err) {
    const details = (err as { details?: unknown }).details;
    if (isApiErrorDetails(details)) return details;
  }
  return err;
}
