# SUPER-ADMIN APP AUDIT REPORT

**Auditor:** Super-Admin Auditor Worker **Date:** 2026-03-01 **Scope:**
`apps/super-admin/src/` — all 15 source files **Reference:**
`docs/unified-design-plan/UNIFIED-ARCHITECTURE-BLUEPRINT.md` Sections 3
(Firestore Schema), 4.1 (Platform-Level Features), 5.2 (Permission Matrix)

---

## Summary

| Severity  | Count  |
| --------- | ------ |
| CRITICAL  | 7      |
| HIGH      | 11     |
| MEDIUM    | 12     |
| LOW       | 8      |
| **Total** | **38** |

---

## CRITICAL ISSUES (7)

### C1. Auth Guard Allows Unauthenticated Access When User Doc Is Missing

- **File:** `src/guards/RequireAuth.tsx:21`
- **Type:** Security Vulnerability
- **Severity:** CRITICAL
- **Description:** The guard checks `if (user && !user.isSuperAdmin)` — this
  condition only blocks users who have a loaded user document AND are not super
  admins. If `firebaseUser` exists but `user` is `null` (Firestore user document
  not yet loaded, deleted, or nonexistent), the guard falls through to
  `<Outlet />` and renders all protected content. Any authenticated Firebase
  user without a corresponding Firestore `/users/{uid}` document gains full
  super-admin access.
- **Fix:** Change condition to `if (!user || !user.isSuperAdmin)` — deny access
  unless the user document is loaded AND explicitly confirms
  `isSuperAdmin === true`.

### C2. Auth Guard Does Not Check Firebase Custom Claims

- **File:** `src/guards/RequireAuth.tsx:20-31`
- **Type:** Security / Architecture Gap
- **Severity:** CRITICAL
- **Description:** Blueprint Section 3.3 defines `PlatformClaims` with
  `role: 'superAdmin'` as the primary authorization mechanism for Firestore
  security rules. The guard relies solely on the Firestore `user.isSuperAdmin`
  field. If Firestore security rules are misconfigured or if a client-side
  exploit modifies the cached user document, the check is bypassed. The guard
  should verify `firebaseUser.getIdTokenResult().claims.role === 'superAdmin'`
  for defense-in-depth, matching the claims-based architecture defined in the
  blueprint.

### C3. Tenant Delete Only Removes Parent Document — Orphans All Subcollections

- **File:** `src/pages/TenantDetailPage.tsx:87`
- **Type:** Data Integrity
- **Severity:** CRITICAL
- **Description:** The delete mutation uses
  `deleteDoc(doc(db, "tenants", tenantId))`. In Firestore, deleting a document
  does NOT delete its subcollections. All tenant subcollections remain as
  orphaned data:
  - `/tenants/{tenantId}/students/*`
  - `/tenants/{tenantId}/teachers/*`
  - `/tenants/{tenantId}/classes/*`
  - `/tenants/{tenantId}/exams/*` and `/exams/*/questions/*`
  - `/tenants/{tenantId}/spaces/*` and nested subcollections
  - `/tenants/{tenantId}/submissions/*` and `/questionSubmissions/*`
  - `/tenants/{tenantId}/chatSessions/*`
  - `/tenants/{tenantId}/evaluationSettings/*`
  - All progress, analytics, and cost summary documents

  Additionally, global documents referencing this tenant are not cleaned up:
  - `/userMemberships/{uid}_{tenantId}` documents
  - `/scanners/{scannerId}` documents linked to this tenant

  **Fix:** Replace with a Cloud Function (`deleteTenant`) that recursively
  deletes all subcollections, removes related global documents, and optionally
  disables/removes user memberships.

### C4. Tenant Edit Bypasses Cloud Functions — No Server-Side Validation

- **File:** `src/pages/TenantDetailPage.tsx:64-72`
- **Type:** Security / Data Integrity
- **Severity:** CRITICAL
- **Description:** Tenant creation correctly uses a Cloud Function (`saveTenant`
  on `TenantsPage.tsx:67`), but tenant editing uses direct `updateDoc()` against
  Firestore. This bypasses:
  - Server-side field validation (e.g., ensuring `contactEmail` is valid)
  - Authorization checks (Cloud Function can verify the caller is truly a super
    admin via custom claims)
  - Audit trail / logging
  - Any business logic (e.g., preventing status changes that violate
    subscription rules)

  The inconsistency between create (Cloud Function) and edit (direct write)
  creates a security gap where the edit path has weaker protections.

- **Fix:** Route all tenant mutations through Cloud Functions for consistent
  validation and authorization.

### C5. Feature Flag Update Bypasses Cloud Functions with Full Object Overwrite

- **File:** `src/pages/FeatureFlagsPage.tsx:70-71`
- **Type:** Security / Data Integrity
- **Severity:** CRITICAL
- **Description:** Uses `updateDoc(tenantRef, { features: flags })` — a direct
  Firestore write that:
  1. Bypasses Cloud Functions (no server-side validation or authorization beyond
     Firestore rules)
  2. Overwrites the entire `features` object rather than merging individual
     fields. If the tenant has feature flags not present in `KNOWN_FLAGS` (e.g.,
     added by a newer deployment), they are silently deleted.
  3. Leaves no audit trail of who changed which flags and when.
- **Fix:** Use a Cloud Function for feature flag updates. Use `dot-notation`
  updates (e.g., `features.autoGradeEnabled: true`) to avoid overwriting unknown
  flags.

### C6. SettingsPage Has No Save/Persist Functionality

- **File:** `src/pages/SettingsPage.tsx` (entire file, lines 1-242)
- **Type:** Missing Feature
- **Severity:** CRITICAL
- **Description:** The Settings page renders UI for:
  - Platform announcement text (line 115-119)
  - Maintenance mode toggle (line 187-189)
  - Default feature flags for new tenants (line 145-161)

  However, there is NO save button, NO `useMutation`, and NO Firestore write
  operation anywhere in the file. All changes exist only in local React state
  and are lost on page navigation or refresh. The entire page is non-functional
  for its intended purpose.

- **Fix:** Add a save mutation that writes to the `platform/config` Firestore
  document (or define a proper schema for platform settings).

### C7. SettingsPage useState Initializer Anti-Pattern — State Never Syncs with Fetched Data

- **File:** `src/pages/SettingsPage.tsx:71-77`
- **Type:** Bug
- **Severity:** CRITICAL
- **Description:** The code uses `useState(() => { if (config) { ... } })`
  attempting to sync local state with fetched data. However:
  1. The function passed to `useState` is a **lazy initializer** — it runs
     exactly ONCE during the component's first render.
  2. On first render, `config` is `undefined` (the `useQuery` fetch is still in
     flight), so the `if (config)` block never executes.
  3. When `config` eventually loads and the component re-renders, the
     initializer does NOT re-run.
  4. Result: `announcement`, `maintenanceMode`, and `defaultFeatures` state
     variables are permanently stuck at their initial empty/false values,
     regardless of what Firestore returns.
- **Fix:** Replace with
  `useEffect(() => { if (config) { setAnnouncement(config.announcement ?? ""); ... } }, [config])`.

---

## HIGH ISSUES (11)

### H1. No Subscription Management (Edit Plans/Limits)

- **File:** `src/pages/TenantDetailPage.tsx:204-231`
- **Type:** Missing Feature
- **Severity:** HIGH
- **Description:** Blueprint Section 4.1 requires "Subscription management —
  Assign plans, set limits, toggle feature flags" as a core SuperAdmin function.
  The TenantDetailPage displays subscription info in a read-only card (plan,
  maxStudents, maxTeachers, maxSpaces) but provides NO edit UI. There is no way
  to:
  - Change a tenant's subscription plan (trial/basic/premium/enterprise)
  - Set or modify limits: `maxStudents`, `maxTeachers`, `maxSpaces`,
    `maxExamsPerMonth`
  - Set or extend `expiresAt` date
  - View or manage subscription history

### H2. No Scanner Device Management Page

- **File:** `src/App.tsx` (missing route)
- **Type:** Missing Feature
- **Severity:** HIGH
- **Description:** Blueprint Section 4.1 requires "Scanner device registration —
  Register/manage physical scanner devices" for SuperAdmin (and TenantAdmin).
  The blueprint schema defines a global `/scanners/{scannerId}` collection. No
  page, route, component, or data hook exists in the super-admin app for:
  - Listing registered scanner devices
  - Registering new scanners
  - Assigning scanners to tenants
  - Deactivating/removing scanners
  - Viewing scanner status or activity

### H3. No AI Cost Monitoring

- **File:** `src/pages/DashboardPage.tsx`, `src/pages/UserAnalyticsPage.tsx`
- **Type:** Missing Feature
- **Severity:** HIGH
- **Description:** Blueprint Section 4.1 specifies "Platform analytics — Total
  tenants, students, exams graded, AI cost" and Section 5.2 grants SuperAdmin
  "AI cost monitoring" capability. No page in the app queries:
  - `/llm-usage/{logId}` — Platform-wide AI cost audit log
  - `/platformStats` — Aggregate platform statistics
  - `/tenants/{tenantId}/llmCallLogs/{callId}` — Per-tenant AI usage
  - `/tenants/{tenantId}/costSummaries/daily/*` or `monthly/*` — Cost summaries

  AI cost data is completely absent from the super-admin portal.

### H4. Dashboard Missing "Exams Graded" Metric

- **File:** `src/pages/DashboardPage.tsx:49-73`
- **Type:** Missing Feature
- **Severity:** HIGH
- **Description:** Blueprint Section 4.1 specifies platform analytics should
  show "exams graded". The dashboard displays `totalExams` (line 66) aggregated
  from `tenant.stats.totalExams`, but does not show the count of
  graded/completed submissions. The `totalExams` stat counts exam definitions,
  not grading activity. Should aggregate `tenant.stats` or query submission
  counts to show actual grading throughput.

### H5. Tenant Create Form Missing Required Fields

- **File:** `src/pages/TenantsPage.tsx:39-53`
- **Type:** Incomplete Feature
- **Severity:** HIGH
- **Description:** The `CreateTenantForm` interface only captures 5 fields:
  `name`, `tenantCode`, `contactEmail`, `contactPerson`, `plan`. Per the
  blueprint Tenant entity (Section 3.2), the following fields are missing from
  the create form:
  - `slug` (required for URL-friendly tenant identification)
  - `ownerUid` (required — the primary admin's Firebase UID)
  - `description`
  - `contactPhone`
  - `website`
  - `address` (street, city, state, country, zipCode)
  - Subscription limits: `maxStudents`, `maxTeachers`, `maxSpaces`,
    `maxExamsPerMonth`
  - Initial feature flags (which products to enable)

  The Cloud Function `saveTenant` may set defaults for some of these, but the
  admin has no control over initial configuration.

### H6. No Tenant Feature Flag Inline Editing on Detail Page

- **File:** `src/pages/TenantDetailPage.tsx:258-276`
- **Type:** Incomplete Feature
- **Severity:** HIGH
- **Description:** The tenant detail page displays feature flags as read-only
  colored dots (green=enabled, gray=disabled). To modify a tenant's feature
  flags, the admin must navigate away to the separate `/feature-flags` page,
  find the tenant, and toggle flags there. Blueprint Section 4.1 groups "toggle
  feature flags" under subscription management, implying it should be part of
  the tenant detail/management view.

### H7. updatedAt Uses Client Date Instead of Server Timestamp

- **File:** `src/pages/TenantDetailPage.tsx:71`
- **Type:** Data Integrity
- **Severity:** HIGH
- **Description:** The tenant update mutation sets `updatedAt: new Date()`,
  which uses the client machine's local clock. Client clocks can be inaccurate,
  set to wrong timezones, or deliberately manipulated. Firestore provides
  `serverTimestamp()` (from `firebase/firestore`) which uses Google's server
  clock, ensuring consistent and trustworthy timestamps across all clients.
- **Fix:** Import `serverTimestamp` from `firebase/firestore` and use
  `updatedAt: serverTimestamp()`.

### H8. No 404/Catch-All Route

- **File:** `src/App.tsx:26-43`
- **Type:** Missing Feature
- **Severity:** HIGH
- **Description:** The router defines specific routes (`/`, `/tenants`,
  `/tenants/:tenantId`, `/analytics`, `/feature-flags`, `/presets`, `/system`,
  `/settings`) but has no catch-all `path="*"` route. Users navigating to
  invalid URLs (e.g., `/foo`, `/tenants/abc/edit`) see a blank page within the
  AppLayout shell with no indication of what went wrong. Should add a 404
  component.

### H9. Global Presets Queries Wrong Collection Name

- **File:** `src/pages/GlobalPresetsPage.tsx:178`
- **Type:** Architecture Mismatch
- **Severity:** HIGH
- **Description:** The `useGlobalPresets` hook queries the collection
  `globalEvaluationPresets`. However, the blueprint Firestore schema (Section
  3.1) defines:
  - `/evaluationSettings/{settingsId}` — Global evaluation presets (SuperAdmin)
  - `/tenants/{tenantId}/evaluationSettings/{settingsId}` — Tenant-specific
    RELMS config

  The collection name `globalEvaluationPresets` does not appear in the
  blueprint. If the backend creates documents in `/evaluationSettings/`, this
  page will show an empty list. If the backend was adapted to use
  `globalEvaluationPresets`, the schema documentation is out of sync.

### H10. No Toast/Notification System Mounted

- **File:** `src/main.tsx` (missing provider)
- **Type:** Missing Feature
- **Severity:** HIGH
- **Description:** The `sonner` toast library is available via
  `@levelup/shared-ui` dependencies, but no `<Toaster />` provider component is
  rendered in `main.tsx` or `App.tsx`. As a result:
  - Successful mutations (tenant create, edit, delete; preset save/delete; flag
    updates) provide no success feedback to the user.
  - Failed mutations show inline error text in some cases but not all (delete
    failures on TenantDetailPage have no error display).
  - The user has no clear confirmation that their actions succeeded.

### H11. Login Does Not Respect Redirect Location

- **File:** `src/pages/LoginPage.tsx:16`
- **Type:** Bug
- **Severity:** HIGH
- **Description:** After successful login, the code always navigates to `"/"`
  with `navigate("/", { replace: true })`. However, `RequireAuth.tsx:17` saves
  the original location when redirecting:
  `<Navigate to="/login" state={{ from: location }} replace />`. The LoginPage
  ignores this saved location, so a user who was on `/tenants/abc` and got
  redirected to login will always land on the dashboard instead of returning to
  their previous page.
- **Fix:** Use
  `const from = (location.state as any)?.from?.pathname ?? "/"; navigate(from, { replace: true });`

---

## MEDIUM ISSUES (12)

### M1. No Pagination for Tenants List

- **File:** `src/pages/TenantsPage.tsx:23-26`, `src/pages/DashboardPage.tsx:14`
- **Type:** Performance
- **Severity:** MEDIUM
- **Description:** `getDocs(collection(db, "tenants"))` fetches ALL tenant
  documents in a single query with no `limit()` or cursor-based pagination. As
  the platform grows to hundreds or thousands of tenants, this will cause:
  - Excessive Firestore read costs (billed per document read)
  - Slow page load times
  - High memory usage in the browser
- **Fix:** Implement cursor-based pagination with `limit()`, `startAfter()`, and
  page controls.

### M2. Duplicate Firestore Queries for All Tenants Across Pages

- **File:** `DashboardPage.tsx:14`, `TenantsPage.tsx:24`,
  `UserAnalyticsPage.tsx:32`, `FeatureFlagsPage.tsx:36`,
  `SystemHealthPage.tsx:41`
- **Type:** Performance / Architecture
- **Severity:** MEDIUM
- **Description:** Five different pages independently execute
  `getDocs(collection(db, "tenants"))` to fetch ALL tenant documents. Each uses
  a different TanStack Query key (`platform/stats`, `platform/tenants`,
  `platform/userAnalytics`, `platform/tenantFlags`, `platform/healthChecks`), so
  the query cache cannot deduplicate them. If a user navigates across these
  pages, they trigger 5 separate full-collection reads.
- **Fix:** Create a shared `useAllTenants()` hook with a single query key, or
  use a Zustand store to cache tenant data globally.

### M3. SystemHealthPage Cloud Functions Probe Uses Production Write Endpoint

- **File:** `src/pages/SystemHealthPage.tsx:58-59`
- **Type:** Architecture
- **Severity:** MEDIUM
- **Description:** The Cloud Functions health probe calls
  `httpsCallable(functions, "saveTenant")({})` with an empty payload. This is a
  production write endpoint. Depending on the Cloud Function's validation logic,
  this could:
  - Create error entries in server-side logging
  - Trigger rate limiting
  - Have unintended side effects if validation is weak The probe relies on
    catching specific error codes to determine if the function is reachable,
    which is fragile.
- **Fix:** Create a dedicated `healthCheck` Cloud Function that returns a simple
  status response.

### M4. SettingsPage Default Feature Flags Use Wrong Key Names

- **File:** `src/pages/SettingsPage.tsx:47-55`
- **Type:** Architecture Mismatch
- **Severity:** MEDIUM
- **Description:** The `DEFAULT_FEATURE_FLAGS` array uses key names that do not
  match the blueprint's `TenantFeatures` interface:

  | SettingsPage Key      | Blueprint Key         | Match? |
  | --------------------- | --------------------- | ------ |
  | `examEnabled`         | `autoGradeEnabled`    | NO     |
  | `spacesEnabled`       | `levelUpEnabled`      | NO     |
  | `aiGradingEnabled`    | `aiGradingEnabled`    | YES    |
  | `chatEnabled`         | `aiChatEnabled`       | NO     |
  | `reportsEnabled`      | (not in blueprint)    | NO     |
  | `parentPortalEnabled` | `parentPortalEnabled` | YES    |
  | `leaderboardEnabled`  | (not in blueprint)    | NO     |

  Even if save functionality were implemented, these settings would not
  correctly configure new tenant feature flags.

### M5. No React Error Boundaries

- **File:** `src/App.tsx`, `src/main.tsx`
- **Type:** Error Handling
- **Severity:** MEDIUM
- **Description:** No React error boundary components are used anywhere in the
  application. An unhandled JavaScript error in any page component (e.g.,
  accessing a property on `undefined` from a malformed Firestore document) will
  crash the entire React tree, showing a blank white screen with no recovery
  option. The user must manually refresh the browser.
- **Fix:** Add an `ErrorBoundary` component wrapping the route outlet, with a
  user-friendly error message and retry button.

### M6. Tenant Edit Dialog Missing Several Blueprint Fields

- **File:** `src/pages/TenantDetailPage.tsx:308-387`
- **Type:** Incomplete Feature
- **Severity:** MEDIUM
- **Description:** The edit dialog allows modifying: `name`, `contactEmail`,
  `contactPhone`, `contactPerson`, `website`, `status`. The following blueprint
  Tenant fields have no edit UI:
  - `address` (street, city, state, country, zipCode)
  - `logoUrl` / `bannerUrl` (branding)
  - `ownerUid` (transfer ownership)
  - `slug` (URL identifier)
  - `description`
  - `settings.timezone`, `settings.locale`, `settings.gradingPolicy`

### M7. No Confirmation Dialog Before Feature Flag Save

- **File:** `src/pages/FeatureFlagsPage.tsx:109-112`
- **Type:** UX / Safety
- **Severity:** MEDIUM
- **Description:** Feature flag changes are saved with a single click on "Save
  Changes" with no confirmation dialog. Accidentally toggling and saving
  critical flags like `autoGradeEnabled` or `aiGradingEnabled` could immediately
  disrupt active grading operations for a tenant's users. Given the impact of
  feature flag changes on production tenants, a confirmation step is warranted.

### M8. AI Pipeline Health Probe Is Superficial

- **File:** `src/pages/SystemHealthPage.tsx:78-85`
- **Type:** Incomplete Feature
- **Severity:** MEDIUM
- **Description:** The AI pipeline "health check" only checks
  `tenants.some(t => t.settings?.geminiKeySet === true)`. This tells you whether
  any tenant has configured a Gemini API key, but does NOT verify:
  - Whether the Gemini API is actually reachable
  - Whether configured API keys are valid/not expired
  - Whether the grading Cloud Functions are operational
  - Actual AI pipeline latency or error rates The probe shows "operational" as
    long as any tenant has ever set a key, regardless of actual AI service
    health.

### M9. Recent Tenants on Dashboard Not Sorted by Creation Date

- **File:** `src/pages/DashboardPage.tsx:116`
- **Type:** UX Bug
- **Severity:** MEDIUM
- **Description:** The "Recent Tenants" section uses `stats.tenants.slice(0, 5)`
  to show the first 5 tenants. However, the Firestore query
  (`getDocs(collection(db, "tenants"))`) returns documents in an undefined order
  (typically document ID order). The section title implies recency, but the
  results are not sorted by `createdAt`. The list may show the oldest tenants
  instead of the newest.
- **Fix:** Sort `tenants` by `createdAt` descending before slicing, or add
  `orderBy("createdAt", "desc")` with `limit(5)` to the Firestore query.

### M10. No Error Display for Tenant Delete Failures

- **File:** `src/pages/TenantDetailPage.tsx:83-93`
- **Type:** UX
- **Severity:** MEDIUM
- **Description:** The `deleteTenant` mutation has no `onError` handler and no
  error state display. If `deleteDoc` fails (e.g., permission denied, network
  error), the AlertDialog closes but the user receives no feedback that the
  deletion failed. The tenant remains but the user may believe it was deleted.
- **Fix:** Add an `onError` handler to display the error, similar to the
  `updateTenant` mutation's `onError` at line 80.

### M11. Platform Config Document Path Not in Blueprint Schema

- **File:** `src/pages/SettingsPage.tsx:39`
- **Type:** Architecture Mismatch
- **Severity:** MEDIUM
- **Description:** The `usePlatformConfig` hook reads from
  `doc(db, "platform", "config")`. This document path is not defined anywhere in
  the blueprint's Firestore schema (Section 3.1). The blueprint defines
  `/platformStats` for aggregate platform statistics, but there is no
  `platform/config` document for global settings like announcements, maintenance
  mode, or default features. This means either:
  - The document will never exist and the page always shows defaults, OR
  - The backend creates this document outside the defined schema, creating a
    documentation gap.

### M12. No Logout Confirmation Dialog

- **File:** `src/pages/DashboardPage.tsx:87`, `src/pages/SettingsPage.tsx:231`
- **Type:** UX
- **Severity:** MEDIUM
- **Description:** Both the Dashboard and Settings pages have "Sign Out" buttons
  that immediately call `logout()` with no confirmation. An accidental click
  logs out the admin, losing any unsaved state and requiring re-authentication.

---

## LOW ISSUES (8)

### L1. import.meta.env Type Casting with `as any`

- **File:** `src/main.tsx:18-24`
- **Type:** Code Quality
- **Severity:** LOW
- **Description:** Environment variables are accessed via
  `(import.meta as any).env.VITE_FIREBASE_*`. The `as any` cast suppresses
  TypeScript's type checking. Vite provides an `ImportMetaEnv` interface that
  can be augmented in a `vite-env.d.ts` file for proper type safety.
- **Fix:** Create `src/vite-env.d.ts` with
  `interface ImportMetaEnv { VITE_FIREBASE_API_KEY: string; ... }`.

### L2. Unused Dependencies in package.json

- **File:** `package.json:15-16, 28-29`
- **Type:** Code Quality
- **Severity:** LOW
- **Description:** The following dependencies are declared but not imported
  anywhere in the `src/` directory:
  - `@hookform/resolvers` (line 15)
  - `react-hook-form` (line 27)
  - `zod` (line 29)

  These add unnecessary weight to `node_modules` and may cause confusion about
  the intended form validation approach.

### L3. No Unit Tests

- **File:** `package.json:13`
- **Type:** Testing
- **Severity:** LOW
- **Description:** The test script is `echo 'No unit tests for super-admin'`.
  There is zero test coverage for any component, hook, or utility. Critical
  business logic (auth guard, tenant mutations, data transformations) has no
  automated verification.

### L4. cn() Utility Duplicated from Shared Package

- **File:** `src/lib/utils.ts`
- **Type:** Code Quality
- **Severity:** LOW
- **Description:** The `cn()` function (combining `clsx` + `twMerge`) is defined
  locally, but the same utility is likely exported from `@levelup/shared-ui`.
  Having a local copy creates a maintenance burden — if the shared version is
  updated, the local copy becomes stale.

### L5. Missing Accessibility Attributes on Custom Interactive Elements

- **File:** Multiple files
- **Type:** Accessibility
- **Severity:** LOW
- **Description:** Custom interactive elements lack proper ARIA attributes:
  - `TenantsPage.tsx:123-134` — Status filter buttons have no `aria-pressed`
    attribute
  - `FeatureFlagsPage.tsx:239-263` — Toggle buttons lack `role="switch"` and
    `aria-checked`
  - `SystemHealthPage.tsx:197-203` — Refresh button has no `aria-label`
  - Multiple `<select>` elements use custom styling but no `aria-label`

### L6. No Dark Mode Support

- **File:** `src/main.tsx`
- **Type:** Missing Feature
- **Severity:** LOW
- **Description:** No `ThemeProvider` (from `next-themes` or similar) is set up,
  despite the shared-ui package likely supporting dark mode via CSS custom
  properties. The app is locked to light mode only.

### L7. Status Color Mapping Duplicated Across 4 Files

- **File:** `TenantsPage.tsx:32-37`, `TenantDetailPage.tsx:134-159`,
  `UserAnalyticsPage.tsx:244-253`, `FeatureFlagsPage.tsx:200-206`
- **Type:** Code Quality
- **Severity:** LOW
- **Description:** The mapping of tenant status to CSS color classes
  (active=green, trial=blue, suspended=red, expired=gray) is independently
  implemented in 4 different files with slightly different structures (some use
  a `Record`, others use inline ternary chains). Should be extracted to a shared
  utility function.

### L8. EvaluationSettings Type Mismatch for Global Presets

- **File:** `src/pages/GlobalPresetsPage.tsx:6`
- **Type:** Type Safety
- **Severity:** LOW
- **Description:** The page imports and uses `EvaluationSettings` from
  `@levelup/shared-types`, which includes a `tenantId: string` field (required
  per the type definition). Global evaluation presets are not tenant-scoped and
  should not have a `tenantId`. Using the full `EvaluationSettings` type means
  TypeScript does not flag the missing `tenantId` on global presets, or the type
  allows `tenantId` to be present on documents where it is semantically
  incorrect.
- **Fix:** Define a separate `GlobalEvaluationPreset` type or use
  `Omit<EvaluationSettings, 'tenantId'>`.

---

## MISSING FEATURES SUMMARY

Comparison of implemented features vs Blueprint Section 4.1 (Platform-Level
Features) and Section 5.2 (Permission Matrix) requirements:

| Blueprint Feature                                   | Status                    | Details                                                                                              |
| --------------------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------- |
| Tenant CRUD (create, view, edit, suspend, delete)   | PARTIAL                   | Create/view/edit work but with gaps; delete orphans data; no quick-suspend action                    |
| Subscription management (plans, limits, expiration) | NOT IMPLEMENTED           | Display only — no edit UI for plan, maxStudents, maxTeachers, maxSpaces, maxExamsPerMonth, expiresAt |
| Feature flags toggle per tenant                     | IMPLEMENTED (with issues) | Works via FeatureFlagsPage; bypasses Cloud Functions; overwrites entire features object              |
| Global evaluation presets (RELMS dimensions)        | IMPLEMENTED (with issues) | Full CRUD via Cloud Functions; queries wrong collection name                                         |
| Platform analytics — total tenants                  | IMPLEMENTED               | Shown on Dashboard                                                                                   |
| Platform analytics — total students                 | IMPLEMENTED               | Shown on Dashboard and UserAnalyticsPage                                                             |
| Platform analytics — exams graded                   | NOT IMPLEMENTED           | Only totalExams shown (exam definitions, not grading activity)                                       |
| Platform analytics — AI cost                        | NOT IMPLEMENTED           | No queries to llm-usage, platformStats, or costSummaries                                             |
| Scanner device registration                         | NOT IMPLEMENTED           | No page, route, or component exists                                                                  |
| Global user management (/users collection)          | NOT IMPLEMENTED           | No user listing, search, suspend, or management UI                                                   |
| Bulk student import (SuperAdmin level)              | NOT IMPLEMENTED           | No UI exists                                                                                         |
| Platform announcements                              | PARTIAL                   | UI renders but has no save functionality (C6)                                                        |
| Maintenance mode                                    | PARTIAL                   | Toggle renders but has no save/enforcement (C6)                                                      |
| System health monitoring                            | IMPLEMENTED (with issues) | Probes are superficial; uses production endpoint for testing                                         |
| Error rate monitoring                               | NOT IMPLEMENTED           | Shows "N/A — No logging system yet"                                                                  |

---

## FILES AUDITED

| File                              | Lines | Issues Found                |
| --------------------------------- | ----- | --------------------------- |
| `src/App.tsx`                     | 44    | H8                          |
| `src/main.tsx`                    | 33    | H10, L1                     |
| `src/guards/RequireAuth.tsx`      | 35    | C1, C2                      |
| `src/layouts/AppLayout.tsx`       | 98    | (clean)                     |
| `src/layouts/AuthLayout.tsx`      | 11    | (clean)                     |
| `src/lib/utils.ts`                | 6     | L4                          |
| `src/pages/LoginPage.tsx`         | 79    | H11                         |
| `src/pages/DashboardPage.tsx`     | 154   | H3, H4, M1, M2, M9, M12     |
| `src/pages/TenantsPage.tsx`       | 310   | H5, M1, M2                  |
| `src/pages/TenantDetailPage.tsx`  | 413   | C3, C4, H1, H6, H7, M6, M10 |
| `src/pages/GlobalPresetsPage.tsx` | 588   | H9, L8                      |
| `src/pages/SystemHealthPage.tsx`  | 328   | M3, M8, M2                  |
| `src/pages/UserAnalyticsPage.tsx` | 268   | H3, M2                      |
| `src/pages/FeatureFlagsPage.tsx`  | 281   | C5, M7, M2                  |
| `src/pages/SettingsPage.tsx`      | 242   | C6, C7, M4, M11             |
| `package.json`                    | 43    | L2, L3                      |

---

_End of Audit Report_
