/**
 * authority-flag-coverage (SDK-LAYERS-PLAN.md §3.1 / T9 / CONV-4).
 *
 * Proves the conservative-optimistic allow-list still excludes authority-
 * sensitive writes at build time:
 *   (1) AUTHORITY_CALLABLES is byte-equal to the set REGENERATED from live
 *       CALLABLES (`filter(d => d.authoritySensitive)`) — no stale hand list.
 *   (2) Every ⚷ callable (grading/publish/lifecycle/purchase/claims/secret) is
 *       flagged authoritySensitive:true.
 *   (3) No callable on the §4.4 OPTIMISTIC_ALLOWLIST is in AUTHORITY_CALLABLES.
 *   (4) OPTIMISTIC_COUNTER_ALLOWLIST contains ONLY unreadCount/unseenCount
 *       (SEC-08) — no progress/score/points/rank/purchase counter.
 *
 * Self-skips until the contract surfaces these registries.
 */
import { describe, it, expect } from "vitest";
import * as contract from "../index";

const C = contract as unknown as {
  CALLABLES?: Record<string, { authoritySensitive?: boolean }>;
  AUTHORITY_CALLABLES?: readonly string[];
  OPTIMISTIC_ALLOWLIST?: readonly string[];
  OPTIMISTIC_COUNTER_ALLOWLIST?: readonly string[];
};

const ready = Boolean(C.CALLABLES && C.AUTHORITY_CALLABLES);

/** The closed ⚷ set that MUST be authoritySensitive (REVIEW §6 owners). */
const MUST_BE_AUTHORITY = [
  "v1.levelup.submitTestSession",
  "v1.levelup.evaluateAnswer",
  "v1.levelup.recordItemAttempt",
  "v1.levelup.purchaseSpace",
  "v1.levelup.saveSpace", // lifecycle publish/archive rides saveSpace.status
  "v1.autograde.gradeQuestion",
  "v1.autograde.releaseResults",
  "v1.autograde.publishExam",
  "v1.identity.startImpersonation",
  "v1.identity.endImpersonation",
  "v1.identity.setUserStatus",
  "v1.identity.createOrgUser",
];

/** The §4.4 optimistic allow-list (the ONLY ✅ surfaces). */
const EXPECTED_OPTIMISTIC = [
  "v1.levelup.recordItemAttempt",
  "v1.levelup.sendChatMessage",
  "v1.identity.markNotificationRead",
  "v1.identity.markAnnouncementRead",
  "v1.levelup.dismissInsight",
  "v1.analytics.dismissInsight",
  "v1.levelup.markAchievementsSeen",
];

(ready ? describe : describe.skip)("authority-flag-coverage", () => {
  it("AUTHORITY_CALLABLES === regenerated set from live CALLABLES", () => {
    const regenerated = Object.values(C.CALLABLES!)
      .filter((d) => d.authoritySensitive)
      .map((d) => (d as { name?: string }).name)
      .filter(Boolean)
      .sort();
    const declared = [...(C.AUTHORITY_CALLABLES ?? [])].sort();
    expect(declared).toEqual(regenerated);
  });

  it("every ⚷ callable is flagged authoritySensitive:true", () => {
    const auth = new Set(C.AUTHORITY_CALLABLES ?? []);
    const missing = MUST_BE_AUTHORITY.filter((n) => C.CALLABLES![n] && !auth.has(n));
    expect(missing, `⚷ callables not flagged:\n${missing.join("\n")}`).toEqual([]);
  });

  it("NO optimistic-allow-list callable is authority-sensitive", () => {
    const auth = new Set(C.AUTHORITY_CALLABLES ?? []);
    const list = C.OPTIMISTIC_ALLOWLIST ?? EXPECTED_OPTIMISTIC;
    const overlap = list.filter((n) => auth.has(n) && n !== "v1.levelup.recordItemAttempt");
    // recordItemAttempt is the documented carve-out: optimistic but server-scored
    // (CD13) — it reconciles from the authoritative response, never sends a score.
    expect(overlap, `optimistic ∩ authority:\n${overlap.join("\n")}`).toEqual([]);
  });

  it("OPTIMISTIC_COUNTER_ALLOWLIST is exactly [unreadCount, unseenCount] (SEC-08)", () => {
    const counters = [...(C.OPTIMISTIC_COUNTER_ALLOWLIST ?? [])].sort();
    expect(counters).toEqual(["unreadCount", "unseenCount"]);
    const forbidden = ["pointsEarned", "xp", "rank", "score", "currentCount", "enrolledSpaceIds"];
    for (const f of forbidden) expect(counters).not.toContain(f);
  });
});
