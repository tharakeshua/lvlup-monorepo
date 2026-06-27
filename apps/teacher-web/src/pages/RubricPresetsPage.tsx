import { useState } from "react";
import { useRubricPresets, useSaveRubricPreset, useApiError } from "@levelup/query";
import type { RubricPreset, RubricPresetCategory, UnifiedRubric } from "@levelup/shared-types";
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
} from "lucide-react";
import ConfirmDialog from "../components/shared/ConfirmDialog";

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

type FormState = {
  name: string;
  description: string;
  category: RubricPresetCategory;
  scoringMode: UnifiedRubric["scoringMode"];
  holisticGuidance: string;
  holisticMaxScore: number;
  passingPercentage: number;
};

const EMPTY_FORM: FormState = {
  name: "",
  description: "",
  category: "custom",
  scoringMode: "holistic",
  holisticGuidance: "",
  holisticMaxScore: 100,
  passingPercentage: 40,
};

export default function RubricPresetsPage() {
  // @levelup/query is tenant-scoped server-side; result is a `{ items }` page.
  const { data: presetsPage, isLoading } = useRubricPresets<{ items: RubricPreset[] }>();
  const presets = presetsPage?.items;
  const savePreset = useSaveRubricPreset();
  const { handleError } = useApiError();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
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
    setForm(EMPTY_FORM);
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
        <Skeleton className="h-8 w-48" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog((prev) => ({ ...prev, open }))}
        title="Delete Preset"
        description={`Are you sure you want to delete "${deleteDialog.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />

      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>Rubric Presets</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Evaluation Presets</h1>
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
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
          <FileText className="text-muted-foreground h-8 w-8" />
          <p className="text-muted-foreground mt-2 text-sm">
            No presets yet. Create one to get started.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filteredPresets.map((preset) => (
            <div key={preset.id} className="bg-card flex flex-col gap-2 rounded-lg border p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="bg-muted rounded-md p-1.5">{CATEGORY_ICONS[preset.category]}</div>
                  <div>
                    <h3 className="text-sm font-medium">{preset.name}</h3>
                    <p className="text-muted-foreground text-xs capitalize">
                      {CATEGORY_LABELS[preset.category]} &middot;{" "}
                      {preset.rubric.scoringMode.replace("_", " ")}
                    </p>
                  </div>
                </div>
                {preset.isDefault && (
                  <span className="bg-primary/10 text-primary rounded px-1.5 py-0.5 text-[10px]">
                    Default
                  </span>
                )}
              </div>

              {preset.description && (
                <p className="text-muted-foreground line-clamp-2 text-xs">{preset.description}</p>
              )}

              {preset.rubric.passingPercentage != null && (
                <p className="text-muted-foreground text-xs">
                  Passing: {preset.rubric.passingPercentage}%
                </p>
              )}

              <div className="mt-auto flex items-center gap-2 border-t pt-2">
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
                      setDeleteDialog({
                        open: true,
                        id: preset.id,
                        name: preset.name,
                      })
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
            <SheetTitle>{editingId ? "Edit Preset" : "New Evaluation Preset"}</SheetTitle>
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
                  setForm((prev) => ({
                    ...prev,
                    category: v as RubricPresetCategory,
                  }))
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
                  setForm((prev) => ({
                    ...prev,
                    scoringMode: v as UnifiedRubric["scoringMode"],
                  }))
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
                  setForm((prev) => ({
                    ...prev,
                    holisticGuidance: e.target.value,
                  }))
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
                  className="mt-1"
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
                  className="mt-1"
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
