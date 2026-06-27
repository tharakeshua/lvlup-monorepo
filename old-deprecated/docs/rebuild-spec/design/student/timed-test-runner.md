# Screen Spec — Timed Test: Runner

> Conforms to **Lyceum / Direction A "Modern Scholarly"**
> (`docs/rebuild-spec/design/00-FOUNDATION.md`). All tokens cited by semantic
> name; never re-pasted. Student register: **steady, low-anxiety, focused** —
> kind in framing, precise where it counts (timer, scores).

---

## 1. Purpose & primary user

**Primary user:** a learner (role `student` in a B2B tenant, or a B2C consumer
from `platform_public`) actively taking a timed assessment.

**Job-to-be-done:** _"Give me a calm, distraction-free space to answer one
question at a time against a trustworthy clock, let me move freely between
questions and flag the ones I want to revisit, and let me submit with confidence
that nothing I answered was lost — without ever making me anxious about whether
the timer is cheating me."_

This is the **`test` state** of the timed-test state machine (the `landing` and
`results` states are separate specs). The screen exists only while a
server-authoritative session is active. It is the single most consequential
learner surface — scoring and timing integrity depend on it — so the design
optimizes for **trust, focus, and zero accidental data loss**, not delight.
There is intentionally **no celebratory motion** here.

---

## 2. Entry points & route

**Route:** `/spaces/:spaceId/test/:storyPointId` (state `test`). Same route
serves B2C via `LearnerContext` (data source `platform_public` vs tenant) — no
path divergence.

**Entry points:**

- From the **Timed Test landing** (`landing` state of the same route) when the
  learner presses _Begin_ (fresh start) or _Resume_ (an in-progress session).
- Direct navigation / refresh mid-test resumes the active session (server
  returns the live `DigitalTestSession`).

**Reads/writes via `@levelup/api-client` (FOUNDATION §5 rule: UI never touches
Firestore):**

| Action                  | Callable / repo                                                               | Notes                                                                                                                               |
| ----------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Start or resume session | `v1.levelup.startTestSession`                                                 | Returns `DigitalTestSession` incl. `serverDeadline`, `markedForReview`, prior `answers`, `adaptiveState`. Idempotent resume.        |
| Best-effort answer save | `v1.levelup.recordItemAttempt` (session-mode)                                 | Per-question save on _Save & Next_ and before submit. Optimistic; failure is silent-but-retried, never blocks.                      |
| Submit                  | `v1.levelup.submitTestSession`                                                | `{ autoSubmitted: boolean, idempotencyKey }`. Server reconciles auto-submit + 30s grace; concurrent-submit guarded client + server. |
| Server clock            | `realtime.subscribe('serverTimeOffset')`                                      | RTDB `.info/serverTimeOffset` via the `subscribe(name,params,cb)` realtime seam — corrects client clock skew.                       |
| Next-question selection | `updateAdaptiveState` / `selectNextQuestion` (shared `@levelup/learner-core`) | Client-side adaptive ordering when `adaptiveConfig` enabled; pure functions, RN-reusable.                                           |

All responses Zod-validated; `serverDeadline` normalized to epoch-ms at the repo
edge (no `Timestamp.seconds` casts — the status report's
`as unknown as { seconds }` debt is removed). Logic lives in headless
**`useTestRunner`** (session state machine, answers, statuses, adaptive, submit
orchestration) + **`useTestTimer`** (offset-corrected remaining time,
auto-submit trigger), decomposed from the 1340-line `TimedTestPage`.

---

## 3. Layout — wireframe-as-text (references AppShell)

This screen runs in a **focus shell**: `AppShell` chrome is suppressed (no
Sidebar, no Topbar tenant-switcher, no notification bell) to remove distraction
and exit temptation. Only a minimal sticky top band (`TestRunnerShell` header)
remains. `CommandPalette` (⌘K) is disabled while a test is live.

```
┌───────────────────────────────────────────────────────────────────────────┐
│ TimerBar (sticky, full-width, z=sticky)                                     │
│  ◀ [Story-point title · Q 7 of 20]        ⏱ 24:13 remaining   [ Submit ]    │
│     (no back-to-app; "Exit" is a guarded confirm, de-emphasized)            │
├──────────────────────────────────────────────┬────────────────────────────┤
│                                              │  QuestionNavigator (panel)  │
│  QuestionCard  (one question at a time)      │  Section: Algebra           │
│   ┌────────────────────────────────────────┐ │   ┌──┬──┬──┬──┬──┐          │
│   │ Q7 · Multiple choice · Medium          │ │   │1●│2◑│3○│4◆│5◈│          │
│   │ ContentRenderer (md + KaTeX)           │ │   ├──┼──┼──┼──┼──┤          │
│   │                                        │ │   │6○│7▣│… │  │  │          │
│   │ AnswerInput (dispatched by type)       │ │   └──┴──┴──┴──┴──┘          │
│   └────────────────────────────────────────┘ │  Legend (icon+label+color)  │
│                                              │   ● Answered  ◑ Marked       │
│  [ Mark for review ]      [ Save & Next ▸ ]  │   ◈ Answered+Marked          │
│                                              │   ○ Not answered  ○ Not seen │
│                                              │  ── status counts ──        │
│                                              │   Answered 5 · Marked 2 …    │
└──────────────────────────────────────────────┴────────────────────────────┘
```

**Grid & responsive (FOUNDATION §4 breakpoints, page gutters 16/24/32):**

- **lg ≥ 1024:** two-column. Question column max reading width
  ~720ch-equivalent, centered in its track; `QuestionNavigator` is a persistent
  right rail (~280–320px). TimerBar spans full width, sticky top.
- **md 768–1023:** single column. `QuestionNavigator` collapses into a
  **Drawer/Sheet** opened by a "Questions (7/20)" pill in the TimerBar; the live
  status-summary count stays inline in the bar.
- **sm < 768:** single column, full-bleed question. TimerBar compresses to
  `⏱ time · Q7/20 · ☰`; navigator is a bottom **Sheet**. Action buttons
  (`Mark`, `Save & Next`) become a sticky bottom action bar with ≥44px touch
  targets. No mobile bottom Tabbar here (focus mode).

---

## 4. Components used (FOUNDATION §5 only)

**Domain:** `TestRunnerShell` (the focus-mode wrapper), `TimerBar`
(server-authoritative countdown), `QuestionCard` (dispatch over 15 types),
`AnswerInput` (per-type input), `ContentRenderer` (md + KaTeX question
stem/options), `AnswerKeyLock` (used as the legibility marker that correctness
is sealed — see §8).

**Primitives / containers / feedback:** Button (`primary` = Save & Next;
`ghost`/`secondary` = Mark for review; `danger`-toned but de-emphasized Exit),
IconButton, `Drawer/Sheet` (mobile navigator), `ConfirmDialog` (submit + exit),
`InlineAlert/Banner` (low-time warning, save-failure retry notice), `Tooltip`
(navigator legend on hover/focus), `Badge`/`Chip` (difficulty, question-type),
Toast (sonner — non-blocking "answer saved/retrying").

**QuestionNavigator** is a `TestRunnerShell` sub-region built from a grid of
status nodes. It maps onto the FOUNDATION node-grid pattern but the **NTA-style
5-status taxonomy** is timed-test-specific.

> **Proposed FOUNDATION additions** (call out for promotion, do not silently
> invent):
>
> 1. **`QuestionNavigator`** — the NTA-style status grid (`not_visited` /
>    `not_answered` / `answered` / `marked_for_review` / `answered_and_marked`)
>    with per-status icon+color+label and live counts. It is distinct from
>    `StoryPointTrack` (a learning path) and reusable across timed-test +
>    practice. Add to §5 domain components with the canonical 5-status token
>    mapping below.
> 2. **`LowTimeBanner`** state on `TimerBar` — a defined low-time variant
>    (icon + text + status.warning, escalating to status.error) so the warning
>    is a system token, not a one-off. Recommend folding into `TimerBar`'s spec
>    as a documented state rather than a new component.

**Navigator status → token mapping (proposed canonical):**

| Status                | Glyph (icon, never color alone)                       | Color token                                | Label                 |
| --------------------- | ----------------------------------------------------- | ------------------------------------------ | --------------------- |
| `not_visited`         | hollow ring                                           | `border.strong` (neutral)                  | "Not seen"            |
| `not_answered`        | hollow ring, filled outline                           | `text.muted`                               | "Not answered"        |
| `answered`            | filled dot ●                                          | `status.success`                           | "Answered"            |
| `marked_for_review`   | flag ◑                                                | `status.info`                              | "Marked for review"   |
| `answered_and_marked` | flag + dot ◈                                          | `status.info` ring + `status.success` core | "Answered & marked"   |
| current question      | thick `border.focus` ring overlay on any of the above | `border.focus`                             | (announced "current") |

---

## 5. States

- **Loading (start/resume):** `TestRunnerShell` skeleton — TimerBar shows a
  Skeleton time chip (no fake ticking number), QuestionCard a Skeleton block,
  navigator a Skeleton grid. Copy: _"Setting up your test…"_. The timer renders
  **only after `serverDeadline` + first `serverTimeOffset` sample arrive** —
  never a client-guessed countdown.
- **Active (success / primary state):** one `QuestionCard` + live `TimerBar` +
  populated navigator. Per-question timer accrues silently.
- **Saving (partial):** a `recordItemAttempt` in flight — a subtle "Saving…"
  affordance near _Save & Next_ (text + spinner, not a blocking overlay);
  navigation is never blocked on a save.
- **Save failure (partial / degraded):** save retried in background; if still
  failing, a quiet `InlineAlert` (status.warning) near the action bar: _"We're
  having trouble saving the last answer. We'll keep retrying — your work isn't
  lost."_ Submit still flushes all answers server-side; the failure never
  strands the learner.
- **Low-time warning (escalating success→warning→error):** at a config threshold
  (e.g. ≤5 min → `status.warning`, ≤1 min → `status.error`), `TimerBar` switches
  to `LowTimeBanner` variant: icon + **text** + color. A
  `RouteAnnouncer`/aria-live announcement fires once per threshold crossing.
- **Auto-submit (timeout):** when offset-corrected remaining hits 0,
  `useTestTimer` triggers a single submit with `autoSubmitted: true`. UI shows a
  non-dismissible `InlineAlert`: _"Time's up — we're submitting your answers
  now."_ Spinner; navigation locked. Result is **server-reconciled** (30s grace;
  scheduler reaps if the client never fires).
- **Submitting (manual):** `ConfirmDialog` → on confirm, button enters loading,
  answers flush, then route advances to `results`. Concurrent manual+auto submit
  is guarded (idempotent + client ref).
- **Empty:** not applicable — a session always has questions. If a session has
  zero deliverable items (data fault), show `ErrorState`: _"This test couldn't
  load its questions. Please contact your teacher — your time hasn't started."_
  and do **not** start the clock.
- **Error (start/submit fails):** `ErrorState` with retry. Submit-failed keeps
  the learner in `test` state with answers intact and a retry CTA — never
  silently drops to results.
- **Role-gated:** identical for B2B student and B2C consumer (data source
  differs upstream via `LearnerContext`; the runner UI is the same). No
  teacher/admin variant — this surface is learner-only.

---

## 6. Interactions & motion (cite motion tokens; subtle only)

**Key flows:**

- **Answer a question:** input via `AnswerInput`; on first interaction the
  status flips `not_visited`→`not_answered` (optimistic, local). On _Save &
  Next_: persist via `recordItemAttempt` (optimistic — UI advances immediately),
  status →`answered` / `answered_and_marked`, then `selectNextQuestion`
  (adaptive) or sequential next. Transition between questions: `motion.fast`
  (160ms) cross-fade/slide using `ease.standard` — felt, not flashy.
- **Mark for review:** toggles `marked_for_review`↔`not_answered` (or
  `answered_and_marked`↔`answered`). Navigator node updates instantly
  (`motion.instant` 100ms color/icon swap).
- **Navigator jump:** clicking a node moves to that question (`motion.fast`);
  current-question focus ring animates in with `ease.entrance`.
- **Low-time threshold:** `TimerBar`→`LowTimeBanner` transition uses
  `motion.base` (220ms) color shift — deliberate, calm, **not** a
  flashing/pulsing alarm (anxiety-reducing). No celebratory spark.
- **Submit:** `Button` → `ConfirmDialog` (`e3` elevation, `motion.base`
  entrance). Confirm → loading state → route to results (`motion.page` 420ms).

**Optimistic updates & guards:** status changes and navigation are optimistic
and local; the authoritative answer set is reconciled server-side at submit.
`recordItemAttempt` carries an `idempotencyKey`; the submit path is guarded by
both a client `isSubmitting` ref and server idempotency so a manual+auto race
produces one submission.

**No celebration:** per the global gamification rule, `CelebrationBurst` / spark
pop is **forbidden** in the runner — celebration belongs only to the post-submit
results/XP moment. Respect `prefers-reduced-motion`: cross-fades become instant
cuts; the low-time color shift remains (it carries meaning) but with no animated
transition.

---

## 7. Content & copy (warm, steady, low-anxiety)

- **TimerBar:** `⏱ 24:13 remaining` (mono / `Spline Sans Mono`, tabular). Label
  _"remaining"_, never _"left"_ with red urgency. Position indicator: _"Question
  7 of 20"_.
- **Low-time (≤5 min):** _"5 minutes remaining — finish strong."_
  (status.warning, supportive not punitive).
- **Low-time (≤1 min):** _"Under a minute left. Anything you've entered is
  already being saved."_ (status.error color, but reassuring text).
- **Save & Next button:** "Save & Next" (primary). On last question: "Save &
  Review" (returns to navigator, not auto-submit).
- **Mark for review:** "Mark for review" / when set: "Marked — I'll come back"
  (toggle label).
- **Saving affordance:** "Saving…" → silent on success (no toast spam). Retry:
  _"Still saving in the background — your work is safe."_
- **Submit ConfirmDialog:**
  - Title: _"Ready to submit?"_
  - Body: _"You've answered 17 of 20 questions. 2 are marked for review. Once
    you submit, the test is final and we'll score it for you."_ (dynamic counts;
    states the marked + unanswered honestly without scolding).
  - Confirm: "Submit test" · Cancel: "Keep working"
- **Auto-submit notice:** _"Time's up — we're submitting your answers now. Hang
  tight."_
- **Exit attempt ConfirmDialog:** _"Leave the test? Your timer keeps running
  while you're away, and your answers stay saved."_ — Confirm "Leave" / Cancel
  "Stay". (Honest: the clock is server-authoritative and does not pause.)
- **Save-failure inline:** _"We're having trouble saving your last answer, so
  we'll keep retrying. Your work isn't lost."_
- **Load error:** _"This test couldn't load its questions. Reach out to your
  teacher — your time hasn't started."_

Headings in `Fraunces` (dialog titles); body/labels in `Schibsted Grotesk`; all
time/counts in `Spline Sans Mono`.

---

## 8. Domain rules surfaced

- **TIMER IS SERVER-AUTHORITATIVE (critical).** The countdown shown is derived
  from `serverDeadline` (computed server-side) corrected by RTDB
  `.info/serverTimeOffset` — the **client clock never decides expiry**. The UI
  never renders a timer before the first offset sample. Auto-submit at zero is a
  _request_; the server reconciles it against a **30s grace** window, and a
  scheduler reaps abandoned/expired sessions if the client never fires. Make
  this legible in copy ("your timer keeps running", "already being saved") so
  the learner trusts (and cannot game) the clock. Refresh/resume reads the same
  `serverDeadline` — no client-side time is trusted across reloads.
- **ANSWER-KEY IS NEVER SHOWN (critical).** During the test there is **zero
  correctness feedback** — no right/wrong coloring on options, no score, no
  explanation. The answer key lives in the server-only `answerKeys`
  subcollection that `firestore.rules` denies to all clients; the client
  physically cannot read it. Adaptive next-question selection runs on
  `adaptiveState` (difficulty signals), **not** on revealed correctness to the
  learner. Use the **`AnswerKeyLock`** marker where the absence of answers must
  be made legible (e.g. a small "Answers are sealed until you submit" affordance
  in the shell / submit dialog), so the sealed state reads as _intentional and
  fair_, not as missing UI. Post-submission feedback/rubric is a separate
  `results` spec.
- **Best-effort save + concurrent-submit guard.** Every _Save & Next_ and the
  submit flush persist via `recordItemAttempt`/`submitTestSession` idempotently;
  a client `isSubmitting` ref + server idempotency prevent double submission
  from a manual+auto race.
- **Tenant / consumer isolation.** Session, items, and progress are read
  tenant-scoped (`tenants/{tenantId}/…`) for B2B, or from `platform_public` +
  `consumerProfile` for B2C — abstracted by `LearnerContext`; the runner UI is
  identical.
- **Per-question time tracking** is recorded (accrues on the active question)
  and submitted with the session for later analytics — surfaced to the learner
  only post-results, never as live pressure.

---

## 9. Accessibility

- **Focus order:** TimerBar (Submit reachable, but not first-focus to avoid
  accidental submit) → QuestionCard stem (`ContentRenderer` output, readable) →
  `AnswerInput` controls → Mark for review → Save & Next → QuestionNavigator
  grid. On question change, focus moves to the new question heading (announced)
  — not lost to top of page.
- **Keyboard:** full operation without a mouse. Navigator grid is a
  roving-tabindex 2D grid (arrow keys move between question nodes, Enter jumps).
  `AnswerInput` types follow their native keyboard semantics (radio group arrows
  for MCQ, etc.). Shortcuts kept discoverable but optional: `n` Save & Next, `m`
  Mark for review (documented in a `?` Tooltip); never the _only_ path.
- **ARIA:** `TimerBar` is `role="timer"` with `aria-live="off"` for the constant
  tick (avoid spamming SR) but fires a **polite** `aria-live` announcement once
  at each low-time threshold and at auto-submit. Each navigator node has
  `aria-label` like _"Question 7, answered and marked for review, current
  question"_. Submit/exit dialogs are proper `role="dialog"` with focus trap and
  labelled by their `Fraunces` title.
- **Contrast & never-color-alone:** all five navigator statuses pair an
  **icon/glyph + text label** (legend) with color (FOUNDATION §2 rule). Low-time
  warning is icon + text + color, never color alone. All pairs meet WCAG AA
  (4.5:1 body / 3:1 UI).
- **Reduced motion:** `prefers-reduced-motion` disables question cross-fades and
  the low-time color _transition_ (the final color still applies). No parallax,
  no pulsing alarms ever.
- **Low-anxiety a11y:** the timer is announced supportively; the SR experience
  mirrors the visible calm tone.

---

## 10. Web ↔ mobile divergence (FOUNDATION §6)

- **Navigator:** web = persistent right-rail grid (lg) / Drawer (md). Mobile (RN
  learner app) = bottom **Sheet** invoked from the TimerBar; status counts stay
  inline in the bar so the learner sees progress without opening it.
- **Hover → press:** navigator legend Tooltips (hover/focus on web) become
  tap-to-reveal or always-visible legend on mobile; node press replaces node
  click.
- **⌘K / CommandPalette:** absent on mobile (and disabled on web during a live
  test) — no global nav escape hatch in focus mode.
- **Action buttons:** web inline under the QuestionCard; mobile = sticky bottom
  action bar (Mark / Save & Next) with ≥44px targets, safe-area-inset aware.
- **Focus shell:** mobile suppresses the bottom Tabbar entirely during a test
  (matches web's suppressed Sidebar/Topbar).
- **Component parity:** `TestRunnerShell`, `TimerBar`, `QuestionCard`,
  `AnswerInput`, `QuestionNavigator`, `ConfirmDialog` share names/props 1:1
  between `shared-ui` (web) and `ui-native` (mobile); `useTestRunner` +
  `useTestTimer` + the realtime `serverTimeOffset` subscription are headless and
  reused unchanged. Only the renderer (DOM vs RN) differs.

---

## 11. Claude-design prompt (ready to paste)

```
Design the "Timed Test — Runner" screen for the Auto-LevelUp STUDENT web app, conforming
strictly to the Lyceum design system (Direction A "Modern Scholarly") in
docs/rebuild-spec/design/00-FOUNDATION.md. Do NOT invent colors, fonts, spacing, radii,
shadows, motion, or component variants — compose only from FOUNDATION §2–§5 and cite tokens
by semantic name (bg.canvas, bg.surface, text.primary/secondary/muted, brand.primary, spark,
border.subtle/strong/focus, status.success/warning/info/error, radius.lg/md/pill, e1/e3,
motion.instant/fast/base/page, ease.standard/entrance). Fonts: Fraunces (display/dialog
titles), Schibsted Grotesk (UI/body/labels), Spline Sans Mono (timer + counts, tabular).

Build a FOCUS-MODE TestRunnerShell (suppress AppShell sidebar/topbar; ⌘K disabled). Regions:
1. Sticky full-width TimerBar: story-point title, "Question 7 of 20", a server-authoritative
   countdown in mono ("24:13 remaining"), and a de-emphasized Submit. The countdown is derived
   from a server deadline + clock-skew offset — render it ONLY after that data loads; never a
   client-guessed timer. Add a low-time variant (icon + TEXT + status.warning at ≤5min,
   status.error at ≤1min) with supportive, non-punitive copy. Never color alone.
2. One QuestionCard at a time (ContentRenderer md+KaTeX stem + AnswerInput dispatched by type),
   with difficulty/type Chips, and actions: a secondary "Mark for review" + a primary
   "Save & Next" (becomes "Save & Review" on the last question).
3. An NTA-style QuestionNavigator: a grid of status nodes with the 5-status taxonomy
   (not_visited / not_answered / answered / marked_for_review / answered_and_marked), each shown
   as ICON/GLYPH + COLOR + a legend with LABELS (status.success answered, status.info marked,
   neutral not-seen), plus live status counts and a focus ring on the current question.
   lg: persistent right rail. md: Drawer. sm: bottom Sheet with counts kept inline in TimerBar.

CRITICAL DOMAIN RULES TO HONOR:
- ANSWER KEY IS NEVER SHOWN. Zero correctness feedback during the test (no right/wrong colors,
  no score, no explanation). Use an AnswerKeyLock affordance ("Answers are sealed until you
  submit") so the sealed state reads as intentional and fair.
- TIMER IS SERVER-AUTHORITATIVE. Client clock never decides expiry; on timeout, show a calm
  "Time's up — submitting now" state (server reconciles a 30s grace). Exit confirm must say the
  timer keeps running.
- NO CELEBRATION. No spark burst / spring pop anywhere here — motion stays subtle (fast/base,
  ease.standard); respect prefers-reduced-motion.

States to render: loading skeleton (no fake ticking clock), active, saving (non-blocking),
save-failure InlineAlert ("we'll keep retrying — your work isn't lost"), low-time warning,
auto-submit, manual-submit ConfirmDialog ("Ready to submit? You've answered 17 of 20…
Once you submit it's final"). Tone: steady, encouraging, low-anxiety. WCAG AA, roving-tabindex
grid navigator, role="timer", polite aria-live only at thresholds, focus moves to the new
question on change. Output responsive web (Tailwind) at sm 640 / md 768 / lg 1024.
```

```

```
