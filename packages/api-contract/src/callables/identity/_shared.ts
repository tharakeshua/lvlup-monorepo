/**
 * Identity-module contract kit.
 *
 * Re-exports the CORE authoring surface (`defineCallable`, `CallableDef`, the
 * pagination fragment — all owned by the stable src-root core files
 * `callable-def.ts` + `pagination.ts`) so every identity def authors against ONE
 * canonical helper set. `SaveResponseSchema`/`SaveResponse` are re-exported from
 * the single canonical home (`callables/core/_shared`) — NOT re-declared here
 * (DP-1: collapse the intra-contract dup). `EmptyRequest`/`looseRecord` stay
 * module-local (no canonical twin).
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

/** The canonical write-callable response — single home in `callables/core/_shared`. */
export { SaveResponseSchema } from "../core/_shared.js";
export type { SaveResponse } from "../core/_shared.js";

/** Empty request body (`{}`), still `.strict()` so a stray key is rejected. */
export const EmptyRequest = z.object({}).strict();

/** A generic JSON value used by loosely-typed `data` payloads on save callables. */
export const looseRecord = z.record(z.string(), z.unknown());
