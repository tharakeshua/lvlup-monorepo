/** `keys/` barrel — factories, registry, named factories, sensitive scopes. */
export { createKeyFactory } from "./key-factory.js";
export * from "./registry.js";
export { EDIT_ITEM_SCOPE, editItemKey, isSensitiveKey } from "./scopes.js";
export type {
  DomainName,
  KeyFactory,
  KeyRoot,
  QueryKey,
  AnyQueryKey,
  DomainKeys,
} from "./types.js";
