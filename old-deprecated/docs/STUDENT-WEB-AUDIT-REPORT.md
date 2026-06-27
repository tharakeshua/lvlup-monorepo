# Student-Web (apps/student-web) — Complete Audit Report

**Auditor:** Student-Web Auditor Agent **Date:** 2026-03-01 **Scope:** Full deep
audit of `apps/student-web/` against
`docs/unified-design-plan/UNIFIED-ARCHITECTURE-BLUEPRINT.md` Section 7.3 **Files
Audited:** 50+ source files (all pages, components, hooks, guards, layouts)

---

## Summary

| Severity      | Count  |
| ------------- | ------ |
| Critical (P0) | 5      |
| High (P1)     | 8      |
| Medium (P2)   | 12     |
| Low (P3)      | 13     |
| **Total**     | **38** |

---

## CRITICAL Issues (P0)

### 1. Missing Leaderboard Page — No route or page exists

- **File:** `src/App.tsx:48-58`
- **Nav Link:** `src/layouts/AppLayout.tsx:76-78`
- **Type:** Missing Feature / Dead Link
- **Severity:** CRITICAL

**Description:** The architecture blueprint (Section 7.3) specifies a
Leaderboard screen with both Space Leaderboard and Overall Leaderboard. The
sidebar nav in `AppLayout.tsx:76-78` links to `/leaderboard`, but NO route is
defined in `App.tsx` and NO `LeaderboardPage` component exists anywhere in the
codebase. Users clicking "Leaderboard" in the sidebar will see a blank page
/ 404.

**Expected:** A `LeaderboardPage.tsx` that queries
`tenants/{tenantId}/leaderboards/{spaceId}` and the RTDB path
`leaderboards/{tenantId}/{spaceId}` for real-time data, with a route at
`/leaderboard` in `App.tsx`.

---

### 2. Missing Tests Link Page — Dead navigation link

- **File:** `src/layouts/AppLayout.tsx:57-60`
- **Route file:** `src/App.tsx` (no `/tests` route)
- **Type:** Missing Feature / Dead Link
- **Severity:** CRITICAL

**Description:** The sidebar navigation defines a "Tests" item linking to
`/tests` (AppLayout.tsx line 58), but no route for `/tests` exists in `App.tsx`.
Clicking "Tests" in the sidebar navigates to a non-existent route. There should
either be a dedicated Tests listing page showing all available timed tests
across spaces, or this nav item should be removed/redirected.

---

### 3. Missing Chat Tutor Standalone Page — Dead navigation link

- **File:** `src/layouts/AppLayout.tsx:80-84`
- **Route file:** `src/App.tsx` (no `/chat` route)
- **Type:** Missing Feature / Dead Link
- **Severity:** CRITICAL

**Description:** The sidebar navigation defines a "Chat Tutor" item linking to
`/chat` (AppLayout.tsx line 82), but no route for `/chat` exists in `App.tsx`.
The `ChatTutorPanel` component exists but is only used as a slide-over panel
within StoryPointViewerPage and PracticeModePage. A standalone Chat Tutor page
for browsing previous chat sessions or starting new ones is missing entirely.

---

### 4. Missing Exam Results Detail Page

- **File:** Architecture Section 7.3 vs `src/App.tsx`
- **Broken link source:**
  `src/components/dashboard/RecommendationsSection.tsx:39-41`
- **Type:** Missing Feature
- **Severity:** CRITICAL

**Description:** The blueprint specifies an Exam Results screen with:

- Result Summary (score, grade, percentage)
- Per-Question Feedback (marks, rubric, AI feedback)
- Recommendations (linked spaces for weak topics)
- PDF Download

None of these exist as a standalone page. The `RecommendationsSection.tsx`
generates links to `/exams/{examId}/results` (line 39-41) but no such route
exists — clicking would 404. The only "results" view is the inline results
section within `TimedTestPage.tsx`, which only covers LevelUp digital test
sessions, not AutoGrade exam results.

**Expected:** A dedicated `ExamResultPage.tsx` with route
`/exams/:examId/results` that fetches from
`tenants/{tenantId}/submissions/{submissionId}` and
`tenants/{tenantId}/submissions/{submissionId}/questionSubmissions/{qId}`.

---

### 5. Missing "Upcoming" Section on Dashboard

- **File:** `src/pages/DashboardPage.tsx`
- **Type:** Missing Feature
- **Severity:** CRITICAL

**Description:** Blueprint Section 7.3 specifies the Dashboard should include an
"Upcoming (exams, deadlines)" section. This is completely absent from the
dashboard implementation. The dashboard shows: Progress Overview, My Spaces,
Recent Exam Results, and Recommendations — but no upcoming exams, assignment
deadlines, or scheduled tests.

---

## HIGH Severity Issues (P1)

### 6. Consumer Routes Cannot Access B2B Space Viewer — Routing Guard Blocks Access

- **File:** `src/App.tsx:48,61-70`
- **Consumer link source:** `src/pages/ConsumerDashboardPage.tsx:113-116`
- **Type:** Auth/Guard Logic Bug
- **Severity:** HIGH

**Description:** Consumer enrolled spaces link to `/spaces/{spaceId}`
(ConsumerDashboardPage.tsx line 116), but that route sits under the B2B
`RequireAuth` guard which requires `allowedRoles={['student']}` (App.tsx line
48). Consumer users who are not members of any tenant will fail the role check
and see "Access Denied". **Consumer users have no way to actually view their
enrolled spaces.**

**Fix:** Either duplicate space viewer routes under the consumer layout, or
create a shared route group that allows both consumer and student access.

---

### 7. Timed Test: Server Deadline Fallback Uses Client Time (Cheating Vector)

- **File:** `src/pages/TimedTestPage.tsx:303-305`
- **Type:** Logic Bug / Security
- **Severity:** HIGH

**Description:**

```typescript
const deadline = activeSession.serverDeadline
  ? (activeSession.serverDeadline as any).seconds * 1000
  : Date.now() +
    (storyPoint?.assessmentConfig?.durationMinutes ?? 60) * 60 * 1000;
```

When `activeSession.serverDeadline` is missing/null, the code falls back to
`Date.now() + durationMinutes * 60000`. This is entirely client-side — students
can manipulate their system clock to get unlimited time. The blueprint mandates
"server-enforced timer". If no server deadline exists, the test should either
not render or should fetch the deadline from the server.

---

### 8. Timed Test: `timeSpentSeconds` Always Sent as 0

- **File:** `src/pages/TimedTestPage.tsx:136`
- **Type:** Logic Bug
- **Severity:** HIGH

**Description:**

```typescript
saveAnswer.mutate({
  tenantId: currentTenantId,
  sessionId: activeSession.id,
  itemId,
  answer,
  timeSpentSeconds: 0, // Always 0!
});
```

Per-question time tracking is never implemented. Every answer is saved with
`timeSpentSeconds: 0`. This breaks all analytics that depend on
time-per-question data and violates the architecture's per-question time
tracking requirements.

**Fix:** Track when the student navigates to a question (`currentIndex` changes)
and compute elapsed time on save.

---

### 9. Practice Mode: No RTDB Integration

- **File:** `src/pages/PracticeModePage.tsx` (entire file)
- **Type:** Missing Feature
- **Severity:** HIGH

**Description:** The blueprint specifies practice mode should use Firebase RTDB
for real-time progress tracking at path
`practiceProgress/{tenantId}/{userId}/{spaceId}/{itemId}`. The current
implementation only:

1. Calls `evaluateAnswer` Cloud Function
2. Stores evaluations in component-level `useState`

No RTDB reads or writes exist anywhere in the practice mode code. **Practice
progress is completely lost on page refresh or navigation away.** There is no
persistence layer for practice attempts.

---

### 10. Items Fetched from Potentially Wrong Firestore Path

- **File:** `src/hooks/useSpaceItems.ts:16-18`
- **Type:** Schema Mismatch
- **Severity:** HIGH

**Description:**

```typescript
const colRef = collection(
  db,
  `tenants/${tenantId}/spaces/${spaceId}/storyPoints/${storyPointId}/items`
);
```

Items are fetched from a deeply nested path under storyPoints. Per the
architecture schema (Section 3.1), items live at
`tenants/{tenantId}/spaces/{spaceId}/items/{itemId}` (flat under space, with a
`storyPointId` field for filtering). If the Firestore data follows the blueprint
schema, this query returns empty results. Verify which path is actually used in
the backend/seed data.

---

### 11. Consumer Dashboard: Hardcoded `platform_public` Tenant ID

- **File:** `src/pages/ConsumerDashboardPage.tsx:23`
- **Type:** Hardcoded Value / Config Issue
- **Severity:** HIGH

**Description:**

```typescript
const spacesRef = collection(firestore, "tenants/platform_public/spaces");
```

The Firestore path uses a hardcoded `platform_public` tenant ID. If the
public/consumer tenant ID is configured differently in any environment (staging,
production), all consumer space queries will fail silently and return empty
results. This should come from environment config or a shared constant.

---

### 12. StoreDetailPage: Also Hardcodes `platform_public`

- **File:** `src/pages/StoreDetailPage.tsx:44`
- **Type:** Hardcoded Value
- **Severity:** HIGH

**Description:**

```typescript
const ref = doc(firestore, `tenants/platform_public/spaces/${spaceId}`);
```

Same issue as #11. Duplicated hardcoded tenant ID. Both files would need
updating if the tenant ID changes.

---

### 13. StoreDetailPage: `orderBy` Field Name Mismatch

- **File:** `src/pages/StoreDetailPage.tsx:62`
- **Type:** Query Bug
- **Severity:** HIGH

**Description:**

```typescript
const q = query(ref, orderBy("order", "asc"));
```

The StoryPoint schema and all other queries in the codebase use `orderIndex` as
the ordering field (see `useStoryPoints.ts:13` which uses
`orderBy('orderIndex', 'asc')`). This query uses `"order"` which is likely a
non-existent field. The query will either fail (if a composite index is
required) or return unordered results.

---

## MEDIUM Severity Issues (P2)

### 14. Consumer Signup Does Not Create `/users/{uid}` Document

- **File:** `src/pages/LoginPage.tsx:100-106`
- **Type:** Data Integrity Bug
- **Severity:** MEDIUM

**Description:** Consumer signup calls `authService.signUp()` and
`updateUserProfile()` but does NOT explicitly create the `/users/{uid}`
Firestore document or the `consumerProfile` sub-object. The architecture relies
on an `onUserCreated` Cloud Function trigger to create this document. If that
function fails, is not deployed, or has a cold-start delay, subsequent queries
to the user document will return null, causing the dashboard and profile pages
to show empty/broken state.

---

### 15. No Max Attempts Enforcement on Client Side

- **File:** `src/pages/TimedTestPage.tsx:251-258`
- **Type:** Missing Validation
- **Severity:** MEDIUM

**Description:** The landing page displays `maxAttempts` (line 241) but never
disables the "Start Test" button when the student has reached the maximum number
of attempts. The server's `startTestSession` function may reject the request,
but the generic error message at line 261-263 just says "Failed to start test.
You may have reached the maximum attempts." — the student doesn't know for sure.

**Fix:** Add
`disabled={completedSessions.length >= (storyPoint?.assessmentConfig?.maxAttempts ?? Infinity)}`
to the Start Test button.

---

### 16. QuestionAnswerer: `savedAnswer` Prop Changes Don't Update Local State

- **File:** `src/components/questions/QuestionAnswerer.tsx:62`
- **Type:** Stale State Bug
- **Severity:** MEDIUM

**Description:**

```typescript
const [answer, setAnswer] = useState<unknown>(savedAnswer ?? undefined);
```

`useState` only uses its argument as the INITIAL value. If `savedAnswer` changes
later (e.g., when navigating back to a previously answered question in test
mode, where the parent passes updated `answers[currentItem.id]`), the local
state retains its old value. This can cause the displayed answer to not match
what was previously saved.

**Fix:** Add a `useEffect` to sync `savedAnswer` changes, or use `savedAnswer`
directly as the source of truth in test mode.

---

### 17. CountdownTimer: `onTimeUp` in Dependency Array is Fragile

- **File:** `src/components/test/CountdownTimer.tsx:28`
- **Type:** Performance / Correctness Bug
- **Severity:** MEDIUM

**Description:** The `useEffect` for the countdown interval includes `onTimeUp`
in its dependency array. The parent (`TimedTestPage`) does wrap `handleTimeUp`
with `useCallback`, but `handleTimeUp` depends on `handleSubmitTest` which
depends on `answers` state. Every time the student answers a question, `answers`
changes → `handleSubmitTest` is recreated → `handleTimeUp` is recreated → the
countdown effect re-runs, clearing and restarting the interval. This can cause
timer display flicker.

---

### 18. ChatTutorPanel: Messages Don't Update in Real-Time After Sending

- **File:** `src/components/chat/ChatTutorPanel.tsx:16,33`
- **Type:** UX Bug
- **Severity:** MEDIUM

**Description:** After sending a message via `sendMessage.mutate()`, the local
`messages` list comes from `session?.messages` (TanStack Query cache). The query
has `staleTime: 10s` and doesn't immediately refetch. The user sees:

1. Their input clears
2. "Thinking..." indicator appears
3. When the mutation completes, the query is invalidated
4. But the old messages list still shows until the next refetch

The user's sent message "disappears" from the chat until the query refreshes.
Should add optimistic local state for the user's message.

---

### 19. AudioAnswerer: Blob is Not Serializable for Cloud Function Submission

- **File:** `src/components/questions/AudioAnswerer.tsx:32-35`
- **Type:** Data Flow Bug
- **Severity:** MEDIUM

**Description:** The audio answer is stored as a `Blob` object in component
state. When submitted through `QuestionAnswerer.onSubmit(answer)`, this Blob
ultimately reaches the `evaluateAnswer` or `recordItemAttempt` Cloud Function
via `httpsCallable`. Blobs cannot be serialized to JSON — the function call will
either fail or send `{}`.

**Fix:** Convert the Blob to a base64 string before submission, or upload to
Cloud Storage and send the download URL.

---

### 20. ImageEvaluationAnswerer: File Objects Not Serializable

- **File:** `src/components/questions/ImageEvaluationAnswerer.tsx:23`
- **Type:** Data Flow Bug
- **Severity:** MEDIUM

**Description:** Same issue as #19. `File[]` objects are stored as the answer
value. `File` extends `Blob` and cannot be JSON-serialized for Cloud Function
calls. Image-based answers will fail to submit.

**Fix:** Upload images to Cloud Storage first, then send the array of download
URLs as the answer.

---

### 21. JumbledAnswerer: Items Not Shuffled on Initialization

- **File:** `src/components/questions/JumbledAnswerer.tsx:14`
- **Type:** Logic Bug
- **Severity:** MEDIUM

**Description:**

```typescript
const order = value ?? data.items.map((item) => item.id);
```

When no previous answer exists (`value` is undefined), the default order is
`data.items.map(item => item.id)` — the original order from the database. If
items are stored in the correct order (which is typical for question authoring),
students see the **correct answer by default** without needing to rearrange
anything.

**Fix:** Shuffle the initial order using a deterministic shuffle (e.g., seeded
by question ID) so students always see a randomized starting order.

---

### 22. StoreListPage: Search Only Filters Pre-Fetched Results (Max 30)

- **File:** `src/pages/StoreListPage.tsx:58-63`
- **Type:** Scalability / UX Bug
- **Severity:** MEDIUM

**Description:** The search input filters the `spaces` array client-side after
fetching. The query fetches at most 30 spaces (`limit: 30` at line 49). If the
store has 100+ spaces, search will only find matches within the first 30
results. The `search` parameter is defined in the Cloud Function interface but
is never passed to it.

**Fix:** Pass `search` to the Cloud Function call for server-side full-text
filtering.

---

### 23. StoreListPage: Hardcoded Subject Filter Options

- **File:** `src/pages/StoreListPage.tsx:98-108`
- **Type:** Hardcoded Values
- **Severity:** MEDIUM

**Description:** The subject filter dropdown contains hardcoded options: "Math,
Science, English, History". These don't reflect the actual subjects available in
the store. New subjects added by content creators won't appear in the filter.

**Fix:** Fetch available subjects from the backend or derive them from the
fetched spaces.

---

### 24. StoreListPage: "Load More" Pagination is Broken

- **File:** `src/pages/StoreListPage.tsx:250-258`
- **Type:** Logic Bug
- **Severity:** MEDIUM

**Description:**

```tsx
<Link to={`/store?after=${data.lastId}`} ...>Load more spaces</Link>
```

"Load more" is implemented as a `<Link>` navigation to `/store?after={lastId}`,
but the page component never reads URL search params (`useSearchParams`). The
`startAfter` parameter is never extracted from the URL and never passed to the
query function. Clicking "Load more" triggers a full page re-render that fetches
the same first page again.

**Fix:** Use `useSearchParams` to read `after` param, or switch to a stateful
"load more" button that appends to the existing results.

---

### 25. StoryPointViewerPage: Item-Level Progress Data May Not Exist

- **File:** `src/pages/StoryPointViewerPage.tsx:116`
- **Type:** Missing Data / Feature Gap
- **Severity:** MEDIUM

**Description:**

```typescript
const itemProgress = progress?.items[item.id];
const isCompleted = itemProgress?.completed;
```

The `useProgress` hook returns space-level progress from
`spaceProgress/{userId}_{spaceId}`. Whether this document contains a nested
`items` map with per-item completion status depends on the backend
implementation. If the backend only tracks story-point-level progress,
`progress?.items` will be undefined and completion checkmarks will never show.

---

### 26. ChatAgentAnswerer: `onSendMessage` Prop Never Passed — Assistant Never Replies

- **File:** `src/components/questions/QuestionAnswerer.tsx:210-218`
- **File:** `src/components/questions/ChatAgentAnswerer.tsx:14,41`
- **Type:** Missing Integration
- **Severity:** MEDIUM

**Description:** `QuestionAnswerer` renders `<ChatAgentAnswerer>` but only
passes `data`, `value`, `onChange`, and `disabled`. The `onSendMessage` prop
(which triggers the AI response) is never provided. In
`ChatAgentAnswerer.tsx:41`:

```typescript
if (onSendMessage) {
  const reply = await onSendMessage(message);
  onChange([...updated, { role: "assistant", text: reply }]);
}
```

Since `onSendMessage` is always undefined, the assistant never replies. Students
can type messages but only see their own messages — no AI response is ever
generated. The chat_agent_question type is effectively non-functional.

---

## LOW Severity Issues (P3)

### 27. SpaceViewerPage: Practice Mode "Solved" Count Calculation is Inaccurate

- **File:** `src/pages/SpaceViewerPage.tsx:163`
- **Type:** Math Bug
- **Severity:** LOW

**Description:**

```typescript
{progress ? Math.round((progress.pointsEarned / (progress.totalPoints || 1)) * (storyPoint.stats.totalItems)) : 0}
/{storyPoint.stats.totalItems} solved
```

This calculates "solved" as `(pointsEarned / totalPoints) * totalItems`. If a
student gets partial credit on questions, this inflates the solved count. E.g.,
50% on all 10 questions shows "5/10 solved" even though 0 are fully solved.

---

### 28. FeedbackPanel: Extra Icon Rendered for `correctness === 0`

- **File:** `src/components/common/FeedbackPanel.tsx:31`
- **Type:** Logic Bug
- **Severity:** LOW

**Description:**

```typescript
{!evaluation.correctness && <Minus className="h-5 w-5 text-gray-500" />}
```

`!evaluation.correctness` is `true` when correctness is `0` (incorrect). This
means both the `XCircle` (from `isIncorrect` check at line 30) AND the `Minus`
icon render simultaneously for incorrect answers. The `Minus` was intended for
the "evaluated but no correctness score" edge case.

**Fix:** Change to `{evaluation.correctness == null && <Minus ... />}` or
`{evaluation.correctness === undefined && ...}`.

---

### 29. RequireAuth: Plain Text Loading State

- **File:** `src/guards/RequireAuth.tsx:14-18`
- **Type:** UX Issue
- **Severity:** LOW

**Description:** During the auth loading phase, the guard shows a plain
"Loading..." text div. On slow connections or cold starts, this can be visible
for several seconds. Should use a proper loading spinner or skeleton consistent
with the rest of the app.

---

### 30. LoginPage: No Password Strength Validation on Consumer Signup

- **File:** `src/pages/LoginPage.tsx:420-425`
- **Type:** Missing Validation
- **Severity:** LOW

**Description:** The consumer signup form accepts any password without
client-side validation. Firebase Auth requires minimum 6 characters, but there's
no visual indicator of password requirements or strength. Users will see a
generic Firebase error if their password is too short.

---

### 31. NotificationsPage: Missing `userId` in Mutation Calls

- **File:** `src/pages/NotificationsPage.tsx:28-34`
- **Type:** Potential Bug
- **Severity:** LOW

**Description:** `markRead.mutate({ tenantId, notificationId })` and
`markAllRead.mutate({ tenantId })` — if the underlying mutation hooks require a
`userId` parameter to construct the Firestore path (e.g.,
`tenants/{tenantId}/notifications` filtered by userId), these calls may fail
silently. Depends on the shared-hooks implementation.

---

### 32. AppLayout: Org Switcher Shows Tenant ID Instead of Tenant Name

- **File:** `src/layouts/AppLayout.tsx:92-94`
- **Type:** UX Bug
- **Severity:** LOW

**Description:**

```typescript
tenantOptions: TenantOption[] = allMemberships
  .filter((m) => m.role === "student")
  .map((m) => ({
    tenantId: m.tenantId,
    tenantName: m.tenantId,  // Shows raw ID like "ten_abc123"
    role: m.role,
  }));
```

The `tenantName` field is set to the raw `tenantId` string. Students with
multiple school memberships will see cryptic IDs in the org switcher instead of
school names. Should use `m.tenantCode` or fetch the tenant name from the
membership/tenant document.

---

### 33. DashboardPage: Unused Direct Import of `useProgress`

- **File:** `src/pages/DashboardPage.tsx:8`
- **Type:** Code Quality
- **Severity:** LOW

**Description:** `useProgress` is imported at the top of DashboardPage but is
only used inside the child `DashboardSpaceCard` component (which is defined in
the same file). Not a functional issue, but the import could be moved to be more
localized.

---

### 34. MaterialViewer: Potential URL Injection in Rich Content Image Blocks

- **File:** `src/components/materials/MaterialViewer.tsx:161`
- **Type:** Security
- **Severity:** LOW

**Description:**

```tsx
<img key={block.id} src={block.content} alt="" className="w-full rounded-lg" />
```

Rich material image blocks use `block.content` directly as the `src` attribute.
While React escapes attribute values, `javascript:` protocol URLs could
theoretically be used in some contexts. Additionally, arbitrary external URLs
could be used for tracking pixels.

**Recommendation:** Validate that image URLs use `https://` protocol only.

---

### 35. InteractiveMaterial: Sandbox Attributes Negate Each Other

- **File:** `src/components/materials/MaterialViewer.tsx:119`
- **Type:** Security
- **Severity:** LOW

**Description:**

```tsx
<iframe
  src={url}
  className="h-full w-full"
  sandbox="allow-scripts allow-same-origin"
/>
```

Combining `allow-scripts` and `allow-same-origin` in the sandbox attribute
effectively negates the sandbox protection. The iframe's script can access the
parent page's DOM and remove its own sandbox attribute. For untrusted content,
use only one of these flags, not both.

---

### 36. Timed Test: Silent Error Swallowing in catch Blocks

- **File:** `src/pages/TimedTestPage.tsx:114-116, 188-189`
- **Type:** Error Handling
- **Severity:** LOW

**Description:**

```typescript
} catch {
  // Handle error
}
```

Multiple catch blocks in `handleStartTest` and `handleSubmitTest` silently
swallow errors with no user feedback. If test start or submission fails due to
network issues, the student sees no error message and may not know their answers
weren't saved.

**Fix:** Show a toast/alert notification on failure.

---

### 37. PracticeModePage: `currentIndex` Not Reset on Filter Change

- **File:** `src/pages/PracticeModePage.tsx:29-33`
- **Type:** UX Bug
- **Severity:** LOW

**Description:** When the difficulty filter changes (e.g., from "all" to
"hard"), `filteredQuestions` changes length but `currentIndex` keeps its old
value. If the student was on question 15 and the "hard" filter only has 3
questions, `currentQuestion` at index 15 is undefined, and the page shows "No
questions match the filter" even though there are matching questions.

**Fix:** Reset `currentIndex` to 0 when `difficultyFilter` changes (add a
`useEffect`).

---

### 38. main.tsx: Unsafe `import.meta` Type Casting

- **File:** `src/main.tsx:18-24`
- **Type:** Type Safety
- **Severity:** LOW

**Description:**

```typescript
(import.meta as any).env.VITE_FIREBASE_API_KEY as string;
```

All environment variable accesses use `(import.meta as any)` cast, bypassing
TypeScript's type system. Vite provides `ImportMeta` type augmentation
specifically for this purpose.

**Fix:** Add a `src/vite-env.d.ts` with proper `ImportMetaEnv` interface
declarations.

---

### 39. ConsumerProfilePage: "Join a School" Links to `/login` (Confusing UX)

- **File:** `src/pages/ConsumerProfilePage.tsx:63-66`
- **Type:** UX Issue
- **Severity:** LOW

**Description:** The "Enter School Code" button links to `/login`, which is the
full login page. A logged-in consumer user clicking this would see the login
form again, which is confusing. Should either link to a dedicated "join school"
flow or pass state to pre-fill the school code step.

---

## Architecture Compliance Matrix

| Blueprint Requirement (Section 7.3)        | Status   | Details                                                                     |
| ------------------------------------------ | -------- | --------------------------------------------------------------------------- |
| **Login:** School code + credentials       | PASS     | Two-step flow implemented correctly                                         |
| **Login:** Roll number support             | PASS     | `loginWithSchoolCode` handles roll number derivation                        |
| **Login:** Consumer B2C login              | PASS     | Email/password + Google OAuth + signup                                      |
| **Dashboard:** Progress Overview           | PASS     | Combined LevelUp + AutoGrade ScoreCards                                     |
| **Dashboard:** My Spaces                   | PASS     | Shows 4 recent spaces with progress bars                                    |
| **Dashboard:** My Results                  | PARTIAL  | Links to `/results` page, but no exam detail view                           |
| **Dashboard:** Recommendations             | PASS     | InsightEngine integration with dismiss support                              |
| **Dashboard:** Upcoming                    | **FAIL** | Completely missing                                                          |
| **Space Viewer:** Space Home               | PASS     | StoryPoint list with type icons + progress                                  |
| **Space Viewer:** Story Point Viewer       | PASS     | Materials + questions + section sidebar                                     |
| **Material Reader:** text                  | PASS     | Text + Story material types                                                 |
| **Material Reader:** video                 | PASS     | YouTube embed detection + native video                                      |
| **Material Reader:** PDF                   | PASS     | iframe embed + download link                                                |
| **Question Answerer:** MCQ                 | PASS     | Radio buttons, correct/wrong highlighting                                   |
| **Question Answerer:** MCAQ                | PASS     | Checkboxes, multi-select                                                    |
| **Question Answerer:** true-false          | PASS     | Boolean toggle                                                              |
| **Question Answerer:** numerical           | PASS     | Number input                                                                |
| **Question Answerer:** text                | PASS     | Text input                                                                  |
| **Question Answerer:** paragraph           | PASS     | Textarea                                                                    |
| **Question Answerer:** code                | PASS     | Monospace textarea with test cases display                                  |
| **Question Answerer:** fill-blanks         | PASS     | Inline text inputs in template                                              |
| **Question Answerer:** fill-blanks-dd      | PASS     | Inline dropdowns in template                                                |
| **Question Answerer:** matching            | PASS     | Left-right matching with dropdowns                                          |
| **Question Answerer:** jumbled             | PARTIAL  | Arrow-based reordering, but not shuffled on init (#21)                      |
| **Question Answerer:** audio               | PARTIAL  | Recording works, but Blob not serializable (#19)                            |
| **Question Answerer:** image_evaluation    | PARTIAL  | Upload works, but Files not serializable (#20)                              |
| **Question Answerer:** group-options       | PASS     | Assign items to groups with dropdown                                        |
| **Question Answerer:** chat_agent_question | **FAIL** | `onSendMessage` never connected — AI never replies (#26)                    |
| **Timed Test:** 5-status navigator         | PASS     | not_visited, not_answered, answered, marked_for_review, answered_and_marked |
| **Timed Test:** Answer area per type       | PASS     | QuestionAnswerer dispatches to correct answerer                             |
| **Timed Test:** Server-enforced timer      | PARTIAL  | Falls back to client time when server deadline missing (#7)                 |
| **Timed Test:** Submit / Auto-submit       | PASS     | Manual submit + CountdownTimer.onTimeUp auto-submit                         |
| **Practice Mode:** Unlimited drill         | PASS     | No attempt limit, retry button                                              |
| **Practice Mode:** Instant feedback        | PASS     | FeedbackPanel with correctness, strengths, weaknesses                       |
| **Practice Mode:** RTDB integration        | **FAIL** | No RTDB reads/writes, progress lost on refresh (#9)                         |
| **AI Tutor Chat:** Per-item context        | PASS     | ChatTutorPanel receives spaceId, storyPointId, itemId                       |
| **Exam Results:** Summary                  | PARTIAL  | Inline in TimedTestPage only, no AutoGrade results                          |
| **Exam Results:** Per-question feedback    | PARTIAL  | Shows correct/incorrect + points, no rubric/AI feedback                     |
| **Exam Results:** Recommendations          | **FAIL** | No linked spaces for weak topics in results                                 |
| **Exam Results:** PDF Download             | **FAIL** | No PDF generation or download                                               |
| **Leaderboard:** Space + Overall           | **FAIL** | No page, no route, dead nav link (#1)                                       |
| **Profile** (B2B student)                  | **FAIL** | Only consumer profile exists                                                |
| **Auth:** Multi-org switcher               | PASS     | RoleSwitcher in AppLayout sidebar                                           |
| **Notifications**                          | PASS     | Full page + bell with unread count                                          |

---

## Issue Index by File

| File                                                   | Issue #s      |
| ------------------------------------------------------ | ------------- |
| `src/App.tsx`                                          | 1, 2, 3, 4, 6 |
| `src/layouts/AppLayout.tsx`                            | 2, 3, 32      |
| `src/pages/TimedTestPage.tsx`                          | 7, 8, 15, 36  |
| `src/pages/PracticeModePage.tsx`                       | 9, 37         |
| `src/pages/DashboardPage.tsx`                          | 5, 33         |
| `src/pages/ConsumerDashboardPage.tsx`                  | 6, 11         |
| `src/pages/StoreDetailPage.tsx`                        | 12, 13        |
| `src/pages/StoreListPage.tsx`                          | 22, 23, 24    |
| `src/pages/StoryPointViewerPage.tsx`                   | 25            |
| `src/pages/LoginPage.tsx`                              | 14, 30        |
| `src/pages/ConsumerProfilePage.tsx`                    | 39            |
| `src/pages/NotificationsPage.tsx`                      | 31            |
| `src/pages/SpaceViewerPage.tsx`                        | 27            |
| `src/hooks/useSpaceItems.ts`                           | 10            |
| `src/hooks/useChatTutor.ts`                            | 18            |
| `src/components/questions/QuestionAnswerer.tsx`        | 16, 26        |
| `src/components/questions/AudioAnswerer.tsx`           | 19            |
| `src/components/questions/ImageEvaluationAnswerer.tsx` | 20            |
| `src/components/questions/JumbledAnswerer.tsx`         | 21            |
| `src/components/questions/ChatAgentAnswerer.tsx`       | 26            |
| `src/components/chat/ChatTutorPanel.tsx`               | 18            |
| `src/components/test/CountdownTimer.tsx`               | 17            |
| `src/components/common/FeedbackPanel.tsx`              | 28            |
| `src/components/materials/MaterialViewer.tsx`          | 34, 35        |
| `src/components/dashboard/RecommendationsSection.tsx`  | 4             |
| `src/guards/RequireAuth.tsx`                           | 29            |
| `src/main.tsx`                                         | 38            |
