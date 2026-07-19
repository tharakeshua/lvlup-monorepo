/**
 * LVLUP_COLLECTION_PREFIX — env-driven top-level collection prefix (Student-Vertical, Slice A).
 *
 * Emulator-free, pure-string assertions on the repo-admin path builders:
 *   (a) NO env set → byte-identical to the pre-prefix baseline (zero behaviour change).
 *   (b) `LVLUP_COLLECTION_PREFIX='v2_'` → top-level collection NAMES prefixed; a tenant-scoped
 *       path is prefixed ONLY on its `tenants` root (NOT double-prefixed on subcollections).
 *   (c) MIRROR: repo-admin builders === `@levelup/seed` `Paths` for the same logical collection
 *       under the same prefix (seeded data lands exactly where the callables read).
 */
import { afterEach, describe, expect, it } from "vitest";
import {
  collectionPrefix,
  topLevel,
  tenantsRoot,
  tenantDoc,
  tenantCollection,
  spaceDoc,
  itemsPath,
  itemDoc,
  spaceProgressDoc,
  conversationSessionDoc,
  conversationSessionKeyDoc,
  conversationSessionKeyId,
  conversationMessageDoc,
  conversationTurnDoc,
  conversationEvidenceDoc,
  itemSubmissionDoc,
  itemSubmissionAttemptDoc,
  progressApplicationDoc,
  usersCollection,
  usersDoc,
  userMembershipsCollection,
  userMembershipDoc,
  tenantCodesCollection,
  tenantCodeDoc,
  consumerProfilesCollection,
  consumerProfileDoc,
  impersonationSessionsCollection,
  globalEvaluationPresetDoc,
  platformActivityLogCollection,
  auditPath,
} from "./paths.js";

const ENV = "LVLUP_COLLECTION_PREFIX";

afterEach(() => {
  delete process.env[ENV];
});

describe("repo-admin paths — default empty prefix (byte-identical baseline)", () => {
  it("collectionPrefix() is empty by default", () => {
    delete process.env[ENV];
    expect(collectionPrefix()).toBe("");
    expect(topLevel("users")).toBe("users");
  });

  it("top-level builders are unprefixed", () => {
    delete process.env[ENV];
    expect(usersCollection()).toBe("users");
    expect(usersDoc("u1")).toBe("users/u1");
    expect(userMembershipsCollection()).toBe("userMemberships");
    expect(userMembershipDoc("u1", "t1")).toBe("userMemberships/u1_t1");
    expect(tenantsRoot()).toBe("tenants");
    expect(tenantDoc("t1")).toBe("tenants/t1");
    expect(tenantCodesCollection()).toBe("tenantCodes");
    expect(tenantCodeDoc("SUB001")).toBe("tenantCodes/SUB001");
    expect(consumerProfilesCollection()).toBe("consumerProfiles");
    expect(consumerProfileDoc("u1")).toBe("consumerProfiles/u1");
    expect(impersonationSessionsCollection()).toBe("impersonationSessions");
    expect(globalEvaluationPresetDoc("p1")).toBe("globalEvaluationPresets/p1");
    expect(platformActivityLogCollection()).toBe("platformActivityLog");
    expect(auditPath("__platform__")).toBe("platformAudit");
  });

  it("tenant-scoped builders are unchanged", () => {
    delete process.env[ENV];
    expect(tenantCollection("t1", "spaces")).toBe("tenants/t1/spaces");
    expect(spaceDoc("t1", "s1")).toBe("tenants/t1/spaces/s1");
    expect(itemsPath("t1", "s1", "sp1")).toBe("tenants/t1/spaces/s1/storyPoints/sp1/items");
    expect(itemDoc("t1", "s1", "sp1", "i1")).toBe("tenants/t1/spaces/s1/storyPoints/sp1/items/i1");
    expect(spaceProgressDoc("t1", "u1", "s1")).toBe("tenants/t1/spaceProgress/u1_s1");
    expect(conversationSessionDoc("t1", "c1")).toBe("tenants/t1/conversationSessions/c1");
    expect(conversationMessageDoc("t1", "c1", "m1")).toBe(
      "tenants/t1/conversationSessions/c1/messages/m1"
    );
    expect(conversationTurnDoc("t1", "c1", "turn1")).toBe(
      "tenants/t1/conversationSessions/c1/turns/turn1"
    );
    expect(conversationEvidenceDoc("t1", "c1", "e1")).toBe(
      "tenants/t1/conversationSessions/c1/privateEvidence/e1"
    );
    expect(itemSubmissionDoc("t1", "cis_1")).toBe("tenants/t1/itemSubmissions/cis_1");
    expect(itemSubmissionAttemptDoc("t1", "cis_1", "attempt_1")).toBe(
      "tenants/t1/itemSubmissions/cis_1/evaluationAttempts/attempt_1"
    );
    expect(progressApplicationDoc("t1", "u1", "s1", "cis_1")).toBe(
      "tenants/t1/spaceProgress/u1_s1/applications/cis_1"
    );
    expect(auditPath("t1")).toBe("tenants/t1/audit");
  });

  it("derives one opaque, stable session-key id per owner/mode/context tuple", () => {
    const key = conversationSessionKeyId("u1", "tutor", "tutor:space:s1");
    expect(key).toMatch(/^csk_[A-Za-z0-9_-]{26}$/);
    expect(conversationSessionKeyId("u1", "tutor", "tutor:space:s1")).toBe(key);
    expect(conversationSessionKeyId("u1", "question_help", "tutor:space:s1")).not.toBe(key);
    expect(conversationSessionKeyDoc("t1", "u1", "tutor", "tutor:space:s1")).toBe(
      `tenants/t1/conversationSessionKeys/${key}`
    );
  });
});

describe("repo-admin paths — LVLUP_COLLECTION_PREFIX=v2_", () => {
  it("prefixes ONLY top-level collection names", () => {
    process.env[ENV] = "v2_";
    expect(collectionPrefix()).toBe("v2_");
    expect(usersCollection()).toBe("v2_users");
    expect(usersDoc("u1")).toBe("v2_users/u1");
    expect(userMembershipsCollection()).toBe("v2_userMemberships");
    expect(userMembershipDoc("u1", "t1")).toBe("v2_userMemberships/u1_t1");
    expect(tenantsRoot()).toBe("v2_tenants");
    expect(tenantDoc("t1")).toBe("v2_tenants/t1");
    expect(tenantCodesCollection()).toBe("v2_tenantCodes");
    expect(tenantCodeDoc("SUB001")).toBe("v2_tenantCodes/SUB001");
    expect(consumerProfilesCollection()).toBe("v2_consumerProfiles");
    expect(impersonationSessionsCollection()).toBe("v2_impersonationSessions");
    expect(globalEvaluationPresetDoc("p1")).toBe("v2_globalEvaluationPresets/p1");
    expect(platformActivityLogCollection()).toBe("v2_platformActivityLog");
    expect(auditPath("__platform__")).toBe("v2_platformAudit");
  });

  it("prefixes a tenant-scoped path ONLY on the `tenants` root (no double-prefix)", () => {
    process.env[ENV] = "v2_";
    const deep = itemDoc("t1", "s1", "sp1", "i1");
    expect(deep).toBe("v2_tenants/t1/spaces/s1/storyPoints/sp1/items/i1");
    expect(deep.match(/v2_/g)?.length).toBe(1);
    expect(spaceProgressDoc("t1", "u1", "s1")).toBe("v2_tenants/t1/spaceProgress/u1_s1");
    expect(conversationSessionDoc("t1", "c1")).toBe("v2_tenants/t1/conversationSessions/c1");
    expect(conversationSessionKeyDoc("t1", "u1", "tutor", "tutor:space:s1")).toMatch(
      /^v2_tenants\/t1\/conversationSessionKeys\/csk_[A-Za-z0-9_-]{26}$/
    );
    expect(conversationMessageDoc("t1", "c1", "m1")).toBe(
      "v2_tenants/t1/conversationSessions/c1/messages/m1"
    );
    expect(itemSubmissionDoc("t1", "cis_1")).toBe("v2_tenants/t1/itemSubmissions/cis_1");
    expect(progressApplicationDoc("t1", "u1", "s1", "cis_1")).toBe(
      "v2_tenants/t1/spaceProgress/u1_s1/applications/cis_1"
    );
    expect(auditPath("t1")).toBe("v2_tenants/t1/audit");
  });
});

/**
 * MIRROR contract: repo-admin builders must produce the SAME path string as the
 * `@levelup/seed` `Paths` object for the same logical collection (so seeded data
 * lands exactly where the callables read). `@levelup/seed` is NOT a dependency of
 * this package, so rather than import it we assert against the EXACT literal
 * strings that `packages/seed/src/__tests__/paths.prefix.test.ts` also asserts
 * for `Paths` — the two test files pin the identical mirror contract on both sides.
 */
describe("MIRROR: repo-admin builders === @levelup/seed Paths (shared literal contract)", () => {
  it("default prefix — identical strings on both sides", () => {
    delete process.env[ENV];
    // top-level (mirror of SeedPaths.user/users/membership/tenant/tenantCode/globalPreset)
    expect(usersDoc("u1")).toBe("users/u1");
    expect(usersCollection()).toBe("users");
    expect(userMembershipDoc("u1", "t1")).toBe("userMemberships/u1_t1");
    expect(tenantDoc("t1")).toBe("tenants/t1");
    expect(tenantsRoot()).toBe("tenants");
    expect(tenantCodeDoc("SUB001")).toBe("tenantCodes/SUB001");
    expect(globalEvaluationPresetDoc("p1")).toBe("globalEvaluationPresets/p1");
    // tenant-scoped (mirror of SeedPaths.space/items/item/spaceProgress)
    expect(spaceDoc("t1", "s1")).toBe("tenants/t1/spaces/s1");
    expect(itemsPath("t1", "s1", "sp1")).toBe("tenants/t1/spaces/s1/storyPoints/sp1/items");
    expect(itemDoc("t1", "s1", "sp1", "i1")).toBe("tenants/t1/spaces/s1/storyPoints/sp1/items/i1");
    expect(spaceProgressDoc("t1", "u1", "s1")).toBe("tenants/t1/spaceProgress/u1_s1");
  });

  it("v2_ prefix — identical strings on both sides", () => {
    process.env[ENV] = "v2_";
    expect(usersDoc("u1")).toBe("v2_users/u1");
    expect(userMembershipDoc("u1", "t1")).toBe("v2_userMemberships/u1_t1");
    expect(tenantDoc("t1")).toBe("v2_tenants/t1");
    expect(tenantCodeDoc("SUB001")).toBe("v2_tenantCodes/SUB001");
    expect(globalEvaluationPresetDoc("p1")).toBe("v2_globalEvaluationPresets/p1");
    expect(spaceDoc("t1", "s1")).toBe("v2_tenants/t1/spaces/s1");
    expect(itemDoc("t1", "s1", "sp1", "i1")).toBe(
      "v2_tenants/t1/spaces/s1/storyPoints/sp1/items/i1"
    );
    expect(spaceProgressDoc("t1", "u1", "s1")).toBe("v2_tenants/t1/spaceProgress/u1_s1");
  });
});
