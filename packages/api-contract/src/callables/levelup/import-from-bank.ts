/**
 * v1.levelup.importFromBank — materialize bank items into a story point as Items.
 * Idempotent (server dedupes; the UUIDv7 rides the api-client envelope).
 */
import { z } from "zod";
import { defineCallable } from "./_shared.js";
import { zItemType } from "./_shared.js";

export const ImportFromBankRequestSchema = z
  .object({
    spaceId: z.string(),
    storyPointId: z.string(),
    bankItemIds: z.array(z.string()).min(1),
    targetType: zItemType.optional(),
  })
  .strict();
export type ImportFromBankRequest = z.infer<typeof ImportFromBankRequestSchema>;

export const ImportFromBankResponseSchema = z
  .object({ createdItemIds: z.array(z.string()) })
  .strict();
export type ImportFromBankResponse = z.infer<typeof ImportFromBankResponseSchema>;

export const importFromBankDef = defineCallable<ImportFromBankRequest, ImportFromBankResponse>({
  name: "v1.levelup.importFromBank",
  module: "levelup",
  requestSchema: ImportFromBankRequestSchema,
  responseSchema: ImportFromBankResponseSchema,
  authMode: "authed",
  rateTier: "write",
  idempotent: true,
  invalidates: ["items"],
});
