import { useState, useCallback } from "react";
import type {
  UnifiedItem,
  QuestionPayload,
  MCQData,
  MCAQData,
  TrueFalseData,
  NumericalData,
  TextData,
  ParagraphData,
  CodeData,
  FillBlanksData,
  FillBlanksDDData,
  MatchingData,
  JumbledData,
  AudioData,
  ImageEvaluationData,
  GroupOptionsData,
  ChatAgentQuestionData,
  UnifiedEvaluationResult,
  ItemAttachment,
} from "@levelup/shared-types";
import MCQAnswerer from "./MCQAnswerer";
import MCAQAnswerer from "./MCAQAnswerer";
import TrueFalseAnswerer from "./TrueFalseAnswerer";
import NumericalAnswerer from "./NumericalAnswerer";
import TextAnswerer from "./TextAnswerer";
import ParagraphAnswerer from "./ParagraphAnswerer";
import CodeAnswerer from "./CodeAnswerer";
import FillBlanksAnswerer from "./FillBlanksAnswerer";
import FillBlanksDDAnswerer from "./FillBlanksDDAnswerer";
import MatchingAnswerer from "./MatchingAnswerer";
import JumbledAnswerer from "./JumbledAnswerer";
import AudioAnswerer from "./AudioAnswerer";
import ImageEvaluationAnswerer from "./ImageEvaluationAnswerer";
import GroupOptionsAnswerer from "./GroupOptionsAnswerer";
import ChatAgentAnswerer from "./ChatAgentAnswerer";
import FeedbackPanel from "../common/FeedbackPanel";
import ImageLightbox, { type LightboxImage } from "../common/ImageLightbox";
import { useSendChatMessage } from "../../hooks/useChatTutor";
import { useAuthStore } from "@levelup/shared-stores";
import { MessageCircle, History } from "lucide-react";
import { DifficultyChip } from "../common/lyceum";

interface QuestionAnswererProps {
  item: UnifiedItem;
  onSubmit: (answer: unknown) => void;
  onOpenChat?: () => void;
  evaluation?: UnifiedEvaluationResult | null;
  previousEvaluation?: UnifiedEvaluationResult | null;
  disabled?: boolean;
  showCorrect?: boolean;
  mode?: "test" | "practice" | "quiz";
  savedAnswer?: unknown;
}

export default function QuestionAnswerer({
  item,
  onSubmit,
  onOpenChat,
  evaluation,
  previousEvaluation,
  disabled,
  showCorrect,
  mode = "practice",
  savedAnswer,
}: QuestionAnswererProps) {
  const payload = item.payload as QuestionPayload;
  // Canonical UnifiedItem reads deliver the question text at TOP-LEVEL
  // `item.content`/`item.title` (LVL-1 projection); legacy payloads carried it
  // on the payload itself. Tolerate both so the question is never blank.
  const itemLike = item as unknown as { title?: string; content?: string };
  const questionTitle = itemLike.title ?? payload.title;
  const questionText = itemLike.content ?? payload.content;
  const [answer, setAnswer] = useState<unknown>(savedAnswer ?? undefined);
  const [submitted, setSubmitted] = useState(!!evaluation);
  const [showPrevious, setShowPrevious] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const sendChatMessage = useSendChatMessage();

  // Extract markdown-embedded images (`![alt](url)`) from the question text —
  // the deployed backend strips top-level `attachments` for questions, so the
  // subhang data migration re-injects diagram URLs as markdown at the end of
  // `content` (marker: `<!-- imgs:auto -->`). We split them out here so they
  // render in the image grid, not as raw markdown in the prose.
  const rawText: string = typeof questionText === "string" ? questionText : "";
  const IMG_MD_RE = /!\[([^\]]*)\]\(([^)\s]+)\)/g;
  const embeddedImages: LightboxImage[] = [];
  for (const m of rawText.matchAll(IMG_MD_RE)) {
    embeddedImages.push({ url: m[2], alt: m[1] || "diagram" });
  }
  const cleanText = rawText
    .replace(/<!--\s*imgs:auto\s*-->/g, "")
    .replace(IMG_MD_RE, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const imageAttachments: LightboxImage[] = [
    ...(item.attachments ?? [])
      .filter((a: ItemAttachment) => a.type === "image")
      .map((a: ItemAttachment) => ({ url: a.url, alt: a.fileName })),
    ...embeddedImages,
  ];
  const { currentTenantId } = useAuthStore();

  // Handler for ChatAgentAnswerer AI replies
  const handleChatAgentSend = useCallback(
    async (message: string): Promise<string> => {
      if (!currentTenantId) {
        return "Chat is unavailable without an active school session. Try signing in with a school code.";
      }
      const result = await sendChatMessage.mutateAsync({
        tenantId: currentTenantId,
        spaceId: item.spaceId ?? "",
        storyPointId: item.storyPointId ?? "",
        itemId: item.id,
        message,
      });
      return result.reply;
    },
    [currentTenantId, item.id, item.spaceId, item.storyPointId, sendChatMessage]
  );

  const handleSubmit = () => {
    if (answer == null) return;
    setSubmitted(true);
    onSubmit(answer);
  };

  const handleRetry = () => {
    setSubmitted(false);
    setAnswer(undefined);
  };

  const isDisabled = disabled || (submitted && mode !== "test");
  const questionData = payload.questionData as Record<string, unknown> | undefined;
  const questionType = (payload.questionType ?? questionData?.questionType) as string | undefined;

  // Runtime type guard helpers to prevent crashes from corrupted answer state
  const asString = (v: unknown): string => (typeof v === "string" ? v : "");
  const asStringArray = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  const asRecord = (v: unknown): Record<string, string> =>
    v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, string>) : {};
  const asRecordArrays = (v: unknown): Record<string, string[]> =>
    v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, string[]>) : {};

  const renderInput = () => {
    switch (questionType) {
      case "mcq":
        return (
          <MCQAnswerer
            data={payload.questionData as MCQData}
            value={asString(answer)}
            onChange={setAnswer}
            disabled={isDisabled}
            showCorrect={showCorrect && submitted}
          />
        );
      case "mcaq":
        return (
          <MCAQAnswerer
            data={payload.questionData as MCAQData}
            value={asStringArray(answer)}
            onChange={setAnswer}
            disabled={isDisabled}
            showCorrect={showCorrect && submitted}
          />
        );
      case "true-false":
        return (
          <TrueFalseAnswerer
            value={typeof answer === "boolean" ? answer : undefined}
            onChange={setAnswer}
            disabled={isDisabled}
            showCorrect={showCorrect && submitted}
            correctAnswer={(payload.questionData as TrueFalseData).correctAnswer}
          />
        );
      case "numerical":
        return (
          <NumericalAnswerer
            data={payload.questionData as NumericalData}
            value={asString(answer)}
            onChange={setAnswer}
            disabled={isDisabled}
          />
        );
      case "text":
        return (
          <TextAnswerer
            data={payload.questionData as TextData}
            value={asString(answer)}
            onChange={setAnswer}
            disabled={isDisabled}
          />
        );
      case "paragraph":
        return (
          <ParagraphAnswerer
            data={payload.questionData as ParagraphData}
            value={asString(answer)}
            onChange={setAnswer}
            disabled={isDisabled}
          />
        );
      case "code":
        return (
          <CodeAnswerer
            data={payload.questionData as CodeData}
            value={asString(answer)}
            onChange={setAnswer}
            disabled={isDisabled}
          />
        );
      case "fill-blanks":
        return (
          <FillBlanksAnswerer
            data={payload.questionData as FillBlanksData}
            value={asRecord(answer)}
            onChange={setAnswer}
            disabled={isDisabled}
          />
        );
      case "fill-blanks-dd":
        return (
          <FillBlanksDDAnswerer
            data={payload.questionData as FillBlanksDDData}
            value={asRecord(answer)}
            onChange={setAnswer}
            disabled={isDisabled}
          />
        );
      case "matching":
        return (
          <MatchingAnswerer
            data={payload.questionData as MatchingData}
            value={asRecord(answer)}
            onChange={setAnswer}
            disabled={isDisabled}
          />
        );
      case "jumbled":
        return (
          <JumbledAnswerer
            data={payload.questionData as JumbledData}
            value={asStringArray(answer)}
            onChange={setAnswer}
            disabled={isDisabled}
          />
        );
      case "audio":
        return (
          <AudioAnswerer
            data={payload.questionData as AudioData}
            value={answer instanceof Blob ? answer : null}
            onChange={setAnswer}
            disabled={isDisabled}
          />
        );
      case "image_evaluation":
        return (
          <ImageEvaluationAnswerer
            data={payload.questionData as ImageEvaluationData}
            value={Array.isArray(answer) ? (answer as File[]) : []}
            onChange={setAnswer}
            disabled={isDisabled}
          />
        );
      case "group-options":
        return (
          <GroupOptionsAnswerer
            data={payload.questionData as GroupOptionsData}
            value={asRecordArrays(answer)}
            onChange={setAnswer}
            disabled={isDisabled}
          />
        );
      case "chat_agent_question":
        return (
          <ChatAgentAnswerer
            data={payload.questionData as ChatAgentQuestionData}
            value={
              Array.isArray(answer)
                ? (answer as { role: "user" | "assistant"; text: string }[])
                : []
            }
            onChange={setAnswer}
            onSendMessage={handleChatAgentSend}
            disabled={isDisabled}
          />
        );
      default:
        return (
          <p className="text-muted-foreground text-sm">Unsupported question type: {questionType}</p>
        );
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      {/* Question content — foregrounded: larger, more line-height, less chrome */}
      <div>
        {(payload.difficulty || payload.basePoints) && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <DifficultyChip difficulty={payload.difficulty} />
            {payload.basePoints ? (
              <span className="border-spark/30 bg-spark-subtle text-spark-hover rounded-pill text-2xs inline-flex items-center border px-2 py-0.5 font-medium">
                <span className="font-mono tabular-nums">{payload.basePoints}</span>&nbsp;pts
              </span>
            ) : null}
          </div>
        )}
        {questionTitle && (
          <h3 className="font-display text-fg mb-2 text-xl leading-snug">{questionTitle}</h3>
        )}
        <div className="text-fg max-w-reading whitespace-pre-wrap text-lg font-medium leading-relaxed">
          {cleanText}
        </div>
      </div>

      {/* Item attachments (images, diagrams) */}
      {imageAttachments.length > 0 && (
        <div
          className={`grid gap-3 ${imageAttachments.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}
        >
          {imageAttachments.map((img, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setLightboxIndex(idx)}
              className="block cursor-zoom-in"
            >
              <img
                src={img.url}
                alt={img.alt}
                loading="lazy"
                decoding="async"
                className="max-h-[28rem] w-full rounded-lg border object-contain"
              />
            </button>
          ))}
        </div>
      )}
      {lightboxIndex !== null && (
        <ImageLightbox
          images={imageAttachments}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      )}

      {/* Answer input */}
      {renderInput()}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {!submitted && mode !== "test" && (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={answer == null}
            className="bg-brand text-fg-on-accent hover:bg-brand-hover shadow-e1 duration-fast ease-standard rounded-md px-5 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            Check answer
          </button>
        )}
        {submitted && mode === "practice" && (
          <button
            type="button"
            onClick={handleRetry}
            className="border-strong text-fg hover:bg-surface-sunken duration-fast ease-standard rounded-md border px-5 py-2.5 text-sm font-semibold transition-colors"
          >
            Try again
          </button>
        )}
        {onOpenChat && (
          <button
            type="button"
            onClick={onOpenChat}
            className="border-subtle text-fg-secondary hover:border-strong hover:text-fg duration-fast ease-standard flex items-center gap-1.5 rounded-md border px-3.5 py-2.5 text-sm transition-colors"
          >
            <MessageCircle className="h-4 w-4" aria-hidden /> Ask tutor
          </button>
        )}
      </div>

      {/* Feedback */}
      {evaluation && <FeedbackPanel evaluation={evaluation} explanation={payload.explanation} />}

      {/* Previous Submission */}
      {previousEvaluation && !showPrevious && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setShowPrevious(true)}
            className="border-subtle text-fg-muted hover:border-strong hover:text-fg duration-fast flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors"
          >
            <History className="h-3.5 w-3.5" aria-hidden /> Previous submission
          </button>
        </div>
      )}
      {showPrevious && previousEvaluation && (
        <div className="border-strong rounded-lg border border-dashed p-4">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-fg-muted text-2xs tracking-caps font-semibold uppercase">
              Previous submission
            </h4>
            <button
              type="button"
              onClick={() => setShowPrevious(false)}
              className="text-fg-muted hover:text-fg text-xs"
            >
              Hide
            </button>
          </div>
          <FeedbackPanel evaluation={previousEvaluation} explanation={payload.explanation} />
        </div>
      )}
    </div>
  );
}
