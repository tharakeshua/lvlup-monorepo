import { Button } from "./button";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";

export interface DataTablePaginationProps {
  totalItems: number;
  pageSize: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
  /** Hide pagination when total items is at or below this threshold (default: 10) */
  hideThreshold?: number;
}

export function DataTablePagination({
  totalItems,
  pageSize,
  currentPage,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  hideThreshold = 10,
}: DataTablePaginationProps) {
  const totalPages = Math.ceil(totalItems / pageSize);

  if (totalItems <= hideThreshold) return null;

  const start = Math.min((currentPage - 1) * pageSize + 1, totalItems);
  const end = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="flex items-center justify-between border-t px-4 py-3">
      <p
        className="text-muted-foreground text-sm tabular-nums"
        aria-live="polite"
        aria-atomic="true"
      >
        Showing <span className="text-foreground font-medium">{start}</span>
        {"\u2013"}
        <span className="text-foreground font-medium">{end}</span> of{" "}
        <span className="text-foreground font-medium">{totalItems}</span>
      </p>
      <div className="flex items-center gap-2">
        <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
          <SelectTrigger className="h-8 w-[70px]" aria-label="Rows per page">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {pageSizeOptions.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-9 min-h-[44px] w-9 min-w-[44px]"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(1)}
            aria-label="Go to first page"
          >
            <ChevronsLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-9 min-h-[44px] w-9 min-w-[44px]"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
            aria-label="Go to previous page"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
          <span className="flex h-9 items-center px-2.5 text-sm font-medium tabular-nums">
            {currentPage} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-9 min-h-[44px] w-9 min-w-[44px]"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(currentPage + 1)}
            aria-label="Go to next page"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-9 min-h-[44px] w-9 min-w-[44px]"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(totalPages)}
            aria-label="Go to last page"
          >
            <ChevronsRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}
