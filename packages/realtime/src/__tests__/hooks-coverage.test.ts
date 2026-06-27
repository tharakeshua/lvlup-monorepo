/**
 * `hooks-coverage.test.ts` — transport-realtime layer §8 test #7.
 *
 * There is exactly one exported convenience hook per registered `SubscriptionName`
 * (and none orphaned) — keeps the hook surface in lockstep with the `SUBSCRIPTIONS` registry.
 * The map below is the explicit hook↔channel binding; the test asserts it covers the live
 * registry in BOTH directions (every channel has a hook; every mapped channel exists).
 */
import { describe, it, expect } from "vitest";
import { SUBSCRIPTION_NAMES } from "@levelup/api-contract";
import * as hooks from "../hooks/index.js";

/** Explicit hook-name → channel-name binding (mirrors hooks/index.ts). */
const HOOK_CHANNEL: Record<string, string> = {
  useTestSessionDeadline: "v1.levelup.testSessionDeadline",
  useChatStream: "v1.levelup.chatStream",
  useSpaceProgressLive: "v1.levelup.spaceProgressLive",
  useStudentLevelLive: "v1.levelup.studentLevelLive",
  useAchievementUnlock: "v1.levelup.achievementUnlock",
  useLeaderboardLive: "v1.levelup.leaderboardLive",
  useGradingStatus: "v1.autograde.gradingStatus",
  useExamGrading: "v1.autograde.examGrading",
  useNotificationBadge: "v1.notification.badge",
};

describe("realtime convenience hooks coverage", () => {
  it("every exported hook is a function", () => {
    for (const name of Object.keys(HOOK_CHANNEL)) {
      expect(typeof (hooks as Record<string, unknown>)[name]).toBe("function");
    }
  });

  it("covers every registered SubscriptionName (no missing channel)", () => {
    const covered = new Set(Object.values(HOOK_CHANNEL));
    for (const channel of SUBSCRIPTION_NAMES) {
      expect(covered.has(channel)).toBe(true);
    }
  });

  it("has no orphaned hook (every mapped channel exists in the registry)", () => {
    const registry = new Set<string>(SUBSCRIPTION_NAMES);
    for (const channel of Object.values(HOOK_CHANNEL)) {
      expect(registry.has(channel)).toBe(true);
    }
  });

  it("one hook per channel — counts match", () => {
    expect(Object.keys(HOOK_CHANNEL)).toHaveLength(SUBSCRIPTION_NAMES.length);
    expect(new Set(Object.values(HOOK_CHANNEL)).size).toBe(SUBSCRIPTION_NAMES.length);
  });

  it("every mapped hook is actually exported (no stale binding)", () => {
    const exported = new Set(
      Object.keys(hooks).filter((k) => typeof (hooks as Record<string, unknown>)[k] === "function")
    );
    for (const hookName of Object.keys(HOOK_CHANNEL)) {
      expect(exported.has(hookName)).toBe(true);
    }
  });
});
