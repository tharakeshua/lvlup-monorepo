/** `mutation/` barrel — the recipe framework + closed optimistic recipes. */
export { defineMutation } from "./define-mutation.js";
export {
  isAuthoritySensitive,
  isOptimisticAllowed,
  OPTIMISTIC_ALLOWLIST,
  OPTIMISTIC_COUNTER_ALLOWLIST,
} from "./authority.js";
export { appendToList, patchDetail, decrementBadge, incrementCounter } from "./recipes/index.js";
export { snapshot, restore, type Snapshot } from "./optimistic.js";
export type { MutationSpec, MutationKind, OptimisticConfig, OptimisticClient } from "./types.js";
