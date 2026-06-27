/**
 * `studySessionRepo` — study-log feed for the heatmap/streak UI
 * (SDK-LAYERS-PLAN §4.1, gamification.md §Repositories).
 *
 * Sessions are written server-side by the levelup progress writer from item
 * attempts (client read-only — §6.6); `streakDays`/`longestStreak` are computed
 * server-side from authoritative attempt timestamps, never the client clock. The
 * repo reads the range and shapes a dense `IsoDate → intensity` map for the
 * calendar heatmap (fills gaps, normalizes intensity 0..1).
 *
 *   • `list(range?)` → `listStudySessions` (already returns streak counters).
 *   • `computeHeatmap(sessions)` → dense `IsoDate → intensity` map (computed once).
 *
 * Per-entity repo — `api` + `@levelup/domain` only; never a sibling repo (R6).
 */
import type { IsoDate, StudySession } from "@levelup/domain";
import type {
  ApiClient,
  ListStudySessionsRequest,
  ListStudySessionsResponse,
} from "./api-types.js";

/** A single heatmap cell — the normalized intensity for a calendar day. */
export interface HeatmapCell {
  date: IsoDate;
  /** 0..1 normalized study intensity for the calendar shade. */
  intensity: number;
  minutesStudied: number;
  itemsCompleted: number;
  pointsEarned: number;
}

export interface StudySessionRepo {
  /** Range read; server already computed `streakDays`/`longestStreak`. */
  list(range?: ListStudySessionsRequest): Promise<ListStudySessionsResponse>;
  /**
   * Dense `IsoDate → HeatmapCell` map across the sessions' date span (gaps
   * filled with zero-intensity cells), intensity normalized 0..1 by the busiest
   * day's `minutesStudied`. Computed once so the UI never re-derives shades.
   */
  computeHeatmap(sessions: readonly StudySession[]): Map<IsoDate, HeatmapCell>;
}

const MS_PER_DAY = 86_400_000;

function isoDay(ms: number): IsoDate {
  return new Date(ms).toISOString().slice(0, 10) as IsoDate;
}

export function createStudySessionRepo(api: ApiClient): StudySessionRepo {
  return {
    list: (range) => api.levelup.listStudySessions({ ...range }),

    computeHeatmap: (sessions) => {
      const out = new Map<IsoDate, HeatmapCell>();
      if (sessions.length === 0) return out;

      // Index real sessions by day + find the span + peak for normalization.
      const byDay = new Map<string, StudySession>();
      let minMs = Number.POSITIVE_INFINITY;
      let maxMs = Number.NEGATIVE_INFINITY;
      let peakMinutes = 0;
      for (const s of sessions) {
        byDay.set(s.date, s);
        const ms = Date.parse(`${s.date}T00:00:00.000Z`);
        if (!Number.isNaN(ms)) {
          if (ms < minMs) minMs = ms;
          if (ms > maxMs) maxMs = ms;
        }
        if (s.minutesStudied > peakMinutes) peakMinutes = s.minutesStudied;
      }
      if (!Number.isFinite(minMs) || !Number.isFinite(maxMs)) return out;

      // Walk every calendar day in the span; fill gaps with zero cells.
      for (let ms = minMs; ms <= maxMs; ms += MS_PER_DAY) {
        const date = isoDay(ms);
        const s = byDay.get(date);
        const minutes = s?.minutesStudied ?? 0;
        out.set(date, {
          date,
          intensity: peakMinutes > 0 ? minutes / peakMinutes : 0,
          minutesStudied: minutes,
          itemsCompleted: s?.itemsCompleted ?? 0,
          pointsEarned: s?.pointsEarned ?? 0,
        });
      }
      return out;
    },
  };
}
