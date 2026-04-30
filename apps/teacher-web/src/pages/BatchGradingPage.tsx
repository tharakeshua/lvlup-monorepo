import { useState, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuthStore } from "@levelup/shared-stores";
import { useSubmissions, useExams } from "@levelup/shared-hooks";
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
} from "lucide-react";

type GradingFilter = "all" | "needs_review" | "auto_graded" | "in_progress";

const FILTER_OPTIONS: { value: GradingFilter; label: string }[] = [
  { value: "all", label: "All Pending" },
  { value: "needs_review", label: "Needs Review" },
  { value: "auto_graded", label: "Auto-Graded" },
  { value: "in_progress", label: "In Progress" },
];

const PAGE_SIZE = 10;

function getStatusBadge(status: string) {
  switch (status) {
    case "grading_complete":
      return (
        <Badge variant="outline" className="border-amber-300 text-amber-600">
          Auto-Graded
        </Badge>
      );
    case "ready_for_review":
    case "grading_partial":
      return (
        <Badge variant="outline" className="border-blue-300 text-blue-600">
          Needs Review
        </Badge>
      );
    case "manual_review_needed":
    case "failed":
      return <Badge variant="destructive">Manual Review</Badge>;
    case "uploaded":
    case "scouting":
    case "scouting_complete":
    case "grading":
      return (
        <Badge variant="outline" className="border-violet-300 text-violet-600">
          In Progress
        </Badge>
      );
    case "reviewed":
      return (
        <Badge variant="outline" className="border-green-300 text-green-600">
          Reviewed
        </Badge>
      );
    default:
      return <Badge variant="outline">{status.replace(/_/g, " ")}</Badge>;
  }
}

export default function BatchGradingPage() {
  const { currentTenantId } = useAuthStore();
  const tenantId = currentTenantId;

  const { data: submissions, isLoading: subsLoading } = useSubmissions(tenantId);
  const { data: exams } = useExams(tenantId);

  const [filter, setFilter] = useState<GradingFilter>("all");
  const [examFilter, setExamFilter] = useState<string>("all");
  const [page, setPage] = useState(0);

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

  const reviewed = (submissions ?? []).filter(
    (s) => s.pipelineStatus === "reviewed" || s.resultsReleased
  ).length;

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex items-center gap-3">
          <CheckSquare className="text-primary h-6 w-6" aria-hidden="true" />
          <div>
            <h1 className="text-2xl font-bold">Batch Grading</h1>
            <p className="text-muted-foreground text-sm">Review and approve pending submissions</p>
          </div>
        </div>
      </FadeIn>

      {/* Progress indicator */}
      <FadeIn delay={0.05}>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-muted-foreground">
            <strong className="text-foreground">{pendingSubmissions.length}</strong> pending
          </span>
          <span className="text-muted-foreground">
            <strong className="text-foreground">{reviewed}</strong> reviewed
          </span>
          {pendingSubmissions.length > 0 && (
            <span className="text-muted-foreground">
              Page {page + 1} of {totalPages}
            </span>
          )}
        </div>
      </FadeIn>

      {/* Filters */}
      <FadeIn delay={0.1}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="text-muted-foreground h-4 w-4" aria-hidden="true" />
            <Select
              value={filter}
              onValueChange={(v) => {
                setFilter(v as GradingFilter);
                setPage(0);
              }}
            >
              <SelectTrigger className="w-[160px]">
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
          <Select
            value={examFilter}
            onValueChange={(v) => {
              setExamFilter(v);
              setPage(0);
            }}
          >
            <SelectTrigger className="w-[200px]">
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
        </div>
      </FadeIn>

      {/* Submission List */}
      {subsLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      ) : currentPageItems.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="No submissions to review"
          description="All pending submissions have been reviewed. Great job!"
        />
      ) : (
        <AnimatedList className="space-y-2">
          {currentPageItems.map((sub) => (
            <AnimatedListItem key={sub.id}>
              <Card>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium">
                        {sub.studentName ?? sub.studentId}
                      </p>
                      {getStatusBadge(sub.pipelineStatus)}
                    </div>
                    <div className="text-muted-foreground mt-1 flex items-center gap-3 text-xs">
                      <span>{getExamTitle(sub.examId)}</span>
                      {sub.summary?.totalScore !== undefined &&
                        sub.summary.maxScore !== undefined && (
                          <span className="font-medium">
                            Score: {sub.summary.totalScore}/{sub.summary.maxScore}
                            {sub.summary.percentage != null
                              ? ` (${Math.round(sub.summary.percentage)}%)`
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
                  <div className="ml-3 flex items-center gap-2">
                    <Button asChild size="sm" variant="outline" className="h-8 text-xs">
                      <Link to={`/exams/${sub.examId}/submissions/${sub.id}`}>
                        <Eye className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                        Review &amp; Grade
                      </Link>
                    </Button>
                    {sub.pipelineStatus === "manual_review_needed" && (
                      <span className="text-destructive" aria-label="Flagged for review">
                        <AlertTriangle className="h-4 w-4" />
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </AnimatedListItem>
          ))}
        </AnimatedList>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-muted-foreground text-sm">
            {page + 1} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
