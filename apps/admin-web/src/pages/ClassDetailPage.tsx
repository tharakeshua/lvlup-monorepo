import { useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  useClasses,
  useTeachers,
  useStudents,
  useExams,
  useSpaces,
  useAcademicSessions,
} from "@levelup/query";
import type { Teacher, Student, Exam, Space, Class, AcademicSession } from "@levelup/shared-types";
import {
  Button,
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@levelup/shared-ui";
import { ArrowLeft, Users, GraduationCap, FileText, BookOpen } from "lucide-react";

function formatTimestamp(timestamp: unknown): string {
  if (!timestamp) return "\u2014";
  const ts = timestamp as { seconds?: number; toDate?: () => Date };
  if (ts.toDate) return ts.toDate().toLocaleDateString();
  if (ts.seconds) return new Date(ts.seconds * 1000).toLocaleDateString();
  return String(timestamp);
}

export default function ClassDetailPage() {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const classesQuery = useClasses({});
  const classes = (classesQuery.data ?? []) as Class[];
  const classesLoading = classesQuery.isLoading;
  const teachers = (useTeachers({}).data ?? []) as Teacher[];
  const students = (useStudents({}).data ?? []) as Student[];
  const exams = (useExams({}).data ?? []) as Exam[];
  const spaces = (useSpaces({}).data ?? []) as Space[];
  const sessions = (useAcademicSessions({}).data ?? []) as AcademicSession[];

  const classData = classes?.find((c) => c.id === classId);

  // Enrolled students derived from Student.classIds
  const enrolledStudents = useMemo(() => {
    if (!students || !classId) return [];
    return students.filter((s: Student) => s.classIds?.includes(classId));
  }, [students, classId]);

  // Assigned teachers
  const assignedTeachers = useMemo(() => {
    if (!teachers || !classData?.teacherIds) return [];
    const teacherIdSet = new Set(classData.teacherIds);
    return teachers.filter((t: Teacher) => teacherIdSet.has(t.id));
  }, [teachers, classData?.teacherIds]);

  // Recent exams for this class (limit 5)
  const recentExams = useMemo(() => {
    if (!exams || !classId) return [];
    return exams.filter((e: Exam) => e.classIds?.includes(classId)).slice(0, 5);
  }, [exams, classId]);

  // Recent spaces for this class (limit 5)
  const recentSpaces = useMemo(() => {
    if (!spaces || !classId) return [];
    return spaces.filter((s: Space) => s.classIds?.includes(classId)).slice(0, 5);
  }, [spaces, classId]);

  // Academic session name
  const sessionName = useMemo(() => {
    if (!sessions || !classData?.academicSessionId) return null;
    return sessions.find((s) => s.id === classData.academicSessionId)?.name ?? null;
  }, [sessions, classData?.academicSessionId]);

  if (classesLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-muted-foreground">Loading class details...</div>
      </div>
    );
  }

  if (!classData) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate("/classes")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Classes
        </Button>
        <div className="rounded-lg border border-dashed p-12 text-center">
          <h3 className="text-lg font-semibold">Class not found</h3>
          <p className="text-muted-foreground mt-1 text-sm">
            The class you are looking for does not exist or has been removed.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/">Dashboard</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/classes">Classes</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{classData.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/classes")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{classData.name}</h1>
              <Badge variant={classData.status === "active" ? "default" : "secondary"}>
                {classData.status}
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm">
              Grade {classData.grade}
              {classData.section ? ` - Section ${classData.section}` : ""}
              {sessionName ? ` | ${sessionName}` : ""}
            </p>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">Students</CardTitle>
            <Users className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{enrolledStudents.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">Teachers</CardTitle>
            <GraduationCap className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{assignedTeachers.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">Exams</CardTitle>
            <FileText className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{recentExams.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">Spaces</CardTitle>
            <BookOpen className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{recentSpaces.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs: Students, Teachers, Exams, Spaces */}
      <Tabs defaultValue="students">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="students">Students ({enrolledStudents.length})</TabsTrigger>
          <TabsTrigger value="teachers">Teachers ({assignedTeachers.length})</TabsTrigger>
          <TabsTrigger value="exams">Exams</TabsTrigger>
          <TabsTrigger value="spaces">Spaces</TabsTrigger>
        </TabsList>

        {/* Students Tab */}
        <TabsContent value="students">
          <div className="rounded-lg border">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Roll Number</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {enrolledStudents.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-muted-foreground py-8 text-center text-sm"
                      >
                        No students enrolled in this class
                      </TableCell>
                    </TableRow>
                  ) : (
                    enrolledStudents.map((s: Student) => (
                      <TableRow key={s.id}>
                        <TableCell className="text-sm font-medium">
                          {[s.firstName, s.lastName].filter(Boolean).join(" ") ||
                            s.displayName ||
                            s.email ||
                            s.uid.slice(0, 12)}
                        </TableCell>
                        <TableCell className="text-sm">{s.rollNumber || "\u2014"}</TableCell>
                        <TableCell className="text-sm">{s.grade || "\u2014"}</TableCell>
                        <TableCell>
                          <Badge variant={s.status === "active" ? "default" : "secondary"}>
                            {s.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* Teachers Tab */}
        <TabsContent value="teachers">
          <div className="rounded-lg border">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Subjects</TableHead>
                    <TableHead>Designation</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignedTeachers.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-muted-foreground py-8 text-center text-sm"
                      >
                        No teachers assigned to this class
                      </TableCell>
                    </TableRow>
                  ) : (
                    assignedTeachers.map((t: Teacher) => (
                      <TableRow key={t.id}>
                        <TableCell className="text-sm font-medium">
                          {[t.firstName, t.lastName].filter(Boolean).join(" ") ||
                            t.displayName ||
                            t.email ||
                            t.uid.slice(0, 12)}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {t.subjects?.map((s) => (
                              <Badge key={s} variant="outline" className="text-xs">
                                {s}
                              </Badge>
                            ))}
                            {(!t.subjects || t.subjects.length === 0) && (
                              <span className="text-muted-foreground text-xs">{"\u2014"}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{t.designation || "\u2014"}</TableCell>
                        <TableCell>
                          <Badge variant={t.status === "active" ? "default" : "secondary"}>
                            {t.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* Exams Tab */}
        <TabsContent value="exams">
          <div className="rounded-lg border">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Total Marks</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentExams.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-muted-foreground py-8 text-center text-sm"
                      >
                        No exams found for this class
                      </TableCell>
                    </TableRow>
                  ) : (
                    recentExams.map((e: Exam) => (
                      <TableRow key={e.id}>
                        <TableCell className="text-sm font-medium">{e.title}</TableCell>
                        <TableCell className="text-sm">{e.subject || "\u2014"}</TableCell>
                        <TableCell className="text-sm">{formatTimestamp(e.examDate)}</TableCell>
                        <TableCell className="text-sm">{e.totalMarks}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              e.status === "published" || e.status === "results_released"
                                ? "default"
                                : "secondary"
                            }
                          >
                            {e.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* Spaces Tab */}
        <TabsContent value="spaces">
          <div className="rounded-lg border">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentSpaces.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-muted-foreground py-8 text-center text-sm"
                      >
                        No spaces found for this class
                      </TableCell>
                    </TableRow>
                  ) : (
                    recentSpaces.map((s: Space) => (
                      <TableRow key={s.id}>
                        <TableCell className="text-sm font-medium">{s.title}</TableCell>
                        <TableCell className="text-sm capitalize">{s.type}</TableCell>
                        <TableCell className="text-sm">{s.subject || "\u2014"}</TableCell>
                        <TableCell>
                          <Badge variant={s.status === "published" ? "default" : "secondary"}>
                            {s.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
