import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSpaces, useSaveSpace, useDuplicateSpace, useApiError } from "@levelup/query";
import {
  sonnerToast,
  Button,
  Input,
  StatusBadge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@levelup/shared-ui";
import { Plus, Search, BookOpen, Copy, Users, Loader2 } from "lucide-react";
import type { Space, SpaceStatus, SpaceType } from "@levelup/shared-types";

const STATUS_TABS: { label: string; value: SpaceStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Draft", value: "draft" },
  { label: "Published", value: "published" },
  { label: "Archived", value: "archived" },
];

const SPACE_TEMPLATES: { value: string; label: string; type: SpaceType; description: string }[] = [
  { value: "blank", label: "Blank Space", type: "learning", description: "Start from scratch" },
  {
    value: "course",
    label: "Course",
    type: "learning",
    description: "Structured learning content",
  },
  {
    value: "assessment",
    label: "Assessment",
    type: "assessment",
    description: "Tests and quizzes",
  },
  { value: "practice", label: "Practice", type: "practice", description: "Practice problems" },
];

export default function SpaceListPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<SpaceStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState("blank");
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const { handleError } = useApiError();

  const createSpace = useSaveSpace();
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

  const handleCreateSpace = async () => {
    const template =
      SPACE_TEMPLATES.find((t) => t.value === selectedTemplate) ?? SPACE_TEMPLATES[0];
    try {
      const result = (await createSpace.mutateAsync({
        data: {
          title: template.value === "blank" ? "Untitled Space" : `New ${template.label}`,
          type: template.type,
        },
      })) as { id: string };
      setShowCreateDialog(false);
      navigate(`/spaces/${result.id}/edit`);
    } catch (err) {
      handleError(err, "Failed to create space");
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Spaces</h1>
          <p className="text-muted-foreground text-sm">Manage your learning spaces and content</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4" />
          New Space
        </Button>
      </div>

      {/* Create Space Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Space</DialogTitle>
            <DialogDescription>Choose a template to get started</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
              <SelectTrigger>
                <SelectValue placeholder="Select a template" />
              </SelectTrigger>
              <SelectContent>
                {SPACE_TEMPLATES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    <div>
                      <span className="font-medium">{t.label}</span>
                      <span className="text-muted-foreground ml-2 text-xs">{t.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleCreateSpace} disabled={createSpace.isPending} className="w-full">
              {createSpace.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Create Space
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative max-w-sm flex-1">
          <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            type="text"
            placeholder="Search spaces..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex rounded-lg border p-0.5">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`duration-fast ease-standard rounded-md px-3 py-1 text-xs font-medium transition-colors ${
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="bg-surface-sunken border-subtle h-40 animate-pulse rounded-lg border"
            />
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
          <BookOpen className="text-fg-muted h-10 w-10" />
          <p className="font-display mt-3 text-lg">Failed to load spaces</p>
          <Button onClick={() => refetch()} size="sm" variant="outline" className="mt-3">
            Retry
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
          <BookOpen className="text-fg-muted h-10 w-10" />
          <p className="font-display mt-3 text-lg">
            {search ? "No spaces match your search" : "No spaces yet"}
          </p>
          {!search && (
            <Button onClick={() => setShowCreateDialog(true)} size="sm" className="mt-3">
              <Plus className="h-3 w-3" /> Create Space
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((space: Space) => (
            <Link
              key={space.id}
              to={`/spaces/${space.id}/edit`}
              className="bg-card border-subtle shadow-e1 duration-fast ease-standard hover:shadow-e2 group rounded-lg border p-5 transition-shadow"
            >
              {space.thumbnailUrl && (
                <img
                  src={space.thumbnailUrl}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="mb-3 h-32 w-full rounded-md object-cover"
                />
              )}
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="group-hover:text-brand font-display duration-fast ease-standard font-semibold transition-colors">
                    {space.title}
                  </h3>
                  {space.description && (
                    <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                      {space.description}
                    </p>
                  )}
                </div>
                <StatusBadge status={space.status} />
              </div>
              <div className="text-muted-foreground mt-4 flex items-center gap-4 text-xs">
                <span className="rounded-pill bg-surface-sunken text-fg-secondary px-1.5 py-0.5 capitalize">
                  {space.type}
                </span>
                {space.subject && <span>{space.subject}</span>}
                <span className="font-mono">{space.stats?.totalStoryPoints ?? 0} story points</span>
                <span className="font-mono">{space.stats?.totalItems ?? 0} items</span>
                {(space.stats?.totalStudents ?? 0) > 0 && (
                  <span className="flex items-center gap-0.5 font-mono">
                    <Users className="h-3 w-3" />
                    {space.stats?.totalStudents}
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
              {/* Duplicate button */}
              <div className="mt-3 flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  className="duration-fast ease-standard h-7 gap-1 text-xs opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={(e) => handleDuplicate(e, space)}
                  disabled={duplicatingId === space.id}
                >
                  {duplicatingId === space.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  Duplicate
                </Button>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
