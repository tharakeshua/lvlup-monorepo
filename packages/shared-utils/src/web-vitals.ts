/**
 * Web Vitals reporting utility.
 * Tracks Core Web Vitals (LCP, FID, CLS) and supplementary metrics (FCP, TTFB)
 * using the web-vitals library and logs them in production.
 */

type WebVitalMetric = {
  name: string;
  value: number;
  rating: "good" | "needs-improvement" | "poor";
  delta: number;
  id: string;
  navigationType: string;
};

type ReportHandler = (metric: WebVitalMetric) => void;

const defaultHandler: ReportHandler = (metric) => {
  // Log to console in development, send to analytics in production
  if ((import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV) {
    const color =
      metric.rating === "good"
        ? "#0cce6b"
        : metric.rating === "needs-improvement"
          ? "#ffa400"
          : "#ff4e42";
    console.log(
      `%c[Web Vitals] ${metric.name}: ${Math.round(metric.value)}ms (${metric.rating})`,
      `color: ${color}; font-weight: bold;`
    );
  }
};

/**
 * Report Web Vitals using the Performance Observer API.
 * Falls back gracefully if PerformanceObserver is not available.
 */
export function reportWebVitals(onReport?: ReportHandler): void {
  const handler = onReport ?? defaultHandler;

  if (typeof window === "undefined" || typeof PerformanceObserver === "undefined") {
    return;
  }

  // First Contentful Paint (FCP)
  try {
    const fcpObserver = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        if (entry.name === "first-contentful-paint") {
          handler({
            name: "FCP",
            value: entry.startTime,
            rating:
              entry.startTime < 1800
                ? "good"
                : entry.startTime < 3000
                  ? "needs-improvement"
                  : "poor",
            delta: entry.startTime,
            id: `fcp-${Date.now()}`,
            navigationType: getNavigationType(),
          });
          fcpObserver.disconnect();
        }
      }
    });
    fcpObserver.observe({ type: "paint", buffered: true });
  } catch {
    // PerformanceObserver not supported for this entry type
  }

  // Largest Contentful Paint (LCP)
  try {
    const lcpObserver = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      const lastEntry = entries[entries.length - 1];
      if (lastEntry) {
        const value = lastEntry.startTime;
        handler({
          name: "LCP",
          value,
          rating: value < 2500 ? "good" : value < 4000 ? "needs-improvement" : "poor",
          delta: value,
          id: `lcp-${Date.now()}`,
          navigationType: getNavigationType(),
        });
      }
    });
    lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });

    // Disconnect on page hide to capture final LCP
    document.addEventListener(
      "visibilitychange",
      () => {
        if (document.visibilityState === "hidden") {
          lcpObserver.takeRecords();
          lcpObserver.disconnect();
        }
      },
      { once: true }
    );
  } catch {
    // LCP not supported
  }

  // Cumulative Layout Shift (CLS)
  try {
    let clsValue = 0;
    let sessionValue = 0;
    let sessionEntries: PerformanceEntry[] = [];

    const clsObserver = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        const layoutShift = entry as PerformanceEntry & { hadRecentInput: boolean; value: number };
        if (!layoutShift.hadRecentInput) {
          const firstSessionEntry = sessionEntries[0];
          const lastSessionEntry = sessionEntries[sessionEntries.length - 1];

          if (
            sessionValue &&
            firstSessionEntry &&
            lastSessionEntry &&
            entry.startTime - lastSessionEntry.startTime < 1000 &&
            entry.startTime - firstSessionEntry.startTime < 5000
          ) {
            sessionValue += layoutShift.value;
            sessionEntries.push(entry);
          } else {
            sessionValue = layoutShift.value;
            sessionEntries = [entry];
          }

          if (sessionValue > clsValue) {
            clsValue = sessionValue;
          }
        }
      }
    });
    clsObserver.observe({ type: "layout-shift", buffered: true });

    document.addEventListener(
      "visibilitychange",
      () => {
        if (document.visibilityState === "hidden") {
          clsObserver.takeRecords();
          clsObserver.disconnect();
          handler({
            name: "CLS",
            value: clsValue,
            rating: clsValue < 0.1 ? "good" : clsValue < 0.25 ? "needs-improvement" : "poor",
            delta: clsValue,
            id: `cls-${Date.now()}`,
            navigationType: getNavigationType(),
          });
        }
      },
      { once: true }
    );
  } catch {
    // CLS not supported
  }

  // First Input Delay (FID) / Interaction to Next Paint (INP)
  try {
    const fidObserver = new PerformanceObserver((entryList) => {
      const firstInput = entryList.getEntries()[0] as PerformanceEntry & {
        processingStart: number;
      };
      if (firstInput) {
        const value = firstInput.processingStart - firstInput.startTime;
        handler({
          name: "FID",
          value,
          rating: value < 100 ? "good" : value < 300 ? "needs-improvement" : "poor",
          delta: value,
          id: `fid-${Date.now()}`,
          navigationType: getNavigationType(),
        });
        fidObserver.disconnect();
      }
    });
    fidObserver.observe({ type: "first-input", buffered: true });
  } catch {
    // FID not supported
  }

  // Time to First Byte (TTFB)
  try {
    const navEntries = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
    if (navEntries.length > 0) {
      const nav = navEntries[0]!;
      const value = nav.responseStart - nav.requestStart;
      handler({
        name: "TTFB",
        value,
        rating: value < 800 ? "good" : value < 1800 ? "needs-improvement" : "poor",
        delta: value,
        id: `ttfb-${Date.now()}`,
        navigationType: getNavigationType(),
      });
    }
  } catch {
    // Navigation timing not supported
  }
}

function getNavigationType(): string {
  const nav = performance.getEntriesByType("navigation")[0] as
    | PerformanceNavigationTiming
    | undefined;
  return nav?.type ?? "navigate";
}

export type { WebVitalMetric, ReportHandler };
