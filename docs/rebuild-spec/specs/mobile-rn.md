# React Native (Expo) Mobile Apps — Fresh-Build Spec

> Net-new addition. This section specifies the **mobile clients** for the
> rebuilt Auto-LevelUp platform. They are first-class consumers of the **one
> common API layer** (`@levelup/api-contract` + typed callable client) and reuse
> the platform-neutral shared packages verbatim. No mobile app talks to
> Firestore/Functions directly via ad-hoc paths; every read/write flows through
> the same typed repositories the web apps use.
>
> Ground-truth sources: `status/app-student-web.md`,
> `status/app-teacher-web.md`, `status/app-legacy-and-scanner.md`,
> `status/shared-packages.md`, `status/api-layer.md`, `status/auth-access.md`.

---

## 0. Design principles (carried from the web rebuild, enforced on mobile)

1. **One API layer, no direct client writes.** Mobile reuses the same
   `@levelup/api-contract` Zod schemas + typed callable registry +
   `createCallableClient(transport)`. The Firebase Functions transport is
   injectable; mobile injects a React-Native Firebase (or HTTPS) transport.
   Business invariants (stats, summary recompute, answer-key protection, version
   history, rate limits) live server-side — identical trust boundary for web and
   mobile (`api-layer.md` §5.1–5.3, `app-legacy-and-scanner.md` Part C.2).
2. **Headless logic is shared; only views differ.** Question answerers, the
   test-runner state machine, the deterministic evaluation engine, progress
   aggregation, and adaptive selection are extracted into framework-agnostic
   packages. RN supplies native input/presentation; logic is identical
   (`app-student-web.md` §5.6, `shared-packages.md` §5.6).
3. **Validate at the boundary with Zod.** Every API response is `safeParse`d
   before entering RN state. No `as Type` casts, one `timestamp → epoch-ms` util
   shared with web (`app-student-web.md` §5.2).
4. **Preserve all core domain concepts.** UnifiedItem + 15 question types,
   hybrid evaluation, server-authoritative timed tests with clock-skew
   correction, the Space→StoryPoint→Item hierarchy, three-layer identity +
   membership/claims, the AutoGrade scouting→grading pipeline, gamification, AI
   tutoring — all intact. Mobile changes the shell, not the model.
5. **Tenant + role context comes from the shared auth store.** RN reuses the
   Zustand `auth-store` (multi-tenant switching via `switchActiveTenant` + token
   refresh) untouched — it is DOM/router-free and already RN-ready
   (`shared-packages.md` §1 auth-store, `auth-access.md` §5.7).

---

## 1. Which roles get a mobile app (and why)

| Mobile app                     | Role(s)                                                  | Rationale                                                                                                                                                                                                                                                     | Priority |
| ------------------------------ | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| **`mobile-student`** (Expo)    | `student` (B2B) + consumer (B2C)                         | Learners want anytime practice, materials, timed tests, chat tutor, streaks/leaderboard, push for assignments/results. Highest engagement surface; mirrors `apps/student-web`.                                                                                | **P0**   |
| **`mobile-scanner`** (Expo)    | `scanner`, also `staff`/`teacher` with upload permission | Native camera + on-device compression + **offline-durable capture queue** is the killer reason this must be native, not a PWA. Feeds AutoGrade `uploadAnswerSheets`. Backend already pre-wired (`app-legacy-and-scanner.md` Part B.2).                        | **P0**   |
| **`mobile-teacher`** (Expo)    | `teacher`, `tenantAdmin`                                 | Teachers want on-the-go **grading review** (AI confidence, accept/override, keyboard→touch gestures), notifications, class/student glance, exam status. Heavy authoring (ItemEditor ~2700 lines) stays **web-first**; mobile is review/monitor + light edits. | **P1**   |
| **`mobile-parent`** (deferred) | `parent`                                                 | Read-only child progress, released results, alerts, push. Low interaction; can ship later or as a lightweight WebView/Expo wrapper. Not in initial scope.                                                                                                     | **P2**   |
| Admin / Super-admin            | —                                                        | No mobile app. Governance/provisioning stays on web.                                                                                                                                                                                                          | —        |

**Recommendation:** ship **student** and **scanner** first (P0), **teacher**
second (P1). Parent is a fast follow once the shared learner-core/teacher-core
packages are stable.

---

## 2. Tech stack & monorepo placement

```
apps/
  teacher-web/      student-web/   admin-web/   super-admin/   parent-web/   (existing web)
  mobile-student/   <- NEW (Expo)
  mobile-scanner/   <- NEW (Expo)
  mobile-teacher/   <- NEW (Expo, P1)
packages/
  api-contract/     <- NEW: Zod schemas + z.infer types + callable registry (web + RN + functions)
  api-client/       <- NEW: createCallableClient(transport) + per-entity repositories
  shared-types/     (unchanged, platform-neutral source of truth)
  shared-utils/     (unchanged, platform-neutral)
  shared-stores/    (Zustand — auth/tenant/ui/consumer; RN-ready, injectable transport)
  shared-hooks/     -> split into shared-hooks-core (headless, RN) + shared-hooks-web (DOM)
  learner-core/     <- NEW: test-runner SM, adaptive engine, progress agg, eval engine adapter
  teacher-core/     <- NEW: grading-review SM, item validation registry
  evaluation-engine/<- NEW: single deterministic auto-evaluator (imported by client AND functions)
  design-tokens/    <- NEW: framework-neutral tokens (feeds Tailwind web + RN styling)
  shared-ui/        (web-only, presentational; gets a headless layer beneath)
  ui-native/        <- NEW: RN component library mapped 1:1 to shared-ui composites
```

**Per-app stack (all three mobile apps):**

- **Expo SDK (managed workflow, EAS Build)** + **Expo Router** (file-based,
  typed routes) — chosen over bare RN for OTA updates, EAS push,
  camera/secure-store/notifications modules out of the box.
- **TypeScript strict.**
- **TanStack Query v5** (already a dep; RN-compatible) for server cache — same
  query-key factories as web.
- **Zustand 5** via `@levelup/shared-stores` — same auth/tenant/consumer stores.
- **`@react-native-firebase/*`** (app, auth, functions, firestore, database,
  messaging, storage) as the Firebase transport adapter, OR `firebase/*` JS SDK
  in Expo Go for dev. Region pinned `asia-south1` (matches `api-layer.md`
  §region).
- **NativeWind** (Tailwind for RN) fed by `@levelup/design-tokens` so tokens
  match web (`shared-packages.md` §5.7).
- **`expo-camera`**, **`expo-image-manipulator`** (compression),
  **`expo-file-system`** + **SQLite/MMKV** or
  **`@react-native-async-storage`**-backed IndexedDB-equivalent for the scanner
  offline queue, **`expo-secure-store`** (token), **`expo-notifications`**
  (push), **`@react-native-community/netinfo`** (connectivity),
  **KaTeX/markdown** via `react-native-math-view` or a WebView-based math
  renderer for the shared content renderer.

---

## 3. Common API layer integration (the load-bearing contract)

Mobile is the forcing function for finishing the API consolidation the web
reports recommend. Mobile **must not** import `firebase/firestore` directly —
that pattern is the explicit blocker called out in `app-student-web.md` §4 and
`shared-packages.md` §4.3.

### 3.1 Contract package (`@levelup/api-contract`)

One file per callable, colocating schema + inferred type (`api-layer.md` §5.1):

```ts
// packages/api-contract/src/levelup/start-test-session.ts
export const StartTestSessionRequestSchema = z.object({
  tenantId: z.string(), // (migration: later derived from claims server-side)
  spaceId: z.string(),
  storyPointId: z.string(),
});
export type StartTestSessionRequest = z.infer<
  typeof StartTestSessionRequestSchema
>;

export const StartTestSessionResponseSchema = z.object({
  sessionId: z.string(),
  serverDeadline: z.number(), // epoch-ms (transport-neutral; NOT FirestoreTimestamp)
  questions: z.array(TestSessionQuestionSchema),
});
export type StartTestSessionResponse = z.infer<
  typeof StartTestSessionResponseSchema
>;
```

A single registry the client is generated from:

```ts
// packages/api-contract/src/registry.ts
export const CALLABLES = {
  startTestSession: {
    req: StartTestSessionRequestSchema,
    res: StartTestSessionResponseSchema,
  },
  submitTestSession: {
    req: SubmitTestSessionRequestSchema,
    res: SubmitTestSessionResponseSchema,
  },
  evaluateAnswer: {
    req: EvaluateAnswerRequestSchema,
    res: EvaluateAnswerResponseSchema,
  },
  recordItemAttempt: {
    req: RecordItemAttemptRequestSchema,
    res: RecordItemAttemptResponseSchema,
  },
  sendChatMessage: {
    req: SendChatMessageRequestSchema,
    res: SendChatMessageResponseSchema,
  },
  uploadAnswerSheets: {
    req: UploadAnswerSheetsRequestSchema,
    res: UploadAnswerSheetsResponseSchema,
  },
  gradeQuestion: {
    req: GradeQuestionRequestSchema,
    res: GradeQuestionResponseSchema,
  },
  saveSpace: { req: SaveSpaceRequestSchema, res: SaveResponseSchema },
  // ...all ~47 callables, one entry each (api-layer.md §1 inventory)
} as const;
export type CallableName = keyof typeof CALLABLES;
```

### 3.2 Transport-agnostic client (`@levelup/api-client`)

```ts
export interface CallableTransport {
  invoke<T>(name: string, data: unknown): Promise<T>; // platform supplies this
}

export function createCallableClient(
  registry,
  transport: CallableTransport,
  opts?: { validateResponses?: boolean }
) {
  // returns fully-typed methods: client.startTestSession(req) -> Promise<res>
  // request validated with registry[name].req.parse(); response safeParse in dev (opts.validateResponses)
}
```

- **Web** injects
  `{ invoke: (n, d) => httpsCallable(getFunctions(app,'asia-south1'), n)(d).then(r => r.data) }`.
- **RN** injects the `@react-native-firebase/functions` equivalent (or a
  `fetch`-based HTTPS transport if/when a REST gateway lands). **The only
  platform difference is the injected transport** (`api-layer.md` §5.2, §5.12).

### 3.3 Repositories (reads behind the same seam)

Reads also move off ad-hoc Firestore paths into typed repositories
(`shared-packages.md` §5.1, `app-student-web.md` §5.1):

```ts
interface SpacesRepo      { listPublished(tenantId): Promise<Space[]>; get(tenantId, spaceId): Promise<Space>; }
interface ProgressRepo    { getSpaceProgress(tenantId, userId, spaceId): Promise<SpaceProgress>; ... }
interface TestSessionRepo { start(req): ...; submit(req): ...; saveAnswer(req): ...; watchSession(id): Observable<DigitalTestSession>; }
interface ChatRepo        { listSessions(tenantId, itemId): ...; send(req): ...; }
interface SubmissionsRepo { watch(tenantId, submissionId): Observable<Submission>; watchQuestions(...): ...; }
```

Repositories return **domain types validated by Zod**, expose **intent-level
methods** (not collection paths), and wrap realtime needs (test deadline,
submission status, chat, notifications, leaderboard) behind an
`Observable`/subscription interface so RN can back it with
`@react-native-firebase` onSnapshot today and SSE/WebSocket later. This is the
single change that makes web + RN share data logic.

### 3.4 What stays server-authoritative (unchanged, mobile honors it)

- **Answer-key isolation** — keys stripped from client reads, re-merged via
  `getItemForEdit`; mobile teacher edits go through the same callable +
  `answerKeyLooksStripped` guard (`app-teacher-web.md` §1.9).
- **Submission creation** — mobile scanner uploads images to Storage then calls
  `uploadAnswerSheets`; never writes the submission doc or generates IDs
  client-side (`app-legacy-and-scanner.md` B.3).
- **Grading recompute** — accept/override/bulk-approve all route through
  `gradeQuestion`; no client `writeBatch` (fixes the web bypass in
  `app-teacher-web.md` §4).
- **Timed-test deadline & scoring** — server allocates `serverDeadline`;
  deterministic local scoring is an _optimistic preview_ only, reconciled by
  `submitTestSession`.

---

## 4. `mobile-student` — spec

### 4.1 Navigation (Expo Router, file-based)

```
app/
  (auth)/login.tsx                         # school-code -> email/pass; or consumer email login
  (tabs)/
    index.tsx            -> Dashboard      (cross-system summary, streak, at-risk, recommendations)
    spaces.tsx           -> My Spaces      (B2B: assigned spaces; B2C: enrolled)
    tests.tsx            -> Tests          (upcoming/active/past timed tests + exams)
    leaderboard.tsx      -> Leaderboard
    profile.tsx          -> Profile/Settings
  space/[spaceId]/
    index.tsx            -> Space detail (Contents / Overview / Insights tabs)
    story-point/[spId].tsx     -> StoryPointViewer (materials + questions, sectioned)
    test/[spId].tsx            -> TimedTest runner (state machine)
    test/[spId]/analytics.tsx  -> Test analytics
    practice/[spId].tsx        -> Practice mode (unlimited retry)
  exam/[examId]/results.tsx    -> Exam results (autograde feedback)
  store/                       -> (B2C) list / [spaceId] / checkout
  notifications.tsx
```

- **B2B vs B2C split done by context, not path prefix** (fixes
  `app-student-web.md` §4 "two products in one app"). A single `LearnerContext`
  resolves data source (`tenant` vs `platform_public`) and the same screens
  render both. No duplicate `/spaces` vs `/consumer/spaces` trees.
- Tab bar replaces web `MobileBottomNav`; deep links map 1:1 to web routes for
  push-notification navigation.
- Guard: a shared
  `<RequireAuth allow={['student']} onConsumerRedirect="/store" />` from the
  config-driven guard package (`routing-appmgmt.md` §5.1) — same guard logic as
  web.

### 4.2 Screen → shared-logic mapping (reuse, not rewrite)

| Mobile screen    | Shared headless logic (reused)                                                                                                                              | RN-specific presentation                                                                      |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| TimedTest runner | `learner-core/useTestRunner` (session state machine), `useTestTimer` (clock-skew via RTDB `.info/serverOffset`), `selectNextQuestion`/`updateAdaptiveState` | Native `QuestionNavigator` grid, swipe between questions, native countdown, haptics on submit |
| StoryPointViewer | item grouping by section, `evaluation-engine` (deterministic), `evaluateAnswer` fallback, `recordItemAttempt`                                               | `QuestionAnswerer` native dispatcher (15 types), `MaterialViewer` (video/pdf/image via Expo)  |
| Dashboard        | `useStudentProgressSummary`, gamification selectors                                                                                                         | `LevelBadge`/`StreakWidget`/`AchievementBadge` RN variants                                    |
| Chat tutor       | `useChatSession`/`useSendChatMessage` (callable)                                                                                                            | bottom-sheet chat UI, streaming tokens if gateway supports SSE                                |
| Exam results     | `SubmissionsRepo`, `QuestionSubmission` feedback                                                                                                            | native rubric breakdown, image lightbox                                                       |

**Question answerers** are dispatched by one `QuestionAnswerer` switch on
`payload.questionType` (15 types: mcq, mcaq, true-false, numerical, text,
paragraph, code, fill-blanks, fill-blanks-dd, matching, jumbled, audio,
image_evaluation, group-options, chat_agent_question). Each answerer is a thin
native view over a **shared `useAnswerState` hook** (the platform adapter
pattern from `app-student-web.md` §5.6). Code/paragraph use native multiline
inputs; audio uses `expo-av`; image_evaluation uses `expo-image-picker`.

### 4.3 Offline behavior

- **Materials & already-fetched questions**: TanStack Query persistence
  (`@tanstack/query-async-storage-persister`) for read-through offline.
- **Practice attempts**: queue locally (MMKV) and flush `recordItemAttempt` on
  reconnect (practice is unlimited-retry, low-stakes — safe to queue). Mirrors
  the web RTDB practice cache concept but durable.
- **Timed tests are online-only** by design (server-authoritative deadline).
  Block start when offline; if connectivity drops mid-test, keep the local timer
  running against `serverDeadline` and best-effort `saveAnswer`, then
  `submitTestSession` on reconnect or auto-submit at deadline. Never extend the
  server deadline client-side.

### 4.4 Core concepts preserved

Server-authoritative timed sessions, hybrid evaluation, unified item model +
dispatcher, adaptive selection, three-tier progress, gamification, AI chat —
**all intact**, sourced from `learner-core` + `evaluation-engine` shared with
web and server (eliminates the client/server scoring-drift risk in
`app-student-web.md` §4 "Evaluation contract duplicated").

---

## 5. `mobile-scanner` — spec (highest native value)

This is where native beats PWA decisively: real camera, real on-device
compression, and a **durable offline capture queue**
(`app-legacy-and-scanner.md` B.5 explicitly flags the PWA plan's in-memory-only
weakness).

### 5.1 Navigation & workflow

```
app/
  (auth)/login.tsx                 # school code -> username -> password (3-credential, tenant scoped)
  (tabs)/
    exams.tsx        -> Exam list (status 'published' | 'grading' ONLY)   # NOT 'ready' (B.3 reconcile)
    queue.tsx        -> Offline upload queue (pending / uploading / failed / done)
  exam/[examId]/
    students.tsx     -> Class-filtered student list (active only)
    student/[studentId]/capture.tsx  -> Camera capture + review grid + submit
```

Linear flow (carried from requirements, fixed to live backend): **Login → Select
Exam → Select Student → Capture/Upload → Submit**.

### 5.2 Capture → compress → enqueue → upload pipeline

```
[expo-camera capture / image-picker / PDF pick]
        |
        v
[expo-image-manipulator]  resize max 1920px, JPEG ~85%   (matches requirements NFR)
        |
        v
[persist to FileSystem.documentDirectory + enqueue job in SQLite]   <-- DURABLE (survives app kill)
        |  job: { id, tenantId, examId, studentId, classId, localUris[], status, attempts }
        v
[NetInfo online?] --no--> stay 'pending', show in queue.tsx
        | yes
        v
[upload compressed images to Storage  tenants/{tenantId}/answer-sheets/{examId}/{studentId}/...]
        |
        v
[client.uploadAnswerSheets({ tenantId, examId, studentId, classId, imagePaths[], uploadSource:'scanner' })]
   region asia-south1; server allocates submission ID & creates the doc
        |
   ok ----------------------> mark job 'done', remove local files
   already-exists ----------> surface "already submitted" toast, mark 'done' (server guard, B.4)
   failed-precondition -----> surface friendly error, mark 'failed' (retryable)
   network error -----------> backoff retry, keep 'pending'
```

- **Never writes the submission doc directly** and **never generates submission
  IDs** — both are server responsibilities the current rules enforce
  (`app-legacy-and-scanner.md` B.3, `auth-access.md` §1.5 submissions are
  CF-created).
- **`uploadSource: 'scanner'`** is the canonical, validated ingestion path; the
  divergent `onAnswerSheetUpload` GCS trigger is retired in the rebuild
  (`be-autograde` rebuild note). RN and web behave identically.
- Storage path is **tenant-scoped** and writable only by the owning scanner —
  this depends on the storage-rules hardening (`auth-access.md` §5.4); the
  scanner is the concrete reason to fix the wide-open `storage.rules`.

### 5.3 Auth & feature gating

- Login resolves tenant code → membership with `role === 'scanner'` (or
  staff/teacher with upload permission), `status === 'active'`; gate the whole
  app on `tenant.features.scannerAppEnabled` (`app-legacy-and-scanner.md` C.10).
  Reuse the shared `auth-store` school-code login; do **not** store raw
  credentials (use `expo-secure-store` for the Firebase token only).
- **Scanner-role model must be unified first** (`auth-access.md` §4.3): pick
  tenant-subcollection `/tenants/{t}/scanners/{id}` with `authUid` + matching
  rule. The mobile app reads its own scanner doc by `authUid`.

### 5.4 Offline-durable queue (the differentiator)

- SQLite-backed job table + files in `documentDirectory` survive app
  termination, reboot, and poor connectivity — exactly the schools-with-bad-wifi
  case (`app-legacy-and-scanner.md` B.5).
- Background sync via `expo-task-manager` / `expo-background-fetch` retries
  pending jobs.
- Idempotency: the server's duplicate-submission guard (`already-exists`) plus
  an optional client idempotency key on `uploadAnswerSheets` makes retries safe
  (`api-layer.md` §5; `be-autograde` idempotency note).
- This queue concept also primes a future RN-only consumer of a REST transport
  (`app-legacy-and-scanner.md` C.11).

---

## 6. `mobile-teacher` — spec (P1, review-first)

Authoring (ItemEditor god component) is **deliberately web-first**. Mobile
teacher focuses on **monitor + grade + light edits**, the things teachers do
away from a desk.

### 6.1 Navigation

```
app/
  (auth)/login.tsx
  (tabs)/
    index.tsx     -> Dashboard (exam status, needs-review counts, at-risk students)
    exams.tsx     -> Exams (status, submission counts)
    classes.tsx   -> Classes / students glance
    notifications.tsx
  exam/[examId]/
    submissions.tsx                 -> Submissions list (filter: needs_review)
    submissions/[submissionId].tsx  -> Grading review (the marquee mobile screen)
  space/[spaceId]/index.tsx         -> Read-only space overview + light status edits (publish/archive)
```

### 6.2 Grading review on mobile (reuses `teacher-core/useGradingReview` state machine)

- Live `SubmissionsRepo.watch` + `watchQuestions` (onSnapshot today, behind the
  repo interface).
- AI confidence bars, rubric breakdown, override audit timeline, needs-review
  filter/sort — same data, native presentation.
- Web keyboard nav (`j/k/Enter/a/o`) maps to **swipe + tap gestures** (swipe
  next/prev question, tap-accept, long-press-override, prev/next submission).
- **All grading actions go through `gradeQuestion`**
  (`mode: 'ai'|'manual'|'retry'`) so `submission.summary` recomputes server-side
  — fixing the web bulk-approve `writeBatch` bypass (`app-teacher-web.md` §4)
  for mobile from day one.
- Image resolution: the rebuilt contract persists resolvable HTTPS URLs (or
  `{path,url}`) for `mapping.imageUrls`, so mobile doesn't reimplement
  `getDownloadURL` (`app-teacher-web.md` §4 image-URL contract).

### 6.3 Light editing only

- Publish/archive a space, edit exam metadata, edit a single item's text — all
  via the same `saveSpace`/`saveExam`/`saveItem` callables with the
  `answerKeyLooksStripped` guard. Full multi-type authoring redirects to "open
  on web."

---

## 7. Push notifications (cross-app)

The web apps use in-app `NotificationBell` + Firestore `notifications` + RTDB
badge state (`be-analytics` dual-write fan-out). Mobile adds true push.

### 7.1 Architecture

```
Server side (functions/analytics notification-sender, the single fan-out point post-rebuild):
  on event (assignment, results released, at-risk, grading complete, ai_budget_alert):
    1. write tenants/{t}/notifications/{id}            (existing, in-app feed)
    2. update RTDB unreadCount/latest                  (existing, badge)
    3. NEW: lookup device push tokens for recipient -> send via Expo Push / FCM
```

- **Device token registration**: on login, `mobile-*` registers its Expo push
  token via a new `registerDeviceToken` callable (or a `manageNotifications`
  action) storing `tenants/{t}/users/{uid}/devices/{token}` (CF-only write,
  mirrors existing notification security). Token removed on logout.
- **Delivery**: Expo Push Service (wraps FCM/APNs) for managed Expo; or
  `@react-native-firebase/messaging` (FCM) directly for bare. Use FCM data
  messages with a `route` field so tapping a notification deep-links via Expo
  Router (`/exam/{id}/submissions/{subId}`, `/exams/{id}/results`).
- **Honesty fix carried over**: the rebuild wires `ai_budget_alert` and at-risk
  notifications that currently only `console.warn` (`be-analytics` §painPoints)
  — mobile push makes these actually actionable.
- **Preferences**: reuse
  `useNotificationPreferences`/`useSaveNotificationPreferences` (promoted to
  shared per `app-student-web.md` §5.5) plus a per-device OS-permission gate.

### 7.2 Notification types → target app

| Notification                               | Student | Teacher   | Scanner | Parent (P2) |
| ------------------------------------------ | ------- | --------- | ------- | ----------- |
| Assignment / new content                   | ✓       | —         | —       | ✓           |
| Exam results released                      | ✓       | —         | —       | ✓           |
| Streak / achievement                       | ✓       | —         | —       | —           |
| Submission needs review / grading complete | —       | ✓         | —       | —           |
| At-risk student detected                   | —       | ✓         | —       | ✓           |
| Upload failed / retry succeeded            | —       | —         | ✓       | —           |
| AI budget alert                            | —       | ✓ (admin) | —       | —           |

---

## 8. Shared cross-platform design language

`shared-ui` stays web-only (Radix/shadcn). Mobile gets `@levelup/ui-native`, but
**both consume the same tokens** so the platform looks like one product
(`shared-packages.md` §5.7).

### 8.1 Token flow

```
@levelup/design-tokens   (framework-neutral TS/JSON: HSL colors, spacing, radii, fontSize, z, shadows)
   |                                   |
   v                                   v
tailwind-config (web: theme.js)    NativeWind/RN theme (mobile)
   |                                   |
   v                                   v
shared-ui (Radix composites)       ui-native (RN composites: 1:1 names)
```

- Promote the existing `tailwind-config/theme.js` HSL tokens into
  `design-tokens` (the single source); auto-generate the Tailwind safelist
  (kills the hand-maintained drift in `shared-packages.md` §4.8).
- Tenant branding: the web injects CSS custom properties via
  `useTenantBranding`; RN applies the same `tenant.branding` colors through a
  `ThemeProvider` reading the `tenant-store`. One branding source, two appliers.

### 8.2 `ui-native` component parity (initial set)

Mirror the names teachers/students already see on web so the mental model
transfers:
`Button, Card, Badge, Input, Select, Sheet (=Dialog), Tabs, Avatar, Toast (sonner→native), AppShell→TabLayout, ScoreCard, ProgressRing, AtRiskBadge, SimpleBarChart (victory-native), LevelBadge, StreakWidget, AchievementBadge, MarkdownWithMath (native math renderer), QuestionAnswerer set (15), MaterialViewer, NotificationBell→header badge, RoleSwitcher, OrgSwitcher`.

- **Content renderer**: the rebuild picks ONE canonical content format (portable
  Markdown-with-math, per `app-teacher-web.md` §5.3). Mobile uses a single
  shared renderer (KaTeX via WebView or `react-native-math-view`), so authoring
  preview (web), student view (web + RN), and grading view (web + RN) are
  byte-identical. This retires the TipTap-HTML vs Markdown+KaTeX split and
  shrinks `preprocessMath` to a migration shim.

---

## 9. Shared-logic reuse matrix (what each package gives mobile)

| Package                     | Reused by           | Notes                                                                              |
| --------------------------- | ------------------- | ---------------------------------------------------------------------------------- |
| `shared-types`              | all                 | unchanged, platform-neutral source of truth                                        |
| `api-contract` (new)        | all + functions     | Zod schemas + types + registry                                                     |
| `api-client` (new)          | all                 | `createCallableClient(transport)` + repositories; RN injects RN-Firebase transport |
| `shared-utils`              | all                 | pure (csv/pdf/validation/format/date); one `timestamp→epoch-ms` util               |
| `shared-stores`             | all                 | auth/tenant/ui/consumer Zustand; auth-store multi-tenant switch reused verbatim    |
| `shared-hooks-core` (split) | all                 | TanStack Query hooks over repositories — no DOM                                    |
| `shared-hooks-web` (split)  | web only            | `useMediaQuery`, `useClickOutside`, etc.                                           |
| `learner-core` (new)        | student             | test-runner SM, timer, adaptive engine, progress agg                               |
| `teacher-core` (new)        | teacher             | grading-review SM, per-type `validateItem` registry                                |
| `evaluation-engine` (new)   | student + functions | single deterministic auto-evaluator (no drift)                                     |
| `design-tokens` (new)       | web + mobile        | feeds Tailwind + NativeWind                                                        |
| `ui-native` (new)           | mobile              | RN components mapped to `shared-ui` names                                          |

---

## 10. Auth & security on mobile (reuse + the prerequisites it forces)

- **Login**: school-code two-step (student/teacher/scanner) and consumer email
  (student B2C) via the shared `auth-store`. Token stored in
  `expo-secure-store`; never store credentials.
- **Claims & tenant switch**: `switchActiveTenant` + forced `getIdToken(true)`
  works identically; RN listens to the same `auth-store` selectors
  (`useUserRole`, `useCurrentTenantId`, `useIsConsumer`).
- **Mobile is the forcing function for these `auth-access.md` fixes** (must land
  before/with mobile):
  1. **Storage rules hardened** to per-path tenant + role + ownership — scanner
     uploads writable only by owning scanner (§5.4). Today's
     `if request.auth != null` blanket is unacceptable for a public-store mobile
     app.
  2. **Scanner role unified** under one model with `authUid` + matching rule
     (§5.6).
  3. **`tenantId` derived from claims** server-side rather than passed in every
     request body (`api-layer.md` §5.5) — shrinks mobile payloads and removes
     wrong-tenant bugs.
  4. **Token revocation** on deactivate/role-change so a stolen/old mobile token
     can't linger ~1h (§5.5).

---

## 11. Diagram — request path (one path, two platforms)

```
   ┌────────────────────────┐         ┌────────────────────────┐
   │  WEB (Vite/React)      │         │  MOBILE (Expo/RN)      │
   │  shared-ui + hooks-web │         │  ui-native + hooks-core│
   └───────────┬────────────┘         └───────────┬────────────┘
               │ same headless logic (learner-core / teacher-core / evaluation-engine)
               ▼                                   ▼
        ┌──────────────────────  @levelup/api-client  ──────────────────────┐
        │  repositories (intent-level) + createCallableClient(registry, T)  │
        └───────────┬───────────────────────────────────────┬──────────────┘
       web transport│ httpsCallable                  RN transport│ rnfirebase/functions (or HTTPS)
                    ▼                                            ▼
        ┌───────────────────────  Cloud Functions (asia-south1)  ───────────────────┐
        │ auth → parseRequest(Zod) → authorize → rate-limit → mutate → side-effects  │
        │ (one trust boundary, one validation path, one rate limiter for web + RN)   │
        └───────────────────────────────────────────────────────────────────────────┘
                    │ Firestore (tenant-scoped) + RTDB (realtime) + Storage + Secret Manager
                    ▼
        firestore.rules / storage.rules / database.rules.json  (defense-in-depth only)
```

---

## 12. Migration notes (from current code to mobile-ready)

Mobile cannot be built on the current web code as-is; it depends on the seams
the web rebuild creates. Order of operations:

1. **Extract `api-contract` + `api-client` first.** Consolidate the scattered
   inline request types (`api-layer.md` §4.1) and the duplicated `getCallable`
   factory into the registry + injectable transport. Web migrates to the typed
   client; mobile then reuses it for free. _Without this, mobile would
   re-duplicate Firestore paths — the exact mistake to avoid._
2. **Split `shared-hooks`** into headless (`-core`, RN-safe) and web (`-web`,
   DOM). Move data hooks onto repositories; delete the local
   `apps/student-web/src/hooks` duplicates (`app-student-web.md` §4 "Duplicate
   hooks").
3. **Extract `learner-core`, `teacher-core`, `evaluation-engine`** out of the
   God components (`TimedTestPage` ~1340, `StoryPointViewerPage`, `ItemEditor`
   ~2700, `GradingReviewPage` ~1330). The deterministic evaluator becomes one
   package imported by client and server (kills scoring drift).
4. **Promote `design-tokens`** from `tailwind-config/theme.js`; stand up
   `ui-native` mapped to `shared-ui` names.
5. **Land the auth/storage prerequisites** (§10): harden `storage.rules`, unify
   scanner role, derive tenantId from claims, add token revocation.
6. **Normalize the content format** to one renderer (Markdown-with-math) so RN
   reuses the same content pipeline; reduce `preprocessMath` to a migration
   shim.
7. **Pick canonical paths server-side**: nested `storyPoints/{id}/items` only,
   single submission-pipeline status taxonomy, resolvable image URLs — so the
   repository layer mobile consumes is clean (no legacy flat-path fallbacks).
8. **Scaffold the apps**: `apps/mobile-student` (P0), `apps/mobile-scanner`
   (P0), `apps/mobile-teacher` (P1) with Expo Router + EAS. Reconcile the stale
   scanner requirements doc against the live backend (`tenants/` paths,
   `asia-south1`, `published`/`grading` exam statuses, server-created
   submissions — `app-legacy-and-scanner.md` B.3 table).
9. **Wire push**: add `registerDeviceToken`, extend `notification-sender` to fan
   out to Expo Push/FCM, deep-link routes.
10. **Test harness**: reuse the data-testid/page-object discipline; add Detox or
    Maestro e2e for mobile mirroring the Playwright journeys (`testing-infra.md`
    rebuild note on RN-reusable page objects). Unit-test the shared
    `learner-core`/`evaluation-engine`/`teacher-core` once (covers web +
    mobile).

**Net result:** student and scanner mobile apps ship on the same API, same
domain model, same design tokens, and the same server invariants as web — mobile
is additive surface, not a parallel codebase.
