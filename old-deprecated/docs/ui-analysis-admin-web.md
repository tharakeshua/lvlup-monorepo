# Admin-Web UI/UX Analysis Report

**Date:** 2026-03-07 **Scope:** `apps/admin-web/` — full UI/UX audit
**Analyzed:** 14 pages, 2 layouts, 8 components, shared-ui library integration

---

## Executive Summary

The admin-web app is well-structured with a proper sidebar + bottom-nav pattern,
good use of shared-ui components, and consistent Tailwind styling. Dialogs use
the correct Radix UI Dialog pattern with controlled `open` state — they will
open correctly. The main issues found are mostly **Minor** quality-of-life
improvements, with a few **Major** items around mobile responsiveness and
accessibility gaps.

**Severity counts:** Critical: 0 | Major: 5 | Minor: 12

---

## 1. NAVIGATION

### 1.1 Desktop Sidebar ✅ CORRECT

- **Implementation:** `AppLayout.tsx:230-238` uses `<AppSidebar>` which renders
  the shared `<Sidebar collapsible="icon">` from
  `packages/shared-ui/src/components/layout/AppSidebar.tsx:75`.
- **Behavior:** On desktop (≥768px), sidebar renders as a fixed left panel with
  expand/collapse via `SidebarTrigger`. Cookie persistence via `sidebar:state`
  cookie.
- **Nav groups:** 4 groups (Overview, Management, Analytics, Configuration) with
  13 items total — well organized.
- **Active state:** Each nav item correctly computes `isActive` based on
  `location.pathname` (`AppLayout.tsx:76-160`).

### 1.2 Mobile Bottom Navbar ✅ CORRECT

- **Implementation:** `AppLayout.tsx:269-275` defines `mobileNavItems` (5 items:
  Home, Users, Classes, Analytics, Settings) and renders `<MobileBottomNav>` at
  `AppLayout.tsx:291`.
- **Visibility:** `MobileBottomNav` uses `md:hidden` (hidden ≥768px), so it only
  shows on mobile — correct.
- **Bottom padding:** `AppShell` adds `pb-20 md:pb-6` when `hasBottomNav=true`
  (`AppShell.tsx:69`) — prevents content being hidden under navbar.

### 1.3 Mobile Sidebar Sheet ✅ CORRECT

- **Auto-close:** `SidebarMobileAutoClose` component (`AppSidebar.tsx:161-177`)
  closes the mobile sidebar sheet on pathname change.
- **Trigger:** `SidebarTrigger` on mobile opens the sheet overlay (managed by
  shadcn/ui Sidebar primitives using Sheet component).

#### Issues Found:

| Severity  | Issue                                                                                                                                                                                                                        | File:Line               | Fix                                                                                                                                                                                                                     |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Minor** | Mobile bottom nav only has 5 items, but there are 13 nav items total. Users can't reach Exams, Spaces, Courses, Reports, AI Usage, Academic Sessions, Staff from mobile bottom nav — they must use the mobile sidebar sheet. | `AppLayout.tsx:269-275` | Consider adding a "More" item to the bottom nav that opens the sidebar, or restructuring to include most-used items. Currently the sidebar trigger in the header does provide access, but it's not immediately obvious. |
| **Minor** | `SidebarTrigger` touch target is `min-h-[44px] min-w-[44px]` — meets WCAG minimum. Good.                                                                                                                                     | `AppShell.tsx:52`       | No fix needed.                                                                                                                                                                                                          |

---

## 2. DIALOGS & MODALS

### 2.1 Dialog Pattern Analysis

All dialogs use the **controlled pattern** correctly:

```tsx
<Dialog open={stateVar} onOpenChange={setStateVar}>
  <DialogContent>...</DialogContent>
</Dialog>
```

This pattern (without `DialogTrigger`) renders the dialog via Radix Portal when
`open=true`. The `onClick` handlers on buttons correctly set state to `true` to
open dialogs.

### 2.2 Dialog Inventory

| Page                    | Dialog                      | Trigger                                          | Open State           | Status                                                          |
| ----------------------- | --------------------------- | ------------------------------------------------ | -------------------- | --------------------------------------------------------------- |
| **ClassesPage**         | Create Class                | Button `onClick` → `setCreateOpen(true)`         | `createOpen`         | ✅ Correct                                                      |
| **ClassesPage**         | Edit Class                  | `openEdit(cls)` → `setEditOpen(true)`            | `editOpen`           | ✅ Correct                                                      |
| **ClassesPage**         | Archive Class (AlertDialog) | `openArchive(cls)` → `setArchiveOpen(true)`      | `archiveOpen`        | ✅ Correct                                                      |
| **ClassesPage**         | Assign Teachers             | `openAssignTeachers(cls)`                        | `assignTeachersOpen` | ✅ Correct                                                      |
| **ClassesPage**         | Assign Students             | `openAssignStudents(cls)`                        | `assignStudentsOpen` | ✅ Correct                                                      |
| **UsersPage**           | Create User                 | `openCreateForTab()` → `setCreateOpen(true)`     | `createOpen`         | ✅ Correct                                                      |
| **UsersPage**           | Assign Class                | `openAssignClass()` → `setAssignClassOpen(true)` | `assignClassOpen`    | ✅ Correct                                                      |
| **UsersPage**           | Link Parent                 | `openLinkParent()` → `setLinkParentOpen(true)`   | `linkParentOpen`     | ✅ Correct                                                      |
| **UsersPage**           | Edit Parent                 | `openEditParent(p)` → `setEditParentOpen(true)`  | `editParentOpen`     | ✅ Correct                                                      |
| **UsersPage**           | Bulk Import                 | Button `onClick` → `setBulkImportOpen(true)`     | `bulkImportOpen`     | ✅ Correct                                                      |
| **StaffPage**           | Permission Editor           | `openPermissionEditor(teacher)`                  | `!!editingTeacher`   | ✅ Correct                                                      |
| **AcademicSessionPage** | Create Session              | Button `onClick`                                 | `createOpen`         | ✅ Correct                                                      |
| **AcademicSessionPage** | Edit Session                | `openEdit(session)`                              | `editOpen`           | ✅ Correct                                                      |
| **SettingsPage**        | API Key (inline)            | Button `onClick` → `setApiKeyDialogOpen(true)`   | `apiKeyDialogOpen`   | ✅ Correct (note: this is an inline expand, not a modal dialog) |

### 2.3 z-index Analysis

- Dialog overlay: `z-50` (`dialog.tsx:22`)
- Dialog content: `z-50` (`dialog.tsx:38-39`)
- Mobile bottom nav: `z-50` (`MobileBottomNav.tsx:54`)
- Sidebar sheet (mobile): Uses Sheet component which also uses `z-50`

#### Issues Found:

| Severity  | Issue                                                                                                                                                                                                                                                                                                                                                                                     | File:Line                                            | Fix                                                                                                                                                                                                |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Major** | z-index conflict: `MobileBottomNav` uses `z-50`, same as Dialog overlay. When a dialog opens on mobile, the bottom nav bar may visually bleed through or interfere with the dialog overlay. The Radix portal renders dialogs at the end of `<body>`, so in practice the DOM order may save us, but this is fragile.                                                                       | `MobileBottomNav.tsx:54`, `dialog.tsx:22`            | Either use `z-40` on MobileBottomNav or ensure Dialog overlay uses a higher z-index like `z-[60]`. Alternatively, hide the bottom nav when a dialog is open.                                       |
| **Major** | EntityPicker inside dialogs: The EntityPicker uses a `Popover` (which also uses z-50). When EntityPicker is placed inside a Dialog (e.g., ClassesPage Assign Teachers/Students), the Popover dropdown may render behind the dialog or have layering issues since both are z-50. Radix handles stacking contexts via portals, but on some browsers/devices this can cause visual glitches. | `EntityPicker.tsx:71-141`, `ClassesPage.tsx:517-524` | Test EntityPicker inside dialogs on mobile. If issues arise, consider using a CommandDialog (full-screen command palette) instead of Popover inside Dialog, or add `modal={false}` to the Popover. |
| **Minor** | StaffPage Permission Editor dialog footer uses manual `<div className="flex justify-end gap-2">` instead of `<DialogFooter>` like all other dialogs. This creates inconsistent footer alignment (won't stack vertically on mobile).                                                                                                                                                       | `StaffPage.tsx:260-267`                              | Replace with `<DialogFooter>` component for consistent responsive behavior.                                                                                                                        |

---

## 3. LAYOUT

### 3.1 AppLayout (`AppLayout.tsx`)

**Structure:** ✅ Well-architected

```
<SkipToContent />
<AppShell sidebar={sidebar} headerRight={headerRight} hasBottomNav>
  <RouteAnnouncer />
  <AppBreadcrumb />
  <main id="main-content">
    <Suspense>
      <PageTransition>
        <Outlet />
      </PageTransition>
    </Suspense>
  </main>
</AppShell>
<MobileBottomNav />
<SWUpdateNotification />
```

- Skip-to-content link for accessibility ✅
- Route announcer for screen readers ✅
- Breadcrumb navigation ✅
- Suspense fallback with skeletons ✅
- Page transitions via Framer Motion ✅
- PWA service worker update notification ✅

### 3.2 AuthLayout (`AuthLayout.tsx`)

**Structure:** Simple centered layout — ✅ Correct

```
<div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
  <div className="w-full max-w-md">
    <Outlet />
  </div>
</div>
```

### 3.3 AppShell (`AppShell.tsx`)

**Structure:** ✅ Uses SidebarProvider + SidebarInset pattern

- Header: `h-14`, border-bottom, with SidebarTrigger + headerRight slot
- Main: Responsive padding `p-3 sm:p-4 md:p-6`, conditional bottom padding for
  mobile nav
- Safe area insets for notched devices ✅

#### Issues Found:

| Severity  | Issue                                                                                                                                                                                                                                                                                                              | File:Line            | Fix                                                                |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------- | ------------------------------------------------------------------ |
| **Minor** | `AppShell.tsx:53` — the separator between SidebarTrigger and breadcrumb uses `hidden sm:block`, so at `sm` breakpoint (640px-768px) both the separator and the mobile bottom nav may be visible simultaneously since bottom nav hides at `md` (768px). Not a real bug, but slightly inconsistent breakpoint usage. | `AppShell.tsx:53`    | Could change to `hidden md:block` for consistency, but low impact. |
| **Minor** | `readSidebarCookie()` in AppShell.tsx uses regex to read cookie but doesn't URL-decode the value. This is fine since the value is just "true"/"false", but worth noting.                                                                                                                                           | `AppShell.tsx:22-27` | No fix needed.                                                     |

---

## 4. COMPONENTS

### 4.1 Shared UI Usage ✅ GOOD

All pages consistently use components from `@levelup/shared-ui`:

- `Button`, `Input`, `Label`, `Select`, `Badge`, `Switch` — form controls
- `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow` —
  data tables
- `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`,
  `DialogFooter` — modals
- `Card`, `CardContent`, `CardDescription`, `CardHeader`, `CardTitle` — cards
- `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` — tabbed navigation
- `ScoreCard`, `SimpleBarChart`, `ProgressRing` — data visualization
- `EntityPicker`, `BulkImportDialog`, `DownloadPDFButton` — domain-specific
  components
- `PageLoader`, `Skeleton`, `PageTransition` — loading states

### 4.2 DataTablePagination (`DataTablePagination.tsx`)

Custom component with page-size selector and navigation buttons. ✅
Well-implemented with clear "Showing X-Y of Z" text.

### 4.3 SortableTableHead (`SortableTableHead.tsx`)

Sort indicators using lucide icons (ArrowUpDown, ArrowUp, ArrowDown). ✅
Accessible with `aria-label`.

### 4.4 User Tab Components (TeachersTab, StudentsTab, ParentsTab)

All follow the same pattern: table with skeleton loading, empty state,
pagination. ✅ Consistent.

#### Issues Found:

| Severity  | Issue                                                                                                                                                                                                                                                                                                       | File:Line                       | Fix                                                                                                                                                                               |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Major** | TeachersTab: The "Actions" column edit button (`Pencil` icon) at `TeachersTab.tsx:70` triggers `onAssignClass` — same action as clicking the class count. There's no actual "edit teacher" action. The Pencil icon misleadingly suggests editing the teacher profile, but it opens the assign-class dialog. | `TeachersTab.tsx:70-72`         | Either (a) rename the icon/action to something clearer like a "folder" icon with "Assign" tooltip, or (b) add a proper edit teacher dialog with name/subjects/designation fields. |
| **Minor** | StudentsTab: The "Actions" column edit button (`Pencil` icon) at `StudentsTab.tsx:77` also triggers `onAssignClass` — same issue as TeachersTab. Pencil icon implies editing student, but opens class assignment.                                                                                           | `StudentsTab.tsx:77-79`         | Same as above — clarify the action or add a proper edit student dialog.                                                                                                           |
| **Minor** | ParentsTab: Shows "Linked Children" but displays `rollNumber` or truncated ID. If rollNumber is empty and student has no display name, shows cryptic 8-char ID hash — not user-friendly.                                                                                                                    | `ParentsTab.tsx:55-62`          | Show student's full name (firstName + lastName) as primary display, falling back to rollNumber.                                                                                   |
| **Minor** | DataTablePagination: No keyboard focus management — the page size Select and navigation buttons don't have visible focus rings on keyboard navigation beyond default browser styles. The shared-ui components likely handle this, but worth verifying.                                                      | `DataTablePagination.tsx:18-53` | Verify focus-visible styles are applied to the pagination controls.                                                                                                               |

---

## 5. STYLING

### 5.1 Tailwind CSS Usage ✅ CONSISTENT

- All pages use the standard pattern: `<div className="space-y-6">` for
  page-level spacing
- Page headers consistently use `<h1 className="text-2xl font-bold">` +
  `<p className="text-sm text-muted-foreground">`
- Cards and borders use theme-aware classes (`bg-card`, `border`, `bg-muted`,
  `text-muted-foreground`)
- Dark mode: All colors use CSS variables from the design system, not hardcoded
  colors ✅

### 5.2 Responsive Design

- Dashboard grid: `grid-cols-2 md:grid-cols-3 lg:grid-cols-6` — collapses
  gracefully ✅
- Search + filter bars: `flex flex-col gap-4 md:flex-row md:items-center`
  pattern used in ExamsOverviewPage, SpacesOverviewPage ✅
- Tables: wrapped in `overflow-x-auto` for horizontal scrolling on small screens
  ✅
- Dialogs: `DialogFooter` uses `flex-col-reverse sm:flex-row` for mobile
  stacking ✅
- OnboardingWizard: Step labels hidden on mobile via `hidden sm:inline` ✅

#### Issues Found:

| Severity  | Issue                                                                                                                                                                                                                                                                                           | File:Line                     | Fix                                                                                                                                          |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Major** | ClassesPage: The search + filter bar uses `flex gap-3` without any responsive wrapping. On narrow screens (<640px), the search input and grade filter Select will be cramped side-by-side. Other pages (ExamsOverviewPage, SpacesOverviewPage) correctly use `flex flex-col gap-4 md:flex-row`. | `ClassesPage.tsx:277`         | Change to `flex flex-col gap-3 md:flex-row md:items-center` to stack on mobile.                                                              |
| **Major** | UsersPage: Tab header buttons ("Bulk Import", "Add Teacher") are in a flex row that doesn't wrap on mobile. On small screens, the header `<div className="flex items-center justify-between">` with two button groups may overflow or squeeze text.                                             | `UsersPage.tsx:246-262`       | Add `flex-wrap gap-2` or restructure to stack title/buttons on mobile: `flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`. |
| **Minor** | ExamsOverviewPage: Status filter buttons (`statuses.map`) render 6 buttons horizontally. On mobile they may overflow without scrolling.                                                                                                                                                         | `ExamsOverviewPage.tsx:71-83` | Wrap in `overflow-x-auto` or use a Select dropdown on mobile instead of buttons.                                                             |
| **Minor** | SettingsPage: `TabsList` with `grid-cols-4` on all screen sizes. On mobile, 4 tabs ("Tenant Settings", "Evaluation", "Branding", "API Keys") with long labels will be very cramped.                                                                                                             | `SettingsPage.tsx:263`        | Consider `grid-cols-2 sm:grid-cols-4` for the TabsList, or use shorter labels on mobile.                                                     |

---

## 6. ACCESSIBILITY

### 6.1 Good Practices Found ✅

- `SkipToContent` link for keyboard users (`AppLayout.tsx:279`)
- `RouteAnnouncer` for screen reader route change announcements
  (`AppLayout.tsx:281`)
- `aria-label` on theme toggle button (`AppLayout.tsx:246`)
- `aria-label` on SortableTableHead sort buttons (`SortableTableHead.tsx:20`)
- `role="alert"` on login error messages (`LoginPage.tsx:77, 121`)
- `aria-describedby` linking inputs to error messages
  (`LoginPage.tsx:94, 138, 154`)
- `role="img"` + `aria-label` on chart containers (DashboardPage, AnalyticsPage,
  AIUsagePage)
- Password show/hide with `aria-label` (`LoginPage.tsx:162`)
- Safe area insets for notched devices (`AppShell.tsx:50`,
  `MobileBottomNav.tsx:55`)
- Minimum 44x44 touch targets on mobile nav items (`MobileBottomNav.tsx:34`)

### 6.2 Issues Found

| Severity  | Issue                                                                                                                                        | File:Line                          | Fix                                                                         |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------- |
| **Minor** | ClassesPage: The teacher count and student count cells use plain `<button>` without `aria-label`. Screen readers would just read the number. | `ClassesPage.tsx:331-337, 340-346` | Add `aria-label="Assign teachers to {className}"` and similar for students. |
| **Minor** | StudentsTab: The "Assign" text link for classes and the parent link use plain `<button>` without descriptive `aria-label`.                   | `StudentsTab.tsx:62, 69`           | Add contextual aria-labels: `aria-label="Assign classes to {studentName}"`. |

---

## 7. STATE MANAGEMENT

### 7.1 Auth & Tenant State ✅ CORRECT

- `useAuthStore` (Zustand) for auth state: user, memberships, currentTenantId,
  login/logout
- `useTenantStore` (Zustand) for active tenant data: subscribes to Firestore doc
- `App.tsx:32-43` correctly initializes auth listener and subscribes to tenant
  on change

### 7.2 Server State ✅ CORRECT

- TanStack Query with `QueryClient` configured (`main.tsx:11-18`): `retry: 1`,
  `refetchOnWindowFocus: false`
- All data hooks (`useClasses`, `useTeachers`, etc.) use TanStack Query with
  proper cache keys
- Mutations use `mutateAsync` with loading states and error handling via `toast`

### 7.3 Local Form State

- All dialog forms use local `useState` — appropriate for ephemeral form data
- Forms reset on dialog close — ✅

---

## 8. ERROR HANDLING

| Severity  | Issue                                                                                                                                                                                                                                 | File:Line                      | Fix                                   |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ------------------------------------- |
| **Minor** | `RouteErrorBoundary` wraps each route's page component. Good pattern. However, the global `<ErrorBoundary>` in `main.tsx:31` and per-route `<RouteErrorBoundary>` provide two layers of protection — possibly redundant but harmless. | `App.tsx:53-66`, `main.tsx:31` | No fix needed. Good defense-in-depth. |

---

## 9. PERFORMANCE

### 9.1 Good Practices Found ✅

- All page components use `React.lazy()` for code-splitting (`App.tsx:10-24`)
- `Suspense` with `PageLoader` fallback at route level
- Inner `Suspense` with Skeleton fallback at layout level
- `useMemo` used for computed data in AnalyticsPage, AIUsagePage
- Pagination limits visible rows (default 25)
- TanStack Query staleTime configured appropriately

### 9.2 Potential Issues

| Severity  | Issue                                                                                                                                                                                                                                                                          | File:Line               | Fix                                                                                         |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------- | ------------------------------------------------------------------------------------------- |
| **Minor** | `AppLayout.tsx:168-181` fires a Firestore batch query on every render when `adminMemberships.length` changes. The dependency `adminMemberships.length` is a primitive but `adminMemberships` is recomputed every render (`.filter()`). This could cause unnecessary refetches. | `AppLayout.tsx:166-181` | Memoize `adminMemberships` with `useMemo` or use a stable dependency like `allMemberships`. |

---

## 10. SUMMARY OF FIXES BY PRIORITY

### Major (5 items — should fix before release)

1. **z-index conflict** between MobileBottomNav and Dialog overlay — risk of
   visual glitches on mobile
2. **EntityPicker in Dialog** layering — test Popover-inside-Dialog on mobile
   devices
3. **ClassesPage filter bar** not responsive — stack filters on mobile
4. **UsersPage header buttons** overflow on mobile — add wrapping
5. **TeachersTab misleading edit icon** — Pencil icon opens class assignment,
   not teacher edit

### Minor (12 items — nice to have)

1. Mobile bottom nav limited to 5 items (other pages only via sidebar)
2. StaffPage dialog footer inconsistent (manual div vs DialogFooter)
3. StudentsTab edit button same misleading icon issue
4. ParentsTab linked children shows cryptic IDs
5. DataTablePagination focus management
6. ExamsOverviewPage status filter buttons overflow on mobile
7. SettingsPage TabsList cramped on mobile
8. ClassesPage button accessibility (aria-labels)
9. StudentsTab button accessibility (aria-labels)
10. AppShell separator breakpoint inconsistency
11. Memoize adminMemberships in AppLayout
12. SettingsPage API key "dialog" is actually inline expand (not a problem, just
    naming inconsistency in state variable)

---

## 11. OVERALL ASSESSMENT

**Rating: 8/10** — The admin-web app is well-built with solid architecture:

- Correct sidebar + bottom-nav navigation pattern
- All dialogs properly wired with controlled open/close state
- Consistent shared-ui component usage across all pages
- Good accessibility foundations (skip-links, route announcer, ARIA attributes)
- Proper code-splitting and loading states
- Theme-aware styling throughout

The main gaps are minor responsive design issues on a few pages and some
misleading icon choices. No critical bugs found — all dialogs open correctly,
navigation works as expected, and the overall UX is coherent.
