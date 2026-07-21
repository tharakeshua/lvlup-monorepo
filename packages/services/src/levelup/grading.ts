/**
 * Server-authoritative deterministic grading helpers (testsession-progress.md).
 *
 * `autoEvaluateDeterministic` scores objective item types (mcq, multi-select,
 * true/false, fill-blank, numeric, matching) against the ⚷ answer key WITHOUT an
 * LLM. Subjective types (short/long answer, code) are flagged AI-pending. These
 * are pure functions over the (server-loaded) answer key + the learner answer —
 * the client NEVER sees the key and NEVER sends a score (CD13/§6.4/§6.5).
 */
import type { StoredEvaluation } from "@levelup/domain";

type Doc = Record<string, unknown>;

/** Objective types we can grade deterministically. */
export const DETERMINISTIC_TYPES = new Set([
  "mcq",
  "multiple_choice",
  "multi_select",
  "true_false",
  "fill_blank",
  "numeric",
  "matching",
  "ordering",
  // group-options: normalizeQuestionType maps "group-options" → "grouping" (practice.ts).
  "grouping",
]);

export interface DeterministicResult {
  /** A cost-free `StoredEvaluation` projection (no answer key, no cost). */
  evaluation: StoredEvaluation;
  /** True when the type needs an LLM pass (subjective). */
  aiPending: boolean;
}

function normalize(v: unknown): string {
  return String(v ?? "")
    .trim()
    .toLowerCase();
}

function arraysEqualAsSet(a: unknown[], b: unknown[]): boolean {
  if (a.length !== b.length) return false;
  const sa = new Set(a.map(normalize));
  return b.every((x) => sa.has(normalize(x)));
}

/**
 * Coerce a group-options assignment payload into a normalized `itemId → group`
 * map. Accepts the registry answer/learner shape (`{ assignments: [{itemId,
 * group}] }`), a bare assignments array, the prompt `items` array (whose per-item
 * `group` is the ⚷ correct group), or a plain `{ itemId: group }` record — so the
 * scorer matches BOTH how the answer key is stored (`correctAnswer`) and how the
 * learner submits, regardless of nesting. Returns `null` when nothing usable.
 */
function toAssignmentMap(v: unknown): Map<string, string> | null {
  const fromArray = (arr: unknown[]): Map<string, string> => {
    const map = new Map<string, string>();
    for (const e of arr) {
      if (e && typeof e === "object") {
        const rec = e as Doc;
        const id = rec["itemId"] ?? rec["id"];
        const group = rec["group"] ?? rec["groupId"];
        if (id != null && group != null) map.set(normalize(id), normalize(group));
      }
    }
    return map;
  };
  if (Array.isArray(v)) {
    const m = fromArray(v);
    return m.size ? m : null;
  }
  if (v && typeof v === "object") {
    const rec = v as Doc;
    if (Array.isArray(rec["assignments"])) {
      const m = fromArray(rec["assignments"] as unknown[]);
      return m.size ? m : null;
    }
    if (Array.isArray(rec["items"])) {
      const m = fromArray(rec["items"] as unknown[]);
      return m.size ? m : null;
    }
    // Plain { itemId: group } record.
    const m = new Map<string, string>();
    for (const [k, g] of Object.entries(rec)) {
      if (g != null && typeof g !== "object") m.set(normalize(k), normalize(g));
    }
    return m.size ? m : null;
  }
  return null;
}

/**
 * Deterministic group-options scoring: award partial credit for the fraction of
 * items assigned to their correct group (full credit iff EVERY item matches).
 * Correct assignments come from the ⚷ answer key (`correctAnswer`/`assignments`/
 * `items`); the learner submission is normalized the same way.
 */
function scoreGrouping(key: Doc, answer: unknown, maxScore: number): DeterministicResult {
  const correct =
    toAssignmentMap(key["correctAnswer"]) ??
    toAssignmentMap(key["assignments"]) ??
    toAssignmentMap(key["items"]);
  // Authoring-error escape: a key with NO usable item→group map cannot be graded
  // deterministically — escalate to the AI pass instead of silently zeroing the
  // learner. Deliberate asymmetry with the scalar-key types below: this structured
  // shape is the one key format where malformed legacy/seed data is plausible.
  if (!correct || correct.size === 0) {
    return {
      evaluation: {
        score: 0,
        maxScore,
        correctness: 0,
        percentage: 0,
        strengths: [],
        weaknesses: [],
        missingConcepts: [],
      },
      aiPending: true,
    };
  }
  const given = toAssignmentMap(answer);
  const total = correct.size;
  let hit = 0;
  if (given) {
    for (const [itemId, group] of correct) {
      if (given.get(itemId) === group) hit += 1;
    }
  }
  const ratio = total > 0 ? hit / total : 0;
  const score = ratio * maxScore;
  const isFull = total > 0 && hit === total;
  return {
    evaluation: {
      score,
      maxScore,
      correctness: ratio,
      percentage: maxScore > 0 ? (score / maxScore) * 100 : 0,
      strengths: isFull ? ["Correct answer"] : [],
      weaknesses: isFull ? [] : ["Incorrect answer"],
      missingConcepts: [],
    },
    aiPending: false,
  };
}

/**
 * Coerce a matching submission into a normalized `leftText → rightText` map.
 * Accepts the canonical learner shape (`{ matches: [{left, right}] }`), a bare
 * `[{left, right}]` array, or the client `{ leftText: rightText }` record.
 */
function toMatchMap(v: unknown): Map<string, string> {
  const map = new Map<string, string>();
  const fromArray = (arr: unknown[]): void => {
    for (const e of arr) {
      if (e && typeof e === "object") {
        const rec = e as Doc;
        if (rec["left"] != null && rec["right"] != null) {
          map.set(normalize(rec["left"]), normalize(rec["right"]));
        }
      }
    }
  };
  if (Array.isArray(v)) {
    fromArray(v);
    return map;
  }
  if (v && typeof v === "object") {
    const rec = v as Doc;
    if (Array.isArray(rec["matches"])) {
      fromArray(rec["matches"] as unknown[]);
      return map;
    }
    if (Array.isArray(rec["pairs"])) {
      fromArray(rec["pairs"] as unknown[]);
      return map;
    }
    // Plain { leftText: rightText } record (the web MatchingAnswerer shape).
    for (const [k, r] of Object.entries(rec)) {
      if (r != null && typeof r !== "object") map.set(normalize(k), normalize(r));
    }
  }
  return map;
}

/**
 * Deterministic matching scoring: partial credit for the fraction of left items
 * paired with their correct right value (full credit iff EVERY pair matches).
 * The correct left→right mapping comes from the ⚷ answer key `pairs`.
 */
function scoreMatching(key: Doc, answer: unknown, maxScore: number): DeterministicResult {
  const keyPairs = Array.isArray(key["pairs"]) ? (key["pairs"] as Doc[]) : [];
  const correct = new Map<string, string>();
  for (const p of keyPairs) {
    if (p && typeof p === "object" && p["left"] != null && p["right"] != null) {
      correct.set(normalize(p["left"]), normalize(p["right"]));
    }
  }
  // Malformed/legacy key with no usable mapping → escalate to the AI pass rather
  // than silently zeroing the learner (mirrors scoreGrouping).
  if (correct.size === 0) {
    return {
      evaluation: {
        score: 0,
        maxScore,
        correctness: 0,
        percentage: 0,
        strengths: [],
        weaknesses: [],
        missingConcepts: [],
      },
      aiPending: true,
    };
  }
  const given = toMatchMap(answer);
  const total = correct.size;
  let hit = 0;
  for (const [left, right] of correct) {
    if (given.get(left) === right) hit += 1;
  }
  const ratio = total > 0 ? hit / total : 0;
  const score = ratio * maxScore;
  const isFull = total > 0 && hit === total;
  return {
    evaluation: {
      score,
      maxScore,
      correctness: ratio,
      percentage: maxScore > 0 ? (score / maxScore) * 100 : 0,
      strengths: isFull ? ["Correct answer"] : [],
      weaknesses: isFull ? [] : ["Incorrect answer"],
      missingConcepts: [],
    },
    aiPending: false,
  };
}

/**
 * Score `answer` against the answer `key` for an item of `type`. For subjective
 * types returns `aiPending:true` with a zeroed placeholder the AI pass overwrites.
 */
export function autoEvaluateDeterministic(
  type: string,
  key: Doc | null,
  answer: unknown,
  maxScore = 1
): DeterministicResult {
  if (!DETERMINISTIC_TYPES.has(type) || !key) {
    return {
      evaluation: {
        score: 0,
        maxScore,
        correctness: 0,
        percentage: 0,
        strengths: [],
        weaknesses: [],
        missingConcepts: [],
      },
      aiPending: true,
    };
  }

  // group-options: item→group assignment scoring (partial credit) — NOT a
  // single-value/set match, so it needs its own branch before the generic logic.
  if (type === "grouping") {
    return scoreGrouping(key, answer, maxScore);
  }

  // matching: per-pair left→right mapping scoring (partial credit) — a structural
  // answer, not a scalar/set match, so it needs its own branch.
  if (type === "matching") {
    return scoreMatching(key, answer, maxScore);
  }

  const correctAnswer = key["correctAnswer"];
  const acceptable = (key["acceptableAnswers"] as unknown[] | undefined) ?? [];
  let correct = false;

  if (Array.isArray(answer) && Array.isArray(correctAnswer)) {
    correct = arraysEqualAsSet(answer, correctAnswer);
  } else if (type === "numeric") {
    const tol = (key["tolerance"] as number | undefined) ?? 0;
    correct = Math.abs(Number(answer) - Number(correctAnswer)) <= tol;
  } else {
    correct =
      normalize(answer) === normalize(correctAnswer) ||
      acceptable.some((a) => normalize(a) === normalize(answer));
  }

  const score = correct ? maxScore : 0;
  return {
    evaluation: {
      score,
      maxScore,
      correctness: correct ? 1 : 0,
      percentage: maxScore > 0 ? (score / maxScore) * 100 : 0,
      strengths: correct ? ["Correct answer"] : [],
      weaknesses: correct ? [] : ["Incorrect answer"],
      missingConcepts: [],
    },
    aiPending: false,
  };
}

/** Map a story-point type to the CANONICAL zTestSessionType it produces.
 *  'test'/'exam' story points are timed assessments → 'timed_test' (the old
 *  'test' output is not a valid zTestSessionType and fails the strict
 *  DigitalTestSessionView; stored legacy values are collapsed on read via
 *  zLegacyTestSessionTypeRead). */
export function storyPointTypeToSessionType(storyPointType: string): string {
  switch (storyPointType) {
    case "quiz":
      return "quiz";
    case "test":
    case "exam":
    case "timed_test":
      return "timed_test";
    default:
      return "practice";
  }
}
