import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  _setKeyWritersForTesting,
  createUserKeyLookup,
  rotateTenantKeyService,
  revokeTenantKeyService,
  savePlatformKeyService,
  saveUserProviderKeyService,
} from "../identity/keys.js";
import type { AuthContext } from "../shared/context.js";

type Doc = Record<string, unknown>;

const NOW = "2026-07-18T14:30:00.000Z";
const TENANT_ID = "tenant_test";
const USER_ID = "student_test";

function makeFixture() {
  const userKeys = new Map<string, Doc>();
  const keyMeta = new Map<string, Doc>();
  const tenants = new Map<string, Doc>();
  const audits: Array<{ tenantId: string; entry: Doc }> = [];
  const tenantSecretWrites: Array<{ tenantId: string; key: string }> = [];
  const userSecretWrites: Array<{ userId: string; provider: string; key: string }> = [];
  const platformSecretWrites: Array<{ secretName: string; key: string }> = [];
  const namedSecretDeletes: string[] = [];

  const userProviderKeys = {
    async get(uid: string, provider: string): Promise<Doc | null> {
      return userKeys.get(`${uid}:${provider}`) ?? null;
    },
    async listByUser(uid: string): Promise<Doc[]> {
      return [...userKeys.values()].filter((doc) => doc["userId"] === uid);
    },
    async upsert(uid: string, provider: string, data: Doc, now = NOW) {
      const id = `${uid}:${provider}`;
      const created = !userKeys.has(id);
      userKeys.set(id, {
        ...userKeys.get(id),
        ...data,
        id,
        userId: uid,
        provider,
        updatedAt: now,
        ...(created ? { createdAt: now } : {}),
      });
      return { created };
    },
    async patch(uid: string, provider: string, patch: Doc, now = NOW): Promise<void> {
      const id = `${uid}:${provider}`;
      userKeys.set(id, { ...userKeys.get(id), ...patch, updatedAt: now });
    },
    async delete(uid: string, provider: string): Promise<void> {
      userKeys.delete(`${uid}:${provider}`);
    },
  };

  const repos = {
    userProviderKeys,
    keyMeta: {
      async get(scope: string): Promise<Doc | null> {
        return keyMeta.get(scope) ?? null;
      },
      async put(scope: string, data: Doc, now = NOW): Promise<void> {
        keyMeta.set(scope, { ...keyMeta.get(scope), ...data, updatedAt: now });
      },
      async delete(scope: string): Promise<void> {
        keyMeta.delete(scope);
      },
    },
    secrets: {
      async put(tenantId: string, key: string) {
        tenantSecretWrites.push({ tenantId, key });
        return { secretRef: `tenant-${tenantId}-gemini` };
      },
    },
    tenants: {
      async upsert(tenantId: string, data: Doc, now = NOW) {
        const created = !tenants.has(tenantId);
        tenants.set(tenantId, { ...tenants.get(tenantId), ...data, updatedAt: now });
        return { id: tenantId, created };
      },
    },
    audit: {
      async write(tenantId: string, entry: Doc): Promise<void> {
        audits.push({ tenantId, entry });
      },
    },
  };

  _setKeyWritersForTesting({
    user: {
      async writeSecret(userId, provider, key) {
        userSecretWrites.push({ userId, provider: String(provider), key });
        return { secretRef: `user-${userId}-${provider}`, version: 3 };
      },
      async disablePriorVersions() {},
      async enableVersion() {},
      async deleteSecret() {},
    },
    named: {
      async writeSecret(secretName, key) {
        platformSecretWrites.push({ secretName, key });
        return 7;
      },
      async deleteSecret(secretName) {
        namedSecretDeletes.push(secretName);
      },
    },
  });

  return {
    repos,
    userProviderKeys,
    userKeys,
    keyMeta,
    tenants,
    audits,
    tenantSecretWrites,
    userSecretWrites,
    platformSecretWrites,
    namedSecretDeletes,
  };
}

function makeCtx(
  repos: unknown,
  options: {
    uid?: string;
    role?: AuthContext["role"];
    tenantId?: string | null;
    isSuperAdmin?: boolean;
  } = {}
): AuthContext {
  return {
    uid: options.uid ?? USER_ID,
    isSuperAdmin: options.isSuperAdmin ?? false,
    tenantId: options.tenantId === undefined ? TENANT_ID : options.tenantId,
    role: options.role ?? "student",
    permissions: null,
    staffPermissions: null,
    classIds: [],
    studentIds: [],
    entityIds: {},
    now: () => NOW,
    repos,
    ai: {},
  } as unknown as AuthContext;
}

beforeEach(() => {
  // Provider validation is intentionally skipped for deterministic unit tests.
  vi.stubEnv("LEVELUP_AI_KEY", "local-test-key");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("identity key management services", () => {
  it("stores a user BYOK key in Secret Manager and exposes only masked metadata", async () => {
    const fx = makeFixture();
    const ctx = makeCtx(fx.repos);
    const rawKey = "AIza-user-secret-1234";

    const result = await saveUserProviderKeyService(
      { provider: "google", apiKey: rawKey, label: "My Gemini", enabled: true },
      ctx
    );

    expect(fx.userSecretWrites).toEqual([{ userId: USER_ID, provider: "google", key: rawKey }]);
    expect(result).toMatchObject({
      provider: "google",
      maskedKey: "AIza…1234",
      enabled: true,
      version: 3,
    });
    expect(JSON.stringify(result)).not.toContain(rawKey);
    expect(JSON.stringify(fx.userKeys.get(`${USER_ID}:google`))).not.toContain(rawKey);
    expect(fx.audits).toContainEqual({
      tenantId: TENANT_ID,
      entry: expect.objectContaining({
        action: "user.ai.key.write",
        actorUid: USER_ID,
        provider: "google",
      }),
    });

    const lookup = createUserKeyLookup({ userProviderKeys: fx.userProviderKeys });
    await expect(lookup.getEligibleUserKey(USER_ID)).resolves.toEqual({
      provider: "google",
      secretRef: `user-${USER_ID}-google`,
    });
  });

  it("denies tenant key rotation to a student", async () => {
    const fx = makeFixture();

    await expect(
      rotateTenantKeyService(
        { provider: "google", apiKey: "AIza-tenant-secret" },
        makeCtx(fx.repos)
      )
    ).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
    expect(fx.tenantSecretWrites).toHaveLength(0);
  });

  it("allows a tenant admin to rotate a tenant key and stores masked status metadata", async () => {
    const fx = makeFixture();
    const result = await rotateTenantKeyService(
      { provider: "google", apiKey: "AIza-tenant-secret-5678" },
      makeCtx(fx.repos, { uid: "tenant_admin", role: "tenantAdmin" })
    );

    expect(fx.tenantSecretWrites).toEqual([
      { tenantId: TENANT_ID, key: "AIza-tenant-secret-5678" },
    ]);
    expect(fx.tenants.get(TENANT_ID)?.["geminiKeyRef"]).toBe(`tenant-${TENANT_ID}-gemini`);
    expect(result).toMatchObject({
      provider: "google",
      present: true,
      maskedKey: "AIza…5678",
      status: "active",
      version: 1,
    });
    expect(JSON.stringify(fx.keyMeta.get(`tenant:${TENANT_ID}:google`))).not.toContain(
      "AIza-tenant-secret-5678"
    );
  });

  it("revokes the tenant secret so resolution can fall back to the platform key", async () => {
    const fx = makeFixture();
    const ctx = makeCtx(fx.repos, { uid: "tenant_admin", role: "tenantAdmin" });

    await rotateTenantKeyService({ provider: "google", apiKey: "AIza-tenant-secret-5678" }, ctx);
    const result = await revokeTenantKeyService({ provider: "google" }, ctx);

    expect(fx.namedSecretDeletes).toEqual([`tenant-${TENANT_ID}-gemini`]);
    expect(fx.tenants.get(TENANT_ID)?.["geminiKeyRef"]).toBeNull();
    expect(fx.keyMeta.get(`tenant:${TENANT_ID}:google`)).toMatchObject({
      status: "revoked",
      present: false,
    });
    expect(result.deleted).toBe(true);
  });

  it("restricts platform key writes to a real super-admin", async () => {
    const fx = makeFixture();
    const request = { provider: "google" as const, apiKey: "AIza-platform-secret-9999" };

    await expect(
      savePlatformKeyService(
        request,
        makeCtx(fx.repos, { uid: "tenant_admin", role: "tenantAdmin" })
      )
    ).rejects.toMatchObject({ code: "PERMISSION_DENIED" });

    const result = await savePlatformKeyService(
      request,
      makeCtx(fx.repos, {
        uid: "super_admin",
        role: "superAdmin",
        tenantId: null,
        isSuperAdmin: true,
      })
    );
    expect(fx.platformSecretWrites).toEqual([
      { secretName: "levelup-default-gemini", key: request.apiKey },
    ]);
    expect(result).toMatchObject({
      provider: "google",
      present: true,
      maskedKey: "AIza…9999",
      status: "active",
      version: 7,
    });
  });
});
