import { describe, expect, it, vi } from "vitest";
import {
  createUserSecretResolver,
  createUserSecretWriter,
  userSecretNameFor,
} from "../secrets/secret-manager.js";
import { createAiGateway, type UserKeyLookup } from "../gateway.js";
import { createStubProvider } from "../provider/stub.js";
import type { AiRepos } from "../repos-seam.js";
import type { TenantId, UserId } from "@levelup/domain";

const PROJECT_ID = "project-byok";
const USER_ID = "user-abc" as UserId;
const TENANT_ID = "tenant-1" as TenantId;

function notFound(): Error & { code: number } {
  return Object.assign(new Error("5 NOT_FOUND"), { code: 5 });
}

describe("userSecretNameFor", () => {
  it("is user-global and provider-scoped", () => {
    expect(userSecretNameFor("abc", "google")).toBe("user-abc-google");
  });
});

describe("createUserSecretResolver", () => {
  it("reads the user secret by ref (versions/latest)", async () => {
    const accessSecretVersion = vi.fn(async ({ name }: { name: string }) => {
      expect(name).toContain(`/secrets/user-abc-google/versions/latest`);
      return [{ payload: { data: Buffer.from("user-key-value") } }];
    });
    const resolver = createUserSecretResolver({
      projectId: PROJECT_ID,
      env: {} as NodeJS.ProcessEnv,
      client: { accessSecretVersion } as never,
    });
    await expect(resolver.getKeyByRef("user-abc-google")).resolves.toBe("user-key-value");
  });

  it("is FAIL-CLOSED — a missing user secret throws, never returns a fallback", async () => {
    const accessSecretVersion = vi.fn(async () => {
      throw notFound();
    });
    const resolver = createUserSecretResolver({
      projectId: PROJECT_ID,
      env: {} as NodeJS.ProcessEnv,
      client: { accessSecretVersion } as never,
    });
    await expect(resolver.getKeyByRef("user-abc-google")).rejects.toMatchObject({
      message: "Failed to access the user BYOK key",
    });
  });

  it("uses the env override in emulator/local-dev", async () => {
    const accessSecretVersion = vi.fn();
    const resolver = createUserSecretResolver({
      projectId: PROJECT_ID,
      env: { GEMINI_API_KEY: "dev-key" } as NodeJS.ProcessEnv,
      client: { accessSecretVersion } as never,
    });
    await expect(resolver.getKeyByRef("user-abc-google")).resolves.toBe("dev-key");
    expect(accessSecretVersion).not.toHaveBeenCalled();
  });
});

describe("createUserSecretWriter", () => {
  it("creates the container then adds a version, returning the version number", async () => {
    const createSecret = vi.fn(async () => [{}]);
    const addSecretVersion = vi.fn(async () => [{ name: "projects/p/secrets/s/versions/1" }]);
    const writer = createUserSecretWriter({
      projectId: PROJECT_ID,
      env: {} as NodeJS.ProcessEnv,
      client: {
        createSecret,
        addSecretVersion,
        listSecretVersions: vi.fn(),
        disableSecretVersion: vi.fn(),
        enableSecretVersion: vi.fn(),
        deleteSecret: vi.fn(),
      } as never,
    });
    const res = await writer.writeSecret(USER_ID, "google", "the-key");
    expect(res).toEqual({ secretRef: "user-user-abc-google", version: 1 });
    expect(createSecret).toHaveBeenCalledOnce();
    expect(addSecretVersion).toHaveBeenCalledOnce();
  });

  it("rotation disables prior enabled versions below the kept one (best-effort)", async () => {
    const disableSecretVersion = vi.fn(async () => [{}]);
    const writer = createUserSecretWriter({
      projectId: PROJECT_ID,
      env: {} as NodeJS.ProcessEnv,
      client: {
        createSecret: vi.fn(),
        addSecretVersion: vi.fn(),
        listSecretVersions: vi.fn(async () => [
          [
            { name: "projects/p/secrets/s/versions/1", state: "ENABLED" },
            { name: "projects/p/secrets/s/versions/2", state: "ENABLED" },
          ],
        ]),
        disableSecretVersion,
        enableSecretVersion: vi.fn(),
        deleteSecret: vi.fn(),
      } as never,
    });
    await writer.disablePriorVersions("user-abc-google", 2);
    expect(disableSecretVersion).toHaveBeenCalledOnce();
    expect(disableSecretVersion).toHaveBeenCalledWith({
      name: "projects/p/secrets/s/versions/1",
    });
  });

  it("no-ops with an env override (emulator) and still returns the ref", async () => {
    const addSecretVersion = vi.fn();
    const writer = createUserSecretWriter({
      projectId: PROJECT_ID,
      env: { GEMINI_API_KEY: "dev-key" } as NodeJS.ProcessEnv,
      client: { addSecretVersion } as never,
    });
    const res = await writer.writeSecret(USER_ID, "google", "the-key");
    expect(res.secretRef).toBe("user-user-abc-google");
    expect(addSecretVersion).not.toHaveBeenCalled();
  });
});

// --- Gateway precedence: BYOK bypasses quota, is fail-closed, and is attributed. ---

function fakeRepos(): { repos: AiRepos; quotaCalls: () => number } {
  let quotaCalls = 0;
  const repos = {
    tenants: {
      getUsageConfig: async () => {
        quotaCalls += 1;
        return { monthlyBudgetUsd: 100, dailyCallCap: 5000, aiEnabled: true };
      },
    },
    costSummaries: {
      monthly: async () => ({ totalCostUsd: 0 }),
      daily: async () => ({ totalCalls: 0 }),
    },
    llm: {
      log: async () => undefined,
      sumCostUsd: async () => 0,
      countCalls: async () => 0,
    },
  } as unknown as AiRepos;
  return { repos, quotaCalls: () => quotaCalls };
}

const CTX = {
  tenantId: TENANT_ID,
  uid: USER_ID,
  role: "student",
  now: () => "2026-07-18T00:00:00.000Z",
};

describe("gateway credential precedence", () => {
  it("uses the user's BYOK key, marks credentialOwner='user', and SKIPS quota", async () => {
    const { repos, quotaCalls } = fakeRepos();
    const created: { credentialOwner?: string }[] = [];
    const userKeyLookup: UserKeyLookup = {
      getEligibleUserKey: async () => ({ provider: "google", secretRef: "user-user-abc-google" }),
    };
    const seenKeys: string[] = [];
    const gw = createAiGateway({
      repos,
      userKeyLookup,
      userSecretResolver: {
        getKeyByRef: async (ref) => {
          seenKeys.push(ref);
          return "user-byok-key";
        },
        invalidate: () => {},
      },
      secretResolver: {
        getApiKey: async () => "tenant-or-platform-key",
        invalidate: () => {},
      },
      providerFactory: (apiKey) => {
        seenKeys.push(`provider:${apiKey}`);
        return createStubProvider();
      },
      telemetry: {
        createRequest: async (r) => {
          created.push({ credentialOwner: (r as { credentialOwner?: string }).credentialOwner });
        },
        recordAttempt: async () => {},
        finalizeRequest: async () => {},
      },
      idGenerator: () => "id-1",
    });

    await gw.generate(
      {
        promptKey: "aiChat",
        variables: { itemContext: "ctx", message: "hi", language: "en", history: "" },
        moderate: false,
      },
      CTX
    );

    expect(seenKeys).toContain("user-user-abc-google");
    expect(seenKeys).toContain("provider:user-byok-key");
    expect(created[0]?.credentialOwner).toBe("user");
    // BYOK bypasses the tenant quota pre-check entirely.
    expect(quotaCalls()).toBe(0);
  });

  it("falls back to tenant/platform (and enforces quota) when the user has no key", async () => {
    const { repos, quotaCalls } = fakeRepos();
    const seenKeys: string[] = [];
    const gw = createAiGateway({
      repos,
      userKeyLookup: { getEligibleUserKey: async () => null },
      secretResolver: {
        getApiKey: async () => "tenant-key",
        invalidate: () => {},
      },
      providerFactory: (apiKey) => {
        seenKeys.push(apiKey);
        return createStubProvider();
      },
      idGenerator: () => "id-2",
    });

    await gw.generate(
      {
        promptKey: "aiChat",
        variables: { itemContext: "ctx", message: "hi", language: "en", history: "" },
        moderate: false,
      },
      CTX
    );
    expect(seenKeys).toEqual(["tenant-key"]);
    expect(quotaCalls()).toBe(1);
  });

  it("is FAIL-CLOSED: a user with a key whose secret read fails errors, no fallback", async () => {
    const { repos } = fakeRepos();
    const tenantGetApiKey = vi.fn(async () => "tenant-key");
    const gw = createAiGateway({
      repos,
      userKeyLookup: {
        getEligibleUserKey: async () => ({ provider: "google", secretRef: "user-user-abc-google" }),
      },
      userSecretResolver: {
        getKeyByRef: async () => {
          throw Object.assign(new Error("boom"), { code: "INTERNAL_ERROR" });
        },
        invalidate: () => {},
      },
      secretResolver: { getApiKey: tenantGetApiKey, invalidate: () => {} },
      providerFactory: () => createStubProvider(),
      idGenerator: () => "id-3",
    });

    await expect(
      gw.generate(
        {
          promptKey: "aiChat",
          variables: { itemContext: "ctx", message: "hi", language: "en", history: "" },
          moderate: false,
        },
        CTX
      )
    ).rejects.toBeTruthy();
    // Never fell back to the tenant key.
    expect(tenantGetApiKey).not.toHaveBeenCalled();
  });
});
