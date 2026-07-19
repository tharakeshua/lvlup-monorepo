import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AssessmentConfig,
  StoryPoint,
  StoryPointSection,
  StoryPointType,
} from "@levelup/domain";
import { asSectionId } from "@levelup/domain";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  GripVertical,
  Loader2,
  Plus,
  Save,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
} from "@levelup/shared-ui";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  fromLocalDateTimeValue,
  hasStoryPointErrors,
  normalizeAssessmentConfig,
  normalizeSections,
  normalizeStoryPointForEditing,
  reorderSections,
  toLocalDateTimeValue,
  usesAssessmentSettings,
  validateStoryPointDraft,
} from "./story-point-editor-model";

const SP_TYPES: ReadonlyArray<{ value: StoryPointType; label: string; hint: string }> = [
  { value: "standard", label: "Standard", hint: "Lessons and mixed content" },
  { value: "practice", label: "Practice", hint: "Repeatable skill building" },
  { value: "quiz", label: "Quiz", hint: "Short graded check" },
  { value: "timed_test", label: "Timed test", hint: "Time-bound assessment" },
];

type SaveStatus = "saved" | "unsaved" | "saving" | "error";

interface Props {
  storyPoint: StoryPoint;
  onSave: (storyPoint: StoryPoint) => Promise<void>;
  onAutoSave?: (storyPoint: StoryPoint) => Promise<void>;
  onCancel: () => void;
}

interface SectionRowProps {
  section: StoryPointSection;
  index: number;
  count: number;
  error?: string;
  confirmingDelete: boolean;
  onChange: (updates: Partial<StoryPointSection>) => void;
  onMove: (toIndex: number) => void;
  onRequestDelete: () => void;
  onCancelDelete: () => void;
  onDelete: () => void;
}

function SectionRow({
  section,
  index,
  count,
  error,
  confirmingDelete,
  onChange,
  onMove,
  onRequestDelete,
  onCancelDelete,
  onDelete,
}: SectionRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
  });

  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`bg-background rounded-lg border p-3 ${isDragging ? "ring-brand/40 shadow-md ring-2" : ""}`}
      aria-label={`Section ${index + 1}: ${section.title || "Untitled"}`}
    >
      <div className="flex items-start gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-muted-foreground mt-0.5 h-9 w-9 shrink-0 cursor-grab touch-none active:cursor-grabbing"
          aria-label={`Drag ${section.title || `section ${index + 1}`} to reorder`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </Button>

        <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor={`section-title-${section.id}`}>Section title</Label>
            <Input
              id={`section-title-${section.id}`}
              value={section.title}
              onChange={(event) => onChange({ title: event.target.value })}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? `section-error-${section.id}` : undefined}
              className="mt-1"
            />
            {error && (
              <p
                id={`section-error-${section.id}`}
                className="text-destructive mt-1 text-xs"
                role="alert"
              >
                {error}
              </p>
            )}
          </div>
          <div>
            <Label htmlFor={`section-description-${section.id}`}>
              Description <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id={`section-description-${section.id}`}
              value={section.description ?? ""}
              onChange={(event) =>
                onChange({
                  description: event.target.value.trim() ? event.target.value : undefined,
                })
              }
              className="mt-1"
            />
          </div>
        </div>

        <div className="flex shrink-0 items-center">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => onMove(index - 1)}
            disabled={index === 0}
            aria-label={`Move ${section.title || "section"} up`}
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => onMove(index + 1)}
            disabled={index === count - 1}
            aria-label={`Move ${section.title || "section"} down`}
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-destructive h-9 w-9"
            onClick={onRequestDelete}
            aria-label={`Remove ${section.title || "section"}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {confirmingDelete && (
        <div
          className="border-destructive/30 bg-destructive/5 mt-3 flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
          role="alertdialog"
          aria-labelledby={`remove-section-${section.id}`}
        >
          <p id={`remove-section-${section.id}`} className="text-sm">
            Remove “{section.title || "Untitled section"}”? Its items will become unsectioned.
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onCancelDelete}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" size="sm" onClick={onDelete}>
              Remove section
            </Button>
          </div>
        </div>
      )}
    </article>
  );
}

function draftSnapshot(storyPoint: StoryPoint): string {
  return JSON.stringify({
    title: storyPoint.title,
    description: storyPoint.description,
    type: storyPoint.type,
    difficulty: storyPoint.difficulty,
    estimatedTimeMinutes: storyPoint.estimatedTimeMinutes,
    sections: storyPoint.sections,
    assessmentConfig: storyPoint.assessmentConfig,
  });
}

export default function StoryPointEditor({ storyPoint, onSave, onAutoSave, onCancel }: Props) {
  const normalizedStoryPoint = useMemo(
    () => normalizeStoryPointForEditing(storyPoint),
    [storyPoint]
  );
  const [title, setTitle] = useState(normalizedStoryPoint.title);
  const [description, setDescription] = useState(normalizedStoryPoint.description ?? "");
  const [type, setType] = useState<StoryPointType>(normalizedStoryPoint.type);
  const [difficulty, setDifficulty] = useState<NonNullable<StoryPoint["difficulty"]>>(
    normalizedStoryPoint.difficulty ?? "medium"
  );
  const [estimatedTime, setEstimatedTime] = useState(
    normalizedStoryPoint.estimatedTimeMinutes ?? 0
  );
  const [sections, setSections] = useState<StoryPointSection[]>(normalizedStoryPoint.sections);
  const [assessmentConfig, setAssessmentConfig] = useState<AssessmentConfig>(
    normalizedStoryPoint.assessmentConfig ?? {}
  );
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [saveError, setSaveError] = useState("");
  const [sectionPendingDelete, setSectionPendingDelete] = useState<string | null>(null);
  const lastSavedSnapshot = useRef(draftSnapshot(normalizedStoryPoint));
  const autoSaveSequence = useRef(0);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    const normalized = normalizeStoryPointForEditing(storyPoint);
    setTitle(normalized.title);
    setDescription(normalized.description ?? "");
    setType(normalized.type);
    setDifficulty(normalized.difficulty ?? "medium");
    setEstimatedTime(normalized.estimatedTimeMinutes ?? 0);
    setSections(normalized.sections);
    setAssessmentConfig(normalized.assessmentConfig ?? {});
    setSaveStatus("saved");
    setSaveError("");
    setSectionPendingDelete(null);
    lastSavedSnapshot.current = draftSnapshot(normalized);
  }, [storyPoint.id]);

  const isAssessment = usesAssessmentSettings(type);
  const draft = useMemo<StoryPoint>(
    () => ({
      ...normalizedStoryPoint,
      title: title.trim(),
      description: description.trim() || undefined,
      type,
      difficulty,
      estimatedTimeMinutes: estimatedTime || undefined,
      sections: normalizeSections(sections),
      assessmentConfig: isAssessment ? normalizeAssessmentConfig(assessmentConfig) : undefined,
    }),
    [
      assessmentConfig,
      description,
      difficulty,
      estimatedTime,
      isAssessment,
      normalizedStoryPoint,
      sections,
      title,
      type,
    ]
  );
  const errors = useMemo(() => validateStoryPointDraft(draft), [draft]);
  const hasErrors = hasStoryPointErrors(errors);
  const snapshot = useMemo(() => draftSnapshot(draft), [draft]);
  const isDirty = snapshot !== lastSavedSnapshot.current;

  useEffect(() => {
    if (!onAutoSave || !isDirty || hasErrors || saving) return;
    setSaveStatus("unsaved");
    const sequence = ++autoSaveSequence.current;
    const timeout = window.setTimeout(async () => {
      setSaveStatus("saving");
      setSaveError("");
      try {
        await onAutoSave(draft);
        if (sequence !== autoSaveSequence.current) return;
        lastSavedSnapshot.current = snapshot;
        setSaveStatus("saved");
      } catch (error) {
        if (sequence !== autoSaveSequence.current) return;
        setSaveStatus("error");
        setSaveError(error instanceof Error ? error.message : "Autosave failed. Try saving again.");
      }
    }, 900);
    return () => window.clearTimeout(timeout);
  }, [draft, hasErrors, isDirty, onAutoSave, saving, snapshot]);

  const handleSave = useCallback(async () => {
    if (hasErrors || saving) return;
    autoSaveSequence.current += 1;
    setSaving(true);
    setSaveStatus("saving");
    setSaveError("");
    try {
      await onSave(draft);
      lastSavedSnapshot.current = snapshot;
      setSaveStatus("saved");
    } catch (error) {
      setSaveStatus("error");
      setSaveError(error instanceof Error ? error.message : "Could not save this story point.");
    } finally {
      setSaving(false);
    }
  }, [draft, hasErrors, onSave, saving, snapshot]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === "s") {
        event.preventDefault();
        void handleSave();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSave]);

  const handleAddSection = () => {
    const uniqueId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setSections((current) => [
      ...normalizeSections(current),
      {
        id: asSectionId(`section_${uniqueId}`),
        title: `Section ${current.length + 1}`,
        orderIndex: current.length,
      },
    ]);
  };

  const handleMoveSection = (fromIndex: number, toIndex: number) => {
    setSections((current) => reorderSections(current, fromIndex, toIndex));
  };

  const handleSectionDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const fromIndex = sections.findIndex((section) => section.id === active.id);
    const toIndex = sections.findIndex((section) => section.id === over.id);
    handleMoveSection(fromIndex, toIndex);
  };

  const updateAssessmentConfig = (updates: Partial<AssessmentConfig>) => {
    setAssessmentConfig((current) => ({ ...current, ...updates }));
  };

  const statusContent = {
    saved: (
      <>
        <Check className="h-3.5 w-3.5" /> Saved
      </>
    ),
    unsaved: <>Unsaved changes</>,
    saving: (
      <>
        <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" /> Saving…
      </>
    ),
    error: (
      <>
        <TriangleAlert className="h-3.5 w-3.5" /> Save failed
      </>
    ),
  } satisfies Record<SaveStatus, React.ReactNode>;

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        void handleSave();
      }}
    >
      <header className="flex flex-wrap items-center gap-3 border-b pb-4">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onCancel}
          aria-label="Close editor"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <h2 className="font-display truncate text-xl font-semibold">Story point details</h2>
          <p className="text-muted-foreground text-xs">Changes autosave after a short pause.</p>
        </div>
        <div
          className={`flex items-center gap-1.5 text-xs ${
            saveStatus === "error"
              ? "text-destructive"
              : saveStatus === "saved"
                ? "text-success"
                : "text-muted-foreground"
          }`}
          aria-live="polite"
        >
          {statusContent[saveStatus]}
        </div>
      </header>

      {saveError && (
        <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-md border p-3 text-sm">
          {saveError}
        </div>
      )}

      <section className="space-y-5" aria-labelledby="story-point-basics">
        <div>
          <h3 id="story-point-basics" className="font-display font-semibold">
            Basics
          </h3>
          <p className="text-muted-foreground text-sm">
            Name this step and choose how students will experience it.
          </p>
        </div>
        <div>
          <Label htmlFor="story-point-title">Title</Label>
          <Input
            id="story-point-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="mt-1"
            autoFocus
            aria-invalid={Boolean(errors.title)}
            aria-describedby={errors.title ? "story-point-title-error" : undefined}
          />
          {errors.title && (
            <p id="story-point-title-error" className="text-destructive mt-1 text-xs" role="alert">
              {errors.title}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="story-point-description">
            Description <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            id="story-point-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            className="mt-1 resize-y"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="story-point-type">Experience type</Label>
            <Select value={type} onValueChange={(value) => setType(value as StoryPointType)}>
              <SelectTrigger id="story-point-type" className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SP_TYPES.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <span className="flex flex-col">
                      <span>{option.label}</span>
                      <span className="text-muted-foreground text-xs">{option.hint}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="story-point-difficulty">Difficulty</Label>
            <Select
              value={difficulty}
              onValueChange={(value) =>
                setDifficulty(value as NonNullable<StoryPoint["difficulty"]>)
              }
            >
              <SelectTrigger id="story-point-difficulty" className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="hard">Hard</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="story-point-time">Estimated minutes</Label>
            <Input
              id="story-point-time"
              type="number"
              inputMode="numeric"
              value={estimatedTime}
              onChange={(event) => setEstimatedTime(Math.max(0, Number(event.target.value)))}
              min={0}
              className="mt-1"
            />
          </div>
        </div>
      </section>

      {isAssessment && (
        <section className="space-y-5 border-t pt-5" aria-labelledby="assessment-settings">
          <div>
            <h3 id="assessment-settings" className="font-display font-semibold">
              Assessment settings
            </h3>
            <p className="text-muted-foreground text-sm">
              Control attempts, question order, availability, and adaptive difficulty.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="assessment-duration">Duration (minutes)</Label>
              <Input
                id="assessment-duration"
                type="number"
                inputMode="numeric"
                value={assessmentConfig.durationMinutes ?? ""}
                onChange={(event) =>
                  updateAssessmentConfig({
                    durationMinutes: event.target.value
                      ? Math.max(1, Number(event.target.value))
                      : undefined,
                  })
                }
                min={1}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="assessment-attempts">Maximum attempts</Label>
              <Input
                id="assessment-attempts"
                type="number"
                inputMode="numeric"
                value={assessmentConfig.maxAttempts ?? ""}
                onChange={(event) =>
                  updateAssessmentConfig({
                    maxAttempts: event.target.value
                      ? Math.max(1, Number(event.target.value))
                      : undefined,
                  })
                }
                min={1}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="assessment-passing">Passing score (%)</Label>
              <Input
                id="assessment-passing"
                type="number"
                inputMode="numeric"
                value={assessmentConfig.passingPercentage ?? ""}
                onChange={(event) =>
                  updateAssessmentConfig({
                    passingPercentage: event.target.value
                      ? Math.min(100, Math.max(0, Number(event.target.value)))
                      : undefined,
                  })
                }
                min={0}
                max={100}
                className="mt-1"
              />
            </div>
          </div>

          <div className="bg-muted/40 flex items-start justify-between gap-4 rounded-lg border p-3">
            <div>
              <Label htmlFor="shuffle-questions" className="font-medium">
                Shuffle questions
              </Label>
              <p className="text-muted-foreground text-xs">
                Each attempt receives a different question order.
              </p>
            </div>
            <Switch
              id="shuffle-questions"
              checked={assessmentConfig.shuffle ?? false}
              onCheckedChange={(shuffle) => updateAssessmentConfig({ shuffle })}
            />
          </div>

          <fieldset className="space-y-3 rounded-lg border p-4">
            <legend className="px-1 text-sm font-semibold">Availability window</legend>
            <p className="text-muted-foreground text-xs">
              Leave either field empty for an open-ended schedule.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="schedule-opens">Opens</Label>
                <Input
                  id="schedule-opens"
                  type="datetime-local"
                  value={toLocalDateTimeValue(assessmentConfig.schedule?.opensAt)}
                  onChange={(event) =>
                    updateAssessmentConfig({
                      schedule: {
                        opensAt: fromLocalDateTimeValue(event.target.value),
                        closesAt: assessmentConfig.schedule?.closesAt ?? null,
                      },
                    })
                  }
                  className="mt-1"
                  aria-invalid={Boolean(errors.schedule)}
                  aria-describedby={errors.schedule ? "schedule-error" : undefined}
                />
              </div>
              <div>
                <Label htmlFor="schedule-closes">Closes</Label>
                <Input
                  id="schedule-closes"
                  type="datetime-local"
                  value={toLocalDateTimeValue(assessmentConfig.schedule?.closesAt)}
                  onChange={(event) =>
                    updateAssessmentConfig({
                      schedule: {
                        opensAt: assessmentConfig.schedule?.opensAt ?? null,
                        closesAt: fromLocalDateTimeValue(event.target.value),
                      },
                    })
                  }
                  className="mt-1"
                  aria-invalid={Boolean(errors.schedule)}
                  aria-describedby={errors.schedule ? "schedule-error" : undefined}
                />
              </div>
            </div>
            {errors.schedule && (
              <p id="schedule-error" className="text-destructive text-xs" role="alert">
                {errors.schedule}
              </p>
            )}
            {assessmentConfig.schedule && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => updateAssessmentConfig({ schedule: undefined })}
              >
                Clear schedule
              </Button>
            )}
          </fieldset>

          <fieldset className="space-y-4 rounded-lg border p-4">
            <legend className="px-1 text-sm font-semibold">Retry rules</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="retry-cooldown">Cooldown between attempts (minutes)</Label>
                <Input
                  id="retry-cooldown"
                  type="number"
                  inputMode="numeric"
                  value={assessmentConfig.retryConfig?.cooldownMinutes ?? ""}
                  onChange={(event) =>
                    updateAssessmentConfig({
                      retryConfig: {
                        ...assessmentConfig.retryConfig,
                        cooldownMinutes: event.target.value
                          ? Math.max(0, Number(event.target.value))
                          : undefined,
                      },
                    })
                  }
                  min={0}
                  className="mt-1"
                />
              </div>
              <div className="bg-muted/40 flex items-center justify-between gap-4 rounded-md p-3">
                <Label htmlFor="lock-after-pass">Lock after passing</Label>
                <Switch
                  id="lock-after-pass"
                  checked={assessmentConfig.retryConfig?.lockAfterPassing ?? false}
                  onCheckedChange={(lockAfterPassing) =>
                    updateAssessmentConfig({
                      retryConfig: { ...assessmentConfig.retryConfig, lockAfterPassing },
                    })
                  }
                />
              </div>
            </div>
          </fieldset>

          <fieldset className="space-y-4 rounded-lg border p-4">
            <legend className="px-1 text-sm font-semibold">Adaptive difficulty</legend>
            <div className="flex items-start justify-between gap-4">
              <div>
                <Label htmlFor="adaptive-enabled">Adjust difficulty from student performance</Label>
                <p className="text-muted-foreground text-xs">
                  Step up after correct answers and step down after missed answers.
                </p>
              </div>
              <Switch
                id="adaptive-enabled"
                checked={assessmentConfig.adaptiveConfig?.enabled ?? false}
                onCheckedChange={(enabled) =>
                  updateAssessmentConfig({
                    adaptiveConfig: {
                      ...assessmentConfig.adaptiveConfig,
                      enabled,
                      startingDifficulty:
                        assessmentConfig.adaptiveConfig?.startingDifficulty ?? "medium",
                    },
                  })
                }
              />
            </div>
            {assessmentConfig.adaptiveConfig?.enabled && (
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label htmlFor="adaptive-start">Starting difficulty</Label>
                  <Select
                    value={assessmentConfig.adaptiveConfig.startingDifficulty ?? "medium"}
                    onValueChange={(value) =>
                      updateAssessmentConfig({
                        adaptiveConfig: {
                          ...assessmentConfig.adaptiveConfig!,
                          startingDifficulty: value as "easy" | "medium" | "hard",
                        },
                      })
                    }
                  >
                    <SelectTrigger id="adaptive-start" className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="adaptive-step-up">Correct to step up</Label>
                  <Input
                    id="adaptive-step-up"
                    type="number"
                    inputMode="numeric"
                    value={assessmentConfig.adaptiveConfig.stepUpThreshold ?? 3}
                    onChange={(event) =>
                      updateAssessmentConfig({
                        adaptiveConfig: {
                          ...assessmentConfig.adaptiveConfig!,
                          stepUpThreshold: Math.max(1, Number(event.target.value)),
                        },
                      })
                    }
                    min={1}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="adaptive-step-down">Missed to step down</Label>
                  <Input
                    id="adaptive-step-down"
                    type="number"
                    inputMode="numeric"
                    value={assessmentConfig.adaptiveConfig.stepDownThreshold ?? 2}
                    onChange={(event) =>
                      updateAssessmentConfig({
                        adaptiveConfig: {
                          ...assessmentConfig.adaptiveConfig!,
                          stepDownThreshold: Math.max(1, Number(event.target.value)),
                        },
                      })
                    }
                    min={1}
                    className="mt-1"
                  />
                </div>
              </div>
            )}
          </fieldset>
        </section>
      )}

      <section className="space-y-3 border-t pt-5" aria-labelledby="story-point-sections">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 id="story-point-sections" className="font-display font-semibold">
              Sections <span className="text-muted-foreground">({sections.length})</span>
            </h3>
            <p className="text-muted-foreground text-sm">
              Drag sections or use the arrow buttons to change their order.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={handleAddSection}>
            <Plus className="h-4 w-4" /> Add section
          </Button>
        </div>

        {sections.length === 0 ? (
          <div className="rounded-lg border border-dashed px-4 py-8 text-center">
            <p className="font-medium">No sections yet</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Items can remain unsectioned, or you can group them into a learning sequence.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddSection}
              className="mt-3"
            >
              <Plus className="h-4 w-4" /> Create first section
            </Button>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleSectionDragEnd}
          >
            <SortableContext
              items={sections.map((section) => section.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {sections.map((section, index) => (
                  <SectionRow
                    key={section.id}
                    section={section}
                    index={index}
                    count={sections.length}
                    error={errors.sections?.[section.id]}
                    confirmingDelete={sectionPendingDelete === section.id}
                    onChange={(updates) =>
                      setSections((current) =>
                        current.map((candidate) =>
                          candidate.id === section.id ? { ...candidate, ...updates } : candidate
                        )
                      )
                    }
                    onMove={(toIndex) => handleMoveSection(index, toIndex)}
                    onRequestDelete={() => setSectionPendingDelete(section.id)}
                    onCancelDelete={() => setSectionPendingDelete(null)}
                    onDelete={() => {
                      setSections((current) =>
                        normalizeSections(
                          current.filter((candidate) => candidate.id !== section.id)
                        )
                      );
                      setSectionPendingDelete(null);
                    }}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </section>

      <footer className="bg-background/95 sticky bottom-0 -mx-1 flex flex-col-reverse gap-2 border-t px-1 py-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-xs">Keyboard shortcut: Ctrl/⌘ + S</p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Close
          </Button>
          <Button
            type="submit"
            disabled={saving || hasErrors || (!isDirty && saveStatus === "saved")}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? "Saving…" : "Save now"}
          </Button>
        </div>
      </footer>
    </form>
  );
}
