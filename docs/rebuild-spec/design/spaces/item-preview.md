# Item / Story Point Preview — Design Spec

> Conforms to **Lyceum** foundation
> (`docs/rebuild-spec/design/00-FOUNDATION.md`). Tokens, type, spacing, motion,
> and components are cited by name — never re-defined here. This screen reuses
> the **student-facing** domain components so staff verify exactly what learners
> will see, with one staff-only override: the answer-key reveal.

---

## 1. Purpose & primary user

**Role:** `teacher` / `tenantAdmin` (content authors and reviewers).

**Job-to-be-done:** _"Before I publish this story point, let me see it rendered
pixel-for-pixel as a student will — every question type, every material, the
timer and section flow for a timed test — and let me toggle the answer key on so
I can sanity-check correctness, knowing students can never do this."_

This is a **read-only verification surface**, not an authoring surface. No
`saveItem` writes happen here. Its single privileged capability is re-merging
the server-stripped answer keys for staff eyes only (see §8).

---

## 2. Entry points & route

**Route:** `/spaces/:spaceId/story-points/:storyPointId/preview`
(`TestPreviewPage`). The embeddable `ItemPreview` component is also mounted
inside the Story Point Editor's right rail and the Item Editor's live-preview
pane.

**Entry points:**

- "Preview as student" action on the Story Point Editor (`storypoint-editor.md`)
  toolbar.
- "Preview" on a `StoryPointNode` in the Space Editor content tree
  (`space-content-structure.md`).
- Per-item "eye" affordance in the Item Editor (`item-editor.md`) → opens
  `ItemPreview` for a single item.
- Breadcrumb back-link returns to `/spaces/:spaceId/edit`.

**Common-API reads/writes** (cite `specs/common-api.md`):

- `v1.levelup.getItemForEdit` — **the load-bearing call.** Re-merges the answer
  keys that `saveItem` strips into the server-only subcollection (common-api
  line 136). This is the _only_ way staff preview obtains correct answers; the
  read is permission-gated to staff.
- `v1.levelup.listStoryPoints` / `v1.levelup.getStoryPoint` — story point doc:
  `type`, `sections[]`, `assessmentConfig` (`durationMinutes`,
  `shuffleQuestions`, `shuffleOptions`, `passingPercentage`).
- `v1.levelup.listItems` — ordered items (`orderIndex asc`) for the story point.
  Today's `TestPreviewPage` reads Firestore collections directly; the rebuild
  routes these through the API seam (common-api line 144: "new read endpoints
  replacing direct Firestore reads").
- `v1.levelup.startTestSession` — **NOT called.** Preview mocks the timer
  client-side; no real server-authoritative session is created (banner copy
  makes this explicit). A separate "take a real attempt" path could call
  `startTestSession`, but base preview never does.

---

## 3. Layout — wireframe-as-text

Renders inside **AppShell** (`Sidebar` + `Topbar`); content column is
**reading-width capped** (`max-w-3xl`, ≈720 reading measure per §3), centered,
page gutters per §4 (mobile 16 / tablet 24 / desktop 32).

```
┌─ AppShell ───────────────────────────────────────────────────────────────┐
│ Sidebar │ Topbar (tenant switcher · search · profile)                     │
│         ├───────────────────────────────────────────────────────────────┤
│         │  [InlineAlert: PREVIEW MODE — answers not saved]   [Exit ▸]    │  ← info banner
│         │  Breadcrumb: Spaces › {Space.title} › Preview: {SP.title}      │
│         │ ┌───────────────────────────────────────────────────────────┐ │
│         │ │ sticky  Q 3 / 12   [Section: Algebra ▸]      ⏱ TimerBar   │ │  ← sticky control bar
│         │ │                                  [⚿ Show answer key ◯]    │ │
│         │ └───────────────────────────────────────────────────────────┘ │
│         │  Question navigator chips:  ① ② ③ … ⑫   (answered = filled)   │
│         │ ┌─ Card (lg radius, e1) ────────────────────────────────────┐ │
│         │ │  QuestionCard  → dispatches over 15 types                 │ │
│         │ │    ContentRenderer (md + KaTeX stem)                      │ │
│         │ │    AnswerInput (per type, ephemeral mock)                 │ │
│         │ │    ─ AnswerKeyLock band (only when toggle ON) ─           │ │
│         │ │      RubricBreakdown / model answer / correct option mark │ │
│         │ └───────────────────────────────────────────────────────────┘ │
│         │  [◂ Previous]            3 / 12            [Next ▸]            │ │
└─────────┴───────────────────────────────────────────────────────────────┘
```

**Responsive:**

- **lg (≥1024):** single centered reading column; sticky control bar; navigator
  chips wrap to one–two rows.
- **md (768–1023):** same column, gutters 24; navigator chips wrap freely;
  TimerBar stays inline.
- **sm (<768):** banner stacks (label over Exit button); control bar wraps to
  two rows (counter+section on top, TimerBar + toggle below); navigator chips
  become a horizontally scrollable strip; Prev/Next become a full-width 2-up
  button row pinned by the card. No ⌘K (mobile).

For `type === 'standard'` / non-timed story points the **TimerBar region is
omitted** and the control bar collapses to `Q n/N` + the answer-key toggle.

---

## 4. Components used (from §5)

- **AppShell**, **Sidebar**, **Topbar**, **Breadcrumb** — chrome.
- **InlineAlert/Banner** — the persistent "Preview mode — answers are not saved"
  notice (`status.info` / sky).
- **TestRunnerShell** — wraps timed_test preview (timer + section mapping +
  nav), driven by a **mock** timer rather than a live session.
- **TimerBar** — server-authoritative countdown component, here fed a
  **simulated** clock seeded from `assessmentConfig.durationMinutes`; rendered
  in Spline Sans Mono (§3 numeric).
- **QuestionCard** — dispatch over all 15 question types: `mcq`, `mcaq`,
  `true-false`, `numerical`, `text`, `paragraph`, `code`, `fill-blanks`,
  `fill-blanks-dd`, `matching`, `jumbled`, `audio`, `image_evaluation`,
  `group-options`, `chat_agent_question`.
- **AnswerInput** — per-type input; in preview it is interactive-but-ephemeral
  (selections held in local state, never persisted) or visually disabled for
  record/upload types (audio, image_evaluation).
- **ContentRenderer** — single md+KaTeX renderer for stems, explanations, and
  `material` `rich`/`text` bodies (replaces the ad-hoc `RichTextViewer` +
  `whitespace-pre-wrap` in today's file).
- **AnswerKeyLock** — the §5 "server-only guard visual." **Default state =
  locked padlock** with copy "Answer key is server-protected — students never
  see this." When staff flips the toggle, it unlocks and reveals the merged key
  (correct-option highlight, `NumericalData` answer/tolerance, model answer,
  word bank, correct order, group membership) using `mastery.mastered` /
  `status.success` greens.
- **RubricBreakdown** — for `paragraph` / `code` / AI-evaluated types, shows the
  model answer + rubric criteria when the key is revealed.
- **Badge / Chip/Tag** — question-type chip, difficulty chip
  (`status.success`/`status.warning`/`status.error` paired with a label, never
  color-alone — §2 contrast rule), `pts` mono value.
- **Button** (`secondary` Prev/Next, `ghost` Exit), **Switch** (answer-key
  toggle), **Card**, **Skeleton**, **EmptyState**.

**Proposed addition (not a new primitive):** `PreviewModeBanner` = the
**InlineAlert** `info` variant with a fixed copy contract, documented here so
every preview surface uses one identical banner.

---

## 5. States

- **Loading (skeleton):** centered column — a `Skeleton` for the control bar
  (h-8) and one card-height `Skeleton` (h-64) per the existing `TestPreviewPage`
  loader. No spinner.
- **Empty:** story point has zero question items. **EmptyState** with a Fraunces
  title "Nothing to preview yet" and a `ghost` "Back to editor" link (replaces
  today's bare paragraph). A material-only story point still renders the
  materials and suppresses the navigator + TimerBar.
- **Error:** `getItemForEdit` / list call fails → **InlineAlert** `error` (red)
  "Couldn't load this preview" with a Retry button; the answer-key toggle is
  force-disabled (we must not show stale/guessed keys).
- **Partial:** items load but one item's payload is malformed/unknown type →
  that card shows a muted "Preview not available for type \"{type}\"" inline
  (per current `ItemPreview` fallback) while siblings render; navigation still
  works.
- **Success:** full render; the current navigator chip uses `brand.primary`,
  answered-in-session chips use `mastery.inProgress`/green tint, untouched chips
  use `border.subtle`.
- **Permission-gated:**
  - `teacher` / `tenantAdmin`: answer-key toggle present and functional (server
    returns merged keys).
  - A non-staff session reaching this route (defense-in-depth): toggle is
    **absent**, and `getItemForEdit` refuses to merge keys server-side → preview
    degrades to the pure student view. Students are never routed here in
    product, but the UI must not assume the toggle implies access.

---

## 6. Interactions & motion (cite §4 motion)

- **Item navigation:** Prev/Next and navigator chips swap the card. Card
  cross-fade/slide on `base 220ms` with `ease.standard`; direction-aware (next =
  enter from right). Sticky control bar and TimerBar do not re-animate.
- **Answer-key toggle:** flipping the **Switch** unlocks **AnswerKeyLock** with
  a `fast 160ms` reveal (`ease.entrance`); the padlock fades to the unlocked
  glyph and the key band expands. Toggle is **session-sticky** across item
  navigation (matches `showAnswers` state in current page). No celebratory
  motion — this is staff tooling, not gamification (§4: the one spring pop is
  reserved for XP/level-up).
- **Ephemeral answering:** selecting an option (mcq/mcaq/true-false) writes to
  local `answers` state only and marks the navigator chip; this is **never** an
  optimistic write — there is no server mutation, and the banner states answers
  are not saved.
- **Timer mock:** TimerBar counts down from `durationMinutes`; reaching zero
  shows a non-blocking "Time's up (simulated)" InlineAlert — it does **not**
  auto-submit, because no session exists.
- **Exit:** `ghost` "Exit preview" returns to `/spaces/:spaceId/edit`. No
  confirm dialog (nothing is dirty).
- **Reduced motion:** `prefers-reduced-motion` collapses card transitions and
  the key-reveal to instant opacity swaps (§4).

---

## 7. Content & copy (tone: precise for staff)

- **Banner (info):** Heading "Preview mode — answers are not saved." Body "This
  simulates the student experience. No test session is created." Action: "Exit
  preview."
- **Breadcrumb tail:** "Preview: {storyPoint.title}".
- **Control bar:** "Q {n} / {N}", section chip = `{section.title}`,
  "{durationMinutes} min" with mono "({elapsed}m elapsed)".
- **Answer-key toggle label:** "Show answer key". **AnswerKeyLock locked
  caption:** "Answer key is server-protected — students never see this."
  **Unlocked header:** "Answer key (staff only)".
- **Empty:** title "Nothing to preview yet", body "Add questions to this story
  point to preview the student experience.", link "Back to editor".
- **Error:** "Couldn't load this preview. Your session may have expired or the
  connection dropped."
  - "Retry".
- **Timer mock end:** "Time's up (simulated). In a real attempt this would
  submit automatically."
- **Type fallback:** "Preview not available for type \"{type}\"." Tone
  throughout: factual, no exclamation, no encouragement copy (that register is
  for students, who don't see this screen).

---

## 8. Domain rules surfaced

- **Answer keys are server-stripped.** `saveItem` extracts correct answers into
  a server-only subcollection (common-api line 135). Students' read paths/SDK
  never return them. This preview re-obtains them solely via `getItemForEdit`
  (line 136), which authorizes staff. **The toggle reveals data the client did
  not have until staff explicitly requested the merged read** — there is no
  client-side hidden key to leak.
- **Tenant isolation:** all reads scoped to
  `tenants/{tenantId}/spaces/{spaceId}/…`; `tenantId` comes from the
  current-tenant store, never the URL alone.
- **Server-authoritative timing:** real timers are owned by
  `startTestSession`/`submitTestSession` (common-api line 138). Preview's
  TimerBar is an explicit **mock**; surfacing it as authoritative would be a
  lie, hence the "(simulated)" labeling and no auto-submit.
- **Section mapping:** items carry `sectionId`; the story point owns
  `sections[]` (`StoryPointSection`). Preview resolves the current item's
  section title for the control-bar chip, mirroring the timed-test runner's
  section grouping.
- **Item ordering:** items render by `orderIndex asc`;
  `shuffleQuestions`/`shuffleOptions` in `assessmentConfig` are author-facing
  config — preview shows the **canonical (unshuffled)** order with an optional
  "shuffle on for students" note, so authors verify content, not randomization.
- **Story point types** (`StoryPointType`): `standard` · `timed_test` · `quiz` ·
  `practice` · `test`. Only the timed/assessment types (`timed_test`, `quiz`,
  `test`, `practice`) render the TimerBar + section flow; `standard` renders
  content only.
- **Type coverage invariant:** the renderer must dispatch all 15 question types
  and 7 material types; an unknown type degrades gracefully (partial state)
  rather than erroring the whole page.

---

## 9. Accessibility (WCAG AA)

- **Focus order:** Exit button → breadcrumb → answer-key Switch → navigator
  chips (roving tabindex, arrow keys move between chips, Enter activates) →
  in-card AnswerInput controls → Prev → Next.
- **Keyboard:** `←/→` navigate items when focus is outside a text field; `Esc`
  exits preview. The Switch is operable by Space/Enter and exposes
  `aria-checked`.
- **ARIA:** control bar is `role="region"` aria-label "Preview controls";
  navigator is `role="tablist"` with each chip `role="tab"` + `aria-selected`;
  TimerBar uses `role="timer"` `aria-live="off"` (mock, to avoid noisy
  announcements) with a visible "(simulated)" label. AnswerKeyLock locked state
  has descriptive `aria-label` "Answer key hidden, server-protected".
- **Contrast:** difficulty/type chips always pair icon + text label (never
  color-alone, §2); correct-answer highlights use `status.success` green meeting
  3:1 against the card surface, plus a `CheckCircle` icon.
- **Reduced motion:** honors `prefers-reduced-motion` (§4) — instant
  transitions.
- **Targets:** navigator chips and Prev/Next ≥44px touch targets on mobile (§4).

---

## 10. Web ↔ mobile divergence

Component names/props match 1:1 between `shared-ui` and `ui-native` (§6); only
the renderer differs.

- **Navigator chips:** wrapping grid on web → horizontally scrollable, snap-to
  chip strip on mobile.
- **Sticky control bar:** `position: sticky` on web → a pinned header within
  `TestRunnerShell` on mobile.
- **Hover:** option hover states (web) → press/active states on mobile
  (`hover→press`).
- **No ⌘K / CommandPalette** on mobile.
- **Prev/Next:** inline split on web → thumb-reachable full-width bottom bar on
  mobile.
- **Media:** PDF/interactive `iframe` materials degrade to an "Open in browser"
  link / native viewer on RN.
- **Answer-key toggle:** identical **Switch** + **AnswerKeyLock** on both; the
  same `getItemForEdit` staff-only merge backs both platforms.

---

## 11. Claude-design prompt

```
Design the "Item / Story Point Preview" screen for Auto-LevelUp, conforming EXACTLY to the Lyceum
design foundation (docs/rebuild-spec/design/00-FOUNDATION.md). Modern Scholarly direction: warm paper
neutrals (bg.canvas paper-50, bg.surface warm white), deep indigo brand.primary (NOT SaaS blue),
marigold "spark" reserved for gamification only (this staff screen uses NONE), Fraunces for the
empty-state/heading, Schibsted Grotesk for UI/labels, Spline Sans Mono for the timer/points/IDs.
Use ONLY the foundation's component inventory.

Build a centered reading-width column (max-w ~720) inside AppShell (Sidebar + Topbar):
1. A persistent InlineAlert (info / sky) "Preview mode — answers are not saved" with an "Exit preview"
   ghost button, then a Breadcrumb (Spaces › {Space} › Preview: {StoryPoint}).
2. A sticky control bar: "Q n / N", a section Chip, a TimerBar (Spline Sans Mono countdown) seeded from
   assessmentConfig.durationMinutes and labeled "(simulated)", and a Switch "Show answer key".
3. A wrapping question-navigator of numbered chips (current = brand.primary, answered = mastery green,
   untouched = border.subtle).
4. A QuestionCard (lg radius, e1 elevation) dispatching over all 15 question types via ContentRenderer
   (md+KaTeX) + AnswerInput. Below the input render an AnswerKeyLock: DEFAULT = a locked padlock with
   "Answer key is server-protected — students never see this"; when the Switch is ON, reveal the merged
   answer key (correct-option highlight with CheckCircle, numerical answer+tolerance, model answer via
   RubricBreakdown, word bank, correct order) in status.success green.
5. A Prev / "n / N" / Next footer using secondary Buttons.

Motion: item swaps cross-fade on base 220ms ease.standard; key reveal on fast 160ms ease.entrance; NO
celebratory animation (this is staff tooling). Respect prefers-reduced-motion. Difficulty/type are shown
as icon+label chips, never color-alone. WCAG AA contrast; navigator is a roving-tabindex tablist; ←/→
navigate items, Esc exits.

Critical domain rule to express visually: students NEVER see answer keys — keys are server-stripped on
save and only re-merged for staff via getItemForEdit. The AnswerKeyLock's default locked state IS the
visual proof of that guarantee. Show responsive sm/md/lg: on mobile, the navigator becomes a scroll strip,
the control bar wraps to two rows, Prev/Next becomes a full-width bottom bar, no ⌘K.
```
