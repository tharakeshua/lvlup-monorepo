/**
 * subscription-sources coverage (transport-realtime.md §3 / SDK-LAYERS-PLAN.md
 * §3.3). `SUBSCRIPTION_SOURCES` must list ALL 9 subscription names (the
 * SUBSCRIPTIONS(9) ⊇ SOURCES(7) schism closer: studentLevelLive + achievementUnlock
 * added, leaderboardLive canonical).
 *
 * Self-skips until transport-firebase exports SUBSCRIPTION_SOURCES and
 * api-contract exports SUBSCRIPTIONS.
 */
import { describe, it, expect } from "vitest";
import * as transport from "../index";
import * as contract from "@levelup/api-contract";

const T = transport as unknown as { SUBSCRIPTION_SOURCES?: Record<string, unknown> };
const C = contract as unknown as { SUBSCRIPTIONS?: Record<string, unknown> };

const ready = Boolean(T.SUBSCRIPTION_SOURCES && C.SUBSCRIPTIONS);

const EXPECTED_NINE = [
  "v1.levelup.testSessionDeadline",
  "v1.levelup.chatStream",
  "v1.levelup.spaceProgressLive",
  "v1.levelup.leaderboardLive",
  "v1.levelup.studentLevelLive",
  "v1.levelup.achievementUnlock",
  "v1.autograde.gradingStatus",
  "v1.autograde.examGrading",
  "v1.notification.badge",
];

(ready ? describe : describe.skip)("SUBSCRIPTION_SOURCES coverage", () => {
  it("SUBSCRIPTION_SOURCES keys ⊇ SUBSCRIPTIONS names (must be GREEN)", () => {
    const sourceKeys = new Set(Object.keys(T.SUBSCRIPTION_SOURCES!));
    const missing = Object.keys(C.SUBSCRIPTIONS!).filter((n) => !sourceKeys.has(n));
    expect(missing, `subscriptions without a source descriptor:\n${missing.join("\n")}`).toEqual(
      []
    );
  });

  it("all nine canonical subscription names exist", () => {
    for (const n of EXPECTED_NINE) {
      expect(Object.keys(C.SUBSCRIPTIONS!), `SUBSCRIPTIONS has ${n}`).toContain(n);
    }
  });

  it("the dropped analytics.leaderboard name is NOT present (leaderboardLive canonical)", () => {
    expect(Object.keys(C.SUBSCRIPTIONS!)).not.toContain("v1.analytics.leaderboard");
  });
});
