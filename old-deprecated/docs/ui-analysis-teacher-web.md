# Teacher-Web UI/UX Analysis Report

**Date**: 2026-03-07 **Analyzed by**: Frontend Apps Engineer **Scope**:
`apps/teacher-web/` + `packages/shared-ui/` shared components

---

## Executive Summary

The teacher-web app is **well-structured** with a solid foundation using
shared-ui components (AppShell, AppSidebar, MobileBottomNav). The navigation
pattern (desktop sidebar + mobile bottom nav) is correctly implemented. Dialogs
use Radix primitives properly with controlled `open`/`onOpenChange` state.
However, there are several issues ranging from minor UX inconsistencies to a few
layout/responsive design concerns.

**Overall Health**: Good (7/10)

- Navigation: Correct pattern implemented
- Dialogs: All properly wired with controlled state
- Responsive: Mostly good, some edge cases
- Accessibility: Good foundation with a11y primitives, some gaps

---

## 1. NAVIGATION

### 1.1 Desktop Left Sidebar — PASS

**Files**: `AppLayout.tsx:188-196`, `packages/shared-ui/.../AppSidebar.tsx`,
`packages/shared-ui/.../sidebar.tsx:215-258`

The desktop sidebar is correctly implemented:

- Uses `<Sidebar collapsible="icon">` which renders as a fixed sidebar on `md:`
  breakpoints (`hidden md:block` at line 218 of sidebar.tsx)
- Supports collapse via keyboard shortcut (`Cmd+B`)
- Auto-close on mobile navigation via `SidebarMobileAutoClose` helper
- Footer has `RoleSwitcher` + user display + `LogoutButton`
- Nav groups are well-organized: Overview, Content, Analytics, People, System

### 1.2 Mobile Bottom Navbar — PASS

**Files**: `AppLayout.tsx:219-225,238`,
`packages/shared-ui/.../MobileBottomNav.tsx`

Mobile bottom nav is correctly implemented:

- `<MobileBottomNav>` is rendered unconditionally in `AppLayout.tsx:238`
- Has `md:hidden` class on the `<nav>` (MobileBottomNav.tsx:54) — only shows on
  mobile
- 5 items: Home, Spaces, Exams, Students, Analytics
- Respects safe area insets: `paddingBottom: 'env(safe-area-inset-bottom, 0px)'`
- `AppShell` adds `pb-20 md:pb-6` padding when `hasBottomNav=true`
  (AppShell.tsx:69)
- Minimum touch target size enforced: `min-h-[44px] min-w-[44px]`

### 1.3 Minor — Duplicate "Students" and "Student Reports" nav items

**File**: `AppLayout.tsx:109-122` **Severity**: Minor

```tsx
{ title: "Students", url: "/students", icon: Users, isActive: location.pathname === "/students" },
{ title: "Student Reports", url: "/students", icon: FileText, isActive: location.pathname.includes("/report") },
```

Both items link to `/students`. The "Student Reports" item should link to a
dedicated reports route or be removed as it creates confusion in the sidebar.
Currently clicking "Student Reports" navigates to the same `/students` page.

### 1.4 Minor — Missing nav items for Question Bank and Rubric Presets

**File**: `AppLayout.tsx:49-135` **Severity**: Minor

The routes `/question-bank` and `/rubric-presets` exist in `App.tsx:64-65` but
have no corresponding sidebar nav items. Users can only reach these pages via
direct URL or in-page links, making them effectively hidden.

### 1.5 Minor — Mobile sidebar (Sheet) z-index vs MobileBottomNav overlap

**Files**: `packages/shared-ui/.../sidebar.tsx:195-212`,
`packages/shared-ui/.../sheet.tsx:32`,
`packages/shared-ui/.../MobileBottomNav.tsx:54` **Severity**: Minor

The mobile sidebar Sheet uses `z-[75]` (SheetOverlay.tsx:22) and the
MobileBottomNav uses `z-50`. This is correct — the sidebar will appear above the
bottom nav. However, when the sheet is open, the bottom nav is still visible
behind the overlay (the overlay is `bg-black/80` which is semi-transparent). The
bottom nav should ideally be fully obscured. This is cosmetic and low-priority.

---

## 2. DIALOGS & MODALS

### 2.1 All dialogs properly use controlled state — PASS

Every dialog/modal in the app uses the correct pattern:

| Dialog                   | File                            | State Variable           | Opens Via                                                     |
| ------------------------ | ------------------------------- | ------------------------ | ------------------------------------------------------------- |
| Create Space             | `SpaceListPage.tsx:140`         | `showCreateDialog`       | Button onClick (line 133)                                     |
| Question Bank Import     | `SpaceEditorPage.tsx:936-947`   | `importBankSPId`         | Button onClick (line 865)                                     |
| Space Confirm Delete     | `SpaceEditorPage.tsx:670-683`   | `confirmDialog.open`     | `handleArchive`, `handleDeleteStoryPoint`, `handleDeleteItem` |
| Space Picker (Exam)      | `ExamDetailPage.tsx:464-497`    | `showSpacePicker`        | Button onClick (line 245)                                     |
| Rubric Editor Sheet      | `ExamDetailPage.tsx:500-519`    | `editingRubric`          | Button onClick (line 351)                                     |
| Item Editor Sheet        | `SpaceEditorPage.tsx:896-913`   | `editingItem`            | SortableItem onClick                                          |
| Story Point Editor Sheet | `SpaceEditorPage.tsx:916-933`   | `editingSP`              | Settings button onClick                                       |
| Image Lightbox           | `GradingReviewPage.tsx:907-913` | `lightboxUrl`            | Image onClick (line 611)                                      |
| Bulk Approve Confirm     | `GradingReviewPage.tsx:916-939` | `showBulkApproveConfirm` | Button onClick (line 411)                                     |

All dialogs use `<Dialog open={...} onOpenChange={...}>` or
`<AlertDialog open={...} onOpenChange={...}>` — the correct Radix controlled
pattern. No instances of broken dialog triggers.

### 2.2 Minor — Image Lightbox dialog missing DialogTitle

**File**: `GradingReviewPage.tsx:907-913` **Severity**: Minor (Accessibility)

```tsx
<Dialog open={!!lightboxUrl} onOpenChange={() => setLightboxUrl(null)}>
  <DialogContent className="max-h-[90vh] max-w-4xl p-2">
    {lightboxUrl && (
      <img
        src={lightboxUrl}
        alt="Full answer"
        className="h-full w-full object-contain"
      />
    )}
  </DialogContent>
</Dialog>
```

Missing `<DialogTitle>` and `<DialogDescription>`. Radix will log a console
warning. For a lightbox, use
`<DialogTitle className="sr-only">Answer Image</DialogTitle>`.

### 2.3 Minor — Sheet content missing SheetDescription

**Files**: `ExamDetailPage.tsx:503-506`, `SpaceEditorPage.tsx:899-902,919-922`
**Severity**: Minor (Accessibility)

All Sheet usages have `SheetTitle` but no `SheetDescription`. Radix may warn
about this. Add `aria-describedby={undefined}` to `SheetContent` or add a
visually-hidden description.

---

## 3. LAYOUT & RESPONSIVE DESIGN

### 3.1 AppShell & AppLayout Structure — PASS

**Files**: `AppLayout.tsx:227-241`, `packages/shared-ui/.../AppShell.tsx`

The layout structure is solid:

```
<SkipToContent />
<AppShell sidebar={sidebar} headerRight={headerRight} hasBottomNav>
  <RouteAnnouncer />
  <div id="main-content">
    <PageTransition>
      <Outlet />
    </PageTransition>
  </div>
</AppShell>
<MobileBottomNav />
<SWUpdateNotification />
```

- `SkipToContent` for keyboard a11y
- `RouteAnnouncer` announces route changes to screen readers
- `PageTransition` provides smooth page transitions
- PWA support with `SWUpdateNotification`

### 3.2 AuthLayout — PASS (Simple, Correct)

**File**: `AuthLayout.tsx:3-11`

Clean centered layout:
`flex min-h-screen items-center justify-center bg-muted/40 p-4` with `max-w-md`
card. Responsive.

### 3.3 Major — ExamDetailPage header action buttons overflow on mobile

**File**: `ExamDetailPage.tsx:200-268` **Severity**: Major

The header area packs many action buttons (Extract Questions, Publish, Release
Results, Link to Space, Download PDF, Submissions) into a single
`flex items-center gap-2` row. On mobile screens, these will overflow
horizontally or wrap awkwardly. This needs to be wrapped in a responsive
container — either:

- Use a dropdown menu for secondary actions on mobile
- Stack vertically on small screens with `flex-wrap`

### 3.4 Major — GradingReviewPage header buttons overflow on mobile

**File**: `GradingReviewPage.tsx:386-424` **Severity**: Major

Similar to ExamDetailPage — the header contains Previous/Next navigation + "X of
Y" counter + "Approve All" button. On mobile, these buttons overflow.

### 3.5 Minor — ExamCreatePage stepper not responsive

**File**: `ExamCreatePage.tsx:141-167` **Severity**: Minor

The stepper uses a horizontal `flex items-center gap-2` layout. On narrow
screens, step labels will truncate or wrap. Consider hiding labels on mobile and
showing only step numbers.

### 3.6 Minor — Exam list status tabs overflow

**File**: `ExamListPage.tsx:69` **Severity**: Minor

The `overflow-x-auto` class is correctly applied to the tab container, but
there's no scroll indicator (e.g., gradient fade). With 6 status tabs (All,
Draft, Published, Grading, Completed, Archived), users may not realize they can
scroll on small screens.

### 3.7 Minor — Tables not wrapped in scroll containers on mobile

**Files**: `StudentsPage.tsx:70-105`, `ClassDetailPage.tsx:279-312,330-363`
**Severity**: Minor

Tables with 5-6 columns will overflow horizontally on mobile. The table is
wrapped in `<div className="rounded-lg border">` but needs `overflow-x-auto` to
allow horizontal scrolling.

---

## 4. COMPONENT USAGE & DESIGN

### 4.1 PASS — Consistent use of shared-ui components

All pages correctly import from `@levelup/shared-ui`:

- `Button`, `Input`, `Label`, `Select`, `Switch`, `Textarea` — form controls
- `Card`, `CardContent`, `CardHeader`, `CardTitle` — card containers
- `Dialog`, `AlertDialog`, `Sheet` — overlays
- `Table`, `TableHeader`, `TableBody`, etc. — data tables
- `StatusBadge`, `Badge` — status indicators
- `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` — tab navigation
- `Breadcrumb` family — breadcrumb navigation
- `Skeleton` — loading states
- `sonnerToast` — toast notifications

### 4.2 PASS — ConfirmDialog is properly abstracted

**File**: `apps/teacher-web/src/components/shared/ConfirmDialog.tsx`

Clean reusable component wrapping `AlertDialog` with
`open/onOpenChange/title/description/confirmLabel/variant/onConfirm` props. Used
correctly in `SpaceEditorPage.tsx` for destructive confirmations.

### 4.3 Minor — DashboardPage loading detection is fragile

**File**: `DashboardPage.tsx:74` **Severity**: Minor

```tsx
const isLoading =
  !spaces.length && !exams.length && !students.length && !classes.length;
```

This will show content (not loading skeleton) if any one of the hooks returns
quickly while others are still loading. Use the actual `isLoading` flags from
each hook instead.

### 4.4 Minor — SubmissionsPage type casting is repetitive

**File**: `SubmissionsPage.tsx:381-392` **Severity**: Minor (Code quality)

The `gradingProgress` type is cast multiple times with
`(sub as Submission & { gradingProgress?: { percentComplete?: number } })`. This
should be a proper type extension or narrowing utility.

### 4.5 Minor — RubricEditor does not show loading/saving state

**File**: `RubricEditor.tsx:486-491` **Severity**: Minor

The "Save Rubric" button has no `disabled` state during save and no loading
indicator. The parent handles saving but RubricEditor doesn't receive a `saving`
prop.

---

## 5. STYLING & TAILWIND CONSISTENCY

### 5.1 PASS — Consistent spacing and typography

All pages follow the same patterns:

- `space-y-6` for vertical page sections
- `text-2xl font-bold` for h1 headings
- `text-sm text-muted-foreground` for subtitles
- `grid gap-4 md:grid-cols-2 lg:grid-cols-3` for card grids
- Consistent use of `border`, `bg-card`, `rounded-lg` for cards

### 5.2 PASS — Dark mode support

All color references use CSS variables (`text-foreground`, `bg-background`,
`text-muted-foreground`, `bg-primary`, etc.) or provide explicit dark mode
variants (e.g., `bg-green-50 dark:bg-green-950/30`).

### 5.3 Minor — Hardcoded color classes in ExamCreatePage

**File**: `ExamCreatePage.tsx:424` **Severity**: Minor

```tsx
className = "bg-green-600 hover:bg-green-700 text-white";
```

Similar patterns appear in `ExamDetailPage.tsx:225,234` and
`SubmissionsPage.tsx:195`. These should use semantic colors or be extracted to
button variants. The green/blue/purple buttons break the design system's
`variant="default"|"destructive"|"outline"|"secondary"|"ghost"|"link"` pattern.

### 5.4 Minor — Inconsistent empty state patterns

Some pages use `<EmptyState preset={...}>` (DashboardPage), others use inline
empty state divs with manual icon + text + optional CTA. The shared `EmptyState`
component should be used consistently.

---

## 6. ACCESSIBILITY

### 6.1 PASS — Good a11y foundation

- `<SkipToContent />` for keyboard navigation (AppLayout.tsx:229)
- `<RouteAnnouncer />` for screen reader route announcements (AppLayout.tsx:231)
- `aria-label` on icon buttons (back buttons, drag handles, toggles)
- `<span className="sr-only">` on icon-only buttons
- Proper `htmlFor` + `id` pairing on form labels (LoginPage, SettingsPage)
- Notification bell has `aria-live="polite"` for unread count

### 6.2 Minor — Missing `aria-label` on some interactive elements

**Files**: Various **Severity**: Minor

- `SpaceListPage.tsx:192-203`: Status filter buttons have no accessible name
  beyond visual text
- `GradingReviewPage.tsx:494-513`: Review filter buttons lack `aria-pressed` or
  role
- `ExamCreatePage.tsx:292-301`: Drop zone div has `onClick` but no role or
  keyboard handler

### 6.3 Minor — Tab filter buttons should use proper tabs/toggle pattern

**Files**: `SpaceListPage.tsx:190-204`, `ExamListPage.tsx:69-83` **Severity**:
Minor

The status filter "tabs" are plain `<button>` elements without `role="tablist"`
/ `role="tab"` / `aria-selected`. They visually look like tabs but aren't
announced as such.

---

## 7. STATE MANAGEMENT & DATA FLOW

### 7.1 PASS — Zustand + TanStack Query pattern

- Auth state via `useAuthStore` (Zustand)
- Server state via `useSpaces`, `useExams`, `useSubmissions`, etc. (TanStack
  Query hooks from `@levelup/shared-hooks`)
- Mutations via dedicated hooks: `useCreateSpace`, `usePublishSpace`,
  `useUpdateItem`, etc.
- Error handling via `useApiError` hook

### 7.2 Minor — SpaceEditorPage manages too much local state

**File**: `SpaceEditorPage.tsx:234-251` **Severity**: Minor (Maintainability)

The page manages 12+ `useState` hooks for items, story points, editing states,
confirmation dialogs, etc. Consider extracting some of this into a custom hook
(e.g., `useSpaceEditor`).

### 7.3 Minor — useEffect dependency array in AppLayout tenant name fetch

**File**: `AppLayout.tsx:159` **Severity**: Minor

```tsx
}, [teacherMemberships.length, currentTenantId]);
```

Using `.length` as dependency is fragile — if a membership is replaced (same
length but different content), tenant names won't refetch. Should use a stable
serialization or move to TanStack Query.

---

## Summary Table

| #   | Issue                                                | Severity  | File                                    | Line(s)       |
| --- | ---------------------------------------------------- | --------- | --------------------------------------- | ------------- |
| 1.3 | Duplicate "Students"/"Student Reports" nav items     | Minor     | AppLayout.tsx                           | 109-122       |
| 1.4 | Missing nav items for Question Bank, Rubric Presets  | Minor     | AppLayout.tsx                           | 49-135        |
| 1.5 | Mobile sidebar overlay doesn't fully hide bottom nav | Minor     | sidebar.tsx, MobileBottomNav.tsx        | —             |
| 2.2 | Image lightbox missing DialogTitle                   | Minor     | GradingReviewPage.tsx                   | 907-913       |
| 2.3 | Sheets missing SheetDescription                      | Minor     | ExamDetailPage.tsx, SpaceEditorPage.tsx | 503, 899, 919 |
| 3.3 | ExamDetailPage header buttons overflow on mobile     | **Major** | ExamDetailPage.tsx                      | 200-268       |
| 3.4 | GradingReviewPage header buttons overflow on mobile  | **Major** | GradingReviewPage.tsx                   | 386-424       |
| 3.5 | ExamCreatePage stepper not responsive                | Minor     | ExamCreatePage.tsx                      | 141-167       |
| 3.6 | Exam list status tabs need scroll indicator          | Minor     | ExamListPage.tsx                        | 69            |
| 3.7 | Tables lack overflow-x-auto on mobile                | Minor     | StudentsPage.tsx, ClassDetailPage.tsx   | 70, 279, 330  |
| 4.3 | Dashboard loading detection is fragile               | Minor     | DashboardPage.tsx                       | 74            |
| 4.5 | RubricEditor lacks saving state indicator            | Minor     | RubricEditor.tsx                        | 486-491       |
| 5.3 | Hardcoded color classes on action buttons            | Minor     | ExamCreatePage.tsx, ExamDetailPage.tsx  | Various       |
| 5.4 | Inconsistent empty state patterns                    | Minor     | Various pages                           | —             |
| 6.2 | Missing aria-label on some interactive elements      | Minor     | Various                                 | —             |
| 6.3 | Filter buttons lack proper tab/toggle ARIA roles     | Minor     | SpaceListPage.tsx, ExamListPage.tsx     | 190, 69       |
| 7.2 | SpaceEditorPage has too much local state             | Minor     | SpaceEditorPage.tsx                     | 234-251       |
| 7.3 | Fragile useEffect dependency for tenant names        | Minor     | AppLayout.tsx                           | 159           |

---

## Recommended Fixes (Priority Order)

### High Priority (Major)

1. **Wrap ExamDetailPage header actions** in a responsive container — use
   `flex-wrap` or collapse secondary actions into a `DropdownMenu` on mobile
2. **Wrap GradingReviewPage header buttons** — same approach; stack
   Previous/Next and Approve All vertically on small screens

### Medium Priority

3. Add `overflow-x-auto` to table containers in StudentsPage and ClassDetailPage
4. Add `DialogTitle className="sr-only"` to Image Lightbox dialog
5. Add nav items for `/question-bank` and `/rubric-presets` in sidebar
6. Fix duplicate "Student Reports" nav entry to point to a real reports route

### Low Priority

7. Use actual `isLoading` flags in DashboardPage instead of checking empty
   arrays
8. Add `aria-describedby={undefined}` to Sheet components or add hidden
   descriptions
9. Extract hardcoded green/blue/purple button colors into design system variants
10. Standardize empty state usage across all pages using `<EmptyState>`
    component
11. Add proper ARIA roles to status filter buttons (tablist/tab pattern)
12. Extract SpaceEditorPage state into a custom `useSpaceEditor` hook
