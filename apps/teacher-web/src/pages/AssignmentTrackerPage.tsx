import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useExams, useSubmissions, useClasses } from "@levelup/query";
import type { Exam, Submission, Class } from "@levelup/shared-types";
import {
  Card,
  CardContent,
  Badge,
  Skeleton,
  Progress,
  FadeIn,
  EmptyState,
} from "@levelup/shared-ui";
import { ClipboardList, CheckCircle2, Clock, AlertCircle, ChevronRight, Users } from "lucide-react";

type AssignmentStatus = "draft" | "active" | "grading" | "completed";

interface AssignmentSummary {
  examId: string;
  title: string;
  subject: string;
  status: AssignmentStatus;
  totalSubmissions: number;
  gradedSubmissions: number;
  totalStudents: number;
  averageScore: number;
  dueDate?: number;
}

export default function AssignmentTrackerPage() {
  // Exams + submissions are infinite (paginated) queries; classes is a PageBag.
  // Tenant scoping is server-side via claims (no tenantId arg).
  const { data: examsRaw, isLoading: examsLoading } = useExams();
  const exams = ((examsRaw as { pages?: { items?: Exam[] }[] } | undefined)?.pages ?? []).flatMap(
    (p) => p.items ?? []
  ) as Exam[];
  const { data: subsRaw } = useSubmissions({});
  const submissions = (
    (subsRaw as { pages?: { items?: Submission[] }[] } | undefined)?.pages ?? []
  ).flatMap((p) => p.items ?? []) as Submission[];
  const { data: classesRaw } = useClasses();
  const classes = ((classesRaw as { items?: Class[] } | undefined)?.items ?? []) as Class[];

  const assignments = useMemo<AssignmentSummary[]>(() => {
    if (!exams) return [];
    return exams.map((exam) => {
      const examSubs = submissions?.filter((s) => s.examId === exam.id) ?? [];
      const graded = examSubs.filter(
        (s) => s.status === "grading_complete" || s.status === "reviewed"
      );
      const scores = graded.map((s) => ((s.totalScore ?? 0) / (exam.totalMarks || 1)) * 100);
      const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

      // Derive total students from class assignments
      const totalStudents =
        exam.classIds?.reduce((sum, classId) => {
          const cls = classes?.find((c) => c.id === classId);
          return sum + (cls?.studentCount ?? 0);
        }, 0) ?? 0;

      let status: AssignmentStatus = "draft";
      if (exam.status === "published") status = "active";
      if (exam.status === "grading" || exam.status === "evaluation_complete") status = "grading";
      if (exam.status === "completed" || exam.status === "archived") status = "completed";

      return {
        examId: exam.id,
        title: exam.title,
        subject: exam.subject ?? "",
        status,
        totalSubmissions: examSubs.length,
        gradedSubmissions: graded.length,
        totalStudents,
        averageScore: avgScore,
        dueDate: exam.examDate?.seconds ? exam.examDate.seconds * 1000 : undefined,
      };
    });
  }, [exams, submissions, classes]);

  const activeAssignments = assignments.filter((a) => a.status === "active");
  const gradingAssignments = assignments.filter((a) => a.status === "grading");
  const completedAssignments = assignments.filter((a) => a.status === "completed");
  const pendingGrading = gradingAssignments.reduce(
    (sum, a) => sum + (a.totalSubmissions - a.gradedSubmissions),
    0
  );

  if (examsLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Assignment Tracker</h1>
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <FadeIn>
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <ClipboardList className="text-primary h-6 w-6" aria-hidden="true" />
            Assignment Tracker
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Track exam assignments across all your classes
          </p>
        </div>
      </FadeIn>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
              <ClipboardList className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activeAssignments.length}</p>
              <p className="text-muted-foreground text-xs">Active</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{pendingGrading}</p>
              <p className="text-muted-foreground text-xs">Pending Grading</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
              <AlertCircle className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{gradingAssignments.length}</p>
              <p className="text-muted-foreground text-xs">In Review</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{completedAssignments.length}</p>
              <p className="text-muted-foreground text-xs">Completed</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Assignments */}
      {activeAssignments.length > 0 && (
        <AssignmentSection title="Active Assignments" items={activeAssignments} />
      )}

      {/* Needs Grading */}
      {gradingAssignments.length > 0 && (
        <AssignmentSection title="Needs Grading" items={gradingAssignments} />
      )}

      {/* Completed */}
      {completedAssignments.length > 0 && (
        <AssignmentSection title="Completed" items={completedAssignments.slice(0, 10)} />
      )}

      {assignments.length === 0 && (
        <EmptyState
          icon={ClipboardList}
          title="No assignments yet"
          description="Create an exam to start tracking assignments across your classes."
        />
      )}
    </div>
  );
}

function AssignmentSection({ title, items }: { title: string; items: AssignmentSummary[] }) {
  return (
    <div>
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      <div className="space-y-3">
        {items.map((item) => (
          <AssignmentRow key={item.examId} assignment={item} />
        ))}
      </div>
    </div>
  );
}

const statusConfig: Record<
  AssignmentStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  draft: { label: "Draft", variant: "secondary" },
  active: { label: "Active", variant: "default" },
  grading: { label: "Grading", variant: "outline" },
  completed: { label: "Completed", variant: "secondary" },
};

function AssignmentRow({ assignment }: { assignment: AssignmentSummary }) {
  const config = statusConfig[assignment.status];
  const gradingProgress =
    assignment.totalSubmissions > 0
      ? (assignment.gradedSubmissions / assignment.totalSubmissions) * 100
      : 0;

  return (
    <Link
      to={`/exams/${assignment.examId}`}
      className="bg-card hover:bg-muted/50 flex items-center gap-4 rounded-lg border p-4 transition-colors"
    >
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <h3 className="truncate text-sm font-medium">{assignment.title}</h3>
          <Badge variant={config.variant}>{config.label}</Badge>
        </div>
        <div className="text-muted-foreground flex items-center gap-4 text-xs">
          {assignment.subject && <span>{assignment.subject}</span>}
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {assignment.totalSubmissions} submissions
          </span>
          {assignment.totalSubmissions > 0 && (
            <span>
              {assignment.gradedSubmissions}/{assignment.totalSubmissions} graded
            </span>
          )}
          {assignment.averageScore > 0 && <span>Avg: {Math.round(assignment.averageScore)}%</span>}
        </div>
        {assignment.status === "grading" && assignment.totalSubmissions > 0 && (
          <div className="mt-2">
            <Progress value={gradingProgress} className="h-1.5" />
          </div>
        )}
      </div>
      <ChevronRight className="text-muted-foreground h-5 w-5 shrink-0" />
    </Link>
  );
}
