/**
 * U2.6 — levelup live-ticker RTDB projection producer tests (AD-12; inherits
 * the AG-5 grading-projection test pattern).
 *
 * Locks the invariants the realtime authority design depends on:
 *   1. SLIM PAYLOAD per channel: bounded numerics / status / unlock event ONLY —
 *      never per-item answers, stored evaluations, answer keys, question order,
 *      or (for the test-session countdown) any score field.
 *   2. The projections ride the REAL write paths (applyProgress, the expire
 *      trigger) — the producers never re-read Firestore to build the payload.
 *   3. Every projector DEGRADES GRACEFULLY to a no-op when the port isn't wired
 *      (the composition root only injects it in prod).
 *
 * The RTDB writer port is injected as a spy on `ctx.repos.levelupProjections`
 * (the seam the sdk-v1 bootstrap wires to the concrete Admin-RTDB adapter) — so
 * these are pure, emulator-free service-unit tests.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { makeSystemContext } from "../../../../tests/sdk/harness/auth-context";
import { createInMemoryRepos } from "../../../../tests/sdk/fakes/in-memory-repos";
import {
  projectSpaceProgressLive,
  projectStudentLevel,
  projectAchievementUnlock,
  clearAchievementUnlockProjection,
  projectTestSessionLive,
  projectChatBump,
  type LevelupProjectionPort,
  type SpaceProgressLiveProjection,
  type StudentLevelProjection,
  type AchievementUnlockProjection,
  type TestSessionLiveProjection,
} from "./levelup-projection";
import { applyProgress } from "./progress-updater";
import { expireAndGradeSessionService } from "./triggers";

const TENANT = "tenant_contract";
const NOW = "2026-01-01T00:00:00.000Z";

/** The ONLY keys allowed on each client-read node (strict payloads). */
const ALLOWED_SPACE_KEYS = [
  "spaceId",
  "userId",
  "status",
  "pointsEarned",
  "totalPoints",
  "percentage",
  "storyPoints",
  "updatedAt",
].sort();
const ALLOWED_SP_KEYS = ["storyPointId", "status", "pointsEarned", "totalPoints", "percentage"];
const ALLOWED_SESSION_KEYS = ["remainingMs", "serverDeadline", "status"].sort();

/** Keys that would be an answer-key / evaluation / release-gate LEAK. */
const FORBIDDEN_KEYS = [
  "items",
  "itemProgress",
  "evaluation",
  "lastEvaluation",
  "answer",
  "answers",
  "answerKey",
  "answerKeys",
  "rubric",
  "score",
  "questionOrder",
  "visitedQuestions",
  "markedForReview",
  "recomputeMarker",
];

/** In-memory spy implementing the RTDB projection port (captures every write). */
function makeSpyPort() {
  const spaceWrites: Array<{ userId: string; spaceId: string; live: SpaceProgressLiveProjection }> =
    [];
  const levelWrites: Array<{ userId: string; level: StudentLevelProjection }> = [];
  const unlockWrites: Array<{ userId: string; event: AchievementUnlockProjection }> = [];
  const unlockClears: string[] = [];
  const sessionWrites: Array<{
    userId: string;
    sessionId: string;
    live: TestSessionLiveProjection;
  }> = [];
  const chatBumps: Array<{ userId: string; sessionId: string; lastMessageAt: string }> = [];

  const port: LevelupProjectionPort = {
    async setSpaceProgress(_t, userId, spaceId, live) {
      spaceWrites.push({ userId, spaceId, live });
    },
    async setStudentLevel(_t, userId, level) {
      levelWrites.push({ userId, level });
    },
    async setAchievementUnlock(_t, userId, event) {
      unlockWrites.push({ userId, event });
    },
    async clearAchievementUnlock(_t, userId) {
      unlockClears.push(userId);
    },
    async setTestSessionLive(_t, userId, sessionId, live) {
      sessionWrites.push({ userId, sessionId, live });
    },
    async bumpChat(_t, userId, sessionId, lastMessageAt) {
      chatBumps.push({ userId, sessionId, lastMessageAt });
    },
  };
  return { port, spaceWrites, levelWrites, unlockWrites, unlockClears, sessionWrites, chatBumps };
}

/** ctx whose repos carry the injected projection spy. */
function ctxWithPort(spy: ReturnType<typeof makeSpyPort>) {
  const repos = createInMemoryRepos({ now: () => NOW });
  (repos as unknown as { levelupProjections: LevelupProjectionPort }).levelupProjections = spy.port;
  return makeSystemContext(TENANT, { repos, clockIso: NOW });
}

describe("U2.6 spaceProgressLive projection — rides applyProgress, slim rollup only", () => {
  let spy: ReturnType<typeof makeSpyPort>;
  beforeEach(() => {
    spy = makeSpyPort();
  });

  it("projects the tx rollup with ONLY the bounded numeric fields", async () => {
    const ctx = ctxWithPort(spy);
    await applyProgress(
      {
        userId: "learner1",
        spaceId: "space1",
        items: [
          {
            storyPointId: "sp1",
            itemId: "i1",
            score: 3,
            maxScore: 5,
            correct: false,
            evaluation: { score: 3, feedback: "close", answerKey: "LEAK?" },
          },
          { storyPointId: "sp2", itemId: "i2", score: 2, maxScore: 2, correct: true },
        ],
      },
      ctx
    );
    expect(spy.spaceWrites).toHaveLength(1);
    const w = spy.spaceWrites[0]!;
    expect(w.userId).toBe("learner1");
    expect(w.spaceId).toBe("space1");
    expect(Object.keys(w.live).sort()).toEqual(ALLOWED_SPACE_KEYS);
    for (const k of FORBIDDEN_KEYS) expect(k in w.live).toBe(false);
    expect(w.live).toMatchObject({
      status: "in_progress",
      pointsEarned: 5,
      totalPoints: 7,
      percentage: 71,
      updatedAt: NOW,
    });
    // Per-story-point slices carry ONLY the bounded numerics — the evaluation
    // payload handed to applyProgress must never reach the live channel.
    expect(Object.keys(w.live.storyPoints).sort()).toEqual(["sp1", "sp2"]);
    for (const sp of Object.values(w.live.storyPoints)) {
      expect(Object.keys(sp).sort()).toEqual([...ALLOWED_SP_KEYS].sort());
      for (const k of FORBIDDEN_KEYS) expect(k in sp).toBe(false);
    }
    expect(w.live.storyPoints["sp2"]).toMatchObject({ status: "completed", percentage: 100 });
  });

  it("marks the space completed when every story point completes", async () => {
    const ctx = ctxWithPort(spy);
    await applyProgress(
      {
        userId: "learner1",
        spaceId: "space1",
        items: [{ storyPointId: "sp1", itemId: "i1", score: 2, maxScore: 2, correct: true }],
      },
      ctx
    );
    expect(spy.spaceWrites[0]!.live.status).toBe("completed");
  });
});

describe("U2.6 testSessionLive projection — countdown state ONLY", () => {
  it("writes {remainingMs, serverDeadline, status} and clamps remainingMs to 0", async () => {
    const spy = makeSpyPort();
    const ctx = ctxWithPort(spy);
    const pastDeadline = "2025-12-31T23:00:00.000Z"; // an hour before NOW
    await projectTestSessionLive(ctx, TENANT, {
      sessionId: "sess1",
      userId: "learner1",
      serverDeadline: pastDeadline,
      status: "expired",
    });
    const w = spy.sessionWrites[0]!;
    expect(w.sessionId).toBe("sess1");
    expect(Object.keys(w.live).sort()).toEqual(ALLOWED_SESSION_KEYS);
    expect(w.live).toEqual({ remainingMs: 0, serverDeadline: pastDeadline, status: "expired" });
  });

  it("rides the expire trigger without leaking session content", async () => {
    const spy = makeSpyPort();
    const ctx = ctxWithPort(spy);
    await ctx.repos.testSessions.upsert(
      TENANT,
      {
        id: "sess1",
        userId: "learner1",
        spaceId: "space1",
        storyPointId: "sp1",
        status: "in_progress",
        serverDeadline: "2025-12-31T23:00:00.000Z",
        questionOrder: ["i1", "i2"],
        visitedQuestions: { i1: true },
      },
      NOW
    );
    await expireAndGradeSessionService({ sessionId: "sess1" }, ctx);
    const w = spy.sessionWrites.find((s) => s.live.status === "expired");
    expect(w).toBeDefined();
    expect(Object.keys(w!.live).sort()).toEqual(ALLOWED_SESSION_KEYS);
    for (const k of FORBIDDEN_KEYS) expect(k in w!.live).toBe(false);
  });
});

describe("U2.6 studentLevelLive + achievementUnlock projections", () => {
  it("projects the strict StudentLevel slim shape with null-safe defaults", async () => {
    const spy = makeSpyPort();
    const ctx = ctxWithPort(spy);
    await projectStudentLevel(ctx, TENANT, "learner1", { level: 3, xp: 120 });
    const w = spy.levelWrites[0]!;
    expect(w.level).toEqual({
      id: "learner1",
      tenantId: TENANT,
      userId: "learner1",
      level: 3,
      currentXP: 120,
      xpToNextLevel: 0,
      totalXP: 120,
      tier: "bronze",
      achievementCount: 0,
      updatedAt: NOW,
    });
  });

  it("projects a whitelisted unlock event (seen=false) and clears on mark-seen", async () => {
    const spy = makeSpyPort();
    const ctx = ctxWithPort(spy);
    await projectAchievementUnlock(ctx, TENANT, "learner1", {
      id: "ua1",
      achievementId: "ach1",
      achievement: { id: "ach1", name: "First Steps", tier: "bronze" },
      earnedAt: NOW,
    });
    const w = spy.unlockWrites[0]!;
    expect(Object.keys(w.event).sort()).toEqual(
      ["id", "tenantId", "userId", "achievementId", "achievement", "earnedAt", "seen"].sort()
    );
    expect(w.event.seen).toBe(false);
    await clearAchievementUnlockProjection(ctx, TENANT, "learner1");
    expect(spy.unlockClears).toEqual(["learner1"]);
  });
});

describe("U2.6 projections — graceful no-op when the port is not wired", () => {
  it("every projector resolves without a levelupProjections port", async () => {
    const ctx = makeSystemContext(TENANT, { clockIso: NOW }); // no port injected
    await expect(
      applyProgress(
        {
          userId: "learner1",
          spaceId: "space1",
          items: [{ storyPointId: "sp1", itemId: "i1", score: 1, maxScore: 1, correct: true }],
        },
        ctx
      )
    ).resolves.toMatchObject({ completed: true });
    await expect(projectStudentLevel(ctx, TENANT, "u", {})).resolves.toBeUndefined();
    await expect(
      projectAchievementUnlock(ctx, TENANT, "u", {
        id: "a",
        achievementId: "a",
        achievement: {},
        earnedAt: NOW,
      })
    ).resolves.toBeUndefined();
    await expect(clearAchievementUnlockProjection(ctx, TENANT, "u")).resolves.toBeUndefined();
    await expect(
      projectTestSessionLive(ctx, TENANT, {
        sessionId: "s",
        userId: "u",
        serverDeadline: NOW,
        status: "in_progress",
      })
    ).resolves.toBeUndefined();
    await expect(
      projectChatBump(ctx, TENANT, { userId: "u", sessionId: "s", lastMessageAt: NOW })
    ).resolves.toBeUndefined();
  });
});

describe("CHAT-1 chatBump projection — refetch signal only, content never in RTDB", () => {
  it("forwards ONLY (userId, sessionId, lastMessageAt) to the port — no message fields", async () => {
    const spy = makeSpyPort();
    const ctx = ctxWithPort(spy);
    await projectChatBump(ctx, TENANT, {
      userId: "learner1",
      sessionId: "sess1",
      lastMessageAt: NOW,
    });
    expect(spy.chatBumps).toEqual([{ userId: "learner1", sessionId: "sess1", lastMessageAt: NOW }]);
    // The projection surface has no channel for text/role/mediaUrls at all —
    // Object keys of the captured bump stay the minimal triple.
    expect(Object.keys(spy.chatBumps[0]!).sort()).toEqual(["lastMessageAt", "sessionId", "userId"]);
  });
});
