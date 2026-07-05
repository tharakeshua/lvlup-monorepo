/**
 * AG-6 P0 — the tenant Gemini-key path (Secret Manager) end-to-end.
 *
 * Three root causes were fixed together; this suite pins each:
 *   (1) `makeSecretRepo.put` now writes the key VALUE to Secret Manager (via the
 *       shared `@levelup/ai` writer) and records a pointer doc — never the value.
 *   (2) `saveTenantService` ingests the key AFTER the tenant id is allocated, so
 *       the secret is owned by the CREATED tenantId (was 'pending' on a
 *       create-without-id, because `data['code']` does not exist in the schema).
 *   (3) the writer's secret name is `secretNameFor(tenantId)` — the SAME name the
 *       AI resolver reads — so a saved key round-trips back to the resolver.
 *
 * A mocked Secret Manager client backs every write/read; no GCP, no emulator.
 */
import { describe, it, expect } from "vitest";
import type { Firestore } from "firebase-admin/firestore";
import { createSecretWriter, createSecretResolver, secretNameFor } from "@levelup/ai";
import type { TenantId } from "@levelup/domain";
import { makeSecretRepo } from "../repo-admin/extended";
import { saveTenantService } from "../identity/tenant";
import type { AuthContext } from "../shared/context";

type Doc = Record<string, unknown>;
type Req = Record<string, unknown>;

const CLOCK = "2026-07-04T00:00:00.000Z";
const PROJECT = "test-project";

/** In-memory Secret Manager double: `secretId -> ordered version values`. */
function makeFakeSm() {
  const secrets = new Map<string, string[]>();
  const client = {
    async createSecret(req: Req) {
      const id = String(req["secretId"]);
      if (secrets.has(id)) {
        const err = new Error(`6 ALREADY_EXISTS: ${id}`) as Error & { code: number };
        err.code = 6;
        throw err;
      }
      secrets.set(id, []);
      return [{ name: `${String(req["parent"])}/secrets/${id}` }];
    },
    async addSecretVersion(req: Req) {
      const id = String(req["parent"]).split("/secrets/")[1];
      const data = (req["payload"] as { data: Buffer | string }).data;
      const value = Buffer.isBuffer(data) ? data.toString("utf8") : String(data);
      const versions = secrets.get(id) ?? [];
      versions.push(value);
      secrets.set(id, versions);
      return [{ name: `${String(req["parent"])}/versions/${versions.length}` }];
    },
    async accessSecretVersion(req: Req) {
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
  return { client, secrets };
}

/** Minimal Firestore double for `db.doc(path).set(value, opts)`. */
function makeFakeDb() {
  const docs = new Map<string, Doc>();
  const db = {
    doc(path: string) {
      return {
        async set(value: Doc) {
          docs.set(path, { ...(docs.get(path) ?? {}), ...value });
        },
      };
    },
  };
  return { db: db as unknown as Firestore, docs };
}

describe("makeSecretRepo (AG-6 root cause 1 + 3)", () => {
  it("persists the key value to Secret Manager and records the ref doc (never the value)", async () => {
    const tid = "1rPpXanI2cGooLxiLko3";
    const sm = makeFakeSm();
    const { db, docs } = makeFakeDb();
    const writer = createSecretWriter({ projectId: PROJECT, client: sm.client as never, env: {} });
    const repo = makeSecretRepo(db, () => CLOCK, writer);

    const { secretRef } = await repo.put(tid, "AIzaSECRET");

    expect(secretRef).toBe(secretNameFor(tid as TenantId));
    // (1) the VALUE reached Secret Manager as a version.
    expect(sm.secrets.get(secretNameFor(tid as TenantId))).toEqual(["AIzaSECRET"]);
    // (3) the ref doc records only the pointer, keyed on the unified name.
    const refEntry = [...docs.entries()].find(([k]) => k.endsWith("/secretRefs/gemini"));
    expect(refEntry).toBeTruthy();
    expect(refEntry![1]["secretRef"]).toBe(secretNameFor(tid as TenantId));
    expect(JSON.stringify(refEntry![1])).not.toContain("AIzaSECRET");
  });
});

/** Full fake ctx wired to a real `makeSecretRepo` over a shared mock SM store. */
function makeFixture() {
  const sm = makeFakeSm();
  const { db } = makeFakeDb();
  const writer = createSecretWriter({ projectId: PROJECT, client: sm.client as never, env: {} });
  const secretRepo = makeSecretRepo(db, () => CLOCK, writer);

  const tenants = new Map<string, Doc>();
  const codes = new Map<string, string>();
  const memberships = new Map<string, Doc>();
  const claims = new Map<string, Doc>();
  const audits: Doc[] = [];
  const putCalls: { tenantId: string; key: string }[] = [];
  let allocCounter = 0;
  const now = () => CLOCK;

  const repos = {
    tenants: {
      async get(_t: string, id: string): Promise<Doc | null> {
        return tenants.get(id) ?? null;
      },
      // Mirrors the real repo: allocate a fresh id when none is given.
      async upsert(_tid: string, data: Doc, ts: string = now()) {
        const explicitId = data["id"] as string | undefined;
        const id = explicitId ?? `alloc_${++allocCounter}`;
        const created = !tenants.has(id);
        tenants.set(id, {
          ...tenants.get(id),
          ...data,
          id,
          updatedAt: ts,
          ...(created ? { createdAt: ts } : {}),
        });
        return { id, created };
      },
      async resolveCode(code: string): Promise<string | null> {
        return codes.get(code) ?? null;
      },
      async writeCode(code: string, tenantId: string): Promise<void> {
        const owner = codes.get(code);
        if (owner && owner !== tenantId) throw new Error(`ALREADY_EXISTS: ${code}`);
        codes.set(code, tenantId);
      },
    },
    memberships: {
      async get(uid: string, tid: string): Promise<Doc | null> {
        return memberships.get(`${uid}_${tid}`) ?? null;
      },
      async upsert(uid: string, tid: string, data: Doc, ts: string = now()) {
        const key = `${uid}_${tid}`;
        const created = !memberships.has(key);
        memberships.set(key, { ...memberships.get(key), ...data, id: key, updatedAt: ts });
        return { id: key, created };
      },
    },
    claims: {
      async set(uid: string, c: Doc): Promise<void> {
        claims.set(uid, c);
      },
      async get(uid: string): Promise<Doc | null> {
        return claims.get(uid) ?? null;
      },
      async revokeRefreshTokens(): Promise<void> {},
    },
    audit: {
      async write(tenantId: string, entry: Doc): Promise<void> {
        audits.push({ tenantId, ...entry });
      },
    },
    secrets: {
      async put(tenantId: string, key: string) {
        putCalls.push({ tenantId, key });
        return secretRepo.put(tenantId, key);
      },
    },
  };

  return { repos, tenants, audits, putCalls, sm, now };
}

function makeSuperAdminCtx(repos: unknown, now: () => string): AuthContext {
  return {
    uid: "superadmin_1",
    isSuperAdmin: true,
    tenantId: null,
    role: "superAdmin",
    permissions: null,
    staffPermissions: null,
    classIds: [],
    studentIds: [],
    entityIds: {},
    now,
    repos,
    ai: {},
  } as unknown as AuthContext;
}

describe("saveTenantService — Gemini key ingest (AG-6 root cause 2)", () => {
  it("owns the secret by the CREATED tenantId on create-without-id (never 'pending', never the code)", async () => {
    const fx = makeFixture();
    const ctx = makeSuperAdminCtx(fx.repos, fx.now);

    const res = (await saveTenantService(
      { data: { name: "Fresh School", tenantCode: "FRESH", geminiApiKey: "AIzaKEY" } },
      ctx
    )) as { id: string; created: boolean };

    expect(res.created).toBe(true);
    const allocatedId = res.id;
    expect(allocatedId).not.toBe("pending");
    expect(allocatedId).not.toBe("FRESH");

    // secrets.put called once, keyed on the ALLOCATED id — not the code, not 'pending'.
    expect(fx.putCalls).toHaveLength(1);
    expect(fx.putCalls[0]!.tenantId).toBe(allocatedId);
    expect(fx.putCalls[0]!.key).toBe("AIzaKEY");

    // geminiKeyRef stamped on the tenant doc with the resolver's unified name.
    const tenant = fx.tenants.get(allocatedId)!;
    expect(tenant["geminiKeyRef"]).toBe(secretNameFor(allocatedId as TenantId));
    expect(tenant["geminiKeyRef"]).toBe(`tenant-${allocatedId}-gemini`);

    // The key value is never persisted on the tenant doc; no orphan 'pending' owner.
    expect(JSON.stringify(tenant)).not.toContain("AIzaKEY");
    expect(tenant["geminiApiKey"]).toBeUndefined();
    expect(fx.tenants.get("pending")).toBeUndefined();

    // Audited against the real id.
    expect(
      fx.audits.some((a) => a["tenantId"] === allocatedId && a["action"] === "tenant.ai.key.write")
    ).toBe(true);
  });

  it("round-trips: saveTenant with a key → the AI resolver finds it under the created tenantId", async () => {
    const fx = makeFixture();
    const ctx = makeSuperAdminCtx(fx.repos, fx.now);

    const res = (await saveTenantService(
      { data: { name: "Round Trip School", geminiApiKey: "AIzaRESOLVE" } },
      ctx
    )) as { id: string };

    const resolver = createSecretResolver({
      projectId: PROJECT,
      client: fx.sm.client as never,
      env: {},
    });
    const key = await resolver.getApiKey(res.id as TenantId);

    expect(key).toBe("AIzaRESOLVE");
  });

  it("does not touch Secret Manager when no key is supplied", async () => {
    const fx = makeFixture();
    const ctx = makeSuperAdminCtx(fx.repos, fx.now);

    await saveTenantService({ data: { name: "No Key School", tenantCode: "NOKEY" } }, ctx);

    expect(fx.putCalls).toHaveLength(0);
    expect(fx.audits).toHaveLength(0);
  });
});
