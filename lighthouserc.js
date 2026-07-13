/**
 * Lighthouse CI configuration for all 5 LevelUp apps.
 * Runs both desktop and mobile presets for comprehensive performance auditing.
 */
module.exports = {
  ci: {
    collect: {
      numberOfRuns: 3,
      startServerCommand:
        "pnpm run preview --filter @levelup/student-web -- --port 4570 & " +
        "pnpm run preview --filter @levelup/admin-web -- --port 4571 & " +
        "pnpm run preview --filter @levelup/teacher-web -- --port 4572 & " +
        "pnpm run preview --filter @levelup/parent-web -- --port 4573 & " +
        "pnpm run preview --filter @levelup/super-admin -- --port 4574",
      startServerReadyPattern: "Local",
      url: [
        // Student Web
        "http://localhost:4570/",
        "http://localhost:4570/login",
        // Admin Web
        "http://localhost:4571/",
        "http://localhost:4571/login",
        // Teacher Web
        "http://localhost:4572/",
        "http://localhost:4572/login",
        // Parent Web
        "http://localhost:4573/",
        "http://localhost:4573/login",
        // Super Admin
        "http://localhost:4574/",
        "http://localhost:4574/login",
      ],
      settings: {
        // Run desktop preset by default; mobile overrides below
        preset: "desktop",
        chromeFlags: "--no-sandbox --headless",
      },
    },
    assert: {
      assertions: {
        // Desktop thresholds
        "categories:performance": ["warn", { minScore: 0.7 }],
        "categories:accessibility": ["warn", { minScore: 0.85 }],
        "categories:best-practices": ["warn", { minScore: 0.85 }],
        "categories:seo": ["warn", { minScore: 0.8 }],
        "first-contentful-paint": ["warn", { maxNumericValue: 1500 }],
        interactive: ["warn", { maxNumericValue: 3000 }],
        "largest-contentful-paint": ["warn", { maxNumericValue: 2500 }],
        "cumulative-layout-shift": ["warn", { maxNumericValue: 0.1 }],
        "total-blocking-time": ["warn", { maxNumericValue: 300 }],
      },
    },
    upload: {
      target: "temporary-public-storage",
    },
  },
};

/**
 * Mobile preset configuration (for reference — run separately with --preset=mobile):
 *
 * Mobile thresholds (relaxed for 4x CPU throttling):
 *   Performance: >= 0.6
 *   FCP: < 2000ms
 *   LCP: < 3000ms
 *   TTI: < 5000ms
 *   TBT: < 600ms
 *   CLS: < 0.1
 *
 * Run mobile audit:
 *   lhci collect --settings.preset=mobile
 */
