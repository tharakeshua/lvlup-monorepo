# Frontend Apps & Shared UI Code Review

**Reviewer:** Frontend Apps Engineer **Date:** 2026-02-24 **Scope:** All 5 apps
(`admin-web`, `teacher-web`, `student-web`, `parent-web`, `super-admin`), shared
packages (`shared-ui`, `shared-hooks`, `shared-stores`, `shared-utils`,
`tailwind-config`), E2E tests

---

## Executive Summary

The frontend is well-structured as a monorepo with good separation of concerns
via shared packages. The shared-ui library (shadcn/ui based) provides consistent
primitives, Zustand stores are clean, and TanStack Query hooks follow a
consistent pattern. However, there are notable issues: duplicated code across
apps (auth guards, login pages), security concerns with XSS and unvalidated user
input rendering, missing lazy loading in most apps, accessibility gaps, and
inconsistent use of shared components vs. inline implementations.

---

## Critical Findings

### C-1: Auth Guard Bypasses Unauthenticated Users Who Have No Membership

**Files:** `apps/admin-web/src/guards/RequireAuth.tsx:25`,
`apps/teacher-web/src/guards/RequireAuth.tsx:25`,
`apps/student-web/src/guards/RequireAuth.tsx:25`,
`apps/parent-web/src/guards/RequireAuth.tsx:25`

The role check at line 25 is:

```typescript
if (allowedRoles && currentMembership) {
```

If `allowedRoles` is specified but `currentMembership` is `null` (user is
authenticated but has no membership for the current tenant), the guard **falls
through** and renders `<Outlet />`. This means an authenticated user with no
membership for the tenant can access protected routes. The condition should deny
access when `allowedRoles` is set but `currentMembership` is null.

**Severity:** Critical **Impact:** Users without proper membership/role for a
tenant can access all protected routes in admin-web, teacher-web, student-web,
and parent-web.

### C-2: Potential XSS via Unescaped User Content Rendering

**File:** `apps/student-web/src/pages/TimedTestPage.tsx:222-223` **File:**
`apps/student-web/src/components/questions/QuestionAnswerer.tsx:230` **File:**
`apps/student-web/src/components/chat/ChatTutorPanel.tsx:81`

Question content (from Firestore) is rendered directly into the DOM via
`whitespace-pre-wrap` text nodes:

```tsx
<div className="whitespace-pre-wrap text-sm text-gray-700">
  {payload.content}
</div>
```

While React auto-escapes JSX expressions, if any content is later refactored to
use `dangerouslySetInnerHTML` for rich text support (which is common for
educational content with formulas/equations), this will become a direct XSS
vector. Chat tutor messages from the AI are also rendered directly at
`ChatTutorPanel.tsx:81`. The `sanitizeString` function exists in
`shared-utils/src/validation.ts:54` but is not used anywhere.

**Severity:** Critical (preventive) **Impact:** Currently mitigated by React's
JSX escaping, but the architecture has no defense-in-depth. Any future rich text
rendering will introduce XSS.

### C-3: `useFirestoreCollection` Uses `JSON.stringify` in Dependency Array

**File:** `packages/shared-hooks/src/data/useFirestoreCollection.ts:53`

```typescript
}, [orgId, collectionName, JSON.stringify(constraints), options?.disabled]);
```

`JSON.stringify(constraints)` creates a new string on every render (Firestore
`QueryConstraint` objects include internal references), causing the effect to
re-run infinitely. This will trigger an infinite loop of Firestore subscription
setup/teardown, causing performance degradation and potential Firestore read
quota exhaustion.

**Severity:** Critical **Impact:** Any component using `useFirestoreCollection`
with constraints will have an infinite re-subscription loop.

---

## Major Findings

### M-1: RequireAuth Component Duplicated 5 Times Identically

**Files:**

- `apps/admin-web/src/guards/RequireAuth.tsx`
- `apps/teacher-web/src/guards/RequireAuth.tsx`
- `apps/student-web/src/guards/RequireAuth.tsx`
- `apps/parent-web/src/guards/RequireAuth.tsx`

These 4 files are byte-for-byte identical (43 lines each). The `super-admin`
version is slightly different (checks `isSuperAdmin`). The common guard should
be extracted to `shared-ui` with an optional `customCheck` prop, reducing 4x
duplication to 1.

**Severity:** Major **Impact:** DRY violation. A security fix to the role check
logic (see C-1) must be applied to 5 files independently.

### M-2: Login Pages Duplicate School-Code Flow Instead of Using Shared Components

**File:** `apps/admin-web/src/pages/LoginPage.tsx` (164 lines) **File:**
`apps/student-web/src/pages/LoginPage.tsx` (461 lines)

The `admin-web` and `student-web` login pages re-implement the school-code
lookup + credentials flow inline with raw `<input>` and `<button>` elements,
despite `shared-ui` already providing `SchoolCodeLoginForm`, `SchoolCodeStep`,
and `CredentialsStep` components. The admin login page duplicates ~100 lines of
school code logic that exists in
`shared-ui/src/components/auth/SchoolCodeStep.tsx`.

**Severity:** Major **Impact:** Inconsistent UI/UX between apps. Bug fixes to
login flow must be applied in multiple places. Raw inputs miss shared styling.

### M-3: Only `teacher-web` Uses Lazy Loading; Other Apps Eagerly Import All Pages

**File:** `apps/teacher-web/src/App.tsx:10-19` -- Uses `lazy()` + `Suspense`
**Files:** `apps/admin-web/src/App.tsx`, `apps/student-web/src/App.tsx`,
`apps/parent-web/src/App.tsx`, `apps/super-admin/src/App.tsx` -- All pages
eagerly imported

Only `teacher-web` uses `React.lazy()` for route-based code splitting. The
`student-web` app has the most pages (40+ components) and would benefit the most
from lazy loading, especially the heavy `TimedTestPage` (551 lines) and
`PracticeModePage`.

**Severity:** Major **Impact:** Larger initial bundle sizes for admin, student,
parent, and super-admin apps. Slower first paint.

### M-4: `useStartTest` and `useSubmitTest` Invalidate ALL Tenant Queries

**File:** `apps/student-web/src/hooks/useTestSession.ts:65-66`

```typescript
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['tenants'] });
},
```

The `onSuccess` callbacks invalidate the entire `['tenants']` query key prefix,
which will refetch **all** data across the app (spaces, exams, submissions,
progress, classes, students, etc.). This should be scoped to just the relevant
test sessions query key.

**Severity:** Major **Impact:** Unnecessary network traffic and UI flickering
after starting or submitting a test. Every query in the app refetches.

### M-5: `handleTimeUp` Callback Has Stale Closure Over `handleSubmitTest`

**File:** `apps/student-web/src/pages/TimedTestPage.tsx:194-196`

```typescript
const handleTimeUp = useCallback(() => {
  handleSubmitTest(true);
}, [currentTenantId, activeSession]);
```

`handleSubmitTest` is not in the dependency array and is not wrapped in
`useCallback`, so `handleTimeUp` captures a stale reference. When the timer
expires, the submission may use outdated `answers` state. The `handleSubmitTest`
function at line 178 directly closes over `answers` state without memoization.

**Severity:** Major **Impact:** Auto-submission on time-up may submit incomplete
or stale answer data.

### M-6: `useRealtimeDB` Uses Deprecated `off()` API

**File:** `packages/shared-hooks/src/data/useRealtimeDB.ts:44-46`

```typescript
return () => {
  off(dbRef);
};
```

The Firebase v9+ modular SDK's `onValue` returns an unsubscribe function
directly. Using `off(dbRef)` removes **all** listeners on that ref, which could
unsubscribe other components listening to the same path. The returned
unsubscribe function from `onValue` (line 27) should be used instead.

**Severity:** Major **Impact:** If multiple components subscribe to the same
RTDB path, unsubscribing one will kill all listeners.

### M-7: Toast Auto-Removal Uses `setTimeout` Outside React Lifecycle

**File:** `packages/shared-stores/src/ui-store.ts:67-71`

```typescript
setTimeout(() => {
  set((state) => ({
    toasts: state.toasts.filter((t) => t.id !== id),
  }));
}, 5000);
```

The `setTimeout` is not cleaned up and will fire even if the store is reset or
toasts are cleared. While Zustand stores are singletons (no cleanup needed),
this creates a subtle issue: if `clearToasts()` is called, individual timers
will still fire and call `set()`, creating unnecessary state updates.

**Severity:** Major **Impact:** Minor memory leak pattern. Toast removal timers
cannot be cancelled.

---

## Minor Findings

### m-1: Inconsistent Use of Shared UI Components vs. Raw HTML

**File:** `apps/admin-web/src/pages/LoginPage.tsx:81-89` -- Raw `<input>` with
inline Tailwind classes **File:**
`apps/admin-web/src/pages/DashboardPage.tsx:67-70` -- Raw `<button>` for Sign
Out **File:** `apps/student-web/src/pages/TimedTestPage.tsx:253-260` -- Raw
`<button>` elements

While `shared-ui` exports `Button`, `Input`, `Label`, and other components, many
app pages use raw HTML elements with duplicated Tailwind class strings. This
leads to inconsistent styling (e.g., the admin login input styles don't match
`shared-ui/Input`).

**Severity:** Minor **Impact:** Visual inconsistencies across apps. Harder to
maintain design system changes.

### m-2: `useFirestoreDoc` and `useFirestoreCollection` Use `organizations/` Path Prefix

**File:** `packages/shared-hooks/src/data/useFirestoreDoc.ts:25` **File:**
`packages/shared-hooks/src/data/useFirestoreCollection.ts:31`

These hooks hardcode `organizations/${orgId}/` as the path prefix, but all
TanStack Query hooks in `packages/shared-hooks/src/queries/` use
`tenants/${tenantId}/`. This suggests the
`useFirestoreDoc`/`useFirestoreCollection` hooks may be legacy or unused,
creating confusion about the data model.

**Severity:** Minor **Impact:** Developer confusion. Potential for bugs if
someone uses these hooks with the wrong path convention.

### m-3: Duplicate `isValidEmail` Implementation

**File:** `packages/shared-utils/src/validation.ts:8-11` **File:**
`packages/shared-utils/src/csv.ts:332-335`

The `isValidEmail` function is implemented identically in both files. The
`csv.ts` version is a private function that should import from `validation.ts`.

**Severity:** Minor **Impact:** DRY violation. Different email validation
behavior could diverge over time.

### m-4: Missing Error Boundaries

**Files:** All `App.tsx` files across all 5 apps

None of the 5 apps wrap their route trees in React Error Boundaries. If a
component throws during render (e.g., invalid data from Firestore), the entire
app will crash with a white screen.

**Severity:** Minor **Impact:** Poor user experience on render errors. No
graceful degradation.

### m-5: `useAuth` Hook in `shared-hooks` Duplicates `useAuthStore` Functionality

**File:** `packages/shared-hooks/src/auth/useAuth.ts`

This hook creates its own `useState` + `onAuthStateChanged` subscription,
completely independent of `useAuthStore` in `shared-stores`. This means two
separate auth state subscriptions could exist simultaneously. The `useUserId`
and `useUserEmail` hooks at lines 45-56 create additional `useAuth()` calls,
each spawning a new auth listener.

**Severity:** Minor **Impact:** Redundant Firebase auth subscriptions. Confusing
API surface (two ways to get auth state).

### m-6: `useSaveAnswer` Mutation Does Not Debounce

**File:** `apps/student-web/src/hooks/useTestSession.ts:94-113` **File:**
`apps/student-web/src/pages/TimedTestPage.tsx:132-141`

Every answer change triggers `saveAnswer.mutate()` immediately. For
text/paragraph questions where students type continuously, this will fire a
Cloud Function call on every keystroke (via the `handleSaveAnswer` callback).
There is no debouncing.

**Severity:** Minor **Impact:** Excessive Cloud Function invocations. Potential
cost issues and rate limiting.

### m-7: `BulkImportDialog` CSV Parser Does Not Handle Quoted Commas

**File:** `packages/shared-ui/src/components/BulkImportDialog.tsx:48-52`

The inline `parseCSV` function uses a naive `split(',')` approach:

```typescript
const values = lines[i].split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
```

This will break on CSV fields containing commas (e.g., `"Doe, John"`). The
`shared-utils/src/csv.ts:307-327` has a proper `parseCSVLine` function that
handles quotes, but `BulkImportDialog` does not use it.

**Severity:** Minor **Impact:** Bulk import will fail or produce incorrect data
for CSV files with commas in field values.

### m-8: Hardcoded `bg-white` in TimedTestPage (Dark Mode Incompatible)

**File:** `apps/student-web/src/pages/TimedTestPage.tsx:324`

```tsx
<div className="... sticky top-0 bg-white z-10 ...">
```

Also at line 386:

```tsx
<div className="bg-white rounded-lg p-6 ...">
```

These use `bg-white` instead of `bg-background` or `bg-card`, breaking dark mode
support. The Tailwind config supports `darkMode: ["class"]`.

**Severity:** Minor **Impact:** Poor dark mode appearance on the test-taking
page.

### m-9: `useStoryPointProgress` Hook Imports from Relative Service Path

**File:** `packages/shared-ui/src/hooks/useStoryPointProgress.ts:2`

```typescript
import UserStoryPointProgressService, {
  UserStoryPointProgressDoc,
} from "../services/progress/UserStoryPointProgressService";
```

This imports from a relative `../services/` path that appears to be within
`shared-ui`, but the file was not found in the glob results. This may be a dead
import or the service may live elsewhere, indicating a potential build error.

**Severity:** Minor **Impact:** Potential build failure or runtime error if the
import path is incorrect.

---

## Suggestions

### S-1: Extract Common App Bootstrap Pattern to Shared Package

All 5 `App.tsx` files repeat the same pattern:

```typescript
useEffect(() => { const unsub = initialize(); return unsub; }, [initialize]);
useEffect(() => { if (currentTenantId) { ... } }, [...]);
```

Consider creating a `useAppBootstrap()` hook in `shared-hooks` that encapsulates
auth initialization + tenant subscription.

### S-2: Add `aria-label` Attributes to Interactive Elements

**Files:** Multiple components across `shared-ui` and app-specific components

- `OrgSwitcher.tsx:60-66` -- Dropdown buttons lack `aria-label`
- `OrgPickerDialog.tsx:36` -- Modal overlay lacks `role="dialog"` and
  `aria-modal="true"`
- `ChatTutorPanel.tsx:51` -- Close button lacks `aria-label="Close"`
- `TimedTestPage.tsx:342-370` -- Navigation buttons lack descriptive
  `aria-label` attributes
- `MCQAnswerer.tsx:33` -- Radio group lacks `role="radiogroup"` and
  `aria-labelledby`
- `QuestionNavigator` -- No keyboard navigation support mentioned

The confirmation dialog in `TimedTestPage.tsx:384-416` is a custom modal that
does not trap focus, does not respond to Escape key, and is not announced to
screen readers.

### S-3: Add `QueryClientProvider` Configuration in App Entry Points

**Files:** `apps/*/src/main.tsx`

Consider configuring a global `QueryClient` with default error handling, retry
logic, and stale times in a shared configuration, rather than relying on
per-hook `staleTime` settings.

### S-4: Consider Using `useId()` for Form Element IDs

Login pages use hardcoded IDs like `#email`, `#password`, `#schoolCode`. If
multiple forms exist on a page (unlikely but possible), these will collide.
React 18's `useId()` is a better approach.

### S-5: Add TypeScript `strict` Mode Enforcement

**File:** `apps/student-web/src/hooks/useTestSession.ts:53` -- Uses
`getFunctions()` without passing the app instance **File:**
`packages/shared-hooks/src/data/useRealtimeDB.ts:8` -- Uses `any` type:
`useRealtimeDB<T = any>`

Several files use loose typing. Consider enabling `noImplicitAny` and
`strictNullChecks` across the monorepo.

### S-6: Use `react-router-dom` `loader` Pattern for Data Prefetching

The current architecture fetches data inside components after mount. React
Router v6.4+ supports `loader` functions that can prefetch data before the route
renders, improving perceived performance.

### S-7: Add Component-Level Test Coverage

There are E2E tests for login flows but no unit/component tests (Vitest + React
Testing Library). The `vitest.config.base.ts` and `vitest.workspace.ts` exist at
the root but no test files were found in any app's `src/` directory. Consider
adding:

- Unit tests for shared hooks (especially `useAuthStore`,
  `useFirestoreCollection`)
- Component tests for `QuestionAnswerer` (covers 15 question types)
- Component tests for `BulkImportDialog` CSV parsing

---

## E2E Test Review

### Coverage Assessment

| App         | Tests | Login | Logout | Error Cases | Navigation | CRUD |
| ----------- | ----- | ----- | ------ | ----------- | ---------- | ---- |
| admin-web   | 7     | Yes   | Yes    | Yes (2)     | Partial    | No   |
| teacher-web | 10    | Yes   | Yes    | No          | Partial    | No   |
| student-web | 12    | Yes   | Yes    | Yes (2)     | No         | No   |
| parent-web  | 5     | Yes   | Yes    | Yes (1)     | No         | No   |
| super-admin | 4     | Yes   | Yes    | Yes (1)     | No         | No   |

### E2E Strengths

- Good coverage of multi-org teacher flow (`teacher-web.spec.ts:45-151`)
- B2B vs B2C student login distinction is well-tested
  (`student-web.spec.ts:66-133`)
- Clean helper abstractions in `tests/e2e/helpers/auth.ts`
- Proper use of Playwright page object pattern

### E2E Gaps

- **No tests for actual page functionality** -- All tests only cover
  login/logout flows. No tests for creating spaces, taking tests, viewing
  progress, managing classes, etc.
- **No tests for data display** -- Dashboard stat cards, exam lists, space lists
  are untested
- **Hardcoded credentials** in `tests/e2e/helpers/selectors.ts:33-42` -- These
  should be sourced from environment variables
- **No mobile viewport tests** -- `shared-ui` has a `use-mobile.tsx` hook but no
  responsive testing
- **Missing accessibility tests** -- No `@axe-core/playwright` or similar a11y
  testing integration

---

## Architecture Summary

### What Works Well

1. **Shared stores pattern** -- Zustand stores in `shared-stores` provide clean,
   centralized state management with good convenience selectors
2. **TanStack Query hooks** -- Consistent query key naming convention
   (`['tenants', tenantId, ...]`), proper `enabled` guards, and appropriate
   `staleTime` values
3. **Tailwind design system** -- The `tailwind-config` package with HSL CSS
   variables enables proper theming across all apps
4. **Component library** -- `shared-ui` provides a comprehensive set of
   shadcn/ui components with proper export structure
5. **Auth flow architecture** -- School code + credentials two-step flow,
   multi-org support, and consumer B2C flow are well-designed

### What Needs Improvement

1. **DRY across apps** -- Auth guards, login pages, app bootstrap logic, and
   layout patterns are duplicated rather than shared
2. **Defense in depth for security** -- No Content Security Policy
   considerations, no input sanitization on render, `sanitizeString` exists but
   is unused
3. **Performance optimization** -- Only 1 of 5 apps uses lazy loading; no
   memoization in heavy components like `TimedTestPage`
4. **Accessibility** -- Custom modals lack focus trapping, no ARIA attributes on
   interactive elements, no keyboard navigation in question navigator
5. **Testing** -- E2E tests only cover auth flows; zero unit/component tests
   despite Vitest being configured
