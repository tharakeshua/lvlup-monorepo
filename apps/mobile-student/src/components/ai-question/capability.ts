/**
 * ai-question/capability — the per-type capability matrix driving the unified
 * composer. "One unified multimodal answer UI, not six bolted-on widgets": each
 * AI question type just enables/disables capabilities on the same composer
 * (docs/design/ai-questions/00 §2, capability-variants.card.html).
 *
 * Source of truth is the type DEFAULT matrix here, overridable per-question by an
 * authoring config on the payload (owner decision: per-question toggles). Until
 * the authoring UI ships, `capabilityFor` reads an optional `data.capabilities`
 * override and otherwise returns the type default (Layer-1 note 5).
 */

export type ComposerVariant = "write" | "code" | "audio" | "image";
export type PrimaryCapability = "write" | "record" | "camera";

export interface CapabilityConfig {
  /** which dominant composer body renders. */
  variant: ComposerVariant;
  /** the prose writing area is present (may be an opt-in "Add a note" for audio/image). */
  write: boolean;
  /** the writing area is opt-in (hidden behind an "Add a note" pill) rather than primary. */
  writeOptional: boolean;
  /** monospace dark-ink code surface + code ergonomics (no autocorrect/caps). */
  code: boolean;
  /** audio record capability (rec-stage hero for `audio`). */
  record: boolean;
  /** photo-library attach. */
  photo: boolean;
  /** camera capture. */
  camera: boolean;
  /** opens straight into full-screen focus mode (paragraph, owner-locked). */
  focusDefault: boolean;
  /** the hero capability that dominates the layout. */
  primary: PrimaryCapability;
  /** primary-action label. */
  submitLabel: string;
  /** is this a type the unified AI composer owns (vs the generic QuestionView)? */
  aiComposer: true;
}

/** The 5 AI-composer types this kit owns. chat_agent_question is delegated. */
export const AI_COMPOSER_TYPES = [
  "text",
  "paragraph",
  "code",
  "audio",
  "image_evaluation",
] as const;

export type AiComposerType = (typeof AI_COMPOSER_TYPES)[number];

export function isAiComposerType(qType?: string): qType is AiComposerType {
  return !!qType && (AI_COMPOSER_TYPES as readonly string[]).includes(qType);
}

const CHECK = "Check answer";
const SUBMIT = "Submit for evaluation";

/** Type-default capability matrix (00 §2 + capability-variants card). */
const DEFAULTS: Record<AiComposerType, CapabilityConfig> = {
  text: {
    variant: "write",
    write: true,
    writeOptional: false,
    code: false,
    record: true,
    photo: true,
    camera: true,
    focusDefault: false,
    primary: "write",
    submitLabel: CHECK,
    aiComposer: true,
  },
  paragraph: {
    variant: "write",
    write: true,
    writeOptional: false,
    code: false,
    record: true,
    photo: true,
    camera: true,
    focusDefault: true,
    primary: "write",
    submitLabel: CHECK,
    aiComposer: true,
  },
  code: {
    variant: "code",
    write: true,
    writeOptional: false,
    code: true,
    record: false,
    photo: false,
    camera: true, // photograph a diagram
    focusDefault: false,
    primary: "write",
    submitLabel: SUBMIT,
    aiComposer: true,
  },
  audio: {
    variant: "audio",
    write: true,
    writeOptional: true, // "Add a note"
    code: false,
    record: true,
    photo: false,
    camera: false,
    focusDefault: false,
    primary: "record",
    submitLabel: SUBMIT,
    aiComposer: true,
  },
  image_evaluation: {
    variant: "image",
    write: true,
    writeOptional: true, // "Add a note"
    code: false,
    record: false,
    photo: true,
    camera: true,
    focusDefault: false,
    primary: "camera",
    submitLabel: SUBMIT,
    aiComposer: true,
  },
};

type Dict = Record<string, unknown>;

/**
 * Resolve the capability config for a question. `qType` picks the default; an
 * optional `data.capabilities` object on the question payload overrides
 * individual booleans (per-question authoring toggles). Returns null for
 * non-AI-composer types (the caller falls back to the generic QuestionView).
 */
export function capabilityFor(qType?: string, data?: Dict): CapabilityConfig | null {
  if (!isAiComposerType(qType)) return null;
  const base = DEFAULTS[qType];
  const override =
    data && typeof data.capabilities === "object" ? (data.capabilities as Dict) : null;
  if (!override) return base;
  const b = (k: keyof CapabilityConfig, cur: boolean) =>
    typeof override[k] === "boolean" ? (override[k] as boolean) : cur;
  return {
    ...base,
    write: b("write", base.write),
    record: b("record", base.record),
    photo: b("photo", base.photo),
    camera: b("camera", base.camera),
  };
}
