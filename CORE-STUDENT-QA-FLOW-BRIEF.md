# Core Student Question & Answering Experience — Analysis Brief

**Scope:** The day-to-day learner loop — how a student opens a space, works
through questions, submits answers, and gets scored/rewarded. Read-only
analysis. No code changed.

**Author:** core-student-qa-analyzer (sess_1783164245740_g6imr7j3j) **Date:**
2026-07-04

---

## 1. The End-to-End Flow (plain English)

A learner moves through a nested hierarchy and every answer is graded **on the
server**, never on the device:

```
Space  ──►  Story Point  ──►  Item (question / material)  ──►  Answer  ──►  Evaluate  ──►  Feedback + Progress + XP
(subject)   (module/lesson)   (one question or reading)      (typed)     (SERVER)      (shown in app)
```

**Step by step:**

1. **Space** = a subject (e.g. "DSA", "System Design"). The student lands on
   **SpaceDetailScreen** (mobile) / spaces pages (web). It shows a hero with an
   XP meter + overall % progress, and a spine of **story point** nodes tagged as
   one of 4 kinds: `standard`, `timed_test`, `quiz`, `practice`.

2. **Story Point** = a module. Tapping a node routes by its `route` field:
   - `content` → **ContentViewerScreen** (mixed reading materials + questions,
     self-paced)
   - `practice` → **PracticeModeScreen** (one question at a time, instant
     feedback)
   - `test` → **TimedTestRunnerScreen** (sealed, server-timed exam)

3. **Item** = one question (or a material/reading). Questions carry a `payload`
   describing the question type + prompt. Materials are one of 7 kinds (`text`,
   `video`, `pdf`, `link`, `interactive`, `story`, `rich`) and are completed by
   "Mark as read."

4. **Answer** = the learner's input, captured by `question-view.tsx` (mobile) /
   the `*Answerer.tsx` components (web), shaped per question type (see §2).

5. **Evaluate** = the answer is sent to a **backend callable**:
   - Practice/content → `recordItemAttempt` (raw answer only; server scores +
     writes progress)
   - Test per-question → `saveTestAnswer` (write-through, no score) then
     `submitTestSession` (batch grade)
   - Free-form / media / preview → `evaluateAnswer` (returns full evaluation,
     can attach media) The **client never computes the authoritative score** —
     it sends the raw answer, the server grades against a server-only
     **AnswerKey** document and returns the verdict.

6. **Feedback + Progress + XP** = the server returns a `StoredEvaluation`
   `{ score, maxScore, correctness, percentage, strengths[], weaknesses[], missingConcepts[], summary? }`.
   The app shows a feedback banner/panel. Progress is persisted **in the same
   call** (no second round-trip). XP/levels/streaks live in a **separate
   gamification layer** surfaced via `useGamificationSummary` /
   `useStudentLevel` — it is NOT part of the evaluation response.

---

## 2. The 15 Question Types & How Answering Differs

The single source of truth is `QUESTION_TYPE_REGISTRY` in
`packages/domain/src/entities/content/question-types/registry.ts`. Everything
(the enum, the Zod unions, the auto-vs-AI lists) is derived from it. Each entry
carries
`{ prompt, answer, learnerAnswer, evaluation: "auto"|"ai", label, sample() }`.

**Auto-graded (deterministic, 9 types) — scored by exact/tolerant compare
against the answer key:**

| Type             | Learner answer shape                     | How answering works                           |
| ---------------- | ---------------------------------------- | --------------------------------------------- |
| `mcq`            | `{ selectedOptionIds: string[] }` (one)  | Tap one option (radio)                        |
| `mcaq`           | `{ selectedOptionIds: string[] }` (many) | Tap multiple (checkbox); set-equality compare |
| `true-false`     | `{ answer: boolean }`                    | Two buttons                                   |
| `numerical`      | `{ value: number }`                      | Number keyboard; compared within `tolerance`  |
| `fill-blanks`    | `{ answers: [{id,value}] }`              | One text input per blank                      |
| `fill-blanks-dd` | `{ answers: [{id,value}] }`              | Pick from a dropdown/chip pool per blank      |
| `matching`       | `{ matches: [{left,right}] }`            | Chip selector to pair left↔right              |
| `jumbled`        | `{ order: number[] }`                    | Reorder tokens (drag / up-down)               |
| `group-options`  | `{ assignments: [{itemId,group}] }`      | Assign each item to a category                |

**AI-graded (subjective, 6 types) — scored by the `@levelup/ai` Gemini gateway
against a rubric/model answer:**

| Type                  | Learner answer shape                 | How answering works                           |
| --------------------- | ------------------------------------ | --------------------------------------------- |
| `text`                | `{ text: string }` (+optional media) | Short text box                                |
| `paragraph`           | `{ text: string }` (+optional media) | Long textarea, word counter                   |
| `code`                | `{ code: string, language? }`        | Monospace editor, starter code, test cases    |
| `audio`               | `{ audioUrl: string }`               | **Record audio** → upload → path submitted    |
| `image_evaluation`    | `{ imageUrls: string[] }`            | **Capture/upload image(s)** → paths submitted |
| `chat_agent_question` | `{ transcript: [{role,content}] }`   | Multi-turn streaming chat, `maxTurns` limit   |

**Key facts:**

- The **AnswerKey** (`answer-key.ts`) is a server-only, deny-all document at
  `items/{itemId}/answerKeys/{keyId}` holding `correctAnswer` (type-specific),
  `acceptableAnswers?`, `evaluationGuidance?`, `modelAnswer?`. It is never sent
  to the device (except authoring-gated `getItemForEdit`). `McqOption.isCorrect`
  is stripped server-side into the key.
- **DP-3 deferral:** prompt schemas still carry answer-bearing fields
  (`isCorrect`, `correctAnswer`, `modelAnswer`…) today; the registry only
  re-homed them so a future strip is a one-place edit.

---

## 3. Where the Core Logic Lives — the Crux

Three layers, one hard rule: **grading authority is server-side.**

- **Backend (`packages/services` + `functions/sdk-v1`)** — the brain:
  - `evaluateAnswerService` / `recordItemAttemptService`
    (`packages/services/src/levelup/practice.ts`) and
    `start/submitTestSessionService` (`test-session.ts`).
  - `scoreOne()` (practice.ts) is the branch point: it normalizes the answer,
    resolves the question type, and routes:
    - `DETERMINISTIC_TYPES` → `autoEvaluateDeterministic()` (`grading.ts`) —
      exact/set/tolerance compare.
    - short-answer/fill-blank with a key → case-insensitive text compare.
    - everything else → **AI grader**
      (`ctx.ai.generate({ promptKey: "answerGrading" })`), with media attached
      as images.
  - All grading is **idempotent** (dedupe key on `uid+space+item+answerHash`),
    and progress is persisted in the same call.
  - **Cost stripping** (`stripEvaluationCost`) removes `costUsd`/`tokenUsage`
    before returning to the client.

- **SDK (`packages/query`, `packages/api-contract`, `packages/repositories`)** —
  the wire:
  - `api-contract` defines the strict Zod input/output for each callable.
  - `packages/query/src/testsession-progress` exposes the hooks
    (`useSpaceProgress`, `useStoryPointProgress`, `useTestSession(s)`,
    `recordAttempt`, `recordEvaluation`, `recordSubmit`) and does optimistic
    patching (bumps `attemptsCount` only — never invents a score; reconciles by
    writing the server's authoritative `{progress}` directly).
  - `packages/query/src/gamification` exposes XP/level/streak/leaderboard
    reads + realtime streams.

- **Apps (mobile-student, student-web)** — the hands:
  - Render the 15 types, capture the typed answer, call the SDK hooks, and
    display the returned evaluation. **No scoring logic** of authority. (Web has
    an _optional_ `autoEvaluateClient` for instant feedback on the 9
    deterministic types, but still persists via the server — the server verdict
    wins.)

**⚠️ CRUX RISK — question-type name divergence.** The domain registry uses
canonical hyphenated keys (`mcq`, `mcaq`, `true-false`, `numerical`,
`fill-blanks`, `jumbled`, `group-options`, `image_evaluation`,
`chat_agent_question`). The backend's `DETERMINISTIC_TYPES` set uses a
_different_ vocabulary (`multiple_choice`, `multi_select`, `true_false`,
`numeric`, `fill_blank`, `ordering`). They are bridged only by a
`normalizeQuestionType()` shim in `scoreOne`. Types like `jumbled`→`ordering`,
`mcaq`→`multi_select`, `numerical`→`numeric` must all be mapped correctly or a
deterministic question silently falls through to the AI grader (or scores 0).
This is the highest-value thing to audit for correctness.

---

## 4. Media-Answer Path & the "Captured-but-not-evaluated" Gap

**The path (fully built on both capture and evaluation ends):**

1. Learner records audio (`expo-av` / browser `getUserMedia`) or picks/takes a
   photo (`expo-image-picker` / file input).
2. The app uploads via the SDK storage seam (`useMediaUpload` →
   `storageRepo.uploadImage`, kind `answer-sheet`), which returns a
   **tenant-scoped storage PATH** (`tenants/{tenantId}/…`), not a URL.
3. The answer value becomes `{ text, mediaUrls: string[] }` (plain string when
   no media — backward compatible).
4. Backend `scoreOne` filters paths to the tenant prefix, maps them to
   `{ base64: path, mimeType }` via `guessMediaMime`, and **attaches them to the
   AI grader call** with a prompt nudge ("the learner also attached N media
   file(s)"). So media _is_ genuinely graded when it reaches the grader.

**The gap (Issue4b — partially resolved, still inconsistent):**

- `evaluateAnswer` accepts a **top-level `mediaUrls`** field. But media rides
  _inside_ the answer object (`answer.mediaUrls`) from the UI.
- **TimedTestRunnerScreen** (mobile) explicitly **lifts** `answer.mediaUrls` →
  top-level `mediaUrls` before calling evaluate. ✅
- **PracticeModeScreen** and **ContentViewerScreen** (mobile) do **NOT** lift it
  — they rely on the server unwrapping `answer.mediaUrls` inside `scoreOne`. The
  server _does_ have that fallback today, so it works, but the two runners are
  inconsistent and the reliance is implicit/fragile (a code comment at
  `question-view.tsx:44-48` flags exactly this).
- No UI signal confirms "your image/audio was received and graded" — the
  feedback panel doesn't distinguish media-graded from text-graded results.
- **Net:** media is captured, uploaded, and evaluated end-to-end today, but the
  _submission plumbing_ is duplicated/uneven across runners and depends on a
  server fallback rather than a single explicit contract. Low correctness risk
  right now; real maintenance/regression risk.

---

## 5. Web vs Mobile Parity

**At parity:** All 15 question types have real, full UIs on **both** web
(`apps/student-web/src/components/questions/*Answerer.tsx`) and mobile
(`question-view.tsx`) — no placeholders on either. Both use the same
api-contract callables and server grading. Audio + image capture exist on both.

**Divergences:**

| Area                | Web                                                                                                            | Mobile                                                               | Note                                                                 |
| ------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Instant feedback    | `autoEvaluateClient` grades the 9 deterministic types client-side for snappy UX, then persists to server       | No client pre-eval; always round-trips                               | UX-only; server verdict authoritative on both                        |
| Media submit        | Uploads then sends `mediaUrls`                                                                                 | TimedTest lifts to top-level; Practice/Content rely on server unwrap | Mobile inconsistency (§4)                                            |
| Test answer save    | `useSaveAnswer()` write-through per question via `useApiClient()` escape hatch (no @levelup/query hook exists) | Same callable via same escape hatch                                  | Documented SDK gap: no first-class `saveTestAnswer` hook/repo method |
| Adaptive reordering | Client-side `updateAdaptiveState` / `selectNextQuestion` in TimedTestPage                                      | Not present inline                                                   | Web-only today                                                       |
| Keyboard nav        | Arrow keys / `m` to mark                                                                                       | Touch only                                                           | Platform-appropriate                                                 |
| Question navigator  | Sidebar (desktop) / sheet                                                                                      | Colored grid                                                         | Both present, different form                                         |

**Parity verdict:** Rendering + grading are at full parity. The gaps are in
_test-session ergonomics_ (adaptive selection, keyboard nav) and the _media-lift
consistency_, plus the missing first-class `saveTestAnswer` SDK hook (both
platforms reach through the escape hatch).

---

## 6. Risks / Rough Edges / What's Missing for Polish

**Correctness risks (highest first):**

1. **Question-type name divergence** (§3 crux) — registry keys vs backend
   `DETERMINISTIC_TYPES` bridged only by `normalizeQuestionType`. Any un-mapped
   alias → deterministic question mis-graded or dumped to AI. **Audit the
   normalization table against all 15 registry keys.**
2. **Media-lift inconsistency** (§4) — Practice/Content depend on the server's
   implicit `answer.mediaUrls` unwrap; TimedTest lifts explicitly. One refactor
   of the server fallback breaks two runners silently. Unify on one explicit
   contract.
3. **AI seam** (`ai.data` vs `ai.json`) — historically every AI-graded answer
   collapsed to zero because services read `ai.json` while the gateway returned
   `ai.data`. **Fixed** via the `aiSeam` result-adapter in
   `functions/sdk-v1/src/bootstrap.ts` (maps `res.data`→`json`). Keep this
   adapter under test; it's a load-bearing 10 lines with no compile-time guard
   (silenced by an `as unknown` cast).
4. **answerKey prefix bug** — `makeAnswerKeyRepo.get` previously used a bad
   `startsWith(tenantDoc+'/')` prefix that blocked grading under `v2_`.
   **Fixed** (SDK-coord, 2026-06-26) but worth a regression test.

**Rough edges / missing polish:**

- **No XP feedback at answer time.** Practice/feedback panels show score +
  correctness but _no earned-XP animation_; XP is only visible later via the
  gamification summary. A "+15 XP" moment on correct answers would tighten the
  reward loop.
- **No media-graded confirmation** in feedback UI.
- **Other item types** (`interactive`, `assessment`, `discussion`, `project`,
  `checkpoint`) render only an info-alert "best completed in the full activity
  view" + a Mark-complete button — no real interactive editor yet.
- **Media retry is manual** — no offline queue / auto-retry; a failed upload
  forces re-capture.
- **Answer history** shows past scores but "Try again" only resets the current
  attempt (doesn't reseed history cleanly).
- **DP-3 not done** — prompt schemas still ship answer-bearing fields
  (`correctAnswer`, `modelAnswer`, `isCorrect`) to the client for authoring
  types; the security strip is deferred. Verify learner-facing reads never
  receive these (they're supposed to be stripped into the server-only
  AnswerKey).
- **`saveTestAnswer` has no SDK hook** — both apps use the raw api-client escape
  hatch; a first-class hook would harden crash-resume.

**Bottom line:** The core loop is functionally complete and correctly
server-authoritative — all 15 types render and grade on both platforms, media
grades end-to-end, and the historically fatal AI/answerKey seams are fixed. The
remaining work is _hardening_ (unify the media-lift, audit the type-name
normalization, test the AI seam adapter) and _delight_ (XP-at-answer-time,
media-graded confirmation, real editors for the non-Q/material item types).
