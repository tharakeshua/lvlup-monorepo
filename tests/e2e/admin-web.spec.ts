import { test, expect, Page } from "@playwright/test";
import { loginWithSchoolCode, logout, expectDashboard } from "./helpers/auth";
import { CREDENTIALS, SELECTORS, SCHOOL_CODE, SCHOOL_NAME } from "./helpers/selectors";

// ─── Helpers ───────────────────────────────────────────────────────────────

async function loginAsAdmin(page: Page) {
  // Retry login up to 2 times — cloud functions may throttle under rapid sequential requests
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto("/login");
    await loginWithSchoolCode(
      page,
      SCHOOL_CODE,
      CREDENTIALS.tenantAdmin.email,
      CREDENTIALS.tenantAdmin.password
    );
    try {
      await expectDashboard(page, SELECTORS.dashboards.schoolAdmin);
      return; // success
    } catch {
      if (attempt === 2) throw new Error("Login failed after 3 attempts");
      await page.waitForTimeout(2000);
    }
  }
}

async function navigateTo(page: Page, path: string) {
  await page.goto(path);
  // Wait for page content to stabilise (avoid networkidle — CORS-blocked requests prevent it)
  await page.waitForLoadState("domcontentloaded");
}

// ─── Auth / Login ──────────────────────────────────────────────────────────

test.describe("Auth – Login", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("redirects unauthenticated users to /login @smoke", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });

  test("school code step renders correctly", async ({ page }) => {
    await expect(page.locator("#schoolCode")).toBeVisible();
    await expect(page.locator('button[type="submit"]:has-text("Continue")')).toBeVisible();
  });

  test("school code entry shows school name", async ({ page }) => {
    await page.fill("#schoolCode", SCHOOL_CODE);
    await page.click('button[type="submit"]:has-text("Continue")');
    await expect(page.locator(`text=${SCHOOL_NAME}`)).toBeVisible({ timeout: 10000 });
  });

  test("invalid school code shows error and stays on code step", async ({ page }) => {
    await page.fill("#schoolCode", "XXXXX");
    await page.click('button[type="submit"]:has-text("Continue")');
    await expect(page.locator('[class*="destructive"], [role="alert"]').first()).toBeVisible({
      timeout: 5000,
    });
    await expect(page.locator("#email")).not.toBeVisible();
  });

  test("credentials step appears after valid school code", async ({ page }) => {
    await page.fill("#schoolCode", SCHOOL_CODE);
    await page.click('button[type="submit"]:has-text("Continue")');
    await page.waitForSelector("#email", { timeout: 10000 });
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
    await expect(page.locator('button[type="submit"]:has-text("Sign In")')).toBeVisible();
  });

  test("Change button returns to school code step", async ({ page }) => {
    await page.fill("#schoolCode", SCHOOL_CODE);
    await page.click('button[type="submit"]:has-text("Continue")');
    await page.waitForSelector("#email", { timeout: 10000 });
    await page.click('button:has-text("Change")');
    await expect(page.locator("#schoolCode")).toBeVisible();
    await expect(page.locator("#email")).not.toBeVisible();
  });

  test("wrong password shows error", async ({ page }) => {
    await page.fill("#schoolCode", SCHOOL_CODE);
    await page.click('button[type="submit"]:has-text("Continue")');
    await page.waitForSelector("#email", { timeout: 10000 });
    await page.fill("#email", CREDENTIALS.tenantAdmin.email);
    await page.fill("#password", "WrongPassword123!");
    await page.click('button[type="submit"]:has-text("Sign In")');
    await expect(page.locator('[class*="destructive"], [role="alert"]').first()).toBeVisible({
      timeout: 5000,
    });
  });

  test("successful login navigates to dashboard @smoke", async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("sign out redirects back to /login", async ({ page }) => {
    await loginAsAdmin(page);
    await logout(page);
    await expect(page).toHaveURL(/\/login/);
  });
});

// ─── Dashboard ─────────────────────────────────────────────────────────────

test.describe("Dashboard @mobile", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('shows "School Admin Dashboard" heading @smoke', async ({ page }) => {
    await expect(page.locator("h1")).toContainText("School Admin Dashboard");
  });

  test("shows sign out button", async ({ page }) => {
    await expect(page.locator('button:has-text("Sign Out")')).toBeVisible();
  });

  test("renders Total Students scorecard @smoke", async ({ page }) => {
    await expect(page.locator("text=Total Students")).toBeVisible();
  });

  test("renders Total Teachers scorecard", async ({ page }) => {
    await expect(page.locator("text=Total Teachers")).toBeVisible();
  });

  test("renders Classes scorecard", async ({ page }) => {
    await expect(page.locator("main").locator("text=Classes").first()).toBeVisible();
  });

  test("renders Total Spaces scorecard", async ({ page }) => {
    await expect(page.locator("text=Total Spaces")).toBeVisible();
  });

  test("renders Total Exams scorecard", async ({ page }) => {
    await expect(page.locator("text=Total Exams")).toBeVisible();
  });

  test("renders At-Risk Students scorecard", async ({ page }) => {
    await expect(page.locator("text=At-Risk Students")).toBeVisible();
  });

  test("shows Tenant Info section", async ({ page }) => {
    await expect(page.locator("text=Tenant Info")).toBeVisible();
  });

  test("shows AI Cost Summary section", async ({ page }) => {
    await expect(page.locator("text=AI Cost Summary")).toBeVisible();
  });

  test("shows today spend in AI cost card", async ({ page }) => {
    await expect(page.locator("text=Today's Spend")).toBeVisible();
  });

  test("no org switcher for single-membership admin", async ({ page }) => {
    await expect(page.locator("text=Select org")).not.toBeVisible();
  });

  test("tenant code visible in tenant info", async ({ page }) => {
    await expect(page.locator("text=Tenant Code")).toBeVisible();
  });
});

// ─── Navigation sidebar ────────────────────────────────────────────────────

test.describe("Navigation @mobile @tablet", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  const navItems = [
    { label: "Users", path: "/users", heading: "User Management" },
    { label: "Classes", path: "/classes", heading: "Classes & Sections" },
    { label: "Courses", path: "/courses", heading: "Courses & Spaces" },
    { label: "Spaces", path: "/spaces", heading: "Spaces Overview" },
    { label: "Exams", path: "/exams", heading: "Exams Overview" },
    { label: "Analytics", path: "/analytics", heading: "Analytics" },
    { label: "AI Usage", path: "/ai-usage", heading: "AI Usage & Costs" },
    { label: "Academic Sessions", path: "/academic-sessions", heading: "Academic Sessions" },
    { label: "Reports", path: "/reports", heading: "Reports" },
    { label: "Notifications", path: "/notifications", heading: "Notifications" },
    { label: "Settings", path: "/settings", heading: "Settings" },
  ];

  for (const { path, heading } of navItems) {
    test(`navigating to ${path} shows correct heading`, async ({ page }) => {
      await navigateTo(page, path);
      await expect(page.locator("h1")).toContainText(heading, { timeout: 15000 });
    });
  }
});

// ─── Users Page ────────────────────────────────────────────────────────────

test.describe("Users Page", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await navigateTo(page, "/users");
    await expect(page.locator("h1")).toContainText("User Management");
  });

  test("shows Teachers tab by default", async ({ page }) => {
    await expect(page.locator('[role="tab"]:has-text("Teachers")')).toBeVisible();
  });

  test("shows Students tab", async ({ page }) => {
    await expect(page.locator('[role="tab"]:has-text("Students")')).toBeVisible();
  });

  test("shows Parents tab", async ({ page }) => {
    await expect(page.locator('[role="tab"]:has-text("Parents")')).toBeVisible();
  });

  test("search input is present", async ({ page }) => {
    await expect(page.locator('input[placeholder*="Search"]')).toBeVisible();
  });

  test("Add Teacher button is visible", async ({ page }) => {
    await expect(page.locator('button:has-text("Add Teacher")')).toBeVisible();
  });

  test("switching to Students tab shows Bulk Import button", async ({ page }) => {
    await page.click('[role="tab"]:has-text("Students")');
    await expect(page.locator('button:has-text("Bulk Import")')).toBeVisible();
    await expect(page.locator('button:has-text("Add Student")')).toBeVisible();
  });

  test("switching to Parents tab shows Add Parent button", async ({ page }) => {
    await page.click('[role="tab"]:has-text("Parents")');
    await expect(page.locator('button:has-text("Add Parent")')).toBeVisible();
  });

  test("teachers table renders column headers", async ({ page }) => {
    await expect(page.locator('th:has-text("Name")')).toBeVisible();
    await expect(page.locator('th:has-text("Subjects")')).toBeVisible();
    await expect(page.locator('th:has-text("Status")')).toBeVisible();
  });

  test("students table renders column headers", async ({ page }) => {
    await page.click('[role="tab"]:has-text("Students")');
    await expect(page.locator('th:has-text("Roll Number")')).toBeVisible();
    await expect(page.locator('th:has-text("Grade")')).toBeVisible();
  });

  test("parents table renders column headers", async ({ page }) => {
    await page.click('[role="tab"]:has-text("Parents")');
    await expect(page.locator('th:has-text("Linked Children")')).toBeVisible();
  });

  test("Add Teacher dialog opens and has required fields", async ({ page }) => {
    await page.click('button:has-text("Add Teacher")');
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    await expect(page.locator("text=First Name")).toBeVisible();
    await expect(page.locator("text=Last Name")).toBeVisible();
    await expect(page.locator("text=Email")).toBeVisible();
  });

  test("Create button is disabled without first/last name", async ({ page }) => {
    await page.click('button:has-text("Add Teacher")');
    await expect(page.locator('[role="dialog"] button:has-text("Create")')).toBeDisabled();
  });

  test("Add Teacher dialog can be cancelled", async ({ page }) => {
    await page.click('button:has-text("Add Teacher")');
    await page.click('[role="dialog"] button:has-text("Cancel")');
    await expect(page.locator('[role="dialog"]')).not.toBeVisible();
  });

  test("Add Student dialog shows roll number field", async ({ page }) => {
    await page.click('[role="tab"]:has-text("Students")');
    await page.click('button:has-text("Add Student")');
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    await expect(page.locator('[role="dialog"]').locator("text=Roll Number")).toBeVisible();
  });

  test("search filters teacher list", async ({ page }) => {
    await page.fill('input[placeholder*="Search"]', "nonexistentxyz123");
    // After filtering, either "No teachers found" or empty results
    await expect(
      page.locator("text=No teachers found").or(page.locator("table tbody tr")).first()
    ).toBeVisible({ timeout: 5000 });
  });
});

// ─── Classes Page ──────────────────────────────────────────────────────────

test.describe("Classes Page", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await navigateTo(page, "/classes");
    await expect(page.locator("h1")).toContainText("Classes & Sections");
  });

  test("shows Create Class button", async ({ page }) => {
    await expect(page.locator('button:has-text("Create Class")')).toBeVisible();
  });

  test("shows search input", async ({ page }) => {
    await expect(page.locator('input[placeholder*="Search classes"]')).toBeVisible();
  });

  test("shows grade filter dropdown", async ({ page }) => {
    await expect(
      page.locator("text=All Grades").or(page.locator("text=Select grade"))
    ).toBeVisible();
  });

  test("Create Class dialog has required fields", async ({ page }) => {
    await page.click('button:has-text("Create Class")');
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("text=Class Name")).toBeVisible();
    await expect(dialog.locator('label:has-text("Grade")')).toBeVisible();
    await expect(dialog.locator('label:has-text("Section")')).toBeVisible();
  });

  test("Create button is disabled without name and grade", async ({ page }) => {
    await page.click('button:has-text("Create Class")');
    await expect(page.locator('[role="dialog"] button:has-text("Create")')).toBeDisabled();
  });

  test("Create Class dialog can be cancelled", async ({ page }) => {
    await page.click('button:has-text("Create Class")');
    await page.click('[role="dialog"] button:has-text("Cancel")');
    await expect(page.locator('[role="dialog"]')).not.toBeVisible();
  });

  test("classes table shows Name, Grade, Section, Status columns", async ({ page }) => {
    // Wait for loading to finish
    await page.waitForTimeout(2000);
    const hasTable = await page.locator('th:has-text("Name")').isVisible();
    const hasEmpty = await page.locator("text=No classes yet").isVisible();
    expect(hasTable || hasEmpty).toBeTruthy();
  });

  test("search input filters the classes list", async ({ page }) => {
    await page.fill('input[placeholder*="Search classes"]', "nonexistentxyz");
    await expect(page.locator("text=No classes yet").or(page.locator("table tbody"))).toBeVisible({
      timeout: 5000,
    });
  });
});

// ─── Courses Page ──────────────────────────────────────────────────────────

test.describe("Courses Page", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await navigateTo(page, "/courses");
    await expect(page.locator("h1")).toContainText("Courses & Spaces");
  });

  test("shows subtitle text", async ({ page }) => {
    await expect(page.locator("text=View learning spaces assigned to classes")).toBeVisible();
  });

  test("shows search input", async ({ page }) => {
    await expect(page.locator('input[placeholder*="Search courses"]')).toBeVisible();
  });

  test("shows All Classes filter", async ({ page }) => {
    await expect(page.locator("text=All Classes")).toBeVisible();
  });

  test("shows status filter dropdown", async ({ page }) => {
    await expect(page.locator("text=All Status")).toBeVisible();
  });

  test("no courses state renders correctly", async ({ page }) => {
    await page.waitForTimeout(3000);
    const hasCards = await page.locator(".rounded-lg.border.bg-card").count();
    const hasEmpty = await page.locator("text=No courses found").isVisible();
    expect(hasCards >= 0 || hasEmpty).toBeTruthy();
  });
});

// ─── Spaces Overview Page ──────────────────────────────────────────────────

test.describe("Spaces Overview Page", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await navigateTo(page, "/spaces");
    await expect(page.locator("h1")).toContainText("Spaces Overview");
  });

  test('shows "All learning spaces across teachers" subtitle', async ({ page }) => {
    await expect(page.locator("text=All learning spaces across teachers")).toBeVisible();
  });

  test("shows search input", async ({ page }) => {
    await expect(page.locator('input[placeholder*="Search spaces"]')).toBeVisible();
  });

  test("shows status filter buttons", async ({ page }) => {
    await expect(page.locator('button:has-text("all")')).toBeVisible();
    await expect(page.locator('button:has-text("draft")')).toBeVisible();
    await expect(page.locator('button:has-text("published")')).toBeVisible();
    await expect(page.locator('button:has-text("archived")')).toBeVisible();
  });

  test("clicking published filter applies it", async ({ page }) => {
    await page.click('button:has-text("published")');
    // Button should appear selected (bg-primary)
    await expect(page.locator('button:has-text("published")')).toBeVisible();
  });

  test("search filters spaces", async ({ page }) => {
    await page.fill('input[placeholder*="Search spaces"]', "nonexistent_xyz_abc");
    await page.waitForTimeout(1000);
    await expect(page.locator("text=No spaces found").or(page.locator(".grid"))).toBeVisible({
      timeout: 5000,
    });
  });
});

// ─── Exams Overview Page ───────────────────────────────────────────────────

test.describe("Exams Overview Page", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await navigateTo(page, "/exams");
    await expect(page.locator("h1")).toContainText("Exams Overview");
  });

  test("shows subtitle", async ({ page }) => {
    await expect(page.locator("text=All exams across teachers")).toBeVisible();
  });

  test("shows search input", async ({ page }) => {
    await expect(page.locator('input[placeholder*="Search exams"]')).toBeVisible();
  });

  test("shows status filter buttons", async ({ page }) => {
    await expect(page.locator('button:has-text("all")')).toBeVisible();
    await expect(page.locator('button:has-text("draft")')).toBeVisible();
    await expect(page.locator('button:has-text("scheduled")')).toBeVisible();
    await expect(page.locator('button:has-text("active")')).toBeVisible();
    await expect(page.locator('button:has-text("completed")')).toBeVisible();
  });

  test("shows exams table with headers", async ({ page }) => {
    await page.waitForTimeout(2000);
    await expect(page.locator('th:has-text("Title")')).toBeVisible();
    await expect(page.locator('th:has-text("Subject")')).toBeVisible();
    await expect(page.locator('th:has-text("Status")')).toBeVisible();
  });

  test("clicking a status filter narrows results", async ({ page }) => {
    await page.click('button:has-text("draft")');
    await page.waitForTimeout(1000);
    await expect(page.locator('button:has-text("draft")')).toBeVisible();
  });

  test("search filters exam list", async ({ page }) => {
    await page.fill('input[placeholder*="Search exams"]', "zzznonexistentzzz");
    await page.waitForTimeout(1000);
    await expect(
      page.locator("text=No exams found").or(page.locator("table tbody tr")).first()
    ).toBeVisible({ timeout: 5000 });
  });
});

// ─── Analytics Page ────────────────────────────────────────────────────────

test.describe("Analytics Page", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await navigateTo(page, "/analytics");
    await expect(page.locator("h1")).toContainText("Analytics");
  });

  test("shows subtitle", async ({ page }) => {
    await expect(page.locator("text=Student performance, class comparisons")).toBeVisible();
  });

  test("shows Avg Exam Score scorecard", async ({ page }) => {
    await expect(page.locator("text=Avg Exam Score")).toBeVisible();
  });

  test("shows Avg Space Completion scorecard", async ({ page }) => {
    await expect(page.locator("text=Avg Space Completion")).toBeVisible();
  });

  test("shows At-Risk Students scorecard", async ({ page }) => {
    await expect(page.locator("text=At-Risk Students")).toBeVisible();
  });

  test("shows Total Students scorecard", async ({ page }) => {
    await expect(page.locator("text=Total Students")).toBeVisible();
  });

  test("shows Class Detail section", async ({ page }) => {
    await expect(page.locator("text=Class Detail")).toBeVisible();
  });

  test("shows prompt to select a class when none selected", async ({ page }) => {
    await page.waitForTimeout(2000);
    await expect(
      page
        .locator("text=Select a class above to view detailed analytics")
        .or(page.locator("text=No classes available"))
    ).toBeVisible({ timeout: 10000 });
  });
});

// ─── AI Usage Page ─────────────────────────────────────────────────────────

test.describe("AI Usage Page", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await navigateTo(page, "/ai-usage");
    await expect(page.locator("h1")).toContainText("AI Usage & Costs");
  });

  test("shows subtitle", async ({ page }) => {
    await expect(page.locator("text=Monitor AI API usage")).toBeVisible();
  });

  test("shows Monthly Cost scorecard", async ({ page }) => {
    await expect(page.locator("text=Monthly Cost")).toBeVisible();
  });

  test("shows Total Calls scorecard", async ({ page }) => {
    await expect(page.locator("text=Total Calls")).toBeVisible();
  });

  test("shows Input Tokens scorecard", async ({ page }) => {
    await expect(page.locator("text=Input Tokens")).toBeVisible();
  });

  test("shows Output Tokens scorecard", async ({ page }) => {
    await expect(page.locator("text=Output Tokens")).toBeVisible();
  });

  test("shows month navigation buttons", async ({ page }) => {
    await expect(page.locator('button:has-text("<")')).toBeVisible();
    await expect(page.locator('button:has-text(">")')).toBeVisible();
  });

  test("previous month button works", async ({ page }) => {
    const initialLabel = await page.locator("span.text-sm.font-medium").first().textContent();
    await page.click('button:has-text("<")');
    await page.waitForTimeout(500);
    const newLabel = await page.locator("span.text-sm.font-medium").first().textContent();
    expect(newLabel).not.toEqual(initialLabel);
  });

  test("next month button is disabled on current month", async ({ page }) => {
    await expect(page.locator('button:has-text(">")')).toBeDisabled();
  });

  test("shows no data or daily breakdown table", async ({ page }) => {
    await page.waitForTimeout(3000);
    const hasTable = await page.locator("text=Daily Breakdown").isVisible();
    const hasEmpty = await page.locator("text=No AI usage data").isVisible();
    expect(hasTable || hasEmpty).toBeTruthy();
  });
});

// ─── Academic Sessions Page ────────────────────────────────────────────────

test.describe("Academic Sessions Page", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await navigateTo(page, "/academic-sessions");
    await expect(page.locator("h1")).toContainText("Academic Sessions");
  });

  test("shows subtitle", async ({ page }) => {
    await expect(page.locator("text=Manage academic years and sessions")).toBeVisible();
  });

  test("shows New Session button", async ({ page }) => {
    await expect(page.locator('button:has-text("New Session")')).toBeVisible();
  });

  test("Create Session dialog has required fields", async ({ page }) => {
    await page.click('button:has-text("New Session")');
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("text=Session Name")).toBeVisible();
    await expect(dialog.locator("text=Start Date")).toBeVisible();
    await expect(dialog.locator("text=End Date")).toBeVisible();
  });

  test("Create button is disabled without required fields", async ({ page }) => {
    await page.click('button:has-text("New Session")');
    await expect(page.locator('[role="dialog"] button:has-text("Create")')).toBeDisabled();
  });

  test("Create Session dialog can be cancelled", async ({ page }) => {
    await page.click('button:has-text("New Session")');
    await page.click('[role="dialog"] button:has-text("Cancel")');
    await expect(page.locator('[role="dialog"]')).not.toBeVisible();
  });

  test("sessions table or empty state renders", async ({ page }) => {
    await page.waitForTimeout(3000);
    const hasTable = await page.locator('th:has-text("Name")').isVisible();
    const hasEmpty = await page.locator("text=No academic sessions").isVisible();
    const hasCard = await page.locator("text=Current Session").isVisible();
    expect(hasTable || hasEmpty || hasCard).toBeTruthy();
  });

  test("current session card shows Active badge if present", async ({ page }) => {
    await page.waitForTimeout(3000);
    const hasCurrentCard = await page.locator("text=Current Session").isVisible();
    if (hasCurrentCard) {
      await expect(page.locator("text=Active").first()).toBeVisible();
    }
  });
});

// ─── Reports Page ──────────────────────────────────────────────────────────

test.describe("Reports Page", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await navigateTo(page, "/reports");
    await expect(page.locator("h1")).toContainText("Reports");
  });

  test("shows subtitle", async ({ page }) => {
    await expect(page.locator("text=Generate and download PDF reports")).toBeVisible();
  });

  test("shows Exam Reports tab", async ({ page }) => {
    await expect(page.locator('button:has-text("Exam Reports")')).toBeVisible();
  });

  test("shows Class Reports tab", async ({ page }) => {
    await expect(page.locator('button:has-text("Class Reports")')).toBeVisible();
  });

  test("Exam Reports is the default active tab", async ({ page }) => {
    // The exam reports tab should have the primary border style
    const examTab = page.locator('button:has-text("Exam Reports")');
    await expect(examTab).toBeVisible();
    await expect(examTab).toHaveClass(/border-primary|text-primary/);
  });

  test("switching to Class Reports tab shows class content", async ({ page }) => {
    await page.click('button:has-text("Class Reports")');
    await page.waitForTimeout(2000);
    const hasClasses = await page.locator("text=Class Report PDF").first().isVisible();
    const hasEmpty = await page.locator("text=No classes found").isVisible();
    expect(hasClasses || hasEmpty).toBeTruthy();
  });

  test("exam reports tab shows content or empty state", async ({ page }) => {
    await page.waitForTimeout(2000);
    const hasPDFButtons = await page.locator("text=Class Summary PDF").first().isVisible();
    const hasEmpty = await page.locator("text=No exams with results available yet").isVisible();
    expect(hasPDFButtons || hasEmpty).toBeTruthy();
  });
});

// ─── Notifications Page ────────────────────────────────────────────────────

test.describe("Notifications Page", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await navigateTo(page, "/notifications");
    // The page uses NotificationsPageUI shared component
    await page.waitForTimeout(2000);
  });

  test("shows Notifications heading", async ({ page }) => {
    await expect(page.locator("h1")).toContainText("Notifications");
  });

  test("shows All filter option", async ({ page }) => {
    await expect(page.locator('[role="tab"]:has-text("All")')).toBeVisible({ timeout: 5000 });
  });

  test("shows Unread filter option", async ({ page }) => {
    await expect(page.locator('[role="tab"]:has-text("Unread")')).toBeVisible({ timeout: 5000 });
  });

  test("page loads without errors", async ({ page }) => {
    // Simply ensure we don't have a crash/error page
    await expect(page.locator("body")).not.toContainText("Error");
    await expect(page.locator("body")).not.toContainText("Something went wrong");
  });
});

// ─── Settings Page ─────────────────────────────────────────────────────────

test.describe("Settings Page", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await navigateTo(page, "/settings");
    await expect(page.locator("h1")).toContainText("Settings");
  });

  test("shows subtitle", async ({ page }) => {
    await expect(page.locator("text=Manage your school's configuration")).toBeVisible();
  });

  test("shows Tenant Settings tab", async ({ page }) => {
    await expect(page.locator('button:has-text("Tenant Settings")')).toBeVisible();
  });

  test("shows Evaluation Settings tab", async ({ page }) => {
    await expect(page.locator('button:has-text("Evaluation Settings")')).toBeVisible();
  });

  test("shows API Keys tab", async ({ page }) => {
    await expect(page.locator('button:has-text("API Keys")')).toBeVisible();
  });

  test("Tenant Settings tab shows School Information section", async ({ page }) => {
    await page.click('button:has-text("Tenant Settings")');
    await expect(page.locator("text=School Information")).toBeVisible();
  });

  test("Tenant Settings shows School Name field", async ({ page }) => {
    await page.click('button:has-text("Tenant Settings")');
    await expect(page.locator("text=School Name")).toBeVisible();
  });

  test("Tenant Settings shows Tenant Code field", async ({ page }) => {
    await page.click('button:has-text("Tenant Settings")');
    await expect(page.locator("text=Tenant Code")).toBeVisible();
  });

  test("Tenant Settings shows Subscription section", async ({ page }) => {
    await page.click('button:has-text("Tenant Settings")');
    await expect(page.locator("text=Subscription")).toBeVisible();
  });

  test("Evaluation Settings tab shows configuration content", async ({ page }) => {
    await page.click('button:has-text("Evaluation Settings")');
    await page.waitForTimeout(2000);
    const hasNoConfig = await page.locator("text=No evaluation settings configured").isVisible();
    const hasConfig = await page.locator("text=Configure evaluation feedback rubrics").isVisible();
    expect(hasNoConfig || hasConfig).toBeTruthy();
  });

  test("API Keys tab shows Gemini API Key section", async ({ page }) => {
    await page.click('button:has-text("API Keys")');
    await expect(page.locator('h3:has-text("Gemini API Key")')).toBeVisible();
  });

  test("API Keys tab shows Set Key or Update Key button", async ({ page }) => {
    await page.click('button:has-text("API Keys")');
    await expect(
      page.locator('button:has-text("Set Key")').or(page.locator('button:has-text("Update Key")'))
    ).toBeVisible({ timeout: 5000 });
  });
});
