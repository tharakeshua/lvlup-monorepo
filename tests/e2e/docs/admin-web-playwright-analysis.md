# Admin-Web Playwright E2E Test Analysis

**Date:** 2026-03-02 **App:** admin-web (School Admin Portal) **Base URL:**
http://localhost:4568 **Test File:** `tests/e2e/admin-web.spec.ts` **Total
Tests:** 116

---

## Pages Tested

| Page               | Route                | Component File            |
| ------------------ | -------------------- | ------------------------- |
| Login              | `/login`             | `LoginPage.tsx`           |
| Dashboard          | `/`                  | `DashboardPage.tsx`       |
| User Management    | `/users`             | `UsersPage.tsx`           |
| Classes & Sections | `/classes`           | `ClassesPage.tsx`         |
| Courses & Spaces   | `/courses`           | `CoursesPage.tsx`         |
| Spaces Overview    | `/spaces`            | `SpacesOverviewPage.tsx`  |
| Exams Overview     | `/exams`             | `ExamsOverviewPage.tsx`   |
| Analytics          | `/analytics`         | `AnalyticsPage.tsx`       |
| AI Usage & Costs   | `/ai-usage`          | `AIUsagePage.tsx`         |
| Academic Sessions  | `/academic-sessions` | `AcademicSessionPage.tsx` |
| Reports            | `/reports`           | `ReportsPage.tsx`         |
| Notifications      | `/notifications`     | `NotificationsPage.tsx`   |
| Settings           | `/settings`          | `SettingsPage.tsx`        |

---

## Test Cases by Suite

### Auth – Login (9 tests)

- Redirects unauthenticated users to `/login`
- School code step renders correctly
- School code entry shows school name (Springfield Academy)
- Invalid school code shows error and stays on code step
- Credentials step appears after valid school code
- Change button returns to school code step
- Wrong password shows error
- Successful login navigates to dashboard
- Sign out redirects back to `/login`

### Dashboard (10 tests)

- Shows "School Admin Dashboard" h1 heading
- Shows Sign Out button
- Renders Total Students scorecard
- Renders Total Teachers scorecard
- Renders Classes scorecard
- Renders Total Spaces scorecard
- Renders Total Exams scorecard
- Renders At-Risk Students scorecard
- Shows Tenant Info section
- Shows AI Cost Summary section with Today's Spend
- No org switcher for single-membership admin
- Tenant Code visible in tenant info

### Navigation (11 tests)

Verifies that navigating directly to each route renders the correct `h1`
heading:

- `/users` → "User Management"
- `/classes` → "Classes & Sections"
- `/courses` → "Courses & Spaces"
- `/spaces` → "Spaces Overview"
- `/exams` → "Exams Overview"
- `/analytics` → "Analytics"
- `/ai-usage` → "AI Usage & Costs"
- `/academic-sessions` → "Academic Sessions"
- `/reports` → "Reports"
- `/notifications` → "Notifications"
- `/settings` → "Settings"

### Users Page (14 tests)

- Shows Teachers / Students / Parents tabs
- Search input present
- Add Teacher / Add Student / Add Parent buttons
- Bulk Import button visible on Students tab
- Teachers table column headers (UID, Subjects, Status)
- Students table column headers (Roll Number, Grade)
- Parents table column headers (Linked Children)
- Add Teacher dialog opens with First Name, Last Name, Email fields
- Create button disabled without required name fields
- Dialog can be cancelled
- Add Student dialog shows Roll Number field
- Search filters teacher list

### Classes Page (9 tests)

- Create Class button visible
- Search input present
- Grade filter dropdown present
- Create Class dialog has Class Name, Grade, Section fields
- Create button disabled without name and grade
- Dialog can be cancelled
- Table headers (Name, Grade, Section, Status) or empty state
- Search input filters classes

### Courses Page (5 tests)

- Subtitle text visible
- Search input present
- All Classes filter present
- All Status filter dropdown present
- Cards or empty state renders correctly

### Spaces Overview Page (5 tests)

- Subtitle "All learning spaces across teachers" visible
- Search input present
- Status filter buttons: all, draft, published, archived
- Clicking published filter applies it
- Search filters spaces

### Exams Overview Page (6 tests)

- Subtitle "All exams across teachers" visible
- Search input present
- Status filter buttons: all, draft, scheduled, active, completed
- Table headers: Title, Subject, Status
- Clicking a status filter narrows results
- Search filters exam list

### Analytics Page (8 tests)

- Subtitle text visible
- Avg Exam Score scorecard
- Avg Space Completion scorecard
- At-Risk Students scorecard
- Total Students scorecard
- Class Detail section visible
- Prompt to select a class (or "No classes available") shown when none selected

### AI Usage Page (8 tests)

- Subtitle visible
- Monthly Cost, Total Calls, Input Tokens, Output Tokens scorecards
- Month navigation < > buttons present
- Previous month button changes the month label
- Next month button is disabled on current month
- Daily breakdown table or empty state renders

### Academic Sessions Page (8 tests)

- Subtitle visible
- New Session button present
- Create Session dialog has Session Name, Start Date, End Date fields
- Create button disabled without required fields
- Dialog can be cancelled
- Sessions table, empty state, or current session card renders
- Current session shows Active badge when present

### Reports Page (7 tests)

- Subtitle "Generate and download PDF reports" visible
- Exam Reports tab present
- Class Reports tab present
- Exam Reports is the default active tab (has primary border)
- Switching to Class Reports shows classes or empty state
- Exam tab shows PDF buttons or empty state

### Notifications Page (4 tests)

- Shows Notifications h1 heading
- Shows All filter option
- Shows Unread filter option
- Page loads without errors/crash

### Settings Page (12 tests)

- Subtitle visible
- Tenant Settings tab present
- Evaluation Settings tab present
- API Keys tab present
- Tenant Settings → School Information section
- School Name field visible
- Tenant Code field visible
- Subscription section visible
- Evaluation Settings → config content or empty state
- API Keys → Gemini API Key section visible
- API Keys → Set Key or Update Key button visible

---

## Selectors Used

### ID Selectors

| Selector      | Usage                            |
| ------------- | -------------------------------- |
| `#schoolCode` | Login step 1 — school code input |
| `#email`      | Login step 2 — email input       |
| `#password`   | Login step 2 — password input    |

### Text / Has-Text Selectors

| Selector                                                                             | Usage                      |
| ------------------------------------------------------------------------------------ | -------------------------- |
| `button[type="submit"]:has-text("Continue")`                                         | Submit school code         |
| `button[type="submit"]:has-text("Sign In")`                                          | Submit credentials         |
| `button:has-text("Sign Out")`                                                        | Logout                     |
| `button:has-text("Change")`                                                          | Return to school code step |
| `button:has-text("Add Teacher")`                                                     | Open create teacher dialog |
| `button:has-text("Add Student")`                                                     | Open create student dialog |
| `button:has-text("Add Parent")`                                                      | Open create parent dialog  |
| `button:has-text("Bulk Import")`                                                     | Open bulk import dialog    |
| `button:has-text("Create Class")`                                                    | Open create class dialog   |
| `button:has-text("New Session")`                                                     | Open create session dialog |
| `button:has-text("Cancel")`                                                          | Cancel any dialog          |
| `button:has-text("Create")`                                                          | Submit create dialogs      |
| `button:has-text("Exam Reports")`                                                    | Reports tab                |
| `button:has-text("Class Reports")`                                                   | Reports tab                |
| `button:has-text("Tenant Settings")`                                                 | Settings tab               |
| `button:has-text("Evaluation Settings")`                                             | Settings tab               |
| `button:has-text("API Keys")`                                                        | Settings tab               |
| `button:has-text("all/draft/published/archived/scheduled/active/completed/grading")` | Status filter buttons      |

### Role Selectors

| Selector                            | Usage              |
| ----------------------------------- | ------------------ |
| `[role="tab"]:has-text("Teachers")` | Users page tab     |
| `[role="tab"]:has-text("Students")` | Users page tab     |
| `[role="tab"]:has-text("Parents")`  | Users page tab     |
| `[role="dialog"]`                   | All modals/dialogs |
| `[role="alert"]`                    | Error messages     |

### Attribute Selectors

| Selector                               | Usage                                 |
| -------------------------------------- | ------------------------------------- |
| `[class*="destructive"]`               | Error/destructive toast notifications |
| `input[placeholder*="Search"]`         | Generic search inputs                 |
| `input[placeholder*="Search classes"]` | Classes page search                   |
| `input[placeholder*="Search courses"]` | Courses page search                   |
| `input[placeholder*="Search spaces"]`  | Spaces page search                    |
| `input[placeholder*="Search exams"]`   | Exams page search                     |

### Text Content Selectors

| Selector                                    | Usage                                |
| ------------------------------------------- | ------------------------------------ |
| `text=Springfield Academy`                  | School name display after code entry |
| `text=School Admin Dashboard`               | Dashboard h1 verification            |
| `text=Total Students/Teachers/Spaces/Exams` | Score card labels                    |
| `text=At-Risk Students`                     | Score card label                     |
| `text=AI Cost Summary`                      | Dashboard section                    |
| `text=Today's Spend`                        | AI cost sub-label                    |
| `text=Tenant Info`                          | Dashboard section                    |
| `text=Tenant Code`                          | Tenant info field                    |
| `text=School Information`                   | Settings section                     |
| `text=Subscription`                         | Settings section                     |
| `text=Gemini API Key`                       | Settings API tab section             |
| `text=Class Detail`                         | Analytics section                    |
| `th:has-text("...")`                        | Table header verification            |

### Element / Structural Selectors

| Selector                                     | Usage                     |
| -------------------------------------------- | ------------------------- |
| `h1`                                         | Page heading verification |
| `table tbody tr`                             | Table row presence        |
| `.rounded-lg.border.bg-card`                 | Course/space cards        |
| `span.text-sm.font-medium`                   | Month label in AI Usage   |
| `button:has-text("<"), button:has-text(">")` | Month navigation          |

---

## Helper Functions Used

From `tests/e2e/helpers/auth.ts`:

- `loginWithSchoolCode(page, schoolCode, email, password)` — two-step login
- `logout(page)` — clicks Sign Out and waits for redirect
- `expectDashboard(page, heading)` — waits for h1 to contain heading text

From `tests/e2e/helpers/selectors.ts`:

- `CREDENTIALS.tenantAdmin` —
  `{ email: 'admin@springfield.test', password: 'TenantAdmin123!' }`
- `SCHOOL_CODE` — `'SPR001'`
- `SCHOOL_NAME` — `'Springfield Academy'`
- `SELECTORS.dashboards.schoolAdmin` — `'School Admin Dashboard'`

Custom helpers (defined inline):

- `loginAsAdmin(page)` — navigates to `/login` + calls `loginWithSchoolCode` +
  `expectDashboard`
- `navigateTo(page, path)` — `page.goto(path)` +
  `waitForLoadState('networkidle')`

---

## Config Change

**File:** `playwright.config.ts` **Change:** Updated `admin-web` project
`baseURL`

```diff
- use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:3001' },
+ use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:4568' },
```

---

## Issues Found / Notes

1. **Login flow is two-step** — school code must be submitted first; the
   credentials form (`#email`, `#password`) only appears after a valid code is
   accepted. Tests account for this ordering.

2. **Data-dependent tests** — Many pages (Analytics class drill-down, AI Usage
   chart, Reports PDF buttons) behave differently depending on whether seed data
   exists. Tests use `.or()` combinator patterns to handle both "data present"
   and "empty state" scenarios, making them robust regardless of DB state.

3. **Shared component for Notifications** — `NotificationsPage.tsx` delegates
   entirely to `NotificationsPageUI` from `@levelup/shared-ui`. The internal
   filter state (`All` / `Unread`) may render as tabs or buttons depending on
   the shared component version. Tests use `.or()` to accommodate both patterns.

4. **Reports tab active state** — The Reports page uses `border-primary` +
   `text-primary` CSS classes (not ARIA `aria-selected`) to indicate the active
   tab. The test checks `toHaveClass(/border-primary|text-primary/)`
   accordingly.

5. **`networkidle` wait** — `navigateTo()` uses
   `waitForLoadState('networkidle')` to ensure Firebase queries complete before
   assertions. Some pages with heavy data fetching (Analytics, AI Usage)
   additionally use `waitForTimeout(2000–3000)` as a safety margin.

6. **No destructive/write tests** — Tests intentionally avoid actually
   submitting create/edit/delete operations to prevent polluting the test
   database. Dialog open/cancel flows are tested without form submission.

7. **Month navigation in AI Usage** — The "next month" button has a `disabled`
   attribute when `monthOffset >= 0`. This is verified with `toBeDisabled()`.
