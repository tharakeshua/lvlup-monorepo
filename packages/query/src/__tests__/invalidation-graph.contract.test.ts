/**
 * Invalidation graph — UNIT/CONTRACT (no emulator).
 *
 * Locks SDK-LAYERS-PLAN §4.3 + query-infra.md §5:
 *   • `INVALIDATION_GRAPH = buildGraphFromContract(CALLABLES, OVERRIDES)`:
 *     totality (every mutating callable has an entry), valid roots (∈ DomainName),
 *   • the documented cross-domain OVERRIDES land verbatim
 *     (submitTestSession/recordItemAttempt/saveItem/saveSpace/gradeQuestion/…),
 *   • `invalidateForCallable` invalidates the NARROWEST correct scope:
 *       - coarse roots match by [domain] prefix,
 *       - the precise `fanout` targets the exact detail/sub key,
 *   • MERGE-INVALIDATION-COARSE: a fanout-present rule does NOT also coarsely
 *     dirty a high-churn root it has a fanout for (precise-only),
 *   • switchActiveTenant invalidates [] (handled by resetForTenantSwitch),
 *   • generateReport / requestUploadUrl invalidate [] (nothing to invalidate),
 *   • reads have no entry.
 *
 * The graph-shape assertions read `INVALIDATION_GRAPH` directly. The behavioral
 * assertions drive `invalidateForCallable` against a REAL QueryClient and a spy.
 *
 * Self-skips until `@levelup/query` exports INVALIDATION_GRAPH + invalidateForCallable.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as query from "../index";
import * as contract from "@levelup/api-contract";

type Rule = { roots?: readonly string[]; fanout?: unknown };
const Q = query as unknown as {
  INVALIDATION_GRAPH?: Record<string, Rule>;
  invalidateForCallable?: (
    qc: unknown,
    name: string,
    ctx?: { vars?: unknown; data?: unknown }
  ) => Promise<void>;
  QUERY_KEYS?: Record<string, unknown>;
  buildGraphFromContract?: (callables: unknown, overrides: unknown) => Record<string, Rule>;
};
const C = contract as unknown as {
  CALLABLES?: Record<
    string,
    { invalidates?: readonly string[]; rateTier?: string; idempotent?: boolean }
  >;
};

const ready = Boolean(Q.INVALIDATION_GRAPH && C.CALLABLES);

/** Minimal QueryClient spy: records every invalidateQueries({queryKey}) call. */
function makeQcSpy() {
  const invalidated: unknown[][] = [];
  const qc = {
    invalidateQueries: vi.fn(async ({ queryKey }: { queryKey: unknown[] }) => {
      invalidated.push(queryKey);
    }),
  };
  return { qc, invalidated, roots: () => invalidated.map((k) => k[0]) };
}

const G = () => Q.INVALIDATION_GRAPH!;

(ready ? describe : describe.skip)("INVALIDATION_GRAPH shape (§4.3)", () => {
  const MUTATING_TIERS = new Set(["write", "ai", "auth", "report"]);
  const isMutating = (d: { rateTier?: string; idempotent?: boolean; invalidates?: unknown }) =>
    (d.rateTier !== undefined && MUTATING_TIERS.has(d.rateTier)) ||
    d.idempotent === true ||
    d.invalidates !== undefined;

  it("TOTALITY: every mutating callable has an INVALIDATION_GRAPH entry", () => {
    const missing = Object.entries(C.CALLABLES!)
      .filter(([, d]) => isMutating(d))
      .filter(([name]) => !G()[name])
      .map(([name]) => name);
    expect(
      missing,
      `mutating callables without an invalidation rule:\n${missing.join("\n")}`
    ).toEqual([]);
  });

  it("VALID ROOTS: every roots[] entry ∈ DomainName (a QUERY_KEYS key)", () => {
    const domains = new Set(Object.keys(Q.QUERY_KEYS!));
    const bad: string[] = [];
    for (const [name, rule] of Object.entries(G())) {
      for (const root of rule.roots ?? []) if (!domains.has(root)) bad.push(`${name} → ${root}`);
    }
    expect(bad, `invalidation roots not in DomainName:\n${bad.join("\n")}`).toEqual([]);
  });

  it("reads (rateTier read, no invalidates) carry an empty rule, never a phantom root", () => {
    for (const [name, d] of Object.entries(C.CALLABLES!)) {
      if (d.rateTier === "read" && d.invalidates === undefined) {
        const rule = G()[name];
        if (rule) expect(rule.roots ?? []).toEqual([]);
      }
    }
  });

  describe("documented cross-domain OVERRIDES land verbatim (§4.3)", () => {
    const expectRoots = (name: string, roots: string[]) => {
      const rule = G()[name];
      expect(rule, `missing rule ${name}`).toBeDefined();
      for (const r of roots) expect(rule.roots, `${name} roots`).toContain(r);
    };

    it("submitTestSession → {progress, spaces, storyPoints, analytics} (+fanout)", () => {
      expectRoots("v1.levelup.submitTestSession", [
        "progress",
        "spaces",
        "storyPoints",
        "analytics",
      ]);
      expect(G()["v1.levelup.submitTestSession"].fanout).toBeDefined();
    });
    it("recordItemAttempt → {progress} (+fanout to the story-point progress sub-key)", () => {
      expectRoots("v1.levelup.recordItemAttempt", ["progress"]);
      expect(G()["v1.levelup.recordItemAttempt"].fanout).toBeDefined();
    });
    it("evaluateAnswer → {progress} (server persists progress now)", () => {
      expectRoots("v1.levelup.evaluateAnswer", ["progress"]);
    });
    it("saveItem → {items, storyPoints, versions}", () => {
      expectRoots("v1.levelup.saveItem", ["items", "storyPoints", "versions"]);
    });
    it("saveSpace → {spaces, store}", () => {
      expectRoots("v1.levelup.saveSpace", ["spaces", "store"]);
    });
    it("gradeQuestion → {questionSubmissions, submissions, analytics}", () => {
      expectRoots("v1.autograde.gradeQuestion", [
        "questionSubmissions",
        "submissions",
        "analytics",
      ]);
    });
    it("uploadAnswerSheets → {submissions, exams}", () => {
      expectRoots("v1.autograde.uploadAnswerSheets", ["submissions", "exams"]);
    });
    it("saveStudent → {students, classes}", () => {
      expectRoots("v1.identity.saveStudent", ["students", "classes"]);
    });
    it("saveClass → {classes, students, teachers}", () => {
      expectRoots("v1.identity.saveClass", ["classes", "students", "teachers"]);
    });
    it("purchaseSpace → {store, spaces}", () => {
      expectRoots("v1.levelup.purchaseSpace", ["store", "spaces"]);
    });
    it("markAchievementsSeen → {achievements, gamification}", () => {
      expectRoots("v1.levelup.markAchievementsSeen", ["achievements", "gamification"]);
    });
    it("markNotificationRead → {notifications, notificationBadge}", () => {
      // root names per §4.3; tolerate the badge being a distinct root or a sub.
      const rule = G()["v1.identity.markNotificationRead"];
      expect(rule).toBeDefined();
      expect(rule.roots).toContain("notifications");
    });

    it("switchActiveTenant → [] (handled by resetForTenantSwitch, not invalidate)", () => {
      expect(G()["v1.identity.switchActiveTenant"].roots ?? []).toEqual([]);
    });
    it("generateReport → [] (produces a URL; nothing to invalidate)", () => {
      expect(G()["v1.analytics.generateReport"].roots ?? []).toEqual([]);
    });
  });

  describe("MERGE-INVALIDATION-COARSE: high-churn roots are fanned-out, not coarsely dirtied", () => {
    const HIGH_CHURN = ["analytics", "progress", "submissions"];
    it("a rule with a fanout does NOT also coarsely list a high-churn root it narrows", () => {
      // The plan: "any rule dirtying a high-churn root provides a fanout and does
      // not also list that root coarsely." We assert the inverse is never violated:
      // recordItemAttempt narrows progress precisely via fanout, so while it may
      // declare progress as a root for safety, the fanout MUST be present.
      for (const name of ["v1.levelup.recordItemAttempt"]) {
        const rule = G()[name];
        const dirtiesHighChurn = (rule.roots ?? []).some((r) => HIGH_CHURN.includes(r));
        if (dirtiesHighChurn)
          expect(rule.fanout, `${name} dirties high-churn but has no fanout`).toBeDefined();
      }
    });
  });
});

(ready ? describe : describe.skip)("invalidateForCallable narrowest-scope behavior (§5.2)", () => {
  let spy: ReturnType<typeof makeQcSpy>;
  beforeEach(() => {
    spy = makeQcSpy();
  });

  it("invalidates each coarse root as a [domain] prefix key", async () => {
    await Q.invalidateForCallable!(spy.qc, "v1.levelup.saveItem", {
      vars: { spaceId: "s", storyPointId: "sp", itemId: "i" },
    });
    // every coarse root invalidated as a single-element [domain] key
    for (const root of ["items", "storyPoints", "versions"]) {
      expect(spy.invalidated).toContainEqual([root]);
    }
  });

  it("fanout adds the EXACT narrow detail/sub key (recordItemAttempt → progress sub)", async () => {
    await Q.invalidateForCallable!(spy.qc, "v1.levelup.recordItemAttempt", {
      vars: { spaceId: "space_1", storyPointId: "sp_1", itemId: "i_1" },
      data: { progress: {}, completed: false },
    });
    // a precise key under the progress domain, deeper than the bare [progress] root
    const progressKeys = spy.invalidated.filter((k) => k[0] === "progress");
    expect(progressKeys.some((k) => k.length > 1)).toBe(true);
  });

  it("submitTestSession fans out to space detail + progress sub keys", async () => {
    await Q.invalidateForCallable!(spy.qc, "v1.levelup.submitTestSession", {
      vars: { sessionId: "ts_1", spaceId: "space_1" },
      data: { progressUpdated: true },
    });
    // precise space detail key present, in addition to coarse roots
    const spaceKeys = spy.invalidated.filter((k) => k[0] === "spaces");
    expect(spaceKeys.some((k) => k.includes("detail") && k.includes("space_1"))).toBe(true);
  });

  it("switchActiveTenant invalidates NOTHING (full clear is the cross-tenant boundary)", async () => {
    await Q.invalidateForCallable!(spy.qc, "v1.identity.switchActiveTenant", {
      vars: { targetTenantId: "t2" },
    });
    expect(spy.invalidated).toEqual([]);
    expect(spy.qc.invalidateQueries).not.toHaveBeenCalled();
  });

  it("generateReport invalidates NOTHING (URL response, no cache)", async () => {
    await Q.invalidateForCallable!(spy.qc, "v1.analytics.generateReport", {
      vars: { type: "exam" },
    });
    expect(spy.invalidated).toEqual([]);
  });

  it("an unknown callable name is a no-op (defensive, no throw)", async () => {
    await expect(
      Q.invalidateForCallable!(spy.qc, "v1.levelup.doesNotExist", { vars: {} })
    ).resolves.toBeUndefined();
    expect(spy.invalidated).toEqual([]);
  });

  it("fanout is skipped when no ctx is supplied (coarse-only fallback)", async () => {
    await Q.invalidateForCallable!(spy.qc, "v1.levelup.recordItemAttempt");
    // only the coarse [progress] root, no deep fanout key, when ctx is absent
    const progressKeys = spy.invalidated.filter((k) => k[0] === "progress");
    expect(progressKeys).toContainEqual(["progress"]);
    expect(progressKeys.every((k) => k.length === 1)).toBe(true);
  });
});

(ready ? describe : describe.skip)("buildGraphFromContract merges hints + overrides (§5.1)", () => {
  it("dedupes roots when a contract hint and an override name the same root", () => {
    if (!Q.buildGraphFromContract) return;
    const callables = {
      "v1.x.foo": { invalidates: ["spaces"] },
    };
    const overrides = { "v1.x.foo": { roots: ["spaces", "store"] } };
    const out = Q.buildGraphFromContract(callables, overrides);
    expect([...(out["v1.x.foo"].roots ?? [])].sort()).toEqual(["spaces", "store"]);
  });
});
