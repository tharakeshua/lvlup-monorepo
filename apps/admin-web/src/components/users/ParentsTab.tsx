import type { Parent, Student } from "@levelup/shared-types";
import {
  Badge,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  DataTablePagination,
} from "@levelup/shared-ui";
import { Pencil } from "lucide-react";
import { TableSkeleton } from "../skeletons/TableSkeleton";
import type { PaginationResult } from "../../hooks/usePagination";

interface Props {
  isLoading: boolean;
  filteredParents: Parent[] | undefined;
  pagination: PaginationResult<Parent>;
  students: Student[] | undefined;
  onEditParent: (parent: Parent) => void;
}

export function ParentsTab({
  isLoading,
  filteredParents,
  pagination,
  students,
  onEditParent,
}: Props) {
  return (
    <div className="rounded-lg border">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Linked Children</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="p-0">
                  <TableSkeleton columns={4} />
                </TableCell>
              </TableRow>
            ) : !filteredParents?.length ? (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground py-8 text-center text-sm">
                  No parents found
                </TableCell>
              </TableRow>
            ) : (
              pagination.paginatedItems.map((p: Parent) => (
                <TableRow key={p.id}>
                  <TableCell className="text-sm font-medium">
                    {[p.firstName, p.lastName].filter(Boolean).join(" ") ||
                      p.displayName ||
                      p.email ||
                      p.uid.slice(0, 12)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {p.childStudentIds?.length ? (
                        p.childStudentIds.map((sId) => {
                          const student = students?.find((s: Student) => s.id === sId);
                          const studentName = student
                            ? [student.firstName, student.lastName].filter(Boolean).join(" ") ||
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
                        <span className="text-muted-foreground text-xs">None</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.status === "active" ? "default" : "secondary"}>
                      {p.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => onEditParent(p)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {(filteredParents?.length ?? 0) > 0 && (
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
