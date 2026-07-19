import AsyncStorage from "@react-native-async-storage/async-storage";

import type {
  ConversationContext,
  ConversationMode,
  ConversationTurnInput,
  QuestionHelpDraftSnapshot,
} from "./types";

const SCHEMA_VERSION = 1;
const STORAGE_PREFIX = "@levelup/mobile/conversation-resume";

/** Safe local state only; the server remains the transcript/result authority. */
export interface LocalConversationResumeState {
  schemaVersion: 1;
  sessionId?: string;
  mode: ConversationMode;
  contextKey: string;
  draft?: string;
  pendingClientMessageId?: string;
  /** Required to replay the exact accepted-or-failed turn after process death. */
  pendingInput?: ConversationTurnInput;
  pendingInputHash?: string;
  updatedAt: string;
}

function stableContextHint(context: ConversationContext): string {
  switch (context.kind) {
    case "tutor":
      return context.scope === "space"
        ? `tutor-space-${context.spaceId}`
        : context.scope === "story_point"
          ? `tutor-story-${context.spaceId}-${context.storyPointId}`
          : `tutor-item-${context.spaceId}-${context.storyPointId}-${context.itemId}`;
    case "question_help":
      return `help-${context.spaceId}-${context.storyPointId}-${context.itemId}-${context.attemptId ?? "none"}`;
    case "agent_assessment":
      return `assessment-${context.spaceId}-${context.storyPointId}-${context.itemId}`;
  }
}

function storageKey(mode: ConversationMode, context: ConversationContext): string {
  return `${STORAGE_PREFIX}/${mode}/${stableContextHint(context)}`;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isJsonValue(value: unknown): value is QuestionHelpDraftSnapshot["answer"] {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (!value || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  return Object.values(value as Record<string, unknown>).every(isJsonValue);
}

function parsePendingInput(value: unknown): ConversationTurnInput | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  if (!isString(raw.text)) return undefined;
  const media = Array.isArray(raw.media)
    ? raw.media.flatMap((entry) => {
        if (!entry || typeof entry !== "object") return [];
        const item = entry as Record<string, unknown>;
        if (item.mediaKind !== "image" || !isString(item.storagePath) || !isString(item.mimeType)) {
          return [];
        }
        return [
          {
            mediaKind: "image" as const,
            storagePath: item.storagePath,
            mimeType: item.mimeType,
            ...(isString(item.altText) ? { altText: item.altText } : {}),
          },
        ];
      })
    : undefined;
  if (Array.isArray(raw.media) && media?.length !== raw.media.length) return undefined;

  let questionHelpDraft: ConversationTurnInput["questionHelpDraft"];
  if (raw.questionHelpDraft !== undefined) {
    if (!raw.questionHelpDraft || typeof raw.questionHelpDraft !== "object") return undefined;
    const draft = raw.questionHelpDraft as Record<string, unknown>;
    if (!Number.isInteger(draft.revision) || !isJsonValue(draft.answer)) return undefined;
    questionHelpDraft = { revision: draft.revision as number, answer: draft.answer };
  }

  return {
    text: raw.text,
    ...(Array.isArray(raw.media) ? { media: media ?? [] } : {}),
    ...(questionHelpDraft ? { questionHelpDraft } : {}),
  };
}

/** Parse only the documented whitelisted fields and reject malformed records. */
function parseResumeState(
  value: string,
  mode: ConversationMode
): LocalConversationResumeState | undefined {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object") return undefined;
    const raw = parsed as Record<string, unknown>;
    if (raw.schemaVersion !== SCHEMA_VERSION || raw.mode !== mode || !isString(raw.contextKey))
      return undefined;
    if (!isString(raw.updatedAt)) return undefined;

    const pendingInput = parsePendingInput(raw.pendingInput);
    return {
      schemaVersion: SCHEMA_VERSION,
      mode,
      contextKey: raw.contextKey,
      ...(isString(raw.sessionId) ? { sessionId: raw.sessionId } : {}),
      ...(isString(raw.draft) ? { draft: raw.draft } : {}),
      ...(isString(raw.pendingClientMessageId)
        ? { pendingClientMessageId: raw.pendingClientMessageId }
        : {}),
      ...(pendingInput ? { pendingInput } : {}),
      ...(isString(raw.pendingInputHash) ? { pendingInputHash: raw.pendingInputHash } : {}),
      updatedAt: raw.updatedAt,
    };
  } catch {
    return undefined;
  }
}

export async function loadConversationResumeState(
  mode: ConversationMode,
  context: ConversationContext
): Promise<LocalConversationResumeState | undefined> {
  const key = storageKey(mode, context);
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return undefined;
  const state = parseResumeState(raw, mode);
  if (state) return state;
  await AsyncStorage.removeItem(key);
  return undefined;
}

export async function saveConversationResumeState(
  context: ConversationContext,
  state: LocalConversationResumeState
): Promise<void> {
  // Construct a new object intentionally; do not let accidental private fields
  // leak into persisted JSON if this call site grows later.
  const safe: LocalConversationResumeState = {
    schemaVersion: SCHEMA_VERSION,
    mode: state.mode,
    contextKey: state.contextKey,
    ...(state.sessionId ? { sessionId: state.sessionId } : {}),
    ...(state.draft ? { draft: state.draft } : {}),
    ...(state.pendingClientMessageId
      ? { pendingClientMessageId: state.pendingClientMessageId }
      : {}),
    ...(state.pendingInput ? { pendingInput: state.pendingInput } : {}),
    ...(state.pendingInputHash ? { pendingInputHash: state.pendingInputHash } : {}),
    updatedAt: state.updatedAt,
  };
  await AsyncStorage.setItem(storageKey(state.mode, context), JSON.stringify(safe));
}

export async function clearConversationResumeState(
  mode: ConversationMode,
  context: ConversationContext
): Promise<void> {
  await AsyncStorage.removeItem(storageKey(mode, context));
}
