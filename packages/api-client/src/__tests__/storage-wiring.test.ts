/**
 * DP-1 regression — `createApiClient(transport).storage` MUST be wired.
 *
 * The latent runtime bug (RR-T1 §4.2 / TR-2): `createApiClient` returned
 * `{ ...namespaces, subscribe, call }` with NO `storage` key, yet `storageRepo`
 * calls `api.storage.requestUploadUrl(...)` / `api.storage.uploadImage(...)` →
 * `api.storage` was `undefined` → TypeError on the first avatar/answer-sheet
 * upload. The fix wires `storage: transport.storage` in the returned client.
 *
 * This test locks that the client exposes the transport's Storage capability and
 * that calls forward to the injected transport.
 */
import { describe, it, expect } from "vitest";
import { createFakeTransport, type FakeTransport } from "../../../../tests/sdk/fakes";
import { C, has } from "./_helpers";

const ready = has("createApiClient");
const d = ready ? describe : describe.skip;

d("DP-1 storage wiring (RR-T1 §4.2 / TR-2 runtime-bug fix)", () => {
  it("createApiClient(...).storage is DEFINED (not undefined)", () => {
    const transport = createFakeTransport();
    const api = C.createApiClient!(transport) as Record<string, unknown>;
    expect(api.storage).toBeDefined();
    expect(typeof api.storage).toBe("object");
  });

  it("exposes requestUploadUrl + uploadImage from the injected transport", () => {
    const transport = createFakeTransport();
    const api = C.createApiClient!(transport) as Record<string, unknown>;
    const storage = api.storage as FakeTransport["storage"];
    expect(typeof storage.requestUploadUrl).toBe("function");
    expect(typeof storage.uploadImage).toBe("function");
  });

  it("storage calls forward to transport.storage (same capability object)", () => {
    const transport = createFakeTransport();
    const api = C.createApiClient!(transport) as Record<string, unknown>;
    // The client re-exposes the transport's storage capability directly.
    expect(api.storage).toBe(transport.storage);
  });
});
