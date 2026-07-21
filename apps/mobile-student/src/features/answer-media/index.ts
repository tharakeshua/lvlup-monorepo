/**
 * answer-media (W3) — multimodal answer capture for the audio + image_evaluation
 * AI question types. W1 consumes: `useAnswerParts()` for state + the capture
 * components for the composer; the AnswerPart model + wire conversion live in the
 * shared `components/ai-question/answer-bundle` seam (re-exported here for
 * convenience).
 */

// Hook (primary export)
export { useAnswerParts } from "./useAnswerParts";
export type {
  UseAnswerPartsOptions,
  UseAnswerPartsResult,
  AnswerPartsScope,
} from "./useAnswerParts";

// Audio record lifecycle (for a custom stage)
export { useAudioRecorder, MAX_RECORDING_MS } from "./useAudioRecorder";
export type { AudioRecorderState, RecordedClip } from "./useAudioRecorder";

// Upload seam
export { useAnswerMediaUpload } from "./upload";
export type { UploadScope, CapturedFile, UploadResult } from "./upload";

// Bundle helpers (delegate to the canonical seam)
export { toAnswerBundle, readyMediaUrls } from "./bundle";

// MIME helpers (client/server lock-step)
export { mimeForUri, kindForUri, kindForMime, DEFAULT_MIME } from "./mime";

// Capture + presentation components
export { RecordStage } from "./components/RecordStage";
export type { RecordStageProps } from "./components/RecordStage";
export { Waveform } from "./components/Waveform";
export type { WaveformProps } from "./components/Waveform";
export { AudioPartCard } from "./components/AudioPartCard";
export { ImagePartCard } from "./components/ImagePartCard";
export { AnswerPartStack } from "./components/AnswerPartStack";
export type { AnswerPartStackProps } from "./components/AnswerPartStack";
export { CaptureRow, CaptureButton } from "./components/CaptureRow";
export type { CaptureAction } from "./components/CaptureRow";
export { PermissionBanner } from "./components/PermissionBanner";
export type { PermissionBannerProps } from "./components/PermissionBanner";

// Re-export the canonical seam so W3 consumers have one import site.
export {
  readyParts,
  hasUploadingPart,
  hasFailedPart,
  bundleHasContent,
  toWireAnswer,
  readWireAnswer,
  emptyBundle,
} from "../../components/ai-question/answer-bundle";
export type {
  AnswerPart,
  AnswerBundle,
  AnswerPartKind,
  AnswerPartStatus,
} from "../../components/ai-question/answer-bundle";
