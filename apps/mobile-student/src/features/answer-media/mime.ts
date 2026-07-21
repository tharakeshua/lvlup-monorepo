/**
 * MIME helpers — kept in lock-step with the server grader's `guessMediaMime`
 * (`packages/services/src/levelup/practice.ts`) so the content-type the client
 * signs the upload with matches what the AI gateway resolves the bytes as. If
 * these two tables drift, audio can be mis-tagged as `image/jpeg` and the
 * multimodal model will refuse it.
 */
import type { AnswerPartKind } from "../../components/ai-question/answer-bundle";

const AUDIO_EXT: Record<string, string> = {
  m4a: "audio/mp4",
  mp4: "audio/mp4",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  aac: "audio/aac",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  opus: "audio/ogg",
  flac: "audio/flac",
  webm: "audio/webm",
  caf: "audio/x-caf",
};

const IMAGE_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  gif: "image/gif",
};

/** Default content-type when the picker/recorder omits one, per kind. */
export const DEFAULT_MIME: Record<AnswerPartKind, string> = {
  image: "image/jpeg",
  audio: "audio/mp4", // expo-av HIGH_QUALITY → .m4a container
};

function extOf(uri: string): string {
  const clean = uri.split("?")[0].split("#")[0];
  const dot = clean.lastIndexOf(".");
  return dot >= 0 ? clean.slice(dot + 1).toLowerCase() : "";
}

/** Resolve a content-type from a local URI + kind (falls back per-kind). */
export function mimeForUri(uri: string, kind: AnswerPartKind): string {
  const ext = extOf(uri);
  return (kind === "audio" ? AUDIO_EXT[ext] : IMAGE_EXT[ext]) ?? DEFAULT_MIME[kind];
}

/** Classify a URI or content-type as audio vs image (image is the default). */
export function kindForUri(uri: string): AnswerPartKind {
  return AUDIO_EXT[extOf(uri)] ? "audio" : "image";
}

export function kindForMime(mimeType: string): AnswerPartKind {
  return mimeType.startsWith("audio/") ? "audio" : "image";
}
