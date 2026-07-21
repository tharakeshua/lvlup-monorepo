import { useMemo } from "react";
import type { MatchingData } from "@levelup/shared-types";

interface MatchingAnswererProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: MatchingData | any;
  /** Learner selection keyed by LEFT text → chosen RIGHT text. */
  value?: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
  disabled?: boolean;
}

/**
 * Normalizes the various stored/projected shapes into `{ leftItems, options }`:
 *  - Learner read:  { pairs: [{left, right:""}], options: [rightText, …] }  ← the
 *    server-projected pool of right-side targets (positional pairing stripped).
 *  - Authoring/full: { pairs: [{left, right}] }  → options derived from `right`.
 *  - Legacy seed:    { leftItems:[{text}], rightItems:[{text}] }.
 *
 * Left items are keyed by their TEXT (the grader keys the answer by left→right
 * text), so the learner value is `Record<leftText, rightText>`.
 */
function normalizeMatchingData(data: unknown): {
  leftItems: string[];
  options: string[];
} {
  if (!data || typeof data !== "object") return { leftItems: [], options: [] };
  const d = data as Record<string, unknown>;

  let leftItems: string[] = [];
  let options: string[] = [];

  if (Array.isArray(d.pairs) && d.pairs.length > 0) {
    leftItems = (d.pairs as Record<string, unknown>[])
      .map((p) => String(p.left ?? ""))
      .filter((t) => t.length > 0);
  } else if (Array.isArray(d.leftItems)) {
    leftItems = (d.leftItems as Record<string, unknown>[])
      .map((li) => String(li.text ?? li.left ?? ""))
      .filter((t) => t.length > 0);
  }

  // Prefer the server-projected `options` pool; fall back to the pairs' `right`
  // texts (authoring/preview) or a legacy `rightItems` list.
  if (Array.isArray(d.options) && d.options.length > 0) {
    options = (d.options as unknown[]).map((o) => String(o)).filter((t) => t.length > 0);
  } else if (Array.isArray(d.pairs)) {
    options = (d.pairs as Record<string, unknown>[])
      .map((p) => String(p.right ?? ""))
      .filter((t) => t.length > 0);
  } else if (Array.isArray(d.rightItems)) {
    options = (d.rightItems as Record<string, unknown>[])
      .map((ri) => String(ri.text ?? ri.right ?? ""))
      .filter((t) => t.length > 0);
  }

  // De-duplicate the option pool while preserving order.
  options = [...new Set(options)];

  return { leftItems, options };
}

export default function MatchingAnswerer({
  data,
  value = {},
  onChange,
  disabled,
}: MatchingAnswererProps) {
  const { leftItems, options } = useMemo(() => normalizeMatchingData(data), [data]);

  const usedRights = new Set(Object.values(value));

  const handleChange = (leftText: string, rightText: string) => {
    const next = { ...value };
    if (rightText) next[leftText] = rightText;
    else delete next[leftText];
    onChange(next);
  };

  if (leftItems.length === 0 || options.length === 0) {
    return <p className="text-muted-foreground text-sm">No matching pairs configured.</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-xs">
        Match each item on the left with its pair on the right.
      </p>
      {leftItems.map((left, idx) => (
        <div key={`${left}-${idx}`} className="flex items-center gap-3">
          <div className="bg-muted/50 flex-1 rounded border p-2 text-sm">{left}</div>
          <span className="text-muted-foreground">→</span>
          <select
            value={value[left] ?? ""}
            onChange={(e) => handleChange(left, e.target.value)}
            disabled={disabled}
            className="border-input bg-background focus-visible:ring-ring flex-1 rounded border p-2 text-sm focus:outline-none focus-visible:ring-2 disabled:opacity-60"
          >
            <option value="">Select match...</option>
            {options.map((opt, optIdx) => (
              <option
                key={`${opt}-${optIdx}`}
                value={opt}
                disabled={usedRights.has(opt) && value[left] !== opt}
              >
                {opt}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}
