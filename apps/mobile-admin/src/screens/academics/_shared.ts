/**
 * Academics-lane shared helpers (lane M-admin-academics, local to this folder).
 *
 * Read responses from the deployed `lvlup-ff6fa` admin callables may drift from
 * the TS types (GATE-B canonicalization in flight), so every accessor here is
 * defensive: a list read may come back as a bare array OR `{ items: [...] }` OR
 * `{ pages: [{ items }] }` (infinite), and any nested field may be absent.
 */

/** Normalize a list read to a plain array, tolerating array / {items} / {pages}. */
export function listOf<T = Record<string, unknown>>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[];
  const r = res as { items?: unknown[]; pages?: Array<{ items?: unknown[] }> } | null | undefined;
  if (Array.isArray(r?.items)) return r!.items as T[];
  if (Array.isArray(r?.pages)) return r!.pages.flatMap((p) => p?.items ?? []) as T[];
  return [];
}

/** A safe count for a list read, or null when unknown (loading / soft-miss). */
export function countOf(res: unknown): number | null {
  if (res == null) return null;
  const arr = listOf(res);
  return arr.length;
}

/** Read a possibly-missing nested number, falling back to 0. */
export function num(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

/** Read a possibly-missing string field. */
export function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

/** Percentage rounded to a whole number, or em-dash when not computable. */
export function pct(v: unknown): string {
  return typeof v === "number" && Number.isFinite(v) ? `${Math.round(v)}%` : "—";
}

/**
 * Format a date-ish value (ISO string, millis, or Firestore-timestamp-like) to
 * a short readable date. Returns '—' when unparseable (never throws).
 */
export function fmtDate(v: unknown): string {
  const d = toDate(v);
  if (!d) return "—";
  try {
    return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return "—";
  }
}

function toDate(v: unknown): Date | null {
  if (v == null) return null;
  if (typeof v === "string") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof v === "number") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const o = v as { seconds?: number; _seconds?: number; toDate?: () => Date };
  if (typeof o.toDate === "function") {
    try {
      return o.toDate();
    } catch {
      return null;
    }
  }
  const secs = o.seconds ?? o._seconds;
  if (typeof secs === "number") return new Date(secs * 1000);
  return null;
}

/** Title-case a lowercase enum token ('learning' → 'Learning'). */
export function titleCase(v: unknown): string {
  const s = str(v);
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}

/** Map an entity status to a Badge variant + label. */
export function statusBadge(status: unknown): {
  variant: "success" | "neutral" | "warning" | "info";
  label: string;
} {
  const s = str(status).toLowerCase();
  if (
    s === "published" ||
    s === "active" ||
    s === "released" ||
    s === "results_released" ||
    s === "completed"
  )
    return { variant: "success", label: titleCase(s.replace(/_/g, " ")) || "Active" };
  if (s === "archived" || s === "inactive")
    return { variant: "neutral", label: titleCase(s) || "Archived" };
  if (s === "grading" || s === "draft")
    return { variant: "warning", label: titleCase(s) || "Draft" };
  return { variant: "info", label: titleCase(s.replace(/_/g, " ")) || "Unknown" };
}
