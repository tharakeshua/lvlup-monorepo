/**
 * T-I — Red-team / prompt-injection gate (LLD §20.7, §22.3/22.4).
 *
 * Drives the machine-checkable subset of RED_TEAM_CORPUS against the PURE guards
 * and projections. Structural-context entries are asserted at the contract level
 * here and become live turn-level assertions in the emulator suites.
 *
 * FAIL release on ANY: cross-tenant / answer-key / private prompt/objective /
 * evidence / cost-telemetry leak.
 */
import { describe, it, expect } from "vitest";
import { ServiceError } from "../../../packages/services/src/shared/context.js";
import {
  assertConversationTurnInput,
  isConversationToolAllowed,
  MODE_POLICY,
  CONVERSATION_LIMITS,
  type ConversationTurnInput,
} from "../../../packages/services/src/conversation/policy.js";
import {
  projectConversationSession,
  projectConversationTurn,
} from "../../../packages/services/src/conversation/projections.js";
import { RED_TEAM_CORPUS, RELEASE_GATES, type RedTeamFixture } from "./red-team-corpus";
import { makeSessionDoc, makeTurnDoc, PRIVATE_SENTINELS } from "./_fixtures";

const TENANT = "tenant_contract";

function expectFail(fn: () => void, code: string): void {
  try {
    fn();
    throw new Error("expected the guard to reject, but it accepted the input");
  } catch (e) {
    expect(e).toBeInstanceOf(ServiceError);
    expect((e as ServiceError).code).toBe(code);
  }
}

describe("red-team corpus integrity", () => {
  it("every fixture references a known release gate", () => {
    for (const f of RED_TEAM_CORPUS) expect(RELEASE_GATES).toContain(f.gate);
  });
  it("covers all eight release gates at least once", () => {
    const covered = new Set(RED_TEAM_CORPUS.map((f) => f.gate));
    for (const g of RELEASE_GATES) expect(covered.has(g)).toBe(true);
  });
});

describe("RT-06 / RT-07 cross-tenant + scope escape via media path (pure guard)", () => {
  it("rejects media scoped to another tenant → PERMISSION_DENIED", () => {
    const input: ConversationTurnInput = {
      text: "here is my work",
      media: [
        {
          mediaKind: "image",
          storagePath: "tenants/other_tenant/secret.png",
          mimeType: "image/png",
        },
      ],
    };
    expectFail(
      () => assertConversationTurnInput(input, "question_help", TENANT),
      "PERMISSION_DENIED"
    );
  });

  it("accepts media correctly scoped to the caller's tenant", () => {
    const input: ConversationTurnInput = {
      text: "here is my work",
      media: [
        {
          mediaKind: "image",
          storagePath: `tenants/${TENANT}/uploads/a.png`,
          mimeType: "image/png",
        },
      ],
    };
    expect(() => assertConversationTurnInput(input, "question_help", TENANT)).not.toThrow();
  });

  it("rejects a non-image / unsupported mime attachment", () => {
    const input: ConversationTurnInput = {
      text: "x",
      media: [
        { mediaKind: "image", storagePath: `tenants/${TENANT}/a.pdf`, mimeType: "application/pdf" },
      ],
    };
    expectFail(
      () => assertConversationTurnInput(input, "question_help", TENANT),
      "VALIDATION_ERROR"
    );
  });
});

describe("RT-10 wrong-mode draft smuggling (pure guard)", () => {
  it("rejects questionHelpDraft on a tutor session → VALIDATION_ERROR", () => {
    const input: ConversationTurnInput = {
      text: "hi",
      questionHelpDraft: { revision: 1, answer: "x" },
    };
    expectFail(() => assertConversationTurnInput(input, "tutor", TENANT), "VALIDATION_ERROR");
    expectFail(
      () => assertConversationTurnInput(input, "agent_assessment", TENANT),
      "VALIDATION_ERROR"
    );
  });

  it("accepts questionHelpDraft only on a question_help session", () => {
    const input: ConversationTurnInput = {
      text: "hi",
      questionHelpDraft: { revision: 1, answer: "x" },
    };
    expect(() => assertConversationTurnInput(input, "question_help", TENANT)).not.toThrow();
  });
});

describe("RT-14 / RT-15 resource-exhaustion input limits (pure guard)", () => {
  it("rejects text over the 4000-char ceiling", () => {
    const input: ConversationTurnInput = {
      text: "a".repeat(CONVERSATION_LIMITS.maxInputTextChars + 1),
    };
    expectFail(() => assertConversationTurnInput(input, "tutor", TENANT), "VALIDATION_ERROR");
  });

  it("rejects a draft snapshot over the 32KB ceiling", () => {
    const big = "b".repeat(CONVERSATION_LIMITS.maxDraftSnapshotBytes + 1);
    const input: ConversationTurnInput = {
      text: "x",
      questionHelpDraft: { revision: 1, answer: big },
    };
    expectFail(
      () => assertConversationTurnInput(input, "question_help", TENANT),
      "VALIDATION_ERROR"
    );
  });

  it("rejects more than the max media items", () => {
    const media = Array.from({ length: CONVERSATION_LIMITS.maxMediaItems + 1 }, () => ({
      mediaKind: "image" as const,
      storagePath: `tenants/${TENANT}/a.png`,
      mimeType: "image/png",
    }));
    expectFail(
      () => assertConversationTurnInput({ text: "x", media }, "question_help", TENANT),
      "VALIDATION_ERROR"
    );
  });

  it("tool-loop byte/step/call ceilings are bounded (no runaway output)", () => {
    expect(CONVERSATION_LIMITS.maxToolResultBytes).toBeLessThanOrEqual(
      CONVERSATION_LIMITS.maxAllToolResultsBytes
    );
    expect(CONVERSATION_LIMITS.maxModelStepsPerTurn).toBeGreaterThan(0);
    expect(CONVERSATION_LIMITS.maxToolCallsPerTurn).toBeGreaterThan(0);
    expect(CONVERSATION_LIMITS.toolTimeoutMs).toBeGreaterThan(0);
  });
});

describe("RT-04 / RT-05 / RT-11 forbidden + silent-authority tool defense (allowlist)", () => {
  it("no fabricated 'read_answer_key' / 'set_score' / 'end_session' tool is allowlisted anywhere", () => {
    for (const mode of ["tutor", "question_help", "agent_assessment"] as const)
      for (const forbidden of ["read_answer_key", "set_score", "end_session", "grade"])
        expect(isConversationToolAllowed(mode, forbidden)).toBe(false);
  });

  it("assessment interviewer has NO scoring/ending tool — only evidence + recommendation", () => {
    expect([...MODE_POLICY.agent_assessment.toolNames].sort()).toEqual(
      ["recommend_completion", "record_evidence"].sort()
    );
  });
});

describe("RT-02 / RT-03 / RT-12 leak gates (projection scan)", () => {
  const scan = (v: unknown): string[] => {
    const s = JSON.stringify(v);
    const hits: string[] = [];
    for (const [k, sentinel] of Object.entries(PRIVATE_SENTINELS))
      if (s.includes(String(sentinel))) hits.push(k);
    return hits;
  };

  it("assessment session projection leaks neither answer key, rubric, objective, nor evaluator prompt", () => {
    const view = projectConversationSession(
      makeSessionDoc("agent_assessment", { status: "grading_pending" })
    );
    expect(scan(view)).toEqual([]);
  });

  it("turn projection leaks no cost telemetry", () => {
    const view = projectConversationTurn(makeTurnDoc("completed"));
    expect(JSON.stringify(view)).not.toContain(String(PRIVATE_SENTINELS.cost));
  });
});

/** Emit the machine-readable gate ledger so the release runbook can cite pass evidence. */
describe("§20.7 release-gate ledger", () => {
  it("produces a gate → fixtures map with no orphan fixtures", () => {
    const ledger: Record<string, RedTeamFixture["id"][]> = {};
    for (const g of RELEASE_GATES) ledger[g] = [];
    for (const f of RED_TEAM_CORPUS) ledger[f.gate].push(f.id);
    // Every gate is exercised; print for the runbook evidence capture.
    for (const g of RELEASE_GATES) expect(ledger[g].length).toBeGreaterThan(0);
    // eslint-disable-next-line no-console
    console.log("[red-team] §20.7 gate ledger:", JSON.stringify(ledger));
  });
});
