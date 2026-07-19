import type { Page } from "@playwright/test";

/**
 * Accessibility testing utilities using axe-core via Playwright.
 *
 * Install: pnpm add -D @axe-core/playwright
 *
 * Usage:
 *   import { checkA11y, checkColorContrast, checkLandmarks } from '@levelup/shared-ui/test-utils/a11y-test-utils';
 *   test('page is accessible', async ({ page }) => {
 *     await page.goto('/dashboard');
 *     await checkA11y(page);
 *   });
 */

export interface A11yCheckOptions {
  /** axe-core rules to disable (e.g., Radix UI false positives) */
  disableRules?: string[];
  /** Only check within this selector */
  include?: string;
  /** Run against specific WCAG tags (default: wcag2a, wcag2aa) */
  tags?: string[];
}

/**
 * Run an axe-core accessibility audit on the current page.
 * Throws if any violations are found, with a formatted report.
 */
export async function checkA11y(page: Page, options: A11yCheckOptions = {}): Promise<void> {
  // Dynamically import to avoid bundling in production
  const { AxeBuilder } = await import("@axe-core/playwright");

  let builder = new AxeBuilder({ page }).withTags(options.tags ?? ["wcag2a", "wcag2aa"]);

  if (options.include) {
    builder = builder.include(options.include);
  }

  if (options.disableRules?.length) {
    builder = builder.disableRules(options.disableRules);
  }

  const results = await builder.analyze();

  if (results.violations.length > 0) {
    const report = results.violations
      .map((v) => {
        const nodes = v.nodes.map((n) => `  - ${n.html}\n    ${n.failureSummary}`).join("\n");
        return `[${v.impact}] ${v.id}: ${v.description}\n${nodes}`;
      })
      .join("\n\n");

    throw new Error(`Accessibility violations found (${results.violations.length}):\n\n${report}`);
  }
}

/**
 * Check only color contrast issues.
 */
export async function checkColorContrast(page: Page): Promise<void> {
  return checkA11y(page, {
    tags: ["wcag2aa"],
    disableRules: [
      // Keep only color-contrast rule
      "area-alt",
      "aria-allowed-attr",
      "aria-required-attr",
      "button-name",
      "image-alt",
      "label",
      "link-name",
    ],
  });
}

/**
 * Check for landmark regions (header, main, nav, etc.).
 */
export async function checkLandmarks(page: Page): Promise<void> {
  const { AxeBuilder } = await import("@axe-core/playwright");

  const results = await new AxeBuilder({ page })
    .withRules(["landmark-one-main", "region", "bypass"])
    .analyze();

  if (results.violations.length > 0) {
    const report = results.violations
      .map((v) => `[${v.impact}] ${v.id}: ${v.description}`)
      .join("\n");
    throw new Error(`Landmark violations:\n${report}`);
  }
}

/**
 * Check that interactive elements have accessible labels.
 */
export async function checkLabels(page: Page): Promise<void> {
  return checkA11y(page, {
    disableRules: ["color-contrast"],
    tags: ["wcag2a", "wcag2aa"],
  });
}

/**
 * Default axe-core rules to disable for known Radix UI patterns
 * that may produce false positives.
 */
export const RADIX_EXCEPTIONS = [
  "aria-required-children", // Radix manages ARIA internally
  "aria-required-parent", // Radix portals move DOM elements
];
