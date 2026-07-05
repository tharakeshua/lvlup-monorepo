/**
 * `evaluateTenantAccess` — the SSOT login/access gate over tenant status
 * (E2E-1 P1-7: trial tenants were locked out of every app's school-code login).
 *
 * Locks: 'trial' has FULL access until trialEndsAt passes; a missing/null
 * trialEndsAt NEVER locks a trial out (fail-open — the server is the
 * enforcement authority); 'expired' surfaces as trial_expired; every other
 * non-active status is plain inactive. TenantPublicView carries the optional
 * trialEndsAt so pre-auth gates can decide this (optional: deployed backends
 * that predate the field must keep passing literal-true response validation).
 */
import { describe, it, expect } from "vitest";
import { evaluateTenantAccess, TenantPublicViewSchema } from "../entities/identity/tenant.js";

const NOW = new Date("2026-07-04T12:00:00.000Z");

describe("evaluateTenantAccess", () => {
  it("active → allowed (not trial)", () => {
    expect(evaluateTenantAccess({ status: "active" }, NOW)).toEqual({
      allowed: true,
      trial: false,
    });
  });

  it("trial with future trialEndsAt → allowed", () => {
    expect(
      evaluateTenantAccess({ status: "trial", trialEndsAt: "2026-07-18T00:00:00.000Z" }, NOW)
    ).toEqual({ allowed: true, trial: true });
  });

  it("trial with missing/null trialEndsAt → allowed (fail-open)", () => {
    expect(evaluateTenantAccess({ status: "trial" }, NOW).allowed).toBe(true);
    expect(evaluateTenantAccess({ status: "trial", trialEndsAt: null }, NOW).allowed).toBe(true);
  });

  it("trial past trialEndsAt → trial_expired", () => {
    expect(
      evaluateTenantAccess({ status: "trial", trialEndsAt: "2026-07-01T00:00:00.000Z" }, NOW)
    ).toEqual({ allowed: false, reason: "trial_expired" });
  });

  it("expired status → trial_expired", () => {
    expect(evaluateTenantAccess({ status: "expired" }, NOW)).toEqual({
      allowed: false,
      reason: "trial_expired",
    });
  });

  it("suspended/deactivated/unknown → inactive", () => {
    for (const status of ["suspended", "deactivated", "", "bogus"]) {
      expect(evaluateTenantAccess({ status }, NOW)).toEqual({
        allowed: false,
        reason: "inactive",
      });
    }
  });
});

describe("TenantPublicView.trialEndsAt (pre-auth trial signal)", () => {
  it("parses WITHOUT trialEndsAt (deployed-backend back-compat)", () => {
    expect(() =>
      TenantPublicViewSchema.parse({ tenantId: "t1", name: "S", status: "trial" })
    ).not.toThrow();
  });

  it("parses with trialEndsAt as ISO timestamp or null", () => {
    expect(() =>
      TenantPublicViewSchema.parse({
        tenantId: "t1",
        name: "S",
        status: "trial",
        trialEndsAt: "2026-07-18T00:00:00.000Z",
      })
    ).not.toThrow();
    expect(() =>
      TenantPublicViewSchema.parse({
        tenantId: "t1",
        name: "S",
        status: "trial",
        trialEndsAt: null,
      })
    ).not.toThrow();
  });
});
