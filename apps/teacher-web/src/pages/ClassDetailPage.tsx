import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentTenantId } from "@levelup/shared-stores";
import {
  useClasses,
  useSpaces,
  useExams,
  useStudents,
  useClassProgressSummary,
  useApiError,
} from "@levelup/shared-hooks";
import { callSaveStudent } from "@levelup/shared-services";
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
import type { Space, Student } from "@levelup/shared-types";
import type { Exam } from "@levelup/shared-types";
import ClassFormDialog from "../components/class/ClassFormDialog";
import EnrollStudentDialog from "../components/class/EnrollStudentDialog";

export default function ClassDetailPage() {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const tenantId = useCurrentTenantId();

  const { data: classes = [] } = useClasses(tenantId);
  const classData = classes.find((c) => c.id === classId);

  const { data: allSpaces = [], isLoading: spacesLoading } = useSpaces(tenantId);
  const classSpaces = allSpaces.filter((s: Space) =>
    s.classIds?.includes(classId ?? "")
  );

  const { data: classExams = [], isLoading: examsLoading } = useExams(tenantId, {
    classId: classId ?? undefined,
  });

  const { data: classStudents = [], isLoading: studentsLoading } = useStudents(
    tenantId,
    { classId: classId ?? undefined }
  );

  const { data: classSummary, isLoading: analyticsLoading } =
    useClassProgressSummary(tenantId, classId ?? null);

  const queryClient = useQueryClient();
  const { handleError } = useApiError();
  const [editClassOpen, setEditClassOpen] = useState(false);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<Student | null>(null);

  const removeMutation = useMutation({
    mutationFn: async (student: Student) => {
      if (!tenantId || !classId) throw new Error("Missing tenant or class");
      const nextClassIds = (student.classIds ?? []).filter((id) => id !== classId);
      return callSaveStudent({
        id: student.id,
        tenantId,
        data: { classIds: nextClassIds },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenants", tenantId, "students"] });
      queryClient.invalidateQueries({ queryKey: ["tenants", tenantId, "classes"] });
      toast.success("Student removed from class");
    },
    onError: (err) => handleError(err, "Failed to remove student from class"),
  });

  if (!classData) {
    return (
      <div className="text-center py-24">
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
            <BreadcrumbLink asChild><Link to="/">Dashboard</Link></BreadcrumbLink>
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
          <h1 className="text-xl font-bold">{classData.name}</h1>
          <div className="flex items-center gap-2 mt-0.5 text-sm text-muted-foreground">
            <span>Grade {classData.grade}</span>
            {classData.section && <span>Section {classData.section}</span>}
            <StatusBadge status={classData.status} />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground flex items-center gap-1 text-sm">
            <Users className="h-4 w-4" /> {classData.studentCount} students
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditClassOpen(true)}
          >
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
        <TabsContent value="overview" className="space-y-6 mt-4">
          <div className="grid gap-4 md:grid-cols-4">
            <ScoreCard
              label="Students"
              value={classData.studentCount}
              icon={Users}
            />
            <ScoreCard
              label="Spaces"
              value={classSpaces.length}
              icon={BookOpen}
            />
            <ScoreCard
              label="Exams"
              value={classExams.length}
              icon={ClipboardList}
            />
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
              <h3 className="font-semibold mb-3">Recent Spaces</h3>
              {classSpaces.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No spaces assigned to this class yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {classSpaces.slice(0, 5).map((space: Space) => (
                    <Link
                      key={space.id}
                      to={`/spaces/${space.id}/edit`}
                      className="flex items-center justify-between rounded-md border px-3 py-2 hover:bg-muted"
                    >
                      <div>
                        <span className="text-sm font-medium">{space.title}</span>
                        {space.subject && (
                          <span className="ml-2 text-xs text-muted-foreground">
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
              <h3 className="font-semibold mb-3">Recent Exams</h3>
              {classExams.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No exams for this class yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {classExams.slice(0, 5).map((exam: Exam) => (
                    <Link
                      key={exam.id}
                      to={`/exams/${exam.id}`}
                      className="flex items-center justify-between rounded-md border px-3 py-2 hover:bg-muted"
                    >
                      <div>
                        <span className="text-sm font-medium">{exam.title}</span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {exam.subject}
                        </span>
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
                <div key={i} className="h-32 animate-pulse rounded-lg border bg-muted" />
              ))}
            </div>
          ) : classSpaces.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
              <BookOpen className="h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">
                No spaces assigned to this class
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {classSpaces.map((space: Space) => (
                <Link
                  key={space.id}
                  to={`/spaces/${space.id}/edit`}
                  className="group rounded-lg border bg-card p-5 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <h3 className="font-semibold group-hover:text-primary">
                      {space.title}
                    </h3>
                    <StatusBadge status={space.status} />
                  </div>
                  {space.description && (
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                      {space.description}
                    </p>
                  )}
                  <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
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
                <div key={i} className="h-16 animate-pulse rounded-lg border bg-muted" />
              ))}
            </div>
          ) : classExams.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
              <ClipboardList className="h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">
                No exams for this class yet
              </p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Total Marks</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classExams.map((exam: Exam) => (
                    <TableRow key={exam.id}>
                      <TableCell className="font-medium">{exam.title}</TableCell>
                      <TableCell className="text-muted-foreground">{exam.subject}</TableCell>
                      <TableCell className="text-muted-foreground">{exam.totalMarks}</TableCell>
                      <TableCell>
                        <StatusBadge status={exam.status} />
                      </TableCell>
                      <TableCell>
                        <Link
                          to={`/exams/${exam.id}`}
                          className="text-primary hover:underline text-xs"
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
                <div key={i} className="h-12 animate-pulse rounded-lg border bg-muted" />
              ))}
            </div>
          ) : classStudents.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
              <Users className="h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">
                No students in this class
              </p>
              <Button
                size="sm"
                className="mt-4"
                onClick={() => setEnrollOpen(true)}
              >
                <UserPlus className="h-3.5 w-3.5" /> Enroll students
              </Button>
            </div>
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Roll No.</TableHead>
                    <TableHead>Student ID</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>Section</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classStudents.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell className="font-medium">{student.displayName ?? student.uid}</TableCell>
                      <TableCell>{student.rollNumber ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{student.uid}</TableCell>
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
        <TabsContent value="analytics" className="space-y-6 mt-4">
          {analyticsLoading ? (
            <div className="grid gap-4 md:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 animate-pulse rounded-lg border bg-muted" />
              ))}
            </div>
          ) : !classSummary ? (
            <div className="rounded-lg border border-dashed p-12 text-center">
              <BarChart3 className="h-10 w-10 mx-auto text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">
                No analytics data yet. Data will appear after exams are graded and
                spaces are used.
              </p>
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <ScoreCard
                  label="Students"
                  value={classSummary.studentCount}
                  icon={Users}
                />
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
                <ScoreCard
                  label="At-Risk Students"
                  value={classSummary.atRiskCount}
                  icon={Users}
                />
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                {/* AutoGrade */}
                <Card>
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-center gap-2">
                      <ClipboardList className="h-4 w-4 text-blue-500" />
                      <h2 className="font-semibold">AutoGrade</h2>
                    </div>
                    <div className="flex items-center gap-6">
                      <ProgressRing
                        value={classSummary.autograde.averageClassScore * 100}
                        label="Avg Score"
                      />
                      <div className="text-sm">
                        <p>
                          Completion Rate:{" "}
                          <span className="font-medium">
                            {Math.round(classSummary.autograde.examCompletionRate * 100)}%
                          </span>
                        </p>
                      </div>
                    </div>
                    {classSummary.autograde.topPerformers.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                          <Trophy className="h-3 w-3" /> Top Performers
                        </p>
                        <div className="space-y-1">
                          {classSummary.autograde.topPerformers.slice(0, 3).map((s) => (
                            <div
                              key={s.studentId}
                              className="flex items-center justify-between text-sm"
                            >
                              <span>{s.name || s.studentId.slice(0, 8)}</span>
                              <span className="font-medium">
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
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-green-500" />
                      <h2 className="font-semibold">LevelUp</h2>
                    </div>
                    <div className="flex items-center gap-6">
                      <ProgressRing
                        value={classSummary.levelup.averageClassCompletion}
                        label="Avg Completion"
                      />
                      <div className="text-sm">
                        <p>
                          Active Rate:{" "}
                          <span className="font-medium">
                            {Math.round(classSummary.levelup.activeStudentRate * 100)}%
                          </span>
                        </p>
                      </div>
                    </div>
                    {classSummary.levelup.topPointEarners.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                          <Trophy className="h-3 w-3" /> Top Point Earners
                        </p>
                        <div className="space-y-1">
                          {classSummary.levelup.topPointEarners.slice(0, 5).map((s) => (
                            <div
                              key={s.studentId}
                              className="flex items-center justify-between text-sm"
                            >
                              <span>{s.name || s.studentId.slice(0, 8)}</span>
                              <span className="font-medium">{s.points} pts</span>
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
