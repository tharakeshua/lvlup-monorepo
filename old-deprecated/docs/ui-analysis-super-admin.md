# Super Admin App — UI/UX Analysis Report

**Date:** 2026-03-07 **Scope:** `apps/super-admin/` full codebase +
`packages/shared-ui/` layout components **Analyst:** Frontend Apps Engineer

---

## Executive Summary

The super-admin app is **well-architected overall** with solid patterns:
shared-ui component library usage, proper dialog state management, good
responsive design foundations, comprehensive loading/error/empty states, and
clean code organization. The codebase follows consistent conventions and is
production-quality.

Below are issues organized by severity. Most are **Minor** polish items; no
show-stopping bugs were found.

---

## 1. NAVIGATION

### Status: GOOD — Pattern is correctly implemented

**Desktop:** Left sidebar via `AppSidebar` → `SidebarProvider`
(collapsible="icon"), always visible on `md+`. **Mobile:** Bottom navbar via
`MobileBottomNav` (`fixed bottom-0`, `md:hidden`, `z-50`), plus Sheet-based
sidebar accessible via hamburger.

| #   | Severity | Issue                                                                                                                                                                               | File:Line                          | Recommendation                                                                                                                                                                                        |
| --- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| N1  | Minor    | Mobile bottom nav only shows 4 of 9 pages (Home, Tenants, Health, Settings). Missing: Analytics, Feature Flags, Presets, LLM Usage. Users must open the sidebar sheet for these.    | `AppLayout.tsx:117-122`            | Consider adding a "More" tab that opens a bottom sheet with remaining nav items, or reorganize to show the 4 most-used items. Current approach is acceptable but may frustrate power users on mobile. |
| N2  | Minor    | Sidebar nav has 9 items across 3 groups but mobile bottom nav has only 4 items — the information architecture mismatch means mobile users have a different mental model of the app. | `AppLayout.tsx:31-95` vs `117-122` | Document this as intentional or add a "More" overflow menu.                                                                                                                                           |
| N3  | Minor    | No visual indicator on MobileBottomNav for which section the user is currently in when on a page not in the bottom nav (e.g., `/analytics`). No tab will be highlighted.            | `AppLayout.tsx:117-122`            | The `isActive` checks don't cover all routes, so visiting `/analytics` shows no active tab. Consider making "Home" active as fallback, or expand bottom nav.                                          |

---

## 2. DIALOGS & MODALS

### Status: GOOD — All dialogs use controlled `open`/`onOpenChange` pattern correctly

Every dialog in the app uses the Radix-based `Dialog`/`AlertDialog` from
shared-ui with explicit `open` state and `onOpenChange` handlers. No
`DialogTrigger` is used — all dialogs are opened via `useState` + button
`onClick`, which is the correct pattern for programmatic control.

| #   | Severity | Issue                                                                                                                                                                                                               | File:Line                            | Recommendation                                                                                                                                                                                                                             |
| --- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------- | ---------------------------------------------------------------------------------------- | ------ | -------------------- |
| D1  | Minor    | `EditTenantDialog` missing `DialogDescription` for accessibility. Radix logs a console warning when DialogDescription is absent.                                                                                    | `EditTenantDialog.tsx:92-94`         | Add `<DialogDescription className="sr-only">Edit tenant details</DialogDescription>` inside `DialogHeader`.                                                                                                                                |
| D2  | Minor    | `TenantSubscriptionCard` dialog missing `DialogDescription`. Same a11y issue.                                                                                                                                       | `TenantSubscriptionCard.tsx:144-146` | Add screen-reader-only `DialogDescription`.                                                                                                                                                                                                |
| D3  | Minor    | `GlobalPresetsPage` create/edit dialog uses a shared `dialogOpen` boolean derived from `createOpen                                                                                                                  |                                      | editOpen`. If both were somehow set to `true`, the behavior would be undefined.                                                                                                                                                            | `GlobalPresetsPage.tsx:277` | Low risk since UI only allows one at a time, but consider using a single `mode: 'create' | 'edit' | null` state instead. |
| D4  | Minor    | `GlobalPresetsPage` delete alert dialog uses `AlertDialogAction` which auto-closes on click. But the `handleDelete` is async — if it fails, the dialog has already closed and the user won't see the error.         | `GlobalPresetsPage.tsx:618-619`      | Use a `Button` with `variant="destructive"` instead of `AlertDialogAction` to prevent auto-close, similar to how `DeleteTenantDialog.tsx:70` handles it correctly.                                                                         |
| D5  | Minor    | `EditTenantSchema` allows `status: "deactivated"` in the type but the `SelectContent` only shows 4 options (active, trial, suspended, expired) — missing "deactivated".                                             | `EditTenantDialog.tsx:39,117-122`    | Either add `deactivated` to the select or remove it from the schema. Since deactivation has its own lifecycle card, omitting it from the edit dialog is reasonable — just ensure the schema matches: remove `"deactivated"` from the enum. |
| D6  | Minor    | `SettingsPage` maintenance mode AlertDialog uses `AlertDialogAction` with an inline `onClick` that calls `setMaintenanceConfirmOpen(false)`. This is redundant since `AlertDialogAction` auto-closes, but harmless. | `SettingsPage.tsx:359`               | Remove the explicit `setMaintenanceConfirmOpen(false)` from the onClick handler since AlertDialogAction handles closing.                                                                                                                   |

### Dialogs Verified Working (No Issues Found):

- `TenantsPage` Create Tenant dialog — `createOpen` state, button onClick,
  proper onOpenChange ✓
- `TenantDetailPage` Edit + Delete dialogs — `editOpen`/`deleteOpen` state ✓
- `DeleteTenantDialog` — AlertDialog with confirmation text input ✓
- `TenantLifecycleCard` — Deactivate confirmation AlertDialog ✓

---

## 3. LAYOUT

### Status: GOOD — AppShell + AuthLayout pattern is solid

| #   | Severity | Issue                                                                                                                                                                                                                                                                  | File:Line                                    | Recommendation                                                                                                                                                                                           |
| --- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L1  | Minor    | `AppBreadcrumb` renders at the page content level (`<div id="main-content">`) which means it's visible on mobile. However, `AppShell` also renders its own breadcrumb area that is `md+` only. This may cause double breadcrumbs on desktop or inconsistent placement. | `AppLayout.tsx:130` + `AppBreadcrumb.tsx:22` | Verify that AppShell's built-in breadcrumb area doesn't conflict. The current setup renders AppBreadcrumb inside the main content area, which is fine as long as AppShell doesn't also show breadcrumbs. |
| L2  | Minor    | `RequireAuth` loading state uses a bare `<div>` with no layout wrapper. If auth check is slow, users see "Loading..." without any branding or structure.                                                                                                               | `RequireAuth.tsx:29-33`                      | Consider using `PageLoader` from shared-ui (already imported in App.tsx Suspense) for consistency.                                                                                                       |
| L3  | Minor    | `RequireAuth` "Access Denied" state has no back/logout option. Users are stuck on a blank page with no way to sign out or navigate.                                                                                                                                    | `RequireAuth.tsx:43-52`                      | Add a "Sign Out" button or "Go to Login" link to the access denied screen.                                                                                                                               |
| L4  | Minor    | `AuthLayout` branding panel uses `lg:flex lg:w-1/2` while `AppShell` uses `md` as the desktop breakpoint. Different breakpoints for auth vs app layouts is intentional (auth needs more space for split panel) but worth documenting.                                  | `AuthLayout.tsx:8`                           | No change needed — the lg breakpoint makes sense for the split panel auth layout.                                                                                                                        |

---

## 4. COMPONENTS

### Status: GOOD — Consistent use of shared-ui, proper patterns

| #   | Severity | Issue                                                                                                                                                                                    | File:Line                       | Recommendation                                                                                                                                                                                                             |
| --- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | Minor    | `TenantsPage` table "View" button uses `opacity-0 group-hover:opacity-100` which makes it invisible on touch devices (no hover). Mobile/tablet users can't see or tap the action button. | `TenantsPage.tsx:258`           | Either always show the button (remove opacity trick) or add `focus-within:opacity-100` on the row. Better: make the entire row clickable on mobile via a `Link` wrapper.                                                   |
| C2  | Minor    | `DataTablePagination` pagination buttons use `h-8 w-8` (32x32px) which is below the 44x44px minimum touch target used elsewhere in the app.                                              | `DataTablePagination.tsx:46-59` | Increase to `h-9 w-9` or use `min-h-[44px] min-w-[44px]` for touch accessibility. The internal icon can remain small.                                                                                                      |
| C3  | Minor    | `SortableTableHead` sort button has no minimum touch target. The clickable area is only as large as the text + icon.                                                                     | `SortableTableHead.tsx:17-29`   | Add `min-h-[44px]` and `px-2` padding to the button for better tap targets.                                                                                                                                                |
| C4  | Minor    | `TenantDataExportCard` collection toggle buttons use `h-7 text-xs` which are small touch targets (28px height).                                                                          | `TenantDataExportCard.tsx:71`   | Consider `h-8` minimum for touch-friendly sizing.                                                                                                                                                                          |
| C5  | Minor    | `UserAnalyticsPage` Progress bar color uses dynamic Tailwind class `[&>div]:${colorClass}` which will NOT work with Tailwind's JIT compilation — the class is generated at runtime.      | `UserAnalyticsPage.tsx:238`     | Use a style prop instead: `style={{ '--progress-color': colorClass }}` with a CSS variable, or define all possible classes statically so Tailwind can detect them.                                                         |
| C6  | Minor    | `DashboardPage` Recharts Tooltip uses default styling which doesn't respect the app's dark theme. The tooltip background/text colors will look jarring in dark mode.                     | `DashboardPage.tsx:236-238`     | Add `contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}` and `labelStyle`/`itemStyle` with proper theme colors. Same issue on `LLMUsagePage.tsx:316-319`. |

---

## 5. STYLING & TAILWIND CONSISTENCY

### Status: GOOD — Very consistent use of Tailwind and design tokens

| #   | Severity | Issue                                                                                                                                                                                                                                        | File:Line                      | Recommendation                                                                                                              |
| --- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| S1  | Minor    | Mixed spacing patterns for page sections: most pages use `space-y-6` but some card content uses `space-y-4`, `space-y-3`, or `space-y-5` inconsistently.                                                                                     | Various                        | This is acceptable variance for different content densities. No action needed.                                              |
| S2  | Minor    | `DashboardPage` stat card loading skeletons use `pb-4 pt-4 px-4` instead of the shorthand `p-4`.                                                                                                                                             | `DashboardPage.tsx:170`        | Use `p-4` for consistency and brevity.                                                                                      |
| S3  | Minor    | `FeatureFlagsPage` flag toggle buttons don't have `focus-visible` ring styling. Keyboard users can't see which flag is focused.                                                                                                              | `FeatureFlagsPage.tsx:299-322` | Add `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` to the button className.                     |
| S4  | Minor    | `GlobalPresetsPage` dimension checkboxes use `<label>` elements that are siblings of the FormField `<Checkbox>`, but the `<label>` doesn't have a `htmlFor` matching the checkbox `id`. Clicking the label text doesn't toggle the checkbox. | `GlobalPresetsPage.tsx:552`    | Use `FormLabel` wrapping the text or add proper `htmlFor`/`id` pairing.                                                     |
| S5  | Minor    | `LoginPage` card uses `border-0 shadow-lg lg:border` which removes the border on mobile but keeps the shadow. This creates a floating card with no edge definition on smaller screens.                                                       | `LoginPage.tsx:41`             | Consider `border-0 shadow-none lg:border lg:shadow-lg` for mobile (flat, edge-to-edge) and bordered with shadow on desktop. |
| S6  | Minor    | Dark mode: `TenantDetailPage` features grid uses hard-coded `border-emerald-200` and `bg-emerald-50/50` without dark mode variants for the enabled state border.                                                                             | `TenantDetailPage.tsx:185-188` | Already has `dark:border-emerald-800/50 dark:bg-emerald-950/30` ✓ — no issue. (False positive on initial scan.)             |

---

## 6. ACCESSIBILITY

| #   | Severity | Issue                                                                                                                                                                                                                                  | File:Line                      | Recommendation                                                                       |
| --- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------ |
| A1  | Major    | `SkipToContent` targets `#main-content` but the `<div id="main-content">` is inside `AppShell`, which means the skip link jumps past the sidebar but also past the header. This is correct behavior. ✓                                 | `AppLayout.tsx:129`            | No issue — correctly implemented.                                                    |
| A2  | Minor    | Missing `DialogDescription` on 2 dialogs (see D1, D2 above). Radix UI logs console warnings and screen readers miss context.                                                                                                           | See D1, D2                     | Add sr-only DialogDescription to EditTenantDialog and TenantSubscriptionCard dialog. |
| A3  | Minor    | `RequireAuth` loading state has no `aria-live` or `role="status"` for screen readers.                                                                                                                                                  | `RequireAuth.tsx:29-33`        | Add `role="status" aria-label="Checking authentication"` to the loading container.   |
| A4  | Minor    | `SystemHealthPage` service status badges use color alone to convey status (green/amber/red). While they include text labels ("Operational", "Degraded", "Down"), the dot indicator `h-1.5 w-1.5 rounded-full` conveys color-only info. | `SystemHealthPage.tsx:270-272` | The text labels next to the dots are sufficient for accessibility. No change needed. |
| A5  | Minor    | `FeatureFlagsPage` toggle buttons use visual toggle icons (ToggleLeft/ToggleRight) but no `aria-pressed` or `aria-checked` attribute to convey state to screen readers.                                                                | `FeatureFlagsPage.tsx:299-322` | Add `aria-pressed={isEnabled}` to the `<button>` element.                            |

---

## 7. STATE MANAGEMENT & DATA FLOW

| #   | Severity | Issue                                                                                                                                                                                                                                                   | File:Line                       | Recommendation                                                                                                                                        |
| --- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| SM1 | Minor    | `DashboardPage` fetches all tenants from Firestore on every page load with `staleTime: 60s`. The `TenantsPage` also fetches all tenants with the same query key. Good — they share cache. ✓                                                             | Various                         | No issue — TanStack Query deduplication works correctly.                                                                                              |
| SM2 | Minor    | `FeatureFlagsPage` uses a separate query key `["platform", "tenantFlags"]` from `TenantsPage`'s `["platform", "tenants"]`, even though both fetch the same `tenants` collection. This means two separate Firestore reads for essentially the same data. | `FeatureFlagsPage.tsx:50`       | Consider reusing the `["platform", "tenants"]` query and transforming the data at the component level, or accept the duplication for simpler code.    |
| SM3 | Minor    | `GlobalPresetsPage` shares a single `useForm` instance between create and edit modes. When switching between modes, the form resets correctly via `form.reset()`. However, form validation errors from a previous mode could theoretically persist.     | `GlobalPresetsPage.tsx:215-218` | The `form.reset()` calls in `openCreate`/`openEdit` clear errors. This is fine.                                                                       |
| SM4 | Minor    | `SettingsPage` uses `useEffect` to sync server config into local state, creating a "controlled copy" pattern. This means stale config could be shown briefly if the query refetches in the background while the user has unsaved changes.               | `SettingsPage.tsx:86-93`        | The `isDirty` flag prevents overwriting user changes. This pattern is acceptable. Consider adding a "You have unsaved changes" warning on navigation. |

---

## 8. PERFORMANCE

| #   | Severity | Issue                                                                                                                                                                           | File:Line                    | Recommendation                                                                                                                      |
| --- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| P1  | Minor    | `LLMUsagePage` runs `Promise.all` over ALL tenants to fetch daily cost summaries. With many tenants (100+), this creates a burst of Firestore reads that could hit rate limits. | `LLMUsagePage.tsx:81-96`     | Consider batching (e.g., 10 at a time) or using a Cloud Function aggregate endpoint.                                                |
| P2  | Minor    | Recharts is imported at the top level in `DashboardPage` and `LLMUsagePage`. These are already lazy-loaded pages, so this is acceptable. But recharts is ~200KB.                | `DashboardPage.tsx:11-21`    | Consider lazy-loading recharts itself with `React.lazy` if bundle size becomes an issue. Current approach is fine for an admin app. |
| P3  | Minor    | `SystemHealthPage` probes Cloud Functions by calling `saveTenant({})` with empty data, which may create an unnecessary error log on the server.                                 | `SystemHealthPage.tsx:67-68` | Create a dedicated `healthCheck` Cloud Function, or use a known read-only function for probing.                                     |

---

## Summary of Issues by Severity

| Severity | Count | Key Areas                                                                         |
| -------- | ----- | --------------------------------------------------------------------------------- |
| Critical | 0     | —                                                                                 |
| Major    | 0     | —                                                                                 |
| Minor    | ~25   | Touch targets, a11y descriptions, mobile nav gaps, Tailwind JIT, Recharts theming |

### Top 5 Recommended Fixes (Highest Impact):

1. **C1 — Table row action visibility on touch** (`TenantsPage.tsx:258`): Remove
   hover-only opacity on "View" button so it's always visible, or make rows
   tappable.
2. **C5 — Broken dynamic Tailwind class** (`UserAnalyticsPage.tsx:238`): The
   `[&>div]:${colorClass}` pattern won't work with Tailwind JIT. Use inline
   styles or static class mapping.
3. **D1/D2 — Missing DialogDescription** (`EditTenantDialog.tsx`,
   `TenantSubscriptionCard.tsx`): Add sr-only descriptions to silence Radix
   warnings and improve screen reader UX.
4. **L3 — Access Denied has no escape** (`RequireAuth.tsx:43-52`): Add a Sign
   Out button so users aren't stuck.
5. **A5 — Feature flag toggles missing aria-pressed**
   (`FeatureFlagsPage.tsx:299-322`): Add `aria-pressed` for screen reader
   support.

---

## Architecture Quality Assessment

| Category           | Rating    | Notes                                                          |
| ------------------ | --------- | -------------------------------------------------------------- |
| Navigation Pattern | Excellent | Desktop sidebar + mobile bottom nav + sheet fallback           |
| Dialog Management  | Excellent | Controlled state, proper open/close, no z-index conflicts      |
| Responsive Design  | Very Good | Consistent md breakpoint, safe area support, mobile padding    |
| Component Reuse    | Excellent | Heavy use of shared-ui library, consistent patterns            |
| Loading States     | Excellent | Skeleton-based loading for every page, error states with retry |
| Empty States       | Excellent | Meaningful empty states with icons and CTAs on every page      |
| Dark Mode          | Very Good | Consistent use of CSS variables, explicit dark mode variants   |
| Accessibility      | Good      | SkipToContent, RouteAnnouncer, aria labels — minor gaps noted  |
| Code Organization  | Excellent | Clean separation: pages, components, hooks, guards, layouts    |
| State Management   | Very Good | TanStack Query for server state, local state for UI            |
