import { describe, expect, it } from "vitest";
import { analyticsQueryKeys } from "./keys.js";

describe("space analytics query key", () => {
  it("is stable, tenant-implicit, and isolated per space", () => {
    const first = analyticsQueryKeys.spaceAnalytics("space-1");
    expect(first).toEqual(analyticsQueryKeys.spaceAnalytics("space-1"));
    expect(first).not.toEqual(analyticsQueryKeys.spaceAnalytics("space-2"));
    expect(JSON.stringify(first)).not.toContain("tenant");
  });
});
