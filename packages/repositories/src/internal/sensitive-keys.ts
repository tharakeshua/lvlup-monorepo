/**
 * Answer-key editor cache-scope isolation (SDK-LAYERS-PLAN §4.2, repositories.md
 * (5), §6.4/§6.7).
 *
 * `getItemForEdit` re-merges the ⚷ answer-key onto the authoring item. That data
 * must NEVER reach a persisted/offline store. The query layer scopes it under a
 * dedicated, non-persisted key prefix; `isSensitiveKey` is the predicate the
 * persisted-cache filter consults so the editor cache is excluded.
 *
 * `EDIT_ITEM_SCOPE` is the single scope tag; `editItemKey(itemId)` builds the
 * `[EDIT_ITEM_SCOPE, itemId]` key both here and in `@levelup/query` so the
 * isolation rule has one definition.
 */

/** The cache-scope tag that marks the answer-key editor cache as non-persisted. */
export const EDIT_ITEM_SCOPE = "__edit_item__" as const;

/** The query key for an authoring (answer-key-bearing) item — always sensitive. */
export function editItemKey(itemId: string): readonly [typeof EDIT_ITEM_SCOPE, string] {
  return [EDIT_ITEM_SCOPE, itemId];
}

/**
 * Is this query key sensitive (must be excluded from the persisted/offline
 * store)? True iff it is scoped under `EDIT_ITEM_SCOPE`. Normal keys are false.
 */
export function isSensitiveKey(key: readonly unknown[]): boolean {
  return Array.isArray(key) && key[0] === EDIT_ITEM_SCOPE;
}
