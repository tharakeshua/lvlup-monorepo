# V8: Multi-Tenancy & Business Logic — Cycle 4 Plan

**Vertical:** V8 | **Cycle:** 4 (Business Readiness) | **Team:** Platform
Engineer **Current Completion:** ~88% (post Cycle 3) **Target Completion:** ~97%
**Status:** Planning → Implementation **Depends on:** C3-V8 ✅ Complete
(2026-03-07)

---

## Audit Summary

### Completed in Previous Cycles (C1–C3)

- Tenant CRUD with create/update/deactivate/reactivate/export
- Subscription types with plan tiers, quotas, billing-ready fields
- Quota enforcement (`assertQuota`) in `createOrgUser`, `bulkImportStudents`
- Feature flag enforcement (`assertFeatureEnabled`) for `bulkImportEnabled`
- 4-step onboarding wizard (school info → academic session → first class →
  invite staff)
- Staff role with 6 granular permissions, teacher permissions with 8 toggles
- Tenant branding (colors, logo URL) with live preview in SettingsPage
- CSS injection hook (`use-tenant-branding.ts`) applying custom properties
- Deactivation/reactivation with cascading membership suspension
- Firestore rules: `isTenantActive()` blocks writes to deactivated tenants
- Data export (JSON/CSV) with signed Cloud Storage URLs
- Audit logging (`logTenantAction`) on all admin operations
- Secure credential handling (signed URLs, auto-delete)
- Synthetic email domain unification (`.levelup.internal`)
- Scoped Firestore queries (StaffPage, UsersPage decomposition)

### Identified Gaps (→ Cycle 4 Scope)

| Gap                                        | Impact | Current State                                                                        |
| ------------------------------------------ | ------ | ------------------------------------------------------------------------------------ |
| No onboarding redirect guard               | High   | Wizard exists but App.tsx doesn't auto-redirect incomplete tenants                   |
| No tenant lifecycle automation             | High   | Trial never auto-expires; no scheduled status transitions                            |
| No monthly usage counter reset             | High   | `examsThisMonth`, `aiCallsThisMonth` never reset                                     |
| No real-time usage tracking                | High   | `TenantUsage` type exists but counters not incremented on operations                 |
| No quota visualization in admin-web        | Medium | Admin has no visibility into subscription utilization                                |
| No admin-web data export UI                | Medium | Export callable exists but only super-admin has UI for it                            |
| No logo file upload                        | Medium | Branding has `logoUrl` field but requires manual URL entry (no Cloud Storage upload) |
| No branding in teacher/student/parent apps | Medium | `use-tenant-branding.ts` exists but only integrated in admin-web layout              |
| No staff member CRUD UI                    | Medium | StaffPage manages teacher permissions only; no create/edit for `role: 'staff'`       |
| No permission presets                      | Low    | Each teacher/staff configured individually; no template system                       |
| No usage alerts                            | Low    | No notification when approaching quota limits                                        |

---

## Implementation Plan

### Phase 1: Onboarding Completeness & Lifecycle Automation

#### T1: Onboarding Redirect Guard [S]

**Files:**

- `apps/admin-web/src/App.tsx` — Add onboarding redirect check
- `apps/admin-web/src/pages/DashboardPage.tsx` — Add "Resume Onboarding" banner

**What**: When a tenantAdmin logs into admin-web and
`tenant.onboarding?.completed !== true`, redirect to `/onboarding`. Add a banner
on DashboardPage if onboarding is incomplete with a "Complete Setup" link. Skip
redirect for superAdmin users who may be inspecting tenant state.

**Acceptance:**

- [ ] TenantAdmin auto-redirected to onboarding wizard when
      `onboarding.completed !== true`
- [ ] SuperAdmin bypasses redirect
- [ ] Dashboard shows "Complete Setup" banner linking to `/onboarding` when
      incomplete
- [ ] After wizard completion, redirect to dashboard works

#### T2: Tenant Lifecycle Automation — Trial Expiry [M]

**Files:**

- `functions/identity/src/scheduled/tenant-lifecycle.ts` (new) — Scheduled
  function
- `functions/identity/src/index.ts` — Export scheduled function
- `packages/shared-types/src/identity/tenant.ts` — Add `trialEndsAt` field

**What**: Create a Cloud Scheduler function that runs daily at 00:00 UTC:

1. Query tenants where `status === 'trial'` and `subscription.expiresAt < now`
2. Set status to `expired` (not `deactivated` — no membership suspension, just a
   soft block)
3. Write audit log: `trial_expired`
4. Query tenants where `status === 'expired'` and `subscription.expiresAt` was >
   30 days ago with no activity
5. Flag for admin review (write to `platformActivityLog`)

Add `trialEndsAt` convenience field on Tenant type, set during creation based on
plan defaults (trial = 30 days).

Firestore rules already block non-admin writes for non-active tenants. Expired
tenants can still be managed by admins.

**Acceptance:**

- [ ] Scheduled function runs daily
- [ ] Trial tenants past `expiresAt` automatically transition to `expired`
- [ ] Audit log entry written for each expiry
- [ ] Long-expired tenants flagged for admin review
- [ ] SuperAdmin can still manage expired tenants
- [ ] `pnpm build` passes

#### T3: Monthly Usage Counter Reset [S]

**Files:**

- `functions/identity/src/scheduled/usage-reset.ts` (new) — Monthly reset
  function
- `functions/identity/src/index.ts` — Export scheduled function

**What**: Scheduled function that runs on the 1st of each month at 00:00 UTC:

1. Query all tenants with `status in ['active', 'trial']`
2. Reset `usage.examsThisMonth` and `usage.aiCallsThisMonth` to 0
3. Update `usage.lastUpdated` to current timestamp
4. Process in batches of 450 (Firestore batch limit safety margin)

**Acceptance:**

- [ ] Monthly counters reset on the 1st of each month
- [ ] Only active/trial tenants are reset
- [ ] Batch processing handles large tenant counts
- [ ] `usage.lastUpdated` reflects reset time

### Phase 2: Real-Time Usage Tracking & Quota Visualization

#### T4: Real-Time Usage Counter Increments [M]

**Files:**

- `functions/autograde/src/callable/save-exam.ts` — Increment
  `usage.examsThisMonth` on create
- `functions/levelup/src/callable/save-space.ts` — Increment
  `usage.currentSpaces` on create
- `functions/identity/src/callable/create-org-user.ts` — Already updates
  `stats`; also update `usage.currentStudents`/`currentTeachers`
- `functions/identity/src/callable/bulk-import-students.ts` — Also update
  `usage.currentStudents`
- `functions/autograde/src/callable/grade-question.ts` — Increment
  `usage.aiCallsThisMonth` on AI grading
- `functions/identity/src/utils/usage.ts` (new) —
  `incrementUsage(tenantId, field, amount)` helper

**What**: Create a centralized `incrementUsage(tenantId, field, amount)` helper
using Firestore `FieldValue.increment()`. Integrate at every point where a
countable resource is created. This ensures `TenantUsage` reflects real resource
consumption for billing and quota visibility.

Fields to track: | Field | Increment Point | Decrement Point |
|-------|----------------|-----------------| | `currentStudents` |
`createOrgUser(student)`, `bulkImportStudents` | (future: archive student) | |
`currentTeachers` | `createOrgUser(teacher)` | (future: archive teacher) | |
`currentSpaces` | `saveSpace(create)` | (future: archive space) | |
`examsThisMonth` | `saveExam(create)` | (never — monthly reset) | |
`aiCallsThisMonth` | `gradeQuestion(AI)` | (never — monthly reset) |

**Acceptance:**

- [ ] `incrementUsage` helper uses `FieldValue.increment` for atomicity
- [ ] Exam creation increments `examsThisMonth`
- [ ] AI grading increments `aiCallsThisMonth`
- [ ] Space creation increments `currentSpaces`
- [ ] User creation increments `currentStudents`/`currentTeachers`
- [ ] `usage.lastUpdated` set on each increment
- [ ] All builds pass

#### T5: Admin-Web Quota Visualization Dashboard [M]

**Files:**

- `apps/admin-web/src/pages/DashboardPage.tsx` — Add subscription utilization
  section
- `apps/admin-web/src/components/dashboard/QuotaUsageCard.tsx` (new) — Reusable
  quota card

**What**: Extend the admin-web DashboardPage with a "Subscription Usage" section
showing:

- **Progress bars** for: Students (current/max), Teachers (current/max), Spaces
  (current/max)
- **Monthly counters**: Exams this month (current/max), AI calls this month
  (current/max)
- Color coding: green (< 70%), amber (70–90%), red (> 90%)
- "Unlimited" label when max is undefined
- Current plan name badge
- Subscription expiry date (if set)
- Link to Settings page for subscription details

Data sourced from `useTenantUsage()` and `useTenant()` (subscription) hooks —
already available via tenant store.

**Acceptance:**

- [ ] Progress bars display for all quota-tracked resources
- [ ] Color transitions at 70% and 90% thresholds
- [ ] "Unlimited" shown when no max set
- [ ] Correct plan name and expiry date displayed
- [ ] Loading skeletons during data fetch
- [ ] Empty state when tenant data not loaded

### Phase 3: Data Export & Staff Management in Admin-Web

#### T6: Admin-Web Data Export Page [S]

**Files:**

- `apps/admin-web/src/pages/DataExportPage.tsx` (new) — Data export UI
- `apps/admin-web/src/App.tsx` — Add route `/data-export`
- `apps/admin-web/src/layouts/AppLayout.tsx` — Add nav item under "School"
  section

**What**: School admin page for exporting tenant data using the existing
`exportTenantData` callable. UI includes:

- Collection selector (checkboxes): Students, Teachers, Classes, Exams,
  Submissions
- Format selector: JSON / CSV radio buttons
- "Export" button with loading state
- After export: Download link with expiry countdown (1-hour expiry)
- Export history list showing past exports (read from `exports/{tenantId}/`
  storage prefix metadata or a simple Firestore subcollection)

Restricted to tenantAdmin or staff with `canExportData` permission.

**Acceptance:**

- [ ] School admin can select collections and format
- [ ] Export triggers existing `exportTenantData` callable
- [ ] Download link shown with expiry information
- [ ] Permission check: only tenantAdmin or staff with `canExportData`
- [ ] Loading/error states handled

#### T7: Staff Member CRUD UI [M]

**Files:**

- `apps/admin-web/src/pages/StaffPage.tsx` — Add Staff tab alongside Teachers
  tab
- `apps/admin-web/src/components/staff/StaffTab.tsx` (new) — Staff member list
- `apps/admin-web/src/components/staff/CreateStaffDialog.tsx` (new) — Create
  staff member dialog

**What**: Extend StaffPage with a tabbed interface:

- **Teachers Tab** (existing): Teacher list with permission toggles
- **Staff Tab** (new): Administrative staff list with CRUD

Staff tab features:

- List staff members with name, email, department, permission summary, status
- "Add Staff" button → CreateStaffDialog
  - Fields: firstName, lastName, email, phone, department
  - Permission toggles: 6 StaffPermissions flags
  - Creates via existing `createOrgUser` callable with `role: 'staff'`
- Edit staff → Update permissions via `saveStaff` or direct membership update
- Archive/activate staff actions

**Acceptance:**

- [ ] StaffPage has two tabs: Teachers and Staff
- [ ] Staff tab lists all staff-role members for the tenant
- [ ] Create staff dialog with permission configuration
- [ ] Edit staff permissions works (permission toggles saved and claims
      refreshed)
- [ ] Archive/activate staff updates membership status
- [ ] Staff creation respects any staff quota if defined

### Phase 4: Branding Enhancement & File Upload

#### T8: Logo File Upload to Cloud Storage [M]

**Files:**

- `apps/admin-web/src/pages/SettingsPage.tsx` — Replace logo URL input with file
  upload
- `apps/admin-web/src/components/settings/LogoUploader.tsx` (new) — File upload
  component
- `functions/identity/src/callable/upload-tenant-asset.ts` (new) — Signed upload
  URL generator
- `packages/shared-types/src/callable-types.ts` — Add
  `UploadTenantAssetRequest/Response`
- `packages/shared-services/src/auth/identity-callables.ts` — Add
  `callUploadTenantAsset`

**What**: Replace the manual logo URL text input with a proper file upload:

1. **Backend**: New callable `uploadTenantAsset` that:
   - Accepts
     `{ tenantId, assetType: 'logo' | 'banner' | 'favicon', contentType: string }`
   - Validates content type (only image/png, image/jpeg, image/svg+xml,
     image/webp)
   - Generates a signed upload URL for Cloud Storage path
     `tenants/{tenantId}/branding/{assetType}-{timestamp}.{ext}`
   - Returns `{ uploadUrl, publicUrl }` (the public URL to store in
     tenant.branding)
2. **Frontend**: `LogoUploader` component with:
   - Drag-and-drop or click-to-browse file selection
   - File type validation (images only, max 2MB)
   - Upload progress indicator
   - Preview of uploaded logo
   - Calls `callUploadTenantAsset` to get signed URL, then uploads directly to
     Cloud Storage
   - On success, updates `tenant.branding.logoUrl` via `saveTenant`

**Acceptance:**

- [ ] Admin can upload logo via drag-and-drop or file picker
- [ ] File type restricted to images (png, jpeg, svg, webp)
- [ ] File size limited to 2MB
- [ ] Upload progress shown
- [ ] Logo preview displayed after upload
- [ ] Signed URL approach (client uploads directly to Cloud Storage)
- [ ] Old logos not automatically cleaned up (acceptable for v1)

#### T9: Branding Propagation to All Tenant Apps [S]

**Files:**

- `apps/teacher-web/src/layouts/AppLayout.tsx` — Integrate `useTenantBranding`
  hook
- `apps/student-web/src/layouts/AppLayout.tsx` — Integrate `useTenantBranding`
  hook
- `apps/parent-web/src/layouts/AppLayout.tsx` — Integrate `useTenantBranding`
  hook
- `packages/shared-hooks/src/ui/use-tenant-branding.ts` — Add logo display to
  sidebar/header

**What**: The `useTenantBranding` hook already exists and injects CSS custom
properties (`--tenant-primary`, `--tenant-accent`). Currently only called in
admin-web's AppLayout. Integrate into all tenant-facing apps:

1. Call `useTenantBranding()` in each app's AppLayout (teacher-web, student-web,
   parent-web)
2. Add tenant logo display in sidebar headers using `--brand-logo-url` or the
   `useTenantBranding` hook's logo URL
3. Ensure CSS custom properties cascade to all shadcn/ui components via Tailwind
   config

No changes needed to the hook itself — just wiring into the remaining app
layouts.

**Acceptance:**

- [ ] Teacher-web applies tenant branding colors
- [ ] Student-web applies tenant branding colors
- [ ] Parent-web applies tenant branding colors
- [ ] Tenant logo displayed in sidebar/header of all apps
- [ ] Default colors used when no branding configured
- [ ] No visual regression when branding is empty

### Phase 5: Quota Alerts & Usage Warnings

#### T10: In-App Quota Warning Banners [S]

**Files:**

- `apps/admin-web/src/components/layout/QuotaWarningBanner.tsx` (new) — Warning
  banner component
- `apps/admin-web/src/layouts/AppLayout.tsx` — Render banner at top of layout
- `packages/shared-hooks/src/tenant/use-quota-status.ts` (new) — Quota status
  calculation hook

**What**: Display warning banners in admin-web when quota thresholds are
approached:

- **Amber banner** (> 80% of any limit): "You've used 45/50 student seats.
  Consider upgrading your plan."
- **Red banner** (> 95% of any limit): "You've reached 49/50 student seats. New
  students cannot be added."
- **Expired banner** (tenant status is 'expired'): "Your trial has expired.
  Contact support to continue."

`useQuotaStatus` hook computes warning state from `useTenantUsage()` and
`useTenant()`:

```typescript
interface QuotaWarning {
  level: "none" | "amber" | "red" | "expired";
  resource: string;
  current: number;
  max: number;
  message: string;
}
```

Banner is dismissible per session (stored in local state, not persisted). Shows
the highest-priority warning if multiple exist.

**Acceptance:**

- [ ] Amber banner shown when any quota exceeds 80%
- [ ] Red banner shown when any quota exceeds 95%
- [ ] Expired status shows trial expiry banner
- [ ] Banner dismissible per session
- [ ] No banner when all quotas are healthy
- [ ] Handles undefined limits gracefully (no banner for unlimited resources)

---

## Implementation Order

| Order | Task                                           | Size | Priority | Deps          |
| ----- | ---------------------------------------------- | ---- | -------- | ------------- |
| 1     | T1: Onboarding redirect guard                  | S    | HIGH     | —             |
| 2     | T4: Real-time usage counter increments         | M    | HIGH     | —             |
| 3     | T3: Monthly usage counter reset                | S    | HIGH     | —             |
| 4     | T2: Tenant lifecycle automation (trial expiry) | M    | HIGH     | —             |
| 5     | T5: Quota visualization dashboard              | M    | MEDIUM   | T4            |
| 6     | T7: Staff member CRUD UI                       | M    | MEDIUM   | —             |
| 7     | T6: Admin-web data export page                 | S    | MEDIUM   | —             |
| 8     | T8: Logo file upload to Cloud Storage          | M    | MEDIUM   | —             |
| 9     | T9: Branding propagation to all apps           | S    | MEDIUM   | T8 (optional) |
| 10    | T10: Quota warning banners                     | S    | LOW      | T4            |

**Parallel tracks:**

- T1, T4, T3, T2 can all run in parallel (independent foundations)
- T5 depends on T4 (needs real-time usage data to visualize)
- T6, T7 are independent and can run in parallel with T5
- T8 is independent; T9 can run after T8 but also works without it (colors only)
- T10 depends on T4 (needs accurate usage data for warnings)

---

## Files Summary

### New Files (10)

| File                                                         | Purpose                                  |
| ------------------------------------------------------------ | ---------------------------------------- |
| `functions/identity/src/scheduled/tenant-lifecycle.ts`       | Daily trial expiry automation            |
| `functions/identity/src/scheduled/usage-reset.ts`            | Monthly usage counter reset              |
| `functions/identity/src/utils/usage.ts`                      | `incrementUsage()` atomic counter helper |
| `functions/identity/src/callable/upload-tenant-asset.ts`     | Signed upload URL for branding assets    |
| `apps/admin-web/src/pages/DataExportPage.tsx`                | School admin data export UI              |
| `apps/admin-web/src/components/dashboard/QuotaUsageCard.tsx` | Quota progress bar component             |
| `apps/admin-web/src/components/staff/StaffTab.tsx`           | Staff member list tab                    |
| `apps/admin-web/src/components/staff/CreateStaffDialog.tsx`  | Create staff member dialog               |
| `apps/admin-web/src/components/settings/LogoUploader.tsx`    | Logo file upload component               |
| `packages/shared-hooks/src/tenant/use-quota-status.ts`       | Quota warning calculation hook           |

### Modified Files (16)

| File                                                      | Changes                                             |
| --------------------------------------------------------- | --------------------------------------------------- |
| `apps/admin-web/src/App.tsx`                              | Onboarding redirect guard, data export route        |
| `apps/admin-web/src/layouts/AppLayout.tsx`                | Data export nav item, quota warning banner          |
| `apps/admin-web/src/pages/DashboardPage.tsx`              | Onboarding banner, quota visualization section      |
| `apps/admin-web/src/pages/StaffPage.tsx`                  | Add Staff tab alongside Teachers tab                |
| `apps/admin-web/src/pages/SettingsPage.tsx`               | Replace logo URL input with file upload             |
| `apps/teacher-web/src/layouts/AppLayout.tsx`              | Integrate `useTenantBranding`                       |
| `apps/student-web/src/layouts/AppLayout.tsx`              | Integrate `useTenantBranding`                       |
| `apps/parent-web/src/layouts/AppLayout.tsx`               | Integrate `useTenantBranding`                       |
| `functions/identity/src/index.ts`                         | Export scheduled functions                          |
| `functions/identity/src/callable/create-org-user.ts`      | Increment `usage.currentStudents`/`currentTeachers` |
| `functions/identity/src/callable/bulk-import-students.ts` | Increment `usage.currentStudents`                   |
| `functions/autograde/src/callable/save-exam.ts`           | Increment `usage.examsThisMonth`                    |
| `functions/autograde/src/callable/grade-question.ts`      | Increment `usage.aiCallsThisMonth`                  |
| `functions/levelup/src/callable/save-space.ts`            | Increment `usage.currentSpaces`                     |
| `packages/shared-types/src/identity/tenant.ts`            | Add `trialEndsAt` field                             |
| `packages/shared-types/src/callable-types.ts`             | Add `UploadTenantAssetRequest/Response`             |

---

## Coding Standards

- TypeScript strict mode, zero `any`
- Use existing Zod schemas and branded types from `@levelup/shared-types`
- Follow existing patterns: `HttpsError` for callable errors, `admin.firestore`
  for DB access
- All new types exported from `@levelup/shared-types`
- Use shadcn/ui components from `@levelup/shared-ui`
- Use `FieldValue.increment()` for atomic counter updates (never
  read-modify-write)
- Scheduled functions use `onSchedule` from `firebase-functions/v2/scheduler`
- Rate limit enforcement on all new callables
- Must pass `pnpm build` and `tsc --noEmit`

---

## Target Completion: ~97%

After Cycle 4, remaining items for 100%:

- Billing provider integration (Stripe/Razorpay payment processing, invoicing,
  dunning)
- GDPR data deletion (right-to-be-forgotten implementation)
- Custom domain per tenant (white-label)
- Data retention policies and automated archival
- Advanced RBAC (custom role definitions beyond the 7 fixed roles)
- Tenant comparison analytics (super-admin cross-tenant benchmarking)
