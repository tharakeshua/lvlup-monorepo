# V7: Admin Dashboards — Changelog

**Vertical:** V7 | **Cycle:** 1 | **Team:** Platform Engineer **Date:**
2026-03-07

---

## New Features

### LLM Usage Dashboard (`apps/super-admin/src/pages/LLMUsagePage.tsx`)

- **Platform-wide AI cost aggregation** across all tenants
- Monthly cost trend bar chart with day-by-day breakdown
- Cost breakdown by task type (grading, extraction, evaluation, tutoring) with
  progress bars
- Per-tenant usage table with budget/quota tracking
  - Color-coded budget utilization: green (<80%), amber (80-99%), red (100%+)
- Month navigation (previous/next) for historical cost data
- 4 KPI stat cards: Monthly Cost, Total API Calls, Input Tokens, Output Tokens
- Pagination on per-tenant breakdown table (25 per page)
- Added to sidebar navigation under "Platform" section
- Added route `/llm-usage` to router

---

## Improvements

### Phase B: V3 Error Handling Patterns Applied

**TenantsPage** — `apps/super-admin/src/pages/TenantsPage.tsx`

- Replaced direct `httpsCallable` with `callSaveTenant` from
  `@levelup/shared-services`
- Added `useApiError` hook for standardized error handling with Sonner toast
- Added `toast.success()` on successful tenant creation
- Replaced `(error as Error)?.message` casts with `error instanceof Error`
  pattern

**TenantDetailPage** — `apps/super-admin/src/pages/TenantDetailPage.tsx`

- Replaced direct `httpsCallable` calls for update/subscription with
  `callSaveTenant`
- Added `useApiError` hook for all mutation error handlers
- Replaced `(err: Error)` with `(err: unknown)` + `handleError()` pattern
- Fixed all `as Error` type casts in inline error alerts

**FeatureFlagsPage** — `apps/super-admin/src/pages/FeatureFlagsPage.tsx`

- Replaced `httpsCallable` with `callSaveTenant` for flag updates
- Added `useApiError` hook and `toast.success()` on save
- Removed bottom-page error alert (replaced by toast notifications)

**GlobalPresetsPage** — `apps/super-admin/src/pages/GlobalPresetsPage.tsx`

- Fixed `(error as Error)?.message` → `error instanceof Error` pattern

**DashboardPage** — `apps/super-admin/src/pages/DashboardPage.tsx`

- Fixed `(error as Error)?.message` → `error instanceof Error` pattern

**SettingsPage** — `apps/super-admin/src/pages/SettingsPage.tsx`

- Fixed `(error as Error)?.message` → `error instanceof Error` pattern

**SystemHealthPage** — `apps/super-admin/src/pages/SystemHealthPage.tsx`

- Removed unsafe `as Tenant & { settings?: ... }` intersection casts
- Removed unsafe `as Tenant & { status?: string }` cast
- Fixed `(err as { code?: string })` with proper type guard
- Fixed `(error as Error)?.message` → `error instanceof Error` pattern

### Phase C: Pagination Added

**New shared components created:**

- `apps/super-admin/src/hooks/usePagination.ts` — Generic pagination hook (25
  items/page default)
- `apps/super-admin/src/components/DataTablePagination.tsx` — Pagination
  controls with page size selector

**Pages updated with pagination:**

- **TenantsPage** — Paginated tenant table (25/page) with page size selector
- **UserAnalyticsPage** — Paginated tenant breakdown table (25/page)
- **FeatureFlagsPage** — Paginated tenant flag cards (25/page)
- **LLMUsagePage** — Paginated per-tenant usage table (25/page)

---

## Files Changed

### New Files (4)

- `apps/super-admin/src/pages/LLMUsagePage.tsx`
- `apps/super-admin/src/hooks/usePagination.ts`
- `apps/super-admin/src/components/DataTablePagination.tsx`
- `docs/evolution/v7-admin-dashboards/plan.md`

### Modified Files (9)

- `apps/super-admin/src/App.tsx` — Added LLMUsagePage route
- `apps/super-admin/src/layouts/AppLayout.tsx` — Added LLM Usage nav item
- `apps/super-admin/src/pages/TenantsPage.tsx` — Pagination, useApiError,
  callSaveTenant
- `apps/super-admin/src/pages/TenantDetailPage.tsx` — useApiError,
  callSaveTenant, type fixes
- `apps/super-admin/src/pages/FeatureFlagsPage.tsx` — Pagination, useApiError,
  callSaveTenant
- `apps/super-admin/src/pages/UserAnalyticsPage.tsx` — Pagination, type fixes
- `apps/super-admin/src/pages/SystemHealthPage.tsx` — Type safety fixes
- `apps/super-admin/src/pages/DashboardPage.tsx` — Type safety fix
- `apps/super-admin/src/pages/SettingsPage.tsx` — Type safety fix
- `apps/super-admin/src/pages/GlobalPresetsPage.tsx` — Type safety fix

---

## Verification

- `tsc --noEmit` passes with 0 errors (super-admin)
- `tsc --noEmit` passes with 0 errors (admin-web)
- `vite build` passes successfully (super-admin)
- No new `any` types introduced
- No `as Error` casts remain in modified files
- All mutations use `callSaveTenant` from shared services
- All mutations provide toast feedback (success + error)
