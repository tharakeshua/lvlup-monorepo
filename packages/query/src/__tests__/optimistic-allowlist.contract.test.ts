/**
 * Optimistic allow-list invariants — UNIT/CONTRACT (no emulator).
 *
 * Locks SDK-LAYERS-PLAN §3.1 (authority-flag coverage), §4.4 (the closed
 * optimistic allow-list + OPTIMISTIC_COUNTER_ALLOWLIST), query-infra.md §6.2/§8:
 *
 *   1. OPTIMISTIC_ALLOWLIST is EXACTLY the documented ✅ set — and contains NO
 *      authoritySensitive callable (drift guard against AUTHORITY_CALLABLES).
 *   2. NO authoritySensitive callable has (or can be given) an optimistic recipe:
 *      `defineMutation({optimistic})` on a ⚷ callable THROWS at construction.
 *   3. `defineMutation({optimistic})` on a non-allow-listed callable THROWS.
 *   4. The allow-listed callables construct successfully with their recipes.
 *   5. OPTIMISTIC_COUNTER_ALLOWLIST === ['unreadCount','unseenCount'] and contains
 *      NO progress / score / points / rank / purchase / xp / stats counter
 *      (SEC-08 / CONV-4 cross-check against the §6.9 denormalized-counter set).
 *   6. The explicit NEVER-optimistic set (grading/publish/lifecycle/purchase/
 *      session-start/bulk/claims/saveStudyGoal/report) is absent from the allow-list.
 *
 * Self-skips until `@levelup/query` exports defineMutation + OPTIMISTIC_ALLOWLIST.
 */
import { describe, it, expect } from "vitest";
import * as query from "../index";
import * as contract from "@levelup/api-contract";

const Q = query as unknown as {
  defineMutation?: (spec: {
    callable?: string;
    name?: string;
    optimistic?: unknown;
    run?: unknown;
  }) => unknown;
  OPTIMISTIC_ALLOWLIST?: readonly string[];
  OPTIMISTIC_COUNTER_ALLOWLIST?: readonly string[];
  isAuthoritySensitive?: (name: string) => boolean;
};
const C = contract as unknown as {
  CALLABLES?: Record<string, { authoritySensitive?: boolean }>;
  AUTHORITY_CALLABLES?: readonly string[];
  OPTIMISTIC_ALLOWLIST?: readonly string[];
  OPTIMISTIC_COUNTER_ALLOWLIST?: readonly string[];
};

/** The canonical ✅ optimistic surfaces (§4.4). */
const EXPECTED_ALLOWLIST = [
  "v1.levelup.recordItemAttempt",
  "v1.levelup.sendChatMessage",
  "v1.identity.markNotificationRead",
  "v1.identity.markAnnouncementRead",
  "v1.levelup.dismissInsight",
  "v1.analytics.dismissInsight",
  "v1.levelup.markAchievementsSeen",
];

/** The explicit NEVER-optimistic set (§4.4 lint-flagged). */
const NEVER_OPTIMISTIC = [
  "v1.autograde.gradeQuestion",
  "v1.levelup.submitTestSession",
  "v1.levelup.evaluateAnswer",
  "v1.levelup.startTestSession",
  "v1.levelup.saveSpace",
  "v1.autograde.saveExam",
  "v1.autograde.releaseResults",
  "v1.identity.saveAnnouncement",
  "v1.levelup.purchaseSpace",
  "v1.levelup.saveStudyGoal",
  "v1.analytics.generateReport",
  "v1.identity.bulkImportStudents",
  "v1.identity.bulkUpdateStatus",
  "v1.identity.createOrgUser",
];

const allowlist = (): readonly string[] | undefined =>
  Q.OPTIMISTIC_ALLOWLIST ?? C.OPTIMISTIC_ALLOWLIST;
const counterAllowlist = (): readonly string[] | undefined =>
  Q.OPTIMISTIC_COUNTER_ALLOWLIST ?? C.OPTIMISTIC_COUNTER_ALLOWLIST;

const ready = Boolean(allowlist());

(ready ? describe : describe.skip)("OPTIMISTIC_ALLOWLIST membership (§4.4)", () => {
  it("contains every documented ✅ surface", () => {
    const set = new Set(allowlist()!);
    const missing = EXPECTED_ALLOWLIST.filter((n) => !set.has(n));
    expect(
      missing,
      `✅ surfaces missing from OPTIMISTIC_ALLOWLIST:\n${missing.join("\n")}`
    ).toEqual([]);
  });

  it("is EXACTLY the documented set (no extra surfaces sneaked in)", () => {
    expect([...allowlist()!].sort()).toEqual([...EXPECTED_ALLOWLIST].sort());
  });

  it("contains NONE of the explicit NEVER-optimistic callables", () => {
    const set = new Set(allowlist()!);
    const leaked = NEVER_OPTIMISTIC.filter((n) => set.has(n));
    expect(
      leaked,
      `NEVER-optimistic callables present in allow-list:\n${leaked.join("\n")}`
    ).toEqual([]);
  });
});

(ready ? describe : describe.skip)(
  "OPTIMISTIC_ALLOWLIST ∩ authoritySensitive === ∅ (§3.1 authority-flag-coverage)",
  () => {
    // recordItemAttempt is the ONE documented carve-out (§4.4 / CD13 / A11 / §6.5):
    // it is authoritySensitive (server scores the raw `answer`) AND on the optimistic
    // allow-list — the optimistic patch shows an in-flight attempt then reconciles
    // from the authoritative {progress,completed} response, never sending a score.
    const AUTHORITY_OPTIMISTIC_CARVEOUT = "v1.levelup.recordItemAttempt";

    it("no callable on the allow-list is authoritySensitive (except the recordItemAttempt carve-out)", () => {
      if (!C.CALLABLES) return;
      const offenders = allowlist()!
        .filter((n) => n !== AUTHORITY_OPTIMISTIC_CARVEOUT)
        .filter((n) => C.CALLABLES![n]?.authoritySensitive === true);
      expect(
        offenders,
        `allow-listed callables that are also authoritySensitive:\n${offenders.join("\n")}`
      ).toEqual([]);
    });

    it("no callable on the allow-list appears in AUTHORITY_CALLABLES (except the recordItemAttempt carve-out)", () => {
      if (!C.AUTHORITY_CALLABLES) return;
      const auth = new Set(C.AUTHORITY_CALLABLES);
      const offenders = allowlist()!
        .filter((n) => n !== AUTHORITY_OPTIMISTIC_CARVEOUT)
        .filter((n) => auth.has(n));
      expect(offenders).toEqual([]);
    });

    it("every documented ⚷ write (grading/publish/purchase/session) IS authoritySensitive", () => {
      if (!C.CALLABLES) return;
      const mustBeFlagged = [
        "v1.autograde.gradeQuestion",
        "v1.levelup.submitTestSession",
        "v1.levelup.evaluateAnswer",
        "v1.levelup.startTestSession",
        "v1.levelup.purchaseSpace",
        "v1.autograde.releaseResults",
      ];
      const unflagged = mustBeFlagged.filter(
        (n) => C.CALLABLES![n] && C.CALLABLES![n].authoritySensitive !== true
      );
      expect(
        unflagged,
        `⚷ callables NOT flagged authoritySensitive:\n${unflagged.join("\n")}`
      ).toEqual([]);
    });
  }
);

(ready ? describe : describe.skip)("OPTIMISTIC_COUNTER_ALLOWLIST (SEC-08 / CONV-4)", () => {
  it('is exactly ["unreadCount","unseenCount"]', () => {
    if (!counterAllowlist()) return;
    expect([...counterAllowlist()!].sort()).toEqual(["unreadCount", "unseenCount"]);
  });

  it("contains NO progress/score/points/rank/purchase/xp/stats counter (§6.9 cross-check)", () => {
    if (!counterAllowlist()) return;
    // The §6.9 denormalized authority counters that must NEVER be optimistically patched.
    const FORBIDDEN = [
      "pointsEarned",
      "totalPoints",
      "score",
      "maxScore",
      "bestScore",
      "rank",
      "xp",
      "level",
      "completionPct",
      "enrolledCount",
      "storyPointCount",
      "itemCount",
      "submissionCount",
      "usageCount",
      "messageCount",
      "currentCount", // StudyGoal
      "average", // ratingAggregate
      "count", // ratingAggregate / leaderboard
    ];
    const set = new Set(counterAllowlist()!);
    const leaked = FORBIDDEN.filter((c) => set.has(c));
    expect(
      leaked,
      `authority counters present in OPTIMISTIC_COUNTER_ALLOWLIST:\n${leaked.join("\n")}`
    ).toEqual([]);
  });

  it("only the two read-state counters are present (no third counter)", () => {
    if (!counterAllowlist()) return;
    expect(counterAllowlist()!.length).toBe(2);
  });
});

(Q.defineMutation ? describe : describe.skip)(
  "defineMutation runtime guard (§6.1) — optimistic forbidden on ⚷ / non-allow-listed",
  () => {
    const spec = (callable: string) => ({
      callable,
      name: callable,
      run: async () => ({}),
      optimistic: { apply: () => ({}), rollback: () => {} },
    });

    it("THROWS for optimistic on an authority-sensitive callable (gradeQuestion)", () => {
      expect(() => Q.defineMutation!(spec("v1.autograde.gradeQuestion"))).toThrow();
    });

    it("THROWS for optimistic on submitTestSession (grading authority)", () => {
      expect(() => Q.defineMutation!(spec("v1.levelup.submitTestSession"))).toThrow();
    });

    it("THROWS for optimistic on purchaseSpace (purchase authority)", () => {
      expect(() => Q.defineMutation!(spec("v1.levelup.purchaseSpace"))).toThrow();
    });

    it("THROWS for optimistic on a non-allow-listed (non-⚷) callable (saveSpace)", () => {
      expect(() => Q.defineMutation!(spec("v1.levelup.saveSpace"))).toThrow();
    });

    it("ALLOWS optimistic on each allow-listed callable", () => {
      for (const name of EXPECTED_ALLOWLIST) {
        expect(() => Q.defineMutation!(spec(name)), `${name} should construct`).not.toThrow();
      }
    });

    it("ALLOWS a standard (no optimistic) mutation on any callable", () => {
      expect(() =>
        Q.defineMutation!({
          callable: "v1.autograde.gradeQuestion",
          name: "v1.autograde.gradeQuestion",
          run: async () => ({}),
        })
      ).not.toThrow();
    });
  }
);

(Q.isAuthoritySensitive ? describe : describe.skip)(
  "isAuthoritySensitive reads the contract flag (§6.3)",
  () => {
    it("true for a grading callable", () => {
      if (!C.CALLABLES?.["v1.autograde.gradeQuestion"]) return;
      expect(Q.isAuthoritySensitive!("v1.autograde.gradeQuestion")).toBe(true);
    });
    it("false for an allow-listed optimistic callable", () => {
      if (!C.CALLABLES?.["v1.levelup.sendChatMessage"]) return;
      expect(Q.isAuthoritySensitive!("v1.levelup.sendChatMessage")).toBe(false);
    });
  }
);

(ready ? describe : describe.skip)(
  "allow-list drift guard — query package === contract package (§9.3)",
  () => {
    it("OPTIMISTIC_ALLOWLIST in @levelup/query equals the one in @levelup/api-contract", () => {
      if (!Q.OPTIMISTIC_ALLOWLIST || !C.OPTIMISTIC_ALLOWLIST) return;
      expect([...Q.OPTIMISTIC_ALLOWLIST].sort()).toEqual([...C.OPTIMISTIC_ALLOWLIST].sort());
    });
  }
);
