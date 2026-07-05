/**
 * `studyGoalRepo` — the ONE client-CRUD gamification entity (planner targets)
 * (SDK-LAYERS-PLAN §4.1, gamification.md §Repositories).
 *
 * The client owns `title/description/targetType/targetCount/startDate/endDate`;
 * the server owns the derived `currentCount/completed/completedAt` (projected
 * from progress — §6.9). The save request therefore carries client-owned fields
 * ONLY (`.strict()` rejects the rest). `archive(id)` is soft-delete sugar over
 * `save({ deleted: true })` (D5 single soft-delete convention).
 *
 *   • `list(opts?)` → paginate `listStudyGoals`.
 *   • `save(input)` → `saveStudyGoal` (no id ⇒ create).
 *   • `archive(id)` → `save({ id, data: { deleted: true } })`.
 *   • Derived: `computeProgressPct`, `computeDaysRemaining`, `isOverdue`.
 *   • Pre-check: `canEdit(goal)` = `!archivedAt && !completed` (UX disable; the
 *     server still enforces — there is NO client transition for this domain, so
 *     no ALLOWED_TRANSITIONS entry exists to consult; see gamification.md
 *     §ALLOWED_TRANSITIONS).
 *
 * `archive` needs the original goal's client-owned fields to re-send them with
 * `deleted: true` (the `.strict()` save schema requires the full client slice),
 * so it takes the `StudyGoal` and projects them. Per-entity repo — `api` +
 * `@levelup/domain` only; never a sibling repo (R6).
 */
import type { StudyGoal } from "@levelup/domain";
import type {
  ApiClient,
  ListStudyGoalsRequest,
  PageResponse,
  SaveResponse,
  SaveStudyGoalRequest,
} from "./api-types.js";
import { listOnce, paginate, type PageBag } from "./paginate.js";

export interface StudyGoalRepo {
  /** ONE wire call for this filter+cursor; surfaces the page envelope unchanged. */
  list(opts?: ListStudyGoalsRequest): Promise<PageResponse<StudyGoal>>;
  /** Cursor-managing walker (opaque cursor threaded forward). */
  paginate(opts?: ListStudyGoalsRequest): Promise<PageBag<StudyGoal>>;

  /** Upsert (no id ⇒ create). Client-owned fields only — `.strict()`-guarded. */
  save(input: SaveStudyGoalRequest): Promise<SaveResponse>;

  /** Soft-delete sugar — re-sends the goal's client-owned fields with deleted. */
  archive(goal: StudyGoal): Promise<SaveResponse>;

  /** Derived 0..1 progress fraction (clamped). */
  computeProgressPct(goal: Pick<StudyGoal, "currentCount" | "targetCount">): number;
  /** Derived whole-day count from `endDate` to `now` (negative ⇒ past due). */
  computeDaysRemaining(goal: Pick<StudyGoal, "endDate">, now?: Date): number;
  /** Derived overdue flag (past `endDate` and not yet completed). */
  isOverdue(goal: Pick<StudyGoal, "endDate" | "completed">, now?: Date): boolean;

  /** Pre-check: editable only while not archived and not completed (UX gate). */
  canEdit(goal: Pick<StudyGoal, "archivedAt" | "completed">): boolean;
}

const MS_PER_DAY = 86_400_000;

/** Whole-day delta from `now` to the END of `endDate` (YYYY-MM-DD, UTC). */
function daysUntilEnd(endDate: string, now: Date): number {
  // End-of-day on endDate (exclusive next-midnight) keeps "today" non-negative.
  const end = Date.parse(`${endDate}T23:59:59.999Z`);
  if (Number.isNaN(end)) return 0;
  return Math.ceil((end - now.getTime()) / MS_PER_DAY);
}

export function createStudyGoalRepo(api: ApiClient): StudyGoalRepo {
  return {
    list: (opts) => listOnce((req) => api.levelup.listStudyGoals(req), { ...opts }),
    paginate: (opts) => paginate((req) => api.levelup.listStudyGoals(req), { ...opts }),

    save: (input) => api.levelup.saveStudyGoal(input),

    archive: (goal) =>
      api.levelup.saveStudyGoal({
        id: goal.id,
        data: {
          title: goal.title,
          description: goal.description,
          targetType: goal.targetType,
          targetCount: goal.targetCount,
          startDate: goal.startDate,
          endDate: goal.endDate,
          deleted: true,
        },
      }),

    computeProgressPct: (goal) => {
      if (goal.targetCount <= 0) return 0;
      const frac = goal.currentCount / goal.targetCount;
      return frac < 0 ? 0 : frac > 1 ? 1 : frac;
    },

    computeDaysRemaining: (goal, now = new Date()) => daysUntilEnd(goal.endDate, now),

    isOverdue: (goal, now = new Date()) => !goal.completed && daysUntilEnd(goal.endDate, now) < 0,

    canEdit: (goal) => goal.archivedAt === null && !goal.completed,
  };
}
