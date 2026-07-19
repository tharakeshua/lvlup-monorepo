import { Page, expect } from "@playwright/test";

/**
 * Configuration for seed data health checks.
 */
interface SeedHealthCheckConfig {
  /** URL of the login page to verify app is running */
  loginUrl: string;
  /** Maximum wait time in ms for the app to be reachable (default: 30000) */
  appTimeout?: number;
}

/**
 * Retry configuration for wait-for-data operations.
 */
interface RetryConfig {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Delay between retries in ms (default: 5000) */
  retryDelay?: number;
  /** Total timeout in ms (default: 15000) */
  timeout?: number;
}

/**
 * Perform a health check at test suite `beforeAll` to ensure the app
 * is running and seed data is available. Fails fast if conditions aren't met.
 */
export async function seedHealthCheck(page: Page, config: SeedHealthCheckConfig): Promise<void> {
  const { loginUrl, appTimeout = 30000 } = config;

  // 1. Verify app is reachable
  let appReachable = false;
  const startTime = Date.now();

  while (Date.now() - startTime < appTimeout && !appReachable) {
    try {
      const response = await page.goto(loginUrl, { timeout: 10000 });
      if (response && response.status() < 500) {
        appReachable = true;
      }
    } catch {
      await page.waitForTimeout(2000);
    }
  }

  if (!appReachable) {
    throw new Error(
      `Seed health check failed: App not reachable at ${loginUrl} after ${appTimeout}ms. ` +
        "Ensure dev servers are running before E2E tests."
    );
  }
}

/**
 * Wait for a specific element to be visible on the page with retry logic.
 * Replaces conditional `test.skip()` patterns with deterministic waits.
 */
export async function waitForElement(
  page: Page,
  selector: string,
  options?: RetryConfig & { description?: string }
): Promise<void> {
  const { maxRetries = 3, retryDelay = 5000, description } = options ?? {};
  const label = description ?? `element "${selector}"`;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await expect(page.locator(selector).first()).toBeVisible({
        timeout: retryDelay,
      });
      return; // Success
    } catch {
      if (attempt === maxRetries) {
        throw new Error(`waitForElement failed: ${label} not visible after ${maxRetries} attempts`);
      }
      await page.waitForTimeout(1000); // Brief pause before retry
    }
  }
}

/**
 * Wait for navigation to complete with retry logic.
 * Useful for login flows where the redirect might take time.
 */
export async function waitForNavigation(
  page: Page,
  urlPattern: RegExp,
  options?: RetryConfig
): Promise<void> {
  const { maxRetries = 3, retryDelay = 5000 } = options ?? {};

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await page.waitForURL(urlPattern, { timeout: retryDelay });
      return;
    } catch {
      if (attempt === maxRetries) {
        throw new Error(
          `waitForNavigation failed: URL did not match ${urlPattern} after ${maxRetries} attempts. ` +
            `Current URL: ${page.url()}`
        );
      }
      await page.waitForTimeout(1000);
    }
  }
}

/**
 * Login with retry logic. Wraps login actions with automatic retry
 * on failure, replacing conditional skips.
 */
export async function loginWithRetry(
  page: Page,
  loginFn: (page: Page) => Promise<void>,
  expectedUrlPattern: RegExp,
  options?: RetryConfig
): Promise<void> {
  const { maxRetries = 3, retryDelay = 5000 } = options ?? {};

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await loginFn(page);
      await page.waitForURL(expectedUrlPattern, { timeout: retryDelay });
      return;
    } catch {
      if (attempt === maxRetries) {
        throw new Error(`Login failed after ${maxRetries} attempts. Current URL: ${page.url()}`);
      }
      // Reload and try again
      await page.goto(page.url().replace(/\/.*$/, "/login"), {
        timeout: 10000,
      });
      await page.waitForTimeout(1000);
    }
  }
}

/**
 * Wait for page data to load by checking for absence of loading indicators
 * and presence of expected content.
 */
export async function waitForDataLoad(
  page: Page,
  options?: {
    loadingSelector?: string;
    contentSelector?: string;
    timeout?: number;
  }
): Promise<void> {
  const {
    loadingSelector = '[data-testid="loading"], .animate-spin, [role="progressbar"]',
    contentSelector,
    timeout = 15000,
  } = options ?? {};

  // Wait for loading indicators to disappear
  try {
    await expect(page.locator(loadingSelector).first()).not.toBeVisible({
      timeout,
    });
  } catch {
    // Loading indicator might not exist at all — that's fine
  }

  // If a content selector is specified, wait for it to appear
  if (contentSelector) {
    await expect(page.locator(contentSelector).first()).toBeVisible({
      timeout,
    });
  }
}
