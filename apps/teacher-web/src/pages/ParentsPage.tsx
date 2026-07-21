import { useMemo, useState } from "react";
import { useParents, useStudents } from "@levelup/query";
import type { Parent, Student } from "@levelup/shared-types";
import {
  Input,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Badge,
} from "@levelup/shared-ui";
import { Users, Search } from "lucide-react";

function asArray<T>(d: unknown): T[] {
  if (Array.isArray(d)) return d as T[];
  if (d && typeof d === "object") {
    const o = d as { items?: T[] };
    if (Array.isArray(o.items)) return o.items;
  }
  return [];
}

export default function ParentsPage() {
  const { data: parentsData, isLoading } = useParents();
  const { data: studentsData } = useStudents();
  const parents = useMemo(() => asArray<Parent>(parentsData), [parentsData]);
  const students = useMemo(() => asArray<Student>(studentsData), [studentsData]);
  const [search, setSearch] = useState("");

  const filtered = parents.filter((p) => {
    const name =
      [p.firstName, p.lastName].filter(Boolean).join(" ") || p.displayName || p.email || p.id;
    return name.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Users className="text-primary h-6 w-6" />
        <div>
          <h1 className="font-display text-2xl font-semibold">Parents</h1>
          <p className="text-muted-foreground text-sm">
            View parent accounts and linked children (read-only)
          </p>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search parents..."
          className="pl-9"
        />
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Linked Children</TableHead>
              <TableHead>Status</TableHead>
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
                  No parents found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((parent) => {
                const linkedIds = parent.studentIds?.length
                  ? parent.studentIds
                  : (parent.childStudentIds ?? []);
                const name =
                  [parent.firstName, parent.lastName].filter(Boolean).join(" ") ||
                  parent.displayName ||
                  parent.email ||
                  parent.id.slice(0, 12);
                return (
                  <TableRow key={parent.id}>
                    <TableCell className="font-medium">{name}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {parent.email ?? "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {linkedIds.length ? (
                          linkedIds.map((sId) => {
                            const student = students.find((s) => s.id === sId);
                            const studentName = student
                              ? student.displayName ||
                                [student.firstName, student.lastName].filter(Boolean).join(" ") ||
                                student.rollNumber ||
                                sId.slice(0, 8)
                              : sId.slice(0, 8);
                            return (
                              <Badge key={sId} variant="outline" className="text-xs">
                                {studentName}
                              </Badge>
                            );
                          })
                        ) : (
                          <span className="text-muted-foreground text-xs">None linked</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="capitalize text-xs">{parent.status ?? "active"}</TableCell>
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
