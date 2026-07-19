import { describe, it, expect, vi } from "vitest";
import { estimateCost, buildTokenUsage, getSupportedModels } from "../ai/cost-tracker";

describe("cost-tracker", () => {
  // ---------------------------------------------------------------------------
  // buildTokenUsage
  // ---------------------------------------------------------------------------
  describe("buildTokenUsage", () => {
    it("builds token usage with correct totals", () => {
      const usage = buildTokenUsage(100, 50);
      expect(usage.input).toBe(100);
      expect(usage.output).toBe(50);
      expect(usage.total).toBe(150);
    });

    it("handles zero tokens", () => {
      const usage = buildTokenUsage(0, 0);
      expect(usage.total).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // estimateCost
  // ---------------------------------------------------------------------------
  describe("estimateCost", () => {
    it("calculates cost for gemini-2.5-flash", () => {
      const tokens = buildTokenUsage(1_000_000, 1_000_000);
      const cost = estimateCost("gemini-2.5-flash", tokens);
      expect(cost.input).toBeCloseTo(0.15, 4);
      expect(cost.output).toBeCloseTo(0.6, 4);
      expect(cost.total).toBeCloseTo(0.75, 4);
      expect(cost.currency).toBe("USD");
    });

    it("calculates cost for gemini-2.5-pro", () => {
      const tokens = buildTokenUsage(1_000_000, 1_000_000);
      const cost = estimateCost("gemini-2.5-pro", tokens);
      expect(cost.input).toBeCloseTo(1.25, 4);
      expect(cost.output).toBeCloseTo(5.0, 4);
    });

    it("returns zero cost for zero tokens", () => {
      const tokens = buildTokenUsage(0, 0);
      const cost = estimateCost("gemini-2.5-flash", tokens);
      expect(cost.total).toBe(0);
    });

    it("uses fallback pricing for unknown model", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const tokens = buildTokenUsage(1_000_000, 1_000_000);
      const cost = estimateCost("unknown-model", tokens);
      // Fallback: 1.25 input, 5.00 output
      expect(cost.input).toBeCloseTo(1.25, 4);
      expect(cost.output).toBeCloseTo(5.0, 4);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Unknown model"));
      consoleSpy.mockRestore();
    });
  });

  // ---------------------------------------------------------------------------
  // getSupportedModels
  // ---------------------------------------------------------------------------
  describe("getSupportedModels", () => {
    it("returns an array of model names", () => {
      const models = getSupportedModels();
      expect(models).toContain("gemini-2.5-flash");
      expect(models).toContain("gemini-2.5-pro");
      expect(models.length).toBeGreaterThanOrEqual(4);
    });
  });
});
