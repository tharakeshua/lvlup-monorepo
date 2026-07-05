/**
 * DP-2 Part A — `QUESTION_TYPE_REGISTRY` is the SSOT and EVERY derived structure
 * regenerates from it EXHAUSTIVELY. A missing or extra registry key must break a
 * derived enum/union/grading-array — this test makes that guarantee load-bearing.
 *
 * Behavior-preserving check: the single derived `QuestionTypeDataSchema` (prompt
 * union) is the same public union as pre-DP-2; the `answer`/`learnerAnswer` columns
 * are INERT metadata (declared for DP-3, not wired into any exported validator).
 */
import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  QUESTION_TYPE_REGISTRY,
  type QuestionTypeSpec,
} from "../entities/content/question-types/registry.js";
import {
  QUESTION_TYPES,
  zQuestionType,
  AUTO_EVALUATABLE_TYPES,
  AI_EVALUATABLE_TYPES,
} from "../enums/content.js";
import { QuestionTypeDataSchema } from "../entities/content/question-payload.js";

const REGISTRY_KEYS = Object.keys(QUESTION_TYPE_REGISTRY);

describe("QUESTION_TYPE_REGISTRY — enum derives exactly the registry keys", () => {
  it("QUESTION_TYPES === Object.keys(registry) (no missing / no extra)", () => {
    expect([...QUESTION_TYPES].sort()).toEqual([...REGISTRY_KEYS].sort());
  });

  it("zQuestionType accepts EVERY registry key and rejects a non-key", () => {
    for (const k of REGISTRY_KEYS) expect(zQuestionType.safeParse(k).success).toBe(true);
    expect(zQuestionType.safeParse("not-a-question-type").success).toBe(false);
  });
});

describe("QUESTION_TYPE_REGISTRY — every entry is complete", () => {
  it("each entry has prompt/answer/learnerAnswer Zod schemas + evaluation + label + sample", () => {
    for (const [key, spec] of Object.entries(QUESTION_TYPE_REGISTRY) as [
      string,
      QuestionTypeSpec,
    ][]) {
      expect(spec.prompt, `${key}.prompt`).toBeInstanceOf(z.ZodType);
      expect(spec.answer, `${key}.answer`).toBeInstanceOf(z.ZodType);
      expect(spec.learnerAnswer, `${key}.learnerAnswer`).toBeInstanceOf(z.ZodType);
      expect(["auto", "ai"], `${key}.evaluation`).toContain(spec.evaluation);
      expect(typeof spec.label, `${key}.label`).toBe("string");
      expect(typeof spec.sample, `${key}.sample`).toBe("function");
    }
  });
});

describe("QUESTION_TYPE_REGISTRY — grading arrays derive from the `evaluation` column", () => {
  it("AUTO ∪ AI partitions the registry keys EXACTLY (disjoint + total)", () => {
    const auto = new Set<string>(AUTO_EVALUATABLE_TYPES);
    const ai = new Set<string>(AI_EVALUATABLE_TYPES);
    // disjoint
    for (const t of ai) expect(auto.has(t)).toBe(false);
    // total: union covers every key, no orphan, no extra
    const union = new Set<string>([...auto, ...ai]);
    expect([...union].sort()).toEqual([...REGISTRY_KEYS].sort());
  });

  it("each array matches its `evaluation` value exactly", () => {
    for (const k of REGISTRY_KEYS) {
      const ev = QUESTION_TYPE_REGISTRY[k as keyof typeof QUESTION_TYPE_REGISTRY].evaluation;
      const inAuto = (AUTO_EVALUATABLE_TYPES as readonly string[]).includes(k);
      const inAi = (AI_EVALUATABLE_TYPES as readonly string[]).includes(k);
      expect(inAuto, `${k} auto`).toBe(ev === "auto");
      expect(inAi, `${k} ai`).toBe(ev === "ai");
    }
  });
});

describe("QUESTION_TYPE_REGISTRY — the derived prompt union covers every key", () => {
  it("QuestionTypeDataSchema parses each entry's sample() (every key is a union member)", () => {
    for (const k of REGISTRY_KEYS) {
      const spec = QUESTION_TYPE_REGISTRY[k as keyof typeof QUESTION_TYPE_REGISTRY];
      const res = QuestionTypeDataSchema.safeParse(spec.sample());
      expect(res.success, `prompt union member ${k}`).toBe(true);
    }
  });

  it("rejects an unknown questionType (the union has no extra members)", () => {
    expect(QuestionTypeDataSchema.safeParse({ questionType: "not-real", x: 1 }).success).toBe(
      false
    );
  });
});
