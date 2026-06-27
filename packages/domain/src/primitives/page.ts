/**
 * Transport-neutral pagination primitives. The domain owns the *types*;
 * api-contract owns the wire PageRequest/pageResponse but imports these so cursors
 * stay opaque end-to-end.
 */
import type { Brand } from "./brand.js";

export type Cursor = Brand<string, "Cursor">;

export interface PageParams {
  cursor?: Cursor;
  limit: number;
}

export interface Page<T> {
  items: T[];
  nextCursor: Cursor | null;
  total?: number;
}

export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 100;

export const asCursor = (s: string): Cursor => s as Cursor;
