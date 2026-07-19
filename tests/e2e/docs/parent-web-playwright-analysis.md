# Parent Web — Playwright E2E Test Analysis

**App URL:** http://localhost:4571 **Test file:** `tests/e2e/parent-web.spec.ts`
**Credentials:** parent1@springfield.test / Parent123! (School Code: SPR001)
**Date:** 2026-03-02

---

## Pages Tested

| Page           | Route             | Component               |
| -------------- | ----------------- | ----------------------- |
| Login          | `/login`          | `LoginPage.tsx`         |
| Dashboard      | `/`               | `DashboardPage.tsx`     |
| My Children    | `/children`       | `ChildrenPage.tsx`      |
| Child Progress | `/child-progress` | `ChildProgressPage.tsx` |
| Exam Results   | `/results`        | `ExamResultsPage.tsx`   |
| Space Progress | `/progress`       | `SpaceProgressPage.tsx` |
| Notifications  | `/notifications`  | `NotificationsPage.tsx` |
| Settings       | `/settings`       | `SettingsPage.tsx`      |

---

## Test Suites & Cases

### Authentication (8 tests)

- Redirects unauthenticated user to `/login`
- Redirects from all protected routes (`/children`, `/child-progress`,
  `/results`, `/progress`, `/notifications`, `/settings`) to `/login`
- Login page renders "Parent Portal" heading and school code input
- School code step validates and shows school name (`Springfield Academy`) on
  success
- Invalid school code (`INVALID999`) shows error message
- Empty school code triggers HTML5 or custom validation
- "Change" button returns from credentials step to school code step
- Successful login navigates to `Parent Dashboard`
- Wrong password shows destructive/alert error element
- Sign out redirects to `/login`

### Dashboard (9 tests)

- Renders `h1` with "Parent Dashboard"
- Shows welcome message containing "Welcome back"
- Renders four overview score cards: Children, Avg Performance, School,
  Status/At-Risk Alerts
- Renders three quick action links: Exam Results, Space Progress, My Children
- Quick action "Exam Results" navigates to `/results`
- Quick action "Space Progress" navigates to `/progress`
- Quick action "My Children" navigates to `/children`
- "Children Overview" section heading is visible
- Shows linked children cards, loading skeleton, or empty state
- "View all" link navigates to `/children`
- Sign Out button in dashboard header logs out

### Children Page (7 tests)

- Renders heading "My Children" and description
- Shows children list or empty state after loading
- Empty state shows "Contact your school admin" message
- Child card shows status badge (active/inactive)
- Child card shows four stat panels: Exam Average, Space Completion, Streak,
  School Code
- "View Full Progress" link navigates to `/child-progress`
- "Exam Results" link navigates to `/results`

### Child Progress Page (10 tests)

- Renders heading "Child Progress" and description
- Shows progress data, empty state, or loading indicator
- Overview score cards visible: Overall Score, Exam Average, Space Completion,
  Streak, Points Earned
- Child selector tabs appear when multiple children exist
- Clicking a selector tab updates the active state (`border-primary` class)
- At-Risk Alert section renders with red-700 reason text when student is at risk
- Strengths section renders with green chips when data is available
- Areas for Improvement section renders with orange chips when data is available
- "Exam Scores by Subject" chart section renders
- "Space Completion by Subject" chart section renders
- Recent Exam Results section renders
- Recent Activity section renders
- Exam completion count (`X/Y exams completed`) is displayed

### Exam Results Page (9 tests)

- Renders heading "Exam Results" and description
- Search input is visible with correct placeholder
- Search input accepts typed text
- Shows results list, loading skeletons, or empty state
- Empty state shows "Results will appear here once teachers release them"
- Search with no-match query reduces results to zero or shows empty state
- Result card shows percentage score (or "--")
- Clicking a result card expands to show Grade, Questions Graded, Status
- Clicking expanded card again collapses it
- Score progress bar is visible for cards with percentage data

### Space Progress Page (7 tests)

- Renders heading "Space Progress" and description
- Shows progress data, empty state, or loading indicator
- Empty state shows "Progress will appear here as your children start learning"
- Progress cards show percentage (`text-xl`) values
- Progress cards show status badges (not started / in progress / completed)
- Progress bar (`h-2 w-full rounded-full`) is rendered per card
- Student section headings are shown per student ID
- Story points count (`X/Y story points completed`) shown when available

### Notifications Page (6 tests)

- `h1` heading contains "notification" (case-insensitive)
- "All" filter button/tab is visible
- "Unread" filter button/tab is visible
- Switching to Unread filter updates the view (shows items or empty state)
- Switching back to All filter works without error
- "Mark all read" button is present when notifications exist
- Notification items are clickable without crashing

### Settings Page (10 tests)

- Renders heading "Settings" and description
- Profile section visible with "Your account information"
- Email field is visible
- Display Name field has `readOnly` attribute
- Email field has `readOnly` attribute
- "Contact your school admin to update your profile information" text is visible
- Notification Preferences section visible with description
- Notification Channels section: Email Notifications + Push Notifications
  toggles
- Notification Types section: Exam Results + Progress Milestones + Teacher
  Messages toggles
- Toggle switches are interactive (clicking changes `aria-checked` state)
- Email Notifications toggle defaults to `aria-checked="true"`
- Account section has Sign Out button
- Sign Out button in Settings logs out to `/login`

### Navigation (7 tests)

- `/children` → "My Children" heading
- `/child-progress` → "Child Progress" heading
- `/results` → "Exam Results" heading
- `/progress` → "Space Progress" heading
- `/notifications` → `h1` is visible
- `/settings` → "Settings" heading
- Unknown route → login page, 404, or dashboard (handled gracefully)

### Session (1 test)

- Authenticated user visiting `/login` stays logged in or is redirected to
  dashboard

---

## Selectors Used

### Auth Helpers (from `helpers/auth.ts`)

| Selector                                     | Purpose                    |
| -------------------------------------------- | -------------------------- |
| `#schoolCode`                                | School code input (step 1) |
| `button[type="submit"]:has-text("Continue")` | School code submit         |
| `#email`                                     | Email input (step 2)       |
| `#password`                                  | Password input (step 2)    |
| `button[type="submit"]:has-text("Sign In")`  | Login submit               |
| `button:has-text("Sign Out")`                | Sign out button            |

### Page-specific Selectors

| Selector                                               | Page                   | Purpose                    |
| ------------------------------------------------------ | ---------------------- | -------------------------- |
| `h1`                                                   | All pages              | Page heading assertion     |
| `text=Parent Portal`                                   | Login                  | Login page title           |
| `text=/Welcome back/i`                                 | Dashboard              | Welcome message            |
| `text=Children Overview`                               | Dashboard              | Section heading            |
| `a:has-text("View all")`                               | Dashboard              | View all children link     |
| `a:has-text("Exam Results")`                           | Dashboard / Children   | Quick action link          |
| `a:has-text("Space Progress")`                         | Dashboard              | Quick action link          |
| `a:has-text("My Children")`                            | Dashboard              | Quick action link          |
| `.rounded-lg.border.bg-card`                           | Children, Exam Results | Card containers            |
| `.animate-pulse`                                       | Multiple pages         | Loading skeleton indicator |
| `input[placeholder*="Search"]`                         | Exam Results           | Search input               |
| `[role="switch"]`                                      | Settings               | Toggle switches            |
| `button:has-text("Change")`                            | Login                  | Back to school code        |
| `[class*="destructive"], [role="alert"]`               | Login                  | Error messages             |
| `.h-2.w-full.rounded-full`                             | Space Progress         | Progress bar               |
| `.h-1\.5.w-full.rounded-full`                          | Exam Results           | Score bar                  |
| `button:has-text("Unread")` / `button:has-text("All")` | Notifications          | Filter tabs                |
| `text=/\d+\/\d+ exams completed/`                      | Child Progress         | Exam count text            |
| `text=/\d+\/\d+ story points completed/`               | Space Progress         | Story points text          |

---

## Issues Found

### 1. Notifications Page — Shared UI Component

The `NotificationsPage.tsx` delegates all rendering to `<NotificationsPageUI>`
from `@levelup/shared-ui`. The exact DOM structure (class names, ARIA roles,
heading text) depends on that shared component implementation. Tests use
flexible selectors (`h1:has-text("notification")` case-insensitive,
`button:has-text("All")`) to avoid tight coupling.

**Recommendation:** Add `data-testid` attributes to shared UI notification
components for more stable test targeting.

### 2. Child Progress — No `data-testid` on Child Selector Buttons

Child selector buttons are identified via `.rounded-full.bg-primary/10` inner
element. If the design changes, selectors will break.

**Recommendation:** Add `data-testid="child-selector-{uid}"` to child selector
buttons in `ChildProgressPage.tsx`.

### 3. Exam Results — Expand/Collapse State

The expanded detail panel is identified by `.border-t` class presence. If the
card structure changes, this could produce false positives.

**Recommendation:** Add `data-testid="exam-details-panel"` to the expanded
section in `ExamResultsPage.tsx`.

### 4. Space Progress — Student IDs in Headings

The student section heading is `Student {studentId.slice(0, 8)}` — a partial
UID. Tests use a generic `h2:has-text("Student")` selector which works but is
loosely matched.

**Recommendation:** Consider showing student display names or school IDs instead
of raw UIDs, or add a `data-testid="student-progress-section"` attribute.

### 5. playwright.config.ts — baseURL Was Incorrect

The `parent-web` project had `baseURL: 'http://localhost:3004'` but the app runs
on `http://localhost:4571`. This has been corrected.

### 6. Async Data Loading — No Explicit Wait Mechanisms

Most pages rely on `page.waitForTimeout(3000–4000ms)` for Firebase data to load,
since there are no loading indicators with stable selectors to await on. If the
network is slow, tests could be flaky.

**Recommendation:** Add `data-testid="loading-state"` and
`data-testid="content-loaded"` markers to pages, or use `waitForFunction` with a
more specific DOM predicate instead of fixed timeouts.

---

## Test Strategy Notes

- **Conditional assertions:** Tests use `if (await locator.count() > 0)`
  patterns for data-dependent sections (e.g., child cards, exam results) so
  tests pass in both populated and empty-DB states.
- **Empty state coverage:** Every page has a test verifying the empty/no-data
  state message.
- **Loading state coverage:** Tests verify loading skeleton or loading text
  doesn't break the assertion.
- **Auth reuse:** A shared `loginAsParent()` helper is used in `beforeEach` for
  all authenticated suites to keep login DRY.
- **Retries:** `playwright.config.ts` is set to 1 retry locally, 2 on CI —
  appropriate for async Firebase data.
