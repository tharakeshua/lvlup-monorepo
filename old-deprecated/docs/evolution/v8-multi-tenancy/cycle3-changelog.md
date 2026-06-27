# V8: Multi-Tenancy & Business Logic — Cycle 3 Changelog

**Vertical:** V8 | **Cycle:** 3 (Feature Completion) | **Team:** Platform
Engineer **Date:** 2026-03-07

---

## Changes — Pass 0 (Security & Decomposition)

### 1. Synthetic Email Domain Inconsistency — Fixed

**File:** `functions/identity/src/callable/create-org-user.ts`

**Before:** Used `{rollNumber}@{tenantCode}.levelup.local` **After:** Uses
`{rollNumber}@{tenantId}.levelup.internal`

Now consistent with `bulk-import-students.ts` and
`shared-services/auth/tenant-lookup.ts`. Uses immutable `tenantId` (not mutable
`tenantCode`) and standard `.levelup.internal` domain.

### 2. Plaintext Credentials in Bulk Import — Secured

**Files:** `functions/identity/src/callable/bulk-import-students.ts`,
`packages/shared-services/src/auth/auth-callables.ts`

**Before:** Credentials returned as plaintext `{ rollNumber, password }[]` in
the response body.

**After:** Credentials uploaded to Cloud Storage as a CSV file. Response
contains only a signed download URL (`credentialsUrl`) that expires in 5
minutes. The file is auto-deleted after 10 minutes.

### 3. StaffPage — Scoped Firestore Query

**File:** `apps/admin-web/src/pages/StaffPage.tsx`

**Before:** Fetched ALL `userMemberships` documents globally, then filtered
client-side.

**After:** Uses Firestore `where("tenantId", "==", tenantId)` +
`where("role", "==", "teacher")` query.

### 4. UsersPage — Decomposition (725 → ~380 lines)

**Files:** `apps/admin-web/src/pages/UsersPage.tsx`, new tab components

Extracted tab table rendering into `TeachersTab`, `StudentsTab`, `ParentsTab`.

---

## Changes — Pass 1 (4-Theme: Feature / Integration / Quality / UX)

### 5. Firestore Security Rules — Deactivated Tenant Write Blocking (Quality/Security)

**File:** `firestore.rules`

**Before:** When a tenant was deactivated, memberships were suspended but users
with cached auth tokens (up to 1h expiry) could still write to deactivated
tenant data.

**After:** Added `isTenantActive(tenantId)` helper function that validates
`tenant.status in ['active', 'trial']` at the security rule level. Applied to
all non-admin write paths:

| Collection            | Write Rules Updated   |
| --------------------- | --------------------- |
| `spaces`              | Teacher create/update |
| `exams`               | Teacher create/update |
| `submissions`         | Student create        |
| `spaceProgress`       | Student create/update |
| `progress`            | Student create/update |
| `testSessions`        | Student create/update |
| `digitalTestSessions` | Student create/update |
| `chatSessions`        | Student create/update |

SuperAdmin and TenantAdmin write paths are NOT gated (they need access to manage
deactivated tenants).

### 6. Branding Preview — SettingsPage (UX)

**File:** `apps/admin-web/src/pages/SettingsPage.tsx`

**Before:** Branding tab showed only form fields with small color swatches.

**After:** Added a live preview card below branding fields that shows:

- Mock header bar with tenant logo and name using the primary color
- Sample buttons styled with primary and accent colors
- Progress bar styled with accent color

Preview updates in real-time during editing. Only renders when at least one
branding field has a value.

---

## Files Modified

| File                                                      | Change                                                         |
| --------------------------------------------------------- | -------------------------------------------------------------- |
| `functions/identity/src/callable/create-org-user.ts`      | Fixed synthetic email domain                                   |
| `functions/identity/src/callable/bulk-import-students.ts` | Credentials → Cloud Storage signed URL                         |
| `packages/shared-services/src/auth/auth-callables.ts`     | Updated BulkImportStudentsResponse type                        |
| `apps/admin-web/src/pages/StaffPage.tsx`                  | Scoped membership query                                        |
| `apps/admin-web/src/pages/UsersPage.tsx`                  | Decomposed into tab components                                 |
| `apps/admin-web/src/hooks/usePagination.ts`               | Exported PaginationResult type                                 |
| `firestore.rules`                                         | Added `isTenantActive()` + applied to 9 collection write rules |
| `apps/admin-web/src/pages/SettingsPage.tsx`               | Added live branding preview card                               |

## Files Created

| File                                                  | Purpose                 |
| ----------------------------------------------------- | ----------------------- |
| `apps/admin-web/src/components/users/TeachersTab.tsx` | Teacher table component |
| `apps/admin-web/src/components/users/StudentsTab.tsx` | Student table component |
| `apps/admin-web/src/components/users/ParentsTab.tsx`  | Parent table component  |

---

## Build Verification

| Package                     | TypeCheck                 | Status |
| --------------------------- | ------------------------- | ------ |
| @levelup/super-admin        | `tsc --noEmit` — 0 errors | PASS   |
| @levelup/admin-web          | `tsc --noEmit` — 0 errors | PASS   |
| @levelup/functions-identity | `tsc --noEmit` — 0 errors | PASS   |
| @levelup/shared-services    | `tsc --noEmit` — 0 errors | PASS   |

---

## 4-Theme Audit Summary

| Theme           | Status   | Notes                                                                                                                                                                                                                                                                                                                                                                 |
| --------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Feature**     | Complete | Dual onboarding (super admin tenant creation + school admin wizard). Tenant branding (colors + logo). Billing-ready (subscription plans, quotas, feature gates). Tenant analytics (LLM usage, progress summaries). Data export/deactivation. 7 role types with granular permissions. Staff permissions (6 flags). Teacher permissions (8 flags + class-level access). |
| **Integration** | Complete | V4 content scoped via Firestore rules (spaces, items, storyPoints). V5 AI quotas per-tenant (rate limits + subscription limits). V6 data isolation (tenant-scoped collections + security rules). V7 admin-web scoped to `currentTenantId`.                                                                                                                            |
| **Quality**     | Complete | Firestore rules block writes to deactivated tenants. Bulk import credentials secured via signed URLs. Scoped queries prevent cross-tenant data leakage. All 6 deferred Cycle 2 issues resolved.                                                                                                                                                                       |
| **UX**          | Complete | Onboarding wizard with 4-step progress stepper + skip/back navigation. Live branding preview card. RoleSwitcher for multi-tenant users. Copy-to-clipboard for tenant code.                                                                                                                                                                                            |
