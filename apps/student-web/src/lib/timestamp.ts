import { toMillis, toTimestamp, type TimestampInput } from "@levelup/domain";

/** Canonical schedule shape from sdk-v1 views; legacy docs may use startAt/endAt. */
export type AssessmentScheduleLike = {
  opensAt?: unknown;
  closesAt?: unknown;
  startAt?: unknown;
  endAt?: unknown;
};

/** Collapse Firestore / ISO / epoch inputs to epoch millis (null when missing). */
export function timestampInputToMillis(value: unknown): number | null {
  if (value == null) return null;
  try {
    const ts = toTimestamp(value as TimestampInput);
    return ts != null ? toMillis(ts) : null;
  } catch {
    return null;
  }
}

/** Read schedule window bounds supporting canonical opensAt/closesAt and legacy startAt/endAt. */
export function assessmentScheduleBounds(schedule: AssessmentScheduleLike | null | undefined): {
  startMs: number | null;
  endMs: number | null;
} {
  if (!schedule) return { startMs: null, endMs: null };
  return {
    startMs: timestampInputToMillis(schedule.opensAt ?? schedule.startAt),
    endMs: timestampInputToMillis(schedule.closesAt ?? schedule.endAt),
  };
}
