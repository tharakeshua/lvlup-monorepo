import { useState, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { useSubmissions, useExams } from "@levelup/query";
import {
  Button,
  Card,
  CardContent,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Skeleton,
  EmptyState,
  FadeIn,
  AnimatedList,
  AnimatedListItem,
  Badge,
  Checkbox,
  Separator,
  StatCard,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@levelup/shared-ui";
import {
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Filter,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  Loader2,
  AlertCircle,
  FileCheck,
  Users,
  BarChart3,
  ListChecks,
  X,
} from "lucide-react";

type GradingFilter = "all" | "needs_review" | "auto_graded" | "in_progress";

const FILTER_OPTIONS: { value: GradingFilter; label: string }[] = [
  { value: "all", label: "All Pending" },
  { value: "needs_review", label: "Needs Review" },
  { value: "auto_graded", label: "Auto-Graded" },
  { value: "in_progress", label: "In Progress" },
];

const PAGE_SIZE = 15;

// Mirrors PIPELINE_ICONS / PIPELINE_COLORS from SubmissionsPage.tsx
const PIPELINE_ICONS: Record<string, React.ElementType> = {
  uploaded: Clock,
  ocr_processing: Loader2,
  scouting: Loader2,
  scouting_complete: CheckCircle2,
  grading: Loader2,
  grading_partial: Clock,
  grading_complete: CheckCircle2,
  ready_for_review: Eye,
  reviewed: CheckCircle2,
  failed: AlertCircle,
  manual_review_needed: AlertCircle,
};

const PIPELINE_COLORS: Record<string, string> = {
  uploaded: "text-info",
  ocr_processing: "text-info animate-spin",
  scouting: "text-info animate-spin",
  scouting_complete: "text-success",
  grading: "text-info animate-spin",
  grading_partial: "text-info",
  grading_complete: "text-success",
  ready_for_review: "text-warning",
  reviewed: "text-success",
  failed: "text-error",
  manual_review_needed: "text-error",
};

function getStatusBadge(status: string) {
  switch (status) {
    case "grading_complete":
      return (
        <Badge variant="outline" className="border-success/40 bg-success-subtle text-success text-[10px]">
          Auto-Graded
        </Badge>
      );
    case "ready_for_review":
    case "grading_partial":
      return (
        <Badge variant="outline" className="border-warning/40 bg-warning-subtle text-warning text-[10px]">
          Needs Review
        </Badge>
      );
    case "manual_review_needed":
    case "failed":
      return (
        <Badge variant="destructive" className="text-[10px]">
          Manual Review
        </Badge>
      );
    case "uploaded":
    case "scouting":
    case "scouting_complete":
    case "grading":
      return (
        <Badge variant="outline" className="border-info/40 bg-info-subtle text-info text-[10px]">
          In Progress
        </Badge>
      );
    case "reviewed":
      return (
        <Badge variant="outline" className="border-success/40 bg-success-subtle text-success text-[10px]">
          Reviewed
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-[10px]">
          {status.replace(/_/g, " ")}
        </Badge>
      );
  }
}

interface SubRow {
  id: string;
  examId: string;
  studentId?: string;
  studentName?: string;
  pipelineStatus: string;
  resultsReleased?: boolean;
  summary?: { totalScore?: number; maxScore?: number; percentage?: number | null };
  createdAt?: unknown;
}
interface ExamRow {
  id: string;
  title: string;
}

/** Normalize a query hook result (bare array | PageResponse | infinite query) → array. */
function asArray<T>(d: unknown): T[] {
  if (Array.isArray(d)) return d as T[];
  if (d && typeof d === "object") {
    const o = d as { items?: T[]; pages?: { items?: T[] }[] };
    if (Array.isArray(o.items)) return o.items;
    if (Array.isArray(o.pages)) return o.pages.flatMap((p) => p.items ?? []);
  }
  return [];
}

export default function BatchGradingPage() {
  // Query hooks are claims-scoped server-side — no tenantId arg.
  const { data: submissionsData, isLoading: subsLoading } = useSubmissions({});
  const { data: examsData } = useExams();
  const submissions = useMemo(() => asArray<SubRow>(submissionsData), [submissionsData]);
  const exams = useMemo(() => asArray<ExamRow>(examsData), [examsData]);

  const [filter, setFilter] = useState<GradingFilter>("all");
  const [examFilter, setExamFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const PIPELINE_PENDING = useMemo(
    () =>
      new Set([
        "uploaded",
        "scouting",
        "scouting_complete",
        "grading",
        "grading_partial",
        "grading_complete",
        "ready_for_review",
        "manual_review_needed",
      ]),
    []
  );

  // Submissions still requiring teacher action (not yet reviewed/released).
  const pendingSubmissions = useMemo(() => {
    const pending = (submissions ?? []).filter((s) => PIPELINE_PENDING.has(s.pipelineStatus));

    let filtered = pending;
    if (filter !== "all") {
      filtered = filtered.filter((s) => {
        if (filter === "auto_graded") return s.pipelineStatus === "grading_complete";
        if (filter === "needs_review")
          return (
            s.pipelineStatus === "ready_for_review" ||
            s.pipelineStatus === "grading_partial" ||
            s.pipelineStatus === "manual_review_needed"
          );
        if (filter === "in_progress")
          return (
            s.pipelineStatus === "uploaded" ||
            s.pipelineStatus === "scouting" ||
            s.pipelineStatus === "scouting_complete" ||
            s.pipelineStatus === "grading"
          );
        return true;
      });
    }

    if (examFilter !== "all") {
      filtered = filtered.filter((s) => s.examId === examFilter);
    }

    return filtered;
  }, [submissions, filter, examFilter, PIPELINE_PENDING]);

  const totalPages = Math.ceil(pendingSubmissions.length / PAGE_SIZE);
  const currentPageItems = pendingSubmissions.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const getExamTitle = useCallback(
    (examId: string) => exams?.find((e) => e.id === examId)?.title ?? examId,
    [exams]
  );

  const uniqueExams = useMemo(() => {
    const examIds = new Set((submissions ?? []).map((s) => s.examId));
    return (exams ?? []).filter((e) => examIds.has(e.id));
  }, [submissions, exams]);

  // Summary stats (across all submissions, not just current filter)
  const stats = useMemo(() => {
    const allPending = (submissions ?? []).filter((s) => PIPELINE_PENDING.has(s.pipelineStatus));
    const needsReview = allPending.filter((s) =>
      ["ready_for_review", "grading_partial", "manual_review_needed"].includes(s.pipelineStatus)
    ).length;
    const autoGraded = allPending.filter((s) => s.pipelineStatus === "grading_complete").length;
    const inProgress = allPending.filter((s) =>
      ["uploaded", "scouting", "scouting_complete", "grading"].includes(s.pipelineStatus)
    ).length;
    const reviewed = (submissions ?? []).filter(
      (s) => s.pipelineStatus === "reviewed" || s.resultsReleased
    ).length;
    return { total: allPending.length, needsReview, autoGraded, inProgress, reviewed };
  }, [submissions, PIPELINE_PENDING]);

  // Selection helpers
  const currentPageIds = useMemo(() => currentPageItems.map((s) => s.id), [currentPageItems]);
  const allCurrentSelected =
    currentPageIds.length > 0 && currentPageIds.every((id) => selectedIds.has(id));
  const someCurrentSelected = currentPageIds.some((id) => selectedIds.has(id));

  const toggleSelectAll = useCallback(() => {
    if (allCurrentSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        currentPageIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => new Set([...prev, ...currentPageIds]));
    }
  }, [allCurrentSelected, currentPageIds]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const handleFilterChange = (v: string) => {
    setFilter(v as GradingFilter);
    setPage(0);
    clearSelection();
  };

  const handleExamFilterChange = (v: string) => {
    setExamFilter(v);
    setPage(0);
    clearSelection();
  };

  const handlePageChange = (next: number) => {
    setPage(next);
    clearSelection();
  };

  const selectedCount = selectedIds.size;
  // Items selected that are reviewable (grading_complete, ready_for_review, grading_partial, manual_review_needed)
  const selectedReviewable = currentPageItems.filter(
    (s) =>
      selectedIds.has(s.id) &&
      ["grading_complete", "ready_for_review", "grading_partial", "manual_review_needed"].includes(
        s.pipelineStatus
      )
  );

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <FadeIn>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
                <CheckSquare className="text-primary h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h1 className="font-display text-2xl font-semibold">Batch Grading</h1>
                <p className="text-muted-foreground text-sm">
                  Review and approve AI-graded submissions across all exams
                </p>
              </div>
            </div>
          </div>
        </FadeIn>

        {/* Summary stat cards */}
        <FadeIn delay={0.04}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {subsLoading ? (
              <>
                {Array.from({ length: 4 }).map((_, i) => (
                  <StatCard
                    key={i}
                    label=""
                    value=""
                    icon={Clock}
                    loading
                  />
                ))}
              </>
            ) : (
              <>
                <StatCard
                  label="Pending"
                  value={stats.total}
                  icon={ListChecks}
                  subtext="awaiting action"
                />
                <StatCard
                  label="Needs Review"
                  value={stats.needsReview}
                  icon={Eye}
                  subtext="teacher review required"
                />
                <StatCard
                  label="Auto-Graded"
                  value={stats.autoGraded}
                  icon={FileCheck}
                  subtext="ready to approve"
                />
                <StatCard
                  label="Reviewed"
                  value={stats.reviewed}
                  icon={CheckCircle2}
                  subtext="completed"
                />
              </>
            )}
          </div>
        </FadeIn>

        {/* Filters */}
        <FadeIn delay={0.08}>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden="true" />
              <Select value={filter} onValueChange={handleFilterChange}>
                <SelectTrigger className="w-[160px]" aria-label="Filter by status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FILTER_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Select value={examFilter} onValueChange={handleExamFilterChange}>
              <SelectTrigger className="w-[200px]" aria-label="Filter by exam">
                <SelectValue placeholder="All Exams" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Exams</SelectItem>
                {uniqueExams.map((exam) => (
                  <SelectItem key={exam.id} value={exam.id}>
                    {exam.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Result count */}
            {!subsLoading && (
              <span className="text-muted-foreground ml-auto font-mono text-sm">
                {pendingSubmissions.length} submission
                {pendingSubmissions.length !== 1 ? "s" : ""}
                {totalPages > 1 && (
                  <span className="ml-2">
                    · page {page + 1}/{totalPages}
                  </span>
                )}
              </span>
            )}
          </div>
        </FadeIn>

        {/* Submission list */}
        {subsLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[72px] rounded-lg" />
            ))}
          </div>
        ) : currentPageItems.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="No submissions to review"
            description={
              filter !== "all" || examFilter !== "all"
                ? "No submissions match the current filters. Try clearing your filters."
                : "All pending submissions have been reviewed. Great job!"
            }
          />
        ) : (
          <>
            {/* Select-all row */}
            <div className="flex items-center gap-3 px-1">
              <Checkbox
                id="select-all"
                checked={allCurrentSelected}
                // @ts-expect-error — indeterminate handled at runtime
                indeterminate={someCurrentSelected && !allCurrentSelected}
                onCheckedChange={toggleSelectAll}
                aria-label={allCurrentSelected ? "Deselect all on page" : "Select all on page"}
              />
              <label
                htmlFor="select-all"
                className="text-muted-foreground cursor-pointer select-none text-xs"
              >
                {allCurrentSelected
                  ? "Deselect all"
                  : someCurrentSelected
                    ? `${selectedCount} selected`
                    : "Select all on this page"}
              </label>
            </div>

            <AnimatedList className="space-y-2">
              {currentPageItems.map((sub) => {
                const StatusIcon = PIPELINE_ICONS[sub.pipelineStatus] ?? Clock;
                const statusColor = PIPELINE_COLORS[sub.pipelineStatus] ?? "text-muted-foreground";
                const isSelected = selectedIds.has(sub.id);
                const isManualFlag = sub.pipelineStatus === "manual_review_needed";

                return (
                  <AnimatedListItem key={sub.id}>
                    <Card
                      className={`transition-colors ${isSelected ? "ring-primary/30 ring-2" : ""}`}
                    >
                      <CardContent className="flex items-center gap-3 p-4">
                        {/* Selection checkbox */}
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(sub.id)}
                          aria-label={`Select submission from ${sub.studentName ?? sub.studentId ?? sub.id}`}
                          className="shrink-0"
                        />

                        {/* Pipeline status icon */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="shrink-0" aria-hidden="true">
                              <StatusIcon
                                className={`h-5 w-5 ${statusColor}`}
                              />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            {sub.pipelineStatus.replace(/_/g, " ")}
                          </TooltipContent>
                        </Tooltip>

                        {/* Student + exam info */}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-medium">
                              {sub.studentName ?? sub.studentId ?? "Unknown student"}
                            </p>
                            {getStatusBadge(sub.pipelineStatus)}
                            {isManualFlag && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span
                                    className="text-error flex items-center"
                                    aria-label="Flagged for manual review"
                                  >
                                    <AlertTriangle className="h-3.5 w-3.5" />
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>Flagged for manual review</TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                          <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
                            <span className="flex items-center gap-1">
                              <FileCheck className="h-3 w-3" aria-hidden="true" />
                              {getExamTitle(sub.examId)}
                            </span>
                            {sub.summary?.totalScore !== undefined &&
                              sub.summary.maxScore !== undefined && (
                                <span className="font-mono font-medium">
                                  {sub.summary.totalScore}/{sub.summary.maxScore}
                                  {sub.summary.percentage != null
                                    ? ` · ${Math.round(sub.summary.percentage)}%`
                                    : ""}
                                </span>
                              )}
                            {sub.createdAt && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" aria-hidden="true" />
                                {new Date(
                                  (sub.createdAt as { toDate?: () => Date })?.toDate?.() ??
                                    (sub.createdAt as unknown as string)
                                ).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Action */}
                        <Button asChild size="sm" variant="outline" className="h-8 shrink-0 text-xs">
                          <Link to={`/exams/${sub.examId}/submissions/${sub.id}`}>
                            <Eye className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                            Review
                          </Link>
                        </Button>
                      </CardContent>
                    </Card>
                  </AnimatedListItem>
                );
              })}
            </AnimatedList>
          </>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(Math.max(0, page - 1))}
              disabled={page === 0}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-muted-foreground font-mono text-sm">
              {page + 1} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Sticky bulk action bar */}
        {selectedCount > 0 && (
          <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
            <Card className="shadow-e3 border-primary/20 min-w-[340px]">
              <CardContent className="flex items-center gap-3 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Users className="text-primary h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="text-sm font-medium">
                    {selectedCount} submission{selectedCount !== 1 ? "s" : ""} selected
                  </span>
                </div>
                <Separator orientation="vertical" className="h-5" />
                <div className="flex items-center gap-2">
                  {selectedReviewable.length > 0 && (
                    <Button
                      asChild
                      size="sm"
                      className="h-7 text-xs"
                    >
                      {/* Navigate to first selected reviewable submission as the entry point */}
                      <Link
                        to={`/exams/${selectedReviewable[0].examId}/submissions/${selectedReviewable[0].id}`}
                      >
                        <Eye className="mr-1 h-3 w-3" aria-hidden="true" />
                        Review {selectedReviewable.length > 1 ? `first of ${selectedReviewable.length}` : ""}
                      </Link>
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearSelection}
                    className="h-7 text-xs"
                    aria-label="Clear selection"
                  >
                    <X className="mr-1 h-3 w-3" aria-hidden="true" />
                    Clear
                  </Button>
                </div>
                {/* Per-exam breakdown of selected */}
                {selectedCount > 0 && (
                  <div className="text-muted-foreground ml-auto flex items-center gap-1">
                    <BarChart3 className="h-3 w-3" aria-hidden="true" />
                    <span className="font-mono text-xs">
                      {
                        new Set(
                          currentPageItems
                            .filter((s) => selectedIds.has(s.id))
                            .map((s) => s.examId)
                        ).size
                      }{" "}
                      exam{new Set(currentPageItems.filter((s) => selectedIds.has(s.id)).map((s) => s.examId)).size !== 1 ? "s" : ""}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
