/**
 * Answer-bundle assembly (W3 convenience over the canonical W1 seam).
 *
 * The single source of truth for the AnswerPart model + wire conversion is
 * `components/ai-question/answer-bundle.ts` (W1-owned). This module only offers
 * a `(text, parts)`-arg alias so capture code that holds text + parts separately
 * doesn't have to build the `{ text, parts }` object itself — it delegates to
 * `toWireAnswer` so strict-parse behaviour stays identical.
 */
import {
  readyParts,
  toWireAnswer,
  type AnswerPart,
} from "../../components/ai-question/answer-bundle";

/** Ready storage paths, in stack order (thin re-export for capture callers). */
export function readyMediaUrls(parts: AnswerPart[]): string[] {
  return readyParts(parts).map((p) => p.storagePath);
}

/**
 * Serialize composer state → `recordItemAttempt`/`evaluateAnswer` `answer` value.
 * Alias of `toWireAnswer({ text, parts })`: bare string for text-only answers
 * (legacy path), `{ text, mediaUrls }` once any ready media is attached.
 */
export function toAnswerBundle(text: string, parts: AnswerPart[]): unknown {
  return toWireAnswer({ text: text ?? "", parts });
}
