# Playwright E2E Test Plan: Super-Admin App

**App:** `apps/super-admin` | **Port:** `4567` | **Test file:**
`tests/e2e/super-admin.spec.ts`

---

## Test Configuration Reference

```ts
// playwright.config.ts — super-admin project
{
  name: 'super-admin',
  use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:4567' },
  testMatch: 'super-admin.spec.ts',
}
```

---

## 1. Authentication & Authorization

### 1.1 Super Admin Login — Happy Path

| Field           | Value                                                                                                                                                                                                      |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `should login with valid super admin credentials`                                                                                                                                                          |
| **Description** | Verify a user with `superAdmin` role can log in and reach the dashboard                                                                                                                                    |
| **Steps**       | 1. Navigate to `/login` 2. Fill email input (`#email`) 3. Fill password input (`#password`) 4. Click "Sign In" button 5. Wait for navigation                                                               |
| **Expected**    | Redirected to `/` (Dashboard). Page header shows "Super Admin Dashboard" with welcome message containing the user's display name or email. Sidebar is visible with nav groups: Overview, Platform, System. |
| **Priority**    | **P0**                                                                                                                                                                                                     |

### 1.2 Login — Invalid Credentials

| Field           | Value                                                                                                |
| --------------- | ---------------------------------------------------------------------------------------------------- |
| **Test Name**   | `should show error alert for invalid credentials`                                                    |
| **Description** | Verify error handling when login fails                                                               |
| **Steps**       | 1. Navigate to `/login` 2. Enter invalid email/password 3. Click "Sign In"                           |
| **Expected**    | A destructive `Alert` appears within the form containing an error message. User remains on `/login`. |
| **Priority**    | **P0**                                                                                               |

### 1.3 Login — Empty Form Validation

| Field           | Value                                                                                                    |
| --------------- | -------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `should require email and password fields`                                                               |
| **Description** | Verify HTML5 required validation prevents empty form submission                                          |
| **Steps**       | 1. Navigate to `/login` 2. Click "Sign In" without entering anything                                     |
| **Expected**    | Browser native validation prevents form submission. Email and password inputs have `required` attribute. |
| **Priority**    | **P1**                                                                                                   |

### 1.4 Login — Loading State

| Field           | Value                                                                                                |
| --------------- | ---------------------------------------------------------------------------------------------------- |
| **Test Name**   | `should show loading state during login`                                                             |
| **Description** | Button text changes to "Signing in..." and is disabled while authenticating                          |
| **Steps**       | 1. Navigate to `/login` 2. Fill credentials 3. Click "Sign In" 4. Observe button state               |
| **Expected**    | Button text changes to "Signing in..." and `disabled` attribute is set while request is in progress. |
| **Priority**    | **P2**                                                                                               |

### 1.5 Login — Redirect After Auth

| Field           | Value                                                                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `should redirect to originally requested page after login`                                                                                  |
| **Description** | If a user tries to access `/tenants` without auth, they should be redirected to `/login` and then back to `/tenants` after successful login |
| **Steps**       | 1. Navigate to `/tenants` (unauthenticated) 2. Verify redirect to `/login` 3. Log in with valid credentials                                 |
| **Expected**    | After login, user is redirected to `/tenants` (the originally requested page), not `/`.                                                     |
| **Priority**    | **P1**                                                                                                                                      |

### 1.6 Access Denied — Non-Super-Admin User

| Field           | Value                                                                                                                        |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `should show access denied for non-superAdmin user`                                                                          |
| **Description** | A user who is authenticated but lacks `superAdmin` role / `isSuperAdmin` flag sees access denied                             |
| **Steps**       | 1. Log in with a regular user (role != superAdmin, claims.role != "superAdmin") 2. Navigate to `/`                           |
| **Expected**    | Page shows "Access Denied" heading and "Super admin privileges required." description. No sidebar or app content is visible. |
| **Priority**    | **P0**                                                                                                                       |

### 1.7 Unauthenticated Access — Protected Routes

| Field           | Value                                                                                                                                              |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `should redirect unauthenticated users to login`                                                                                                   |
| **Description** | All protected routes redirect to `/login`                                                                                                          |
| **Steps**       | 1. Without logging in, navigate to each route: `/`, `/tenants`, `/tenants/abc`, `/analytics`, `/feature-flags`, `/presets`, `/system`, `/settings` |
| **Expected**    | Each route redirects to `/login`.                                                                                                                  |
| **Priority**    | **P0**                                                                                                                                             |

### 1.8 Logout

| Field           | Value                                                                                              |
| --------------- | -------------------------------------------------------------------------------------------------- |
| **Test Name**   | `should log out and redirect to login page`                                                        |
| **Description** | Clicking Sign Out on dashboard or settings page logs the user out                                  |
| **Steps**       | 1. Login as super admin 2. Click "Sign Out" button on dashboard page header 3. Wait for navigation |
| **Expected**    | User is redirected to `/login`. Navigating to `/` now redirects back to `/login`.                  |
| **Priority**    | **P0**                                                                                             |

---

## 2. Dashboard Page (`/`)

### 2.1 Dashboard — Stat Cards Render

| Field           | Value                                                                                                                                                              |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Test Name**   | `should display four platform stat cards on dashboard`                                                                                                             |
| **Description** | Dashboard shows Total Tenants, Total Users, Total Exams, Total Spaces cards                                                                                        |
| **Steps**       | 1. Login 2. Navigate to `/` 3. Wait for data to load                                                                                                               |
| **Expected**    | Four `StatCard` components visible with labels: "Total Tenants", "Total Users", "Total Exams", "Total Spaces". Each shows a numeric value and descriptive subtext. |
| **Priority**    | **P0**                                                                                                                                                             |

### 2.2 Dashboard — Recent Tenants List

| Field           | Value                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| **Test Name**   | `should display recent tenants list on dashboard`                                                |
| **Description** | Dashboard shows up to 5 most recent tenants with name, code, email, user count, and status badge |
| **Steps**       | 1. Login 2. Navigate to `/` 3. Wait for data                                                     |
| **Expected**    | "Recent Tenants" section visible. Each tenant row shows name, "Code: {code}                      | {email}", user count, and a `StatusBadge`. Max 5 tenants displayed. |
| **Priority**    | **P1**                                                                                           |

### 2.3 Dashboard — Loading Skeletons

| Field           | Value                                                                                              |
| --------------- | -------------------------------------------------------------------------------------------------- |
| **Test Name**   | `should show skeleton loading state on dashboard`                                                  |
| **Description** | While data loads, skeleton placeholders are shown                                                  |
| **Steps**       | 1. Login 2. Navigate to `/` 3. Observe initial render (throttle network if needed)                 |
| **Expected**    | Four skeleton cards in a grid and a skeleton tenant list section are visible before data resolves. |
| **Priority**    | **P2**                                                                                             |

### 2.4 Dashboard — Error State with Retry

| Field           | Value                                                                                                                  |
| --------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `should show error alert with retry on dashboard data failure`                                                         |
| **Description** | When Firestore query fails, an error alert appears with a retry button                                                 |
| **Steps**       | 1. Login 2. Mock/intercept Firestore to fail 3. Navigate to `/`                                                        |
| **Expected**    | A destructive `Alert` with title "Failed to load data" and a "Try again" link button. Clicking "Try again" re-fetches. |
| **Priority**    | **P1**                                                                                                                 |

### 2.5 Dashboard — Welcome Message

| Field           | Value                                                                     |
| --------------- | ------------------------------------------------------------------------- |
| **Test Name**   | `should show personalized welcome message`                                |
| **Description** | The PageHeader description includes the user's display name or email      |
| **Steps**       | 1. Login as user with displayName "Admin User" 2. Check PageHeader        |
| **Expected**    | Description text contains "Welcome back, Admin User — Platform Overview". |
| **Priority**    | **P2**                                                                    |

---

## 3. Tenant Management — List Page (`/tenants`)

### 3.1 Tenants Table — Renders Data

| Field           | Value                                                                                                                                                                                  |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `should display tenants in a table with correct columns`                                                                                                                               |
| **Description** | Tenants page shows a table with columns: Name, Code, Plan, Users, Status, Actions                                                                                                      |
| **Steps**       | 1. Login 2. Navigate to `/tenants` 3. Wait for data                                                                                                                                    |
| **Expected**    | Table with header columns: Name, Code, Plan, Users, Status, Actions. Each row shows tenant name + email, monospace code, plan (capitalized), user count, StatusBadge, and "View" link. |
| **Priority**    | **P0**                                                                                                                                                                                 |

### 3.2 Tenants — Search by Name

| Field           | Value                                                                                   |
| --------------- | --------------------------------------------------------------------------------------- |
| **Test Name**   | `should filter tenants by search query (name)`                                          |
| **Description** | Typing in the search input filters tenants by name                                      |
| **Steps**       | 1. Navigate to `/tenants` 2. Type a tenant name in the search field 3. Observe table    |
| **Expected**    | Table shows only tenants whose name matches the search query. Other tenants are hidden. |
| **Priority**    | **P0**                                                                                  |

### 3.3 Tenants — Search by Code

| Field           | Value                                                               |
| --------------- | ------------------------------------------------------------------- |
| **Test Name**   | `should filter tenants by tenant code`                              |
| **Description** | Search also matches against tenantCode                              |
| **Steps**       | 1. Navigate to `/tenants` 2. Type a tenant code in the search field |
| **Expected**    | Table filters to show tenants matching the tenant code.             |
| **Priority**    | **P1**                                                              |

### 3.4 Tenants — Search by Email

| Field           | Value                                                                 |
| --------------- | --------------------------------------------------------------------- |
| **Test Name**   | `should filter tenants by contact email`                              |
| **Description** | Search also matches against contactEmail                              |
| **Steps**       | 1. Navigate to `/tenants` 2. Type a partial email in the search field |
| **Expected**    | Table filters to show tenants with matching contact email.            |
| **Priority**    | **P1**                                                                |

### 3.5 Tenants — Status Filter Buttons

| Field           | Value                                                                                                                                                                        |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `should filter tenants by status using filter buttons`                                                                                                                       |
| **Description** | Clicking status filter buttons (all, active, trial, suspended, expired) filters the table                                                                                    |
| **Steps**       | 1. Navigate to `/tenants` 2. Click "active" filter button 3. Observe table 4. Click "trial" 5. Click "all"                                                                   |
| **Expected**    | Clicking "active" shows only active tenants. "trial" shows only trial tenants. "all" shows all. Active filter button has `default` variant, others have `secondary` variant. |
| **Priority**    | **P0**                                                                                                                                                                       |

### 3.6 Tenants — Combined Search + Filter

| Field           | Value                                                                      |
| --------------- | -------------------------------------------------------------------------- |
| **Test Name**   | `should combine search and status filter`                                  |
| **Description** | Search and status filter work together                                     |
| **Steps**       | 1. Navigate to `/tenants` 2. Click "active" filter 3. Type search query    |
| **Expected**    | Only tenants matching both the search query AND "active" status are shown. |
| **Priority**    | **P1**                                                                     |

### 3.7 Tenants — Empty State (No Tenants)

| Field           | Value                                                                                                                                  |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `should show empty state when no tenants exist`                                                                                        |
| **Description** | Empty state with icon and message when tenant list is empty                                                                            |
| **Steps**       | 1. Navigate to `/tenants` with no tenants in DB                                                                                        |
| **Expected**    | Table body shows centered content: Building2 icon, "No tenants found" heading, "Create your first tenant to get started." description. |
| **Priority**    | **P1**                                                                                                                                 |

### 3.8 Tenants — Empty State (No Search Results)

| Field           | Value                                                                               |
| --------------- | ----------------------------------------------------------------------------------- |
| **Test Name**   | `should show filtered empty state when search has no matches`                       |
| **Description** | Different empty message when search/filter yields no results                        |
| **Steps**       | 1. Navigate to `/tenants` 2. Type a non-matching search query                       |
| **Expected**    | "No tenants found" with description "Try adjusting your search or filter criteria." |
| **Priority**    | **P2**                                                                              |

### 3.9 Tenants — Loading Skeletons

| Field           | Value                                                             |
| --------------- | ----------------------------------------------------------------- |
| **Test Name**   | `should show skeleton rows while tenants are loading`             |
| **Description** | Table shows 5 skeleton rows during data fetch                     |
| **Steps**       | 1. Navigate to `/tenants` before data loads                       |
| **Expected**    | Five `TableRow`s with skeleton elements in each cell are visible. |
| **Priority**    | **P2**                                                            |

### 3.10 Tenants — View Link Navigation

| Field           | Value                                                           |
| --------------- | --------------------------------------------------------------- |
| **Test Name**   | `should navigate to tenant detail page when clicking View`      |
| **Description** | "View" link in Actions column navigates to `/tenants/{id}`      |
| **Steps**       | 1. Navigate to `/tenants` 2. Click "View" link for a tenant     |
| **Expected**    | URL changes to `/tenants/{tenantId}`. Tenant detail page loads. |
| **Priority**    | **P0**                                                          |

---

## 4. Tenant Management — Create Tenant

### 4.1 Create Tenant — Open Dialog

| Field           | Value                                                                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `should open create tenant dialog`                                                                                                                |
| **Description** | Clicking "Create Tenant" button opens a dialog                                                                                                    |
| **Steps**       | 1. Navigate to `/tenants` 2. Click "Create Tenant" button in page header                                                                          |
| **Expected**    | A Dialog opens with title "Create Tenant". Form fields visible: Organization Name, Tenant Code, Contact Email, Contact Person, Subscription Plan. |
| **Priority**    | **P0**                                                                                                                                            |

### 4.2 Create Tenant — Successful Creation

| Field           | Value                                                                                                                                                                                         |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `should create a new tenant with valid data`                                                                                                                                                  |
| **Description** | Filling out form and clicking Create creates a tenant and closes dialog                                                                                                                       |
| **Steps**       | 1. Open create dialog 2. Fill "Organization Name" 3. Fill "Tenant Code" (auto-uppercased) 4. Fill "Contact Email" 5. Optionally fill "Contact Person" 6. Select plan 7. Click "Create Tenant" |
| **Expected**    | Dialog closes. Tenants list refreshes and includes the new tenant.                                                                                                                            |
| **Priority**    | **P0**                                                                                                                                                                                        |

### 4.3 Create Tenant — Tenant Code Formatting

| Field           | Value                                                                                                                                                            |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `should auto-uppercase tenant code and strip invalid characters`                                                                                                 |
| **Description** | Tenant code input auto-transforms to uppercase and removes non-alphanumeric/hyphen characters                                                                    |
| **Steps**       | 1. Open create dialog 2. Type "my school-1!" in tenant code field                                                                                                |
| **Expected**    | Input value becomes "MY SCHOOL-1" (lowercases uppercased, special chars stripped except hyphens). Hint text says "Uppercase letters, numbers, and hyphens only". |
| **Priority**    | **P1**                                                                                                                                                           |

### 4.4 Create Tenant — Validation (Required Fields)

| Field           | Value                                                                                                                                  |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `should disable create button when required fields are empty`                                                                          |
| **Description** | Create button is disabled when name, code, or email is blank                                                                           |
| **Steps**       | 1. Open create dialog 2. Leave all fields empty                                                                                        |
| **Expected**    | "Create Tenant" button is `disabled`. Button becomes enabled only when name, tenantCode, and contactEmail are all non-empty (trimmed). |
| **Priority**    | **P0**                                                                                                                                 |

### 4.5 Create Tenant — Plan Selection

| Field           | Value                                                                            |
| --------------- | -------------------------------------------------------------------------------- |
| **Test Name**   | `should allow selecting subscription plan`                                       |
| **Description** | Plan dropdown shows Trial, Basic, Premium, Enterprise options                    |
| **Steps**       | 1. Open create dialog 2. Click plan dropdown 3. Verify options                   |
| **Expected**    | Select dropdown shows four options: Trial (default), Basic, Premium, Enterprise. |
| **Priority**    | **P1**                                                                           |

### 4.6 Create Tenant — Error Handling

| Field           | Value                                                                                                             |
| --------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `should show error in dialog when create fails`                                                                   |
| **Description** | Server-side error is displayed inside the dialog                                                                  |
| **Steps**       | 1. Open create dialog 2. Fill with data that causes backend error (e.g., duplicate code) 3. Click "Create Tenant" |
| **Expected**    | Destructive alert appears inside the dialog with the error message. Dialog remains open.                          |
| **Priority**    | **P1**                                                                                                            |

### 4.7 Create Tenant — Loading State

| Field           | Value                                                                                                 |
| --------------- | ----------------------------------------------------------------------------------------------------- |
| **Test Name**   | `should show loading state during tenant creation`                                                    |
| **Description** | Button text changes and buttons are disabled during mutation                                          |
| **Steps**       | 1. Open create dialog 2. Fill valid data 3. Click "Create Tenant"                                     |
| **Expected**    | Button text changes to "Creating...". Both Cancel and Create buttons are disabled during the request. |
| **Priority**    | **P2**                                                                                                |

### 4.8 Create Tenant — Cancel Closes Dialog

| Field           | Value                                                     |
| --------------- | --------------------------------------------------------- |
| **Test Name**   | `should close create dialog on cancel`                    |
| **Description** | Cancel button closes dialog without creating a tenant     |
| **Steps**       | 1. Open create dialog 2. Fill some data 3. Click "Cancel" |
| **Expected**    | Dialog closes. No new tenant is created.                  |
| **Priority**    | **P1**                                                    |

---

## 5. Tenant Management — Detail Page (`/tenants/:tenantId`)

### 5.1 Tenant Detail — Page Layout

| Field           | Value                                                                                                                      |
| --------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `should display tenant detail page with all sections`                                                                      |
| **Description** | Tenant detail shows header with name/code/email, stat cards, subscription card, contact card, features card, settings card |
| **Steps**       | 1. Navigate to `/tenants/{validId}`                                                                                        |
| **Expected**    | Page shows: "Back" link, tenant name as h1, "Code: {code}                                                                  | {email}" subtitle, StatusBadge, Edit button, Delete button. Four stat cards (Students, Teachers, Exams, Spaces). Subscription card, Contact card, Features card, Settings card. |
| **Priority**    | **P0**                                                                                                                     |

### 5.2 Tenant Detail — Back Navigation

| Field           | Value                                               |
| --------------- | --------------------------------------------------- |
| **Test Name**   | `should navigate back to tenants list`              |
| **Description** | "Back" link returns to `/tenants`                   |
| **Steps**       | 1. Navigate to `/tenants/{id}` 2. Click "Back" link |
| **Expected**    | URL changes to `/tenants`.                          |
| **Priority**    | **P1**                                              |

### 5.3 Tenant Detail — Edit Tenant Dialog

| Field           | Value                                                                                                                                                                                                                                               |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `should open and submit edit tenant dialog`                                                                                                                                                                                                         |
| **Description** | Clicking Edit opens a dialog pre-filled with tenant data. Saving updates the tenant.                                                                                                                                                                |
| **Steps**       | 1. Navigate to `/tenants/{id}` 2. Click "Edit" button 3. Verify form is pre-filled (name, email, phone, person, website, status) 4. Change the name 5. Click "Save Changes"                                                                         |
| **Expected**    | Dialog opens with title "Edit Tenant". Fields pre-filled with current tenant data. Status dropdown shows Active, Trial, Suspended, Expired. After save, dialog closes, toast "Tenant updated successfully" appears, and page reflects updated data. |
| **Priority**    | **P0**                                                                                                                                                                                                                                              |

### 5.4 Tenant Detail — Edit Validation

| Field           | Value                                                      |
| --------------- | ---------------------------------------------------------- |
| **Test Name**   | `should disable save when name is empty in edit dialog`    |
| **Description** | Save Changes button is disabled when name field is cleared |
| **Steps**       | 1. Open edit dialog 2. Clear the name field                |
| **Expected**    | "Save Changes" button is disabled.                         |
| **Priority**    | **P1**                                                     |

### 5.5 Tenant Detail — Delete Tenant Confirmation

| Field           | Value                                                                                                                                                                                                    |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `should show delete confirmation dialog`                                                                                                                                                                 |
| **Description** | Clicking Delete opens an AlertDialog with confirmation message                                                                                                                                           |
| **Steps**       | 1. Navigate to `/tenants/{id}` 2. Click "Delete" button                                                                                                                                                  |
| **Expected**    | AlertDialog opens with title "Delete Tenant", description mentioning the tenant name and "This action cannot be undone." with Cancel and "Delete Tenant" buttons. Delete button has destructive styling. |
| **Priority**    | **P0**                                                                                                                                                                                                   |

### 5.6 Tenant Detail — Confirm Delete

| Field           | Value                                                                                                            |
| --------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `should delete tenant and redirect to tenants list`                                                              |
| **Description** | Confirming delete removes tenant and navigates back                                                              |
| **Steps**       | 1. Open delete dialog 2. Click "Delete Tenant"                                                                   |
| **Expected**    | Toast "Tenant deleted successfully" appears. User is redirected to `/tenants`. Deleted tenant no longer in list. |
| **Priority**    | **P0**                                                                                                           |

### 5.7 Tenant Detail — Cancel Delete

| Field           | Value                                                           |
| --------------- | --------------------------------------------------------------- |
| **Test Name**   | `should cancel tenant deletion`                                 |
| **Description** | Clicking Cancel in the delete dialog closes it without deleting |
| **Steps**       | 1. Open delete dialog 2. Click "Cancel"                         |
| **Expected**    | Dialog closes. Tenant still exists.                             |
| **Priority**    | **P1**                                                          |

### 5.8 Tenant Detail — Edit Subscription

| Field           | Value                                                                                                                                                                                                                                                                         |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `should open and submit subscription edit dialog`                                                                                                                                                                                                                             |
| **Description** | "Edit Plan" button opens subscription dialog with plan, max limits, and expiration date                                                                                                                                                                                       |
| **Steps**       | 1. Navigate to `/tenants/{id}` 2. Click "Edit Plan" on subscription card 3. Verify fields are pre-filled 4. Change plan to "premium" 5. Set maxStudents to 500 6. Click "Save Subscription"                                                                                   |
| **Expected**    | Dialog title "Edit Subscription". Fields: Plan (Select), Max Students, Max Teachers, Max Spaces, Max Exams Per Month (number inputs), Expiration Date (date input). After save, toast "Subscription updated successfully", dialog closes, subscription card reflects changes. |
| **Priority**    | **P0**                                                                                                                                                                                                                                                                        |

### 5.9 Tenant Detail — Features Display

| Field           | Value                                                                                                                                                                                                    |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `should display tenant features with enabled/disabled indicators`                                                                                                                                        |
| **Description** | Features card shows a grid of feature flags with colored dot indicators                                                                                                                                  |
| **Steps**       | 1. Navigate to `/tenants/{id}` with features data                                                                                                                                                        |
| **Expected**    | Features card shows a grid with feature names. Enabled features have emerald dot, disabled features have muted dot. Feature names are formatted (camelCase split with spaces, "Enabled" suffix removed). |
| **Priority**    | **P1**                                                                                                                                                                                                   |

### 5.10 Tenant Detail — Settings Display

| Field           | Value                                                                              |
| --------------- | ---------------------------------------------------------------------------------- |
| **Test Name**   | `should display tenant settings`                                                   |
| **Description** | Settings card shows Gemini Key Set, Default AI Model, Timezone, Locale             |
| **Steps**       | 1. Navigate to `/tenants/{id}`                                                     |
| **Expected**    | Settings card with 4 key-value pairs in a 2-column grid. Missing values show "--". |
| **Priority**    | **P1**                                                                             |

### 5.11 Tenant Detail — Not Found

| Field           | Value                                                                                                                                                                 |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `should show not found state for invalid tenant ID`                                                                                                                   |
| **Description** | Non-existent tenant ID shows empty state                                                                                                                              |
| **Steps**       | 1. Navigate to `/tenants/nonexistent-id`                                                                                                                              |
| **Expected**    | "Back to Tenants" link, Building2 icon, "Tenant not found" heading, "This tenant may have been deleted or the ID is invalid." description, "View All Tenants" button. |
| **Priority**    | **P1**                                                                                                                                                                |

### 5.12 Tenant Detail — Error State

| Field           | Value                                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------ |
| **Test Name**   | `should show error state when tenant load fails`                                                       |
| **Description** | Network error when fetching tenant shows retry option                                                  |
| **Steps**       | 1. Mock Firestore to fail 2. Navigate to `/tenants/{id}`                                               |
| **Expected**    | "Back to Tenants" link visible. Destructive alert with "Failed to load tenant" and "Try again" button. |
| **Priority**    | **P1**                                                                                                 |

---

## 6. Feature Flags Page (`/feature-flags`)

### 6.1 Feature Flags — Page Layout

| Field           | Value                                                                                                                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `should display feature flags page with overview and tenant cards`                                                                                                                    |
| **Description** | Page shows header, flag overview summary, search, and per-tenant flag cards                                                                                                           |
| **Steps**       | 1. Navigate to `/feature-flags`                                                                                                                                                       |
| **Expected**    | PageHeader: "Feature Flags" with description. Flag Overview card with 9 known flags showing label, description, and enabled/total count. SearchInput. Tenant cards with flag toggles. |
| **Priority**    | **P0**                                                                                                                                                                                |

### 6.2 Feature Flags — Flag Overview Summary

| Field           | Value                                                                                                                                                                             |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `should show correct enabled/total counts in flag overview`                                                                                                                       |
| **Description** | Each flag row in the overview shows how many tenants have it enabled                                                                                                              |
| **Steps**       | 1. Navigate to `/feature-flags` 2. Check overview card                                                                                                                            |
| **Expected**    | Nine flags listed: AutoGrade, LevelUp Spaces, Scanner App, AI Chat Tutor, AI Grading, Analytics, Parent Portal, Bulk Import, API Access. Each shows "{enabled}/{total}" fraction. |
| **Priority**    | **P1**                                                                                                                                                                            |

### 6.3 Feature Flags — Search Tenants

| Field           | Value                                                                      |
| --------------- | -------------------------------------------------------------------------- |
| **Test Name**   | `should filter tenant flag cards by search`                                |
| **Description** | Search filters tenant cards by name or code                                |
| **Steps**       | 1. Navigate to `/feature-flags` 2. Type tenant name in search              |
| **Expected**    | Only tenant cards matching the search query (by name or code) are visible. |
| **Priority**    | **P1**                                                                     |

### 6.4 Feature Flags — Toggle a Flag

| Field           | Value                                                                                                                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Test Name**   | `should toggle a feature flag and show pending state`                                                                                                                                      |
| **Description** | Clicking a flag toggle marks the change as pending with a visual ring                                                                                                                      |
| **Steps**       | 1. Navigate to `/feature-flags` 2. Click on "AI Chat Tutor" toggle for a tenant                                                                                                            |
| **Expected**    | The toggle icon switches between ToggleRight (emerald, enabled) and ToggleLeft (muted, disabled). The tenant card gets a `ring-2 ring-primary/20` border. A "Save Changes" button appears. |
| **Priority**    | **P0**                                                                                                                                                                                     |

### 6.5 Feature Flags — Save Flag Changes

| Field           | Value                                                                                                                                                                   |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `should save flag changes and show saved confirmation`                                                                                                                  |
| **Description** | Clicking "Save Changes" persists toggles and shows brief "Saved" confirmation                                                                                           |
| **Steps**       | 1. Toggle a flag 2. Click "Save Changes"                                                                                                                                |
| **Expected**    | "Save Changes" button shows "Saving..." while pending. After success, a green "Saved" text with check icon appears briefly (2 seconds). Pending ring border is removed. |
| **Priority**    | **P0**                                                                                                                                                                  |

### 6.6 Feature Flags — Multiple Toggles Before Save

| Field           | Value                                                                       |
| --------------- | --------------------------------------------------------------------------- |
| **Test Name**   | `should accumulate multiple flag changes before saving`                     |
| **Description** | Multiple flags can be toggled before clicking save                          |
| **Steps**       | 1. Toggle "AutoGrade" off 2. Toggle "AI Grading" on 3. Click "Save Changes" |
| **Expected**    | Both changes are saved in a single mutation. Card reflects new flag states. |
| **Priority**    | **P1**                                                                      |

### 6.7 Feature Flags — Empty State

| Field           | Value                                                                   |
| --------------- | ----------------------------------------------------------------------- |
| **Test Name**   | `should show empty state when no tenants exist`                         |
| **Description** | Empty state with message when no tenants are available                  |
| **Steps**       | 1. Navigate to `/feature-flags` with no tenants                         |
| **Expected**    | Building2 icon, "No tenants found", "No tenants have been created yet." |
| **Priority**    | **P2**                                                                  |

### 6.8 Feature Flags — Error on Save

| Field           | Value                                                                        |
| --------------- | ---------------------------------------------------------------------------- |
| **Test Name**   | `should show error alert when flag save fails`                               |
| **Description** | Error alert appears at the bottom of the page when update fails              |
| **Steps**       | 1. Toggle a flag 2. Mock Firestore updateDoc to fail 3. Click "Save Changes" |
| **Expected**    | Destructive alert: "Failed to update flags: {message}".                      |
| **Priority**    | **P1**                                                                       |

---

## 7. System Health Page (`/system`)

### 7.1 System Health — Service Status Cards

| Field           | Value                                                                                                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `should display service status cards`                                                                                                                                     |
| **Description** | Page shows 4 service probes: Firebase Auth, Firestore, Cloud Functions, AI Grading Pipeline                                                                               |
| **Steps**       | 1. Navigate to `/system`                                                                                                                                                  |
| **Expected**    | Four service cards in a 2-column grid. Each card shows icon, service name, description, StatusBadge (operational/degraded/down). Firestore card also shows latency in ms. |
| **Priority**    | **P0**                                                                                                                                                                    |

### 7.2 System Health — Overall Status Banner

| Field           | Value                                                                                                                                                                                   |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `should show overall status banner`                                                                                                                                                     |
| **Description** | Top banner shows aggregated system status                                                                                                                                               |
| **Steps**       | 1. Navigate to `/system`                                                                                                                                                                |
| **Expected**    | Banner shows one of: "All Systems Operational" (all operational), "Some Services Degraded" (any degraded), "Service Disruption Detected" (any down). Also shows "Last checked: {time}". |
| **Priority**    | **P0**                                                                                                                                                                                  |

### 7.3 System Health — Refresh Button

| Field           | Value                                                                                                                                              |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `should refresh health checks on button click`                                                                                                     |
| **Description** | Refresh button re-runs all health probes                                                                                                           |
| **Steps**       | 1. Navigate to `/system` 2. Click "Refresh" button                                                                                                 |
| **Expected**    | RefreshCw icon spins (animate-spin class). Button text changes to "Checking...". After completion, data updates with new "Last checked" timestamp. |
| **Priority**    | **P0**                                                                                                                                             |

### 7.4 System Health — Platform Metrics

| Field           | Value                                                                                                                                                                                        |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `should display platform metrics section`                                                                                                                                                    |
| **Description** | Metrics section shows Avg Response Time, Total Users, and Error Rate                                                                                                                         |
| **Steps**       | 1. Navigate to `/system`                                                                                                                                                                     |
| **Expected**    | "Platform Metrics" card with 3 metric boxes: "Avg Response Time" showing ms value, "Total Users" with count and active tenant info, "Error Rate" showing "N/A" with "No logging system yet". |
| **Priority**    | **P1**                                                                                                                                                                                       |

### 7.5 System Health — Loading State

| Field           | Value                                                                               |
| --------------- | ----------------------------------------------------------------------------------- |
| **Test Name**   | `should show skeleton loading during health checks`                                 |
| **Description** | Skeletons shown while probes run                                                    |
| **Steps**       | 1. Navigate to `/system`                                                            |
| **Expected**    | Overall status banner shows skeleton. Four service card skeletons in 2-column grid. |
| **Priority**    | **P2**                                                                              |

### 7.6 System Health — Error State

| Field           | Value                                                                     |
| --------------- | ------------------------------------------------------------------------- |
| **Test Name**   | `should show error alert when health checks fail`                         |
| **Description** | Error alert with retry when the health check query itself fails           |
| **Steps**       | 1. Mock health checks to throw 2. Navigate to `/system`                   |
| **Expected**    | Destructive alert: "Failed to run health checks" with "Try again" button. |
| **Priority**    | **P1**                                                                    |

---

## 8. Global Presets Page (`/presets`)

### 8.1 Global Presets — List Display

| Field           | Value                                                                                                                                                                                                                                                                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `should display list of global evaluation presets`                                                                                                                                                                                                                                                                  |
| **Description** | Page shows preset cards with name, badges, description, dimensions, and display settings                                                                                                                                                                                                                            |
| **Steps**       | 1. Navigate to `/presets`                                                                                                                                                                                                                                                                                           |
| **Expected**    | PageHeader: "Global Evaluation Presets". Each preset card shows: name, "Default" badge (if isDefault), "Public" badge (if isPublic), description, dimension tags (blue for enabled, muted+strikethrough for disabled), display settings (Strengths, Key Takeaway, Priority Sort). Edit and Delete buttons per card. |
| **Priority**    | **P0**                                                                                                                                                                                                                                                                                                              |

### 8.2 Global Presets — Create Preset

| Field           | Value                                                                                                                                                                                                                                                                                                                                          |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `should create a new evaluation preset`                                                                                                                                                                                                                                                                                                        |
| **Description** | Create dialog with name, description, flags, display settings, and dimension toggles                                                                                                                                                                                                                                                           |
| **Steps**       | 1. Click "Create Preset" 2. Fill name: "My Rubric" 3. Fill description 4. Check "Set as default preset" 5. Check "Public" 6. Toggle display settings 7. Enable/disable dimensions and set weights 8. Click "Save Preset"                                                                                                                       |
| **Expected**    | Dialog opens with title "Create Preset". Form has: Name (required), Description (textarea), checkboxes (default, public), Display Settings section (showStrengths, showKeyTakeaway, prioritizeByImportance), Evaluation Dimensions section (6 dimensions with checkbox + weight input). After save, dialog closes, new preset appears in list. |
| **Priority**    | **P0**                                                                                                                                                                                                                                                                                                                                         |

### 8.3 Global Presets — Edit Preset

| Field           | Value                                                                                        |
| --------------- | -------------------------------------------------------------------------------------------- |
| **Test Name**   | `should edit an existing preset`                                                             |
| **Description** | Edit button opens dialog pre-filled with preset data                                         |
| **Steps**       | 1. Click "Edit" on a preset card 2. Change name 3. Toggle a dimension 4. Click "Save Preset" |
| **Expected**    | Dialog title "Edit Preset". Fields pre-filled. After save, preset card updates.              |
| **Priority**    | **P0**                                                                                       |

### 8.4 Global Presets — Delete Preset

| Field           | Value                                                                                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Test Name**   | `should delete a preset with confirmation`                                                                                                                   |
| **Description** | Delete button opens confirmation dialog                                                                                                                      |
| **Steps**       | 1. Click "Delete" on a preset card 2. AlertDialog appears 3. Click "Delete"                                                                                  |
| **Expected**    | AlertDialog: "Delete Preset" title, "Are you sure you want to delete '{name}'? This action cannot be undone." After confirming, preset is removed from list. |
| **Priority**    | **P0**                                                                                                                                                       |

### 8.5 Global Presets — Cancel Delete

| Field           | Value                                           |
| --------------- | ----------------------------------------------- |
| **Test Name**   | `should cancel preset deletion`                 |
| **Description** | Cancel in delete dialog preserves the preset    |
| **Steps**       | 1. Click "Delete" on a preset 2. Click "Cancel" |
| **Expected**    | Dialog closes. Preset still in list.            |
| **Priority**    | **P1**                                          |

### 8.6 Global Presets — Dimension Weight Input

| Field           | Value                                                                                                                                              |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `should allow setting dimension weights`                                                                                                           |
| **Description** | Each dimension has a weight number input (1-5) that is disabled when dimension is unchecked                                                        |
| **Steps**       | 1. Open create/edit dialog 2. Check "Critical Thinking" 3. Set weight to 3 4. Uncheck "Grammar"                                                    |
| **Expected**    | Weight input enabled when dimension is checked, disabled when unchecked. Weight value reflects in dimension tags (e.g., "Critical Thinking (3x)"). |
| **Priority**    | **P1**                                                                                                                                             |

### 8.7 Global Presets — Empty State

| Field           | Value                                                                                                                               |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `should show empty state when no presets exist`                                                                                     |
| **Description** | Sliders icon and message when no presets                                                                                            |
| **Steps**       | 1. Navigate to `/presets` with no presets in DB                                                                                     |
| **Expected**    | Sliders icon, "No global presets" heading, "Create evaluation presets that tenants can adopt" text, "Create Preset" outline button. |
| **Priority**    | **P2**                                                                                                                              |

### 8.8 Global Presets — Validation

| Field           | Value                                     |
| --------------- | ----------------------------------------- |
| **Test Name**   | `should disable save when name is empty`  |
| **Description** | Save button disabled without a name       |
| **Steps**       | 1. Open create dialog 2. Leave name empty |
| **Expected**    | "Save Preset" button is disabled.         |
| **Priority**    | **P1**                                    |

### 8.9 Global Presets — Error Handling

| Field           | Value                                                                          |
| --------------- | ------------------------------------------------------------------------------ |
| **Test Name**   | `should show error in form dialog on save failure`                             |
| **Description** | Server error displays inside the form dialog                                   |
| **Steps**       | 1. Open create dialog 2. Fill data 3. Mock save to fail 4. Click "Save Preset" |
| **Expected**    | Destructive alert inside dialog showing error message. Dialog stays open.      |
| **Priority**    | **P1**                                                                         |

---

## 9. User Analytics Page (`/analytics`)

### 9.1 User Analytics — Summary Stat Cards

| Field           | Value                                                                                                                                                              |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Test Name**   | `should display user analytics stat cards`                                                                                                                         |
| **Description** | Four stat cards showing Total Users, Students, Teachers, Active Tenants                                                                                            |
| **Steps**       | 1. Navigate to `/analytics`                                                                                                                                        |
| **Expected**    | Four StatCards: "Total Users" (with tenant count subtext), "Students" (with percentage), "Teachers" (with percentage), "Active Tenants" (with "of {total} total"). |
| **Priority**    | **P0**                                                                                                                                                             |

### 9.2 User Analytics — Users by Plan Chart

| Field           | Value                                                                                                                                                       |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `should display users by subscription plan with progress bars`                                                                                              |
| **Description** | Card shows plan breakdown with progress bars                                                                                                                |
| **Steps**       | 1. Navigate to `/analytics`                                                                                                                                 |
| **Expected**    | "Users by Subscription Plan" card. Each plan shows: capitalized plan name, user count with percentage, Progress bar. Plans sorted by user count descending. |
| **Priority**    | **P1**                                                                                                                                                      |

### 9.3 User Analytics — Users by Tenant Table

| Field           | Value                                                                                                                                                                               |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `should display users by tenant breakdown table`                                                                                                                                    |
| **Description** | Table sorted by total users descending                                                                                                                                              |
| **Steps**       | 1. Navigate to `/analytics`                                                                                                                                                         |
| **Expected**    | "Users by Tenant" card with table. Columns: Tenant, Code, Students, Teachers, Total, Status. Rows sorted by total descending. "Sorted by total users, descending" subtitle visible. |
| **Priority**    | **P0**                                                                                                                                                                              |

### 9.4 User Analytics — Empty Tenant Table

| Field           | Value                                                                             |
| --------------- | --------------------------------------------------------------------------------- |
| **Test Name**   | `should show empty state in tenant table when no tenants`                         |
| **Description** | Empty table shows icon and message                                                |
| **Steps**       | 1. Navigate to `/analytics` with no tenants                                       |
| **Expected**    | Table cell spanning 6 columns with Building2 icon and "No tenants found" heading. |
| **Priority**    | **P2**                                                                            |

### 9.5 User Analytics — Loading State

| Field           | Value                                                   |
| --------------- | ------------------------------------------------------- |
| **Test Name**   | `should show skeleton loading for analytics page`       |
| **Description** | Skeletons for stat cards and plan breakdown             |
| **Steps**       | 1. Navigate to `/analytics` before data loads           |
| **Expected**    | Four skeleton stat cards. Skeleton plan breakdown card. |
| **Priority**    | **P2**                                                  |

### 9.6 User Analytics — Error State

| Field           | Value                                                                                          |
| --------------- | ---------------------------------------------------------------------------------------------- |
| **Test Name**   | `should show error with retry on analytics page`                                               |
| **Description** | Error alert when data fetch fails                                                              |
| **Steps**       | 1. Mock Firestore to fail 2. Navigate to `/analytics`                                          |
| **Expected**    | PageHeader still visible. Destructive alert with "Failed to load data" and "Try again" button. |
| **Priority**    | **P1**                                                                                         |

---

## 10. Settings Page (`/settings`)

### 10.1 Settings — Page Layout

| Field           | Value                                                                                                                                                                                                                           |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `should display settings page with all configuration cards`                                                                                                                                                                     |
| **Description** | Settings page shows Platform Announcement, Default Features, System Configuration, Admin Account cards                                                                                                                          |
| **Steps**       | 1. Navigate to `/settings`                                                                                                                                                                                                      |
| **Expected**    | PageHeader: "Platform Settings" with "Save Settings" button. Four cards: Platform Announcement (Bell icon), Default Features for New Tenants (ToggleLeft icon), System Configuration (Globe icon), Admin Account (Shield icon). |
| **Priority**    | **P0**                                                                                                                                                                                                                          |

### 10.2 Settings — Platform Announcement

| Field           | Value                                                                                                                                                                                          |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `should edit platform announcement text`                                                                                                                                                       |
| **Description** | Textarea for broadcast announcement to all tenants                                                                                                                                             |
| **Steps**       | 1. Navigate to `/settings` 2. Type announcement text in textarea 3. Observe description text change                                                                                            |
| **Expected**    | Textarea accepts input. When text is present: "Announcement will be visible to all tenant admins." When empty: "No active announcement." "Save Settings" button becomes enabled (dirty state). |
| **Priority**    | **P1**                                                                                                                                                                                         |

### 10.3 Settings — Default Feature Toggles

| Field           | Value                                                                                                                                                                                                                              |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `should toggle default features for new tenants`                                                                                                                                                                                   |
| **Description** | Switch toggles for 7 default feature flags                                                                                                                                                                                         |
| **Steps**       | 1. Navigate to `/settings` 2. Toggle "AI Chat / Tutoring" switch off                                                                                                                                                               |
| **Expected**    | Seven feature toggles: Auto Grade, Learning Spaces, AI Grading, AI Chat / Tutoring, Analytics, Parent Portal, Bulk Import. Each with label and description. Switch reflects current state. "Save Settings" button becomes enabled. |
| **Priority**    | **P1**                                                                                                                                                                                                                             |

### 10.4 Settings — Maintenance Mode Toggle

| Field           | Value                                                                                                                  |
| --------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `should toggle maintenance mode`                                                                                       |
| **Description** | System Configuration card has a maintenance mode switch                                                                |
| **Steps**       | 1. Navigate to `/settings` 2. Toggle "Maintenance Mode" switch on                                                      |
| **Expected**    | Switch toggles. Description: "When enabled, non-admin users will see a maintenance page". Save button becomes enabled. |
| **Priority**    | **P0**                                                                                                                 |

### 10.5 Settings — Save Settings

| Field           | Value                                                                                                                           |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `should save settings and show success toast`                                                                                   |
| **Description** | Clicking Save Settings persists configuration                                                                                   |
| **Steps**       | 1. Make any change 2. Click "Save Settings"                                                                                     |
| **Expected**    | Button text changes to "Saving...". On success, toast "Settings saved successfully". Button becomes disabled again (not dirty). |
| **Priority**    | **P0**                                                                                                                          |

### 10.6 Settings — Save Button Disabled When Clean

| Field           | Value                                                                                     |
| --------------- | ----------------------------------------------------------------------------------------- |
| **Test Name**   | `should keep save button disabled when no changes made`                                   |
| **Description** | Save button starts disabled and enables only on changes                                   |
| **Steps**       | 1. Navigate to `/settings` 2. Wait for load 3. Observe Save button                        |
| **Expected**    | "Save Settings" button is disabled initially. Becomes enabled only when a change is made. |
| **Priority**    | **P1**                                                                                    |

### 10.7 Settings — Save Error

| Field           | Value                                                                      |
| --------------- | -------------------------------------------------------------------------- |
| **Test Name**   | `should show error toast when save fails`                                  |
| **Description** | Save failure shows toast error                                             |
| **Steps**       | 1. Make a change 2. Mock Firestore setDoc to fail 3. Click "Save Settings" |
| **Expected**    | Toast: "Failed to save settings: {message}".                               |
| **Priority**    | **P1**                                                                     |

### 10.8 Settings — Admin Account Card

| Field           | Value                                                                                          |
| --------------- | ---------------------------------------------------------------------------------------------- |
| **Test Name**   | `should display admin account info with sign out`                                              |
| **Description** | Admin Account card shows current user info and Sign Out button                                 |
| **Steps**       | 1. Navigate to `/settings`                                                                     |
| **Expected**    | Card shows user display name (or "Super Admin") and email. "Sign Out" button with LogOut icon. |
| **Priority**    | **P1**                                                                                         |

### 10.9 Settings — Sign Out from Settings

| Field           | Value                                                                |
| --------------- | -------------------------------------------------------------------- |
| **Test Name**   | `should sign out from settings page`                                 |
| **Description** | Sign Out button on settings page logs out                            |
| **Steps**       | 1. Navigate to `/settings` 2. Click "Sign Out" in Admin Account card |
| **Expected**    | User logged out and redirected to `/login`.                          |
| **Priority**    | **P1**                                                               |

### 10.10 Settings — Read-Only System Config Fields

| Field           | Value                                                                                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Test Name**   | `should show read-only system config fields`                                                                                                                 |
| **Description** | Default Plan and Max Tenants Allowed are read-only                                                                                                           |
| **Steps**       | 1. Navigate to `/settings`                                                                                                                                   |
| **Expected**    | "Default Plan" input shows value (e.g., "trial") with `readOnly` and `bg-muted` class. "Max Tenants Allowed" shows value or "Unlimited" with same treatment. |
| **Priority**    | **P2**                                                                                                                                                       |

---

## 11. Navigation & Sidebar

### 11.1 Sidebar — Nav Groups and Items

| Field           | Value                                                                                                                                                                                                 |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `should display sidebar with correct nav groups and items`                                                                                                                                            |
| **Description** | Sidebar shows Overview, Platform, System groups with correct links                                                                                                                                    |
| **Steps**       | 1. Login 2. Observe sidebar                                                                                                                                                                           |
| **Expected**    | App name "Super Admin" at top. Three groups: Overview (Dashboard), Platform (Tenants, User Analytics, Feature Flags, Global Presets), System (System Health, Settings). Footer shows user name/email. |
| **Priority**    | **P0**                                                                                                                                                                                                |

### 11.2 Sidebar — Active State

| Field           | Value                                                                                                                            |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `should highlight active sidebar item based on current route`                                                                    |
| **Description** | Current page's nav item is visually active                                                                                       |
| **Steps**       | 1. Navigate to `/tenants` 2. Check sidebar "Tenants" item 3. Navigate to `/settings` 4. Check sidebar "Settings" item            |
| **Expected**    | Active item is visually distinguished (isActive prop true). `/tenants/{id}` also activates "Tenants" item (startsWith matching). |
| **Priority**    | **P1**                                                                                                                           |

### 11.3 Sidebar — Navigation Links

| Field           | Value                                                                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `should navigate to all pages via sidebar links`                                                                                            |
| **Description** | Each sidebar link navigates to the correct route                                                                                            |
| **Steps**       | 1. Login 2. Click each sidebar item in sequence: Dashboard, Tenants, User Analytics, Feature Flags, Global Presets, System Health, Settings |
| **Expected**    | Each click navigates to the correct URL: `/`, `/tenants`, `/analytics`, `/feature-flags`, `/presets`, `/system`, `/settings`.               |
| **Priority**    | **P0**                                                                                                                                      |

### 11.4 Sidebar — User Info Footer

| Field           | Value                                                               |
| --------------- | ------------------------------------------------------------------- |
| **Test Name**   | `should show user info in sidebar footer`                           |
| **Description** | Sidebar footer displays current user's display name or email        |
| **Steps**       | 1. Login 2. Check sidebar footer                                    |
| **Expected**    | Footer shows truncated display name or email of the logged-in user. |
| **Priority**    | **P2**                                                              |

---

## 12. 404 / Not Found

### 12.1 Not Found — Authenticated Unknown Route

| Field           | Value                                                                                        |
| --------------- | -------------------------------------------------------------------------------------------- |
| **Test Name**   | `should show 404 page for unknown routes when authenticated`                                 |
| **Description** | Unknown routes inside the app layout show NotFoundPage                                       |
| **Steps**       | 1. Login 2. Navigate to `/unknown-page`                                                      |
| **Expected**    | `NotFoundPage` component renders (from shared-ui). Sidebar still visible (inside AppLayout). |
| **Priority**    | **P1**                                                                                       |

### 12.2 Not Found — Unauthenticated Unknown Route

| Field           | Value                                                                                    |
| --------------- | ---------------------------------------------------------------------------------------- |
| **Test Name**   | `should show 404 for unknown routes outside auth`                                        |
| **Description** | Unknown routes outside the auth/app tree hit the outer catch-all                         |
| **Steps**       | 1. Without logging in, navigate to a completely unknown path that doesn't match `/login` |
| **Expected**    | `NotFoundPage` component renders (no sidebar, no auth layout).                           |
| **Priority**    | **P2**                                                                                   |

---

## 13. Cross-Cutting Concerns

### 13.1 Error States — Network Errors on All Pages

| Field           | Value                                                                                                                                                                  |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `should handle network errors gracefully on all data pages`                                                                                                            |
| **Description** | Every data-fetching page shows a destructive Alert with retry                                                                                                          |
| **Steps**       | 1. For each page (Dashboard, Tenants, Tenant Detail, Feature Flags, System Health, Global Presets, User Analytics, Settings): mock network failure and verify error UI |
| **Expected**    | Each page shows a destructive Alert with AlertCircle icon, error title, error message, and "Try again" button.                                                         |
| **Priority**    | **P1**                                                                                                                                                                 |

### 13.2 Toast Notifications

| Field           | Value                                                                                                                                                                                                                                                                                                 |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `should show toast notifications for mutations`                                                                                                                                                                                                                                                       |
| **Description** | Success and error toasts appear for tenant edit, tenant delete, subscription update, settings save                                                                                                                                                                                                    |
| **Steps**       | 1. Perform each mutation operation 2. Observe toast                                                                                                                                                                                                                                                   |
| **Expected**    | Success toasts: "Tenant updated successfully", "Tenant deleted successfully", "Subscription updated successfully", "Settings saved successfully". Error toasts: "Failed to update tenant: ...", "Failed to delete tenant: ...", "Failed to update subscription: ...", "Failed to save settings: ...". |
| **Priority**    | **P1**                                                                                                                                                                                                                                                                                                |

### 13.3 Responsive Layout

| Field           | Value                                                                                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `should render responsive grid layouts`                                                                                                                 |
| **Description** | Stat cards and content areas adapt to screen size                                                                                                       |
| **Steps**       | 1. Set viewport to desktop (1280px) 2. Check stat cards are in 4-column grid 3. Set viewport to tablet (768px) 4. Check stat cards are in 2-column grid |
| **Expected**    | Desktop: `lg:grid-cols-4` active. Tablet: `md:grid-cols-2` active.                                                                                      |
| **Priority**    | **P2**                                                                                                                                                  |

### 13.4 Dialog Accessibility

| Field           | Value                                                                                                    |
| --------------- | -------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `should support keyboard navigation in dialogs`                                                          |
| **Description** | Dialogs can be closed with Escape, focus is trapped                                                      |
| **Steps**       | 1. Open any dialog (Create Tenant, Edit Tenant, etc.) 2. Press Escape 3. Re-open 4. Tab through elements |
| **Expected**    | Escape closes dialog. Focus is trapped within dialog. Tab navigates through form elements.               |
| **Priority**    | **P2**                                                                                                   |

### 13.5 Form Accessibility

| Field           | Value                                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------- |
| **Test Name**   | `should have proper labels on all form inputs`                                                                |
| **Description** | All inputs have associated Label elements via htmlFor/id                                                      |
| **Steps**       | 1. Open login page 2. Check email and password labels 3. Open create tenant dialog 4. Check all labels        |
| **Expected**    | Every Input has an associated Label with matching `htmlFor`/`id`. Screen reader can identify all form fields. |
| **Priority**    | **P2**                                                                                                        |

---

## Summary by Priority

| Priority  | Count  | Description                                                                                 |
| --------- | ------ | ------------------------------------------------------------------------------------------- |
| **P0**    | 24     | Critical flows: login, logout, auth guard, CRUD operations, core page rendering, navigation |
| **P1**    | 28     | Important functionality: search, filter, validation, error handling, secondary features     |
| **P2**    | 15     | Polish: loading states, empty states, accessibility, responsive layout, UI details          |
| **Total** | **67** |                                                                                             |
