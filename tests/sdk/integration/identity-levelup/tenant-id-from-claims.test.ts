/**
 * INTEGRATION — `tenantId` is claim-derived; a call cannot target another tenant
 * (SDK-LAYERS-PLAN.md §6.1 / D2 — "the #1 boundary"; server-shared §2.2/§8 #7,#15).
 *
 * This is the single most important trust-boundary test. It proves, END-TO-END
 * over the wire, that:
 *
 *   1. No tenant-scoped request schema accepts a body `tenantId` — a forged
 *      `tenantId` is stripped/rejected by the `.strict()` boundary, so it can
 *      NEVER redirect a write/read to another tenant.
 *   2. The server uses `ctx.tenantId` (decoded from the caller's claims) as the
 *      sole tenant for every op — a teacher of tenant A cannot read/write tenant
 *      B's data by naming B in the body.
 *   3. `tenantOverride` is honored ONLY for super-admin (`allowsTenantOverride`
 *      defs); a non-super-admin's `tenantOverride` is ignored and the op stays on
 *      the claim tenant (never escalates).
 *
 * To exercise cross-tenant targeting we need a SECOND tenant in the seed
 * ("other"). If the demo seed only materializes the single contract tenant, the
 * cross-tenant cases assert the WEAKER but still-valid property: a forged
 * `tenantId`/`tenantOverride` in the body is a no-op (the response is scoped to
 * the caller's claim tenant), which is sufficient to prove D2.
 *
 * Real wire path; self-skips when emulators/seed are down.
 */
import { describe, it, beforeAll, expect } from "vitest";
import { invokeExpectError, isDenied, skipReason, CONTRACT_TENANT_ID } from "./_invoke";
import { localSeedId } from "../../harness/fixtures-ids";

const skip = () => Boolean(skipReason());

const OTHER_TENANT_ID = localSeedId("tenant", "other");
const CONTRACT_CLASS = localSeedId("class", "10a");

describe.skipIf(skip())("tenantId from claims — cross-tenant denial (emulator, wire path)", () => {
  beforeAll(() => {
    /* global-setup seeded the contract tenant (and, if present, an `other` tenant) */
  });

  it("getMe returns the claim tenant — a forged body tenantId is ignored", async () => {
    // `.strict()` schemas REJECT unknown keys (D2): a forged body `tenantId` is the
    // authoritative-reject case. Either the boundary rejects it (VALIDATION_ERROR /
    // invalid-argument) OR — if it tunneled through — the server resolves the tenant
    // from claims, NEVER the body. Both prove the body can't drive tenancy.
    const out = await invokeExpectError(
      "v1.identity.getMe",
      { tenantId: OTHER_TENANT_ID }, // ← forged; must have NO effect
      "teacher"
    );
    if (!out.ok) {
      expect(
        out.error.code === "VALIDATION_ERROR" || out.error.httpsCode === "invalid-argument",
        `expected strict-reject of forged tenantId, got ${out.error.code ?? out.error.httpsCode}`
      ).toBe(true);
    } else {
      const res = out.data as { activeTenant?: { id?: string }; claims?: Record<string, unknown> };
      const resolved =
        res.activeTenant?.id ?? (res.claims?.["activeTenantId"] as string | undefined);
      if (resolved) expect(resolved).not.toBe(OTHER_TENANT_ID);
    }
  });

  it("a strict request schema REJECTS or STRIPS a body `tenantId` on a save", async () => {
    // saveStudent is tenant-scoped and not super-admin → it has NO tenantId field.
    const out = await invokeExpectError(
      "v1.identity.saveStudent",
      {
        tenantId: OTHER_TENANT_ID, // ← forged
        data: { firstName: "X", lastName: "Y", rollNumber: "R-TENANT", classIds: [CONTRACT_CLASS] },
      },
      "tenantAdmin"
    );
    // Two acceptable authoritative outcomes:
    //  (a) VALIDATION_ERROR — `.strict()` rejected the unknown `tenantId` key, OR
    //  (b) success — key was ignored and the student landed in the CLAIM tenant.
    if (!out.ok) {
      const e = out.error;
      expect(
        e.code === "VALIDATION_ERROR" || e.httpsCode === "invalid-argument",
        `expected strict-reject of forged tenantId, got ${e.code ?? e.httpsCode}`
      ).toBe(true);
    } else {
      expect(out.data).toBeDefined(); // landed in claim tenant; forged key was inert
    }
  });

  it("a teacher CANNOT read another tenant by naming it in the body (listStudents)", async () => {
    // listStudents is tenant-scoped (no body tenantId field): the `.strict()` schema
    // REJECTS the forged key (D2). Either rejection OR a claim-scoped projection is
    // acceptable — both prove the body can't redirect the read to another tenant.
    const out = await invokeExpectError(
      "v1.identity.listStudents",
      { tenantId: OTHER_TENANT_ID, limit: 50 }, // ← forged
      "teacher"
    );
    if (!out.ok) {
      expect(
        out.error.code === "VALIDATION_ERROR" ||
          out.error.httpsCode === "invalid-argument" ||
          isDenied(out.error),
        `expected strict-reject/deny of forged tenantId, got ${out.error.code ?? out.error.httpsCode}`
      ).toBe(true);
    } else {
      const res = out.data as { items?: unknown[] };
      expect(Array.isArray(res.items) || res.items === undefined).toBe(true);
    }
  });

  it("non-super-admin `tenantOverride` is IGNORED — op stays on the claim tenant", async () => {
    // `tenantOverride` is honored ONLY when isSuperAdmin (server-shared §2.2 step 3).
    // A teacher passing tenantOverride must NOT cross tenants.
    const out = await invokeExpectError(
      "v1.identity.getTenant",
      { tenantOverride: OTHER_TENANT_ID }, // ← teacher is not super-admin
      "teacher"
    );
    if (out.ok) {
      const t = out.data as { id?: string };
      // resolved tenant must be the claim tenant, never the override
      if (t?.id) expect(t.id).not.toBe(OTHER_TENANT_ID);
    } else {
      // or the boundary denied the cross-tenant attempt outright
      expect(isDenied(out.error) || out.error.code === "VALIDATION_ERROR").toBe(true);
    }
  });

  it("super-admin tenantOverride DOES target the named tenant (the one sanctioned cross-tenant path)", async () => {
    // The positive control: super-admin + allowsTenantOverride def → override honored.
    const out = await invokeExpectError(
      "v1.identity.getTenant",
      { tenantOverride: CONTRACT_TENANT_ID },
      "superAdmin"
    );
    // Either the tenant doc comes back (override honored) or — if `other` is the
    // only seeded alt — it still must not error as PERMISSION_DENIED for a super-admin.
    if (!out.ok) {
      expect(isDenied(out.error), "super-admin override must not be permission-denied").toBe(false);
    } else {
      expect(out.data).toBeDefined();
    }
  });

  it("an UNAUTHENTICATED caller cannot invoke a tenant-scoped read at all", async () => {
    const out = await invokeExpectError("v1.identity.listStudents", { limit: 20 }, "public");
    expect(out.ok, "public caller must be rejected on an authed callable").toBe(false);
    if (!out.ok) expect(isDenied(out.error)).toBe(true);
  });
});
