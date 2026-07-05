/**
 * DP-2 Part B — `ROLE_DESCRIPTORS` is the SSOT and EVERY role-keyed structure
 * regenerates from it EXHAUSTIVELY. A missing/extra descriptor (or a descriptor
 * whose id-field is dropped) must break a derived enum/rank/map/id-field set — this
 * test makes that guarantee load-bearing (it is what closes B-IDN-23: scanner can
 * never again be orphaned from the id-field maps/links).
 */
import { describe, it, expect } from "vitest";
import {
  ROLE_DESCRIPTORS,
  ID_ROLES,
  TENANT_ROLES,
  zTenantRole,
  ROLE_RANK,
  isAuthoringRole,
  repoKeyForRole,
  idFieldForRole,
  roleIdFields,
  type TenantRole,
} from "../entities/identity/role-registry.js";
import { PlatformClaimsSchema } from "../entities/identity/claims.js";
import { UserMembershipSchema } from "../entities/identity/membership.js";

const ROLE_KEYS = ROLE_DESCRIPTORS.map((d) => d.role);
const ID_FIELDS = ID_ROLES.map((d) => d.idField);

describe("ROLE_DESCRIPTORS — enum + rank derive exactly the descriptors", () => {
  it("TENANT_ROLES === descriptor roles (no missing / no extra)", () => {
    expect([...TENANT_ROLES].sort()).toEqual([...ROLE_KEYS].sort());
  });

  it("zTenantRole accepts EVERY role and rejects a non-role", () => {
    for (const r of ROLE_KEYS) expect(zTenantRole.safeParse(r).success).toBe(true);
    expect(zTenantRole.safeParse("examiner").success).toBe(false);
  });

  it("ROLE_RANK keys === roles and each value matches its descriptor", () => {
    expect(Object.keys(ROLE_RANK).sort()).toEqual([...ROLE_KEYS].sort());
    for (const d of ROLE_DESCRIPTORS) expect(ROLE_RANK[d.role as TenantRole]).toBe(d.rank);
  });

  it("isAuthoringRole matches each descriptor's `authoring` flag", () => {
    for (const d of ROLE_DESCRIPTORS) {
      expect(isAuthoringRole(d.role as TenantRole), d.role).toBe(d.authoring);
    }
    expect(isAuthoringRole(null)).toBe(false);
  });
});

describe("ROLE_DESCRIPTORS — repo/id-field maps derive from the descriptors", () => {
  it("repoKeyForRole / idFieldForRole return each provisionable descriptor's values", () => {
    for (const d of ID_ROLES) {
      expect(idFieldForRole(d.role as TenantRole)).toBe(d.idField);
      expect(repoKeyForRole(d.role as TenantRole)).toBe(d.repoKey);
    }
  });

  it("non-id roles (tenantAdmin/superAdmin) have no id field", () => {
    for (const d of ROLE_DESCRIPTORS.filter((x) => x.idField === "")) {
      expect(idFieldForRole(d.role as TenantRole)).toBeUndefined();
    }
  });
});

describe("ROLE_DESCRIPTORS — the shared id-field set covers every id role (B-IDN-23)", () => {
  it("roleIdFields keys === ID_ROLES id-fields (incl. scannerId)", () => {
    expect(Object.keys(roleIdFields).sort()).toEqual([...ID_FIELDS].sort());
    expect(Object.keys(roleIdFields)).toContain("scannerId");
  });

  it("PlatformClaimsSchema carries every role id field", () => {
    const shape = Object.keys((PlatformClaimsSchema as unknown as { shape: object }).shape);
    for (const f of ID_FIELDS) expect(shape, `claims.${f}`).toContain(f);
  });

  it("UserMembershipSchema carries every role id field", () => {
    const shape = Object.keys((UserMembershipSchema as unknown as { shape: object }).shape);
    for (const f of ID_FIELDS) expect(shape, `membership.${f}`).toContain(f);
  });

  it("a sample claim with all role id fields parses (incl. scannerId)", () => {
    const sample = {
      role: "teacher",
      teacherId: "t1",
      studentId: "s1",
      parentId: "p1",
      scannerId: "sc1",
      staffId: "st1",
    };
    expect(PlatformClaimsSchema.safeParse(sample).success).toBe(true);
  });
});
