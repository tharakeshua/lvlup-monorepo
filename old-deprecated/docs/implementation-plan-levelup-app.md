# Implementation Plan: LevelUp-App UI/UX Fixes

**Based on:** UI/UX Audit (March 2026) **Target App:** `/LevelUp-App/` **Total
Issues:** 5 Critical, 9 Major, 10 Minor

---

## Phase 1: Critical Fixes (Immediate)

### 1.1 [C1] Delete `App.css` Boilerplate

**Severity:** Critical | **Complexity:** S | **Estimated Effort:** 5 min

**Problem:** `src/App.css` contains leftover Vite boilerplate with
`#root { max-width: 1280px; margin: 0 auto; padding: 2rem; text-align: center; }`
which corrupts the entire app layout.

**Current state:** File exists at `src/App.css` but is NOT imported anywhere
(confirmed via grep). The file is dead code but a latent risk if anyone
re-imports it.

**Changes:** | Action | File | |--------|------| | DELETE | `src/App.css` |

**Steps:**

1. Delete `src/App.css` entirely
2. Verify no imports reference it (already confirmed: `grep "App\.css"` returns
   0 results)
3. Run `npm run build` to confirm no breakage

---

### 1.2 [C2] Replace `window.location.reload()` with React State Updates

**Severity:** Critical | **Complexity:** M | **Estimated Effort:** 3 hr

**Problem:** `window.location.reload()` destroys React state, causes full-page
flash, kills in-memory caches, and is terrible UX.

**Affected files and exact locations:**

#### `src/pages/Home.tsx`

**Location 1: Line 166** — `handleArchive` fallback reload

```tsx
// BEFORE (line 158-166):
} else {
  console.log('[HANDLE_ARCHIVE] ⚠️ Course not found in state, reloading page');
  toast({ title: "Course archived", description: "Course moved to archived section. Refresh to see changes." });
  window.location.reload();
}

// AFTER — Refetch courses instead of reloading:
} else {
  toast({ title: "Course archived", description: "Course moved to archived section." });
  // Trigger re-fetch by toggling a refresh key state
  setRefreshKey(prev => prev + 1);
}
```

**Location 2: Line 205** — `handleUnarchive` fallback reload

```tsx
// Same pattern as above: replace window.location.reload() with setRefreshKey(prev => prev + 1)
```

**Location 3: Line 520** — `EditCourseDialog onUpdated` callback

```tsx
// BEFORE:
onUpdated={() => {
  setEditingCourse(null);
  window.location.reload();
}}

// AFTER:
onUpdated={() => {
  setEditingCourse(null);
  setRefreshKey(prev => prev + 1);
}}
```

**Implementation:** Add a `refreshKey` state variable to `Home.tsx`:

```tsx
const [refreshKey, setRefreshKey] = useState(0);
```

Add `refreshKey` to the `useEffect` dependency array for course loading (line
29):

```tsx
useEffect(() => { ... }, [user?.uid, isAdmin, refreshKey]);
```

#### `src/pages/Store.tsx`

**Location: Line 302** — `EditCourseDialog onUpdated`

```tsx
// BEFORE:
onUpdated={() => window.location.reload()}

// AFTER — Add refreshKey pattern same as Home.tsx:
const [refreshKey, setRefreshKey] = useState(0);
// Add refreshKey to useEffect deps (line 27)
// Then:
onUpdated={() => setRefreshKey(prev => prev + 1)}
```

#### `src/pages/Course.tsx`

**Location: Line 537** — `EditStoryPointDialog onUpdated`

```tsx
// BEFORE:
onUpdated={() => window.location.reload()}

// AFTER — Story points are already subscribed via real-time listener,
// so the update should auto-propagate. Simply remove the reload:
onUpdated={() => {}}
// Or if real-time isn't working, use a refreshKey similar to Home.tsx
```

---

### 1.3 [C2/M7] Replace `window.location.href` with `navigate()`

**Severity:** Critical | **Complexity:** M | **Estimated Effort:** 2 hr

**Problem:** `window.location.href` causes full page reload, destroying all
React state, sidebar state, chat state, and loaded data.

**Affected files and exact changes:**

#### `src/pages/Course.tsx`

**Line 380** — Story point list item navigation:

```tsx
// BEFORE:
onClick={() => { window.location.href = `/courses/${encodeURIComponent(String(id || ''))}/sp/${encodeURIComponent(sp.id)}`; }}

// AFTER:
onClick={() => navigate(`/courses/${encodeURIComponent(String(id || ''))}/sp/${encodeURIComponent(sp.id)}`)}
```

**Lines 547-549** — Story point card navigation:

```tsx
// BEFORE:
if (isTimedTest) {
  window.location.href = `/courses/${encodeURIComponent(String(id || ""))}/sp/${encodeURIComponent(sp.id)}/timed-test`;
} else {
  window.location.href = `/courses/${encodeURIComponent(String(id || ""))}/sp/${encodeURIComponent(sp.id)}`;
}

// AFTER:
if (isTimedTest) {
  navigate(
    `/courses/${encodeURIComponent(String(id || ""))}/sp/${encodeURIComponent(sp.id)}/timed-test`
  );
} else {
  navigate(
    `/courses/${encodeURIComponent(String(id || ""))}/sp/${encodeURIComponent(sp.id)}`
  );
}
```

**Line 765** — After course redemption success:

```tsx
// BEFORE:
<Button onClick={() => { const cid = redeemedCourseId || String(id || ''); window.location.href = `/courses/${encodeURIComponent(cid)}`; }}>Unlock course</Button>

// AFTER — Close the dialog and refetch access state:
<Button onClick={() => {
  setRedeemOpen(false);
  // The access subscription (line 278-290) will automatically update hasAccess
  // since the UserCourseInventoryService record was just created by redemption
}}>Unlock course</Button>
```

**Line 780** — Resume course button:

```tsx
// BEFORE:
window.location.href = resumeUrl;

// AFTER:
navigate(resumeUrl);
```

#### `src/pages/story-point/StoryPointDetailPage.tsx`

**Lines 298, 312** — Resume navigation:

```tsx
// BEFORE:
window.location.href = resumeUrl;

// AFTER:
navigate(resumeUrl);
```

Note: `StoryPointDetailPage` receives `courseId` as prop, so ensure
`useNavigate()` is imported and available.

---

### 1.4 [C3] Replace Hardcoded Colors with Design Tokens

**Severity:** Critical | **Complexity:** S | **Estimated Effort:** 1 hr

**Problem:** Hardcoded Tailwind colors (`bg-gray-100`, `text-blue-500`, etc.)
bypass the design system and break dark mode.

**Affected files and exact changes:**

#### `src/pages/NotFound.tsx`

```tsx
// BEFORE (line 15):
<div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-gray-100">

// AFTER:
<div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-muted">

// BEFORE (line 18):
<p className="text-xl text-gray-600 mb-4">Oops! Page not found</p>

// AFTER:
<p className="text-xl text-muted-foreground mb-4">Oops! Page not found</p>

// BEFORE (line 19):
<a href="/home" className="text-blue-500 hover:text-blue-700 underline">

// AFTER (also replace <a> with <Link> for SPA navigation):
import { Link } from 'react-router-dom';
<Link to="/home" className="text-primary hover:text-primary/80 underline">
```

#### `src/pages/TimedTestQuestionPage.tsx`

**Line 435:**

```tsx
// BEFORE:
<p className="text-xs sm:text-sm text-gray-600">

// AFTER:
<p className="text-xs sm:text-sm text-muted-foreground">
```

**Line ~528 (desktop sidebar background):**

```tsx
// BEFORE:
bg - gray - 50;

// AFTER:
bg - muted;
```

**Line ~543 (SheetHeader background):**

```tsx
// BEFORE:
bg - white;

// AFTER:
bg - background;
```

#### `src/pages/PracticeRange.tsx` — `getDifficultyColor()` function (lines 187-200)

```tsx
// BEFORE:
const getDifficultyColor = (difficulty: string) => {
  switch (difficulty) {
    case "easy":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    case "medium":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
    case "hard":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
    case "expert":
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
  }
};

// AFTER — Already includes dark mode variants, so these are acceptable.
// However, for full design-token compliance, consider adding CSS variables:
// For now, this is a LOW priority since it already handles dark mode.
// Leave as-is unless migrating to full design token system.
```

---

### 1.5 [C4] Remove Duplicate Toast System

**Severity:** Critical | **Complexity:** S | **Estimated Effort:** 1 hr

**Problem:** Both `Toaster` (Radix toast) and `Sonner` are mounted
simultaneously in `App.tsx`. This doubles the bundle size for toasts and creates
confusion about which system fires.

**Decision:** Keep **Sonner** (more modern, better DX, auto-dismiss). Remove
**Radix Toaster**.

**Changes:**

#### `src/App.tsx`

```tsx
// BEFORE (lines 1-2):
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";

// AFTER:
import { Toaster as Sonner } from "@/components/ui/sonner";

// BEFORE (lines 47-48 inside the JSX):
<Toaster />
<Sonner />

// AFTER:
<Sonner />
```

#### Audit all toast usages:

Search for which toast API is used across the app:

- `import { useToast } from '@/hooks/use-toast'` → This uses the **Radix** toast
  system
- `import { toast } from 'sonner'` → This uses **Sonner**

**If the app uses `useToast` (Radix) in most places (which it does — confirmed
in `Home.tsx:8`):**

**Option A (Recommended — less disruptive):** Keep Radix `Toaster`, remove
Sonner.

```tsx
// App.tsx — keep Toaster, remove Sonner
import { Toaster } from "@/components/ui/toaster";
// Remove: import { Toaster as Sonner } from "@/components/ui/sonner";
// Remove <Sonner /> from JSX
```

**Option B (Better long-term):** Migrate all `useToast` calls to Sonner, then
remove Radix.

- Search all files for `useToast` and replace with `toast()` from Sonner
- This requires updating every toast call site (~10-15 locations)

**Recommendation:** Go with **Option A** first (quick fix), then migrate to
Sonner in Phase 4.

---

### 1.6 [C5] Add Error Boundaries

**Severity:** Critical | **Complexity:** M | **Estimated Effort:** 3 hr

**Problem:** No error boundaries exist. Unhandled errors in data fetching crash
the entire app with a white screen.

**Changes:**

#### Create `src/components/core/ErrorBoundary.tsx` (NEW FILE)

```tsx
import React from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="flex min-h-[50vh] items-center justify-center p-6">
            <div className="max-w-md text-center">
              <AlertTriangle className="text-destructive mx-auto mb-4 h-12 w-12" />
              <h2 className="mb-2 text-lg font-semibold">
                Something went wrong
              </h2>
              <p className="text-muted-foreground mb-4 text-sm">
                {this.state.error?.message || "An unexpected error occurred."}
              </p>
              <Button onClick={() => this.setState({ hasError: false })}>
                Try again
              </Button>
            </div>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
```

#### Wrap routes in `src/App.tsx`

```tsx
import { ErrorBoundary } from "@/components/core/ErrorBoundary";

// Wrap the Suspense fallback:
<ErrorBoundary>
  <Suspense fallback={<Loading />}>
    <Routes>{/* ... all routes */}</Routes>
  </Suspense>
</ErrorBoundary>;
```

#### Add per-page boundaries for data-heavy pages

Wrap the following pages in additional `<ErrorBoundary>` at the route level:

- `<Course />` (complex data loading, 10+ useEffects)
- `<StoryPoint />` (multiple async loads)
- `<TimedTestQuestionPage />` (critical test-taking flow)

---

### 1.7 [M8] Remove `dangerouslySetInnerHTML` Script Injection

**Severity:** Critical (Security) | **Complexity:** S | **Estimated Effort:** 30
min

**Problem:** `StoryPoint.tsx` lines 505-512 inject raw JavaScript into the DOM
via `dangerouslySetInnerHTML`, which is an XSS vector.

**File:** `src/pages/StoryPoint.tsx`

```tsx
// BEFORE (lines 504-512):
<button type="button" data-open-sp-drawer onClick={() => setMobileOpen(true)} style={{ display: 'none' }} />
<script dangerouslySetInnerHTML={{__html: `
  (function(){
    window.addEventListener('openStoryPointsDrawer', function(){
      const el = document.querySelector('[data-open-sp-drawer]');
      if (el) el.click();
    });
  })();
`}} />

// AFTER — Replace with a React useEffect:
```

**Add this useEffect to the `StoryPointPage` component (near top, after existing
state declarations):**

```tsx
// Listen for custom event to open story points drawer
React.useEffect(() => {
  const handler = () => setMobileOpen(true);
  window.addEventListener("openStoryPointsDrawer", handler);
  return () => window.removeEventListener("openStoryPointsDrawer", handler);
}, []);
```

**Remove the hidden button and script entirely** (lines 504-512):

```tsx
// DELETE these lines:
<button type="button" data-open-sp-drawer onClick={() => setMobileOpen(true)} style={{ display: 'none' }} />
<script dangerouslySetInnerHTML={{__html: `...`}} />
```

---

### 1.8 [M2] Remove Production `console.log` Statements

**Severity:** Major | **Complexity:** S | **Estimated Effort:** 1 hr

**Problem:** 12+ debug `console.log` statements in `Home.tsx`, plus scattered
`console.error` calls used for debugging (not actual error handling).

**File:** `src/pages/Home.tsx`

**Remove ALL of these lines:**

- Line 63: `console.log('[LOAD_COURSES] 📚 All course IDs:', allCourseIds);`
- Lines 106-111: `console.log('[LOAD_COURSES] 📝 Mapped course...', {...})`
- Line 118: `console.log('[LOAD_COURSES] ✅ Active courses:', ...)`
- Line 119: `console.log('[LOAD_COURSES] 📦 Archived courses:', ...)`
- Line 129: `console.log('[HANDLE_ARCHIVE] ❌ No user ID, aborting');`
- Line 133: `console.log('[HANDLE_ARCHIVE] Starting archive for:', ...)`
- Line 134: `console.log('[HANDLE_ARCHIVE] Current myCourses:', ...)`
- Line 135: `console.log('[HANDLE_ARCHIVE] Current archivedCourses:', ...)`
- Line 139: `console.log('[HANDLE_ARCHIVE] ✅ Service call completed');`
- Line 143: `console.log('[HANDLE_ARCHIVE] Found course in state:', course);`
- Line 153: `console.log('[HANDLE_ARCHIVE] ✅ State updated successfully');`
- Line 160:
  `console.log('[HANDLE_ARCHIVE] ⚠️ Course not found in state, reloading page');`

**Also check and remove from:**

- `src/pages/StoryPoint.tsx` line 72:
  `console.error('Failed to load story point page', e);` — Replace with a
  user-facing error state
- `src/pages/NotFound.tsx` lines 7-12: `console.error("404 Error: ...")` — Can
  be removed; 404s are normal browser events

**For future prevention:** Consider adding an ESLint rule:

```json
// .eslintrc
{ "rules": { "no-console": ["warn", { "allow": ["warn", "error"] }] } }
```

---

## Phase 2: Shared Components & Design System (Week 2-3)

### 2.1 [M6] Add TabsList to Course.tsx Desktop View

**Severity:** Major (Regression) | **Complexity:** S | **Estimated Effort:** 30
min

**Problem:** The `<Tabs>` component at line 461 has `<TabsContent>` blocks but
no `<TabsList>` or `<TabsTrigger>` for desktop users. Only the mobile
`CourseBottomNav` provides tab switching. Desktop users cannot switch between
Story Points / Agents / Leaderboard tabs.

**File:** `src/pages/Course.tsx`

**Add TabsList after the Tabs opening tag (line 468):**

```tsx
<Tabs value={activeTab} onValueChange={(val) => setSearchParams(prev => {
  const next = new URLSearchParams(prev);
  next.set('tab', val);
  return next;
})} className="w-full">
  {/* ADD THIS BLOCK — Desktop tab triggers */}
  <TabsList className="hidden md:flex w-full mb-4">
    <TabsTrigger value="story-points" className="flex-1 gap-2">
      <BookOpen className="h-4 w-4" />
      Story Points
    </TabsTrigger>
    <TabsTrigger value="agents" className="flex-1 gap-2">
      <MessageSquare className="h-4 w-4" />
      Agents
    </TabsTrigger>
    <TabsTrigger value="leaderboard" className="flex-1 gap-2">
      <Trophy className="h-4 w-4" />
      Leaderboard
    </TabsTrigger>
  </TabsList>

  <TabsContent value="story-points" ...>
```

**Required imports (already imported on line 10):** `TabsList`, `TabsTrigger`
are already imported.

**Additional imports needed for icons:**

```tsx
// Add to existing import on line 10:
import { BookOpen, Trophy } from "lucide-react";
```

Note: `BookOpen` may not be imported yet in Course.tsx. Check and add if needed.
`MessageSquare` is also needed — check imports.

---

### 2.2 [M5] Create `<PageContainer>` Component

**Severity:** Major | **Complexity:** S | **Estimated Effort:** 2 hr

**Problem:** Each page wraps content differently: `max-w-7xl` (Home),
`max-w-6xl` (Course), `max-w-4xl` (StoryPoint), `max-w-2xl` (Settings). No
consistency.

#### Create `src/components/core/PageContainer.tsx` (NEW FILE)

```tsx
import React from "react";
import { cn } from "@/lib/utils";

const widthMap = {
  narrow: "max-w-2xl", // Settings, forms, single-column
  default: "max-w-5xl", // Course pages, store, story points
  wide: "max-w-7xl", // Home, landing page, admin dashboards
} as const;

type PageContainerProps = {
  children: React.ReactNode;
  maxWidth?: keyof typeof widthMap;
  className?: string;
  noPadding?: boolean;
};

export const PageContainer: React.FC<PageContainerProps> = ({
  children,
  maxWidth = "default",
  className,
  noPadding = false,
}) => (
  <div className={cn("bg-background min-h-[calc(100vh-64px)]", className)}>
    <div
      className={cn(
        widthMap[maxWidth],
        "mx-auto",
        !noPadding && "px-3 py-4 sm:px-6 sm:py-8"
      )}
    >
      {children}
    </div>
  </div>
);
```

#### Apply to pages:

| Page           | Current                            | New                                  |
| -------------- | ---------------------------------- | ------------------------------------ |
| `Home.tsx`     | `max-w-7xl mx-auto`                | `<PageContainer maxWidth="wide">`    |
| `Course.tsx`   | `max-w-6xl mx-auto`                | `<PageContainer maxWidth="default">` |
| `Store.tsx`    | `max-w-7xl mx-auto` (courses view) | `<PageContainer maxWidth="wide">`    |
| `Settings.tsx` | `max-w-2xl mx-auto`                | `<PageContainer maxWidth="narrow">`  |
| `NotFound.tsx` | No container                       | `<PageContainer maxWidth="narrow">`  |

---

### 2.3 [M1] Create Shared `<EmptyState>` Component

**Severity:** Major | **Complexity:** S | **Estimated Effort:** 2 hr

**Problem:** Empty states are reimplemented 6+ times with different patterns.

#### Create `src/components/core/EmptyState.tsx` (NEW FILE)

```tsx
import React from "react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  action,
  className,
}) => (
  <div
    className={cn(
      "flex flex-col items-center justify-center px-4 py-12 sm:py-20",
      className
    )}
  >
    <div className="relative mb-6 sm:mb-8">
      <div className="bg-primary/20 absolute inset-0 rounded-full blur-3xl" />
      <div className="from-primary/10 to-primary/5 border-primary/20 relative rounded-full border bg-gradient-to-br p-6 sm:p-8">
        <Icon className="text-primary h-16 w-16 sm:h-20 sm:w-20" />
      </div>
    </div>
    <h3 className="mb-2 text-xl font-bold sm:mb-3 sm:text-2xl">{title}</h3>
    <p className="text-muted-foreground mb-6 max-w-md text-center text-sm sm:mb-8 sm:text-base">
      {description}
    </p>
    {action}
  </div>
);
```

#### Replace usage in:

- `Home.tsx` (empty courses state, ~lines 370-401) →
  `<EmptyState icon={ShoppingBag} title="No courses yet!" description="..." action={<FeatureCards />} />`
- `Home.tsx` (archived empty state, ~lines 277-289) →
  `<EmptyState icon={Archive} title="No archived courses" description="..." />`
- `Store.tsx` (no courses found, ~lines 283-293) →
  `<EmptyState icon={ShoppingBag} title="No courses found" description="..." />`
- `Course.tsx` (no story points, ~lines 601-619) →
  `<EmptyState icon={BookOpen} title="No story points yet" description="..." />`

---

### 2.4 [M1] Create Shared `<SkeletonCard>` Component

**Severity:** Major | **Complexity:** S | **Estimated Effort:** 1 hr

**Problem:** `renderSkeletonCard()` is duplicated in `Course.tsx` and
`StoryPoint.tsx`.

#### Create `src/components/core/SkeletonCard.tsx` (NEW FILE)

```tsx
import React from "react";

export const SkeletonStoryPointCard: React.FC = () => (
  <div className="bg-card group rounded-lg border p-4 transition">
    <div className="flex items-start justify-between gap-3">
      <div className="flex-1">
        <div className="bg-muted mb-2 h-5 w-3/4 animate-pulse rounded" />
        <div className="bg-muted mb-1 h-4 w-full animate-pulse rounded" />
        <div className="bg-muted h-4 w-2/3 animate-pulse rounded" />
      </div>
      <div className="bg-muted h-5 w-16 animate-pulse rounded" />
    </div>
    <div className="mt-3 space-y-1">
      <div className="bg-muted h-2 w-full animate-pulse rounded" />
      <div className="bg-muted h-3 w-1/2 animate-pulse rounded" />
    </div>
  </div>
);

export const SkeletonListItem: React.FC = () => (
  <div className="bg-card border-border/60 mb-2 w-full rounded-lg border px-3 py-2 transition-colors">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <div className="bg-muted mb-2 h-4 w-3/4 animate-pulse rounded" />
        <div className="bg-muted mb-1 h-3 w-full animate-pulse rounded" />
        <div className="bg-muted h-3 w-2/3 animate-pulse rounded" />
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <div className="bg-muted h-5 w-12 animate-pulse rounded" />
        <div className="bg-muted h-5 w-8 animate-pulse rounded" />
      </div>
    </div>
    <div className="mt-2 space-y-1">
      <div className="bg-muted h-2 w-full animate-pulse rounded" />
      <div className="bg-muted h-3 w-1/2 animate-pulse rounded" />
    </div>
  </div>
);
```

#### Replace in:

- `Course.tsx` lines 406-421 (`renderSkeletonCard`) → Use
  `<SkeletonStoryPointCard />`
- `StoryPoint.tsx` lines 246-264 (`renderSkeletonListItem`) → Use
  `<SkeletonListItem />`

---

### 2.5 Define Typography Scale

**Severity:** Major | **Complexity:** S | **Estimated Effort:** 1 hr

**Problem:** No formal typography scale. Font sizes applied ad-hoc. Several
instances of `text-[10px]`, `text-[9px]` which are hard to read on mobile.

**File:** `src/index.css` — Add to the `:root` block

```css
:root {
  /* ... existing vars ... */

  /* Typography Scale */
  --text-micro: 0.6875rem; /* 11px — badges, labels (MINIMUM readable) */
  --text-xs: 0.75rem; /* 12px — captions */
  --text-sm: 0.8125rem; /* 13px — secondary text */
  --text-body: 0.875rem; /* 14px — body text */
}
```

**File:** `tailwind.config.ts` — Add custom utilities (if using tailwind-config
package)

```ts
theme: {
  extend: {
    fontSize: {
      'micro': ['0.6875rem', { lineHeight: '1rem' }],
    }
  }
}
```

**Then replace across files:** | Current | Replace With | Files |
|---------|-------------|-------| | `text-[10px]` | `text-[11px]` (minimum) |
`MainBottomNav.tsx:20,28,36`, `CourseBottomNav.tsx:55,63,71,81`,
`Store.tsx:226,367` | | `text-[9px]` | `text-[11px]` | `StoryPoint.tsx:204`,
`Store.tsx:367` |

---

### 2.6 [M4] Add Dark Mode Toggle

**Severity:** Major | **Complexity:** M | **Estimated Effort:** 3 hr

**Problem:** Full dark mode CSS variables exist in `index.css` but no toggle is
exposed to users. The `.dark` class is never applied.

**Implementation approach:** Use `next-themes` (already in the monorepo's
`packages/shared-ui`) or a simple context.

#### Create `src/contexts/ThemeContext.tsx` (NEW FILE)

```tsx
import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (theme: Theme) => void;
}>({ theme: "system", setTheme: () => {} });

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem("theme") as Theme) || "system";
  });

  useEffect(() => {
    const root = document.documentElement;
    const systemDark = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;
    const isDark = theme === "dark" || (theme === "system" && systemDark);

    root.classList.toggle("dark", isDark);
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Listen for system theme changes when in 'system' mode
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      document.documentElement.classList.toggle("dark", e.matches);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
```

#### Add `ThemeProvider` to `App.tsx`

Wrap it around the outermost level (before `ReduxProvider` or just inside it).

#### Add theme toggle to `Settings.tsx`

```tsx
import { useTheme } from "@/contexts/ThemeContext";
import { Sun, Moon, Monitor } from "lucide-react";

// Inside the Settings component, after the profile form:
const { theme, setTheme } = useTheme();

<div className="bg-card shadow-card mt-6 rounded-lg border p-6">
  <h2 className="mb-4 text-lg font-semibold">Appearance</h2>
  <div className="flex gap-2">
    <Button
      variant={theme === "light" ? "default" : "outline"}
      onClick={() => setTheme("light")}
      size="sm"
    >
      <Sun className="mr-2 h-4 w-4" /> Light
    </Button>
    <Button
      variant={theme === "dark" ? "default" : "outline"}
      onClick={() => setTheme("dark")}
      size="sm"
    >
      <Moon className="mr-2 h-4 w-4" /> Dark
    </Button>
    <Button
      variant={theme === "system" ? "default" : "outline"}
      onClick={() => setTheme("system")}
      size="sm"
    >
      <Monitor className="mr-2 h-4 w-4" /> System
    </Button>
  </div>
</div>;
```

---

## Phase 3: Accessibility & Navigation (Week 3-4)

### 3.1 [A1] Add Skip-to-Content Link

**Severity:** A11y Critical | **Complexity:** S | **Estimated Effort:** 30 min

**Files:** `src/layouts/MainLayout.tsx`, `src/layouts/CourseLayout.tsx`

**Add as the first child inside the outer div:**

```tsx
<div className="min-h-screen bg-background pb-16 md:pb-0">
  {/* ADD THIS */}
  <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:p-4 focus:bg-background focus:text-foreground focus:border focus:rounded-md focus:top-2 focus:left-2">
    Skip to main content
  </a>
  <AppHeader rightExtra={...} />
  <main id="main-content">
    <Outlet />
  </main>
  <MainBottomNav />
</div>
```

Note: Wrap `<Outlet />` in `<main id="main-content">` in both layouts.

---

### 3.2 [A2] Replace `<div onClick>` with Semantic Elements

**Severity:** A11y Major | **Complexity:** M | **Estimated Effort:** 3 hr

**Problem:** Course cards in `Home.tsx` and `Store.tsx` use
`<div onClick={...}>` which is not keyboard-accessible and invisible to screen
readers.

#### `src/pages/Home.tsx` — Active courses grid (lines 428-430)

```tsx
// BEFORE:
<div
  className="cursor-pointer transform transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1"
  onClick={() => navigate(`/courses/${course.id}`)}
>

// AFTER — Wrap with <Link>:
import { Link } from 'react-router-dom';

<Link
  to={`/courses/${course.id}`}
  className="block cursor-pointer transform transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-xl"
>
```

Do the same for:

- `Home.tsx` archived courses grid (~line 315-317)
- `Store.tsx` course cards (~line 306-308)
- `Course.tsx` story point cards (~lines 543-551) — already use `<div onClick>`,
  change to `<Link to={...}>`

---

### 3.3 [A4] Add `aria-current="page"` to Navigation

**Severity:** A11y Major | **Complexity:** S | **Estimated Effort:** 30 min

#### `src/components/navigation/MainBottomNav.tsx`

```tsx
// BEFORE:
<button
  onClick={() => navigate('/home')}
  className={cn(navItemClass, location.pathname.startsWith('/home') && activeClass)}
>

// AFTER:
<button
  onClick={() => navigate('/home')}
  className={cn(navItemClass, location.pathname.startsWith('/home') && activeClass)}
  aria-current={location.pathname.startsWith('/home') ? 'page' : undefined}
>
```

Apply same pattern to all 3 buttons in `MainBottomNav.tsx` and all 4 buttons in
`CourseBottomNav.tsx`.

---

### 3.4 [A3] Add Focus Management After Route Changes

**Severity:** A11y Major | **Complexity:** S | **Estimated Effort:** 1 hr

#### Create `src/hooks/useFocusOnRouteChange.ts` (NEW FILE)

```tsx
import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export const useFocusOnRouteChange = () => {
  const location = useLocation();

  useEffect(() => {
    // Focus the main content area after navigation
    const main = document.getElementById("main-content");
    if (main) {
      main.focus({ preventScroll: false });
    }
  }, [location.pathname]);
};
```

#### Apply in both layout components:

```tsx
// In MainLayout.tsx and CourseLayout.tsx:
import { useFocusOnRouteChange } from "@/hooks/useFocusOnRouteChange";

const MainLayout = () => {
  useFocusOnRouteChange();
  // ...
};
```

Add `tabIndex={-1}` to the `<main>` element so it can receive focus:

```tsx
<main id="main-content" tabIndex={-1} className="outline-none">
  <Outlet />
</main>
```

---

### 3.5 [A5] Add Text Labels to Difficulty Badges

**Severity:** A11y Minor | **Complexity:** S | **Estimated Effort:** 30 min

**Problem:** `PracticeRange.tsx` difficulty badges rely on color alone.

The badges already have text labels ("easy", "medium", "hard", "expert") — the
issue is they use only color to differentiate. Add an `aria-label` for screen
readers and ensure the text is always visible:

```tsx
// In PracticeRange.tsx, wherever difficulty badges are rendered:
<Badge
  className={getDifficultyColor(item.difficulty)}
  aria-label={`Difficulty: ${item.difficulty}`}
>
  {item.difficulty}
</Badge>
```

This is already mostly fine since the text label is visible. The color is
supplementary. No major change needed.

---

### 3.6 [A7] Add `aria-live` Regions

**Severity:** A11y Major | **Complexity:** S | **Estimated Effort:** 1 hr

**Add to these locations:**

#### Progress updates in `Course.tsx`:

```tsx
// Wrap the progress text in an aria-live region:
<div className="text-muted-foreground text-[11px]" aria-live="polite">
  {hasAccess ? `${completed}/${total} items completed` : `${total} items`}
</div>
```

#### Timer in `TimedTestTimer` component:

```tsx
// Add aria-live="assertive" to the timer display so screen readers announce time changes
// (only announce at key intervals — 10 min, 5 min, 1 min remaining)
<div aria-live="assertive" aria-atomic="true" role="timer">
  {formattedTime}
</div>
```

---

## Phase 4: UX Polish & Improvements (Week 4-6)

### 4.1 [M3] Migrate Data Fetching to TanStack React Query

**Severity:** Major | **Complexity:** XL | **Estimated Effort:** 16 hr

**Problem:** TanStack React Query is installed but unused. All data fetching
uses raw `useEffect` + `useState`, meaning no caching, deduplication, background
refresh, or retry logic.

**This is a large migration. Approach incrementally page-by-page:**

#### Step 1: Configure QueryClient properly in `App.tsx`

```tsx
// BEFORE:
const queryClient = new QueryClient();

// AFTER:
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (was cacheTime)
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});
```

#### Step 2: Create query hooks per domain

Create `src/hooks/queries/useCourses.ts`:

```tsx
import { useQuery } from "@tanstack/react-query";
import CoursesService from "@/services/courses/CoursesService";

export const useCourseById = (courseId: string | undefined) =>
  useQuery({
    queryKey: ["course", courseId],
    queryFn: () => CoursesService.getById(courseId!),
    enabled: !!courseId,
  });

export const usePublicCourses = () =>
  useQuery({
    queryKey: ["courses", "public"],
    queryFn: () => CoursesService.listPublic(),
  });
```

#### Step 3: Migrate one page at a time

Start with `Store.tsx` (simplest data fetching) → `Home.tsx` → `Course.tsx` →
`StoryPoint.tsx`

**Priority pages for migration:**

1. `Store.tsx` — Replace `useEffect` with `usePublicCourses()`
2. `Home.tsx` — Replace course loading `useEffect` with custom hook
3. `Course.tsx` — Complex but high-value (multiple data sources)

---

### 4.2 [m5] Extract Magic Aspect Ratio to CSS Variable

**Severity:** Minor | **Complexity:** S | **Estimated Effort:** 15 min

**Problem:** `aspectRatio: '2.2/3.3'` is hardcoded inline 8+ times.

#### Add to `tailwind.config.ts`:

```ts
theme: {
  extend: {
    aspectRatio: {
      'course-card': '2.2 / 3.3',
    },
  },
}
```

#### Replace all instances:

```tsx
// BEFORE:
style={{ aspectRatio: '2.2/3.3' }}

// AFTER:
className="aspect-course-card"
```

**Files to update:**

- `Home.tsx`: lines 320, 433
- `Store.tsx`: line 311
- `Course.tsx`: lines 680, 746

---

### 4.3 [m7] Fix QR Code Placeholder in Landing Page

**Severity:** Minor | **Complexity:** S | **Estimated Effort:** 30 min

**File:** `src/landing-page/v2/LandingPage.tsx` (lines 476-479)

```tsx
// BEFORE:
[QR Code Placeholder]

// AFTER — Either remove the QR section entirely or use react-qr-code:
import QRCode from 'react-qr-code';

<QRCode value="https://levelup-10404.web.app" size={120} />
```

If `react-qr-code` is not installed, simply remove the placeholder text and the
containing div.

---

### 4.4 [m9] Replace Emoji Icons with Lucide Icons

**Severity:** Minor | **Complexity:** S | **Estimated Effort:** 30 min

**Problem:** Feature cards in `Home.tsx` and category labels in `Store.tsx` use
emoji (💻, 🧩, 🔢, 🎯, 🏃) which render differently across OS.

#### `src/pages/Home.tsx` — Feature cards (lines 386-399)

```tsx
// BEFORE:
<div className="mb-2 text-2xl sm:mb-3 sm:text-3xl">💻</div>;

// AFTER:
import { Code, Puzzle, Calculator } from "lucide-react";
<Code className="text-primary mb-2 h-8 w-8 sm:mb-3 sm:h-10 sm:w-10" />;
```

#### `src/pages/Store.tsx` — Category labels (lines 72-78)

```tsx
// BEFORE:
{ id: 'all' as const, name: 'All Courses', icon: '🎯' },
{ id: CourseLabel.PROGRAMMING, name: ..., icon: '💻' },

// AFTER:
import { Target, Code, Puzzle, Activity, Calculator } from 'lucide-react';
{ id: 'all' as const, name: 'All Courses', icon: Target },
{ id: CourseLabel.PROGRAMMING, name: ..., icon: Code },
{ id: CourseLabel.LOGIC_PUZZLES, name: ..., icon: Puzzle },
{ id: CourseLabel.HEALTH, name: ..., icon: Activity },
{ id: CourseLabel.MATH, name: ..., icon: Calculator },
```

Then update the rendering to use the component:

```tsx
// BEFORE:
<span className="text-xl">{label.icon}</span>

// AFTER:
<label.icon className="h-5 w-5" />
```

---

### 4.5 [m10] Replace `any` TypeScript Types

**Severity:** Minor | **Complexity:** M | **Estimated Effort:** 2 hr

**Problem:** Extensive use of `any` reduces type safety.

**Key locations:**

| File             | Line | Current                       | Recommended                                                            |
| ---------------- | ---- | ----------------------------- | ---------------------------------------------------------------------- |
| `Home.tsx`       | 19   | `useState<any[]>([])`         | `useState<CourseViewModel[]>([])` — Define `CourseViewModel` interface |
| `Course.tsx`     | 82   | `useState<any>(null)`         | `useState<CourseProgress \| null>(null)`                               |
| `StoryPoint.tsx` | 31   | `useState<any[]>([])`         | `useState<StoryPointDTO[]>([])`                                        |
| `StoryPoint.tsx` | 36   | `useState<any \| null>(null)` | `useState<ChatData \| null>(null)`                                     |

**Create a `CourseViewModel` type in `src/types/courses.ts`:**

```tsx
export interface CourseViewModel {
  id: string;
  title: string;
  description: string;
  thumbnailUrl?: string;
  progressPercent: number;
  isAdmin: boolean;
  isArchived: boolean;
  isPracticeRange: boolean;
  fullCourse: CourseDTO;
}
```

---

### 4.6 [m2] Add Dynamic Page Titles

**Severity:** Minor | **Complexity:** S | **Estimated Effort:** 1 hr

**Problem:** No dynamic `<title>` per page, causing confusing browser tabs.

#### Create `src/hooks/usePageTitle.ts` (NEW FILE)

```tsx
import { useEffect } from "react";

export const usePageTitle = (title: string) => {
  useEffect(() => {
    const prev = document.title;
    document.title = title ? `${title} | LevelUp` : "LevelUp";
    return () => {
      document.title = prev;
    };
  }, [title]);
};
```

#### Apply to each page:

| Page                        | Title                                                        |
| --------------------------- | ------------------------------------------------------------ |
| `Home.tsx`                  | `usePageTitle('My Spaces')`                                  |
| `Store.tsx`                 | `usePageTitle('Explore')`                                    |
| `Course.tsx`                | `usePageTitle(courseData?.title \|\| 'Course')`              |
| `StoryPoint.tsx`            | `usePageTitle(selectedStoryPoint?.title \|\| 'Story Point')` |
| `Settings.tsx`              | `usePageTitle('Settings')`                                   |
| `NotFound.tsx`              | `usePageTitle('Page Not Found')`                             |
| `PracticeRange.tsx`         | `usePageTitle('Practice Range')`                             |
| `TimedTestQuestionPage.tsx` | `usePageTitle('Timed Test')`                                 |
| `TimedTestResults.tsx`      | `usePageTitle('Test Results')`                               |

---

### 4.7 [m3/m4] Improve UserProfileForm

**Severity:** Minor | **Complexity:** M | **Estimated Effort:** 3 hr

**File:** `src/components/space/UserProfileForm.tsx`

**Changes:**

1. **Hide raw Firebase UID** (lines 99-101):

```tsx
// BEFORE:
<div>
  <div className="text-muted-foreground text-sm">User ID</div>
  <div className="break-all font-mono text-xs">{user?.uid}</div>
</div>

// AFTER — Remove or hide behind a collapsible:
// Simply remove these 3 lines. Users don't need to see their UID.
```

2. **Add success feedback after saving:**

```tsx
// After line 80 (after refreshUser call):
toast({
  title: "Profile updated",
  description: "Your changes have been saved.",
});
```

(Requires importing `useToast`)

3. **Add field-level validation** (future Phase 5 — requires react-hook-form +
   Zod migration):

- Email format validation
- Age range (5-120)
- Phone number format
- Required fields (name)

---

### 4.8 Standardize Layout Header Gradient

**Severity:** Minor | **Complexity:** S | **Estimated Effort:** 15 min

**Problem:** Both `MainLayout.tsx` and `CourseLayout.tsx` use inline gradient
classes `from-purple-600 via-pink-600 to-blue-600` which don't use design
tokens.

**Files:** `src/layouts/MainLayout.tsx:10`, `src/layouts/CourseLayout.tsx:10`

```tsx
// BEFORE:
<span className="hidden sm:block text-sm font-semibold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent ...">

// AFTER — Use primary color or define a brand gradient token:
<span className="hidden sm:block text-sm font-semibold text-primary ...">
  LevelUp
</span>

// OR if the gradient is important for branding, add a CSS variable:
// In index.css: --gradient-brand: linear-gradient(90deg, hsl(271 76% 53%), hsl(330 81% 60%), hsl(217 91% 60%));
// Then use: style={{ backgroundImage: 'var(--gradient-brand)' }}
```

---

## Phase 5: Advanced Improvements (Week 6+)

### 5.1 Improve NotFound Page

**File:** `src/pages/NotFound.tsx`

Replace the minimal 404 with a more helpful page:

- Add an illustration or icon
- Add common navigation links (Home, Explore)
- Add search capability
- Use `<Link>` instead of `<a href>` for SPA navigation

### 5.2 Add Breadcrumb Navigation

**Components needed:** The `breadcrumb.tsx` UI component already exists in
`src/components/ui/breadcrumb.tsx`.

**Implementation:**

- Add breadcrumbs below the header in `StoryPoint.tsx`:
  `Home > Course Name > Story Point Name`
- Add breadcrumbs in `Course.tsx`: `Home > Course Name`
- Create a `useBreadcrumbs` hook that builds breadcrumb items from the current
  route

### 5.3 Mobile Grid Optimization

**File:** `src/pages/Home.tsx` (line 404)

```tsx
// BEFORE:
<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">

// AFTER — Single column on small mobile, 2-col on larger mobile:
<div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6">
```

Note: Tailwind doesn't have `xs:` by default. Either use
`min-[480px]:grid-cols-2` or add a custom breakpoint.

### 5.4 Global Search with cmdk

**New file:** `src/components/core/CommandPalette.tsx`

Use the `cmdk` package (already installed as a dependency of shadcn's
`command.tsx`) to implement a global search:

- Trigger with `Cmd+K` / `Ctrl+K`
- Search courses, story points, settings
- Add to `AppHeader.tsx`

### 5.5 Activate Gamification Tier System

The CSS variables for tier colors (`--tier-silver`, `--tier-gold`,
`--tier-platinum`, `--tier-diamond`) and learning states (`--state-locked`,
`--state-available`, `--state-progress`, `--state-completed`) are defined but
unused.

**Apply to:**

- Story point cards: Left border color based on difficulty tier
- Course cards: Progress ring with state color
- User profiles: Tier badges based on accumulated points
- Completed items: Green checkmark with `--state-completed` accent

### 5.6 Remove Unused Dependencies

**Check and potentially remove:**

- `framer-motion` — If not used after landing page animations are added,
  evaluate removal (60KB+)
- Dual toast system remnants — After committing to one toast system
- Any other unused packages in `package.json`

---

## Dependency Map

```
Phase 1 (no dependencies — all can be done in parallel):
  ├── 1.1 Delete App.css
  ├── 1.2 Replace window.location.reload
  ├── 1.3 Replace window.location.href
  ├── 1.4 Replace hardcoded colors
  ├── 1.5 Remove duplicate toast
  ├── 1.6 Add error boundaries
  ├── 1.7 Remove dangerouslySetInnerHTML
  └── 1.8 Remove console.logs

Phase 2 (depends on Phase 1 being complete):
  ├── 2.1 Add TabsList to Course.tsx
  ├── 2.2 Create PageContainer (depends: none)
  ├── 2.3 Create EmptyState (depends: none)
  ├── 2.4 Create SkeletonCard (depends: none)
  ├── 2.5 Define typography scale (depends: none)
  └── 2.6 Add dark mode toggle (depends: 1.4 hardcoded colors fixed)

Phase 3 (depends on Phase 2 for layout components):
  ├── 3.1 Skip-to-content (depends: 2.2 PageContainer or layouts)
  ├── 3.2 Semantic elements (depends: none)
  ├── 3.3 aria-current (depends: none)
  ├── 3.4 Focus management (depends: 3.1 main landmark)
  ├── 3.5 Difficulty text labels (depends: none)
  └── 3.6 aria-live regions (depends: none)

Phase 4 (independent or depends on earlier phases):
  ├── 4.1 React Query migration (depends: 1.2 reload removal)
  ├── 4.2 Aspect ratio variable (depends: none)
  ├── 4.3 QR code fix (depends: none)
  ├── 4.4 Replace emoji icons (depends: none)
  ├── 4.5 TypeScript types (depends: none)
  ├── 4.6 Dynamic page titles (depends: none)
  ├── 4.7 UserProfileForm (depends: none)
  └── 4.8 Layout gradient (depends: none)

Phase 5 (depends on earlier phases):
  ├── 5.1 NotFound improvements (depends: 1.4, 2.2)
  ├── 5.2 Breadcrumbs (depends: 2.2 PageContainer)
  ├── 5.3 Mobile grid (depends: none)
  ├── 5.4 Global search (depends: none)
  ├── 5.5 Gamification (depends: 2.5 typography, 1.4 colors)
  └── 5.6 Remove unused deps (depends: all other phases)
```

---

## Summary Table

| Phase                               | Items  | Complexity | Total Est. Effort |
| ----------------------------------- | ------ | ---------- | ----------------- |
| Phase 1: Critical Fixes             | 8      | S-M        | ~12 hr            |
| Phase 2: Components & Design System | 6      | S-M        | ~10 hr            |
| Phase 3: Accessibility              | 6      | S-M        | ~7 hr             |
| Phase 4: UX Polish                  | 8      | S-XL       | ~26 hr            |
| Phase 5: Advanced                   | 6      | M-XL       | ~20+ hr           |
| **Total**                           | **34** |            | **~75 hr**        |

---

_This plan is designed to be immediately actionable. Each item specifies exact
files, line numbers, and before/after code changes. A developer can start coding
from any Phase 1 item without further research._
