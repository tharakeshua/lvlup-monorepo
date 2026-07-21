import { useState } from "react";
import {
  useRubricPresets,
  useSaveRubricPreset,
  useEvaluationSettings,
  useSaveEvaluationSettings,
  useSpaces,
  useAgents,
  useSaveAgent,
  useApiError,
} from "@levelup/query";
import type { RubricPreset, RubricPresetCategory, UnifiedRubric } from "@levelup/shared-types";
import type { EvaluationSettings } from "@levelup/shared-types";
import type { Agent } from "@levelup/shared-types";
import type { Space } from "@levelup/shared-types";
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
  Skeleton,
  sonnerToast,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbPage,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Card,
  CardContent,
  Switch,
} from "@levelup/shared-ui";
import {
  Plus,
  Pencil,
  Trash2,
  FileText,
  BookOpen,
  Code2,
  FlaskConical,
  Calculator,
  Languages,
  Layers,
  Settings2,
  Bot,
  ChevronDown,
} from "lucide-react";
import ConfirmDialog from "../components/shared/ConfirmDialog";

// ── helpers ──────────────────────────────────────────────────────────────────

/** Normalize list hook results: bare array | `{items}` | `{pages:[{items}]}` */
function asArray<T>(data: unknown): T[] {
  if (!data) return [];
  if (Array.isArray(data)) return data as T[];
  const d = data as Record<string, unknown>;
  if (Array.isArray(d["items"])) return d["items"] as T[];
  if (Array.isArray(d["pages"])) {
    return (d["pages"] as Array<{ items?: T[] }>).flatMap((p) => p.items ?? []) as T[];
  }
  return [];
}

// ── Rubric Presets section ────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<RubricPresetCategory, string> = {
  general: "General",
  math: "Mathematics",
  science: "Science",
  language: "Language",
  coding: "Coding",
  essay: "Essay",
  custom: "Custom",
};

const CATEGORY_ICONS: Record<RubricPresetCategory, React.ReactNode> = {
  general: <Layers className="h-4 w-4" />,
  math: <Calculator className="h-4 w-4" />,
  science: <FlaskConical className="h-4 w-4" />,
  language: <Languages className="h-4 w-4" />,
  coding: <Code2 className="h-4 w-4" />,
  essay: <FileText className="h-4 w-4" />,
  custom: <BookOpen className="h-4 w-4" />,
};

type PresetFormState = {
  name: string;
  description: string;
  category: RubricPresetCategory;
  scoringMode: UnifiedRubric["scoringMode"];
  holisticGuidance: string;
  holisticMaxScore: number;
  passingPercentage: number;
};

const EMPTY_PRESET_FORM: PresetFormState = {
  name: "",
  description: "",
  category: "custom",
  scoringMode: "holistic",
  holisticGuidance: "",
  holisticMaxScore: 100,
  passingPercentage: 40,
};

function EvaluationPresetsTab() {
  const {
    data: presetsPage,
    isLoading,
    isError,
    error,
    refetch,
  } = useRubricPresets<{ items: RubricPreset[] }>();
  const presets = presetsPage?.items;
  const savePreset = useSaveRubricPreset();
  const { handleError } = useApiError();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [form, setForm] = useState<PresetFormState>(EMPTY_PRESET_FORM);
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    id: string;
    name: string;
  }>({ open: false, id: "", name: "" });
  const [filterCategory, setFilterCategory] = useState<RubricPresetCategory | "all">("all");

  const filteredPresets = presets?.filter(
    (p) => filterCategory === "all" || p.category === filterCategory
  );

  const handleOpenCreate = () => {
    setEditingId(null);
    setForm(EMPTY_PRESET_FORM);
    setSheetOpen(true);
  };

  const handleOpenEdit = (preset: RubricPreset) => {
    setEditingId(preset.id);
    setForm({
      name: preset.name,
      description: preset.description ?? "",
      category: preset.category,
      scoringMode: preset.rubric.scoringMode,
      holisticGuidance: preset.rubric.holisticGuidance ?? "",
      holisticMaxScore: preset.rubric.holisticMaxScore ?? 100,
      passingPercentage: preset.rubric.passingPercentage ?? 40,
    });
    setSheetOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    const rubric: UnifiedRubric = {
      scoringMode: form.scoringMode,
      holisticGuidance: form.holisticGuidance || undefined,
      holisticMaxScore: form.holisticMaxScore,
      passingPercentage: form.passingPercentage,
    };
    try {
      await savePreset.mutateAsync({
        id: editingId ?? undefined,
        data: {
          name: form.name.trim(),
          description: form.description.trim(),
          rubric,
          category: form.category,
        },
      });
      sonnerToast.success(editingId ? "Preset updated" : "Preset created");
      setSheetOpen(false);
    } catch (err) {
      handleError(err, "Failed to save preset");
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog.id) return;
    try {
      await savePreset.mutateAsync({
        id: deleteDialog.id,
        data: { deleted: true },
      });
      sonnerToast.success("Preset deleted");
      setDeleteDialog({ open: false, id: "", name: "" });
    } catch (err) {
      handleError(err, "Failed to delete preset");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
        <FileText className="text-muted-foreground h-8 w-8" />
        <p className="font-display mt-3 text-lg">Failed to load presets</p>
        <p className="text-muted-foreground mt-1 max-w-md text-center text-sm">
          {(error as { message?: string } | null)?.message ??
            "Could not load rubric presets. Retry or create a new preset."}
        </p>
        <Button onClick={() => void refetch()} size="sm" variant="outline" className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog((prev) => ({ ...prev, open }))}
        title="Delete Preset"
        description={`Are you sure you want to delete "${deleteDialog.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />

      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-base font-semibold">Evaluation Presets</h2>
          <p className="text-muted-foreground text-sm">
            Reusable rubric templates for consistent grading
          </p>
        </div>
        <Button onClick={handleOpenCreate} size="sm" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> New Preset
        </Button>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <Label className="text-sm">Category:</Label>
        <Select
          value={filterCategory}
          onValueChange={(v) => setFilterCategory(v as RubricPresetCategory | "all")}
        >
          <SelectTrigger className="h-8 w-40 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {!filteredPresets?.length ? (
        <div className="border-subtle flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
          <FileText className="text-muted-foreground h-8 w-8" />
          <p className="text-muted-foreground mt-2 text-sm">
            No presets yet. Create one to get started.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filteredPresets.map((preset) => (
            <div
              key={preset.id}
              className="bg-card border-subtle shadow-e1 flex flex-col gap-2 rounded-lg border p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="bg-muted rounded-md p-1.5">{CATEGORY_ICONS[preset.category]}</div>
                  <div>
                    <h3 className="text-sm font-medium">{preset.name}</h3>
                    <p className="text-muted-foreground text-xs capitalize">
                      {CATEGORY_LABELS[preset.category] ?? preset.category}
                      {preset.rubric?.scoringMode
                        ? ` · ${preset.rubric.scoringMode.replace(/_/g, " ")}`
                        : ""}
                    </p>
                  </div>
                </div>
                {preset.isDefault && (
                  <span className="bg-brand-subtle text-brand rounded-pill px-1.5 py-0.5 text-[10px]">
                    Default
                  </span>
                )}
              </div>

              {preset.description && (
                <p className="text-muted-foreground line-clamp-2 text-xs">{preset.description}</p>
              )}

              {preset.rubric.passingPercentage != null && (
                <p className="text-muted-foreground font-mono text-xs">
                  Passing: {preset.rubric.passingPercentage}%
                </p>
              )}

              <div className="border-subtle mt-auto flex items-center gap-2 border-t pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  onClick={() => handleOpenEdit(preset)}
                >
                  <Pencil className="h-3 w-3" /> Edit
                </Button>
                {!preset.isDefault && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="hover:bg-destructive/10 hover:text-destructive h-7 gap-1 text-xs"
                    onClick={() =>
                      setDeleteDialog({ open: true, id: preset.id, name: preset.name })
                    }
                  >
                    <Trash2 className="h-3 w-3" /> Delete
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="font-display">
              {editingId ? "Edit Preset" : "New Evaluation Preset"}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-4">
            <div>
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., CBSE Math Grade 10"
                className="mt-1"
              />
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="When to use this preset..."
                rows={2}
                className="mt-1"
              />
            </div>

            <div>
              <Label>Category</Label>
              <Select
                value={form.category}
                onValueChange={(v) =>
                  setForm((prev) => ({ ...prev, category: v as RubricPresetCategory }))
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Scoring Mode</Label>
              <Select
                value={form.scoringMode}
                onValueChange={(v) =>
                  setForm((prev) => ({ ...prev, scoringMode: v as UnifiedRubric["scoringMode"] }))
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="holistic">Holistic</SelectItem>
                  <SelectItem value="criteria_based">Criteria-Based</SelectItem>
                  <SelectItem value="dimension_based">Dimension-Based</SelectItem>
                  <SelectItem value="hybrid">Hybrid</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Grading Guidance</Label>
              <Textarea
                value={form.holisticGuidance}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, holisticGuidance: e.target.value }))
                }
                placeholder="Instructions for grading..."
                rows={3}
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Max Score</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.holisticMaxScore}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      holisticMaxScore: Number(e.target.value) || 100,
                    }))
                  }
                  className="mt-1 font-mono"
                />
              </div>
              <div>
                <Label>Passing %</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={form.passingPercentage}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      passingPercentage: Number(e.target.value) || 0,
                    }))
                  }
                  className="mt-1 font-mono"
                />
              </div>
            </div>

            <div className="flex gap-2 border-t pt-4">
              <Button onClick={handleSave} disabled={savePreset.isPending || !form.name.trim()}>
                {savePreset.isPending ? "Saving..." : editingId ? "Update" : "Create"}
              </Button>
              <Button variant="outline" onClick={() => setSheetOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ── Evaluation Settings section ───────────────────────────────────────────────

type SettingsFormState = {
  name: string;
  description: string;
  isDefault: boolean;
  isPublic: boolean;
  confidenceThreshold: number;
  autoApproveThreshold: number;
  requireReviewForPartialCredit: boolean;
  showStrengths: boolean;
  showKeyTakeaway: boolean;
  prioritizeByImportance: boolean;
};

const EMPTY_SETTINGS_FORM: SettingsFormState = {
  name: "",
  description: "",
  isDefault: false,
  isPublic: false,
  confidenceThreshold: 0.7,
  autoApproveThreshold: 0.9,
  requireReviewForPartialCredit: true,
  showStrengths: true,
  showKeyTakeaway: true,
  prioritizeByImportance: false,
};

function settingsToForm(s: EvaluationSettings): SettingsFormState {
  return {
    name: s.name,
    description: s.description ?? "",
    isDefault: s.isDefault,
    isPublic: s.isPublic ?? false,
    confidenceThreshold: s.confidenceConfig?.confidenceThreshold ?? 0.7,
    autoApproveThreshold: s.confidenceConfig?.autoApproveThreshold ?? 0.9,
    requireReviewForPartialCredit: s.confidenceConfig?.requireReviewForPartialCredit ?? true,
    showStrengths: s.displaySettings?.showStrengths ?? true,
    showKeyTakeaway: s.displaySettings?.showKeyTakeaway ?? true,
    prioritizeByImportance: s.displaySettings?.prioritizeByImportance ?? false,
  };
}

function EvaluationSettingsTab() {
  const { data: rawSettings, isLoading, isError, refetch } = useEvaluationSettings();
  const settings = asArray<EvaluationSettings>(rawSettings);
  const saveSettings = useSaveEvaluationSettings();
  const { handleError } = useApiError();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [form, setForm] = useState<SettingsFormState>(EMPTY_SETTINGS_FORM);
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    id: string;
    name: string;
  }>({ open: false, id: "", name: "" });

  const handleOpenCreate = () => {
    setEditingId(null);
    setForm(EMPTY_SETTINGS_FORM);
    setSheetOpen(true);
  };

  const handleOpenEdit = (s: EvaluationSettings) => {
    setEditingId(s.id);
    setForm(settingsToForm(s));
    setSheetOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    try {
      await saveSettings.mutateAsync({
        id: editingId ?? undefined,
        data: {
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          isDefault: form.isDefault,
          isPublic: form.isPublic,
          confidenceConfig: {
            confidenceThreshold: form.confidenceThreshold,
            autoApproveThreshold: form.autoApproveThreshold,
            requireReviewForPartialCredit: form.requireReviewForPartialCredit,
          },
          displaySettings: {
            showStrengths: form.showStrengths,
            showKeyTakeaway: form.showKeyTakeaway,
            prioritizeByImportance: form.prioritizeByImportance,
          },
        },
      });
      sonnerToast.success(editingId ? "Settings updated" : "Settings created");
      setSheetOpen(false);
    } catch (err) {
      handleError(err, "Failed to save evaluation settings");
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog.id) return;
    try {
      await saveSettings.mutateAsync({ id: deleteDialog.id, delete: true });
      sonnerToast.success("Settings deleted");
      setDeleteDialog({ open: false, id: "", name: "" });
    } catch (err) {
      handleError(err, "Failed to delete settings");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-28 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
        <Settings2 className="text-muted-foreground h-8 w-8" />
        <p className="font-display mt-3 text-lg">Failed to load evaluation settings</p>
        <Button onClick={() => void refetch()} size="sm" variant="outline" className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog((prev) => ({ ...prev, open }))}
        title="Delete Evaluation Settings"
        description={`Are you sure you want to delete "${deleteDialog.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />

      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-base font-semibold">Evaluation Settings</h2>
          <p className="text-muted-foreground text-sm">
            Tenant-level grading thresholds and AI feedback configuration
          </p>
        </div>
        <Button onClick={handleOpenCreate} size="sm" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> New Config
        </Button>
      </div>

      {!settings.length ? (
        <div className="border-subtle flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
          <Settings2 className="text-muted-foreground h-8 w-8" />
          <p className="text-muted-foreground mt-2 text-sm">
            No evaluation settings yet. Create one to configure grading thresholds.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {settings.map((s) => (
            <div
              key={s.id}
              className="bg-card border-subtle shadow-e1 flex flex-col gap-2 rounded-lg border p-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-medium">{s.name}</h3>
                  {s.description && (
                    <p className="text-muted-foreground line-clamp-2 text-xs">{s.description}</p>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  {s.isDefault && (
                    <span className="bg-brand-subtle text-brand rounded-pill px-1.5 py-0.5 text-[10px]">
                      Default
                    </span>
                  )}
                  {s.isPublic && (
                    <span className="bg-muted text-muted-foreground rounded-pill px-1.5 py-0.5 text-[10px]">
                      Public
                    </span>
                  )}
                </div>
              </div>

              {s.confidenceConfig && (
                <div className="text-muted-foreground font-mono text-xs">
                  Confidence ≥{" "}
                  {(s.confidenceConfig.confidenceThreshold * 100).toFixed(0)}% · Auto-approve ≥{" "}
                  {(s.confidenceConfig.autoApproveThreshold * 100).toFixed(0)}%
                </div>
              )}

              {s.enabledDimensions?.length > 0 && (
                <p className="text-muted-foreground text-xs">
                  {s.enabledDimensions.length} dimension
                  {s.enabledDimensions.length !== 1 ? "s" : ""} enabled
                </p>
              )}

              <div className="border-subtle mt-auto flex items-center gap-2 border-t pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  onClick={() => handleOpenEdit(s)}
                >
                  <Pencil className="h-3 w-3" /> Edit
                </Button>
                {!s.isDefault && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="hover:bg-destructive/10 hover:text-destructive h-7 gap-1 text-xs"
                    onClick={() => setDeleteDialog({ open: true, id: s.id, name: s.name })}
                  >
                    <Trash2 className="h-3 w-3" /> Delete
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="font-display">
              {editingId ? "Edit Evaluation Settings" : "New Evaluation Settings"}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-5">
            <div>
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Strict AI Grading"
                className="mt-1"
              />
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="When to apply this configuration..."
                rows={2}
                className="mt-1"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Set as Default</p>
                <p className="text-muted-foreground text-xs">
                  Apply this config to all new exams by default
                </p>
              </div>
              <Switch
                checked={form.isDefault}
                onCheckedChange={(v) => setForm((prev) => ({ ...prev, isDefault: v }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Public</p>
                <p className="text-muted-foreground text-xs">
                  Allow other tenants to discover this config
                </p>
              </div>
              <Switch
                checked={form.isPublic}
                onCheckedChange={(v) => setForm((prev) => ({ ...prev, isPublic: v }))}
              />
            </div>

            <div className="border-subtle rounded-lg border p-3">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide">
                Confidence Thresholds
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Confidence Threshold</Label>
                  <Input
                    type="number"
                    step={0.05}
                    min={0}
                    max={1}
                    value={form.confidenceThreshold}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        confidenceThreshold: Number(e.target.value),
                      }))
                    }
                    className="mt-1 font-mono text-sm"
                  />
                  <p className="text-muted-foreground mt-0.5 text-[10px]">
                    Below this → needs review
                  </p>
                </div>
                <div>
                  <Label className="text-xs">Auto-approve Threshold</Label>
                  <Input
                    type="number"
                    step={0.05}
                    min={0}
                    max={1}
                    value={form.autoApproveThreshold}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        autoApproveThreshold: Number(e.target.value),
                      }))
                    }
                    className="mt-1 font-mono text-sm"
                  />
                  <p className="text-muted-foreground mt-0.5 text-[10px]">
                    Above this → auto-approved
                  </p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Review Partial Credit</p>
                  <p className="text-muted-foreground text-xs">
                    Require human review for partial credit scores
                  </p>
                </div>
                <Switch
                  checked={form.requireReviewForPartialCredit}
                  onCheckedChange={(v) =>
                    setForm((prev) => ({ ...prev, requireReviewForPartialCredit: v }))
                  }
                />
              </div>
            </div>

            <div className="border-subtle rounded-lg border p-3">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide">
                Feedback Display
              </p>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm">Show Strengths</p>
                  <Switch
                    checked={form.showStrengths}
                    onCheckedChange={(v) => setForm((prev) => ({ ...prev, showStrengths: v }))}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm">Show Key Takeaway</p>
                  <Switch
                    checked={form.showKeyTakeaway}
                    onCheckedChange={(v) => setForm((prev) => ({ ...prev, showKeyTakeaway: v }))}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm">Prioritize by Importance</p>
                  <Switch
                    checked={form.prioritizeByImportance}
                    onCheckedChange={(v) =>
                      setForm((prev) => ({ ...prev, prioritizeByImportance: v }))
                    }
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 border-t pt-4">
              <Button
                onClick={handleSave}
                disabled={saveSettings.isPending || !form.name.trim()}
              >
                {saveSettings.isPending ? "Saving..." : editingId ? "Update" : "Create"}
              </Button>
              <Button variant="outline" onClick={() => setSheetOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ── Agents section ────────────────────────────────────────────────────────────

type AgentFormState = {
  name: string;
  publicDescription: string;
  identity: string;
  isActive: boolean;
  openingMessage: string;
  feedbackStyle: string;
  strictness: string;
  modelPolicyId: string;
  maxConversationTurns: number | "";
};

const EMPTY_AGENT_FORM: AgentFormState = {
  name: "",
  publicDescription: "",
  identity: "",
  isActive: true,
  openingMessage: "",
  feedbackStyle: "detailed",
  strictness: "moderate",
  modelPolicyId: "conversation.quality",
  maxConversationTurns: "",
};

function agentToForm(a: Agent): AgentFormState {
  // Agent from shared-types uses older shape; domain Agent has `modelPolicyId`.
  // Cast to record to defensively read either shape.
  const raw = a as Record<string, unknown>;
  return {
    name: a.name,
    publicDescription: (raw["publicDescription"] as string | undefined) ?? "",
    identity: a.identity ?? "",
    isActive: (raw["isActive"] as boolean | undefined) ?? true,
    openingMessage: (raw["openingMessage"] as string | undefined) ?? "",
    feedbackStyle: a.feedbackStyle ?? "detailed",
    strictness: typeof a.strictness === "string" ? a.strictness : "moderate",
    modelPolicyId:
      (raw["modelPolicyId"] as string | undefined) ??
      (a.type === "evaluator" ? "evaluation.quality" : "conversation.quality"),
    maxConversationTurns: a.maxConversationTurns ?? "",
  };
}

function AgentTypeLabel({ type }: { type: string }) {
  const label = type === "evaluator" ? "Evaluator" : "Tutor";
  const cls =
    type === "evaluator"
      ? "bg-purple-100 text-purple-700"
      : "bg-blue-100 text-blue-700";
  return (
    <span className={`rounded-pill px-1.5 py-0.5 text-[10px] font-medium ${cls}`}>{label}</span>
  );
}

function AgentsTab() {
  const { data: rawSpaces, isLoading: spacesLoading } = useSpaces<{ items: Space[] }>();
  const spaces = asArray<Space>(rawSpaces);

  const [selectedSpaceId, setSelectedSpaceId] = useState<string>("");

  const {
    data: rawAgents,
    isLoading: agentsLoading,
    isError: agentsError,
    refetch: refetchAgents,
  } = useAgents<{ items: Agent[] }>(selectedSpaceId, { enabled: Boolean(selectedSpaceId) });
  const agents = asArray<Agent>(rawAgents);
  const saveAgent = useSaveAgent();
  const { handleError } = useApiError();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingSpaceId, setEditingSpaceId] = useState<string>("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [form, setForm] = useState<AgentFormState>(EMPTY_AGENT_FORM);

  const handleOpenEdit = (agent: Agent) => {
    setEditingId(agent.id);
    setEditingSpaceId(agent.spaceId ?? selectedSpaceId);
    setForm(agentToForm(agent));
    setSheetOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !editingId || !editingSpaceId) return;
    try {
      await saveAgent.mutateAsync({
        id: editingId,
        spaceId: editingSpaceId,
        data: {
          name: form.name.trim(),
          publicDescription: form.publicDescription.trim() || undefined,
          identity: form.identity.trim() || undefined,
          isActive: form.isActive,
          openingMessage: form.openingMessage.trim() || undefined,
          feedbackStyle: form.feedbackStyle || undefined,
          strictness: form.strictness || undefined,
          modelPolicyId: form.modelPolicyId || undefined,
          maxConversationTurns:
            form.maxConversationTurns === "" ? undefined : Number(form.maxConversationTurns),
        },
      });
      sonnerToast.success("Agent updated");
      setSheetOpen(false);
    } catch (err) {
      handleError(err, "Failed to save agent");
    }
  };

  const selectedSpace = spaces.find((s) => s.id === selectedSpaceId);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-base font-semibold">AI Agents</h2>
        <p className="text-muted-foreground text-sm">
          Tutor and evaluator agents are configured per space. Select a space to view its agents.
        </p>
      </div>

      {/* Space picker */}
      <div>
        <Label className="text-sm">Space</Label>
        {spacesLoading ? (
          <Skeleton className="mt-1 h-9 w-full max-w-xs rounded-md" />
        ) : (
          <div className="relative mt-1 max-w-xs">
            <select
              value={selectedSpaceId}
              onChange={(e) => setSelectedSpaceId(e.target.value)}
              className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus:ring-ring w-full appearance-none rounded-md border px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">— Select a space —</option>
              {spaces.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
            <ChevronDown className="text-muted-foreground pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2" />
          </div>
        )}
      </div>

      {/* Agent list */}
      {!selectedSpaceId ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-14">
            <Bot className="text-muted-foreground h-8 w-8" />
            <p className="text-muted-foreground mt-2 text-sm">
              Select a space above to view its agents
            </p>
          </CardContent>
        </Card>
      ) : agentsLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      ) : agentsError ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
          <Bot className="text-muted-foreground h-8 w-8" />
          <p className="font-display mt-3 text-lg">Failed to load agents</p>
          <Button onClick={() => void refetchAgents()} size="sm" variant="outline" className="mt-4">
            Retry
          </Button>
        </div>
      ) : !agents.length ? (
        <div className="border-subtle flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
          <Bot className="text-muted-foreground h-8 w-8" />
          <p className="text-muted-foreground mt-2 text-sm">
            No agents configured for{" "}
            <span className="font-medium">{selectedSpace?.title ?? "this space"}</span>.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {agents.map((agent) => {
            const raw = agent as Record<string, unknown>;
            const isActive = (raw["isActive"] as boolean | undefined) ?? true;
            const publicDesc = (raw["publicDescription"] as string | undefined) ?? "";
            const modelPolicyId = (raw["modelPolicyId"] as string | undefined) ?? "";
            return (
              <div
                key={agent.id}
                className="bg-card border-subtle shadow-e1 flex flex-col gap-2 rounded-lg border p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="bg-muted rounded-md p-1.5">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium">{agent.name}</h3>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <AgentTypeLabel type={agent.type} />
                        {!isActive && (
                          <span className="text-muted-foreground text-[10px]">Inactive</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {publicDesc && (
                  <p className="text-muted-foreground line-clamp-2 text-xs">{publicDesc}</p>
                )}

                {modelPolicyId && (
                  <p className="text-muted-foreground font-mono text-xs">{modelPolicyId}</p>
                )}

                <div className="border-subtle mt-auto flex items-center border-t pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 text-xs"
                    onClick={() => handleOpenEdit(agent)}
                  >
                    <Pencil className="h-3 w-3" /> Edit
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Agent Sheet (read-only authoring — no create; agents are created with spaces) */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="font-display">Edit Agent</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-4">
            <div>
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Agent name"
                className="mt-1"
              />
            </div>

            <div>
              <Label>Public Description</Label>
              <Textarea
                value={form.publicDescription}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, publicDescription: e.target.value }))
                }
                placeholder="Student-facing description of this agent"
                rows={2}
                className="mt-1"
              />
            </div>

            <div>
              <Label>Identity</Label>
              <Textarea
                value={form.identity}
                onChange={(e) => setForm((prev) => ({ ...prev, identity: e.target.value }))}
                placeholder="Agent persona or role description"
                rows={2}
                className="mt-1"
              />
            </div>

            <div>
              <Label>Opening Message</Label>
              <Textarea
                value={form.openingMessage}
                onChange={(e) => setForm((prev) => ({ ...prev, openingMessage: e.target.value }))}
                placeholder="Static first message to student"
                rows={2}
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Feedback Style</Label>
                <Select
                  value={form.feedbackStyle}
                  onValueChange={(v) => setForm((prev) => ({ ...prev, feedbackStyle: v }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="brief">Brief</SelectItem>
                    <SelectItem value="detailed">Detailed</SelectItem>
                    <SelectItem value="encouraging">Encouraging</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Strictness</Label>
                <Select
                  value={form.strictness}
                  onValueChange={(v) => setForm((prev) => ({ ...prev, strictness: v }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lenient">Lenient</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="strict">Strict</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Model Policy</Label>
              <Select
                value={form.modelPolicyId}
                onValueChange={(v) => setForm((prev) => ({ ...prev, modelPolicyId: v }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="conversation.quality">conversation.quality</SelectItem>
                  <SelectItem value="conversation.speed">conversation.speed</SelectItem>
                  <SelectItem value="evaluation.quality">evaluation.quality</SelectItem>
                  <SelectItem value="evaluation.speed">evaluation.speed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Max Conversation Turns</Label>
              <Input
                type="number"
                min={1}
                value={form.maxConversationTurns}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    maxConversationTurns: e.target.value === "" ? "" : Number(e.target.value),
                  }))
                }
                placeholder="Leave blank for no limit"
                className="mt-1 font-mono"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Active</p>
                <p className="text-muted-foreground text-xs">
                  Inactive agents are not presented to students
                </p>
              </div>
              <Switch
                checked={form.isActive}
                onCheckedChange={(v) => setForm((prev) => ({ ...prev, isActive: v }))}
              />
            </div>

            <div className="flex gap-2 border-t pt-4">
              <Button onClick={handleSave} disabled={saveAgent.isPending || !form.name.trim()}>
                {saveAgent.isPending ? "Saving..." : "Update Agent"}
              </Button>
              <Button variant="outline" onClick={() => setSheetOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AISettingsPage() {
  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>AI Settings</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div>
        <h1 className="font-display text-xl font-semibold">AI Settings</h1>
        <p className="text-muted-foreground text-sm">
          Configure AI agents, evaluation settings, and rubric presets
        </p>
      </div>

      <Tabs defaultValue="presets">
        <TabsList className="mb-4">
          <TabsTrigger value="presets">
            <FileText className="mr-1.5 h-3.5 w-3.5" />
            Evaluation Presets
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings2 className="mr-1.5 h-3.5 w-3.5" />
            Evaluation Settings
          </TabsTrigger>
          <TabsTrigger value="agents">
            <Bot className="mr-1.5 h-3.5 w-3.5" />
            Agents
          </TabsTrigger>
        </TabsList>

        <TabsContent value="presets">
          <EvaluationPresetsTab />
        </TabsContent>

        <TabsContent value="settings">
          <EvaluationSettingsTab />
        </TabsContent>

        <TabsContent value="agents">
          <AgentsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
