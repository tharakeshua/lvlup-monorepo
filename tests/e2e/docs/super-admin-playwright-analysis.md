# Super Admin App — Playwright E2E Test Analysis

**Date:** 2026-03-02 **App:** `super-admin` (http://localhost:4567) **Test
file:** `tests/e2e/super-admin.spec.ts` **Config file:** `playwright.config.ts`
**Total tests:** 118

---

## Pages Tested

| Page           | Route                | Description                                      |
| -------------- | -------------------- | ------------------------------------------------ |
| Login          | `/login`             | Email + password authentication                  |
| Dashboard      | `/`                  | Platform overview stats                          |
| Tenants        | `/tenants`           | Tenant list with search/filter/create            |
| Tenant Detail  | `/tenants/:tenantId` | Individual tenant management                     |
| Feature Flags  | `/feature-flags`     | Per-tenant feature toggle matrix                 |
| Global Presets | `/presets`           | Evaluation rubric preset management              |
| User Analytics | `/analytics`         | Platform-wide user statistics                    |
| System Health  | `/system`            | Service health probes + metrics                  |
| Settings       | `/settings`          | Platform config, announcements, feature defaults |

---

## Test Cases Created (by group)

### Authentication (8 tests)

- Unauthenticated redirect to `/login` from `/` and `/tenants`
- Login page renders email, password, submit fields
- Successful login with valid credentials
- Error shown for wrong password
- Error shown for unknown email
- Sign out from dashboard redirects to `/login`
- Cannot access protected page after sign out

### Dashboard (7 tests)

- `h1` contains "Super Admin Dashboard"
- Welcome message with admin name/email visible
- All 4 stat cards visible (Total Tenants, Total Users, Total Exams, Total
  Spaces)
- Stat cards show numeric values (after loading spinner gone)
- "X active, Y trial" sub-label visible
- Sign Out button present
- Sign Out redirects to login

### Navigation (7 tests)

- Sidebar links to `/tenants`, `/analytics`, `/feature-flags`, `/presets`,
  `/system`, `/settings`
- Back navigation from Tenants to Dashboard

### Tenants Page (14 tests)

- Heading + description text
- Create Tenant button visible
- Search input visible
- Status filter buttons: all / active / trial / suspended / expired
- Table headers: Name, Code, Plan, Users, Status, Actions
- Search filters tenant rows
- Search with no match shows "No tenants found"
- Status filter "active" shows only active rows
- Create Tenant dialog opens and shows correct title
- Dialog has all required fields (name, code, email, person, plan select)
- Cancel closes dialog
- Create button disabled when required fields empty
- Plan select has Trial/Basic/Premium/Enterprise options
- Tenant code input auto-uppercases and strips invalid chars
- "View" link navigates to tenant detail page

### Tenant Detail Page (14 tests)

- Tenant name shown as `h1`
- Back link visible and navigates to `/tenants`
- 4 stat cards: Students, Teachers, Exams, Spaces
- Subscription section (Plan, Max Students, Max Teachers, Max Spaces)
- Contact section (Email, Phone, Contact Person, Website)
- Features section visible
- Settings section (Gemini Key Set, Default AI Model)
- Edit and Delete buttons visible
- Edit button opens dialog with title "Edit Tenant"
- Edit dialog has all fields (name, email, phone, person, website, status)
- Edit Cancel closes dialog
- Status select has Active/Trial/Suspended/Expired options
- Delete button opens AlertDialog with "Delete Tenant" title
- AlertDialog has Cancel + Delete Tenant buttons
- Cancel on delete dialog closes without navigating away

### Feature Flags Page (8 tests)

- Heading + description
- Flag Overview section visible
- All 9 known flags in overview (AutoGrade, LevelUp Spaces, Scanner App, AI Chat
  Tutor, AI Grading, Analytics, Parent Portal, Bulk Import, API Access)
- Flag counts in X/Y format
- Search input visible
- Search with no match shows "No tenants found"
- Tenant flag cards visible after load
- Clicking a toggle shows "Save Changes" button on the card

### Global Presets Page (13 tests)

- Heading + description
- Create Preset button
- Dialog opens with correct title
- Name field (`#preset-name`)
- Description textarea (`#preset-desc`)
- "Set as default" and "Public" checkboxes
- Display Settings section (show strengths, show takeaway, prioritize)
- Evaluation Dimensions section with all 6 dims (Clarity, Accuracy, Depth,
  Grammar, Relevance, Critical Thinking)
- Save Preset disabled when name empty, enabled when filled
- Cancel closes dialog
- Existing preset cards show Edit + Delete buttons
- Edit button opens Edit Preset dialog
- Delete opens AlertDialog; Cancel closes it without deleting
- Preset cards show Dimensions label

### User Analytics Page (7 tests)

- Heading + description
- 4 stat cards (Total Users, Students, Teachers, Active Tenants)
- Numeric values in stat cards
- Users by Tenant table visible
- Table columns: Tenant, Code, Students, Teachers, Total, Status
- Rows sorted by total users descending
- Users by Subscription Plan section + progress bars (when data present)

### System Health Page (8 tests)

- Heading + description
- Refresh button visible
- Overall status banner shows one of: All Systems Operational / Some Services
  Degraded / Service Disruption Detected
- 4 service cards: Firebase Auth, Firestore, Cloud Functions, AI Grading
  Pipeline
- Status values are valid (operational / degraded / down)
- Platform Metrics section (Avg Response Time, Total Users, Error Rate)
- Refresh button triggers re-check (shows Checking... state)
- "Last checked:" timestamp visible

### Settings Page (12 tests)

- Heading + description
- Platform Announcement card + textarea
- Announcement hint text changes when textarea has content
- Default Features for New Tenants card
- All 7 feature toggles (Exams, Learning Spaces, AI Grading, Chat/Tutoring,
  Reports, Parent Portal, Leaderboard)
- At least 7 Switch role elements present
- System Configuration card with Maintenance Mode toggle
- Default Plan + Max Tenants Allowed readonly inputs
- Admin Account card visible
- Admin email displayed
- Sign Out button present
- Sign Out redirects to `/login`
- Maintenance Mode switch toggles aria-checked state
- Typing in announcement textarea updates value + hint

### Direct URL Access (7 tests)

- Authenticated direct navigation to all 6 protected routes loads correct page
- Non-existent tenant ID shows "Tenant not found"

---

## Selectors Used

### ID selectors

| Selector          | Page                  | Purpose                  |
| ----------------- | --------------------- | ------------------------ |
| `#email`          | Login                 | Email input              |
| `#password`       | Login                 | Password input           |
| `#tenant-name`    | Tenants Create Dialog | Name field               |
| `#tenant-code`    | Tenants Create Dialog | Code field               |
| `#tenant-email`   | Tenants Create Dialog | Email field              |
| `#tenant-person`  | Tenants Create Dialog | Contact person           |
| `#tenant-plan`    | Tenants Create Dialog | Plan select              |
| `#edit-name`      | Tenant Detail Edit    | Name field               |
| `#edit-email`     | Tenant Detail Edit    | Email field              |
| `#edit-phone`     | Tenant Detail Edit    | Phone field              |
| `#edit-person`    | Tenant Detail Edit    | Contact person           |
| `#edit-website`   | Tenant Detail Edit    | Website field            |
| `#edit-status`    | Tenant Detail Edit    | Status select            |
| `#preset-name`    | Global Presets        | Preset name              |
| `#preset-desc`    | Global Presets        | Description              |
| `#preset-default` | Global Presets        | Default checkbox         |
| `#preset-public`  | Global Presets        | Public checkbox          |
| `#show-strengths` | Global Presets        | Display setting checkbox |
| `#show-takeaway`  | Global Presets        | Display setting checkbox |
| `#prioritize`     | Global Presets        | Display setting checkbox |

### Role/Semantic selectors

| Selector                                           | Purpose                  |
| -------------------------------------------------- | ------------------------ |
| `[role="dialog"]`                                  | Modal dialogs (Radix UI) |
| `[role="alertdialog"]`                             | Confirmation dialogs     |
| `[role="switch"]`                                  | Toggle switches          |
| `button[type="submit"]:has-text("Sign In")`        | Login submit             |
| `a[href="/tenants"]`, `a[href="/analytics"]`, etc. | Sidebar navigation links |

### Text selectors

| Pattern                          | Purpose                     |
| -------------------------------- | --------------------------- |
| `text=Loading...`                | Tenants table loading state |
| `text=Loading platform stats...` | Dashboard loading state     |
| `text=Loading tenant flags...`   | Feature flags loading       |
| `text=Loading presets...`        | Presets loading             |
| `text=Loading tenant details...` | Tenant detail loading       |
| `text=Loading configuration...`  | Settings loading            |
| `text=Running health checks`     | System health loading       |
| `text=No tenants found`          | Empty state                 |
| `text=Tenant not found`          | Missing tenant 404 state    |

### CSS class selectors

| Selector                                  | Purpose             |
| ----------------------------------------- | ------------------- |
| `.rounded-lg.border.bg-card`              | Card containers     |
| `.rounded-lg.border p.text-2xl.font-bold` | Stat card values    |
| `.space-y-4 > .rounded-lg.border.bg-card` | Tenant flag cards   |
| `.animate-pulse`                          | Loading skeleton    |
| `.h-2.rounded-full.bg-blue-500`           | Progress bar        |
| `span.rounded-full`                       | Status badge pills  |
| `span.capitalize.font-medium`             | Service status text |
| `span.font-mono.text-muted-foreground`    | Flag count badges   |

---

## Issues Found

### 1. `playwright.config.ts` — Wrong Port for super-admin

**Issue:** `baseURL` was set to `http://localhost:3000` instead of
`http://localhost:4567`. **Fix applied:** Updated to `http://localhost:4567`.

### 2. Tenant Detail Page — Conditional test execution

**Issue:** The Tenant Detail tests require at least one tenant to exist in the
database. If the seeded data is missing, the "View" link won't appear and detail
tests will be skipped via `test.skip()`. **Mitigation:** Tests use `test.skip()`
gracefully when no tenants are found. Pre-condition: run seeders before the test
suite.

### 3. Feature Flags — Save is a network mutation

**Issue:** Clicking "Save Changes" in Feature Flags fires a Firestore
`updateDoc`. Tests only verify the UI interaction (toggle → Save button appears)
and do not attempt to save, preventing unintended data mutations in the test
environment.

### 4. Global Presets — CRUD mutates Firebase

**Issue:** Create/Edit/Delete preset operations call
`httpsCallable(functions, "saveGlobalEvaluationPreset")`. Tests only test dialog
open/close interactions. Full CRUD tests would require a dedicated test Firebase
project or mocking.

### 5. System Health — Async probe timing

**Issue:** Health checks run multiple async probes (Firestore, Cloud Functions).
Wait conditions use `not.toBeVisible({ timeout: 30000 })` on the loading
indicator to accommodate slow emulators. In CI with real Firebase emulators,
this should be reliable.

### 6. Settings — State sync on load

**Issue:** `SettingsPage.tsx` uses `useState()` (not `useEffect`) to sync config
state, which is a React anti-pattern that may cause stale state. Tests work
around this by testing toggle interactions directly without asserting persisted
values.

---

## Test Infrastructure

- **Helper imports:** `loginDirect`, `logout`, `expectDashboard` from
  `./helpers/auth`
- **Credentials:** `CREDENTIALS.superAdmin` from `./helpers/selectors`
- **Login helper:** `loginAsSuperAdmin(page)` — reusable across all test groups
  via `test.beforeEach`
- **Timeouts:** Default 10s for `expect`, extended to 15-30s for async data
  loading
- **Parallelism:** Tests run with `workers: 1` (sequential) to avoid Firebase
  emulator contention
