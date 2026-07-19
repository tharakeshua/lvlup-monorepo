/**
 * T-I — Conversation state-machine TOTALITY + guard property tests
 * (LLD §20.2 "status and transition totality", §22.2 lifecycle).
 *
 * Runtime-independent: drives the pure guards in
 * `packages/services/src/conversation/state-machine.ts` + `policy.ts` across the
 * FULL cross-product of statuses, so a future edit that widens a guard (e.g. lets
 * a terminal session accept a send, or lets an assessment at the hard limit be
 * abandoned) fails here rather than in production.
 */
import { describe, it, expect } from "vitest";
import {
  CONVERSATION_SESSION_STATUSES,
  CONVERSATION_TURN_STATUSES,
  type ConversationSessionStatus,
  type ConversationTurnStatus,
} from "@levelup/domain";
import {
  canSend,
  canFinish,
  canAbandon,
  isTerminalSessionStatus,
  isTurnRunning,
  isTurnReplayable,
  toTurnViewStatus,
  turnMayBeRetried,
  nextStatusAfterTurn,
} from "../../../packages/services/src/conversation/state-machine.js";

const SESSION_STATUSES = CONVERSATION_SESSION_STATUSES;
const TURN_STATUSES = CONVERSATION_TURN_STATUSES;
const BOOL = [true, false];

function session(
  status: ConversationSessionStatus,
  activeTurnId: string | undefined,
  hardLimitReached: boolean
) {
  return {
    status,
    activeTurnId,
    completionRecommendation: hardLimitReached
      ? {
          reasonCode: "hard_limit" as const,
          coveredPublicObjectiveIds: [],
          remainingPublicObjectiveIds: [],
          hardLimitReached: true,
          recommendedAt: "2026-07-19T00:00:00.000Z" as never,
        }
      : undefined,
  };
}

describe("session guards across the full status × activeTurn × hardLimit cross-product", () => {
  it("canSend ⇔ (active|ready_to_finish) ∧ no active turn ∧ not hard-limited", () => {
    for (const status of SESSION_STATUSES)
      for (const active of [undefined, "ct_x"])
        for (const hard of BOOL) {
          const expected =
            (status === "active" || status === "ready_to_finish") && !active && !hard;
          expect(canSend(session(status, active, hard) as never)).toBe(expected);
        }
  });

  it("canFinish ⇔ (active|ready_to_finish) ∧ no active turn (hard limit STILL allows finish)", () => {
    for (const status of SESSION_STATUSES)
      for (const active of [undefined, "ct_x"])
        for (const hard of BOOL) {
          const expected = (status === "active" || status === "ready_to_finish") && !active;
          expect(canFinish(session(status, active, hard) as never)).toBe(expected);
        }
  });

  it("canAbandon ⇔ canFinish ∧ not hard-limited (a hard-limit assessment must finalize, not abandon)", () => {
    for (const status of SESSION_STATUSES)
      for (const active of [undefined, "ct_x"])
        for (const hard of BOOL) {
          const s = session(status, active, hard);
          const expected = canFinish(s as never) && !hard;
          expect(canAbandon(s as never)).toBe(expected);
        }
  });

  it("terminal sessions (completed|abandoned) accept NO send/finish/abandon", () => {
    for (const status of ["completed", "abandoned"] as const) {
      expect(isTerminalSessionStatus(status)).toBe(true);
      for (const active of [undefined, "ct_x"])
        for (const hard of BOOL) {
          const s = session(status, active, hard);
          expect(canSend(s as never)).toBe(false);
          expect(canFinish(s as never)).toBe(false);
          expect(canAbandon(s as never)).toBe(false);
        }
    }
  });

  it("non-terminal grading states (finalizing|grading_pending|grading_failed) block new sends", () => {
    for (const status of ["finalizing", "grading_pending", "grading_failed"] as const) {
      expect(isTerminalSessionStatus(status)).toBe(false);
      expect(canSend(session(status, undefined, false) as never)).toBe(false);
    }
  });
});

describe("turn status classification is TOTAL over the six-state enum", () => {
  it("every turn status maps to a defined view status and never throws", () => {
    for (const status of TURN_STATUSES) {
      const view = toTurnViewStatus(status);
      expect(["running", "completed", "failed_recoverable", "failed_terminal"]).toContain(view);
    }
  });

  it("running / replayable / retryable partitions are consistent", () => {
    for (const status of TURN_STATUSES) {
      const running = isTurnRunning(status);
      const replayable = isTurnReplayable(status);
      const retryable = turnMayBeRetried({ status } as never);
      // running = claimed|model_running|tool_running
      expect(running).toBe(["claimed", "model_running", "tool_running"].includes(status));
      // replayable = completed|failed_terminal (idempotent replay outcomes)
      expect(replayable).toBe(["completed", "failed_terminal"].includes(status));
      // only failed_recoverable may be retried
      expect(retryable).toBe(status === "failed_recoverable");
      // a status is never simultaneously running and replayable
      expect(running && replayable).toBe(false);
    }
  });
});

describe("nextStatusAfterTurn — only assessment can enter ready_to_finish", () => {
  it("tutor / question_help always stay active regardless of recommendation/hard-limit", () => {
    for (const mode of ["tutor", "question_help"] as const)
      for (const hard of BOOL) {
        expect(nextStatusAfterTurn(mode, undefined, hard)).toBe("active");
        expect(
          nextStatusAfterTurn(
            mode,
            {
              reasonCode: "objectives_covered",
              coveredPublicObjectiveIds: [],
              remainingPublicObjectiveIds: [],
              hardLimitReached: hard,
              recommendedAt: "2026-07-19T00:00:00.000Z" as never,
            },
            hard
          )
        ).toBe("active");
      }
  });

  it("agent_assessment enters ready_to_finish on a recommendation OR hard limit", () => {
    expect(nextStatusAfterTurn("agent_assessment", undefined, false)).toBe("active");
    expect(nextStatusAfterTurn("agent_assessment", undefined, true)).toBe("ready_to_finish");
    expect(
      nextStatusAfterTurn(
        "agent_assessment",
        {
          reasonCode: "objectives_covered",
          coveredPublicObjectiveIds: [],
          remainingPublicObjectiveIds: [],
          hardLimitReached: false,
          recommendedAt: "2026-07-19T00:00:00.000Z" as never,
        },
        false
      )
    ).toBe("ready_to_finish");
  });
});
