# Assessment Configuration (Timed Test / Quiz) — Screen Spec

> The configuration surface for `quiz` and `timed_test` story points:
> server-authoritative timing, question ordering (sequential / shuffle /
> adaptive), attempts, retry rules, passing threshold, section mapping,
> scheduling windows, and result visibility. Conforms to the Lyceum foundation
> (`00-FOUNDATION.md`) — composes only from its tokens and components.

---

## 1. Purpose & primary user

**Primary user:** Teacher (content author / instructor) — occasionally Tenant
Admin reviewing assessment policy.

**Job-to-be-done:** _"I've built a story point full of questions. Now I need to
turn it into a real test — set how long students get, whether they can retry,
when it opens, what counts as passing, and how the questions are ordered — and I
need confidence that the timer can't be gamed."_

This screen is **author-only**. Students never see it; they experience its
effects at runtime through `TimerBar`, `TestRunnerShell`, and `ResultSummary`.
The defining concern is **trust in the assessment**: the configured rules must
be enforced server-side, and the UI must make that enforcement legible to the
teacher (no client clock — the deadline is computed at `startTestSession`).

---

## 2. Entry points & route

**Entry:** Inside the **Story Point Editor** (`storypoint-editor.md`) when
`type ∈ {quiz, timed_test}`. Surfaced as the **"Assessment"** tab/section of
that editor — not a standalone route. When a teacher sets a story point's type
to `quiz` or `timed_test`, this panel appears; for `standard` it is hidden, and
`practice` shows a reduced subset (see §5).

**Route (within editor):** `/spaces/:spaceId/story-points/:storyPointId/edit` →
Assessment tab (`#assessment`).

**Common-API reads/writes:**

- Read story point (incl. existing `assessmentConfig`):
  `v1.levelup.getStoryPoint` (via the editor's loaded entity /
  `v1.levelup.listStoryPoints`).
- Read sections + question inventory for section-mapping and count preview:
  `v1.levelup.listItems` (filtered to `type === 'question'`). Per-section counts
  shown come from the trigger-maintained `StoryPoint.stats` — **never recomputed
  client-side**.
- Write config: **`v1.levelup.saveStoryPoint`** (partial update to
  `assessmentConfig`). This is the only write this panel issues.
- Runtime (referenced, not called here): `startTestSession` computes
  `serverDeadline = startedAt + durationMinutes`; `submitTestSession` enforces
  `serverDeadline + 30s` grace. The panel mirrors these rules in copy so
  authoring intent matches enforcement.

The panel never touches Firestore directly (rebuild API seam).

---

## 3. Layout — wireframe-as-text

Rendered inside the Story Point Editor's content column within **AppShell**
(Sidebar + Topbar). The editor's own header (title, type selector, sticky Save)
is shared chrome above this panel; this panel owns the scroll region.

```
┌─ AppShell ───────────────────────────────────────────────────────────────┐
│ Sidebar │ Topbar (tenant · search · profile)                              │
│         ├───────────────────────────────────────────────────────────────┤
│         │ Breadcrumb: Spaces / {Space} / {Story Point} / Assessment       │
│         │ [Story Point header — title · Type=Timed Test · ● Unsaved · Save]│
│         │                                                                  │
│         │ ┌─ InlineAlert (info) ───────────────────────────────────────┐ │
│         │ │ ⓘ Time is enforced on the server. The countdown a student   │ │
│         │ │   sees is derived from a deadline set when they start.       │ │
│         │ └─────────────────────────────────────────────────────────────┘ │
│         │ ┌─ Section: Timing ──────────────────────────────────────────┐ │
│         │ │ Time limit (min) [  60 ]  ⟵ Input numeric (Spline Mono)     │ │
│         │ │ Instructions     [ Textarea — Markdown + math             ] │ │
│         │ └─────────────────────────────────────────────────────────────┘ │
│         │ ┌─ Section: Question order ──────────────────────────────────┐ │
│         │ │ Order mode  ( ) Sequential  ( ) Shuffle  (•) Adaptive       │ │
│         │ │ [Switch] Shuffle answer options                             │ │
│         │ │ ── Adaptive sub-panel (visible when Adaptive) ──────────────│ │
│         │ │  Start difficulty [Select: Easy ▾]  Adjustment [Gradual ▾] │ │
│         │ │  Min Q before adjusting [ 3 ]  Max same in a row [ 2 ]      │ │
│         │ └─────────────────────────────────────────────────────────────┘ │
│         │ ┌─ Section: Attempts & retries ──────────────────────────────┐ │
│         │ │ Max attempts [ 2 ]  (0 = unlimited)                         │ │
│         │ │ [Switch] Lock after passing                                 │ │
│         │ │ Retry cooldown (min) [ 30 ]                                  │ │
│         │ └─────────────────────────────────────────────────────────────┘ │
│         │ ┌─ Section: Scoring & results ───────────────────────────────┐ │
│         │ │ Passing threshold ──────●──── 70%  ⟵ Slider + mono readout   │ │
│         │ │ [Switch] Show results immediately on submit                 │ │
│         │ └─────────────────────────────────────────────────────────────┘ │
│         │ ┌─ Accordion: Availability window (optional, collapsed) ─────┐ │
│         │ │ Opens  [DatePicker ▾]   Closes  [DatePicker ▾]              │ │
│         │ │ Late submission grace (min) [ 0 ]                            │ │
│         │ └─────────────────────────────────────────────────────────────┘ │
│         │ ┌─ Section: Sections → questions ────────────────────────────┐ │
│         │ │ DefinitionList: Intro 4Q · Core 10Q · Bonus 2Q · Unsec'd 1Q │ │
│         │ └─────────────────────────────────────────────────────────────┘ │
└─────────┴───────────────────────────────────────────────────────────────┘
```

**Grid & responsive:**

- **lg (≥1024):** single reading column, max width 720 (`§4` reading measure).
  Each `Section` is a `Card` (radius `lg`, elevation `e1`). Field rows are a
  2-col label/control grid (`gap` 4); wide controls span full width.
- **md (768–1023):** same single column; section cards full width; the
  DatePicker pair stacks to two rows below ~560px.
- **sm (<768):** all field rows collapse to stacked label-over-control; sliders
  full width; the order-mode radios become a vertical group. Page gutters 16
  (`§4`).

The **Save** affordance lives in the editor header (sticky), not per-section —
config is persisted as one atomic `saveStoryPoint`.

---

## 4. Components used (FOUNDATION §5 only)

- **Containers:** `Section`, `Card`, `Panel`, `Accordion` (Availability window —
  collapsed by default), `Tooltip` (server-time hint, "0 = unlimited").
- **Primitives:** `Input` (numeric variant, Spline Sans Mono per `§3`, for time
  limit / max attempts / cooldown / min-Q / max-same / grace), `Textarea`
  (instructions, canonical Markdown+math), `Select` (starting difficulty,
  adjustment strategy), `Radio` (order-mode group), `Switch` (shuffle options,
  lock-after-passing, show-results), `Slider` (passing threshold, paired with a
  mono numeric readout), `DatePicker` (open/close windows).
- **Feedback:** `InlineAlert` / `Banner` (server-time notice; misconfig
  warnings), `FormFieldError`, `ConfirmDialog` (publish-impact confirmation),
  `Toast` (sonner — save success/failure), `LoadingOverlay` (only if
  save >400ms).
- **Data:** `DefinitionList` (section → question counts), `Badge` (per-section
  count, `pill`), `Skeleton` (load), `EmptyState` (no questions yet).

**Proposed addition to FOUNDATION (flagged, not silently invented):** a
`SegmentedControl` would suit "Order mode" better than a `Radio` group;
FOUNDATION §5 does not define one. Until added, **use `Radio`** (3 options,
horizontal at lg, vertical at sm).

---

## 5. States

- **Loading:** `Skeleton` per `Section` card (header bar + 2–3 field rows); ~3
  stacked. Save disabled.
- **Empty (no questions yet):** Timing/scoring fields render normally, but the
  **Sections → questions** card shows an `EmptyState`: _"No questions yet — add
  questions to this story point before students can take the test."_ with a link
  to the editor's Content tab. A `status.warning` `InlineAlert` notes the test
  is non-startable (mirrors `startTestSession`'s "No questions found"
  precondition).
- **Error:** Load failure → `InlineAlert` (`status.error`) + retry. Save failure
  → error `Toast`; the offending field gets `FormFieldError` when the server
  returns a validation reason (e.g., `durationMinutes <= 0` for a timed test).
- **Partial:** Config loads but `stats` is stale/absent → section counts show
  `—` with a muted _"counting…"_ note rather than a recomputed number (stats are
  trigger-authoritative).
- **Success:** Values render; header shows "Saved {relativeTime}". A
  `status.success` check appears beside Save for `instant` (100ms), then fades.

**Permission-gated variations:**

- **Teacher:** full read/write.
- **Tenant Admin:** identical read/write, plus a tenant-policy banner (e.g.,
  minimum passing threshold) if one exists — read-only constraint via
  `Tooltip` + a disabled lower bound on the `Slider`.
- **Student / Consumer:** **no access** — never routed for learner roles. Any
  deep-link attempt resolves to the student's read-only story-point overview (no
  config, no thresholds-as-config, no answer keys).
- **Practice type (`type === 'practice'`):** reduced view — Timing,
  Availability, and passing-lock retry rules hidden; only order/shuffle and
  instructions remain (practice has no enforced deadline).

---

## 6. Interactions & motion

**Order-mode switching:** selecting **Adaptive** expands the adaptive sub-panel
with an `ease.entrance` height/opacity reveal at `base` (220ms); switching away
collapses it via `ease.exit` at `fast` (160ms). Selecting Adaptive disables the
manual "Shuffle questions" notion (adaptive ordering supersedes it) and shows a
`Tooltip`: _"Adaptive ordering controls question sequence; manual shuffle is off
while adaptive is on."_ — mirroring `start-test-session.ts`, where adaptive
order takes precedence over `shuffleQuestions`. "Shuffle answer options" is
independent and stays enabled in all modes.

**Passing threshold:** `Slider` and mono `Input` are two-way bound; dragging
updates the readout live (`instant`). The readout is Spline Mono, colored by the
`grade.*` band it falls in (≥90 `grade.A` … <60 `grade.F`) as a **secondary**
cue — the numeric % is always present (never color-only).

**Save:** explicit (editor header). **No optimistic write** — assessment rules
are consequential, so we confirm round-trip before showing "Saved". Brief
`LoadingOverlay` only if >400ms; success `Toast` "Assessment settings saved."

**Publish-impact confirmation:** if the space is **published** and the teacher
changes a rule affecting learners (time limit, max attempts, schedule, passing
threshold), Save first opens a `ConfirmDialog`: _"This space is live. Changing
the time limit applies to new attempts only — in-progress sessions keep the
deadline set when they started."_ (Truthful to server behavior; the deadline is
frozen at session start.)

**Misconfiguration feedback (inline, live):**

- `timed_test` with time limit ≤ 0 → `FormFieldError` "Timed tests need a time
  limit above 0." + Save blocked.
- Close window before open window → both DatePickers get `FormFieldError`.
- Max attempts = 1 **and** lock-after-passing on → `InlineAlert`
  (`status.info`): _"With one attempt, lock-after-passing has no additional
  effect."_ (non-blocking).

`prefers-reduced-motion`: adaptive reveal and Save check-fade become instant
opacity swaps (no height animation).

---

## 7. Content & copy (precise, staff tone)

**Section headings:** "Timing" · "Question order" · "Attempts & retries" ·
"Scoring & results" · "Availability window" · "Sections → questions".

**Labels & helpers:**

- **Time limit (minutes)** — _"Each student gets this much time from the moment
  they start. Enforced on the server."_
- **Instructions shown before the test** — _"Supports Markdown and math."_
  (canonical `ContentRenderer`).
- **Question order** — Sequential / Shuffle / Adaptive. Adaptive: _"Serves
  questions by difficulty, starting from your chosen level and adjusting as the
  student answers."_
- **Starting difficulty** / **Difficulty adjustment** (Gradual / Aggressive).
- **Minimum questions before adjusting** / **Max consecutive same-difficulty
  questions**.
- **Shuffle answer options** — _"Randomizes choice order within each question."_
- **Maximum attempts** — _"0 = unlimited."_
- **Lock after passing** — _"Once a student passes, no further attempts are
  allowed."_
- **Retry cooldown (minutes)** — _"Wait time before a student can retry after
  finishing."_
- **Passing threshold** — _"Percent of available points needed to pass."_
- **Show results immediately on submit** — _"Off keeps scores hidden until you
  release them."_
- **Opens** / **Closes** / **Late submission grace (minutes)**.

**Empty state:** _"No questions yet — add questions before this test can run."_
**Error copy:** save → _"Couldn't save assessment settings. Your changes are
still here — try again."_; load → _"We couldn't load this test's settings."_
**Server-time banner:** _"Time is enforced on the server. The countdown students
see comes from a deadline set the moment they start — there's no client clock to
pause or rewind."_

---

## 8. Domain rules surfaced

- **Server-authoritative timing (central rule):** the banner and Time-limit
  helper state that the deadline is computed at `startTestSession`
  (`serverDeadline = startedAt + durationMinutes`) and enforced at submit with a
  30s grace (`submit-test-session.ts`). The UI never implies a client timer is
  the source of truth.
- **Answer keys never shown:** this panel sets policy (passing %, etc.) but
  **displays no answer keys** — those live in the server-only `answerKeys`
  subcollection denied to all clients by `firestore.rules`. Nothing here exposes
  correctness.
- **In-flight immutability:** changing time limit / schedule applies to **new**
  sessions only; in-progress sessions keep their frozen deadline — surfaced in
  the publish-impact `ConfirmDialog`.
- **Schedule enforcement:** open/close + late grace map 1:1 to
  `AssessmentSchedule` and are enforced in `startTestSession` (rejects before
  `startAt`, after `endAt`). Copy mirrors the server's user-facing precondition
  messages.
- **Attempts / retries:** `maxAttempts` (0=unlimited),
  `retryConfig.cooldownMinutes`, `retryConfig.lockAfterPassing` map directly to
  the enforced checks in `start-test-session.ts`; passing comparison uses
  `passingPercentage`.
- **Adaptive precedence:** when `adaptiveConfig.enabled`, adaptive ordering
  overrides `shuffleQuestions` (server builds a difficulty-grouped order); UI
  disables manual shuffle accordingly.
- **Type canon:** the rebuild supports `quiz` and `timed_test` (the duplicate
  `test` type is dropped); the type selector offers only the canonical set.
- **Stats authoritative:** section → question counts come from
  trigger-maintained `stats`; no client recomputation.
- **Tenant isolation:** `tenantId` is derived server-side from auth claims; the
  panel never sends it in the write body.

---

## 9. Accessibility

- **Focus order:** top-down by section, label → control; within the Adaptive
  sub-panel, focus enters the first field on reveal. The Radio group is a single
  tab-stop with arrow-key navigation; `Switch` toggles with Space/Enter.
- **Slider:** `role="slider"` with `aria-valuenow/min/max`; the visible mono
  readout is its `aria-describedby` source; keyboard: arrows ±1, PageUp/Down
  ±10.
- **DatePicker:** fully keyboard-operable calendar; `aria-invalid` +
  `FormFieldError` linked via `aria-describedby` when the window is inverted.
- **Status never by color alone:** the grade-band coloring of the passing % is
  paired with the numeric value and a text band; misconfig alerts pair
  `status.*` color with icon + text (`§2` rule).
- **Contrast:** all text/control pairs meet WCAG AA (4.5:1 body, 3:1 UI) using
  Lyceum semantic tokens; mono numerics on `bg.surface` verified.
- **Reduced motion:** adaptive reveal and Save-check fade degrade to instant per
  `prefers-reduced-motion`.
- **Announcements:** save success/failure and blocking validation announced via
  `aria-live="polite"`; the server-time banner is a static, screen-reader-first
  region (not a transient toast).

---

## 10. Web ↔ mobile divergence

`shared-ui` (web) ↔ `ui-native` (RN) — component names/props match 1:1;
renderers differ.

- An **authoring** surface: on the merged mobile app it appears under the
  teacher role via `RoleSwitcher`. Mobile authoring is supported but secondary.
- **Layout:** section `Card`s stack full-width; the 2-col label/control grid
  always collapses to stacked (label over control), as on web `sm`.
- **Controls:** `Slider` becomes a touch-drag slider with a ≥44px thumb;
  `Select` uses a native bottom-sheet `Drawer` instead of a popover;
  `DatePicker` uses the platform date wheel.
- **Hover → press:** Tooltips become tap-to-reveal `Popover`s; the server-time
  hint shows inline rather than on hover.
- **No ⌘K / CommandPalette** on mobile; Save lives in a sticky bottom action bar
  instead of the top header.
- **Motion:** adaptive reveal uses a Reanimated `spring`-adjacent timing;
  otherwise identical token mapping from the shared JSON.

---

## 11. Claude-design prompt (ready to paste)

```
You are designing ONE screen for the Auto-LevelUp web app. STRICTLY conform to the
Lyceum design system in docs/rebuild-spec/design/00-FOUNDATION.md — use ONLY its
semantic color tokens (§2: bg.canvas, bg.surface, text.primary/secondary, brand.primary,
status.info/warning/error/success, grade.* scale), typography (§3: Fraunces display,
Schibsted Grotesk UI, Spline Sans Mono for ALL numerics), spacing/radius/elevation/motion
(§4: cards radius lg + e1, inputs radius md, motion instant/fast/base + ease.*), and
components from the §5 inventory ONLY. Do not invent colors, fonts, or component names.

SCREEN: Assessment Configuration for a quiz / timed_test story point (teacher-only),
rendered inside the Story Point Editor's "Assessment" tab within AppShell (Sidebar + Topbar).

Build a single reading column (max width 720) of Section cards in this order:
1. A persistent InlineAlert (status.info, icon + text): "Time is enforced on the server. The
   countdown students see comes from a deadline set the moment they start."
2. Timing — numeric Input (Spline Mono) "Time limit (minutes)"; Textarea "Instructions".
3. Question order — Radio group Sequential / Shuffle / Adaptive; Switch "Shuffle answer
   options". When Adaptive is selected, reveal (ease.entrance, base 220ms) a sub-panel:
   Select "Starting difficulty" (Easy/Medium/Hard), Select "Difficulty adjustment"
   (Gradual/Aggressive), numeric Inputs "Minimum questions before adjusting" and
   "Max consecutive same-difficulty questions". Disable manual shuffle while Adaptive is on.
4. Attempts & retries — numeric Input "Maximum attempts" (helper "0 = unlimited"), Switch
   "Lock after passing", numeric Input "Retry cooldown (minutes)".
5. Scoring & results — Slider + bound Spline Mono readout "Passing threshold" (color the
   % by grade.* band but ALWAYS keep the numeric label; never color-only); Switch
   "Show results immediately on submit".
6. Availability window — collapsible Accordion with two DatePickers "Opens"/"Closes" and a
   numeric "Late submission grace (minutes)".
7. Sections → questions — a DefinitionList of section name → question-count pill Badges.

Rules to honor visually: never show answer keys; passing threshold/grade band is a secondary
cue paired with text; show a publish-impact ConfirmDialog when editing a live test; surface a
non-blocking InlineAlert when time limit<=0 for a timed test. Save lives in the editor header
(not per-section). Responsive: collapse 2-col label/control rows to stacked at sm; full-width
sliders on mobile. Respect prefers-reduced-motion (instant reveals). WCAG AA contrast.
Deliver clean React + Tailwind reading the @theme CSS variables from the foundation tokens.
```
