/** `invalidation/` barrel. */
export { INVALIDATION_GRAPH } from "./graph.js";
export { invalidateForCallable } from "./invalidate.js";
export type { InvalidatingClient } from "./invalidate.js";
export { buildGraphFromContract } from "./derive-from-contract.js";
export type { InvalidationRule, FanoutResolver } from "./types.js";
