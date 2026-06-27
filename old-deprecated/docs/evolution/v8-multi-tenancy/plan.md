# V8: Multi-Tenancy & Business Logic — Evolution Plan

**Vertical:** V8 | **Cycle:** 1 | **Team:** Platform Engineer **Status:**
Planning → Implementation **Depends on:** V7 (Admin Dashboards) ✅ Complete

---

## Current State Assessment

### What Already Works

| Area                | Status     | Details                                                                                      |
| ------------------- | ---------- | -------------------------------------------------------------------------------------------- |
| Tenant CRUD         | ✅ Solid   | `saveTenant` callable with create/update, atomic transactions, tenant code auto-generation   |
| User Membership     | ✅ Solid   | Composite key pattern `{uid}_{tenantId}`, role-based, multi-tenant switching                 |
| Firestore Rules     | ✅ Solid   | Tenant isolation via `belongsToTenant()`, role-based access helpers                          |
| Custom Claims       | ✅ Solid   | role, tenantId, tenantCode, permissions in JWT, class overflow handling                      |
| Subscription Fields | ⚠️ Partial | `plan`, `maxStudents`, `maxTeachers`, `maxSpaces`, `maxExamsPerMonth` exist but NOT enforced |
| Feature Flags       | ✅ Solid   | 9 feature flags on Tenant, toggled via super-admin                                           |
| Tenant Store        | ✅ Solid   | Real-time Firestore subscription, reactive in all apps                                       |
| Auth Store          | ✅ Solid   | Multi-tenant switching, membership loading, school-code login                                |
| Admin Settings      | ✅ Solid   | School info editing, evaluation settings, API key management                                 |
| Teacher Permissions | ⚠️ Partial | 8 permission fields defined but no management UI                                             |
| Tenant Status       | ⚠️ Partial | 4 statuses (active/suspended/trial/expired) but no lifecycle automation                      |
| Branding Fields     | ⚠️ Partial | `logoUrl`, `bannerUrl` fields exist but unused in UI                                         |

### Critical Gaps (V8 Scope)

1. **No subscription quota enforcement** — `createOrgUser`/`bulkImportStudents`
   never check limits
2. **No onboarding wizard** — bare `saveTenant` with no guided setup flow
3. **No staff role management UI** — teacher permissions exist but can't be
   managed from admin portal
4. **No billing-ready structure** — no billing cycles, usage tracking beyond
   stats, or tier enforcement
5. **No tenant branding** — `logoUrl`/`bannerUrl` unused, no CSS theming
6. **No data export** — no CSV/PDF bulk export for tenant data
7. **No tenant deactivation flow** — no graceful suspend/archive with user
   notifications
8. **No data isolation audit** — no centralized tenant context validation
   middleware
9. **No onboarding wizard** — no step-by-step guided setup for new tenants

---

## V8 Implementation Scope

### Phase A: Subscription Quota Enforcement & Billing-Ready Types

**Goal:** Enforce tenant subscription limits at the Cloud Function boundary;
extend types for billing readiness.

#### A1: Extended Types (`packages/shared-types/`)

**File: `src/identity/tenant.ts`** — Extend `TenantSubscription`:

```typescript
export interface TenantSubscription {
  plan: "free" | "trial" | "basic" | "premium" | "enterprise";
  expiresAt?: FirestoreTimestamp;
  maxStudents?: number;
  maxTeachers?: number;
  maxSpaces?: number;
  maxExamsPerMonth?: number;
  // NEW: Billing-ready fields
  billingCycle?: "monthly" | "annual";
  billingEmail?: string;
  currentPeriodStart?: FirestoreTimestamp;
  currentPeriodEnd?: FirestoreTimestamp;
  cancelAtPeriodEnd?: boolean;
}
```

**File: `src/identity/tenant.ts`** — Add `TenantBranding`:

```typescript
export interface TenantBranding {
  logoUrl?: string;
  bannerUrl?: string;
  primaryColor?: string;
  accentColor?: string;
  favicon?: string;
}
```

Move `logoUrl`/`bannerUrl` from `Tenant` root into `branding` nested object
(keep root fields for backward compat, deprecate).

**File: `src/identity/tenant.ts`** — Extend `Tenant.status`:

```typescript
status: "active" | "suspended" | "trial" | "expired" | "deactivated";
```

**File: `src/identity/tenant.ts`** — Add `TenantUsage`:

```typescript
export interface TenantUsage {
  currentStudents: number;
  currentTeachers: number;
  currentSpaces: number;
  examsThisMonth: number;
  aiCallsThisMonth: number;
  storageBytes: number;
  lastUpdated: FirestoreTimestamp;
}
```

**File: `src/identity/membership.ts`** — Add `staff` role & `StaffPermissions`:

```typescript
export type TenantRole =
  | "superAdmin"
  | "tenantAdmin"
  | "teacher"
  | "student"
  | "parent"
  | "scanner"
  | "staff"; // NEW

export interface StaffPermissions {
  canManageUsers: boolean;
  canManageClasses: boolean;
  canManageBilling: boolean;
  canViewAnalytics: boolean;
  canManageSettings: boolean;
  canExportData: boolean;
}

export const DEFAULT_STAFF_PERMISSIONS: StaffPermissions = {
  canManageUsers: false,
  canManageClasses: false,
  canManageBilling: false,
  canViewAnalytics: true,
  canManageSettings: false,
  canExportData: false,
};
```

**File: `src/identity/membership.ts`** — Extend `UserMembership`:

```typescript
// Add to UserMembership
staffPermissions?: StaffPermissions;
```

#### A2: Quota Enforcement Middleware (`functions/identity/src/utils/`)

**New file: `quota.ts`**

```typescript
export async function assertQuota(
  tenantId: string,
  resource: "student" | "teacher" | "space" | "exam"
): Promise<void>;
```

- Reads `tenant.subscription` limits + `tenant.stats` current counts
- Throws `HttpsError('resource-exhausted', ...)` if over quota
- Called before `createOrgUser`, `bulkImportStudents`, `saveExam` (create only),
  `saveSpace` (create only)

#### A3: Integrate Quota Checks

**Modified files:**

- `functions/identity/src/callable/create-org-user.ts` — Add
  `assertQuota(tenantId, role)` before entity creation
- `functions/identity/src/callable/bulk-import-students.ts` — Add
  `assertQuota(tenantId, 'student')` with batch count validation
- `functions/autograde/src/callable/save-exam.ts` — Add
  `assertQuota(tenantId, 'exam')` on create
- `functions/levelup/src/callable/save-space.ts` — Add
  `assertQuota(tenantId, 'space')` on create

#### A4: Feature Gating Middleware

**New file: `functions/identity/src/utils/feature-gate.ts`**

```typescript
export async function assertFeatureEnabled(
  tenantId: string,
  feature: keyof TenantFeatures
): Promise<void>;
```

- Reads `tenant.features[feature]`
- Throws `HttpsError('permission-denied', 'Feature not enabled for your plan')`
- Integrate into relevant callables (e.g., check `aiGradingEnabled` before AI
  grading)

#### A5: Zod Schemas

**File: `src/schemas/callable-schemas.ts`** — Add schemas for new request types:

- `SaveTenantRequestSchema` — extend to include branding, usage fields
- `DeactivateTenantRequestSchema`
- `ExportTenantDataRequestSchema`

---

### Phase B: Tenant Onboarding Wizard

**Goal:** Step-by-step guided setup for new tenants, both self-service and
admin-managed.

#### B1: Self-Service Onboarding Flow (admin-web)

**New file: `apps/admin-web/src/pages/OnboardingWizardPage.tsx`**

4-step wizard:

1. **School Info** — Name, contact email, phone, address, logo upload
2. **Academic Setup** — Create first academic session, configure grading policy
3. **First Class** — Create initial class with grade/section
4. **Invite Staff** — Add first teacher or admin, show tenant code for sharing

Each step uses existing callables (`saveTenant`, `saveAcademicSession`,
`saveClass`, `createOrgUser`).

**New file: `apps/admin-web/src/components/onboarding/`** directory with step
components:

- `SchoolInfoStep.tsx`
- `AcademicSetupStep.tsx`
- `FirstClassStep.tsx`
- `InviteStaffStep.tsx`
- `OnboardingProgress.tsx` (stepper component)

#### B2: Onboarding State Tracking

**File: `src/identity/tenant.ts`** — Add to Tenant:

```typescript
onboarding?: {
  completed: boolean;
  completedSteps: string[];
  completedAt?: FirestoreTimestamp;
};
```

#### B3: Admin-Managed Onboarding (super-admin)

**Modified file: `apps/super-admin/src/pages/TenantsPage.tsx`**

- Enhance "Create Tenant" dialog to include quick-setup fields (academic
  session, first class)
- Show onboarding completion status badge on tenant cards

#### B4: Redirect Logic

**Modified file: `apps/admin-web/src/App.tsx`**

- If `tenant.onboarding?.completed !== true`, redirect to `/onboarding`
- After wizard completion, mark `onboarding.completed = true` and navigate to
  dashboard

---

### Phase C: Staff Roles & Permission Management

**Goal:** Enable fine-grained staff role management through the admin portal.

#### C1: Permission Management UI (admin-web)

**New file: `apps/admin-web/src/pages/StaffPage.tsx`**

- List all staff/teacher members with their current permissions
- Edit permissions per user via dialog
- Assign `staff` role to non-teaching staff members
- View permission summary per role

**New file: `apps/admin-web/src/components/staff/PermissionEditor.tsx`**

- Toggle grid for TeacherPermissions (8 fields)
- Toggle grid for StaffPermissions (6 fields)
- Class/space assignment multi-select for `managedClassIds`/`managedSpaceIds`

#### C2: Staff Role in Auth Flow

**Modified file: `functions/identity/src/callable/create-org-user.ts`**

- Support `role: 'staff'` with StaffPermissions
- Create membership with `staffPermissions` field
- Include in custom claims

**Modified file: `functions/identity/src/utils/claims.ts`**

- Include `staffPermissions` bits in claims for Firestore rule checks

#### C3: Permission Updates

**Modified file: `functions/identity/src/callable/save-teacher.ts`**

- Accept `permissions` updates (already partially supported)
- Refresh custom claims on permission change

**New callable type: `SaveStaffRequest`** in `callable-types.ts`:

```typescript
export interface SaveStaffRequest {
  id?: string;
  tenantId: string;
  data: {
    uid?: string;
    department?: string;
    staffPermissions?: StaffPermissions;
    status?: "active" | "archived";
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    password?: string;
  };
}
```

#### C4: Firestore Rules Update

**Modified file: `firestore.rules`**

- Add `isStaff(tenantId)` helper
- Allow staff with `canManageUsers` to read student/teacher subcollections
- Allow staff with `canViewAnalytics` to read analytics collections
- Allow staff with `canManageClasses` to write to class subcollection

---

### Phase D: Tenant Branding

**Goal:** Allow tenants to customize their visual identity.

#### D1: Branding Settings UI (admin-web)

**Modified file: `apps/admin-web/src/pages/SettingsPage.tsx`**

- Add "Branding" tab (4th tab)
- Logo upload (Cloud Storage) with preview
- Primary color picker
- Accent color picker
- Live preview of color scheme

#### D2: Branding Application

**Modified file: `packages/shared-stores/src/tenant-store.ts`**

- Expose `branding` from tenant store

**New file: `packages/shared-hooks/src/ui/use-tenant-branding.ts`**

- Hook that reads `tenantStore.branding` and applies CSS custom properties to
  `:root`
- Applied in all tenant-facing app layouts (admin-web, teacher-web, student-web,
  parent-web)

#### D3: Branding in saveTenant

**Modified file: `functions/identity/src/callable/save-tenant.ts`**

- Accept `branding` field in updates
- Validate color format (hex)

---

### Phase E: Tenant Lifecycle & Data Operations

**Goal:** Complete tenant lifecycle management with deactivation, data export,
and analytics.

#### E1: Tenant Deactivation Flow

**New callable: `deactivateTenant`** in
`functions/identity/src/callable/deactivate-tenant.ts`

- SuperAdmin only
- Sets status to `deactivated`
- Suspends all user memberships (batch update)
- Logs deactivation event
- Does NOT delete data (preserves for potential reactivation)

**New callable: `reactivateTenant`** in
`functions/identity/src/callable/reactivate-tenant.ts`

- SuperAdmin only
- Sets status back to `active`
- Reactivates all user memberships that were auto-suspended

#### E2: Tenant Data Export

**New callable: `exportTenantData`** in
`functions/identity/src/callable/export-tenant-data.ts`

- Accepts `format: 'json' | 'csv'` and `collections: string[]`
- Exports specified subcollections from `/tenants/{tenantId}/*`
- Generates downloadable file in Cloud Storage
- Returns signed download URL (expires in 1 hour)
- Restricted to SuperAdmin or TenantAdmin with `canExportData`

**New callable type in `callable-types.ts`:**

```typescript
export interface ExportTenantDataRequest {
  tenantId: string;
  format: "json" | "csv";
  collections: (
    | "students"
    | "teachers"
    | "classes"
    | "exams"
    | "submissions"
  )[];
}

export interface ExportTenantDataResponse {
  downloadUrl: string;
  expiresAt: string;
  recordCount: number;
}
```

#### E3: Data Export UI (super-admin)

**Modified file: `apps/super-admin/src/pages/TenantDetailPage.tsx`**

- Add "Data Export" section
- Collection selector (checkboxes)
- Format selector (JSON/CSV)
- Export button with progress indicator
- Download link display

#### E4: Tenant Analytics Dashboard (admin-web)

**Modified file: `apps/admin-web/src/pages/AnalyticsPage.tsx`**

- Add usage metrics section: current students vs. quota, teachers vs. quota
- Show subscription utilization progress bars
- Monthly exam count vs. limit
- AI calls this month (from existing llmCallLogs)

---

### Phase F: Data Isolation Audit & Hardening

**Goal:** Verify and strengthen tenant data isolation across all callables.

#### F1: Centralized Tenant Context Assertion

**New file: `functions/identity/src/utils/tenant-context.ts`**

```typescript
export async function assertTenantContext(
  callerUid: string,
  tenantId: string
): Promise<{ tenant: Tenant; membership: UserMembership }>;
```

- Validates caller has active membership for the tenant
- Validates tenant status is 'active' or 'trial'
- Returns tenant + membership for downstream use
- Replaces scattered `assertTenantAdminOrSuperAdmin` + `getTenant` +
  `assertTenantAccessible` pattern

#### F2: Audit All Callables

Review and add `assertTenantContext` to all callables that accept `tenantId`:

- `saveClass`, `saveStudent`, `saveTeacher`, `saveParent`, `saveAcademicSession`
- `saveExam`, `saveSpace`, `saveStoryPoint`, `saveItem`
- `gradeQuestion`, `generateReport`
- `manageNotifications`, `getCostSummary`

#### F3: Cross-Tenant Access Logging

**New file: `functions/identity/src/utils/audit-log.ts`**

```typescript
export async function logTenantAction(
  tenantId: string,
  callerUid: string,
  action: string,
  details?: Record<string, unknown>
): Promise<void>;
```

- Writes to `/tenants/{tenantId}/auditLogs/{logId}`
- Records: action, callerUid, timestamp, details
- Integrated into all write callables

---

## Files Changed Summary

### New Files (14)

| File                                                             | Purpose                        |
| ---------------------------------------------------------------- | ------------------------------ |
| `functions/identity/src/utils/quota.ts`                          | Subscription quota enforcement |
| `functions/identity/src/utils/feature-gate.ts`                   | Feature flag enforcement       |
| `functions/identity/src/utils/tenant-context.ts`                 | Centralized tenant validation  |
| `functions/identity/src/utils/audit-log.ts`                      | Tenant action audit logging    |
| `functions/identity/src/callable/deactivate-tenant.ts`           | Tenant deactivation callable   |
| `functions/identity/src/callable/reactivate-tenant.ts`           | Tenant reactivation callable   |
| `functions/identity/src/callable/export-tenant-data.ts`          | Data export callable           |
| `apps/admin-web/src/pages/OnboardingWizardPage.tsx`              | Onboarding wizard page         |
| `apps/admin-web/src/pages/StaffPage.tsx`                         | Staff/permission management    |
| `apps/admin-web/src/components/onboarding/SchoolInfoStep.tsx`    | Onboarding step 1              |
| `apps/admin-web/src/components/onboarding/AcademicSetupStep.tsx` | Onboarding step 2              |
| `apps/admin-web/src/components/onboarding/FirstClassStep.tsx`    | Onboarding step 3              |
| `apps/admin-web/src/components/onboarding/InviteStaffStep.tsx`   | Onboarding step 4              |
| `packages/shared-hooks/src/ui/use-tenant-branding.ts`            | Tenant branding CSS hook       |

### Modified Files (18)

| File                                                      | Changes                                                                                          |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `packages/shared-types/src/identity/tenant.ts`            | Add TenantBranding, TenantUsage, extend TenantSubscription, onboarding field, deactivated status |
| `packages/shared-types/src/identity/membership.ts`        | Add staff role, StaffPermissions                                                                 |
| `packages/shared-types/src/callable-types.ts`             | Add SaveStaffRequest, ExportTenantDataRequest/Response, DeactivateTenantRequest                  |
| `packages/shared-types/src/schemas/callable-schemas.ts`   | Add Zod schemas for new request types                                                            |
| `packages/shared-stores/src/tenant-store.ts`              | Expose branding, usage from tenant                                                               |
| `functions/identity/src/callable/create-org-user.ts`      | Add quota check, support staff role                                                              |
| `functions/identity/src/callable/bulk-import-students.ts` | Add quota check with batch count                                                                 |
| `functions/identity/src/callable/save-tenant.ts`          | Accept branding field, onboarding status                                                         |
| `functions/identity/src/callable/save-teacher.ts`         | Refresh claims on permission update                                                              |
| `functions/identity/src/utils/claims.ts`                  | Include staffPermissions in claims                                                               |
| `functions/autograde/src/callable/save-exam.ts`           | Add quota check on create                                                                        |
| `functions/levelup/src/callable/save-space.ts`            | Add quota check on create                                                                        |
| `firestore.rules`                                         | Add isStaff(), staff access rules, auditLogs collection rules                                    |
| `apps/admin-web/src/App.tsx`                              | Add onboarding redirect, StaffPage route                                                         |
| `apps/admin-web/src/layouts/AppLayout.tsx`                | Add Staff nav item                                                                               |
| `apps/admin-web/src/pages/SettingsPage.tsx`               | Add Branding tab                                                                                 |
| `apps/admin-web/src/pages/AnalyticsPage.tsx`              | Add usage metrics vs. quota                                                                      |
| `apps/super-admin/src/pages/TenantDetailPage.tsx`         | Add data export section, onboarding status badge                                                 |

---

## Acceptance Criteria

1. `createOrgUser` rejects with `resource-exhausted` when student/teacher quota
   is exceeded
2. `bulkImportStudents` validates batch count against remaining quota before
   processing
3. Onboarding wizard guides new tenants through 4-step setup and marks
   completion
4. Admin portal can create `staff` role users with granular permissions
5. Teacher permissions can be edited from admin portal
6. Custom claims include staff permissions for Firestore rule enforcement
7. Tenant branding (colors, logo) can be configured and applies to tenant-scoped
   apps
8. SuperAdmin can deactivate/reactivate tenants with cascading membership
   suspension
9. Tenant data can be exported as JSON/CSV with signed download URLs
10. All write callables log actions to tenant auditLogs collection
11. No `any` types or unsafe casts in new/modified files
12. Both `admin-web` and `super-admin` build (`pnpm build`) with zero errors
13. Both apps type-check (`tsc --noEmit`) with zero errors

---

## Implementation Order

```
Phase A (Quota + Types)  →  Phase B (Onboarding)  →  Phase C (Staff Roles)
                                                          ↓
Phase F (Data Isolation)  ←  Phase E (Lifecycle)  ←  Phase D (Branding)
```

Phases A-C are the core business logic that enables revenue readiness. Phases
D-F are operational hardening that enables enterprise readiness.
