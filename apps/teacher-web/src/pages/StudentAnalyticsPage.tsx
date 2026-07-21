import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useStudents, useClasses } from "@levelup/query";
import type { Student, Class } from "@levelup/shared-types";
import {
  Button,
  Input,
  Skeleton,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@levelup/shared-ui";
import { Users, Search, BarChart3, ChevronRight } from "lucide-react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function asArray<T>(d: unknown): T[] {
  if (!d) return [];
  if (Array.isArray(d)) return d as T[];
  const obj = d as Record<string, unknown>;
  if (Array.isArray(obj.items)) return obj.items as T[];
  return [];
}

/** Runtime students may carry firstName/lastName/displayName beyond the strict type. */
type StudentRuntime = Student & {
  displayName?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
};

function studentDisplayName(s: StudentRuntime): string {
  if (s.displayName) return s.displayName;
  if (s.name) return s.name;
  if (s.firstName || s.lastName) return `${s.firstName ?? ""} ${s.lastName ?? ""}`.trim();
  return s.uid;
}

// ---------------------------------------------------------------------------
// Summary strip
// ---------------------------------------------------------------------------

interface SummaryStripProps {
  totalStudents: number;
  activeStudents: number;
  totalClasses: number;
}

function SummaryStrip({ totalStudents, activeStudents, totalClasses }: SummaryStripProps) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      <div className="bg-card border-subtle shadow-e1 rounded-lg border p-4">
        <p className="tracking-caps text-fg-muted text-xs font-bold uppercase">Total Students</p>
        <p className="font-display mt-1 text-2xl font-semibold">{totalStudents}</p>
        {activeStudents < totalStudents && (
          <p className="text-muted-foreground mt-0.5 text-xs">
            {activeStudents} active
          </p>
        )}
      </div>
      <div className="bg-card border-subtle shadow-e1 rounded-lg border p-4">
        <p className="tracking-caps text-fg-muted text-xs font-bold uppercase">Classes</p>
        <p className="font-display mt-1 text-2xl font-semibold">{totalClasses}</p>
      </div>
      <div className="bg-card border-subtle shadow-e1 hidden rounded-lg border p-4 sm:block">
        <p className="tracking-caps text-fg-muted text-xs font-bold uppercase">Per-student analytics</p>
        <p className="text-muted-foreground mt-1 text-sm">Click "View report" to see full metrics</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function StudentAnalyticsPage() {
  const navigate = useNavigate();

  const { data: studentData, isLoading: studentsLoading, error: studentsError } = useStudents();
  const { data: classData, isLoading: classesLoading } = useClasses();

  const students = useMemo(() => asArray<StudentRuntime>(studentData), [studentData]);
  const classes = useMemo(() => asArray<Class>(classData), [classData]);

  const [search, setSearch] = useState("");
  const [selectedClassId, setSelectedClassId] = useState<string>("__all__");

  // Build a lookup for class names
  const classMap = useMemo(
    () => new Map(classes.map((c) => [c.id, c])),
    [classes]
  );

  // Resolve primary class name for a student (first classId that resolves)
  function primaryClassName(s: StudentRuntime): string {
    for (const cid of s.classIds ?? []) {
      const cls = classMap.get(cid);
      if (cls) return cls.name;
    }
    return "—";
  }

  // Filter by class
  const classFiltered = useMemo(() => {
    if (selectedClassId === "__all__") return students;
    return students.filter((s) => (s.classIds ?? []).includes(selectedClassId));
  }, [students, selectedClassId]);

  // Filter by search term
  const filtered = useMemo(() => {
    if (!search.trim()) return classFiltered;
    const term = search.toLowerCase();
    return classFiltered.filter(
      (s) =>
        studentDisplayName(s).toLowerCase().includes(term) ||
        (s.rollNumber ?? "").toLowerCase().includes(term) ||
        (s.admissionNumber ?? "").toLowerCase().includes(term)
    );
  }, [classFiltered, search]);

  const activeStudents = students.filter((s) => s.status === "active").length;

  const isLoading = studentsLoading || classesLoading;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Student Analytics</h1>
          <p className="text-muted-foreground text-sm">
            Roster overview — open a student report for detailed metrics
          </p>
        </div>
      </div>

      {/* Summary strip */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      ) : (
        <SummaryStrip
          totalStudents={students.length}
          activeStudents={activeStudents}
          totalClasses={classes.length}
        />
      )}

      {/* Filters row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-xs flex-1">
          <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            type="text"
            placeholder="Search by name or roll number…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={selectedClassId} onValueChange={setSelectedClassId}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All classes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All classes</SelectItem>
            {classes.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Body */}
      {studentsError ? (
        <div className="border-destructive/50 bg-destructive/10 flex flex-col items-center justify-center rounded-lg border py-16">
          <p className="text-destructive text-sm">Failed to load students. Please try again.</p>
        </div>
      ) : isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
          <Users className="text-muted-foreground h-10 w-10" />
          <p className="text-muted-foreground mt-3 text-sm">
            {search || selectedClassId !== "__all__"
              ? "No students match your filters"
              : "No students yet"}
          </p>
          {(search || selectedClassId !== "__all__") && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-3"
              onClick={() => {
                setSearch("");
                setSelectedClassId("__all__");
              }}
            >
              Clear filters
            </Button>
          )}
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
                  Roll Number
                </TableHead>
                <TableHead className="tracking-caps text-fg-muted text-xs font-bold uppercase">
                  Class
                </TableHead>
                <TableHead className="tracking-caps text-fg-muted text-xs font-bold uppercase">
                  Grade
                </TableHead>
                <TableHead className="tracking-caps text-fg-muted text-xs font-bold uppercase">
                  Status
                </TableHead>
                <TableHead className="tracking-caps text-fg-muted text-right text-xs font-bold uppercase">
                  Report
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((student) => (
                <TableRow
                  key={student.id}
                  className={`border-subtle border-b hover:bg-surface-sunken/60${
                    student.status === "archived" ? " opacity-60" : ""
                  }`}
                >
                  <TableCell className="font-medium">
                    {studentDisplayName(student)}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {student.rollNumber ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {primaryClassName(student)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {student.grade ?? "—"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={student.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/students/${student.id}/report`)}
                      aria-label={`View analytics for ${studentDisplayName(student)}`}
                    >
                      <BarChart3 className="h-3.5 w-3.5" />
                      View report
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
