/**
 * Deterministic STUB `LLMProvider` for the emulator/test runtime.
 *
 * NO network calls — every `call()` returns a fixed, schema-valid result keyed
 * off the prompt's structural shape (the gateway passes the rendered system text,
 * so we branch on the system string and on whether a `responseSchema` was asked
 * for). This exists ONLY so the emulator-backed integration suite never blocks on
 * a real Gemini round-trip (an AI-keyless test would otherwise hang on a network
 * timeout). The gateway's moderation / quota / cost / audit-log / circuit-breaker
 * sequence is UNCHANGED — only the provider's network leg and the Secret Manager
 * key lookup are stubbed.
 *
 * Wired in `functions/sdk-v1/src/bootstrap.ts` behind an emulator/test env guard.
 */
import type { LLMProvider, ProviderInput, ProviderOutput, ProviderTokenUsage } from "./provider.js";
import { DEFAULT_FLASH_MODEL } from "../models.js";

const STUB_USAGE: ProviderTokenUsage = { inputTokens: 16, outputTokens: 32, totalTokens: 48 };

/** A grading/evaluation JSON shape (RELMS answerGrading + practice answerGrading). */
const GRADE_JSON = {
  score: 1,
  maxScore: 1,
  correctness: 1,
  percentage: 100,
  confidence: 0.95,
  feedback: "Deterministic stub grade.",
  strengths: ["stub-strength"],
  weaknesses: [],
  missingConcepts: [],
  breakdown: [{ criterion: "stub", marks: 1, maxMarks: 1 }],
};

/** A question-extraction JSON shape (array of questions). */
const EXTRACT_JSON = [
  {
    text: "Stub extracted question",
    maxMarks: 1,
    order: 1,
    questionType: "subjective",
    rubric: { criteria: [{ description: "stub", marks: 1 }] },
    extractionConfidence: 0.95,
    readabilityIssue: false,
  },
];

/** An answer-mapping JSON shape (routing map). */
const MAPPING_JSON = {
  routingMap: { q1: [1] },
  confidence: { q1: 0.95 },
};

/** An insights JSON shape. */
const INSIGHTS_JSON = {
  insights: [{ title: "Stub insight", body: "Deterministic stub insight.", severity: "info" }],
};

function pickJson(input: ProviderInput): unknown {
  const sys = input.system.toLowerCase();
  if (sys.includes("extraction engine")) return EXTRACT_JSON;
  if (sys.includes("answer-sheet scout")) return MAPPING_JSON;
  if (sys.includes("grader")) return GRADE_JSON;
  if (sys.includes("insight")) return INSIGHTS_JSON;
  // Unknown structured prompt → safe grade-shaped default.
  return GRADE_JSON;
}

/**
 * Build the deterministic stub provider. `name` is reported as `gemini` so cost
 * pricing (model-keyed) and downstream telemetry behave exactly as in prod.
 */
export function createStubProvider(_apiKey?: string, model?: string): LLMProvider {
  const defaultModel = model ?? DEFAULT_FLASH_MODEL;
  return {
    name: "gemini",
    async call(input: ProviderInput): Promise<ProviderOutput> {
      const resolvedModel = input.model ?? defaultModel;
      if (input.responseSchema !== undefined) {
        const json = pickJson(input);
        return {
          text: JSON.stringify(json),
          json,
          usage: STUB_USAGE,
          model: resolvedModel,
        };
      }
      // Free-text (tutor chat) — deterministic, no rubric leak.
      return {
        text: "Deterministic stub tutor reply.",
        usage: STUB_USAGE,
        model: resolvedModel,
      };
    },
  };
}
