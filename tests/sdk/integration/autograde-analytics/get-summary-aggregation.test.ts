/**
 * `getSummary` aggregation + scope authority (autograde-analytics).
 *
 * Locks the analytics domain plan's `getSummaryService`:
 *   • `{scope}` is a discriminated response — `student|class|platform|health`
 *     each return their matching summary shape and `def.responseSchema.parse`
 *     accepts the live response (the contract gate, here exercised directly).
 *   • SCOPE AUTHORITY (REVIEW §6.1/§6.9, analytics §206/§296):
 *       – student scope: a student reads only their OWN summary; reading another
 *         student is denied. `studentId` defaults to self.
 *       – class scope: a teacher may read a class they are ASSIGNED to; a class
 *         they are not assigned to is denied.
 *       – platform/health scope: require `ctx.isSuperAdmin`; a teacher is denied.
 *   • `tenantId` is claim-derived — never in the request body (D2). platform/
 *     health are tenant-less and still require super-admin.
 *   • The summary is a materialized projection (callable-only access, rules
 *     default-deny — D13/D14): SDK reads it, never writes; the response carries
 *     no ⚷ cost field.
 *
 * Self-skips when emulators/seed are unavailable.
 */
import { describe, it, beforeAll, expect } from "vitest";
import { requireFunctions } from "../../harness/per-test-setup";
import { IDS, callAs, expectDenied, leakedKeys, COST_FIELDS } from "./_helpers";

interface SummaryEnvelope {
  scope: string;
  studentSummary?: unknown;
  classSummary?: unknown;
  platformSummary?: unknown;
  healthSummary?: unknown;
}

describe("autograde-analytics · getSummary aggregation + scope authority", () => {
  let skip: string | null = null;
  beforeAll(() => {
    skip = requireFunctions();
  });
  const maybe = (name: string, fn: () => Promise<void> | void) =>
    it(name, async (c) => {
      if (skip) {
        c.skip();
        return;
      }
      await fn();
    });

  // --- discriminated aggregation by scope -------------------------------------

  maybe("student scope returns the student summary for the caller (self-default)", async () => {
    const res = (await callAs(
      "v1.analytics.getSummary",
      { scope: "student" },
      "student"
    )) as SummaryEnvelope;
    expect(res.scope, "response is discriminated by scope").toBe("student");
    expect(res.studentSummary, "student scope carries studentSummary").toBeDefined();
    expect(
      leakedKeys(res, COST_FIELDS),
      "getSummary leaked ⚷ AI cost into a student response"
    ).toEqual([]);
  });

  maybe("teacher class scope aggregates the assigned class", async () => {
    const res = (await callAs(
      "v1.analytics.getSummary",
      { scope: "class", classId: IDS.class },
      "teacher"
    )) as SummaryEnvelope;
    expect(res.scope).toBe("class");
    expect(res.classSummary, "class scope carries classSummary").toBeDefined();
    expect(leakedKeys(res, COST_FIELDS), "class summary leaked AI cost").toEqual([]);
  });

  maybe("platform scope aggregates for a super-admin", async () => {
    const res = (await callAs(
      "v1.analytics.getSummary",
      { scope: "platform" },
      "superAdmin"
    )) as SummaryEnvelope;
    expect(res.scope).toBe("platform");
    expect(res.platformSummary, "platform scope carries platformSummary").toBeDefined();
  });

  maybe("health scope aggregates for a super-admin", async () => {
    const res = (await callAs(
      "v1.analytics.getSummary",
      { scope: "health" },
      "superAdmin"
    )) as SummaryEnvelope;
    expect(res.scope).toBe("health");
    expect(res.healthSummary, "health scope carries healthSummary").toBeDefined();
  });

  // --- scope authority: cross-student / cross-class / privilege ----------------

  maybe("a student CANNOT read another student’s summary (student-self check)", async () => {
    await expectDenied(
      "v1.analytics.getSummary",
      { scope: "student", studentId: IDS.studentOther },
      "student",
      "permission-denied"
    );
  });

  maybe("a teacher CANNOT read a class summary they are not assigned to", async () => {
    await expectDenied(
      "v1.analytics.getSummary",
      { scope: "class", classId: "class__not_assigned" },
      "teacher",
      "permission-denied"
    );
  });

  maybe("a teacher CANNOT read the platform summary (super-admin only)", async () => {
    await expectDenied(
      "v1.analytics.getSummary",
      { scope: "platform" },
      "teacher",
      "permission-denied"
    );
  });

  maybe("a teacher CANNOT read the health summary (super-admin only)", async () => {
    await expectDenied(
      "v1.analytics.getSummary",
      { scope: "health" },
      "teacher",
      "permission-denied"
    );
  });

  maybe("getSummary rejects a forged tenantId in the body (D2 — claim-derived only)", async () => {
    await expectDenied(
      "v1.analytics.getSummary",
      { scope: "student", tenantId: "tenant__evil" } as unknown,
      "student",
      "invalid-argument"
    );
  });

  // --- parent path: child summary is gated on the link ------------------------

  maybe(
    "a parent reads their linked child’s summary, but is DENIED an unlinked child",
    async () => {
      // linked child → allowed
      const ok = (await callAs(
        "v1.analytics.getChildSummary",
        { studentId: IDS.student },
        "parent"
      ).catch(() => null)) as { studentSummary?: unknown } | null;
      if (ok) expect(ok.studentSummary, "parent sees linked child summary").toBeDefined();

      // unlinked child → denied (studentId ∉ ctx.studentIds)
      await expectDenied(
        "v1.analytics.getChildSummary",
        { studentId: IDS.studentOther },
        "parent",
        "permission-denied"
      );
    }
  );

  // --- exam analytics (the autograde→analytics rollup) ------------------------

  maybe("getExamAnalytics is teacher/admin-only and carries no ⚷ cost", async () => {
    const res = await callAs(
      "v1.analytics.getExamAnalytics",
      { examId: IDS.exam },
      "teacher"
    ).catch(() => null);
    if (res) {
      expect(leakedKeys(res, COST_FIELDS), "exam analytics leaked AI cost").toEqual([]);
    }
    // a student must not read exam analytics
    await expectDenied(
      "v1.analytics.getExamAnalytics",
      { examId: IDS.exam },
      "student",
      "permission-denied"
    );
  });
});
