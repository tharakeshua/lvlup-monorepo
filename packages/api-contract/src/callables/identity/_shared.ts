/**
 * Identity-module contract kit.
 *
 * Re-exports the CORE authoring surface (`defineCallable`, `CallableDef`, the
 * pagination fragment — all owned by the stable src-root core files
 * `callable-def.ts` + `pagination.ts`) so every identity def authors against ONE
 * canonical helper set. The small write/empty fragments (`SaveResponseSchema`,
 * `EmptyRequest`, `looseRecord`) are defined here to the canonical §3.2 shape so
 * this module compiles standalone on the parallel build wave; the typecheck/fix
 * wave folds them onto the core `callables/core/_shared` versions (byte-identical).
 */
import { z } from "zod";

export { defineCallable } from "../../callable-def.js";
export type {
  CallableDef,
  ApiModule,
  RateTier,
  AuthMode,
  IdempotencyKeyHint,
} from "../../callable-def.js";
export { PageRequest, pageResponse, withPaging } from "../../pagination.js";
export type { PageRequestInput, PageRequestParsed, PageResponse } from "../../pagination.js";

/** The canonical write-callable response: `{ id, created?, deleted? }` (§3.2 DX-11). */
export const SaveResponseSchema = z
  .object({
    id: z.string(),
    created: z.boolean().optional(),
    deleted: z.boolean().optional(),
  })
  .strict();
export type SaveResponse = z.infer<typeof SaveResponseSchema>;

/** Empty request body (`{}`), still `.strict()` so a stray key is rejected. */
export const EmptyRequest = z.object({}).strict();

/** A generic JSON value used by loosely-typed `data` payloads on save callables. */
export const looseRecord = z.record(z.string(), z.unknown());
