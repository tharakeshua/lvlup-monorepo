import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  useSpaces,
  useSaveSpace,
  useSaveStoryPoint,
  useDuplicateSpace,
  useApiError,
} from "@levelup/query";
import { sonnerToast, Button, Input, StatusBadge } from "@levelup/shared-ui";
import { Plus, Search, BookOpen, Copy, Users, Loader2, RotateCcw, Sparkles } from "lucide-react";
import type { Space, SpaceStatus } from "@levelup/domain";
import SpaceCreationDialog, {
  type SpaceCreationDraft,
} from "../../components/spaces/SpaceCreationDialog";

const STATUS_TABS: { label: string; value: SpaceStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Draft", value: "draft" },
  { label: "Published", value: "published" },
  { label: "Archived", value: "archived" },
];

export default function SpaceListPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<SpaceStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const { handleError } = useApiError();

  const createSpace = useSaveSpace();
  const createStoryPoint = useSaveStoryPoint();
  const duplicateSpace = useDuplicateSpace();

  // @levelup/query hooks are tenant-scoped server-side via auth claims; the
  // result is a `{ items }` page, not a bare array.
  const statusFilter = activeTab === "all" ? undefined : activeTab;
  const {
    data: spacesPage,
    isLoading,
    isError,
    refetch,
  } = useSpaces<{ items: Space[] }>({
    status: statusFilter,
  });
  const spaces = spacesPage?.items ?? [];

  const filtered = spaces.filter((s: Space) =>
    s.title.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreateSpace = async (draft: SpaceCreationDraft) => {
    try {
      const result = (await createSpace.mutateAsync({
        data: {
          title: draft.title,
          type: draft.template.type,
          subject: draft.subject,
          description: draft.description,
          accessType: draft.accessType,
        },
      })) as { id: string };

      let startersCreated = true;
      for (const [index, storyPoint] of draft.template.starterStoryPoints.entries()) {
        try {
          await createStoryPoint.mutateAsync({
            spaceId: result.id,
            data: {
              title: storyPoint.title,
              description: storyPoint.description,
              type: storyPoint.type,
              orderIndex: index,
            },
          });
        } catch {
          startersCreated = false;
          break;
        }
      }

      setShowCreateDialog(false);
      if (startersCreated) {
        sonnerToast.success("Space created", {
          description:
            draft.template.starterStoryPoints.length > 0
              ? `${draft.template.starterStoryPoints.length} starter story points are ready to shape.`
              : "Your blank canvas is ready.",
        });
      } else {
        sonnerToast.warning("Space created without the full starter structure", {
          description: "Your draft is safe. You can add or rename story points in the editor.",
        });
      }
      navigate(`/spaces/${result.id}/edit`);
    } catch (err) {
      handleError(err, "Failed to create space");
      throw err;
    }
  };

  const handleDuplicate = async (e: React.MouseEvent, space: Space) => {
    e.preventDefault();
    e.stopPropagation();
    setDuplicatingId(space.id);
    try {
      const result = (await duplicateSpace.mutateAsync({ spaceId: space.id })) as { id: string };
      sonnerToast.success("Space duplicated successfully");
      navigate(`/spaces/${result.id}/edit`);
    } catch (err) {
      handleError(err, "Failed to duplicate space");
    } finally {
      setDuplicatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-brand text-xs font-semibold uppercase tracking-[0.16em]">
            Learning studio
          </p>
          <h1 className="font-display mt-1 text-2xl font-semibold sm:text-3xl">Spaces</h1>
          <p className="text-muted-foreground mt-1 max-w-xl text-sm">
            Build guided lessons, practice pathways, and assessments for your students.
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} className="min-h-11 sm:min-h-9">
          <Plus className="h-4 w-4" />
          New Space
        </Button>
      </div>

      <SpaceCreationDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onCreate={handleCreateSpace}
      />

      {/* Filters */}
      <div className="bg-card border-subtle flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <label htmlFor="space-search" className="sr-only">
            Search spaces
          </label>
          <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            id="space-search"
            type="text"
            placeholder="Search by space title…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-h-11 pl-9 text-base sm:min-h-9 sm:text-sm"
          />
        </div>
        <div
          className="flex max-w-full gap-1 overflow-x-auto rounded-lg border p-1"
          aria-label="Filter spaces by status"
        >
          {STATUS_TABS.map((tab) => (
            <button
              type="button"
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              aria-pressed={activeTab === tab.value}
              className={`duration-fast ease-standard focus-visible:ring-ring min-h-9 shrink-0 rounded-md px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                activeTab === tab.value
                  ? "bg-primary text-primary-foreground"
                  : "text-fg-muted hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Space Grid */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Loading spaces">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="bg-surface-sunken border-subtle h-56 animate-pulse rounded-xl border motion-reduce:animate-none"
            />
          ))}
        </div>
      ) : isError ? (
        <div
          className="flex flex-col items-center justify-center rounded-xl border border-dashed px-5 py-16 text-center"
          role="alert"
        >
          <BookOpen className="text-fg-muted h-10 w-10" />
          <p className="font-display mt-3 text-lg">Failed to load spaces</p>
          <p className="text-muted-foreground mt-1 max-w-sm text-sm">
            Your work is still safe. Check your connection and try loading the list again.
          </p>
          <Button onClick={() => refetch()} size="sm" variant="outline" className="mt-4 min-h-11">
            <RotateCcw className="h-4 w-4" />
            Retry
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed px-5 py-16 text-center">
          <span className="bg-surface-sunken text-brand flex h-14 w-14 items-center justify-center rounded-xl">
            {search ? <Search className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
          </span>
          <p className="font-display mt-3 text-lg">
            {search ? "No spaces match your search" : "No spaces yet"}
          </p>
          <p className="text-muted-foreground mt-1 max-w-sm text-sm">
            {search
              ? "Try a shorter title or clear the search to see every space."
              : "Choose a guided template and turn your next lesson into a student-ready path."}
          </p>
          {search ? (
            <Button variant="outline" onClick={() => setSearch("")} className="mt-4 min-h-11">
              Clear search
            </Button>
          ) : (
            <Button onClick={() => setShowCreateDialog(true)} size="sm" className="mt-4 min-h-11">
              <Plus className="h-3 w-3" /> Create Space
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((space: Space) => (
            <article
              key={space.id}
              className="bg-card border-subtle shadow-e1 duration-fast ease-standard hover:shadow-e2 hover:border-primary/30 group relative flex min-h-60 flex-col rounded-xl border p-4 transition-[border-color,box-shadow]"
            >
              {space.thumbnailUrl && (
                <img
                  src={space.thumbnailUrl}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="mb-4 aspect-[16/7] w-full rounded-lg object-cover"
                />
              )}
              {!space.thumbnailUrl && (
                <div className="bg-surface-sunken text-brand mb-4 flex aspect-[16/7] items-center justify-center rounded-lg border border-dashed">
                  <BookOpen className="h-7 w-7" aria-hidden="true" />
                </div>
              )}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="font-display font-semibold">
                    <Link
                      to={`/spaces/${space.id}/edit`}
                      className="group-hover:text-brand focus-visible:ring-ring after:absolute after:inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                    >
                      {space.title}
                    </Link>
                  </h2>
                  {space.description && (
                    <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                      {space.description}
                    </p>
                  )}
                </div>
                <StatusBadge status={space.status} />
              </div>
              <div className="text-muted-foreground mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
                <span className="rounded-pill bg-surface-sunken text-fg-secondary px-1.5 py-0.5 capitalize">
                  {space.type}
                </span>
                {space.subject && <span>{space.subject}</span>}
                <span className="font-mono">{space.stats?.storyPointCount ?? 0} story points</span>
                <span className="font-mono">{space.stats?.itemCount ?? 0} items</span>
                {(space.stats?.enrolledCount ?? 0) > 0 && (
                  <span className="flex items-center gap-0.5 font-mono">
                    <Users className="h-3 w-3" />
                    {space.stats?.enrolledCount}
                  </span>
                )}
              </div>
              {space.labels && space.labels.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {space.labels.slice(0, 3).map((label) => (
                    <span
                      key={label}
                      className="bg-surface-sunken text-fg-secondary rounded-pill px-1.5 py-0.5 text-[10px]"
                    >
                      {label}
                    </span>
                  ))}
                  {space.labels.length > 3 && (
                    <span className="bg-surface-sunken text-fg-muted rounded-pill px-1.5 py-0.5 text-[10px]">
                      +{space.labels.length - 3} more
                    </span>
                  )}
                </div>
              )}
              <div className="relative z-10 mt-auto flex justify-end pt-4">
                <Button
                  variant="ghost"
                  size="sm"
                  className="duration-fast ease-standard min-h-11 gap-1 text-xs transition-opacity lg:min-h-9 lg:opacity-0 lg:group-focus-within:opacity-100 lg:group-hover:opacity-100"
                  onClick={(e) => handleDuplicate(e, space)}
                  disabled={duplicatingId === space.id}
                  aria-label={`Duplicate ${space.title}`}
                >
                  {duplicatingId === space.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                  ) : (
                    <Copy className="h-3 w-3" aria-hidden="true" />
                  )}
                  {duplicatingId === space.id ? "Duplicating…" : "Duplicate"}
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
