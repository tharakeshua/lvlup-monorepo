import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useCurrentTenantId } from "@levelup/shared-stores";
import {
  useSpace,
  useUpdateSpace,
  usePublishSpace,
  useArchiveSpace,
  useCreateStoryPoint,
  useUpdateStoryPoint,
  useCreateItem,
  useUpdateItem,
  useDeleteItem,
  useDeleteStoryPoint,
  useApiError,
} from "@levelup/shared-hooks";
import {
  collection,
  getDocs,
  getCountFromServer,
  query,
  orderBy,
  where,
  writeBatch,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import {
  getFirebaseServices,
  callListVersions,
  type ContentVersionEntry,
} from "@levelup/shared-services";
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
} from "@levelup/shared-ui";
import type {
  Space,
  StoryPoint,
  UnifiedItem,
  QuestionPayload,
  MaterialPayload,
} from "@levelup/shared-types";
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
} from "lucide-react";
import SpaceSettingsPanel from "../../components/spaces/SpaceSettingsPanel";
import StoryPointEditor from "../../components/spaces/StoryPointEditor";
import ItemEditor from "../../components/spaces/ItemEditor";
import ItemPreview from "../../components/spaces/ItemPreview";
import RubricEditor from "../../components/spaces/RubricEditor";
import AgentConfigPanel from "../../components/spaces/AgentConfigPanel";
import QuestionBankImportDialog from "../../components/spaces/QuestionBankImportDialog";
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

type EditorTab = "settings" | "content" | "rubric" | "agents" | "versions";

function SortableItem({
  item,
  storyPointId: _storyPointId,
  onEdit,
  onDelete,
  selected,
  onToggleSelect,
  expanded,
  onToggleExpand,
}: {
  item: UnifiedItem;
  storyPointId: string;
  onEdit: () => void;
  onDelete: () => void;
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
          <HelpCircle className="h-4 w-4 text-blue-500" />
        ) : (
          <FileText className="h-4 w-4 text-green-500" />
        )}
        <button
          onClick={onToggleExpand ?? onEdit}
          className="hover:text-primary flex-1 text-left text-sm"
        >
          {item.title || "Untitled"}
          <span className="text-muted-foreground ml-2 text-xs capitalize">
            {item.type === "question"
              ? (item.payload as QuestionPayload).questionType
              : (item.payload as MaterialPayload).materialType}
          </span>
        </button>
        <Button
          variant="ghost"
          size="icon"
          className="hover:text-primary h-7 w-7"
          onClick={onEdit}
          aria-label="Edit"
          title="Edit"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="hover:bg-destructive/10 hover:text-destructive h-7 w-7"
          onClick={onDelete}
          aria-label="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${
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
  liveItemCount,
}: {
  sp: StoryPoint;
  isExpanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onPreview?: () => void;
  onAddSection?: () => void;
  liveItemCount?: number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: sp.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isTest = sp.type === "timed_test" || sp.type === "test" || sp.type === "quiz";

  return (
    <div ref={setNodeRef} style={style} className="bg-card rounded-lg border">
      <div className="flex items-center gap-2 px-4 py-3">
        <button
          {...attributes}
          {...listeners}
          className="text-muted-foreground hover:text-foreground cursor-grab"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <button
          onClick={onToggle}
          className="flex flex-1 items-center gap-2 text-left"
          aria-label="Toggle details"
        >
          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <span className="text-sm font-medium">{sp.title}</span>
          <span className="text-muted-foreground ml-2 text-xs capitalize">{sp.type}</span>
        </button>
        <div className="text-muted-foreground flex items-center gap-2 text-xs">
          <span>{liveItemCount ?? sp.stats?.totalItems ?? 0} items</span>
          {sp.stats?.totalQuestions != null && sp.stats.totalQuestions > 0 && (
            <span>{sp.stats.totalQuestions} Q</span>
          )}
          {sp.stats?.totalMaterials != null && sp.stats.totalMaterials > 0 && (
            <span>{sp.stats.totalMaterials} M</span>
          )}
          {sp.stats?.totalPoints != null && sp.stats.totalPoints > 0 && (
            <span>{sp.stats.totalPoints} pts</span>
          )}
          {sp.difficulty && <span className="capitalize">{sp.difficulty}</span>}
        </div>
        {isTest && onPreview && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
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
            className="h-7 gap-1 px-2 text-xs"
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
          className="h-7 w-7"
          onClick={onEdit}
          aria-label="Edit settings"
        >
          <Settings2 className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="hover:bg-destructive/10 hover:text-destructive h-7 w-7"
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
  const tenantId = useCurrentTenantId();
  const { data: space, isLoading, refetch } = useSpace(tenantId, spaceId ?? null);
  const { handleError } = useApiError();

  // Mutation hooks (use consolidated callables)
  const updateSpace = useUpdateSpace();
  const publishSpace = usePublishSpace();
  const archiveSpace = useArchiveSpace();
  const createStoryPoint = useCreateStoryPoint();
  const updateStoryPoint = useUpdateStoryPoint();
  const createItem = useCreateItem();
  const updateItem = useUpdateItem();
  const deleteItem = useDeleteItem();
  const deleteStoryPoint = useDeleteStoryPoint();

  const [activeTab, setActiveTab] = useState<EditorTab>("settings");
  const [storyPoints, setStoryPoints] = useState<StoryPoint[]>([]);
  const [expandedSP, setExpandedSP] = useState<string | null>(null);
  const [editingSP, setEditingSP] = useState<StoryPoint | null>(null);
  const [items, setItems] = useState<Record<string, UnifiedItem[]>>({});
  const [itemPaths, setItemPaths] = useState<Record<string, "nested" | "flat">>({});
  // Live item counts per story point. Authoritative — sp.stats.totalItems is
  // stale for seeded data because the seed bypasses the stats-incrementing
  // saveItem callable.
  const [liveCounts, setLiveCounts] = useState<Record<string, number>>({});
  const [editingItem, setEditingItem] = useState<UnifiedItem | null>(null);
  const [editingItemSPId, setEditingItemSPId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [importBankSPId, setImportBankSPId] = useState<string | null>(null);
  const [versions, setVersions] = useState<ContentVersionEntry[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const versionsLoaded = useRef(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [_bulkSelectSP, _setBulkSelectSP] = useState<string | null>(null);

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    onConfirm: () => void;
  }>({ open: false, title: "", description: "", confirmLabel: "", onConfirm: () => {} });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Load story points
  useEffect(() => {
    if (!tenantId || !spaceId) return;
    const load = async () => {
      try {
        const { db } = getFirebaseServices();
        const colRef = collection(db, `tenants/${tenantId}/spaces/${spaceId}/storyPoints`);
        const q = query(colRef, orderBy("orderIndex", "asc"));
        const snap = await getDocs(q);
        setStoryPoints(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as StoryPoint));
      } catch (err) {
        handleError(err, "Failed to load story points");
      }
    };
    load();
  }, [tenantId, spaceId, handleError]);

  // Items live at the canonical nested path
  // (storyPoints/{id}/items); legacy installs may still have them at the
  // flat /items path. Try nested first, fall back to flat, and remember
  // which path was used per story point so subsequent writes (reorder)
  // target the correct location.
  const loadItems = useCallback(
    async (storyPointId: string) => {
      if (!tenantId || !spaceId) return;
      try {
        const { db } = getFirebaseServices();
        const nestedRef = collection(
          db,
          `tenants/${tenantId}/spaces/${spaceId}/storyPoints/${storyPointId}/items`
        );
        let snap = await getDocs(query(nestedRef, orderBy("orderIndex", "asc")));
        let pathKind: "nested" | "flat" = "nested";
        if (snap.empty) {
          const flatRef = collection(db, `tenants/${tenantId}/spaces/${spaceId}/items`);
          const flatSnap = await getDocs(
            query(flatRef, where("storyPointId", "==", storyPointId), orderBy("orderIndex", "asc"))
          );
          if (!flatSnap.empty) {
            snap = flatSnap;
            pathKind = "flat";
          }
        }
        const loaded = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as UnifiedItem);
        setItems((prev) => ({ ...prev, [storyPointId]: loaded }));
        setItemPaths((prev) => ({ ...prev, [storyPointId]: pathKind }));
        setLiveCounts((prev) => ({ ...prev, [storyPointId]: loaded.length }));
      } catch (err) {
        handleError(err, "Failed to load items");
      }
    },
    [tenantId, spaceId, handleError]
  );

  useEffect(() => {
    if (expandedSP) loadItems(expandedSP);
  }, [expandedSP, loadItems]);

  // Fetch live item counts for each story point. Tries the canonical nested
  // path first; if empty, falls back to a count on the legacy flat path
  // filtered by storyPointId. Runs whenever the story-point list changes.
  useEffect(() => {
    if (!tenantId || !spaceId || storyPoints.length === 0) return;
    let cancelled = false;
    const { db } = getFirebaseServices();

    (async () => {
      const results = await Promise.all(
        storyPoints.map(async (sp) => {
          try {
            const nestedRef = collection(
              db,
              `tenants/${tenantId}/spaces/${spaceId}/storyPoints/${sp.id}/items`
            );
            const nestedCount = await getCountFromServer(nestedRef);
            const n = nestedCount.data().count;
            if (n > 0) return [sp.id, n] as const;

            const flatRef = collection(db, `tenants/${tenantId}/spaces/${spaceId}/items`);
            const flatCount = await getCountFromServer(
              query(flatRef, where("storyPointId", "==", sp.id))
            );
            return [sp.id, flatCount.data().count] as const;
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
  }, [tenantId, spaceId, storyPoints]);

  // Load versions when tab is active
  useEffect(() => {
    if (activeTab !== "versions" || !tenantId || !spaceId || versionsLoaded.current) return;
    const loadVersions = async () => {
      setVersionsLoading(true);
      try {
        const result = await callListVersions({ tenantId, spaceId, limit: 50 });
        setVersions(result.versions);
        versionsLoaded.current = true;
      } catch (err) {
        handleError(err, "Failed to load version history");
      } finally {
        setVersionsLoading(false);
      }
    };
    loadVersions();
  }, [activeTab, tenantId, spaceId, handleError]);

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

  // --- Fixed handlers: all use consolidated callables ---

  const handleSaveSettings = async (data: Partial<Space>) => {
    if (!tenantId || !spaceId) return;
    setSaving(true);
    try {
      await updateSpace.mutateAsync({
        id: spaceId,
        tenantId,
        data: {
          title: data.title,
          description: data.description,
          type: data.type,
          subject: data.subject,
          labels: data.labels,
          accessType: data.accessType,
          allowRetakes: data.allowRetakes,
          maxRetakes: data.maxRetakes,
          defaultTimeLimitMinutes: data.defaultTimeLimitMinutes,
          showCorrectAnswers: data.showCorrectAnswers,
          thumbnailUrl: data.thumbnailUrl,
          // Store listing fields
          price: data.price,
          currency: data.currency,
          publishedToStore: data.publishedToStore,
          storeDescription: data.storeDescription,
          storeThumbnailUrl: data.storeThumbnailUrl,
        },
      });
      await refetch();
      sonnerToast.success("Settings saved");
    } catch (err) {
      handleError(err, "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!tenantId || !spaceId) return;
    try {
      await publishSpace.mutateAsync({ tenantId, spaceId });
      await refetch();
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
      onConfirm: async () => {
        if (!tenantId || !spaceId) return;
        try {
          await archiveSpace.mutateAsync({ tenantId, spaceId });
          await refetch();
          sonnerToast.success("Space archived");
        } catch (err) {
          handleError(err, "Failed to archive space");
        }
      },
    });
  };

  const handleUnpublish = async () => {
    if (!tenantId || !spaceId) return;
    try {
      await updateSpace.mutateAsync({
        id: spaceId,
        tenantId,
        data: { status: "draft" },
      });
      await refetch();
      sonnerToast.success("Space unpublished");
    } catch (err) {
      handleError(err, "Failed to unpublish space");
    }
  };

  const handleAddStoryPoint = async (
    spType: StoryPoint["type"] = "standard"
  ) => {
    if (!tenantId || !spaceId) return;
    try {
      await createStoryPoint.mutateAsync({
        tenantId,
        spaceId,
        data: {
          title: `Story Point ${storyPoints.length + 1}`,
          orderIndex: storyPoints.length,
          type: spType,
        },
      });
      // Reload story points to get server-computed data
      const { db } = getFirebaseServices();
      const colRef = collection(db, `tenants/${tenantId}/spaces/${spaceId}/storyPoints`);
      const q = query(colRef, orderBy("orderIndex", "asc"));
      const snap = await getDocs(q);
      setStoryPoints(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as StoryPoint));
      sonnerToast.success("Story point added");
    } catch (err) {
      handleError(err, "Failed to add story point");
    }
  };

  const handleAddSection = async (storyPointId: string) => {
    if (!tenantId || !spaceId) return;
    const sp = storyPoints.find((s) => s.id === storyPointId);
    if (!sp) return;
    const existing = sp.sections ?? [];
    const newSection = {
      id: `section_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      title: `Section ${existing.length + 1}`,
      orderIndex: existing.length,
    };
    const nextSections = [...existing, newSection];
    try {
      await updateStoryPoint.mutateAsync({
        id: storyPointId,
        tenantId,
        spaceId,
        data: { sections: nextSections },
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
      onConfirm: async () => {
        if (!tenantId || !spaceId) return;
        try {
          await deleteStoryPoint.mutateAsync({ id: spId, tenantId, spaceId });
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

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !tenantId || !spaceId) return;

    const oldIndex = storyPoints.findIndex((sp) => sp.id === active.id);
    const newIndex = storyPoints.findIndex((sp) => sp.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = [...storyPoints];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);

    const previousOrder = storyPoints;
    setStoryPoints(reordered);

    try {
      const { db } = getFirebaseServices();
      const batch = writeBatch(db);
      reordered.forEach((sp, idx) => {
        batch.update(doc(db, `tenants/${tenantId}/spaces/${spaceId}/storyPoints`, sp.id), {
          orderIndex: idx,
          updatedAt: serverTimestamp(),
        });
      });
      await batch.commit();
    } catch (err) {
      setStoryPoints(previousOrder);
      handleError(err, "Failed to reorder story points");
    }
  };

  const handleItemDragEnd = async (storyPointId: string, event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !tenantId || !spaceId) return;

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
      const { db } = getFirebaseServices();
      const batch = writeBatch(db);
      const pathKind = itemPaths[storyPointId] ?? "nested";
      const itemsCollectionPath =
        pathKind === "nested"
          ? `tenants/${tenantId}/spaces/${spaceId}/storyPoints/${storyPointId}/items`
          : `tenants/${tenantId}/spaces/${spaceId}/items`;
      reordered.forEach((item, idx) => {
        batch.update(doc(db, itemsCollectionPath, item.id), {
          orderIndex: idx,
          updatedAt: serverTimestamp(),
        });
      });
      await batch.commit();
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
    if (!tenantId || !spaceId) return;
    try {
      const currentItems = items[storyPointId] ?? [];
      const orderIndex = currentItems.length;
      // Use defaults that mirror ItemEditor.defaultQuestionData (P0-18).
      const payload =
        type === "question"
          ? {
              questionType: "mcq" as const,
              content: "",
              questionData: { options: [], shuffleOptions: false },
            }
          : { materialType: "text" as const, content: "" };
      const title = type === "question" ? "New Question" : "New Material";

      const result = await createItem.mutateAsync({
        tenantId,
        spaceId,
        storyPointId,
        data: { type, title, orderIndex, payload, sectionId },
      });

      // Reload from server and pick up the freshly-created item — avoids
      // fabricating a local UnifiedItem missing audit fields and possibly
      // disagreeing with the server-stored payload (P0-18).
      const { db } = getFirebaseServices();
      const nestedRef = collection(
        db,
        `tenants/${tenantId}/spaces/${spaceId}/storyPoints/${storyPointId}/items`
      );
      const snap = await getDocs(query(nestedRef, orderBy("orderIndex", "asc")));
      const loaded = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as UnifiedItem);
      setItems((prev) => ({ ...prev, [storyPointId]: loaded }));
      setItemPaths((prev) => ({ ...prev, [storyPointId]: "nested" }));
      setLiveCounts((prev) => ({ ...prev, [storyPointId]: loaded.length }));

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
      onConfirm: async () => {
        if (!tenantId || !spaceId) return;
        try {
          await deleteItem.mutateAsync({
            id: itemId,
            tenantId,
            spaceId,
            storyPointId,
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

  /**
   * Persist an item edit. P0-2: split into manual save (closes the sheet) and
   * auto-save (keeps the sheet open).
   */
  const persistItem = async (item: UnifiedItem) => {
    // Prefer the item's own storyPointId so we don't accidentally write to a
    // stale React-state SP id (P1-38).
    const targetSP = item.storyPointId || editingItemSPId;
    if (!tenantId || !spaceId || !targetSP) return;
    await updateItem.mutateAsync({
      id: item.id,
      tenantId,
      spaceId,
      storyPointId: targetSP,
      data: {
        payload: item.payload,
        title: item.title,
        content: item.content,
        difficulty: item.difficulty,
        topics: item.topics,
        labels: item.labels,
        orderIndex: item.orderIndex,
        rubric: item.rubric,
        sectionId: item.sectionId,
        attachments: item.attachments,
        meta: item.meta,
      },
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
    if (!tenantId || !spaceId) return;
    try {
      await updateStoryPoint.mutateAsync({
        id: sp.id,
        tenantId,
        spaceId,
        data: {
          title: sp.title,
          description: sp.description,
          type: sp.type,
          sections: sp.sections,
          assessmentConfig: sp.assessmentConfig,
          defaultRubric: sp.defaultRubric,
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
        variant="destructive"
        onConfirm={() => {
          confirmDialog.onConfirm();
          setConfirmDialog((prev) => ({ ...prev, open: false }));
        }}
      />

      {/* Breadcrumbs */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/spaces">Spaces</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{space.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/spaces")}
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{space.title}</h1>
          <div className="mt-0.5 flex items-center gap-2">
            <StatusBadge status={space.status} />
            <span className="text-muted-foreground text-xs capitalize">{space.type}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)}>
            <Eye className="h-3.5 w-3.5" /> Preview
          </Button>
          {space.status === "draft" && (
            <Button
              onClick={handlePublish}
              size="sm"
              disabled={publishSpace.isPending}
              className="bg-green-600 text-white hover:bg-green-700"
            >
              <Globe className="h-3.5 w-3.5" /> Publish
            </Button>
          )}
          {space.status === "published" && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleUnpublish}
                disabled={updateSpace.isPending}
              >
                Unpublish
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleArchive}
                disabled={archiveSpace.isPending}
              >
                <Archive className="h-3.5 w-3.5" /> Archive
              </Button>
            </>
          )}
          {space.status === "archived" && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleUnpublish}
              disabled={updateSpace.isPending}
            >
              Restore to Draft
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as EditorTab)}>
        <TabsList>
          <TabsTrigger value="settings" className="gap-1.5">
            <Settings2 className="h-4 w-4" />
            Settings
          </TabsTrigger>
          <TabsTrigger value="content" className="gap-1.5">
            <List className="h-4 w-4" />
            Content
          </TabsTrigger>
          <TabsTrigger value="rubric" className="gap-1.5">
            <FileText className="h-4 w-4" />
            Rubric
          </TabsTrigger>
          <TabsTrigger value="agents" className="gap-1.5">
            <Bot className="h-4 w-4" />
            Agent Config
          </TabsTrigger>
          <TabsTrigger value="versions" className="gap-1.5">
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
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Story Points ({storyPoints.length})</h2>
              <div className="flex items-center gap-2">
                <Select onValueChange={(v) => handleAddStoryPoint(v as StoryPoint["type"])}>
                  <SelectTrigger className="w-44 h-9" aria-label="Add story point of type">
                    <SelectValue placeholder="+ Add as type…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="practice">Practice</SelectItem>
                    <SelectItem value="quiz">Quiz</SelectItem>
                    <SelectItem value="test">Test</SelectItem>
                    <SelectItem value="timed_test">Timed Test</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  onClick={() => handleAddStoryPoint("standard")}
                  size="sm"
                  disabled={createStoryPoint.isPending}
                  title="Add Story Point (Ctrl+N)"
                >
                  <Plus className="h-3.5 w-3.5" /> Add
                </Button>
              </div>
            </div>

            {storyPoints.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
                <List className="text-muted-foreground h-8 w-8" />
                <p className="text-muted-foreground mt-2 text-sm">No story points yet</p>
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
                    {storyPoints.map((sp) => (
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
                              const definedSectionIds = new Set(sortedSections.map((s) => s.id));
                              const unsectioned = allItems.filter(
                                (it) => !it.sectionId || !definedSectionIds.has(it.sectionId)
                              );

                              const renderItem = (item: UnifiedItem) => (
                                <SortableItem
                                  key={item.id}
                                  item={item}
                                  storyPointId={sp.id}
                                  onEdit={() => {
                                    setEditingItem(item);
                                    setEditingItemSPId(sp.id);
                                  }}
                                  onDelete={() => handleDeleteItem(sp.id, item.id)}
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
                                                <h4 className="text-foreground text-xs font-semibold uppercase tracking-wide">
                                                  {section.title}
                                                </h4>
                                                <span className="text-muted-foreground text-[10px]">
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
                                              <h4 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                                                {sortedSections.length === 0 ? "Items" : "Unsectioned"}
                                              </h4>
                                              <span className="text-muted-foreground text-[10px]">
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
                                        onConfirm: async () => {
                                          if (!tenantId || !spaceId) return;
                                          try {
                                            for (const it of toDelete) {
                                              await deleteItem.mutateAsync({
                                                id: it.id,
                                                tenantId,
                                                spaceId,
                                                storyPointId: sp.id,
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
                                        if (!tenantId || !spaceId || targetSpId === sp.id) return;
                                        const toMove = (items[sp.id] ?? []).filter((i) =>
                                          selectedItems.has(i.id)
                                        );
                                        try {
                                          for (const it of toMove) {
                                            // Delete from current SP and create in target SP
                                            await deleteItem.mutateAsync({
                                              id: it.id,
                                              tenantId,
                                              spaceId,
                                              storyPointId: sp.id,
                                            });
                                            await createItem.mutateAsync({
                                              tenantId,
                                              spaceId,
                                              storyPointId: targetSpId,
                                              data: {
                                                type: it.type,
                                                payload: it.payload,
                                                title: it.title,
                                                content: it.content,
                                                difficulty: it.difficulty,
                                                topics: it.topics,
                                                labels: it.labels,
                                              },
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
                                className="border-primary/40 text-primary border-dashed"
                                onClick={() => setImportBankSPId(sp.id)}
                              >
                                <Library className="h-3 w-3" /> Import from Bank
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
            <h2 className="text-lg font-semibold">Version History</h2>
            {versionsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : versions.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
                <History className="text-muted-foreground h-8 w-8" />
                <p className="text-muted-foreground mt-2 text-sm">No version history yet</p>
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
                          <span className="bg-muted inline-flex items-center rounded-full px-2 py-0.5 text-xs capitalize">
                            {v.changeType}
                          </span>
                          <span className="text-muted-foreground text-xs capitalize">
                            {v.entityType}
                          </span>
                          {v.changedAt && (
                            <span className="text-muted-foreground flex items-center gap-1 text-xs">
                              <Clock className="h-3 w-3" />
                              {new Date(v.changedAt._seconds * 1000).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
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
                sections={
                  storyPoints.find((s) => s.id === editingItemSPId)?.sections ?? []
                }
                storyPointType={
                  storyPoints.find((s) => s.id === editingItemSPId)?.type
                }
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
                onCancel={() => setEditingSP(null)}
              />
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Question Bank Import Dialog */}
      {tenantId && spaceId && importBankSPId && (
        <QuestionBankImportDialog
          open={!!importBankSPId}
          onOpenChange={(open) => {
            if (!open) setImportBankSPId(null);
          }}
          tenantId={tenantId}
          spaceId={spaceId}
          storyPointId={importBankSPId}
          onImported={() => {
            if (importBankSPId) loadItems(importBankSPId);
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
                <h3 className="border-b pb-2 text-lg font-semibold">{sp.title}</h3>
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
                            <span key={att.id} className="bg-muted rounded px-2 py-1 text-xs">
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
