/**
 * Core-owned shared response fragments for the per-module callable defs
 * (SDK-LAYERS-PLAN §3.2). The module `_shared` files re-export `SaveResponse`
 * from here so the canonical upsert response shape lives in ONE place.
 */
import { z } from "zod";

/** The canonical write-callable response: `{ id, created? }` (upsert convention). */
export const SaveResponseSchema = z
  .object({
    id: z.string(),
    created: z.boolean().optional(),
    deleted: z.boolean().optional(),
  })
  .strict();
export type SaveResponse = z.infer<typeof SaveResponseSchema>;
