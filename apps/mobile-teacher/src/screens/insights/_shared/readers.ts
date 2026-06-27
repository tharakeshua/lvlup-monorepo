/**
 * Defensive readers shared across the HOME + INSIGHTS lane.
 *
 * Every `@levelup/query` payload reaches a screen typed `unknown` (the teacher
 * callables are still being canonicalized — GATE-B). Nothing here ever throws on
 * a missing field: list envelopes are unwrapped, infinite-query pages flattened,
 * numbers/strings coerced with fallbacks. Field access in every screen goes
 * through these so a half-shaped (or absent) doc renders an empty/zero state
 * rather than red-screening.
 */

/** Coerce to a finite number, else default. */
export const num = (v: unknown, d = 0): number => (typeof v === "number" && isFinite(v) ? v : d);

/** Coerce to a string, else default. */
export const str = (v: unknown, d = ""): string => (typeof v === "string" ? v : d);

/** Coerce to a plain record (never null). */
export const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" ? (v as Record<string, unknown>) : {};

/** Coerce to a boolean (only literal `true`). */
export const bool = (v: unknown): boolean => v === true;

/** First present (non-null/undefined) value across candidate keys. */
export function pick(source: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    if (source[k] !== undefined && source[k] !== null) return source[k];
  }
  return undefined;
}

/** Unwrap a list payload that may be `T[]`, `{ items }`, `{ data }`, `{ docs }`, … */
export function asList(v: unknown): Record<string, unknown>[] {
  if (Array.isArray(v)) return v.map(obj);
  const o = obj(v);
  for (const key of [
    "items",
    "data",
    "results",
    "docs",
    "rows",
    "spaces",
    "classes",
    "students",
    "exams",
    "announcements",
    "insights",
  ]) {
    if (Array.isArray(o[key])) return (o[key] as unknown[]).map(obj);
  }
  return [];
}

/**
 * Flatten an infinite-query result (`{ pages: PageResponse[] }`) into a flat row
 * list. Each page may itself be `T[]` or `{ items }`-shaped, so reuse `asList`.
 */
export function flattenPages(v: unknown): Record<string, unknown>[] {
  const o = obj(v);
  const pages = o.pages;
  if (!Array.isArray(pages)) return asList(v);
  return pages.flatMap((p) => asList(p));
}

/** Clamp a 0–100 percentage. */
export const pct = (v: unknown, d = 0): number => Math.max(0, Math.min(100, num(v, d)));

/** Round to at most one decimal (drops a trailing `.0`). */
export function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

/** A short "Xd ago"-style relative time from an ISO string / ms / Date. */
export function relTime(v: unknown): string {
  const t = toMillis(v);
  if (t == null) return "";
  const diff = Date.now() - t;
  if (diff < 0) return "just now";
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

/** Best-effort epoch-ms from ISO string / number / Firestore-ish `{ seconds }`. */
export function toMillis(v: unknown): number | null {
  if (typeof v === "number" && isFinite(v)) return v < 1e12 ? v * 1000 : v;
  if (typeof v === "string") {
    const t = Date.parse(v);
    return isNaN(t) ? null : t;
  }
  const o = obj(v);
  const secs = pick(o, ["seconds", "_seconds"]);
  if (typeof secs === "number") return secs * 1000;
  return null;
}

/** Initials from a display name ("Asha Rao" → "AR"). */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** First-name (or email local part), title-cased, for greetings. */
export function firstName(name: string, email = ""): string {
  const base = name.trim() || email.trim();
  if (!base) return "there";
  const part = base.split(/[\s@.]+/).filter(Boolean)[0];
  if (!part) return "there";
  return part.charAt(0).toUpperCase() + part.slice(1);
}

/** Numbers from a `Record<string, number>` map (analytics bucket records). */
export function recordValues(v: unknown): number[] {
  const o = obj(v);
  return Object.values(o).map((x) => num(x));
}

/** `{ label, value }[]` rows from a record-of-objects (e.g. topicPerformance). */
export function recordRows(
  v: unknown,
  valueKeys: string[],
  labelKeys: string[] = ["label", "topic", "name", "title"]
): { key: string; label: string; value: number }[] {
  const o = obj(v);
  return Object.entries(o).map(([k, raw]) => {
    const r = obj(raw);
    return {
      key: k,
      label: str(pick(r, labelKeys), k),
      value: num(pick(r, valueKeys)),
    };
  });
}
