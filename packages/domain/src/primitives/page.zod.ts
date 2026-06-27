import { z } from "zod";
import { zObject } from "../authoring/strict.js";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "./page.js";
import type { Cursor } from "./page.js";

export const zCursor = z.string().transform((s) => s as Cursor);

export const zPageParams = zObject({
  cursor: zCursor.optional(),
  limit: z.number().int().min(1).max(MAX_PAGE_LIMIT).default(DEFAULT_PAGE_LIMIT),
});

export const zPage = <T extends z.ZodTypeAny>(item: T) =>
  zObject({
    items: z.array(item),
    nextCursor: zCursor.nullable(),
    total: z.number().int().optional(),
  });
