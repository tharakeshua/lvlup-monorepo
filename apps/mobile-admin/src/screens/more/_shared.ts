/**
 * Defensive read helpers shared by the More-section screens (lane M-admin-more).
 *
 * The `@levelup/query` admin hooks return `unknown` (the admin identity/comms
 * callables are still deploying — GATE-B), so every screen must coerce shapes
 * defensively: a read can be an array, a `{ items }` envelope, or absent. None
 * of these helpers throw; missing data degrades to empty/`undefined`.
 *
 * NOT a screen module — the registry imports screens by exact filename, so this
 * sibling file is free to exist in the lane folder.
 */

/** Coerce a read result into a flat array (array | `{ items }` | `{ data }`). */
export function listOf<T = Record<string, unknown>>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[];
  if (res && typeof res === "object") {
    const o = res as { items?: unknown; data?: unknown; results?: unknown };
    if (Array.isArray(o.items)) return o.items as T[];
    if (Array.isArray(o.data)) return o.data as T[];
    if (Array.isArray(o.results)) return o.results as T[];
  }
  return [];
}

/** Count of a read result, or null when the shape isn't list-like. */
export function countOf(res: unknown): number | null {
  if (res == null) return null;
  if (Array.isArray(res)) return res.length;
  const items = listOf(res);
  return items.length > 0 ? items.length : null;
}

/** A loosely-keyed view of an object (every field optional + unknown). */
export type Loose = Record<string, unknown>;

/** Read a string field, trying several aliases; `undefined` when absent. */
export function pickStr(o: unknown, ...keys: string[]): string | undefined {
  if (!o || typeof o !== "object") return undefined;
  const rec = o as Loose;
  for (const k of keys) {
    const v = rec[k];
    if (typeof v === "string" && v.length > 0) return v;
    if (typeof v === "number") return String(v);
  }
  return undefined;
}

/** Read a numeric field, trying several aliases; `undefined` when absent. */
export function pickNum(o: unknown, ...keys: string[]): number | undefined {
  if (!o || typeof o !== "object") return undefined;
  const rec = o as Loose;
  for (const k of keys) {
    const v = rec[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) {
      return Number(v);
    }
  }
  return undefined;
}

/** Read a boolean field, trying several aliases. */
export function pickBool(o: unknown, ...keys: string[]): boolean | undefined {
  if (!o || typeof o !== "object") return undefined;
  const rec = o as Loose;
  for (const k of keys) {
    const v = rec[k];
    if (typeof v === "boolean") return v;
  }
  return undefined;
}

/** Best-effort human date from an ISO string / epoch / `{ seconds }` stamp. */
export function fmtDate(value: unknown): string | undefined {
  if (value == null) return undefined;
  let ms: number | undefined;
  if (typeof value === "number") ms = value < 1e12 ? value * 1000 : value;
  else if (typeof value === "string") {
    const t = Date.parse(value);
    if (!Number.isNaN(t)) ms = t;
  } else if (typeof value === "object") {
    const secs =
      (value as { seconds?: number; _seconds?: number }).seconds ??
      (value as { _seconds?: number })._seconds;
    if (typeof secs === "number") ms = secs * 1000;
  }
  if (ms == null) return undefined;
  try {
    return new Date(ms).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return undefined;
  }
}

/** Title-case a snake/kebab status token (e.g. `in_review` → `In review`). */
export function humanize(s: string | undefined): string | undefined {
  if (!s) return undefined;
  const spaced = s.replace(/[_-]+/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
