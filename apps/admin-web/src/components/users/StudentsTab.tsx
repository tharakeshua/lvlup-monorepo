import type { Student, Class } from "@levelup/shared-types";
import {
  Badge,
  Button,
  Checkbox,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  DataTablePagination,
} from "@levelup/shared-ui";
import { FolderOpen, Link2 } from "lucide-react";
import { TableSkeleton } from "../skeletons/TableSkeleton";
import type { PaginationResult } from "../../hooks/usePagination";

interface Props {
  isLoading: boolean;
  filteredStudents: Student[] | undefined;
  pagination: PaginationResult<Student>;
  classes: Class[] | undefined;
  onAssignClass: (entityId: string, type: "teacher" | "student", currentClassIds: string[]) => void;
  onLinkParent: (studentId: string, currentParentIds: string[]) => void;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: (checked: boolean) => void;
}

export function StudentsTab({
  isLoading,
  filteredStudents,
  pagination,
  classes,
  onAssignClass,
  onLinkParent,
  selectedIds,
  onToggle,
  onToggleAll,
}: Props) {
  const getClassName = (classId: string) =>
    classes?.find((c) => c.id === classId)?.name ?? classId.slice(0, 8);

  const allOnPageSelected =
    pagination.paginatedItems.length > 0 &&
    pagination.paginatedItems.every((s) => selectedIds.has(s.id));

  return (
    <div className="rounded-lg border">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allOnPageSelected}
                  onCheckedChange={(checked) => onToggleAll(!!checked)}
                  aria-label="Select all students on page"
                />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Roll Number</TableHead>
              <TableHead>Grade</TableHead>
              <TableHead>Class(es)</TableHead>
              <TableHead>Parents</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="p-0">
                  <TableSkeleton columns={8} />
                </TableCell>
              </TableRow>
            ) : !filteredStudents?.length ? (
              <TableRow>
                <TableCell colSpan={8} className="text-muted-foreground py-8 text-center text-sm">
                  No students found
                </TableCell>
              </TableRow>
            ) : (
              pagination.paginatedItems.map((s: Student) => (
                <TableRow key={s.id} className={selectedIds.has(s.id) ? "bg-muted/50" : undefined}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(s.id)}
                      onCheckedChange={() => onToggle(s.id)}
                      aria-label={`Select ${[s.firstName, s.lastName].filter(Boolean).join(" ") || "student"}`}
                    />
                  </TableCell>
                  <TableCell className="text-sm font-medium">
                    {[s.firstName, s.lastName].filter(Boolean).join(" ") ||
                      s.displayName ||
                      s.email ||
                      s.uid.slice(0, 12)}
                  </TableCell>
                  <TableCell className="text-sm">{s.rollNumber || "\u2014"}</TableCell>
                  <TableCell className="text-sm">{s.grade || "\u2014"}</TableCell>
                  <TableCell>
                    <button
                      onClick={() => onAssignClass(s.id, "student", s.classIds ?? [])}
                      className="hover:text-primary inline-flex flex-wrap items-center gap-1 text-sm"
                      aria-label={`Assign classes to ${[s.firstName, s.lastName].filter(Boolean).join(" ") || "student"}`}
                    >
                      {s.classIds?.length
                        ? s.classIds.map((cId) => (
                            <Badge key={cId} variant="outline" className="text-xs">
                              {getClassName(cId)}
                            </Badge>
                          ))
                        : "Assign"}
                    </button>
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => onLinkParent(s.id, s.parentIds ?? [])}
                      className="hover:text-primary inline-flex items-center gap-1 text-sm"
                      aria-label={`Link parents to ${[s.firstName, s.lastName].filter(Boolean).join(" ") || "student"}`}
                    >
                      <Link2 className="h-3.5 w-3.5" /> {s.parentIds?.length ?? 0}
                    </button>
                  </TableCell>
                  <TableCell>
                    <Badge variant={s.status === "active" ? "default" : "secondary"}>
                      {s.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onAssignClass(s.id, "student", s.classIds ?? [])}
                      aria-label="Assign classes"
                    >
                      <FolderOpen className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {(filteredStudents?.length ?? 0) > 0 && (
        <DataTablePagination
          totalItems={pagination.totalItems}
          pageSize={pagination.pageSize}
          currentPage={pagination.currentPage}
          onPageChange={pagination.setCurrentPage}
          onPageSizeChange={pagination.setPageSize}
        />
      )}
    </div>
  );
}
