# Parent-Web Audit Report

**App:** `apps/parent-web` (Parent Portal) **Date:** 2026-03-01 **Auditor:**
Parent-Web Auditor Agent **Blueprint Reference:**
`docs/unified-design-plan/UNIFIED-ARCHITECTURE-BLUEPRINT.md` Section 6.4

---

## Summary

| Severity  | Count  |
| --------- | ------ |
| CRITICAL  | 3      |
| HIGH      | 8      |
| MEDIUM    | 9      |
| LOW       | 4      |
| **Total** | **24** |

**Files Audited (16):**

- `src/App.tsx`
- `src/main.tsx`
- `src/index.css`
- `src/layouts/AuthLayout.tsx`
- `src/layouts/AppLayout.tsx`
- `src/guards/RequireAuth.tsx`
- `src/hooks/useLinkedStudents.ts`
- `src/lib/utils.ts`
- `src/pages/LoginPage.tsx`
- `src/pages/DashboardPage.tsx`
- `src/pages/ChildrenPage.tsx`
- `src/pages/ChildProgressPage.tsx`
- `src/pages/SpaceProgressPage.tsx`
- `src/pages/ExamResultsPage.tsx`
- `src/pages/NotificationsPage.tsx`
- `src/pages/SettingsPage.tsx`

---

## CRITICAL Issues (3)

### C-1: Settings page notification preferences not persisted to Firestore

- **File:** `src/pages/SettingsPage.tsx:21-25`
- **Type:** Missing Implementation
- **Severity:** CRITICAL

All five notification preference switches (`emailNotifs`, `pushNotifs`,
`examResults`, `progressMilestones`, `teacherMessages`) use local `useState`
only. Changes are lost on page refresh. There is no Firestore write, no API
call, no mutation hook. The comment on line 21 reads
`"would be persisted to Firestore"` but this is never implemented. Parents
believe they are saving preferences, but nothing is actually saved.

```tsx
// Line 21-25 — local state only, no persistence
const [emailNotifs, setEmailNotifs] = useState(true);
const [pushNotifs, setPushNotifs] = useState(true);
const [examResults, setExamResults] = useState(true);
const [progressMilestones, setProgressMilestones] = useState(true);
const [teacherMessages, setTeacherMessages] = useState(true);
```

**Fix:** Create a Firestore document at
`tenants/{tenantId}/notificationPreferences/{userId}` (or similar), load
preferences on mount, and persist changes via a mutation hook with debounce or a
Save button.

---

### C-2: Tenant switcher shows raw Firestore IDs instead of school names

- **File:** `src/layouts/AppLayout.tsx:89-95`
- **Type:** Bug
- **Severity:** CRITICAL

The `RoleSwitcher` `tenantOptions` mapping sets `tenantName` to `m.tenantId`
(the raw Firestore document ID) instead of an actual school name. Parents with
children across multiple schools will see random IDs like `"abc123xyz"` instead
of `"Springfield Academy"`.

```tsx
// Line 89-95 — tenantName incorrectly set to tenantId
const tenantOptions: TenantOption[] = allMemberships
  .filter((m) => m.role === "parent")
  .map((m) => ({
    tenantId: m.tenantId,
    tenantName: m.tenantId, // BUG: should be m.tenantName or resolved from tenant doc
    role: m.role,
  }));
```

**Fix:** Use `m.tenantName` if available on the membership object, or resolve
tenant names from the tenant document/store.

---

### C-3: Structured feedback per exam question NOT implemented

- **Blueprint Requirement:** Section 6.4 — "See structured feedback per exam
  question"
- **File:** `src/pages/ExamResultsPage.tsx:215-257`
- **Type:** Missing Feature
- **Severity:** CRITICAL

The architecture blueprint (Section 6.4) requires parents to see structured
feedback per exam question. The `ExamResultsPage` expanded view (lines 215-257)
shows only summary stats (grade, questions graded count, pipeline status, PDF
download button) but has **no per-question breakdown** showing:

- Individual question scores
- AI-generated feedback text per question
- Correct vs student answers
- Question-level explanations or recommendations

This is a core parent-facing feature that is entirely missing. The `Submission`
type likely has a `questions` or `answers` array that is never rendered.

**Fix:** Expand the detail view to iterate over `sub.answers` or
`sub.questions`, showing per-question score, feedback, and correct answer
comparison.

---

## HIGH Severity Issues (8)

### H-1: Improvement recommendations NOT implemented

- **Blueprint Requirement:** Section 6.4 — "See recommendations for improvement"
- **Type:** Missing Feature
- **Severity:** HIGH

Section 6.4 specifies parents should "See recommendations for improvement." No
page displays actionable improvement recommendations or AI-suggested actions.
`ChildProgressPage` shows strength/weakness areas as tags (lines 190-223) but no
textual recommendations explaining what the child should do to improve.

**Fix:** Add a recommendations section to `ChildProgressPage` that renders
`selectedSummary.recommendations` (or similar field) with actionable guidance.

---

### H-2: Multi-school org switcher doesn't show correct labels

- **File:** `src/layouts/AppLayout.tsx:89-95`
- **Type:** Bug
- **Severity:** HIGH

Directly related to C-2. The org switcher for parents with children across
multiple schools is functionally broken at the display level. The `RoleSwitcher`
UI component works for switching, but shows meaningless Firestore document IDs
as labels, making it impossible for parents to identify which school they are
switching to.

---

### H-3: Duplicate useLinkedStudents hook definition

- **Files:** `src/pages/ChildProgressPage.tsx:26-45` vs
  `src/hooks/useLinkedStudents.ts:11-33`
- **Type:** Code Duplication
- **Severity:** HIGH

`ChildProgressPage` defines its own local `useLinkedStudents` hook (lines 26-45)
with identical Firestore query logic instead of importing from
`../hooks/useLinkedStudents.ts`. This:

- Duplicates code and risks divergence if one is updated but not the other
- Queries the root `userMemberships` collection (consistent with the shared
  hook, but both lack tenant-scoping via subcollection)
- Means bug fixes to the shared hook won't apply to this page

```tsx
// ChildProgressPage.tsx:26 — local duplicate definition
function useLinkedStudents(tenantId: string | null, parentId: string | null) {
  return useQuery<UserMembership[]>({ ... });
}
```

**Fix:** Remove the local definition and import `useLinkedStudents` from
`../hooks/useLinkedStudents`.

---

### H-4: Firestore query on root collection requires composite index

- **Files:** `src/hooks/useLinkedStudents.ts:20-26`,
  `src/pages/ChildProgressPage.tsx:32-38`
- **Type:** Performance / Query
- **Severity:** HIGH

The `useLinkedStudents` query filters on three fields (`tenantId`, `parentId`,
`role`) on the root `userMemberships` collection. Firestore requires a composite
index for multi-field queries. If the composite index is not deployed to the
Firestore instance, the query will fail at runtime with a Firestore error (error
message includes a link to create the index, but this error is never surfaced to
the user — see M-5).

```tsx
// Three-field compound query requiring composite index
const q = query(
  colRef,
  where("tenantId", "==", tenantId),
  where("parentId", "==", parentId),
  where("role", "==", "student")
);
```

**Fix:** Ensure the composite index is defined in `firestore.indexes.json`. Also
consider whether this should be a tenant-scoped subcollection query
(`tenants/{tenantId}/memberships`) for better data isolation.

---

### H-5: No route parameters for child-specific views

- **Files:** `src/App.tsx:56`, `src/pages/ChildrenPage.tsx:174-185`
- **Type:** Missing Implementation
- **Severity:** HIGH

Routes `/child-progress` and `/results` have no `:childId` URL parameter. When
clicking "View Full Progress" or "Exam Results" from `ChildrenPage`, the links
navigate to a page showing ALL children's data rather than the specific child
that was clicked. `ChildProgressPage` uses a local selector dropdown to pick a
child, but the link from `ChildrenPage` doesn't pass which child was clicked.

```tsx
// App.tsx:56 — no :childId param
<Route path="/child-progress" element={<ChildProgressPage />} />

// ChildrenPage.tsx:174-176 — link doesn't pass child context
<Link to="/child-progress" ...>
  View Full Progress
</Link>
```

**Fix:** Change routes to `/child-progress/:childId` and `/results/:childId`,
pass `student.uid` in the link, and read the param with `useParams()` in the
target pages.

---

### H-6: ExamResultsPage N+1 query problem

- **File:** `src/pages/ExamResultsPage.tsx:42-61`
- **Type:** Performance
- **Severity:** HIGH

For each submission, the code performs a separate `getDoc` call to fetch exam
metadata (title, subject) inside a loop. With 100 submissions across 20 unique
exams, this makes 20+ individual Firestore document reads sequentially. The
in-memory `examCache` helps with duplicates within a single batch, but:

- Still N individual reads for N unique exams
- Reads are sequential (await inside for loop), not parallel
- No cross-session caching

```tsx
// Line 46-61 — N+1 pattern
for (const d of snap.docs) {
  const sub = { id: d.id, ...d.data() } as Submission;
  if (sub.examId && !examCache[sub.examId]) {
    const examDoc = await getDoc(
      doc(db, `tenants/${tenantId}/exams`, sub.examId)
    );
    // ...
  }
}
```

**Fix:** Collect unique `examId` values first, then batch-fetch all exams with
`where("__name__", "in", examIds)` (up to 30 per batch). Alternatively,
denormalize exam title/subject onto the submission document.

---

### H-7: SpaceProgressPage shows truncated IDs instead of names

- **File:** `src/pages/SpaceProgressPage.tsx:112,123`
- **Type:** UX Bug
- **Severity:** HIGH

Student headers show `"Student abc12345"` (truncated UID) and space cards show
`"Space abc12345abcd"` (truncated spaceId) instead of actual student names or
space titles. No name resolution is performed — the page never fetches user or
space documents to get display names.

```tsx
// Line 112 — truncated UID as label
<h2 className="text-lg font-semibold">
  Student {studentId.slice(0, 8)}
</h2>

// Line 123 — truncated spaceId as label
<h3 className="font-medium">
  Space {prog.spaceId.slice(0, 12)}
</h3>
```

**Fix:** Fetch student names from the linked students data (already available
via `useLinkedStudents`) and space titles from the `spaceProgress` documents or
a separate spaces query.

---

### H-8: No wildcard/404 route

- **File:** `src/App.tsx:44-63`
- **Type:** Missing Implementation
- **Severity:** HIGH

There is no catch-all `*` route for undefined paths. Navigating to `/foo` or any
non-existent path shows a blank page within the authenticated layout (or the
auth layout, depending on auth state). This is confusing for users.

**Fix:** Add a `<Route path="*" element={<NotFoundPage />} />` or redirect to
dashboard: `<Route path="*" element={<Navigate to="/" replace />} />`.

---

## MEDIUM Severity Issues (9)

### M-1: Unused variable `_selectedStudent`

- **File:** `src/pages/ChildProgressPage.tsx:70-72`
- **Type:** Dead Code
- **Severity:** MEDIUM

`_selectedStudent` is computed but never referenced in JSX or logic. Prefixed
with underscore to suppress lint warnings, but indicates incomplete
implementation — likely intended to show the selected student's name in the UI
header.

```tsx
const _selectedStudent = linkedStudents?.find(
  (s) => s.uid === (selectedStudentId ?? summaries[0]?.studentId)
);
```

**Fix:** Either use it to display the student's name in the page header, or
remove the variable.

---

### M-2: NotificationsPage duplicates notification fetching with AppLayout

- **Files:** `src/pages/NotificationsPage.tsx:12-16` vs
  `src/layouts/AppLayout.tsx:27-33`
- **Type:** Redundancy
- **Severity:** MEDIUM

Both `AppLayout` and `NotificationsPage` independently call
`useNotifications()`. When navigating to `/notifications`, two separate
Firestore queries execute for essentially the same data. While React Query may
deduplicate if query keys align, the `NotificationsPage` passes additional
options (`unreadOnly` filter, `limit: 50`) that differ from `AppLayout`'s
default call, so they may not cache-align.

**Fix:** Lift notification state to a shared context, or ensure query keys are
identical so React Query deduplicates.

---

### M-3: Dashboard has redundant Sign Out button

- **Files:** `src/pages/DashboardPage.tsx:56-61`,
  `src/pages/SettingsPage.tsx:164`
- **Type:** UX
- **Severity:** MEDIUM

The dashboard page has a standalone "Sign Out" button in the header. The
Settings page also has a "Sign Out" button. Multiple exit points can confuse
users about the canonical way to sign out. Typically, sign out belongs in the
sidebar footer or settings page, not on the main dashboard.

**Fix:** Remove the dashboard Sign Out button and keep it only in Settings or
the sidebar user menu.

---

### M-4: Loading states are inconsistent across pages

- **Files:** Multiple
- **Type:** UX Consistency
- **Severity:** MEDIUM

| Page                            | Loading UI                         |
| ------------------------------- | ---------------------------------- |
| `DashboardPage.tsx:157-164`     | 3 skeleton pulse rectangles (h-48) |
| `ChildrenPage.tsx:30-37`        | 2 skeleton pulse rectangles (h-40) |
| `ChildProgressPage.tsx:104-107` | Plain text "Loading..."            |
| `SpaceProgressPage.tsx:96-99`   | Plain text "Loading progress..."   |
| `ExamResultsPage.tsx:119-127`   | 4 skeleton pulse rectangles (h-24) |

**Fix:** Create a shared `PageSkeleton` or `LoadingState` component and use
consistently.

---

### M-5: Empty state messages are inconsistent

- **Files:** Multiple
- **Type:** UX Consistency
- **Severity:** MEDIUM

| Page                            | Empty State Text                                     |
| ------------------------------- | ---------------------------------------------------- |
| `DashboardPage.tsx:166-173`     | "No linked children" with Users icon                 |
| `ChildrenPage.tsx:39-46`        | "No children linked" with Users icon, different copy |
| `ChildProgressPage.tsx:108-114` | "No linked children" without icon                    |
| `SpaceProgressPage.tsx:100-106` | "No progress data yet" without icon                  |

**Fix:** Standardize empty state copy and presentation with a shared
`EmptyState` component.

---

### M-6: No error boundary or error state handling

- **Files:** All pages, `src/App.tsx`
- **Type:** Missing Implementation
- **Severity:** MEDIUM

No page checks the `error` state from `useQuery` or `useLinkedStudents`. If a
Firestore query fails (network error, permission denied, missing index), the
page falls through to the empty state, misleading users into thinking there is
no data when the real problem is a query failure. There is also no React Error
Boundary wrapping the app or individual routes.

**Fix:** Check `isError` / `error` from query hooks and display an error banner.
Wrap `<Routes>` in a React Error Boundary with a fallback UI.

---

### M-7: useStudentSummaries called with potentially empty array on every render

- **Files:** `src/pages/DashboardPage.tsx:37`, `src/pages/ChildrenPage.tsx:18`
- **Type:** Performance
- **Severity:** MEDIUM

When `linkedStudents` is `undefined` (loading state), `studentIds` becomes `[]`,
and `useStudentSummaries` creates a `useQueries` call with 0 queries. While
functionally safe, this triggers unnecessary hook evaluations on every render
cycle during the loading phase.

**Fix:** Guard the call or pass an `enabled` flag to avoid unnecessary hook
processing while parent data is loading.

---

### M-8: Firebase config uses `(import.meta as any)` — bypasses type safety

- **File:** `src/main.tsx:18-24`
- **Type:** TypeScript
- **Severity:** MEDIUM

All `import.meta.env` accesses cast through `any`, bypassing TypeScript's type
checking. There is no `vite-env.d.ts` with a proper `ImportMetaEnv` interface
declaration. Additionally, there is no validation that environment variables are
actually set — `undefined` values will be silently passed to
`initializeFirebase`, causing cryptic runtime errors.

```tsx
apiKey: (import.meta as any).env.VITE_FIREBASE_API_KEY as string,
```

**Fix:** Create a `src/vite-env.d.ts` with `ImportMetaEnv` interface declaring
all `VITE_*` variables. Add a startup validation check that required env vars
are non-empty.

---

### M-9: No React StrictMode wrapper

- **File:** `src/main.tsx:27-33`
- **Type:** Best Practice
- **Severity:** MEDIUM

`React.StrictMode` is not used, which means double-render checks for detecting
side effects in development mode are disabled. This can mask bugs related to
impure renders, missing cleanup in effects, and deprecated API usage.

**Fix:** Wrap `<App />` or `<QueryClientProvider>` with `<React.StrictMode>`.

---

## LOW Severity Issues (4)

### L-1: ChildProgressPage uses deep import path for shared-hooks

- **File:** `src/pages/ChildProgressPage.tsx:11`
- **Type:** Import Path Inconsistency
- **Severity:** LOW

Uses `'@levelup/shared-hooks/queries'` while all other pages import from
`'@levelup/shared-hooks'`. Should use the barrel export for consistency.

```tsx
// ChildProgressPage.tsx:11
import { useStudentSummaries } from "@levelup/shared-hooks/queries";

// All other pages use:
import { useStudentSummaries } from "@levelup/shared-hooks";
```

---

### L-2: ExamResultsPage imports shared hook but ChildProgressPage doesn't

- **Files:** `src/pages/ExamResultsPage.tsx:18` vs
  `src/pages/ChildProgressPage.tsx:26-45`
- **Type:** Inconsistency
- **Severity:** LOW

`ExamResultsPage` correctly imports `useLinkedStudentIds` from the shared hook
file (`../hooks/useLinkedStudents`), but `ChildProgressPage` defines its own
local version. This inconsistency suggests the refactoring to a shared hook was
incomplete.

---

### L-3: DashboardPage ScoreCard falls back to truncated tenantId

- **File:** `src/pages/DashboardPage.tsx:78`
- **Type:** Minor UX
- **Severity:** LOW

The "School" ScoreCard falls back to `tenantId?.slice(0, 12)` — a truncated
Firebase document ID — when `membership?.tenantCode` is unavailable. This is not
user-friendly.

```tsx
value={membership?.tenantCode || tenantId?.slice(0, 12) || "--"}
```

---

### L-4: No pagination on ExamResultsPage

- **File:** `src/pages/ExamResultsPage.tsx:32-74`
- **Type:** Scalability
- **Severity:** LOW

All matching submissions are fetched at once with no `limit` clause or
pagination. For parents with multiple children who have many exams over time,
this could result in increasingly large data fetches and slow page loads.

**Fix:** Add Firestore `limit()` and implement cursor-based pagination or
infinite scroll.

---

## Architecture Assessment

### What Works Well

- **Auth guard** (`RequireAuth`) properly checks for `parent` role and handles
  loading/unauthorized states
- **Lazy-loaded routes** via `React.lazy()` with a shared `PageLoader` fallback
- **Shared UI components** (`ScoreCard`, `ProgressRing`, `AtRiskBadge`,
  `AppShell`, `NotificationBell`) from `@levelup/shared-ui`
- **Shared stores** (`useAuthStore`, `useTenantStore`) from
  `@levelup/shared-stores`
- **Tenant subscription** in `App.tsx` properly subscribes/unsubscribes on
  tenant change
- **Login flow** correctly implements two-step school code + credentials as per
  blueprint
- **Notification system** integrates `NotificationBell` in header and dedicated
  page

### Gaps vs Blueprint (Section 6.4)

| Blueprint Requirement                       | Status                                    |
| ------------------------------------------- | ----------------------------------------- |
| Enter school code + credentials → dashboard | Implemented                               |
| See list of linked children                 | Implemented                               |
| Multi-school org switcher                   | Implemented but shows IDs not names (C-2) |
| Per child: view space progress (LevelUp)    | Implemented                               |
| Per child: view exam results (AutoGrade)    | Implemented (summary only)                |
| Structured feedback per exam question       | **NOT IMPLEMENTED** (C-3)                 |
| Recommendations for improvement             | **NOT IMPLEMENTED** (H-1)                 |
| Notifications on result releases            | Implemented                               |

### Firestore Query Concerns

1. Root `userMemberships` collection queries require composite indexes (H-4)
2. N+1 exam metadata fetching pattern (H-6)
3. No pagination on submissions query (L-4)
4. Mixed patterns: some queries tenant-scoped
   (`tenants/{tenantId}/spaceProgress`), some on root collection
   (`userMemberships`)
