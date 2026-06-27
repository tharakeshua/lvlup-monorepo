# V8 Multi-Tenancy — Cycle 4 Changelog

**Date:** 2026-03-08 **Vertical:** V8 — Multi-Tenancy & Business Logic **Target
Completion:** ~97%

---

## Phase 1: Tenant Lifecycle & Usage Foundations

### T1 — Onboarding Redirect Guard (admin-web)

- Added `OnboardingGuard` component in `apps/admin-web/src/App.tsx` that
  redirects `tenantAdmin` users to `/onboarding` when
  `tenant.onboarding.completed !== true`
- SuperAdmin users bypass the guard
- Added "Complete Setup" banner on DashboardPage with link to `/onboarding`

### T2 — Tenant Lifecycle Automation (Scheduled Function)

- **New file:** `functions/identity/src/scheduled/tenant-lifecycle.ts`
- Daily scheduled function (`every day 00:00`, asia-south1) that:
  - Transitions `trial` tenants past `expiresAt` to `expired` status
  - Writes audit log entries to `tenants/{id}/auditLog`
  - Flags tenants expired >30 days for admin review

### T3 — Monthly Usage Counter Reset (Scheduled Function)

- **New file:** `functions/identity/src/scheduled/usage-reset.ts`
- Monthly scheduled function (`0 0 1 * *`, asia-south1) that:
  - Resets `examsThisMonth` and `aiCallsThisMonth` to 0 for active/trial tenants
  - Processes in batches of 450 for Firestore write safety

---

## Phase 2: Usage Tracking & Visualization

### T4 — Real-Time Usage Counter Increments

- **New file:** `functions/identity/src/utils/usage.ts` — centralized
  `incrementUsage()` helper
- **Modified:** `create-org-user.ts` — increments
  `currentStudents`/`currentTeachers` on user creation
- **Modified:** `bulk-import-students.ts` — increments `currentStudents` by
  import count
- **Modified:** `save-exam.ts` (autograde) — increments `examsThisMonth` on exam
  creation (inline `FieldValue.increment`)
- **Modified:** `grade-question.ts` (autograde) — increments `aiCallsThisMonth`
  on manual grading (inline)
- **Modified:** `save-space.ts` (levelup) — increments `currentSpaces` on space
  creation (inline)

### T5 — Quota Visualization on Dashboard

- **New file:** `apps/admin-web/src/components/dashboard/QuotaUsageCard.tsx`
- Added "Subscription Usage" section to DashboardPage with progress bars for:
  - Students, Teachers, Spaces, Exams/month, AI Calls/month
- Color coding: green (<70%), amber (70-90%), red (>90%)
- Shows plan badge and subscription expiry date

---

## Phase 3: Data Export & Staff Management

### T6 — Data Export Page (admin-web)

- **New file:** `apps/admin-web/src/pages/DataExportPage.tsx`
- Collection selector (Students, Teachers, Classes, Exams, Submissions)
- Format selector (JSON/CSV)
- Export history with download links and expiry countdown
- Added route `/data-export` in App.tsx
- Added "Data Export" nav item in AppLayout.tsx under Configuration

### T7 — Staff Member CRUD UI (admin-web)

- **New file:** `apps/admin-web/src/components/staff/StaffTab.tsx` — staff list
  with search, permission editor
- **New file:** `apps/admin-web/src/components/staff/CreateStaffDialog.tsx` —
  create staff dialog with permission toggles
- **Rewritten:** `apps/admin-web/src/pages/StaffPage.tsx` — tabbed interface
  (Teachers + Staff)
- **New file:** `functions/identity/src/callable/save-staff.ts` — callable for
  updating staff details and permissions (refreshes custom claims)
- Added `callSaveStaff` wrapper in
  `packages/shared-services/src/auth/auth-callables.ts`

---

## Phase 4: Tenant Branding

### T8 — Logo File Upload to Cloud Storage

- **New file:** `functions/identity/src/callable/upload-tenant-asset.ts` —
  generates signed upload URLs for tenant assets (logo, banner, favicon)
- **New types:** `UploadTenantAssetRequest/Response` in
  `packages/shared-types/src/callable-types.ts`
- **New file:** `apps/admin-web/src/components/settings/LogoUploader.tsx` —
  drag-and-drop upload with progress, preview, validation (png/jpeg/svg/webp,
  max 2MB)
- **Modified:** `apps/admin-web/src/pages/SettingsPage.tsx` — replaced URL text
  input with LogoUploader component
- Added `callUploadTenantAsset` wrapper in
  `packages/shared-services/src/auth/auth-callables.ts`

### T9 — Branding Propagation to All Apps

- **Modified:** `apps/teacher-web/src/layouts/AppLayout.tsx` — added
  `useTenantBranding()` call
- **Modified:** `apps/student-web/src/layouts/AppLayout.tsx` — added
  `useTenantBranding()` call
- **Modified:** `apps/parent-web/src/layouts/AppLayout.tsx` — added
  `useTenantBranding()` call
- All portal apps now apply tenant CSS custom properties (primary/secondary
  colors, logo)

---

## Phase 5: Quota Warning System

### T10 — In-App Quota Warning Banners

- **New file:** `packages/shared-hooks/src/tenant/use-quota-status.ts` —
  `useQuotaStatus()` hook computing `QuotaWarning` (none/amber/red/expired)
- **New file:** `apps/admin-web/src/components/layout/QuotaWarningBanner.tsx` —
  dismissible banner with amber/red/expired styling
- **Modified:** `apps/admin-web/src/layouts/AppLayout.tsx` — renders
  `QuotaWarningBanner` before main content
- Exported `useQuotaStatus` and `QuotaWarning` from `packages/shared-hooks`

---

## Infrastructure Fixes

- Added `@levelup/shared-hooks` dependency to `packages/shared-ui/package.json`
  (required by `OfflineBanner.tsx`)
- Exported `callSaveStaff` and `callUploadTenantAsset` from
  `packages/shared-services/src/auth/index.ts`
- Added `trialEndsAt` field to `Tenant` type in
  `packages/shared-types/src/identity/tenant.ts`
- Exported new scheduled functions and callables from
  `functions/identity/src/index.ts`

---

## Build Verification

| Package                        | Status  |
| ------------------------------ | ------- |
| `@levelup/functions-identity`  | ✅ Pass |
| `@levelup/functions-autograde` | ✅ Pass |
| `@levelup/admin-web`           | ✅ Pass |
| `@levelup/teacher-web`         | ✅ Pass |
| `@levelup/student-web`         | ✅ Pass |
| `@levelup/parent-web`          | ✅ Pass |

**Note:** `@levelup/functions-levelup` has pre-existing build errors (missing
`@levelup/functions-shared` module) unrelated to this cycle.
