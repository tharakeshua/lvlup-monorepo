import { useEffect, useRef } from "react";

/**
 * App-local route hover/focus prefetch.
 *
 * PARITY GAP workaround: the legacy shared route-prefetch hook has no
 * `@levelup/query` equivalent (it prefetches lazy ROUTE CHUNKS, not query data —
 * a TanStack `queryClient.prefetchQuery` would be the wrong tool). It is pure UI
 * and app-agnostic, so it lives locally here. Behavior is identical to the legacy hook.
 */

/** Map of route paths to their lazy import functions */
export type PrefetchMap = Record<string, () => Promise<unknown>>;

// Track which routes have already been prefetched
const prefetched = new Set<string>();
const MAX_CONCURRENT = 3;
let activePrefetches = 0;

function findMatchingRoute(href: string, prefetchMap: PrefetchMap): string | null {
  let pathname: string;
  try {
    const url = new URL(href, window.location.origin);
    pathname = url.pathname;
  } catch {
    pathname = href;
  }

  if (prefetchMap[pathname]) return pathname;

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
 * Hook that enables route prefetching on link hover/focus via event delegation.
 *
 * @param prefetchMap - Map of route paths to their lazy import functions
 * @param delay - Delay in ms before triggering prefetch (default: 100)
 */
export function useRoutePrefetch(prefetchMap: PrefetchMap, delay = 100) {
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
