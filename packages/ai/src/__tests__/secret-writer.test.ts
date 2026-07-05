/**
 * `createSecretWriter` — the server-side Secret Manager WRITER (P0 fix).
 *
 * The tenant Gemini-key path used to record a Firestore ref doc but never write
 * the key VALUE to Secret Manager, and the writer/resolver names diverged
 * (`{id}-gemini-key` vs `tenant-{id}-gemini`), so every freshly onboarded tenant
 * got FEATURE_DISABLED. These tests pin the three failure modes:
 *   • the key value is persisted as a Secret Manager VERSION,
 *   • the secret name is `secretNameFor(tenantId)` — the SAME name the resolver
 *     reads (a written key round-trips back through the resolver),
 *   • create is idempotent (rotation adds a version, ALREADY_EXISTS swallowed).
 */
import { describe, it, expect } from "vitest";
import {
  createSecretWriter,
  createSecretResolver,
  secretNameFor,
} from "../secrets/secret-manager.js";
import type { TenantId } from "@levelup/domain";

const PROJECT = "test-project";
const TID = "1rPpXanI2cGooLxiLko3" as TenantId;

type Req = Record<string, unknown>;

/** In-memory Secret Manager double: `secretId -> ordered version values`. */
function makeFakeSm() {
  const secrets = new Map<string, string[]>();
  const calls = {
    createSecret: [] as Req[],
    addSecretVersion: [] as Req[],
    accessSecretVersion: [] as Req[],
  };
  const client = {
    async createSecret(req: Req) {
      calls.createSecret.push(req);
      const id = String(req["secretId"]);
      if (secrets.has(id)) {
        const err = new Error(`6 ALREADY_EXISTS: secret ${id} exists`) as Error & { code: number };
        err.code = 6;
        throw err;
      }
      secrets.set(id, []);
      return [{ name: `${String(req["parent"])}/secrets/${id}` }];
    },
    async addSecretVersion(req: Req) {
      calls.addSecretVersion.push(req);
      const id = String(req["parent"]).split("/secrets/")[1];
      const data = (req["payload"] as { data: Buffer | string }).data;
      const value = Buffer.isBuffer(data) ? data.toString("utf8") : String(data);
      const versions = secrets.get(id) ?? [];
      versions.push(value);
      secrets.set(id, versions);
      return [{ name: `${String(req["parent"])}/versions/${versions.length}` }];
    },
    async accessSecretVersion(req: Req) {
      calls.accessSecretVersion.push(req);
      const id = String(req["name"]).match(/\/secrets\/([^/]+)\/versions\//)?.[1];
      const versions = id ? secrets.get(id) : undefined;
      if (!versions || versions.length === 0) {
        const err = new Error("5 NOT_FOUND") as Error & { code: number };
        err.code = 5;
        throw err;
      }
      return [{ payload: { data: Buffer.from(versions[versions.length - 1]!, "utf8") } }];
    },
  };
  return { client, secrets, calls };
}

describe("createSecretWriter (SEC-09 / AG-6 P0)", () => {
  it("writes the key value as a Secret Manager version named secretNameFor(tenantId)", async () => {
    const sm = makeFakeSm();
    const writer = createSecretWriter({ projectId: PROJECT, client: sm.client as never, env: {} });

    const ref = await writer.writeSecret(TID, "AIzaSECRET");

    // The returned ref is the resolver's name — no `{id}-gemini-key` divergence.
    expect(ref).toBe(secretNameFor(TID));
    expect(ref).toBe(`tenant-${TID}-gemini`);
    // Container created under the resolver's name.
    expect(sm.calls.createSecret).toHaveLength(1);
    expect(sm.calls.createSecret[0]!["secretId"]).toBe(secretNameFor(TID));
    expect(sm.calls.createSecret[0]!["parent"]).toBe(`projects/${PROJECT}`);
    // The VALUE is written as a version (was never written before the fix).
    expect(sm.calls.addSecretVersion).toHaveLength(1);
    expect(sm.calls.addSecretVersion[0]!["parent"]).toBe(
      `projects/${PROJECT}/secrets/${secretNameFor(TID)}`
    );
    expect(sm.secrets.get(secretNameFor(TID))).toEqual(["AIzaSECRET"]);
  });

  it("rotates (adds a version) when the secret already exists, swallowing ALREADY_EXISTS", async () => {
    const sm = makeFakeSm();
    const writer = createSecretWriter({ projectId: PROJECT, client: sm.client as never, env: {} });

    await writer.writeSecret(TID, "key-v1");
    await writer.writeSecret(TID, "key-v2"); // createSecret throws code 6 → swallowed

    expect(sm.secrets.get(secretNameFor(TID))).toEqual(["key-v1", "key-v2"]);
    expect(sm.calls.addSecretVersion).toHaveLength(2);
  });

  it("round-trips: a key written by the writer is read back by the resolver", async () => {
    const sm = makeFakeSm();
    const writer = createSecretWriter({ projectId: PROJECT, client: sm.client as never, env: {} });
    const resolver = createSecretResolver({
      projectId: PROJECT,
      client: sm.client as never,
      env: {},
    });

    await writer.writeSecret(TID, "round-trip-key");
    const got = await resolver.getApiKey(TID);

    expect(got).toBe("round-trip-key");
  });

  it("no-ops (no Secret Manager write) when a platform env override is set", async () => {
    const sm = makeFakeSm();
    const writer = createSecretWriter({
      projectId: PROJECT,
      client: sm.client as never,
      env: { LEVELUP_AI_KEY: "platform-key" },
    });

    const ref = await writer.writeSecret(TID, "ignored");

    expect(ref).toBe(secretNameFor(TID));
    expect(sm.calls.createSecret).toHaveLength(0);
    expect(sm.calls.addSecretVersion).toHaveLength(0);
  });
});
