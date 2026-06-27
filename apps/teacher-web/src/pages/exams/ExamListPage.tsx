import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useExams } from "@levelup/query";
import { Plus, Search, ClipboardList } from "lucide-react";
import { Button, Input, StatusBadge } from "@levelup/shared-ui";
import type { Exam, ExamStatus } from "@levelup/shared-types";

const STATUS_TABS: { label: string; value: ExamStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Draft", value: "draft" },
  { label: "Published", value: "published" },
  { label: "Grading", value: "grading" },
  { label: "Completed", value: "completed" },
  { label: "Archived", value: "archived" },
];

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

export default function ExamListPage() {
  const [activeTab, setActiveTab] = useState<ExamStatus | "all">("all");
  const [search, setSearch] = useState("");

  // Query hooks are claims-scoped server-side — no tenantId arg.
  const statusFilter = activeTab === "all" ? undefined : activeTab;
  const { data, isLoading } = useExams({ status: statusFilter });
  const exams = useMemo(() => asArray<Exam>(data), [data]);

  const filtered = exams.filter((e: Exam) => e.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Exams</h1>
          <p className="text-muted-foreground text-sm">
            Create and manage exams, grade submissions
          </p>
        </div>
        <Button asChild>
          <Link to="/exams/new">
            <Plus className="h-4 w-4" />
            New Exam
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative max-w-sm flex-1">
          <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            type="text"
            placeholder="Search exams..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex overflow-x-auto rounded-lg border p-0.5">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`whitespace-nowrap rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                activeTab === tab.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Exam list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-muted h-20 animate-pulse rounded-lg border" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
          <ClipboardList className="text-muted-foreground h-10 w-10" />
          <p className="text-muted-foreground mt-3 text-sm">
            {search ? "No exams match your search" : "No exams yet"}
          </p>
          {!search && (
            <Button size="sm" className="mt-3" asChild>
              <Link to="/exams/new">
                <Plus className="h-3 w-3" /> Create Exam
              </Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((exam: Exam) => (
            <Link
              key={exam.id}
              to={`/exams/${exam.id}`}
              className="bg-card flex items-center justify-between rounded-lg border p-4 transition-shadow hover:shadow-sm"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{exam.title}</h3>
                  <StatusBadge status={exam.status} />
                </div>
                <div className="text-muted-foreground mt-1 flex items-center gap-4 text-xs">
                  <span>{exam.subject}</span>
                  <span>{exam.totalMarks} marks</span>
                  <span>{exam.duration} min</span>
                  {exam.topics?.length > 0 && <span>{exam.topics.slice(0, 2).join(", ")}</span>}
                </div>
              </div>
              <div className="text-muted-foreground flex items-center gap-6 text-sm">
                {exam.stats && (
                  <>
                    <div className="text-center">
                      <p className="text-foreground font-semibold">{exam.stats.totalSubmissions}</p>
                      <p className="text-xs">Submissions</p>
                    </div>
                    <div className="text-center">
                      <p className="text-foreground font-semibold">
                        {exam.stats.gradedSubmissions}
                      </p>
                      <p className="text-xs">Graded</p>
                    </div>
                    <div className="text-center">
                      <p className="text-foreground font-semibold">
                        {Math.round(exam.stats.avgScore)}%
                      </p>
                      <p className="text-xs">Avg Score</p>
                    </div>
                  </>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
