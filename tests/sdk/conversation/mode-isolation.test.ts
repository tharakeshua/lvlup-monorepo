/**
 * T-I — Mode isolation + learner-projection LEAK proofs
 * (LLD §20.1 "projection snapshot proving every private field is absent",
 *  §22.3/§22.4 private-data boundary, §22.4 "tutor cannot become assessment").
 *
 * Runtime-independent. Two guarantees:
 *  1. Each mode declares ONLY its allowlisted tools — an assessment-only tool
 *     (record_evidence / recommend_completion) is never exposed to tutor or
 *     question-help, and tutor/help tools are never exposed to assessment.
 *  2. The learner-safe projections NEVER contain the frozen configuration
 *     snapshot, interviewer system prompt, answer key, private rubric/objective,
 *     evaluator policy, or cost telemetry — proven by a deep string scan for the
 *     greppable sentinels seeded into the durable fixtures.
 */
import { describe, it, expect } from "vitest";
import { CONVERSATION_MODES, type ConversationMode } from "@levelup/domain";
import {
  MODE_POLICY,
  isConversationToolAllowed,
} from "../../../packages/services/src/conversation/policy.js";
import { toolDeclarationsFor } from "../../../packages/services/src/conversation/tools/registry.js";
import {
  projectConversationSession,
  projectConversationSummary,
  projectConversationMessage,
  projectConversationTurn,
} from "../../../packages/services/src/conversation/projections.js";
import { makeSessionDoc, makeTurnDoc, makeAssistantMessage, PRIVATE_SENTINELS } from "./_fixtures";

const ASSESSMENT_ONLY = ["record_evidence", "recommend_completion"] as const;
const HELP_ONLY = ["retrieve_item_context", "record_hint_usage"] as const;

describe("tool allowlists are mode-scoped (LLD §10.3, §22.4)", () => {
  it("assessment-only tools are NEVER allowlisted for tutor or question_help", () => {
    for (const tool of ASSESSMENT_ONLY) {
      expect(isConversationToolAllowed("tutor", tool)).toBe(false);
      expect(isConversationToolAllowed("question_help", tool)).toBe(false);
      expect(isConversationToolAllowed("agent_assessment", tool)).toBe(true);
    }
  });

  it("assessment never declares learner-context retrieval tools (no private-context exposure)", () => {
    // retrieve_scope_context / retrieve_item_context / progress-summary are structurally
    // absent from assessment so the interviewer cannot pull learner-visible context.
    for (const tool of [
      "retrieve_scope_context",
      "get_learner_visible_progress_summary",
      ...HELP_ONLY,
    ] as const) {
      expect(isConversationToolAllowed("agent_assessment", tool)).toBe(false);
    }
  });

  it("toolDeclarationsFor returns only the mode's allowlisted tools", () => {
    for (const mode of CONVERSATION_MODES) {
      const declared = toolDeclarationsFor(mode, MODE_POLICY[mode].toolsetVersion).map(
        (t) => t.name
      );
      expect(new Set(declared)).toEqual(new Set(MODE_POLICY[mode].toolNames));
    }
  });

  it("assessment uses the quality runtime policy; tutor/help use fast", () => {
    expect(MODE_POLICY.agent_assessment.defaultModelPolicyId).toBe("conversation.quality");
    expect(MODE_POLICY.tutor.defaultModelPolicyId).toBe("conversation.fast");
    expect(MODE_POLICY.question_help.defaultModelPolicyId).toBe("conversation.fast");
  });
});

/** Deep-scan a projected value for any private sentinel; returns the first hit. */
function findLeak(value: unknown): string | null {
  const haystack = JSON.stringify(value);
  for (const [name, sentinel] of Object.entries(PRIVATE_SENTINELS)) {
    if (haystack.includes(String(sentinel))) return `${name}=${sentinel}`;
  }
  // structural leak markers that must never appear on a learner view
  for (const forbiddenKey of [
    "configurationSnapshot",
    "interviewerContext",
    "evaluatorContext",
    "answerKey",
    "systemPrompt",
    "usageAggregate",
    "costUsd",
  ]) {
    if (haystack.includes(`"${forbiddenKey}"`)) return `forbidden-key:${forbiddenKey}`;
  }
  return null;
}

describe("learner projection strips ALL private data (LLD §8.6, §22.3/22.4)", () => {
  for (const mode of CONVERSATION_MODES) {
    it(`projectConversationSession(${mode}) leaks nothing private`, () => {
      const doc = makeSessionDoc(mode);
      const view = projectConversationSession(doc);
      expect(findLeak(view)).toBeNull();
      // sanity: the durable doc DID contain the sentinels (proves the scan is meaningful)
      expect(findLeak(doc)).not.toBeNull();
    });

    it(`projectConversationSummary(${mode}) leaks nothing private`, () => {
      expect(findLeak(projectConversationSummary(makeSessionDoc(mode)))).toBeNull();
    });
  }

  it("projected session exposes only the allowlisted public surface", () => {
    const view = projectConversationSession(makeSessionDoc("agent_assessment")) as Record<
      string,
      unknown
    >;
    const allowed = new Set([
      "id",
      "mode",
      "context",
      "contextBaseKey",
      "contextKey",
      "title",
      "locale",
      "status",
      "revision",
      "learnerTurnCount",
      "publicConfig",
      "completionRecommendation",
      "activeTurn",
      "grading",
      "result",
      "allowedActions",
      "createdAt",
      "updatedAt",
      "completedAt",
    ]);
    for (const key of Object.keys(view)) expect(allowed.has(key)).toBe(true);
  });

  it("projectConversationTurn exposes no model request ids / usage / config fingerprint", () => {
    const view = projectConversationTurn(makeTurnDoc("completed")) as Record<string, unknown>;
    expect(findLeak(view)).toBeNull();
    for (const forbidden of [
      "modelRequestIds",
      "configurationFingerprint",
      "traceId",
      "lease",
      "usageAggregate",
    ]) {
      expect(Object.keys(view)).not.toContain(forbidden);
    }
  });

  it("projectConversationMessage exposes only learner-safe fields", () => {
    const view = projectConversationMessage(makeAssistantMessage()) as Record<string, unknown>;
    expect(findLeak(view)).toBeNull();
    const allowed = new Set([
      "id",
      "sequence",
      "role",
      "origin",
      "content",
      "clientMessageId",
      "deliveryStatus",
      "createdAt",
      "completedAt",
    ]);
    for (const key of Object.keys(view)) expect(allowed.has(key)).toBe(true);
  });
});

describe("session action-affordances reflect server state only (LLD §22.2)", () => {
  it("a hard-limited assessment offers finish but NOT abandon", () => {
    const view = projectConversationSession(
      makeSessionDoc("agent_assessment", { status: "ready_to_finish", hardLimitReached: true })
    );
    expect(view.allowedActions).toContain("finish");
    expect(view.allowedActions).not.toContain("abandon");
  });

  it("a completed session offers no send/finish/abandon", () => {
    const view = projectConversationSession(makeSessionDoc("tutor", { status: "completed" }));
    for (const action of ["send", "finish", "abandon"])
      expect(view.allowedActions).not.toContain(action);
  });

  it("an active session with a running turn offers no send (one active turn)", () => {
    const doc = makeSessionDoc("tutor", { activeTurnId: "ct_turn_alpha" });
    const view = projectConversationSession(doc, makeTurnDoc("model_running"));
    expect(view.allowedActions).not.toContain("send");
    expect(view.activeTurn?.status).toBe("running");
  });
});
