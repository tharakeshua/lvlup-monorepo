import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  useSpace,
  useStoryPoints,
  useVersions,
  useSaveSpace,
  useSaveStoryPoint,
  useSaveItem,
  useDuplicateSpace,
  useApiError,
  useRepos,
} from "@levelup/query";
import {
  sonnerToast,
  Button,
  StatusBadge,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Skeleton,
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  RichTextViewer,
  Checkbox,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  BreadcrumbSeparator,
  Progress,
} from "@levelup/shared-ui";
import type { UnifiedItem, QuestionPayload, MaterialPayload } from "@levelup/shared-types";
import type { Space, StoryPoint, UnifiedItem as CanonicalItem } from "@levelup/domain";
import { asSectionId } from "@levelup/domain";
import {
  ArrowLeft,
  Globe,
  Archive,
  Settings2,
  List,
  Plus,
  GripVertical,
  Trash2,
  ChevronDown,
  ChevronRight,
  FileText,
  HelpCircle,
  Bot,
  Library,
  History,
  Clock,
  Eye,
  Pencil,
  Sparkles,
  CheckCircle2,
  CircleAlert,
  Copy,
  Loader2,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import SpaceSettingsPanel, {
  type SpaceSettingsDraft,
} from "../../components/spaces/SpaceSettingsPanel";
import PublishReadinessDialog from "../../components/spaces/PublishReadinessDialog";
import {
  getPublishReadiness,
  getReadinessProgress,
} from "../../components/spaces/space-authoring-model";
import StoryPointEditor from "../../components/spaces/StoryPointEditor";
import ItemEditor from "../../components/spaces/ItemEditor";
import ItemPreview from "../../components/spaces/ItemPreview";
import RubricEditor from "../../components/spaces/RubricEditor";
import AgentConfigPanel from "../../components/spaces/AgentConfigPanel";
import QuestionBankImportDialog from "../../components/spaces/QuestionBankImportDialog";
import GenerateContentPanel from "../../components/spaces/GenerateContentPanel";
import {
  toItemEditorModel,
  toSaveItemData,
  type ItemEditView,
} from "../../components/spaces/item-editor-contract";
import {
  createStoryPointDuplicatePlan,
  remapSectionIdForDuplicate,
  reorderStoryPoints,
} from "../../components/spaces/story-point-structure";
import ConfirmDialog from "../../components/shared/ConfirmDialog";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useAuthSession } from "../../sdk/session";

type EditorTab = "settings" | "content" | "rubric" | "agents" | "versions";

/** Loose view over a `@levelup/query` content version (the seam returns `unknown`). */
interface VersionView {
  id: string;
  changeSummary?: string;
  changeType?: string;
  entityType?: string;
  // SDK timestamps are ISO strings at rest; legacy seed data may carry the
  // Firestore `{_seconds}` shape — handle both.
  changedAt?: string | number | { _seconds: number } | null;
}

function formatVersionDate(ts: VersionView["changedAt"]): string {
  if (ts == null) return "";
  const ms =
    typeof ts === "string" ? Date.parse(ts) : typeof ts === "number" ? ts : ts._seconds * 1000;
  if (Number.isNaN(ms)) return "";
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SortableItem({
  item,
  storyPointId: _storyPointId,
  onEdit,
  onDuplicate,
  onDelete,
  duplicating,
  selected,
  onToggleSelect,
  expanded,
  onToggleExpand,
}: {
  item: UnifiedItem;
  storyPointId: string;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  duplicating?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  expanded?: boolean;
  onToggleExpand?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="bg-background overflow-hidden rounded-md border">
      <div className="flex items-center gap-2 px-3 py-2">
        {onToggleSelect && (
          <Checkbox
            checked={selected}
            onCheckedChange={onToggleSelect}
            aria-label={`Select ${item.title || "item"}`}
            className="h-4 w-4"
          />
        )}
        <button
          {...attributes}
          {...listeners}
          className="text-muted-foreground hover:text-foreground cursor-grab"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onToggleExpand}
          className="text-muted-foreground hover:text-foreground"
          aria-label={expanded ? "Collapse preview" : "Expand preview"}
          aria-expanded={!!expanded}
        >
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </button>
        {item.type === "question" ? (
          <HelpCircle className="text-info h-4 w-4" />
        ) : (
          <FileText className="text-success h-4 w-4" />
        )}
        <button
          onClick={onToggleExpand ?? onEdit}
          className="hover:text-brand flex-1 text-left text-sm"
        >
          {item.title || "Untitled"}
          <span className="text-fg-secondary bg-surface-sunken rounded-pill ml-2 px-1.5 py-0.5 text-xs capitalize">
            {item.type === "question"
              ? (item.payload as QuestionPayload).questionType
              : (item.payload as MaterialPayload).materialType}
          </span>
        </button>
        <Button
          variant="ghost"
          size="icon"
          className="hover:text-brand h-11 w-11"
          onClick={onEdit}
          aria-label={`Edit ${item.title || "item"}`}
          title="Edit item"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="hover:text-brand h-11 w-11"
          onClick={onDuplicate}
          disabled={duplicating}
          aria-label={
            duplicating
              ? `Duplicating ${item.title || "item"}`
              : `Duplicate ${item.title || "item"}`
          }
          title="Duplicate item"
        >
          {duplicating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="hover:bg-destructive/10 hover:text-destructive h-11 w-11"
          onClick={onDelete}
          aria-label={`Delete ${item.title || "item"}`}
          title="Delete item"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div
        className={`duration-base ease-standard grid transition-[grid-template-rows] ${
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          {expanded && (
            <div className="border-t px-4 py-3">
              <ItemPreview item={item} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SortableStoryPoint({
  sp,
  isExpanded,
  onToggle,
  onDelete,
  onEdit,
  onPreview,
  onAddSection,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  position,
  count,
  duplicating,
  reordering,
  liveItemCount,
}: {
  sp: StoryPoint;
  isExpanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onPreview?: () => void;
  onAddSection?: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  position: number;
  count: number;
  duplicating?: boolean;
  reordering?: boolean;
  liveItemCount?: number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: sp.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isTest = sp.type === "timed_test" || sp.type === "quiz" || sp.type === "practice";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-card border-subtle shadow-e1 rounded-lg border"
    >
      <div className="flex flex-wrap items-center gap-2 px-3 py-3 sm:px-4">
        <button
          {...attributes}
          {...listeners}
          className="text-muted-foreground hover:text-foreground focus-visible:ring-brand flex h-11 w-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2"
          aria-label={`Drag ${sp.title || "story point"} to reorder`}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <button
          onClick={onToggle}
          className="focus-visible:ring-brand flex min-w-40 flex-1 items-center gap-2 rounded-md text-left focus-visible:outline-none focus-visible:ring-2"
          aria-label={`${isExpanded ? "Collapse" : "Expand"} ${sp.title || "story point"}`}
          aria-expanded={isExpanded}
        >
          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <span className="text-sm font-medium">{sp.title}</span>
          <span className="text-fg-secondary bg-surface-sunken rounded-pill ml-2 px-1.5 py-0.5 text-xs capitalize">
            {sp.type}
          </span>
        </button>
        <div className="text-muted-foreground order-3 flex w-full items-center gap-2 pl-11 text-xs sm:order-none sm:w-auto sm:pl-0">
          <span className="font-mono">{liveItemCount ?? sp.stats?.itemCount ?? 0} items</span>
          {sp.stats?.completionCount != null && sp.stats.completionCount > 0 && (
            <span className="font-mono">{sp.stats.completionCount} completions</span>
          )}
          {sp.difficulty && <span className="capitalize">{sp.difficulty}</span>}
        </div>
        {isTest && onPreview && (
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11"
            onClick={onPreview}
            aria-label="Preview as student"
            title="Preview as Student"
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>
        )}
        {onAddSection && (
          <Button
            variant="outline"
            size="sm"
            className="min-h-11 gap-1 px-2 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              onAddSection();
            }}
            title="Add section"
          >
            <Plus className="h-3 w-3" /> Section
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11"
          onClick={onMoveUp}
          disabled={position === 0 || reordering}
          aria-label={`Move ${sp.title || "story point"} up`}
          title="Move up"
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11"
          onClick={onMoveDown}
          disabled={position === count - 1 || reordering}
          aria-label={`Move ${sp.title || "story point"} down`}
          title="Move down"
        >
          <ArrowDown className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11"
          onClick={onDuplicate}
          disabled={duplicating}
          aria-label={`Duplicate ${sp.title || "story point"}`}
          title="Duplicate story point"
        >
          {duplicating ? (
            <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11"
          onClick={onEdit}
          aria-label="Edit settings"
        >
          <Settings2 className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="hover:bg-destructive/10 hover:text-destructive h-11 w-11"
          onClick={onDelete}
          aria-label="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export default function SpaceEditorPage() {
  const { spaceId } = useParams<{ spaceId: string }>();
  const navigate = useNavigate();
  // tenantId kept only for the ItemEditor child prop (tenant is otherwise
  // implicit in @levelup/query, derived from auth claims server-side).
  const tenantId = useAuthSession((s) => s.currentTenantId);
  const { data: space, isLoading, refetch } = useSpace<Space>(spaceId ?? "");
  const { handleError } = useApiError();
  const { itemRepo } = useRepos();

  // Mutation hooks. saveSpace IS the lifecycle transition verb (publish/archive/
  // unpublish = a status change in data) — there is no separate publish/archive
  // callable. Deletes use the `deleted` convention on the relevant save callable.
  const saveSpace = useSaveSpace();
  const saveStoryPoint = useSaveStoryPoint();
  const saveItem = useSaveItem();
  const duplicateSpace = useDuplicateSpace();

  const [activeTab, setActiveTab] = useState<EditorTab>("settings");
  const [storyPoints, setStoryPoints] = useState<StoryPoint[]>([]);
  const [expandedSP, setExpandedSP] = useState<string | null>(null);
  const [editingSP, setEditingSP] = useState<StoryPoint | null>(null);
  const [items, setItems] = useState<Record<string, UnifiedItem[]>>({});
  // Live item counts per story point. Authoritative — denormalized stats can be
  // stale for seeded data because the seed bypasses the stats-incrementing
  // saveItem callable.
  const [liveCounts, setLiveCounts] = useState<Record<string, number>>({});
  const [editingItem, setEditingItem] = useState<UnifiedItem | null>(null);
  const [editingItemSPId, setEditingItemSPId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [importBankSPId, setImportBankSPId] = useState<string | null>(null);
  const [generateAiSPId, setGenerateAiSPId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [_bulkSelectSP, _setBulkSelectSP] = useState<string | null>(null);
  const [duplicatingStoryPointId, setDuplicatingStoryPointId] = useState<string | null>(null);
  const [duplicatingItemId, setDuplicatingItemId] = useState<string | null>(null);
  const [reorderingStoryPoints, setReorderingStoryPoints] = useState(false);

  const publishReadiness = useMemo(
    () => (space ? getPublishReadiness(space, storyPoints, liveCounts) : []),
    [space, storyPoints, liveCounts]
  );
  const publishIssues = publishReadiness.filter((item) => !item.ready);
  const readinessProgress = getReadinessProgress(publishReadiness);

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    variant: "destructive" | "default";
    onConfirm: () => void | Promise<void>;
  }>({
    open: false,
    title: "",
    description: "",
    confirmLabel: "",
    variant: "default",
    onConfirm: () => {},
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Story points (tenant-scoped server-side). Synced into local state so the DnD
  // reorder + inline section edits can mutate optimistically.
  const storyPointsQuery = useStoryPoints<{ items: StoryPoint[] }>(spaceId ?? "", {
    enabled: !!spaceId,
  });
  const reloadStoryPoints = useCallback(async () => {
    const res = await storyPointsQuery.refetch();
    const next = (res.data?.items ?? []) as StoryPoint[];
    setStoryPoints(next);
    return next;
  }, [storyPointsQuery]);
  useEffect(() => {
    if (storyPointsQuery.data?.items) {
      setStoryPoints(storyPointsQuery.data.items as StoryPoint[]);
    }
  }, [storyPointsQuery.data]);
  useEffect(() => {
    if (storyPointsQuery.isError) {
      handleError(storyPointsQuery.error, "Failed to load story points");
    }
  }, [storyPointsQuery.isError, storyPointsQuery.error, handleError]);

  // Items for a story point. The list read is answer-stripped — fine for the
  // editor's row display; the answer-bearing payload is fetched on edit-open
  // (getForEdit) and on duplicate/preview.
  const listAllItems = useCallback(
    async (storyPointId: string): Promise<CanonicalItem[]> => {
      if (!spaceId) return [];
      let page = (await itemRepo.paginate({ spaceId, storyPointId })) as {
        items: CanonicalItem[];
        nextCursor: string | null;
        fetchNextPage: () => Promise<{
          items: CanonicalItem[];
          nextCursor: string | null;
          fetchNextPage: () => Promise<unknown>;
        }>;
      };
      const all = [...page.items];
      while (page.nextCursor) {
        page = (await page.fetchNextPage()) as typeof page;
        all.push(...page.items);
      }
      return all;
    },
    [spaceId, itemRepo]
  );

  const loadItems = useCallback(
    async (storyPointId: string): Promise<UnifiedItem[]> => {
      if (!spaceId) return [];
      try {
        const loaded = (await listAllItems(storyPointId)).map((item) => toItemEditorModel(item));
        setItems((prev) => ({ ...prev, [storyPointId]: loaded }));
        setLiveCounts((prev) => ({ ...prev, [storyPointId]: loaded.length }));
        return loaded;
      } catch (err) {
        handleError(err, "Failed to load items");
        return [];
      }
    },
    [spaceId, listAllItems, handleError]
  );

  useEffect(() => {
    if (expandedSP) loadItems(expandedSP);
  }, [expandedSP, loadItems]);

  // Fetch live item counts for each story point by listing items per SP. Runs
  // whenever the story-point list changes. (NOTE: counts reflect the first page
  // of the items list; very large story points may undercount.)
  useEffect(() => {
    if (!spaceId || storyPoints.length === 0) return;
    let cancelled = false;
    (async () => {
      const results = await Promise.all(
        storyPoints.map(async (sp) => {
          try {
            return [sp.id, (await listAllItems(sp.id)).length] as const;
          } catch {
            return [sp.id, 0] as const;
          }
        })
      );
      if (cancelled) return;
      setLiveCounts((prev) => {
        const next = { ...prev };
        for (const [id, n] of results) next[id] = n;
        return next;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [spaceId, storyPoints, listAllItems]);

  // Version history (only fetched while the History tab is active).
  const versionsQuery = useVersions<{ items: VersionView[] }>(spaceId ?? "", {
    enabled: activeTab === "versions" && !!spaceId,
  });
  const versions = (versionsQuery.data?.items ?? []) as VersionView[];
  const versionsLoading = versionsQuery.isLoading && activeTab === "versions";

  // Keyboard shortcuts (P0-3: Cmd+Enter is handled INSIDE ItemEditor and saves;
  // here we only handle non-editor shortcuts).
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;

      // Ctrl/Cmd+N: Add new story point (when no editor open)
      if (isMod && e.key === "n" && !editingItem && !editingSP) {
        e.preventDefault();
        handleAddStoryPoint();
      }

      // Escape: Cancel current action
      if (e.key === "Escape") {
        if (editingItem) {
          setEditingItem(null);
          setEditingItemSPId(null);
        } else if (editingSP) {
          setEditingSP(null);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingItem, editingSP]);

  // --- Handlers (all on @levelup/query save callables). NOTE: the contract
  // request schemas are `.strict()`. Form-only representations (major-unit
  // price and the legacy item form payload) are converted at this boundary.

  const handleSaveSettings = async (data: SpaceSettingsDraft) => {
    if (!spaceId) return false;
    setSaving(true);
    try {
      // Convert price: panel holds a raw major-unit number (e.g. 10.50 USD);
      // contract expects zMoney { amountMinor: int, currency } (minor = cents).
      const rawPrice = data.price;
      const rawCurrency = data.currency;
      const price =
        rawPrice !== undefined && rawCurrency
          ? { amountMinor: Math.round(rawPrice * 100), currency: rawCurrency }
          : undefined;
      await saveSpace.mutateAsync({
        id: spaceId,
        data: {
          title: data.title,
          description: data.description,
          type: data.type,
          subject: data.subject,
          labels: data.labels,
          accessType: data.accessType,
          thumbnailUrl: data.thumbnailUrl,
          // Assessment defaults.
          allowRetakes: data.allowRetakes,
          maxRetakes: data.maxRetakes,
          defaultTimeLimitMinutes: data.defaultTimeLimitMinutes,
          showCorrectAnswers: data.showCorrectAnswers,
          defaultRubric: data.defaultRubric,
          // Store listing fields.
          publishedToStore: data.publishedToStore,
          price,
          storeDescription: data.storeDescription,
          storeThumbnailUrl: data.storeThumbnailUrl,
        },
      });
      await refetch();
      sonnerToast.success("Settings saved");
      return true;
    } catch (err) {
      handleError(err, "Failed to save settings");
      return false;
    } finally {
      setSaving(false);
    }
  };

  // saveSpace is the lifecycle transition verb (status change, server-enforced
  // against ALLOWED_TRANSITIONS) — there is no separate publish/archive callable.
  const handlePublish = async () => {
    if (!spaceId) return;
    try {
      await saveSpace.mutateAsync({ id: spaceId, data: { status: "published" } });
      await refetch();
      setPublishDialogOpen(false);
      sonnerToast.success("Space published successfully");
    } catch (err) {
      handleError(err, "Failed to publish space");
    }
  };

  const handleArchive = async () => {
    setConfirmDialog({
      open: true,
      title: "Archive Space",
      description:
        "Are you sure you want to archive this space? Students will no longer be able to access it.",
      confirmLabel: "Archive",
      variant: "destructive",
      onConfirm: async () => {
        if (!spaceId) return;
        try {
          await saveSpace.mutateAsync({ id: spaceId, data: { status: "archived" } });
          await refetch();
          sonnerToast.success("Space archived");
        } catch (err) {
          handleError(err, "Failed to archive space");
        }
      },
    });
  };

  const handleUnpublish = async () => {
    if (!spaceId) return;
    try {
      await saveSpace.mutateAsync({ id: spaceId, data: { status: "draft" } });
      await refetch();
      sonnerToast.success("Space unpublished");
    } catch (err) {
      handleError(err, "Failed to unpublish space");
    }
  };

  const handleRequestUnpublish = () => {
    setConfirmDialog({
      open: true,
      title: "Return space to draft?",
      description:
        "Students will lose access to this space until you publish it again. Their existing progress and results will be preserved.",
      confirmLabel: "Return to draft",
      variant: "default",
      onConfirm: handleUnpublish,
    });
  };

  const handleRestoreToDraft = async () => {
    if (!spaceId) return;
    try {
      await saveSpace.mutateAsync({ id: spaceId, data: { status: "draft" } });
      await refetch();
      sonnerToast.success("Space restored to draft", {
        description: "You can continue editing and publish it again when ready.",
      });
    } catch (err) {
      handleError(err, "Failed to restore space");
    }
  };

  const handleDuplicateSpace = async () => {
    if (!spaceId) return;
    try {
      const result = (await duplicateSpace.mutateAsync({ spaceId })) as { id: string };
      sonnerToast.success("Space duplicated", {
        description: "A new draft copy is ready to edit.",
      });
      navigate(`/spaces/${result.id}/edit`);
    } catch (err) {
      handleError(err, "Failed to duplicate space");
    }
  };

  const handleAddStoryPoint = async (spType: StoryPoint["type"] = "standard") => {
    if (!spaceId) return;
    try {
      await saveStoryPoint.mutateAsync({
        spaceId,
        data: {
          title: `Story Point ${storyPoints.length + 1}`,
          orderIndex: storyPoints.length,
          type: spType,
        },
      });
      await reloadStoryPoints();
      sonnerToast.success("Story point added");
    } catch (err) {
      handleError(err, "Failed to add story point");
    }
  };

  const handleAddSection = async (storyPointId: string) => {
    if (!spaceId) return;
    const sp = storyPoints.find((s) => s.id === storyPointId);
    if (!sp) return;
    const existing = sp.sections ?? [];
    const newSection = {
      id: asSectionId(`section_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
      title: `Section ${existing.length + 1}`,
      orderIndex: existing.length,
    };
    const nextSections = [...existing, newSection];
    try {
      // title + type are required by the strict saveStoryPoint schema even on
      // a sections-only update.
      await saveStoryPoint.mutateAsync({
        id: storyPointId,
        spaceId,
        data: { title: sp.title, type: sp.type, sections: nextSections },
      });
      setStoryPoints((prev) =>
        prev.map((s) => (s.id === storyPointId ? { ...s, sections: nextSections } : s))
      );
      sonnerToast.success("Section added");
    } catch (err) {
      handleError(err, "Failed to add section");
    }
  };

  const handleDeleteStoryPoint = (spId: string) => {
    const sp = storyPoints.find((s) => s.id === spId);
    setConfirmDialog({
      open: true,
      title: "Delete Story Point",
      description: `Are you sure you want to delete "${sp?.title ?? "this story point"}"? This will also delete all items within it.`,
      confirmLabel: "Delete",
      variant: "destructive",
      onConfirm: async () => {
        if (!spaceId || !sp) return;
        try {
          await saveStoryPoint.mutateAsync({
            id: spId,
            spaceId,
            data: { title: sp.title, type: sp.type, deleted: true },
          });
          setStoryPoints((prev) => prev.filter((s) => s.id !== spId));
          setItems((prev) => {
            const next = { ...prev };
            delete next[spId];
            return next;
          });
          if (expandedSP === spId) setExpandedSP(null);
          sonnerToast.success("Story point deleted");
        } catch (err) {
          handleError(err, "Failed to delete story point");
        }
      },
    });
  };

  const handleDuplicateStoryPoint = async (source: StoryPoint) => {
    if (!spaceId || duplicatingStoryPointId) return;
    setDuplicatingStoryPointId(source.id);
    let duplicateId: string | undefined;
    try {
      // Hydrate every source item through the authoring read before creating the
      // duplicate. The list projection intentionally strips answer keys.
      const sourceItems = (await listAllItems(source.id)).sort(
        (left, right) => left.orderIndex - right.orderIndex
      );
      const hydratedItems = await Promise.all(
        sourceItems.map(async (item) => {
          const edit = await itemRepo.getForEdit({
            spaceId,
            storyPointId: source.id,
            itemId: item.id,
          });
          if (!edit.item) throw new Error(`Could not load “${item.title || "Untitled item"}”`);
          return toItemEditorModel(edit.item as ItemEditView);
        })
      );
      const duplicatePlan = createStoryPointDuplicatePlan(
        source,
        storyPoints.length,
        (_section, index) =>
          `section_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 8)}`
      );
      const created = (await saveStoryPoint.mutateAsync({
        spaceId,
        data: duplicatePlan.data,
      })) as { id: string };
      duplicateId = created.id;

      for (const [index, item] of hydratedItems.entries()) {
        await saveItem.mutateAsync({
          spaceId,
          storyPointId: duplicateId,
          data: toSaveItemData(item, {
            orderIndex: index,
            sectionId: remapSectionIdForDuplicate(item.sectionId, duplicatePlan.sectionIdMap),
          }),
        });
      }

      await reloadStoryPoints();
      await loadItems(duplicateId);
      setExpandedSP(duplicateId);
      sonnerToast.success("Story point duplicated", {
        description: `${hydratedItems.length} ${hydratedItems.length === 1 ? "item was" : "items were"} copied.`,
      });
    } catch (err) {
      // Avoid leaving a partial copy behind when any item save fails.
      if (duplicateId) {
        try {
          await saveStoryPoint.mutateAsync({
            id: duplicateId,
            spaceId,
            data: { title: `${source.title} copy`, type: source.type, deleted: true },
          });
          await reloadStoryPoints();
        } catch {
          // The original error remains the most actionable one for the teacher.
        }
      }
      handleError(err, "Failed to duplicate story point");
    } finally {
      setDuplicatingStoryPointId(null);
    }
  };

  const handleReorderStoryPoints = async (fromIndex: number, toIndex: number) => {
    if (!spaceId || reorderingStoryPoints || fromIndex === toIndex) return;
    const reordered = reorderStoryPoints(storyPoints, fromIndex, toIndex);
    const previousOrder = storyPoints;
    setStoryPoints(reordered);
    setReorderingStoryPoints(true);

    try {
      const previousById = new Map(previousOrder.map((storyPoint) => [storyPoint.id, storyPoint]));
      await Promise.all(
        reordered.map((sp) =>
          previousById.get(sp.id)?.orderIndex === sp.orderIndex
            ? Promise.resolve()
            : saveStoryPoint.mutateAsync({
                id: sp.id,
                spaceId,
                data: { title: sp.title, type: sp.type, orderIndex: sp.orderIndex },
              })
        )
      );
    } catch (err) {
      setStoryPoints(previousOrder);
      await reloadStoryPoints();
      handleError(err, "Failed to reorder story points");
    } finally {
      setReorderingStoryPoints(false);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIndex = storyPoints.findIndex((sp) => sp.id === active.id);
    const toIndex = storyPoints.findIndex((sp) => sp.id === over.id);
    if (fromIndex === -1 || toIndex === -1) return;
    void handleReorderStoryPoints(fromIndex, toIndex);
  };

  const handleItemDragEnd = async (storyPointId: string, event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !spaceId) return;

    const spItems = items[storyPointId] ?? [];
    const oldIndex = spItems.findIndex((i) => i.id === active.id);
    const newIndex = spItems.findIndex((i) => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = [...spItems];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);

    const previousItems = spItems;
    setItems((prev) => ({ ...prev, [storyPointId]: reordered }));

    try {
      // saveItem is a full upsert that re-extracts the answer key from `payload`,
      // so a reorder must send the ANSWER-BEARING payload (getForEdit) to avoid
      // wiping answers. Only items whose index changed are re-saved.
      await Promise.all(
        reordered.map(async (item, idx) => {
          if (item.orderIndex === idx) return;
          const edit = await itemRepo.getForEdit({ spaceId, storyPointId, itemId: item.id });
          const full = edit.item ? toItemEditorModel(edit.item as ItemEditView) : item;
          await saveItem.mutateAsync({
            id: item.id,
            spaceId,
            storyPointId,
            data: toSaveItemData(full, { orderIndex: idx }),
          });
        })
      );
    } catch (err) {
      setItems((prev) => ({ ...prev, [storyPointId]: previousItems }));
      handleError(err, "Failed to reorder items");
    }
  };

  const handleAddItem = async (
    storyPointId: string,
    type: "question" | "material",
    sectionId?: string
  ) => {
    if (!spaceId) return;
    try {
      const currentItems = items[storyPointId] ?? [];
      const orderIndex = currentItems.length;
      // Use defaults that mirror ItemEditor.defaultQuestionData (P0-18).
      const payload =
        type === "question"
          ? {
              type: "question" as const,
              questionData: {
                questionType: "mcq" as const,
                options: [],
                shuffleOptions: false,
              },
            }
          : {
              type: "material" as const,
              materialData: { materialType: "text" as const, body: "" },
            };
      const title = type === "question" ? "New Question" : "New Material";

      const result = (await saveItem.mutateAsync({
        spaceId,
        storyPointId,
        data: { type, title, orderIndex, payload, sectionId },
      })) as { id: string };

      // Reload from server and pick up the freshly-created item.
      const loaded = await loadItems(storyPointId);
      const created = loaded.find((i) => i.id === result.id);
      if (created) {
        setEditingItem(created);
        setEditingItemSPId(storyPointId);
      }
    } catch (err) {
      handleError(err, "Failed to add item");
    }
  };

  const handleDeleteItem = (storyPointId: string, itemId: string) => {
    const item = (items[storyPointId] ?? []).find((i) => i.id === itemId);
    setConfirmDialog({
      open: true,
      title: "Delete Item",
      description: `Are you sure you want to delete "${item?.title ?? "this item"}"? This action cannot be undone.`,
      confirmLabel: "Delete",
      variant: "destructive",
      onConfirm: async () => {
        if (!spaceId) return;
        try {
          // saveItem's strict schema requires `type` + `payload` even for a
          // soft-delete; fetch the answer-bearing item to build a valid payload.
          const edit = await itemRepo.getForEdit({ spaceId, storyPointId, itemId });
          if (!item && !edit.item) throw new Error("Item not found");
          const full = edit.item ? toItemEditorModel(edit.item as ItemEditView) : item!;
          await saveItem.mutateAsync({
            id: itemId,
            spaceId,
            storyPointId,
            data: toSaveItemData(full, { deleted: true }),
          });
          setItems((prev) => ({
            ...prev,
            [storyPointId]: (prev[storyPointId] ?? []).filter((i) => i.id !== itemId),
          }));
          if (editingItem?.id === itemId) {
            setEditingItem(null);
            setEditingItemSPId(null);
          }
          sonnerToast.success("Item deleted");
        } catch (err) {
          handleError(err, "Failed to delete item");
        }
      },
    });
  };

  const handleDuplicateItem = async (storyPointId: string, item: UnifiedItem) => {
    if (!spaceId || duplicatingItemId) return;
    setDuplicatingItemId(item.id);
    try {
      const edit = await itemRepo.getForEdit({
        spaceId,
        storyPointId,
        itemId: item.id,
      });
      const full = edit.item ? toItemEditorModel(edit.item as ItemEditView) : item;
      const currentItems = items[storyPointId] ?? [];
      const nextOrderIndex =
        currentItems.reduce((highest, current) => Math.max(highest, current.orderIndex ?? -1), -1) +
        1;
      const baseTitle =
        full.title?.trim() ||
        (full.type === "question" ? "Untitled question" : "Untitled material");

      await saveItem.mutateAsync({
        spaceId,
        storyPointId,
        data: toSaveItemData(full, {
          title: `${baseTitle} (copy)`,
          orderIndex: nextOrderIndex,
        }),
      });
      await loadItems(storyPointId);
      sonnerToast.success("Item duplicated", {
        description: `“${baseTitle} (copy)” was added to this story point.`,
      });
    } catch (err) {
      handleError(err, "Failed to duplicate item");
    } finally {
      setDuplicatingItemId(null);
    }
  };

  // Open an item in the editor with its ANSWER-BEARING payload (getForEdit);
  // the list rows themselves are answer-stripped.
  const openItemForEdit = async (item: UnifiedItem, storyPointId: string) => {
    setEditingItemSPId(storyPointId);
    if (!spaceId) {
      setEditingItem(item);
      return;
    }
    try {
      const edit = await itemRepo.getForEdit({ spaceId, storyPointId, itemId: item.id });
      setEditingItem(edit.item ? toItemEditorModel(edit.item as ItemEditView) : item);
    } catch (err) {
      handleError(err, "Failed to open item for editing");
      setEditingItem(item);
    }
  };

  /**
   * Persist an item edit. P0-2: split into manual save (closes the sheet) and
   * auto-save (keeps the sheet open).
   */
  const persistItem = async (item: UnifiedItem) => {
    // Prefer the item's own storyPointId so we don't accidentally write to a
    // stale React-state SP id (P1-38).
    const targetSP = item.storyPointId || editingItemSPId;
    if (!spaceId || !targetSP) return;
    await saveItem.mutateAsync({
      id: item.id,
      spaceId,
      storyPointId: targetSP,
      data: toSaveItemData(item),
    });
    setItems((prev) => ({
      ...prev,
      [targetSP]: (prev[targetSP] ?? []).map((i) => (i.id === item.id ? item : i)),
    }));
  };

  const handleSaveItem = async (item: UnifiedItem) => {
    try {
      await persistItem(item);
      setEditingItem(null);
      setEditingItemSPId(null);
      sonnerToast.success("Item saved");
    } catch (err) {
      handleError(err, "Failed to save item");
    }
  };

  const handleAutoSaveItem = async (item: UnifiedItem) => {
    // P0-2: auto-save MUST NOT close the sheet. Errors are reported by
    // ItemEditor itself; we just propagate them.
    await persistItem(item);
  };

  const handleSaveStoryPoint = async (sp: StoryPoint) => {
    if (!spaceId) return;
    try {
      await saveStoryPoint.mutateAsync({
        id: sp.id,
        spaceId,
        data: {
          title: sp.title,
          description: sp.description,
          type: sp.type,
          sections: sp.sections,
          assessmentConfig: sp.assessmentConfig,
          defaultRubric: sp.defaultRubric,
          defaultRubricId: sp.defaultRubricId,
          difficulty: sp.difficulty,
          estimatedTimeMinutes: sp.estimatedTimeMinutes,
          orderIndex: sp.orderIndex,
        },
      });
      setStoryPoints((prev) => prev.map((s) => (s.id === sp.id ? sp : s)));
      setEditingSP(null);
      sonnerToast.success("Story point saved");
    } catch (err) {
      handleError(err, "Failed to save story point");
    }
  };

  const handleAutoSaveStoryPoint = async (sp: StoryPoint) => {
    if (!spaceId) return;
    await saveStoryPoint.mutateAsync({
      id: sp.id,
      spaceId,
      data: {
        title: sp.title,
        description: sp.description,
        type: sp.type,
        sections: sp.sections,
        assessmentConfig: sp.assessmentConfig,
        defaultRubric: sp.defaultRubric,
        defaultRubricId: sp.defaultRubricId,
        difficulty: sp.difficulty,
        estimatedTimeMinutes: sp.estimatedTimeMinutes,
        orderIndex: sp.orderIndex,
      },
    });
    setStoryPoints((prev) => prev.map((storyPoint) => (storyPoint.id === sp.id ? sp : storyPoint)));
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!space) {
    return (
      <div className="py-24 text-center">
        <p className="text-muted-foreground">Space not found</p>
        <Button variant="link" onClick={() => navigate("/spaces")} className="mt-3">
          Back to Spaces
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmLabel={confirmDialog.confirmLabel}
        variant={confirmDialog.variant}
        onConfirm={() => {
          confirmDialog.onConfirm();
          setConfirmDialog((prev) => ({ ...prev, open: false }));
        }}
      />

      <PublishReadinessDialog
        open={publishDialogOpen}
        onOpenChange={setPublishDialogOpen}
        items={publishReadiness}
        onNavigate={(tab) => setActiveTab(tab)}
        onPublish={handlePublish}
        publishing={saveSpace.isPending}
      />

      {/* Breadcrumbs */}
      <Breadcrumb className="overflow-hidden">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/spaces">Spaces</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem className="min-w-0">
            <BreadcrumbPage className="truncate">{space.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <header className="bg-card border-subtle shadow-e1 rounded-xl border p-4 sm:p-5">
        <div className="flex items-start gap-3 sm:gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/spaces")}
            aria-label="Back to Spaces"
            className="min-h-11 min-w-11 shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="text-brand text-[0.6875rem] font-semibold uppercase tracking-[0.14em]">
              Space authoring
            </p>
            <h1 className="font-display mt-1 truncate text-xl font-semibold sm:text-2xl">
              {space.title}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge status={space.status} />
              <span className="text-muted-foreground text-xs capitalize">{space.type}</span>
              <span className="text-muted-foreground text-xs" aria-label="Story point count">
                {storyPoints.length} story point{storyPoints.length === 1 ? "" : "s"}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 sm:justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPreviewOpen(true)}
            className="min-h-11 flex-1 sm:min-h-9 sm:flex-none"
          >
            <Eye className="h-3.5 w-3.5" />
            Preview
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDuplicateSpace}
            disabled={duplicateSpace.isPending}
            className="min-h-11 flex-1 sm:min-h-9 sm:flex-none"
          >
            {duplicateSpace.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {duplicateSpace.isPending ? "Duplicating…" : "Duplicate"}
          </Button>
          {space.status === "draft" && (
            <Button
              onClick={() => setPublishDialogOpen(true)}
              size="sm"
              disabled={saveSpace.isPending}
              className="bg-success text-fg-on-accent hover:bg-success/90 min-h-11 w-full sm:min-h-9 sm:w-auto"
            >
              <Globe className="h-3.5 w-3.5" />
              {publishIssues.length === 0 ? "Review & publish" : "Prepare to publish"}
            </Button>
          )}
          {space.status === "published" && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRequestUnpublish}
                disabled={saveSpace.isPending}
                className="min-h-11 flex-1 sm:min-h-9 sm:flex-none"
              >
                Return to draft
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleArchive}
                disabled={saveSpace.isPending}
                className="min-h-11 flex-1 sm:min-h-9 sm:flex-none"
              >
                <Archive className="h-3.5 w-3.5" /> Archive
              </Button>
            </>
          )}
          {space.status === "archived" && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRestoreToDraft}
              disabled={saveSpace.isPending}
              className="min-h-11 w-full sm:min-h-9 sm:w-auto"
            >
              Restore to Draft
            </Button>
          )}
        </div>
      </header>

      {space.status === "draft" && (
        <section
          className="bg-surface-sunken border-subtle rounded-xl border p-4"
          aria-labelledby="readiness-summary-title"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                publishIssues.length === 0
                  ? "bg-success/10 text-success"
                  : "bg-warning/10 text-warning"
              }`}
            >
              {publishIssues.length === 0 ? (
                <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
              ) : (
                <CircleAlert className="h-5 w-5" aria-hidden="true" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 id="readiness-summary-title" className="text-sm font-semibold">
                    {publishIssues.length === 0
                      ? "Student-ready draft"
                      : `${publishIssues.length} publishing step${publishIssues.length === 1 ? "" : "s"} left`}
                  </h2>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {readinessProgress}% of the essential publishing checklist is complete.
                  </p>
                </div>
                <span className="font-mono text-xs font-semibold" aria-hidden="true">
                  {readinessProgress}%
                </span>
              </div>
              <Progress
                value={readinessProgress}
                className="mt-2 h-1.5"
                indicatorClassName={publishIssues.length === 0 ? "bg-success" : undefined}
                aria-label={`${readinessProgress}% publish ready`}
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPublishDialogOpen(true)}
              className="min-h-11 shrink-0 sm:min-h-9"
            >
              Review readiness
            </Button>
          </div>
        </section>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as EditorTab)}>
        <TabsList className="border-subtle h-auto w-full max-w-full justify-start gap-1 overflow-x-auto rounded-none border-b bg-transparent p-0">
          <TabsTrigger
            value="settings"
            className="text-fg-muted duration-fast ease-standard data-[state=active]:border-brand data-[state=active]:text-brand min-h-11 shrink-0 gap-1.5 rounded-none border-b-2 border-transparent px-3 transition-colors data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            <Settings2 className="h-4 w-4" />
            Settings
          </TabsTrigger>
          <TabsTrigger
            value="content"
            className="text-fg-muted duration-fast ease-standard data-[state=active]:border-brand data-[state=active]:text-brand min-h-11 shrink-0 gap-1.5 rounded-none border-b-2 border-transparent px-3 transition-colors data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            <List className="h-4 w-4" />
            Content
          </TabsTrigger>
          <TabsTrigger
            value="rubric"
            className="text-fg-muted duration-fast ease-standard data-[state=active]:border-brand data-[state=active]:text-brand min-h-11 shrink-0 gap-1.5 rounded-none border-b-2 border-transparent px-3 transition-colors data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            <FileText className="h-4 w-4" />
            Rubric
          </TabsTrigger>
          <TabsTrigger
            value="agents"
            className="text-fg-muted duration-fast ease-standard data-[state=active]:border-brand data-[state=active]:text-brand min-h-11 shrink-0 gap-1.5 rounded-none border-b-2 border-transparent px-3 transition-colors data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            <Bot className="h-4 w-4" />
            Agent Config
          </TabsTrigger>
          <TabsTrigger
            value="versions"
            className="text-fg-muted duration-fast ease-standard data-[state=active]:border-brand data-[state=active]:text-brand min-h-11 shrink-0 gap-1.5 rounded-none border-b-2 border-transparent px-3 transition-colors data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            <History className="h-4 w-4" />
            History
          </TabsTrigger>
        </TabsList>

        {/* Settings tab */}
        <TabsContent value="settings" className="mt-4">
          <SpaceSettingsPanel space={space} onSave={handleSaveSettings} saving={saving} />
        </TabsContent>

        {/* Content tab - Story Points */}
        <TabsContent value="content" className="mt-4">
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="font-display text-lg font-semibold">
                Story Points ({storyPoints.length})
              </h2>
              <div className="flex flex-col gap-2 min-[420px]:flex-row">
                <Select onValueChange={(v) => handleAddStoryPoint(v as StoryPoint["type"])}>
                  <SelectTrigger
                    className="min-h-11 w-full min-[420px]:w-44"
                    aria-label="Add story point of type"
                  >
                    <SelectValue placeholder="+ Add as type…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="practice">Practice</SelectItem>
                    <SelectItem value="quiz">Quiz</SelectItem>
                    <SelectItem value="timed_test">Timed Test</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  onClick={() => handleAddStoryPoint("standard")}
                  size="sm"
                  className="min-h-11"
                  disabled={saveStoryPoint.isPending}
                  title="Add Story Point (Ctrl+N)"
                >
                  <Plus className="h-3.5 w-3.5" /> Add
                </Button>
              </div>
            </div>

            {storyPoints.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
                <List className="text-fg-muted h-8 w-8" />
                <p className="font-display mt-2 text-lg">No story points yet</p>
                <Button onClick={() => handleAddStoryPoint("standard")} size="sm" className="mt-3">
                  <Plus className="h-3 w-3" /> Add Story Point
                </Button>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={storyPoints.map((sp) => sp.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {storyPoints.map((sp, index) => (
                      <div key={sp.id}>
                        <SortableStoryPoint
                          sp={sp}
                          isExpanded={expandedSP === sp.id}
                          onToggle={() => setExpandedSP((prev) => (prev === sp.id ? null : sp.id))}
                          onDelete={() => handleDeleteStoryPoint(sp.id)}
                          onEdit={() => setEditingSP(sp)}
                          onPreview={() =>
                            navigate(`/spaces/${spaceId}/story-points/${sp.id}/preview`)
                          }
                          onAddSection={() => handleAddSection(sp.id)}
                          onDuplicate={() => void handleDuplicateStoryPoint(sp)}
                          onMoveUp={() => void handleReorderStoryPoints(index, index - 1)}
                          onMoveDown={() => void handleReorderStoryPoints(index, index + 1)}
                          position={index}
                          count={storyPoints.length}
                          duplicating={duplicatingStoryPointId === sp.id}
                          reordering={reorderingStoryPoints}
                          liveItemCount={liveCounts[sp.id]}
                        />

                        {/* Expanded: show items grouped by section */}
                        {expandedSP === sp.id && (
                          <div className="ml-8 mt-2 space-y-2 pb-2">
                            {(() => {
                              const allItems = items[sp.id] ?? [];
                              const sortedSections = (sp.sections ?? [])
                                .slice()
                                .sort((a, b) => a.orderIndex - b.orderIndex);
                              const definedSectionIds = new Set<string>(
                                sortedSections.map((s) => s.id)
                              );
                              const unsectioned = allItems.filter(
                                (it) => !it.sectionId || !definedSectionIds.has(it.sectionId)
                              );

                              const renderItem = (item: UnifiedItem) => (
                                <SortableItem
                                  key={item.id}
                                  item={item}
                                  storyPointId={sp.id}
                                  onEdit={() => openItemForEdit(item, sp.id)}
                                  onDuplicate={() => void handleDuplicateItem(sp.id, item)}
                                  onDelete={() => handleDeleteItem(sp.id, item.id)}
                                  duplicating={duplicatingItemId === item.id}
                                  selected={selectedItems.has(item.id)}
                                  onToggleSelect={() => {
                                    setSelectedItems((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(item.id)) next.delete(item.id);
                                      else next.add(item.id);
                                      return next;
                                    });
                                  }}
                                  expanded={expandedItems.has(item.id)}
                                  onToggleExpand={() => {
                                    setExpandedItems((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(item.id)) next.delete(item.id);
                                      else next.add(item.id);
                                      return next;
                                    });
                                  }}
                                />
                              );

                              return (
                                <DndContext
                                  sensors={sensors}
                                  collisionDetection={closestCenter}
                                  onDragEnd={(e) => handleItemDragEnd(sp.id, e)}
                                >
                                  <SortableContext
                                    items={allItems.map((i) => i.id)}
                                    strategy={verticalListSortingStrategy}
                                  >
                                    <div className="space-y-3">
                                      {sortedSections.map((section) => {
                                        const sectionItems = allItems.filter(
                                          (it) => it.sectionId === section.id
                                        );
                                        return (
                                          <div key={section.id} className="space-y-1.5">
                                            <div className="flex items-center justify-between gap-2 border-b pb-1">
                                              <div className="flex items-baseline gap-2">
                                                <h4 className="text-fg-muted tracking-caps text-xs font-bold uppercase">
                                                  {section.title}
                                                </h4>
                                                <span className="text-muted-foreground font-mono text-[10px]">
                                                  {sectionItems.length}{" "}
                                                  {sectionItems.length === 1 ? "item" : "items"}
                                                </span>
                                              </div>
                                              <div className="flex items-center gap-1">
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  className="h-6 gap-1 px-2 text-[11px]"
                                                  onClick={() =>
                                                    handleAddItem(sp.id, "question", section.id)
                                                  }
                                                  title="Add question to this section"
                                                >
                                                  <HelpCircle className="h-3 w-3" /> Question
                                                </Button>
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  className="h-6 gap-1 px-2 text-[11px]"
                                                  onClick={() =>
                                                    handleAddItem(sp.id, "material", section.id)
                                                  }
                                                  title="Add material to this section"
                                                >
                                                  <FileText className="h-3 w-3" /> Material
                                                </Button>
                                              </div>
                                            </div>
                                            {sectionItems.length > 0 ? (
                                              <div className="space-y-1.5">
                                                {sectionItems.map(renderItem)}
                                              </div>
                                            ) : (
                                              <p className="text-muted-foreground py-1 pl-1 text-xs italic">
                                                No items in this section yet.
                                              </p>
                                            )}
                                          </div>
                                        );
                                      })}

                                      {(unsectioned.length > 0 || sortedSections.length === 0) && (
                                        <div className="space-y-1.5">
                                          <div className="flex items-center justify-between gap-2 border-b pb-1">
                                            <div className="flex items-baseline gap-2">
                                              <h4 className="text-fg-muted tracking-caps text-xs font-bold uppercase">
                                                {sortedSections.length === 0
                                                  ? "Items"
                                                  : "Unsectioned"}
                                              </h4>
                                              <span className="text-muted-foreground font-mono text-[10px]">
                                                {unsectioned.length}{" "}
                                                {unsectioned.length === 1 ? "item" : "items"}
                                              </span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 gap-1 px-2 text-[11px]"
                                                onClick={() => handleAddItem(sp.id, "question")}
                                                title="Add question"
                                              >
                                                <HelpCircle className="h-3 w-3" /> Question
                                              </Button>
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 gap-1 px-2 text-[11px]"
                                                onClick={() => handleAddItem(sp.id, "material")}
                                                title="Add material"
                                              >
                                                <FileText className="h-3 w-3" /> Material
                                              </Button>
                                            </div>
                                          </div>
                                          <div className="space-y-1.5">
                                            {unsectioned.map(renderItem)}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </SortableContext>
                                </DndContext>
                              );
                            })()}

                            {/* Bulk actions */}
                            {selectedItems.size > 0 &&
                              (items[sp.id] ?? []).some((i) => selectedItems.has(i.id)) && (
                                <div className="bg-muted flex items-center gap-2 rounded-md px-3 py-2">
                                  <span className="text-xs font-medium">
                                    {
                                      (items[sp.id] ?? []).filter((i) => selectedItems.has(i.id))
                                        .length
                                    }{" "}
                                    selected
                                  </span>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => {
                                      const toDelete = (items[sp.id] ?? []).filter((i) =>
                                        selectedItems.has(i.id)
                                      );
                                      setConfirmDialog({
                                        open: true,
                                        title: "Delete Selected Items",
                                        description: `Are you sure you want to delete ${toDelete.length} item(s)? This action cannot be undone.`,
                                        confirmLabel: "Delete All",
                                        variant: "destructive",
                                        onConfirm: async () => {
                                          if (!spaceId) return;
                                          try {
                                            for (const it of toDelete) {
                                              const edit = await itemRepo.getForEdit({
                                                spaceId,
                                                storyPointId: sp.id,
                                                itemId: it.id,
                                              });
                                              const full = edit.item
                                                ? toItemEditorModel(edit.item as ItemEditView)
                                                : it;
                                              await saveItem.mutateAsync({
                                                id: it.id,
                                                spaceId,
                                                storyPointId: sp.id,
                                                data: toSaveItemData(full, { deleted: true }),
                                              });
                                            }
                                            setItems((prev) => ({
                                              ...prev,
                                              [sp.id]: (prev[sp.id] ?? []).filter(
                                                (i) => !selectedItems.has(i.id)
                                              ),
                                            }));
                                            setSelectedItems(new Set());
                                            sonnerToast.success(`Deleted ${toDelete.length} items`);
                                          } catch (err) {
                                            handleError(err, "Failed to delete items");
                                          }
                                        },
                                      });
                                    }}
                                  >
                                    <Trash2 className="h-3 w-3" /> Delete
                                  </Button>
                                  {storyPoints.length > 1 && (
                                    <Select
                                      onValueChange={async (targetSpId) => {
                                        if (!spaceId || targetSpId === sp.id) return;
                                        const toMove = (items[sp.id] ?? []).filter((i) =>
                                          selectedItems.has(i.id)
                                        );
                                        try {
                                          for (const it of toMove) {
                                            // Move = create answer-bearing copy in
                                            // the target SP, then soft-delete the
                                            // source (getForEdit preserves answers).
                                            const edit = await itemRepo.getForEdit({
                                              spaceId,
                                              storyPointId: sp.id,
                                              itemId: it.id,
                                            });
                                            const full = edit.item
                                              ? toItemEditorModel(edit.item as ItemEditView)
                                              : it;
                                            await saveItem.mutateAsync({
                                              spaceId,
                                              storyPointId: targetSpId,
                                              data: toSaveItemData(full, {
                                                orderIndex: items[targetSpId]?.length ?? 0,
                                                sectionId: undefined,
                                              }),
                                            });
                                            await saveItem.mutateAsync({
                                              id: it.id,
                                              spaceId,
                                              storyPointId: sp.id,
                                              data: toSaveItemData(full, { deleted: true }),
                                            });
                                          }
                                          await loadItems(sp.id);
                                          if (expandedSP === targetSpId || items[targetSpId]) {
                                            await loadItems(targetSpId);
                                          }
                                          setSelectedItems(new Set());
                                          sonnerToast.success(`Moved ${toMove.length} items`);
                                        } catch (err) {
                                          handleError(err, "Failed to move items");
                                        }
                                      }}
                                    >
                                      <SelectTrigger className="h-8 w-40 text-xs">
                                        <SelectValue placeholder="Move to..." />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {storyPoints
                                          .filter((s) => s.id !== sp.id)
                                          .map((s) => (
                                            <SelectItem key={s.id} value={s.id}>
                                              {s.title}
                                            </SelectItem>
                                          ))}
                                      </SelectContent>
                                    </Select>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setSelectedItems(new Set())}
                                  >
                                    Clear
                                  </Button>
                                </div>
                              )}

                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-brand/40 text-brand border-dashed"
                                onClick={() => setImportBankSPId(sp.id)}
                              >
                                <Library className="h-3 w-3" /> Import from Bank
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-brand/40 text-brand border-dashed"
                                onClick={() => setGenerateAiSPId(sp.id)}
                              >
                                <Sparkles className="h-3 w-3" /> Generate with AI
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </TabsContent>

        {/* Rubric tab */}
        <TabsContent value="rubric" className="mt-4">
          <RubricEditor
            rubric={space.defaultRubric}
            onSave={(rubric) => handleSaveSettings({ defaultRubric: rubric })}
          />
        </TabsContent>

        {/* Agent Config tab */}
        <TabsContent value="agents" className="mt-4">
          {spaceId && <AgentConfigPanel spaceId={spaceId} />}
        </TabsContent>

        {/* Version History tab */}
        <TabsContent value="versions" className="mt-4">
          <div className="space-y-4">
            <h2 className="font-display text-lg font-semibold">Version History</h2>
            {versionsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : versions.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
                <History className="text-fg-muted h-8 w-8" />
                <p className="font-display mt-2 text-lg">No version history yet</p>
                <p className="text-muted-foreground text-xs">
                  Changes will be tracked when you publish, archive, or edit content.
                </p>
              </div>
            ) : (
              <div className="relative">
                <div className="bg-border absolute bottom-0 left-4 top-0 w-px" />
                <div className="space-y-1">
                  {versions.map((v) => (
                    <div key={v.id} className="relative flex items-start gap-4 py-2 pl-10">
                      <div className="border-background bg-primary absolute left-2.5 top-3 h-3 w-3 rounded-full border-2" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{v.changeSummary}</p>
                        <div className="mt-0.5 flex items-center gap-2">
                          <span className="bg-surface-sunken text-fg-secondary rounded-pill inline-flex items-center px-2 py-0.5 text-xs capitalize">
                            {v.changeType}
                          </span>
                          <span className="text-muted-foreground text-xs capitalize">
                            {v.entityType}
                          </span>
                          {v.changedAt != null && (
                            <span className="text-muted-foreground flex items-center gap-1 text-xs">
                              <Clock className="h-3 w-3" />
                              {formatVersionDate(v.changedAt)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Item Editor Sheet */}
      <Sheet
        open={!!editingItem}
        onOpenChange={(open) => {
          if (!open) {
            setEditingItem(null);
            setEditingItemSPId(null);
          }
        }}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl" aria-describedby={undefined}>
          <SheetHeader>
            <SheetTitle>Edit Item</SheetTitle>
          </SheetHeader>
          {editingItem && editingItemSPId && (
            <div className="mt-4">
              <ItemEditor
                key={editingItem.id}
                item={editingItem}
                tenantId={tenantId ?? undefined}
                spaceId={spaceId}
                sections={storyPoints.find((s) => s.id === editingItemSPId)?.sections ?? []}
                storyPointType={storyPoints.find((s) => s.id === editingItemSPId)?.type}
                onSave={handleSaveItem}
                onAutoSave={handleAutoSaveItem}
                onCancel={() => {
                  setEditingItem(null);
                  setEditingItemSPId(null);
                }}
              />
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Story Point Editor Sheet */}
      <Sheet
        open={!!editingSP}
        onOpenChange={(open) => {
          if (!open) setEditingSP(null);
        }}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl" aria-describedby={undefined}>
          <SheetHeader>
            <SheetTitle>Edit Story Point</SheetTitle>
          </SheetHeader>
          {editingSP && (
            <div className="mt-4">
              <StoryPointEditor
                storyPoint={editingSP}
                onSave={handleSaveStoryPoint}
                onAutoSave={handleAutoSaveStoryPoint}
                onCancel={() => setEditingSP(null)}
              />
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Question Bank Import Dialog */}
      {spaceId && importBankSPId && (
        <QuestionBankImportDialog
          open={!!importBankSPId}
          onOpenChange={(open) => {
            if (!open) setImportBankSPId(null);
          }}
          spaceId={spaceId}
          storyPointId={importBankSPId}
          onImported={() => {
            if (importBankSPId) loadItems(importBankSPId);
          }}
        />
      )}

      {/* Generate Content with AI Panel */}
      {spaceId && generateAiSPId && (
        <GenerateContentPanel
          open={!!generateAiSPId}
          onOpenChange={(open) => {
            if (!open) setGenerateAiSPId(null);
          }}
          spaceId={spaceId}
          storyPointId={generateAiSPId}
          onAccepted={() => {
            if (generateAiSPId) loadItems(generateAiSPId);
          }}
        />
      )}

      {/* Content Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" /> Student Preview — {space.title}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-6">
            {storyPoints.map((sp) => (
              <div key={sp.id} className="space-y-3">
                <h3 className="font-display border-b pb-2 text-lg font-semibold">{sp.title}</h3>
                {sp.description && (
                  <p className="text-muted-foreground text-sm">{sp.description}</p>
                )}
                <div className="space-y-4 pl-4">
                  {(items[sp.id] ?? []).map((it) => (
                    <div key={it.id} className="rounded-lg border p-4">
                      {it.title && <h4 className="mb-2 font-medium">{it.title}</h4>}
                      {it.content && <RichTextViewer content={it.content} className="mb-3" />}
                      {it.type === "question" && (
                        <p className="text-muted-foreground text-xs capitalize">
                          {(it.payload as QuestionPayload).questionType?.replace(/[-_]/g, " ")}{" "}
                          question
                        </p>
                      )}
                      {it.type === "material" && (
                        <p className="text-muted-foreground text-xs capitalize">
                          {(it.payload as MaterialPayload).materialType} material
                        </p>
                      )}
                      {it.attachments && it.attachments.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {it.attachments.map((att) => (
                            <span
                              key={att.id}
                              className="bg-surface-sunken text-fg-secondary rounded-pill px-2 py-1 text-xs"
                            >
                              {att.fileName}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {(!items[sp.id] || items[sp.id].length === 0) && (
                    <p className="text-muted-foreground text-sm italic">
                      No items loaded. Expand this story point first.
                    </p>
                  )}
                </div>
              </div>
            ))}
            {storyPoints.length === 0 && (
              <p className="text-muted-foreground text-sm">No story points to preview.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
