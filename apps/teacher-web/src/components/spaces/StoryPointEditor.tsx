import { useState } from "react";
import type {
  StoryPoint,
  StoryPointType,
  StoryPointSection,
  AssessmentConfig,
  AssessmentSchedule,
} from "@levelup/shared-types";
import { ArrowLeft, Save, Plus, Trash2 } from "lucide-react";
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
} from "@levelup/shared-ui";

const SP_TYPES: { value: StoryPointType; label: string }[] = [
  { value: "standard", label: "Standard" },
  { value: "timed_test", label: "Timed Test" },
  { value: "quiz", label: "Quiz" },
  { value: "practice", label: "Practice" },
  { value: "test", label: "Test" },
];

interface Props {
  storyPoint: StoryPoint;
  onSave: (sp: StoryPoint) => Promise<void>;
  onCancel: () => void;
}

export default function StoryPointEditor({ storyPoint, onSave, onCancel }: Props) {
  const [title, setTitle] = useState(storyPoint.title);
  const [description, setDescription] = useState(storyPoint.description ?? "");
  const [type, setType] = useState<StoryPointType>(storyPoint.type);
  const [difficulty, setDifficulty] = useState(storyPoint.difficulty ?? "medium");
  const [estimatedTime, setEstimatedTime] = useState(storyPoint.estimatedTimeMinutes ?? 0);
  const [sections, setSections] = useState<StoryPointSection[]>(storyPoint.sections ?? []);
  const [assessmentConfig, setAssessmentConfig] = useState<AssessmentConfig>(
    storyPoint.assessmentConfig ?? {}
  );
  const [saving, setSaving] = useState(false);

  const isAssessment = type === "timed_test" || type === "quiz" || type === "test";

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        ...storyPoint,
        title,
        description: description || undefined,
        type,
        difficulty: difficulty as StoryPoint["difficulty"],
        estimatedTimeMinutes: estimatedTime || undefined,
        sections,
        assessmentConfig: isAssessment ? assessmentConfig : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const addSection = () => {
    setSections((prev) => [
      ...prev,
      {
        id: `sec_${Date.now()}`,
        title: `Section ${prev.length + 1}`,
        orderIndex: prev.length,
      },
    ]);
  };

  const removeSection = (idx: number) => {
    setSections((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateSection = (idx: number, updates: Partial<StoryPointSection>) => {
    setSections((prev) => prev.map((s, i) => (i === idx ? { ...s, ...updates } : s)));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onCancel} aria-label="Go back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-display text-xl font-semibold">Edit Story Point</h1>
      </div>

      <div className="max-w-2xl space-y-5">
        <div>
          <Label className="text-fg-secondary">Title</Label>
          <Input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1"
          />
        </div>

        <div>
          <Label className="text-fg-secondary">Description</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="mt-1"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label className="text-fg-secondary">Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as StoryPointType)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SP_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-fg-secondary">Difficulty</Label>
            <Select value={difficulty} onValueChange={setDifficulty}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="hard">Hard</SelectItem>
                <SelectItem value="expert">Expert</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-fg-secondary">Est. Time (min)</Label>
            <Input
              type="number"
              value={estimatedTime}
              onChange={(e) => setEstimatedTime(Number(e.target.value))}
              min={0}
              className="mt-1"
            />
          </div>
        </div>

        {/* Assessment Config */}
        {isAssessment && (
          <div className="space-y-4 rounded-lg border p-4">
            <h3 className="font-display font-medium">Assessment Configuration</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label className="text-fg-secondary">Duration (min)</Label>
                <Input
                  type="number"
                  value={assessmentConfig.durationMinutes ?? 0}
                  onChange={(e) =>
                    setAssessmentConfig((p) => ({
                      ...p,
                      durationMinutes: Number(e.target.value) || undefined,
                    }))
                  }
                  min={0}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-fg-secondary">Max Attempts</Label>
                <Input
                  type="number"
                  value={assessmentConfig.maxAttempts ?? 1}
                  onChange={(e) =>
                    setAssessmentConfig((p) => ({
                      ...p,
                      maxAttempts: Number(e.target.value) || 1,
                    }))
                  }
                  min={1}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-fg-secondary">Passing % (0 = none)</Label>
                <Input
                  type="number"
                  value={assessmentConfig.passingPercentage ?? 0}
                  onChange={(e) =>
                    setAssessmentConfig((p) => ({
                      ...p,
                      passingPercentage: Number(e.target.value) || undefined,
                    }))
                  }
                  min={0}
                  max={100}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label className="text-fg-secondary">Instructions</Label>
              <Textarea
                value={assessmentConfig.instructions ?? ""}
                onChange={(e) =>
                  setAssessmentConfig((p) => ({
                    ...p,
                    instructions: e.target.value || undefined,
                  }))
                }
                rows={2}
                className="mt-1"
              />
            </div>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={assessmentConfig.shuffleQuestions ?? false}
                  onCheckedChange={(v) =>
                    setAssessmentConfig((p) => ({ ...p, shuffleQuestions: v }))
                  }
                  id="shuffle-questions"
                />
                <Label
                  htmlFor="shuffle-questions"
                  className="text-fg-secondary cursor-pointer text-sm"
                >
                  Shuffle questions
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={assessmentConfig.shuffleOptions ?? false}
                  onCheckedChange={(v) => setAssessmentConfig((p) => ({ ...p, shuffleOptions: v }))}
                  id="shuffle-options"
                />
                <Label
                  htmlFor="shuffle-options"
                  className="text-fg-secondary cursor-pointer text-sm"
                >
                  Shuffle options
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={assessmentConfig.showResultsImmediately ?? false}
                  onCheckedChange={(v) =>
                    setAssessmentConfig((p) => ({ ...p, showResultsImmediately: v }))
                  }
                  id="show-results"
                />
                <Label htmlFor="show-results" className="text-fg-secondary cursor-pointer text-sm">
                  Show results immediately
                </Label>
              </div>
            </div>

            {/* Schedule */}
            <div className="space-y-3 border-t pt-4">
              <h4 className="text-sm font-medium">Schedule (Optional)</h4>
              <p className="text-muted-foreground text-xs">
                Set availability windows. Students can only start tests within this window.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-fg-secondary">Available From</Label>
                  <Input
                    type="datetime-local"
                    value={
                      assessmentConfig.schedule?.startAt
                        ? new Date(
                            (assessmentConfig.schedule.startAt as unknown as { seconds: number })
                              .seconds * 1000
                          )
                            .toISOString()
                            .slice(0, 16)
                        : ""
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      setAssessmentConfig((p) => ({
                        ...p,
                        schedule: {
                          ...p.schedule,
                          startAt: val
                            ? ({
                                seconds: Math.floor(new Date(val).getTime() / 1000),
                                nanoseconds: 0,
                              } as unknown as AssessmentSchedule["startAt"])
                            : undefined,
                        },
                      }));
                    }}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-fg-secondary">Available Until</Label>
                  <Input
                    type="datetime-local"
                    value={
                      assessmentConfig.schedule?.endAt
                        ? new Date(
                            (assessmentConfig.schedule.endAt as unknown as { seconds: number })
                              .seconds * 1000
                          )
                            .toISOString()
                            .slice(0, 16)
                        : ""
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      setAssessmentConfig((p) => ({
                        ...p,
                        schedule: {
                          ...p.schedule,
                          endAt: val
                            ? ({
                                seconds: Math.floor(new Date(val).getTime() / 1000),
                                nanoseconds: 0,
                              } as unknown as AssessmentSchedule["endAt"])
                            : undefined,
                        },
                      }));
                    }}
                    className="mt-1"
                  />
                </div>
              </div>
              <div className="max-w-[200px]">
                <Label className="text-fg-secondary">Late Grace (min)</Label>
                <Input
                  type="number"
                  value={assessmentConfig.schedule?.lateSubmissionGraceMinutes ?? 0}
                  onChange={(e) =>
                    setAssessmentConfig((p) => ({
                      ...p,
                      schedule: {
                        ...p.schedule,
                        lateSubmissionGraceMinutes: Number(e.target.value) || undefined,
                      },
                    }))
                  }
                  min={0}
                  className="mt-1"
                />
              </div>
              {(assessmentConfig.schedule?.startAt || assessmentConfig.schedule?.endAt) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAssessmentConfig((p) => ({ ...p, schedule: undefined }))}
                >
                  Clear Schedule
                </Button>
              )}
            </div>

            {/* Retry Config */}
            <div className="space-y-3 border-t pt-4">
              <h4 className="text-sm font-medium">Retry Settings</h4>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-fg-secondary">Cooldown (min)</Label>
                  <Input
                    type="number"
                    value={assessmentConfig.retryConfig?.cooldownMinutes ?? 0}
                    onChange={(e) =>
                      setAssessmentConfig((p) => ({
                        ...p,
                        retryConfig: {
                          ...p.retryConfig,
                          cooldownMinutes: Number(e.target.value) || undefined,
                        },
                      }))
                    }
                    min={0}
                    className="mt-1"
                  />
                  <p className="text-muted-foreground mt-1 text-xs">
                    Minimum wait between attempts
                  </p>
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <Switch
                    checked={assessmentConfig.retryConfig?.lockAfterPassing ?? false}
                    onCheckedChange={(v) =>
                      setAssessmentConfig((p) => ({
                        ...p,
                        retryConfig: {
                          ...p.retryConfig,
                          lockAfterPassing: v,
                        },
                      }))
                    }
                    id="lock-after-pass"
                  />
                  <Label
                    htmlFor="lock-after-pass"
                    className="text-fg-secondary cursor-pointer text-sm"
                  >
                    Lock after passing
                  </Label>
                </div>
              </div>
            </div>

            {/* Adaptive Config */}
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={assessmentConfig.adaptiveConfig?.enabled ?? false}
                  onCheckedChange={(v) =>
                    setAssessmentConfig((p) => ({
                      ...p,
                      adaptiveConfig: {
                        ...p.adaptiveConfig,
                        enabled: v,
                        initialDifficulty: p.adaptiveConfig?.initialDifficulty ?? "medium",
                        difficultyAdjustment: p.adaptiveConfig?.difficultyAdjustment ?? "gradual",
                      },
                    }))
                  }
                  id="adaptive-enabled"
                />
                <Label
                  htmlFor="adaptive-enabled"
                  className="text-fg-secondary cursor-pointer text-sm font-medium"
                >
                  Adaptive Testing
                </Label>
              </div>
              {assessmentConfig.adaptiveConfig?.enabled && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label className="text-fg-secondary">Initial Difficulty</Label>
                    <Select
                      value={assessmentConfig.adaptiveConfig?.initialDifficulty ?? "medium"}
                      onValueChange={(v) =>
                        setAssessmentConfig((p) => ({
                          ...p,
                          adaptiveConfig: {
                            ...p.adaptiveConfig!,
                            initialDifficulty: v as "easy" | "medium" | "hard",
                          },
                        }))
                      }
                    >
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
                  <div>
                    <Label className="text-fg-secondary">Adjustment Mode</Label>
                    <Select
                      value={assessmentConfig.adaptiveConfig?.difficultyAdjustment ?? "gradual"}
                      onValueChange={(v) =>
                        setAssessmentConfig((p) => ({
                          ...p,
                          adaptiveConfig: {
                            ...p.adaptiveConfig!,
                            difficultyAdjustment: v as "gradual" | "aggressive",
                          },
                        }))
                      }
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gradual">Gradual (3 consecutive)</SelectItem>
                        <SelectItem value="aggressive">Aggressive (2 consecutive)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-fg-secondary">Min Questions/Difficulty</Label>
                    <Input
                      type="number"
                      value={assessmentConfig.adaptiveConfig?.minQuestionsPerDifficulty ?? 2}
                      onChange={(e) =>
                        setAssessmentConfig((p) => ({
                          ...p,
                          adaptiveConfig: {
                            ...p.adaptiveConfig!,
                            minQuestionsPerDifficulty: Number(e.target.value) || 2,
                          },
                        }))
                      }
                      min={1}
                      max={10}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-fg-secondary">Max Consecutive Same</Label>
                    <Input
                      type="number"
                      value={assessmentConfig.adaptiveConfig?.maxConsecutiveSameDifficulty ?? 5}
                      onChange={(e) =>
                        setAssessmentConfig((p) => ({
                          ...p,
                          adaptiveConfig: {
                            ...p.adaptiveConfig!,
                            maxConsecutiveSameDifficulty: Number(e.target.value) || 5,
                          },
                        }))
                      }
                      min={2}
                      max={20}
                      className="mt-1"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sections */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-medium">Sections ({sections.length})</h3>
            <Button variant="outline" size="sm" onClick={addSection}>
              <Plus className="h-3 w-3" /> Add Section
            </Button>
          </div>
          {sections.map((sec, idx) => (
            <div key={sec.id} className="flex items-center gap-2">
              <Input
                type="text"
                value={sec.title}
                onChange={(e) => updateSection(idx, { title: e.target.value })}
                className="h-8 flex-1"
                placeholder="Section title"
              />
              <Input
                type="text"
                value={sec.description ?? ""}
                onChange={(e) =>
                  updateSection(idx, {
                    description: e.target.value || undefined,
                  })
                }
                className="h-8 flex-1"
                placeholder="Description (optional)"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeSection(idx)}
                className="text-muted-foreground hover:text-destructive h-8 w-8"
                aria-label="Remove section"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>

        <Button onClick={handleSave} disabled={saving || !title.trim()}>
          <Save className="h-4 w-4" />
          {saving ? "Saving..." : "Save Story Point"}
        </Button>
      </div>
    </div>
  );
}
