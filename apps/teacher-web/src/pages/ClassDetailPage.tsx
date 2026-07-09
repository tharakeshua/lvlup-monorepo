import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import {
  useClasses,
  useSpaces,
  useExams,
  useStudents,
  useClassSummary,
  useSaveStudent,
  useApiError,
} from "@levelup/query";
import { useAuthSession } from "../sdk/session";
import { toast } from "sonner";
import {
  ArrowLeft,
  Users,
  BookOpen,
  ClipboardList,
  BarChart3,
  Trophy,
  Pencil,
  UserPlus,
  UserMinus,
} from "lucide-react";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  ScoreCard,
  ProgressRing,
  Button,
  StatusBadge,
  Card,
  CardContent,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  ConfirmDialog,
} from "@levelup/shared-ui";
import type { Space, Student, Class, ClassProgressSummary } from "@levelup/shared-types";
import type { Exam } from "@levelup/shared-types";
import ClassFormDialog from "../components/class/ClassFormDialog";
import EnrollStudentDialog from "../components/class/EnrollStudentDialog";

// The @levelup/query class summary (domain shape) drops the legacy top/bottom
// performer & point-earner lists and exposes different field names; adapt to the
// legacy shape with safe defaults so the analytics tab degrades gracefully.
// (PARITY GAP — flagged to Frontend-Lead.)
function adaptClassSummary(raw: unknown): ClassProgressSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as {
    id?: string;
    tenantId?: string;
    classId?: string;
    className?: string;
    studentCount?: number;
    atRiskCount?: number;
    atRiskStudentIds?: string[];
    lastUpdatedAt?: unknown;
    autograde?: { averageScore?: number; averagePercentage?: number; passRate?: number };
    levelup?: { averageCompletion?: number; activeStudents?: number };
  };
  const studentCount = s.studentCount ?? 0;
  return {
    id: s.id ?? s.classId ?? "",
    tenantId: s.tenantId ?? "",
    classId: s.classId ?? "",
    className: s.className ?? "",
    studentCount,
    autograde: {
      averageClassScore: (s.autograde?.averagePercentage ?? 0) / 100,
      examCompletionRate: s.autograde?.passRate ?? 0,
      topPerformers: [],
      bottomPerformers: [],
    },
    levelup: {
      averageClassCompletion: s.levelup?.averageCompletion ?? 0,
      activeStudentRate: studentCount > 0 ? (s.levelup?.activeStudents ?? 0) / studentCount : 0,
      topPointEarners: [],
    },
    atRiskStudentIds: s.atRiskStudentIds ?? [],
    atRiskCount: s.atRiskCount ?? 0,
    lastUpdatedAt: s.lastUpdatedAt as ClassProgressSummary["lastUpdatedAt"],
  };
}

export default function ClassDetailPage() {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const tenantId = useAuthSession((s) => s.currentTenantId);

  const { data: classesRaw } = useClasses();
  const classes = ((classesRaw as { items?: Class[] } | undefined)?.items ?? []) as Class[];
  const classData = classes.find((c) => c.id === classId);

  const { data: spacesRaw, isLoading: spacesLoading } = useSpaces();
  const allSpaces = ((spacesRaw as { items?: Space[] } | undefined)?.items ?? []) as Space[];
  const classSpaces = allSpaces.filter((s: Space) => s.classIds?.includes(classId ?? ""));

  const { data: examsRaw, isLoading: examsLoading } = useExams({
    classId: classId ?? undefined,
  });
  const classExams = (
    (examsRaw as { pages?: { items?: Exam[] }[] } | undefined)?.pages ?? []
  ).flatMap((p) => p.items ?? []) as Exam[];

  const { data: studentsRaw, isLoading: studentsLoading } = useStudents({
    classId: classId ?? undefined,
  });
  const classStudents = ((studentsRaw as { items?: Student[] } | undefined)?.items ??
    []) as Student[];

  const { data: rawSummary, isLoading: analyticsLoading } = useClassSummary(
    (classId ?? "") as never
  );
  const classSummary = adaptClassSummary(rawSummary);

  const saveStudent = useSaveStudent();
  const { handleError } = useApiError();
  const [editClassOpen, setEditClassOpen] = useState(false);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<Student | null>(null);

  const removeMutation = useMutation({
    mutationFn: async (student: Student) => {
      if (!classId) throw new Error("Missing class");
      const nextClassIds = (student.classIds ?? []).filter((id) => id !== classId);
      // Tenant applied server-side from claims; useSaveStudent auto-invalidates.
      return saveStudent.mutateAsync({
        id: student.id,
        data: { classIds: nextClassIds },
      });
    },
    onSuccess: () => {
      toast.success("Student removed from class");
    },
    onError: (err) => handleError(err, "Failed to remove student from class"),
  });

  if (!classData) {
    return (
      <div className="py-24 text-center">
        <p className="text-muted-foreground">Class not found</p>
        <Button variant="link" onClick={() => navigate("/")} className="mt-3">
          Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/">Dashboard</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{classData.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")} aria-label="Go back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="font-display text-xl font-semibold">{classData.name}</h1>
          <div className="text-muted-foreground mt-0.5 flex items-center gap-2 text-sm">
            <span>Grade {classData.grade}</span>
            {classData.section && <span>Section {classData.section}</span>}
            <StatusBadge status={classData.status} />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground flex items-center gap-1 font-mono text-sm">
            <Users className="h-4 w-4" /> {classData.studentCount} students
          </span>
          <Button variant="outline" size="sm" onClick={() => setEditClassOpen(true)}>
            <Pencil className="h-3.5 w-3.5" /> Edit class
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="spaces">Spaces</TabsTrigger>
          <TabsTrigger value="exams">Exams</TabsTrigger>
          <TabsTrigger value="students">Students</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-4 space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <ScoreCard label="Students" value={classData.studentCount} icon={Users} />
            <ScoreCard label="Spaces" value={classSpaces.length} icon={BookOpen} />
            <ScoreCard label="Exams" value={classExams.length} icon={ClipboardList} />
            <ScoreCard
              label="Analytics"
              value={
                classSummary
                  ? `${Math.round(classSummary.autograde.averageClassScore * 100)}%`
                  : "—"
              }
              icon={BarChart3}
            />
          </div>

          {/* Recent Spaces */}
          <Card>
            <CardContent className="p-5">
              <h3 className="font-display mb-3 font-semibold">Recent Spaces</h3>
              {classSpaces.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No spaces assigned to this class yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {classSpaces.slice(0, 5).map((space: Space) => (
                    <Link
                      key={space.id}
                      to={`/spaces/${space.id}/edit`}
                      className="hover:bg-surface-sunken/60 border-subtle duration-fast ease-standard flex items-center justify-between rounded-md border px-3 py-2 transition-colors"
                    >
                      <div>
                        <span className="text-sm font-medium">{space.title}</span>
                        {space.subject && (
                          <span className="text-muted-foreground ml-2 text-xs">
                            {space.subject}
                          </span>
                        )}
                      </div>
                      <StatusBadge status={space.status} />
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Exams */}
          <Card>
            <CardContent className="p-5">
              <h3 className="font-display mb-3 font-semibold">Recent Exams</h3>
              {classExams.length === 0 ? (
                <p className="text-muted-foreground text-sm">No exams for this class yet.</p>
              ) : (
                <div className="space-y-2">
                  {classExams.slice(0, 5).map((exam: Exam) => (
                    <Link
                      key={exam.id}
                      to={`/exams/${exam.id}`}
                      className="hover:bg-surface-sunken/60 border-subtle duration-fast ease-standard flex items-center justify-between rounded-md border px-3 py-2 transition-colors"
                    >
                      <div>
                        <span className="text-sm font-medium">{exam.title}</span>
                        <span className="text-muted-foreground ml-2 text-xs">{exam.subject}</span>
                      </div>
                      <StatusBadge status={exam.status} />
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Spaces Tab */}
        <TabsContent value="spaces" className="mt-4">
          {spacesLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="bg-surface-sunken border-subtle h-32 animate-pulse rounded-lg border"
                />
              ))}
            </div>
          ) : classSpaces.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
              <BookOpen className="text-muted-foreground h-8 w-8" />
              <p className="text-muted-foreground mt-2 text-sm">No spaces assigned to this class</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {classSpaces.map((space: Space) => (
                <Link
                  key={space.id}
                  to={`/spaces/${space.id}/edit`}
                  className="bg-card border-subtle shadow-e1 duration-fast ease-standard hover:shadow-e2 group rounded-lg border p-5 transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <h3 className="group-hover:text-primary font-semibold">{space.title}</h3>
                    <StatusBadge status={space.status} />
                  </div>
                  {space.description && (
                    <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                      {space.description}
                    </p>
                  )}
                  <div className="text-muted-foreground mt-3 flex items-center gap-3 text-xs">
                    <span className="capitalize">{space.type}</span>
                    <span>{space.stats?.totalStoryPoints ?? 0} story points</span>
                    <span>{space.stats?.totalItems ?? 0} items</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Exams Tab */}
        <TabsContent value="exams" className="mt-4">
          {examsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="bg-surface-sunken border-subtle h-16 animate-pulse rounded-lg border"
                />
              ))}
            </div>
          ) : classExams.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
              <ClipboardList className="text-muted-foreground h-8 w-8" />
              <p className="text-muted-foreground mt-2 text-sm">No exams for this class yet</p>
            </div>
          ) : (
            <div className="border-subtle shadow-e1 overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="border-strong border-b">
                    <TableHead className="tracking-caps text-fg-muted text-xs font-bold uppercase">
                      Title
                    </TableHead>
                    <TableHead className="tracking-caps text-fg-muted text-xs font-bold uppercase">
                      Subject
                    </TableHead>
                    <TableHead className="tracking-caps text-fg-muted text-xs font-bold uppercase">
                      Total Marks
                    </TableHead>
                    <TableHead className="tracking-caps text-fg-muted text-xs font-bold uppercase">
                      Status
                    </TableHead>
                    <TableHead className="tracking-caps text-fg-muted text-xs font-bold uppercase">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classExams.map((exam: Exam) => (
                    <TableRow
                      key={exam.id}
                      className="border-subtle hover:bg-surface-sunken/60 border-b"
                    >
                      <TableCell className="font-medium">{exam.title}</TableCell>
                      <TableCell className="text-muted-foreground">{exam.subject}</TableCell>
                      <TableCell className="text-muted-foreground font-mono">
                        {exam.totalMarks}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={exam.status} />
                      </TableCell>
                      <TableCell>
                        <Link
                          to={`/exams/${exam.id}`}
                          className="text-primary text-xs hover:underline"
                        >
                          View
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* Students Tab */}
        <TabsContent value="students" className="mt-4 space-y-3">
          <div className="flex items-center justify-end">
            <Button size="sm" onClick={() => setEnrollOpen(true)}>
              <UserPlus className="h-3.5 w-3.5" /> Add Student
            </Button>
          </div>
          {studentsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="bg-surface-sunken border-subtle h-12 animate-pulse rounded-lg border"
                />
              ))}
            </div>
          ) : classStudents.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
              <Users className="text-muted-foreground h-8 w-8" />
              <p className="text-muted-foreground mt-2 text-sm">No students in this class</p>
              <Button size="sm" className="mt-4" onClick={() => setEnrollOpen(true)}>
                <UserPlus className="h-3.5 w-3.5" /> Enroll students
              </Button>
            </div>
          ) : (
            <div className="border-subtle shadow-e1 overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="border-strong border-b">
                    <TableHead className="tracking-caps text-fg-muted text-xs font-bold uppercase">
                      Name
                    </TableHead>
                    <TableHead className="tracking-caps text-fg-muted text-xs font-bold uppercase">
                      Roll No.
                    </TableHead>
                    <TableHead className="tracking-caps text-fg-muted text-xs font-bold uppercase">
                      Student ID
                    </TableHead>
                    <TableHead className="tracking-caps text-fg-muted text-xs font-bold uppercase">
                      Grade
                    </TableHead>
                    <TableHead className="tracking-caps text-fg-muted text-xs font-bold uppercase">
                      Section
                    </TableHead>
                    <TableHead className="tracking-caps text-fg-muted text-xs font-bold uppercase">
                      Status
                    </TableHead>
                    <TableHead className="tracking-caps text-fg-muted text-right text-xs font-bold uppercase">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classStudents.map((student) => (
                    <TableRow
                      key={student.id}
                      className="border-subtle hover:bg-surface-sunken/60 border-b"
                    >
                      <TableCell className="font-medium">
                        {student.displayName ?? student.uid}
                      </TableCell>
                      <TableCell className="font-mono">{student.rollNumber ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs">
                        {student.uid}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {student.grade ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {student.section ?? "—"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={student.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setRemoveTarget(student)}
                          disabled={removeMutation.isPending}
                          aria-label={`Remove ${student.displayName ?? student.uid} from class`}
                        >
                          <UserMinus className="h-3.5 w-3.5" /> Remove
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="mt-4 space-y-6">
          {analyticsLoading ? (
            <div className="grid gap-4 md:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="bg-surface-sunken border-subtle h-24 animate-pulse rounded-lg border"
                />
              ))}
            </div>
          ) : !classSummary ? (
            <div className="rounded-lg border border-dashed p-12 text-center">
              <BarChart3 className="text-muted-foreground mx-auto h-10 w-10" />
              <p className="text-muted-foreground mt-3 text-sm">
                No analytics data yet. Data will appear after exams are graded and spaces are used.
              </p>
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <ScoreCard label="Students" value={classSummary.studentCount} icon={Users} />
                <ScoreCard
                  label="Avg Exam Score"
                  value={`${Math.round(classSummary.autograde.averageClassScore * 100)}%`}
                  icon={ClipboardList}
                />
                <ScoreCard
                  label="Avg Space Completion"
                  value={`${Math.round(classSummary.levelup.averageClassCompletion)}%`}
                  icon={BookOpen}
                />
                <ScoreCard label="At-Risk Students" value={classSummary.atRiskCount} icon={Users} />
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                {/* AutoGrade */}
                <Card>
                  <CardContent className="space-y-4 p-5">
                    <div className="flex items-center gap-2">
                      <ClipboardList className="text-info h-4 w-4" />
                      <h2 className="font-display font-semibold">AutoGrade</h2>
                    </div>
                    <div className="flex items-center gap-6">
                      <ProgressRing
                        value={classSummary.autograde.averageClassScore * 100}
                        label="Avg Score"
                      />
                      <div className="text-sm">
                        <p>
                          Completion Rate:{" "}
                          <span className="font-mono font-medium">
                            {Math.round(classSummary.autograde.examCompletionRate * 100)}%
                          </span>
                        </p>
                      </div>
                    </div>
                    {classSummary.autograde.topPerformers.length > 0 && (
                      <div>
                        <p className="tracking-caps text-fg-muted mb-2 flex items-center gap-1 text-xs font-bold uppercase">
                          <Trophy className="h-3 w-3" /> Top Performers
                        </p>
                        <div className="space-y-1">
                          {classSummary.autograde.topPerformers.slice(0, 3).map((s) => (
                            <div
                              key={s.studentId}
                              className="flex items-center justify-between text-sm"
                            >
                              <span>{s.name || s.studentId.slice(0, 8)}</span>
                              <span className="font-mono font-medium">
                                {Math.round(s.avgScore * 100)}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* LevelUp */}
                <Card>
                  <CardContent className="space-y-4 p-5">
                    <div className="flex items-center gap-2">
                      <BookOpen className="text-success h-4 w-4" />
                      <h2 className="font-display font-semibold">LevelUp</h2>
                    </div>
                    <div className="flex items-center gap-6">
                      <ProgressRing
                        value={classSummary.levelup.averageClassCompletion}
                        label="Avg Completion"
                      />
                      <div className="text-sm">
                        <p>
                          Active Rate:{" "}
                          <span className="font-mono font-medium">
                            {Math.round(classSummary.levelup.activeStudentRate * 100)}%
                          </span>
                        </p>
                      </div>
                    </div>
                    {classSummary.levelup.topPointEarners.length > 0 && (
                      <div>
                        <p className="tracking-caps text-fg-muted mb-2 flex items-center gap-1 text-xs font-bold uppercase">
                          <Trophy className="h-3 w-3" /> Top Point Earners
                        </p>
                        <div className="space-y-1">
                          {classSummary.levelup.topPointEarners.slice(0, 5).map((s) => (
                            <div
                              key={s.studentId}
                              className="flex items-center justify-between text-sm"
                            >
                              <span>{s.name || s.studentId.slice(0, 8)}</span>
                              <span className="font-mono font-medium">{s.points} pts</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      {tenantId && (
        <ClassFormDialog
          open={editClassOpen}
          onOpenChange={setEditClassOpen}
          tenantId={tenantId}
          editing={classData}
        />
      )}

      {tenantId && classId && (
        <EnrollStudentDialog
          open={enrollOpen}
          onOpenChange={setEnrollOpen}
          tenantId={tenantId}
          classId={classId}
          className={classData.name}
        />
      )}

      <ConfirmDialog
        open={!!removeTarget}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
        title="Remove student from class?"
        description={
          removeTarget
            ? `${removeTarget.displayName ?? removeTarget.uid} will be unenrolled from ${classData.name}. The student record itself is not deleted.`
            : ""
        }
        confirmLabel="Remove"
        variant="danger"
        onConfirm={() => {
          if (removeTarget) {
            removeMutation.mutate(removeTarget);
            setRemoveTarget(null);
          }
        }}
      />
    </div>
  );
}
