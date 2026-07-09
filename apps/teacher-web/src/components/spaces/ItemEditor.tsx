import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import type {
  UnifiedItem,
  QuestionType,
  MaterialType,
  QuestionPayload,
  MaterialPayload,
  QuestionTypeData,
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
  MCQOption,
  CodeTestCase,
  FillBlank,
  MatchingPair,
  JumbledItem,
  GroupOptionsGroup,
  GroupOptionsItem as GOItem,
  ItemAttachment,
  StoryPointSection,
  StoryPointType,
  BloomsLevel,
  RichContentBlock,
  RichContentBlockItem,
} from "@levelup/shared-types";
import { BLOOMS_LEVELS } from "@levelup/shared-types";
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  Paperclip,
  X,
  FileIcon,
  ImageIcon,
  Music,
  GripVertical,
  AlertTriangle,
} from "lucide-react";
import { uploadItemMedia, deleteItemMedia, callGetItemForEdit } from "@levelup/shared-services";
import {
  Button,
  Input,
  Label,
  Textarea,
  Switch,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  RichTextEditor,
  Badge,
  sonnerToast,
} from "@levelup/shared-ui";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: "mcq", label: "Multiple Choice (Single)" },
  { value: "mcaq", label: "Multiple Choice (Multiple)" },
  { value: "true-false", label: "True / False" },
  { value: "numerical", label: "Numerical" },
  { value: "text", label: "Short Text" },
  { value: "paragraph", label: "Paragraph" },
  { value: "code", label: "Code" },
  { value: "fill-blanks", label: "Fill in the Blanks" },
  { value: "fill-blanks-dd", label: "Fill Blanks (Dropdown)" },
  { value: "matching", label: "Matching" },
  { value: "jumbled", label: "Jumbled / Ordering" },
  { value: "audio", label: "Audio Response" },
  { value: "image_evaluation", label: "Image Evaluation" },
  { value: "group-options", label: "Group Options" },
  { value: "chat_agent_question", label: "Chat Agent" },
];

const MATERIAL_TYPES: { value: MaterialType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "video", label: "Video" },
  { value: "pdf", label: "PDF" },
  { value: "link", label: "Link" },
  { value: "interactive", label: "Interactive" },
  { value: "story", label: "Story" },
  { value: "rich", label: "Rich Content" },
];

interface Props {
  item: UnifiedItem;
  tenantId?: string;
  spaceId?: string;
  /** StoryPoint sections for the section dropdown. */
  sections?: StoryPointSection[];
  /** StoryPoint type — used to warn teachers when answer keys live in protected storage. */
  storyPointType?: StoryPointType;
  /** Manual save — closes the sheet on success. */
  onSave: (item: UnifiedItem) => Promise<void>;
  /** Auto-save — does NOT close the sheet. Falls back to onSave if not provided. */
  onAutoSave?: (item: UnifiedItem) => Promise<void>;
  onCancel: () => void;
}

// Audio language options (P1-31).
const AUDIO_LANGUAGES: { value: string; label: string }[] = [
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "zh", label: "Chinese" },
  { value: "ja", label: "Japanese" },
  { value: "ar", label: "Arabic" },
  { value: "pt", label: "Portuguese" },
  { value: "ru", label: "Russian" },
];

const RICH_BLOCK_TYPES: RichContentBlockItem["type"][] = [
  "heading",
  "paragraph",
  "image",
  "video",
  "audio",
  "code",
  "quote",
  "list",
  "divider",
];

function isValidUrl(s: string): boolean {
  if (!s) return false;
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Detects if answer-key fields appear to have been stripped server-side
 * (timed_test items). Used to warn the teacher before they overwrite the
 * key with empty values (P0-1 mitigation).
 */
function answerKeyLooksStripped(qPayload: QuestionPayload): boolean {
  const qt = qPayload.questionType;
  const qd = qPayload.questionData as Partial<QuestionTypeData> | undefined;
  if (!qd) return false;
  switch (qt) {
    case "mcq":
    case "mcaq": {
      const opts = (qd as MCQData).options ?? [];
      return opts.length > 0 && opts.every((o) => !o.isCorrect);
    }
    case "true-false":
      return (qd as TrueFalseData).correctAnswer === undefined;
    case "numerical":
      return (qd as NumericalData).correctAnswer === undefined;
    case "text":
      return !(qd as TextData).correctAnswer && !(qd as TextData).acceptableAnswers?.length;
    case "fill-blanks": {
      const blanks = (qd as FillBlanksData).blanks ?? [];
      return blanks.length > 0 && blanks.every((b) => !b.correctAnswer);
    }
    case "fill-blanks-dd": {
      const blanks = (qd as FillBlanksDDData).blanks ?? [];
      return blanks.length > 0 && blanks.every((b) => !b.correctOptionId);
    }
    case "matching": {
      // After stripping, the right side may be intact but mappings are
      // shuffled — hard to detect from the client. Skip.
      return false;
    }
    case "jumbled": {
      const correctOrder = (qd as JumbledData).correctOrder ?? [];
      const items = (qd as JumbledData).items ?? [];
      return items.length > 0 && correctOrder.length === 0;
    }
    case "group-options": {
      const groups = (qd as GroupOptionsData).groups ?? [];
      return groups.length > 0 && groups.every((g) => g.correctItems.length === 0);
    }
    default:
      return false;
  }
}

/**
 * Per-type validation. Returns an array of human-readable error messages.
 * Used to disable the Save button and show inline errors (P0-4).
 */
function validateItem(args: {
  title: string;
  isQuestion: boolean;
  payload: unknown;
  attachments: ItemAttachment[];
}): string[] {
  const errors: string[] = [];
  if (!args.title.trim()) errors.push("Title is required");

  if (args.isQuestion) {
    const p = args.payload as QuestionPayload;
    const qt = p.questionType;
    const qd = p.questionData as Partial<QuestionTypeData> | undefined;
    if (!qt) errors.push("Question type is required");
    if (!qd) {
      errors.push("Question configuration is missing");
      return errors;
    }
    switch (qt) {
      case "mcq":
      case "mcaq": {
        const opts = (qd as MCQData).options ?? [];
        if (opts.length < 2) errors.push("Add at least 2 options");
        if (opts.some((o) => !o.text.trim())) errors.push("All options need text");
        if (!opts.some((o) => o.isCorrect)) errors.push("Mark at least one option correct");
        if (qt === "mcaq") {
          const min = (qd as MCAQData).minSelections;
          const max = (qd as MCAQData).maxSelections;
          if (min != null && max != null && min > max) {
            errors.push("Min selections cannot exceed max selections");
          }
        }
        break;
      }
      case "true-false":
        if ((qd as TrueFalseData).correctAnswer === undefined) errors.push("Pick True or False");
        break;
      case "numerical":
        if (
          (qd as NumericalData).correctAnswer === undefined ||
          Number.isNaN(Number((qd as NumericalData).correctAnswer))
        ) {
          errors.push("Numerical answer is required");
        }
        if (((qd as NumericalData).tolerance ?? 0) < 0) errors.push("Tolerance cannot be negative");
        break;
      case "text":
        if (
          !((qd as TextData).correctAnswer ?? "").trim() &&
          !(qd as TextData).acceptableAnswers?.length
        )
          errors.push("Provide a correct answer or acceptable answers");
        break;
      case "paragraph":
        // AI-graded; modelAnswer + evaluationGuidance are recommended but optional.
        break;
      case "code": {
        const cd = qd as CodeData;
        if (!cd.language) errors.push("Choose a programming language");
        if (!cd.testCases?.length) errors.push("Add at least one test case");
        if (cd.testCases?.some((tc) => !tc.expectedOutput.trim()))
          errors.push("All test cases need an expected output");
        if ((cd.timeoutMs ?? 1) <= 0) errors.push("Timeout must be > 0 ms");
        if ((cd.memoryLimitMb ?? 1) <= 0) errors.push("Memory limit must be > 0 MB");
        break;
      }
      case "fill-blanks": {
        const fbd = qd as FillBlanksData;
        if (!fbd.textWithBlanks?.trim()) errors.push("Enter text with blanks");
        if (!fbd.blanks?.length) errors.push("Add at least one blank");
        if (fbd.blanks?.some((b) => !b.correctAnswer.trim()))
          errors.push("All blanks need a correct answer");
        break;
      }
      case "fill-blanks-dd": {
        const fbdd = qd as FillBlanksDDData;
        if (!fbdd.textWithBlanks?.trim()) errors.push("Enter text with blanks");
        if (!fbdd.blanks?.length) errors.push("Add at least one blank");
        fbdd.blanks?.forEach((b, i) => {
          if (!b.options.length) errors.push(`Blank #${i + 1} needs options`);
          if (b.options.some((o) => !o.text.trim()))
            errors.push(`Blank #${i + 1}: all options need text`);
          if (!b.correctOptionId) errors.push(`Blank #${i + 1}: pick a correct option`);
        });
        break;
      }
      case "matching": {
        const md = qd as MatchingData;
        if (!md.pairs?.length) errors.push("Add at least one matching pair");
        if (md.pairs?.some((p) => !p.left.trim() || !p.right.trim()))
          errors.push("All pairs need left and right text");
        break;
      }
      case "jumbled": {
        const jd = qd as JumbledData;
        if ((jd.items?.length ?? 0) < 2) errors.push("Add at least 2 items to reorder");
        if (jd.items?.some((it) => !it.text.trim())) errors.push("All items need text");
        break;
      }
      case "audio": {
        const ad = qd as AudioData;
        if ((ad.maxDurationSeconds ?? 0) <= 0) errors.push("Max duration must be > 0 seconds");
        break;
      }
      case "image_evaluation": {
        const ied = qd as ImageEvaluationData;
        if (!ied.instructions?.trim()) errors.push("Image-evaluation instructions are required");
        if ((ied.maxImages ?? 0) < 1) errors.push("Max images must be at least 1");
        break;
      }
      case "group-options": {
        const god = qd as GroupOptionsData;
        if ((god.groups?.length ?? 0) < 2) errors.push("Add at least 2 groups");
        if ((god.items?.length ?? 0) < 2) errors.push("Add at least 2 items");
        if (god.items?.some((i) => !i.text.trim())) errors.push("All items need text");
        if (god.groups?.some((g) => !g.name.trim())) errors.push("All groups need a name");
        const totalAssigned = god.groups?.reduce((n, g) => n + g.correctItems.length, 0) ?? 0;
        if (totalAssigned < (god.items?.length ?? 0)) errors.push("Assign every item to a group");
        break;
      }
      case "chat_agent_question": {
        const cad = qd as ChatAgentQuestionData;
        if (!cad.objectives?.length) errors.push("At least one objective is required");
        if ((cad.maxTurns ?? 0) < 1) errors.push("Max turns must be at least 1");
        break;
      }
    }
  } else {
    const p = args.payload as MaterialPayload;
    switch (p.materialType) {
      case "video":
      case "pdf":
      case "link":
        if (!isValidUrl(p.url ?? "")) errors.push("A valid http(s) URL is required");
        break;
      case "interactive":
        if (!isValidUrl(p.url ?? "")) errors.push("Interactive material needs a valid embed URL");
        break;
      case "story":
      case "rich":
        if (!(p.content ?? "").trim() && !p.richContent?.blocks?.length)
          errors.push("Add narrative content or at least one block");
        break;
      case "text":
        if (!(p.content ?? "").trim()) errors.push("Text content is required");
        break;
    }
  }

  return errors;
}

// Helper to get default question data for a given type
function defaultQuestionData(qt: QuestionType): QuestionTypeData {
  switch (qt) {
    case "mcq":
      return { options: [], shuffleOptions: false } satisfies MCQData;
    case "mcaq":
      return { options: [], minSelections: 1, shuffleOptions: false } satisfies MCAQData;
    case "true-false":
      return { correctAnswer: true } satisfies TrueFalseData;
    case "numerical":
      return { correctAnswer: 0, tolerance: 0 } satisfies NumericalData;
    case "text":
      return { correctAnswer: "", maxLength: 500 } satisfies TextData;
    case "paragraph":
      return { maxLength: 5000, minLength: 50 } satisfies ParagraphData;
    case "code":
      return { language: "python", testCases: [] } satisfies CodeData;
    case "fill-blanks":
      return { textWithBlanks: "", blanks: [] } satisfies FillBlanksData;
    case "fill-blanks-dd":
      return { textWithBlanks: "", blanks: [] } satisfies FillBlanksDDData;
    case "matching":
      return { pairs: [] } satisfies MatchingData;
    case "jumbled":
      return { correctOrder: [], items: [] } satisfies JumbledData;
    case "audio":
      return { maxDurationSeconds: 120 } satisfies AudioData;
    case "image_evaluation":
      return { instructions: "", maxImages: 1 } satisfies ImageEvaluationData;
    case "group-options":
      return { groups: [], items: [] } satisfies GroupOptionsData;
    case "chat_agent_question":
      return { objectives: [], maxTurns: 10 } satisfies ChatAgentQuestionData;
    default:
      return {} as QuestionTypeData;
  }
}

export default function ItemEditor({
  item,
  tenantId,
  spaceId,
  sections,
  storyPointType,
  onSave,
  onAutoSave,
  onCancel,
}: Props) {
  const [title, setTitle] = useState(item.title ?? "");
  const [content, setContent] = useState(item.content ?? "");
  const [type] = useState(item.type);
  const [difficulty, setDifficulty] = useState(item.difficulty ?? "medium");
  const [payload, setPayload] = useState(item.payload);
  const [topics, setTopics] = useState<string[]>(item.topics ?? []);
  const [labels, setLabels] = useState<string[]>(item.labels ?? []);
  const [sectionId, setSectionId] = useState<string | undefined>(item.sectionId ?? undefined);
  const [bloomsLevel, setBloomsLevel] = useState<BloomsLevel | undefined>(
    item.meta?.bloomsLevel ?? undefined
  );
  const [saving, setSaving] = useState(false);
  const [attachments, setAttachments] = useState<ItemAttachment[]>(item.attachments ?? []);
  const [uploading, setUploading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSaveInFlightRef = useRef(false);

  const isQuestion = type === "question";
  const qPayload = payload as QuestionPayload;
  const mPayload = payload as MaterialPayload;

  const questionType = isQuestion ? qPayload.questionType : null;
  const materialType = !isQuestion ? mPayload.materialType : null;

  const isTimedTestSP = storyPointType === "timed_test" || storyPointType === "test";

  // Re-sync state when the underlying item identity changes (P0-19).
  useEffect(() => {
    setTitle(item.title ?? "");
    setContent(item.content ?? "");
    setDifficulty(item.difficulty ?? "medium");
    setPayload(item.payload);
    setTopics(item.topics ?? []);
    setLabels(item.labels ?? []);
    setSectionId(item.sectionId ?? undefined);
    setBloomsLevel(item.meta?.bloomsLevel ?? undefined);
    setAttachments(item.attachments ?? []);
    setHasUnsavedChanges(false);
    setSaveStatus("saved");
  }, [item.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // For timed_test items, fetch the merged payload (with answer key) from
  // the server so the editor doesn't display a stripped/empty answer key
  // that would be silently overwritten on save (P0-1).
  useEffect(() => {
    if (!isTimedTestSP || !isQuestion) return;
    if (!tenantId || !spaceId || !item.storyPointId) return;
    let cancelled = false;
    callGetItemForEdit({
      tenantId,
      spaceId,
      storyPointId: item.storyPointId,
      itemId: item.id,
    })
      .then((res) => {
        if (cancelled) return;
        if (res.item.payload) {
          setPayload(res.item.payload);
        }
      })
      .catch(() => {
        // Best-effort — fall back to stripped payload + warning banner.
      });
    return () => {
      cancelled = true;
    };
  }, [item.id, isTimedTestSP, isQuestion, tenantId, spaceId, item.storyPointId]);

  // Validate the item against per-type rules. Returns array of error messages.
  const validationErrors = useMemo(
    () => validateItem({ title, isQuestion, payload, attachments }),
    [title, isQuestion, payload, attachments]
  );
  const isValid = validationErrors.length === 0;

  // Detect probable answer-key stripping (P0-1 client-side warning).
  const looksAnswerKeyStripped = useMemo(
    () => isQuestion && isTimedTestSP && answerKeyLooksStripped(qPayload),
    [isQuestion, isTimedTestSP, qPayload]
  );

  // Mark as unsaved when any field changes
  const markUnsaved = useCallback(() => {
    setHasUnsavedChanges(true);
    setSaveStatus("unsaved");
  }, []);

  const buildItemForSave = useCallback((): UnifiedItem => {
    // Mirror bloomsLevel into meta. Drop the field when cleared so saves
    // actually unset it.
    const baseMeta = item.meta ?? {};
    const meta = bloomsLevel
      ? { ...baseMeta, bloomsLevel }
      : Object.fromEntries(Object.entries(baseMeta).filter(([k]) => k !== "bloomsLevel"));
    return {
      ...item,
      title,
      content,
      difficulty: difficulty as UnifiedItem["difficulty"],
      topics,
      labels,
      sectionId: sectionId ?? undefined,
      meta,
      attachments,
      payload: isQuestion
        ? // Mirror the top-level content into the payload so server and student
          // views stay in sync. Use exact value (no `||` fallback) so clearing
          // actually clears (P1-21).
          { ...qPayload, content }
        : mPayload,
    } as UnifiedItem;
  }, [
    item,
    title,
    content,
    difficulty,
    topics,
    labels,
    sectionId,
    bloomsLevel,
    attachments,
    isQuestion,
    qPayload,
    mPayload,
    payload,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  const performAutoSave = useCallback(async () => {
    if (autoSaveInFlightRef.current) return; // P1-24: drop if already saving
    if (!isValid) return; // P0-4: don't autosave invalid state
    autoSaveInFlightRef.current = true;
    setSaveStatus("saving");
    try {
      const saver = onAutoSave ?? onSave;
      await saver(buildItemForSave());
      setSaveStatus("saved");
      setHasUnsavedChanges(false);
    } catch (err) {
      setSaveStatus("unsaved");
      sonnerToast.error(
        err instanceof Error ? `Auto-save failed: ${err.message}` : "Auto-save failed"
      );
    } finally {
      autoSaveInFlightRef.current = false;
    }
  }, [onAutoSave, onSave, buildItemForSave, isValid]);

  // Auto-save debounce (2s after last edit)
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      performAutoSave();
    }, 2000);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [
    title,
    content,
    difficulty,
    payload,
    attachments,
    topics,
    labels,
    sectionId,
    bloomsLevel,
    hasUnsavedChanges,
    performAutoSave,
  ]);

  // Wrap state setters to trigger unsaved tracking
  const setTitleTracked = (v: string) => {
    setTitle(v);
    markUnsaved();
  };
  const setContentTracked = (v: string) => {
    setContent(v);
    markUnsaved();
  };
  const setDifficultyTracked = (v: string) => {
    setDifficulty(v);
    markUnsaved();
  };

  const handleChangeQuestionType = (qt: QuestionType) => {
    if (qt === questionType) return;
    // Warn before destroying configured data (P1-22).
    const hasConfiguredData =
      qPayload.questionData &&
      Object.keys(qPayload.questionData).length > 0 &&
      JSON.stringify(qPayload.questionData) !==
        JSON.stringify(defaultQuestionData(questionType ?? "mcq"));
    if (
      hasConfiguredData &&
      !window.confirm("Changing question type will reset the question's configuration. Continue?")
    ) {
      return;
    }
    setPayload({
      ...qPayload,
      questionType: qt,
      questionData: defaultQuestionData(qt),
    });
    markUnsaved();
  };

  const handleChangeMaterialType = (mt: MaterialType) => {
    setPayload({ ...mPayload, materialType: mt });
    markUnsaved();
  };

  const updateQD = (updates: Partial<QuestionTypeData>) => {
    setPayload({
      ...qPayload,
      questionData: { ...qPayload.questionData, ...updates },
    });
    markUnsaved();
  };

  const handleFileUpload = async (files: FileList) => {
    if (!tenantId || !spaceId) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const result = await uploadItemMedia(tenantId, spaceId, item.id, file);
        setAttachments((prev) => [...prev, result]);
      }
      sonnerToast.success("Files uploaded");
    } catch (err) {
      sonnerToast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveAttachment = async (attachment: ItemAttachment) => {
    if (!tenantId || !spaceId) return;
    try {
      await deleteItemMedia(tenantId, spaceId, item.id, attachment.fileName, attachment.id);
      setAttachments((prev) => prev.filter((a) => a.id !== attachment.id));
      sonnerToast.success("Attachment removed");
    } catch {
      sonnerToast.error("Failed to remove attachment");
    }
  };

  const handleSave = useCallback(async () => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    if (!isValid) {
      sonnerToast.error(validationErrors[0] ?? "Item is incomplete");
      return;
    }
    setSaving(true);
    setSaveStatus("saving");
    try {
      await onSave(buildItemForSave());
      setSaveStatus("saved");
      setHasUnsavedChanges(false);
    } finally {
      setSaving(false);
    }
  }, [isValid, validationErrors, onSave, buildItemForSave]);

  // Keyboard: Cmd/Ctrl+Enter saves (P0-3 — was previously closing the sheet
  // without saving). Esc cancels.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key === "Enter") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleSave]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            if (hasUnsavedChanges) {
              if (window.confirm("You have unsaved changes. Are you sure you want to close?")) {
                onCancel();
              }
            } else {
              onCancel();
            }
          }}
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-display text-xl font-semibold">
          Edit {isQuestion ? "Question" : "Material"}
        </h1>
        <span
          className={`rounded-pill ml-auto px-2 py-1 text-xs ${
            saveStatus === "saved"
              ? "bg-success-subtle text-success"
              : saveStatus === "saving"
                ? "bg-info-subtle text-info"
                : "bg-warning-subtle text-warning"
          }`}
        >
          {saveStatus === "saved"
            ? "Saved"
            : saveStatus === "saving"
              ? "Saving..."
              : "Unsaved changes"}
        </span>
      </div>

      <div className="max-w-3xl space-y-5">
        {/* Timed-test answer-key warning (P0-1 mitigation) */}
        {isQuestion && isTimedTestSP && looksAnswerKeyStripped && (
          <div className="border-warning/40 bg-warning-subtle text-warning flex items-start gap-2 rounded-md border px-3 py-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="text-xs">
              This is a timed-test question. The correct answer is stored in protected server-only
              storage and is <strong>not</strong> shown here. Saving without re-entering the correct
              answer will overwrite the stored answer key with empty data.
            </div>
          </div>
        )}

        {/* Validation errors */}
        {!isValid && validationErrors.length > 0 && (
          <div className="border-error/40 bg-error-subtle text-error rounded-md border px-3 py-2 text-xs">
            <p className="mb-1 font-medium">Fix before saving:</p>
            <ul className="list-disc pl-4">
              {validationErrors.slice(0, 5).map((e) => (
                <li key={e}>{e}</li>
              ))}
              {validationErrors.length > 5 && <li>… and {validationErrors.length - 5} more</li>}
            </ul>
          </div>
        )}

        {/* Common fields */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>
              Title <span className="text-error">*</span>
            </Label>
            <Input
              type="text"
              value={title}
              onChange={(e) => setTitleTracked(e.target.value)}
              className="mt-1"
              aria-invalid={!title.trim()}
            />
          </div>

          {isQuestion && (
            <div>
              <Label>Question Type</Label>
              <Select
                value={questionType ?? "mcq"}
                onValueChange={(v) => handleChangeQuestionType(v as QuestionType)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUESTION_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {!isQuestion && (
            <div>
              <Label>Material Type</Label>
              <Select
                value={materialType ?? "text"}
                onValueChange={(v) => handleChangeMaterialType(v as MaterialType)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MATERIAL_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label>Difficulty</Label>
            <Select value={difficulty} onValueChange={setDifficultyTracked}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="hard">Hard</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label>{isQuestion ? "Question Content" : "Content"}</Label>
          <RichTextEditor
            content={content}
            onChange={setContentTracked}
            placeholder={isQuestion ? "Enter the question text..." : "Enter content or URL..."}
            className="mt-1"
          />
        </div>

        {/* Question-type specific editors */}
        {isQuestion && (
          <div className="border-subtle shadow-e1 space-y-4 rounded-lg border p-4">
            <h3 className="tracking-caps text-fg-muted text-xs font-bold uppercase">
              {questionType?.replace(/[-_]/g, " ")} Configuration
            </h3>
            <QuestionDataEditor
              questionType={questionType!}
              data={qPayload.questionData}
              onChange={updateQD}
            />

            {/* Base points and explanation */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Base Points</Label>
                <Input
                  type="number"
                  value={qPayload.basePoints ?? 1}
                  onChange={(e) =>
                    setPayload({
                      ...qPayload,
                      basePoints: Number(e.target.value),
                    })
                  }
                  min={0}
                  className="mt-1 font-mono"
                />
              </div>
            </div>
            <div>
              <Label>Explanation (shown after answering)</Label>
              <Textarea
                value={qPayload.explanation ?? ""}
                onChange={(e) =>
                  setPayload({ ...qPayload, explanation: e.target.value || undefined })
                }
                rows={2}
                className="mt-1"
              />
            </div>
          </div>
        )}

        {/* Material-type specific editors */}
        {!isQuestion && (
          <div className="border-subtle shadow-e1 space-y-4 rounded-lg border p-4">
            <h3 className="tracking-caps text-fg-muted text-xs font-bold uppercase">
              {materialType?.replace(/[-_]/g, " ")} Configuration
            </h3>
            <MaterialDataEditor
              materialType={materialType!}
              data={mPayload}
              onChange={(updates) => {
                setPayload({ ...mPayload, ...updates });
                markUnsaved();
              }}
            />
          </div>
        )}

        {/* Classification panel (P0-7) */}
        <div className="border-subtle shadow-e1 space-y-4 rounded-lg border p-4">
          <h3 className="tracking-caps text-fg-muted text-xs font-bold uppercase">
            Classification
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {sections && sections.length > 0 && (
              <div>
                <Label>Section</Label>
                <Select
                  value={sectionId ?? "__none__"}
                  onValueChange={(v) => {
                    setSectionId(v === "__none__" ? undefined : v);
                    markUnsaved();
                  }}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Unsectioned</SelectItem>
                    {sections.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {isQuestion && (
              <div>
                <Label>Bloom's Level</Label>
                <Select
                  value={bloomsLevel ?? "__none__"}
                  onValueChange={(v) => {
                    setBloomsLevel(v === "__none__" ? undefined : (v as BloomsLevel));
                    markUnsaved();
                  }}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Not set" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Not set</SelectItem>
                    {BLOOMS_LEVELS.map((l) => (
                      <SelectItem key={l} value={l}>
                        {l[0].toUpperCase() + l.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <ChipsInput
            label="Topics"
            placeholder="Add a topic and press Enter"
            values={topics}
            onChange={(v) => {
              setTopics(v);
              markUnsaved();
            }}
          />
          <ChipsInput
            label="Labels"
            placeholder="Add a label and press Enter"
            values={labels}
            onChange={(v) => {
              setLabels(v);
              markUnsaved();
            }}
          />
        </div>

        {/* Media Attachments */}
        {tenantId && spaceId && (
          <div>
            <Label>Attachments</Label>
            <div className="mt-1 space-y-2">
              {attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="border-subtle flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                >
                  {attachment.type === "image" ? (
                    <ImageIcon className="text-info h-4 w-4" />
                  ) : attachment.type === "audio" ? (
                    <Music className="text-brand h-4 w-4" />
                  ) : (
                    <FileIcon className="text-error h-4 w-4" />
                  )}
                  <span className="flex-1 truncate">{attachment.fileName}</span>
                  <span className="text-muted-foreground font-mono text-xs">
                    {(attachment.size / 1024).toFixed(0)}KB
                  </span>
                  <button
                    onClick={() => handleRemoveAttachment(attachment)}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Remove attachment"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf,audio/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) handleFileUpload(e.target.files);
                  e.target.value = "";
                }}
              />
              <Button
                variant="outline"
                size="sm"
                className="border-dashed"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <Paperclip className="h-3.5 w-3.5" />
                {uploading ? "Uploading..." : "Add Attachment"}
              </Button>
              <p className="text-muted-foreground text-xs">
                Max 10MB per file. Supported: images, PDFs, audio.
              </p>
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <Button onClick={handleSave} disabled={saving || !isValid}>
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save Item"}
          </Button>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <span className="text-muted-foreground ml-auto self-center text-xs">
            Cmd/Ctrl+Enter to save
          </span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────
// ChipsInput — simple tag/label input
// ─────────────────────────────────────────────────

function ChipsInput({
  label,
  placeholder,
  values,
  onChange,
}: {
  label: string;
  placeholder?: string;
  values: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const commit = () => {
    const v = draft.trim();
    if (!v) return;
    if (values.includes(v)) {
      setDraft("");
      return;
    }
    onChange([...values, v]);
    setDraft("");
  };
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1 flex flex-wrap items-center gap-1.5 rounded-md border px-2 py-1.5">
        {values.map((v) => (
          <Badge key={v} variant="secondary" className="gap-1 pr-1">
            {v}
            <button
              type="button"
              onClick={() => onChange(values.filter((x) => x !== v))}
              aria-label={`Remove ${v}`}
              className="text-muted-foreground hover:text-destructive"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              commit();
            } else if (e.key === "Backspace" && !draft && values.length) {
              onChange(values.slice(0, -1));
            }
          }}
          onBlur={commit}
          placeholder={placeholder}
          className="min-w-[8ch] flex-1 bg-transparent text-sm outline-none"
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────
// Question Data Editor (all 15 types)
// ─────────────────────────────────────────────────

function QuestionDataEditor({
  questionType,
  data,
  onChange,
}: {
  questionType: QuestionType;
  data: QuestionTypeData;
  onChange: (updates: Partial<QuestionTypeData>) => void;
}) {
  switch (questionType) {
    case "mcq":
    case "mcaq":
      return (
        <MCQEditor
          data={data as MCQData | MCAQData}
          onChange={onChange}
          multi={questionType === "mcaq"}
        />
      );
    case "true-false":
      return <TrueFalseEditor data={data as TrueFalseData} onChange={onChange} />;
    case "numerical":
      return <NumericalEditor data={data as NumericalData} onChange={onChange} />;
    case "text":
      return <TextEditor data={data as TextData} onChange={onChange} />;
    case "paragraph":
      return <ParagraphEditor data={data as ParagraphData} onChange={onChange} />;
    case "code":
      return <CodeEditor data={data as CodeData} onChange={onChange} />;
    case "fill-blanks":
      return <FillBlanksEditor data={data as FillBlanksData} onChange={onChange} />;
    case "fill-blanks-dd":
      return <FillBlanksDDEditor data={data as FillBlanksDDData} onChange={onChange} />;
    case "matching":
      return <MatchingEditor data={data as MatchingData} onChange={onChange} />;
    case "jumbled":
      return <JumbledEditor data={data as JumbledData} onChange={onChange} />;
    case "audio":
      return <AudioEditor data={data as AudioData} onChange={onChange} />;
    case "image_evaluation":
      return <ImageEvalEditor data={data as ImageEvaluationData} onChange={onChange} />;
    case "group-options":
      return <GroupOptionsEditor data={data as GroupOptionsData} onChange={onChange} />;
    case "chat_agent_question":
      return <ChatAgentEditor data={data as ChatAgentQuestionData} onChange={onChange} />;
    default:
      return <p className="text-muted-foreground text-sm">No editor for this type</p>;
  }
}

// ── MCQ / MCAQ ──────────────────────────────────

function MCQEditor({
  data,
  onChange,
  multi,
}: {
  data: MCQData | MCAQData;
  onChange: (u: Partial<MCQData & MCAQData>) => void;
  multi: boolean;
}) {
  const options: MCQOption[] = data.options ?? [];

  const addOption = () => {
    onChange({
      options: [...options, { id: `opt_${Date.now()}`, text: "", isCorrect: false }],
    });
  };

  const updateOption = (idx: number, updates: Partial<MCQOption>) => {
    const updated = options.map((o, i) => {
      if (i !== idx) {
        // Single MCQ: clear isCorrect on all others when one is being marked correct.
        if (!multi && updates.isCorrect === true) return { ...o, isCorrect: false };
        return o;
      }
      return { ...o, ...updates };
    });
    onChange({ options: updated });
  };

  const removeOption = (idx: number) => {
    onChange({ options: options.filter((_, i) => i !== idx) });
  };

  const mcaq = data as MCAQData;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Switch
            checked={data.shuffleOptions ?? false}
            onCheckedChange={(v) => onChange({ shuffleOptions: v })}
            id="shuffle-options-mcq"
          />
          <Label htmlFor="shuffle-options-mcq" className="cursor-pointer text-sm">
            Shuffle options
          </Label>
        </div>
        {/* MCAQ-only: min/max selections (P0-9) */}
        {multi && (
          <>
            <div className="flex items-center gap-2">
              <Label className="text-xs">Min selections</Label>
              <Input
                type="number"
                min={1}
                value={mcaq.minSelections ?? 1}
                onChange={(e) =>
                  onChange({ minSelections: Math.max(1, Number(e.target.value) || 1) })
                }
                className="h-8 w-20 font-mono"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs">Max selections</Label>
              <Input
                type="number"
                min={mcaq.minSelections ?? 1}
                value={mcaq.maxSelections ?? ""}
                placeholder="any"
                onChange={(e) => {
                  const n = e.target.value === "" ? undefined : Number(e.target.value);
                  onChange({ maxSelections: n });
                }}
                className="h-8 w-20 font-mono"
              />
            </div>
          </>
        )}
      </div>
      {options.map((opt, idx) => (
        <div key={opt.id} className="flex items-center gap-2">
          <input
            type={multi ? "checkbox" : "radio"}
            checked={opt.isCorrect}
            onChange={(e) => updateOption(idx, { isCorrect: e.target.checked })}
            name="correct_option"
            className="mt-0.5"
            aria-label={`Mark option ${idx + 1} correct`}
          />
          <Input
            type="text"
            value={opt.text}
            onChange={(e) => updateOption(idx, { text: e.target.value })}
            placeholder={`Option ${idx + 1}`}
            className="h-8 flex-1"
          />
          <Input
            type="text"
            value={opt.explanation ?? ""}
            onChange={(e) => updateOption(idx, { explanation: e.target.value || undefined })}
            placeholder="Explanation"
            className="h-8 w-48"
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => removeOption(idx)}
            className="text-muted-foreground hover:text-destructive h-8 w-8"
            aria-label="Remove option"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={addOption}>
        <Plus className="h-3 w-3" /> Add Option
      </Button>
    </div>
  );
}

// ── True/False ──────────────────────────────────

function TrueFalseEditor({
  data,
  onChange,
}: {
  data: TrueFalseData;
  onChange: (u: Partial<TrueFalseData>) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <Label>Correct Answer</Label>
        <div className="mt-1 flex gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={data.correctAnswer === true}
              onChange={() => onChange({ correctAnswer: true })}
            />
            True
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={data.correctAnswer === false}
              onChange={() => onChange({ correctAnswer: false })}
            />
            False
          </label>
        </div>
      </div>
      <div>
        <Label>Explanation</Label>
        <Textarea
          value={data.explanation ?? ""}
          onChange={(e) => onChange({ explanation: e.target.value || undefined })}
          rows={2}
          className="mt-1"
        />
      </div>
    </div>
  );
}

// ── Numerical ───────────────────────────────────

function NumericalEditor({
  data,
  onChange,
}: {
  data: NumericalData;
  onChange: (u: Partial<NumericalData>) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
      <div>
        <Label>Correct Answer</Label>
        <Input
          type="number"
          value={data.correctAnswer ?? 0}
          onChange={(e) => onChange({ correctAnswer: Number(e.target.value) })}
          className="mt-1 font-mono"
        />
      </div>
      <div>
        <Label>Tolerance (+/-)</Label>
        <Input
          type="number"
          min={0}
          value={data.tolerance ?? 0}
          onChange={(e) => onChange({ tolerance: Math.max(0, Number(e.target.value) || 0) })}
          step="0.01"
          className="mt-1 font-mono"
        />
      </div>
      <div>
        <Label>Decimal Places</Label>
        <Input
          type="number"
          min={0}
          max={10}
          value={data.decimalPlaces ?? ""}
          placeholder="any"
          onChange={(e) => {
            const v = e.target.value === "" ? undefined : Math.max(0, Number(e.target.value));
            onChange({ decimalPlaces: v });
          }}
          className="mt-1 font-mono"
        />
      </div>
      <div>
        <Label>Unit</Label>
        <Input
          type="text"
          value={data.unit ?? ""}
          onChange={(e) => onChange({ unit: e.target.value || undefined })}
          placeholder="e.g. kg, m/s"
          className="mt-1"
        />
      </div>
    </div>
  );
}

// ── Short Text ──────────────────────────────────

function TextEditor({
  data,
  onChange,
}: {
  data: TextData;
  onChange: (u: Partial<TextData>) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <Label>Correct Answer</Label>
        <Input
          type="text"
          value={data.correctAnswer ?? ""}
          onChange={(e) => onChange({ correctAnswer: e.target.value })}
          className="mt-1"
        />
      </div>
      <div>
        <Label>Acceptable Answers (one per line)</Label>
        <Textarea
          value={data.acceptableAnswers?.join("\n") ?? ""}
          onChange={(e) =>
            onChange({
              acceptableAnswers: e.target.value
                .split("\n")
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
          rows={2}
          className="mt-1"
          placeholder="Each line is a separate accepted answer (case-insensitive unless toggled below)"
        />
      </div>
      <div className="flex gap-4">
        <div className="flex items-center gap-2">
          <Switch
            checked={data.caseSensitive ?? false}
            onCheckedChange={(v) => onChange({ caseSensitive: v })}
            id="case-sensitive"
          />
          <Label htmlFor="case-sensitive" className="cursor-pointer text-sm">
            Case sensitive
          </Label>
        </div>
        <div>
          <Label>Max Length</Label>
          <Input
            type="number"
            value={data.maxLength ?? 500}
            onChange={(e) => onChange({ maxLength: Number(e.target.value) })}
            className="ml-2 h-8 w-24"
          />
        </div>
      </div>
    </div>
  );
}

// ── Paragraph ───────────────────────────────────

function ParagraphEditor({
  data,
  onChange,
}: {
  data: ParagraphData;
  onChange: (u: Partial<ParagraphData>) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Min Length</Label>
          <Input
            type="number"
            value={data.minLength ?? 0}
            onChange={(e) => onChange({ minLength: Number(e.target.value) })}
            className="mt-1"
          />
        </div>
        <div>
          <Label>Max Length</Label>
          <Input
            type="number"
            value={data.maxLength ?? 5000}
            onChange={(e) => onChange({ maxLength: Number(e.target.value) })}
            className="mt-1"
          />
        </div>
      </div>
      <div>
        <Label>Model Answer</Label>
        <Textarea
          value={data.modelAnswer ?? ""}
          onChange={(e) => onChange({ modelAnswer: e.target.value || undefined })}
          rows={3}
          className="mt-1"
        />
      </div>
      <div>
        <Label>Evaluation Guidance (for AI)</Label>
        <Textarea
          value={data.evaluationGuidance ?? ""}
          onChange={(e) => onChange({ evaluationGuidance: e.target.value || undefined })}
          rows={2}
          className="mt-1"
        />
      </div>
    </div>
  );
}

// ── Code ────────────────────────────────────────

function CodeEditor({
  data,
  onChange,
}: {
  data: CodeData;
  onChange: (u: Partial<CodeData>) => void;
}) {
  const testCases: CodeTestCase[] = data.testCases ?? [];

  const addTestCase = () => {
    onChange({
      testCases: [...testCases, { id: `tc_${Date.now()}`, input: "", expectedOutput: "" }],
    });
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label>Language</Label>
          <Select value={data.language} onValueChange={(v) => onChange({ language: v })}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["python", "javascript", "java", "cpp", "c", "go", "rust"].map((l) => (
                <SelectItem key={l} value={l}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Timeout (ms)</Label>
          <Input
            type="number"
            min={100}
            max={60000}
            value={data.timeoutMs ?? 5000}
            onChange={(e) =>
              onChange({
                timeoutMs: Math.max(100, Math.min(60000, Number(e.target.value) || 5000)),
              })
            }
            className="mt-1"
          />
        </div>
        <div>
          <Label>Memory Limit (MB)</Label>
          <Input
            type="number"
            min={16}
            max={2048}
            value={data.memoryLimitMb ?? 256}
            onChange={(e) =>
              onChange({
                memoryLimitMb: Math.max(16, Math.min(2048, Number(e.target.value) || 256)),
              })
            }
            className="mt-1"
          />
        </div>
      </div>
      <div>
        <Label>Starter Code</Label>
        <Textarea
          value={data.starterCode ?? ""}
          onChange={(e) => onChange({ starterCode: e.target.value || undefined })}
          rows={4}
          className="mt-1 font-mono"
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Test Cases</Label>
          <Button variant="outline" size="sm" onClick={addTestCase}>
            <Plus className="h-3 w-3" /> Add
          </Button>
        </div>
        {testCases.map((tc, idx) => (
          <div key={tc.id} className="border-subtle space-y-2 rounded border p-2">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground w-12 font-mono text-xs">#{idx + 1}</span>
              <Input
                value={tc.description ?? ""}
                onChange={(e) => {
                  const updated = [...testCases];
                  updated[idx] = { ...tc, description: e.target.value || undefined };
                  onChange({ testCases: updated });
                }}
                placeholder="Description (optional)"
                className="h-7 flex-1 text-xs"
              />
              <Label className="text-xs">Points</Label>
              <Input
                type="number"
                min={0}
                value={tc.points ?? ""}
                placeholder="auto"
                onChange={(e) => {
                  const v = e.target.value === "" ? undefined : Math.max(0, Number(e.target.value));
                  const updated = [...testCases];
                  updated[idx] = { ...tc, points: v };
                  onChange({ testCases: updated });
                }}
                className="h-7 w-16 font-mono text-xs"
              />
              <div className="flex items-center gap-1">
                <Switch
                  checked={tc.isHidden ?? false}
                  onCheckedChange={(v) => {
                    const updated = [...testCases];
                    updated[idx] = { ...tc, isHidden: v };
                    onChange({ testCases: updated });
                  }}
                  id={`hidden-${tc.id}`}
                />
                <Label htmlFor={`hidden-${tc.id}`} className="cursor-pointer text-xs">
                  Hidden
                </Label>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onChange({ testCases: testCases.filter((_, i) => i !== idx) })}
                className="text-muted-foreground hover:text-destructive h-7 w-7"
                aria-label="Remove test case"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="flex gap-2">
              <Textarea
                value={tc.input}
                onChange={(e) => {
                  const updated = [...testCases];
                  updated[idx] = { ...tc, input: e.target.value };
                  onChange({ testCases: updated });
                }}
                placeholder="Input"
                rows={1}
                className="flex-1 font-mono text-xs"
              />
              <Textarea
                value={tc.expectedOutput}
                onChange={(e) => {
                  const updated = [...testCases];
                  updated[idx] = { ...tc, expectedOutput: e.target.value };
                  onChange({ testCases: updated });
                }}
                placeholder="Expected Output"
                rows={1}
                className="flex-1 font-mono text-xs"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Fill in the Blanks ──────────────────────────

function FillBlanksEditor({
  data,
  onChange,
}: {
  data: FillBlanksData;
  onChange: (u: Partial<FillBlanksData>) => void;
}) {
  const blanks: FillBlank[] = data.blanks ?? [];

  const addBlank = () => {
    onChange({
      blanks: [...blanks, { id: `blank_${Date.now()}`, correctAnswer: "" }],
    });
  };

  return (
    <div className="space-y-3">
      <div>
        <Label>Text with Blanks (use ___1___, ___2___ etc.)</Label>
        <Textarea
          value={data.textWithBlanks}
          onChange={(e) => onChange({ textWithBlanks: e.target.value })}
          rows={3}
          className="mt-1"
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Blanks</Label>
          <Button variant="outline" size="sm" onClick={addBlank}>
            <Plus className="h-3 w-3" /> Add
          </Button>
        </div>
        {blanks.map((b, idx) => (
          <div key={b.id} className="border-subtle space-y-2 rounded border p-2">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground w-8 font-mono text-xs">#{idx + 1}</span>
              <Input
                type="text"
                value={b.correctAnswer}
                onChange={(e) => {
                  const updated = [...blanks];
                  updated[idx] = { ...b, correctAnswer: e.target.value };
                  onChange({ blanks: updated });
                }}
                placeholder="Correct answer"
                className="h-8 flex-1"
              />
              <div className="flex items-center gap-1">
                <Switch
                  checked={b.caseSensitive ?? false}
                  onCheckedChange={(v) => {
                    const updated = [...blanks];
                    updated[idx] = { ...b, caseSensitive: v };
                    onChange({ blanks: updated });
                  }}
                  id={`fb-cs-${b.id}`}
                />
                <Label htmlFor={`fb-cs-${b.id}`} className="cursor-pointer text-xs">
                  Case
                </Label>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onChange({ blanks: blanks.filter((_, i) => i !== idx) })}
                className="text-muted-foreground hover:text-destructive h-8 w-8"
                aria-label="Remove blank"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            <Input
              type="text"
              value={(b.acceptableAnswers ?? []).join(", ")}
              onChange={(e) => {
                const updated = [...blanks];
                updated[idx] = {
                  ...b,
                  acceptableAnswers: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                };
                onChange({ blanks: updated });
              }}
              placeholder="Other acceptable answers (comma-separated)"
              className="h-7 text-xs"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Fill Blanks Dropdown ────────────────────────

function FillBlanksDDEditor({
  data,
  onChange,
}: {
  data: FillBlanksDDData;
  onChange: (u: Partial<FillBlanksDDData>) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <Label>Text with Blanks</Label>
        <Textarea
          value={data.textWithBlanks}
          onChange={(e) => onChange({ textWithBlanks: e.target.value })}
          rows={3}
          className="mt-1"
        />
      </div>
      <p className="text-muted-foreground text-xs">
        Dropdown blanks are configured per-blank with options and a correct option ID. Add blanks,
        then configure each with their options.
      </p>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          const blanks = [...(data.blanks ?? [])];
          blanks.push({
            id: `ddb_${Date.now()}`,
            correctOptionId: "",
            options: [{ id: `ddo_${Date.now()}`, text: "" }],
          });
          onChange({ blanks });
        }}
      >
        <Plus className="h-3 w-3" /> Add Blank
      </Button>
      {(data.blanks ?? []).map((blank, bIdx) => (
        <div key={blank.id} className="border-subtle space-y-2 rounded border p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">Blank #{bIdx + 1}</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() =>
                onChange({
                  blanks: (data.blanks ?? []).filter((_, i) => i !== bIdx),
                })
              }
              className="text-muted-foreground hover:text-destructive h-7 w-7"
              aria-label="Remove blank"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          {blank.options.map((opt, oIdx) => (
            <div key={opt.id} className="flex items-center gap-2">
              <input
                type="radio"
                checked={blank.correctOptionId === opt.id}
                onChange={() => {
                  const blanks = [...(data.blanks ?? [])];
                  blanks[bIdx] = { ...blank, correctOptionId: opt.id };
                  onChange({ blanks });
                }}
                aria-label={`Mark option ${oIdx + 1} correct`}
              />
              <Input
                type="text"
                value={opt.text}
                onChange={(e) => {
                  const blanks = [...(data.blanks ?? [])];
                  const options = [...blank.options];
                  options[oIdx] = { ...opt, text: e.target.value };
                  blanks[bIdx] = { ...blank, options };
                  onChange({ blanks });
                }}
                className="h-7 flex-1 text-xs"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  const blanks = [...(data.blanks ?? [])];
                  const options = blank.options.filter((_, i) => i !== oIdx);
                  // Clear correctOptionId if the removed option was the answer.
                  const correctOptionId =
                    blank.correctOptionId === opt.id ? "" : blank.correctOptionId;
                  blanks[bIdx] = { ...blank, options, correctOptionId };
                  onChange({ blanks });
                }}
                className="text-muted-foreground hover:text-destructive h-6 w-6"
                aria-label={`Remove option ${oIdx + 1}`}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
          <button
            onClick={() => {
              const blanks = [...(data.blanks ?? [])];
              blanks[bIdx] = {
                ...blank,
                options: [...blank.options, { id: `ddo_${Date.now()}`, text: "" }],
              };
              onChange({ blanks });
            }}
            className="text-primary text-xs hover:underline"
          >
            + Add option
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Matching ────────────────────────────────────

function MatchingEditor({
  data,
  onChange,
}: {
  data: MatchingData;
  onChange: (u: Partial<MatchingData>) => void;
}) {
  const pairs: MatchingPair[] = data.pairs ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Switch
          checked={data.shufflePairs ?? false}
          onCheckedChange={(v) => onChange({ shufflePairs: v })}
          id="shuffle-pairs"
        />
        <Label htmlFor="shuffle-pairs" className="cursor-pointer text-sm">
          Shuffle pairs
        </Label>
      </div>
      {pairs.map((pair, idx) => (
        <div key={pair.id} className="flex items-center gap-2">
          <Input
            type="text"
            value={pair.left}
            onChange={(e) => {
              const updated = [...pairs];
              updated[idx] = { ...pair, left: e.target.value };
              onChange({ pairs: updated });
            }}
            placeholder="Left"
            className="h-8 flex-1"
          />
          <span className="text-muted-foreground">→</span>
          <Input
            type="text"
            value={pair.right}
            onChange={(e) => {
              const updated = [...pairs];
              updated[idx] = { ...pair, right: e.target.value };
              onChange({ pairs: updated });
            }}
            placeholder="Right"
            className="h-8 flex-1"
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onChange({ pairs: pairs.filter((_, i) => i !== idx) })}
            className="text-muted-foreground hover:text-destructive h-8 w-8"
            aria-label="Remove pair"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          onChange({
            pairs: [...pairs, { id: `pair_${Date.now()}`, left: "", right: "" }],
          })
        }
      >
        <Plus className="h-3 w-3" /> Add Pair
      </Button>
    </div>
  );
}

// ── Jumbled / Ordering ──────────────────────────

function JumbledEditor({
  data,
  onChange,
}: {
  data: JumbledData;
  onChange: (u: Partial<JumbledData>) => void;
}) {
  const items: JumbledItem[] = data.items ?? [];
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = items.findIndex((i) => i.id === active.id);
    const newIdx = items.findIndex((i) => i.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = [...items];
    const [moved] = reordered.splice(oldIdx, 1);
    reordered.splice(newIdx, 0, moved);
    onChange({
      items: reordered,
      correctOrder: reordered.map((i) => i.id),
    });
  };

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-xs">
        Drag items into the correct order. Students will see them shuffled.
      </p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          {items.map((item, idx) => (
            <JumbledRow
              key={item.id}
              item={item}
              idx={idx}
              onText={(t) => {
                const updated = [...items];
                updated[idx] = { ...item, text: t };
                onChange({
                  items: updated,
                  correctOrder: updated.map((i) => i.id),
                });
              }}
              onRemove={() => {
                const updated = items.filter((_, i) => i !== idx);
                onChange({
                  items: updated,
                  correctOrder: updated.map((i) => i.id),
                });
              }}
            />
          ))}
        </SortableContext>
      </DndContext>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          const newItem = { id: `jmb_${Date.now()}`, text: "" };
          const updated = [...items, newItem];
          onChange({
            items: updated,
            correctOrder: updated.map((i) => i.id),
          });
        }}
      >
        <Plus className="h-3 w-3" /> Add Item
      </Button>
    </div>
  );
}

function JumbledRow({
  item,
  idx,
  onText,
  onRemove,
}: {
  item: JumbledItem;
  idx: number;
  onText: (text: string) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2">
      <button
        {...attributes}
        {...listeners}
        className="text-muted-foreground hover:text-foreground cursor-grab"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <span className="text-muted-foreground w-6 font-mono text-xs">{idx + 1}.</span>
      <Input
        type="text"
        value={item.text}
        onChange={(e) => onText(e.target.value)}
        className="h-8 flex-1"
      />
      <Button
        variant="ghost"
        size="icon"
        onClick={onRemove}
        className="text-muted-foreground hover:text-destructive h-8 w-8"
        aria-label="Remove item"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

// ── Audio ───────────────────────────────────────

function AudioEditor({
  data,
  onChange,
}: {
  data: AudioData;
  onChange: (u: Partial<AudioData>) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <Label>Max Duration (seconds)</Label>
        <Input
          type="number"
          min={5}
          max={600}
          value={data.maxDurationSeconds ?? 120}
          onChange={(e) =>
            onChange({
              maxDurationSeconds: Math.max(5, Math.min(600, Number(e.target.value) || 120)),
            })
          }
          className="mt-1"
        />
      </div>
      <div>
        <Label>Language</Label>
        <Select
          value={data.language ?? "__none__"}
          onValueChange={(v) => onChange({ language: v === "__none__" ? undefined : v })}
        >
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Any" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Any</SelectItem>
            {AUDIO_LANGUAGES.map((l) => (
              <SelectItem key={l.value} value={l.value}>
                {l.label} ({l.value})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="sm:col-span-2">
        <Label>Evaluation Guidance</Label>
        <Textarea
          value={data.evaluationGuidance ?? ""}
          onChange={(e) => onChange({ evaluationGuidance: e.target.value || undefined })}
          rows={2}
          className="mt-1"
        />
      </div>
    </div>
  );
}

// ── Image Evaluation ────────────────────────────

function ImageEvalEditor({
  data,
  onChange,
}: {
  data: ImageEvaluationData;
  onChange: (u: Partial<ImageEvaluationData>) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <Label>Instructions</Label>
        <Textarea
          value={data.instructions}
          onChange={(e) => onChange({ instructions: e.target.value })}
          rows={3}
          className="mt-1"
        />
      </div>
      <div>
        <Label>Max Images</Label>
        <Input
          type="number"
          value={data.maxImages ?? 1}
          onChange={(e) =>
            onChange({ maxImages: Math.max(1, Math.min(10, Number(e.target.value) || 1)) })
          }
          min={1}
          max={10}
          className="mt-1 w-32"
        />
      </div>
      <div>
        <Label>Evaluation Guidance</Label>
        <Textarea
          value={data.evaluationGuidance ?? ""}
          onChange={(e) => onChange({ evaluationGuidance: e.target.value || undefined })}
          rows={2}
          className="mt-1"
        />
      </div>
    </div>
  );
}

// ── Group Options ───────────────────────────────

function GroupOptionsEditor({
  data,
  onChange,
}: {
  data: GroupOptionsData;
  onChange: (u: Partial<GroupOptionsData>) => void;
}) {
  const groups: GroupOptionsGroup[] = data.groups ?? [];
  const goItems: GOItem[] = data.items ?? [];

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between">
          <Label>Groups</Label>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              onChange({
                groups: [
                  ...groups,
                  {
                    id: `grp_${Date.now()}`,
                    name: `Group ${groups.length + 1}`,
                    correctItems: [],
                  },
                ],
              })
            }
          >
            <Plus className="h-3 w-3" /> Add Group
          </Button>
        </div>
        {groups.map((g, idx) => (
          <div key={g.id} className="mt-2 flex items-center gap-2">
            <Input
              type="text"
              value={g.name}
              onChange={(e) => {
                const updated = [...groups];
                updated[idx] = { ...g, name: e.target.value };
                onChange({ groups: updated });
              }}
              className="h-8 flex-1"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onChange({ groups: groups.filter((_, i) => i !== idx) })}
              className="text-muted-foreground hover:text-destructive h-8 w-8"
              aria-label="Remove group"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
      <div>
        <div className="flex items-center justify-between">
          <Label>Items</Label>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              onChange({
                items: [...goItems, { id: `gi_${Date.now()}`, text: "" }],
              })
            }
          >
            <Plus className="h-3 w-3" /> Add Item
          </Button>
        </div>
        {goItems.map((item, idx) => (
          <div key={item.id} className="mt-2 flex items-center gap-2">
            <Input
              type="text"
              value={item.text}
              onChange={(e) => {
                const updated = [...goItems];
                updated[idx] = { ...item, text: e.target.value };
                onChange({ items: updated });
              }}
              className="h-8 flex-1"
            />
            <Select
              value={groups.find((g) => g.correctItems.includes(item.id))?.id ?? "unassigned"}
              onValueChange={(v) => {
                const targetGroupId = v === "unassigned" ? "" : v;
                const updatedGroups = groups.map((g) => ({
                  ...g,
                  correctItems:
                    g.id === targetGroupId
                      ? [...g.correctItems.filter((id) => id !== item.id), item.id]
                      : g.correctItems.filter((id) => id !== item.id),
                }));
                onChange({ groups: updatedGroups });
              }}
            >
              <SelectTrigger className="h-8 w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                // P1-28: also remove this item id from any group's correctItems
                // so we don't leave orphan references.
                const cleanedGroups = groups.map((g) => ({
                  ...g,
                  correctItems: g.correctItems.filter((id) => id !== item.id),
                }));
                onChange({
                  items: goItems.filter((_, i) => i !== idx),
                  groups: cleanedGroups,
                });
              }}
              className="text-muted-foreground hover:text-destructive h-8 w-8"
              aria-label="Remove item"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Chat Agent ──────────────────────────────────

function ChatAgentEditor({
  data,
  onChange,
}: {
  data: ChatAgentQuestionData;
  onChange: (u: Partial<ChatAgentQuestionData>) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <Label>Agent ID (optional)</Label>
        <Input
          type="text"
          value={data.agentId ?? ""}
          onChange={(e) => onChange({ agentId: e.target.value || undefined })}
          className="mt-1 font-mono"
          placeholder="leave blank to use the space's default agent"
        />
        <p className="text-muted-foreground mt-1 text-xs">
          Configure agents in the &ldquo;Agent Config&rdquo; tab on the space, then paste the agent
          ID here.
        </p>
      </div>
      <div>
        <Label>Objectives (one per line)</Label>
        <Textarea
          value={data.objectives?.join("\n") ?? ""}
          onChange={(e) => onChange({ objectives: e.target.value.split("\n").filter(Boolean) })}
          rows={3}
          className="mt-1"
        />
      </div>
      <div>
        <Label>Conversation Starters (one per line)</Label>
        <Textarea
          value={data.conversationStarters?.join("\n") ?? ""}
          onChange={(e) =>
            onChange({
              conversationStarters: e.target.value.split("\n").filter(Boolean),
            })
          }
          rows={2}
          className="mt-1"
        />
      </div>
      <div>
        <Label>Max Turns</Label>
        <Input
          type="number"
          value={data.maxTurns ?? 10}
          onChange={(e) => onChange({ maxTurns: Number(e.target.value) })}
          min={1}
          className="mt-1 w-32"
        />
      </div>
      <div>
        <Label>Evaluation Guidance</Label>
        <Textarea
          value={data.evaluationGuidance ?? ""}
          onChange={(e) => onChange({ evaluationGuidance: e.target.value || undefined })}
          rows={2}
          className="mt-1"
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────
// Material Data Editor (all 7 types)
// ─────────────────────────────────────────────────

function MaterialDataEditor({
  materialType,
  data,
  onChange,
}: {
  materialType: MaterialType;
  data: MaterialPayload;
  onChange: (updates: Partial<MaterialPayload>) => void;
}) {
  switch (materialType) {
    case "text":
      return (
        <div>
          <Label>Text Content</Label>
          <Textarea
            value={data.content ?? ""}
            onChange={(e) => onChange({ content: e.target.value })}
            rows={8}
            className="mt-1"
          />
        </div>
      );
    case "video":
      return (
        <div className="space-y-3">
          <div>
            <Label>
              Video URL <span className="text-error">*</span>
            </Label>
            <Input
              type="url"
              value={data.url ?? ""}
              onChange={(e) => onChange({ url: e.target.value })}
              placeholder="https://youtube.com/watch?v=..."
              className="mt-1"
              aria-invalid={!isValidUrl(data.url ?? "")}
            />
            {!isValidUrl(data.url ?? "") && (data.url ?? "") !== "" && (
              <p className="text-error mt-1 text-xs">Must be a valid http(s) URL</p>
            )}
          </div>
          <div>
            <Label>Duration (seconds)</Label>
            <Input
              type="number"
              min={0}
              value={data.duration ?? 0}
              onChange={(e) => onChange({ duration: Math.max(0, Number(e.target.value) || 0) })}
              className="mt-1 w-32"
            />
          </div>
        </div>
      );
    case "pdf":
      return (
        <div className="space-y-3">
          <div>
            <Label>
              PDF URL <span className="text-error">*</span>
            </Label>
            <Input
              type="url"
              value={data.url ?? ""}
              onChange={(e) => onChange({ url: e.target.value })}
              className="mt-1"
              aria-invalid={!isValidUrl(data.url ?? "")}
            />
            {!isValidUrl(data.url ?? "") && (data.url ?? "") !== "" && (
              <p className="text-error mt-1 text-xs">Must be a valid http(s) URL</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={data.downloadable ?? false}
              onCheckedChange={(v) => onChange({ downloadable: v })}
              id="allow-download"
            />
            <Label htmlFor="allow-download" className="cursor-pointer text-sm">
              Allow download
            </Label>
          </div>
        </div>
      );
    case "link":
      return (
        <div>
          <Label>
            URL <span className="text-error">*</span>
          </Label>
          <Input
            type="url"
            value={data.url ?? ""}
            onChange={(e) => onChange({ url: e.target.value })}
            placeholder="https://..."
            className="mt-1"
            aria-invalid={!isValidUrl(data.url ?? "")}
          />
          {!isValidUrl(data.url ?? "") && (data.url ?? "") !== "" && (
            <p className="text-error mt-1 text-xs">Must be a valid http(s) URL</p>
          )}
        </div>
      );
    case "interactive":
      // Embed-able tool/simulation/demo. Distinct from `story`.
      return (
        <div className="space-y-3">
          <div>
            <Label>
              Embed URL <span className="text-error">*</span>
            </Label>
            <Input
              type="url"
              value={data.url ?? ""}
              onChange={(e) => onChange({ url: e.target.value })}
              className="mt-1"
              placeholder="https://your-tool.example/embed/..."
              aria-invalid={!isValidUrl(data.url ?? "")}
            />
            {!isValidUrl(data.url ?? "") && (data.url ?? "") !== "" && (
              <p className="text-error mt-1 text-xs">Must be a valid http(s) URL</p>
            )}
          </div>
          <div>
            <Label>Instructions for the learner</Label>
            <Textarea
              value={data.content ?? ""}
              onChange={(e) => onChange({ content: e.target.value })}
              rows={3}
              className="mt-1"
              placeholder="What should the learner do with this interactive?"
            />
          </div>
        </div>
      );
    case "story":
      // Long-form narrative content. Uses richContent blocks if available,
      // falls back to plain markdown content otherwise.
      return (
        <RichBlocksEditor
          data={data}
          onChange={onChange}
          contentLabel="Narrative (markdown)"
          contentRows={6}
          showCover
        />
      );
    case "rich":
      return (
        <RichBlocksEditor
          data={data}
          onChange={onChange}
          contentLabel="Body (markdown)"
          contentRows={6}
          showCover
        />
      );
    default:
      return (
        <p className="text-muted-foreground text-sm">No specific editor for this material type</p>
      );
  }
}

// ── Rich / Story material — block-based editor ───
function RichBlocksEditor({
  data,
  onChange,
  contentLabel,
  contentRows,
  showCover,
}: {
  data: MaterialPayload;
  onChange: (updates: Partial<MaterialPayload>) => void;
  contentLabel: string;
  contentRows: number;
  showCover?: boolean;
}) {
  const rich: RichContentBlock = data.richContent ?? { blocks: [] };

  const updateRich = (next: RichContentBlock) => {
    onChange({ richContent: next });
  };

  const addBlock = () => {
    const newBlock: RichContentBlockItem = {
      id: `blk_${Date.now()}`,
      type: "paragraph",
      content: "",
    };
    updateRich({ ...rich, blocks: [...rich.blocks, newBlock] });
  };

  const updateBlock = (idx: number, updates: Partial<RichContentBlockItem>) => {
    const blocks = rich.blocks.map((b, i) => (i === idx ? { ...b, ...updates } : b));
    updateRich({ ...rich, blocks });
  };

  const removeBlock = (idx: number) => {
    updateRich({ ...rich, blocks: rich.blocks.filter((_, i) => i !== idx) });
  };

  const moveBlock = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= rich.blocks.length) return;
    const blocks = [...rich.blocks];
    [blocks[idx], blocks[target]] = [blocks[target], blocks[idx]];
    updateRich({ ...rich, blocks });
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Title</Label>
          <Input
            type="text"
            value={rich.title ?? ""}
            onChange={(e) => updateRich({ ...rich, title: e.target.value || undefined })}
            className="mt-1"
          />
        </div>
        <div>
          <Label>Subtitle</Label>
          <Input
            type="text"
            value={rich.subtitle ?? ""}
            onChange={(e) => updateRich({ ...rich, subtitle: e.target.value || undefined })}
            className="mt-1"
          />
        </div>
        {showCover && (
          <div className="sm:col-span-2">
            <Label>Cover Image URL</Label>
            <Input
              type="url"
              value={rich.coverImage ?? ""}
              onChange={(e) => updateRich({ ...rich, coverImage: e.target.value || undefined })}
              className="mt-1"
              placeholder="https://..."
            />
          </div>
        )}
      </div>

      <div>
        <Label>{contentLabel}</Label>
        <Textarea
          value={data.content ?? ""}
          onChange={(e) => onChange({ content: e.target.value })}
          rows={contentRows}
          className="mt-1 font-mono text-sm"
          placeholder="Plain markdown — used when no blocks are defined"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Content Blocks</Label>
          <Button variant="outline" size="sm" onClick={addBlock}>
            <Plus className="h-3 w-3" /> Add Block
          </Button>
        </div>
        {rich.blocks.length === 0 ? (
          <p className="text-muted-foreground text-xs italic">
            No blocks. Use the markdown body above, or add structured blocks.
          </p>
        ) : (
          rich.blocks.map((b, idx) => (
            <div key={b.id} className="border-subtle space-y-2 rounded border p-2">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground w-6 font-mono text-xs">{idx + 1}</span>
                <Select
                  value={b.type}
                  onValueChange={(v) =>
                    updateBlock(idx, { type: v as RichContentBlockItem["type"] })
                  }
                >
                  <SelectTrigger className="h-7 w-32 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RICH_BLOCK_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => moveBlock(idx, -1)}
                  disabled={idx === 0}
                  className="h-7 w-7"
                  aria-label="Move up"
                >
                  ↑
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => moveBlock(idx, 1)}
                  disabled={idx === rich.blocks.length - 1}
                  className="h-7 w-7"
                  aria-label="Move down"
                >
                  ↓
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeBlock(idx)}
                  className="text-muted-foreground hover:text-destructive ml-auto h-7 w-7"
                  aria-label="Remove block"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              {b.type === "divider" ? (
                <p className="text-muted-foreground text-xs italic">Divider — no content</p>
              ) : b.type === "image" || b.type === "video" || b.type === "audio" ? (
                <Input
                  type="url"
                  value={b.content}
                  onChange={(e) => updateBlock(idx, { content: e.target.value })}
                  placeholder={`${b.type} URL`}
                  className="h-7 text-xs"
                />
              ) : b.type === "code" ? (
                <Textarea
                  value={b.content}
                  onChange={(e) => updateBlock(idx, { content: e.target.value })}
                  rows={4}
                  className="font-mono text-xs"
                  placeholder="Code content"
                />
              ) : (
                <Textarea
                  value={b.content}
                  onChange={(e) => updateBlock(idx, { content: e.target.value })}
                  rows={b.type === "heading" ? 1 : 3}
                  className="text-xs"
                  placeholder={`${b.type} content`}
                />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
