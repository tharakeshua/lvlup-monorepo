/**
 * Shared opaque-cursor pagination helper (SDK-LAYERS-PLAN §4.1, §3.5,
 * MERGE-PAGINATION).
 *
 * Repos own `paginate()` opaque-cursor management: the `nextCursor` returned by
 * the wire is threaded back VERBATIM into the next request's `cursor` field —
 * never parsed or mutated by the client. `nextCursor: null` is the end-of-stream
 * sentinel. `total` is surfaced ONLY when the wire returns one (a maintained
 * server counter) — the client never derives it (no `.count()`; the client never
 * touches Firestore).
 */
import type { PageRequest, PageResponse } from "./api-types.js";

/** A single fetched page plus a cursor-managing `fetchNextPage` walker. */
export interface PageBag<T> {
  items: T[];
  nextCursor: string | null;
  total?: number;
  /** Fetch the next page; absent at end-of-stream (`nextCursor === null`). */
  fetchNextPage?: () => Promise<PageBag<T>>;
}

/** A filter that may carry paging fields merged in. */
export type Paged<F> = F & PageRequest;

/**
 * `list(filter)` — issue exactly ONE wire call for the given filter+cursor and
 * surface the `pageResponse` envelope unchanged.
 */
export async function listOnce<F, T>(
  fetcher: (req: Paged<F>) => Promise<PageResponse<T>>,
  filter: Paged<F>
): Promise<PageResponse<T>> {
  const page = await fetcher(filter);
  return { items: page.items, nextCursor: page.nextCursor, total: page.total };
}

/**
 * `paginate(filter)` — returns a {@link PageBag} whose `fetchNextPage` threads
 * the opaque cursor forward and stops (omits `fetchNextPage`) once
 * `nextCursor === null`. Drains exactly one wire call per page, never one past
 * the null sentinel.
 */
export async function paginate<F, T>(
  fetcher: (req: Paged<F>) => Promise<PageResponse<T>>,
  filter: Paged<F>
): Promise<PageBag<T>> {
  const page = await fetcher(filter);
  return toBag(fetcher, filter, page);
}

function toBag<F, T>(
  fetcher: (req: Paged<F>) => Promise<PageResponse<T>>,
  filter: Paged<F>,
  page: PageResponse<T>
): PageBag<T> {
  const bag: PageBag<T> = {
    items: page.items,
    nextCursor: page.nextCursor,
    total: page.total,
  };
  if (page.nextCursor !== null) {
    bag.fetchNextPage = async () => {
      // Opaque: thread the cursor straight back, untouched.
      const next = await fetcher({ ...filter, cursor: page.nextCursor as string });
      return toBag(fetcher, filter, next);
    };
  }
  return bag;
}
