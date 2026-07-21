import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useStudents, useClasses } from "@levelup/query";
import type { Student } from "@levelup/shared-types";
import {
  Input,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Button,
} from "@levelup/shared-ui";
import { BarChart3, Search, ChevronRight } from "lucide-react";

function asArray<T>(d: unknown): T[] {
  if (Array.isArray(d)) return d as T[];
  if (d && typeof d === "object") {
    const o = d as { items?: T[] };
    if (Array.isArray(o.items)) return o.items;
  }
  return [];
}

export default function StudentAnalyticsPage() {
  const { data: studentsData, isLoading } = useStudents();
  const { data: classesData } = useClasses();
  const students = useMemo(() => asArray<Student>(studentsData), [studentsData]);
  const classes = useMemo(
    () => asArray<{ id: string; name: string }>(classesData),
    [classesData]
  );
  const classNameById = useMemo(
    () => Object.fromEntries(classes.map((c) => [c.id, c.name])),
    [classes]
  );
  const [search, setSearch] = useState("");

  const filtered = students.filter((s) => {
    const name = s.displayName ?? `${s.firstName ?? ""} ${s.lastName ?? ""}`.trim();
    const haystack = [name, s.rollNumber, s.admissionNumber, s.uid].filter(Boolean).join(" ");
    return haystack.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <BarChart3 className="text-primary h-6 w-6" />
        <div>
          <h1 className="font-display text-2xl font-semibold">Student Analytics</h1>
          <p className="text-muted-foreground text-sm">
            Progress summaries and exam performance by student
          </p>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search students..."
          className="pl-9"
        />
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Roll</TableHead>
              <TableHead>Class</TableHead>
              <TableHead className="text-right">Report</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={4}>
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground py-8 text-center text-sm">
                  No students found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((student) => {
                const name =
                  student.displayName ??
                  `${student.firstName ?? ""} ${student.lastName ?? ""}`.trim() ||
                  student.uid;
                const classLabel =
                  student.classIds?.map((id) => classNameById[id] ?? id).join(", ") || "—";
                return (
                  <TableRow key={student.id}>
                    <TableCell className="font-medium">{name}</TableCell>
                    <TableCell className="font-mono text-xs">{student.rollNumber ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{classLabel}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="sm" className="gap-1">
                        <Link to={`/students/${student.id}/report`}>
                          View <ChevronRight className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
