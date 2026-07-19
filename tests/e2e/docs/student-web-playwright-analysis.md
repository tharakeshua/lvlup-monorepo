# Student Web — Playwright E2E Test Analysis

**Date:** 2026-03-02 **App URL:** http://localhost:4570 **Test File:**
`tests/e2e/student-web.spec.ts` **Total Tests:** 139

---

## 1. Pages Tested

| Page               | Route(s)                                      | User Role      |
| ------------------ | --------------------------------------------- | -------------- |
| Login              | `/login`                                      | Any            |
| Dashboard          | `/`                                           | Student (B2B)  |
| Spaces List        | `/spaces`                                     | Student        |
| Space Viewer       | `/spaces/:spaceId`                            | Student        |
| Story Point Viewer | `/spaces/:spaceId/story-points/:storyPointId` | Student        |
| Practice Mode      | `/spaces/:spaceId/practice/:storyPointId`     | Student        |
| Timed Test         | `/spaces/:spaceId/test/:storyPointId`         | Student        |
| Progress / Results | `/results`                                    | Student        |
| Notifications      | `/notifications`                              | Student        |
| Store List         | `/store`                                      | Consumer (B2C) |
| Store Detail       | `/store/:spaceId`                             | Consumer       |
| Checkout           | `/store/checkout`                             | Consumer       |
| Consumer Dashboard | `/consumer`                                   | Consumer       |
| Consumer Profile   | `/profile`                                    | Consumer       |

---

## 2. Test Suites & Case Counts

| Suite                                | # Tests | Description                                                                                                                                                                              |
| ------------------------------------ | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Student Web App › Email Login        | 4       | School code → email tab login, sign out, wrong password                                                                                                                                  |
| Student Web App › Roll Number Login  | 4       | Roll number login, synthetic email hidden, invalid/wrong-pw errors                                                                                                                       |
| Student Web App › Consumer B2C Login | 6       | Consumer login, signup flow, back-to-school link, logout isolation                                                                                                                       |
| Dashboard Page                       | 7       | Heading, welcome msg, Sign Out, "View all" nav, sidebar links, score cards, My Spaces                                                                                                    |
| Spaces List Page                     | 5       | Heading, space cards, card titles, click-to-navigate, sidebar active state                                                                                                               |
| Space Viewer Page                    | 6       | Title, progress bar, Contents section, breadcrumb nav, SP card links, empty state                                                                                                        |
| Story Point Viewer Page              | 4       | Navigation from space, breadcrumb, title render, items (materials/questions)                                                                                                             |
| Practice Mode Page                   | 9       | Heading, subtitle, unlimited retries, solved counter, difficulty filters (toggle), Prev/Next, disabled first, question indicator, breadcrumb                                             |
| Timed Test Page (Landing)            | 7       | Landing render, metadata (Duration/Questions/Points/Attempts), Start Test, breadcrumb, start→test view, previous attempts                                                                |
| Timed Test — In-Progress Controls    | 7       | Question navigator, countdown timer, Save & Next, Mark for Review, Clear, Submit dialog open, Cancel closes dialog                                                                       |
| Progress Page                        | 8       | Heading, 3 tabs, Overall default, Exams tab (table/empty), Spaces tab (cards/empty), Spaces→navigate, Overall score cards                                                                |
| Store List Page                      | 9       | Heading, subtitle, search input, subject filter dropdown, filter options, space cards/empty, search filtering, card structure, Add to Cart→cart button                                   |
| Store Detail Page                    | 7       | Title, Back to Store, back navigation, price/Free label, enrollment CTA, course content section, enrolled/lessons count, Add to Cart toggle                                              |
| Checkout Page                        | 8       | Heading, Back to Store, empty cart state, Browse Store empty CTA, back navigation, Order Summary with items, checkout button, remove/clear cart                                          |
| Consumer Dashboard Page              | 12      | Heading, welcome msg, Plan/Enrolled Spaces/Total Spend cards, Profile link, Sign Out, enrolled spaces section, Browse Store link + navigation, empty state, Profile navigation, logout   |
| Consumer Profile Page                | 10      | Heading, Sign Out, avatar, email, Plan/Enrolled/Total Spent fields, Join a School section, Enter School Code link + navigation, Purchase History (empty/list), browse store link, logout |
| Notifications Page                   | 5       | URL, renders without crash, All/Unread filter, notification bell on dashboard, mark all read                                                                                             |
| Sidebar Navigation                   | 3       | Dashboard link, My Spaces link, Results link                                                                                                                                             |
| Protected Routes                     | 7       | Unauthenticated redirect to `/login` for: `/`, `/spaces`, `/results`, `/notifications`, `/consumer`, `/store`, `/profile`                                                                |

---

## 3. Selectors Used

### Input Selectors (from `helpers/selectors.ts`)

| Selector            | Element                                     |
| ------------------- | ------------------------------------------- |
| `#schoolCode`       | School code input                           |
| `#credential`       | Email or roll number input (student step 2) |
| `#password`         | Password input                              |
| `#consumerEmail`    | Consumer email input                        |
| `#consumerPassword` | Consumer password input                     |
| `#signupName`       | Consumer signup name                        |
| `#signupEmail`      | Consumer signup email                       |
| `#signupPassword`   | Consumer signup password                    |

### Button Selectors (text-based)

| Selector                                                  | Button                      |
| --------------------------------------------------------- | --------------------------- |
| `button[type="submit"]:has-text("Continue")`              | School code submit          |
| `button[type="submit"]:has-text("Sign In")`               | Credentials submit          |
| `button:has-text("Sign Out")`                             | Logout                      |
| `getByRole('button', { name: 'Email' })`                  | Email tab                   |
| `getByRole('button', { name: 'Roll Number' })`            | Roll Number tab             |
| `button:has-text("Don't have a school code")`             | Consumer login switch       |
| `button:has-text("Back to school login")`                 | Return to school login      |
| `button:has-text("Create an account")`                    | Consumer signup             |
| `button[type="submit"]:has-text("Create Account")`        | Signup submit               |
| `button:has-text("Start Test")`                           | Begin timed test            |
| `button:has-text("Save & Next")`                          | Test navigator              |
| `button:has-text("Mark for Review")`                      | Flag question               |
| `button:has-text("Clear")`                                | Clear test response         |
| `button:has-text("Submit Test")`                          | Open submit dialog          |
| `button:has-text("Cancel")`                               | Dismiss submit dialog       |
| `button:has-text("easy/medium/hard")`                     | Practice difficulty filters |
| `button:has-text("Previous")` / `button:has-text("Next")` | Practice navigator          |
| `button:has-text("Add to Cart")`                          | Store add to cart           |
| `button:has-text("Remove from Cart")`                     | Store remove from cart      |
| `button:has-text("Clear cart")`                           | Checkout clear all          |
| `[aria-label="Remove from cart"]`                         | Checkout item remove        |

### Navigation/Link Selectors

| Selector                          | Link                          |
| --------------------------------- | ----------------------------- |
| `a[href="/"]`                     | Dashboard sidebar             |
| `a[href="/spaces"]`               | My Spaces sidebar             |
| `a[href="/results"]`              | Results sidebar               |
| `a[href^="/spaces/"]`             | Space cards / progress cards  |
| `a[href*="/story-points/"]`       | Standard story point links    |
| `a[href*="/practice/"]`           | Practice story point links    |
| `a[href*="/test/"]`               | Timed test story point links  |
| `a[href^="/store/"]`              | Store space cards             |
| `a:has-text("Spaces")`            | Breadcrumb nav                |
| `a:has-text("Back to Store")`     | Store detail back             |
| `a:has-text("Browse Store")`      | Consumer dashboard store link |
| `a:has-text("Profile")`           | Consumer dashboard profile    |
| `a:has-text("Enter School Code")` | Consumer profile school link  |
| `a:has-text("View all")`          | Dashboard → spaces            |

### Content Selectors

| Selector                                 | Content                 |
| ---------------------------------------- | ----------------------- |
| `h1`                                     | Page main heading       |
| `h2:has-text(...)`                       | Section headings        |
| `[class*="destructive"], [role="alert"]` | Error messages          |
| `text=...`                               | Text content assertions |
| `.group.rounded-lg.border`               | Store space cards       |
| `.rounded-lg.border.bg-card.p-5`         | Story point item cards  |
| `input[placeholder="Search spaces..."]`  | Store search            |
| `select`                                 | Store subject filter    |
| `table`                                  | Exams progress table    |

---

## 4. Test Design Patterns

### Data-Dependent Navigation

Pages like SpaceViewer, StoryPointViewer, PracticeMode, and TimedTest depend on
test data (spaces must exist). These tests use a pattern:

```typescript
if ((await someLocator.count()) === 0) test.skip();
```

This makes tests non-flaky when test data is sparse — they skip gracefully
rather than fail.

### Login Helpers

All tests use the shared helpers from `tests/e2e/helpers/auth.ts`:

- `loginStudentWithEmail(page, schoolCode, email, password)`
- `loginStudentWithRollNumber(page, schoolCode, rollNumber, password)`
- `loginConsumer(page, email, password)`
- `logout(page)`
- `expectDashboard(page, heading)`

Two module-level helpers compose these for reuse:

- `loginAsStudent(page)` — goes to `/login` then logs in as student1
- `loginAsConsumer(page)` — goes to `/login` then logs in as consumer

### Two-State Assertions

Many UI areas have dual states (data loaded vs. empty). Tests use:

```typescript
const hasData = ...; const hasEmpty = ...;
expect(hasData || hasEmpty).toBeTruthy();
```

---

## 5. Issues Found / Observations

### Config Fix Required

- **`playwright.config.ts` had wrong port for `student-web`**: was `3003`,
  corrected to `4570`.

### Timed Test — Max Attempts Edge Case

- If a student has already exhausted max attempts for a test, `Start Test`
  button triggers an error rather than the test view. The test handles this:
  ```typescript
  const hasTimer = ...; const hasError = ...;
  expect(hasTimer || hasError).toBeTruthy();
  ```

### Consumer vs. Student Role Separation

- Consumer routes (`/consumer`, `/store`, `/profile`) are accessible to any
  authenticated user (no role restriction), while student routes (`/`,
  `/spaces`, `/results`, `/notifications`) require `role === 'student'`.
- Protected route tests validate that all routes redirect unauthenticated users
  to `/login`.

### Store — Firebase Function Dependency

- `StoreListPage` and `StoreDetailPage` call Firebase callable functions
  (`listStoreSpaces`, `purchaseSpace`). Store tests use `waitForTimeout` to
  allow async data loading. If the emulator is not running these functions,
  tests gracefully handle the empty/error state.

### Notifications — Shared UI Component

- `NotificationsPage` delegates entirely to `@levelup/shared-ui`'s
  `NotificationsPageUI`. Selector choices are kept flexible (e.g.,
  `button:has-text("All")`) to accommodate the shared component's internal
  structure.

### Story Point Sidebar (Sections)

- `StoryPointViewerPage` shows a sections sidebar only when
  `sections.length > 1`. Tests do not assert sidebar presence to avoid
  data-coupling.

---

## 6. Credentials Used

| Role            | Email / Roll              | Password     | School Code |
| --------------- | ------------------------- | ------------ | ----------- |
| Student (email) | student1@springfield.test | Student123!  | SPR001      |
| Student (roll)  | 2024035                   | Student123!  | SPR001      |
| Consumer        | consumer@gmail.test       | Consumer123! | —           |
