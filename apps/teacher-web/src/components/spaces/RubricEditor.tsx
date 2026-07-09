import { useState, useEffect } from "react";
import type {
  UnifiedRubric,
  RubricScoringMode,
  RubricCriterion,
  EvaluationDimension,
} from "@levelup/shared-types";
import { Save, Plus, Trash2 } from "lucide-react";
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
} from "@levelup/shared-ui";

const SCORING_MODES: { value: RubricScoringMode; label: string; desc: string }[] = [
  {
    value: "criteria_based",
    label: "Criteria Based",
    desc: "Traditional rubric with criteria and levels",
  },
  {
    value: "dimension_based",
    label: "Dimension Based",
    desc: "AI evaluation dimensions with weights and scoring scales",
  },
  {
    value: "holistic",
    label: "Holistic",
    desc: "Single overall score with guidance text",
  },
  {
    value: "hybrid",
    label: "Hybrid",
    desc: "Combination of criteria and holistic scoring",
  },
];

interface Props {
  rubric?: UnifiedRubric;
  onSave: (rubric: UnifiedRubric) => void;
}

export default function RubricEditor({ rubric, onSave }: Props) {
  const [mode, setMode] = useState<RubricScoringMode>(rubric?.scoringMode ?? "criteria_based");
  const [criteria, setCriteria] = useState<RubricCriterion[]>(rubric?.criteria ?? []);
  const [dimensions, setDimensions] = useState<EvaluationDimension[]>(rubric?.dimensions ?? []);
  const [holisticGuidance, setHolisticGuidance] = useState(rubric?.holisticGuidance ?? "");
  const [holisticMaxScore, setHolisticMaxScore] = useState(rubric?.holisticMaxScore ?? 100);
  const [passingPercentage, setPassingPercentage] = useState(rubric?.passingPercentage ?? 40);
  const [evaluatorGuidance, setEvaluatorGuidance] = useState(rubric?.evaluatorGuidance ?? "");
  const [modelAnswer, setModelAnswer] = useState(rubric?.modelAnswer ?? "");

  useEffect(() => {
    if (rubric) {
      setMode(rubric.scoringMode);
      setCriteria(rubric.criteria ?? []);
      setDimensions(rubric.dimensions ?? []);
      setHolisticGuidance(rubric.holisticGuidance ?? "");
      setHolisticMaxScore(rubric.holisticMaxScore ?? 100);
      setPassingPercentage(rubric.passingPercentage ?? 40);
      setEvaluatorGuidance(rubric.evaluatorGuidance ?? "");
      setModelAnswer(rubric.modelAnswer ?? "");
    }
  }, [rubric]);

  const handleSave = () => {
    onSave({
      scoringMode: mode,
      criteria: mode === "criteria_based" || mode === "hybrid" ? criteria : undefined,
      dimensions: mode === "dimension_based" ? dimensions : undefined,
      holisticGuidance:
        mode === "holistic" || mode === "hybrid" ? holisticGuidance || undefined : undefined,
      holisticMaxScore: mode === "holistic" || mode === "hybrid" ? holisticMaxScore : undefined,
      passingPercentage,
      evaluatorGuidance: evaluatorGuidance || undefined,
      modelAnswer: modelAnswer || undefined,
    });
  };

  const addCriterion = () => {
    setCriteria((prev) => [
      ...prev,
      {
        id: `crit_${Date.now()}`,
        name: "",
        maxPoints: 10,
        levels: [
          { score: 0, label: "Missing", description: "" },
          { score: 5, label: "Partial", description: "" },
          { score: 10, label: "Excellent", description: "" },
        ],
      },
    ]);
  };

  const updateCriterion = (idx: number, updates: Partial<RubricCriterion>) => {
    setCriteria((prev) => prev.map((c, i) => (i === idx ? { ...c, ...updates } : c)));
  };

  const removeCriterion = (idx: number) => {
    setCriteria((prev) => prev.filter((_, i) => i !== idx));
  };

  const addDimension = () => {
    setDimensions((prev) => [
      ...prev,
      {
        id: `dim_${Date.now()}`,
        name: "",
        description: "",
        priority: "MEDIUM",
        promptGuidance: "",
        enabled: true,
        isDefault: false,
        isCustom: true,
        weight: 1,
        scoringScale: 10,
      },
    ]);
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Label>Scoring Mode</Label>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {SCORING_MODES.map((m) => (
            <button
              key={m.value}
              onClick={() => setMode(m.value)}
              className={`duration-fast ease-standard rounded-lg border p-3 text-left transition-colors ${
                mode === m.value
                  ? "border-brand bg-brand-subtle"
                  : "border-subtle hover:bg-surface-sunken/60"
              }`}
            >
              <p className="text-sm font-medium">{m.label}</p>
              <p className="text-muted-foreground text-xs">{m.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Criteria Based */}
      {(mode === "criteria_based" || mode === "hybrid") && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="tracking-caps text-fg-muted text-xs font-bold uppercase">Criteria</h3>
            <Button variant="outline" size="sm" onClick={addCriterion}>
              <Plus className="h-3 w-3" /> Add Criterion
            </Button>
          </div>
          {criteria.map((crit, idx) => (
            <div key={crit.id} className="border-subtle shadow-e1 space-y-3 rounded-lg border p-4">
              <div className="flex items-start gap-2">
                <div className="grid flex-1 gap-3 sm:grid-cols-3">
                  <div className="sm:col-span-2">
                    <Label className="text-xs">Name</Label>
                    <Input
                      type="text"
                      value={crit.name}
                      onChange={(e) => updateCriterion(idx, { name: e.target.value })}
                      className="mt-1 h-8"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Max Points</Label>
                    <Input
                      type="number"
                      value={crit.maxPoints}
                      onChange={(e) =>
                        updateCriterion(idx, {
                          maxPoints: Number(e.target.value),
                        })
                      }
                      className="mt-1 h-8 font-mono"
                    />
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeCriterion(idx)}
                  className="text-muted-foreground hover:text-destructive mt-5"
                  aria-label="Remove criterion"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div>
                <Label className="text-xs">Description</Label>
                <Input
                  type="text"
                  value={crit.description ?? ""}
                  onChange={(e) =>
                    updateCriterion(idx, {
                      description: e.target.value || undefined,
                    })
                  }
                  className="mt-1 h-8"
                />
              </div>
              {/* Levels */}
              <div className="space-y-1">
                <Label className="text-xs">Levels</Label>
                {(crit.levels ?? []).map((lvl, lIdx) => (
                  <div key={lIdx} className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={lvl.score}
                      onChange={(e) => {
                        const levels = [...(crit.levels ?? [])];
                        levels[lIdx] = {
                          ...lvl,
                          score: Number(e.target.value),
                        };
                        updateCriterion(idx, { levels });
                      }}
                      className="h-7 w-16 font-mono"
                    />
                    <Input
                      type="text"
                      value={lvl.label}
                      onChange={(e) => {
                        const levels = [...(crit.levels ?? [])];
                        levels[lIdx] = { ...lvl, label: e.target.value };
                        updateCriterion(idx, { levels });
                      }}
                      placeholder="Label"
                      className="h-7 w-28"
                    />
                    <Input
                      type="text"
                      value={lvl.description}
                      onChange={(e) => {
                        const levels = [...(crit.levels ?? [])];
                        levels[lIdx] = {
                          ...lvl,
                          description: e.target.value,
                        };
                        updateCriterion(idx, { levels });
                      }}
                      placeholder="Description"
                      className="h-7 flex-1"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        const levels = (crit.levels ?? []).filter((_, i) => i !== lIdx);
                        updateCriterion(idx, { levels });
                      }}
                      className="text-muted-foreground hover:text-destructive h-7 w-7"
                      aria-label="Remove level"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                <button
                  onClick={() => {
                    const levels = [
                      ...(crit.levels ?? []),
                      { score: 0, label: "", description: "" },
                    ];
                    updateCriterion(idx, { levels });
                  }}
                  className="text-primary text-xs hover:underline"
                >
                  + Add level
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dimension Based */}
      {mode === "dimension_based" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="tracking-caps text-fg-muted text-xs font-bold uppercase">
              Evaluation Dimensions
            </h3>
            <Button variant="outline" size="sm" onClick={addDimension}>
              <Plus className="h-3 w-3" /> Add Dimension
            </Button>
          </div>
          {dimensions.map((dim, idx) => (
            <div key={dim.id} className="border-subtle shadow-e1 space-y-3 rounded-lg border p-4">
              <div className="flex items-start gap-2">
                <div className="grid flex-1 gap-3 sm:grid-cols-3">
                  <div>
                    <Label className="text-xs">Name</Label>
                    <Input
                      type="text"
                      value={dim.name}
                      onChange={(e) => {
                        const updated = [...dimensions];
                        updated[idx] = { ...dim, name: e.target.value };
                        setDimensions(updated);
                      }}
                      className="mt-1 h-8"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Priority</Label>
                    <Select
                      value={dim.priority}
                      onValueChange={(v) => {
                        const updated = [...dimensions];
                        updated[idx] = { ...dim, priority: v as EvaluationDimension["priority"] };
                        setDimensions(updated);
                      }}
                    >
                      <SelectTrigger className="mt-1 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="HIGH">High</SelectItem>
                        <SelectItem value="MEDIUM">Medium</SelectItem>
                        <SelectItem value="LOW">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Label className="text-xs">Weight</Label>
                      <Input
                        type="number"
                        value={dim.weight}
                        onChange={(e) => {
                          const updated = [...dimensions];
                          updated[idx] = {
                            ...dim,
                            weight: Number(e.target.value),
                          };
                          setDimensions(updated);
                        }}
                        className="mt-1 h-8 font-mono"
                      />
                    </div>
                    <div className="flex-1">
                      <Label className="text-xs">Scale</Label>
                      <Input
                        type="number"
                        value={dim.scoringScale}
                        onChange={(e) => {
                          const updated = [...dimensions];
                          updated[idx] = {
                            ...dim,
                            scoringScale: Number(e.target.value),
                          };
                          setDimensions(updated);
                        }}
                        className="mt-1 h-8 font-mono"
                      />
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setDimensions(dimensions.filter((_, i) => i !== idx))}
                  className="text-muted-foreground hover:text-destructive mt-5"
                  aria-label="Remove dimension"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div>
                <Label className="text-xs">Description</Label>
                <Input
                  type="text"
                  value={dim.description}
                  onChange={(e) => {
                    const updated = [...dimensions];
                    updated[idx] = { ...dim, description: e.target.value };
                    setDimensions(updated);
                  }}
                  className="mt-1 h-8"
                />
              </div>
              <div>
                <Label className="text-xs">Prompt Guidance</Label>
                <Textarea
                  value={dim.promptGuidance}
                  onChange={(e) => {
                    const updated = [...dimensions];
                    updated[idx] = { ...dim, promptGuidance: e.target.value };
                    setDimensions(updated);
                  }}
                  rows={2}
                  className="mt-1"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Holistic */}
      {(mode === "holistic" || mode === "hybrid") && (
        <div className="space-y-3">
          <h3 className="tracking-caps text-fg-muted text-xs font-bold uppercase">
            Holistic Scoring
          </h3>
          <div>
            <Label>Max Score</Label>
            <Input
              type="number"
              value={holisticMaxScore}
              onChange={(e) => setHolisticMaxScore(Number(e.target.value))}
              className="mt-1 w-32 font-mono"
            />
          </div>
          <div>
            <Label>Guidance</Label>
            <Textarea
              value={holisticGuidance}
              onChange={(e) => setHolisticGuidance(e.target.value)}
              rows={4}
              className="mt-1"
            />
          </div>
        </div>
      )}

      {/* Shared settings */}
      <div className="border-subtle shadow-e1 space-y-3 rounded-lg border p-4">
        <h3 className="tracking-caps text-fg-muted text-xs font-bold uppercase">Shared Settings</h3>
        <div>
          <Label>Passing Percentage</Label>
          <Input
            type="number"
            value={passingPercentage}
            onChange={(e) => setPassingPercentage(Number(e.target.value))}
            min={0}
            max={100}
            className="mt-1 w-32 font-mono"
          />
        </div>
        <div>
          <Label>Evaluator Guidance</Label>
          <Textarea
            value={evaluatorGuidance}
            onChange={(e) => setEvaluatorGuidance(e.target.value)}
            rows={2}
            className="mt-1"
          />
        </div>
        <div>
          <Label>Model Answer</Label>
          <Textarea
            value={modelAnswer}
            onChange={(e) => setModelAnswer(e.target.value)}
            rows={3}
            className="mt-1"
          />
        </div>
      </div>

      <Button onClick={handleSave}>
        <Save className="h-4 w-4" /> Save Rubric
      </Button>
    </div>
  );
}
