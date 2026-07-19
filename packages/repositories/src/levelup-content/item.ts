/**
 * itemRepo (SDK-LAYERS-PLAN §4.1, levelup-content.md).
 *
 *   list(spaceId,storyPointId)  — listItems (paginated, ANSWER-STRIPPED)
 *   getForEdit(input)           — authoring-only; returns the re-merged item AND
 *                                 the isolated non-persisted cache key so answer
 *                                 keys never leak into a shared/offline store
 *                                 (§4.2 / SDK-SERVER §7.1.3)
 *   save(input)                 — maps ergonomic delete to data.deleted
 *   saveFromBank(input)         — idempotent bank → items (the `importFromBank`
 *                                 callable; named with the sanctioned `save*` IO
 *                                 prefix per the method-naming convention)
 */
import {
  type ApiClientLike,
  type Page,
  type PageBag,
  EDIT_ITEM_SCOPE,
  editItemKey,
  invokeCallable,
  makePaginator,
  toPage,
} from "./_kit";
import type { ReqOf, ResOf } from "@levelup/api-contract";
import type { UnifiedItem } from "@levelup/domain";

type ListItemsRequest = ReqOf<"v1.levelup.listItems">;
export type ItemFilter = Omit<ListItemsRequest, "limit"> & {
  limit?: ListItemsRequest["limit"];
};

export type SaveItemInput = ReqOf<"v1.levelup.saveItem"> & {
  /** Ergonomic soft-delete flag; mapped to the canonical data.deleted field. */
  delete?: boolean;
};

export type GetForEditInput = ReqOf<"v1.levelup.getItemForEdit">;

/** The authoring read result, carrying the isolated (sensitive) cache key. */
export interface ItemEditResult {
  item: ResOf<"v1.levelup.getItemForEdit">["item"];
  /** Non-persisted, answer-key-isolated cache key (§4.2). */
  cacheKey: readonly unknown[];
}

export type ImportFromBankInput = ReqOf<"v1.levelup.importFromBank">;

export interface ItemRepo {
  list(filter: ItemFilter): Promise<Page<UnifiedItem>>;
  paginate(filter: ItemFilter): Promise<PageBag<UnifiedItem>>;
  getForEdit(input: GetForEditInput): Promise<ItemEditResult>;
  save(input: SaveItemInput): Promise<ResOf<"v1.levelup.saveItem">>;
  saveFromBank(input: ImportFromBankInput): Promise<ResOf<"v1.levelup.importFromBank">>;
}

export function createItemRepo(api: ApiClientLike): ItemRepo {
  const lv = api.levelup;
  return {
    list: (filter) =>
      invokeCallable<"v1.levelup.listItems">(lv["listItems"]!, {
        ...filter,
        limit: filter.limit ?? 20,
      }).then((r) => toPage<UnifiedItem>(r)),
    paginate: (filter) =>
      makePaginator<UnifiedItem, ItemFilter>(
        (req) =>
          invokeCallable<"v1.levelup.listItems">(lv["listItems"]!, {
            ...req,
            limit: req.limit ?? 20,
          }),
        { ...filter, limit: filter.limit ?? 20 }
      ),
    getForEdit: async (input) => {
      // ⚷ authoring-only — re-merges the AnswerKey server-side. We never persist
      // this under a shared key; the caller binds it to `editItemKey(itemId)`
      // (gcTime:0/staleTime:0) so answer keys cannot leak into offline cache.
      const response = await invokeCallable<"v1.levelup.getItemForEdit">(
        lv["getItemForEdit"]!,
        input
      );
      return { item: response.item, cacheKey: editItemKey(input.itemId) };
    },
    save: ({ delete: shouldDelete, ...input }) =>
      invokeCallable<"v1.levelup.saveItem">(lv["saveItem"]!, {
        ...input,
        data: { ...input.data, ...(shouldDelete ? { deleted: true } : {}) },
      }),
    saveFromBank: (input) =>
      invokeCallable<"v1.levelup.importFromBank">(lv["importFromBank"]!, input),
  };
}

/** Re-exported so the public surface exposes the answer-key scope helpers (§4.2). */
export { EDIT_ITEM_SCOPE };
