/**
 * Internal kit for the `levelup-content` repositories (SDK-LAYERS-PLAN §4.1).
 *
 * This module is deliberately NOT named `*repo*` so the R6 static
 * import-isolation scan (repo-isolation.static.test.ts) never mistakes it for a
 * sibling repo — it is shared plumbing (cursor mgmt, getMany fan-in, paginate
 * iterator, transition pre-checks), consumed by every per-entity repo and by the
 * view repo.
 *
 * The repos depend on `@levelup/api-client` + `@levelup/domain` + the contract's
 * `ALLOWED_TRANSITIONS` ONLY (the strictly-downward edge). The `ApiClient` shape
 * is declared structurally here (mirrors api-client-core.md §3.2) so this layer
 * type-checks against the sibling package's plan-specified public surface while
 * it is written concurrently.
 */
import { ALLOWED_TRANSITIONS } from "@levelup/api-contract";
// Single canonical source for the answer-key editor cache-scope helpers (§4.2).
import { EDIT_ITEM_SCOPE, editItemKey, isSensitiveKey } from "../internal/sensitive-keys";

// ---------------------------------------------------------------------------
// ApiClient seam (structural — mirrors api-client-core.md §3.2)
// ---------------------------------------------------------------------------

/** A single namespaced callable: `req → Promise<res>`. */
export type CallableFn = (data: unknown) => Promise<unknown>;

/** A module namespace (`api.levelup.saveSpace`, …). Indexed by op name. */
export type ModuleNamespace = Record<string, CallableFn>;

/**
 * The injected SDK client. We type only what the repos touch: the four module
 * namespaces, the realtime `subscribe` pass-through, and the dynamic `call`
 * escape hatch. The real `ApiClient` (mapped over CALLABLES) is structurally
 * assignable to this.
 */
export interface ApiClientLike {
  identity: ModuleNamespace;
  levelup: ModuleNamespace;
  autograde: ModuleNamespace;
  analytics: ModuleNamespace;
  subscribe: (
    name: string,
    params: unknown,
    cb:
      | ((payload: unknown) => void)
      | { next: (p: unknown) => void; error?: (e: unknown) => void; onSynced?: () => void }
  ) => { unsubscribe(): void };
  call: (name: string) => CallableFn;
}

// ---------------------------------------------------------------------------
// Pagination — opaque cursor management (§3.5, §4.1, MERGE-PAGINATION)
// ---------------------------------------------------------------------------

/** A contract `PageRequest` fragment merged onto any list filter. */
export interface PageRequest {
  cursor?: string | null;
  limit?: number;
}

/** The wire `pageResponse(item)` shape (§3.5). `nextCursor:null` = end-of-stream. */
export interface Page<T> {
  items: T[];
  nextCursor: string | null;
  total?: number;
}

/** A cursor-managing page bag with a bound `fetchNextPage` (§4.1 iterator). */
export interface PageBag<T> extends Page<T> {
  fetchNextPage(): Promise<PageBag<T>>;
}

/**
 * Normalize an arbitrary wire response into a strict `Page<T>`. The cursor is
 * OPAQUE — we never parse or mutate it, only thread it back verbatim. `total` is
 * surfaced ONLY when the wire returns one (never repo-derived — no `.count()`).
 */
export function toPage<T>(raw: unknown): Page<T> {
  const r = (raw ?? {}) as { items?: T[]; nextCursor?: string | null; total?: number };
  const page: Page<T> = {
    items: Array.isArray(r.items) ? r.items : [],
    nextCursor: r.nextCursor ?? null,
  };
  if (typeof r.total === "number") page.total = r.total;
  return page;
}

/**
 * Build a `paginate()` iterator over a single callable. Each `fetchNextPage`
 * issues exactly ONE wire call carrying the previous `nextCursor` verbatim, and
 * stops at the `null` sentinel (never re-issues past end-of-stream).
 */
export function makePaginator<T, R extends PageRequest = PageRequest>(
  invoke: (req: R) => Promise<unknown>,
  baseReq: R
): Promise<PageBag<T>> {
  const fetch = async (req: R): Promise<PageBag<T>> => {
    const page = toPage<T>(await invoke(req));
    return {
      ...page,
      async fetchNextPage(): Promise<PageBag<T>> {
        if (page.nextCursor === null) return fetch({ ...req, cursor: null });
        return fetch({ ...req, cursor: page.nextCursor });
      },
    };
  };
  return fetch(baseReq);
}

// ---------------------------------------------------------------------------
// getMany — N+1 collapse with NO client-side Firestore chunking (§4.1, §5.5)
// ---------------------------------------------------------------------------

/**
 * Collapse N gets into ONE batched read callable. The full id list rides one
 * request; the 10/30-id `in`-chunking + `Promise.all` + max-ids cap lives
 * SERVER-SIDE in repository-admin (DX-14/PC-15). `[]` short-circuits to zero wire
 * calls. Missing ids are surfaced faithfully (server omits them — none fabricated).
 */
export async function batchGetMany<T, E extends object = Record<string, never>>(
  invoke: (req: { ids: string[] } & E) => Promise<unknown>,
  ids: readonly string[],
  extra?: E
): Promise<T[]> {
  if (ids.length === 0) return [];
  const req = { ...(extra ?? ({} as E)), ids: [...ids] } as { ids: string[] } & E;
  const res = toPage<T>(await invoke(req));
  return res.items;
}

// ---------------------------------------------------------------------------
// Transition pre-checks — pure reads of ALLOWED_TRANSITIONS (§3.6, §4.1, §4.5)
// ---------------------------------------------------------------------------

type TransitionTable = Record<string, Record<string, readonly string[]>>;

/**
 * Pure UX pre-check: may `from → to` for this state machine? Reads the SAME
 * `ALLOWED_TRANSITIONS` data the server enforces with `assertTransition` — the
 * repo never encodes a second, drifting table. No wire call.
 */
export function canTransition(domain: string, from: string, to: string): boolean {
  const table = ALLOWED_TRANSITIONS as unknown as TransitionTable;
  const edges = table[domain]?.[from];
  return Array.isArray(edges) ? edges.includes(to) : false;
}

// ---------------------------------------------------------------------------
// Answer-key editor cache scope (§4.2 — getItemForEdit isolation)
// Re-exported from the single canonical `../internal/sensitive-keys`.
// ---------------------------------------------------------------------------
export { EDIT_ITEM_SCOPE, editItemKey, isSensitiveKey };
