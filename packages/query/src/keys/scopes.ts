/**
 * Answer-key cache isolation (query-infra.md §4.3, REVIEW §6.4, open-Q 7.1.3).
 *
 * Editor items carry re-merged answer keys (`getItemForEdit`). These MUST NOT
 * land in the shared, persistable cache, and MUST be excluded from any future
 * offline store. They live under their OWN scope root (`'items:edit'`), NOT the
 * `'items'` domain root, so a bulk `items` invalidation can never touch — or
 * leak — them.
 *
 * The canonical source of these helpers is `@levelup/repositories` (so the same
 * predicate the offline persister uses is shared). We re-export them here for
 * `@levelup/query` consumers and the offline `dehydrate` filter.
 */
export { EDIT_ITEM_SCOPE, editItemKey, isSensitiveKey } from "@levelup/repositories";
