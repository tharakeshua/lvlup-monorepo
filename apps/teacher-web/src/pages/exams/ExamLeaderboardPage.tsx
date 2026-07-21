import { useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useExam, useSubmissions, useStudents, useClasses } from "@levelup/query";
import type { Exam, Submission } from "@levelup/shared-types";
import {
  ArrowLeft,
  Trophy,
  Medal,
  Award,
  Users,
  TrendingUp,
  Star,
  AlertCircle,
} from "lucide-react";
import {
  Button,
  Badge,
  Card,
  CardContent,
  Skeleton,
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@levelup/shared-ui";

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

interface StudentRecord {
  id: string;
  rollNumber?: string;
  firstName?: string;
  lastName?: string;
}

interface ClassRow {
  id: string;
  name: string;
}

interface RankedEntry {
  rank: number;
  sub: Submission;
  displayName: string;
  className: string;
  percentage: number;
}

/** Derive a numeric sort key for a submission. Returns null if not scoreable. */
function getSortScore(sub: Submission): number | null {
  if (sub.summary?.percentage != null) return sub.summary.percentage;
  if (sub.summary?.totalScore != null && sub.summary?.maxScore != null && sub.summary.maxScore > 0) {
    return (sub.summary.totalScore / sub.summary.maxScore) * 100;
  }
  return null;
}

/** Map a grade letter to a badge color class. */
function gradeColor(grade: string | undefined): string {
  if (!grade) return "border-border text-muted-foreground";
  const g = grade.toUpperCase();
  if (g === "A+" || g === "A") return "border-transparent bg-success/15 text-success";
  if (g === "B+" || g === "B") return "border-transparent bg-info/15 text-info";
  if (g === "C") return "border-transparent bg-warning/15 text-warning";
  return "border-transparent bg-error/15 text-error";
}

export default function ExamLeaderboardPage() {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();

  const { data: examData, isLoading: examLoading } = useExam(examId ?? "");
  const exam = examData as Exam | undefined;

  const { data: submissionsData, isLoading: subsLoading } = useSubmissions({ examId });
  const submissions = useMemo(() => asArray<Submission>(submissionsData), [submissionsData]);

  const { data: allStudentsData } = useStudents();
  const studentMap = useMemo(() => {
    const map = new Map<string, StudentRecord>();
    const arr = asArray<StudentRecord>(allStudentsData);
    for (const s of arr) map.set(s.id, s);
    return map;
  }, [allStudentsData]);

  const { data: classesData } = useClasses();
  const classNameMap = useMemo(() => {
    const map = new Map<string, string>();
    const arr = asArray<ClassRow>(classesData);
    for (const c of arr) map.set(c.id, c.name);
    return map;
  }, [classesData]);

  /** Resolve display name: sub.studentName → roster full name → rollNumber → studentId */
  function resolveDisplayName(sub: Submission): string {
    const subName = sub.studentName?.trim();
    if (subName) return subName;
    const rec = studentMap.get(sub.studentId);
    if (rec) {
      const full = `${rec.firstName ?? ""} ${rec.lastName ?? ""}`.trim();
      if (full) return full;
      if (rec.rollNumber) return rec.rollNumber;
    }
    return sub.rollNumber || sub.studentId;
  }

  /** Build ranked list from all submissions with a computable score. */
  const { ranked, ungradedCount } = useMemo(() => {
    const scoreable: { sub: Submission; score: number }[] = [];
    let ungraded = 0;

    for (const sub of submissions) {
      const score = getSortScore(sub);
      if (score == null) {
        ungraded++;
      } else {
        scoreable.push({ sub, score });
      }
    }

    // Sort descending
    scoreable.sort((a, b) => b.score - a.score);

    // Assign standard competition ranks (ties share the same rank)
    const entries: RankedEntry[] = [];
    let currentRank = 1;
    for (let i = 0; i < scoreable.length; i++) {
      if (i > 0 && scoreable[i].score < scoreable[i - 1].score) {
        currentRank = i + 1;
      }
      const { sub, score } = scoreable[i];
      entries.push({
        rank: currentRank,
        sub,
        displayName: resolveDisplayName(sub),
        className: sub.classId ? (classNameMap.get(sub.classId) ?? sub.classId) : "",
        percentage: score,
      });
    }

    return { ranked: entries, ungradedCount: ungraded };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissions, studentMap, classNameMap]);

  const top3 = ranked.slice(0, 3);
  const rest = ranked.slice(3);

  /** Summary stats */
  const stats = useMemo(() => {
    if (ranked.length === 0) return null;
    const percentages = ranked.map((e) => e.percentage);
    const avg = Math.round(percentages.reduce((a, b) => a + b, 0) / percentages.length);
    const highest = Math.round(Math.max(...percentages));
    return { participants: ranked.length, avg, highest };
  }, [ranked]);

  const isLoading = examLoading || subsLoading;

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-5 w-64" />
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="space-y-1">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  // ── Empty state ───────────────────────────────────────────────────────────
  if (ranked.length === 0) {
    return (
      <div className="space-y-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/exams">Exams</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to={`/exams/${examId}`}>{exam?.title ?? "Exam"}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Leaderboard</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/exams/${examId}/submissions`)}
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="font-display text-xl font-semibold">Leaderboard</h1>
            <p className="text-muted-foreground text-sm">{exam?.title}</p>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Trophy className="text-muted-foreground mb-4 h-12 w-12 opacity-40" />
          <p className="text-muted-foreground text-sm font-medium">No graded submissions yet</p>
          <p className="text-muted-foreground mt-1 text-xs">
            Scores will appear here once submissions are graded.
          </p>
          {ungradedCount > 0 && (
            <p className="text-muted-foreground mt-3 text-xs">
              {ungradedCount} submission{ungradedCount !== 1 ? "s" : ""} still in progress.
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── Podium card configuration ─────────────────────────────────────────────
  // Reorder for visual podium: 2nd (left), 1st (center/taller), 3rd (right)
  const podiumOrder = [
    top3[1] ?? null, // silver — left
    top3[0] ?? null, // gold   — center
    top3[2] ?? null, // bronze — right
  ] as const;

  const podiumConfig = [
    {
      // silver (left)
      heightClass: "pt-8",
      iconEl: <Medal className="h-6 w-6 text-[#a8a9ad]" />,
      ringClass: "ring-2 ring-[#a8a9ad]/40",
      labelClass: "text-[#a8a9ad]",
      rankLabel: "2nd",
      bgClass: "bg-[#a8a9ad]/10",
    },
    {
      // gold (center)
      heightClass: "pt-0",
      iconEl: <Trophy className="h-7 w-7 text-[#d4af37]" />,
      ringClass: "ring-2 ring-[#d4af37]/50",
      labelClass: "text-[#d4af37]",
      rankLabel: "1st",
      bgClass: "bg-[#d4af37]/10",
    },
    {
      // bronze (right)
      heightClass: "pt-12",
      iconEl: <Award className="h-5 w-5 text-[#cd7f32]" />,
      ringClass: "ring-2 ring-[#cd7f32]/40",
      labelClass: "text-[#cd7f32]",
      rankLabel: "3rd",
      bgClass: "bg-[#cd7f32]/10",
    },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/exams">Exams</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to={`/exams/${examId}`}>{exam?.title ?? "Exam"}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Leaderboard</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(`/exams/${examId}/submissions`)}
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="font-display text-xl font-semibold flex items-center gap-2">
            <Trophy className="h-5 w-5 text-[#d4af37]" />
            Leaderboard
          </h1>
          <p className="text-muted-foreground text-sm">{exam?.title}</p>
        </div>
      </div>

      {/* Summary strip */}
      {stats && (
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-3 text-center">
              <Users className="text-muted-foreground mx-auto mb-1 h-4 w-4" />
              <p className="font-mono text-lg font-bold">{stats.participants}</p>
              <p className="text-muted-foreground text-[10px]">Participants</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <TrendingUp className="text-info mx-auto mb-1 h-4 w-4" />
              <p className="font-mono text-lg font-bold">{stats.avg}%</p>
              <p className="text-muted-foreground text-[10px]">Average</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <Star className="text-[#d4af37] mx-auto mb-1 h-4 w-4" />
              <p className="font-mono text-lg font-bold">{stats.highest}%</p>
              <p className="text-muted-foreground text-[10px]">Highest</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Ungraded notice */}
      {ungradedCount > 0 && (
        <div className="border-warning/30 bg-warning/5 text-warning flex items-center gap-2 rounded-lg border p-3 text-xs">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>
            {ungradedCount} submission{ungradedCount !== 1 ? "s" : ""} excluded — still ungraded or
            in progress.
          </span>
        </div>
      )}

      {/* Podium — top 3 */}
      {top3.length > 0 && (
        <div className="flex items-end justify-center gap-3 px-2 pb-2 pt-4">
          {podiumOrder.map((entry, i) => {
            const cfg = podiumConfig[i];
            if (!entry) {
              // Placeholder when fewer than 3 scored entries
              return <div key={i} className={`flex-1 ${cfg.heightClass}`} />;
            }
            return (
              <div key={entry.sub.id} className={`flex flex-1 flex-col items-center ${cfg.heightClass}`}>
                <div className={`mb-2 rounded-full p-2 ${cfg.bgClass}`}>{cfg.iconEl}</div>
                <div
                  className={`bg-card border-subtle shadow-e1 w-full rounded-xl border p-3 text-center ${cfg.ringClass}`}
                >
                  <p className={`text-[10px] font-semibold uppercase tracking-wide ${cfg.labelClass}`}>
                    {cfg.rankLabel}
                  </p>
                  <p className="mt-1 truncate text-xs font-semibold leading-snug">
                    {entry.displayName}
                  </p>
                  {entry.className && (
                    <p className="text-muted-foreground mt-0.5 truncate text-[10px]">
                      {entry.className}
                    </p>
                  )}
                  <p className="font-mono mt-2 text-sm font-bold">
                    {Math.round(entry.percentage)}%
                  </p>
                  <p className="text-muted-foreground font-mono text-[10px]">
                    {entry.sub.summary?.totalScore ?? "—"}/
                    {entry.sub.summary?.maxScore ?? exam?.totalMarks ?? "—"}
                  </p>
                  {entry.sub.summary?.grade && (
                    <div className="mt-1.5 flex justify-center">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${gradeColor(entry.sub.summary.grade)}`}
                      >
                        {entry.sub.summary.grade}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Ranked table — rank 4+ */}
      {rest.length > 0 && (
        <div className="space-y-1.5">
          <h2 className="text-muted-foreground px-1 text-xs font-medium uppercase tracking-wide">
            Rankings
          </h2>
          {rest.map((entry) => (
            <div
              key={entry.sub.id}
              className="bg-card border-subtle shadow-e1 flex items-center gap-3 rounded-lg border px-4 py-3"
            >
              {/* Rank number */}
              <span className="text-muted-foreground font-mono w-7 shrink-0 text-center text-sm font-semibold">
                #{entry.rank}
              </span>

              {/* Name + class */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{entry.displayName}</p>
                {entry.className && (
                  <p className="text-muted-foreground truncate text-xs">{entry.className}</p>
                )}
              </div>

              {/* Score + percentage + grade */}
              <div className="flex shrink-0 items-center gap-3 text-right">
                <div>
                  <p className="font-mono text-sm font-semibold">
                    {entry.sub.summary?.totalScore ?? "—"}/
                    {entry.sub.summary?.maxScore ?? exam?.totalMarks ?? "—"}
                  </p>
                  <p className="text-muted-foreground font-mono text-xs">
                    {Math.round(entry.percentage)}%
                  </p>
                </div>
                {entry.sub.summary?.grade && (
                  <Badge
                    className={`shrink-0 text-[10px] ${gradeColor(entry.sub.summary.grade)}`}
                  >
                    {entry.sub.summary.grade}
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Also show top-3 in table when there are NO rank-4+ entries (for completeness) */}
      {rest.length === 0 && top3.length > 0 && ranked.length > 0 && (
        <div className="space-y-1.5">
          <h2 className="text-muted-foreground px-1 text-xs font-medium uppercase tracking-wide">
            All Rankings
          </h2>
          {ranked.map((entry) => (
            <div
              key={entry.sub.id}
              className="bg-card border-subtle shadow-e1 flex items-center gap-3 rounded-lg border px-4 py-3"
            >
              <span className="text-muted-foreground font-mono w-7 shrink-0 text-center text-sm font-semibold">
                #{entry.rank}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{entry.displayName}</p>
                {entry.className && (
                  <p className="text-muted-foreground truncate text-xs">{entry.className}</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-3 text-right">
                <div>
                  <p className="font-mono text-sm font-semibold">
                    {entry.sub.summary?.totalScore ?? "—"}/
                    {entry.sub.summary?.maxScore ?? exam?.totalMarks ?? "—"}
                  </p>
                  <p className="text-muted-foreground font-mono text-xs">
                    {Math.round(entry.percentage)}%
                  </p>
                </div>
                {entry.sub.summary?.grade && (
                  <Badge
                    className={`shrink-0 text-[10px] ${gradeColor(entry.sub.summary.grade)}`}
                  >
                    {entry.sub.summary.grade}
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
