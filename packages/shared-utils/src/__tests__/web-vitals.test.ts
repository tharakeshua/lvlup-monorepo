import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

let observerCallbacks: Map<string, (entryList: any) => void>;
let observeCalls: Array<{ type: string; buffered?: boolean }>;

function setupBrowserMocks() {
  observerCallbacks = new Map();
  observeCalls = [];

  class MockPerformanceObserver {
    private callback: (entryList: any) => void;

    constructor(callback: (entryList: any) => void) {
      this.callback = callback;
    }

    observe(opts: { type: string; buffered?: boolean }) {
      observerCallbacks.set(opts.type, this.callback);
      observeCalls.push(opts);
    }

    disconnect() {}
    takeRecords() {}
  }

  vi.stubGlobal("window", {});
  vi.stubGlobal("PerformanceObserver", MockPerformanceObserver);
  vi.stubGlobal("document", {
    addEventListener: vi.fn(),
    visibilityState: "visible",
  });
  vi.stubGlobal("performance", {
    getEntriesByType: vi.fn(() => []),
  });
}

describe("web-vitals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    observerCallbacks = new Map();
    observeCalls = [];
  });

  it("returns early when window is undefined (SSR)", async () => {
    vi.stubGlobal("window", undefined);

    const { reportWebVitals } = await import("../web-vitals");
    const handler = vi.fn();

    reportWebVitals(handler);

    expect(handler).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it("returns early when PerformanceObserver is undefined", async () => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("PerformanceObserver", undefined);

    const { reportWebVitals } = await import("../web-vitals");
    const handler = vi.fn();

    reportWebVitals(handler);

    expect(handler).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it("observes FCP with paint entry type", async () => {
    setupBrowserMocks();

    const { reportWebVitals } = await import("../web-vitals");
    reportWebVitals(vi.fn());

    const paintCall = observeCalls.find((c) => c.type === "paint");
    expect(paintCall).toBeDefined();
    expect(paintCall!.buffered).toBe(true);

    vi.unstubAllGlobals();
  });

  it("observes LCP with largest-contentful-paint type", async () => {
    setupBrowserMocks();

    const { reportWebVitals } = await import("../web-vitals");
    reportWebVitals(vi.fn());

    const lcpCall = observeCalls.find((c) => c.type === "largest-contentful-paint");
    expect(lcpCall).toBeDefined();
    expect(lcpCall!.buffered).toBe(true);

    vi.unstubAllGlobals();
  });

  it("observes CLS with layout-shift type", async () => {
    setupBrowserMocks();

    const { reportWebVitals } = await import("../web-vitals");
    reportWebVitals(vi.fn());

    const clsCall = observeCalls.find((c) => c.type === "layout-shift");
    expect(clsCall).toBeDefined();
    expect(clsCall!.buffered).toBe(true);

    vi.unstubAllGlobals();
  });

  it("observes FID with first-input type", async () => {
    setupBrowserMocks();

    const { reportWebVitals } = await import("../web-vitals");
    reportWebVitals(vi.fn());

    const fidCall = observeCalls.find((c) => c.type === "first-input");
    expect(fidCall).toBeDefined();
    expect(fidCall!.buffered).toBe(true);

    vi.unstubAllGlobals();
  });

  it("reports TTFB from navigation timing entries", async () => {
    setupBrowserMocks();
    vi.stubGlobal("performance", {
      getEntriesByType: vi.fn((type: string) => {
        if (type === "navigation") {
          return [{ requestStart: 100, responseStart: 350, type: "navigate" }];
        }
        return [];
      }),
    });

    const { reportWebVitals } = await import("../web-vitals");
    const handler = vi.fn();

    reportWebVitals(handler);

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "TTFB",
        value: 250,
        rating: "good",
      })
    );

    vi.unstubAllGlobals();
  });

  it("reports correct FCP rating thresholds", async () => {
    setupBrowserMocks();

    const { reportWebVitals } = await import("../web-vitals");
    const handler = vi.fn();

    reportWebVitals(handler);

    // Simulate FCP observer callback with a value below 1800ms (good)
    const fcpCallback = observerCallbacks.get("paint");
    expect(fcpCallback).toBeDefined();

    fcpCallback!({
      getEntries: () => [{ name: "first-contentful-paint", startTime: 1500 }],
    });

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "FCP",
        value: 1500,
        rating: "good",
      })
    );

    // Test needs-improvement threshold (1800-3000)
    handler.mockClear();
    fcpCallback!({
      getEntries: () => [{ name: "first-contentful-paint", startTime: 2500 }],
    });

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "FCP",
        value: 2500,
        rating: "needs-improvement",
      })
    );

    vi.unstubAllGlobals();
  });
});
