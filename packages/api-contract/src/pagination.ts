/**
 * Pagination fragment (SDK-LAYERS-PLAN §3.5 / api-contract-core.md §5).
 *
 * The unified wire envelope EVERY `list*` endpoint uses. Domain owns the
 * `Page<T>`/`Cursor` types; this layer owns the request/response wire fragment.
 * Cursors are opaque strings (the SDK/UI never construct or parse them);
 * `limit` defaults to 20, hard-capped at 100; `nextCursor: null` = end-of-stream.
 */
import { z } from "zod";
import type { ZodType } from "zod";

/** Opaque, server-encoded cursor (base64 Firestore snapshot today; row key under REST later). */
export const PageRequest = z
  .object({
    cursor: z.string().optional(),
    limit: z.number().int().min(1).max(100).default(20),
  })
  .strict();
export type PageRequestInput = z.input<typeof PageRequest>; // limit optional (pre-default)
export type PageRequestParsed = z.infer<typeof PageRequest>; // limit required (post-default)

/**
 * Wrap any item schema in the unified page envelope. `total` only when cheaply
 * known (a maintained counter, never a live `.count()` per page).
 */
export const pageResponse = <T extends ZodType>(item: T) =>
  z
    .object({
      items: z.array(item),
      nextCursor: z.string().nullable(), // null = end of stream
      total: z.number().int().nonnegative().optional(),
    })
    .strict();

/** Inferred page type for a given item type (repos/hooks consume this; UI never sees `cursor`). */
export type PageResponse<T> = { items: T[]; nextCursor: string | null; total?: number };

/**
 * Composition helper so a request schema can mix filter fields + paging without
 * re-spelling them. Stays `.strict()` if `shape` was `.strict()`.
 *   requestSchema: withPaging(z.object({ status: SpaceStatus.optional() }).strict())
 */
export const withPaging = <Shape extends z.ZodRawShape>(shape: z.ZodObject<Shape>) =>
  shape.extend(PageRequest.shape).strict();
