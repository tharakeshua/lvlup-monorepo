import type { Teacher } from "@levelup/shared-types";
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
import { FolderOpen } from "lucide-react";
import { TableSkeleton } from "../skeletons/TableSkeleton";
import type { PaginationResult } from "../../hooks/usePagination";

interface Props {
  isLoading: boolean;
  filteredTeachers: Teacher[] | undefined;
  pagination: PaginationResult<Teacher>;
  onAssignClass: (entityId: string, type: "teacher" | "student", currentClassIds: string[]) => void;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: (checked: boolean) => void;
}

export function TeachersTab({
  isLoading,
  filteredTeachers,
  pagination,
  onAssignClass,
  selectedIds,
  onToggle,
  onToggleAll,
}: Props) {
  const allOnPageSelected =
    pagination.paginatedItems.length > 0 &&
    pagination.paginatedItems.every((t) => selectedIds.has(t.id));

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
                  aria-label="Select all teachers on page"
                />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Subjects</TableHead>
              <TableHead>Designation</TableHead>
              <TableHead>Classes</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="p-0">
                  <TableSkeleton columns={7} />
                </TableCell>
              </TableRow>
            ) : !filteredTeachers?.length ? (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground py-8 text-center text-sm">
                  No teachers found
                </TableCell>
              </TableRow>
            ) : (
              pagination.paginatedItems.map((t: Teacher) => (
                <TableRow key={t.id} className={selectedIds.has(t.id) ? "bg-muted/50" : undefined}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(t.id)}
                      onCheckedChange={() => onToggle(t.id)}
                      aria-label={`Select ${[t.firstName, t.lastName].filter(Boolean).join(" ") || "teacher"}`}
                    />
                  </TableCell>
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
                    <button
                      onClick={() => onAssignClass(t.id, "teacher", t.classIds ?? [])}
                      className="hover:text-primary inline-flex items-center gap-1 text-sm"
                    >
                      {t.classIds?.length ?? 0} class(es)
                    </button>
                  </TableCell>
                  <TableCell>
                    <Badge variant={t.status === "active" ? "default" : "secondary"}>
                      {t.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onAssignClass(t.id, "teacher", t.classIds ?? [])}
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
      {(filteredTeachers?.length ?? 0) > 0 && (
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
