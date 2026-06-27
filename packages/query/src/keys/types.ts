/**
 * Query-key types (query-infra.md §4.1/§4.2, SDK-LAYERS-PLAN §4.2).
 *
 * `DomainName` is the canonical query-key-root union. It is pinned to the
 * contract's `DomainName` (the exhaustive `DOMAIN_NAMES` set) so the
 * `keyof typeof QUERY_KEYS === DomainName` totality invariant holds and every
 * `INVALIDATION_GRAPH` root is a real key root (MERGE-DOMAINNAME).
 */
import type { DomainName as ContractDomainName } from "@levelup/api-contract";

/** The single exhaustive union of query-key roots (≡ contract `DomainName`). */
export type DomainName = ContractDomainName;

/** A query key: a tuple whose first element is the `DomainName` root. */
export type QueryKey = readonly [DomainName, ...unknown[]];

/** The canonical invalidation unit — a single root string. */
export type KeyRoot = DomainName;

/** The hierarchical factory surface every domain gets (query-infra.md §4.1). */
export interface KeyFactory<D extends DomainName = DomainName> {
  /** `[domain]` — the root prefix every key extends (tenant-implicit). */
  readonly root: () => readonly [D];
  /** Alias of `root()` — `[domain]` (bulk-invalidate the whole domain). */
  readonly all: () => readonly [D];
  /** `[domain, 'list', filter]` — finite/paginated list keyed by an object filter. */
  readonly list: <F extends object>(filter?: F) => readonly [D, "list", F | Record<string, never>];
  /** `[domain, 'infinite', filter]` — distinct from `list` so invalidation can target one. */
  readonly infinite: <F extends object>(
    filter?: F
  ) => readonly [D, "infinite", F | Record<string, never>];
  /** `[domain, 'detail', id]` — one entity. Branded IDs are stringified here. */
  readonly detail: (id: string) => readonly [D, "detail", string];
  /** `[domain, 'detail', id, kind, params]` — a nested/derived sub-resource of a detail. */
  readonly sub: (
    id: string,
    kind: string,
    params?: object
  ) => readonly [D, "detail", string, string, object];
}

/** The full registry shape: one factory per `DomainName`. */
export type DomainKeys = { readonly [D in DomainName]: KeyFactory<D> };

/** Any key produced by any factory method (registry-wide). */
export type AnyQueryKey = readonly unknown[];
