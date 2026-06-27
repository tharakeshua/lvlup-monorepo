/**
 * allowed-transitions-enum (SDK-LAYERS-PLAN.md §3.6 / api-contract-core.md §10.4
 * / MERGE-TRANSITIONS / REVIEW top-risk #5).
 *
 * The runtime half of the `as const satisfies TransitionMap<XStatus>` build-time
 * gate. `ALLOWED_TRANSITIONS` is build-time-checked DATA: the key set of every
 * machine must equal its `as const` status enum, and every to-state must be a
 * member of that enum. `tsc` catches a typo/stale status; this suite catches it
 * at runtime AND locks the concrete edge tables from §3.6 so a silent edit to a
 * machine fails CI.
 *
 * Parameterized over ALL NINE machines (§3.6 / §7.5 aggregate):
 *   space, exam, submission, questionGrading, testSession, tenant, membership,
 *   announcement, entityStatus.
 * Plus: the 7 entityStatus-consuming enums each === {active, archived}, a
 * toggle-consistency assertion (no edge references an excluded 'completed'/OCR
 * member), and `canTransition()` agreement vs the table.
 *
 * Self-skips until the contract surfaces ALLOWED_TRANSITIONS (parallel impl).
 */
import { describe, it, expect } from "vitest";
import * as contract from "../index";

type TransitionMap = Record<string, readonly string[]>;

const C = contract as unknown as {
  ALLOWED_TRANSITIONS?: Record<string, TransitionMap>;
  canTransition?: (entity: string, from: string, to: string) => boolean;
};

const ready = Boolean(C.ALLOWED_TRANSITIONS);
const d = ready ? describe : describe.skip;

/**
 * The FROZEN expected adjacency tables, transcribed verbatim from
 * SDK-LAYERS-PLAN.md §3.6. These lock the plan: if impl drifts from the frozen
 * spec, the diff is named here. (For machines the plan states only loosely —
 * e.g. submission's full pipeline — we assert structural invariants rather than a
 * brittle byte-equal table, but the from-key set is always pinned.)
 */
const EXPECTED: Record<string, TransitionMap> = {
  space: {
    draft: ["published"],
    published: ["archived", "draft"],
    archived: ["draft"],
  },
  testSession: {
    in_progress: ["completed", "expired", "abandoned"],
    completed: [],
    expired: [],
    abandoned: [],
  },
  tenant: {
    trial: ["active", "expired", "suspended", "deactivated"],
    active: ["suspended", "deactivated", "expired"],
    suspended: ["active", "deactivated"],
    expired: ["active", "deactivated"],
    deactivated: ["active"],
  },
  membership: {
    active: ["inactive", "suspended"],
    inactive: ["active"],
    suspended: ["active", "inactive"],
  },
  announcement: {
    // §3.6 schism resolved: adopt archived→[draft]
    draft: ["published", "archived"],
    published: ["archived"],
    archived: ["draft"],
  },
  questionGrading: {
    pending: ["processing"],
    processing: ["graded", "needs_review", "failed"],
    graded: ["overridden"],
    needs_review: ["graded", "manual", "overridden"],
    failed: ["pending", "manual"],
    manual: ["overridden"],
    overridden: [],
  },
  entityStatus: {
    active: ["archived"],
    archived: ["active"],
  },
};

/** From-key sets that MUST be present (pins the machine identity even where edge
 *  lists are asserted structurally rather than byte-equal). */
const EXPECTED_FROM_KEYS: Record<string, string[]> = {
  space: ["draft", "published", "archived"],
  exam: [
    "draft",
    "question_paper_uploaded",
    "question_paper_extracted",
    "published",
    "grading",
    "results_released",
    "archived",
  ],
  submission: [
    "uploaded",
    "scouting",
    "scouting_failed",
    "scouting_complete",
    "grading",
    "grading_partial",
    "grading_failed",
    "grading_complete",
    "finalization_failed",
    "ready_for_review",
    "reviewed",
    "manual_review_needed",
    "failed",
  ],
  questionGrading: [
    "pending",
    "processing",
    "graded",
    "needs_review",
    "failed",
    "manual",
    "overridden",
  ],
  testSession: ["in_progress", "completed", "expired", "abandoned"],
  tenant: ["trial", "active", "suspended", "expired", "deactivated"],
  membership: ["active", "inactive", "suspended"],
  announcement: ["draft", "published", "archived"],
  entityStatus: ["active", "archived"],
};

// Members explicitly DROPPED by §3.6 are scoped to their OWNING machine inside the
// toggle-consistency test below (exam drops 'completed'; testSession drops
// 'submitted'/'graded'). 'completed' is a legitimate testSession terminal and
// 'graded' is a legitimate questionGrading/submission member, so neither is a
// GLOBAL forbidden member — see FORBIDDEN_BY_MACHINE in the test.

const ALL_NINE = [
  "space",
  "exam",
  "submission",
  "questionGrading",
  "testSession",
  "tenant",
  "membership",
  "announcement",
  "entityStatus",
];

d("ALLOWED_TRANSITIONS — all 9 machines exist (§7.5 aggregate)", () => {
  const T = C.ALLOWED_TRANSITIONS!;
  for (const machine of ALL_NINE) {
    it(`has machine: ${machine}`, () => {
      expect(T[machine], `ALLOWED_TRANSITIONS.${machine} missing`).toBeTruthy();
      expect(typeof T[machine]).toBe("object");
    });
  }

  it("declares EXACTLY the nine machines (no stray, no missing)", () => {
    expect(Object.keys(T).sort()).toEqual([...ALL_NINE].sort());
  });
});

d("ALLOWED_TRANSITIONS — from-key set === status enum (§10.4 a)", () => {
  const T = C.ALLOWED_TRANSITIONS!;
  for (const [machine, fromKeys] of Object.entries(EXPECTED_FROM_KEYS)) {
    it(`${machine}: from-keys === pinned status enum`, () => {
      if (!T[machine]) return; // machine-existence covered above
      expect(Object.keys(T[machine]).sort()).toEqual([...fromKeys].sort());
    });
  }
});

d("ALLOWED_TRANSITIONS — every to-state is a declared from-key (§10.4 b)", () => {
  const T = C.ALLOWED_TRANSITIONS!;
  for (const machine of ALL_NINE) {
    it(`${machine}: every edge target is a member of the machine`, () => {
      const m = T[machine];
      if (!m) return;
      const members = new Set(Object.keys(m));
      const offenders: string[] = [];
      for (const [from, tos] of Object.entries(m)) {
        for (const to of tos) {
          if (!members.has(to)) offenders.push(`${machine}.${from}→${to}`);
        }
      }
      expect(offenders, `edge to a non-member:\n${offenders.join("\n")}`).toEqual([]);
    });
  }
});

d("ALLOWED_TRANSITIONS — frozen edge tables match §3.6 verbatim", () => {
  const T = C.ALLOWED_TRANSITIONS!;
  for (const [machine, table] of Object.entries(EXPECTED)) {
    it(`${machine}: edge lists match the frozen plan`, () => {
      const actual = T[machine];
      if (!actual) return;
      for (const [from, tos] of Object.entries(table)) {
        expect(
          [...(actual[from] ?? [])].sort(),
          `${machine}.${from} edges drifted from §3.6`
        ).toEqual([...tos].sort());
      }
    });
  }
});

d("ALLOWED_TRANSITIONS — terminal states map to [] (§10.4 c)", () => {
  const T = C.ALLOWED_TRANSITIONS!;
  const terminals: Array<[string, string]> = [
    ["exam", "archived"],
    ["testSession", "completed"],
    ["testSession", "expired"],
    ["testSession", "abandoned"],
    ["submission", "reviewed"],
    ["submission", "failed"],
    ["questionGrading", "overridden"],
  ];
  for (const [machine, state] of terminals) {
    it(`${machine}.${state} is terminal ([])`, () => {
      const m = T[machine];
      if (!m || !(state in m)) return;
      expect(m[state]).toEqual([]);
    });
  }
});

d("ALLOWED_TRANSITIONS — the 7 entityStatus consumers === {active, archived}", () => {
  // entityStatus backs student/teacher/parent/staff/scanner/class/session (§3.6).
  // There is ONE entityStatus machine; the 7 enums collapse onto it. We assert the
  // single machine is exactly {active↔archived} (no extra members leaked in).
  const T = C.ALLOWED_TRANSITIONS!;
  it("entityStatus machine === {active↔archived}", () => {
    const m = T["entityStatus"];
    if (!m) return;
    expect(Object.keys(m).sort()).toEqual(["active", "archived"]);
    expect([...m["active"]].sort()).toEqual(["archived"]);
    expect([...m["archived"]].sort()).toEqual(["active"]);
  });
});

d("ALLOWED_TRANSITIONS — toggle-consistency: no excluded member referenced", () => {
  const T = C.ALLOWED_TRANSITIONS!;

  it("exam machine never references the dropped 'completed' status", () => {
    const m = T["exam"];
    if (!m) return;
    expect(Object.keys(m)).not.toContain("completed");
    for (const tos of Object.values(m)) expect(tos).not.toContain("completed");
  });

  it("testSession never references dropped 'submitted'/'graded'", () => {
    const m = T["testSession"];
    if (!m) return;
    for (const banned of ["submitted", "graded"]) {
      expect(Object.keys(m)).not.toContain(banned);
      for (const tos of Object.values(m)) expect(tos).not.toContain(banned);
    }
  });

  it("no machine references a globally-forbidden member as a from-key", () => {
    // §3.6: 'completed' is dropped from EXAM (unreachable); 'submitted' is dropped
    // from TESTSESSION. Each dropped member is forbidden ONLY on its owning machine
    // — 'completed' is a legitimate terminal of testSession, so it must NOT be
    // asserted-forbidden there. Scope each forbidden member to its owner.
    const FORBIDDEN_BY_MACHINE: Record<string, string[]> = {
      exam: ["completed"],
      testSession: ["submitted", "graded"],
    };
    for (const machine of ALL_NINE) {
      const m = T[machine];
      if (!m) continue;
      for (const f of FORBIDDEN_BY_MACHINE[machine] ?? []) {
        expect(Object.keys(m), `${machine} leaks ${f}`).not.toContain(f);
        for (const tos of Object.values(m)) {
          expect(tos, `${machine} edge leaks ${f}`).not.toContain(f);
        }
      }
    }
  });
});

d("canTransition() agrees with the table (§10.4 d)", () => {
  const T = C.ALLOWED_TRANSITIONS!;
  const canT = C.canTransition;
  if (!canT) {
    it.skip("canTransition not exported", () => undefined);
    return;
  }

  it("returns true for every declared edge", () => {
    const fails: string[] = [];
    for (const [machine, m] of Object.entries(T)) {
      for (const [from, tos] of Object.entries(m)) {
        for (const to of tos) {
          if (!canT(machine, from, to)) fails.push(`${machine}.${from}→${to} should be allowed`);
        }
      }
    }
    expect(fails, fails.join("\n")).toEqual([]);
  });

  it("returns false for a sampled set of NON-edges", () => {
    // sample illegal transitions per machine (must NOT be in the edge list)
    const nonEdges: Array<[string, string, string]> = [
      ["space", "draft", "archived"], // draft can only →published
      ["space", "archived", "published"], // archived→draft only
      ["testSession", "completed", "in_progress"], // terminal
      ["tenant", "deactivated", "suspended"], // deactivated→active only
      ["membership", "inactive", "suspended"], // inactive→active only
      ["announcement", "published", "draft"], // published→archived only
      ["questionGrading", "overridden", "graded"], // terminal
      ["entityStatus", "active", "active"], // self-loop not allowed
    ];
    const fails: string[] = [];
    for (const [machine, from, to] of nonEdges) {
      if (!T[machine] || !(from in T[machine])) continue;
      if (canT(machine, from, to)) fails.push(`${machine}.${from}→${to} should be DENIED`);
    }
    expect(fails, fails.join("\n")).toEqual([]);
  });

  it("returns false for an unknown from-state / unknown machine (no throw)", () => {
    expect(canT("space", "no_such_state", "published")).toBe(false);
    expect(canT("no_such_machine", "draft", "published")).toBe(false);
  });
});
