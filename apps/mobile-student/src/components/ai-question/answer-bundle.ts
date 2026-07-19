/**
 * ai-question/answer-bundle — the multimodal answer SEAM shared by W1 (render)
 * and W3 (capture/upload). A student's answer is one bundle: prose + attached
 * image / audio parts, sent to the LLM together.
 *
 * TWO shapes, on purpose:
 *  • AnswerBundle  — edit-time state: { text, parts: AnswerPart[] }. Parts carry
 *    upload status so the stack can show uploading / ready / error. W3's
 *    useAnswerParts() owns producing these; W1 renders them.
 *  • wire answer   — what recordItemAttempt receives. The mutation contract is
 *    `.strict()` with NO top-level media field; media rides INSIDE `answer` as
 *    { text, mediaUrls } (server unwraps it). Text-only answers keep emitting the
 *    bare string so the server's existing grading of them is unaffected.
 *
 * Only READY parts (uploaded, storagePath present) go on the wire — an answer is
 * never submitted mid-upload. This is the single canonical converter; capture
 * hooks and screens both import from here rather than redefining it.
 */

export type AnswerPartKind = "image" | "audio";
export type AnswerPartStatus = "uploading" | "ready" | "error";

/** One attached media part (coordinator-defined ANSWERPART seam). */
export interface AnswerPart {
  id: string;
  kind: AnswerPartKind;
  /** Server-scoped storage path (resolved at evaluation time). Present once ready. */
  storagePath: string;
  mimeType: string;
  name?: string;
  sizeBytes?: number;
  durationSec?: number;
  status: AnswerPartStatus;
  /** Local file URI for optimistic thumbnail / playback before/after upload. */
  localUri?: string;
}

/** Edit-time multimodal answer state. */
export interface AnswerBundle {
  text: string;
  parts: AnswerPart[];
}

export const emptyBundle: AnswerBundle = { text: "", parts: [] };

type Dict = Record<string, unknown>;

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/** Parts that are fully uploaded and safe to submit. */
export function readyParts(parts: AnswerPart[]): AnswerPart[] {
  return parts.filter((p) => p.status === "ready" && !!p.storagePath);
}

/** Any part still uploading — used to defer submit / show progress. */
export function hasUploadingPart(parts: AnswerPart[]): boolean {
  return parts.some((p) => p.status === "uploading");
}

/** Any part that failed to upload — surfaced for inline retry. */
export function hasFailedPart(parts: AnswerPart[]): boolean {
  return parts.some((p) => p.status === "error");
}

/**
 * Does the bundle have anything worth submitting? Text with non-whitespace OR at
 * least one ready media part. Drives the disabled-check / validation shake (A5).
 */
export function bundleHasContent(bundle: AnswerBundle): boolean {
  return bundle.text.trim().length > 0 || readyParts(bundle.parts).length > 0;
}

/**
 * Convert an edit-time bundle to the recordItemAttempt `answer` value. Bare
 * string when there is no ready media (legacy-compatible); { text, mediaUrls }
 * otherwise. W3's toAnswerBundle(text, parts) is an alias of this on the wire.
 */
export function toWireAnswer(bundle: AnswerBundle): unknown {
  const media = readyParts(bundle.parts).map((p) => p.storagePath);
  return media.length > 0 ? { text: bundle.text, mediaUrls: media } : bundle.text;
}

/**
 * Parse a stored / in-flight answer value back into a plain { text, mediaUrls }.
 * Tolerates the bare-string legacy shape and the { text, mediaUrls } object shape
 * (used for try-again pre-fill and the focus-mode / evaluating read-only view).
 */
export function readWireAnswer(value: unknown): { text: string; mediaUrls: string[] } {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const o = value as Dict;
    const mediaUrls = Array.isArray(o.mediaUrls)
      ? (o.mediaUrls as unknown[]).filter((x): x is string => typeof x === "string")
      : [];
    return { text: asString(o.text), mediaUrls };
  }
  return { text: asString(value), mediaUrls: [] };
}

/** Word count for the composer / word-target UI (Unicode-safe-ish, trims runs). */
export function wordCount(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/).length;
}
