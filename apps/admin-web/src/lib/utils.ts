import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Unwrap repo `PageBag` / `{ items }` / infinite-query `{ pages }` into a stable array.
 * Query hooks return page bags; casting them as `T[]` crashes on `.map`.
 */
export function pageItems<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object") {
    const bag = data as { items?: unknown; pages?: Array<{ items?: unknown }> };
    if (Array.isArray(bag.items)) return bag.items as T[];
    if (Array.isArray(bag.pages)) {
      return bag.pages.flatMap((p) => (Array.isArray(p?.items) ? (p.items as T[]) : []));
    }
  }
  return [];
}
