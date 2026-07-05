/**
 * getMe canonicalization REGRESSION test (E2E-1 stage 9 / APP-1).
 *
 * The deployed backend echoed raw stored docs out of getMe; with response
 * validation literal-TRUE in every app, the strict `GetMeResponseSchema`
 * rejected the payload (16 issues) → `useMe` errored → session degraded to
 * null → every role-guarded route rendered "Access Denied" for a PERFECTLY
 * VALID teacher login. The doc shapes below are lifted verbatim from the real
 * CHAITANY tenant (tmp-e2e-chaitanya/getme-payload.json):
 *   • user doc missing uid/isSuperAdmin/status/updatedAt/lastLogin,
 *   • membership carrying `classIds` + EMPTY `tenantCode`, missing audit pair,
 *   • claims blob with `tenantCode: ""`,
 *   • tenant doc with top-level `geminiKeyRef`/`tenantId` strays and missing
 *     required features/settings/stats embeds.
 * Locks: getMeService output validates against the CONTRACT schema.
 */
import { describe, it, expect } from "vitest";
import { getCallable } from "@levelup/api-contract";
import { getMeService } from "../identity/reads";
import type { AuthContext } from "../shared/context";

type Doc = Record<string, unknown>;

const UID = "zI3KwSwHqcT8ydjgTi0PuZaLWN12";
const TID = "1rPpXanI2cGooLxiLko3";

const storedUser: Doc = {
  id: UID, // repo-injected
  createdAt: "2026-07-04T14:13:06.731Z",
  displayName: "Meera Iyer",
  email: "meera.teacher@chaitanya-e2e.test",
  createdBy: UID,
  updatedBy: UID,
};

const storedMembership: Doc = {
  id: `${UID}_${TID}`,
  uid: UID,
  role: "teacher",
  teacherId: "mVTlXRHa1rvv5epOMKZT",
  updatedBy: "f4u4eI2UPdQOOKBBER3Om1VYayR2",
  classIds: [], // legacy claims-sync key — NOT in the schema
  joinSource: "admin_created",
  tenantId: TID,
  tenantCode: "", // legacy writer bug — branded id rejects ""
  status: "active",
  createdAt: "2026-07-04T14:13:06.881Z",
  updatedAt: "2026-07-04T14:13:06.881Z",
};

const storedClaims: Doc = {
  role: "teacher",
  tenantId: TID,
  tenantCode: "",
  teacherId: "mVTlXRHa1rvv5epOMKZT",
  classIds: [],
};

const storedTenant: Doc = {
  id: TID,
  tenantId: TID, // stray duplicate key
  geminiKeyRef: "pending-gemini-key", // stray top-level — domain nests in settings
  name: "Chaitanya E2E Test",
  slug: "chaitanya-e2e-test",
  tenantCode: "CHAITANY",
  ownerUid: "f4u4eI2UPdQOOKBBER3Om1VYayR2",
  status: "trial",
  subscription: { plan: "trial", renewsAt: null },
  trialEndsAt: "2026-07-18T14:11:31.072Z",
  contactEmail: "chaitanya-e2e@test.levelup.app",
  createdAt: "2026-07-04T14:11:31.072Z",
  updatedAt: "2026-07-04T14:13:11.802Z",
  createdBy: "f4u4eI2UPdQOOKBBER3Om1VYayR2",
  updatedBy: "f4u4eI2UPdQOOKBBER3Om1VYayR2",
};

function makeCtx(): AuthContext {
  const repos = {
    users: { get: async () => ({ ...storedUser }) },
    memberships: { listForUser: async () => [{ ...storedMembership }] },
    claims: { get: async () => ({ ...storedClaims }) },
    tenants: { get: async (_t: string, id: string) => (id === TID ? { ...storedTenant } : null) },
  };
  return {
    uid: UID,
    tenantId: TID,
    role: "teacher",
    repos,
    now: () => "2026-07-05T00:00:00.000Z",
  } as unknown as AuthContext;
}

describe("getMeService canonicalizes legacy stored shapes (E2E-1 Access-Denied regression)", () => {
  it("output validates against the strict GetMeResponseSchema", async () => {
    const res = await getMeService({}, makeCtx());
    const r = getCallable("v1.identity.getMe").responseSchema.safeParse(res);
    if (!r.success) {
      throw new Error(r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n"));
    }
    expect(r.success).toBe(true);
  });

  it("keeps the load-bearing session fields intact", async () => {
    const res = (await getMeService({}, makeCtx())) as unknown as {
      user: Doc;
      memberships: Doc[];
      claims: Doc;
      activeTenant?: Doc;
    };
    // The session guard derives access from claims.tenantId + membership.role.
    expect(res.claims["tenantId"]).toBe(TID);
    expect(res.memberships[0]!["role"]).toBe("teacher");
    expect(res.memberships[0]!["tenantId"]).toBe(TID);
    // Empty tenantCode healed from the tenant doc (authoritative).
    expect(res.memberships[0]!["tenantCode"]).toBe("CHAITANY");
    expect(res.claims["tenantCode"]).toBe("CHAITANY");
    // classIds (legacy claims-sync key) must NOT leak into memberships.
    expect("classIds" in res.memberships[0]!).toBe(false);
    // Trial signal survives for the app-side lock screens.
    expect(res.activeTenant?.["trialEndsAt"]).toBe("2026-07-18T14:11:31.072Z");
    expect(res.activeTenant?.["status"]).toBe("trial");
  });
});
