/**
 * `question-forms` — pure TypeScript form helpers for the 15 question types.
 *
 * RN-safe: no React, no DOM, no external dependencies beyond `@levelup/domain`.
 * Exports:
 *  - `QuestionType`, `QUESTION_TYPES`  (derived from domain SSOT)
 *  - `QuestionFormError`               (field-level error shape)
 *  - `initialQuestionPayload`          (ready-to-edit defaults per type)
 *  - `validateQuestionPayload`         (field-level validation per type)
 *  - per-type list mutation helpers    (`qf*`)
 */

import { QUESTION_TYPE_REGISTRY } from "@levelup/domain";

// ---------------------------------------------------------------------------
// Re-exported type + constant (derived from domain SSOT)
// ---------------------------------------------------------------------------

export type QuestionType = keyof typeof QUESTION_TYPE_REGISTRY;

export const QUESTION_TYPES: QuestionType[] = Object.keys(QUESTION_TYPE_REGISTRY) as QuestionType[];

// ---------------------------------------------------------------------------
// Error shape
// ---------------------------------------------------------------------------

export type QuestionFormError = { field: string; message: string };

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ---------------------------------------------------------------------------
// initialQuestionPayload
// ---------------------------------------------------------------------------

export function initialQuestionPayload(qt: QuestionType): Record<string, unknown> {
  switch (qt) {
    case "mcq":
      return {
        questionType: "mcq",
        options: [
          { id: uid(), text: "", isCorrect: true },
          { id: uid(), text: "" },
        ],
        shuffleOptions: false,
      };

    case "mcaq":
      return {
        questionType: "mcaq",
        options: [
          { id: uid(), text: "", isCorrect: true },
          { id: uid(), text: "", isCorrect: true },
          { id: uid(), text: "" },
        ],
        shuffleOptions: false,
      };

    case "true-false":
      return { questionType: "true-false" };

    case "numerical":
      return { questionType: "numerical", correctAnswer: 0 };

    case "text":
      return { questionType: "text" };

    case "paragraph":
      return { questionType: "paragraph" };

    case "code": {
      return {
        questionType: "code",
        language: "python",
        testCases: [{ input: "", output: "" }],
      };
    }

    case "fill-blanks": {
      const blankId = "b1";
      return {
        questionType: "fill-blanks",
        template: `Fill in the ___${blankId}___ here`,
        blanks: [{ id: blankId, correctAnswer: "" }],
      };
    }

    case "fill-blanks-dd": {
      const blankId = "b1";
      return {
        questionType: "fill-blanks-dd",
        template: `Fill in the ___${blankId}___ here`,
        blanks: [{ id: blankId, correctAnswer: "" }],
        optionPool: ["Option A", "Option B"],
      };
    }

    case "matching":
      return {
        questionType: "matching",
        pairs: [
          { left: "", right: "" },
          { left: "", right: "" },
        ],
        shufflePairs: false,
      };

    case "jumbled":
      return {
        questionType: "jumbled",
        tokens: ["", ""],
        correctOrder: [0, 1],
      };

    case "audio":
      return { questionType: "audio", maxDurationSeconds: 120 };

    case "image_evaluation":
      return { questionType: "image_evaluation" };

    case "group-options": {
      const itemId1 = uid();
      const itemId2 = uid();
      return {
        questionType: "group-options",
        groups: ["Group A", "Group B"],
        items: [
          { id: itemId1, text: "", group: "Group A" },
          { id: itemId2, text: "", group: "Group B" },
        ],
      };
    }

    case "chat_agent_question":
      return { questionType: "chat_agent_question" };
  }
}

// ---------------------------------------------------------------------------
// validateQuestionPayload
// ---------------------------------------------------------------------------

export function validateQuestionPayload(qt: QuestionType, payload: unknown): QuestionFormError[] {
  const errors: QuestionFormError[] = [];
  const p = (payload ?? {}) as Record<string, unknown>;

  switch (qt) {
    case "mcq":
    case "mcaq": {
      const options = Array.isArray(p.options) ? (p.options as Record<string, unknown>[]) : [];
      if (options.length < 2) {
        errors.push({ field: "options", message: "At least 2 options are required." });
      }
      const hasCorrect = options.some((o) => o.isCorrect === true);
      if (!hasCorrect) {
        errors.push({ field: "options", message: "At least 1 option must be marked correct." });
      }
      options.forEach((o, i) => {
        if (!o.text || (o.text as string).trim() === "") {
          errors.push({ field: `options[${i}].text`, message: "Option text must not be empty." });
        }
      });
      if (qt === "mcaq") {
        const min = p.minSelections as number | undefined;
        const max = p.maxSelections as number | undefined;
        if (min !== undefined && max !== undefined && min > max) {
          errors.push({
            field: "minSelections",
            message: "minSelections must be ≤ maxSelections.",
          });
        }
      }
      break;
    }

    case "true-false": {
      if (p.correctAnswer === undefined || p.correctAnswer === null) {
        errors.push({
          field: "correctAnswer",
          message: "correctAnswer must be set (true or false).",
        });
      }
      break;
    }

    case "numerical": {
      if (p.correctAnswer === undefined || p.correctAnswer === null) {
        errors.push({ field: "correctAnswer", message: "correctAnswer must not be undefined." });
      }
      break;
    }

    case "fill-blanks": {
      const blanks = Array.isArray(p.blanks) ? (p.blanks as Record<string, unknown>[]) : [];
      if (blanks.length < 1) {
        errors.push({ field: "blanks", message: "At least 1 blank is required." });
      }
      blanks.forEach((b, i) => {
        if (!b.correctAnswer || (b.correctAnswer as string).trim() === "") {
          errors.push({
            field: `blanks[${i}].correctAnswer`,
            message: "correctAnswer must not be empty.",
          });
        }
      });
      break;
    }

    case "fill-blanks-dd": {
      const blanks = Array.isArray(p.blanks) ? (p.blanks as Record<string, unknown>[]) : [];
      const pool = Array.isArray(p.optionPool) ? (p.optionPool as string[]) : [];
      if (blanks.length < 1) {
        errors.push({ field: "blanks", message: "At least 1 blank is required." });
      }
      if (pool.length < 1) {
        errors.push({ field: "optionPool", message: "optionPool must not be empty." });
      }
      blanks.forEach((b, i) => {
        if (!b.correctAnswer || (b.correctAnswer as string).trim() === "") {
          errors.push({
            field: `blanks[${i}].correctAnswer`,
            message: "correctAnswer must not be empty.",
          });
        }
      });
      break;
    }

    case "matching": {
      const pairs = Array.isArray(p.pairs) ? (p.pairs as Record<string, unknown>[]) : [];
      if (pairs.length < 1) {
        errors.push({ field: "pairs", message: "At least 1 pair is required." });
      }
      pairs.forEach((pair, i) => {
        if (!pair.left || (pair.left as string).trim() === "") {
          errors.push({ field: `pairs[${i}].left`, message: "Left side must not be empty." });
        }
        if (!pair.right || (pair.right as string).trim() === "") {
          errors.push({ field: `pairs[${i}].right`, message: "Right side must not be empty." });
        }
      });
      break;
    }

    case "jumbled": {
      const tokens = Array.isArray(p.tokens) ? (p.tokens as string[]) : [];
      if (tokens.length < 2) {
        errors.push({ field: "tokens", message: "At least 2 tokens are required." });
      }
      tokens.forEach((t, i) => {
        if (!t || t.trim() === "") {
          errors.push({ field: `tokens[${i}]`, message: "Token must not be empty." });
        }
      });
      break;
    }

    case "group-options": {
      const groups = Array.isArray(p.groups) ? (p.groups as string[]) : [];
      const items = Array.isArray(p.items) ? (p.items as Record<string, unknown>[]) : [];
      if (groups.length < 2) {
        errors.push({ field: "groups", message: "At least 2 groups are required." });
      }
      if (items.length < 2) {
        errors.push({ field: "items", message: "At least 2 items are required." });
      }
      items.forEach((item, i) => {
        if (!item.group || (item.group as string).trim() === "") {
          errors.push({
            field: `items[${i}].group`,
            message: "Every item must have a group assigned.",
          });
        }
      });
      break;
    }

    case "code": {
      const testCases = Array.isArray(p.testCases)
        ? (p.testCases as Record<string, unknown>[])
        : [];
      testCases.forEach((tc, i) => {
        if (!tc.output || (tc.output as string).trim() === "") {
          errors.push({
            field: `testCases[${i}].output`,
            message: "Test case output must not be empty.",
          });
        }
      });
      break;
    }

    case "image_evaluation": {
      const maxImages = p.maxImages as number | undefined;
      if (maxImages !== undefined && maxImages < 1) {
        errors.push({ field: "maxImages", message: "maxImages must be ≥ 1." });
      }
      break;
    }

    // AI-graded types with no required fields
    case "text":
    case "paragraph":
    case "audio":
    case "chat_agent_question":
      break;
  }

  return errors;
}

// ---------------------------------------------------------------------------
// MCQ / MCAQ option operations
// ---------------------------------------------------------------------------

export function qfAddOption(payload: Record<string, unknown>): Record<string, unknown> {
  const options = Array.isArray(payload.options)
    ? (payload.options as Record<string, unknown>[])
    : [];
  return {
    ...payload,
    options: [...options, { id: uid(), text: "" }],
  };
}

export function qfRemoveOption(
  payload: Record<string, unknown>,
  optionId: string
): Record<string, unknown> {
  const options = Array.isArray(payload.options)
    ? (payload.options as Record<string, unknown>[])
    : [];
  return {
    ...payload,
    options: options.filter((o) => o.id !== optionId),
  };
}

export function qfUpdateOption(
  payload: Record<string, unknown>,
  optionId: string,
  patch: { text?: string; isCorrect?: boolean; imageUrl?: string }
): Record<string, unknown> {
  const options = Array.isArray(payload.options)
    ? (payload.options as Record<string, unknown>[])
    : [];
  return {
    ...payload,
    options: options.map((o) => (o.id === optionId ? { ...o, ...patch } : o)),
  };
}

export function qfMoveOptionUp(
  payload: Record<string, unknown>,
  optionId: string
): Record<string, unknown> {
  const options = Array.isArray(payload.options)
    ? [...(payload.options as Record<string, unknown>[])]
    : [];
  const idx = options.findIndex((o) => o.id === optionId);
  if (idx <= 0) return payload;
  [options[idx - 1], options[idx]] = [options[idx], options[idx - 1]];
  return { ...payload, options };
}

export function qfMoveOptionDown(
  payload: Record<string, unknown>,
  optionId: string
): Record<string, unknown> {
  const options = Array.isArray(payload.options)
    ? [...(payload.options as Record<string, unknown>[])]
    : [];
  const idx = options.findIndex((o) => o.id === optionId);
  if (idx < 0 || idx >= options.length - 1) return payload;
  [options[idx], options[idx + 1]] = [options[idx + 1], options[idx]];
  return { ...payload, options };
}

// ---------------------------------------------------------------------------
// Fill-blanks operations
// ---------------------------------------------------------------------------

export function qfAddBlank(payload: Record<string, unknown>): Record<string, unknown> {
  const blanks = Array.isArray(payload.blanks) ? (payload.blanks as Record<string, unknown>[]) : [];
  const template = typeof payload.template === "string" ? payload.template : "";
  const id = uid();
  return {
    ...payload,
    template: template + ` ___${id}___`,
    blanks: [...blanks, { id, correctAnswer: "" }],
  };
}

export function qfRemoveBlank(
  payload: Record<string, unknown>,
  blankId: string
): Record<string, unknown> {
  const blanks = Array.isArray(payload.blanks) ? (payload.blanks as Record<string, unknown>[]) : [];
  const template = typeof payload.template === "string" ? payload.template : "";
  return {
    ...payload,
    template: template.replace(new RegExp(`\\s*___${blankId}___`, "g"), ""),
    blanks: blanks.filter((b) => b.id !== blankId),
  };
}

export function qfUpdateBlank(
  payload: Record<string, unknown>,
  blankId: string,
  patch: { correctAnswer?: string; acceptableAnswers?: string[] }
): Record<string, unknown> {
  const blanks = Array.isArray(payload.blanks) ? (payload.blanks as Record<string, unknown>[]) : [];
  return {
    ...payload,
    blanks: blanks.map((b) => (b.id === blankId ? { ...b, ...patch } : b)),
  };
}

// ---------------------------------------------------------------------------
// Fill-blanks-dd operations
// ---------------------------------------------------------------------------

export function qfAddBlankDd(payload: Record<string, unknown>): Record<string, unknown> {
  const blanks = Array.isArray(payload.blanks) ? (payload.blanks as Record<string, unknown>[]) : [];
  const template = typeof payload.template === "string" ? payload.template : "";
  const id = uid();
  return {
    ...payload,
    template: template + ` ___${id}___`,
    blanks: [...blanks, { id, correctAnswer: "" }],
  };
}

export function qfRemoveBlankDd(
  payload: Record<string, unknown>,
  blankId: string
): Record<string, unknown> {
  const blanks = Array.isArray(payload.blanks) ? (payload.blanks as Record<string, unknown>[]) : [];
  const template = typeof payload.template === "string" ? payload.template : "";
  return {
    ...payload,
    template: template.replace(new RegExp(`\\s*___${blankId}___`, "g"), ""),
    blanks: blanks.filter((b) => b.id !== blankId),
  };
}

export function qfAddPoolOption(
  payload: Record<string, unknown>,
  text: string
): Record<string, unknown> {
  const pool = Array.isArray(payload.optionPool) ? (payload.optionPool as string[]) : [];
  return { ...payload, optionPool: [...pool, text] };
}

export function qfRemovePoolOption(
  payload: Record<string, unknown>,
  index: number
): Record<string, unknown> {
  const pool = Array.isArray(payload.optionPool) ? (payload.optionPool as string[]) : [];
  return { ...payload, optionPool: pool.filter((_, i) => i !== index) };
}

export function qfUpdatePoolOption(
  payload: Record<string, unknown>,
  index: number,
  text: string
): Record<string, unknown> {
  const pool = Array.isArray(payload.optionPool) ? [...(payload.optionPool as string[])] : [];
  pool[index] = text;
  return { ...payload, optionPool: pool };
}

// ---------------------------------------------------------------------------
// Matching operations
// ---------------------------------------------------------------------------

export function qfAddPair(payload: Record<string, unknown>): Record<string, unknown> {
  const pairs = Array.isArray(payload.pairs) ? (payload.pairs as Record<string, unknown>[]) : [];
  return { ...payload, pairs: [...pairs, { left: "", right: "" }] };
}

export function qfRemovePair(
  payload: Record<string, unknown>,
  index: number
): Record<string, unknown> {
  const pairs = Array.isArray(payload.pairs) ? (payload.pairs as Record<string, unknown>[]) : [];
  return { ...payload, pairs: pairs.filter((_, i) => i !== index) };
}

export function qfUpdatePair(
  payload: Record<string, unknown>,
  index: number,
  patch: { left?: string; right?: string }
): Record<string, unknown> {
  const pairs = Array.isArray(payload.pairs)
    ? [...(payload.pairs as Record<string, unknown>[])]
    : [];
  pairs[index] = { ...pairs[index], ...patch };
  return { ...payload, pairs };
}

export function qfMovePairUp(
  payload: Record<string, unknown>,
  index: number
): Record<string, unknown> {
  if (index <= 0) return payload;
  const pairs = Array.isArray(payload.pairs)
    ? [...(payload.pairs as Record<string, unknown>[])]
    : [];
  [pairs[index - 1], pairs[index]] = [pairs[index], pairs[index - 1]];
  return { ...payload, pairs };
}

export function qfMovePairDown(
  payload: Record<string, unknown>,
  index: number
): Record<string, unknown> {
  const pairs = Array.isArray(payload.pairs)
    ? [...(payload.pairs as Record<string, unknown>[])]
    : [];
  if (index < 0 || index >= pairs.length - 1) return payload;
  [pairs[index], pairs[index + 1]] = [pairs[index + 1], pairs[index]];
  return { ...payload, pairs };
}

// ---------------------------------------------------------------------------
// Jumbled operations
// ---------------------------------------------------------------------------

export function qfAddToken(
  payload: Record<string, unknown>,
  text: string
): Record<string, unknown> {
  const tokens = Array.isArray(payload.tokens) ? (payload.tokens as string[]) : [];
  const correctOrder = Array.isArray(payload.correctOrder)
    ? (payload.correctOrder as number[])
    : tokens.map((_, i) => i);
  const newIndex = tokens.length;
  return {
    ...payload,
    tokens: [...tokens, text],
    correctOrder: [...correctOrder, newIndex],
  };
}

export function qfRemoveToken(
  payload: Record<string, unknown>,
  index: number
): Record<string, unknown> {
  const tokens = Array.isArray(payload.tokens) ? [...(payload.tokens as string[])] : [];
  const correctOrder = Array.isArray(payload.correctOrder)
    ? [...(payload.correctOrder as number[])]
    : tokens.map((_, i) => i);

  // Remove the token
  tokens.splice(index, 1);

  // Remove the entry for `index` from correctOrder and remap remaining indices
  const newOrder = correctOrder
    .filter((pos) => pos !== index)
    .map((pos) => (pos > index ? pos - 1 : pos));

  return { ...payload, tokens, correctOrder: newOrder };
}

export function qfUpdateToken(
  payload: Record<string, unknown>,
  index: number,
  text: string
): Record<string, unknown> {
  const tokens = Array.isArray(payload.tokens) ? [...(payload.tokens as string[])] : [];
  tokens[index] = text;
  return { ...payload, tokens };
}

export function qfMoveTokenUp(
  payload: Record<string, unknown>,
  index: number
): Record<string, unknown> {
  if (index <= 0) return payload;
  const tokens = Array.isArray(payload.tokens) ? [...(payload.tokens as string[])] : [];
  const correctOrder = Array.isArray(payload.correctOrder)
    ? [...(payload.correctOrder as number[])]
    : tokens.map((_, i) => i);

  // Swap adjacent tokens in display order
  [tokens[index - 1], tokens[index]] = [tokens[index], tokens[index - 1]];

  // Adjust correctOrder: wherever correctOrder references index-1 or index,
  // swap them so the semantic correct order is preserved
  const newOrder = correctOrder.map((pos) => {
    if (pos === index - 1) return index;
    if (pos === index) return index - 1;
    return pos;
  });

  return { ...payload, tokens, correctOrder: newOrder };
}

export function qfMoveTokenDown(
  payload: Record<string, unknown>,
  index: number
): Record<string, unknown> {
  const tokens = Array.isArray(payload.tokens) ? [...(payload.tokens as string[])] : [];
  if (index < 0 || index >= tokens.length - 1) return payload;
  const correctOrder = Array.isArray(payload.correctOrder)
    ? [...(payload.correctOrder as number[])]
    : tokens.map((_, i) => i);

  // Swap adjacent tokens in display order
  [tokens[index], tokens[index + 1]] = [tokens[index + 1], tokens[index]];

  // Adjust correctOrder to preserve semantic order
  const newOrder = correctOrder.map((pos) => {
    if (pos === index) return index + 1;
    if (pos === index + 1) return index;
    return pos;
  });

  return { ...payload, tokens, correctOrder: newOrder };
}

// ---------------------------------------------------------------------------
// Group-options operations
// ---------------------------------------------------------------------------

export function qfAddGroup(
  payload: Record<string, unknown>,
  name: string
): Record<string, unknown> {
  const groups = Array.isArray(payload.groups) ? (payload.groups as string[]) : [];
  return { ...payload, groups: [...groups, name] };
}

export function qfRemoveGroup(
  payload: Record<string, unknown>,
  name: string
): Record<string, unknown> {
  const groups = Array.isArray(payload.groups) ? (payload.groups as string[]) : [];
  const items = Array.isArray(payload.items) ? (payload.items as Record<string, unknown>[]) : [];
  return {
    ...payload,
    groups: groups.filter((g) => g !== name),
    // Unassign items that belonged to the removed group
    items: items.map((item) => (item.group === name ? { ...item, group: undefined } : item)),
  };
}

export function qfRenameGroup(
  payload: Record<string, unknown>,
  oldName: string,
  newName: string
): Record<string, unknown> {
  const groups = Array.isArray(payload.groups) ? (payload.groups as string[]) : [];
  const items = Array.isArray(payload.items) ? (payload.items as Record<string, unknown>[]) : [];
  return {
    ...payload,
    groups: groups.map((g) => (g === oldName ? newName : g)),
    items: items.map((item) => (item.group === oldName ? { ...item, group: newName } : item)),
  };
}

export function qfAddGroupItem(
  payload: Record<string, unknown>,
  text: string
): Record<string, unknown> {
  const items = Array.isArray(payload.items) ? (payload.items as Record<string, unknown>[]) : [];
  return {
    ...payload,
    items: [...items, { id: uid(), text, group: "" }],
  };
}

export function qfRemoveGroupItem(
  payload: Record<string, unknown>,
  id: string
): Record<string, unknown> {
  const items = Array.isArray(payload.items) ? (payload.items as Record<string, unknown>[]) : [];
  return { ...payload, items: items.filter((item) => item.id !== id) };
}

export function qfUpdateGroupItem(
  payload: Record<string, unknown>,
  id: string,
  patch: { text?: string; group?: string }
): Record<string, unknown> {
  const items = Array.isArray(payload.items) ? (payload.items as Record<string, unknown>[]) : [];
  return {
    ...payload,
    items: items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
  };
}

// ---------------------------------------------------------------------------
// Code test case operations
// ---------------------------------------------------------------------------

export function qfAddTestCase(payload: Record<string, unknown>): Record<string, unknown> {
  const testCases = Array.isArray(payload.testCases)
    ? (payload.testCases as Record<string, unknown>[])
    : [];
  return { ...payload, testCases: [...testCases, { input: "", output: "" }] };
}

export function qfRemoveTestCase(
  payload: Record<string, unknown>,
  index: number
): Record<string, unknown> {
  const testCases = Array.isArray(payload.testCases)
    ? (payload.testCases as Record<string, unknown>[])
    : [];
  return { ...payload, testCases: testCases.filter((_, i) => i !== index) };
}

export function qfUpdateTestCase(
  payload: Record<string, unknown>,
  index: number,
  patch: { input?: string; output?: string }
): Record<string, unknown> {
  const testCases = Array.isArray(payload.testCases)
    ? [...(payload.testCases as Record<string, unknown>[])]
    : [];
  testCases[index] = { ...testCases[index], ...patch };
  return { ...payload, testCases };
}
