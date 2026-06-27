# UI/UX Audit: LevelUp-App (Student-Facing Application)

**Date:** March 2026 **Auditor:** UI/UX Design Agent **App:** LevelUp-App
(`/LevelUp-App/`) **Tech Stack:** React 18, Vite, Tailwind CSS 3.4, shadcn/ui,
Firebase, React Router v6, TanStack React Query, Redux Toolkit, Framer Motion,
Lucide React

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State Analysis](#2-current-state-analysis)
3. [Issues Found](#3-issues-found)
4. [Page-by-Page Improvement Recommendations](#4-page-by-page-improvement-recommendations)
5. [Component Library Improvements](#5-component-library-improvements)
6. [Design System Recommendations](#6-design-system-recommendations)
7. [Navigation & Information Architecture](#7-navigation--information-architecture)
8. [Accessibility Improvements](#8-accessibility-improvements)
9. [Mobile & Responsive Strategy](#9-mobile--responsive-strategy)
10. [Performance & Loading States](#10-performance--loading-states)
11. [Implementation Priority Roadmap](#11-implementation-priority-roadmap)

---

## 1. Executive Summary

### Overview

The LevelUp-App is a student-facing educational platform supporting courses,
story points (lessons/chapters), timed tests, practice ranges, leaderboards, and
AI-tutored question solving. It serves multiple user roles (student, admin,
super admin) and handles complex flows including course redemption, progress
tracking, and timed assessments.

### Strengths

- **Solid component foundation**: Uses shadcn/ui + Radix primitives correctly,
  providing a baseline of accessible interactive components (dialogs, dropdowns,
  tooltips, tabs)
- **Responsive mobile navigation**: Bottom navigation pattern (`MainBottomNav`,
  `CourseBottomNav`) is appropriate for mobile-first student use
- **HSL design token system**: Well-structured CSS custom properties for theming
  with light/dark mode support
- **Lazy loading**: All page components are lazy-loaded with `React.lazy()` +
  `Suspense`, good for performance
- **Real-time subscriptions**: Firebase real-time listeners provide live
  progress updates
- **Skeleton loading states**: Several pages implement skeleton placeholders
  (Course page, StoryPoint page)

### Critical Concerns

- **Leftover Vite boilerplate CSS** (`App.css`) applying `max-width: 1280px`,
  `padding: 2rem`, and `text-align: center` to `#root` — likely breaking layouts
  globally
- **Hardcoded colors** in `NotFound.tsx` (`bg-gray-100`, `text-gray-600`,
  `text-blue-500`) bypassing the design system
- **No dark mode toggle** exposed to users despite full dark mode CSS variable
  support
- **Inconsistent layout patterns** across pages — some use `max-w-7xl`, others
  `max-w-6xl`, `max-w-4xl`, `max-w-2xl` with no clear system
- **Excessive `console.log` statements** in production code (Home.tsx has 15+
  debug logs)
- **`window.location.reload()`** used in 5+ places instead of proper React state
  management
- **Missing keyboard navigation** in many custom interactive elements
- **No focus management** after route transitions or dialog close

### Overall Grade: **C+** — Functional but needs significant polish

The app works but suffers from inconsistent design language, accessibility gaps,
accumulated technical debt (leftover boilerplate, hardcoded colors), and missed
opportunities for a premium learning experience befitting the "LevelUp" brand.

---

## 2. Current State Analysis

### 2.1 App Architecture

**File: `src/App.tsx`**

The app uses a provider-heavy root with 7 nested context providers:

```
ReduxProvider > QueryClientProvider > TooltipProvider > AuthProvider > BrowserRouter > OrgProvider > OnboardingProvider > LoginDialogProvider
```

**Issues:**

- Provider nesting depth creates potential performance overhead (7 levels of
  context re-renders)
- Both `Toaster` (Radix) and `Sonner` toast systems mounted simultaneously —
  pick one
- `QueryClient` instantiated outside component but with default config (no
  `staleTime`, `gcTime`, or `retry` settings)

**Routes:** 20+ routes across 4 layout patterns:

1. `MainLayout` — Home, Store, Settings, Orgs (with bottom nav)
2. `CourseLayout` — Course detail, admin dashboards (with course bottom nav)
3. No layout — StoryPoint, TimedTest pages (custom internal layouts)
4. No layout — PracticeRange pages

### 2.2 Layout System

**File: `src/layouts/MainLayout.tsx` (lines 1-21)** **File:
`src/layouts/CourseLayout.tsx` (lines 1-21)**

Both layouts are nearly identical:

```tsx
<div className="bg-background min-h-screen pb-16 md:pb-0">
  <AppHeader rightExtra={<span>LevelUp</span>} />
  <Outlet />
  <MainBottomNav /> // or CourseBottomNav
</div>
```

**Issues:**

- No max-width container at the layout level — each page handles its own
  `max-w-*`
- `pb-16 md:pb-0` accounts for bottom nav height but is a magic number
- The "LevelUp" text in the header uses inline gradient styles
  (`bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600`) that don't use
  design tokens
- No sidebar layout for desktop — the app is purely vertical which wastes
  horizontal space on wide screens
- No breadcrumb component for deep navigation (Course > StoryPoint > Question)

### 2.3 Color System

**File: `src/index.css` (lines 9-130)**

Well-structured HSL variable system with:

- Core semantics: `--background`, `--foreground`, `--primary`, `--secondary`,
  `--muted`, `--accent`, `--destructive`
- Tier colors: `--tier-silver`, `--tier-gold`, `--tier-platinum`,
  `--tier-diamond`
- Learning states: `--state-locked`, `--state-available`, `--state-progress`,
  `--state-completed`
- Gradient variables for cosmic, space, progress, and glow effects
- Sidebar-specific variables

**Issues:**

- Tier/state colors defined but barely used in the actual UI — the gamification
  system feels dormant
- `--shadow-glow`, `--shadow-tier-gold`, `--shadow-tier-diamond` are all set to
  `0 0 0 transparent` in light mode (no-op)
- Gradient variables defined but inconsistently applied — many pages use inline
  Tailwind gradients instead
- The dark mode `--destructive: 0 62.8% 30.6%` produces a very dark red that may
  not be visible enough

### 2.4 Critical CSS Issue — `App.css`

**File: `src/App.css` (lines 1-43)**

This is **leftover Vite/React boilerplate** that was never removed:

```css
#root {
  max-width: 1280px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
}
```

**Impact:** This applies `text-align: center` to the entire app and adds `2rem`
padding globally. While individual components may override this, it's a latent
bug that affects any element not explicitly setting its own text alignment. The
`.logo`, `.card`, and `.read-the-docs` classes are completely unused.

**Recommendation:** Delete `App.css` entirely and remove its import from
`App.tsx` (it's likely imported in `main.tsx`).

### 2.5 Typography

No formal typography scale is defined. Font sizes are applied ad-hoc:

- Headings range from `text-lg` to `text-4xl` with no consistent hierarchy
- Body text oscillates between `text-xs`, `text-sm`, and `text-base`
- Several instances of `text-[10px]`, `text-[11px]`, `text-[9px]` — pixel-level
  text is hard to read on mobile

### 2.6 State Management

The app uses three concurrent state management approaches:

1. **Redux Toolkit** (`src/store/`) — appears to be for courses slice
2. **React Context** — Auth, Org, Onboarding, LoginDialog
3. **TanStack React Query** — QueryClient is mounted but I found no
   `useQuery`/`useMutation` hooks in the main pages; all data fetching uses raw
   `useEffect` + `useState`

**Issue:** TanStack React Query is installed but seemingly unused in favor of
manual `useEffect` data fetching patterns. This means no automatic caching,
deduplication, background refetching, or optimistic updates.

---

## 3. Issues Found

### 3.1 Critical Issues

| #   | Issue                                                                               | Location                                                                                                                                                 | Impact                                                                   |
| --- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| C1  | **App.css boilerplate** applies `text-align: center` and `padding: 2rem` to `#root` | `src/App.css:1-6`                                                                                                                                        | Global layout corruption, affects all pages                              |
| C2  | **`window.location.reload()`** used for state sync                                  | `Home.tsx:166,206`, `Store.tsx:303`, `Course.tsx:538`                                                                                                    | Destroys React state, causes full page flash, kills any in-memory caches |
| C3  | **Hardcoded colors** bypass design system                                           | `NotFound.tsx:15,19` (`bg-gray-100`, `text-blue-500`), `TimedTestQuestionPage.tsx:435` (`text-gray-600`), `TimedTestQuestionPage.tsx:528` (`bg-gray-50`) | Breaks dark mode, inconsistent with theme                                |
| C4  | **Duplicate toast systems** — both `Toaster` (Radix) and `Sonner` mounted           | `App.tsx:1-2`                                                                                                                                            | Confusing for users, extra bundle size, unclear which fires              |
| C5  | **No error boundaries** — unhandled promise rejections in data fetching             | All pages with `useEffect` async calls                                                                                                                   | App crashes on network errors instead of showing error states            |

### 3.2 Major Issues

| #   | Issue                                                                                         | Location                                              | Impact                                                                            |
| --- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------- |
| M1  | **No loading/error/empty state system** — each page reimplements its own                      | Throughout                                            | Inconsistent user experience                                                      |
| M2  | **Excessive console.log in production** — 15+ debug logs in Home.tsx alone                    | `Home.tsx:63,106-112,118-119,129-135,139-140,153,160` | Performance impact, exposes internals, unprofessional                             |
| M3  | **TanStack React Query installed but unused** — all data fetching is manual useEffect         | All pages                                             | No caching, no deduplication, no background refresh, race conditions              |
| M4  | **No dark mode toggle** in the UI despite full CSS variable support                           | Settings page, AppHeader                              | Users can't switch themes; system preference detection not implemented            |
| M5  | **Inconsistent max-width containers** — `max-w-7xl`, `max-w-6xl`, `max-w-4xl`, `max-w-2xl`    | Throughout                                            | Different content widths on different pages feels disjointed                      |
| M6  | **Missing `<TabsList>` in Course.tsx** — Tabs component rendered without visible tab triggers | `Course.tsx:461-640`                                  | Users can't switch tabs on desktop; only mobile bottom nav provides tab switching |
| M7  | **`window.location.href` used for navigation** instead of `navigate()`                        | `StoryPoint.tsx:380,547-548`, `Course.tsx:765`        | Causes full page reloads, loses React state, poor UX                              |
| M8  | **dangerouslySetInnerHTML with inline script**                                                | `StoryPoint.tsx:505-512`                              | Security risk (XSS vector), anti-pattern in React                                 |
| M9  | **Framer Motion installed** but not used anywhere in the audited pages                        | `package.json`                                        | 60KB+ of unused bundle size                                                       |

### 3.3 Minor Issues

| #   | Issue                                                        | Location                                                  | Impact                                                              |
| --- | ------------------------------------------------------------ | --------------------------------------------------------- | ------------------------------------------------------------------- |
| m1  | **No favicon or app icon** visible in configuration          | Root files                                                | Missing brand identity in browser tab                               |
| m2  | **Generic page title** — no dynamic `<title>` per page       | All pages                                                 | Poor SEO, confusing browser tabs when multiple open                 |
| m3  | **Avatar URL as text input** in profile form                 | `UserProfileForm.tsx:114`                                 | Users expected to paste URLs — should use file upload               |
| m4  | **No form validation feedback** in UserProfileForm           | `UserProfileForm.tsx`                                     | No field-level validation, error shown as generic string            |
| m5  | **Magic aspect ratio** `2.2/3.3` repeated 8+ times inline    | `Home.tsx:320,433`, `Store.tsx:311`, `Course.tsx:680,750` | Should be a CSS variable or Tailwind utility                        |
| m6  | **No "back to top"** on long scrolling pages                 | Landing page, Course page                                 | Poor navigation on long content                                     |
| m7  | **QR code placeholder** in landing page footer               | `LandingPage.tsx:476-479`                                 | Unprofessional — shows `[QR Code Placeholder]` text                 |
| m8  | **No skip-to-content link**                                  | Layout components                                         | Accessibility requirement for keyboard users                        |
| m9  | **Emoji used as icons** in feature cards and category labels | `Home.tsx:387-399`, `Store.tsx:73-78`                     | Inconsistent with Lucide icon system, renders differently across OS |
| m10 | **`any` TypeScript type** used extensively                   | `Home.tsx:19`, `Course.tsx:82`, `StoryPoint.tsx:31,36`    | Reduces type safety and IDE support                                 |

---

## 4. Page-by-Page Improvement Recommendations

### 4.1 Landing Page (`src/landing-page/v2/LandingPage.tsx`)

**Current State:** A professional, multi-section B2B landing page targeting
educational institutions. Well-structured with clear value proposition sections,
visually appealing gradient treatments, and proper use of Card components.

**Strengths:**

- Clear information hierarchy with distinct sections
- Consistent use of Badge, Card, and Button components
- Good responsive grid layouts
- Appropriate use of Lucide icons

**Issues & Recommendations:**

1. **QR Code Placeholder (line 476-479):** Replace `[QR Code Placeholder]` with
   actual QR code using the installed `react-qr-code` package, or remove
   entirely

2. **No animation/scroll effects:** The page is entirely static. Add subtle
   scroll-triggered animations using Framer Motion (already installed but
   unused):

   ```tsx
   <motion.div
     initial={{ opacity: 0, y: 20 }}
     whileInView={{ opacity: 1, y: 0 }}
     viewport={{ once: true }}
   >
   ```

3. **Iceberg visual (lines 106-116):** Currently built with simple divs and
   text. Replace with an SVG illustration or use CSS clip-paths for a more
   polished visual

4. **Mobile CTA stickiness:** Add a sticky CTA bar on mobile that appears after
   scrolling past the hero section

5. **Footer (lines 462-486):** Incomplete — needs proper navigation links
   (Privacy Policy, Terms, About), social media links, and the QR code should
   link to the app

### 4.2 Home Page (`src/pages/Home.tsx`)

**Current State:** Displays user's courses in a grid with thumbnails, progress
bars, archive/unarchive functionality, and an empty state for new users.

**Strengths:**

- Good hover interactions on course cards (scale, shadow, border highlight)
- Progress bar below cards with gradient and shimmer animation
- Well-designed empty state with feature cards

**Issues & Recommendations:**

1. **Remove all console.log statements** (15+ instances). Use a proper logging
   service for production

2. **Replace `window.location.reload()`** (lines 166, 206) with React state
   updates after successful operations — the `handleArchive`/`handleUnarchive`
   functions already update state locally, so the reload is only a fallback for
   edge cases. Use a toast notification instead of reloading

3. **Course card grid responsiveness:** Currently
   `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5`. On mobile
   (2-col), the tall aspect ratio `2.2/3.3` makes cards very small. Recommend
   `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4` for better
   readability

4. **Missing course search/filter:** No way to search or filter courses when a
   user has many. Add a search bar at the top

5. **Progress indicator improvement:** The current
   `{course.progressPercent}% Complete` text below the bar is tiny
   (`text-[11px]`). Overlay the percentage directly on the progress bar or show
   it as a badge on the thumbnail

6. **"My Spaces" vs "My Courses":** The heading says "My Spaces" but the feature
   is "courses". Standardize terminology across the app

7. **Add streak/last-accessed indicator:** Show when the user last opened each
   course to encourage return visits

### 4.3 Store / Explore Page (`src/pages/Store.tsx`)

**Current State:** Two-view architecture — a menu view with 3 action cards
(Create, Explore, Organizations), and a courses browsing view with sidebar
categories and grid layout.

**Strengths:**

- Good category sidebar with active state highlighting
- Clean mobile horizontal scroll for categories
- Nice hover effects on action cards with color transitions

**Issues & Recommendations:**

1. **"Store" naming inconsistency:** The route is `/store`, the heading says
   "Store", but the bottom nav says "Explore", and the menu says "Explore
   Courses". Standardize to "Explore" throughout

2. **Desktop sidebar height:** Uses `h-[calc(100vh-64px)]` which assumes a 64px
   header. If header height changes, this breaks. Use `flex-1` with `min-h-0` in
   a flex container instead

3. **Price badge showing "Owned" vs price:** The green "Owned" badge is good.
   But the blue price badge `formatINR(course.priceCents ?? 10000)` defaults to
   ₹100 if no price is set — this could mislead users. Show "Free" for zero-cost
   courses

4. **No course detail preview:** Clicking a course navigates immediately. Add a
   quick-preview modal or expandable card showing description, story point
   count, and price before navigating

5. **Missing sorting options:** No way to sort by price, popularity, or recency.
   Add a sort dropdown

6. **Mobile back navigation:** The `ArrowLeft` back button works but there's no
   visual breadcrumb trail showing the user's navigation path

### 4.4 Course Page (`src/pages/Course.tsx`)

**Current State:** The most complex page — 797 lines handling course detail,
story point listing, tabs (story points/agents/leaderboard), access control,
code redemption, and floating resume button.

**Strengths:**

- `CourseHeader` component with skeleton loading state
- Story point cards with progress bars
- Floating "Resume Course" FAB is a great UX pattern
- Timed test story points visually differentiated with blue borders and badges

**Issues & Recommendations:**

1. **CRITICAL: Missing TabsList** — The `<Tabs>` component at line 461 renders
   `<TabsContent>` blocks but no `<TabsList>` or `<TabsTrigger>` on desktop.
   Only the mobile `CourseBottomNav` provides tab switching. Desktop users
   cannot switch between Story Points / Agents / Leaderboard tabs. **This is
   likely a regression.**

2. **Page length (797 lines):** This page has too many responsibilities.
   Decompose into:
   - `CourseOverview` — header, access control
   - `StoryPointGrid` — story point cards
   - `CourseRedeemDialog` — redemption flow
   - Custom hooks for data loading

3. **Skeleton count calculation** (lines 92-108): Uses window dimensions to
   calculate skeletons, but this runs on every resize. Debounce the resize
   handler or use a simpler approach (e.g., always show 6 skeletons)

4. **Lock icon UX:** The "Course locked" banner is informative but doesn't
   clearly show what the user gets upon unlocking. Add a preview of story points
   (titles/count) even for locked courses

5. **Floating Resume Button** (lines 773-791): Good UX but `fixed bottom-20` on
   mobile assumes bottom nav height. Also, the button is always centered on
   mobile but right-aligned on desktop — consider consistent placement

6. **Code redemption flow** (lines 671-770): The OTP input for 6-character codes
   works well. But after success, clicking "Unlock course" does
   `window.location.href = ...` which is a full page reload. Use `navigate()`
   and refetch data instead

### 4.5 StoryPoint Page (`src/pages/StoryPoint.tsx`)

**Current State:** A master-detail layout with a left sidebar listing all story
points and a right panel showing the selected story point's detail. Features
desktop sidebar toggle, mobile drawer, and AI chat panel.

**Strengths:**

- Desktop master-detail layout is appropriate for content browsing
- Sidebar toggle with collapse/expand
- Skeleton loading states for list items

**Issues & Recommendations:**

1. **Security: `dangerouslySetInnerHTML` with inline script** (lines 505-512):

   ```tsx
   <script dangerouslySetInnerHTML={{ __html: `...` }} />
   ```

   This injects JavaScript to handle a custom event. Replace with React's
   `useEffect` and custom event handling

2. **`window.location.href` for navigation** (lines 380, 547-548): Uses full
   page navigation instead of `navigate()`. This is especially bad here because
   it destroys the sidebar state, chat state, and all loaded data

3. **Mobile experience:** On mobile, the sidebar is hidden and users see only
   the detail view. But there's no clear way to navigate between story points on
   mobile — the drawer needs to be more prominently accessible

4. **AI Chat Panel:** Currently only shows in a right panel on desktop. For
   mobile, consider a bottom sheet or floating chat button pattern

5. **No breadcrumb trail:** Deep navigation (Home > Course > Story Point >
   Question) has no breadcrumb. Add a compact breadcrumb bar below the app
   header

### 4.6 Settings Page (`src/pages/Settings.tsx`)

**Current State:** Minimal page wrapping `UserProfileForm` with a heading and
description.

**Issues & Recommendations:**

1. **Expand settings scope:** Currently only profile editing. Add:
   - Theme toggle (light/dark/system)
   - Notification preferences
   - Language/locale settings
   - Account management (delete account, change password)
   - Data export

2. **Form improvements** in `UserProfileForm.tsx`:
   - Replace "Avatar URL" text input with a file upload + image crop component
   - Add field-level validation with `react-hook-form` + Zod (both are
     installed)
   - Group fields into sections: "Personal Info", "Education", "Contact"
   - Add success feedback after saving (currently no visual confirmation beyond
     the button state)

3. **User ID display** (line 99-101): Showing raw Firebase UID is not useful for
   most users. Hide behind an expandable "Developer" section or remove entirely

### 4.7 NotFound Page (`src/pages/NotFound.tsx`)

**Current State:** Simple centered 404 message with hardcoded gray/blue colors.

**Issues & Recommendations:**

1. **Replace hardcoded colors:**

   ```tsx
   // Before
   className = "bg-gray-100"; // line 15
   className = "text-gray-600"; // line 18
   className = "text-blue-500 hover:text-blue-700"; // line 19

   // After
   className = "bg-muted";
   className = "text-muted-foreground";
   className = "text-primary hover:text-primary/80";
   ```

2. **Improve the 404 experience:** Add an illustration, a search bar, and common
   navigation links. Use the same empty state pattern as other pages

### 4.8 Timed Test Pages

**TimedTestStoryPointDetail.tsx** — Test landing page with overview,
instructions, and previous attempts.

**TimedTestQuestionPage.tsx** — Test-taking interface with timer, sidebar
navigation, and question display.

**TimedTestResults.tsx** — Comprehensive results with score breakdown,
analytics, and question review.

**Strengths:**

- Well-structured test flow with clear states (start → in-progress → results)
- Timer component with visual urgency indicators
- Question status legend dialog for mobile
- PDF export capability for results

**Issues & Recommendations:**

1. **Hardcoded colors** in TimedTestQuestionPage: `text-gray-600` (line 435),
   `bg-gray-50` (line 528), `bg-white` (line 543). Replace with design tokens

2. **Desktop sidebar** (line 528): `bg-gray-50` should be `bg-muted` for dark
   mode support

3. **SheetHeader** (line 543): `bg-white` should be `bg-background`

4. **Test anxiety UX:** The timer is always visible but there's no option to
   hide it for students who experience test anxiety. Consider a "focus mode"
   that hides the timer

5. **Submit confirmation dialog:** Good that it warns about unanswered
   questions. Also show questions marked for review count

6. **Results page improvement:** Add comparison with class average, percentile
   ranking, and improvement suggestions

### 4.9 Practice Range (`src/pages/PracticeRange.tsx`)

**Current State:** A LeetCode-style problem list with search, filters (tags,
difficulty, status), and progress tracking.

**Strengths:**

- Clean filter system with popovers
- Status icons (completed, incorrect, attempted, pending)
- Difficulty color coding
- Tag-based filtering

**Issues & Recommendations:**

1. **Difficulty colors use hardcoded values:** `getDifficultyColor()` (lines
   187-200) returns hardcoded colors like `bg-green-100 text-green-800`. Map
   these to design token variables instead

2. **No problem description preview:** Only titles shown in the list. Add a
   brief description or first line of the problem

3. **No sorting:** Can't sort by difficulty, status, or recency. Add a sort
   selector

4. **Table view option:** For desktop users with many problems, offer a dense
   table view alongside the card view

---

## 5. Component Library Improvements

### 5.1 Missing Shared Components

The following components are reimplemented on every page and should be extracted
to shared:

| Component          | Current Pattern                                                                                                                                             | Recommended                                                                                |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------ | ------------ |
| **PageContainer**  | Each page wraps in `<div className="min-h-[calc(100vh-64px)] bg-background"><div className="px-3 sm:px-6 py-4 sm:py-8"><div className="max-w-Xyl mx-auto">` | Create `<PageContainer maxWidth="7xl">`                                                    |
| **EmptyState**     | Reimplemented 6+ times with different icon/message patterns                                                                                                 | Create `<EmptyState icon={} title="" description="" action={}>`                            |
| **LoadingSpinner** | `<Loader2 className="h-5 w-5 animate-spin" />` copied everywhere                                                                                            | Already have `Loading.tsx` — promote and use consistently                                  |
| **ErrorBanner**    | Inline error divs with red text                                                                                                                             | Create `<ErrorBanner message="" onRetry={}>`                                               |
| **SkeletonCard**   | `renderSkeletonCard()` function in Course.tsx and StoryPoint.tsx                                                                                            | Create `<SkeletonCard variant="course"                                                     | "storyPoint" | "practice">` |
| **Breadcrumb**     | Not implemented                                                                                                                                             | Create `<Breadcrumb items={[{label, href}]}>` using existing `breadcrumb.tsx` UI component |
| **ConfirmDialog**  | Alert dialogs scattered across pages                                                                                                                        | Create `<ConfirmDialog title="" description="" onConfirm={} destructive={}>`               |

### 5.2 Button Component

**File: `src/components/ui/button.tsx`**

The button variants are standard shadcn/ui. Add:

- `loading` prop that shows spinner and disables
- `success` variant with green background
- `icon-label` variant that stacks icon on top of text for mobile

### 5.3 Card Component Variants

Course cards, story point cards, and practice items all use different card
patterns. Standardize into:

```tsx
// ContentCard — for course thumbnails
<ContentCard
  thumbnail={url}
  title="Course Title"
  badges={[{label: "Admin", color: "purple"}]}
  progress={75}
  onClick={handleClick}
/>

// ListCard — for story points, practice items
<ListCard
  title="Story Point"
  description="Learn about..."
  rightBadge={<Badge>beginner</Badge>}
  progress={50}
  statusIcon={<CheckCircle />}
/>
```

---

## 6. Design System Recommendations

### 6.1 Typography Scale

Define a formal type scale in `index.css` or Tailwind config:

```css
/* Proposed Typography Scale */
--text-display: clamp(2rem, 4vw, 3.5rem); /* Landing hero */
--text-h1: clamp(1.5rem, 3vw, 2.25rem); /* Page titles */
--text-h2: clamp(1.25rem, 2.5vw, 1.75rem); /* Section titles */
--text-h3: clamp(1rem, 2vw, 1.25rem); /* Card titles */
--text-body: 0.875rem; /* 14px — body text */
--text-sm: 0.8125rem; /* 13px — secondary text */
--text-xs: 0.75rem; /* 12px — captions */
--text-micro: 0.6875rem; /* 11px — badges, labels */
```

**Rule:** Never use `text-[10px]` or `text-[9px]`. Minimum readable size is 11px
(`text-micro`).

### 6.2 Spacing System

Standardize page padding and section spacing:

```css
--page-padding-x: clamp(0.75rem, 2vw, 1.5rem);
--page-padding-y: clamp(1rem, 2vw, 2rem);
--section-gap: clamp(1.5rem, 3vw, 3rem);
--card-padding: clamp(0.75rem, 2vw, 1.5rem);
```

### 6.3 Consistent Max-Widths

Standardize to three tier levels:

| Token               | Value            | Usage                                  |
| ------------------- | ---------------- | -------------------------------------- |
| `--content-narrow`  | `42rem` (672px)  | Settings, forms, single-column content |
| `--content-default` | `72rem` (1152px) | Course pages, store, story points      |
| `--content-wide`    | `80rem` (1280px) | Landing page, admin dashboards         |

### 6.4 Shadow System

Current shadows are mostly transparent (disabled). Enable a proper elevation
system:

```css
--shadow-xs: 0 1px 2px hsl(var(--foreground) / 0.04);
--shadow-sm:
  0 1px 3px hsl(var(--foreground) / 0.06),
  0 1px 2px hsl(var(--foreground) / 0.04);
--shadow-md:
  0 4px 6px hsl(var(--foreground) / 0.06),
  0 2px 4px hsl(var(--foreground) / 0.04);
--shadow-lg:
  0 10px 15px hsl(var(--foreground) / 0.08),
  0 4px 6px hsl(var(--foreground) / 0.04);
--shadow-xl:
  0 20px 25px hsl(var(--foreground) / 0.1),
  0 8px 10px hsl(var(--foreground) / 0.04);
```

### 6.5 Gamification System Activation

The tier colors (`silver`, `gold`, `platinum`, `diamond`) and learning states
(`locked`, `available`, `progress`, `completed`) are defined but dormant.
Activate them:

- Story point cards should have tier-colored left borders based on difficulty
- Completed story points should show `--state-completed` green accents
- Locked content should have `--state-locked` gray overlay
- User profiles should show tier badges based on points accumulated

### 6.6 Motion/Animation Guidelines

Standardize animation usage:

```
Micro-interactions: 150-200ms ease-out (hover, focus, active states)
Transitions: 200-300ms ease-out (page content reveals, card expansions)
Entrances: 300-500ms ease-out with stagger (list items appearing)
Never: >500ms for UI state changes
```

Use the installed Framer Motion for:

- Page transitions (`AnimatePresence`)
- List item stagger animations
- Progress bar fills
- Achievement unlocks

---

## 7. Navigation & Information Architecture

### 7.1 Current Navigation Structure

```
AppHeader (top bar)
├── Home button
├── Orgs button (authenticated)
├── Super Admin button (super admin only)
├── "LevelUp" brand text
└── UserMenu (avatar dropdown)

MainBottomNav (mobile, main layout)
├── My Spaces (Home)
├── Explore (Store)
└── Settings

CourseBottomNav (mobile, course layout)
├── Story Points
├── Agents
├── Leaderboard
└── Admin (if admin)
```

### 7.2 Issues

1. **Desktop has no sidebar or persistent navigation** — only the top bar with
   Home/Orgs buttons. Users must navigate entirely through the top bar and
   browser back button

2. **No search functionality** — no global search to find courses, story points,
   or questions

3. **Inconsistent back navigation:** Some pages use browser back, some have
   explicit back buttons, some use `window.location.href`

4. **Deep linking confusion:** The URL structure
   `/courses/:id/sp/:storyPointId/item/:itemId` is correct but there's no UI
   indicator of the full path

5. **No "recently visited" or "favorites"** for quick access to frequently used
   content

### 7.3 Recommended Navigation Redesign

**Desktop (md+):**

- Add a collapsible left sidebar with: My Spaces, Explore, Settings, Orgs
- When inside a course, sidebar transforms to show course story points
- Add breadcrumb bar below header:
  `Home > Course Name > Story Point > Question 5`
- Add global search in header (use `cmdk` which is already installed)

**Mobile:**

- Keep bottom nav pattern (it's correct for mobile)
- Add breadcrumb as a horizontal scroll bar below the header
- Add a floating action button for quick search

---

## 8. Accessibility Improvements

### 8.1 Critical A11y Issues

| #   | Issue                                                                      | WCAG  | Location                                   |
| --- | -------------------------------------------------------------------------- | ----- | ------------------------------------------ |
| A1  | **No skip-to-content link**                                                | 2.4.1 | All layouts                                |
| A2  | **Course cards use `<div>` with `onClick`** instead of `<button>` or `<a>` | 4.1.2 | `Home.tsx:429`, `Store.tsx:306`            |
| A3  | **No focus management** after route changes                                | 2.4.3 | App.tsx router                             |
| A4  | **Bottom nav buttons lack `aria-current`** for active state                | 4.1.2 | `MainBottomNav.tsx`, `CourseBottomNav.tsx` |
| A5  | **Color-only status indication** — difficulty badges rely on color alone   | 1.4.1 | `PracticeRange.tsx:187-200`                |
| A6  | **Missing alt text** — some images use empty/generic alt                   | 1.1.1 | CachedImage usages                         |
| A7  | **No `aria-live` regions** for dynamic content updates                     | 4.1.3 | Progress updates, toast notifications      |
| A8  | **Timer in timed tests** has no screen reader announcements                | 1.3.1 | TimedTestTimer component                   |

### 8.2 Recommended Fixes

1. **Add skip link** to layout components:

   ```tsx
   <a
     href="#main-content"
     className="focus:bg-background sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4"
   >
     Skip to main content
   </a>
   ```

2. **Use semantic elements** for interactive cards:

   ```tsx
   // Instead of <div onClick={...}>
   <Link to={`/courses/${course.id}`} className="block ...">
   ```

3. **Add focus management** with `useEffect` after navigation:

   ```tsx
   useEffect(() => {
     document.getElementById("main-content")?.focus();
   }, [location.pathname]);
   ```

4. **Add `aria-current="page"`** to active bottom nav items

5. **Add text labels** to difficulty badges (not just color):
   - Easy: green dot + "Easy" text
   - Medium: yellow dot + "Medium" text
   - Hard: red dot + "Hard" text

6. **Add `aria-live="polite"`** to:
   - Progress percentage updates
   - Leaderboard data changes
   - Toast notification container

---

## 9. Mobile & Responsive Strategy

### 9.1 Current State

The app uses a mobile-first approach with Tailwind responsive prefixes (`sm:`,
`md:`, `lg:`, `xl:`). Bottom navigation is mobile-only (`md:hidden`). Most pages
are functional on mobile but with some issues.

### 9.2 Breakpoint Analysis

| Breakpoint           | Current Behavior                        | Issues                                                                         |
| -------------------- | --------------------------------------- | ------------------------------------------------------------------------------ |
| **< 640px (mobile)** | Single column, bottom nav, compact text | Text too small (`text-[10px]`), cards cramped in 2-col grid                    |
| **640-768px (sm)**   | 2-3 col grids, slightly larger text     | Good transition                                                                |
| **768-1024px (md)**  | Bottom nav hidden, header only          | **Gap**: No replacement navigation for desktop. Users only have header buttons |
| **1024-1280px (lg)** | 3-4 col grids                           | Functional but underutilizes horizontal space                                  |
| **1280px+ (xl)**     | 5 col grid for courses                  | Good density                                                                   |

### 9.3 Key Mobile Issues

1. **Touch targets too small:** Badge buttons, dropdown triggers, and edit
   buttons are often `h-7 w-7` (28px). Minimum touch target should be 44x44px
   per WCAG

2. **Course card grid on mobile:** `grid-cols-2` with `aspect-ratio: 2.2/3.3`
   creates very tall, narrow cards. On a 375px screen, each card is ~170px wide
   — too cramped for text

3. **Story point sidebar on mobile:** Accessed only via a hamburger menu in
   `StoryPointAppBar`. The drawer is a fullscreen overlay — consider a bottom
   sheet instead for easier dismissal

4. **Timed test on mobile:** The question area takes full width but the sidebar
   requires opening a sheet. During a timed test, this friction of
   opening/closing the drawer to navigate questions is significant. Consider a
   fixed bottom bar showing question numbers

5. **Forms on mobile:** `UserProfileForm` has standard inputs that work, but no
   mobile-optimized date picker for age or phone input with country code

### 9.4 Recommendations

1. **Increase minimum touch target to 44px** for all interactive elements
2. **Use single column** for course cards on mobile
   (`grid-cols-1 sm:grid-cols-2`)
3. **Add a desktop sidebar** at `md` breakpoint to replace bottom nav
   functionality
4. **Implement pull-to-refresh** on course and story point lists (especially
   relevant for mobile)
5. **Add swipe gestures** for navigating between questions in story points
6. **Test on actual devices** — the `useIsMobile` hook checks for
   `max-width: 768px` which is correct but ensure iPad landscape works

---

## 10. Performance & Loading States

### 10.1 Current Loading Patterns

| Page                  | Loading State                      | Quality |
| --------------------- | ---------------------------------- | ------- |
| App (Suspense)        | `<Loading />` — centered spinner   | Minimal |
| Home                  | `<Loader2 />` centered spinner     | Basic   |
| Store                 | `<Loader2 />` centered spinner     | Basic   |
| Course (story points) | Skeleton cards with animated pulse | Good    |
| StoryPoint (sidebar)  | Skeleton list items                | Good    |
| PracticeRange         | Pulsing rectangle skeletons        | Basic   |
| Settings              | None (instant render)              | N/A     |
| TimedTestQuestion     | Text "Loading..."                  | Poor    |
| TimedTestResults      | Alert "Loading results..."         | Basic   |

### 10.2 Recommendations

1. **Standardize loading patterns:**
   - **Page-level:** Full-page skeleton matching the page layout
   - **Component-level:** Skeleton matching the component's final shape
   - **Action-level:** Button loading state (spinner + disabled)
   - **Never:** Text-only "Loading..." without visual indicator

2. **Implement `Suspense` boundaries** per-route instead of a single global
   fallback. Each route should have its own skeleton

3. **Add optimistic updates** for:
   - Course archive/unarchive (instant state change, background sync)
   - Question submission (show success immediately)
   - Profile updates (update UI before server confirms)

4. **Image loading:**
   - Use `loading="lazy"` on all `<img>` tags (CachedImage should support this)
   - Add blur placeholder while images load
   - Use responsive `srcset` for different screen sizes

5. **Bundle optimization:**
   - Remove unused `framer-motion` if not adding animations, OR use it
     throughout
   - Code-split heavy dependencies (CodeMirror, recharts, react-pdf) per route
   - Remove `@anthropic-ai/claude-code` and `@google/gemini-cli` from client
     bundle (these are likely server-side tools)

---

## 11. Implementation Priority Roadmap

### Phase 1: Critical Fixes (Week 1-2)

| Priority | Task                                                                         | Effort | Impact                                     |
| -------- | ---------------------------------------------------------------------------- | ------ | ------------------------------------------ |
| P0       | Delete `App.css` and its import — fixes global layout corruption             | 5 min  | Critical                                   |
| P0       | Add `<TabsList>` with triggers to Course.tsx desktop view                    | 30 min | Critical — desktop users can't switch tabs |
| P0       | Replace all hardcoded colors (`bg-gray-*`, `text-blue-*`) with design tokens | 2 hr   | Dark mode compatibility                    |
| P0       | Remove all `console.log` statements from production code                     | 1 hr   | Performance + professionalism              |
| P1       | Replace `window.location.reload()` with proper state management              | 3 hr   | UX — eliminates page flashes               |
| P1       | Replace `window.location.href` with `navigate()`                             | 2 hr   | UX — preserves React state                 |
| P1       | Remove `dangerouslySetInnerHTML` script injection in StoryPoint.tsx          | 1 hr   | Security                                   |
| P1       | Choose one toast system (recommend Sonner) and remove the other              | 1 hr   | Bundle size + consistency                  |

### Phase 2: Shared Components & Design System (Week 3-4)

| Priority | Task                                                                   | Effort | Impact                    |
| -------- | ---------------------------------------------------------------------- | ------ | ------------------------- |
| P1       | Create `<PageContainer>` component with standardized max-width/padding | 2 hr   | Layout consistency        |
| P1       | Create shared `<EmptyState>` component                                 | 2 hr   | Consistent empty states   |
| P1       | Create shared `<SkeletonCard>` variants                                | 3 hr   | Consistent loading states |
| P1       | Define typography scale in CSS variables                               | 2 hr   | Typography consistency    |
| P2       | Standardize max-width to 3 tiers across all pages                      | 3 hr   | Visual consistency        |
| P2       | Add error boundaries for each route                                    | 3 hr   | Error resilience          |
| P2       | Implement breadcrumb navigation                                        | 4 hr   | Navigation clarity        |

### Phase 3: Accessibility & Navigation (Week 5-6)

| Priority | Task                                                                 | Effort | Impact                 |
| -------- | -------------------------------------------------------------------- | ------ | ---------------------- |
| P1       | Add skip-to-content links                                            | 30 min | A11y compliance        |
| P1       | Replace `<div onClick>` with `<Link>` or `<button>` for course cards | 3 hr   | Keyboard accessibility |
| P1       | Add `aria-current` to navigation items                               | 1 hr   | Screen reader support  |
| P2       | Add focus management after route changes                             | 2 hr   | A11y compliance        |
| P2       | Add `aria-live` regions for dynamic content                          | 3 hr   | Screen reader support  |
| P2       | Increase touch targets to 44px minimum                               | 4 hr   | Mobile usability       |
| P2       | Add dark mode toggle to Settings page                                | 3 hr   | User preference        |

### Phase 4: UX Polish (Week 7-8)

| Priority | Task                                                                | Effort | Impact                      |
| -------- | ------------------------------------------------------------------- | ------ | --------------------------- |
| P2       | Add global search using `cmdk`                                      | 8 hr   | Discovery                   |
| P2       | Add scroll-triggered animations to landing page using Framer Motion | 4 hr   | Polish                      |
| P2       | Improve course card grid for mobile (single column)                 | 2 hr   | Mobile readability          |
| P2       | Migrate data fetching to TanStack React Query                       | 16 hr  | Performance, caching, dedup |
| P3       | Add desktop sidebar navigation                                      | 12 hr  | Desktop UX                  |
| P3       | Add form validation with react-hook-form + Zod                      | 6 hr   | Form UX                     |
| P3       | Activate gamification tier system (badges, borders, shadows)        | 8 hr   | Engagement                  |
| P3       | Fix QR code placeholder in landing page                             | 30 min | Professionalism             |

### Phase 5: Advanced Features (Week 9+)

| Priority | Task                                                                 | Effort | Impact      |
| -------- | -------------------------------------------------------------------- | ------ | ----------- |
| P3       | Add question swipe navigation on mobile                              | 8 hr   | Mobile UX   |
| P3       | Add pull-to-refresh on lists                                         | 4 hr   | Mobile UX   |
| P3       | Implement file upload for avatar in profile                          | 6 hr   | Profile UX  |
| P3       | Add streak visualization and last-accessed indicators                | 8 hr   | Engagement  |
| P3       | Performance audit — remove unused deps, code split, lazy load images | 8 hr   | Performance |

---

## Appendix: Files Audited

| File                                             | Lines | Role                                 |
| ------------------------------------------------ | ----- | ------------------------------------ |
| `src/App.tsx`                                    | 107   | Root component, router configuration |
| `src/App.css`                                    | 43    | **Leftover boilerplate — DELETE**    |
| `src/main.tsx`                                   | 5     | Entry point                          |
| `src/index.css`                                  | 168   | Design tokens, CSS variables         |
| `tailwind.config.ts`                             | 174   | Tailwind theme extension             |
| `src/layouts/MainLayout.tsx`                     | 21    | Main app layout                      |
| `src/layouts/CourseLayout.tsx`                   | 21    | Course pages layout                  |
| `src/pages/Home.tsx`                             | 529   | Home / My Courses page               |
| `src/pages/Store.tsx`                            | 391   | Explore / Store page                 |
| `src/pages/Course.tsx`                           | 797   | Course detail page                   |
| `src/pages/Settings.tsx`                         | 37    | Settings page                        |
| `src/pages/NotFound.tsx`                         | 27    | 404 page                             |
| `src/pages/StoryPoint.tsx`                       | 519   | Story point detail page              |
| `src/pages/Scan.tsx`                             | 65    | QR/link scan redirect page           |
| `src/pages/PracticeRange.tsx`                    | 438   | Practice range listing               |
| `src/pages/TimedTestStoryPointDetail.tsx`        | ~800  | Timed test landing                   |
| `src/pages/TimedTestQuestionPage.tsx`            | 641   | Timed test question                  |
| `src/pages/TimedTestResults.tsx`                 | ~900  | Timed test results                   |
| `src/pages/story-point/StoryPointDetailPage.tsx` | 585   | Story point detail                   |
| `src/components/core/AppHeader.tsx`              | 50    | Top header bar                       |
| `src/components/core/UserMenu.tsx`               | 58    | User avatar dropdown                 |
| `src/components/navigation/MainBottomNav.tsx`    | 41    | Mobile bottom nav                    |
| `src/components/navigation/CourseBottomNav.tsx`  | 86    | Course mobile bottom nav             |
| `src/components/auth/RequireAuth.tsx`            | 21    | Auth guard                           |
| `src/components/auth/LoginDialog.tsx`            | 238   | Login/register dialog                |
| `src/components/courses/CourseHeader.tsx`        | 95    | Course header with skeleton          |
| `src/components/space/UserProfileForm.tsx`       | 167   | Profile edit form                    |
| `src/components/leaderboard/Leaderboard.tsx`     | 162   | Leaderboard component                |
| `src/components/ui/Loading.tsx`                  | 11    | Loading spinner                      |
| `src/contexts/AuthContext.tsx`                   | 328   | Auth context provider                |
| `src/contexts/LoginDialogContext.tsx`            | 36    | Login dialog state                   |
| `src/landing-page/v2/LandingPage.tsx`            | 492   | Landing page                         |

---

_This audit was conducted by analyzing all source files referenced above.
Recommendations are prioritized by impact and effort, focusing on issues that
affect the largest number of users or represent the most significant design
system violations._
