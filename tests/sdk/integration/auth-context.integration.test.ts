/**
 * Auth-context harness integration test (emulator).
 *
 * Demonstrates + guards the per-test auth-context helpers end-to-end:
 *   • `signInAsDemoUser(role)` mints a real ID token whose decoded claims match
 *     the role's `buildClaimsForRole` (so contract tests address the right ctx),
 *   • the demo user exists in the Auth emulator with the right custom claims,
 *   • `isSuperAdmin` is a CLAIM, tenant is claim-derived (D2 / §6.1).
 *
 * Self-skips when emulators are down.
 */
import { describe, it, beforeAll, expect } from "vitest";
import { requireEmulators } from "../harness/per-test-setup";
import { signInAsDemoUser, ensureDemoAuthUser, buildClaimsForRole } from "../harness/auth-context";
import { adminAuth } from "../harness/emulator";

const skip = () => Boolean(requireEmulators());

describe.skipIf(skip())("auth-context harness (emulator)", () => {
  beforeAll(() => {
    /* harness global-setup already exported emulator env + seeded */
  });

  it("mints an ID token for a teacher with claim-derived tenant + role", async () => {
    const { uid, idToken } = await signInAsDemoUser("teacher");
    expect(idToken).toBeTruthy();
    const decoded = await adminAuth().verifyIdToken(idToken);
    expect(decoded.uid).toBe(uid);
    // claims travel on the token (PlatformClaims)
    expect(decoded["role"]).toBe("teacher");
    expect(decoded["activeTenantId"]).toBeTruthy();
    expect(decoded["isSuperAdmin"]).toBe(false);
  });

  it("super-admin has isSuperAdmin claim and null active tenant (tenantOverride only)", async () => {
    const { idToken } = await signInAsDemoUser("superAdmin");
    const decoded = await adminAuth().verifyIdToken(idToken);
    expect(decoded["isSuperAdmin"]).toBe(true);
    expect(decoded["activeTenantId"]).toBeNull();
  });

  it("parent claims carry linked studentIds (parent-gate substrate)", async () => {
    const { claims } = await ensureDemoAuthUser("parent");
    expect(claims.studentIds?.length).toBeGreaterThan(0);
    // mirror builder is deterministic
    expect(claims).toEqual(buildClaimsForRole("parent"));
  });

  it("overrides flow through to the minted claims", async () => {
    const { idToken } = await signInAsDemoUser("teacher", { classIds: ["c1", "c2"] });
    const decoded = await adminAuth().verifyIdToken(idToken);
    expect(decoded["classIds"]).toEqual(["c1", "c2"]);
  });
});
