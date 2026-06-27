# UI/UX Analysis Report — Parent Web App

**App:** `apps/parent-web/` **Date:** 2026-03-07 **Analyst:** Frontend Apps
Engineer

---

## Executive Summary

The parent-web app is well-structured overall, using shared-ui components
consistently and following the required navigation pattern (desktop sidebar +
mobile bottom nav). However, there are **2 critical bugs**, **4 major issues**,
and **several minor issues** that need attention.

---

## 1. CRITICAL Issues

### 1.1 BUG: `useStudentNames` called with wrong arguments in PerformanceAlertsPage

**File:** `src/pages/PerformanceAlertsPage.tsx:34` **Severity:** Critical — will
cause data fetch failures or return empty results

The hook is called with only one argument:

```tsx
const { data: studentNames } = useStudentNames(studentUids);
```

But the hook signature requires two arguments:

```tsx
// hooks/useStudentNames.ts
export function useStudentNames(tenantId: string | null, studentIds: string[]);
```

This means `studentUids` (a `string[]`) is being passed as `tenantId` (expected
`string | null`), and `studentIds` defaults to `undefined`. The query will
always fail or return `{}`.

**Fix:**

```tsx
const { data: studentNames } = useStudentNames(tenantId, studentUids);
```

---

### 1.2 BUG: Dead link — Dashboard links to non-existent route `/children/:uid`

**File:** `src/pages/DashboardPage.tsx:363` **Severity:** Critical — users
clicking "View details" will see a 404 page

The Dashboard renders a link for each child:

```tsx
<Link to={`/children/${student.uid}`} ...>
  View details <ArrowRight />
</Link>
```

But there is NO matching route in `App.tsx`. The routes are:

```tsx
<Route path="/children" element={<ChildrenPage />} />
```

There is no `/children/:childId` route. Clicking "View details" will match the
`<Route path="*" element={<NotFoundPage />} />` catch-all.

**Fix:** Either:

- (a) Add a route
  `<Route path="/children/:childId" element={<ChildDetailPage />} />` and create
  the page, OR
- (b) Change the link to point to an existing route like
  `/child-progress?student=${student.uid}`, OR
- (c) Remove the "View details" link entirely

---

## 2. MAJOR Issues

### 2.1 Dead code: Local `MobileBottomNav.tsx` is unused

**File:** `src/components/MobileBottomNav.tsx` (entire file, 73 lines)
**Severity:** Major — dead code / maintenance burden

`AppLayout.tsx` imports `MobileBottomNav` from `@levelup/shared-ui` (line 12),
NOT from the local component. The local `src/components/MobileBottomNav.tsx` is
completely unused dead code with a different interface:

- **Local component:** Takes `{ unreadCount?: number }` prop, manages its own
  nav items internally
- **Shared-ui component:** Takes `{ items: MobileNavItem[]; LinkComponent? }` —
  more flexible

**Fix:** Delete `src/components/MobileBottomNav.tsx`.

---

### 2.2 PerformanceAlertsPage — `useChildSubmissions` receives array without proper typing

**File:** `src/pages/PerformanceAlertsPage.tsx:35` **Severity:** Major — type
mismatch may cause runtime issues

```tsx
const { data: submissions } = useChildSubmissions(tenantId, studentUids);
```

The `ChildAlertSection` component's `submissions` prop type (line 95) is:

```tsx
submissions: Array<{
  examTitle?: string;
  percentage?: number;
  score?: number;
  maxScore?: number;
}>;
```

But `useChildSubmissions` returns
`(Submission & { examTitle?: string; examSubject?: string })[]`. The
`percentage` field is accessed as `s.percentage` at line 109, but on
`Submission` type, the percentage lives inside `sub.summary?.percentage`. The
filtering at line 109:

```tsx
const lowScoreExams = submissions.filter((s) => (s.percentage ?? 0) < 40);
```

This accesses `s.percentage` which doesn't exist on the Submission type — it
would be `s.summary?.percentage`.

**Fix:** Update the `ChildAlertSection` to use `s.summary?.percentage` or
transform the data before passing.

---

### 2.3 ChildrenPage links — "View Full Progress" and "Exam Results" don't filter by child

**File:** `src/pages/ChildrenPage.tsx:186-197` **Severity:** Major — misleading
UX, no per-child filtering

```tsx
<Link to="/child-progress" ...>View Full Progress</Link>
<Link to="/results" ...>Exam Results</Link>
```

Both links navigate to global pages without passing the student ID as a
parameter. Users expect to see progress for _that specific child_ but instead
see all children's data combined. The `ChildProgressPage` does support child
selection via `selectedStudentId` state, but there's no URL param support.

**Fix:** Pass the student UID as a query parameter:

```tsx
<Link to={`/child-progress?student=${student.uid}`} ...>
<Link to={`/results?student=${student.uid}`} ...>
```

And update `ChildProgressPage`/`ExamResultsPage` to read and apply the query
param.

---

### 2.4 Missing `tenantId` in `useStudentNames` call on PerformanceAlertsPage

**File:** `src/pages/PerformanceAlertsPage.tsx:34` **Severity:** Major (same
root cause as Critical 1.1, listed separately for tracking)

This is the same as Critical 1.1 — the missing `tenantId` argument means student
names will never resolve, so all students will display as "Student" in the
alerts page.

---

## 3. MINOR Issues

### 3.1 Inconsistent empty state patterns

**Files:** Multiple pages **Severity:** Minor — visual inconsistency

- `DashboardPage.tsx:245-249` uses
  `<EmptyState icon={...} title={...} description={...} />` (shared-ui
  component)
- `ChildrenPage.tsx:67-73` uses custom inline empty state with
  `border-dashed p-12 text-center`
- `ExamResultsPage.tsx:241-247` uses same custom inline pattern
- `SpaceProgressPage.tsx:75-80` uses same custom inline pattern
- `ChildProgressPage.tsx:110-115` uses same custom inline pattern
- `PerformanceAlertsPage.tsx:75-80` uses `<EmptyState />` component

**Fix:** Standardize all empty states to use the shared-ui `<EmptyState />`
component for visual consistency.

---

### 3.2 AuthLayout is very minimal — no branding

**File:** `src/layouts/AuthLayout.tsx` **Severity:** Minor — missed opportunity
for branding

The auth layout is just a centered container:

```tsx
<div className="bg-muted/40 flex min-h-screen items-center justify-center p-4">
  <div className="w-full max-w-md">
    <Outlet />
  </div>
</div>
```

No app logo, no branding, no background pattern. Other apps (admin-web,
teacher-web) may have similar minimal auth layouts, but for a parent-facing
portal, branding and trust signals matter.

**Fix (suggestion):** Add the LevelUp logo and a subtle background pattern or
illustration.

---

### 3.3 Missing keyboard navigation on ChildProgressPage child selector

**File:** `src/pages/ChildProgressPage.tsx:120-142` **Severity:** Minor —
accessibility

The child selector tabs are implemented as plain `<button>` elements, which is
fine for click, but they don't implement ARIA tab pattern (`role="tablist"`,
`role="tab"`, `aria-selected`). Screen reader users won't understand the tab
selection context.

**Fix:** Add ARIA tab attributes:

```tsx
<div className="flex gap-2 ..." role="tablist" aria-label="Select child">
  <button role="tab" aria-selected={isSelected} ...>
```

---

### 3.4 DataFreshnessIndicator has no aria-live for dynamic updates

**File:** `src/pages/DashboardPage.tsx:68-102` **Severity:** Minor —
accessibility

The "Updated X ago" text changes dynamically but has no `aria-live` region, so
screen readers won't announce data freshness changes.

**Fix:** Wrap in `aria-live="polite"`:

```tsx
<div className="..." aria-live="polite">
  <span>Updated {timeAgo}</span>
  ...
</div>
```

---

### 3.5 ExamResultsPage — AccordionTrigger nesting issue

**File:** `src/pages/ExamResultsPage.tsx:256` **Severity:** Minor — potential
HTML validation issue

`AccordionTrigger` renders as a `<button>`, and the content inside includes
complex nested `<div>` with `<h3>` and `<p>` elements. While browsers handle
this, it's technically invalid HTML to nest heading/paragraph elements inside a
button.

**Fix:** Use `<span>` elements instead of `<h3>` and `<p>` inside the trigger,
with appropriate styling classes.

---

### 3.6 Score bar progress indicators lack aria labels

**Files:** `ExamResultsPage.tsx:296-311`, `ChildProgressPage.tsx:326-339`,
`SpaceProgressPage.tsx:120-131` **Severity:** Minor — accessibility

The colored progress bars (score indicators) have no `role="progressbar"`,
`aria-valuenow`, `aria-valuemin`, or `aria-valuemax` attributes. Screen readers
can't interpret them.

**Fix:** Add ARIA progressbar attributes:

```tsx
<div
  role="progressbar"
  aria-valuenow={percentage}
  aria-valuemin={0}
  aria-valuemax={100}
  aria-label={`Score: ${percentage}%`}
  className="h-1.5 w-full rounded-full bg-muted"
>
```

---

### 3.7 Redundant `useCurrentUser` and `useCurrentTenantId` usage

**Files:** Multiple pages **Severity:** Minor — code smell

Most pages import both `useCurrentUser` and `useCurrentTenantId` separately from
`@levelup/shared-stores`. Some pages also import `useAuthStore` directly. This
is inconsistent:

- `SettingsPage.tsx`: Uses `useCurrentUser`, `useCurrentTenantId`, AND
  `useAuthStore`
- `NotificationsPage.tsx`: Uses `useAuthStore` directly
- `DashboardPage.tsx`: Uses `useCurrentUser`, `useCurrentTenantId`,
  `useCurrentMembership`
- `PerformanceAlertsPage.tsx`: Uses `useAuthStore` directly

**Fix:** Standardize on one pattern across all pages (prefer the selector hooks
like `useCurrentUser`, `useCurrentTenantId`).

---

### 3.8 Mobile bottom nav doesn't include all key sections

**File:** `src/layouts/AppLayout.tsx:169-174` **Severity:** Minor — UX
limitation

The mobile bottom nav has only 4 items: Home, Children, Results, Alerts. Missing
items include:

- Settings (accessible only from sidebar on mobile)
- Child Progress (no mobile shortcut)
- Space Progress (no mobile shortcut)

Since the sidebar exists on mobile (as a sheet), these pages ARE accessible but
require opening the sidebar menu. This is fine but means mobile users have a
2-tap journey for those pages vs. 1-tap for the 4 primary items.

**Fix (suggestion):** Consider if "Space Progress" or "Child Progress" should
replace one of the bottom nav items based on usage analytics. Alternatively,
keep as-is since 4 items is the recommended max for bottom navs.

---

## 4. NAVIGATION Analysis

### Desktop Navigation ✅ PASS

- **Implementation:** Left sidebar via `AppSidebar` component inside `AppShell`
- **Groups:** "Overview" (Dashboard), "My Children" (5 items), "Account" (2
  items)
- **Sidebar footer:** RoleSwitcher + user display name
- **Collapsible:** Icon-only mode supported (`collapsible="icon"`)

### Mobile Navigation ✅ PASS

- **Bottom Nav:** `MobileBottomNav` from shared-ui with 4 primary items
- **Sidebar access:** Available as Sheet overlay (z-[75]) via sidebar trigger
- **Bottom padding:** `hasBottomNav` prop on AppShell adds `pb-20` on mobile
- **Breakpoint:** `md:hidden` for bottom nav, Sheet for sidebar

### Navigation Consistency ✅ PASS

- Active state highlighting works correctly on both sidebar and bottom nav
- Badge count (unread notifications) synced between sidebar and bottom nav
- Route transitions animated via `PageTransition` component

---

## 5. DIALOG/MODAL Analysis

### All Dialogs Found:

| Component            | Type         | Source    | Opens? | Notes                               |
| -------------------- | ------------ | --------- | ------ | ----------------------------------- |
| NotificationBell     | Popover      | shared-ui | ✅ Yes | z-50, align="end", controlled state |
| RoleSwitcher         | DropdownMenu | shared-ui | ✅ Yes | z-50, renders only if >1 tenant     |
| LogoutButton         | AlertDialog  | shared-ui | ✅ Yes | z-50, "Sign out?" confirmation      |
| Mobile Sidebar       | Sheet        | shared-ui | ✅ Yes | z-[75], auto-closes on route change |
| SWUpdateNotification | Fixed banner | shared-ui | ✅ Yes | z-[60], top-positioned              |
| ThemeToggle          | DropdownMenu | shared-ui | ✅ Yes | z-50, System/Light/Dark options     |

### Z-Index Stacking (verified no conflicts):

1. `z-[75]` — Mobile sidebar Sheet (highest)
2. `z-[60]` — SW Update notification banner
3. `z-50` — All popovers, dropdowns, dialogs, bottom nav (same level,
   portal-rendered)

### Verdict: ✅ No dialog/modal opening issues found

All overlays use Radix UI primitives with portal rendering. No z-index conflicts
detected. No missing onClick handlers or broken state management.

---

## 6. LAYOUT Analysis

### AppLayout ✅ GOOD

- Uses `AppShell` with sidebar, headerRight, hasBottomNav
- `SkipToContent` for accessibility
- `RouteAnnouncer` for screen reader route change announcements
- `PageTransition` for smooth page transitions
- Content wrapped in `#main-content` div

### AuthLayout ✅ ADEQUATE (minor branding gap)

- Centered card layout, max-w-md
- `bg-muted/40` background
- Responsive padding

### Responsive Breakpoints ✅ CONSISTENT

- Mobile-first approach throughout
- Common breakpoints: `sm:`, `md:`, `lg:`
- Grid layouts: `grid-cols-1` → `sm:grid-cols-2` → `lg:grid-cols-3/4`

---

## 7. STYLING Analysis

### Tailwind Usage ✅ CONSISTENT

- Uses semantic color tokens: `text-primary`, `text-muted-foreground`,
  `bg-card`, `bg-muted`, `border`
- Score colors: `text-success` (≥70%), `text-warning` (≥40%), `text-destructive`
  (<40%)
- Consistent spacing: `space-y-6` for page sections, `gap-4` for grids, `gap-2`
  for small items

### Theme Support ✅ GOOD

- `ThemeProvider` with system/light/dark modes
- `ThemeToggle` in header
- Dark mode styles via Tailwind dark variants (automatic via class strategy)
- Note: PerformanceAlertsPage (lines 136-146) uses explicit dark mode styles
  like `dark:border-red-900/50` which break from the semantic token pattern used
  elsewhere

---

## 8. COMPONENT DESIGN Analysis

### Shared-UI Usage ✅ GOOD

Components from `@levelup/shared-ui` used consistently:

- Layout: `AppShell`, `AppSidebar`, `MobileBottomNav`, `SkipToContent`,
  `PageTransition`, `RouteAnnouncer`
- UI: `Card`, `Button`, `Input`, `Label`, `Switch`, `Badge`, `Skeleton`,
  `Accordion`
- Data: `ScoreCard`, `ProgressRing`, `AtRiskBadge`, `SimpleBarChart`,
  `DownloadPDFButton`
- Feedback: `EmptyState`, `SonnerToaster`, `ErrorBoundary`,
  `SWUpdateNotification`
- Auth: `LogoutButton`, `NotificationBell`, `RoleSwitcher`, `ThemeToggle`

### Loading States ✅ GOOD

All pages have skeleton loading states:

- `DashboardSkeleton` — grid + card skeletons
- `ChildrenSkeleton` — card with avatar skeletons
- `ExamResultsSkeleton` — list skeletons
- `ChildProgressSkeleton` — tabs + grid skeletons
- `SpaceProgressSkeleton` — grouped grid skeletons
- `SettingsPrefsSkeleton` — switch row skeletons

### Animation ✅ GOOD

- `FadeIn` component used on Dashboard for staggered reveals
- `AnimatedList` / `AnimatedListItem` for children overview on Dashboard
- `PageTransition` for route changes
- `transition-shadow` on hover for cards

---

## Priority Fix Summary

| #   | Severity     | Issue                               | File                             | Effort   |
| --- | ------------ | ----------------------------------- | -------------------------------- | -------- |
| 1.1 | **Critical** | `useStudentNames` wrong args        | PerformanceAlertsPage.tsx:34     | 1 min    |
| 1.2 | **Critical** | Dead link to `/children/:uid`       | DashboardPage.tsx:363            | 5-30 min |
| 2.1 | **Major**    | Dead code: local MobileBottomNav    | components/MobileBottomNav.tsx   | 1 min    |
| 2.2 | **Major**    | Wrong `percentage` access in alerts | PerformanceAlertsPage.tsx:95,109 | 10 min   |
| 2.3 | **Major**    | Child links don't filter by child   | ChildrenPage.tsx:186-197         | 30 min   |
| 3.1 | Minor        | Inconsistent empty states           | Multiple                         | 15 min   |
| 3.3 | Minor        | Missing ARIA tab roles              | ChildProgressPage.tsx:120        | 5 min    |
| 3.5 | Minor        | Button nesting in accordion         | ExamResultsPage.tsx:256          | 10 min   |
| 3.6 | Minor        | Missing progressbar ARIA            | Multiple                         | 10 min   |
| 3.7 | Minor        | Inconsistent store usage            | Multiple                         | 10 min   |
