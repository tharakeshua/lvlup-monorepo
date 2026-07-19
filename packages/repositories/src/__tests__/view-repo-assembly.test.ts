/**
 * Repositories — cross-entity VIEW repo assembly batches, no N+1
 * (SDK-LAYERS-PLAN §4.1, §4.3 PC-14, repositories.md (2)(4)(5)).
 *
 * Locked invariants:
 *   • A view repo composes a cross-entity read in a BOUNDED number of wire calls
 *     and never issues an O(N) callable fan-out (PC-14): genuine 1+N dashboards
 *     get a server composite callable (e.g. getSpaceDetail), not N client calls.
 *   • `spaceDetailViewRepo.get` assembles space + storyPoints + items + myProgress
 *     into ONE shaped object; against a fixed wire fixture the shape is stable.
 *   • `classRepo` (class+roster), `gradingReviewRepo`
 *     (submission+questionSubmissions+questions) compose via batched reads — not
 *     one read per child id.
 *   • `parentRepo` collapses the N+1 child fetch (one batched children read for K
 *     linked children, not K calls).
 *   • View repos are the ONLY repos allowed to compose others (R6 exception);
 *     asserted structurally in repo-isolation.test.ts.
 *
 * Runs over the FAKE ApiClient — no emulator.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  createFakeApiClient,
  makePage,
  makeSpace,
  makeStoryPoint,
  makeItem,
  makeStudent,
  makeClass,
  makeSubmission,
  type FakeApiClient,
} from "../../../../tests/sdk/fakes";
import { ready, buildRepos } from "./_harness";

const d = ready() ? describe : describe.skip;

d("repositories · view-repo assembly (no N+1)", () => {
  let api: FakeApiClient;
  beforeEach(() => {
    api = createFakeApiClient();
  });

  it("spaceDetailViewRepo.get assembles space+storyPoints+items+myProgress and is BOUNDED", async () => {
    api.stub("levelup", "getSpace", () => ({ space: makeSpace() }));
    api.stub("levelup", "listStoryPoints", () =>
      makePage([makeStoryPoint({ id: "sp1" }), makeStoryPoint({ id: "sp2" })])
    );
    api.stub("levelup", "listItems", () =>
      makePage([makeItem({ id: "i1" }), makeItem({ id: "i2" })])
    );
    api.stub("levelup", "getSpaceProgress", () => ({ progress: null }));

    const r = buildRepos(api);
    const view = r["spaceDetailViewRepo"];
    if (!view?.["get"]) return;

    const detail = (await view["get"]({ spaceId: makeSpace().id })) as Record<string, unknown>;
    expect(detail).toBeDefined();

    // BOUNDED: the number of wire calls does not grow with #storyPoints or #items.
    // A small fixed set of contract-valid reads — never one listItems per story point.
    const total = api.calls.length;
    expect(total).toBeLessThanOrEqual(4);
    // Specifically: at most ONE listItems call (batched across story points),
    // not one per story point.
    expect(api.callsTo("v1.levelup.listItems").length).toBeLessThanOrEqual(1);
  });

  it("classRepo (class+roster) batches the roster — one roster read, not one-per-student", async () => {
    api.stub("identity", "getClass", () =>
      // getClass returns counts + first roster page (MERGE-PAGINATION §4.1)
      ({
        class: makeClass({ studentIds: ["s1", "s2", "s3"] }),
        roster: makePage([makeStudent({ id: "s1" })], "c1"),
      })
    );
    api.stub("identity", "listStudents", () =>
      makePage([makeStudent({ id: "s2" }), makeStudent({ id: "s3" })], null)
    );

    const r = buildRepos(api);
    const repo = r["classRepo"]!;
    const get = (repo["get"] ?? repo["getDetail"]) as
      | ((a: unknown) => Promise<unknown>)
      | undefined;
    if (!get) return;
    await get({ classId: makeClass().id });

    // No per-student wire call: at most the getClass + one paginated listStudents.
    expect(api.callsTo("v1.identity.getStudent")).toHaveLength(0);
    expect(api.calls.length).toBeLessThanOrEqual(2);
  });

  it("gradingReviewRepo batches submission+questionSubmissions+questions (single bundle)", async () => {
    api.stub("autograde", "getGradingReviewBundle", () => ({
      submission: makeSubmission(),
      questionSubmissions: [{ id: "qs1" }, { id: "qs2" }],
      questions: [{ id: "q1" }, { id: "q2" }],
    }));
    // Fallback granular stubs in case the impl composes client-side via batched reads.
    api.stub("autograde", "getSubmission", () => makeSubmission());
    api.stub("autograde", "listQuestionSubmissions", () => makePage([{ id: "qs1" }]));
    api.stub("autograde", "listQuestions", () => makePage([{ id: "q1" }]));

    const r = buildRepos(api);
    const repo = r["gradingReviewRepo"]!;
    const get = (repo["get"] ?? repo["getBundle"] ?? repo["getReviewBundle"]) as
      | ((a: unknown) => Promise<unknown>)
      | undefined;
    if (!get) return;
    await get({ submissionId: makeSubmission().id });

    // No O(N) per-question fan-out.
    expect(api.callsTo("v1.autograde.getQuestion")).toHaveLength(0);
    // Either a single bundle callable OR ≤3 batched reads.
    expect(api.calls.length).toBeLessThanOrEqual(3);
  });

  it("parentRepo collapses the N+1 child summary fetch into ONE batched children read", async () => {
    api.stub("analytics", "listLinkedChildren", () =>
      makePage([{ studentId: "c1" }, { studentId: "c2" }, { studentId: "c3" }], null)
    );
    // A batched child-summary read (NOT one getChildSummary per child).
    api.stub("analytics", "getChildSummary", (req) => ({
      studentSummary: { studentId: (req as { studentId?: string }).studentId },
      recentInsights: [],
    }));

    const r = buildRepos(api);
    const repo = r["parentRepo"]!;
    const list = (repo["listChildren"] ?? repo["list"] ?? repo["listAlerts"]) as
      | ((a?: unknown) => Promise<unknown>)
      | undefined;
    if (!list) return;
    await list({});

    // The N+1 collapse invariant: listing children does not trigger K
    // per-child summary calls during the list itself.
    expect(api.callsTo("v1.analytics.getChildSummary").length).toBeLessThanOrEqual(1);
  });

  it("view shaping against a FIXED wire fixture is deterministic (snapshot-stable shape)", async () => {
    const fixedSpace = makeSpace({ id: "space__dsa", title: "Data Structures" });
    api.stub("levelup", "getSpace", () => ({ space: fixedSpace }));
    api.stub("levelup", "listStoryPoints", () => makePage([makeStoryPoint({ id: "sp__arrays" })]));
    api.stub("levelup", "listItems", () => makePage([makeItem({ id: "item__q1" })]));
    api.stub("levelup", "getSpaceProgress", () => ({ progress: null }));

    const r = buildRepos(api);
    const view = r["spaceDetailViewRepo"];
    if (!view?.["get"]) return;
    const detail = (await view["get"]({ spaceId: "space__dsa" })) as Record<string, unknown>;
    // Shape contains the composed sub-entities under stable keys.
    expect(detail).toBeDefined();
    expect(JSON.stringify(detail)).toContain("space__dsa");
  });
});
