import { useState } from "react";
import { useQuestionBank, useImportFromBank } from "@levelup/query";
import type { QuestionBankItem } from "@levelup/shared-types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Button,
  Input,
  Badge,
  Skeleton,
} from "@levelup/shared-ui";
import { Search, Check, Library, AlertCircle } from "lucide-react";

interface QuestionBankImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spaceId: string;
  storyPointId: string;
  onImported: () => void;
}

export default function QuestionBankImportDialog({
  open,
  onOpenChange,
  spaceId,
  storyPointId,
  onImported,
}: QuestionBankImportDialogProps) {
  const [importing, setImporting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Load question bank items (tenant-scoped server-side; only fetch while open).
  const {
    data,
    isLoading: loading,
    isError: loadError,
  } = useQuestionBank<{ items: QuestionBankItem[] }>({ limit: 100 }, { enabled: open });
  const questions = data?.items ?? [];
  const importFromBank = useImportFromBank();

  const filtered = questions.filter((q) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      q.content?.toLowerCase().includes(term) ||
      q.title?.toLowerCase().includes(term) ||
      q.subject?.toLowerCase().includes(term) ||
      q.topics?.some((t) => t.toLowerCase().includes(term))
    );
  });

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleImport = async () => {
    if (selected.size === 0) return;
    setImporting(true);
    setError(null);
    try {
      await importFromBank.mutateAsync({
        spaceId,
        storyPointId,
        bankItemIds: Array.from(selected),
      });
      setSelected(new Set());
      onImported();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80vh] max-w-2xl flex-col">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Library className="h-5 w-5" />
            Import from Question Bank
          </DialogTitle>
          <DialogDescription>Select questions to import into this story point.</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Search by content, subject, or topic..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {(error || loadError) && (
          <div className="text-error flex items-center gap-2 text-sm">
            <AlertCircle className="h-4 w-4" />
            {error ?? "Failed to load question bank"}
          </div>
        )}

        <div className="max-h-[400px] min-h-[200px] flex-1 space-y-2 overflow-y-auto">
          {loading ? (
            <>
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
            </>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center">
              <Library className="text-muted-foreground/30 mx-auto h-8 w-8" />
              <p className="text-muted-foreground mt-2 text-sm">
                {questions.length === 0
                  ? "No questions in the bank yet. Add questions from the Question Bank page."
                  : "No matching questions found."}
              </p>
            </div>
          ) : (
            filtered.map((q) => {
              const isSelected = selected.has(q.id);
              return (
                <button
                  key={q.id}
                  onClick={() => toggleSelect(q.id)}
                  className={`duration-fast ease-standard w-full rounded-lg border p-3 text-left transition-colors ${
                    isSelected
                      ? "border-brand bg-brand-subtle"
                      : "border-subtle hover:bg-surface-sunken/60"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border ${
                        isSelected ? "bg-brand border-brand text-fg-on-accent" : "border-strong"
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-medium">{q.title || q.content}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <Badge
                          variant="outline"
                          className="rounded-pill bg-surface-sunken text-fg-secondary border-transparent text-[10px]"
                        >
                          {q.questionType}
                        </Badge>
                        {q.difficulty && (
                          <Badge variant="secondary" className="text-[10px] capitalize">
                            {q.difficulty}
                          </Badge>
                        )}
                        {q.subject && (
                          <span className="text-muted-foreground text-[10px]">{q.subject}</span>
                        )}
                        {q.usageCount > 0 && (
                          <span className="text-muted-foreground font-mono text-[10px]">
                            Used {q.usageCount}x
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between border-t pt-3">
          <span className="text-muted-foreground text-sm">
            {selected.size} question{selected.size !== 1 ? "s" : ""} selected
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleImport} disabled={selected.size === 0 || importing}>
              {importing
                ? "Importing..."
                : `Import ${selected.size > 0 ? `(${selected.size})` : ""}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
