/**
 * ALLOWED_TRANSITIONS runtime contract — domain-core.md §7 + SDK-LAYERS-PLAN §3.6.
 *
 * The build-time `as const satisfies TransitionMap<S>` guarantees keys ⊆ enum and
 * values ⊆ enum at compile time; this test asserts the SAME invariants at runtime
 * (the §9 "Transition ↔ enum membership" row): for each of the 9 machines, every
 * key and every target ∈ its as-const status enum tuple, every enum member appears
 * as a key (no missing source state), and terminal states map to []. It also pins
 * the exact authored edges per §3.6, the dropped members (exam 'completed', OCR
 * submission statuses), the canonical enum tuples (MERGE-TRANSITIONS), and the
 * canTransition / assertTransition / InvalidTransitionError behavior.
 *
 * Companion to the self-skipping `transitions.assertion.test.ts` (barrel-import):
 * this one imports concrete module paths so it runs against the real impl now.
 */
import { describe, it, expect } from "vitest";
import {
  ALLOWED_TRANSITIONS,
  canTransition,
  assertTransition,
  InvalidTransitionError,
  type TransitionDomain,
} from "../transitions/index.js";
import { SPACE_STATUSES } from "../enums/space.js";
import { EXAM_STATUSES } from "../enums/exam.js";
import { SUBMISSION_PIPELINE_STATUSES } from "../enums/submission.js";
import { QUESTION_GRADING_STATUSES } from "../enums/question-grading.js";
import { TEST_SESSION_STATUSES } from "../enums/test-session.js";
import { TENANT_STATUSES, MEMBERSHIP_STATUSES, ENTITY_STATUSES } from "../enums/tenant.js";
import { ANNOUNCEMENT_STATUSES } from "../enums/misc.js";

const NINE_MACHINES: TransitionDomain[] = [
  "space",
  "exam",
  "submission",
  "questionGrading",
  "testSession",
  "tenant",
  "membership",
  "entityStatus",
  "announcement",
];

const ENUM_FOR: Record<TransitionDomain, readonly string[]> = {
  space: SPACE_STATUSES,
  exam: EXAM_STATUSES,
  submission: SUBMISSION_PIPELINE_STATUSES,
  questionGrading: QUESTION_GRADING_STATUSES,
  testSession: TEST_SESSION_STATUSES,
  tenant: TENANT_STATUSES,
  membership: MEMBERSHIP_STATUSES,
  entityStatus: ENTITY_STATUSES,
  announcement: ANNOUNCEMENT_STATUSES,
};

describe("ALLOWED_TRANSITIONS aggregate", () => {
  it("contains all nine machines", () => {
    expect(Object.keys(ALLOWED_TRANSITIONS).sort()).toEqual([...NINE_MACHINES].sort());
  });
});

describe.each(NINE_MACHINES)(
  "machine: %s — runtime mirror of the compile-time satisfies",
  (machine) => {
    const table = ALLOWED_TRANSITIONS[machine] as Record<string, readonly string[]>;
    const members = new Set(ENUM_FOR[machine]);

    it("every key is a member of the status enum", () => {
      for (const key of Object.keys(table)) {
        expect(members.has(key), `${machine} key ${key} not in enum`).toBe(true);
      }
    });

    it("every enum member appears as a key (no missing source state)", () => {
      for (const member of members) {
        expect(
          Object.prototype.hasOwnProperty.call(table, member),
          `${machine} missing key ${member}`
        ).toBe(true);
      }
    });

    it("every target status is a member of the status enum (and a key — no dangling edge)", () => {
      for (const [from, targets] of Object.entries(table)) {
        for (const to of targets) {
          expect(members.has(to), `${machine}: ${from}→${to} targets a non-member`).toBe(true);
          expect(
            Object.prototype.hasOwnProperty.call(table, to),
            `${machine}: ${to} not a key`
          ).toBe(true);
        }
      }
    });

    it("no self-edge unless explicitly authored (§3.6 authors only exam.grading→grading)", () => {
      // §3.6: the SOLE authored self-edge is exam `grading→[results_released,grading]`
      // (a grading retry loop). Every other machine forbids from→from.
      const AUTHORED_SELF_EDGES = new Set(["exam.grading"]);
      for (const [from, targets] of Object.entries(table)) {
        if (AUTHORED_SELF_EDGES.has(`${machine}.${from}`)) continue;
        expect(targets, `${machine} ${from} has a self-edge`).not.toContain(from);
      }
    });
  }
);

describe("exact authored edges (§3.6)", () => {
  it("space: draft→[published]; published→[archived,draft]; archived→[draft] (§3.6)", () => {
    // §3.6: draft reaches ONLY published (no draft→archived edge).
    expect(ALLOWED_TRANSITIONS.space.draft).toEqual(["published"]);
    expect(ALLOWED_TRANSITIONS.space.published).toEqual(["archived", "draft"]);
    expect(ALLOWED_TRANSITIONS.space.archived).toEqual(["draft"]);
  });

  it("exam: 'completed' is DROPPED everywhere; archived is terminal", () => {
    expect(Object.keys(ALLOWED_TRANSITIONS.exam)).not.toContain("completed");
    for (const targets of Object.values(ALLOWED_TRANSITIONS.exam)) {
      expect(targets).not.toContain("completed");
    }
    expect(ALLOWED_TRANSITIONS.exam.archived).toEqual([]);
    expect(ALLOWED_TRANSITIONS.exam.grading).toContain("results_released");
  });

  it("submission: OCR statuses excluded; failed & reviewed are terminal", () => {
    const keys = Object.keys(ALLOWED_TRANSITIONS.submission);
    expect(keys).not.toContain("ocr_processing");
    expect(keys).not.toContain("ocr_failed");
    expect(ALLOWED_TRANSITIONS.submission.failed).toEqual([]);
    expect(ALLOWED_TRANSITIONS.submission.reviewed).toEqual([]);
  });

  it("questionGrading: overridden is terminal; processing→{graded,needs_review,failed}", () => {
    expect(ALLOWED_TRANSITIONS.questionGrading.overridden).toEqual([]);
    expect(ALLOWED_TRANSITIONS.questionGrading.processing).toEqual([
      "graded",
      "needs_review",
      "failed",
    ]);
  });

  it("testSession: only in_progress has out-edges; all terminals are []", () => {
    expect(ALLOWED_TRANSITIONS.testSession.in_progress).toEqual([
      "completed",
      "expired",
      "abandoned",
    ]);
    for (const terminal of ["completed", "expired", "abandoned"] as const) {
      expect(ALLOWED_TRANSITIONS.testSession[terminal]).toEqual([]);
    }
  });

  it("tenant: trial reaches the 4 lifecycle states; deactivated→[active]", () => {
    expect(ALLOWED_TRANSITIONS.tenant.trial).toEqual([
      "active",
      "expired",
      "suspended",
      "deactivated",
    ]);
    expect(ALLOWED_TRANSITIONS.tenant.deactivated).toEqual(["active"]);
  });

  it("entityStatus: exactly {active↔archived}", () => {
    expect(ALLOWED_TRANSITIONS.entityStatus.active).toEqual(["archived"]);
    expect(ALLOWED_TRANSITIONS.entityStatus.archived).toEqual(["active"]);
  });

  it("announcement: archived→[draft] (schism resolved toward draft, not [])", () => {
    expect(ALLOWED_TRANSITIONS.announcement.archived).toEqual(["draft"]);
    expect(ALLOWED_TRANSITIONS.announcement.draft).toEqual(["published", "archived"]);
  });
});

describe("canonical enum tuples (MERGE-TRANSITIONS)", () => {
  it("TEST_SESSION_STATUSES === [in_progress, completed, expired, abandoned] (no submitted/graded)", () => {
    expect([...TEST_SESSION_STATUSES].sort()).toEqual(
      ["abandoned", "completed", "expired", "in_progress"].sort()
    );
  });

  it("TENANT_STATUSES has the 5 members {trial,active,suspended,expired,deactivated}", () => {
    expect([...TENANT_STATUSES].sort()).toEqual(
      ["active", "deactivated", "expired", "suspended", "trial"].sort()
    );
  });

  it("EXAM_STATUSES excludes 'completed'", () => {
    expect(EXAM_STATUSES).not.toContain("completed");
  });

  it("SUBMISSION_PIPELINE_STATUSES excludes ocr_* members", () => {
    expect(SUBMISSION_PIPELINE_STATUSES).not.toContain("ocr_processing");
    expect(SUBMISSION_PIPELINE_STATUSES).not.toContain("ocr_failed");
  });

  it("ENTITY_STATUSES === [active, archived]", () => {
    expect([...ENTITY_STATUSES]).toEqual(["active", "archived"]);
  });
});

describe("canTransition / assertTransition helpers", () => {
  it("canTransition reads the table (true for an authored edge, false otherwise)", () => {
    expect(canTransition("space", "draft", "published")).toBe(true);
    expect(canTransition("space", "archived", "published")).toBe(false);
    expect(canTransition("exam", "grading", "results_released")).toBe(true);
  });

  it("canTransition returns false from a terminal state", () => {
    expect(canTransition("testSession", "completed", "in_progress")).toBe(false);
    expect(canTransition("questionGrading", "overridden", "graded")).toBe(false);
  });

  it("canTransition returns false for an unknown source state", () => {
    expect(canTransition("space", "bogus" as never, "published")).toBe(false);
  });

  it("assertTransition is silent on a valid edge", () => {
    expect(() => assertTransition("space", "draft", "published")).not.toThrow();
  });

  it("assertTransition throws InvalidTransitionError carrying {domain,from,to}", () => {
    let err: unknown;
    try {
      assertTransition("space", "archived", "published");
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(InvalidTransitionError);
    const e = err as InvalidTransitionError;
    expect(e.name).toBe("InvalidTransitionError");
    expect(e.domain).toBe("space");
    expect(e.from).toBe("archived");
    expect(e.to).toBe("published");
  });
});
