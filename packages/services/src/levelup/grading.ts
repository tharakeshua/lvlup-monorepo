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

/** Map a story-point type to the session type it produces (shared helper). */
export function storyPointTypeToSessionType(storyPointType: string): string {
  switch (storyPointType) {
    case "quiz":
      return "quiz";
    case "test":
    case "exam":
      return "test";
    case "practice":
      return "practice";
    default:
      return "practice";
  }
}
