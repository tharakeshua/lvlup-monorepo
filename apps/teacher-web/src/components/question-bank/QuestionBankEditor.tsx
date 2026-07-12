import { useState } from "react";
import {
  Button,
  Input,
  Label,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  Switch,
  Badge,
  sonnerToast as toast,
} from "@levelup/shared-ui";
import { Save, X, Plus, Trash2 } from "lucide-react";
import type { QuestionBankItem, BloomsLevel, QuestionType } from "@levelup/shared-types";
import { callSaveQuestionBankItem } from "@levelup/shared-services";

const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: "mcq", label: "Multiple Choice (MCQ)" },
  { value: "mcaq", label: "Multiple Correct (MCAQ)" },
  { value: "true-false", label: "True/False" },
  { value: "numerical", label: "Numerical" },
  { value: "text", label: "Short Text" },
  { value: "paragraph", label: "Paragraph" },
  { value: "code", label: "Code" },
  { value: "fill-blanks", label: "Fill Blanks" },
  { value: "fill-blanks-dd", label: "Fill Blanks Dropdown" },
  { value: "matching", label: "Matching" },
  { value: "jumbled", label: "Jumbled" },
  { value: "audio", label: "Audio" },
  { value: "image_evaluation", label: "Image Evaluation" },
  { value: "group-options", label: "Group Options" },
  { value: "chat_agent_question", label: "Chat Agent" },
];

const BLOOMS_LEVELS: BloomsLevel[] = [
  "remember",
  "understand",
  "apply",
  "analyze",
  "evaluate",
  "create",
];
const DIFFICULTY_OPTIONS = ["easy", "medium", "hard"] as const;

const CODE_LANGUAGES = ["python", "javascript", "java", "cpp", "c", "go", "rust"];

const AUDIO_LANGUAGES = [
  { value: "en-US", label: "English (US)" },
  { value: "en-IN", label: "English (India)" },
  { value: "hi-IN", label: "Hindi" },
  { value: "es-ES", label: "Spanish" },
  { value: "fr-FR", label: "French" },
  { value: "de-DE", label: "German" },
];

interface McqOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

interface FillBlank {
  id: string;
  correctAnswer: string;
  acceptableAnswers?: string[];
  caseSensitive?: boolean;
}

interface FillBlankDDOption {
  id: string;
  text: string;
}

interface FillBlankDD {
  id: string;
  correctOptionId: string;
  options: FillBlankDDOption[];
}

interface MatchingPair {
  id: string;
  left: string;
  right: string;
}

interface JumbledItem {
  id: string;
  text: string;
}

interface GroupItem {
  id: string;
  text: string;
}

interface GroupOptionsGroup {
  id: string;
  name: string;
  correctItems: string[];
}

interface CodeTestCase {
  id: string;
  input: string;
  expectedOutput: string;
  description?: string;
  points?: number;
  isHidden?: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  item?: QuestionBankItem | null;
  onSaved: () => void;
}

function uid() {
  return `id_${Math.random().toString(36).slice(2, 9)}`;
}

export default function QuestionBankEditor({ open, onOpenChange, tenantId, item, onSaved }: Props) {
  const isEditing = !!item?.id;
  const qd = (item?.questionData as Record<string, unknown>) ?? {};

  const [questionType, setQuestionType] = useState<QuestionType>(item?.questionType ?? "mcq");
  const [title, setTitle] = useState(item?.title ?? "");
  const [content, setContent] = useState(item?.content ?? "");
  const [explanation, setExplanation] = useState(item?.explanation ?? "");
  const [basePoints, setBasePoints] = useState(item?.basePoints ?? 1);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">(
    item?.difficulty ?? "medium"
  );
  const [bloomsLevel, setBloomsLevel] = useState<BloomsLevel | "">(item?.bloomsLevel ?? "");
  const [subject, setSubject] = useState(item?.subject ?? "");
  const [topicInput, setTopicInput] = useState("");
  const [topics, setTopics] = useState<string[]>(item?.topics ?? []);
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>(item?.tags ?? []);
  const [saving, setSaving] = useState(false);

  // ── MCQ / MCAQ ──────────────────────────────────────────────────────────────
  const [mcqOptions, setMcqOptions] = useState<McqOption[]>(() => {
    const opts = (qd.options as Array<{ id?: string; text: string; isCorrect?: boolean }>) ?? [];
    if (opts.length > 0) {
      return opts.map((o, i) => ({
        id: o.id ?? `opt_${i}`,
        text: o.text,
        isCorrect: o.isCorrect ?? false,
      }));
    }
    return [
      { id: "opt_1", text: "", isCorrect: true },
      { id: "opt_2", text: "", isCorrect: false },
    ];
  });

  // ── True/False ───────────────────────────────────────────────────────────────
  const [tfAnswer, setTfAnswer] = useState<boolean>((qd.correctAnswer as boolean) ?? true);

  // ── Numerical ────────────────────────────────────────────────────────────────
  const [numericalAnswer, setNumericalAnswer] = useState(
    String(qd.answer ?? qd.correctAnswer ?? "")
  );
  const [tolerance, setTolerance] = useState(String(qd.tolerance ?? "0"));
  const [numericalUnit, setNumericalUnit] = useState(String(qd.unit ?? ""));

  // ── Short Text ───────────────────────────────────────────────────────────────
  const [textCorrect, setTextCorrect] = useState(String(qd.correctAnswer ?? ""));
  const [textAcceptable, setTextAcceptable] = useState(
    ((qd.acceptableAnswers as string[]) ?? []).join("\n")
  );
  const [textCaseSensitive, setTextCaseSensitive] = useState(
    (qd.caseSensitive as boolean) ?? false
  );
  const [textMaxLength, setTextMaxLength] = useState((qd.maxLength as number) ?? 500);

  // ── Paragraph ────────────────────────────────────────────────────────────────
  const [paraMinLength, setParaMinLength] = useState((qd.minLength as number) ?? 0);
  const [paraMaxLength, setParaMaxLength] = useState((qd.maxLength as number) ?? 5000);
  const [paraModelAnswer, setParaModelAnswer] = useState(String(qd.modelAnswer ?? ""));
  const [paraGuidance, setParaGuidance] = useState(String(qd.evaluationGuidance ?? ""));

  // ── Code ─────────────────────────────────────────────────────────────────────
  const [codeLanguage, setCodeLanguage] = useState(String(qd.language ?? "python"));
  const [codeStarter, setCodeStarter] = useState(String(qd.starterCode ?? ""));
  const [codeTimeoutMs, setCodeTimeoutMs] = useState((qd.timeoutMs as number) ?? 5000);
  const [codeMemoryMb, setCodeMemoryMb] = useState((qd.memoryLimitMb as number) ?? 256);
  const [codeTestCases, setCodeTestCases] = useState<CodeTestCase[]>(() => {
    const raw = (qd.testCases as CodeTestCase[]) ?? [];
    return raw.length > 0 ? raw : [];
  });

  // ── Fill Blanks ───────────────────────────────────────────────────────────────
  const [fbTemplate, setFbTemplate] = useState(String(qd.textWithBlanks ?? ""));
  const [fbBlanks, setFbBlanks] = useState<FillBlank[]>(() => {
    const raw = (qd.blanks as FillBlank[]) ?? [];
    return raw.length > 0 ? raw : [];
  });

  // ── Fill Blanks DD ────────────────────────────────────────────────────────────
  const [fbddTemplate, setFbddTemplate] = useState(String(qd.textWithBlanks ?? ""));
  const [fbddBlanks, setFbddBlanks] = useState<FillBlankDD[]>(() => {
    const raw = (qd.blanks as FillBlankDD[]) ?? [];
    return raw.length > 0 ? raw : [];
  });

  // ── Matching ──────────────────────────────────────────────────────────────────
  const [matchPairs, setMatchPairs] = useState<MatchingPair[]>(() => {
    const raw = (qd.pairs as MatchingPair[]) ?? [];
    return raw.length > 0 ? raw : [];
  });
  const [matchShuffle, setMatchShuffle] = useState((qd.shufflePairs as boolean) ?? false);

  // ── Jumbled ───────────────────────────────────────────────────────────────────
  const [jumbledItems, setJumbledItems] = useState<JumbledItem[]>(() => {
    const raw = (qd.items as JumbledItem[]) ?? [];
    return raw.length > 0 ? raw : [];
  });

  // ── Audio ─────────────────────────────────────────────────────────────────────
  const [audioMaxSecs, setAudioMaxSecs] = useState((qd.maxDurationSeconds as number) ?? 120);
  const [audioLanguage, setAudioLanguage] = useState(String(qd.language ?? "__none__"));
  const [audioGuidance, setAudioGuidance] = useState(String(qd.evaluationGuidance ?? ""));

  // ── Image Evaluation ──────────────────────────────────────────────────────────
  const [imgInstructions, setImgInstructions] = useState(String(qd.instructions ?? ""));
  const [imgMaxImages, setImgMaxImages] = useState((qd.maxImages as number) ?? 1);
  const [imgGuidance, setImgGuidance] = useState(String(qd.evaluationGuidance ?? ""));

  // ── Group Options ─────────────────────────────────────────────────────────────
  const [goGroups, setGoGroups] = useState<GroupOptionsGroup[]>(() => {
    const raw = (qd.groups as GroupOptionsGroup[]) ?? [];
    return raw.length > 0 ? raw : [];
  });
  const [goItems, setGoItems] = useState<GroupItem[]>(() => {
    const raw = (qd.items as GroupItem[]) ?? [];
    return raw.length > 0 ? raw : [];
  });

  // ── Chat Agent ────────────────────────────────────────────────────────────────
  const [chatAgentId, setChatAgentId] = useState(String(qd.agentId ?? ""));
  const [chatObjectives, setChatObjectives] = useState(
    ((qd.objectives as string[]) ?? []).join("\n")
  );
  const [chatStarters, setChatStarters] = useState(
    ((qd.conversationStarters as string[]) ?? []).join("\n")
  );
  const [chatMaxTurns, setChatMaxTurns] = useState((qd.maxTurns as number) ?? 10);
  const [chatGuidance, setChatGuidance] = useState(String(qd.evaluationGuidance ?? ""));

  // ── helpers ───────────────────────────────────────────────────────────────────
  const addTopic = () => {
    const t = topicInput.trim();
    if (t && !topics.includes(t)) {
      setTopics([...topics, t]);
      setTopicInput("");
    }
  };
  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) {
      setTags([...tags, t]);
      setTagInput("");
    }
  };

  // ── buildQuestionData ─────────────────────────────────────────────────────────
  const buildQuestionData = (): Record<string, unknown> => {
    switch (questionType) {
      case "mcq":
      case "mcaq":
        return { options: mcqOptions };
      case "true-false":
        return { correctAnswer: tfAnswer };
      case "numerical":
        return {
          correctAnswer: Number(numericalAnswer),
          tolerance: Number(tolerance),
          ...(numericalUnit ? { unit: numericalUnit } : {}),
        };
      case "text":
        return {
          correctAnswer: textCorrect,
          acceptableAnswers: textAcceptable
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
          caseSensitive: textCaseSensitive,
          maxLength: textMaxLength,
        };
      case "paragraph":
        return {
          minLength: paraMinLength,
          maxLength: paraMaxLength,
          ...(paraModelAnswer ? { modelAnswer: paraModelAnswer } : {}),
          ...(paraGuidance ? { evaluationGuidance: paraGuidance } : {}),
        };
      case "code":
        return {
          language: codeLanguage,
          ...(codeStarter ? { starterCode: codeStarter } : {}),
          timeoutMs: codeTimeoutMs,
          memoryLimitMb: codeMemoryMb,
          testCases: codeTestCases,
        };
      case "fill-blanks":
        return { textWithBlanks: fbTemplate, blanks: fbBlanks };
      case "fill-blanks-dd":
        return { textWithBlanks: fbddTemplate, blanks: fbddBlanks };
      case "matching":
        return { pairs: matchPairs, shufflePairs: matchShuffle };
      case "jumbled":
        return { items: jumbledItems, correctOrder: jumbledItems.map((i) => i.id) };
      case "audio":
        return {
          maxDurationSeconds: audioMaxSecs,
          ...(audioLanguage !== "__none__" ? { language: audioLanguage } : {}),
          ...(audioGuidance ? { evaluationGuidance: audioGuidance } : {}),
        };
      case "image_evaluation":
        return {
          instructions: imgInstructions,
          maxImages: imgMaxImages,
          ...(imgGuidance ? { evaluationGuidance: imgGuidance } : {}),
        };
      case "group-options":
        return { groups: goGroups, items: goItems };
      case "chat_agent_question":
        return {
          ...(chatAgentId ? { agentId: chatAgentId } : {}),
          objectives: chatObjectives.split("\n").filter(Boolean),
          conversationStarters: chatStarters.split("\n").filter(Boolean),
          maxTurns: chatMaxTurns,
          ...(chatGuidance ? { evaluationGuidance: chatGuidance } : {}),
        };
      default:
        return item?.questionData ?? {};
    }
  };

  // ── validate ──────────────────────────────────────────────────────────────────
  const validate = (): string | null => {
    if (!content.trim()) return "Question content is required";
    if (!difficulty) return "Difficulty is required";
    if (!subject.trim()) return "Subject is required";
    if (questionType === "mcq" || questionType === "mcaq") {
      if (mcqOptions.length < 2) return "MCQ requires at least 2 options";
      if (!mcqOptions.some((o) => o.isCorrect)) return "At least one correct answer is required";
      if (mcqOptions.some((o) => !o.text.trim())) return "All options must have text";
    }
    if (questionType === "fill-blanks" && !fbTemplate.trim())
      return "Fill-Blanks requires a template";
    if (questionType === "fill-blanks-dd" && !fbddTemplate.trim())
      return "Fill-Blanks Dropdown requires a template";
    if (questionType === "image_evaluation" && !imgInstructions.trim())
      return "Image Evaluation requires instructions";
    return null;
  };

  // ── save ──────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    const error = validate();
    if (error) {
      toast.error(error);
      return;
    }
    setSaving(true);
    try {
      await callSaveQuestionBankItem({
        id: item?.id,
        tenantId,
        data: {
          questionType,
          title: title || undefined,
          content,
          explanation: explanation || undefined,
          basePoints,
          questionData: buildQuestionData(),
          subject,
          topics,
          difficulty,
          bloomsLevel: bloomsLevel || undefined,
          tags,
        },
      });
      toast.success(isEditing ? "Question updated" : "Question created");
      onSaved();
      onOpenChange(false);
    } catch {
      toast.error("Failed to save question");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl" aria-describedby={undefined}>
        <SheetHeader>
          <SheetTitle className="font-display">
            {isEditing ? "Edit Question" : "Create Question"}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-5">
          {/* Question Type */}
          <div>
            <Label>Question Type</Label>
            <Select value={questionType} onValueChange={(v) => setQuestionType(v as QuestionType)}>
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

          {/* Title */}
          <div>
            <Label>Title (optional)</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Question title"
              className="mt-1"
            />
          </div>

          {/* Content */}
          <div>
            <Label>Question Content *</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter the question text..."
              rows={4}
              className="mt-1"
            />
          </div>

          {/* ── Type-specific editors ── */}

          {(questionType === "mcq" || questionType === "mcaq") && (
            <div className="border-subtle space-y-3 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <Label>Options</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setMcqOptions((prev) => [...prev, { id: uid(), text: "", isCorrect: false }])
                  }
                >
                  <Plus className="h-3 w-3" /> Add Option
                </Button>
              </div>
              {mcqOptions.map((opt, idx) => (
                <div key={opt.id} className="flex items-center gap-2">
                  <div className="flex flex-shrink-0 items-center gap-1.5">
                    <Switch
                      checked={opt.isCorrect}
                      onCheckedChange={(v) =>
                        setMcqOptions((prev) =>
                          prev.map((o, i) =>
                            i === idx
                              ? { ...o, isCorrect: v }
                              : questionType === "mcq" && v
                                ? { ...o, isCorrect: false }
                                : o
                          )
                        )
                      }
                    />
                    <span className="text-success w-7 text-xs">{opt.isCorrect ? "✓" : ""}</span>
                  </div>
                  <Input
                    value={opt.text}
                    onChange={(e) =>
                      setMcqOptions((prev) =>
                        prev.map((o, i) => (i === idx ? { ...o, text: e.target.value } : o))
                      )
                    }
                    placeholder={`Option ${idx + 1}`}
                    className="flex-1"
                  />
                  {mcqOptions.length > 2 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setMcqOptions((prev) => prev.filter((_, i) => i !== idx))}
                      aria-label="Remove option"
                    >
                      <Trash2 className="text-destructive h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          {questionType === "true-false" && (
            <div className="border-subtle rounded-lg border p-4">
              <Label>Correct Answer</Label>
              <Select
                value={tfAnswer ? "true" : "false"}
                onValueChange={(v) => setTfAnswer(v === "true")}
              >
                <SelectTrigger className="mt-1 w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">True</SelectItem>
                  <SelectItem value="false">False</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {questionType === "numerical" && (
            <div className="border-subtle grid gap-4 rounded-lg border p-4 sm:grid-cols-3">
              <div>
                <Label>Correct Answer</Label>
                <Input
                  type="number"
                  value={numericalAnswer}
                  onChange={(e) => setNumericalAnswer(e.target.value)}
                  className="mt-1 font-mono"
                />
              </div>
              <div>
                <Label>Tolerance (±)</Label>
                <Input
                  type="number"
                  value={tolerance}
                  onChange={(e) => setTolerance(e.target.value)}
                  min={0}
                  step={0.01}
                  className="mt-1 font-mono"
                />
              </div>
              <div>
                <Label>Unit (optional)</Label>
                <Input
                  value={numericalUnit}
                  onChange={(e) => setNumericalUnit(e.target.value)}
                  placeholder="e.g. kg, m/s"
                  className="mt-1"
                />
              </div>
            </div>
          )}

          {questionType === "text" && (
            <div className="border-subtle space-y-3 rounded-lg border p-4">
              <div>
                <Label>Correct Answer</Label>
                <Input
                  value={textCorrect}
                  onChange={(e) => setTextCorrect(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Acceptable Answers (one per line)</Label>
                <Textarea
                  value={textAcceptable}
                  onChange={(e) => setTextAcceptable(e.target.value)}
                  rows={2}
                  className="mt-1"
                  placeholder="Each line is a separate accepted answer"
                />
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={textCaseSensitive}
                    onCheckedChange={setTextCaseSensitive}
                    id="qb-case-sensitive"
                  />
                  <Label htmlFor="qb-case-sensitive" className="cursor-pointer text-sm">
                    Case sensitive
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-sm">Max Length</Label>
                  <Input
                    type="number"
                    value={textMaxLength}
                    onChange={(e) => setTextMaxLength(Number(e.target.value))}
                    className="h-8 w-24 font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {questionType === "paragraph" && (
            <div className="border-subtle space-y-3 rounded-lg border p-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Min Length</Label>
                  <Input
                    type="number"
                    value={paraMinLength}
                    onChange={(e) => setParaMinLength(Number(e.target.value))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Max Length</Label>
                  <Input
                    type="number"
                    value={paraMaxLength}
                    onChange={(e) => setParaMaxLength(Number(e.target.value))}
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <Label>Model Answer</Label>
                <Textarea
                  value={paraModelAnswer}
                  onChange={(e) => setParaModelAnswer(e.target.value)}
                  rows={3}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Evaluation Guidance (for AI)</Label>
                <Textarea
                  value={paraGuidance}
                  onChange={(e) => setParaGuidance(e.target.value)}
                  rows={2}
                  className="mt-1"
                />
              </div>
            </div>
          )}

          {questionType === "code" && (
            <div className="border-subtle space-y-3 rounded-lg border p-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label>Language</Label>
                  <Select value={codeLanguage} onValueChange={setCodeLanguage}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CODE_LANGUAGES.map((l) => (
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
                    value={codeTimeoutMs}
                    onChange={(e) =>
                      setCodeTimeoutMs(Math.max(100, Number(e.target.value) || 5000))
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Memory (MB)</Label>
                  <Input
                    type="number"
                    min={16}
                    max={2048}
                    value={codeMemoryMb}
                    onChange={(e) => setCodeMemoryMb(Math.max(16, Number(e.target.value) || 256))}
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <Label>Starter Code</Label>
                <Textarea
                  value={codeStarter}
                  onChange={(e) => setCodeStarter(e.target.value)}
                  rows={4}
                  className="mt-1 font-mono"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Test Cases</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCodeTestCases((prev) => [
                        ...prev,
                        { id: uid(), input: "", expectedOutput: "" },
                      ])
                    }
                  >
                    <Plus className="h-3 w-3" /> Add
                  </Button>
                </div>
                {codeTestCases.map((tc, idx) => (
                  <div key={tc.id} className="border-subtle space-y-2 rounded border p-2">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground w-12 font-mono text-xs">
                        #{idx + 1}
                      </span>
                      <Input
                        value={tc.description ?? ""}
                        onChange={(e) => {
                          const u = [...codeTestCases];
                          u[idx] = { ...tc, description: e.target.value || undefined };
                          setCodeTestCases(u);
                        }}
                        placeholder="Description (optional)"
                        className="h-7 flex-1 text-xs"
                      />
                      <div className="flex items-center gap-1">
                        <Switch
                          checked={tc.isHidden ?? false}
                          onCheckedChange={(v) => {
                            const u = [...codeTestCases];
                            u[idx] = { ...tc, isHidden: v };
                            setCodeTestCases(u);
                          }}
                          id={`tc-hidden-${tc.id}`}
                        />
                        <Label htmlFor={`tc-hidden-${tc.id}`} className="cursor-pointer text-xs">
                          Hidden
                        </Label>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setCodeTestCases((prev) => prev.filter((_, i) => i !== idx))}
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
                          const u = [...codeTestCases];
                          u[idx] = { ...tc, input: e.target.value };
                          setCodeTestCases(u);
                        }}
                        placeholder="Input"
                        rows={1}
                        className="flex-1 font-mono text-xs"
                      />
                      <Textarea
                        value={tc.expectedOutput}
                        onChange={(e) => {
                          const u = [...codeTestCases];
                          u[idx] = { ...tc, expectedOutput: e.target.value };
                          setCodeTestCases(u);
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
          )}

          {questionType === "fill-blanks" && (
            <div className="border-subtle space-y-3 rounded-lg border p-4">
              <div>
                <Label>Text with Blanks (use ___1___, ___2___ etc.)</Label>
                <Textarea
                  value={fbTemplate}
                  onChange={(e) => setFbTemplate(e.target.value)}
                  rows={3}
                  className="mt-1"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Blanks</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setFbBlanks((prev) => [...prev, { id: uid(), correctAnswer: "" }])
                    }
                  >
                    <Plus className="h-3 w-3" /> Add
                  </Button>
                </div>
                {fbBlanks.map((b, idx) => (
                  <div key={b.id} className="border-subtle space-y-2 rounded border p-2">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground w-8 font-mono text-xs">
                        #{idx + 1}
                      </span>
                      <Input
                        value={b.correctAnswer}
                        onChange={(e) => {
                          const u = [...fbBlanks];
                          u[idx] = { ...b, correctAnswer: e.target.value };
                          setFbBlanks(u);
                        }}
                        placeholder="Correct answer"
                        className="h-8 flex-1"
                      />
                      <div className="flex items-center gap-1">
                        <Switch
                          checked={b.caseSensitive ?? false}
                          onCheckedChange={(v) => {
                            const u = [...fbBlanks];
                            u[idx] = { ...b, caseSensitive: v };
                            setFbBlanks(u);
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
                        onClick={() => setFbBlanks((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-muted-foreground hover:text-destructive h-8 w-8"
                        aria-label="Remove blank"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <Input
                      value={(b.acceptableAnswers ?? []).join(", ")}
                      onChange={(e) => {
                        const u = [...fbBlanks];
                        u[idx] = {
                          ...b,
                          acceptableAnswers: e.target.value
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean),
                        };
                        setFbBlanks(u);
                      }}
                      placeholder="Other acceptable answers (comma-separated)"
                      className="h-7 text-xs"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {questionType === "fill-blanks-dd" && (
            <div className="border-subtle space-y-3 rounded-lg border p-4">
              <div>
                <Label>Text with Blanks</Label>
                <Textarea
                  value={fbddTemplate}
                  onChange={(e) => setFbddTemplate(e.target.value)}
                  rows={3}
                  className="mt-1"
                />
              </div>
              <p className="text-muted-foreground text-xs">
                Each blank has a dropdown of options. Select the radio button for the correct
                option.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setFbddBlanks((prev) => [
                    ...prev,
                    { id: uid(), correctOptionId: "", options: [{ id: uid(), text: "" }] },
                  ])
                }
              >
                <Plus className="h-3 w-3" /> Add Blank
              </Button>
              {fbddBlanks.map((blank, bIdx) => (
                <div key={blank.id} className="border-subtle space-y-2 rounded border p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">Blank #{bIdx + 1}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setFbddBlanks((prev) => prev.filter((_, i) => i !== bIdx))}
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
                          const u = [...fbddBlanks];
                          u[bIdx] = { ...blank, correctOptionId: opt.id };
                          setFbddBlanks(u);
                        }}
                        aria-label={`Correct option ${oIdx + 1}`}
                      />
                      <Input
                        value={opt.text}
                        onChange={(e) => {
                          const u = [...fbddBlanks];
                          const opts = [...blank.options];
                          opts[oIdx] = { ...opt, text: e.target.value };
                          u[bIdx] = { ...blank, options: opts };
                          setFbddBlanks(u);
                        }}
                        className="h-7 flex-1 text-xs"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          const u = [...fbddBlanks];
                          const opts = blank.options.filter((_, i) => i !== oIdx);
                          const correctOptionId =
                            blank.correctOptionId === opt.id ? "" : blank.correctOptionId;
                          u[bIdx] = { ...blank, options: opts, correctOptionId };
                          setFbddBlanks(u);
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
                      const u = [...fbddBlanks];
                      u[bIdx] = { ...blank, options: [...blank.options, { id: uid(), text: "" }] };
                      setFbddBlanks(u);
                    }}
                    className="text-primary text-xs hover:underline"
                  >
                    + Add option
                  </button>
                </div>
              ))}
            </div>
          )}

          {questionType === "matching" && (
            <div className="border-subtle space-y-3 rounded-lg border p-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={matchShuffle}
                  onCheckedChange={setMatchShuffle}
                  id="qb-shuffle-pairs"
                />
                <Label htmlFor="qb-shuffle-pairs" className="cursor-pointer text-sm">
                  Shuffle pairs
                </Label>
              </div>
              {matchPairs.map((pair, idx) => (
                <div key={pair.id} className="flex items-center gap-2">
                  <Input
                    value={pair.left}
                    onChange={(e) => {
                      const u = [...matchPairs];
                      u[idx] = { ...pair, left: e.target.value };
                      setMatchPairs(u);
                    }}
                    placeholder="Left"
                    className="h-8 flex-1"
                  />
                  <span className="text-muted-foreground">→</span>
                  <Input
                    value={pair.right}
                    onChange={(e) => {
                      const u = [...matchPairs];
                      u[idx] = { ...pair, right: e.target.value };
                      setMatchPairs(u);
                    }}
                    placeholder="Right"
                    className="h-8 flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setMatchPairs((prev) => prev.filter((_, i) => i !== idx))}
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
                  setMatchPairs((prev) => [...prev, { id: uid(), left: "", right: "" }])
                }
              >
                <Plus className="h-3 w-3" /> Add Pair
              </Button>
            </div>
          )}

          {questionType === "jumbled" && (
            <div className="border-subtle space-y-3 rounded-lg border p-4">
              <p className="text-muted-foreground text-xs">
                Add items in the correct order. Students will see them shuffled.
              </p>
              {jumbledItems.map((item, idx) => (
                <div key={item.id} className="flex items-center gap-2">
                  <span className="text-muted-foreground w-6 font-mono text-xs">{idx + 1}.</span>
                  <Input
                    value={item.text}
                    onChange={(e) => {
                      const u = [...jumbledItems];
                      u[idx] = { ...item, text: e.target.value };
                      setJumbledItems(u);
                    }}
                    className="h-8 flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setJumbledItems((prev) => prev.filter((_, i) => i !== idx))}
                    className="text-muted-foreground hover:text-destructive h-8 w-8"
                    aria-label="Remove item"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setJumbledItems((prev) => [...prev, { id: uid(), text: "" }])}
              >
                <Plus className="h-3 w-3" /> Add Item
              </Button>
            </div>
          )}

          {questionType === "audio" && (
            <div className="border-subtle grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
              <div>
                <Label>Max Duration (seconds)</Label>
                <Input
                  type="number"
                  min={5}
                  max={600}
                  value={audioMaxSecs}
                  onChange={(e) =>
                    setAudioMaxSecs(Math.max(5, Math.min(600, Number(e.target.value) || 120)))
                  }
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Language</Label>
                <Select value={audioLanguage} onValueChange={setAudioLanguage}>
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
                  value={audioGuidance}
                  onChange={(e) => setAudioGuidance(e.target.value)}
                  rows={2}
                  className="mt-1"
                />
              </div>
            </div>
          )}

          {questionType === "image_evaluation" && (
            <div className="border-subtle space-y-3 rounded-lg border p-4">
              <div>
                <Label>Instructions *</Label>
                <Textarea
                  value={imgInstructions}
                  onChange={(e) => setImgInstructions(e.target.value)}
                  rows={3}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Max Images</Label>
                <Input
                  type="number"
                  value={imgMaxImages}
                  onChange={(e) =>
                    setImgMaxImages(Math.max(1, Math.min(10, Number(e.target.value) || 1)))
                  }
                  min={1}
                  max={10}
                  className="mt-1 w-32"
                />
              </div>
              <div>
                <Label>Evaluation Guidance</Label>
                <Textarea
                  value={imgGuidance}
                  onChange={(e) => setImgGuidance(e.target.value)}
                  rows={2}
                  className="mt-1"
                />
              </div>
            </div>
          )}

          {questionType === "group-options" && (
            <div className="border-subtle space-y-4 rounded-lg border p-4">
              <div>
                <div className="flex items-center justify-between">
                  <Label>Groups</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setGoGroups((prev) => [
                        ...prev,
                        { id: uid(), name: `Group ${prev.length + 1}`, correctItems: [] },
                      ])
                    }
                  >
                    <Plus className="h-3 w-3" /> Add Group
                  </Button>
                </div>
                {goGroups.map((g, idx) => (
                  <div key={g.id} className="mt-2 flex items-center gap-2">
                    <Input
                      value={g.name}
                      onChange={(e) => {
                        const u = [...goGroups];
                        u[idx] = { ...g, name: e.target.value };
                        setGoGroups(u);
                      }}
                      className="h-8 flex-1"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setGoGroups((prev) => prev.filter((_, i) => i !== idx))}
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
                    onClick={() => setGoItems((prev) => [...prev, { id: uid(), text: "" }])}
                  >
                    <Plus className="h-3 w-3" /> Add Item
                  </Button>
                </div>
                {goItems.map((item, idx) => (
                  <div key={item.id} className="mt-2 flex items-center gap-2">
                    <Input
                      value={item.text}
                      onChange={(e) => {
                        const u = [...goItems];
                        u[idx] = { ...item, text: e.target.value };
                        setGoItems(u);
                      }}
                      className="h-8 flex-1"
                    />
                    <Select
                      value={
                        goGroups.find((g) => g.correctItems.includes(item.id))?.id ?? "unassigned"
                      }
                      onValueChange={(v) => {
                        const targetGroupId = v === "unassigned" ? "" : v;
                        setGoGroups(
                          goGroups.map((g) => ({
                            ...g,
                            correctItems:
                              g.id === targetGroupId
                                ? [...g.correctItems.filter((id) => id !== item.id), item.id]
                                : g.correctItems.filter((id) => id !== item.id),
                          }))
                        );
                      }}
                    >
                      <SelectTrigger className="h-8 w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {goGroups.map((g) => (
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
                        const cleanedGroups = goGroups.map((g) => ({
                          ...g,
                          correctItems: g.correctItems.filter((id) => id !== item.id),
                        }));
                        setGoGroups(cleanedGroups);
                        setGoItems((prev) => prev.filter((_, i) => i !== idx));
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
          )}

          {questionType === "chat_agent_question" && (
            <div className="border-subtle space-y-3 rounded-lg border p-4">
              <div>
                <Label>Agent ID (optional)</Label>
                <Input
                  value={chatAgentId}
                  onChange={(e) => setChatAgentId(e.target.value)}
                  className="mt-1 font-mono"
                  placeholder="leave blank to use the space's default agent"
                />
              </div>
              <div>
                <Label>Objectives (one per line)</Label>
                <Textarea
                  value={chatObjectives}
                  onChange={(e) => setChatObjectives(e.target.value)}
                  rows={3}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Conversation Starters (one per line)</Label>
                <Textarea
                  value={chatStarters}
                  onChange={(e) => setChatStarters(e.target.value)}
                  rows={2}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Max Turns</Label>
                <Input
                  type="number"
                  value={chatMaxTurns}
                  onChange={(e) => setChatMaxTurns(Number(e.target.value))}
                  min={1}
                  className="mt-1 w-32"
                />
              </div>
              <div>
                <Label>Evaluation Guidance</Label>
                <Textarea
                  value={chatGuidance}
                  onChange={(e) => setChatGuidance(e.target.value)}
                  rows={2}
                  className="mt-1"
                />
              </div>
            </div>
          )}

          {/* Classification */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label>Subject *</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Math"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Difficulty *</Label>
              <Select
                value={difficulty}
                onValueChange={(v) => setDifficulty(v as "easy" | "medium" | "hard")}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIFFICULTY_OPTIONS.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d.charAt(0).toUpperCase() + d.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Bloom&apos;s Level</Label>
              <Select
                value={bloomsLevel}
                onValueChange={(v) => setBloomsLevel(v as BloomsLevel | "")}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {BLOOMS_LEVELS.map((l) => (
                    <SelectItem key={l} value={l}>
                      {l.charAt(0).toUpperCase() + l.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Base Points</Label>
            <Input
              type="number"
              value={basePoints}
              onChange={(e) => setBasePoints(Number(e.target.value) || 1)}
              min={1}
              className="mt-1 w-24 font-mono"
            />
          </div>

          {/* Topics */}
          <div>
            <Label>Topics</Label>
            <div className="mt-1 flex gap-2">
              <Input
                value={topicInput}
                onChange={(e) => setTopicInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTopic())}
                placeholder="Add topic..."
                className="flex-1"
              />
              <Button variant="outline" size="sm" onClick={addTopic}>
                Add
              </Button>
            </div>
            {topics.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {topics.map((t) => (
                  <Badge key={t} variant="secondary" className="gap-1 text-xs">
                    {t}
                    <button
                      onClick={() => setTopics(topics.filter((x) => x !== t))}
                      className="ml-1"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Tags */}
          <div>
            <Label>Tags</Label>
            <div className="mt-1 flex gap-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                placeholder="Add tag..."
                className="flex-1"
              />
              <Button variant="outline" size="sm" onClick={addTag}>
                Add
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {tags.map((t) => (
                  <Badge key={t} variant="secondary" className="gap-1 text-xs">
                    {t}
                    <button onClick={() => setTags(tags.filter((x) => x !== t))} className="ml-1">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Explanation */}
          <div>
            <Label>Explanation / Solution</Label>
            <Textarea
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="Explain the correct answer..."
              rows={3}
              className="mt-1"
            />
          </div>
        </div>

        <SheetFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : isEditing ? "Update" : "Create"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
