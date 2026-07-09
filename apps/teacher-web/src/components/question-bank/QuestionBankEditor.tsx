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

interface McqOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  item?: QuestionBankItem | null;
  onSaved: () => void;
}

export default function QuestionBankEditor({ open, onOpenChange, tenantId, item, onSaved }: Props) {
  const isEditing = !!item?.id;

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

  // MCQ-specific state
  const [mcqOptions, setMcqOptions] = useState<McqOption[]>(() => {
    const qd = item?.questionData as Record<string, unknown> | undefined;
    const opts = (qd?.options as Array<{ id?: string; text: string; isCorrect?: boolean }>) ?? [];
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

  // True/False state
  const [correctAnswer, setCorrectAnswer] = useState<boolean>(
    ((item?.questionData as Record<string, unknown>)?.correctAnswer as boolean) ?? true
  );

  // Numerical state
  const [numericalAnswer, setNumericalAnswer] = useState<string>(
    String((item?.questionData as Record<string, unknown>)?.answer ?? "")
  );
  const [tolerance, setTolerance] = useState<string>(
    String((item?.questionData as Record<string, unknown>)?.tolerance ?? "0")
  );

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

  const buildQuestionData = (): Record<string, unknown> => {
    switch (questionType) {
      case "mcq":
      case "mcaq":
        return { options: mcqOptions };
      case "true-false":
        return { correctAnswer };
      case "numerical":
        return { answer: Number(numericalAnswer), tolerance: Number(tolerance) };
      default:
        return item?.questionData ?? {};
    }
  };

  const validate = (): string | null => {
    if (!content.trim()) return "Question content is required";
    if (!difficulty) return "Difficulty is required";
    if (!subject.trim()) return "Subject is required";
    if (questionType === "mcq" || questionType === "mcaq") {
      if (mcqOptions.length < 2) return "MCQ requires at least 2 options";
      if (!mcqOptions.some((o) => o.isCorrect)) return "At least one correct answer is required";
      if (mcqOptions.some((o) => !o.text.trim())) return "All options must have text";
    }
    return null;
  };

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

          {/* Type-specific editors */}
          {(questionType === "mcq" || questionType === "mcaq") && (
            <div className="border-subtle space-y-3 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <Label>Options</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setMcqOptions((prev) => [
                      ...prev,
                      { id: `opt_${Date.now()}`, text: "", isCorrect: false },
                    ])
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
                value={correctAnswer ? "true" : "false"}
                onValueChange={(v) => setCorrectAnswer(v === "true")}
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
            <div className="border-subtle grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
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
