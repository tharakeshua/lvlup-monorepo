/**
 * Gamification's opaque-cursor pagination view (SDK-LAYERS-PLAN §4.1, §3.5).
 *
 * Re-exports the shared `paginate`/`listOnce`/`PageBag` from the canonical
 * implementation (testsession-progress/paginate.ts) so every domain threads the
 * `nextCursor` VERBATIM and never parses/derives it client-side. Kept as a thin
 * local barrel so the gamification repos import from a sibling module within
 * their own domain folder (R6 — no cross-repo import; pagination is a shared kit,
 * not a repo).
 */
export { paginate, listOnce, type PageBag, type Paged } from "../testsession-progress/paginate.js";
