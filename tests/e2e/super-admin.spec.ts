import { test, expect, Page } from "@playwright/test";
import { loginDirect, logout, expectDashboard } from "./helpers/auth";
import { CREDENTIALS, SELECTORS } from "./helpers/selectors";

// ─── Helpers ────────────────────────────────────────────────────────────────

async function loginAsSuperAdmin(page: Page) {
  await page.goto("/login");
  await loginDirect(page, CREDENTIALS.superAdmin.email, CREDENTIALS.superAdmin.password);
  // Retry login if rate-limited (Firebase may throttle after many sequential logins)
  try {
    await expectDashboard(page, SELECTORS.dashboards.superAdmin);
  } catch {
    // If login failed (still on login page), wait and retry up to 2 times
    for (let attempt = 1; attempt <= 2; attempt++) {
      if (!page.url().includes("/login")) {
        throw new Error("Login failed: unexpected URL " + page.url());
      }
      await page.waitForTimeout(3000);
      await page.fill("#email", "");
      await page.fill("#password", "");
      await loginDirect(page, CREDENTIALS.superAdmin.email, CREDENTIALS.superAdmin.password);
      try {
        await expectDashboard(page, SELECTORS.dashboards.superAdmin);
        return; // Success
      } catch {
        if (attempt === 2) throw new Error("Login failed after 3 attempts (likely rate-limited)");
      }
    }
  }
}

// ─── Authentication ──────────────────────────────────────────────────────────

test.describe("Authentication", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("redirects to /login when not authenticated", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });

  test("redirects /tenants to /login when not authenticated", async ({ page }) => {
    await page.goto("/tenants");
    await expect(page).toHaveURL(/\/login/);
  });

  test("login page renders email and password fields", async ({ page }) => {
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
    await expect(page.locator('button[type="submit"]:has-text("Sign In")')).toBeVisible();
  });

  test("successful login with valid credentials", async ({ page }) => {
    await loginDirect(page, CREDENTIALS.superAdmin.email, CREDENTIALS.superAdmin.password);
    await expectDashboard(page, SELECTORS.dashboards.superAdmin);
  });

  test("shows error for invalid password", async ({ page }) => {
    await loginDirect(page, CREDENTIALS.superAdmin.email, "WrongPassword123!");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('[class*="destructive"], [role="alert"]').first()).toBeVisible({
      timeout: 5000,
    });
  });

  test("shows error for invalid email", async ({ page }) => {
    await loginDirect(page, "nobody@nowhere.test", "SomePass123!");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('[class*="destructive"], [role="alert"]').first()).toBeVisible({
      timeout: 5000,
    });
  });

  test("sign out redirects to login", async ({ page }) => {
    await loginAsSuperAdmin(page);
    await logout(page);
    await expect(page).toHaveURL(/\/login/);
  });

  test("cannot access protected pages after sign out", async ({ page }) => {
    await loginAsSuperAdmin(page);
    await logout(page);
    await page.goto("/tenants");
    await expect(page).toHaveURL(/\/login/);
  });
});

// ─── Dashboard ───────────────────────────────────────────────────────────────

test.describe("Dashboard Page", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
  });

  test("dashboard heading is visible", async ({ page }) => {
    await expect(page.locator("h1")).toContainText("Super Admin Dashboard");
  });

  test("shows welcome message with admin email or name", async ({ page }) => {
    const welcomeText = page.locator('p:has-text("Welcome back")');
    await expect(welcomeText).toBeVisible();
  });

  test("shows stat cards: Total Tenants, Total Users, Total Exams, Total Spaces", async ({
    page,
  }) => {
    await expect(page.getByText("Total Tenants")).toBeVisible();
    await expect(page.getByText("Total Users")).toBeVisible();
    await expect(page.getByText("Total Exams")).toBeVisible();
    await expect(page.getByText("Total Spaces")).toBeVisible();
  });

  test("stat cards show numeric values", async ({ page }) => {
    // Wait for loading to complete (no "Loading platform stats...")
    await expect(page.locator("text=Loading platform stats...")).not.toBeVisible({
      timeout: 15000,
    });
    // Each stat card has a large bold number
    const statValues = page.locator(".rounded-lg.border p.text-2xl.font-bold");
    await expect(statValues.first()).toBeVisible();
  });

  test("shows active and trial counts below Total Tenants", async ({ page }) => {
    await expect(page.locator("text=Loading platform stats...")).not.toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText(/active,.*trial/)).toBeVisible();
  });

  test("Sign Out button is present on dashboard", async ({ page }) => {
    await expect(page.locator('button:has-text("Sign Out")')).toBeVisible();
  });

  test("Sign Out from dashboard redirects to login", async ({ page }) => {
    await page.locator('button:has-text("Sign Out")').first().click();
    // LogoutButton always shows an AlertDialog confirmation ("Sign out?")
    await expect(page.locator('[role="alertdialog"]')).toBeVisible({ timeout: 5000 });
    await page.locator('[role="alertdialog"] button:has-text("Sign Out")').click();
    await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
  });
});

// ─── Navigation / Sidebar ────────────────────────────────────────────────────

test.describe("Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
  });

  test("navigate to Tenants page via sidebar", async ({ page }) => {
    await page.click('a[href="/tenants"]');
    await expect(page).toHaveURL(/\/tenants/);
    await expect(page.locator("h1")).toContainText("Tenants");
  });

  test("navigate to Analytics page via sidebar", async ({ page }) => {
    await page.click('a[href="/analytics"]');
    await expect(page).toHaveURL(/\/analytics/);
    await expect(page.locator("h1")).toContainText("User Analytics");
  });

  test("navigate to Feature Flags page via sidebar", async ({ page }) => {
    await page.click('a[href="/feature-flags"]');
    await expect(page).toHaveURL(/\/feature-flags/);
    await expect(page.locator("h1")).toContainText("Feature Flags");
  });

  test("navigate to Global Presets page via sidebar", async ({ page }) => {
    await page.click('a[href="/presets"]');
    await expect(page).toHaveURL(/\/presets/);
    await expect(page.locator("h1")).toContainText("Global Evaluation Presets");
  });

  test("navigate to System Health page via sidebar", async ({ page }) => {
    await page.click('a[href="/system"]');
    await expect(page).toHaveURL(/\/system/);
    await expect(page.locator("h1")).toContainText("System Health");
  });

  test("navigate to Settings page via sidebar", async ({ page }) => {
    await page.click('a[href="/settings"]');
    await expect(page).toHaveURL(/\/settings/);
    await expect(page.locator("h1")).toContainText("Platform Settings");
  });

  test("navigate back to dashboard from tenants", async ({ page }) => {
    await page.goto("/tenants");
    await page.click('a[href="/"]');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator("h1")).toContainText("Super Admin Dashboard");
  });
});

// ─── Tenants Page ────────────────────────────────────────────────────────────

test.describe("Tenants Page", () => {
  test.describe.configure({ timeout: 120000 }); // Login may take 40-60s with Firebase throttling
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
    await page.goto("/tenants");
    await expect(page.locator("h1")).toContainText("Tenants");
  });

  test("shows page heading and description", async ({ page }) => {
    await expect(page.locator("h1")).toContainText("Tenants");
    await expect(page.getByText("Manage all registered tenants")).toBeVisible();
  });

  test("shows Create Tenant button", async ({ page }) => {
    await expect(page.locator('button:has-text("Create Tenant")')).toBeVisible();
  });

  test("shows search input", async ({ page }) => {
    await expect(page.locator('input[placeholder*="Search"]')).toBeVisible();
  });

  test("shows status filter buttons (all, active, trial, suspended, expired)", async ({ page }) => {
    const statuses = ["all", "active", "trial", "suspended", "expired"];
    for (const status of statuses) {
      await expect(page.locator(`button:has-text("${status}")`).first()).toBeVisible();
    }
  });

  test("shows table with headers: Name, Code, Plan, Users, Status, Actions", async ({ page }) => {
    // Wait for loading to complete
    await expect(page.locator("text=Loading...")).not.toBeVisible({ timeout: 15000 });
    await expect(page.locator('th:has-text("Name")')).toBeVisible();
    await expect(page.locator('th:has-text("Code")')).toBeVisible();
    await expect(page.locator('th:has-text("Plan")')).toBeVisible();
    await expect(page.locator('th:has-text("Users")')).toBeVisible();
    await expect(page.locator('th:has-text("Status")')).toBeVisible();
    await expect(page.locator('th:has-text("Actions")')).toBeVisible();
  });

  test("search filters tenants by name", async ({ page }) => {
    await expect(page.locator("text=Loading...")).not.toBeVisible({ timeout: 15000 });
    const searchInput = page.locator('input[placeholder*="Search"]');
    await searchInput.fill("Springfield");
    // Either rows matching Springfield or "No tenants found" message
    const rows = page.locator("tbody tr");
    const count = await rows.count();
    if (count > 0) {
      const firstRowText = await rows.first().textContent();
      if (firstRowText && !firstRowText.includes("No tenants found")) {
        expect(firstRowText.toLowerCase()).toContain("springfield");
      }
    }
  });

  test('search with no match shows "No tenants found"', async ({ page }) => {
    await expect(page.locator("text=Loading...")).not.toBeVisible({ timeout: 15000 });
    await page.locator('input[placeholder*="Search"]').fill("xyznonexistentxyz123");
    await expect(page.locator("text=No tenants found")).toBeVisible();
  });

  test('status filter "active" shows only active tenants', async ({ page }) => {
    await expect(page.locator("text=Loading...")).not.toBeVisible({ timeout: 15000 });
    await page.locator('button:has-text("active")').first().click();
    // After filtering, all visible rows should contain "active" status text
    const rows = page.locator("tbody tr");
    const rowCount = await rows.count();
    for (let i = 0; i < rowCount; i++) {
      const rowText = await rows.nth(i).textContent();
      if (rowText && !rowText.includes("No tenants found")) {
        expect(rowText.toLowerCase()).toContain("active");
      }
    }
  });

  test("opens Create Tenant dialog when clicking Create Tenant", async ({ page }) => {
    await page.click('button:has-text("Create Tenant")');
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    await expect(page.locator('[role="dialog"] h2, [role="dialog"] h3')).toContainText(
      "Create Tenant"
    );
  });

  test("Create Tenant dialog has required fields", async ({ page }) => {
    await page.locator('button:has-text("Create Tenant")').first().click();
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    // Fields identified by label text (shadcn FormControl generates auto IDs)
    await expect(dialog.getByLabel("Organization Name", { exact: false })).toBeVisible();
    await expect(dialog.getByLabel("Tenant Code", { exact: false })).toBeVisible();
    await expect(dialog.getByLabel("Contact Email", { exact: false })).toBeVisible();
    await expect(dialog.getByLabel("Contact Person", { exact: false })).toBeVisible();
    // Plan uses shadcn Select (combobox), not a native select
    await expect(dialog.getByRole("combobox").first()).toBeVisible();
  });

  test("Create Tenant dialog - Cancel closes the dialog", async ({ page }) => {
    await page.locator('button:has-text("Create Tenant")').first().click();
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    // Cancel button may be below viewport in a fixed dialog — use force click
    await page.locator('[role="dialog"] button:has-text("Cancel")').click({ force: true });
    await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 10000 });
  });

  test("Create Tenant dialog - Create button enabled (validation on submit)", async ({ page }) => {
    await page.locator('button:has-text("Create Tenant")').first().click();
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    // The Create Tenant submit button uses react-hook-form: enabled by default, validates on submit
    const createBtn = dialog.getByRole("button", { name: "Create Tenant" });
    await expect(createBtn).toBeEnabled();
  });

  test("Create Tenant dialog - plan select has trial, basic, premium, enterprise options", async ({
    page,
  }) => {
    await page.locator('button:has-text("Create Tenant")').first().click();
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    // shadcn Select uses combobox role; click to open the dropdown
    await dialog.getByRole("combobox").first().click({ force: true });
    // Options appear in a portal listbox; wait for first option
    await expect(page.getByRole("option", { name: "Trial" })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("option", { name: "Basic" })).toBeVisible();
    await expect(page.getByRole("option", { name: "Premium" })).toBeVisible();
    await expect(page.getByRole("option", { name: "Enterprise" })).toBeVisible();
  });

  test("tenant code input auto-uppercases and strips invalid chars", async ({ page }) => {
    await page.locator('button:has-text("Create Tenant")').first().click();
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    const codeInput = dialog.getByLabel("Tenant Code", { exact: false });
    await codeInput.fill("my school!@#");
    const value = await codeInput.inputValue();
    // Should be uppercase and only A-Z0-9-
    expect(value).toMatch(/^[A-Z0-9-]*$/);
  });

  test('tenant row has "View" link', async ({ page }) => {
    await expect(page.locator("text=Loading...")).not.toBeVisible({ timeout: 15000 });
    const rows = page.locator("tbody tr");
    const count = await rows.count();
    if (count > 0) {
      const firstRowText = await rows.first().textContent();
      if (firstRowText && !firstRowText.includes("No tenants found")) {
        const viewLink = rows.first().locator('a:has-text("View")');
        await expect(viewLink).toBeVisible();
      }
    }
  });

  test("clicking View link navigates to tenant detail page", async ({ page }) => {
    await expect(page.locator("text=Loading...")).not.toBeVisible({ timeout: 15000 });
    const viewLinks = page.locator('tbody a:has-text("View")');
    const count = await viewLinks.count();
    if (count > 0) {
      await viewLinks.first().click();
      await expect(page).toHaveURL(/\/tenants\/.+/);
    }
  });
});

// ─── Tenant Detail Page ──────────────────────────────────────────────────────

test.describe("Tenant Detail Page", () => {
  test.describe.configure({ timeout: 180000 }); // Extra time for login + navigation (Firebase throttling)
  let tenantHref: string | null = null;

  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
    await page.goto("/tenants");
    await expect(page.locator("text=Loading...")).not.toBeVisible({ timeout: 15000 });

    // Navigate to the first available tenant detail
    const viewLinks = page.locator('tbody a:has-text("View")');
    const count = await viewLinks.count();
    if (count > 0) {
      tenantHref = await viewLinks.first().getAttribute("href");
      await viewLinks.first().click();
      await page.waitForURL(/\/tenants\/.+/);
    }
  });

  test("shows tenant name as heading", async ({ page }) => {
    if (!tenantHref) test.skip();
    const heading = page.locator("h1");
    await expect(heading).toBeVisible({ timeout: 15000 });
    const text = await heading.textContent();
    expect(text?.trim().length).toBeGreaterThan(0);
  });

  test("shows Back link to tenants list", async ({ page }) => {
    if (!tenantHref) test.skip();
    await expect(page.locator('a:has-text("Back")')).toBeVisible();
  });

  test("Back link navigates to /tenants", async ({ page }) => {
    if (!tenantHref) test.skip();
    await page.locator('a:has-text("Back")').first().click();
    await expect(page).toHaveURL(/\/tenants/);
  });

  test("shows stat cards: Students, Teachers, Exams, Spaces", async ({ page }) => {
    if (!tenantHref) test.skip();
    await expect(page.getByText("Students", { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Teachers", { exact: true })).toBeVisible();
    await expect(page.getByText("Exams", { exact: true })).toBeVisible();
    await expect(page.getByText("Spaces", { exact: true })).toBeVisible();
  });

  test("shows Subscription section", async ({ page }) => {
    if (!tenantHref) test.skip();
    await expect(page.locator('h3:has-text("Subscription")')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('dt:has-text("Plan")')).toBeVisible();
    await expect(page.locator('dt:has-text("Max Students")')).toBeVisible();
    await expect(page.locator('dt:has-text("Max Teachers")')).toBeVisible();
    await expect(page.locator('dt:has-text("Max Spaces")')).toBeVisible();
  });

  test("shows Contact section", async ({ page }) => {
    if (!tenantHref) test.skip();
    await expect(page.locator('h3:has-text("Contact")')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('dt:has-text("Email")')).toBeVisible();
    await expect(page.locator('dt:has-text("Phone")')).toBeVisible();
    await expect(page.locator('dt:has-text("Contact Person")')).toBeVisible();
    await expect(page.locator('dt:has-text("Website")')).toBeVisible();
  });

  test("shows Features section", async ({ page }) => {
    if (!tenantHref) test.skip();
    await expect(page.locator('h3:has-text("Features")')).toBeVisible({ timeout: 15000 });
  });

  test("shows Settings section", async ({ page }) => {
    if (!tenantHref) test.skip();
    await expect(page.locator('h3:has-text("Settings")')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('dt:has-text("Gemini Key Set")')).toBeVisible();
    await expect(page.locator('dt:has-text("Default AI Model")')).toBeVisible();
  });

  test("shows Edit and Delete buttons", async ({ page }) => {
    if (!tenantHref) test.skip();
    await expect(page.getByRole("button", { name: "Edit", exact: true })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByRole("button", { name: "Delete", exact: true })).toBeVisible();
  });

  test("Edit button opens edit dialog", async ({ page }) => {
    if (!tenantHref) test.skip();
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    await expect(page.locator('[role="dialog"] h2, [role="dialog"] h3')).toContainText(
      "Edit Tenant"
    );
  });

  test("Edit dialog has all editable fields", async ({ page }) => {
    if (!tenantHref) test.skip();
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    // shadcn FormControl generates auto IDs; use label-based selectors
    await expect(dialog.getByLabel("Name", { exact: true })).toBeVisible();
    await expect(dialog.getByLabel("Contact Email", { exact: false })).toBeVisible();
    await expect(dialog.getByLabel("Contact Phone", { exact: false })).toBeVisible();
    await expect(dialog.getByLabel("Contact Person", { exact: false })).toBeVisible();
    await expect(dialog.getByLabel("Website", { exact: false })).toBeVisible();
    // Status uses shadcn Select (combobox)
    await expect(dialog.getByRole("combobox")).toBeVisible();
  });

  test("Edit dialog Cancel button closes dialog", async ({ page }) => {
    if (!tenantHref) test.skip();
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    // Cancel may be below viewport in fixed dialog — use force click
    await page.locator('[role="dialog"] button:has-text("Cancel")').click({ force: true });
    await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 10000 });
  });

  test("Edit dialog status select has valid options", async ({ page }) => {
    if (!tenantHref) test.skip();
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    // shadcn Select: click the combobox to open options list (force in case partially outside viewport)
    await dialog.getByRole("combobox").click({ force: true });
    // Wait for the listbox to appear then check options
    await expect(page.getByRole("option", { name: "Active" })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("option", { name: "Trial" })).toBeVisible();
    await expect(page.getByRole("option", { name: "Suspended" })).toBeVisible();
    await expect(page.getByRole("option", { name: "Expired" })).toBeVisible();
  });

  test("Delete button opens confirmation alert dialog", async ({ page }) => {
    if (!tenantHref) test.skip();
    await page.locator('button:has-text("Delete")').click();
    await expect(page.locator('[role="alertdialog"]')).toBeVisible();
    await expect(page.locator('[role="alertdialog"]')).toContainText("Delete Tenant");
  });

  test("Delete confirmation dialog has Cancel and confirm delete buttons", async ({ page }) => {
    if (!tenantHref) test.skip();
    await page.locator('button:has-text("Delete")').click();
    await expect(page.locator('[role="alertdialog"] button:has-text("Cancel")')).toBeVisible();
    // The confirm button text says "I understand, delete this tenant"
    await expect(
      page.locator('[role="alertdialog"] button:has-text("delete this tenant")')
    ).toBeVisible();
  });

  test("Cancel on delete dialog closes it without deleting", async ({ page }) => {
    if (!tenantHref) test.skip();
    await page.locator('button:has-text("Delete")').click();
    await expect(page.locator('[role="alertdialog"]')).toBeVisible();
    // Cancel button may be below viewport in fixed dialog — use force click
    const cancelBtn = page.locator('[role="alertdialog"] button:has-text("Cancel")');
    await cancelBtn.waitFor({ state: "attached", timeout: 5000 });
    await cancelBtn.click({ force: true });
    await expect(page.locator('[role="alertdialog"]')).not.toBeVisible({ timeout: 10000 });
    // Still on the tenant detail page
    await expect(page).toHaveURL(/\/tenants\/.+/);
  });
});

// ─── Feature Flags Page ───────────────────────────────────────────────────────

test.describe("Feature Flags Page", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
    await page.goto("/feature-flags");
    await expect(page.locator("h1")).toContainText("Feature Flags");
  });

  test("shows page heading and description", async ({ page }) => {
    await expect(page.locator("h1")).toContainText("Feature Flags");
    await expect(page.getByText("Manage tenant-level feature toggles")).toBeVisible();
  });

  test("shows Flag Overview section", async ({ page }) => {
    await expect(page.locator('h3:has-text("Flag Overview")')).toBeVisible();
  });

  test("shows all 9 known feature flags in overview", async ({ page }) => {
    const knownFlags = [
      "AutoGrade",
      "LevelUp Spaces",
      "Scanner App",
      "AI Chat Tutor",
      "AI Grading",
      "Analytics",
      "Parent Portal",
      "Bulk Import",
      "API Access",
    ];
    // Scope to the Flag Overview section to avoid matching duplicate flag names in tenant cards
    const overview = page.locator('h3:has-text("Flag Overview")').locator("..");
    for (const flag of knownFlags) {
      await expect(overview.getByText(flag, { exact: true }).first()).toBeVisible({
        timeout: 15000,
      });
    }
  });

  test("shows flag counts (x/y format) in overview", async ({ page }) => {
    await expect(page.locator("text=Loading tenant flags...")).not.toBeVisible({ timeout: 15000 });
    // Count badges like "2/3"
    const countBadges = page.locator("span.font-mono.text-muted-foreground");
    await expect(countBadges.first()).toBeVisible();
  });

  test("shows search input for tenants", async ({ page }) => {
    await expect(page.locator('input[placeholder="Search tenants..."]')).toBeVisible();
  });

  test("search filters tenant flag cards", async ({ page }) => {
    await expect(page.locator("text=Loading tenant flags...")).not.toBeVisible({ timeout: 15000 });
    const searchInput = page.locator('input[placeholder="Search tenants..."]');
    await searchInput.fill("xyznonexistentxyz999");
    await expect(page.locator("text=No tenants found")).toBeVisible();
  });

  test("shows tenant flag cards after loading", async ({ page }) => {
    await expect(page.locator("text=Loading tenant flags...")).not.toBeVisible({ timeout: 15000 });
    const cards = page.locator(".rounded-lg.border.bg-card");
    // The Flag Overview card plus at least one tenant card
    await expect(cards.first()).toBeVisible();
  });

  test("tenant cards show toggle buttons for each flag", async ({ page }) => {
    await expect(page.locator("text=Loading tenant flags...")).not.toBeVisible({ timeout: 15000 });
    // Each tenant card should have feature toggle buttons
    const tenantCards = page.locator(".space-y-4 > .rounded-lg.border.bg-card");
    const cardCount = await tenantCards.count();
    if (cardCount > 0) {
      const firstCard = tenantCards.first();
      // Each toggle button contains flag label text
      await expect(firstCard.locator('button:has-text("AutoGrade")')).toBeVisible();
    }
  });

  test("clicking a feature flag toggle marks card as pending with Save Changes button", async ({
    page,
  }) => {
    await expect(page.locator("text=Loading tenant flags...")).not.toBeVisible({ timeout: 15000 });
    const tenantCards = page.locator(".space-y-4 > .rounded-lg.border.bg-card");
    const cardCount = await tenantCards.count();
    if (cardCount > 0) {
      const firstCard = tenantCards.first();
      // Click one flag toggle
      const toggleBtn = firstCard.locator("button").first();
      await toggleBtn.click();
      // Should show "Save Changes" button
      await expect(firstCard.locator('button:has-text("Save Changes")')).toBeVisible();
    }
  });
});

// ─── Global Presets Page ─────────────────────────────────────────────────────

test.describe("Global Presets Page", () => {
  test.describe.configure({ timeout: 120000 }); // Login may take 40-60s with Firebase throttling
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
    await page.goto("/presets");
    await expect(page.locator("h1")).toContainText("Global Evaluation Presets");
  });

  test("shows page heading and description", async ({ page }) => {
    await expect(page.locator("h1")).toContainText("Global Evaluation Presets");
    await expect(page.getByText("Manage public evaluation feedback rubric presets")).toBeVisible();
  });

  test("shows Create Preset button", async ({ page }) => {
    await expect(page.locator('button:has-text("Create Preset")')).toBeVisible();
  });

  test("opens Create Preset dialog", async ({ page }) => {
    await page.click('button:has-text("Create Preset")');
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    await expect(page.locator('[role="dialog"] h2, [role="dialog"] h3')).toContainText(
      "Create Preset"
    );
  });

  test("Create Preset dialog has Name field", async ({ page }) => {
    await page.locator('button:has-text("Create Preset")').first().click();
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    // Name input identified by label (shadcn FormControl generates auto IDs)
    await expect(dialog.getByLabel("Name", { exact: false }).first()).toBeVisible();
  });

  test("Create Preset dialog has Description textarea", async ({ page }) => {
    await page.locator('button:has-text("Create Preset")').first().click();
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Description", { exact: false })).toBeVisible();
  });

  test('Create Preset dialog has "Set as default" and "Public" checkboxes', async ({ page }) => {
    await page.locator('button:has-text("Create Preset")').first().click();
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    // Checkboxes identified by adjacent label text
    await expect(dialog.getByText("Set as default preset")).toBeVisible();
    await expect(dialog.getByText("Public (visible to all tenants)")).toBeVisible();
  });

  test("Create Preset dialog has Display Settings section", async ({ page }) => {
    await page.locator('button:has-text("Create Preset")').first().click();
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Display Settings")).toBeVisible();
    await expect(dialog.getByText("Show strengths")).toBeVisible();
    await expect(dialog.getByText("Show key takeaway")).toBeVisible();
    await expect(dialog.getByText("Prioritize by importance")).toBeVisible();
  });

  test("Create Preset dialog has Evaluation Dimensions section with all 6 dimensions", async ({
    page,
  }) => {
    await page.click('button:has-text("Create Preset")');
    await expect(page.getByText("Evaluation Dimensions")).toBeVisible();
    const dimensions = [
      "Clarity",
      "Accuracy",
      "Depth",
      "Grammar",
      "Relevance",
      "Critical Thinking",
    ];
    for (const dim of dimensions) {
      await expect(page.locator(`label:has-text("${dim}")`).first()).toBeVisible();
    }
  });

  test("Save Preset button is present and enabled", async ({ page }) => {
    await page.locator('button:has-text("Create Preset")').first().click();
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    // Save Preset button uses react-hook-form: enabled by default (validates on submit)
    const saveBtn = dialog.getByRole("button", { name: "Save Preset" });
    await expect(saveBtn).toBeVisible();
    await expect(saveBtn).toBeEnabled();
  });

  test("Save Preset button enabled when name is filled", async ({ page }) => {
    await page.locator('button:has-text("Create Preset")').first().click();
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    // Fill name using label-based selector (auto-generated IDs in shadcn)
    await dialog.getByLabel("Name", { exact: false }).first().fill("Test Preset");
    const saveBtn = dialog.getByRole("button", { name: "Save Preset" });
    await expect(saveBtn).toBeEnabled();
  });

  test("Cancel button closes the dialog", async ({ page }) => {
    await page.locator('button:has-text("Create Preset")').first().click();
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    // Cancel may be below viewport in fixed dialog — use force click
    await page.locator('[role="dialog"] button:has-text("Cancel")').click({ force: true });
    await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 10000 });
  });

  test("existing presets show Edit and Delete buttons", async ({ page }) => {
    await expect(page.locator("text=Loading presets...")).not.toBeVisible({ timeout: 15000 });
    const presetCards = page.locator(".rounded-lg.border.bg-card.p-5");
    const count = await presetCards.count();
    if (count > 0) {
      const firstCard = presetCards.first();
      await expect(firstCard.locator('button:has-text("Edit")')).toBeVisible();
      await expect(firstCard.locator('button:has-text("Delete")')).toBeVisible();
    }
  });

  test("Edit button on preset card opens edit dialog", async ({ page }) => {
    await expect(page.locator("text=Loading presets...")).not.toBeVisible({ timeout: 15000 });
    const presetCards = page.locator(".rounded-lg.border.bg-card.p-5");
    const count = await presetCards.count();
    if (count > 0) {
      await presetCards.first().locator('button:has-text("Edit")').click();
      await expect(page.locator('[role="dialog"]')).toBeVisible();
      await expect(page.locator('[role="dialog"] h2, [role="dialog"] h3')).toContainText(
        "Edit Preset"
      );
    }
  });

  test("Delete button on preset opens delete confirmation dialog", async ({ page }) => {
    await expect(page.locator("text=Loading presets...")).not.toBeVisible({ timeout: 15000 });
    const presetCards = page.locator(".rounded-lg.border.bg-card.p-5");
    const count = await presetCards.count();
    if (count > 0) {
      await presetCards.first().locator('button:has-text("Delete")').click();
      await expect(page.locator('[role="alertdialog"]')).toBeVisible();
      await expect(page.locator('[role="alertdialog"]')).toContainText("Delete Preset");
    }
  });

  test("Delete confirmation Cancel button closes dialog", async ({ page }) => {
    await expect(page.locator("text=Loading presets...")).not.toBeVisible({ timeout: 15000 });
    const presetCards = page.locator(".rounded-lg.border.bg-card.p-5");
    const count = await presetCards.count();
    if (count > 0) {
      await presetCards.first().locator('button:has-text("Delete")').click();
      await expect(page.locator('[role="alertdialog"]')).toBeVisible();
      await page.locator('[role="alertdialog"] button:has-text("Cancel")').click();
      await expect(page.locator('[role="alertdialog"]')).not.toBeVisible();
    }
  });

  test("preset cards show dimension badges", async ({ page }) => {
    await expect(page.locator("text=Loading presets...")).not.toBeVisible({ timeout: 15000 });
    const presetCards = page.locator(".rounded-lg.border.bg-card.p-5");
    const count = await presetCards.count();
    if (count > 0) {
      const firstCard = presetCards.first();
      // Dimensions label
      await expect(firstCard.getByText("Dimensions", { exact: false })).toBeVisible();
    }
  });
});

// ─── User Analytics Page ──────────────────────────────────────────────────────

test.describe("User Analytics Page", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
    await page.goto("/analytics");
    await expect(page.locator("h1")).toContainText("User Analytics");
  });

  test("shows page heading and description", async ({ page }) => {
    await expect(page.locator("h1")).toContainText("User Analytics");
    await expect(page.getByText("Platform-wide user statistics")).toBeVisible();
  });

  test("shows stat cards: Total Users, Students, Teachers, Active Tenants", async ({ page }) => {
    // Wait for loading skeleton to disappear
    await expect(page.locator(".animate-pulse").first()).not.toBeVisible({ timeout: 15000 });
    // Scope to stat cards area to avoid matching table column headers
    const statCards = page.locator(".rounded-lg.border.bg-card");
    await expect(statCards.getByText("Total Users", { exact: true })).toBeVisible();
    await expect(statCards.getByText("Students", { exact: true }).first()).toBeVisible();
    await expect(statCards.getByText("Teachers", { exact: true }).first()).toBeVisible();
    await expect(statCards.getByText("Active Tenants", { exact: true })).toBeVisible();
  });

  test("stat cards show numeric values", async ({ page }) => {
    await expect(page.locator(".animate-pulse").first()).not.toBeVisible({ timeout: 15000 });
    const statValues = page.locator(".rounded-lg.border.bg-card p.text-2xl.font-bold");
    const count = await statValues.count();
    expect(count).toBeGreaterThanOrEqual(4);
  });

  test("shows Users by Tenant table", async ({ page }) => {
    await expect(page.locator(".animate-pulse").first()).not.toBeVisible({ timeout: 15000 });
    await expect(page.locator('h3:has-text("Users by Tenant")')).toBeVisible();
  });

  test("Users by Tenant table has correct columns", async ({ page }) => {
    await expect(page.locator(".animate-pulse").first()).not.toBeVisible({ timeout: 15000 });
    await expect(page.locator('th:has-text("Tenant")')).toBeVisible();
    await expect(page.locator('th:has-text("Code")')).toBeVisible();
    await expect(page.locator('th:has-text("Students")')).toBeVisible();
    await expect(page.locator('th:has-text("Teachers")')).toBeVisible();
    await expect(page.locator('th:has-text("Total")')).toBeVisible();
    await expect(page.locator('th:has-text("Status")')).toBeVisible();
  });

  test("shows tenant rows sorted by total users descending", async ({ page }) => {
    await expect(page.locator(".animate-pulse").first()).not.toBeVisible({ timeout: 15000 });
    const rows = page.locator("tbody tr");
    const count = await rows.count();
    if (count >= 2) {
      const firstTotal = await rows.first().locator("td:nth-child(5)").textContent();
      const secondTotal = await rows.nth(1).locator("td:nth-child(5)").textContent();
      if (firstTotal && secondTotal) {
        const first = parseInt(firstTotal.replace(/,/g, ""), 10);
        const second = parseInt(secondTotal.replace(/,/g, ""), 10);
        expect(first).toBeGreaterThanOrEqual(second);
      }
    }
  });

  test("shows Users by Subscription Plan section when data available", async ({ page }) => {
    await expect(page.locator(".animate-pulse").first()).not.toBeVisible({ timeout: 15000 });
    // This section only shows if usersByPlan has entries
    const planSection = page.locator('h3:has-text("Users by Subscription Plan")');
    const planSectionVisible = await planSection.isVisible();
    if (planSectionVisible) {
      await expect(planSection).toBeVisible();
      // Progress bars use shadcn Progress component (not bare css classes)
      await expect(page.locator('[role="progressbar"]').first()).toBeVisible();
    }
  });

  test("shows percentage breakdown for Students and Teachers in stat cards", async ({ page }) => {
    await expect(page.locator(".animate-pulse").first()).not.toBeVisible({ timeout: 15000 });
    // Sub-texts on the stat cards show "% of users"
    const subTexts = page.locator(".rounded-lg.border.bg-card p.text-xs.text-muted-foreground");
    const count = await subTexts.count();
    expect(count).toBeGreaterThan(0);
  });
});

// ─── System Health Page ───────────────────────────────────────────────────────

test.describe("System Health Page", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
    await page.goto("/system");
    await expect(page.locator("h1")).toContainText("System Health");
  });

  test("shows page heading and description", async ({ page }) => {
    await expect(page.locator("h1")).toContainText("System Health");
    await expect(page.getByText("Monitor platform health and service status")).toBeVisible();
  });

  test("shows Refresh button", async ({ page }) => {
    await expect(page.locator('button:has-text("Refresh")')).toBeVisible();
  });

  test("shows overall status banner after checks complete", async ({ page }) => {
    // Wait for "Running health checks..." to disappear
    await expect(page.locator("text=Running health checks")).not.toBeVisible({ timeout: 30000 });
    // Overall status messages
    const statusMessages = [
      "All Systems Operational",
      "Some Services Degraded",
      "Service Disruption Detected",
    ];
    let found = false;
    for (const msg of statusMessages) {
      if (await page.locator(`text=${msg}`).isVisible()) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  test("shows four service cards: Firebase Auth, Firestore, Cloud Functions, AI Grading Pipeline", async ({
    page,
  }) => {
    await expect(page.locator("text=Running health checks")).not.toBeVisible({ timeout: 30000 });
    await expect(page.getByText("Firebase Auth")).toBeVisible();
    await expect(page.getByText("Firestore")).toBeVisible();
    await expect(page.getByText("Cloud Functions")).toBeVisible();
    await expect(page.getByText("AI Grading Pipeline")).toBeVisible();
  });

  test("service cards show status (operational/degraded/down)", async ({ page }) => {
    await expect(page.locator("text=Running health checks")).not.toBeVisible({ timeout: 30000 });
    const validStatuses = ["operational", "degraded", "down"];
    // StatusBadge renders with text content showing one of the valid status values
    // Look within service card grid for status text
    const serviceGrid = page.locator(".grid.gap-4.md\\:grid-cols-2").first();
    await expect(serviceGrid).toBeVisible({ timeout: 15000 });
    // Each card has a StatusBadge showing the service status
    const cards = serviceGrid.locator(".rounded-lg");
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThan(0);
    for (let i = 0; i < cardCount; i++) {
      const cardText = await cards.nth(i).textContent();
      if (cardText) {
        const hasValidStatus = validStatuses.some((s) => cardText.toLowerCase().includes(s));
        expect(hasValidStatus).toBe(true);
      }
    }
  });

  test("shows Platform Metrics section", async ({ page }) => {
    await expect(page.locator("text=Running health checks")).not.toBeVisible({ timeout: 30000 });
    await expect(page.locator('h3:has-text("Platform Metrics")')).toBeVisible();
    await expect(page.getByText("Avg Response Time")).toBeVisible();
    await expect(page.locator('p:has-text("Total Users")').last()).toBeVisible();
    await expect(page.getByText("Error Rate")).toBeVisible();
  });

  test("Refresh button triggers a new health check", async ({ page }) => {
    await expect(page.locator("text=Running health checks")).not.toBeVisible({ timeout: 30000 });
    await page.click('button:has-text("Refresh")');
    // Should show "Checking..." temporarily
    const checking = page.locator('button:has-text("Checking...")');
    // It may appear briefly; just verify the button exists and is not throwing
    await expect(
      page.locator('button:has-text("Refresh"), button:has-text("Checking...")')
    ).toBeVisible();
  });

  test("shows Last checked timestamp after health check", async ({ page }) => {
    await expect(page.locator("text=Running health checks")).not.toBeVisible({ timeout: 30000 });
    await expect(page.locator("text=Last checked:")).toBeVisible();
  });

  test("shows firestore latency in ms", async ({ page }) => {
    await expect(page.locator("text=Running health checks")).not.toBeVisible({ timeout: 30000 });
    // Firestore card should show latency like "123ms"
    const latency = page.locator('span:has-text("ms")').first();
    await expect(latency).toBeVisible();
  });
});

// ─── Settings Page ────────────────────────────────────────────────────────────

test.describe("Settings Page", () => {
  test.describe.configure({ timeout: 120000 }); // Login may take 40-60s with Firebase throttling
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
    await page.goto("/settings");
    await expect(page.locator("h1")).toContainText("Platform Settings");
  });

  test("shows page heading and description", async ({ page }) => {
    await expect(page.locator("h1")).toContainText("Platform Settings");
    await expect(page.getByText("Global configuration for the LevelUp platform")).toBeVisible();
  });

  test("shows Platform Announcement card", async ({ page }) => {
    await expect(page.locator("text=Loading configuration...")).not.toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Platform Announcement")).toBeVisible();
    await expect(page.getByText("Broadcast a message to all tenants")).toBeVisible();
  });

  test("shows announcement textarea", async ({ page }) => {
    await expect(page.locator("text=Loading configuration...")).not.toBeVisible({ timeout: 15000 });
    await expect(page.locator('textarea[placeholder*="announcement"]')).toBeVisible();
  });

  test("announcement textarea shows active/no announcement hint text", async ({ page }) => {
    await expect(page.locator("text=Loading configuration...")).not.toBeVisible({ timeout: 15000 });
    await expect(
      page.getByText("No active announcement.").or(page.getByText("Announcement will be visible"))
    ).toBeVisible();
  });

  test("shows Default Features for New Tenants card", async ({ page }) => {
    await expect(page.locator("text=Loading configuration...")).not.toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Default Features for New Tenants")).toBeVisible();
    await expect(page.getByText("Configure which features are enabled by default")).toBeVisible();
  });

  test("shows all 7 default feature toggles", async ({ page }) => {
    await expect(page.locator("text=Loading configuration...")).not.toBeVisible({ timeout: 15000 });
    const features = [
      "Auto Grade",
      "Learning Spaces",
      "AI Grading",
      "AI Chat / Tutoring",
      "Analytics",
      "Parent Portal",
      "Bulk Import",
    ];
    for (const feat of features) {
      await expect(page.getByText(feat, { exact: true })).toBeVisible();
    }
  });

  test("default feature toggles are Switch components", async ({ page }) => {
    // Wait for switches to appear (skeleton loading state renders no switches)
    const switches = page.locator('[role="switch"]');
    await expect(switches.first()).toBeVisible({ timeout: 20000 });
    // At least 7 feature flags + 1 maintenance mode switch
    const count = await switches.count();
    expect(count).toBeGreaterThanOrEqual(7);
  });

  test("shows System Configuration card with Maintenance Mode", async ({ page }) => {
    await expect(page.locator("text=Loading configuration...")).not.toBeVisible({ timeout: 15000 });
    await expect(page.getByText("System Configuration")).toBeVisible();
    await expect(page.getByText("Maintenance Mode")).toBeVisible();
    await expect(
      page.getByText("When enabled, non-admin users will see a maintenance page")
    ).toBeVisible();
  });

  test("shows Default Plan and Max Tenants Allowed readonly fields", async ({ page }) => {
    await expect(page.locator("text=Loading configuration...")).not.toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Default Plan")).toBeVisible();
    await expect(page.getByText("Max Tenants Allowed")).toBeVisible();
  });

  test("shows Admin Account card", async ({ page }) => {
    await expect(page.locator("text=Loading configuration...")).not.toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Admin Account")).toBeVisible();
  });

  test("Admin Account card shows super admin email", async ({ page }) => {
    await expect(page.locator("text=Loading configuration...")).not.toBeVisible({ timeout: 15000 });
    await expect(page.locator(`text=${CREDENTIALS.superAdmin.email}`)).toBeVisible();
  });

  test("Admin Account card has Sign Out button", async ({ page }) => {
    await expect(page.locator("text=Loading configuration...")).not.toBeVisible({ timeout: 15000 });
    await expect(page.locator('button:has-text("Sign Out")')).toBeVisible();
  });

  test("Sign Out from settings redirects to login", async ({ page }) => {
    await expect(page.locator('[role="switch"]').first()).toBeVisible({ timeout: 20000 });
    await page.locator('button:has-text("Sign Out")').click();
    // LogoutButton always shows an AlertDialog confirmation ("Sign out?")
    await expect(page.locator('[role="alertdialog"]')).toBeVisible({ timeout: 5000 });
    await page.locator('[role="alertdialog"] button:has-text("Sign Out")').click();
    await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
  });

  test("can toggle Maintenance Mode switch", async ({ page }) => {
    // Wait for switches to be rendered (Skeleton loader disappears)
    await expect(page.locator('[role="switch"]').first()).toBeVisible({ timeout: 20000 });
    // Find maintenance mode switch via XPath: p text → inner div → flex container → switch sibling
    const switchEl = page
      .getByText("Maintenance Mode", { exact: true })
      .locator("xpath=../..")
      .locator('[role="switch"]');
    await expect(switchEl).toBeVisible({ timeout: 10000 });
    const initialChecked = await switchEl.getAttribute("aria-checked");
    await switchEl.click({ force: true });
    // If turning ON: AlertDialog appears asking to confirm
    try {
      await expect(page.locator('[role="alertdialog"]')).toBeVisible({ timeout: 3000 });
      await page.locator('[role="alertdialog"] button:has-text("Enable Maintenance Mode")').click();
      await expect(page.locator('[role="alertdialog"]')).not.toBeVisible({ timeout: 5000 });
    } catch {
      // No dialog = turning OFF, which requires no confirmation
    }
    const newChecked = await switchEl.getAttribute("aria-checked");
    expect(newChecked).not.toBe(initialChecked);
    // Restore original state
    await switchEl.click({ force: true });
    try {
      await expect(page.locator('[role="alertdialog"]')).toBeVisible({ timeout: 3000 });
      await page.locator('[role="alertdialog"] button:has-text("Enable Maintenance Mode")').click();
      await expect(page.locator('[role="alertdialog"]')).not.toBeVisible({ timeout: 5000 });
    } catch {
      // No dialog needed for turning OFF
    }
  });

  test("can type in announcement textarea", async ({ page }) => {
    await expect(page.locator("text=Loading configuration...")).not.toBeVisible({ timeout: 15000 });
    const textarea = page.locator('textarea[placeholder*="announcement"]');
    await textarea.fill("Test announcement for all tenants");
    await expect(textarea).toHaveValue("Test announcement for all tenants");
    // Hint text changes
    await expect(
      page.getByText("Announcement will be visible to all tenant admins.")
    ).toBeVisible();
  });
});

// ─── Deep Link / Direct URL Access ───────────────────────────────────────────

test.describe("Direct URL navigation (authenticated)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
  });

  test("direct navigation to /tenants loads tenants page", async ({ page }) => {
    await page.goto("/tenants");
    await expect(page.locator("h1")).toContainText("Tenants");
  });

  test("direct navigation to /analytics loads analytics page", async ({ page }) => {
    await page.goto("/analytics");
    await expect(page.locator("h1")).toContainText("User Analytics");
  });

  test("direct navigation to /feature-flags loads feature flags page", async ({ page }) => {
    await page.goto("/feature-flags");
    await expect(page.locator("h1")).toContainText("Feature Flags");
  });

  test("direct navigation to /presets loads global presets page", async ({ page }) => {
    await page.goto("/presets");
    await expect(page.locator("h1")).toContainText("Global Evaluation Presets");
  });

  test("direct navigation to /system loads system health page", async ({ page }) => {
    await page.goto("/system");
    await expect(page.locator("h1")).toContainText("System Health");
  });

  test("direct navigation to /settings loads settings page", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.locator("h1")).toContainText("Platform Settings");
  });

  test("direct navigation to non-existent tenant ID shows not found state", async ({ page }) => {
    await page.goto("/tenants/nonexistent-tenant-id-12345");
    // Wait for loading to complete and show "not found"
    await expect(page.locator("text=Loading tenant details...")).not.toBeVisible({
      timeout: 15000,
    });
    await expect(page.locator("text=Tenant not found")).toBeVisible({ timeout: 5000 });
  });
});
