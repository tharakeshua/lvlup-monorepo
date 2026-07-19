import { useCallback, useMemo } from "react";
import type { JumbledData } from "@levelup/shared-types";
import { GripVertical, ArrowUp, ArrowDown } from "lucide-react";

interface JumbledAnswererProps {
  data: JumbledData;
  value?: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
}

/**
 * Deterministic shuffle using a simple hash seed derived from item IDs.
 * Ensures the same question always shows the same shuffled order,
 * but NOT the correct order.
 */
function deterministicShuffle(ids: string[]): string[] {
  if (ids.length <= 1) return [...ids];

  // Simple hash from concatenated IDs
  let seed = 0;
  const key = ids.join("-");
  for (let i = 0; i < key.length; i++) {
    seed = ((seed << 5) - seed + key.charCodeAt(i)) | 0;
  }

  const shuffled = [...ids];
  // Fisher-Yates with seeded pseudo-random
  for (let i = shuffled.length - 1; i > 0; i--) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const j = seed % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }

  // If shuffle happened to produce the original order, swap first two
  const isOriginalOrder = shuffled.every((id, idx) => id === ids[idx]);
  if (isOriginalOrder && shuffled.length >= 2) {
    [shuffled[0], shuffled[1]] = [shuffled[1]!, shuffled[0]!];
  }

  return shuffled;
}

export default function JumbledAnswerer({ data, value, onChange, disabled }: JumbledAnswererProps) {
  // Shuffle on first render if no saved value
  const initialOrder = useMemo(
    () => deterministicShuffle((data?.items ?? []).map((item) => item.id)),
    [data?.items]
  );

  const order = value ?? initialOrder;

  const moveItem = useCallback(
    (fromIndex: number, direction: "up" | "down") => {
      const toIndex = direction === "up" ? fromIndex - 1 : fromIndex + 1;
      if (toIndex < 0 || toIndex >= order.length) return;
      const next = [...order];
      [next[fromIndex], next[toIndex]] = [next[toIndex]!, next[fromIndex]!];
      onChange(next);
    },
    [order, onChange]
  );

  if (!data?.items?.length) {
    return <p className="text-muted-foreground text-sm">Question data not available</p>;
  }

  const itemMap = new Map(data.items.map((item) => [item.id, item]));

  return (
    <div className="space-y-1">
      <p className="text-muted-foreground mb-2 text-xs">
        Arrange the items in the correct order using the arrows.
      </p>
      {order.map((itemId, index) => {
        const item = itemMap.get(itemId);
        if (!item) return null;

        return (
          <div
            key={itemId}
            className={`bg-background flex items-center gap-2 rounded-lg border p-3 ${
              disabled ? "opacity-60" : ""
            }`}
          >
            <GripVertical className="text-muted-foreground h-4 w-4 flex-shrink-0" />
            <span className="text-muted-foreground w-6 text-sm font-medium">{index + 1}.</span>
            <span className="flex-1 text-sm">{item.text}</span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => moveItem(index, "up")}
                disabled={disabled || index === 0}
                className="hover:bg-accent rounded p-1 disabled:opacity-30"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => moveItem(index, "down")}
                disabled={disabled || index === order.length - 1}
                className="hover:bg-accent rounded p-1 disabled:opacity-30"
              >
                <ArrowDown className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
