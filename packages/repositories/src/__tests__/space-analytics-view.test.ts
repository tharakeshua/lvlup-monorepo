import { describe, expect, it } from "vitest";
import { createFakeApiClient } from "../../../../tests/sdk/fakes";
import { buildRepos, ready } from "./_harness";

(ready() ? describe : describe.skip)("spaceAnalyticsRepo", () => {
  it("uses one canonical server read and returns the projection unchanged", async () => {
    const api = createFakeApiClient();
    const response = {
      spaceId: "space-1",
      generatedAt: "2026-07-18T00:00:00.000Z",
      summary: {
        totalStudents: 2,
        startedStudents: 1,
        completedStudents: 0,
        activeStudents7d: 1,
        avgCompletionPct: 25,
        avgTimeSpentSeconds: 60,
        totalAttempts: 3,
      },
      students: [],
    };
    api.stub("analytics", "getSpaceAnalytics", () => response);

    const repo = buildRepos(api)["spaceAnalyticsRepo"];
    expect(repo).toBeDefined();
    await expect(repo!["get"]!("space-1")).resolves.toEqual(response);
    expect(api.callsTo("v1.analytics.getSpaceAnalytics")).toHaveLength(1);
    expect(api.calls).toHaveLength(1);
  });
});
