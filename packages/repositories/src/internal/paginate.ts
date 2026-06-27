/**
 * Opaque-cursor pagination helpers (SDK-LAYERS-PLAN §4.1, §3.5,
 * MERGE-PAGINATION). Repos thread `nextCursor` straight back into the next
 * request's `cursor` field WITHOUT parsing/mutating it — the cursor is opaque.
 * `nextCursor:null` is the end-of-stream sentinel.
 *
 * `total` is surfaced ONLY when the wire returns it (a maintained counter) — the
 * repo never derives it via a `.count()` (the client never touches Firestore).
 */
import type { PageRequest, PageResponse } from "./api-types.js";

/** A drained-on-demand page bag: the current page + a bound `fetchNextPage`. */
export interface PageBag<T> {
  items: T[];
  nextCursor: string | null;
  total?: number;
  /** Fetch the next page; absent once `nextCursor === null` (end of stream). */
  fetchNextPage?: () => Promise<PageBag<T>>;
}

/** A `list*` callable taking a paged request and returning a paged response. */
export type ListFn<TReq extends PageRequest, T> = (req: TReq) => Promise<PageResponse<T>>;

/**
 * Issue ONE `list*` call, threading the opaque cursor verbatim. The returned
 * `PageResponse` is surfaced as-is (items + nextCursor + maybe total).
 */
export async function listPage<TReq extends PageRequest, T>(
  fn: ListFn<TReq, T>,
  req: TReq
): Promise<PageResponse<T>> {
  const res = await fn(req);
  return {
    items: res.items ?? [],
    nextCursor: res.nextCursor ?? null,
    ...(res.total !== undefined ? { total: res.total } : {}),
  };
}

/**
 * Build a cursor-managing `PageBag` over a `list*` callable. The bag exposes the
 * first page plus a bound `fetchNextPage()` that walks to the `nextCursor:null`
 * sentinel and never re-issues past it (the iterator contract in
 * paginate-cursor.test.ts).
 */
export async function paginate<TReq extends PageRequest, T>(
  fn: ListFn<TReq, T>,
  req: TReq
): Promise<PageBag<T>> {
  const page = await listPage(fn, req);
  return toBag(fn, req, page);
}

function toBag<TReq extends PageRequest, T>(
  fn: ListFn<TReq, T>,
  req: TReq,
  page: PageResponse<T>
): PageBag<T> {
  const bag: PageBag<T> = {
    items: page.items,
    nextCursor: page.nextCursor,
    ...(page.total !== undefined ? { total: page.total } : {}),
  };
  if (page.nextCursor !== null) {
    bag.fetchNextPage = async (): Promise<PageBag<T>> => {
      const next = await listPage(fn, { ...req, cursor: page.nextCursor as string });
      return toBag(fn, req, next);
    };
  }
  return bag;
}
