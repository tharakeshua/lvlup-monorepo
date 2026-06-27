/**
 * Shared opaque-cursor pagination helper for the autograde repos
 * (SDK-LAYERS-PLAN §4.1, §3.5, MERGE-PAGINATION).
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
  const out: PageResponse<T> = {
    items: page.items ?? [],
    nextCursor: page.nextCursor ?? null,
  };
  if (page.total !== undefined) out.total = page.total;
  return out;
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
  const page = await listOnce(fetcher, filter);
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
  };
  if (page.total !== undefined) bag.total = page.total;
  if (page.nextCursor !== null) {
    bag.fetchNextPage = async (): Promise<PageBag<T>> => {
      // Opaque: thread the cursor straight back, untouched.
      const next = await listOnce(fetcher, { ...filter, cursor: page.nextCursor as string });
      return toBag(fetcher, filter, next);
    };
  }
  return bag;
}

// ---------------------------------------------------------------------------
// getMany — N+1 collapse with NO client-side Firestore chunking (§4.1, §5.5)
// ---------------------------------------------------------------------------

/**
 * Collapse N gets into ONE batched read callable. The full id list rides one
 * request; the 10/30-id `in`-chunking + max-ids cap lives SERVER-SIDE in
 * repository-admin (DX-14/PC-15). `[]` short-circuits to zero wire calls. Missing
 * ids are surfaced faithfully (server omits them — none fabricated).
 */
export async function batchGetMany<T, E extends object = Record<string, never>>(
  invoke: (req: { ids: string[] } & E) => Promise<PageResponse<T>>,
  ids: readonly string[],
  extra?: E
): Promise<T[]> {
  if (ids.length === 0) return [];
  const req = { ...(extra ?? ({} as E)), ids: [...ids] } as { ids: string[] } & E;
  const res = await invoke(req);
  return res.items ?? [];
}
