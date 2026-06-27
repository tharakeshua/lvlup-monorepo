# Timed Test — Landing / Pre-start Gate

> **Conforms to:** [`00-FOUNDATION.md`](../00-FOUNDATION.md) ("Lyceum",
> Direction A — Modern Scholarly). All colors, type, spacing, radius, elevation,
> motion, and components are cited by their FOUNDATION semantic-token /
> component names — never re-defined here. **Audience tone:** student — calm,
> confidence-building, anxiety-reducing. Clear instructions before a high-stakes
> moment. Precise on the load-bearing numbers (duration, marks, attempts), kind
> in everything around them.

---

## 1. Purpose & primary user

**Primary user:** a learner (B2B school `student`, or B2C `consumer`) who is
about to take a timed assessment for a story point.

**Job-to-be-done:** _"Before I commit, show me exactly what I'm walking into —
how long, how many questions, what counts as passing, how many tries I have left
— and tell me plainly that once I press Start the clock runs on the server and
won't pause. Then let me begin (or resume) with a steady hand, or tell me kindly
why I can't start yet."_

This is the **`landing`** state of the timed-test state machine
(`landing | test | results`). It is the only place a student sees the full
"contract" of the assessment and the only place the clock has not yet started.
Its core responsibility is to **set expectations and reduce surprise** — every
gate (schedule, attempts, cooldown, lock-after-pass) is explained, not just
enforced.

---

## 2. Entry points & route

**Route:** `/spaces/:spaceId/test/:storyPointId` (landing branch — rendered when
there is no active in-progress session, or as the gate before one is created).
**Consumer route equivalence:** the same page component is reached via the B2C
`LearnerContext` (data source `platform_public`); route on context, not on a
`/consumer/...` path prefix (per webapps-design §5.2 key fixes).

**Entry points:**

- Space detail "Learning Track" → tapping a `StoryPointNode` whose `type` is
  `timed_test` / `test` / `quiz` routes here (see
  `space-detail-learning-track.md`).
- "Tests" list (`/tests`) → a scheduled/available test row.
- Resume deep-link / notification ("Your test is still open") → lands here; if
  an active session exists the page transitions straight into the `test` state
  (see §6).

**Reads (via `@levelup/api-client` repos / hooks over headless layer — never
`firebase/firestore` directly):**

- `v1.levelup.getStoryPoint` (repo `storyPoints.get` / `getStoryPoint`) → the
  `StoryPoint`, crucially `assessmentConfig` (`durationMinutes`, `instructions`,
  `maxAttempts`, `passingPercentage`, `adaptiveConfig.enabled`,
  `schedule.{startAt,endAt,lateSubmissionGraceMinutes}`,
  `retryConfig.{cooldownMinutes,lockAfterPassing}`) and
  `stats.{totalQuestions,totalPoints}`.
- `v1.levelup.getSpace` (`spaces.get`) → space title for breadcrumb/context.
- `testSessions.list` (repo over `digitalTestSessions` for this `userId` +
  `storyPointId`) → prior `DigitalTestSession[]`: attempts used
  (`attemptNumber`), latest session `status`/`endedAt` (for cooldown), best
  `percentage` (for lock-after-passing), and whether an `in_progress` session
  exists (for resume).
- **Server clock:** `realtime repo` `.info/serverTimeOffset` (RTDB) is fetched
  here so the _displayed_ schedule/cooldown remaining time is skew-corrected
  even before Start. The displayed countdowns are advisory; **gate decisions are
  server-enforced** (see §8).

**Write (the one mutation on this screen):**

- `v1.levelup.startTestSession` (repo `testSessions.startTestSession` → callable
  `startTestSession`, `rateTier: write`, optional `idempotencyKey`). The
  **server** computes `serverDeadline`, builds `questionOrder`, enforces every
  gate, and **resumes the existing active session if one exists** rather than
  creating a duplicate.

> Timestamps from all reads are normalized to epoch-ms at the repo edge; this
> screen never casts `as { seconds }` (retiring the `TimedTestPage.tsx`
> timestamp-cast debt).

---

## 3. Layout — wireframe-as-text

Renders inside **AppShell** (Sidebar + Topbar on `lg`; Tabbar on mobile).
Content is a single **reading-width column** (max ~720, FOUNDATION §4 reading
measure) centered in the canvas — this is a focusing, pre-exam moment, not a
dashboard, so it is deliberately narrow and quiet. `bg.canvas` background; the
gate card sits on `bg.surface`.

```
┌─ AppShell ──────────────────────────────────────────────────────────────┐
│ Topbar: ‹ Back to {Space title}            [tenant] [notif] [profile]    │
│ Sidebar (lg)                                                             │
│ ┌──────────────────── centered column (max 720) ──────────────────────┐ │
│ │ Breadcrumb: Spaces › {Space} › {Story point title}                  │ │
│ │                                                                     │ │
│ │  H1 (Fraunces): {Test title}                                        │ │
│ │  Sub (text.secondary): {Space title} · Timed assessment             │ │
│ │                                                                     │ │
│ │  ┌─ GATE BANNER (conditional, only when blocked) ────────────────┐ │ │
│ │  │ [icon] {reason heading} — {warm explanation + when}           │ │ │
│ │  └───────────────────────────────────────────────────────────────┘ │ │
│ │                                                                     │ │
│ │  ┌─ "At a glance" Stat/KPI strip (2×3 grid lg / 2-col sm) ──────┐  │ │
│ │  │ ⏱ Duration       ❓ Questions      🏅 Max marks               │  │ │
│ │  │  45 min           20               100                        │  │ │
│ │  │ ✓ Passing        ↻ Attempts        🗓 Window                  │  │ │
│ │  │  60%              1 of 3 used       Closes in 2d              │  │ │
│ │  └───────────────────────────────────────────────────────────────┘ │ │
│ │                                                                     │ │
│ │  ┌─ Adaptive note (Chip + 1 line) — only if adaptiveConfig.enabled ┐│ │
│ │  │ ✨ Adaptive — questions adjust to how you're doing.            ││ │
│ │  └───────────────────────────────────────────────────────────────┘ │ │
│ │                                                                     │ │
│ │  ┌─ Instructions Panel (ContentRenderer) ─────────────────────────┐│ │
│ │  │ Before you begin                                              ││ │
│ │  │ • The clock starts on the server the moment you press Start.   ││ │
│ │  │ • It can't be paused — finish in one sitting.                  ││ │
│ │  │ {assessmentConfig.instructions rendered md+KaTeX}             ││ │
│ │  └───────────────────────────────────────────────────────────────┘ │ │
│ │                                                                     │ │
│ │  ┌─ AnswerKeyLock strip (reassurance, subtle) ────────────────────┐│ │
│ │  │ 🔒 Answers are sealed during the test. You'll see feedback     ││ │
│ │  │    after you submit.                                          ││ │
│ │  └───────────────────────────────────────────────────────────────┘ │ │
│ │                                                                     │ │
│ │  [ ▸ Start test ]  (spark Button, full-width on sm)                 │ │
│ │   ↳ when active session exists: [ ▸ Resume your test ]              │ │
│ │   ↳ when gated: disabled + inline reason under the button          │ │
│ │                                                                     │ │
│ │  ── Previous attempts (Accordion, collapsed) ──────────────────────  │ │
│ │   Attempt #2 · 72% · Passed     ·  Attempt #1 · 48% · Keep going    │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

**Responsive behavior:**

- **`lg` (≥1024):** Sidebar visible; centered 720 column; "At a glance" as a
  3-col Stat grid (2 rows).
- **`md` (768–1023):** Sidebar collapsible; column full-width within page
  gutters (24); Stat grid stays 3-col, may wrap to 2.
- **`sm` (<640):** Tabbar replaces Sidebar; page gutters 16; Stat grid → 2-col;
  "Start test" becomes a full-width sticky CTA pinned to the bottom safe-area so
  the primary action is always reachable; instructions and previous-attempts
  stack.

---

## 4. Components used (FOUNDATION §5 only)

- **AppShell / Sidebar / Topbar / Tabbar / Breadcrumb** — navigation chrome.
- **Card** (radius.lg, e1) — the gate container and instruction panel; **Panel**
  for the instructions block; **Section** for grouping.
- **Stat/KPI** — the "At a glance" cells (Spline Sans Mono numerics for
  duration/marks/percentages per FOUNDATION §3).
- **Button** variant **spark** — the "Start test" / "Resume your test" hero CTA
  (spark glow reserved for hero CTA only, FOUNDATION §4). Disabled state when
  gated.
- **InlineAlert/Banner** — the conditional gate banner
  (schedule/cooldown/lock/attempts) and the under-CTA reason line.
- **Chip/Tag** (pill) — "Adaptive", "Timed", attempt status chips.
- **Badge** — "Passed" / status markers in previous-attempts (always icon +
  label, never color alone).
- **ContentRenderer** — renders `assessmentConfig.instructions` (Markdown +
  KaTeX), so authored instructions with formatting/math display identically to
  the test body.
- **AnswerKeyLock** — the "answers are sealed" reassurance strip (the FOUNDATION
  component whose job is to make the _absence_ of answers legible and calm, not
  alarming).
- **Accordion** — "Previous attempts", collapsed by default.
- **GradePill / ConfidenceBadge** — _not_ used here pre-start (no grading exists
  yet); GradePill may appear inside the previous-attempts list for finished
  attempts' percentages.
- **Skeleton** — loading state.
- **EmptyState** — misconfigured / no-questions state.
- **Tooltip** — on the "server clock" info affordance next to Duration.
- **Toast (sonner)** — start failure / resume notice.

**Proposed FOUNDATION additions:** none. `TimerBar` is intentionally **absent**
on this screen — no countdown has started, so nothing server-authoritative is
ticking yet; introducing TimerBar here would falsely imply a running clock.
(TimerBar appears only in the `test` state.)

---

## 5. States

- **Loading (skeleton):** Card with skeleton title, a 6-cell Stat skeleton grid,
  two skeleton instruction lines, and a disabled skeleton CTA. No spinner-only
  screens. Uses **Skeleton**; `motion.fast` fade-in on resolve.
- **Empty / misconfigured:** assessment has 0 questions or no `assessmentConfig`
  → **EmptyState** (warm): "This test isn't quite ready yet — your teacher is
  still setting it up. Check back soon." CTA: "Back to {Space}". No Start
  button.
- **Error:** read failed → **ErrorState** distinct from empty: "We couldn't load
  this test right now." with a "Try again" retry (re-runs the query). Start
  mutation error → **InlineAlert** + Toast (see §6/§7), Start CTA returns to
  enabled.
- **Partial:** story point loads but `testSessions.list` is still loading →
  render the gate with attempts/cooldown cells showing a small inline Skeleton;
  Start stays disabled with "Checking your attempts…" until the session list
  resolves (we must not let a student start without the server-side attempt
  context being confirmed).
- **Success — startable:** all gates pass → Stat strip filled, instructions
  shown, **spark** Start CTA enabled.
- **Success — resume:** an `in_progress` session exists → CTA reads **"Resume
  your test"**; a calm InlineAlert notes "You have a test in progress — your
  time has been running. Pick up where you left off." (honest: the server clock
  kept going).
- **Gated variations (each shows a reason banner + disabled CTA + under-CTA
  line):**
  - **Before schedule** (`now < schedule.startAt`): banner "Opens {date/time}".
    CTA disabled, label "Opens {relative}".
  - **After schedule** (`now > schedule.endAt` + grace): banner "This window has
    closed." CTA disabled.
  - **Cooldown** (`retryConfig.cooldownMinutes` since last `endedAt`): banner
    "Take a breath — you can retry in {n} min." CTA disabled, countdown
    advisory.
  - **Attempts exhausted** (`attemptNumber ≥ maxAttempts`): banner "You've used
    all {max} attempts." CTA disabled.
  - **Locked after passing** (`retryConfig.lockAfterPassing` && best
    `percentage ≥ passingPercentage`): celebratory-but-final banner "You've
    already passed this — nicely done. It's locked now." CTA disabled. (Tone:
    reward, not denial.)
- **Permission/role-gated (B2B vs B2C):** identical UI. B2B student data comes
  tenant-scoped; B2C consumer from `platform_public` via `LearnerContext`. If a
  B2C learner hasn't purchased/enrolled the space, the guard upstream redirects
  to the store — this screen assumes access is already granted.

---

## 6. Interactions & motion

**Press "Start test":**

1. CTA → loading: spark Button shows in-button spinner, label "Starting…",
   disabled (prevents double-submit; the server is also idempotent via
   `idempotencyKey`).
2. Call `v1.levelup.startTestSession`. **No optimistic transition** — we wait
   for the server to return `serverDeadline` + `questionOrder` before entering
   the `test` state. Starting a timed test is server-authoritative and
   irreversible; we never fabricate the clock client-side.
3. On success → state machine transitions `landing → test`; page-level
   transition uses `motion.page` (420ms, `ease.entrance`) crossfade into the
   **TestRunnerShell**. The TimerBar mounts already showing server-derived
   remaining time.
4. On failure → CTA re-enables; **InlineAlert** above the button + **Toast**. If
   the failure is a gate the server caught (e.g. attempts exhausted that the
   client thought was fine, or schedule edge), the banner switches to the
   matching gated state — **the server is the final word**, the client UI
   reconciles to it.

**Press "Resume your test":** same call (`startTestSession` resumes),
transitions into `test` with the _already-running_ server deadline. Copy makes
clear time has continued.

**Gate countdowns (schedule/cooldown):** the "Opens in" / "Retry in" line ticks
down using skew-corrected client time (advisory only). When it reaches zero, the
query auto-refetches and the gate re-evaluates server-side; if now startable,
the banner clears and the CTA enables with a gentle `motion.base`
color/elevation transition — never an abrupt jump, never a celebratory burst
(this is not a gamification moment).

**Accordion (previous attempts):** expand/collapse at `motion.base`,
`ease.standard`.

**No CelebrationBurst here.** The single celebratory spring-pop + marigold burst
is reserved for XP/streak/level-up/achievement/100% in the `results` state. The
lock-after-passing banner is warm but uses standard subtle motion only.

**Reduced motion:** all transitions collapse to instant opacity per
`prefers-reduced-motion`; the page transition becomes a plain swap.

---

## 7. Content & copy

**Headings & labels:**

- H1: `{Test title}` (the story-point title).
- Sub: `{Space title} · Timed assessment`.
- Stat labels: `Duration` (`{n} min`), `Questions` (`{n}`), `Max marks` (`{n}`),
  `Passing` (`{n}%`), `Attempts` (`{used} of {max} used` — or
  `Unlimited attempts` when no `maxAttempts`), `Window` (`Closes in {relative}`
  / `Opens {date}` / `Always open`).
- Instructions block heading: **"Before you begin"**.
- Lead instruction lines (always shown, above authored instructions):
  - "⏱ The clock starts on the server the moment you press Start."
  - "⏸ It can't be paused — give yourself one uninterrupted sitting."
  - "🔒 Answers stay sealed during the test; you'll get feedback right after you
    submit."
- AnswerKeyLock strip: **"Answers are sealed during the test. You'll see your
  results and feedback as soon as you submit."**
- Adaptive chip line: **"✨ Adaptive — the questions adapt to how you're doing,
  so it'll feel just-right-hard."**

**Primary CTA:** "Start test" · resume: "Resume your test" · gated: contextual
disabled label ("Opens in 2h", "Retry in 8 min", "All attempts used", "Already
passed").

**Gate banners (warm, never punitive):**

- Before schedule: _"Not open just yet. This test opens {weekday, date, time}.
  We'll have it ready for you."_
- After schedule: _"This test's window has closed. If you think this is a
  mistake, reach out to your teacher."_
- Cooldown: _"Take a breath. You can retry this test in {n} minute(s) — a short
  pause helps things sink in."_
- Attempts exhausted: _"You've used all {max} of your attempts on this one. Your
  best result is saved in Previous attempts below."_
- Locked after passing: _"You've already passed this — nicely done! It's locked
  now so your result stays. On to the next thing."_
- Resume: _"You have a test in progress, and your time has kept running on the
  server. Jump back in where you left off."_

**Empty/misconfigured:** _"This test isn't quite ready yet — your teacher is
still setting it up. Check back soon."_ **Load error:** _"We couldn't load this
test right now. Give it another go."_ (retry) **Start failure (toast):** _"Hmm,
we couldn't start the test. Let's try that again."_ — recovery hint from the
server `ApiErrorDetails.code` (e.g. attempts/schedule) routes to the matching
banner.

**Previous attempts rows:**
`Attempt #{n} · {percentage}% · {Passed | Keep going}` — sub-passing framed as
growth ("Keep going"), never "Failed".

---

## 8. Domain rules surfaced

- **Timer is server-authoritative (the headline rule of this screen).** This
  page exists partly to _communicate_ that the countdown is not client-trusted.
  We state in plain words that the clock starts server-side on Start and cannot
  be paused; we do **not** render a running TimerBar here. On Start, the server
  computes `serverDeadline`; the client only ever displays server-derived
  remaining time (in the next state) and reconciles auto-submit with the server.
  The schedule/cooldown countdowns shown on this screen are **advisory and
  skew-corrected** (`.info/serverTimeOffset`) — the server makes the actual gate
  decision in `startTestSession`.
- **Answer key is NEVER shown.** Pre-start, there is by definition no answer,
  feedback, or correctness to show. The **AnswerKeyLock** strip makes this
  absence legible and reassuring ("sealed"). The correct answers live in a
  server-only `answerKeys` subcollection that `firestore.rules` denies to all
  clients — the client physically cannot read them. No "preview the answers"
  affordance exists.
- **All gates are server-enforced, client-mirrored.** Schedule window,
  `maxAttempts`, `retryConfig.cooldownMinutes`, and
  `retryConfig.lockAfterPassing` are evaluated client-side **only to render the
  right disabled state + kind reason copy early**. `startTestSession` re-checks
  every gate server-side; if the client thought Start was allowed but the server
  disagrees, the UI reconciles to the server's verdict (banner + disabled CTA).
  The server is the source of truth.
- **Resume, not duplicate.** If an `in_progress` session exists,
  `startTestSession` resumes it (server-side), preventing a second session and
  preserving the original `serverDeadline` — the student cannot reset their
  clock by reloading.
- **Adaptive note honesty.** When `adaptiveConfig.enabled`, we tell the student
  the test adapts — framed encouragingly. Adaptive selection itself runs in the
  `test`/runner layer; here it's just an expectation-setting note.
- **Tenant isolation:** B2B reads are tenant-scoped (`tenants/{tenantId}/...`);
  B2C reads come from `platform_public` + `user.consumerProfile`, abstracted by
  `LearnerContext`. UI is identical.

---

## 9. Accessibility

- **Focus order:** Breadcrumb → H1 (programmatically focused / announced on
  route enter via RouteAnnouncer) → gate banner (if present, `role="status"` for
  advisory, `role="alert"` only for hard blocks) → Stat strip (each Stat a
  labeled group) → instructions → AnswerKeyLock → **Start CTA** →
  Previous-attempts Accordion. The Start CTA is reachable in a short,
  predictable path.
- **Keyboard:** Start CTA activatable via Enter/Space; Accordion header toggle
  via Enter/Space with `aria-expanded`; Tooltip ("server clock") openable on
  focus, not hover-only. Disabled CTA is `aria-disabled` with the reason text
  associated via `aria-describedby` so screen-reader users hear _why_ it's
  disabled, not just that it is.
- **ARIA:** Stat cells use `aria-label` combining label + value + unit
  ("Duration, 45 minutes"). The countdown line uses `aria-live="polite"`
  (advisory; not aggressive). The gate banner that blocks Start uses
  `aria-live="polite"` and is associated to the CTA. Numeric values in Spline
  Sans Mono retain text semantics (not images).
- **Contrast:** all text/background pairs meet WCAG AA (FOUNDATION §2
  guarantee); status is never color-only — every gate/badge pairs an icon + a
  text label.
- **Reduced motion:** honor `prefers-reduced-motion`; the page-transition
  crossfade and any color/elevation easing collapse to instant. No motion is
  ever required to understand state.
- **Touch targets:** Start CTA and Accordion headers ≥44px (FOUNDATION §4); the
  sticky mobile CTA respects the bottom safe-area.

---

## 10. Web ↔ mobile divergence (FOUNDATION §6)

- **Shell:** web uses Sidebar + Topbar; mobile uses bottom **Tabbar** (no
  persistent sidebar).
- **CTA placement:** web — Start CTA inline at the natural end of the column;
  mobile — Start becomes a **sticky bottom CTA** above the Tabbar/safe-area so
  it's always thumb-reachable during a pre-exam read.
- **At-a-glance grid:** web 3-col Stat grid; mobile 2-col stacked.
- **Previous attempts:** web Accordion; mobile same Accordion (already a
  stacked-card pattern — no table to collapse).
- **Hover → press:** the Duration "server clock" Tooltip is hover/focus on web;
  on mobile it becomes a tappable info affordance (press to reveal), or the
  explanatory line is shown inline by default.
- **⌘K CommandPalette:** present on web only; absent on mobile.
- **Component parity:** `shared-ui` (web) and `ui-native` (mobile) expose the
  same component names/props (AnswerKeyLock, Stat, Button spark,
  ContentRenderer, Accordion); only the renderer differs.

---

## 11. Claude-design prompt (ready-to-paste)

```
Design the "Timed Test — Landing / Pre-start Gate" screen for the Auto-LevelUp STUDENT web app.
STRICTLY conform to the Lyceum design system (docs/rebuild-spec/design/00-FOUNDATION.md,
Direction A "Modern Scholarly"). Do NOT invent colors, fonts, spacing, radii, shadows,
motion, or component variants — compose only from FOUNDATION §2–§5 and cite tokens by
semantic name.

CONTEXT: This is the calm, expectation-setting gate a learner sees right BEFORE a timed
assessment starts (state `landing` of a landing|test|results machine, route
/spaces/:spaceId/test/:storyPointId). Tone: warm, confidence-building, anxiety-reducing —
precise on numbers, kind in framing. No countdown is running yet.

LAYOUT: Inside AppShell (Sidebar+Topbar on desktop, Tabbar on mobile). A single centered
reading-width column (~720) on bg.canvas; content on bg.surface Cards (radius.lg, e1).
Top: Breadcrumb, then Fraunces H1 = test title, text.secondary sub = "{Space} · Timed
assessment". Then (conditionally) a gate InlineAlert/Banner. Then an "At a glance" Stat/KPI
strip (3-col desktop / 2-col mobile) with Spline Sans Mono numerics: Duration (min),
Questions, Max marks, Passing %, Attempts ("1 of 3 used"), Window ("Closes in 2d").
Then an optional Chip "✨ Adaptive" with one reassuring line. Then an instructions Panel
titled "Before you begin" rendered via ContentRenderer (md+KaTeX), led by three fixed lines:
the clock starts on the server on Start, it can't be paused, answers stay sealed. Then an
AnswerKeyLock strip ("Answers are sealed during the test — you'll see feedback after you
submit."). Then a full-width spark Button "Start test" (spark glow reserved for this hero
CTA only). Finally a collapsed Accordion "Previous attempts" with rows "Attempt #2 · 72% ·
Passed" (sub-passing framed as "Keep going", never "Failed").

COMPONENTS (FOUNDATION §5 only): AppShell, Sidebar, Topbar, Tabbar, Breadcrumb, Card, Panel,
Section, Stat/KPI, Button(spark), InlineAlert/Banner, Chip, Badge, ContentRenderer,
AnswerKeyLock, Accordion, GradePill (in attempts list), Skeleton, EmptyState, Tooltip, Toast.
DO NOT use TimerBar here — no clock is running yet.

STATES to show: loading (Skeleton grid + disabled CTA), empty/misconfigured (warm EmptyState),
error (ErrorState + retry), resume ("Resume your test" + "your time has kept running"),
and the four GATED states each with a warm banner + disabled CTA + under-CTA reason:
before-schedule ("Opens {time}"), after-schedule ("window closed"), cooldown ("Take a breath…"),
attempts-exhausted ("used all 3 attempts"), locked-after-passing ("already passed — nicely done").

DOMAIN RULES (must surface): (1) Timer is server-authoritative — state plainly the clock
starts server-side on Start and can't be paused; never render a running countdown here.
(2) Answer key is NEVER shown — AnswerKeyLock makes the sealed state legible. (3) All gates
(schedule/maxAttempts/cooldown/lockAfterPassing) are server-enforced; the client only mirrors
them to show the right disabled state + kind copy. (4) Start resumes an existing in-progress
session, never duplicates it. NO CelebrationBurst on this screen.

MOTION: subtle only — motion.base/ease.standard for banners/accordion, motion.page/ease.entrance
for the start→test transition (do not show that here). Respect prefers-reduced-motion.

A11y: focus order Breadcrumb→H1→banner→stats→instructions→AnswerKeyLock→Start CTA→accordion;
disabled CTA is aria-disabled with aria-describedby pointing at the reason; status uses icon+label,
never color alone; AA contrast; advisory countdowns aria-live="polite".

Produce a desktop (lg) and a mobile (sm, sticky bottom CTA) layout. Keep it quiet, focused,
and reassuring — this is the moment to steady a nervous student, not to overwhelm them.
```
