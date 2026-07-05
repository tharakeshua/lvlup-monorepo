/**
 * saveTenant CREATE-branch provisioning UNIT test (IDN-1 — v1 school onboarding).
 *
 * Proves the front-door saga that was previously missing end-to-end:
 *   • create tenant → the `tenantCodes/{code}` public index is written (so
 *     lookupTenantByCode / joinTenant resolve the tenant),
 *   • the creating user gets an OWNER membership as `tenantAdmin` + synced claims
 *     (the super-admin's `isSuperAdmin` claim is preserved, not clobbered),
 *   • a trial clock (`trialEndsAt` + trial status/subscription) is stamped,
 *   • a duplicate join code is rejected (ALREADY_EXISTS) with no partial write,
 *   • the UPDATE path does NOT re-provision (no new membership / index / trial reset).
 *
 * Uses a hand-rolled in-memory repo + fake ctx (no emulator), mirroring
 * `chat.unit.test.ts`, so it exercises the real service logic in isolation.
 */
import { describe, it, expect } from "vitest";
import { saveTenantService } from "../identity/tenant";
import type { AuthContext } from "../shared/context";

type Doc = Record<string, unknown>;

const CLOCK = "2026-07-04T00:00:00.000Z";

/** In-memory stand-in for the tenants + memberships + claims authority repos. */
function makeFakeRepos() {
  const tenants = new Map<string, Doc>(); // tenantId -> tenant doc
  const codes = new Map<string, string>(); // tenantCode -> tenantId (the index)
  const memberships = new Map<string, Doc>(); // `${uid}_${tid}` -> membership doc
  const claims = new Map<string, Doc>(); // uid -> custom claims
  const revoked = new Set<string>();
  const now = () => CLOCK;

  const repos = {
    tenants: {
      async get(_t: string, id: string): Promise<Doc | null> {
        return tenants.get(id) ?? null;
      },
      async upsert(tid: string, data: Doc, ts: string = now()) {
        const id = (data["id"] as string | undefined) ?? tid;
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
      async revokeRefreshTokens(uid: string): Promise<void> {
        revoked.add(uid);
      },
    },
  };

  return { repos, tenants, codes, memberships, claims, revoked, now };
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

describe("saveTenantService — CREATE-branch provisioning (IDN-1)", () => {
  it("writes the tenantCodes index, owner tenantAdmin membership + claims, and a trial clock", async () => {
    const fx = makeFakeRepos();
    const ctx = makeSuperAdminCtx(fx.repos, fx.now);

    const res = (await saveTenantService(
      { id: "tenant_test", data: { name: "Test School", tenantCode: "SUB001", plan: "trial" } },
      ctx
    )) as { id: string; created: boolean };

    expect(res.created).toBe(true);
    expect(res.id).toBe("tenant_test");

    // (1) tenantCodes/{code} index resolves to the tenant.
    expect(fx.codes.get("SUB001")).toBe("tenant_test");

    // (2) owner membership exists as tenantAdmin.
    const membership = fx.memberships.get("superadmin_1_tenant_test");
    expect(membership).toBeTruthy();
    expect(membership!["role"]).toBe("tenantAdmin");
    expect(membership!["status"]).toBe("active");
    expect(membership!["tenantId"]).toBe("tenant_test");

    // (3) claims synced from the membership, super-admin preserved.
    const claim = fx.claims.get("superadmin_1");
    expect(claim).toBeTruthy();
    expect(claim!["role"]).toBe("tenantAdmin");
    expect(claim!["tenantId"]).toBe("tenant_test");
    expect(claim!["isSuperAdmin"]).toBe(true);

    // (4) trial clock stamped on the tenant doc.
    const tenant = fx.tenants.get("tenant_test")!;
    expect(tenant["status"]).toBe("trial");
    expect(tenant["ownerUid"]).toBe("superadmin_1");
    expect(typeof tenant["trialEndsAt"]).toBe("string");
    expect(Date.parse(tenant["trialEndsAt"] as string)).toBeGreaterThan(Date.parse(CLOCK));
    expect((tenant["subscription"] as Doc)["plan"]).toBe("trial");
  });

  it("derives slug + a unique tenantCode server-side when the request omits them (invariant: no tenant without a resolvable code)", async () => {
    const fx = makeFakeRepos();
    const ctx = makeSuperAdminCtx(fx.repos, fx.now);
    // A colliding code already exists so the generator must suffix past it.
    fx.codes.set("ACME", "tenant_other");

    await saveTenantService({ id: "tenant_acme", data: { name: "Acme!!" } }, ctx);

    const tenant = fx.tenants.get("tenant_acme")!;
    // slug derived from the name, tenantCode generated + indexed.
    expect(tenant["slug"]).toBe("acme");
    const code = tenant["tenantCode"] as string;
    expect(code).toBe("ACME2"); // base "ACME" was taken → next free
    expect(fx.codes.get(code)).toBe("tenant_acme");
    // owner membership + claims still provisioned with the generated code.
    expect(fx.memberships.get("superadmin_1_tenant_acme")!["role"]).toBe("tenantAdmin");
    expect(fx.claims.get("superadmin_1")!["tenantCode"]).toBe(code);
  });

  it("rejects a duplicate join code with ALREADY_EXISTS and no partial tenant write", async () => {
    const fx = makeFakeRepos();
    const ctx = makeSuperAdminCtx(fx.repos, fx.now);
    // The code is already owned by another tenant.
    fx.codes.set("SUB001", "tenant_other");

    await expect(
      saveTenantService({ id: "tenant_test", data: { name: "Dup", tenantCode: "SUB001" } }, ctx)
    ).rejects.toMatchObject({ code: "ALREADY_EXISTS" });

    // The collision is caught BEFORE the tenant doc / membership are written.
    expect(fx.tenants.get("tenant_test")).toBeUndefined();
    expect(fx.memberships.get("superadmin_1_tenant_test")).toBeUndefined();
    expect(fx.codes.get("SUB001")).toBe("tenant_other");
  });

  it("does NOT re-provision on the UPDATE path (existing tenant)", async () => {
    const fx = makeFakeRepos();
    const ctx = makeSuperAdminCtx(fx.repos, fx.now);
    // Seed an existing tenant with a prior trial clock.
    fx.tenants.set("tenant_test", {
      id: "tenant_test",
      name: "Existing",
      status: "active",
      ownerUid: "founder_1",
      trialEndsAt: "2020-01-01T00:00:00.000Z",
    });

    const res = (await saveTenantService(
      { id: "tenant_test", data: { name: "Renamed", tenantCode: "SUB999" } },
      ctx
    )) as { id: string; created: boolean };

    expect(res.created).toBe(false);
    // No index write, no owner membership, no claim mint, no trial reset.
    expect(fx.codes.get("SUB999")).toBeUndefined();
    expect(fx.memberships.get("superadmin_1_tenant_test")).toBeUndefined();
    expect(fx.claims.get("superadmin_1")).toBeUndefined();
    const tenant = fx.tenants.get("tenant_test")!;
    expect(tenant["name"]).toBe("Renamed");
    expect(tenant["ownerUid"]).toBe("founder_1"); // ownership untouched
    expect(tenant["trialEndsAt"]).toBe("2020-01-01T00:00:00.000Z"); // clock untouched
  });
});
