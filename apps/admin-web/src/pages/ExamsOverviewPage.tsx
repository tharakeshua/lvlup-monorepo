import { useMemo, useState } from "react";
import { useExams, useTeachers } from "@levelup/query";
import type { Exam, Teacher } from "@levelup/shared-types";
import {
  Input,
  Button,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  DataTablePagination,
  SortableTableHead,
} from "@levelup/shared-ui";
import { Search } from "lucide-react";
import { TableSkeleton } from "../components/skeletons/TableSkeleton";
import { usePagination } from "../hooks/usePagination";
import { useSort } from "../hooks/useSort";
import { STATUS_VARIANT } from "../lib/constants";
import { pageItems } from "@/lib/utils";

export default function ExamsOverviewPage() {
  const examsQuery = useExams({});
  const exams = pageItems<Exam>(examsQuery.data);
  const { isLoading, isError, refetch } = examsQuery;
  const teachers = pageItems<Teacher>(useTeachers({}).data);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const teacherMap = useMemo(
    () =>
      new Map(
        teachers.map((t) => {
          const id = t.uid || (t as { id?: string }).id || "";
          return [id, t.displayName ?? t.email ?? (id ? id.slice(0, 8) : "Teacher")] as const;
        })
      ),
    [teachers]
  );

  // Match live zExamStatus (legacy "completed"/"scheduled"/"active" are not valid filters).
  const statuses = [
    "all",
    "draft",
    "question_paper_uploaded",
    "question_paper_extracted",
    "published",
    "grading",
    "results_released",
    "archived",
  ];

  // Client-side filter; server list is unconstrained (repo fans out if needed).
  const filtered = exams.filter((exam) => {
    if (statusFilter !== "all" && exam.status !== statusFilter) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return exam.title.toLowerCase().includes(q) || exam.subject?.toLowerCase().includes(q);
  });

  const { sortedItems, currentSort, handleSort } = useSort(filtered ?? []);
  const { paginatedItems, currentPage, pageSize, totalItems, setCurrentPage, setPageSize } =
    usePagination(sortedItems, 25);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Exams Overview</h1>
        <p className="text-muted-foreground text-sm">All exams across teachers</p>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            type="text"
            placeholder="Search exams..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1 overflow-x-auto">
          {statuses.map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? "default" : "secondary"}
              size="sm"
              onClick={() => setStatusFilter(s)}
              className="shrink-0 capitalize"
            >
              {s === "all" ? "All" : s.replaceAll("_", " ")}
            </Button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border">
        {isError ? (
          <div className="px-4 py-8 text-center">
            <p className="text-muted-foreground text-sm">Failed to load exams.</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : isLoading ? (
          <TableSkeleton columns={5} />
        ) : !filtered?.length ? (
          <div className="text-muted-foreground px-4 py-8 text-center text-sm">No exams found</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableTableHead
                      sortKey="title"
                      currentSort={currentSort}
                      onSort={handleSort}
                    >
                      Title
                    </SortableTableHead>
                    <SortableTableHead
                      sortKey="subject"
                      currentSort={currentSort}
                      onSort={handleSort}
                    >
                      Subject
                    </SortableTableHead>
                    <SortableTableHead
                      sortKey="totalMarks"
                      currentSort={currentSort}
                      onSort={handleSort}
                    >
                      Total Marks
                    </SortableTableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedItems.map((exam) => (
                    <TableRow key={exam.id}>
                      <TableCell className="font-medium">{exam.title}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {exam.subject || "--"}
                      </TableCell>
                      <TableCell>{exam.totalMarks}</TableCell>
                      <TableCell>
                        <Badge
                          variant={STATUS_VARIANT[exam.status] ?? "secondary"}
                          className="capitalize"
                        >
                          {exam.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {exam.createdBy
                          ? (teacherMap.get(exam.createdBy) ?? exam.createdBy.slice(0, 8))
                          : "--"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <DataTablePagination
              totalItems={totalItems}
              pageSize={pageSize}
              currentPage={currentPage}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
            />
          </>
        )}
      </div>
    </div>
  );
}
