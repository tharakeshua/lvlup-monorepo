---
name: seed-test-automation
description:
  Auto-generate Playwright E2E tests from seed data configurations. Templates
  for all 5 Auto-LevelUp apps with credential injection, entity verification,
  and cross-role consistency checks.
origin: custom
---

# Seed Test Automation

Patterns for auto-generating Playwright E2E tests based on seeded data in the
Auto-LevelUp platform.

## When to Activate

- Generating E2E tests after seeding data
- Creating test specs that verify seeded entities across apps
- Building data-driven test templates
- Verifying cross-app data consistency
- Adding test credentials for new seed datasets

## Project Context

- **Test framework**: Playwright 1.58.2
- **Test directory**: `tests/e2e/`
- **Config**: `playwright.config.ts`
- **Helpers**: `tests/e2e/helpers/selectors.ts`
- **5 test projects**: super-admin, admin-web, teacher-web, student-web,
  parent-web
- **App ports**: super-admin (4567), admin-web (4568), teacher-web (4569),
  student-web (4570), parent-web (4571)

## Test Generation from Seed Config

Given a seed config, generate tests using these templates:

### 1. Add Credentials to Helpers

```typescript
// tests/e2e/helpers/selectors.ts
export const SEED_CREDENTIALS = {
  "{configName}Admin": { email: "{admin_email}", password: "{password}" },
  "{configName}Teacher": { email: "{teacher_email}", password: "{password}" },
  "{configName}Student": { email: "{student_email}", password: "{password}" },
  "{configName}Parent": { email: "{parent_email}", password: "{password}" },
};
export const SCHOOL_CODE = "{tenant_code}";
```

### 2. Test File Structure

```typescript
// tests/e2e/{slug}-e2e.spec.ts
import { test, expect } from "@playwright/test";

// Import or define credentials
const CREDENTIALS = {
  admin: { email: "...", password: "..." },
  teacher: { email: "...", password: "..." },
  student: { email: "...", password: "..." },
  parent: { email: "...", password: "..." },
};
const SCHOOL_CODE = "...";
const TENANT_NAME = "...";
const SPACE_TITLE = "...";
```

### 3. Login Helper Pattern

```typescript
async function loginToApp(
  page: Page,
  port: number,
  email: string,
  password: string,
  schoolCode?: string
) {
  await page.goto(`http://localhost:${port}`);

  // If school code is required (admin, teacher, student, parent apps)
  if (schoolCode) {
    await page.getByPlaceholder(/school code/i).fill(schoolCode);
    await page.getByRole("button", { name: /continue|next/i }).click();
  }

  await page.getByPlaceholder(/email/i).fill(email);
  await page.getByPlaceholder(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in|log in/i }).click();

  // Wait for dashboard
  await page.waitForURL(/dashboard|home/i, { timeout: 15000 });
}
```

### 4. Per-App Test Templates

#### Super Admin Tests (port 4567)

```typescript
test.describe("Super Admin - {TenantName}", () => {
  test("should verify tenant exists", async ({ page }) => {
    await loginToApp(page, 4567, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD);
    // Navigate to tenants
    await page.getByRole("link", { name: /tenants/i }).click();
    // Verify tenant in list
    await expect(page.getByText(TENANT_NAME)).toBeVisible();
  });

  test("should view tenant details", async ({ page }) => {
    await loginToApp(page, 4567, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD);
    await page.getByRole("link", { name: /tenants/i }).click();
    await page.getByText(TENANT_NAME).click();
    await expect(page.getByText(SCHOOL_CODE)).toBeVisible();
    await expect(page.getByText(/active/i)).toBeVisible();
  });
});
```

#### Admin Tests (port 4568)

```typescript
test.describe("Admin - {TenantName}", () => {
  test("should login and see dashboard", async ({ page }) => {
    await loginToApp(
      page,
      4568,
      CREDENTIALS.admin.email,
      CREDENTIALS.admin.password,
      SCHOOL_CODE
    );
    await expect(page.getByText(TENANT_NAME)).toBeVisible();
  });

  test("should verify classes exist", async ({ page }) => {
    // Navigate to classes section
    // Verify each class from seed config is visible
    for (const cls of SEEDED_CLASSES) {
      await expect(page.getByText(cls.name)).toBeVisible();
    }
  });

  test("should verify teachers", async ({ page }) => {
    // Navigate to teachers
    // Verify each teacher from seed config
  });

  test("should verify students", async ({ page }) => {
    // Navigate to students
    // Verify student count and names
  });

  test("should verify spaces", async ({ page }) => {
    // Navigate to spaces/LevelUp
    // Verify space title is visible
    await expect(page.getByText(SPACE_TITLE)).toBeVisible();
  });
});
```

#### Teacher Tests (port 4569)

```typescript
test.describe("Teacher - {SpaceTitle}", () => {
  test("should see assigned space", async ({ page }) => {
    await loginToApp(
      page,
      4569,
      CREDENTIALS.teacher.email,
      CREDENTIALS.teacher.password,
      SCHOOL_CODE
    );
    await expect(page.getByText(SPACE_TITLE)).toBeVisible();
  });

  test("should view story points", async ({ page }) => {
    // Click into space
    // Verify each story point title
    for (const sp of SEEDED_STORY_POINTS) {
      await expect(page.getByText(sp.title)).toBeVisible();
    }
  });

  test("should view items in story point", async ({ page }) => {
    // Click into first story point
    // Verify item count matches seed config
  });
});
```

#### Student Tests (port 4570)

```typescript
test.describe("Student - {SpaceTitle}", () => {
  test("should see published space", async ({ page }) => {
    await loginToApp(
      page,
      4570,
      CREDENTIALS.student.email,
      CREDENTIALS.student.password,
      SCHOOL_CODE
    );
    // Navigate to spaces
    await expect(page.getByText(SPACE_TITLE)).toBeVisible();
  });

  test("should answer MCQ question", async ({ page }) => {
    // Navigate to story point with MCQ
    // Select correct option
    // Submit and verify score
  });

  test("should take quiz", async ({ page }) => {
    // Navigate to quiz story point
    // Verify quiz mode UI
    // Answer questions
    // Submit and check results
  });

  test("should take timed test", async ({ page }) => {
    // Navigate to timed test
    // Verify timer is visible
    // Answer questions
    // Submit before timer
  });
});
```

#### Parent Tests (port 4571)

```typescript
test.describe("Parent - {StudentName}", () => {
  test("should see linked student", async ({ page }) => {
    await loginToApp(
      page,
      4571,
      CREDENTIALS.parent.email,
      CREDENTIALS.parent.password,
      SCHOOL_CODE
    );
    await expect(page.getByText(STUDENT_NAME)).toBeVisible();
  });

  test("should view student progress", async ({ page }) => {
    // Navigate to student progress
    // Verify space progress is visible
    await expect(page.getByText(SPACE_TITLE)).toBeVisible();
  });
});
```

### 5. Cross-App Consistency Matrix

Generate verification tests based on this matrix:

| Entity       | Super Admin     | Admin          | Teacher          | Student       | Parent         |
| ------------ | --------------- | -------------- | ---------------- | ------------- | -------------- |
| Tenant       | visible in list | dashboard name | login context    | login context | login context  |
| Class        | -               | class list     | assigned classes | -             | -              |
| Space        | -               | space list     | space detail     | space browse  | progress view  |
| Story Points | -               | count          | detail + items   | interactive   | -              |
| Submissions  | -               | summary        | analytics        | results       | child progress |

### 6. Test Run Commands

```bash
# All tests for a seed dataset
pnpm run test:e2e -- --grep "{DatasetName}"

# Per-app
pnpm run test:e2e:super-admin -- --grep "{DatasetName}"
pnpm run test:e2e:admin-web -- --grep "{DatasetName}"
pnpm run test:e2e:teacher-web -- --grep "{DatasetName}"
pnpm run test:e2e:student-web -- --grep "{DatasetName}"
pnpm run test:e2e:parent-web -- --grep "{DatasetName}"
```

### 7. Test Data File Pattern

After seeding, write test data to a JSON file for test consumption:

```typescript
// scripts/seed-results/{name}.json
{
  "tenantId": "tenant_xxx",
  "tenantCode": "XXX001",
  "tenantName": "School Name",
  "credentials": {
    "admin": { "email": "...", "password": "..." },
    "teacher": { "email": "...", "password": "..." },
    "student": { "email": "...", "password": "..." },
    "parent": { "email": "...", "password": "..." }
  },
  "entities": {
    "classes": [{ "id": "...", "name": "..." }],
    "spaces": [{ "id": "...", "title": "...", "storyPointCount": 4 }],
    "studentName": "Test Student",
    "teacherName": "Teacher Name"
  }
}
```

Tests import this JSON to parameterize assertions:

```typescript
import seedResults from "../../scripts/seed-results/{name}.json";

const { credentials, entities, tenantName } = seedResults;
```

### 8. Visual Regression Baseline

After initial test pass, capture visual baselines:

```bash
pnpm run test:e2e -- --grep "{DatasetName}" --update-snapshots
```
