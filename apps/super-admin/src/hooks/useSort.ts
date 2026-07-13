import { useState, useMemo } from "react";

type SortDirection = "asc" | "desc" | null;

export function useSort<T>(items: T[], defaultKey = "", defaultDirection: SortDirection = null) {
  const [sortKey, setSortKey] = useState(defaultKey);
  const [sortDirection, setSortDirection] = useState<SortDirection>(defaultDirection);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection((d) => (d === "asc" ? "desc" : d === "desc" ? null : "asc"));
      if (sortDirection === "desc") setSortKey("");
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  const sortedItems = useMemo(() => {
    if (!sortKey || !sortDirection) return items;
    return [...items].sort((a, b) => {
      const aVal = (a as Record<string, unknown>)[sortKey];
      const bVal = (b as Record<string, unknown>)[sortKey];
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
      return sortDirection === "asc" ? cmp : -cmp;
    });
  }, [items, sortKey, sortDirection]);

  return { sortedItems, currentSort: { key: sortKey, direction: sortDirection }, handleSort };
}
