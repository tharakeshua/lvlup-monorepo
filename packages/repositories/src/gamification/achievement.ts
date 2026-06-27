/**
 * `achievementRepo` — badge *definitions* catalog + caller unlock-state +
 * mark-seen (SDK-LAYERS-PLAN §4.1, gamification.md §Repositories).
 *
 * Achievements are server-authoritative: unlocks are monotonic, server-only; the
 * SDK only reads the definition catalog (joined with the caller's earned-state by
 * the server — collapsing the UI N+1) and the caller's own unlock records, and
 * may flip `seen` (the mark-read pattern, on the conservative optimistic
 * allow-list owned by the query layer).
 *
 *   • `listCatalog(filter?)` → paginate `listAchievements` (definitions ⨯ earned).
 *   • `listEarned(opts?)`    → paginate `listStudentAchievements` (unlock records).
 *   • `markSeen(ids | { all })` → `markAchievementsSeen`.
 *   • `saveDefinition(input)` → `saveAchievementDefinition` (tenant-admin authoring).
 *   • Shaping/derived: `computeByCategory`, `computeUnseenCount` — computed once so the UI
 *     never recomputes them.
 *
 * Per-entity repo — `api` + `@levelup/domain` only; never a sibling repo (R6).
 */
import type { AchievementCategory, StudentAchievement } from "@levelup/domain";
import type {
  AchievementWithEarnedState,
  ApiClient,
  ListAchievementsRequest,
  ListStudentAchievementsRequest,
  MarkAchievementsSeenRequest,
  MarkAchievementsSeenResponse,
  PageResponse,
  SaveAchievementDefinitionRequest,
  SaveResponse,
} from "./api-types.js";
import { listOnce, paginate, type PageBag } from "./paginate.js";

/** View-model grouping for the badge wall — definitions bucketed by category. */
export type AchievementsByCategory = Record<AchievementCategory, AchievementWithEarnedState[]>;

export interface AchievementRepo {
  /** ONE wire call for this filter+cursor; surfaces the page envelope unchanged. */
  listCatalog(filter?: ListAchievementsRequest): Promise<PageResponse<AchievementWithEarnedState>>;
  /** Cursor-managing walker over the catalog (opaque cursor threaded forward). */
  paginateCatalog(filter?: ListAchievementsRequest): Promise<PageBag<AchievementWithEarnedState>>;

  /** ONE wire call for this filter+cursor over the caller's unlock records. */
  listEarned(opts?: ListStudentAchievementsRequest): Promise<PageResponse<StudentAchievement>>;
  /** Cursor-managing walker over unlock records. */
  paginateEarned(opts?: ListStudentAchievementsRequest): Promise<PageBag<StudentAchievement>>;

  /** Flip `seen` on specific unlocks or all of the caller's (mark-read). */
  markSeen(input: MarkAchievementsSeenRequest): Promise<MarkAchievementsSeenResponse>;

  /** Tenant-admin upsert of a badge template (authoring; not a student write). */
  saveDefinition(
    input: SaveAchievementDefinitionRequest
  ): Promise<SaveResponse<AchievementWithEarnedState["id"]>>;

  /** Derived: bucket the catalog by category for the badge wall (computed once). */
  computeByCategory(catalog: readonly AchievementWithEarnedState[]): AchievementsByCategory;

  /** Derived: count of unseen unlocks the UI should NOT recompute. */
  computeUnseenCount(earned: readonly StudentAchievement[]): number;
}

export function createAchievementRepo(api: ApiClient): AchievementRepo {
  return {
    listCatalog: (filter) => listOnce((req) => api.levelup.listAchievements(req), { ...filter }),
    paginateCatalog: (filter) =>
      paginate((req) => api.levelup.listAchievements(req), { ...filter }),

    listEarned: (opts) => listOnce((req) => api.levelup.listStudentAchievements(req), { ...opts }),
    paginateEarned: (opts) =>
      paginate((req) => api.levelup.listStudentAchievements(req), { ...opts }),

    markSeen: (input) => api.levelup.markAchievementsSeen(input),

    saveDefinition: (input) => api.levelup.saveAchievementDefinition(input),

    computeByCategory: (catalog) => {
      const out = {} as AchievementsByCategory;
      for (const a of catalog) {
        (out[a.category] ??= []).push(a);
      }
      return out;
    },

    computeUnseenCount: (earned) => {
      let n = 0;
      for (const e of earned) if (!e.seen) n += 1;
      return n;
    },
  };
}
