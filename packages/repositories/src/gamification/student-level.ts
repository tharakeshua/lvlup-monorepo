/**
 * `studentLevelRepo` — XP / level summary (SDK-LAYERS-PLAN §4.1,
 * gamification.md §Repositories).
 *
 * `StudentLevel` is wholly server-authoritative (level/XP/tier/achievementCount
 * are trigger-maintained counters — §6.9). The SDK only reads it; the only value
 * the repo adds is the derived `computeProgressToNext` XP-bar fraction so the UI never
 * recomputes it.
 *
 *   • `get(userId?)` → `getStudentLevel` (omit ⇒ self; parent/teacher may pass a
 *     child/student userId, server authorizes).
 *   • `computeProgressToNext(level)` → `currentXP / (currentXP + xpToNextLevel)` clamped
 *     to 0..1 (derived; UI never recomputes the bar fraction).
 *
 * Per-entity repo — `api` + `@levelup/domain` only; never a sibling repo (R6).
 */
import type { StudentLevel, UserId } from "@levelup/domain";
import type { ApiClient } from "./api-types.js";

export interface StudentLevelRepo {
  get(userId?: UserId): Promise<StudentLevel>;
  /** Derived 0..1 XP-bar fraction (clamped); UI never recomputes it. */
  computeProgressToNext(level: Pick<StudentLevel, "currentXP" | "xpToNextLevel">): number;
}

export function createStudentLevelRepo(api: ApiClient): StudentLevelRepo {
  return {
    get: (userId) => api.levelup.getStudentLevel({ userId }),

    computeProgressToNext: (level) => {
      const denom = level.currentXP + level.xpToNextLevel;
      if (denom <= 0) return 0;
      const frac = level.currentXP / denom;
      return frac < 0 ? 0 : frac > 1 ? 1 : frac;
    },
  };
}
