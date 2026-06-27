# UI/UX Analysis Report: Student-Web App

**Date:** 2026-03-07 **Scope:** `/apps/student-web/` + `/packages/shared-ui/`
(shared components) **Analyst:** Frontend Apps Engineer (automated analysis)

---

## Executive Summary

The student-web app is well-structured with proper lazy-loading, role-based
routing, and good shared-ui component adoption. Navigation pattern (desktop
sidebar + mobile bottom navbar) is correctly implemented. Dialog/modal
implementations are all functional. Key areas for improvement: ConsumerLayout
accessibility gaps, inconsistent theme toggle patterns, missing error states on
several pages, and a few accessibility issues in content viewers.

**Issue Counts:** 8 Critical | 12 Major | 18 Minor

---

## 1. NAVIGATION ANALYSIS

### 1.1 Desktop Left Sidebar — PASS

**AppLayout** (`src/layouts/AppLayout.tsx`):

- Uses `AppShell` + `AppSidebar` from shared-ui (correct pattern)
- 3 nav groups: Overview (Dashboard), Learning (Spaces, Tests, Results), Growth
  (Achievements, Study Planner, Leaderboard, Chat Tutor)
- `RoleSwitcher` in sidebar footer for multi-tenant students
- Sidebar state persisted via cookie through `SidebarProvider`
- Collapsible with keyboard shortcut (Ctrl/Cmd+B)

**ConsumerLayout** (`src/layouts/ConsumerLayout.tsx`):

- Uses same `AppShell` + `AppSidebar` pattern (correct)
- 3 nav groups: Overview (My Learning), Explore (Space Store, Cart), Account
  (Profile)
- Dynamic cart item in nav (shown only when cart > 0)

**Verdict:** Desktop sidebar is properly implemented in both layouts.

### 1.2 Mobile Bottom Navbar — PASS

**AppLayout** (`src/layouts/AppLayout.tsx:190-196`):

- `MobileBottomNav` with 5 items: Home, Spaces, Tests, Board, Chat
- Uses `md:hidden` to show only on mobile
- `hasBottomNav` prop on `AppShell` adds `pb-20 md:pb-6` to prevent content
  overlap
- Fixed bottom with `z-50`, proper safe-area insets

**ConsumerLayout** (`src/layouts/ConsumerLayout.tsx:137-142`):

- `MobileBottomNav` with 3-4 items: Home, Store, Cart (conditional), Profile
- Same pattern as AppLayout

**Verdict:** Mobile bottom navbar correctly implemented in both layouts.

### 1.3 Navigation Issues Found

| #   | Severity  | File:Line                  | Issue                                                                                                                                                                                      | Fix                                                  |
| --- | --------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| N1  | **Major** | `ConsumerLayout.tsx:1-157` | Missing `<SkipToContent />` component — AppLayout has it but ConsumerLayout does not. Accessibility regression for keyboard/screen-reader users.                                           | Add `<SkipToContent />` before `<AppShell>`          |
| N2  | **Major** | `ConsumerLayout.tsx:148`   | Missing `id="main-content"` wrapper around `<Outlet />` — the skip-to-content link target won't work even if SkipToContent is added. AppLayout wraps content in `<div id="main-content">`. | Wrap `<PageTransition>` in `<div id="main-content">` |
| N3  | **Minor** | `AppLayout.tsx:194`        | Mobile nav label "Board" is ambiguous — users may not understand it means "Leaderboard".                                                                                                   | Change label to "Rank" or "Leaders"                  |

---

## 2. DIALOG/MODAL ANALYSIS

### 2.1 All Dialog Instances — ALL FUNCTIONAL

| Component           | File:Line                                    | Type                       | State Mgmt                        | Opens?                    | Closes?                    | Status   |
| ------------------- | -------------------------------------------- | -------------------------- | --------------------------------- | ------------------------- | -------------------------- | -------- |
| New Study Goal      | `StudyPlannerPage.tsx:43,76-96`              | Dialog                     | `dialogOpen` useState             | DialogTrigger button      | onOpenChange + form submit | **PASS** |
| Mobile Question Nav | `TimedTestPage.tsx:577-599`                  | Sheet (bottom)             | Uncontrolled                      | SheetTrigger button       | Overlay click / X          | **PASS** |
| Submit Test Confirm | `TimedTestPage.tsx:142,704,718-750`          | AlertDialog                | `showConfirm` useState            | onClick handler           | Cancel/Submit actions      | **PASS** |
| Chat Tutor Panel    | `ChatTutorPanel.tsx:52`                      | Sheet (right)              | Parent-controlled (`open={true}`) | Parent conditional render | onOpenChange → onClose     | **PASS** |
| Chat Session Viewer | `ChatTutorPage.tsx:38-42,82,129-136`         | Sheet (via ChatTutorPanel) | `activeSession` useState          | Button onClick            | onClose callback           | **PASS** |
| Story Point Chat    | `StoryPointViewerPage.tsx:64-65,369,429-436` | Sheet (via ChatTutorPanel) | `chatItemId` useState             | onOpenChat callback       | onClose callback           | **PASS** |
| Practice Mode Chat  | `PracticeModePage.tsx:47,232,260-267`        | Sheet (via ChatTutorPanel) | `chatItemId` useState             | onOpenChat callback       | onClose callback           | **PASS** |
| Review Form         | `SpaceReviewSection.tsx:64,112-154`          | Inline expansion           | `showForm` useState               | Button onClick            | Cancel button / submit     | **PASS** |

### 2.2 Dialog Issues Found

| #   | Severity  | File:Line               | Issue                                                                                                                                                        | Fix                                                              |
| --- | --------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| D1  | **Minor** | `ChatTutorPanel.tsx:52` | `open={true}` is unconventional — relies on parent conditional rendering for mount/unmount lifecycle. Works correctly but makes the component less reusable. | Consider accepting `open` prop from parent instead of hardcoding |

**Verdict:** All dialogs open and close properly. No broken onClick handlers, no
z-index conflicts, no state management issues.

---

## 3. LAYOUT ANALYSIS

### 3.1 AppShell Structure — GOOD

**File:** `packages/shared-ui/src/components/layout/AppShell.tsx`

- `SidebarProvider` → `Sidebar` + `SidebarInset` (header + main)
- Header: `h-14`, sidebar trigger, separator, breadcrumb, right slot
- Main: responsive padding `p-3 sm:p-4 md:p-6`
- Bottom nav padding: `pb-20 md:pb-6` when `hasBottomNav=true`
- Safe area insets for notched devices
- Minimum touch targets: `min-h-[44px] min-w-[44px]` on sidebar trigger

### 3.2 AuthLayout — MINIMAL BUT CORRECT

**File:** `src/layouts/AuthLayout.tsx`

- Centered card layout:
  `flex min-h-screen items-center justify-center bg-muted/40 p-4`
- Max width constraint: `max-w-md`
- Simple and appropriate for login flows

### 3.3 Layout Issues Found

| #   | Severity     | File:Line                     | Issue                                                                                                                                                                                                                                                                                                                              | Fix                                                               |
| --- | ------------ | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| L1  | **Critical** | `ConsumerLayout.tsx:4,30,113` | Uses `useTheme` from `next-themes` directly + manual Sun/Moon toggle button, while AppLayout uses the shared `ThemeToggle` component from shared-ui. This is an **inconsistency** — the ConsumerLayout toggle only supports light/dark (no "system" option), while the shared ThemeToggle supports light/dark/system via dropdown. | Replace manual theme toggle with `<ThemeToggle />` from shared-ui |
| L2  | **Minor**    | `ConsumerLayout.tsx:117`      | Moon icon has `className="absolute"` — this positions it absolutely within the button, which works for the toggle effect but could cause layout issues if button sizing changes.                                                                                                                                                   | No immediate fix needed, but note for future                      |
| L3  | **Minor**    | `AuthLayout.tsx:1-11`         | No background pattern/branding. Very plain compared to modern auth pages.                                                                                                                                                                                                                                                          | Consider adding subtle branding or background pattern             |

---

## 4. PAGE-LEVEL ANALYSIS

### 4.1 Critical Issues

| #   | Severity     | File:Line                            | Issue                                                                                                                              | Fix                                                                            |
| --- | ------------ | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| P1  | **Critical** | `CheckoutPage.tsx`                   | No confirmation dialog before clearing cart or processing purchase. User can accidentally lose cart contents.                      | Add AlertDialog confirmation before destructive cart operations                |
| P2  | **Critical** | `CheckoutPage.tsx`                   | Hardcoded "USD" currency — not using `item.currency` consistently. Could show wrong currency for international users.              | Use `item.currency` from each cart item                                        |
| P3  | **Critical** | `StudyPlannerPage.tsx` (NewGoalForm) | No validation that `endDate > startDate`. User can create goals with impossible date ranges.                                       | Add date range validation                                                      |
| P4  | **Critical** | `StudyPlannerPage.tsx`               | Goal `currentCount` never changes from 0 — no mechanism to track progress on goals. Goals are created but never updated.           | Implement goal progress tracking or remove progress display                    |
| P5  | **Critical** | `LoginPage.tsx`                      | `clearError()` is called on view switch but no error message is ever displayed to the user. If login fails, user sees no feedback. | Ensure auth error from `useAuthStore` is rendered in each form, or add a toast |

### 4.2 Major Issues

| #   | Severity  | File:Line                   | Issue                                                                                                                                                    | Fix                                               |
| --- | --------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| P6  | **Major** | `StoreDetailPage.tsx`       | Action buttons use hardcoded inline classes (`inline-flex h-9 items-center...`) instead of the shared `Button` component. Inconsistent with rest of app. | Use `<Button>` component from shared-ui           |
| P7  | **Major** | `LeaderboardPage.tsx`       | No empty state when leaderboard data is empty. Shows nothing if no students have scores.                                                                 | Add `<EmptyState>` component                      |
| P8  | **Major** | `ExamResultPage.tsx`        | `GradeBadge` color mapping has no fallback if grade key doesn't exist. Could render with undefined styles.                                               | Add default/fallback color                        |
| P9  | **Major** | `ConsumerDashboardPage.tsx` | Firestore `in` query limited to 30 items (hardcoded). Silent failure if student has >30 enrolled spaces.                                                 | Implement batched queries for >30 items           |
| P10 | **Major** | `TimedTestPage.tsx`         | Auto-submit on timeout doesn't confirm with user — just submits silently. Student may not realize time ran out.                                          | Show a brief toast/notification on auto-submit    |
| P11 | **Major** | `TimedTestPage.tsx`         | Save status indicator only shows "Saving..."/"Saved" — no error state. If save fails during exam, student loses answers silently.                        | Add error state with retry for answer persistence |
| P12 | **Major** | `SpacesListPage.tsx`        | Each space card fetches progress individually (N+1 query pattern). With many spaces, this creates excessive Firestore reads.                             | Batch progress queries or use a summary endpoint  |

### 4.3 Minor Issues

| #   | Severity  | File:Line                 | Issue                                                                                                             | Fix                                                     |
| --- | --------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| P13 | **Minor** | `StoreListPage.tsx`       | View toggle buttons (grid/list) have no `aria-label` — only icons visible.                                        | Add `aria-label="Grid view"` / `aria-label="List view"` |
| P14 | **Minor** | `TestsPage.tsx`           | No test status indication (completed, in-progress, locked). Student can't tell which tests they've already taken. | Add status badges/icons                                 |
| P15 | **Minor** | `ChatTutorPage.tsx`       | Last message preview doesn't distinguish between user/AI messages visually.                                       | Add "You:" or "AI:" prefix to preview                   |
| P16 | **Minor** | `ConsumerProfilePage.tsx` | No ability to edit profile information (name, avatar).                                                            | Add edit profile form or link                           |
| P17 | **Minor** | `ConsumerProfilePage.tsx` | "Join a School" links to `/login` which may confuse already-logged-in users.                                      | Link to a dedicated school-code entry page              |
| P18 | **Minor** | `PracticeModePage.tsx`    | No save confirmation when leaving page with unsaved progress (no `beforeunload` handler).                         | Add `useBeforeUnload` or navigation blocker             |
| P19 | **Minor** | `DashboardPage.tsx`       | "Resume Learning" always shows first space without checking which has actual in-progress state.                   | Sort by last-accessed or filter to in-progress spaces   |
| P20 | **Minor** | `TestAnalyticsPage.tsx`   | Score trend bar chart has no tooltips on hover showing attempt details.                                           | Add hover tooltips                                      |

---

## 5. COMPONENT-LEVEL ANALYSIS

### 5.1 Critical Issues

| #   | Severity     | File:Line                      | Issue                                                                                                                                                                       | Fix                                         |
| --- | ------------ | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| C1  | **Critical** | `MaterialViewer.tsx:52,77,119` | `<iframe>` elements missing `title` attribute. WCAG 2.1 Level A violation — screen readers cannot identify iframe purpose.                                                  | Add descriptive `title` prop to all iframes |
| C2  | **Critical** | `QuestionAnswerer.tsx:100-242` | Answer type casting (`answer as string[]`, `answer as Record<string,string>`) without runtime validation. If answer state gets corrupted, causes runtime crash during exam. | Add runtime type guards before casting      |

### 5.2 Major Issues

| #   | Severity  | File:Line                      | Issue                                                                                                                   | Fix                                                            |
| --- | --------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| C3  | **Major** | `ChatAgentAnswerer.tsx:65-108` | Message container missing `role="log"` and `aria-live="polite"`. Screen reader users won't be notified of new messages. | Add `role="log"` and `aria-live="polite"` to message container |
| C4  | **Major** | `AudioAnswerer.tsx`            | Recording button missing `aria-label`. State changes (recording/stopped) not clearly announced to assistive tech.       | Add dynamic `aria-label` based on recording state              |
| C5  | **Major** | `SpaceReviewSection.tsx:128`   | Textarea has no associated `<label>` element — only `placeholder`. WCAG violation.                                      | Add `<label htmlFor="review-text">` or `aria-label`            |
| C6  | **Major** | `ChatTutorPanel.tsx:71-92`     | Chat message thread missing `role="log"` for accessibility.                                                             | Add `role="log" aria-label="Chat messages"`                    |
| C7  | **Major** | `MaterialViewer.tsx:76`        | PDF viewer iframe has hardcoded `600px` height — not responsive on small screens.                                       | Use `min-h-[400px] h-[60vh]` or responsive units               |

### 5.3 Minor Issues

| #   | Severity  | File:Line                       | Issue                                                                                                        | Fix                            |
| --- | --------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------ |
| C8  | **Minor** | `FeedbackPanel.tsx:69,80,91`    | Uses array index as React key in maps. Low risk (static lists) but not best practice.                        | Use unique IDs where available |
| C9  | **Minor** | `FillBlanksAnswerer.tsx:20-39`  | Uses array `index` as key instead of `blankId`.                                                              | Use `blankId` as key           |
| C10 | **Minor** | `MaterialViewer.tsx:147,161`    | Image `alt=""` on author avatars and rich content images — should have descriptive alt text.                 | Add meaningful alt text        |
| C11 | **Minor** | `SpaceReviewSection.tsx:31-48`  | Star rating buttons could benefit from `role="radio"` + `aria-checked` for clearer screen reader experience. | Add radio-like ARIA semantics  |
| C12 | **Minor** | `AttemptComparison.tsx:138-139` | Grid with 10 columns could be cramped on small mobile screens.                                               | Add responsive column count    |

---

## 6. STYLING & TAILWIND ANALYSIS

### 6.1 Consistency Assessment

**Overall:** Good Tailwind usage across the app. Uses design tokens (bg-card,
text-muted-foreground, border, etc.) consistently.

### 6.2 Issues Found

| #   | Severity  | File:Line                 | Issue                                                                                                                                                | Fix                                                   |
| --- | --------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| S1  | **Major** | `StoreDetailPage.tsx`     | Multiple inline button styles instead of using `<Button>` variants. Inconsistent hover/focus states.                                                 | Replace with `<Button variant="..." size="...">`      |
| S2  | **Minor** | `DashboardPage.tsx:92-94` | LogoutButton uses custom inline classes (`inline-flex h-9 items-center gap-1 rounded-md border px-4...`) — should use Button styling from shared-ui. | Use shared Button component or pass variant prop      |
| S3  | **Minor** | Multiple pages            | Color coding for scores (emerald/yellow/red) is implemented inline in each page rather than via a shared utility.                                    | Create a shared `scoreColorClass(percentage)` utility |
| S4  | **Minor** | `PracticeModePage.tsx`    | Difficulty color coding uses different class patterns than other pages.                                                                              | Standardize via shared utility                        |

---

## 7. Z-INDEX ANALYSIS

| Layer                       | Component                  | z-index              | Conflict?                                                                       |
| --------------------------- | -------------------------- | -------------------- | ------------------------------------------------------------------------------- |
| Mobile Bottom Nav           | `MobileBottomNav.tsx`      | z-50                 | No                                                                              |
| PWA Install Banner          | `PWAInstallBanner.tsx`     | z-50                 | **Potential** — same as bottom nav, but positioned `bottom-16` to avoid overlap |
| SW Update Notification      | `SWUpdateNotification.tsx` | z-[60]               | No — above nav                                                                  |
| Test Sticky Header          | `TimedTestPage.tsx:606`    | z-10                 | No — local scroll context                                                       |
| Sidebar (mobile sheet)      | `sidebar.tsx`              | Radix default (z-50) | **Potential** — could conflict with MobileBottomNav if both visible             |
| Dialog/AlertDialog overlays | Radix defaults             | z-50                 | No — portaled above everything                                                  |

**Verdict:** No critical z-index conflicts. The PWA install banner correctly
uses `bottom-16` offset to avoid overlapping the mobile bottom nav.

---

## 8. RESPONSIVE DESIGN ANALYSIS

### 8.1 Breakpoint Usage

The app uses Tailwind's standard breakpoints (`sm:`, `md:`, `lg:`) consistently:

- **Mobile-first:** Base styles target mobile, with `md:` breakpoints for
  desktop
- **Sidebar:** Hidden on mobile via `md:hidden` / shown via `md:flex`
- **Bottom nav:** `md:hidden` — correctly hidden on desktop
- **Grids:** `md:grid-cols-2`, `lg:grid-cols-4` patterns used appropriately
- **Padding:** `p-3 sm:p-4 md:p-6` progressive padding

### 8.2 Responsive Issues

| #   | Severity  | File:Line                   | Issue                                                                        | Fix                                                                               |
| --- | --------- | --------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| R1  | **Major** | `MaterialViewer.tsx:76`     | PDF iframe `height="600"` — not responsive, will overflow on mobile screens. | Use CSS height: `className="w-full" style={{height: '60vh', minHeight: '300px'}}` |
| R2  | **Minor** | `AttemptComparison.tsx:138` | 10-column grid doesn't scale for very small screens (<360px).                | Add overflow-x-auto or reduce columns on xs                                       |
| R3  | **Minor** | `TimedTestPage.tsx`         | Keyboard shortcuts (M for mark, arrow keys) not documented in mobile UI.     | Add visible hint or help icon on mobile                                           |

---

## 9. STATE MANAGEMENT ANALYSIS

### 9.1 Architecture — GOOD

- **Zustand** for global state: `useAuthStore`, `useTenantStore`,
  `useConsumerStore`
- **TanStack Query** for server state: `useSpaces`, `useExams`, `useProgress`,
  etc.
- **Local useState** for UI state: dialog open/close, form inputs, filters

### 9.2 Issues Found

| #   | Severity  | File:Line                  | Issue                                                                                                                                                                                                                                    | Fix                                                    |
| --- | --------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| ST1 | **Minor** | `AppLayout.tsx:120-135`    | `useEffect` fetches tenant names with `studentMemberships.length` as dependency — this is a primitive value, so it won't trigger unnecessary re-fetches. However, the effect creates a new Promise.all on every membership count change. | Consider using TanStack Query for tenant name fetching |
| ST2 | **Minor** | `StoryPointViewerPage.tsx` | Filter state stored as 4 separate `useState` calls instead of a single filter object.                                                                                                                                                    | Consolidate into `useReducer` or single state object   |

---

## 10. ACCESSIBILITY (a11y) SUMMARY

### 10.1 What's Done Well

- `SkipToContent` in AppLayout
- `RouteAnnouncer` for page transitions in both layouts
- `role="progressbar"` with ARIA attributes on ProgressBar
- `role="timer"` with `aria-live` on CountdownTimer
- `aria-current`, `aria-label` on QuestionNavigator
- `role="alert"` and `role="status"` on NetworkStatusBanner
- `sr-only` text on NotificationBell badge
- `aria-hidden="true"` on decorative icons consistently
- `aria-live="polite"` on FeedbackPanel

### 10.2 What's Missing

| #   | Priority     | Issue                                                                            |
| --- | ------------ | -------------------------------------------------------------------------------- |
| A1  | **Critical** | ConsumerLayout missing `<SkipToContent />` and `id="main-content"`               |
| A2  | **Critical** | Iframe elements missing `title` attribute (MaterialViewer)                       |
| A3  | **Major**    | Chat message containers missing `role="log"` (ChatTutorPanel, ChatAgentAnswerer) |
| A4  | **Major**    | Audio recording button missing `aria-label`                                      |
| A5  | **Major**    | Review textarea missing `<label>` association                                    |
| A6  | **Minor**    | Star rating should use radio group ARIA pattern                                  |
| A7  | **Minor**    | Store view toggle buttons missing `aria-label`                                   |

---

## 11. RECOMMENDED PRIORITY FIXES

### Immediate (Critical — Fix Now)

1. **ConsumerLayout accessibility** — Add `<SkipToContent />`,
   `id="main-content"` wrapper, replace manual theme toggle with
   `<ThemeToggle />` (`ConsumerLayout.tsx`)
2. **Iframe titles** — Add `title` attribute to all iframes in
   `MaterialViewer.tsx`
3. **Login error display** — Ensure auth errors are shown to users
   (`LoginPage.tsx` + auth forms)
4. **Answer type safety** — Add runtime type guards in `QuestionAnswerer.tsx`
5. **Checkout confirmation** — Add AlertDialog before purchase/clear-cart in
   `CheckoutPage.tsx`

### Short-term (Major — Fix This Sprint)

6. **Chat accessibility** — Add `role="log"` to chat containers
7. **PDF responsive height** — Fix hardcoded 600px iframe height
8. **Test auto-submit notification** — Notify student when time expires
9. **Test save error state** — Show error + retry when answer save fails
10. **Leaderboard empty state** — Add empty state component
11. **Study planner date validation** — Validate end > start date
12. **N+1 space progress queries** — Batch progress fetching

### Long-term (Minor — Backlog)

13. Standardize score color utilities across pages
14. Add test status badges to TestsPage
15. Add profile editing to ConsumerProfilePage
16. Add `beforeunload` handler to PracticeModePage
17. Improve "Resume Learning" logic on DashboardPage

---

## 12. FILE INDEX

All analyzed files:

**Layouts:**

- `src/layouts/AppLayout.tsx` — Main B2B student layout
- `src/layouts/AuthLayout.tsx` — Login/auth layout
- `src/layouts/ConsumerLayout.tsx` — B2C consumer layout

**Pages (18):**

- `src/pages/DashboardPage.tsx`
- `src/pages/SpacesListPage.tsx`
- `src/pages/SpaceViewerPage.tsx`
- `src/pages/StoryPointViewerPage.tsx`
- `src/pages/TimedTestPage.tsx`
- `src/pages/PracticeModePage.tsx`
- `src/pages/TestsPage.tsx`
- `src/pages/TestAnalyticsPage.tsx`
- `src/pages/ExamResultPage.tsx`
- `src/pages/ProgressPage.tsx`
- `src/pages/LeaderboardPage.tsx`
- `src/pages/ChatTutorPage.tsx`
- `src/pages/AchievementsPage.tsx`
- `src/pages/StudyPlannerPage.tsx`
- `src/pages/NotificationsPage.tsx`
- `src/pages/ConsumerDashboardPage.tsx`
- `src/pages/StoreListPage.tsx`
- `src/pages/StoreDetailPage.tsx`
- `src/pages/CheckoutPage.tsx`
- `src/pages/ConsumerProfilePage.tsx`
- `src/pages/LoginPage.tsx`

**Components (34):**

- `src/components/questions/` — 16 answerer components + index
- `src/components/common/` — FeedbackPanel, ProgressBar, EmptyState,
  SectionErrorBoundary
- `src/components/auth/` — SchoolCodeForm, SchoolCredentialsForm,
  ConsumerLoginForm, ConsumerSignupForm
- `src/components/chat/` — ChatTutorPanel
- `src/components/materials/` — MaterialViewer
- `src/components/dashboard/` — RecommendationsSection
- `src/components/leaderboard/` — LeaderboardTable
- `src/components/analytics/` — AttemptComparison
- `src/components/spaces/` — SpaceReviewSection
- `src/components/test/` — CountdownTimer, QuestionNavigator,
  NetworkStatusBanner

**Shared-UI (key files):**

- `packages/shared-ui/src/components/layout/AppShell.tsx`
- `packages/shared-ui/src/components/layout/MobileBottomNav.tsx`
- `packages/shared-ui/src/components/layout/NotificationBell.tsx`
- `packages/shared-ui/src/components/ui/sidebar.tsx`
- `packages/shared-ui/src/components/ui/dialog.tsx`
- `packages/shared-ui/src/components/ui/sheet.tsx`
- `packages/shared-ui/src/components/ui/alert-dialog.tsx`
- `packages/shared-ui/src/components/ui/theme-toggle.tsx`
