/**
 * Per-callable fixtures for `v1.identity.*` (representative request + seed-state).
 * See tests/sdk/fixtures/callable-fixture.ts for the mechanism.
 *
 * Coverage here is a STARTER set spanning the authority-sensitive and read paths
 * named in SDK-LAYERS-PLAN.md §2.1 + §9 (C2,C5,C8–C11,C22–C28,C30,C31). The
 * `registry-integrity` contract test will report any `v1.identity.*` callable
 * still missing a fixture, so this list is filled in lock-step with the registry.
 */
import { registerFixture } from "./callable-fixture";
import { CONTRACT_TENANT_CODE, localSeedId } from "../harness/fixtures-ids";

// --- public ---
registerFixture("v1.identity.lookupTenantByCode", {
  request: { tenantCode: CONTRACT_TENANT_CODE },
  as: "public",
  seedState: "none",
});

// --- reads ---
registerFixture("v1.identity.getMe", {
  request: {},
  as: "teacher",
  seedState: "contract-tenant",
});
registerFixture("v1.identity.getTenant", {
  request: {},
  as: "tenantAdmin",
  seedState: "contract-tenant",
});
registerFixture("v1.identity.listStudents", {
  request: { limit: 20 },
  as: "teacher",
  seedState: "contract-tenant",
});
registerFixture("v1.identity.listClasses", {
  request: { limit: 20 },
  as: "teacher",
  seedState: "contract-tenant",
});
registerFixture("v1.identity.listNotifications", {
  request: { limit: 20 },
  as: "student",
  seedState: "contract-tenant",
});
registerFixture("v1.identity.getNotificationBadge", {
  request: {},
  as: "student",
  seedState: "contract-tenant",
});

// --- writes (authority) ---
registerFixture("v1.identity.saveStudent", {
  request: {
    data: {
      firstName: "New",
      lastName: "Student",
      rollNumber: "R-999",
      classIds: [localSeedId("class", "10a")],
    },
  },
  as: "tenantAdmin",
  seedState: "contract-tenant",
});
registerFixture("v1.identity.saveClass", {
  // `grade` is required; the session selector is `academicSessionId` (not `sessionId`).
  request: {
    data: { name: "Grade 11B", grade: "11", academicSessionId: localSeedId("session", "2026") },
  },
  as: "tenantAdmin",
  seedState: "contract-tenant",
});

// --- conservative optimistic (✅) ---
registerFixture("v1.identity.markNotificationRead", {
  request: { mode: "all" },
  as: "student",
  seedState: "contract-tenant",
});

// --- notification preferences (C2) ---
registerFixture("v1.identity.getNotificationPreferences", {
  request: {},
  as: "student",
  seedState: "contract-tenant",
});
registerFixture("v1.identity.saveNotificationPreferences", {
  request: { enabledTypes: ["space_published"] },
  as: "student",
  seedState: "contract-tenant",
});

// --- super-admin / platform (C25–C28, C30, C31) ---
registerFixture("v1.identity.searchUsers", {
  request: { query: "alice", limit: 20 },
  as: "superAdmin",
  seedState: "contract-tenant",
});
registerFixture("v1.identity.startImpersonation", {
  request: {
    targetUid: localSeedId("uid", "teacher.alice"),
    tenantOverride: localSeedId("tenant", "contract"),
    reason: "support ticket #1",
  },
  as: "superAdmin",
  seedState: "contract-tenant",
  tenantOverride: localSeedId("tenant", "contract"),
});
registerFixture("v1.identity.endImpersonation", {
  request: {},
  as: "superAdmin",
  seedState: "contract-tenant",
});
