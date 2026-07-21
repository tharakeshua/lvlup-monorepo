/**
 * ai-question/ai-answer-surface — Surface A, the unified multimodal answering
 * region for the 5 AI-composer types (text · paragraph · code · audio ·
 * image_evaluation). One skeleton; only the capability pills + composer body
 * change per type (capability.ts). Renders the prompt (collapses on write), the
 * HYE card, the composer body, the parts stack, banners, capability pills, focus
 * mode, and the shake-on-blocked submit dock.
 *
 * Media capture/upload is owned by W3's `useAnswerParts` (features/answer-media);
 * this surface renders the resulting AnswerPart[] and wires submit via
 * `toWireAnswer`. The host screen owns the submit mutation, the evaluating state,
 * and feedback. MUST be mounted with `key={itemId}` so per-item capture state
 * stays isolated across navigation.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { Icon } from "../Icon";
import { Button } from "../primitives";
import { colors } from "../../theme";
import { useAnswerParts } from "../../features/answer-media";
import { bundleHasContent, readWireAnswer, toWireAnswer, type AnswerPart } from "./answer-bundle";
import type { CapabilityConfig } from "./capability";
import { CapabilityPills } from "./capability-pills";
import { WriteArea, CodeArea, type WordTarget } from "./composer";
import { FocusComposer } from "./focus-mode";
import { HowYoullBeEvaluated, type HyeModel } from "./hye-card";
import { PartsStack } from "./parts-stack";
import { QuestionPrompt, CollapsedPrompt, splitPromptImages } from "./prompt";
import { RecordStage } from "./record-stage";
import {
  DraftRestoredBanner,
  PermissionBanner,
  ValidationBanner,
  Shakeable,
  useShake,
} from "./banners";

type Dict = Record<string, unknown>;
const asStr = (v: unknown): string | undefined => (typeof v === "string" && v ? v : undefined);
const asNum = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;

const AUDIO_EXT = /\.(m4a|caf|wav|mp3|aac|ogg)(\?|$)/i;

/** Rehydrate ready AnswerParts from a wire answer's storagePaths (try-again / revisit). */
function partsFromMediaUrls(mediaUrls: string[]): AnswerPart[] {
  return mediaUrls.map((path, i) => ({
    id: `seed-${i}`,
    kind: AUDIO_EXT.test(path) ? "audio" : "image",
    storagePath: path,
    mimeType: "",
    status: "ready" as const,
  }));
}

export interface AiAnswerSurfaceProps {
  qType: string;
  config: CapabilityConfig;
  prompt: string;
  data: Dict;
  eyebrow?: string;
  difficulty?: string | null;
  hyeModel?: HyeModel | null;
  /** wire answer (bare string | { text, mediaUrls }). */
  value: unknown;
  onChange: (wire: unknown) => void;
  /** answer-media upload scope — BOTH required by the path grammar. */
  spaceId?: string;
  scopeId?: string;
  disabled?: boolean;
  submitting?: boolean;
  onSubmit: () => void;
  onDiscuss?: () => void;
  draftRestored?: boolean;
  onStartFresh?: () => void;
}

export function AiAnswerSurface(props: AiAnswerSurfaceProps) {
  const {
    qType,
    config,
    prompt,
    data,
    eyebrow,
    difficulty,
    hyeModel,
    value,
    onChange,
    spaceId,
    scopeId,
    disabled,
    submitting,
    onSubmit,
    onDiscuss,
    draftRestored,
    onStartFresh,
  } = props;

  const wire = readWireAnswer(value);
  const text = wire.text;
  const textRef = useRef(text);
  textRef.current = text;

  // mount-only seed (component is keyed by itemId at the call site).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initialParts = useMemo(() => partsFromMediaUrls(readWireAnswer(value).mediaUrls), []);

  const media = useAnswerParts({
    scope: { spaceId, itemId: scopeId },
    initialParts,
    onChange: (parts) => onChange(toWireAnswer({ text: textRef.current, parts })),
    disabled,
  });

  const [peek, setPeek] = useState(false);
  const [noteActive, setNoteActive] = useState(false);
  const [focusOpen, setFocusOpen] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const { style: shakeStyle, shake } = useShake();
  const openedFocusOnce = useRef(false);

  const { text: promptText, images: promptImages } = splitPromptImages(prompt);
  const referenceImages = Array.isArray(data.referenceImageUrls)
    ? (data.referenceImageUrls as unknown[]).filter((x): x is string => typeof x === "string")
    : [];
  const promptAudioUrl = asStr(data.promptAudioUrl);
  const language = asStr(data.language);
  const wordTarget: WordTarget | undefined =
    qType === "paragraph" ? { min: asNum(data.minWords), max: asNum(data.maxWords) } : undefined;

  // seed the code editor with starterCode once, if the answer is still empty.
  useEffect(() => {
    if (qType === "code" && value == null) {
      const starter = asStr(data.starterCode);
      if (starter) onChange(starter);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // paragraph opens straight into full-screen focus (owner decision), once.
  useEffect(() => {
    if (config.focusDefault && !openedFocusOnce.current && !disabled) {
      openedFocusOnce.current = true;
      setFocusOpen(true);
    }
  }, [config.focusDefault, disabled]);

  const setText = (t: string) => {
    if (showValidation) setShowValidation(false);
    onChange(toWireAnswer({ text: t, parts: media.parts }));
  };

  const isWriting = text.trim().length > 0 || media.parts.length > 0;
  const canSubmit = bundleHasContent({ text, parts: media.parts }) && !media.uploading;

  const handleSubmit = () => {
    if (!canSubmit) {
      setShowValidation(true);
      shake();
      return;
    }
    setShowValidation(false);
    onSubmit();
  };

  const activateNote = () => setNoteActive(true);
  const elapsedSec = Math.floor(media.recorder.durationMs / 1000);
  const permMessage = media.micDenied
    ? "Microphone is off for Lyceum."
    : media.cameraDenied
      ? "Camera / photo access is off for Lyceum."
      : null;

  return (
    <View className="gap-4">
      {draftRestored ? <DraftRestoredBanner onStartFresh={onStartFresh} /> : null}

      {/* prompt — full when idle, collapsed once writing (tap to peek) */}
      {isWriting && !peek ? (
        <CollapsedPrompt text={promptText} onExpand={() => setPeek(true)} />
      ) : (
        <View className="gap-3">
          <QuestionPrompt
            eyebrow={eyebrow}
            prompt={promptText}
            difficulty={difficulty}
            promptImages={promptImages}
            referenceImages={referenceImages}
            promptAudioUrl={promptAudioUrl}
          />
          {onDiscuss ? (
            <Pressable
              onPress={onDiscuss}
              accessibilityRole="button"
              className="flex-row items-center gap-1.5 self-start"
            >
              <Icon name="message-circle" size={15} color={colors.brand} />
              <Text className="text-brand text-xs font-semibold">Discuss this question</Text>
            </Pressable>
          ) : null}
        </View>
      )}

      {/* HYE — visible while idle only (A2 hides it on write) */}
      {hyeModel && !isWriting ? <HowYoullBeEvaluated model={hyeModel} /> : null}

      {/* composer body by variant */}
      {config.variant === "audio" ? (
        <>
          <RecordStage
            recording={media.recorder.isRecording}
            elapsedSec={elapsedSec}
            onStart={() => void media.recorder.start()}
            onStop={() => void media.stopRecordingAndAttach()}
            disabled={disabled}
            hint="Tap to record — speak your answer"
          />
          {noteActive ? (
            <WriteArea
              value={text}
              onChangeText={setText}
              disabled={disabled}
              placeholder="Add a note (optional)…"
              minHeight={80}
            />
          ) : null}
        </>
      ) : config.variant === "image" ? (
        noteActive ? (
          <WriteArea
            value={text}
            onChangeText={setText}
            disabled={disabled}
            placeholder="Add a note (optional)…"
            minHeight={80}
          />
        ) : null
      ) : config.variant === "code" ? (
        <CodeArea
          value={text}
          onChangeText={setText}
          disabled={disabled}
          language={language}
          onExpand={() => setFocusOpen(true)}
        />
      ) : (
        <WriteArea
          value={text}
          onChangeText={setText}
          disabled={disabled}
          target={wordTarget}
          onFocus={() => setPeek(false)}
        />
      )}

      {/* parts stack */}
      <PartsStack parts={media.parts} onRemove={media.remove} onRetry={media.retry} />

      {/* permission-denied banner */}
      {permMessage ? (
        <PermissionBanner
          message={permMessage}
          icon={media.micDenied ? "mic-off" : "camera-off"}
          onOpenSettings={media.clearError}
        />
      ) : null}

      {/* validation warn */}
      {showValidation ? <ValidationBanner /> : null}

      {/* capability pills */}
      {!disabled ? (
        <CapabilityPills
          config={config}
          onRecord={() => void media.recorder.start()}
          onCamera={() => void media.addFromCamera()}
          onPhoto={() => void media.addPhoto()}
          onAddNote={activateNote}
          onFocus={config.variant === "write" ? () => setFocusOpen(true) : undefined}
          showNote={config.writeOptional}
          noteActive={noteActive}
          disabled={disabled}
        />
      ) : null}

      {/* submit dock — shakes on a blocked tap */}
      {!disabled ? (
        <Shakeable shakeStyle={shakeStyle}>
          <Button variant="primary" block loading={submitting} onPress={handleSubmit}>
            {config.submitLabel}
          </Button>
        </Shakeable>
      ) : null}

      {/* focus mode (Surface B) */}
      <FocusComposer
        visible={focusOpen}
        onClose={() => setFocusOpen(false)}
        config={config}
        promptLine={promptText}
        text={text}
        onChangeText={setText}
        language={language}
        wordTarget={wordTarget}
        submitLabel={config.submitLabel}
        submitting={submitting}
        canSubmit={canSubmit}
        onSubmit={() => {
          if (canSubmit) {
            setFocusOpen(false);
            onSubmit();
          }
        }}
        onRecord={() => void media.recorder.start()}
        onCamera={() => void media.addFromCamera()}
      />
    </View>
  );
}
