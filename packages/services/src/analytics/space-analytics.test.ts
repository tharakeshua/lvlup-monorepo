import { describe, expect, it } from "vitest";
import { getCallable } from "@levelup/api-contract";
import { makeAuthContext } from "../../../../tests/sdk/harness/auth-context";
import { getSpaceAnalyticsService } from "./space-analytics.js";

describe("getSpaceAnalyticsService", () => {
  it("batches canonical progress, includes not-started roster members, and ignores Space.stats", async () => {
    const ctx = makeAuthContext("teacher");
    const tenantId = ctx.tenantId!;
    const now = ctx.now();
    await ctx.repos.spaces.upsert(tenantId, {
      id: "space-1",
      title: "Arrays",
      accessType: "class_assigned",
      classIds: ["class-1"],
      stats: { totalStudents: 999, avgCompletionRate: 99 },
    });
    await ctx.repos.students.upsert(tenantId, {
      id: "student-1",
      authUid: "uid-1",
      firstName: "Ada",
      lastName: "Lovelace",
      classIds: ["class-1"],
    });
    await ctx.repos.students.upsert(tenantId, {
      id: "student-2",
      authUid: "uid-2",
      displayName: "Grace Hopper",
      classIds: ["class-1"],
    });
    await ctx.repos.students.upsert(tenantId, {
      id: "student-other",
      authUid: "uid-other",
      classIds: ["class-other"],
    });
    await ctx.repos.progressDocs.upsert(tenantId, {
      id: "uid-1_space-1",
      userId: "uid-1",
      spaceId: "space-1",
      pointsEarned: 5,
      totalPoints: 10,
      updatedAt: now,
      items: {
        q1: { completed: true, timeSpentMs: 90_000, attempts: [{}, {}] },
        q2: { completed: false, timeSpentMs: 30_000 },
      },
    });

    const result = await getSpaceAnalyticsService({ spaceId: "space-1" } as never, ctx);
    expect(
      getCallable("v1.analytics.getSpaceAnalytics").responseSchema.safeParse(result).success
    ).toBe(true);
    expect(result.summary).toMatchObject({
      totalStudents: 2,
      startedStudents: 1,
      completedStudents: 0,
      avgCompletionPct: 25,
      totalAttempts: 3,
    });
    expect(result.students).toEqual([
      expect.objectContaining({
        studentId: "student-1",
        name: "Ada Lovelace",
        completionPct: 50,
        timeSpentSeconds: 120,
        attempts: 3,
      }),
      expect.objectContaining({
        studentId: "student-2",
        name: "Grace Hopper",
        status: "not_started",
        completionPct: 0,
      }),
    ]);
  });

  it("rejects student callers", async () => {
    const ctx = makeAuthContext("student");
    await expect(
      getSpaceAnalyticsService({ spaceId: "space-1" } as never, ctx)
    ).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
  });
});
