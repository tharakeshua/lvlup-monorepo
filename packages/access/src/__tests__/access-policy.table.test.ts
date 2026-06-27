/**
 * Per-rule access policy TABLE test (server-shared.md §8 #8 / T5).
 *
 * Test #8 only proves a rule EXISTS + authorize is called. T5 requires per-rule
 * CORRECTNESS: a positive case (authorized ctx allowed) and the disqualifying
 * negatives (each denied with PERMISSION_DENIED) — especially the parent-gate
 * (`studentId ∈ ctx.studentIds`) and the guidance-leak gate (§6.7).
 *
 * Built over the harness's server-side AuthContext (in-memory ctx; no emulator).
 * Self-skips until `@levelup/access` exports `authorize` + `ACCESS_RULES`.
 */
import { describe, it, expect } from "vitest";
import { makeAuthContext, makeSystemContext } from "../../../../tests/sdk/harness/auth-context";
import { localSeedId } from "../../../../tests/sdk/harness/fixtures-ids";
import * as access from "../index";

const A = access as unknown as {
  authorize?: (ctx: unknown, action: string, resource?: unknown) => void | Promise<void>;
  ACCESS_RULES?: Record<string, unknown>;
};

const ready = Boolean(A.authorize && A.ACCESS_RULES);
const d = ready ? describe : describe.skip;

async function denies(ctx: unknown, action: string, resource?: unknown): Promise<boolean> {
  try {
    await A.authorize!(ctx, action, resource);
    return false;
  } catch (e) {
    return (
      (e as { code?: string }).code === "PERMISSION_DENIED" ||
      /PERMISSION_DENIED|denied/i.test(String((e as Error).message))
    );
  }
}

d("ACCESS_RULES per-rule correctness", () => {
  it("every Action in ACCESS_RULES is non-empty (completeness)", () => {
    for (const [action, rule] of Object.entries(A.ACCESS_RULES!)) {
      expect(rule, `rule for ${action}`).toBeDefined();
    }
  });

  it("teacher may grade.manual; student is denied", async () => {
    const teacher = makeAuthContext("teacher");
    const student = makeAuthContext("student");
    await expect(Promise.resolve(A.authorize!(teacher, "grade.manual"))).resolves.not.toThrow();
    expect(await denies(student, "grade.manual")).toBe(true);
  });

  it("PARENT-GATE: child.read allowed for a linked child, denied for an unlinked one", async () => {
    const parent = makeAuthContext("parent"); // linked to `student.sam`
    const linked = localSeedId("student", "student.sam"); // matches buildClaimsForRole parent.studentIds
    const unlinked = localSeedId("student", "student.nora");
    await expect(
      Promise.resolve(
        A.authorize!(parent, "child.read", { studentId: parent.studentIds[0] ?? linked })
      )
    ).resolves.not.toThrow();
    expect(await denies(parent, "child.read", { studentId: unlinked })).toBe(true);
  });

  it("GUIDANCE-LEAK GATE: a student is denied rubric.guidance.read", async () => {
    const student = makeAuthContext("student");
    expect(await denies(student, "rubric.guidance.read")).toBe(true);
  });

  it("an impersonated session (impersonating:true) cannot re-impersonate or sync claims", async () => {
    const impersonated = makeAuthContext("teacher", {
      claimsOverride: { isSuperAdmin: false },
    });
    // simulate the constrained claim by tagging the ctx
    (impersonated as unknown as { impersonating?: boolean }).impersonating = true;
    expect(await denies(impersonated, "user.impersonate.start")).toBe(true);
    expect(await denies(impersonated, "claims.sync")).toBe(true);
  });

  it("SystemContext cannot operate across tenants", async () => {
    const sys = makeSystemContext(localSeedId("tenant", "contract"));
    const otherTenantResource = { tenantId: localSeedId("tenant", "other") };
    // a cross-tenant write must be denied (only audited platform rollups excepted)
    expect(await denies(sys, "space.write", otherTenantResource)).toBe(true);
  });
});
