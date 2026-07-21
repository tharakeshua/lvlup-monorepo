import { describe, expect, it } from "vitest";
import { assessmentScheduleBounds, timestampInputToMillis } from "./timestamp";

describe("timestampInputToMillis", () => {
  it("parses canonical ISO deadlines from sdk-v1", () => {
    expect(timestampInputToMillis("2026-01-01T00:30:00.000Z")).toBe(
      Date.parse("2026-01-01T00:30:00.000Z")
    );
  });

  it("parses legacy Firestore Timestamp duck shapes", () => {
    expect(timestampInputToMillis({ seconds: 1_700_000_000, nanoseconds: 0 })).toBe(
      1_700_000_000_000
    );
  });

  it("returns null for missing values", () => {
    expect(timestampInputToMillis(null)).toBeNull();
    expect(timestampInputToMillis(undefined)).toBeNull();
  });
});

describe("assessmentScheduleBounds", () => {
  it("prefers opensAt/closesAt but accepts legacy startAt/endAt", () => {
    const canonical = assessmentScheduleBounds({
      opensAt: "2026-06-01T09:00:00.000Z",
      closesAt: "2026-06-01T10:00:00.000Z",
    });
    expect(canonical.startMs).toBe(Date.parse("2026-06-01T09:00:00.000Z"));
    expect(canonical.endMs).toBe(Date.parse("2026-06-01T10:00:00.000Z"));

    const legacy = assessmentScheduleBounds({
      startAt: { seconds: 1_700_000_000, nanoseconds: 0 },
      endAt: { seconds: 1_700_003_600, nanoseconds: 0 },
    });
    expect(legacy.startMs).toBe(1_700_000_000_000);
    expect(legacy.endMs).toBe(1_700_003_600_000);
  });
});
