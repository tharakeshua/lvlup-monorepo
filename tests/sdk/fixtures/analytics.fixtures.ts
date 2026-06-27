/**
 * Per-callable fixtures for `v1.analytics.*`. See callable-fixture.ts.
 *
 * Analytics reads are materialized + callable-only (rules default-deny, D13/D14)
 * and parent reads are gated `studentId ∈ ctx.studentIds` (MERGE-PARENT-GATE).
 */
import { registerFixture } from "./callable-fixture";
import { localSeedId } from "../harness/fixtures-ids";

const STUDENT = localSeedId("student", "sam");
const CLASS = localSeedId("class", "10a");
const EXAM = localSeedId("exam", "midterm");

registerFixture("v1.analytics.getSummary", {
  request: { scope: "student", studentId: STUDENT },
  as: "teacher",
  seedState: "enrolled-student",
});
registerFixture("v1.analytics.getExamAnalytics", {
  request: { examId: EXAM },
  as: "teacher",
  seedState: "released-exam",
});
registerFixture("v1.analytics.listInsights", {
  request: { studentId: STUDENT, limit: 20 },
  as: "teacher",
  seedState: "enrolled-student",
});
registerFixture("v1.analytics.dismissInsight", {
  request: { insightId: localSeedId("insight", "i1") },
  as: "student",
  seedState: "enrolled-student",
});
registerFixture("v1.analytics.getPerformanceTrends", {
  request: { studentId: STUDENT, granularity: "week" },
  as: "teacher",
  seedState: "enrolled-student",
});
registerFixture("v1.analytics.getChildSummary", {
  // parent-gate: studentId MUST be in ctx.studentIds
  request: { studentId: STUDENT },
  as: "parent",
  seedState: "parent-linked",
});
registerFixture("v1.analytics.listLinkedChildren", {
  request: {},
  as: "parent",
  seedState: "parent-linked",
});
registerFixture("v1.analytics.getCostSummary", {
  // admin-scoped cost roll-up; tenantAdmin carries an active tenant (super-admin has
  // none on-claim and getCostSummary is tenant-scoped, not cross-tenant).
  request: { granularity: "daily" },
  as: "tenantAdmin",
  seedState: "contract-tenant",
});
registerFixture("v1.analytics.getLeaderboard", {
  request: { scope: "space", spaceId: localSeedId("space", "dsa"), limit: 10 },
  as: "student",
  seedState: "enrolled-student",
});
registerFixture("v1.analytics.listParentAlerts", {
  request: {},
  as: "parent",
  seedState: "parent-linked",
});
registerFixture("v1.analytics.listPlatformActivity", {
  request: { limit: 20 },
  as: "superAdmin",
  seedState: "contract-tenant",
});

void CLASS;
