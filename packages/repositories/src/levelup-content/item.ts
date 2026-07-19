/**
 * itemRepo (SDK-LAYERS-PLAN §4.1, levelup-content.md).
 *
 *   list(spaceId,storyPointId)  — listItems (paginated, ANSWER-STRIPPED)
 *   get(id)                     — getSpace-scoped item read (answer-stripped)
 *   getForEdit(input)           — authoring-only; returns the re-merged item AND
 *                                 the isolated non-persisted cache key so answer
 *                                 keys never leak into a shared/offline store
 *                                 (§4.2 / SDK-SERVER §7.1.3)
 *   getMany(ids)                — batched
 *   save(input)                 — metadata only; D2: never injects tenantId
 *   saveFromBank(input)         — idempotent bank → items (the `importFromBank`
 *                                 callable; named with the sanctioned `save*` IO
 *                                 prefix per the method-naming convention)
 */
import { ApiError } from "@levelup/api-client";
import {
  type ApiClientLike,
  type Page,
  type PageBag,
  type PageRequest,
  EDIT_ITEM_SCOPE,
  batchGetMany,
  editItemKey,
  makePaginator,
  toPage,
} from "./_kit";

export interface ItemFilter extends PageRequest {
  spaceId: string;
  storyPointId: string;
}

export interface SaveItemInput {
  id?: string;
  spaceId: string;
  storyPointId: string;
  data?: Record<string, unknown>;
  delete?: boolean;
}

export interface GetForEditInput {
  spaceId: string;
  storyPointId: string;
  itemId: string;
}

/** The authoring read result, carrying the isolated (sensitive) cache key. */
export interface ItemEditResult {
  item: unknown;
  /** Non-persisted, answer-key-isolated cache key (§4.2). */
  cacheKey: readonly unknown[];
}

export interface ImportFromBankInput {
  spaceId: string;
  storyPointId: string;
  bankItemIds: string[];
  targetType?: string;
}

export interface ItemRepo {
  list(filter: ItemFilter): Promise<Page<unknown>>;
  paginate(filter: ItemFilter): Promise<PageBag<unknown>>;
  get(input: { spaceId: string; storyPointId: string; itemId: string }): Promise<unknown>;
  getForEdit(input: GetForEditInput): Promise<ItemEditResult>;
  getMany(
    ids: readonly string[],
    scope: { spaceId: string; storyPointId: string }
  ): Promise<unknown[]>;
  save(input: SaveItemInput): Promise<unknown>;
  saveFromBank(input: ImportFromBankInput): Promise<unknown>;
}

export function createItemRepo(api: ApiClientLike): ItemRepo {
  const lv = api.levelup;
  return {
    list: (filter) => lv["listItems"]!(filter).then((r) => toPage(r)),
    paginate: (filter) => makePaginator((req) => lv["listItems"]!(req), filter),
    // No v1.levelup.getItem — answer-stripped reads go through listItems.
    get: async (input) => {
      let cursor: string | undefined;
      for (;;) {
        const page = (await lv["listItems"]!({
          spaceId: input.spaceId,
          storyPointId: input.storyPointId,
          ...(cursor ? { cursor } : {}),
        })) as { items?: Array<{ id?: string }>; nextCursor?: string | null };
        const found = (page.items ?? []).find((i) => i.id === input.itemId);
        if (found) return found;
        if (!page.nextCursor) break;
        cursor = page.nextCursor;
      }
      throw new ApiError({
        code: "NOT_FOUND",
        message: "Item not found",
        meta: { resource: "item", id: input.itemId },
      });
    },
    getForEdit: async (input) => {
      // ⚷ authoring-only — re-merges the AnswerKey server-side. We never persist
      // this under a shared key; the caller binds it to `editItemKey(itemId)`
      // (gcTime:0/staleTime:0) so answer keys cannot leak into offline cache.
      const res = (await lv["getItemForEdit"]!(input)) as { item?: unknown };
      return { item: res?.item ?? res, cacheKey: editItemKey(input.itemId) };
    },
    getMany: (ids, scope) => batchGetMany((req) => lv["listItems"]!(req), ids, scope),
    save: (input) => lv["saveItem"]!(input),
    saveFromBank: (input) => lv["importFromBank"]!(input),
  };
}

/** Re-exported so the public surface exposes the answer-key scope helpers (§4.2). */
export { EDIT_ITEM_SCOPE };
