# UI/UX Audit: Super-Admin App

**Date:** March 4, 2026 **Auditor:** UI/UX Design Agent **App:** Super-Admin
(`apps/super-admin/`) **Port:** 4567 **Tech Stack:** React 18, Vite 5.4,
Tailwind CSS 3.4, shared-ui (shadcn/ui + Radix), Firebase 11, React Router v7,
TanStack React Query v5, Lucide React, react-hook-form, Zod

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State Analysis](#2-current-state-analysis)
3. [Issues Found](#3-issues-found)
4. [Page-by-Page Improvement Recommendations](#4-page-by-page-improvement-recommendations)
5. [Component Quality & Design System Adherence](#5-component-quality--design-system-adherence)
6. [Navigation & Information Architecture](#6-navigation--information-architecture)
7. [Super-Admin Dashboard Patterns](#7-super-admin-dashboard-patterns)
8. [Multi-Tenant UX Recommendations](#8-multi-tenant-ux-recommendations)
9. [Security UX](#9-security-ux)
10. [Accessibility Audit](#10-accessibility-audit)
11. [Loading, Empty & Error States](#11-loading-empty--error-states)
12. [Dark Mode & Theming](#12-dark-mode--theming)
13. [Responsive Design](#13-responsive-design)
14. [Implementation Roadmap](#14-implementation-roadmap)

---

## 1. Executive Summary

### Overview

The Super-Admin app is the platform-level management console for the LevelUp
educational platform. It enables super-administrators to manage tenants
(schools), monitor system health, configure platform-wide settings, manage
feature flags, create evaluation rubric presets, and view cross-platform user
analytics. The app consists of 8 authenticated pages plus a login page, wrapped
in a sidebar-based layout shell.

### Strengths

- **Solid architectural foundation**: Clean route structure using `RequireAuth`
  guard with defense-in-depth (Firebase custom claims + Firestore doc
  verification). Well-organized file structure with clear separation of pages,
  layouts, guards, and utilities.
- **Shared-UI integration**: Uses `AppShell` + `AppSidebar` from shared-ui for
  consistent layout, plus shared `Dialog`, `AlertDialog`, `Button`, `Input`,
  `Label`, `Card`, `Switch`, `Textarea`, and `Checkbox` components.
- **React Query usage**: Server state is well-managed with
  `useQuery`/`useMutation` patterns, proper cache invalidation via
  `queryClient.invalidateQueries()`, and appropriate stale times per query.
- **Functional completeness**: Covers all critical super-admin operations
  (tenant CRUD, subscription management, feature flags, evaluation presets,
  system health monitoring, platform configuration).
- **Security-conscious**: Auth guard verifies both Firestore `user.isSuperAdmin`
  AND Firebase custom claims `role === "superAdmin"`. Delete operations use
  recursive Cloud Functions. Mutations properly handle loading/error states.
- **Toast notifications**: Uses Sonner toasts for mutation success/error
  feedback across tenant operations and settings.

### Critical Concerns

- **No dark mode support**: `index.css` only defines `:root` light theme
  variables with no `.dark` class or `prefers-color-scheme` media query. The app
  will appear broken if a system-level dark mode is active.
- **Hardcoded status badge colors**: Status badges use raw Tailwind colors
  (`bg-green-100 text-green-700`, `bg-blue-100`, `bg-red-100`, `bg-gray-100`)
  instead of design tokens. These appear 7+ times across pages with copy-pasted
  conditional class strings.
- **Raw HTML elements instead of shared-ui**: Login page uses raw `<input>` and
  `<button>` elements instead of `Input` and `Button` from shared-ui. Tenants
  page search uses raw `<input>`. Feature flags uses raw `<input>` and
  `<button>`. System health uses raw `<button>`. Native `<select>` used in 4
  form dialogs instead of the shared-ui `Select` component.
- **No loading skeletons on most pages**: Only `UserAnalyticsPage` and
  `SystemHealthPage` show skeleton/pulse states during loading. Other pages
  display plain "Loading..." text strings.
- **Tables are raw HTML**: All data tables (`TenantsPage`, `UserAnalyticsPage`)
  use raw `<table>` elements instead of the shared-ui `Table` component, missing
  consistent styling, hover states, and accessibility attributes.
- **No pagination**: Tenant and analytics tables load all records without
  pagination, creating scaling issues.
- **No breadcrumbs**: The `AppShell` supports a `pageTitle` prop for
  breadcrumbs, but the super-admin app never passes it, resulting in empty
  header space.
- **Inconsistent form management**: Forms use manual `useState` instead of
  `react-hook-form` + Zod validation, leading to verbose code and missing
  client-side validation.

### Overall Grade: **C+** - Functionally complete, but UI polish, consistency, and accessibility need significant improvement.

---

## 2. Current State Analysis

### 2.1 App Architecture

```
src/
├── main.tsx                    # Entry: Firebase init, QueryClient, Router, Toaster
├── App.tsx                     # Route definitions with auth guard
├── index.css                   # Tailwind directives + HSL light theme only
├── layouts/
│   ├── AppLayout.tsx           # AppShell + AppSidebar wrapper
│   └── AuthLayout.tsx          # Centered auth page container
├── guards/
│   └── RequireAuth.tsx         # Defense-in-depth auth + role verification
├── pages/
│   ├── LoginPage.tsx           # Email/password login
│   ├── DashboardPage.tsx       # Platform stats overview
│   ├── TenantsPage.tsx         # Tenant list + create dialog
│   ├── TenantDetailPage.tsx    # Single tenant view + edit/delete/subscription
│   ├── GlobalPresetsPage.tsx   # Evaluation rubric preset management
│   ├── SystemHealthPage.tsx    # Service health probes + metrics
│   ├── UserAnalyticsPage.tsx   # Cross-platform user statistics
│   ├── FeatureFlagsPage.tsx    # Per-tenant feature toggles
│   └── SettingsPage.tsx        # Platform-wide configuration
└── lib/
    └── utils.ts                # cn() utility
```

### 2.2 Route Map

| Route                | Page              | Auth | Description                        |
| -------------------- | ----------------- | ---- | ---------------------------------- |
| `/login`             | LoginPage         | No   | Email/password login               |
| `/`                  | DashboardPage     | Yes  | Platform overview with stats       |
| `/tenants`           | TenantsPage       | Yes  | Tenant list with search/filter     |
| `/tenants/:tenantId` | TenantDetailPage  | Yes  | Single tenant details + management |
| `/analytics`         | UserAnalyticsPage | Yes  | Cross-platform user statistics     |
| `/feature-flags`     | FeatureFlagsPage  | Yes  | Per-tenant feature toggles         |
| `/presets`           | GlobalPresetsPage | Yes  | Evaluation rubric presets          |
| `/system`            | SystemHealthPage  | Yes  | System health monitoring           |
| `/settings`          | SettingsPage      | Yes  | Platform-wide settings             |
| `*`                  | NotFoundPage      | No   | 404 catch-all                      |

### 2.3 Data Flow

- **Auth**: `useAuthStore` (Zustand) from `@levelup/shared-stores` manages
  Firebase auth state
- **Server State**: React Query with query key pattern
  `["platform", "<resource>"]`
- **Mutations**: Cloud Functions (`saveTenant`, `deleteTenant`,
  `saveGlobalEvaluationPreset`) via `httpsCallable()`, plus direct Firestore
  writes for feature flags and platform config
- **Stale Times**: 0s (health checks), 30s (tenant detail), 60s (tenants, stats,
  analytics, config), 5m (presets)

### 2.4 Shared-UI Usage Inventory

| Component       | Used In                                        | Notes                                        |
| --------------- | ---------------------------------------------- | -------------------------------------------- |
| `AppShell`      | AppLayout                                      | Core layout shell                            |
| `AppSidebar`    | AppLayout                                      | Navigation sidebar                           |
| `Button`        | Tenants, TenantDetail, GlobalPresets, Settings | Primary action buttons                       |
| `Input`         | Tenants, TenantDetail, GlobalPresets, Settings | Form text inputs                             |
| `Label`         | Tenants, TenantDetail, GlobalPresets, Settings | Form labels                                  |
| `Textarea`      | GlobalPresets, Settings                        | Multi-line inputs                            |
| `Dialog`        | Tenants, TenantDetail, GlobalPresets           | Modal forms                                  |
| `AlertDialog`   | TenantDetail, GlobalPresets                    | Delete confirmations                         |
| `Card`          | Settings only                                  | Card layout with header/content              |
| `Checkbox`      | GlobalPresets                                  | Dimension/flag toggles                       |
| `Switch`        | Settings                                       | Feature/maintenance toggles                  |
| `LogoutButton`  | Dashboard, Settings                            | Sign out action                              |
| `ErrorBoundary` | main.tsx                                       | Error boundary wrapper                       |
| `SonnerToaster` | main.tsx                                       | Toast notification container                 |
| `NotFoundPage`  | App.tsx                                        | 404 fallback                                 |
| `Badge`         | **NOT USED**                                   | Available but status badges are hand-coded   |
| `Table`         | **NOT USED**                                   | Available but tables use raw HTML            |
| `Skeleton`      | **NOT USED**                                   | Available but loading states use plain text  |
| `Select`        | **NOT USED**                                   | Available but forms use native `<select>`    |
| `Progress`      | **NOT USED**                                   | Available but analytics uses hand-coded bars |
| `Tabs`          | **NOT USED**                                   | Could improve TenantDetailPage layout        |

---

## 3. Issues Found

### 3.1 Critical Issues (4)

#### C1. No Dark Mode CSS Variables

- **File:** `src/index.css`
- **Impact:** App may render unreadable text/backgrounds if user has system dark
  mode enabled
- **Details:** Only `:root` (light) variables are defined. No `.dark` class or
  `@media (prefers-color-scheme: dark)` block exists. All other apps in the
  monorepo should have both themes defined.
- **Fix:** Add a `.dark` block with inverted HSL values matching the shared
  tailwind-config dark theme.

#### C2. Hardcoded Status Badge Colors (Repeated 7+ Times)

- **Files:** `DashboardPage.tsx:135-141`, `TenantsPage.tsx:32-37,197-198`,
  `TenantDetailPage.tsx:229-237`, `UserAnalyticsPage.tsx:246-253`,
  `FeatureFlagsPage.tsx:201-206`
- **Impact:** Inconsistent appearance across pages, no dark mode support,
  violates DRY
- **Details:** Status badges use identical conditional class strings copy-pasted
  across 5+ files:
  ```tsx
  tenant.status === "active"
    ? "bg-green-100 text-green-700"
    : tenant.status === "trial"
      ? "bg-blue-100 text-blue-700"
      : ...
  ```
  These raw Tailwind colors bypass the HSL design token system and will not
  adapt to dark mode.
- **Fix:** Create a `<StatusBadge status={status} />` component in shared-ui
  using the `Badge` component with CVA variants for `active`, `trial`,
  `suspended`, `expired` statuses.

#### C3. Raw HTML Elements Instead of Design System Components

- **Files:** `LoginPage.tsx:46-69,72-78`, `TenantsPage.tsx:113-119`,
  `FeatureFlagsPage.tsx:164-170`, `SystemHealthPage.tsx:197-203`
- **Impact:** Visual inconsistency, missing accessibility attributes, bypassed
  design tokens
- **Details:**
  - **LoginPage**: Uses raw `<input>` elements with manually copied Tailwind
    classes instead of `Input` from shared-ui. Uses raw `<button>` instead of
    `Button`.
  - **TenantsPage search**: Uses raw `<input>` instead of `Input`.
  - **FeatureFlagsPage search**: Uses raw `<input>` instead of `Input`.
  - **SystemHealthPage refresh**: Uses raw `<button>` instead of `Button`.
  - **4 forms**: Use native `<select>` elements (TenantsPage, TenantDetailPage
    x2, GlobalPresetsPage) instead of shared-ui `Select`.
- **Fix:** Replace all raw elements with shared-ui components. This ensures
  consistent styling, focus ring behavior, dark mode compatibility, and ARIA
  attributes.

#### C4. No Pagination on Data Tables

- **Files:** `TenantsPage.tsx`, `UserAnalyticsPage.tsx`, `FeatureFlagsPage.tsx`
- **Impact:** Performance degradation and unusable UI at scale (100+ tenants)
- **Details:** All data is fetched and rendered in a single pass with no
  pagination, virtual scrolling, or lazy loading. The
  `getDocs(collection(db, "tenants"))` call loads every tenant document into
  memory.
- **Fix:** Add cursor-based pagination using Firestore `startAfter`/`limit`
  queries, or at minimum implement client-side pagination with a `Pagination`
  component from shared-ui.

### 3.2 Major Issues (8)

#### M1. No Breadcrumbs in Header

- **File:** `layouts/AppLayout.tsx:93-96`
- **Impact:** Users lose contextual awareness of their location; header space is
  wasted
- **Details:** `AppShell` accepts a `pageTitle` prop that renders in the header
  breadcrumb area, but `AppLayout` never passes it. The header shows only the
  sidebar trigger and a separator.
- **Fix:** Either pass `pageTitle` to `AppShell` dynamically (e.g., via route
  metadata or a context), or render breadcrumbs in each page header.

#### M2. No Loading Skeletons

- **Files:** `DashboardPage.tsx:94-97`, `TenantsPage.tsx:163-167`,
  `TenantDetailPage.tsx:186-192`, `GlobalPresetsPage.tsx:271-274`,
  `FeatureFlagsPage.tsx:174-177`, `SettingsPage.tsx:144-148`
- **Impact:** Poor perceived performance; layout shift when content loads
- **Details:** 6 out of 8 pages show plain "Loading..." text or simple text-only
  states. Only `UserAnalyticsPage` uses `animate-pulse` skeleton rectangles, and
  `SystemHealthPage` uses basic pulse blocks.
- **Fix:** Use shared-ui `Skeleton` component to create proper content-shaped
  loading placeholders that match the layout of the loaded content.

#### M3. Tables Not Using Shared-UI Table Component

- **Files:** `TenantsPage.tsx:138-216`, `UserAnalyticsPage.tsx:183-265`
- **Impact:** Inconsistent table styling across the monorepo, missing semantic
  table attributes
- **Details:** Tables are built with raw `<table>`, `<thead>`, `<tbody>`,
  `<tr>`, `<td>` elements with manual Tailwind classes. The shared-ui exports a
  full `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`
  component set with consistent styling.
- **Fix:** Refactor to use shared-ui `Table` components for consistency and
  future features (sortable columns, row selection).

#### M4. Form Dialogs Use Manual State Instead of react-hook-form

- **Files:** `TenantsPage.tsx:39-53,224-307`,
  `TenantDetailPage.tsx:53-68,407-580`, `GlobalPresetsPage.tsx:109-135,449-587`
- **Impact:** Verbose code, no client-side validation, poor error UX, no
  field-level errors
- **Details:** Every form dialog manages state with individual `useState` calls
  and manual `setFormData` patterns. No Zod schemas for validation. Required
  fields only checked at the button `disabled` level (e.g.,
  `!formData.name.trim()`), with no inline error messages.
- **Fix:** Migrate forms to `react-hook-form` with Zod schemas. Use shared-ui
  `Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormMessage`
  components for consistent form patterns with inline validation errors.

#### M5. Dashboard Has No Charts or Visual Analytics

- **File:** `DashboardPage.tsx`
- **Impact:** Dashboard feels bare and provides only numbers without trends or
  visual context
- **Details:** The dashboard shows 4 stat cards and a recent tenants list. There
  are no charts, graphs, or trend indicators. For a super-admin managing a
  platform, visual analytics (growth trends, user distribution, activity over
  time) are essential for decision-making.
- **Fix:** Add charts using the `recharts` library (already a dependency). Add a
  line chart for tenant growth over time, a pie/donut chart for user
  distribution by role, and bar charts for usage metrics.

#### M6. Sidebar Footer Is Minimal

- **File:** `layouts/AppLayout.tsx:78-82`
- **Impact:** No user avatar, no quick actions, no role indicator
- **Details:** The sidebar footer only shows a truncated display name/email in
  small muted text. It lacks a user avatar, logout option, profile link, or
  super-admin role badge.
- **Fix:** Add an avatar (or initials fallback), display the role, and include a
  dropdown menu with "Profile", "Sign Out", and theme toggle options. Consider
  using the shared-ui `DropdownMenu` component.

#### M7. Feature Flags Uses Direct Firestore Write

- **File:** `FeatureFlagsPage.tsx:68-71`
- **Impact:** Bypasses Cloud Function validation and audit trail
- **Details:** Feature flags are saved via
  `updateDoc(doc(db, "tenants", tenantId), { features: flags })` directly, while
  all other mutations use Cloud Functions. This inconsistency means feature flag
  changes skip any server-side validation, rate limiting, or audit logging.
- **Fix:** Route through a Cloud Function (e.g., `updateTenantFeatures`) for
  consistency with the rest of the mutation pattern.

#### M8. Stat Cards Are Hand-Built, Not Using Card Component

- **Files:** `DashboardPage.tsx:100-111`, `TenantDetailPage.tsx:252-277`,
  `UserAnalyticsPage.tsx:136-147`
- **Impact:** Inconsistent card styling, not using the shared-ui Card component
- **Details:** Stat cards use `<div className="rounded-lg border bg-card p-4">`
  instead of `<Card>` from shared-ui. While visually similar, this misses the
  `shadow-card` style and the compositional API (`CardHeader`, `CardTitle`,
  `CardContent`).
- **Fix:** Refactor to use shared-ui `Card` component for consistent elevation
  and structure.

### 3.3 Minor Issues (10)

#### m1. Login Page Missing Branding

- **File:** `LoginPage.tsx:28-33`
- **Details:** Login shows "Super Admin" text with no logo, icon, or brand
  colors. A platform admin portal should have a professional branded login.
- **Fix:** Add the LevelUp logo, a gradient background, and a stronger visual
  identity.

#### m2. Access Denied Page Is Minimal

- **File:** `guards/RequireAuth.tsx:44-52`
- **Details:** Shows plain "Access Denied" text with no styling, icon, or action
  button. Users are stuck with no way to navigate.
- **Fix:** Add a Shield/Lock icon, a styled card container, a "Back to Login"
  button, and a "Contact Administrator" suggestion.

#### m3. Tenant Detail Not Found State

- **File:** `TenantDetailPage.tsx:194-209`
- **Details:** Shows "Tenant not found" in a dashed border container. Should
  include an icon (e.g., `Building2`) and a clear call-to-action.

#### m4. Feature Names Are camelCase in UI

- **File:** `TenantDetailPage.tsx:366-369`
- **Details:** Feature keys are displayed after a regex transform
  (`key.replace(/([A-Z])/g, " $1").replace("Enabled", "").trim()`) but this
  produces inconsistent labels like "Auto Grade", "Level Up", "Ai Chat". The
  labels should come from a lookup map.

#### m5. No Confirmation for Maintenance Mode Toggle

- **File:** `SettingsPage.tsx:229-239`
- **Details:** Toggling maintenance mode (which blocks all non-admin users) is a
  simple `Switch` with no confirmation dialog. This destructive action should
  require explicit confirmation.

#### m6. Health Check Probes Cloud Function By Calling `saveTenant` with Empty Payload

- **File:** `SystemHealthPage.tsx:58-59`
- **Details:** The Cloud Functions health probe calls
  `httpsCallable(functions, "saveTenant")({})`, relying on it to throw an error
  that indicates the function is reachable. While functional, this could trigger
  side effects if the function implementation changes.
- **Fix:** Create a dedicated `healthCheck` Cloud Function or use a lightweight
  ping endpoint.

#### m7. Error Rate Shows "N/A" Permanently

- **File:** `SystemHealthPage.tsx:319-323`
- **Details:** The Error Rate metric always displays "N/A" with "No logging
  system yet". Either remove the metric or implement it.

#### m8. UserAnalyticsPage "Teachers" Icon Is Wrong

- **File:** `UserAnalyticsPage.tsx:113`
- **Details:** The "Teachers" stat card uses `TrendingUp` icon instead of a
  teacher-related icon like `GraduationCap` or `UserCheck`.

#### m9. Logout Button on Dashboard and Settings Is Redundant

- **Files:** `DashboardPage.tsx:86-91`, `SettingsPage.tsx:280-286`
- **Details:** The LogoutButton appears in the dashboard header AND the settings
  page. Logout should be in one consistent location (sidebar footer or settings
  only).

#### m10. Global Presets Form Dialog Maximum Height Overflow

- **File:** `GlobalPresetsPage.tsx:451`
- **Details:** The preset form dialog uses `max-h-[90vh] overflow-y-auto`
  directly on `DialogContent`. While this prevents overflow, the scroll
  container includes the dialog header and footer, which should remain sticky.

---

## 4. Page-by-Page Improvement Recommendations

### 4.1 Login Page (`LoginPage.tsx`)

**Current State:**

- Raw HTML `<input>` and `<button>` elements with manually copied Tailwind
  classes
- No logo or branding beyond "Super Admin" text
- No "Forgot Password" link
- Basic error display

**Redesign Recommendations:**

1. **Use shared-ui components**: Replace raw elements with `Input`, `Button`
   from shared-ui
2. **Add branding**: LevelUp logo, gradient accent bar, "Platform
   Administration" subtitle
3. **Add visual feedback**: Spinner in button during login, shake animation on
   error
4. **Add password visibility toggle**: Eye/EyeOff icon button in password field
5. **Add "Forgot Password" link**: Even if not functional yet, it's expected UX
6. **Improve error display**: Use the shared-ui `Alert` component with icon for
   error messages
7. **Consider react-hook-form**: Validate email format and password minimum
   length client-side

```tsx
// Recommended structure
<Card className="w-full max-w-md">
  <CardHeader className="text-center">
    <Logo className="mx-auto h-12 w-12" />
    <CardTitle>LevelUp Admin</CardTitle>
    <CardDescription>Sign in to the platform console</CardDescription>
  </CardHeader>
  <CardContent>
    <Form {...form}>
      <FormField name="email" control={form.control} render={...} />
      <FormField name="password" control={form.control} render={...} />
      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Sign In
      </Button>
    </Form>
  </CardContent>
</Card>
```

### 4.2 Dashboard Page (`DashboardPage.tsx`)

**Current State:**

- 4 stat cards (tenants, users, exams, spaces) as hand-built divs
- Recent tenants list (last 5)
- "Sign Out" button in header (redundant if in sidebar)
- No charts, trends, or visual analytics
- Plain text loading state

**Redesign Recommendations:**

1. **Remove redundant Sign Out**: Move to sidebar footer dropdown
2. **Use shared-ui Card components**: Replace hand-built stat cards with
   `Card`/`CardHeader`/`CardContent`
3. **Add trend indicators**: Show growth percentages or up/down arrows compared
   to previous period
4. **Add charts section**:
   - Line chart: Tenant count over time (monthly/weekly)
   - Bar chart: Users per tenant (top 10)
   - Donut chart: Users by plan distribution
5. **Add quick actions**: "Create Tenant", "View System Health", "Manage Feature
   Flags" action cards
6. **Recent Tenants → clickable links**: Each tenant row should link to
   `/tenants/:id`
7. **Add skeleton loading**: 4 stat card skeletons + chart placeholder
8. **Add "Recently Active" section**: Show tenants with recent login activity,
   not just first 5 records

```
┌─────────────────────────────────────────────────────────┐
│ Dashboard                                    [Period ▾] │
├───────────┬───────────┬───────────┬───────────────────── │
│ Tenants   │ Users     │ Exams     │ Spaces              │
│ 24        │ 1,847     │ 342       │ 89                  │
│ ↑12% MoM  │ ↑8% MoM   │ ↑3% MoM   │ ↑15% MoM           │
├───────────┴───────────┴───────────┴───────────────────── │
│ ┌─── User Growth ─────┐  ┌─── Users by Plan ──────────┐ │
│ │  📈 Line Chart       │  │  🍩 Donut Chart            │ │
│ │  (monthly trend)     │  │  (trial/basic/premium/ent) │ │
│ └─────────────────────┘  └────────────────────────────┘ │
│ ┌─── Recent Tenants ──────────────────────────────────┐ │
│ │  Springfield HS   SPRING-HS   active   24 users  →  │ │
│ │  Oakville Academy OAK-AC      trial    12 users  →  │ │
│ └─────────────────────────────────────────────────────┘ │
│ ┌─── Quick Actions ───────────────────────────────────┐ │
│ │  [+ Create Tenant]  [🔧 System Health]  [⚙ Settings]│ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### 4.3 Tenants Page (`TenantsPage.tsx`)

**Current State:**

- Header with title and "Create Tenant" button
- Search bar (raw `<input>`) + status filter pills
- Raw HTML table with 6 columns
- Create Tenant dialog (manual state management, native `<select>`)
- No pagination

**Redesign Recommendations:**

1. **Use shared-ui Input**: Replace raw `<input>` with `Input` component
2. **Use shared-ui Table**: Replace raw `<table>` with
   `Table`/`TableHeader`/`TableBody`/`TableRow`/`TableCell`
3. **Use shared-ui Badge**: Replace status badges with
   `<StatusBadge status={tenant.status} />`
4. **Add pagination**: 10-25 items per page with `Pagination` component
5. **Add column sorting**: Click column headers to sort by name, users, status
6. **Add bulk actions**: Multi-select tenants for bulk status changes or feature
   flag updates
7. **Use shared-ui Select**: Replace native `<select>` in create dialog
8. **Use react-hook-form + Zod**: For create tenant form validation
9. **Add table row actions**: Replace "View" link with dropdown menu (View,
   Edit, Suspend, Delete)
10. **Add skeleton loading**: Table row skeletons instead of "Loading..." text
11. **Enhance empty state**: Add illustration and "Create your first tenant" CTA

### 4.4 Tenant Detail Page (`TenantDetailPage.tsx`)

**Current State:**

- Back link + tenant name + status badge + Edit/Delete buttons
- 4 stat cards (students, teachers, exams, spaces)
- Subscription card with Edit Plan button
- Contact card
- Features display with green/gray dots
- Settings display
- 3 dialog modals (Edit, Subscription, Delete)

**Redesign Recommendations:**

1. **Add breadcrumbs**: "Tenants > Springfield High School" in header
2. **Use Tabs layout**: Organize sections into tabs (Overview, Subscription,
   Features, Settings, Activity)
3. **Use shared-ui Card**: Replace hand-built stat cards
4. **Features section → interactive**: Allow toggling features directly
   (currently read-only; toggles are only on FeatureFlagsPage)
5. **Add activity log**: Show recent changes, login events, exam activity
6. **Add subscription usage indicators**: Show "12/50 students used" with
   progress bars
7. **Use react-hook-form + Zod**: For edit and subscription forms
8. **Use shared-ui Select**: Replace native `<select>` in edit/subscription
   dialogs
9. **Feature labels → lookup map**: Replace regex-based camelCase-to-label
   transformation
10. **Add danger zone**: Group destructive actions (suspend, delete) in a
    visually distinct section

### 4.5 Global Presets Page (`GlobalPresetsPage.tsx`)

**Current State:**

- Good preset card layout with badges (Default, Public)
- Dimension display with enabled/disabled chips
- PresetFormDialog extracted as sub-component (good pattern)
- Delete confirmation with AlertDialog

**Redesign Recommendations:**

1. **Good foundation**: This page is the best-structured in the app. Keep the
   card-based layout.
2. **Add preset preview**: Show a mini-preview of how the rubric would appear to
   students/teachers
3. **Add drag-to-reorder dimensions**: Use `@dnd-kit` for dimension ordering in
   the form
4. **Add search/filter**: Filter by name, default status, public status
5. **Add bulk actions**: Select multiple presets to set public/private
6. **Improve dimension weight UX**: Use a slider instead of a number input for
   weights 1-5
7. **Add "Duplicate Preset" action**: Common admin pattern for creating variants

### 4.6 System Health Page (`SystemHealthPage.tsx`)

**Current State:**

- Overall status banner with green/yellow/red indicator
- 4 service cards (Auth, Firestore, Functions, AI Pipeline) with status and
  latency
- Platform metrics (response time, total users, error rate "N/A")
- Skeleton loading for service cards (good)
- Refresh button with spinner (good)

**Redesign Recommendations:**

1. **Add auto-refresh option**: Toggle for periodic health checks (every
   30s/60s/5m)
2. **Add historical uptime**: Show last 24h/7d/30d uptime percentage per service
3. **Add incident log**: Track when services go degraded/down with timestamps
4. **Remove or implement Error Rate**: "N/A" is worse than not showing the
   metric
5. **Add service dependency graph**: Visual representation of how services
   connect
6. **Use shared-ui Button**: Replace raw `<button>` for the refresh action
7. **Fix health probe approach**: Create a dedicated Cloud Function instead of
   calling `saveTenant` with empty payload

### 4.7 User Analytics Page (`UserAnalyticsPage.tsx`)

**Current State:**

- 4 stat cards (total users, students, teachers, active tenants)
- Users by subscription plan (progress bars)
- Per-tenant breakdown table
- Good skeleton loading state

**Redesign Recommendations:**

1. **Fix teacher icon**: Replace `TrendingUp` with `GraduationCap` or
   `UserCheck`
2. **Add charts**: Line chart for user growth trends, bar chart for top tenants
   by users
3. **Add time period filter**: "Last 7 days", "Last 30 days", "Last 90 days",
   "All time"
4. **Use shared-ui Table**: Replace raw `<table>` with shared-ui components
5. **Use shared-ui Progress**: Replace hand-built progress bars
6. **Add export**: Download CSV/PDF of analytics data
7. **Add search**: Filter the per-tenant breakdown table
8. **Make tenant names clickable**: Link to `/tenants/:id`

### 4.8 Feature Flags Page (`FeatureFlagsPage.tsx`)

**Current State:**

- Flag overview summary grid
- Search filter
- Per-tenant flag toggle cards with pending changes + save
- Visual feedback (blue ring for pending, green "Saved" indicator)

**Redesign Recommendations:**

1. **Use shared-ui Input**: Replace raw `<input>` for search
2. **Add bulk toggle**: Toggle a flag across ALL tenants in one action
3. **Add flag history**: Show when each flag was last changed
4. **Use shared-ui Switch**: Replace toggle button layout with actual `Switch`
   components
5. **Add confirmation for destructive toggles**: Disabling AI features should
   confirm impact
6. **Route through Cloud Function**: Replace direct Firestore writes for audit
   trail
7. **Add "Apply template" feature**: Apply a predefined feature set to selected
   tenants

### 4.9 Settings Page (`SettingsPage.tsx`)

**Current State:**

- Best page in the app for shared-ui usage: Uses `Card`, `CardHeader`,
  `CardTitle`, `CardDescription`, `CardContent`, `Switch`, `Textarea`, `Input`,
  `Label`, `Button`
- Platform announcement with textarea
- Default features with toggle switches
- System configuration (maintenance mode, read-only defaults)
- Admin account with sign-out

**Redesign Recommendations:**

1. **Add confirmation for maintenance mode**: AlertDialog before enabling
2. **Remove redundant Sign Out**: Keep in sidebar only, not duplicated here
3. **Add audit log**: Show who changed what setting and when
4. **Make Default Plan editable**: Currently read-only; should be configurable
5. **Add platform branding section**: Upload logo, set primary color, configure
   email templates
6. **Add notification preferences**: Configure email alerts for system health,
   new tenant signups

---

## 5. Component Quality & Design System Adherence

### 5.1 Components Not Using Design System

| Component        | Current                                   | Should Use                                        |
| ---------------- | ----------------------------------------- | ------------------------------------------------- |
| Status badges    | Inline conditional classes                | `Badge` with CVA variants or custom `StatusBadge` |
| Data tables      | Raw `<table>` HTML                        | Shared-ui `Table` components                      |
| Search inputs    | Raw `<input>` with manual classes         | Shared-ui `Input` with `Search` icon wrapper      |
| Select dropdowns | Native `<select>` element                 | Shared-ui `Select` component                      |
| Stat cards       | `<div className="rounded-lg border...">`  | Shared-ui `Card` composition                      |
| Progress bars    | `<div>` with inline style width           | Shared-ui `Progress` component                    |
| Refresh button   | Raw `<button>`                            | Shared-ui `Button` variant="outline"              |
| Feature toggles  | Custom button with ToggleLeft/Right icons | Shared-ui `Switch` component                      |

### 5.2 Recommended New Shared Components

1. **`StatusBadge`** - Reusable tenant/entity status indicator

   ```tsx
   <StatusBadge status="active" />    // green
   <StatusBadge status="trial" />     // blue
   <StatusBadge status="suspended" /> // red
   <StatusBadge status="expired" />   // gray
   ```

2. **`StatCard`** - Reusable metric display card

   ```tsx
   <StatCard
     label="Total Users"
     value={1847}
     icon={Users}
     subtext="across all tenants"
     trend={{ value: 8, direction: "up" }}
   />
   ```

3. **`SearchInput`** - Input with search icon prefix

   ```tsx
   <SearchInput
     placeholder="Search tenants..."
     value={query}
     onChange={setQuery}
   />
   ```

4. **`DataTable`** - Configurable data table with sorting, pagination, search

   ```tsx
   <DataTable columns={columns} data={tenants} searchKey="name" pagination />
   ```

5. **`PageHeader`** - Consistent page header with title, description, and
   actions
   ```tsx
   <PageHeader
     title="Tenants"
     description="Manage all registered tenants"
     actions={<Button>Create Tenant</Button>}
   />
   ```

### 5.3 Code Patterns to Standardize

| Pattern       | Current                           | Recommended                                 |
| ------------- | --------------------------------- | ------------------------------------------- |
| Loading state | `"Loading..."` text               | `Skeleton` component matching content shape |
| Empty state   | `<div className="border-dashed">` | Standardized empty state with icon + CTA    |
| Page header   | Ad-hoc flex layout per page       | `PageHeader` component                      |
| Form state    | `useState` per field              | `react-hook-form` + Zod                     |
| Error display | Inline red div                    | Shared-ui `Alert` variant="destructive"     |
| Stat display  | Custom div cards                  | `StatCard` component                        |

---

## 6. Navigation & Information Architecture

### 6.1 Current Sidebar Structure

```
Overview
  └── Dashboard

Platform
  ├── Tenants
  ├── User Analytics
  ├── Feature Flags
  └── Global Presets

System
  ├── System Health
  └── Settings
```

### 6.2 Recommended Revised IA

```
Overview
  └── Dashboard                    (keep)

Tenants                           (elevate to top-level group)
  ├── All Tenants                  (was "Tenants")
  ├── Onboarding                   (NEW - guided tenant creation wizard)
  └── Subscription Plans           (NEW - plan management)

Platform
  ├── Feature Flags                (keep)
  ├── Evaluation Presets           (was "Global Presets" - clearer label)
  └── User Analytics               (keep)

System
  ├── Health & Monitoring          (was "System Health" - broader scope)
  ├── Audit Log                    (NEW - track all admin actions)
  └── Settings                     (keep)
```

### 6.3 Navigation Improvements

1. **Add breadcrumbs**: Every page should display its location in the `AppShell`
   header via `pageTitle` or custom breadcrumb
2. **Add navigation badges**: Show counts in sidebar (e.g., "Tenants (24)",
   "Active Alerts (2)")
3. **Add keyboard navigation**: `Cmd+K` command palette for quick navigation
   using shared-ui `Command` component
4. **Sidebar footer**: User avatar + name + role badge + dropdown menu with sign
   out

---

## 7. Super-Admin Dashboard Patterns

### 7.1 Recommended Dashboard Layout

A super-admin dashboard should provide at-a-glance platform health and key
metrics. The recommended layout follows a "command center" pattern:

**Row 1: Status Banner**

- Overall platform health indicator (All Systems Operational / Degraded / Down)
- Active maintenance mode warning banner
- Platform-wide announcement preview

**Row 2: KPI Cards (4 columns)**

- Total Tenants (with active/trial breakdown)
- Total Users (with growth trend)
- System Uptime (last 30 days)
- Active Sessions (real-time)

**Row 3: Charts (2 columns)**

- Left: Tenant & User Growth (line chart, last 90 days)
- Right: Users by Subscription Plan (donut chart)

**Row 4: Activity (2 columns)**

- Left: Recent Tenants (last 5, clickable)
- Right: Recent Admin Actions (audit log preview)

**Row 5: Quick Actions (horizontal)**

- Create Tenant, Manage Feature Flags, View System Health, Export Data

### 7.2 Data-Driven Insights

- **At-risk tenants**: Highlight tenants approaching subscription limits (e.g.,
  45/50 students)
- **Inactive tenants**: Flag tenants with no login activity in 30+ days
- **Trending features**: Show which features are most/least adopted across
  tenants
- **Growth alerts**: Notify when platform-wide metrics hit milestones or
  anomalies

---

## 8. Multi-Tenant UX Recommendations

### 8.1 Tenant Lifecycle Management

The current app handles basic CRUD but lacks lifecycle management UX:

1. **Onboarding Wizard**: Multi-step guided setup for new tenants
   - Step 1: Organization details (name, code, contact)
   - Step 2: Subscription plan selection with feature comparison table
   - Step 3: Feature configuration (toggle defaults)
   - Step 4: Admin account creation (invite first admin)
   - Step 5: Review & confirm

2. **Tenant Status Transitions**: Visual state machine showing allowed
   transitions

   ```
   trial → active → suspended → expired
           ↑                      │
           └──────────────────────┘ (reactivation)
   ```

3. **Subscription Management**:
   - Usage meters showing current vs. limit (students, teachers, spaces)
   - Upgrade/downgrade flow with prorated billing preview
   - Expiry warnings at 30/14/7/1 days before subscription end

### 8.2 Tenant Comparison

Add the ability to compare 2-3 tenants side-by-side:

- Usage metrics
- Feature flags
- Subscription details
- Activity levels

### 8.3 Tenant Impersonation

Add a "Login as Admin" button on tenant detail pages that creates a scoped
session to view the tenant's admin dashboard. This is essential for debugging
and support.

---

## 9. Security UX

### 9.1 Current Security UX Assessment

| Area                       | Status      | Notes                                                         |
| -------------------------- | ----------- | ------------------------------------------------------------- |
| Auth guard                 | Good        | Defense-in-depth with claims + Firestore verification         |
| Session management         | Adequate    | Firebase handles token refresh automatically                  |
| Destructive action confirm | Partial     | Delete tenant has AlertDialog; maintenance mode does not      |
| Audit trail                | Missing     | No logging of who performed what action                       |
| Password policy            | Not shown   | No password strength indicator on login                       |
| 2FA/MFA                    | Missing     | No multi-factor authentication for super-admin                |
| Rate limiting              | Server-side | Cloud Functions may have rate limits; UI provides no feedback |
| CSRF protection            | N/A         | Firebase SDK handles this                                     |

### 9.2 Recommendations

1. **Add MFA requirement**: Super-admin accounts should require TOTP or
   SMS-based MFA
2. **Add session timeout**: Auto-logout after 30 minutes of inactivity with
   warning dialog
3. **Add audit log page**: Track all admin actions with timestamp, user, action,
   target, IP
4. **Add confirmation for all destructive actions**:
   - Deleting a tenant (exists ✓)
   - Deleting a preset (exists ✓)
   - Suspending a tenant (missing)
   - Enabling maintenance mode (missing)
   - Changing subscription plan downward (missing)
5. **Type-to-confirm for high-risk deletions**: Require typing the tenant name
   to confirm deletion (like GitHub repo deletion)
6. **Add "Danger Zone" section**: Group all destructive actions at the bottom of
   tenant detail with red-bordered card

### 9.3 Recommended Delete Confirmation UX

```tsx
<AlertDialog>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-destructive" />
        Delete Tenant Permanently
      </AlertDialogTitle>
      <AlertDialogDescription>
        This will permanently delete <strong>{tenant.name}</strong> and all
        associated data including {tenant.stats.totalStudents} students,
        {tenant.stats.totalTeachers} teachers, {tenant.stats.totalExams} exams,
        and {tenant.stats.totalSpaces} spaces.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <div className="space-y-2 py-4">
      <Label>Type <code>{tenant.tenantCode}</code> to confirm</Label>
      <Input value={confirmText} onChange={...} />
    </div>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <Button
        variant="destructive"
        disabled={confirmText !== tenant.tenantCode}
        onClick={handleDelete}
      >
        I understand, delete this tenant
      </Button>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

---

## 10. Accessibility Audit

### 10.1 Issues Found

| Issue                                                 | Severity | Location                          | WCAG  |
| ----------------------------------------------------- | -------- | --------------------------------- | ----- |
| Status badges lack sr-only text                       | High     | All pages with status badges      | 1.3.1 |
| Health status dots are color-only indicators          | High     | SystemHealthPage                  | 1.4.1 |
| Feature flag toggle buttons lack aria-pressed         | Medium   | FeatureFlagsPage                  | 4.1.2 |
| Native `<select>` may have inconsistent focus styling | Medium   | 4 form dialogs                    | 2.4.7 |
| Raw `<table>` missing `<caption>`                     | Medium   | TenantsPage, UserAnalyticsPage    | 1.3.1 |
| No skip-to-content link                               | Medium   | All pages                         | 2.4.1 |
| Loading states announced only visually                | Medium   | All pages                         | 4.1.3 |
| Sidebar navigation lacks `aria-current="page"`        | Low      | AppLayout (handled by shared-ui?) | 2.4.8 |
| No focus trap in custom form dialogs                  | Low      | Dialog handles this via Radix     | 2.4.3 |

### 10.2 Recommendations

1. **Add `role="status"` to loading indicators**: Screen readers should announce
   loading state changes
2. **Add `aria-label` to icon-only buttons**: Refresh button, edit/delete icons
3. **Add `<caption>` to tables**: Describe the data being presented
4. **Add sr-only text to color-coded badges**:
   `<span className="sr-only">Status: active</span>`
5. **Use `aria-pressed` on toggle buttons**: Feature flag toggles should
   indicate state
6. **Add skip-to-main-content link**: First focusable element should skip
   navigation
7. **Announce live regions**: Use `aria-live="polite"` for toast notifications
   and save confirmations

---

## 11. Loading, Empty & Error States

### 11.1 Current State Matrix

| Page           | Loading                          | Empty                                 | Error                |
| -------------- | -------------------------------- | ------------------------------------- | -------------------- |
| Dashboard      | "Loading platform stats..." text | N/A                                   | N/A (fails silently) |
| Tenants        | "Loading..." in table cell       | "No tenants found" text               | N/A                  |
| Tenant Detail  | "Loading tenant details..." text | "Tenant not found" with dashed border | N/A                  |
| Global Presets | "Loading presets..." text        | Dashed border + description           | Error text in form   |
| System Health  | Animated pulse blocks (good)     | N/A                                   | Status shows "down"  |
| User Analytics | Animated pulse cards (good)      | "No tenants found" in table           | N/A                  |
| Feature Flags  | "Loading tenant flags..." text   | Dashed border + "No tenants found"    | Red error banner     |
| Settings       | "Loading configuration..." text  | N/A                                   | Toast on error       |

### 11.2 Recommended State Pattern

Every page should implement this consistent pattern:

```tsx
// Loading: Content-shaped skeletons
<div className="grid gap-4 md:grid-cols-4">
  {Array.from({ length: 4 }).map((_, i) => (
    <Card key={i}>
      <CardHeader>
        <Skeleton className="h-4 w-24" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-3 w-32 mt-2" />
      </CardContent>
    </Card>
  ))}
</div>

// Empty: Illustration + description + CTA
<div className="flex flex-col items-center justify-center py-12 text-center">
  <Building2 className="h-12 w-12 text-muted-foreground/50" />
  <h3 className="mt-4 text-lg font-semibold">No tenants yet</h3>
  <p className="mt-1 text-sm text-muted-foreground max-w-sm">
    Create your first tenant to get started managing schools on the platform.
  </p>
  <Button className="mt-4">
    <Plus className="mr-2 h-4 w-4" />
    Create Tenant
  </Button>
</div>

// Error: Alert with retry
<Alert variant="destructive">
  <AlertCircle className="h-4 w-4" />
  <AlertTitle>Failed to load tenants</AlertTitle>
  <AlertDescription>
    {error.message}
    <Button variant="link" onClick={refetch}>Try again</Button>
  </AlertDescription>
</Alert>
```

---

## 12. Dark Mode & Theming

### 12.1 Current Issue

The `index.css` only defines light mode variables:

```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 47.4% 11.2%;
  /* ... */
}
```

No `.dark` block exists. Hardcoded Tailwind colors (`bg-green-100`,
`text-green-700`, etc.) appear throughout the codebase and will not adapt to
dark mode.

### 12.2 Fix Plan

1. **Add dark theme variables** to `index.css`:

   ```css
   .dark {
     --background: 222.2 84% 4.9%;
     --foreground: 210 40% 98%;
     --card: 222.2 84% 4.9%;
     --card-foreground: 210 40% 98%;
     --primary: 217.2 91.2% 59.8%;
     --primary-foreground: 222.2 47.4% 11.2%;
     /* ... complete dark theme */
   }
   ```

2. **Replace all hardcoded colors** with semantic tokens:
   - `bg-green-100 text-green-700` → custom `--success` / `--success-foreground`
     tokens
   - `bg-blue-100 text-blue-700` → custom `--info` / `--info-foreground` tokens
   - `bg-red-100 text-red-700` → `bg-destructive/10 text-destructive`
   - `bg-gray-100 text-gray-600` → `bg-muted text-muted-foreground`

3. **Add ThemeProvider**: Use `next-themes` (already in the monorepo) to add
   system/light/dark mode toggle

---

## 13. Responsive Design

### 13.1 Current Responsive Behavior

- **Sidebar**: Collapsible via `AppShell`/`SidebarProvider` (handled well by
  shared-ui)
- **Stat cards**: 4-column grid → 2-column on `md` → 1-column on mobile (good)
- **Tables**: No horizontal scroll wrapper (will overflow on small screens)
- **Dialogs**: `max-w-md` or `max-w-lg` (reasonable)
- **Feature flag cards**: 3-column grid → 2-column → 1-column (good)

### 13.2 Issues

1. **Tables overflow on mobile**: `TenantsPage` and `UserAnalyticsPage` tables
   will horizontally overflow without `overflow-x-auto` wrapper
   (UserAnalyticsPage has it, TenantsPage does not)
2. **Tenant detail page**: Header with back link, title, status, edit, delete
   buttons will wrap awkwardly on small screens
3. **Feature flags grid**: 9 flag toggles per tenant create a very tall card on
   mobile
4. **No mobile-specific navigation**: No bottom nav or hamburger for mobile
   (sidebar collapse handles this)

### 13.3 Recommendations

1. **Add `overflow-x-auto`** to all table containers
2. **Stack header actions vertically** on mobile for tenant detail
3. **Consider accordion pattern** for feature flags per tenant on mobile
4. **Test all dialogs** on 375px width to ensure they don't overflow

---

## 14. Implementation Roadmap

### Phase 1: Foundation Fixes (1-2 days)

**Priority: Critical fixes and design system alignment**

- [ ] Add dark mode CSS variables to `index.css`
- [ ] Replace all raw `<input>`, `<button>`, `<select>` with shared-ui
      components (`Input`, `Button`, `Select`)
- [ ] Replace all raw `<table>` with shared-ui `Table` components
- [ ] Create `StatusBadge` component in shared-ui and replace all 7+ instances
- [ ] Replace all hardcoded colors with design tokens
- [ ] Add `pageTitle` breadcrumbs to `AppShell` in `AppLayout`
- [ ] Add `overflow-x-auto` to table containers

### Phase 2: Loading & State Improvements (1 day)

**Priority: Perceived performance and UX polish**

- [ ] Add `Skeleton` loading states to all 8 pages
- [ ] Standardize empty states with icons and CTAs
- [ ] Add error states with `Alert` component and retry buttons
- [ ] Add `aria-live` regions for dynamic content updates

### Phase 3: Form & Interaction Improvements (1-2 days)

**Priority: Data integrity and usability**

- [ ] Migrate all form dialogs to `react-hook-form` + Zod validation
- [ ] Add confirmation for maintenance mode toggle
- [ ] Add type-to-confirm for tenant deletion
- [ ] Add confirmation for destructive feature flag changes
- [ ] Route feature flag updates through Cloud Function

### Phase 4: Dashboard Enhancement (1-2 days)

**Priority: Decision-making and analytics**

- [ ] Add charts to Dashboard using `recharts` (growth trends, distribution)
- [ ] Create `StatCard` component with trend indicators
- [ ] Add Quick Actions section to Dashboard
- [ ] Add time period filters to User Analytics
- [ ] Make tenant names/rows clickable links throughout

### Phase 5: Navigation & IA (0.5-1 day)

**Priority: Workflow efficiency**

- [ ] Enhance sidebar footer with avatar, role badge, dropdown menu
- [ ] Remove redundant LogoutButton from Dashboard and Settings
- [ ] Add `Cmd+K` command palette for quick navigation
- [ ] Fix teacher icon in UserAnalyticsPage
- [ ] Add navigation badges to sidebar items

### Phase 6: Advanced Features (2-3 days)

**Priority: Platform maturity**

- [ ] Add pagination to all list views (tenants, analytics, presets)
- [ ] Add column sorting to tables
- [ ] Add audit log page
- [ ] Add tenant onboarding wizard
- [ ] Add bulk feature flag toggle
- [ ] Add data export (CSV/PDF) for analytics
- [ ] Add health check auto-refresh
- [ ] Create dedicated health probe Cloud Function

### Phase 7: Accessibility & Polish (1 day)

**Priority: Compliance and inclusivity**

- [ ] Add skip-to-content link
- [ ] Add `sr-only` text to all color-coded indicators
- [ ] Add `aria-pressed` to toggle buttons
- [ ] Add `<caption>` to all data tables
- [ ] Add `role="status"` to loading indicators
- [ ] Test keyboard navigation across all pages
- [ ] Verify contrast ratios in both light and dark themes

---

## Appendix A: File-by-File Issue Summary

| File                    | Issues                                                            | Severity                     |
| ----------------------- | ----------------------------------------------------------------- | ---------------------------- |
| `index.css`             | No dark mode variables                                            | Critical                     |
| `LoginPage.tsx`         | Raw HTML elements, no branding, no validation                     | Critical, Minor              |
| `DashboardPage.tsx`     | Hand-built cards, no charts, redundant logout, no skeleton        | Major x3, Minor              |
| `TenantsPage.tsx`       | Raw input, raw table, no pagination, raw select, hardcoded colors | Critical x2, Major x2, Minor |
| `TenantDetailPage.tsx`  | Raw select, hardcoded colors, manual form state, feature labels   | Major x2, Minor x2           |
| `GlobalPresetsPage.tsx` | Dialog scroll container, no react-hook-form                       | Major, Minor                 |
| `SystemHealthPage.tsx`  | Raw button, saveTenant probe, "N/A" metric                        | Minor x3                     |
| `UserAnalyticsPage.tsx` | Raw table, wrong icon, hardcoded colors, no pagination            | Major x2, Minor x2           |
| `FeatureFlagsPage.tsx`  | Raw input, direct Firestore write, hardcoded colors               | Major, Critical, Minor       |
| `SettingsPage.tsx`      | No maintenance mode confirm, redundant logout                     | Minor x2                     |
| `AppLayout.tsx`         | No breadcrumbs, minimal footer                                    | Major x2                     |
| `RequireAuth.tsx`       | Minimal Access Denied page                                        | Minor                        |

## Appendix B: Shared-UI Components to Adopt

| Component      | Currently Used | Should Be Used In                 |
| -------------- | -------------- | --------------------------------- |
| `Badge`        | No             | All status indicators             |
| `Table`        | No             | TenantsPage, UserAnalyticsPage    |
| `Skeleton`     | No             | All page loading states           |
| `Select`       | No             | All form dialogs with dropdowns   |
| `Progress`     | No             | UserAnalyticsPage progress bars   |
| `Tabs`         | No             | TenantDetailPage sections         |
| `Alert`        | No             | Error states across all pages     |
| `Command`      | No             | Global keyboard navigation        |
| `DropdownMenu` | No             | Sidebar footer, table row actions |
| `Tooltip`      | No             | Icon-only buttons, truncated text |
| `Avatar`       | No             | Sidebar footer user display       |
| `Separator`    | Minimal        | Section dividers                  |
