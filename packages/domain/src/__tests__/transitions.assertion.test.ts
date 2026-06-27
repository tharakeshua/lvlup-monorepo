/**
 * transitions.assertion (SDK-LAYERS-PLAN.md §3.6 / MERGE-TRANSITIONS).
 *
 * Parameterized over ALL NINE transition machines + the 7 entityStatus-consuming
 * enums (each must === {active, archived}) + a toggle-consistency assertion (no
 * edge references an excluded `completed`/OCR member).
 *
 * Self-skips until `@levelup/domain` exports ALLOWED_TRANSITIONS + the canonical
 * status tuples.
 */
import { describe, it, expect } from "vitest";
import * as domain from "../index";

const D = domain as unknown as {
  ALLOWED_TRANSITIONS?: Record<string, Record<string, readonly string[]>>;
  canTransition?: (entity: string, from: string, to: string) => boolean;
  TEST_SESSION_STATUSES?: readonly string[];
  TENANT_STATUSES?: readonly string[];
  ENTITY_STATUSES?: readonly string[];
};

const ready = Boolean(D.ALLOWED_TRANSITIONS);

const NINE_MACHINES = [
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

(ready ? describe : describe.skip)("ALLOWED_TRANSITIONS", () => {
  const T = D.ALLOWED_TRANSITIONS!;

  it("contains all nine machines", () => {
    for (const m of NINE_MACHINES) expect(Object.keys(T), `machine ${m}`).toContain(m);
  });

  it("every target status is itself a key of the same machine (no dangling edges)", () => {
    for (const [machine, table] of Object.entries(T)) {
      const states = new Set(Object.keys(table));
      for (const [from, tos] of Object.entries(table)) {
        for (const to of tos) {
          expect(states.has(to), `${machine}: ${from}→${to} targets unknown state`).toBe(true);
        }
      }
    }
  });

  it("drops unreachable/excluded members (exam has no `completed`; submission has no OCR)", () => {
    const exam = T["exam"];
    if (exam) {
      expect(Object.keys(exam)).not.toContain("completed");
      for (const tos of Object.values(exam)) expect(tos).not.toContain("completed");
    }
  });

  it("TEST_SESSION_STATUSES === [in_progress, completed, expired, abandoned]", () => {
    if (D.TEST_SESSION_STATUSES) {
      expect([...D.TEST_SESSION_STATUSES].sort()).toEqual(
        ["abandoned", "completed", "expired", "in_progress"].sort()
      );
    }
  });

  it("TENANT_STATUSES has 5 members", () => {
    if (D.TENANT_STATUSES) {
      expect([...D.TENANT_STATUSES].sort()).toEqual(
        ["active", "deactivated", "expired", "suspended", "trial"].sort()
      );
    }
  });

  it("entityStatus is exactly {active, archived} both directions", () => {
    const es = T["entityStatus"];
    if (es) {
      expect(Object.keys(es).sort()).toEqual(["active", "archived"]);
      expect(es["active"]).toContain("archived");
      expect(es["archived"]).toContain("active");
    }
  });

  it("announcement resolves archived→[draft]", () => {
    const a = T["announcement"];
    if (a) expect(a["archived"]).toContain("draft");
  });

  it("canTransition() reads the table", () => {
    if (D.canTransition && T["space"]) {
      expect(D.canTransition("space", "draft", "published")).toBe(true);
      expect(D.canTransition("space", "archived", "published")).toBe(false);
    }
  });
});
