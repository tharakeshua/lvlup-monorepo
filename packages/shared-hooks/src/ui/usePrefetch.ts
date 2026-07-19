import { useEffect, useRef } from "react";

/** Map of route paths to their lazy import functions */
export type PrefetchMap = Record<string, () => Promise<unknown>>;

// Track which routes have already been prefetched
const prefetched = new Set<string>();
const MAX_CONCURRENT = 3;
let activePrefetches = 0;

function findMatchingRoute(href: string, prefetchMap: PrefetchMap): string | null {
  // Extract pathname from href (handles both relative and absolute URLs)
  let pathname: string;
  try {
    const url = new URL(href, window.location.origin);
    pathname = url.pathname;
  } catch {
    pathname = href;
  }

  // Direct match
  if (prefetchMap[pathname]) return pathname;

  // Try matching the base path (e.g., /spaces/123 -> /spaces)
  const segments = pathname.split("/").filter(Boolean);
  for (let i = segments.length; i > 0; i--) {
    const basePath = "/" + segments.slice(0, i).join("/");
    if (prefetchMap[basePath]) return basePath;
  }

  return null;
}

function prefetchRoute(path: string, prefetchMap: PrefetchMap) {
  if (prefetched.has(path) || activePrefetches >= MAX_CONCURRENT) return;

  const importFn = prefetchMap[path];
  if (!importFn) return;

  prefetched.add(path);
  activePrefetches++;
  importFn().finally(() => {
    activePrefetches--;
  });
}

/**
 * Hook that enables route prefetching on link hover/focus.
 * Uses event delegation to listen for hover events on all <a> elements,
 * then triggers the lazy import for the matching route.
 *
 * @param prefetchMap - Map of route paths to their lazy import functions
 * @param delay - Delay in ms before triggering prefetch (default: 100)
 */
export function usePrefetch(prefetchMap: PrefetchMap, delay = 100) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const handleMouseEnter = (e: Event) => {
      const target = (e.target as Element)?.closest?.("a[href]");
      if (!target) return;

      const href = target.getAttribute("href");
      if (!href || href.startsWith("http") || href.startsWith("mailto:")) return;

      const route = findMatchingRoute(href, prefetchMap);
      if (!route) return;

      timerRef.current = setTimeout(() => {
        prefetchRoute(route, prefetchMap);
      }, delay);
    };

    const handleMouseLeave = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };

    const handleFocus = (e: Event) => {
      const target = (e.target as Element)?.closest?.("a[href]");
      if (!target) return;

      const href = target.getAttribute("href");
      if (!href || href.startsWith("http") || href.startsWith("mailto:")) return;

      const route = findMatchingRoute(href, prefetchMap);
      if (route) {
        prefetchRoute(route, prefetchMap);
      }
    };

    document.addEventListener("pointerenter", handleMouseEnter, true);
    document.addEventListener("pointerleave", handleMouseLeave, true);
    document.addEventListener("focusin", handleFocus, true);

    return () => {
      document.removeEventListener("pointerenter", handleMouseEnter, true);
      document.removeEventListener("pointerleave", handleMouseLeave, true);
      document.removeEventListener("focusin", handleFocus, true);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [prefetchMap, delay]);
}
