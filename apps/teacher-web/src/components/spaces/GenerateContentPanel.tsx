/**
 * GenerateContentPanel — AI-powered draft generation for a story point (CC-2/CC-3).
 *
 * Contract: v1.levelup.generateContent returns DRAFTS only; each accepted draft
 * is persisted individually via useSaveItem. The panel is a Dialog so it sits
 * above the DnD layer without intercepting pointer events.
 *
 * sourcePdfPath: uploaded via v1.autograde.requestUploadUrl (kind:'content-source')
 * then passed to generateContent. Backend validates ≤14MB; oversize surfaces as
 * PRECONDITION_FAILED with a teacher-readable message.
 */
import { useState, useRef } from "react";
import {
  useGenerateContent,
  useSaveItem,
  useApiError,
  useUploadImage,
  asApiError,
} from "@levelup/query";
import type { GeneratedItem } from "@levelup/api-contract";
import type { UnifiedItem as CanonicalItem } from "@levelup/domain";
import { BLOOMS_LEVELS, type BloomsLevel } from "@levelup/shared-types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Button,
  Badge,
  Checkbox,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  sonnerToast,
} from "@levelup/shared-ui";
import {
  Sparkles,
  ChevronDown,
  ChevronRight,
  CheckCheck,
  X,
  Loader2,
  FileText,
  UploadCloud,
} from "lucide-react";
import ItemPreview from "./ItemPreview";
import { toItemEditorModel } from "./item-editor-contract";

const QUESTION_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "mcq", label: "Multiple Choice" },
  { value: "mcaq", label: "Multiple Correct" },
  { value: "true-false", label: "True / False" },
  { value: "numerical", label: "Numerical" },
  { value: "text", label: "Short Answer" },
  { value: "paragraph", label: "Long Answer" },
  { value: "code", label: "Code" },
  { value: "fill-blanks", label: "Fill in the Blanks" },
  { value: "fill-blanks-dd", label: "Fill Blanks (Dropdown)" },
  { value: "matching", label: "Matching" },
  { value: "jumbled", label: "Reorder" },
  { value: "audio", label: "Audio Response" },
  { value: "image_evaluation", label: "Image Evaluation" },
  { value: "group-options", label: "Group Options" },
  { value: "chat_agent_question", label: "Chat Agent" },
];

const DIFFICULTY_OPTIONS = [
  { value: "", label: "Any difficulty" },
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
];

type GeneratedDraft = GeneratedItem;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spaceId: string;
  storyPointId: string;
  onAccepted: () => void;
}

function readableGenerateError(err: unknown): string {
  const api = asApiError(err);
  if (api.code === "RATE_LIMITED")
    return "AI generation limit reached. Please wait a moment and try again.";
  if (api.code === "PRECONDITION_FAILED")
    return api.message?.includes("14MB") ||
      api.message?.includes("size") ||
      api.message?.includes("oversize")
      ? "The PDF is too large (max 14 MB). Please split the document into smaller parts and try again."
      : "Generation unavailable right now — your plan may not include AI generation, or content moderation blocked this request.";
  return api.message || "Failed to generate content. Please try again.";
}

function readableUploadError(err: unknown): string {
  const api = asApiError(err);
  if (api.code === "RATE_LIMITED") return "Upload limit reached. Please try again in a moment.";
  if (api.code === "PERMISSION_DENIED")
    return "You don't have permission to upload files to this space.";
  return api.message || "Failed to upload PDF. Please try again.";
}

export default function GenerateContentPanel({
  open,
  onOpenChange,
  spaceId,
  storyPointId,
  onAccepted,
}: Props) {
  const { handleError } = useApiError();
  const generateContent = useGenerateContent();
  const saveItem = useSaveItem();
  const uploadImage = useUploadImage();

  // Form state
  const [selectedTypes, setSelectedTypes] = useState<string[]>(["mcq"]);
  const [count, setCount] = useState(5);
  const [difficulty, setDifficulty] = useState("");

  // PDF upload state
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [sourcePdfFile, setSourcePdfFile] = useState<File | null>(null);
  const [sourcePdfPath, setSourcePdfPath] = useState<string | null>(null);
  const [pdfUploading, setPdfUploading] = useState(false);
  const [pdfUploadError, setPdfUploadError] = useState<string | null>(null);

  // Generation state
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<GeneratedDraft[]>([]);

  // Draft interaction state
  const [expandedDrafts, setExpandedDrafts] = useState<Set<number>>(new Set());
  const [acceptedDrafts, setAcceptedDrafts] = useState<Set<number>>(new Set());
  const [acceptingDraft, setAcceptingDraft] = useState<number | null>(null);
  const [acceptingAll, setAcceptingAll] = useState(false);

  function toggleType(type: string) {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }

  function toggleExpand(idx: number) {
    setExpandedDrafts((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  async function handlePdfSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side size guard (14MB) — server enforces too, but fast feedback is better UX.
    if (file.size > 14 * 1024 * 1024) {
      setPdfUploadError("PDF exceeds the 14 MB limit. Please split it into smaller parts.");
      return;
    }

    setSourcePdfFile(file);
    setSourcePdfPath(null);
    setPdfUploadError(null);
    setPdfUploading(true);
    try {
      const path = await uploadImage.mutateAsync({
        kind: "content-source",
        spaceId,
        contentType: "application/pdf",
        body: file,
      });
      setSourcePdfPath(path as string);
    } catch (err) {
      setPdfUploadError(readableUploadError(err));
      setSourcePdfFile(null);
    } finally {
      setPdfUploading(false);
      // Reset input so the same file can be re-selected after error.
      if (pdfInputRef.current) pdfInputRef.current.value = "";
    }
  }

  function clearPdf() {
    setSourcePdfFile(null);
    setSourcePdfPath(null);
    setPdfUploadError(null);
    if (pdfInputRef.current) pdfInputRef.current.value = "";
  }

  async function handleGenerate() {
    if (selectedTypes.length === 0) {
      sonnerToast.error("Select at least one question type");
      return;
    }
    setGenerating(true);
    setGenerateError(null);
    setDrafts([]);
    setAcceptedDrafts(new Set());
    setExpandedDrafts(new Set());
    try {
      const result = (await generateContent.mutateAsync({
        storyPointId,
        spaceId,
        spec: {
          types: selectedTypes,
          count,
          ...(difficulty ? { difficulty } : {}),
        },
        ...(sourcePdfPath ? { sourcePdfPath } : {}),
      })) as { drafts?: GeneratedDraft[] };
      const received = result?.drafts ?? [];
      setDrafts(received);
      if (received.length === 0) {
        setGenerateError("No drafts were generated. Try adjusting the types or count.");
      }
    } catch (err) {
      setGenerateError(readableGenerateError(err));
    } finally {
      setGenerating(false);
    }
  }

  async function acceptDraft(idx: number): Promise<boolean> {
    const draft = drafts[idx];
    if (!draft) return false;
    setAcceptingDraft(idx);
    try {
      const bloomsLevel = BLOOMS_LEVELS.includes(draft.bloomsLevel as BloomsLevel)
        ? (draft.bloomsLevel as BloomsLevel)
        : undefined;
      await saveItem.mutateAsync({
        spaceId,
        storyPointId,
        data: {
          type: draft.itemType,
          payload: draft.payload,
          title: draft.title,
          ...(draft.topics?.length ? { topics: draft.topics } : {}),
          ...(difficulty ? { difficulty: difficulty as "easy" | "medium" | "hard" } : {}),
          ...(draft.suggestedRubric ? { rubric: draft.suggestedRubric } : {}),
          ...(bloomsLevel ? { meta: { bloomsLevel } } : {}),
        },
      });
      setAcceptedDrafts((prev) => new Set(prev).add(idx));
      onAccepted();
      return true;
    } catch (err) {
      handleError(err, "Failed to save item");
      return false;
    } finally {
      setAcceptingDraft(null);
    }
  }

  async function acceptAll() {
    const pending = drafts.map((_, idx) => idx).filter((idx) => !acceptedDrafts.has(idx));
    if (pending.length === 0) return;
    setAcceptingAll(true);
    let accepted = 0;
    try {
      for (const idx of pending) {
        if (await acceptDraft(idx)) accepted++;
      }
      if (accepted > 0) {
        sonnerToast.success(`Accepted ${accepted} item${accepted === 1 ? "" : "s"}`);
      }
    } finally {
      setAcceptingAll(false);
    }
  }

  function handleClose() {
    if (generating || acceptingAll || pdfUploading) return;
    setDrafts([]);
    setGenerateError(null);
    setAcceptedDrafts(new Set());
    setExpandedDrafts(new Set());
    clearPdf();
    onOpenChange(false);
  }

  const pendingCount = drafts.filter((_, idx) => !acceptedDrafts.has(idx)).length;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) handleClose();
      }}
    >
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="text-brand h-4 w-4" />
            Generate Content with AI
          </DialogTitle>
          <DialogDescription className="text-xs">
            Generate draft items for this story point. Review each draft and accept the ones you
            want to keep.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {/* Form section */}
          {drafts.length === 0 && !generating && (
            <div className="space-y-5 px-6 py-5">
              {/* Question type multi-select */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Question types</Label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {QUESTION_TYPE_OPTIONS.map(({ value, label }) => (
                    <label
                      key={value}
                      className="hover:bg-muted/50 flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 transition-colors"
                    >
                      <Checkbox
                        checked={selectedTypes.includes(value)}
                        onCheckedChange={() => toggleType(value)}
                        className="h-3.5 w-3.5"
                      />
                      <span className="text-xs">{label}</span>
                    </label>
                  ))}
                </div>
                {selectedTypes.length === 0 && (
                  <p className="text-destructive text-xs">Select at least one type.</p>
                )}
              </div>

              <div className="flex gap-4">
                {/* Count */}
                <div className="flex-1 space-y-1">
                  <Label className="text-sm font-medium">Count</Label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={count}
                    onChange={(e) =>
                      setCount(Math.min(50, Math.max(1, parseInt(e.target.value, 10) || 1)))
                    }
                    className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <p className="text-fg-muted text-xs">1–50 items</p>
                </div>

                {/* Difficulty */}
                <div className="flex-1 space-y-1">
                  <Label className="text-sm font-medium">Difficulty</Label>
                  <Select value={difficulty} onValueChange={setDifficulty}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Any difficulty" />
                    </SelectTrigger>
                    <SelectContent>
                      {DIFFICULTY_OPTIONS.map(({ value, label }) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Source PDF upload (CC-3) */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">
                  Source PDF{" "}
                  <span className="text-fg-muted font-normal">(optional — max 14 MB)</span>
                </Label>

                <input
                  ref={pdfInputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={handlePdfSelect}
                  disabled={pdfUploading}
                />

                {!sourcePdfFile && !pdfUploading ? (
                  <button
                    type="button"
                    onClick={() => pdfInputRef.current?.click()}
                    className="border-input text-fg-muted hover:border-brand hover:text-brand flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed px-3 py-3 text-sm transition-colors"
                  >
                    <UploadCloud className="h-4 w-4" />
                    Upload PDF to guide generation
                  </button>
                ) : pdfUploading ? (
                  <div className="bg-surface-sunken flex items-center gap-2 rounded-md px-3 py-2.5 text-sm">
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                    <span className="text-fg-muted">Uploading {sourcePdfFile?.name}…</span>
                  </div>
                ) : sourcePdfPath ? (
                  <div className="bg-surface-sunken flex items-center gap-2 rounded-md px-3 py-2">
                    <FileText className="text-brand h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1 truncate text-sm">{sourcePdfFile?.name}</span>
                    <button
                      type="button"
                      onClick={clearPdf}
                      className="text-fg-muted hover:text-destructive ml-1 shrink-0"
                      aria-label="Remove PDF"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : null}

                {pdfUploadError && <p className="text-destructive text-xs">{pdfUploadError}</p>}
              </div>

              {generateError && (
                <div className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">
                  {generateError}
                </div>
              )}
            </div>
          )}

          {/* Generating state */}
          {generating && (
            <div className="flex flex-col items-center justify-center gap-4 py-16">
              <Loader2 className="text-brand h-8 w-8 animate-spin" />
              <div className="text-center">
                <p className="text-sm font-medium">
                  Generating {count} item{count === 1 ? "" : "s"}
                  {sourcePdfPath ? " from your PDF" : ""}…
                </p>
                <p className="text-fg-muted mt-1 text-xs">This may take 15–30 seconds.</p>
              </div>
            </div>
          )}

          {/* Drafts list */}
          {!generating && drafts.length > 0 && (
            <div className="space-y-2 px-6 py-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  {drafts.length} draft{drafts.length === 1 ? "" : "s"} generated
                  {acceptedDrafts.size > 0 && (
                    <span className="text-fg-muted ml-2 font-normal">
                      ({acceptedDrafts.size} accepted)
                    </span>
                  )}
                </p>
                {pendingCount > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={acceptAll}
                    disabled={acceptingAll}
                    className="h-7 gap-1 px-2 text-xs"
                  >
                    <CheckCheck className="h-3 w-3" />
                    {acceptingAll ? "Accepting…" : `Accept all (${pendingCount})`}
                  </Button>
                )}
              </div>

              <div className="space-y-2">
                {drafts.map((draft, idx) => {
                  const isAccepted = acceptedDrafts.has(idx);
                  const isExpanded = expandedDrafts.has(idx);
                  const isAccepting = acceptingDraft === idx;

                  // Build a UnifiedItem-shaped object for ItemPreview rendering.
                  const previewItem = toItemEditorModel({
                    id: `draft_${idx}`,
                    type: draft.itemType,
                    payload: draft.payload,
                    title: draft.title,
                    spaceId,
                    storyPointId,
                    tenantId: "preview",
                    orderIndex: idx,
                    createdAt: "1970-01-01T00:00:00.000Z",
                    updatedAt: "1970-01-01T00:00:00.000Z",
                    createdBy: "preview",
                    updatedBy: "preview",
                    archivedAt: null,
                  } as CanonicalItem);

                  return (
                    <div
                      key={idx}
                      className={`bg-background overflow-hidden rounded-md border transition-opacity ${
                        isAccepted ? "opacity-50" : ""
                      }`}
                    >
                      <div className="flex items-center gap-2 px-3 py-2">
                        <button
                          type="button"
                          onClick={() => toggleExpand(idx)}
                          className="text-fg-muted hover:text-foreground"
                          aria-label={isExpanded ? "Collapse preview" : "Expand preview"}
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleExpand(idx)}
                          className="hover:text-brand flex-1 text-left text-sm"
                        >
                          {draft.title || "Untitled"}
                        </button>

                        {draft.itemType === "question" && draft.questionType && (
                          <Badge variant="secondary" className="text-[10px] capitalize">
                            {draft.questionType}
                          </Badge>
                        )}
                        {draft.bloomsLevel && (
                          <Badge variant="outline" className="text-[10px] capitalize">
                            {draft.bloomsLevel}
                          </Badge>
                        )}

                        {isAccepted ? (
                          <span className="text-success text-xs font-medium">Accepted</span>
                        ) : (
                          <Button
                            size="sm"
                            className="h-6 gap-1 px-2 text-[11px]"
                            onClick={() => acceptDraft(idx)}
                            disabled={isAccepting || acceptingAll}
                          >
                            {isAccepting ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : null}
                            {isAccepting ? "Saving…" : "Accept"}
                          </Button>
                        )}
                      </div>

                      <div
                        className={`duration-base ease-standard grid transition-[grid-template-rows] ${
                          isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                        }`}
                      >
                        <div className="overflow-hidden">
                          {isExpanded && (
                            <div className="border-t px-4 py-3">
                              <ItemPreview item={previewItem} />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Generate error with no drafts */}
          {!generating && drafts.length === 0 && generateError && (
            <div className="bg-destructive/10 text-destructive mx-6 my-4 rounded-md px-3 py-2 text-sm">
              {generateError}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4">
          {drafts.length === 0 && !generating ? (
            <div className="flex items-center justify-between gap-3">
              <Button variant="ghost" size="sm" onClick={handleClose} disabled={pdfUploading}>
                Cancel
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={selectedTypes.length === 0 || pdfUploading}
                className="gap-2"
              >
                {pdfUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {pdfUploading ? "Uploading PDF…" : "Generate"}
              </Button>
            </div>
          ) : !generating ? (
            <div className="flex items-center justify-between gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDrafts([]);
                  setGenerateError(null);
                  setAcceptedDrafts(new Set());
                  setExpandedDrafts(new Set());
                }}
                disabled={acceptingAll}
              >
                <X className="h-3.5 w-3.5" /> Discard all &amp; start over
              </Button>
              <Button variant="outline" size="sm" onClick={handleClose} disabled={acceptingAll}>
                Done
              </Button>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
