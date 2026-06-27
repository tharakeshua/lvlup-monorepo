/**
 * LVLUP_COLLECTION_PREFIX — env-driven top-level collection prefix (Student-Vertical, Slice A).
 *
 * Emulator-free, pure-string assertions:
 *   (a) with NO env set → every top-level + tenant-scoped path is BYTE-IDENTICAL to the
 *       pre-prefix baseline (zero behaviour change for emulator/dev).
 *   (b) with `LVLUP_COLLECTION_PREFIX='v2_'` → top-level collection NAMES become prefixed,
 *       and a tenant-scoped path is prefixed ONLY on its `tenants` root (NOT double-prefixed).
 *
 * The mirror-equality assertion (seed Paths === repo-admin builders) lives in the
 * `@levelup/services` suite, which can import both packages.
 */
import { afterEach, describe, expect, it } from "vitest";
import { Paths } from "../engine/paths";

const ENV = "LVLUP_COLLECTION_PREFIX";

afterEach(() => {
  delete process.env[ENV];
});

describe("seed Paths — default empty prefix (byte-identical baseline)", () => {
  it("top-level collections are unprefixed", () => {
    delete process.env[ENV];
    expect(Paths.users()).toBe("users");
    expect(Paths.user("u1")).toBe("users/u1");
    expect(Paths.memberships()).toBe("userMemberships");
    expect(Paths.membership("u1", "t1")).toBe("userMemberships/u1_t1");
    expect(Paths.tenants()).toBe("tenants");
    expect(Paths.tenant("t1")).toBe("tenants/t1");
    expect(Paths.tenantCode("SUB001")).toBe("tenantCodes/SUB001");
    expect(Paths.globalPreset("p1")).toBe("globalEvaluationPresets/p1");
    expect(Paths.platformActivityLog("a1")).toBe("platformActivityLog/a1");
  });

  it("tenant-scoped paths are unchanged", () => {
    delete process.env[ENV];
    expect(Paths.spaces("t1")).toBe("tenants/t1/spaces");
    expect(Paths.item("t1", "s1", "sp1", "i1")).toBe(
      "tenants/t1/spaces/s1/storyPoints/sp1/items/i1"
    );
    expect(Paths.answerKey("t1", "s1", "sp1", "i1", "k1")).toBe(
      "tenants/t1/spaces/s1/storyPoints/sp1/items/i1/answerKeys/k1"
    );
    expect(Paths.spaceProgress("t1", "u1", "s1")).toBe("tenants/t1/spaceProgress/u1_s1");
    expect(Paths.testSubmission("t1", "sess1", "i1")).toBe(
      "tenants/t1/digitalTestSessions/sess1/submissions/i1"
    );
    expect(Paths.dailyCostSummary("t1", "2026-06-23")).toBe(
      "tenants/t1/costSummaries/daily_2026-06-23"
    );
  });
});

describe("seed Paths — LVLUP_COLLECTION_PREFIX=v2_", () => {
  it("prefixes ONLY the top-level collection name", () => {
    process.env[ENV] = "v2_";
    expect(Paths.users()).toBe("v2_users");
    expect(Paths.user("u1")).toBe("v2_users/u1");
    expect(Paths.memberships()).toBe("v2_userMemberships");
    expect(Paths.membership("u1", "t1")).toBe("v2_userMemberships/u1_t1");
    expect(Paths.tenants()).toBe("v2_tenants");
    expect(Paths.tenant("t1")).toBe("v2_tenants/t1");
    expect(Paths.tenantCode("SUB001")).toBe("v2_tenantCodes/SUB001");
    expect(Paths.globalPreset("p1")).toBe("v2_globalEvaluationPresets/p1");
    expect(Paths.platformActivityLog("a1")).toBe("v2_platformActivityLog/a1");
  });

  it("prefixes a tenant-scoped path ONLY on the `tenants` root (no double-prefix)", () => {
    process.env[ENV] = "v2_";
    // The deep nested item path: prefix appears once, on `tenants` only.
    expect(Paths.item("t1", "s1", "sp1", "i1")).toBe(
      "v2_tenants/t1/spaces/s1/storyPoints/sp1/items/i1"
    );
    expect(Paths.spaces("t1")).toBe("v2_tenants/t1/spaces");
    expect(Paths.spaceProgress("t1", "u1", "s1")).toBe("v2_tenants/t1/spaceProgress/u1_s1");
    expect(Paths.dailyCostSummary("t1", "2026-06-23")).toBe(
      "v2_tenants/t1/costSummaries/daily_2026-06-23"
    );
    // No subcollection segment is prefixed: exactly one `v2_` in the whole path.
    const deep = Paths.answerKey("t1", "s1", "sp1", "i1", "k1");
    expect(deep).toBe("v2_tenants/t1/spaces/s1/storyPoints/sp1/items/i1/answerKeys/k1");
    expect(deep.match(/v2_/g)?.length).toBe(1);
  });
});
