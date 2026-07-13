import { TableHead } from "./table";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

type SortDirection = "asc" | "desc" | null;

export interface SortableTableHeadProps {
  children: React.ReactNode;
  sortKey: string;
  currentSort: { key: string; direction: SortDirection };
  onSort: (key: string) => void;
}

export function SortableTableHead({
  children,
  sortKey,
  currentSort,
  onSort,
}: SortableTableHeadProps) {
  const isActive = currentSort.key === sortKey;
  const direction = isActive ? currentSort.direction : null;

  return (
    <TableHead
      aria-sort={direction === "asc" ? "ascending" : direction === "desc" ? "descending" : "none"}
    >
      <button
        className="hover:text-foreground flex items-center gap-1 transition-colors"
        onClick={() => onSort(sortKey)}
        aria-label={`Sort by ${typeof children === "string" ? children : sortKey}`}
        type="button"
      >
        {children}
        {isActive ? (
          direction === "asc" ? (
            <ArrowUp className="h-3 w-3" aria-hidden="true" />
          ) : (
            <ArrowDown className="h-3 w-3" aria-hidden="true" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-50" aria-hidden="true" />
        )}
      </button>
    </TableHead>
  );
}
