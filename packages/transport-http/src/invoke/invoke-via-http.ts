/**
 * `invokeViaHttp` — FUTURE stub shape (transport-realtime layer §5.2).
 *
 * The REST equivalent of the Firebase callable invoke: `POST {baseUrl}/v1/<module>/<op>`
 * with `Authorization: Bearer <token>`, body `{ data }`, response `{ result } | { error: ApiErrorDetails }`.
 * The HTTP error body carries the **same `ApiErrorDetails` envelope** as the callable transport,
 * so `@levelup/api-client.normalizeError` works unchanged across transports.
 *
 * **NOT IMPLEMENTED in v1** — this is the typed-but-unwired seam a future REST/SSE build fills in.
 * The signature is frozen so app code never changes when the transport is swapped.
 */
import type { CallableName, ReqOf, ResOf } from "../seam.js";
import type { HttpTransportOptions } from "../create-http-transport.js";

/**
 * Build the REST path for a callable name: `v1.identity.getMe` → `v1/identity/getMe`.
 * Exported so the future SSE/WS subscribe builders share one path grammar.
 */
export function callableToHttpPath(name: CallableName): string {
  return name.replace(/\./g, "/");
}

/**
 * POST a callable over HTTP. **Stub:** throws until the future REST build lands.
 *
 * Intended impl (future):
 * ```
 * const token = await opts.getBearerToken();
 * const res = await (opts.fetchImpl ?? fetch)(`${opts.baseUrl}/${callableToHttpPath(name)}`, {
 *   method: 'POST',
 *   headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
 *   body: JSON.stringify({ data }),
 * });
 * const json = await res.json();
 * if (json.error) throw json.error as ApiErrorDetails;  // api-client.normalizeError consumes it
 * return json.result as ResOf<N>;
 * ```
 */
export function invokeViaHttp<N extends CallableName>(
  _opts: HttpTransportOptions,
  _name: N,
  _data: ReqOf<N>
): Promise<ResOf<N>> {
  return Promise.reject(
    new Error(
      "[transport-http] invokeViaHttp is a future stub (transport-realtime §5). " +
        "Use @levelup/transport-firebase in v1."
    )
  );
}
