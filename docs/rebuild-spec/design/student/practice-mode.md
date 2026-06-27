# Practice Mode — Student Web Design Spec

> Conforms to **Lyceum** (`docs/rebuild-spec/design/00-FOUNDATION.md`, Direction
> A — "Modern Scholarly"). Token, type, spacing, motion, and component names are
> cited by their FOUNDATION §2/§3/§4/§5 semantic names — never re-defined here.
> Student tone: relaxed, warm, repetition-friendly — "try as many times as you
> like."

---

## 1. Purpose & primary user

**Primary user:** A learner drilling a story point in low-stakes,
unlimited-retry **practice** — either a **B2B school student** (role `student`,
tenant-scoped) or a **B2C consumer learner** (no membership, served from
`platform_public`). One screen, one set of components; only the data source
differs (resolved by `LearnerContext` per `webapps-design.md` §5.2).

**Job to be done:** "Let me grind through these questions at my own pace, get
immediate feedback, and retry anything I miss as many times as I want — no
timer, no penalty, just reps until it clicks." Practice is the
**mastery-through-repetition** surface: distinct from the non-timed _learning_
viewer (which moves linearly through material + questions) and the _timed test_
(server-authoritative, single-attempt). Here the emotional register is calm and
inviting; getting one wrong is a cue to "look at this one again," never a
failure.

---

## 2. Entry points & route

**Route:** `/spaces/:spaceId/practice/:storyPointId` (B2B) and
`/consumer/spaces/:spaceId/practice/:storyPointId` (B2C — same page component,
context-routed, not path-forked per `webapps-design.md` §5.2).

**Entered from:**

- SpaceViewer → Contents tab → a `StoryPointNode`/`SpaceCard` whose `type` is
  `practice` (routes here; `timed_test`/`test` → `/test`, standard/learning →
  `/story-points`).
- `StoryPointTrack` adjacency — a practice node sits inline on the learning
  path.
- Dashboard "Keep practicing" / weak-area recommendation deep link.

**Reads / writes (all via `@levelup/api-client`; UI never touches Firestore —
`common-api.md` §3.3 levelup module):**

| Action                                               | Callable / repo read                                                                                                               |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Space header (title, breadcrumb)                     | `v1.levelup.getSpace` (repo: `SpacesRepo.get`)                                                                                     |
| Story-point metadata (title, prev/next)              | `v1.levelup.listStoryPoints` (repo: `StoryPointsRepo.list`)                                                                        |
| Practice items (`UnifiedItem[]`, question-type only) | `v1.levelup.listItems`                                                                                                             |
| Submit a **deterministic** answer                    | shared `auto-evaluate` package (local, instant, zero-cost) → then `v1.levelup.recordItemAttempt` for durable progress              |
| Submit an **AI/subjective** answer                   | `v1.levelup.evaluateAnswer` (`mode: 'practice'`; persists progress server-side — no second `recordItemAttempt` call for that path) |
| Fast resume cache (session evaluations)              | realtime repo `PracticeCacheRepo` over RTDB `practice/{userId}/{spaceId}` (`subscribe`/`setData` seam, `common-api.md` §10)        |
| Inline tutor message                                 | `v1.levelup.sendChatMessage`                                                                                                       |

`recordItemAttempt` accepts an optional `idempotencyKey` (`common-api.md` §9) so
a retried network call never double-counts an attempt. Headless decomposition
(RN-reusable): `usePracticeSession` (item load + difficulty filter + navigator
index), `useItemSubmission` (hybrid eval orchestration — shared with the
learning viewer), `usePracticeCache` (RTDB read-through write-back + dirty
tracking for the unload guard). All responses Zod-validated; timestamps
normalized to epoch-ms at the repo edge.

---

## 3. Layout — wireframe-as-text

Rendered inside **AppShell** (Sidebar + Topbar on web; Tabbar on mobile). Single
centered column, page frame max 1200, question/feedback prose at reading width
(FOUNDATION §4). Page gutters 16 / 24 / 32 (mobile / tablet / desktop). Vertical
rhythm uses `gap` at space-6 between regions.

```
┌─ AppShell ────────────────────────────────────────────────────────────┐
│ Topbar: tenant switcher · ⌘K · notifications · profile                 │
├──────────┬─────────────────────────────────────────────────────────────┤
│ Sidebar  │  Breadcrumb: Spaces / {Space title} / {Story point title}    │
│ (nav)    │                                                              │
│          │  ┌─ Practice header ──────────────────────────────────────┐  │
│          │  │ dumbbell icon · h1 (Fraunces) {storyPoint.title}        │  │
│          │  │ secondary: "Practice — retry as many times as you like" │  │
│          │  │                              ┌─ Solved counter ──────┐  │  │
│          │  │                              │  3 / 12   (Spline Mono)│  │  │
│          │  │                              │  "Solved"  (secondary) │  │  │
│          │  └──────────────────────────────└────────────────────────┘  │
│          │  ┌─ ProgressBar (solved / filtered total) ────────────────┐  │
│          │  └────────────────────────────────────────────────────────┘  │
│          │                                                              │
│          │  Difficulty filter:  [All] [Easy] [Medium] [Hard]  (Chips)   │
│          │                                                              │
│          │  QuestionNavigator (mini): [1][2][3][4][5]…  status-colored  │
│          │                                                              │
│          │  ┌─ Current question card ───────────────────────────────┐  │
│          │  │ "Question 3 of 12" · difficulty Chip · status glyph    │  │
│          │  │                                                        │  │
│          │  │  QuestionCard → AnswerInput (per type, dispatch of 15) │  │
│          │  │     [Check answer]   · [Ask tutor]                     │  │
│          │  │  ── after submit ──                                    │  │
│          │  │  FeedbackPanel: correctness + explanation + strengths/ │  │
│          │  │     weaknesses + summary   →  [Try again]  (if missed) │  │
│          │  └────────────────────────────────────────────────────────┘  │
│          │                                                              │
│          │  [◂ Previous]                                  [Next ▸]       │
│          └──────────────────────────────────────────────────────────────┘
│  (Inline tutor: TutorChatBubble panel docks as Drawer/Sheet per item)   │
└────────────────────────────────────────────────────────────────────────┘
```

**Grid:** single column; header is a 2-region flex (title block left, Solved
`Stat`/KPI right). On lg the navigator wraps inline; the question card is full
column width within reading measure.

**Responsive behavior:**

- **lg ≥1024:** Sidebar persistent. Solved counter sits top-right of the header.
  Difficulty Chips on one row. QuestionNavigator nodes wrap inline (multi-row).
  Tutor opens as a right-side Drawer (does not cover the question). Prev/Next
  are a justified pair at column foot.
- **md 768–1023:** Sidebar collapses to icon rail. Header stacks counter beneath
  title if cramped. Navigator nodes wrap to 2–3 rows. Tutor becomes a slide-over
  Sheet.
- **sm <768:** AppShell switches to bottom **Tabbar**. Difficulty Chips become a
  horizontal touch-scroll row. QuestionNavigator nodes scroll horizontally in a
  single row (current node auto-scrolled into view). Prev/Next become full-width
  stacked buttons (≥44px). Tutor is a full-height bottom **Sheet**. Solved
  counter and ProgressBar stack directly under the title.

---

## 4. Components used (FOUNDATION §5 only)

**Domain components:** `QuestionCard` (dispatch over the 15 question types),
`AnswerInput` (per-type entry), `ContentRenderer` (md + KaTeX inside question
stems / explanations), `StoryPointNode` (entry affordance from the track),
`XPMeter`/`StreakFlame` are **not** rendered here (no gamification award on
practice — see §8), `TutorChatBubble` (inline Socratic tutor panel),
`ConfidenceBadge` is omitted (practice feedback is direct, not
confidence-routed).

**Primitives / containers / data / feedback / navigation:**

- `Button` (`secondary` for Prev/Next; `spark` reserved is **not** used here —
  practice CTA is calm, so the submit action uses `primary` "Check answer"),
  `IconButton` (Ask tutor).
- `Chip/Tag` (pill) for the difficulty filter set; `Badge` (pill) for status
  glyphs on navigator nodes.
- `ProgressBar` (solved-vs-total).
- `Stat`/KPI (the Solved counter, Spline Mono numerals).
- `Card` (the current-question container, radius.lg, e1).
- `Skeleton` (loading), `EmptyState` (no items / filter empties out),
  `ErrorState` (load failure — distinct from empty), `InlineAlert/Banner`
  (save-failed-but-kept-locally notice), `Toast` (sonner) for transient
  confirmations.
- `Breadcrumb`, `AppShell`, `Sidebar`/`Tabbar`, `Drawer/Sheet` (tutor),
  `Tooltip` (navigator node status on hover).

**FeedbackPanel** is in the shared-ui `feedback` subpath (`webapps-design.md`
§2.2) — it renders post-submit correctness, explanation, strengths/weaknesses,
and the encouraging summary returned by the evaluator. It is composed here, not
redefined.

**Proposed FOUNDATION additions:** none. `QuestionNavigator` (mini,
status-colored numbered grid) is realized by composing `Badge`/numbered `Button`
nodes; if the team wants it as a first-class reusable, promote a
**`QuestionNavigator`** domain component into FOUNDATION §5 (it is also used by
TimedTest's NTA-style navigator and the learning viewer's ItemNavigator — three
current consumers justify promotion). Flagged, not silently invented.

---

## 5. States

| State                                               | Treatment                                                                                                                                                                                                                                                                                                                                |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Loading**                                         | `Skeleton` for header, ProgressBar, navigator row, and one question `Card`. Matches final layout to avoid shift. bg.surface-sunken placeholders, `motion.fast` shimmer (suppressed under reduced-motion).                                                                                                                                |
| **Empty (no practice items)**                       | `EmptyState`: dumbbell icon (text.muted), title "No practice questions here yet", body "This story point doesn't have practice questions yet — check back soon, or head back to the lesson." CTA `Button secondary` → back to SpaceViewer.                                                                                               |
| **Empty (filter excludes all)**                     | Inline note in the question slot: "No {difficulty} questions in this set — try another difficulty." A `Button ghost` "Show all" clears the filter. Navigator + header remain.                                                                                                                                                            |
| **Error (item load failed)**                        | `ErrorState`: title "We couldn't load this practice set", body with retry `Button`. Uses `useApiError` → `ERROR_MESSAGES` (`common-api.md` §6.3). Never silently renders as empty.                                                                                                                                                       |
| **Partial (cache restored, durable write pending)** | Evaluations restored instantly from the RTDB practice cache so the navigator shows prior progress on resume; durable `recordItemAttempt` writes reconcile in the background. If a durable write fails, an `InlineAlert` (status.warning, non-blocking): "Your progress is saved on this device — we'll sync it when you're back online." |
| **Success (answered)**                              | Navigator node flips to `status.success` (correct, ≥1 correctness) or `status.warning` (missed — never `status.error`/punitive red as a primary; see tone note in §8). FeedbackPanel expands with explanation + summary; "Try again" appears for missed items. Solved counter + ProgressBar advance with a subtle `motion.base` ease.    |
| **Permission / role variation**                     | B2B vs B2C identical UI; `LearnerContext` swaps the repo data source (tenant vs `platform_public`). No answer-key reveal in either. No timer in either.                                                                                                                                                                                  |

---

## 6. Interactions & motion

- **Pick / answer a question:** Tapping a navigator node sets the current index
  (`motion.fast` cross-fade of the question card, `ease.standard`). Entering an
  answer via `AnswerInput` and pressing **Check answer** triggers the hybrid
  evaluator.
- **Hybrid evaluation:** deterministic types resolve **instantly** via the
  shared `auto-evaluate` package (optimistic: card shows result with no
  spinner). AI/subjective types call `v1.levelup.evaluateAnswer` with a
  `motion.base` inline loading state on the submit button ("Checking…"). On
  resolve, FeedbackPanel slides open (`ease.entrance`, `motion.base`).
- **Optimistic + reconciliation:** the local evaluation updates
  `evaluations[itemId]`, the navigator node, the Solved counter, and the
  ProgressBar immediately; the RTDB cache write and the durable
  `recordItemAttempt` fire in the background. If the durable write rejects, the
  local result is **kept** (cache holds it) and the warning InlineAlert appears
  — we never roll back the learner's visible progress.
- **Retry (the whole point):** a missed question shows a `Button secondary`
  **"Try again"** that re-arms `AnswerInput` (clears the prior input, keeps the
  question), no confirmation, no penalty, unlimited. The attempt counter
  increments in `AttemptHistoryPanel` (optional expand). Copy frames it as
  iteration, not correction.
- **Difficulty filter:** toggling a `Chip` filters the set and resets the
  navigator to index 0; `motion.fast` reflow. The Solved counter recomputes
  against the filtered total.
- **Unsaved-progress guard:** if there are session evaluations not yet durably
  persisted, a `beforeunload` warning fires. Prefer to make this rare by
  flushing on each answer; the guard is a backstop. (No custom modal —
  browser-native unload prompt; in-app navigation away shows a `ConfirmDialog`
  only if a durable write is still in flight: "Hang on — saving your last
  answer." with an auto-dismiss on flush.)
- **Tutor:** **Ask tutor** opens `TutorChatBubble` as a Drawer/Sheet keyed to
  the current item (`motion.base`, `ease.entrance`); does not block the question
  on lg.
- **No celebratory burst here.** Practice deliberately does **not** fire
  `CelebrationBurst` — that single marigold spring-pop moment is reserved for
  genuine gamification awards (XP / streak / level-up / achievement / 100%
  _completion_), not for getting a practice rep right (FOUNDATION §4 + §8 global
  rule). Everywhere here motion stays subtle. Reaching 100% solved on the
  _filtered set_ may show a quiet, encouraging Toast ("Nice — you've cleared the
  Hard set!") but no burst.
- All motion respects `prefers-reduced-motion` (cross-fades become instant;
  ProgressBar jumps).

---

## 7. Content & copy

- **Header title:** `{storyPoint.title}`. **Subtitle (text.secondary):**
  "Practice — retry as many times as you like."
- **Solved counter label:** "Solved" under `{n} / {total}` (Spline Mono).
- **ProgressBar label:** "Progress".
- **Difficulty Chips:** "All" · "Easy" · "Medium" · "Hard".
- **Submit button:** "Check answer" (calm `primary`, not "Submit" — softer).
  While evaluating: "Checking…".
- **After correct:** FeedbackPanel header "Got it!" (status.success) with the
  explanation and a short encouraging summary.
- **After missed:** FeedbackPanel header "Let's look at this one again"
  (status.warning, never "Wrong" / "Incorrect" / red as primary). Body shows the
  explanation and _what to focus on_ (strengths/weaknesses/missingConcepts from
  the evaluator) — but **never the raw correct answer** for any item the learner
  hasn't satisfied (§8). Primary follow-up: **"Try again"**.
- **Empty (no items):** title "No practice questions here yet" · body "This
  story point doesn't have practice questions yet — check back soon, or head
  back to the lesson."
- **Empty (filtered out):** "No {difficulty} questions in this set — try another
  difficulty."
- **Error:** title "We couldn't load this practice set" · body "Something
  hiccuped on our end. Give it another go." · `Button` "Retry".
- **Offline / save-deferred banner:** "Your progress is saved on this device —
  we'll sync it when you're back online."
- **Tutor entry:** "Ask tutor" / panel placeholder "Stuck on this one? Ask away
  — no wrong questions here."

Tone throughout: relaxed, encouraging, repetition-positive. Precise only where
it must be (the Solved count, attempt count).

---

## 8. Domain rules surfaced

- **Answer-key is never shown to students (global).** Correct answers live in
  the server-only `answerKeys` subcollection that `firestore.rules` denies to
  all clients; the client physically cannot read them. Practice **may** show
  correctness + explanations + strengths/weaknesses + summary because they are
  server-returned evaluation feedback for a _completed attempt on a low-stakes,
  ungraded surface_ — but it must **never** surface the raw stored answer key
  for an item the learner has not yet answered correctly. The evaluator response
  carries pedagogical feedback, not the key. Where a question remains unsolved,
  no "the answer was X" reveal — only guidance to retry. `AnswerKeyLock` is
  **not** prominently needed here (practice is feedback-rich by design), but the
  underlying guarantee (client cannot fetch keys) holds identically.
- **No timer (screen-specific).** Practice has no `serverDeadline`, no
  `TimerBar`, no auto-submit, no cooldown, no lock-after-passing. The
  server-authoritative-timer rule simply does not apply — and the UI must make
  the _absence_ of pressure legible (the "retry as many times as you like"
  subtitle, unlimited "Try again").
- **No gamification award (screen-specific, global motion rule).** Practice does
  not grant XP/streak/level progress and never fires `CelebrationBurst`. The one
  celebratory motion moment stays reserved for true gamification surfaces (§6).
- **Durable + fast-resume persistence.** Session evaluations are written to the
  RTDB practice cache (`practice/{userId}/{spaceId}`) for instant resume _and_
  to durable progress via `recordItemAttempt`. The cache is a convenience layer;
  the durable write is the source of truth for progress aggregation.
  `beforeunload` guards genuinely-unsaved state.
- **Tenant isolation (global).** B2B reads are tenant-scoped
  (`tenants/{tenantId}/...`); B2C reads come from `platform_public` +
  `user.consumerProfile`. Resolved by `LearnerContext`; the screen is identical.
- **All data via `@levelup/api-client`** (global). No direct Firestore/RTDB SDK
  use in the UI; the realtime cache goes through the `PracticeCacheRepo`
  `subscribe`/`setData` seam.

---

## 9. Accessibility

- **Focus order:** Breadcrumb → header → difficulty Chips (left→right) →
  QuestionNavigator nodes (1→N) → question `AnswerInput` → Check answer → Ask
  tutor → FeedbackPanel (when present) → Try again → Prev / Next.
- **Keyboard:** navigator nodes are real `button`s, arrow-key navigable within
  the group (`role="navigation"`, each node
  `aria-label="Question {n}: Solved | Needs another look | Not attempted"`,
  current node `aria-current="step"`). `Enter`/`Space` activates. Prev/Next
  reachable and disabled-aware. The whole flow is operable without a pointer.
- **Status not by color alone:** every navigator node and the in-card status
  pair a glyph (check / minus-circle / dash) + the aria label with the color
  (FOUNDATION §2 contrast rule). FeedbackPanel headers carry text labels ("Got
  it!" / "Let's look at this one again"), not color only.
- **aria-live:** the Solved counter and FeedbackPanel result announce via a
  polite live region so screen-reader users hear "Solved 4 of 12" and the
  feedback verdict after each check. `RouteAnnouncer` announces the page on
  entry.
- **Contrast:** all text/background and status pairs meet WCAG AA per FOUNDATION
  §2; `status.warning` used for "missed" meets AA against bg.surface; the
  difficulty Chips meet 3:1 UI contrast in both selected/unselected states.
- **Touch targets:** navigator nodes and Prev/Next ≥44px on mobile.
- **Reduced motion:** card cross-fades, FeedbackPanel slide, and ProgressBar
  fill become instant under `prefers-reduced-motion`.

---

## 10. Web↔mobile divergence (FOUNDATION §6)

- **Shell:** web = Sidebar + Topbar with **⌘K** CommandPalette; mobile = bottom
  **Tabbar**, **no ⌘K**.
- **QuestionNavigator:** web wraps numbered nodes inline across multiple rows
  with hover `Tooltip` showing status; mobile is a single horizontally-scrolling
  touch row (current node auto-scrolled into view), hover→press, no tooltip
  (status conveyed by glyph + aria).
- **Difficulty Chips:** web one row; mobile horizontal touch-scroll.
- **Tutor:** web right-side `Drawer` (question stays visible); mobile
  full-height bottom `Sheet`.
- **Prev/Next:** web justified inline pair; mobile full-width stacked buttons
  (≥44px).
- **Unsaved guard:** web uses `beforeunload`; RN (future learner-rn) uses
  navigation `beforeRemove` interception with the same `ConfirmDialog` copy —
  the headless `usePracticeCache` dirty flag is shared.
- **Interaction:** hover affordances (node tooltips, Chip hover) collapse to
  press feedback on mobile.
- Component **names/props match 1:1** between `shared-ui` (web) and `ui-native`
  (mobile); only the renderer differs. The headless hooks (`usePracticeSession`,
  `useItemSubmission`, `usePracticeCache`) are imported unchanged by RN.

---

## 11. Claude-design prompt (ready to paste)

```
You are designing the "Practice Mode" screen for the Auto-LevelUp STUDENT (learner) web app.
STRICTLY conform to the Lyceum design system in docs/rebuild-spec/design/00-FOUNDATION.md
(Direction A — "Modern Scholarly"). Do NOT invent colors, fonts, spacing, radii, shadows,
motion, or component variants — compose only from FOUNDATION §2 tokens (bg.canvas, bg.surface,
text.primary/secondary/muted, brand.primary, status.success, status.warning, border.subtle,
mastery.*, radius.lg, e1, motion.fast/base, ease.standard/entrance), §3 type (Fraunces display /
Schibsted Grotesk UI / Spline Sans Mono numerics), and §5 components.

SCREEN: Unlimited-retry practice for one story point. Route /spaces/:spaceId/practice/:storyPointId
(B2B) and /consumer/... (B2C, same component, context-routed). Rendered inside AppShell.

LAYOUT (single centered column, page frame max 1200, prose at reading width; gutters 16/24/32):
- Breadcrumb: Spaces / {Space} / {Story point}.
- Header: dumbbell icon + Fraunces h1 {storyPoint.title}; subtitle "Practice — retry as many
  times as you like."; top-right a Solved Stat/KPI "{n} / {total}" in Spline Sans Mono with
  label "Solved".
- ProgressBar (solved vs filtered total), label "Progress".
- Difficulty filter: pill Chips [All][Easy][Medium][Hard], one selected at a time.
- Mini QuestionNavigator: numbered Button/Badge nodes, status-colored (status.success = solved,
  status.warning = needs another look, neutral = not attempted), current node ring; pair each
  with a glyph + aria-label (never color alone).
- Current question Card (radius.lg, e1): "Question {i} of {total}" + difficulty Chip + status
  glyph; QuestionCard → AnswerInput; primary Button "Check answer" + ghost "Ask tutor".
  After submit: FeedbackPanel — "Got it!" (status.success) or "Let's look at this one again"
  (status.warning, NEVER "Wrong"/red-as-primary) with explanation + strengths/weaknesses + a
  warm summary, and a secondary "Try again" for missed items (unlimited).
- Prev/Next pair at column foot.

DOMAIN RULES (must respect):
- NO answer-key reveal. Show correctness + explanations + guidance (server-returned), but never
  the raw correct answer for an unsolved item. The client physically cannot read answer keys.
- NO timer, NO cooldown, NO lock — make the absence of pressure legible.
- NO CelebrationBurst, NO XP/streak award — practice is not a gamification surface; keep all
  motion subtle (FOUNDATION §4). A quiet encouraging Toast on clearing a set is fine.
- Hybrid eval: deterministic types resolve instantly (optimistic), AI types show "Checking…".
  Progress persists to a fast RTDB resume cache AND durably; a beforeunload guard backstops
  unsaved state.

STATES: loading (skeleton matching layout), empty (no items / filter empties out), error
(distinct ErrorState with retry), partial (cache-restored + deferred-save warning InlineAlert),
success (node flips, FeedbackPanel opens, counter/ProgressBar advance subtly).

TONE: relaxed, encouraging, repetition-positive. Frame misses as growth ("Let's look at this one
again"), never punitive.

RESPONSIVE: lg sidebar persistent + inline-wrapping navigator + right Drawer tutor; md icon rail;
sm bottom Tabbar + horizontal-scroll navigator/Chips + full-width stacked Prev/Next + bottom-Sheet
tutor. Touch targets ≥44px. Honor prefers-reduced-motion. WCAG AA; status by icon+label+color.

Output: a single responsive React screen composed from @levelup/shared-ui components, using the
Lyceum tokens by name. Do not redefine tokens.
```
