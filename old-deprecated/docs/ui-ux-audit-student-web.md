# UI/UX Audit Report: Student-Web Application

**Date:** March 2026 **Auditor:** UI/UX Design Agent **App Path:**
`apps/student-web/` **Tech Stack:** React 18, Vite + SWC, Tailwind CSS 3.4,
shadcn/ui (shared-ui), Firebase, React Router v7, TanStack React Query, Lucide
icons

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Current State Analysis](#current-state-analysis)
4. [Issues Found](#issues-found)
   - [Critical Issues](#critical-issues)
   - [Major Issues](#major-issues)
   - [Minor Issues](#minor-issues)
5. [Page-by-Page Analysis & Recommendations](#page-by-page-analysis--recommendations)
6. [Component-Level Analysis](#component-level-analysis)
7. [Navigation & Information Architecture](#navigation--information-architecture)
8. [Accessibility Audit](#accessibility-audit)
9. [Responsive & Mobile Strategy](#responsive--mobile-strategy)
10. [Visual Consistency & Design System Adherence](#visual-consistency--design-system-adherence)
11. [Interaction & Motion Design](#interaction--motion-design)
12. [Loading, Empty & Error States](#loading-empty--error-states)
13. [Redesign Recommendations](#redesign-recommendations)
14. [Implementation Roadmap](#implementation-roadmap)

---

## Executive Summary

The Student-Web app is a feature-rich learning platform serving two user
personas: **B2B students** (enrolled via school codes) and **B2C consumers**
(self-service learners via a store). It provides dashboards, learning spaces,
timed tests, practice modes, leaderboards, AI tutoring, exam results, and a
storefront.

### Strengths

- **Strong feature set**: Dashboard, spaces, tests, practice mode, leaderboard,
  AI tutor, store — the app covers the full student learning journey
- **Good data architecture**: TanStack React Query with Firebase provides
  consistent data fetching patterns
- **Decent skeleton loading**: Most pages include animate-pulse skeletons during
  data loading
- **Functional layout system**: Uses shared AppShell/AppSidebar for consistent
  chrome
- **Diverse question types**: Supports 15+ question types (MCQ, code, audio,
  matching, etc.)

### Critical Weaknesses

- **No dark mode support**: Despite HSL custom properties being defined only for
  `:root` (light), no `.dark` theme exists — hardcoded colors like `bg-gray-50`,
  `bg-white`, `bg-blue-50` throughout
- **Poor accessibility**: Missing ARIA labels, no focus management, inadequate
  keyboard navigation, raw `<select>` and `<input>` elements without shadcn/ui
  counterparts
- **Inconsistent component usage**: Raw HTML `<input>`, `<select>`, `<button>`
  used everywhere instead of shared-ui components (Input, Select, Button)
- **No responsive design strategy**: Zero mobile breakpoint considerations —
  test pages, chat panels, and sidebars will break on mobile
- **Hardcoded color values**: Extensive use of `bg-gray-100`, `bg-blue-50`,
  `bg-white`, `text-gray-700` bypassing the design token system

### Overall Score: **5.5/10** — Functional but needs significant polish for production readiness.

---

## Architecture Overview

### Route Structure (App.tsx)

```
/login                                     → LoginPage (AuthLayout)
── B2B Routes (RequireAuth: student role) ──
/                                          → DashboardPage (AppLayout)
/spaces                                    → SpacesListPage
/spaces/:spaceId                           → SpaceViewerPage
/spaces/:spaceId/story-points/:id          → StoryPointViewerPage
/spaces/:spaceId/test/:id                  → TimedTestPage
/spaces/:spaceId/practice/:id              → PracticeModePage
/results                                   → ProgressPage
/exams/:examId/results                     → ExamResultPage
/notifications                             → NotificationsPage
/leaderboard                               → LeaderboardPage
/tests                                     → TestsPage
/chat                                      → ChatTutorPage
── B2C Routes (RequireAuth: any logged in) ──
/consumer                                  → ConsumerDashboardPage (ConsumerLayout)
/my-spaces                                 → ConsumerDashboardPage
/consumer/spaces/:spaceId                  → SpaceViewerPage
/consumer/spaces/:spaceId/story-points/:id → StoryPointViewerPage
/consumer/spaces/:spaceId/test/:id         → TimedTestPage
/consumer/spaces/:spaceId/practice/:id     → PracticeModePage
/store                                     → StoreListPage
/store/checkout                            → CheckoutPage
/store/:spaceId                            → StoreDetailPage
/profile                                   → ConsumerProfilePage
*                                          → NotFoundPage
```

### Layout Architecture

| Layout           | Description                                             | Components Used      |
| ---------------- | ------------------------------------------------------- | -------------------- |
| `AuthLayout`     | Centered card, `min-h-screen`, `bg-muted/40`            | Minimal wrapper      |
| `AppLayout`      | AppShell + AppSidebar + NotificationBell + RoleSwitcher | shared-ui components |
| `ConsumerLayout` | AppShell + AppSidebar (simpler nav, cart badge)         | shared-ui components |

### Component Organization

```
src/
├── components/
│   ├── chat/          ChatTutorPanel (1 component)
│   ├── common/        ProgressBar, FeedbackPanel (2 components)
│   ├── dashboard/     RecommendationsSection (1 component)
│   ├── materials/     MaterialViewer (1 component, 6 sub-renderers)
│   ├── questions/     15 answerer components + QuestionAnswerer orchestrator
│   └── test/          QuestionNavigator, CountdownTimer (2 components)
├── hooks/             6 custom hooks
├── layouts/           3 layout components
├── guards/            RequireAuth
├── pages/             17 page components
└── lib/               cn() utility
```

---

## Current State Analysis

### Design System Adherence

| Criterion                 | Score | Notes                                                                                                                              |
| ------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Uses shared-ui components | 3/10  | Only AppShell, AppSidebar, ScoreCard, ProgressRing, LogoutButton, NotificationBell, NotificationsPage used; all forms use raw HTML |
| Tailwind token usage      | 4/10  | Uses `text-muted-foreground`, `bg-card`, `border` tokens but also hardcodes `bg-gray-50`, `bg-white`, `bg-blue-50` extensively     |
| Dark mode ready           | 1/10  | No `.dark` CSS variables; 80+ hardcoded color instances that would break in dark mode                                              |
| Consistent spacing        | 6/10  | Mostly uses `space-y-6`, `gap-4`, `p-4/5/6` but inconsistent between pages                                                         |
| Typography scale          | 5/10  | Good use of `text-2xl font-bold` for h1, `text-sm` for body, but no heading component                                              |
| Icon consistency          | 8/10  | Lucide icons used exclusively and correctly                                                                                        |

### Component Reuse Patterns

**Good reuse:**

- `ProgressBar` — used on Dashboard, SpaceViewer, PracticeMode, Progress,
  ExamResult pages
- `QuestionAnswerer` — orchestrates all 15+ question types via a single
  component
- `ChatTutorPanel` — reused on StoryPointViewer, PracticeMode, ChatTutor pages
- `FeedbackPanel` — reused across question evaluation flows

**Missing reuse opportunities:**

- Breadcrumb navigation is implemented inline with raw `<nav>` + `<Link>` chains
  on 6+ pages — should be a shared `Breadcrumb` component
- Space cards appear in 3 different forms (DashboardSpaceCard, SpaceCard,
  SpaceProgressCard) with duplicated layouts
- "Loading skeleton" pattern is copy-pasted everywhere — should be a `Skeleton`
  component from shared-ui
- Button styles are repeated inline ~40 times — should use shadcn Button
  component
- Input styles are copied ~15 times — should use shadcn Input component

---

## Issues Found

### Critical Issues

#### C1: No Dark Mode Support

**Impact:** High — Users in dark environments get a fully-white UI with no way
to switch **Location:** `src/index.css` (lines 5-46), all pages **Details:**

- CSS only defines `:root` variables (light theme) — no `.dark` class variant
- 80+ instances of hardcoded colors: `bg-gray-50`, `bg-gray-100`, `bg-gray-200`,
  `bg-white`, `bg-blue-50`, `bg-red-50`, etc.
- `TimedTestPage.tsx:382` has `bg-white` hardcoded on the sticky timer bar
- `ChatTutorPanel.tsx:44` has `bg-white` on the panel itself
- The confirmation dialog in `TimedTestPage.tsx:444` uses `bg-white` and
  `bg-black/50`

**Recommendation:**

1. Add `.dark` CSS custom property block to `index.css`
2. Replace all hardcoded color classes with token-aware equivalents (`bg-muted`,
   `bg-card`, `bg-accent`)
3. Add theme toggle via next-themes (already available in shared packages)

#### C2: Raw HTML Elements Instead of Design System Components

**Impact:** High — Inconsistent styling, no accessibility features, maintenance
burden **Location:** Every form and interactive page **Details:**

- **Buttons:** ~40 instances of raw `<button>` with inline Tailwind classes
  instead of `<Button>` from shared-ui
  - `LoginPage.tsx` lines 167-173, 277-283, 330-333, 431-437
  - `TimedTestPage.tsx` lines 296-303, 400-406, 408-414, 416-421, 423-428,
    432-437
  - `PracticeModePage.tsx` lines 226-229, 232-238
- **Inputs:** ~15 instances of raw `<input>` with inline Tailwind instead of
  `<Input>` from shared-ui
  - `LoginPage.tsx` lines 156-164, 247-258, 266-274
  - `StoreListPage.tsx` lines 89-95
  - `ChatTutorPanel.tsx` lines 104-110
- **Selects:** Raw `<select>` elements in `LeaderboardPage.tsx:141-153`,
  `StoreListPage.tsx:98-108`
- **Dialogs:** Raw `<div>` with `fixed inset-0` in `TimedTestPage.tsx:442-474`
  instead of `<Dialog>` from shared-ui

**Recommendation:** Replace all raw elements with shadcn/ui components:

- `<Button variant="..." size="...">` for all buttons
- `<Input>` for all text/email/password inputs
- `<Select>` for all dropdowns
- `<Dialog>` / `<AlertDialog>` for confirmation modals

#### C3: Missing Keyboard Navigation and Focus Management

**Impact:** High — App is largely unusable for keyboard-only users **Location:**
Global **Details:**

- Test navigation (`TimedTestPage.tsx`): No keyboard shortcuts for
  Next/Previous/Submit — arrow keys don't work
- Question grid navigation: Tab order is undefined for 100+ question buttons
- Chat panel (`ChatTutorPanel.tsx`): No focus trap — Tab can escape behind the
  panel overlay
- Login page: No focus-on-mount for the first input
- Practice mode difficulty filters: No `role="radiogroup"` or arrow key
  navigation
- Store space cards: Card hover states not reflected on focus

**Recommendation:**

- Add keyboard shortcuts (arrow keys) for test question navigation
- Add focus trap to ChatTutorPanel and confirmation dialogs
- Add `role="tablist"` to tab-like interfaces (ProgressPage tabs, login method
  toggle)
- Add `autoFocus` to first form fields
- Add `onKeyDown` arrow-key handling to radio-button-like filter groups

#### C4: Missing ARIA Attributes Throughout

**Impact:** High — Screen reader users cannot navigate the app effectively
**Location:** Global **Details:**

- ProgressBar has no `role="progressbar"`, `aria-valuenow`, `aria-valuemin`,
  `aria-valuemax`
- CountdownTimer has no `role="timer"`, `aria-live="polite"`, `aria-label`
- QuestionNavigator buttons have no `aria-current`, `aria-label` for status
- Login method toggle has no `role="tablist"` / `role="tab"` / `aria-selected`
- ProgressPage tabs have no ARIA tab pattern
- Chat messages have no `role="log"`, individual messages lack `role="listitem"`
- Score values on DashboardPage lack `aria-label` context
- Breadcrumb navs lack `aria-label="Breadcrumb"`

**Recommendation:** Systematic ARIA pass — add roles and labels to all
interactive and informational components.

### Major Issues

#### M1: No Mobile Responsive Layout

**Impact:** Medium-High — App is completely broken on mobile devices
**Location:** Multiple pages **Details:**

- `TimedTestPage.tsx` test view: Side-by-side layout
  (`flex gap-4 h-[calc(100vh-4rem)]`) with fixed `w-52` sidebar — no mobile
  breakpoint
- `StoryPointViewerPage.tsx`: Side-by-side `flex gap-6` layout with `w-48`
  sidebar — no responsive collapse
- `ChatTutorPanel.tsx`: Fixed `w-96` right panel — would extend off-screen on
  mobile
- DashboardPage: `grid md:grid-cols-2 lg:grid-cols-4` works but cards are too
  dense on tablet
- Test controls bar: `flex items-center gap-2` with 5 buttons wraps awkwardly on
  small screens

**Recommendation:**

- Add mobile-first layouts with collapsible sidebars
- Convert ChatTutorPanel to full-screen sheet on mobile (use `<Sheet>` from
  shared-ui)
- Stack test controls vertically on mobile
- Add `lg:` breakpoint for test question navigator visibility

#### M2: Inconsistent Error Handling UX

**Impact:** Medium — Users may not understand what went wrong **Location:**
Multiple pages **Details:**

- `LoginPage.tsx`: Error messages are well-styled with `bg-destructive/10`
- `TimedTestPage.tsx:157-159`: Empty `catch {}` blocks — errors silently
  swallowed
- `PracticeModePage.tsx:103-104`: Empty `catch {}` — evaluation failures
  invisible to user
- `StoryPointViewerPage.tsx:49-51`: `catch {}` silently ignores answer
  evaluation errors
- `PracticeModePage.tsx:68-69`: RTDB write failures silently caught
- `StoreListPage.tsx:117-120`: Has error display — good
- No global error toast/notification system for async operations

**Recommendation:**

- Add `sonner` toast notifications (available in shared-ui) for all async error
  cases
- Replace empty `catch {}` blocks with user-visible error feedback
- Add error boundaries per page section (not just the global one)

#### M3: Inadequate Loading States

**Impact:** Medium — Skeleton loaders exist but are inconsistent and primitive
**Location:** Multiple pages **Details:**

- Current pattern:
  `<div className="h-24 animate-pulse rounded-lg border bg-gray-100" />` — plain
  gray rectangles
- No semantic structure in skeletons (they don't match the actual content shape)
- `ConsumerDashboardPage.tsx:91-93`: Plain text "Loading your spaces..." — no
  skeleton
- `StoreDetailPage.tsx:88-92`: Plain text "Loading space details..." — no
  skeleton
- `StoreListPage.tsx:112-115`: Plain text "Loading spaces..." — no skeleton
- `RequireAuth.tsx:14-18`: Just "Loading..." text during auth check — should be
  a full-screen spinner or branded splash
- No `Skeleton` component from shared-ui being used anywhere

**Recommendation:**

- Use `<Skeleton>` component from shared-ui for content-shaped placeholders
- Create page-specific skeleton layouts that match the final content structure
- Add a branded loading screen for the initial auth check

#### M4: Test Timer Sticky Bar Accessibility and Dark Mode Issue

**Impact:** Medium — Timer bar has hardcoded `bg-white` and lacks ARIA
attributes **Location:** `TimedTestPage.tsx:382` **Details:**

```tsx
<div className="flex items-center justify-between mb-4 sticky top-0 bg-white z-10 py-2 border-b">
```

- `bg-white` breaks dark mode
- No `aria-live` region for the timer
- No screen reader announcement for time warnings (5 min, 1 min)

#### M5: Login Page Is Overly Complex — Single Component with 460+ Lines

**Impact:** Medium — Maintenance difficulty, no code splitting **Location:**
`LoginPage.tsx` (463 lines, ~30 state variables) **Details:**

- Four separate views (`school-code`, `credentials`, `consumer-login`,
  `consumer-signup`) in one component
- All form inputs use raw HTML instead of shared-ui form components
- No form validation library (react-hook-form + Zod available in project)
- No password strength indicator for consumer signup
- No "Forgot Password" flow
- No email format validation beyond HTML `type="email"`
- Consumer signup doesn't confirm password

**Recommendation:**

- Split into `SchoolCodeForm`, `SchoolCredentialsForm`, `ConsumerLoginForm`,
  `ConsumerSignupForm` components
- Use react-hook-form + Zod for validation
- Add password strength indicator
- Add "Forgot Password" link
- Add password confirmation for signup

#### M6: Chat Tutor Panel Not Accessible as Overlay

**Impact:** Medium — Panel sits on top of content without proper focus trap or
backdrop **Location:** `ChatTutorPanel.tsx` **Details:**

- Uses `fixed inset-y-0 right-0 w-96` — a slide-over panel
- No backdrop/overlay to indicate modal behavior
- No focus trap — keyboard can escape behind the panel
- No `aria-modal`, `role="dialog"`, `aria-label`
- Content behind the panel is still interactive
- On mobile, the `w-96` (384px) panel takes up the entire viewport or overflows

**Recommendation:**

- Use `<Sheet>` component from shared-ui (which wraps Radix Dialog with
  slide-over behavior)
- Provides focus trap, backdrop, ARIA attributes, and mobile-friendly sizing out
  of the box

### Minor Issues

#### m1: Breadcrumb Navigation is Inconsistent

**Location:** SpaceViewerPage, StoryPointViewerPage, TimedTestPage,
PracticeModePage, ExamResultPage **Details:** Each page implements its own
breadcrumb with slightly different markup:
`<nav className="text-xs text-muted-foreground">` with inline links and `/`
separators.

**Recommendation:** Create a `<Breadcrumb>` component or use the one from
shared-ui if available.

#### m2: Space Card Component Duplication

**Location:** DashboardPage (`DashboardSpaceCard`), SpacesListPage
(`SpaceCard`), ProgressPage (`SpaceProgressCard`) **Details:** Three separate
card components rendering similar space data with different layouts. Each
fetches progress independently.

**Recommendation:** Create a single
`<SpaceCard variant="compact" | "full" | "progress">` component.

#### m3: Consumer Layout Missing NotificationBell

**Location:** `ConsumerLayout.tsx` **Details:** B2B `AppLayout` has
`NotificationBell` in the header, but `ConsumerLayout` has no header-right
content. Consumer users get no notification indicator.

#### m4: Hardcoded Subject List in Store Filter

**Location:** `StoreListPage.tsx:99-108` **Details:** Subject options are
hardcoded: `math`, `science`, `english`, `history`. Should be dynamic from API.

#### m5: "Download PDF" Uses `window.print()`

**Location:** `ExamResultPage.tsx:274-280` **Details:** The "Download PDF"
button just calls `window.print()`. This is a poor UX — the button label
promises a PDF but gives a print dialog.

**Recommendation:** Either rename to "Print Results" or implement actual PDF
generation.

#### m6: No Animation/Transition Between Page Views

**Location:** `TimedTestPage.tsx` (landing → test → results views) **Details:**
View transitions happen via state change with no animation. Moving from the test
to results feels abrupt.

#### m7: Confirmation Dialog in TimedTestPage is Custom, Not Using shared-ui

**Location:** `TimedTestPage.tsx:442-474` **Details:** The submit confirmation
uses a raw fixed overlay with `bg-black/50`. Should use `<AlertDialog>` from
shared-ui.

#### m8: `(exam as any)` Type Assertions in DashboardPage

**Location:** `DashboardPage.tsx:50-61` **Details:** Multiple `(exam as any)`
casts for `scheduledAt` and `startDate` — indicates type definitions may be
incomplete or there's a Firestore timestamp handling gap.

#### m9: Missing "Back" Navigation on Several Pages

**Location:** Various **Details:** Pages like `LeaderboardPage`, `TestsPage`,
`ChatTutorPage` have no back/breadcrumb navigation — the only way back is the
sidebar.

#### m10: Consumer Store Link Goes to Wrong Route

**Location:** `StoreListPage.tsx:210-215` **Details:** The "Continue Learning"
button for enrolled spaces links to `/spaces/${space.id}` instead of
`/consumer/spaces/${space.id}`, which would fail the B2C route matching.

---

## Page-by-Page Analysis & Recommendations

### 1. LoginPage (`/login`)

**Current State:**

- Multi-step login flow (school code → credentials; or consumer login/signup)
- Clean centered layout via AuthLayout
- Method toggle (Roll Number / Email) uses custom tab-like buttons
- All inputs are raw HTML with inline Tailwind
- Error messages well-positioned above forms
- Google sign-in available for consumers

**Issues:**

- 460+ lines in single component — needs decomposition
- No form validation (react-hook-form + Zod)
- No password visibility toggle
- No "Forgot Password" link
- Consumer signup has no password confirmation
- No password strength indicator
- Tab-like toggle lacks ARIA `role="tablist"`
- No loading spinner on Google OAuth button

**Redesign Recommendations:**

1. Split into 4 sub-components (one per view) managed by a state machine
2. Use shared-ui `<Input>`, `<Button>`, `<Label>` components
3. Add react-hook-form + Zod schemas for validation
4. Add password visibility toggle (eye icon)
5. Add "Forgot Password" flow
6. Add password confirmation + strength meter for signup
7. Add ARIA roles to the login method toggle
8. Add branded logo/illustration to the AuthLayout card
9. Add `autoFocus` to the first field in each form step

### 2. DashboardPage (`/`)

**Current State:**

- Greeting header with user name and logout button
- 4 ScoreCards (Overall Score, Avg Exam, Space Completion, Streak)
- Strengths & Weaknesses chips
- Quick Stats card
- Recent Exam Results table
- Upcoming Exams list with date/time
- Recommendations section
- My Spaces grid with progress bars
- Fallback stats when no summary data

**Issues:**

- Logout button in top-right with `<LogOut>` icon — good placement but custom
  styling instead of `<Button variant="outline">`
- Strengths/Weaknesses use hardcoded `bg-green-100 text-green-700` and
  `bg-red-100 text-red-700` — not dark-mode safe
- Skeleton loading uses primitive gray boxes
- DashboardSpaceCard is defined inline at bottom of file
- Upcoming exams section uses `(exam as any)` type casts
- No welcome animation or personality

**Redesign Recommendations:**

1. Add a warm welcome banner with time-of-day greeting, streak badge, and
   motivational message
2. Use `<Badge variant="success">` for strengths,
   `<Badge variant="destructive">` for weaknesses
3. Add progress ring animation for the overall score
4. Make exam result items clickable → link to `/exams/:examId/results`
5. Add "Continue where you left off" section showing the last-accessed
   space/story-point
6. Move DashboardSpaceCard to its own file
7. Use `<Card>` component for all card elements
8. Add confetti or celebration micro-interaction when streak increases
9. Add relative time ("3 days away") for upcoming exams

### 3. SpacesListPage (`/spaces`)

**Current State:**

- Page title "My Spaces"
- Grid layout: `md:grid-cols-2 lg:grid-cols-3`
- SpaceCard with thumbnail, title, description, subject, stats, progress bar
- Skeleton loading (3 pulsing rectangles)
- Empty state with BookOpen icon

**Issues:**

- No search or filter functionality
- No sort options (by name, progress, last accessed)
- SpaceCard defined inline (not shared)
- Thumbnail image has `alt=""` — should be descriptive
- No indication of new/updated spaces

**Redesign Recommendations:**

1. Add search bar and subject filter dropdown
2. Add sort options: "Last Accessed", "Progress", "A-Z"
3. Add "New" badge for recently-added spaces
4. Add view toggle (grid/list)
5. Make SpaceCard a shared component
6. Use `<Card>` from shared-ui for consistent styling
7. Add completion checkmark overlay on 100% progress cards

### 4. SpaceViewerPage (`/spaces/:spaceId`)

**Current State:**

- Breadcrumb (inline `<nav>`)
- Space title, description, overall progress bar
- Story point list with type icons, metadata, progress indicators
- Test story points show "Start Test" or "Completed" badge
- Standard/quiz story points show progress bar
- Practice story points show X/Y solved count

**Issues:**

- Breadcrumb implemented inline — should use shared component
- No thumbnail/header image for the space
- Story point cards are dense — all rendered vertically with minimal visual
  hierarchy
- No indication of recommended next step
- No section grouping if space has many story points
- `StoryPointCard` is defined inline
- Progress bar max-width is `max-w-md` but could use full width

**Redesign Recommendations:**

1. Add a hero section with space thumbnail, title, description, and overall
   stats
2. Group story points by section if sections exist (with collapsible sections)
3. Highlight the "recommended next" story point (first incomplete)
4. Add completion celebration when space reaches 100%
5. Show estimated total time remaining
6. Add a mini-map/progress indicator for story point sequence

### 5. StoryPointViewerPage (`/spaces/:spaceId/story-points/:storyPointId`)

**Current State:**

- Optional sidebar for section navigation (`w-48`)
- Breadcrumb navigation
- Items rendered as cards (materials and questions)
- QuestionAnswerer for questions with "Ask AI Tutor" button
- MaterialViewer for materials (text, video, PDF, link, interactive, rich)
- ChatTutorPanel slide-over when activated

**Issues:**

- Sidebar layout is not responsive — `w-48` is fixed
- Section buttons use custom active styling instead of shared-ui pattern
- Items layout is a flat list — no clear visual progression
- Material and question cards look identical (same border/bg-card)
- Item type icons (FileText, HelpCircle) are small and easily missed
- No "scroll to next item" or step-through navigation
- No completion celebration per item
- ChatTutorPanel has no backdrop — content behind is interactive

**Redesign Recommendations:**

1. Add visual differentiation between material cards (softer, no border) and
   question cards (interactive, border + bg)
2. Add sequential numbering for items: "1 of 12"
3. Add a sticky progress indicator at the top showing completion
4. Convert section sidebar to a dropdown on mobile
5. Add "Next Item" / "Previous Item" navigation at the bottom
6. Add completion checkmarks and a progress breadcrumb trail
7. Use `<Sheet>` for ChatTutorPanel

### 6. TimedTestPage (`/spaces/:spaceId/test/:storyPointId`)

**Current State:** Three views: **Landing**, **Test**, **Results**

**Landing View:**

- Test info card with icon, title, instructions
- 2x2 grid showing duration, questions, points, max attempts
- Start Test button
- Previous attempts list

**Test View:**

- Left sidebar: QuestionNavigator (5-column grid, color-coded)
- Center: Question with timer bar (sticky)
- Bottom controls: Previous, Save & Next, Mark for Review, Clear, Submit
- Submit confirmation dialog (custom overlay)

**Results View:**

- Score summary (percentage, points, answered count)
- Per-question breakdown
- Topic analysis with progress bars
- Navigation buttons

**Issues:**

- **Critical:** `bg-white` on sticky timer bar breaks dark mode
- **Critical:** Custom confirmation dialog instead of `<AlertDialog>`
- Test view height `h-[calc(100vh-4rem)]` — good but no mobile layout
- Controls bar with 5 buttons is cramped on smaller screens
- No keyboard shortcuts for test navigation (common exam UI pattern)
- QuestionNavigator grid is fixed `grid-cols-5` — doesn't scale well for 50+
  questions
- Results page has no "share results" or "review answers" feature
- No animation when transitioning between views
- `bg-blue-50` sections in instructions break dark mode

**Redesign Recommendations:**

1. Replace custom dialog with `<AlertDialog>` from shared-ui
2. Add keyboard shortcuts: ←/→ for prev/next, `m` for mark, `s` for submit
3. Make controls bar responsive — stack vertically on mobile
4. Add an `aria-live` region for timer updates
5. Add smooth view transitions (Framer Motion or CSS transitions)
6. Add a "Review All" mode in results showing correct answers
7. Replace `bg-white` with `bg-background`
8. Add sound/haptic feedback for timer warnings
9. Make question navigator scrollable with a sticky header for large tests

### 7. PracticeModePage (`/spaces/:spaceId/practice/:storyPointId`)

**Current State:**

- Header with Dumbbell icon, title, solved count
- Progress bar
- Difficulty filter (Easy/Medium/Hard pill buttons)
- Question number grid (color-coded: green=correct, red=incorrect)
- Current question card with QuestionAnswerer
- Previous/Next navigation
- ChatTutorPanel on demand

**Issues:**

- Difficulty filter buttons use hardcoded `bg-blue-500 text-white` /
  `bg-gray-100 text-gray-600`
- Question number grid uses `h-8 w-8` buttons — too small for touch targets
- No animation on correct/incorrect answer
- No "skip" or "shuffle" option
- No hint system before using AI tutor
- No celebration on completing all questions

**Redesign Recommendations:**

1. Add confetti animation on 100% completion
2. Add a "streak" counter for consecutive correct answers
3. Add "Show Hint" button before full AI tutor chat
4. Use `<Badge>` for difficulty filter instead of custom pills
5. Add gamification: XP gained per question, sound effects option
6. Make question grid buttons larger (40px min for WCAG touch target)
7. Add "Shuffle Questions" option
8. Show time spent per question

### 8. ProgressPage (`/results`)

**Current State:**

- Three tabs: Overall, Exams, Spaces
- Overall: ScoreCards + ProgressRing subject breakdown
- Exams: HTML `<table>` with exam results
- Spaces: SpaceProgressCard list with status badges

**Issues:**

- Tabs implemented with custom buttons instead of `<Tabs>` from shared-ui
- Exams tab uses raw `<table>` — should use `<Table>` from shared-ui
- No date column in exams table
- No data visualization (charts/graphs for progress over time)
- SpaceProgressCard is inline — not shared
- No "View Details" link on exam rows

**Redesign Recommendations:**

1. Use `<Tabs>` from shared-ui for tab navigation
2. Use `<Table>` from shared-ui for exam results
3. Add trend charts using recharts (already in dependencies)
4. Add "View Details" link on exam rows → `/exams/:examId/results`
5. Add time-based filters (this week, this month, all time)
6. Add comparative metrics (class average vs. individual)
7. Add downloadable progress report

### 9. LeaderboardPage (`/leaderboard`)

**Current State:**

- Header with trophy icon and user's current rank
- Space filter dropdown (raw `<select>`)
- Leaderboard table with rank icons (Crown, Medal)
- Current user row highlighted with `bg-blue-50`

**Issues:**

- Raw `<select>` element — should use shared-ui `<Select>`
- `bg-blue-50` hardcoded highlight — not dark-mode safe
- No avatar display (field exists but not rendered)
- No pagination for large leaderboards
- No rank change indicators (up/down arrows)
- Empty state icon is `text-gray-300` — should use token color

**Redesign Recommendations:**

1. Use `<Select>` from shared-ui for space filter
2. Add avatar circles for each entry
3. Add rank change indicators (green up arrow, red down arrow)
4. Add top-3 podium visualization
5. Add class/group filter in addition to space filter
6. Highlight current user with `bg-primary/5` instead of hardcoded blue
7. Add "View My Position" button to scroll to current user

### 10. TestsPage (`/tests`)

**Current State:**

- Lists all timed tests across all spaces
- TestCard with space name, duration, questions, max attempts
- Skeleton loading

**Issues:**

- No filter or sort options
- No indication of attempted/completed tests
- No grouping by space
- TestCard defined inline — not shared
- SpaceTests component makes N+1 queries (one per space)

**Redesign Recommendations:**

1. Group tests by space with collapsible sections
2. Add status indicators: Not started, In Progress, Completed
3. Add "Best Score" display for completed tests
4. Add "Due Date" if applicable
5. Add filter: All / Not Attempted / Completed
6. Batch story point queries to reduce N+1

### 11. ChatTutorPage (`/chat`)

**Current State:**

- Lists previous chat sessions
- Session cards show title, last message preview, message count, date
- Opens ChatTutorPanel when clicked
- Empty state with helpful instructions

**Issues:**

- No way to start a new chat from this page (only from question contexts)
- No search functionality for finding past conversations
- No delete/archive option for old sessions
- ChatTutorPanel opens as overlay — should be full-screen on this page
- Session date uses `toLocaleDateString()` — no relative time

**Redesign Recommendations:**

1. Add a full chat interface (not slide-over) when viewing from this page
2. Add search bar for sessions
3. Add "Archive" swipe action on sessions
4. Show relative time ("2 days ago") instead of absolute dates
5. Group sessions by space/question
6. Add a "New Chat" button for general questions (not tied to a specific
   question)

### 12. NotificationsPage (`/notifications`)

**Current State:**

- Delegates entirely to `<NotificationsPageUI>` from shared-ui
- Passes filter, handlers, and data through props
- Well-structured with filter toggle (all/unread)

**Issues:**

- Almost none — this is one of the best-implemented pages since it uses the
  shared component
- Could add real-time notification updates (currently requires page refresh)

**Redesign Recommendations:**

1. Add real-time notification subscription for instant updates
2. Add notification preferences/settings link
3. Add notification categories (tests, assignments, announcements)

### 13. ExamResultPage (`/exams/:examId/results`)

**Current State:**

- Award icon with pass/fail coloring
- Grade badge (A+, B, C, etc.) with color coding
- 3-column stat grid (Score %, Marks, Graded count)
- Progress bar
- Per-question breakdown with correctness icons
- Strengths/weaknesses feedback per question
- Recommended practice topics from missing concepts
- "Download PDF" button (actually calls `window.print()`)
- Back to Results link

**Issues:**

- "Download PDF" is misleading — actually calls `window.print()`
- Per-question cards don't show the actual question text
- No "Review Full Question" expand/collapse
- Feedback sections use hardcoded colors
- No chart visualization of topic performance

**Redesign Recommendations:**

1. Rename "Download PDF" to "Print Results" or implement actual PDF generation
2. Add expandable question cards showing the full question + student's answer +
   correct answer
3. Add a radar/spider chart for topic breakdown
4. Add sharing functionality (share result link)
5. Add "Practice Weak Areas" CTA linking to relevant practice modes
6. Add comparison to class average

### 14. Consumer Pages (Dashboard, Store, Detail, Checkout, Profile)

**ConsumerDashboardPage:**

- Clean 3-column stat cards (Plan, Enrolled, Spend)
- Enrolled spaces grid with thumbnails
- Empty state with CTA to store
- Issue: Space cards don't show progress

**StoreListPage:**

- Search + subject filter
- Space cards with thumbnail, description, labels, price, stats
- Add to Cart / Remove / Continue Learning buttons
- Load More pagination link
- Issue: Subject filter is hardcoded; no skeleton loading; filter is client-side
  only

**StoreDetailPage:**

- Hero image + title + metadata
- Course content preview list with numbered items
- Enroll/Add to Cart CTA
- Issue: Long page with no table of contents; no reviews/ratings

**CheckoutPage:**

- Cart items with thumbnail, title, price, remove button
- Order summary sidebar
- Sequential purchase processing
- Success state with CTAs
- Issue: No real payment integration; sequential purchase is slow for multiple
  items

**ConsumerProfilePage:**

- Account info with avatar placeholder
- Plan/Enrolled/Spent stats
- "Join a School" CTA
- Purchase history list
- Issue: No edit profile functionality; no plan upgrade option

**Common Consumer Issues:**

- Consumer store link goes to B2B route (`/spaces/` instead of
  `/consumer/spaces/`)
- No breadcrumbs on consumer pages
- No loading states on consumer dashboard

---

## Component-Level Analysis

### ProgressBar (`components/common/ProgressBar.tsx`)

**Score: 6/10**

- Good API: `value`, `max`, `label`, `showPercent`, `size`, `color`
- Uses hardcoded `bg-gray-200` for track — not dark-mode safe
- Missing ARIA: `role="progressbar"`, `aria-valuenow`, `aria-valuemin`,
  `aria-valuemax`
- No animation on value changes (has `transition-all` but initial render has no
  animation)
- Consider: Use `<Progress>` from shared-ui instead or align API

### FeedbackPanel (`components/common/FeedbackPanel.tsx`)

**Score: 7/10**

- Clean correctness-based styling (green/yellow/red)
- Shows strengths, weaknesses, missing concepts
- Good use of Lucide icons for status
- Issue: Hardcoded background colors (`bg-green-50`, `bg-red-50`) not dark-mode
  safe
- Consider: Add `aria-live="polite"` for screen readers

### QuestionAnswerer (`components/questions/QuestionAnswerer.tsx`)

**Score: 7/10**

- Excellent orchestration of 15+ question types
- Clean switch-case rendering pattern
- Supports test/practice/quiz modes
- Has retry capability for practice mode
- Issue: Large component (310 lines) — could benefit from custom hook extraction
- Issue: "Submit Answer" and "Ask AI Tutor" buttons use raw HTML

### CountdownTimer (`components/test/CountdownTimer.tsx`)

**Score: 8/10**

- Server-time-aware with offset correction
- Three visual states: normal, warning (5 min), critical (1 min)
- Critical state has `animate-pulse` — effective urgency indicator
- Issue: No `aria-live` or `role="timer"` — screen readers can't track time
- Issue: Hardcoded `bg-gray-100`, `bg-orange-100`, `bg-red-100`

### QuestionNavigator (`components/test/QuestionNavigator.tsx`)

**Score: 7/10**

- Color-coded status grid (5 statuses with distinct colors)
- Legend for color meanings
- Ring highlight for current question
- Issue: Fixed `grid-cols-5` — breaks with many questions (scroll needed)
- Issue: No `aria-current` on active question
- Issue: Buttons lack `aria-label` (just show number, no status info)

### ChatTutorPanel (`components/chat/ChatTutorPanel.tsx`)

**Score: 5/10**

- Clean chat UI with user/assistant message bubbles
- Auto-scroll to latest message
- Loading state for AI response
- Empty state with helpful instructions
- Issues: Hardcoded `bg-white`, no focus trap, no ARIA dialog attributes, fixed
  width not responsive, no backdrop

### MaterialViewer (`components/materials/MaterialViewer.tsx`)

**Score: 7/10**

- Supports 7 material types: text, video, PDF, link, interactive, story, rich
- YouTube auto-detection and embed
- Rich content renderer with headings, paragraphs, images, code, quotes, lists
- Issues: Inline `style={{ height: '600px' }}` for PDF/interactive — should be
  responsive
- Issue: YouTube iframe missing `title` attribute
- Issue: Images in rich content lack meaningful `alt` text
- Issue: Code blocks use hardcoded `bg-gray-900 text-gray-100`

### MCQAnswerer (`components/questions/MCQAnswerer.tsx`)

**Score: 7/10** (representative of question answerers)

- Radio-button-styled cards with hover states
- Correct/incorrect visual feedback
- Explanation display on selected answer
- Issue: Uses native `<input type="radio">` — accessible but not styled
  consistently
- Issue: Hardcoded colors for correct/incorrect states

---

## Navigation & Information Architecture

### B2B Student Navigation (AppLayout sidebar)

```
Overview
├── Dashboard (/)

Learning
├── My Spaces (/spaces)
├── Tests (/tests)
├── Results (/results)

Community
├── Leaderboard (/leaderboard)
├── Chat Tutor (/chat)
```

**Assessment:**

- **Good:** Clear grouping (Overview, Learning, Community)
- **Good:** Active state detection with `location.pathname.startsWith()`
- **Issue:** No notifications page in sidebar (accessible only via
  NotificationBell)
- **Issue:** "Chat Tutor" under "Community" is misleading — it's a personal AI
  tutor, not a community feature
- **Recommendation:** Move "Chat Tutor" to "Learning" group; rename to "AI
  Tutor"

### B2C Consumer Navigation (ConsumerLayout sidebar)

```
Overview
├── My Learning (/consumer)

Explore
├── Space Store (/store)
├── Cart (N) (/store/checkout)   [dynamic, shown only when cart > 0]

Account
├── Profile (/profile)
```

**Assessment:**

- **Good:** Simple and focused
- **Good:** Dynamic cart item in nav
- **Issue:** No way to access notifications
- **Issue:** No progress/results page for consumer users
- **Recommendation:** Add "My Progress" to Overview; add notification bell to
  header

### Breadcrumb Patterns

Breadcrumbs exist on 6 pages but are inconsistently implemented. Current
pattern:

```tsx
<nav className="text-muted-foreground mb-2 text-xs">
  <Link to="/spaces" className="hover:underline">
    Spaces
  </Link>
  <span className="mx-1">/</span>
  <span>{space.title}</span>
</nav>
```

**Issues:**

- No `aria-label="Breadcrumb"` on the `<nav>` element
- No `<ol>` / `<li>` semantic structure
- Inconsistent spacing (`mb-2` vs no margin)
- No breadcrumb on DashboardPage, SpacesListPage, TestsPage, ChatTutorPage,
  LeaderboardPage

**Recommendation:** Use shadcn/ui `<Breadcrumb>` component with proper
semantics.

---

## Accessibility Audit

### WCAG 2.1 AA Compliance Summary

| Criterion                    | Status  | Notes                                                                     |
| ---------------------------- | ------- | ------------------------------------------------------------------------- |
| 1.1.1 Non-text Content       | Partial | Some images have `alt=""`, thumbnails lack descriptive alt                |
| 1.3.1 Info & Relationships   | Fail    | Forms lack `<fieldset>`, tables lack proper headers, tabs lack ARIA roles |
| 1.3.2 Meaningful Sequence    | Pass    | DOM order matches visual order                                            |
| 1.4.1 Use of Color           | Fail    | Question status in test uses color alone (no icon/text label on buttons)  |
| 1.4.3 Contrast (Minimum)     | Partial | `text-muted-foreground` may fail on some backgrounds                      |
| 1.4.11 Non-text Contrast     | Fail    | Progress bar track `bg-gray-200` may have insufficient contrast           |
| 2.1.1 Keyboard               | Fail    | No keyboard navigation for test questions, no focus traps                 |
| 2.4.3 Focus Order            | Fail    | No programmatic focus management on view transitions                      |
| 2.4.7 Focus Visible          | Partial | Some elements have `focus-visible:ring-2` but many custom buttons don't   |
| 2.4.8 Location               | Partial | Breadcrumbs exist but incomplete; no page titles                          |
| 3.3.1 Error Identification   | Partial | Login errors shown; async errors silently caught                          |
| 3.3.2 Labels or Instructions | Partial | Form inputs have labels but lack descriptions                             |
| 4.1.2 Name, Role, Value      | Fail    | Custom controls lack ARIA (progress bars, timers, tab groups)             |

### Priority ARIA Fixes

1. **ProgressBar:** Add `role="progressbar"` with `aria-valuenow`,
   `aria-valuemin="0"`, `aria-valuemax`
2. **CountdownTimer:** Add `role="timer"`, `aria-live="polite"`,
   `aria-label="Time remaining"`
3. **QuestionNavigator:** Add `aria-label` to each button (e.g., "Question 3:
   Answered"), `aria-current="step"` for active
4. **Tab groups:** Add `role="tablist"`, `role="tab"`, `aria-selected` to
   ProgressPage tabs and LoginPage method toggle
5. **ChatTutorPanel:** Add `role="dialog"`, `aria-modal="true"`,
   `aria-label="AI Tutor Chat"`
6. **Breadcrumbs:** Add `aria-label="Breadcrumb"`, use `<ol>` with `<li>`
   children
7. **Submit Dialog:** Add `role="alertdialog"`, `aria-describedby` for the
   warning message

---

## Responsive & Mobile Strategy

### Current State

The app has **minimal** responsive design:

- Most page grids use `md:grid-cols-2` or `lg:grid-cols-3` — these stack on
  mobile (good)
- Card components are full-width on mobile (good)
- Sidebar navigation collapses via AppShell (inherited behavior)

### Critical Mobile Failures

1. **TimedTestPage test view:** `flex gap-4` with `w-52` sidebar + main content
   — sidebar doesn't collapse
2. **StoryPointViewerPage:** `flex gap-6` with `w-48` section sidebar — doesn't
   collapse
3. **ChatTutorPanel:** `fixed w-96` — takes entire viewport width or overflows
4. **Test controls bar:** 5 buttons in a row — wraps awkwardly
5. **Checkout page:** `lg:grid-cols-3` sidebar layout — works but summary card
   could be sticky on mobile

### Recommended Mobile Breakpoint Strategy

```
sm (640px):  Stack all grids, hide secondary sidebars
md (768px):  2-column grids for cards
lg (1024px): Full sidebar + content layouts, 3-column grids
xl (1280px): 4-column grids (dashboard)
```

### Mobile-Specific Recommendations

1. **Test Page:** Hide QuestionNavigator sidebar, add a bottom sheet navigator
   triggered by a button
2. **StoryPointViewer:** Replace sidebar with a dropdown or horizontal
   scrollable tabs
3. **ChatTutorPanel:** Use `<Sheet side="bottom">` on mobile (full-screen on
   tap)
4. **Test Controls:** Group into primary (Save & Next) and secondary (Mark,
   Clear) — show secondary in a `<DropdownMenu>`
5. **Touch Targets:** Ensure all interactive elements are minimum 44x44px (WCAG
   2.5.5)
6. **Sticky Elements:** Make test controls and timer sticky-bottom on mobile
7. **Swipe Gestures:** Add swipe left/right for test question navigation on
   mobile

---

## Visual Consistency & Design System Adherence

### Color Usage Analysis

**Token-aware (good):**

- `text-muted-foreground` — used consistently for secondary text (~60 instances)
- `bg-card` — used for card backgrounds (~20 instances)
- `border` — used for default borders (~30 instances)
- `text-primary` — used for primary actions/links (~10 instances)
- `bg-primary` / `bg-primary/90` — used for primary buttons (~12 instances)
- `bg-destructive/10` — used for error messages (~5 instances)

**Hardcoded (bad — breaks dark mode):**

- `bg-gray-50` — 8 instances (empty states)
- `bg-gray-100` — 15 instances (skeletons, backgrounds)
- `bg-gray-200` — 6 instances (progress bar tracks, question grid)
- `bg-white` — 5 instances (panels, dialogs, select)
- `bg-blue-50` — 8 instances (info sections, selected states)
- `bg-green-50` — 3 instances (success feedback)
- `bg-red-50` — 3 instances (error feedback)
- `bg-orange-50` — 2 instances (warning/recommendation sections)
- `text-gray-700` — 5 instances (should be `text-foreground`)
- `text-gray-600` — 4 instances (should be `text-muted-foreground`)

### Typography Consistency

**Heading Patterns:**

- h1: `text-2xl font-bold` — consistent across all pages
- h2: `text-lg font-semibold` — mostly consistent
- h3: Varies — `font-semibold text-sm`, `font-medium text-sm`,
  `text-base font-semibold`
- Body: `text-sm` — consistent
- Captions: `text-xs text-muted-foreground` — consistent

**Recommendation:** Create heading utility classes or a `<Heading>` component:

```
h1 = text-2xl font-bold tracking-tight
h2 = text-lg font-semibold
h3 = text-sm font-semibold
```

### Spacing Consistency

**Page-level:**

- Outer: `space-y-6` — consistent across most pages
- Section gaps: `space-y-3` to `space-y-4` — slightly inconsistent
- Card padding: `p-4` to `p-6` — varies by context

**Recommendation:** Standardize to `p-4` for compact cards, `p-6` for full-width
sections.

---

## Interaction & Motion Design

### Current Animations

1. **Skeleton loading:** `animate-pulse` on gray rectangles — functional but
   bland
2. **Countdown timer critical:** `animate-pulse` on red background — effective
   urgency
3. **Hover states:** `hover:shadow-sm`, `hover:shadow-md`, `hover:bg-gray-50` —
   subtle and consistent
4. **Transitions:** `transition-shadow`, `transition-colors`, `transition-all` —
   applied inconsistently
5. **Progress bar fill:** `transition-all duration-300` — smooth fill animation

### Missing Interactions

1. **No page transitions:** Route changes are instant with no animation
2. **No answer feedback animation:** Correct/incorrect answers appear statically
3. **No celebration moments:** Completing a space, passing a test, or achieving
   a streak has no visual reward
4. **No loading indicators on buttons:** Buttons show text change
   ("Submitting...") but no spinner
5. **No toast notifications:** Async operations complete silently
6. **No scroll animations:** Content appears instantly on scroll
7. **No micro-interactions:** Question selection in test, filter toggling, tab
   switching are all instant

### Recommended Motion System

| Interaction           | Animation                           | Duration   |
| --------------------- | ----------------------------------- | ---------- |
| Page transition       | Fade + slight upward slide          | 200ms      |
| Card hover            | Scale(1.02) + shadow elevation      | 150ms      |
| Correct answer        | Green flash + confetti particles    | 500ms      |
| Incorrect answer      | Red shake + pulse                   | 300ms      |
| Button loading        | Spinner icon replacing text         | Continuous |
| Toast notification    | Slide in from top-right             | 300ms      |
| Progress bar increase | Smooth width + glow pulse           | 500ms      |
| Tab switch            | Underline slide + content crossfade | 200ms      |
| Streak increment      | Flame icon bounce + scale           | 400ms      |
| Test completion       | Full-screen confetti + score reveal | 1500ms     |

---

## Loading, Empty & Error States

### Loading States Inventory

| Page                  | Loading Implementation                   | Quality         |
| --------------------- | ---------------------------------------- | --------------- |
| DashboardPage         | Skeleton boxes (2 pulsing rectangles)    | Basic           |
| SpacesListPage        | 3 pulsing rectangles                     | Basic           |
| SpaceViewerPage       | Mixed: h-8 + h-4 + 3 rectangles          | Slightly shaped |
| StoryPointViewerPage  | 3 tall pulsing rectangles                | Basic           |
| TimedTestPage         | None for landing; text fallback for test | Poor            |
| PracticeModePage      | Single pulsing rectangle                 | Minimal         |
| ProgressPage          | 3 pulsing rectangles                     | Basic           |
| LeaderboardPage       | 5 pulsing rows                           | Good shape      |
| TestsPage             | 3 pulsing rectangles                     | Basic           |
| ChatTutorPage         | 3 pulsing rectangles                     | Basic           |
| NotificationsPage     | Delegated to shared-ui                   | Good            |
| ExamResultPage        | 3 pulsing rectangles                     | Basic           |
| ConsumerDashboardPage | Text: "Loading your spaces..."           | Poor            |
| StoreListPage         | Text: "Loading spaces..."                | Poor            |
| StoreDetailPage       | Text: "Loading space details..."         | Poor            |
| RequireAuth           | Text: "Loading..."                       | Poor            |

### Empty States Inventory

| Page                          | Empty State Implementation                     | Quality   |
| ----------------------------- | ---------------------------------------------- | --------- |
| DashboardPage (spaces)        | BookOpen icon + "No spaces assigned yet."      | Good      |
| SpacesListPage                | BookOpen icon + "No spaces assigned yet."      | Good      |
| SpaceViewerPage (space)       | Text: "Space not found."                       | Poor      |
| SpaceViewerPage (items)       | Text: "No items in this section."              | Poor      |
| LeaderboardPage               | Trophy icon + "No leaderboard data yet."       | Good      |
| TestsPage                     | ClipboardList icon + "No tests available yet." | Good      |
| ChatTutorPage                 | Bot icon + helpful instructions                | Excellent |
| ConsumerDashboardPage         | BookOpen icon + "You haven't enrolled" + CTA   | Excellent |
| StoreListPage                 | Text: "No spaces found."                       | Basic     |
| CheckoutPage                  | ShoppingCart icon + CTA to store               | Good      |
| ConsumerProfilePage (history) | Text with link to store                        | Good      |

### Error States Inventory

| Page                 | Error Handling                   | Quality  |
| -------------------- | -------------------------------- | -------- |
| LoginPage            | Red banner `bg-destructive/10`   | Good     |
| StoreListPage        | Red banner with retry message    | Good     |
| StoreDetailPage      | Red banner + back link           | Good     |
| TimedTestPage        | Empty catch blocks (3 instances) | Critical |
| PracticeModePage     | Empty catch blocks               | Critical |
| StoryPointViewerPage | Empty catch block                | Critical |

### Recommendations for State Management

1. **Loading:**
   - Replace all text-based loading with `<Skeleton>` components that match
     content shape
   - Create page-specific skeleton compositions (e.g., `DashboardSkeleton`,
     `SpaceCardSkeleton`)
   - Add a branded splash screen for the initial auth check in RequireAuth
   - Use `Suspense` boundaries for code-split page chunks

2. **Empty:**
   - All empty states should follow a consistent pattern: Icon + Title +
     Description + CTA
   - Use a shared
     `<EmptyState icon={...} title={...} description={...} action={...} />`
     component
   - Add illustrations/graphics for empty states (more engaging than plain
     icons)

3. **Error:**
   - Add `sonner` toast notifications for all async errors
   - Replace empty `catch {}` blocks with error toasts
   - Add per-section error boundaries with retry buttons
   - Add error analytics/logging (Sentry or similar)

---

## Redesign Recommendations

### Priority 1: Foundation (Week 1-2)

1. **Add dark mode support**
   - Add `.dark` CSS custom property block to `index.css`
   - Replace all 80+ hardcoded color instances with token-aware alternatives
   - Add theme toggle using next-themes

2. **Replace raw HTML with shared-ui components**
   - All `<button>` → `<Button>` (40+ instances)
   - All `<input>` → `<Input>` (15+ instances)
   - All `<select>` → `<Select>` (3 instances)
   - Confirmation dialog → `<AlertDialog>` (1 instance)
   - Chat panel → `<Sheet>` (1 instance)
   - Tabs → `<Tabs>` (2 instances)
   - Tables → `<Table>` (1 instance)

3. **Add core ARIA attributes**
   - ProgressBar: `role="progressbar"` + value attributes
   - CountdownTimer: `role="timer"` + `aria-live`
   - Breadcrumbs: `aria-label` + semantic `<ol>/<li>`
   - Custom tabs: `role="tablist"/"tab"` + `aria-selected`
   - Dialogs: `role="dialog"/"alertdialog"` + `aria-modal`

### Priority 2: Mobile & Responsiveness (Week 2-3)

4. **Mobile-first layout overhaul**
   - Test page: Collapsible question navigator → bottom sheet on mobile
   - StoryPointViewer: Section sidebar → dropdown on mobile
   - ChatTutorPanel → `<Sheet side="bottom">` on mobile
   - Test controls: Primary/secondary grouping with dropdown for secondary
     actions
   - Minimum 44px touch targets on all interactive elements

5. **Create shared components**
   - `<Breadcrumb>` component (or use shared-ui's)
   - `<SpaceCard variant="compact|full|progress">` unified component
   - `<EmptyState icon title description action>` component
   - `<PageSkeleton>` compositions per page type
   - `<Heading level={1|2|3}>` component

### Priority 3: UX Polish (Week 3-4)

6. **Loading and error states**
   - Content-shaped skeletons for all pages
   - Toast notifications via `sonner` for all async operations
   - Error boundaries per page section
   - Branded auth loading screen

7. **Form improvements**
   - LoginPage: Split into sub-components, add react-hook-form + Zod
   - Add password visibility toggle, strength indicator, forgot password
   - Add form validation feedback (inline errors, success states)

8. **Interaction design**
   - Answer feedback animations (correct: green flash, incorrect: red shake)
   - Button loading spinners
   - Page transition animations
   - Completion celebrations (confetti on 100% progress)
   - Progress bar glow animations

### Priority 4: Gamification & Engagement (Week 4-5)

9. **Gamification elements**
   - XP/points earned animation on question completion
   - Streak counter with flame animation
   - Achievement badges for milestones
   - Sound effects option for correct/incorrect
   - "Continue where you left off" section on dashboard
   - Time-of-day contextual greeting

10. **Advanced features**
    - Trend charts on ProgressPage using recharts
    - Keyboard shortcuts for test navigation
    - Real-time notifications
    - Search functionality on SpacesListPage
    - Sort and filter options across list pages
    - Comparative metrics (vs. class average)

---

## Implementation Roadmap

### Phase 1: Design System Alignment (Estimated: 1 week)

- [ ] Add `.dark` theme variables to `index.css`
- [ ] Replace all hardcoded colors with token-aware classes (80+ changes)
- [ ] Replace raw `<button>` with `<Button>` from shared-ui (40+ instances)
- [ ] Replace raw `<input>` with `<Input>` from shared-ui (15+ instances)
- [ ] Replace raw `<select>` with `<Select>` from shared-ui (3 instances)
- [ ] Add `<AlertDialog>` for TimedTestPage submit confirmation
- [ ] Add `<Tabs>` for ProgressPage and LoginPage
- [ ] Add `<Table>` for ProgressPage exams tab
- [ ] Add `<Sheet>` for ChatTutorPanel

### Phase 2: Accessibility (Estimated: 3-4 days)

- [ ] Add ARIA attributes to ProgressBar, CountdownTimer, QuestionNavigator
- [ ] Add `role="tablist"/"tab"` to custom tab implementations
- [ ] Add breadcrumb semantics (`aria-label`, `<ol>/<li>`)
- [ ] Add focus management: auto-focus first fields, trap focus in
      dialogs/sheets
- [ ] Add keyboard navigation for test questions (arrow keys)
- [ ] Ensure all interactive elements have `focus-visible` states
- [ ] Add `aria-live` regions for timer and dynamic content

### Phase 3: Responsive Design (Estimated: 1 week)

- [ ] Mobile layout for TimedTestPage (bottom sheet navigator, stacked controls)
- [ ] Mobile layout for StoryPointViewerPage (dropdown section picker)
- [ ] Mobile ChatTutorPanel (`<Sheet side="bottom">` full-screen)
- [ ] Touch target audit (44px minimum)
- [ ] Test all pages at 320px, 768px, 1024px, 1280px breakpoints
- [ ] Add responsive test for critical user flows

### Phase 4: Loading & Error States (Estimated: 3-4 days)

- [ ] Create content-shaped skeleton compositions for each page type
- [ ] Replace text loading indicators with skeletons (Consumer pages, Store,
      Auth)
- [ ] Add sonner toast integration for async errors
- [ ] Replace empty `catch {}` blocks with toast error notifications
- [ ] Add per-section error boundaries
- [ ] Create branded auth loading screen

### Phase 5: Component Refactoring (Estimated: 3-4 days)

- [ ] Create shared `<Breadcrumb>` component
- [ ] Create unified `<SpaceCard>` component with variants
- [ ] Create shared `<EmptyState>` component
- [ ] Split LoginPage into 4 sub-components
- [ ] Extract DashboardSpaceCard, TestCard, SpaceProgressCard to shared files
- [ ] Add react-hook-form + Zod to login forms

### Phase 6: Interaction & Motion (Estimated: 3-4 days)

- [ ] Add button loading spinners (replace text-only "Submitting...")
- [ ] Add answer feedback animations (correct flash, incorrect shake)
- [ ] Add progress bar glow animations
- [ ] Add page transition animations (fade + slide)
- [ ] Add toast notifications for success actions
- [ ] Add completion celebrations (test passed, space completed)

### Phase 7: Gamification & Advanced (Estimated: 1 week)

- [ ] Add trend charts to ProgressPage using recharts
- [ ] Add keyboard shortcuts for test navigation
- [ ] Add "Continue where you left off" on dashboard
- [ ] Add search/filter to SpacesListPage
- [ ] Add real-time notification updates
- [ ] Fix consumer store routing bug (M10)
- [ ] Add dynamic subject filter for store

---

## Summary of All Issues

| ID  | Severity | Category       | Issue                                                              | Location       |
| --- | -------- | -------------- | ------------------------------------------------------------------ | -------------- |
| C1  | Critical | Dark Mode      | No dark mode support; 80+ hardcoded colors                         | Global         |
| C2  | Critical | Components     | Raw HTML instead of shared-ui components (40+ buttons, 15+ inputs) | Global         |
| C3  | Critical | Accessibility  | Missing keyboard navigation and focus management                   | Global         |
| C4  | Critical | Accessibility  | Missing ARIA attributes throughout                                 | Global         |
| M1  | Major    | Responsive     | No mobile layout for test page, story viewer, chat panel           | Multiple       |
| M2  | Major    | Error Handling | Silent error swallowing (5+ empty catch blocks)                    | Multiple       |
| M3  | Major    | Loading States | Primitive/missing skeletons on 5+ pages                            | Multiple       |
| M4  | Major    | Accessibility  | Timer bar hardcoded `bg-white`, no ARIA                            | TimedTestPage  |
| M5  | Major    | Architecture   | LoginPage is 460+ lines, single component                          | LoginPage      |
| M6  | Major    | Accessibility  | ChatTutorPanel no focus trap, no ARIA dialog                       | ChatTutorPanel |
| m1  | Minor    | Navigation     | Inconsistent breadcrumb implementation                             | 6 pages        |
| m2  | Minor    | Components     | Space card component duplication (3 variants)                      | 3 pages        |
| m3  | Minor    | Navigation     | Consumer layout missing NotificationBell                           | ConsumerLayout |
| m4  | Minor    | Data           | Hardcoded subject list in store filter                             | StoreListPage  |
| m5  | Minor    | UX             | "Download PDF" actually calls window.print()                       | ExamResultPage |
| m6  | Minor    | Interaction    | No animation between view transitions                              | TimedTestPage  |
| m7  | Minor    | Components     | Custom confirmation dialog instead of AlertDialog                  | TimedTestPage  |
| m8  | Minor    | TypeScript     | `(exam as any)` type assertions                                    | DashboardPage  |
| m9  | Minor    | Navigation     | Missing back navigation on several pages                           | Multiple       |
| m10 | Minor    | Routing        | Consumer store links to wrong route prefix                         | StoreListPage  |

**Total: 4 Critical, 6 Major, 10 Minor = 20 issues identified**

---

_This audit was performed by analyzing all 17 pages, 3 layouts, 20+ components,
and 6 custom hooks in the Student-Web application source code. Recommendations
prioritize accessibility, design system alignment, and mobile responsiveness as
the highest-impact improvements._
