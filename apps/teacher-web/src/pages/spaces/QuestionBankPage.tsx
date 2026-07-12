import { useState, useCallback } from "react";
import { useAuthSession } from "../../sdk/session";
import { useQuestionBank, useSaveQuestionBankItem } from "@levelup/query";
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Skeleton,
  sonnerToast as toast,
  Badge,
} from "@levelup/shared-ui";
import { Library, Search, Plus, Trash2, Filter, ChevronRight, Pencil, Copy } from "lucide-react";
import type { QuestionBankItem, BloomsLevel } from "@levelup/shared-types";
import { useQueryClient } from "@tanstack/react-query";
import QuestionBankEditor from "../../components/question-bank/QuestionBankEditor";

const BLOOMS_LEVELS: BloomsLevel[] = [
  "remember",
  "understand",
  "apply",
  "analyze",
  "evaluate",
  "create",
];

const DIFFICULTY_OPTIONS = ["easy", "medium", "hard"] as const;
const QUESTION_TYPE_LABELS: Record<string, string> = {
  mcq: "MCQ",
  mcaq: "MCAQ",
  "true-false": "True/False",
  numerical: "Numerical",
  text: "Short Text",
  paragraph: "Paragraph",
  code: "Code",
  "fill-blanks": "Fill Blanks",
  "fill-blanks-dd": "Fill Blanks DD",
  matching: "Matching",
  jumbled: "Jumbled",
  audio: "Audio",
  image_evaluation: "Image",
  "group-options": "Group Options",
  chat_agent_question: "Chat Agent",
};

export default function QuestionBankPage() {
  // Tenant is implicit in @levelup/query; only kept for the editor child prop.
  const currentTenantId = useAuthSession((s) => s.currentTenantId);
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState<string>("");
  const [bloomsLevel, setBloomsLevel] = useState<string>("");
  const [questionType, setQuestionType] = useState<string>("");
  const [selectedItem, setSelectedItem] = useState<QuestionBankItem | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<QuestionBankItem | null>(null);

  const { data, isLoading, refetch } = useQuestionBank<{ items: QuestionBankItem[] }>({
    search: search || undefined,
    difficulty: (difficulty as "easy" | "medium" | "hard") || undefined,
    bloomsLevel: bloomsLevel || undefined,
    questionType: questionType || undefined,
    limit: 50,
  });

  const deleteMutation = useSaveQuestionBankItem();

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteMutation.mutateAsync({ id, data: { deleted: true } });
        toast.success("Question deleted");
        setShowDeleteConfirm(null);
      } catch {
        toast.error("Failed to delete question");
      }
    },
    [deleteMutation]
  );

  const handleSearch = useCallback(() => {
    refetch();
  }, [refetch]);

  const items = data?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Library className="text-primary h-6 w-6" />
          <div>
            <h1 className="font-display text-2xl font-semibold">Question Bank</h1>
            <p className="text-muted-foreground text-sm">
              Reusable questions across all your spaces
            </p>
          </div>
        </div>
        <Button
          className="gap-2"
          onClick={() => {
            setEditingItem(null);
            setEditorOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> Add Question
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[200px] max-w-md flex-1">
          <div className="relative">
            <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
            <Input
              placeholder="Search questions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="pl-9"
            />
          </div>
        </div>

        <Select
          value={difficulty || "__all__"}
          onValueChange={(v) => setDifficulty(v === "__all__" ? "" : v)}
        >
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Difficulty" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All</SelectItem>
            {DIFFICULTY_OPTIONS.map((d) => (
              <SelectItem key={d} value={d}>
                {d.charAt(0).toUpperCase() + d.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={bloomsLevel || "__all__"}
          onValueChange={(v) => setBloomsLevel(v === "__all__" ? "" : v)}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Bloom's Level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All</SelectItem>
            {BLOOMS_LEVELS.map((level) => (
              <SelectItem key={level} value={level}>
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={questionType || "__all__"}
          onValueChange={(v) => setQuestionType(v === "__all__" ? "" : v)}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Types</SelectItem>
            {Object.entries(QUESTION_TYPE_LABELS).map(([type, label]) => (
              <SelectItem key={type} value={type}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(difficulty || bloomsLevel || questionType) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setDifficulty("");
              setBloomsLevel("");
              setQuestionType("");
            }}
          >
            <Filter className="mr-1 h-4 w-4" /> Clear
          </Button>
        )}
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="bg-muted/50 border-subtle rounded-lg border p-8 text-center">
          <Library className="text-muted-foreground/30 mx-auto mb-2 h-8 w-8" />
          <p className="text-muted-foreground text-sm">
            {search ? "No questions match your search." : "No questions in the bank yet."}
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            Save questions from your spaces or create new ones.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => setSelectedItem(item)}
              className="bg-card border-subtle shadow-e1 hover:shadow-e2 duration-fast ease-standard w-full rounded-lg border p-4 text-left transition-shadow"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {item.title || item.content.slice(0, 80)}
                  </p>
                  <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">{item.content}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className="rounded-pill bg-surface-sunken text-fg-secondary border-transparent text-xs"
                    >
                      {QUESTION_TYPE_LABELS[item.questionType] ?? item.questionType}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`rounded-pill text-xs ${
                        item.difficulty === "easy"
                          ? "border-success/40 text-success"
                          : item.difficulty === "hard"
                            ? "border-error/40 text-error"
                            : "border-warning/40 text-warning"
                      }`}
                    >
                      {item.difficulty}
                    </Badge>
                    {item.bloomsLevel && (
                      <Badge
                        variant="outline"
                        className="border-info/40 text-info rounded-pill text-xs"
                      >
                        {item.bloomsLevel}
                      </Badge>
                    )}
                    {item.subject && (
                      <span className="text-muted-foreground text-xs">{item.subject}</span>
                    )}
                    {item.usageCount > 0 && (
                      <span className="text-muted-foreground font-mono text-xs">
                        Used {item.usageCount}x
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingItem(item);
                      setEditorOpen(true);
                    }}
                    className="h-8 w-8 p-0"
                    title="Edit"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingItem({ ...item, id: "" } as QuestionBankItem);
                      setEditorOpen(true);
                    }}
                    className="h-8 w-8 p-0"
                    title="Duplicate"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowDeleteConfirm(item.id);
                    }}
                    className="text-destructive h-8 w-8 p-0"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                  <ChevronRight className="text-muted-foreground h-4 w-4" />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Question Preview Dialog */}
      <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">Question Preview</DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium">{selectedItem.title || "Untitled"}</p>
                <p className="text-muted-foreground mt-1 whitespace-pre-wrap text-sm">
                  {selectedItem.content}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">
                  {QUESTION_TYPE_LABELS[selectedItem.questionType] ?? selectedItem.questionType}
                </Badge>
                <Badge variant="outline">{selectedItem.difficulty}</Badge>
                {selectedItem.bloomsLevel && (
                  <Badge variant="outline">{selectedItem.bloomsLevel}</Badge>
                )}
                <Badge variant="outline" className="font-mono">
                  {selectedItem.basePoints ?? 1} pts
                </Badge>
              </div>
              {selectedItem.topics.length > 0 && (
                <div>
                  <p className="text-muted-foreground mb-1 text-xs font-medium">Topics</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedItem.topics.map((t) => (
                      <Badge key={t} variant="secondary" className="text-xs">
                        {t}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {selectedItem.tags.length > 0 && (
                <div>
                  <p className="text-muted-foreground mb-1 text-xs font-medium">Tags</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedItem.tags.map((t) => (
                      <Badge key={t} variant="secondary" className="text-xs">
                        {t}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {selectedItem.averageScore != null && (
                <p className="text-muted-foreground text-xs">
                  Average score: {Math.round(selectedItem.averageScore * 100)}%
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedItem(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!showDeleteConfirm} onOpenChange={() => setShowDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Delete Question?</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            This will permanently remove this question from the bank. Questions already imported
            into spaces will not be affected.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => showDeleteConfirm && handleDelete(showDeleteConfirm)}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Question Bank Editor */}
      {currentTenantId && (
        <QuestionBankEditor
          open={editorOpen}
          onOpenChange={setEditorOpen}
          tenantId={currentTenantId}
          item={editingItem}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["questionBank"] });
          }}
        />
      )}
    </div>
  );
}
