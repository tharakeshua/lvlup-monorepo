# UI/UX Audit Report: Parent-Web App

**Date:** 2026-03-04 **Auditor:** UI/UX Designer Agent **App:** Parent-Web
(`apps/parent-web/`) **Version:** Current main branch **Scope:** Comprehensive
UI/UX audit covering all pages, components, navigation, accessibility, mobile
responsiveness, and parent-specific UX patterns

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State Architecture](#2-current-state-architecture)
3. [Page-by-Page Analysis](#3-page-by-page-analysis)
4. [Issues Found](#4-issues-found)
5. [Parent-Specific UX Analysis](#5-parent-specific-ux-analysis)
6. [Navigation & Information Architecture](#6-navigation--information-architecture)
7. [Component Quality & Design System Compliance](#7-component-quality--design-system-compliance)
8. [Data Visualization Audit](#8-data-visualization-audit)
9. [Loading, Empty & Error States](#9-loading-empty--error-states)
10. [Mobile & Responsive Design](#10-mobile--responsive-design)
11. [Accessibility Audit](#11-accessibility-audit)
12. [Trust & Professional Appearance](#12-trust--professional-appearance)
13. [Redesign Recommendations](#13-redesign-recommendations)
14. [Implementation Roadmap](#14-implementation-roadmap)

---

## 1. Executive Summary

### Overall Assessment: **Functional but Needs Significant UX Polish**

The Parent-Web app is a functional monitoring portal that allows parents to view
their children's academic progress, exam results, learning space completion, and
notification history. It successfully leverages the shared-ui component library
(AppShell, AppSidebar, ScoreCard, ProgressRing, etc.) and has a consistent
routing/auth architecture.

However, the app suffers from several critical and major UX issues that impact
the parent experience:

### Key Findings

| Category                  | Rating  | Notes                                                                    |
| ------------------------- | ------- | ------------------------------------------------------------------------ |
| **Functionality**         | Good    | All core parent workflows are implemented                                |
| **Visual Design**         | Fair    | Functional but utilitarian; lacks warmth and delight                     |
| **Navigation/IA**         | Fair    | Confusing overlap between Children, Child Progress, Space Progress pages |
| **Mobile Responsiveness** | Poor    | No mobile-specific optimizations; parents primarily use phones           |
| **Accessibility**         | Fair    | Uses semantic shared-ui components but misses ARIA on custom elements    |
| **Loading States**        | Fair    | Basic skeletons exist but inconsistent across pages                      |
| **Empty States**          | Good    | Meaningful empty states with guidance on all pages                       |
| **Data Visualization**    | Fair    | Basic bar charts; lacks trend lines, comparisons, and time-series        |
| **Trust & Polish**        | Poor    | Raw HTML inputs on login, no branding, missing "forgot password"         |
| **Dark Mode**             | Missing | No dark mode CSS variables defined; only light theme in `index.css`      |
| **Forms**                 | Poor    | Login uses raw HTML inputs; no react-hook-form/zod despite being in deps |

### Critical Issues (Must Fix)

1. **No dark mode support** — only light theme HSL variables defined in
   `index.css`
2. **Login page uses raw HTML inputs** instead of shared-ui `Input`/`Button`
   components
3. **No "forgot password" flow** — parents are stuck if they forget credentials
4. **No mobile optimization** — grid layouts break on small screens; no mobile
   nav
5. **Child displayed by UID/studentId, not by name** — dehumanizing experience

### Top Recommendations

1. Consolidate redundant pages (Children + Child Progress + Space Progress →
   unified child detail view)
2. Add dark mode support with proper HSL variable definitions
3. Redesign login page using shared-ui components with school branding
4. Implement a mobile-first responsive strategy with bottom navigation
5. Show child display names (not UID slices) everywhere — the current
   `student.uid.slice(0,2).toUpperCase()` pattern for avatars is meaningless

---

## 2. Current State Architecture

### 2.1 Route Map

| Route             | Page                | Lazy       | Purpose                                         |
| ----------------- | ------------------- | ---------- | ----------------------------------------------- |
| `/login`          | `LoginPage`         | No (eager) | Two-step school code + credentials login        |
| `/`               | `DashboardPage`     | Yes        | Overview cards, quick actions, children grid    |
| `/children`       | `ChildrenPage`      | Yes        | Detailed card per child with stats              |
| `/results`        | `ExamResultsPage`   | Yes        | Accordion list of released exam submissions     |
| `/progress`       | `SpaceProgressPage` | Yes        | Learning space progress cards per child         |
| `/child-progress` | `ChildProgressPage` | Yes        | Deep analytics per child with charts            |
| `/notifications`  | `NotificationsPage` | Yes        | Shared-ui notifications page wrapper            |
| `/settings`       | `SettingsPage`      | Yes        | Profile (read-only), notification prefs, logout |
| `*`               | `NotFoundPage`      | -          | Shared-ui 404                                   |

### 2.2 Layout Architecture

```
AuthLayout (unauthenticated)
├── /login → LoginPage
│
AppShell (authenticated via RequireAuth)
├── AppSidebar (navGroups: Overview, My Children, Account)
│   ├── RoleSwitcher (footer, multi-tenant)
│   └── User display name/email (footer)
├── Header: SidebarTrigger + NotificationBell
└── Main content area (p-6, flex-1)
    └── <Outlet /> → page components
```

### 2.3 Data Flow

```
useAuthStore (Zustand) → Firebase Auth listener
  ├── firebaseUser, user, currentMembership, allMemberships
  ├── currentTenantId → useTenantStore subscription
  └── loginWithSchoolCode(), logout(), switchTenant()

useLinkedStudents(tenantId, parentId) → Firestore userMemberships
  └── Returns UserMembership[] (children linked to parent)

useStudentSummaries(tenantId, studentIds) → shared-hooks
  └── Returns StudentProgressSummary[] per child

Page-local hooks:
  ├── useChildSubmissions() → Firestore submissions + exams enrichment
  ├── useChildProgress() → Firestore spaceProgress
  ├── useStudentNames() → Firestore users collection
  ├── useSpaceNames() → Firestore spaces collection
  └── useNotificationPreferences() → Firestore notificationPreferences
```

### 2.4 Shared-UI Components Used

| Component                            | Used In                            | Notes                         |
| ------------------------------------ | ---------------------------------- | ----------------------------- |
| `AppShell`                           | AppLayout                          | Main layout wrapper           |
| `AppSidebar`                         | AppLayout                          | Navigation with LinkComponent |
| `NotificationBell`                   | AppLayout header                   | Popover + badge               |
| `RoleSwitcher`                       | AppLayout sidebar footer           | Multi-tenant switching        |
| `ScoreCard`                          | Dashboard, ChildProgress           | Metric display cards          |
| `ProgressRing`                       | Dashboard, Children                | SVG circular progress         |
| `AtRiskBadge`                        | Dashboard, Children, ChildProgress | Risk status pill              |
| `SimpleBarChart`                     | ChildProgress                      | Subject breakdown bars        |
| `LogoutButton`                       | Dashboard, Settings                | AlertDialog confirmation      |
| `DownloadPDFButton`                  | ExamResults (expanded)             | Cloud Function PDF generation |
| `NotificationsPage` (UI)             | NotificationsPage                  | Full notifications view       |
| `Card`, `CardHeader`, etc.           | Settings                           | shadcn Card composition       |
| `Button`, `Input`, `Label`, `Switch` | Settings                           | shadcn form primitives        |
| `ErrorBoundary`                      | main.tsx                           | Global error boundary         |
| `NotFoundPage`                       | App.tsx catch-all                  | 404 page                      |

---

## 3. Page-by-Page Analysis

### 3.1 Login Page (`/login`)

**File:** `src/pages/LoginPage.tsx` (166 lines)

#### Current State

Two-step login: (1) school code validation, (2) email + password.

#### Issues

| ID   | Severity    | Issue                                                                                                                                                                       |
| ---- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L-01 | Critical    | **Raw HTML `<input>` and `<button>` elements** instead of shared-ui `Input`/`Button` — inconsistent with design system, duplicates styling inline                           |
| L-02 | Critical    | **No "Forgot Password" link** — parents who forget passwords have no self-service recovery                                                                                  |
| L-03 | Major       | **No school logo or branding** — after validating school code, the credential step only shows the school name in a muted box; should show the school's logo/brand for trust |
| L-04 | Major       | **No password visibility toggle** — parents can't verify what they're typing                                                                                                |
| L-05 | Minor       | `shadow-card` class on the card wrapper but this CSS variable isn't defined in parent-web's `index.css` — may render no shadow                                              |
| L-06 | Minor       | No loading animation on school code validation — only text change "Validating..."                                                                                           |
| L-07 | Minor       | Error messages use `bg-destructive/10` which is correct but don't include a dismiss action or icon                                                                          |
| L-08 | Enhancement | No "Remember me" checkbox or persistent session option                                                                                                                      |
| L-09 | Enhancement | No support for social login or SSO options                                                                                                                                  |

#### Visual Assessment

The login page is bare and utilitarian. A centered `max-w-md` card with basic
form fields. No illustration, no branding beyond "Parent Portal" text. The
two-step flow is logically sound but visually flat.

**Step 1 (School Code):**

```
┌──────────────────────────────────┐
│        Parent Portal             │
│  Sign in to view your child's   │
│        progress                  │
│                                  │
│  School Code                     │
│  ┌────────────────────────────┐  │
│  │ Enter your school code     │  │
│  └────────────────────────────┘  │
│                                  │
│  ┌────────────────────────────┐  │
│  │        Continue            │  │
│  └────────────────────────────┘  │
└──────────────────────────────────┘
```

**Step 2 (Credentials):**

```
┌──────────────────────────────────┐
│        Parent Portal             │
│  Sign in to view your child's   │
│        progress                  │
│                                  │
│  ┌─ School Name ──── Change ──┐  │
│  │                            │  │
│  └────────────────────────────┘  │
│                                  │
│  Email                           │
│  ┌────────────────────────────┐  │
│  │ parent@email.com           │  │
│  └────────────────────────────┘  │
│  Password                        │
│  ┌────────────────────────────┐  │
│  │ Enter your password        │  │
│  └────────────────────────────┘  │
│                                  │
│  ┌────────────────────────────┐  │
│  │        Sign In             │  │
│  └────────────────────────────┘  │
└──────────────────────────────────┘
```

---

### 3.2 Dashboard Page (`/`)

**File:** `src/pages/DashboardPage.tsx` (296 lines)

#### Current State

Four overview cards → three quick action links → children grid with summary
data.

#### Issues

| ID   | Severity    | Issue                                                                                                                                                                                                                            |
| ---- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-01 | Major       | **LogoutButton in page header** is redundant — already available in Settings and should be in sidebar/user menu only; wastes prime header real estate                                                                            |
| D-02 | Major       | **Child avatar uses `studentId.slice(0,2).toUpperCase()`** — shows meaningless characters (e.g., "AB" from a UID like "ab8c3f..."). Should use the child's actual name initials                                                  |
| D-03 | Major       | **Child name shows `studentId` (roll number) or "Child 1"** — not the student's display name. The dashboard doesn't fetch actual student names                                                                                   |
| D-04 | Major       | **`avgScore * 100` displayed as percentage** — but the `overallScore` field is already 0-1 normalized, so the math is correct; however the card label "Avg Performance" is ambiguous. Is this across all subjects? All children? |
| D-05 | Minor       | **School code card shows `tenantId.slice(0,12)` as fallback** — showing raw Firebase document IDs to parents is a trust violation                                                                                                |
| D-06 | Minor       | **Skeleton loading shows 3 gray boxes** — doesn't match the actual card structure (no skeleton ScoreCards, no skeleton quick actions)                                                                                            |
| D-07 | Minor       | **`transition-shadow` on children cards** but no `transition-colors` — hover state is shadow-only, feels flat                                                                                                                    |
| D-08 | Enhancement | **No date/time context** — parents don't see when data was last updated                                                                                                                                                          |
| D-09 | Enhancement | **No comparison or trend** — parents can't see if their child is improving or declining over time                                                                                                                                |

#### Visual Assessment

The dashboard has good information density. The four ScoreCards provide a quick
overview. Quick action links are clear. The children grid effectively uses
`ProgressRing` and color-coded exam percentages.

**Layout:**

```
┌──────────────────────────────────────────────────┐
│  Parent Dashboard          [Sign Out]            │
│  Welcome back, ParentName                        │
├──────────────────────────────────────────────────┤
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐           │
│  │Child │ │ Avg  │ │School│ │Status│           │
│  │  3   │ │ 72%  │ │ABC123│ │All OK│           │
│  └──────┘ └──────┘ └──────┘ └──────┘           │
├──────────────────────────────────────────────────┤
│  [Exam Results →] [Space Progress →] [Children →]│
├──────────────────────────────────────────────────┤
│  Children Overview                   View all →  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐        │
│  │ Child 1  │ │ Child 2  │ │ Child 3  │        │
│  │ Progress │ │ Progress │ │ Progress │        │
│  │ Ring+Stats│ │ Ring+Stats│ │Ring+Stats│        │
│  └──────────┘ └──────────┘ └──────────┘        │
└──────────────────────────────────────────────────┘
```

---

### 3.3 Children Page (`/children`)

**File:** `src/pages/ChildrenPage.tsx` (194 lines)

#### Current State

Stacked card list, one per linked child, with 4-metric row, recent exams, and
action links.

#### Issues

| ID   | Severity    | Issue                                                                                                                                                                                                                                                             |
| ---- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C-01 | Major       | **Same child naming problem** — shows `studentId` (roll number) or "Child N" instead of display name                                                                                                                                                              |
| C-02 | Major       | **Action links "View Full Progress" and "Exam Results" navigate to `/child-progress` and `/results`** but these pages show ALL children — there's no way to deep-link to a specific child's progress. The "View Full Progress" click doesn't pre-select the child |
| C-03 | Major       | **Heavy overlap with Dashboard children grid** — nearly identical information displayed in a slightly different layout. This page adds a 4-metric row and 3 exam results (vs 2 on dashboard) but doesn't justify a separate page                                  |
| C-04 | Minor       | **School Code metric per child** in the 4-metric row is redundant — all children share the same school code within a tenant                                                                                                                                       |
| C-05 | Minor       | **Status badges use hardcoded Tailwind classes** (`bg-green-100 text-green-700`) instead of the design system's semantic tokens or a reusable Badge component                                                                                                     |
| C-06 | Enhancement | **No search or filter** — if a parent has many children (rare but possible), there's no way to find one quickly                                                                                                                                                   |

---

### 3.4 Child Progress Page (`/child-progress`)

**File:** `src/pages/ChildProgressPage.tsx` (392 lines)

#### Current State

The most data-rich page. Child selector tabs → 5 ScoreCards → At-Risk alert →
Strengths/Weaknesses tags → Recommendations → 2 bar charts → 2 detail panels.

#### Issues

| ID    | Severity    | Issue                                                                                                                                           |
| ----- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| CP-01 | Major       | **Child selector shows UID slice** — `student.uid.slice(0, 2).toUpperCase()` for avatar, `studentId` or "Child N" for name                      |
| CP-02 | Major       | **Page title shows `studentId` or UID slice** — `Progress — {studentId}` is meaningless to parents. Should show the child's actual name         |
| CP-03 | Major       | **5 ScoreCards in `lg:grid-cols-5`** — on medium screens this wraps awkwardly; 5-column grids are unusual and can look cramped                  |
| CP-04 | Major       | **Recommendations are generic/templated** — "Practice more {area} topics" is repeated for each weakness area. Lacks specific, actionable advice |
| CP-05 | Minor       | **At-Risk alert uses hardcoded `border-red-200 bg-red-50`** — doesn't respect dark mode. Should use semantic tokens                             |
| CP-06 | Minor       | **Recommendations panel uses hardcoded `border-blue-200 bg-blue-50`** — same dark mode issue                                                    |
| CP-07 | Minor       | **No loading state for charts** — if `selectedSummary` is null while loading, shows empty state instead of skeleton                             |
| CP-08 | Enhancement | **No historical trend view** — parents can't see how scores changed over time. Only shows current snapshot                                      |
| CP-09 | Enhancement | **No time period selector** — can't filter by "this month", "this semester", etc.                                                               |
| CP-10 | Enhancement | **Bar charts are basic** — `SimpleBarChart` is functional but lacks interactivity (no hover tooltips, no click-to-drill)                        |

---

### 3.5 Exam Results Page (`/results`)

**File:** `src/pages/ExamResultsPage.tsx` (511 lines)

#### Current State

Search bar → accordion list of exam submissions with expandable per-question
feedback.

#### Issues

| ID    | Severity    | Issue                                                                                                                                                                                      |
| ----- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ER-01 | Major       | **Large monolithic file (511 lines)** — contains 3 inline hooks (`useChildSubmissions`, `useQuestionSubmissions`) and an inline component (`QuestionFeedbackSection`). Should be extracted |
| ER-02 | Major       | **No grouping or sorting options** — submissions are returned in `createdAt desc` order from Firestore but parents can't sort by subject, score, or child                                  |
| ER-03 | Major       | **No child filter** — if a parent has multiple children, all their submissions are mixed together with no way to filter by child                                                           |
| ER-04 | Minor       | **Search input uses raw HTML `<input>`** instead of shared-ui `Input` component                                                                                                            |
| ER-05 | Minor       | **Accordion is custom-built** — uses `expandedId` state + `ChevronDown/Right` instead of shadcn/ui `Accordion` component. Misses animation and keyboard support                            |
| ER-06 | Minor       | **"Pipeline Status" shown to parents** — technical field (`sub.pipelineStatus`) is meaningless to parents; should be hidden or translated to parent-friendly language                      |
| ER-07 | Minor       | **Improvement recommendations section (lines 472-501)** uses hardcoded blue colors — dark mode incompatible                                                                                |
| ER-08 | Enhancement | **No pagination** — all released submissions loaded at once. Could be slow with many exams                                                                                                 |
| ER-09 | Enhancement | **PDF download button is in a "stats grid" cell** — awkward placement as the 4th item in a grid where the other 3 are stats                                                                |

---

### 3.6 Space Progress Page (`/progress`)

**File:** `src/pages/SpaceProgressPage.tsx` (227 lines)

#### Current State

Groups learning space progress cards by child. Shows status badge, percentage,
points, progress bar, story points.

#### Issues

| ID    | Severity    | Issue                                                                                                                   |
| ----- | ----------- | ----------------------------------------------------------------------------------------------------------------------- |
| SP-01 | Major       | **3 inline hooks** (`useChildProgress`, `useStudentNames`, `useSpaceNames`) — should be extracted to `hooks/` directory |
| SP-02 | Major       | **Loading state is just "Loading progress..." text** — no skeleton cards, no spinner. Jarring compared to other pages   |
| SP-03 | Minor       | **Space names fallback to `spaceId.slice(0,12)`** — Firebase doc IDs shown to parents                                   |
| SP-04 | Minor       | **No sorting or filtering** — can't filter by status (completed, in_progress, not_started)                              |
| SP-05 | Minor       | **`md:grid-cols-2` only** — doesn't scale to 3 columns on large screens                                                 |
| SP-06 | Enhancement | **No aggregate stats** — no overview of "X spaces completed, Y in progress, Z not started" per child                    |
| SP-07 | Enhancement | **No click-through** — space cards are display-only with no way to see detailed story point breakdown                   |

---

### 3.7 Notifications Page (`/notifications`)

**File:** `src/pages/NotificationsPage.tsx` (41 lines)

#### Current State

Thin wrapper around shared-ui `NotificationsPageUI`. Clean delegation pattern.

#### Issues

| ID   | Severity | Issue                                                                                                  |
| ---- | -------- | ------------------------------------------------------------------------------------------------------ |
| N-01 | Minor    | **Hardcoded limit of 50** — no pagination or infinite scroll for older notifications                   |
| N-02 | Minor    | **No "Load More" wired** — the shared-ui component supports `onLoadMore` but this page doesn't pass it |

#### Assessment

This is the cleanest page in the app. Proper composition over implementation.
The shared-ui component handles all the UI complexity. Only improvement needed
is pagination support.

---

### 3.8 Settings Page (`/settings`)

**File:** `src/pages/SettingsPage.tsx` (288 lines)

#### Current State

Three Card sections: Profile (read-only), Notification Preferences (5 switches),
Account (logout).

#### Issues

| ID   | Severity    | Issue                                                                                                                                                                                                                                                                           |
| ---- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S-01 | Major       | **Profile is completely read-only** with "Contact your school admin" note — no self-service profile management (photo, phone number, preferred language)                                                                                                                        |
| S-02 | Major       | **LogoutButton uses a massive inline className string** (line 279) — duplicates button styling from scratch instead of using `Button` variant                                                                                                                                   |
| S-03 | Minor       | **"Save Changes" success state logic is incorrect** — `saveMutation.isSuccess && !isDirty` check shows the Check icon, but `isDirty` is immediately set to `false` in `handleSave()` before the mutation completes. This means the success icon briefly flashes then disappears |
| S-04 | Minor       | **No toast notification on save** — parent doesn't get clear confirmation that preferences were saved                                                                                                                                                                           |
| S-05 | Minor       | **2 inline hooks** (`useNotificationPreferences`, `useSaveNotificationPreferences`) should be extracted                                                                                                                                                                         |
| S-06 | Enhancement | **No account security section** — no change password, no 2FA, no session management                                                                                                                                                                                             |
| S-07 | Enhancement | **No language/locale preference** — important for multilingual school communities                                                                                                                                                                                               |
| S-08 | Enhancement | **No privacy section** — no data export, no account deletion option                                                                                                                                                                                                             |

---

## 4. Issues Found

### 4.1 Critical Issues (P0 — Must Fix)

| #   | Issue                                                                                             | Pages Affected                                    | Impact                                            |
| --- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------- |
| 1   | **No dark mode** — `index.css` only defines `:root` (light) variables, no `.dark` class block     | All pages                                         | Accessibility, eye strain, modern expectation     |
| 2   | **Login uses raw HTML inputs/buttons** — violates design system consistency                       | Login                                             | Trust, consistency, accessibility                 |
| 3   | **No forgot password flow**                                                                       | Login                                             | Parents locked out of their account               |
| 4   | **Children shown by UID/roll number, not display name**                                           | Dashboard, Children, ChildProgress, SpaceProgress | Dehumanizing UX; parents see "ab8c3f" not "Sarah" |
| 5   | **No mobile optimization** — grids use `md:` and `lg:` breakpoints but no mobile-specific layouts | All pages                                         | Parents primarily use phones                      |

### 4.2 Major Issues (P1 — High Priority)

| #   | Issue                                                                                               | Pages Affected                                  | Impact                                    |
| --- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ----------------------------------------- |
| 6   | **Redundant page structure** — Children, ChildProgress, SpaceProgress overlap significantly         | 3 pages                                         | Confusing navigation, user disorientation |
| 7   | **No child-specific deep links** — can't navigate to a specific child's progress from Children page | Children → ChildProgress                        | Broken information scent                  |
| 8   | **Inline hooks not extracted** — 8+ hooks defined inside page files                                 | ExamResults, SpaceProgress, Settings            | Code quality, testability, reusability    |
| 9   | **No data freshness indicator** — parents don't know when data was last updated                     | Dashboard, all data pages                       | Trust, data confidence                    |
| 10  | **Hardcoded color classes** — `bg-red-50`, `bg-blue-50`, `bg-green-100` throughout                  | ChildProgress, ExamResults, Dashboard, Children | Dark mode incompatible                    |
| 11  | **LogoutButton placed redundantly** — appears in both Dashboard header and Settings page            | Dashboard, Settings                             | UI clutter, wasted space                  |
| 12  | **ExamResults accordion is custom-built** — misses keyboard navigation, animation                   | ExamResults                                     | Accessibility, UX polish                  |

### 4.3 Minor Issues (P2 — Should Fix)

| #   | Issue                                                                   | Pages Affected                     |
| --- | ----------------------------------------------------------------------- | ---------------------------------- |
| 13  | Skeleton loaders don't match actual card structure                      | Dashboard, Children, ExamResults   |
| 14  | Status badges use hardcoded Tailwind classes instead of Badge component | Dashboard, Children, SpaceProgress |
| 15  | Search input on ExamResults uses raw HTML input                         | ExamResults                        |
| 16  | Pipeline status shown to parents in raw form                            | ExamResults                        |
| 17  | "School Code" metric per child is redundant within single tenant        | Children                           |
| 18  | 5-column ScoreCard grid wraps awkwardly on medium screens               | ChildProgress                      |
| 19  | No toast/snackbar on notification preference save                       | Settings                           |
| 20  | Recommendations text is generic/templated                               | ChildProgress, ExamResults         |
| 21  | `shadow-card` CSS variable potentially undefined                        | Login                              |
| 22  | SpaceProgress loading is plain text, no spinner                         | SpaceProgress                      |

---

## 5. Parent-Specific UX Analysis

### 5.1 Core Parent Needs Assessment

| Need                                | Current Support                                                    | Gap                                                           |
| ----------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------- |
| **"How is my child doing?"**        | Partially met — Dashboard shows overview, ChildProgress has detail | No trend/comparison over time; no "this week's summary"       |
| **"What grades did my child get?"** | Well met — ExamResults with per-question breakdown                 | No child filter; no grouping by subject or time               |
| **"Is my child keeping up?"**       | Partially met — AtRiskBadge and recommendations                    | Generic advice; no specific action items                      |
| **"What should I do?"**             | Poorly met — Template recommendations only                         | No personalized guidance, no parent-teacher communication     |
| **"Quick check on my phone"**       | Not met — No mobile-optimized views                                | Grid layouts break; no mobile nav                             |
| **"Talk to the teacher"**           | Not met — No messaging feature                                     | Teacher Messages in notification prefs but no compose feature |
| **"Pay school fees"**               | Not met — No payments integration                                  | No payment/billing page                                       |

### 5.2 Parent Journey Analysis

**Current Happy Path:**

```
Login (2-step) → Dashboard → Click child card → ... (no link to child detail)
                           → Quick Actions → Exam Results / Space Progress / Children
```

**Friction Points:**

1. After viewing a child on Dashboard, there's no direct "View details" link per
   child
2. Clicking "View Full Progress" on Children page goes to `/child-progress` but
   doesn't pre-select that child
3. Space Progress and Child Progress are separate pages — parent must visit both
   to get full picture
4. No "weekly digest" or summary view — parent must manually check each section

### 5.3 Emotional Design Assessment

The current app is **informational but cold**. Parents are emotionally invested
in their children's education. The app should:

- **Celebrate wins** — "Your child scored 90% on Math!" deserves a moment of
  delight, not just a green number
- **Soften concerns** — At-Risk alerts are clinical and alarming. Should be
  reframed as "Areas where we can help"
- **Build connection** — No photos, no teacher messages, no school community
  feel
- **Reduce anxiety** — "All Good" status is reassuring but more detailed
  positive feedback would help

---

## 6. Navigation & Information Architecture

### 6.1 Current Sidebar Structure

```
Overview
  └── Dashboard (/)

My Children
  ├── Children (/children)
  ├── Exam Results (/results)
  ├── Space Progress (/progress)
  └── Child Progress (/child-progress)

Account
  └── Settings (/settings)
```

### 6.2 Problems with Current IA

1. **"Children" vs "Child Progress"** — overlapping scope. Parents must
   understand the distinction:
   - Children = enrollment overview with basic stats
   - Child Progress = deep analytics with charts
   - This is an internal domain-model distinction, not a user mental model

2. **"Space Progress" vs "Child Progress"** — further confusion:
   - Space Progress = learning module completion
   - Child Progress = holistic view (exams + spaces + streaks)
   - Parents don't think in terms of "spaces" vs "exams" — they think per-child

3. **No child-centric navigation** — the IA is feature-centric (Exams, Spaces,
   Progress) not child-centric. Parents think: "How is Sarah doing?" not "Let me
   check the Space Progress feature."

4. **Notifications not in sidebar** — accessible only via NotificationBell
   popover or direct URL. The bell in header is good, but there should also be a
   sidebar entry with unread count badge for discoverability.

### 6.3 Recommended IA Restructure

```
Home
  └── Dashboard (/)

My Children
  ├── Overview (/children)           ← Children list with summary cards
  └── {Child Name} (/children/:id)   ← Unified child detail (NEW)
       ├── Tab: Progress              ← Merged ChildProgress + SpaceProgress
       ├── Tab: Exam Results          ← Filtered exam results for this child
       └── Tab: Activity              ← Recent activity timeline

Notifications (/notifications)        ← Add to sidebar with badge
Account
  └── Settings (/settings)
```

This restructure:

- Reduces sidebar items from 6 to 4
- Eliminates confusion between Children/ChildProgress/SpaceProgress
- Creates a child-centric detail page with tabbed navigation
- Adds Notifications to sidebar for discoverability

---

## 7. Component Quality & Design System Compliance

### 7.1 Design System Compliance Scorecard

| Component/Pattern            | Compliant | Notes                                                   |
| ---------------------------- | --------- | ------------------------------------------------------- |
| `AppShell` / `AppSidebar`    | Yes       | Correctly composed with shared-ui                       |
| `ScoreCard`                  | Yes       | Proper usage on Dashboard and ChildProgress             |
| `ProgressRing`               | Yes       | Correct props, good size variation                      |
| `AtRiskBadge`                | Yes       | Used on Dashboard, Children, ChildProgress              |
| `SimpleBarChart`             | Yes       | Used on ChildProgress                                   |
| `NotificationBell`           | Yes       | Properly wired in AppLayout header                      |
| `NotificationsPage`          | Yes       | Clean wrapper pattern                                   |
| `RoleSwitcher`               | Yes       | Correctly placed in sidebar footer                      |
| `LogoutButton`               | Partial   | Used but with massive className overrides               |
| `Card` / `CardHeader` / etc. | Partial   | Used on Settings but not on other pages                 |
| `Button`                     | Partial   | Used on Settings but login/dashboard use raw `<button>` |
| `Input`                      | Partial   | Used on Settings but login uses raw `<input>`           |
| Status badges                | No        | Hardcoded classes instead of shared Badge component     |
| Color usage                  | No        | Many hardcoded hex/utility colors instead of CSS vars   |

### 7.2 Component Consistency Issues

**Buttons:** Three different button implementations across the app:

1. Settings page: `<Button>` from shared-ui (correct)
2. Login page: Raw `<button>` with inline Tailwind classes duplicating Button
   styles
3. Dashboard header: `<LogoutButton>` with custom className

**Inputs:** Two implementations:

1. Settings page: `<Input>` from shared-ui (correct)
2. Login page: Raw `<input>` with manually duplicated Input styles

**Cards:** Inconsistent container patterns:

1. Settings: `<Card>` + `<CardHeader>` + `<CardContent>` (correct composition)
2. All other pages: Raw `<div className="rounded-lg border bg-card p-4">` —
   visually identical but doesn't use the Card component

### 7.3 Recommendations

- **Replace all raw `<input>` with shared-ui `Input`** — 4 instances in
  LoginPage
- **Replace all raw `<button>` with shared-ui `Button`** — 3 instances in
  LoginPage, 1 in Dashboard
- **Use `Card` composition** on data display sections — Children cards,
  ExamResults cards, SpaceProgress cards
- **Create a `StatusBadge` component** (or use shared-ui `Badge` with variants)
  for active/inactive/at-risk states
- **Extract `color-coded percentage` pattern** into a reusable `PercentageBadge`
  component — used 12+ times across pages

---

## 8. Data Visualization Audit

### 8.1 Current Visualizations

| Visualization       | Component        | Page                                      | Data                              |
| ------------------- | ---------------- | ----------------------------------------- | --------------------------------- |
| Circular progress   | `ProgressRing`   | Dashboard, Children                       | Overall score 0-100%              |
| Score cards         | `ScoreCard`      | Dashboard, ChildProgress                  | Single metrics                    |
| Bar charts          | `SimpleBarChart` | ChildProgress                             | Subject breakdown (exams, spaces) |
| Progress bars       | Raw `<div>`      | ChildProgress, ExamResults, SpaceProgress | Score/completion percentage       |
| Color-coded numbers | Raw `<span>`     | Dashboard, Children, ExamResults          | Green/yellow/red by threshold     |

### 8.2 Missing Visualizations

| Type                   | Use Case                          | Priority                               |
| ---------------------- | --------------------------------- | -------------------------------------- |
| **Line/area chart**    | Score trends over time            | High — parents need to see improvement |
| **Comparison chart**   | Child vs class average            | High — context for scores              |
| **Calendar heatmap**   | Daily learning activity / streak  | Medium — motivation tool               |
| **Radar/spider chart** | Multi-subject strength profile    | Medium — holistic view                 |
| **Pie/donut chart**    | Time distribution across subjects | Low — nice-to-have                     |

### 8.3 Color Coding Consistency

The app uses a consistent 3-tier color threshold system:

- `>= 70%` → green (`text-green-600` / `bg-green-500`)
- `>= 40%` → yellow (`text-yellow-600` / `bg-yellow-500`)
- `< 40%` → red (`text-red-600` / `bg-red-500`)

This is applied consistently on: ProgressRing (auto-color), exam score displays,
progress bars.

**Issue:** These thresholds are hardcoded in every component. They should be
centralized as constants or configuration so schools can customize grade
boundaries.

---

## 9. Loading, Empty & Error States

### 9.1 Loading States Audit

| Page                      | Loading Implementation        | Quality                                 |
| ------------------------- | ----------------------------- | --------------------------------------- |
| Dashboard — ScoreCards    | No loading state (shows 0/--) | Poor — cards render with default values |
| Dashboard — Children grid | 3 pulsing gray rectangles     | Fair — doesn't match actual card shape  |
| Children                  | 2 pulsing gray rectangles     | Fair — same issue                       |
| ChildProgress             | "Loading..." centered text    | Poor — no visual structure              |
| ExamResults               | 4 pulsing gray rectangles     | Fair — closer to actual card height     |
| SpaceProgress             | "Loading progress..." text    | Poor — no spinner, no skeleton          |
| Notifications             | Delegated to shared-ui        | Good                                    |
| Settings — prefs          | "Loading preferences..." text | Poor — no skeleton for switches         |

**Recommendation:** Create proper skeleton variants matching each page's actual
layout structure. Use `Skeleton` component from shared-ui if available, or
create shimmer cards with proper proportions.

### 9.2 Empty States Audit

| Page                        | Empty State                                   | Quality |
| --------------------------- | --------------------------------------------- | ------- |
| Dashboard — no children     | Icon + "No linked children" + guidance        | Good    |
| Children — no children      | Icon + "No children linked" + "Contact admin" | Good    |
| ChildProgress — no data     | "No progress data available yet" + guidance   | Good    |
| ExamResults — no results    | Icon + "No results available" + guidance      | Good    |
| SpaceProgress — no progress | "No progress data yet" + guidance             | Good    |

**Assessment:** Empty states are consistently good. All include an icon,
heading, and helpful description. Could be improved with illustrations and a CTA
button.

### 9.3 Error States Audit

| Scenario                 | Current Handling                     | Quality                     |
| ------------------------ | ------------------------------------ | --------------------------- |
| Login validation error   | Red `bg-destructive/10` box          | Fair — no dismiss, no icon  |
| Auth error (wrong creds) | Same red box via store `error`       | Fair                        |
| Network failure          | No handling — TanStack Query retry:1 | Poor — no offline indicator |
| Firebase query error     | Silently caught, returns empty       | Poor — no user feedback     |
| Access denied            | "Access Denied" full-screen          | Fair — no way to recover    |

**Critical Gap:** No global error handling for network failures. Parents on poor
mobile connections get no feedback when data fails to load.

---

## 10. Mobile & Responsive Design

### 10.1 Current Responsive Breakpoints

The app uses Tailwind's default breakpoints:

- `md:` (768px) — used for grid column changes
- `lg:` (1024px) — used for wider grids

**There are NO `sm:` breakpoints used anywhere in the app.**

### 10.2 Mobile Layout Issues

| Page          | Mobile Issue                                                             |
| ------------- | ------------------------------------------------------------------------ |
| Dashboard     | 4 ScoreCards stack to single column — too long; Quick Actions stack fine |
| Dashboard     | Children grid stacks to single column — OK but cards are wide            |
| Children      | 4-metric row stacks vertically — acceptable                              |
| ChildProgress | 5 ScoreCards in single column — excessive scrolling                      |
| ChildProgress | Side-by-side charts stack — OK but very long scroll                      |
| ExamResults   | Accordion items work well on mobile — best mobile page                   |
| SpaceProgress | 2-column grid stacks — OK                                                |
| Settings      | Switch rows work well on mobile                                          |
| Login         | Centered card works well — best mobile experience                        |

### 10.3 Sidebar on Mobile

The `AppSidebar` from shared-ui likely collapses to an overlay drawer on mobile
(standard shadcn sidebar behavior with `collapsible="icon"` mode), but:

- No bottom navigation for quick access to key pages
- Sidebar trigger (hamburger) is the only navigation mechanism on mobile
- No swipe gestures

### 10.4 Mobile-Specific Recommendations

1. **Add bottom navigation bar** for mobile with 4 key tabs: Dashboard,
   Children, Results, More
2. **Redesign ScoreCards for mobile** — use a 2-column grid at `sm:` breakpoint
   instead of stacking to 1
3. **Use horizontal scroll for child selector** on ChildProgress instead of
   wrapping buttons
4. **Implement pull-to-refresh** for data freshness
5. **Add touch-friendly tap targets** — some interactive elements (exam title
   truncation, small buttons) are < 44px
6. **Consider a mobile-specific dashboard** with a more compact layout

---

## 11. Accessibility Audit

### 11.1 WCAG 2.1 AA Compliance

| Criterion                        | Status      | Notes                                                                                                       |
| -------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------- |
| **1.1.1 Non-text Content**       | Partial     | Icons are decorative (OK), but ProgressRing SVG lacks `role="img"` + `aria-label`                           |
| **1.3.1 Info and Relationships** | Partial     | Proper heading hierarchy (`h1` on each page), but data grids lack `role="list"` or table semantics          |
| **1.4.1 Use of Color**           | Fail        | Color-coded percentages (green/yellow/red) convey meaning without text alternative                          |
| **1.4.3 Contrast**               | Likely Pass | Uses design system HSL variables; `text-muted-foreground` should have 4.5:1 ratio                           |
| **1.4.11 Non-text Contrast**     | Partial     | Progress bars and rings convey data via color only                                                          |
| **2.1.1 Keyboard**               | Partial     | Shared-ui components (Popover, AlertDialog) are keyboard-accessible; custom accordion on ExamResults is NOT |
| **2.4.1 Bypass Blocks**          | Pass        | Sidebar navigation provides page structure; skip-to-content link via AppShell                               |
| **2.4.6 Headings and Labels**    | Pass        | Each page has descriptive h1; form labels are present                                                       |
| **2.4.7 Focus Visible**          | Pass        | Tailwind's `focus-visible:ring-2` applied on inputs/buttons                                                 |
| **3.3.1 Error Identification**   | Partial     | Login shows error text but doesn't associate it with specific fields via `aria-describedby`                 |
| **4.1.2 Name, Role, Value**      | Partial     | Shared-ui components handle this; custom status badges lack ARIA                                            |

### 11.2 Key Accessibility Fixes Needed

1. **Add `aria-label` to ProgressRing SVG** — screen readers can't interpret the
   visual progress
2. **Add text labels alongside color-coded scores** — use "(Excellent)", "(Needs
   Improvement)" etc.
3. **Replace custom ExamResults accordion** with shadcn `Accordion` — built-in
   keyboard nav + ARIA
4. **Associate error messages with inputs** via `aria-describedby` on login form
5. **Add `role="status"` and `aria-live="polite"`** to loading indicators
6. **Add screen reader text to AtRiskBadge** — current `title` attribute is not
   announced by all screen readers

---

## 12. Trust & Professional Appearance

### 12.1 Trust Indicators Assessment

| Indicator                   | Present | Notes                                                                           |
| --------------------------- | ------- | ------------------------------------------------------------------------------- |
| School branding/logo        | No      | Only "Parent Portal" text on login; no school logo after validation             |
| Professional login page     | Partial | Functional but bare; no illustration, no testimonial                            |
| Data freshness indicator    | No      | Parents don't know when scores were last updated                                |
| Secure connection indicator | No      | No visual HTTPS/security badge (handled by browser, but a lock icon would help) |
| Contact/support link        | No      | No help link, no "Contact school" CTA                                           |
| Privacy policy link         | No      | No link to data privacy / terms of service                                      |
| Version/copyright           | No      | No footer with app version or copyright                                         |

### 12.2 Visual Polish Assessment

| Aspect               | Assessment                                                                                                            |
| -------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Typography**       | Good — consistent use of `text-2xl font-bold` for h1, `text-sm text-muted-foreground` for descriptions                |
| **Spacing**          | Good — consistent `space-y-6` page rhythm, `gap-4` card grids                                                         |
| **Color palette**    | Fair — blue primary is professional but mono-tonal; no secondary/accent color for variety                             |
| **Elevation/shadow** | Poor — minimal use of shadows; cards are flat with `border` only                                                      |
| **Icons**            | Good — consistent Lucide icon usage, appropriate metaphors                                                            |
| **Animation/motion** | Poor — only `animate-pulse` on skeletons and `transition-shadow` on cards. No page transitions, no micro-interactions |
| **Illustrations**    | None — empty states use icons only, no SVG illustrations                                                              |

---

## 13. Redesign Recommendations

### 13.1 High-Impact Quick Wins (1-2 days each)

#### R1: Fix Child Display Names

**Effort:** Small | **Impact:** High

Replace all instances of `studentId` / `uid.slice()` with actual display names.
The `useStudentNames` hook already exists in SpaceProgressPage — extract it to a
shared hook and use it across all pages.

```tsx
// Before (DashboardPage line 195)
{
  student.studentId || `Child ${idx + 1}`;
}

// After
{
  studentNames?.[student.uid] || student.studentId || `Child ${idx + 1}`;
}
```

Also fix avatar initials:

```tsx
// Before
{
  student.uid.slice(0, 2).toUpperCase();
}

// After — use actual name initials
{
  getInitials(studentNames?.[student.uid] || student.studentId || "C");
}
```

#### R2: Add Dark Mode Variables

**Effort:** Small | **Impact:** High

Add `.dark` class variables to `index.css`:

```css
.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  --card: 222.2 84% 4.9%;
  --card-foreground: 210 40% 98%;
  /* ... full dark palette ... */
}
```

#### R3: Replace Raw HTML Elements on Login

**Effort:** Small | **Impact:** High

Replace all `<input>` with `<Input>`, all `<button>` with `<Button>`, and add
`<Label>` from shared-ui. Add `Card` wrapper:

```tsx
<Card>
  <CardHeader>
    <CardTitle>Parent Portal</CardTitle>
    <CardDescription>Sign in to view your child's progress</CardDescription>
  </CardHeader>
  <CardContent>
    <form className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" placeholder="parent@email.com" />
      </div>
      {/* ... */}
      <Button type="submit" className="w-full">
        Sign In
      </Button>
    </form>
  </CardContent>
</Card>
```

#### R4: Add Forgot Password Link

**Effort:** Small | **Impact:** High

Add a "Forgot password?" link on the credentials step that triggers Firebase's
`sendPasswordResetEmail`:

```tsx
<div className="flex justify-end">
  <Button variant="link" size="sm" onClick={handleForgotPassword}>
    Forgot password?
  </Button>
</div>
```

#### R5: Remove Redundant LogoutButton from Dashboard

**Effort:** Trivial | **Impact:** Minor

Remove the LogoutButton from Dashboard header. It's already in Settings and
could be added to the sidebar user menu instead.

### 13.2 Medium-Impact Improvements (3-5 days each)

#### R6: Consolidated Child Detail Page

**Effort:** Medium | **Impact:** High

Create a new route `/children/:childId` that merges:

- ChildProgress content (stats, charts, strengths/weaknesses)
- SpaceProgress content (learning module cards)
- ExamResults content (filtered to this child)

Use tabs:

```
/children/:id          → redirects to /children/:id/progress
/children/:id/progress → Progress tab (merged ChildProgress + SpaceProgress)
/children/:id/exams    → Exams tab (filtered ExamResults)
/children/:id/activity → Activity tab (timeline)
```

This eliminates the confusing Children/ChildProgress/SpaceProgress navigation.

#### R7: Replace Hardcoded Colors with Semantic Tokens

**Effort:** Medium | **Impact:** Medium

Replace all hardcoded Tailwind color classes with HSL CSS variable-based
equivalents:

```tsx
// Before
className = "border-red-200 bg-red-50 text-red-700";

// After — use semantic variables
className = "border-destructive/20 bg-destructive/5 text-destructive";
```

For non-destructive semantic colors (success, warning, info), add new CSS
variables:

```css
:root {
  --success: 142 76% 36%;
  --success-foreground: 355 7% 97%;
  --warning: 38 92% 50%;
  --warning-foreground: 48 96% 89%;
  --info: 221.2 83.2% 53.3%;
  --info-foreground: 210 40% 98%;
}
```

#### R8: Mobile Bottom Navigation

**Effort:** Medium | **Impact:** High

Add a fixed bottom navigation bar visible only on mobile (`md:hidden`):

```tsx
<nav className="bg-background fixed bottom-0 left-0 right-0 z-50 border-t md:hidden">
  <div className="flex h-14 items-center justify-around">
    <NavTab icon={LayoutDashboard} label="Home" to="/" />
    <NavTab icon={Users} label="Children" to="/children" />
    <NavTab icon={ClipboardList} label="Results" to="/results" />
    <NavTab
      icon={Bell}
      label="Alerts"
      to="/notifications"
      badge={unreadCount}
    />
  </div>
</nav>
```

#### R9: Proper Skeleton Loading States

**Effort:** Medium | **Impact:** Medium

Create skeleton variants for each page that match the actual rendered layout:

```tsx
// Dashboard skeleton
<div className="space-y-6">
  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
    {Array.from({ length: 4 }).map((_, i) => (
      <Skeleton key={i} className="h-24 rounded-lg" />
    ))}
  </div>
  <div className="grid gap-3 md:grid-cols-3">
    {Array.from({ length: 3 }).map((_, i) => (
      <Skeleton key={i} className="h-16 rounded-lg" />
    ))}
  </div>
</div>
```

#### R10: Extract Inline Hooks

**Effort:** Medium | **Impact:** Medium (code quality)

Move inline hooks to proper files:

| Current Location                                  | New Location                              |
| ------------------------------------------------- | ----------------------------------------- |
| `ExamResultsPage.tsx:useChildSubmissions`         | `hooks/useChildSubmissions.ts`            |
| `ExamResultsPage.tsx:useQuestionSubmissions`      | `hooks/useQuestionSubmissions.ts`         |
| `SpaceProgressPage.tsx:useChildProgress`          | `hooks/useChildProgress.ts`               |
| `SpaceProgressPage.tsx:useStudentNames`           | `hooks/useStudentNames.ts`                |
| `SpaceProgressPage.tsx:useSpaceNames`             | `hooks/useSpaceNames.ts`                  |
| `SettingsPage.tsx:useNotificationPreferences`     | `hooks/useNotificationPreferences.ts`     |
| `SettingsPage.tsx:useSaveNotificationPreferences` | `hooks/useSaveNotificationPreferences.ts` |
| `AppLayout.tsx:useTenantNames`                    | `hooks/useTenantNames.ts`                 |

### 13.3 High-Effort, High-Impact Improvements (1-2 weeks)

#### R11: Historical Trend Charts

**Effort:** Large | **Impact:** High

Add time-series visualizations using recharts (already in monorepo
dependencies):

- **Score trend line** — exam average over the last N exams
- **Activity heatmap** — daily learning streak calendar
- **Subject radar chart** — multi-axis strength profile

These would live in the new child detail page's Progress tab.

#### R12: Parent-Teacher Communication

**Effort:** Large | **Impact:** High

Add a messaging feature:

- View messages from teachers (currently notifications only)
- Reply to teacher messages
- Request parent-teacher meeting

This requires backend work (new Firestore collection, Cloud Functions for
notifications).

#### R13: Weekly Summary Digest

**Effort:** Large | **Impact:** High

Auto-generated weekly summary card on Dashboard:

```
📊 This Week's Summary
Sarah: ↑ Improved 5% in Math, completed 2 spaces
James: Exam results released (85%), streak: 7 days!
```

Could be generated via Cloud Function and stored as a special notification type.

---

## 14. Implementation Roadmap

### Phase 1: Foundation Fixes (Week 1)

**Goal:** Fix critical issues that undermine trust and usability

| Task                                                          | Est.  | Priority |
| ------------------------------------------------------------- | ----- | -------- |
| R1: Fix child display names across all pages                  | 2h    | P0       |
| R2: Add dark mode CSS variables                               | 3h    | P0       |
| R3: Redesign login with shared-ui components                  | 4h    | P0       |
| R4: Add forgot password flow                                  | 3h    | P0       |
| R5: Remove redundant LogoutButton from dashboard              | 15min | P1       |
| R10: Extract all inline hooks to `hooks/` directory           | 4h    | P1       |
| Replace ExamResults custom accordion with shadcn Accordion    | 2h    | P1       |
| Replace all raw HTML inputs/buttons with shared-ui components | 2h    | P1       |

**Total: ~20 hours**

### Phase 2: Navigation & Mobile (Week 2)

**Goal:** Fix information architecture and mobile experience

| Task                                                        | Est. | Priority |
| ----------------------------------------------------------- | ---- | -------- |
| R6: Create consolidated child detail page (`/children/:id`) | 16h  | P1       |
| R8: Add mobile bottom navigation                            | 4h   | P1       |
| Add Notifications to sidebar with unread badge              | 1h   | P2       |
| Implement proper skeleton loading states (R9)               | 6h   | P2       |
| Add responsive breakpoint fixes across all pages            | 4h   | P1       |

**Total: ~31 hours**

### Phase 3: Polish & Delight (Week 3)

**Goal:** Elevate the parent experience

| Task                                                      | Est. | Priority |
| --------------------------------------------------------- | ---- | -------- |
| R7: Replace hardcoded colors with semantic tokens         | 6h   | P1       |
| Add toast notifications for save actions                  | 2h   | P2       |
| Add data freshness indicators ("Updated 5 min ago")       | 3h   | P2       |
| Add accessibility fixes (ARIA labels, screen reader text) | 6h   | P1       |
| Add "Contact School" / support link                       | 2h   | P2       |
| Add school branding to login (logo after code validation) | 3h   | P2       |

**Total: ~22 hours**

### Phase 4: Advanced Features (Week 4+)

**Goal:** Differentiate the parent experience

| Task                                                | Est. | Priority |
| --------------------------------------------------- | ---- | -------- |
| R11: Historical trend charts (recharts integration) | 16h  | P2       |
| R13: Weekly summary digest on Dashboard             | 12h  | P2       |
| Add settings for language/locale preference         | 8h   | P3       |
| Add parent-specific onboarding flow                 | 8h   | P3       |
| R12: Parent-teacher communication                   | 24h  | P3       |

**Total: ~68 hours**

---

## Appendix A: File Reference

| File                              | Lines      | Purpose                                                |
| --------------------------------- | ---------- | ------------------------------------------------------ |
| `src/main.tsx`                    | 37         | App bootstrap (Firebase, React Query, Router)          |
| `src/App.tsx`                     | 67         | Route definitions, auth/tenant init                    |
| `src/index.css`                   | 47         | Tailwind directives + HSL color variables (light only) |
| `src/guards/RequireAuth.tsx`      | 39         | Auth guard with role checking                          |
| `src/hooks/useLinkedStudents.ts`  | 44         | Core parent→student relationship hook                  |
| `src/layouts/AppLayout.tsx`       | 177        | Main app shell with sidebar + header                   |
| `src/layouts/AuthLayout.tsx`      | 11         | Minimal centered auth wrapper                          |
| `src/pages/LoginPage.tsx`         | 166        | Two-step login form                                    |
| `src/pages/DashboardPage.tsx`     | 296        | Parent dashboard with overview                         |
| `src/pages/ChildrenPage.tsx`      | 194        | Children enrollment list                               |
| `src/pages/ChildProgressPage.tsx` | 392        | Deep analytics per child                               |
| `src/pages/ExamResultsPage.tsx`   | 511        | Exam submissions with Q&A feedback                     |
| `src/pages/SpaceProgressPage.tsx` | 227        | Learning space progress                                |
| `src/pages/NotificationsPage.tsx` | 41         | Shared-ui notifications wrapper                        |
| `src/pages/SettingsPage.tsx`      | 288        | Profile + prefs + account                              |
| **Total**                         | **~2,536** |                                                        |

## Appendix B: Shared-UI Components Used

| Component                  | Import Path          | Used By                  |
| -------------------------- | -------------------- | ------------------------ |
| `AppShell`                 | `@levelup/shared-ui` | AppLayout                |
| `AppSidebar`               | `@levelup/shared-ui` | AppLayout                |
| `NotificationBell`         | `@levelup/shared-ui` | AppLayout                |
| `RoleSwitcher`             | `@levelup/shared-ui` | AppLayout                |
| `ScoreCard`                | `@levelup/shared-ui` | Dashboard, ChildProgress |
| `ProgressRing`             | `@levelup/shared-ui` | Dashboard, Children      |
| `AtRiskBadge`              | `@levelup/shared-ui` | Dashboard, Children      |
| `SimpleBarChart`           | `@levelup/shared-ui` | ChildProgress            |
| `LogoutButton`             | `@levelup/shared-ui` | Dashboard, Settings      |
| `DownloadPDFButton`        | `@levelup/shared-ui` | ExamResults              |
| `NotificationsPage` (UI)   | `@levelup/shared-ui` | NotificationsPage        |
| `Card`, `CardHeader`, etc. | `@levelup/shared-ui` | Settings                 |
| `Button`, `Input`, `Label` | `@levelup/shared-ui` | Settings                 |
| `Switch`                   | `@levelup/shared-ui` | Settings                 |
| `ErrorBoundary`            | `@levelup/shared-ui` | main.tsx                 |
| `NotFoundPage`             | `@levelup/shared-ui` | App.tsx                  |

## Appendix C: Color Coding Thresholds

Used consistently across all data pages:

| Range  | Color        | Label                | CSS Class                           |
| ------ | ------------ | -------------------- | ----------------------------------- |
| >= 70% | Green        | Excellent / On Track | `text-green-600` / `bg-green-500`   |
| >= 40% | Yellow/Amber | Needs Improvement    | `text-yellow-600` / `bg-yellow-500` |
| < 40%  | Red          | At Risk / Failing    | `text-red-600` / `bg-red-500`       |

**Recommendation:** Centralize these as `SCORE_THRESHOLDS` constant and consider
making them configurable per tenant.
