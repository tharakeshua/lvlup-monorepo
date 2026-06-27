# Study Goals & Planner — Design Spec

> Conforms to **Lyceum** (Direction A — "Modern Scholarly"),
> `docs/rebuild-spec/design/00-FOUNDATION.md`. Cite tokens by semantic name; do
> not re-paste scales. Tone: empowering, self-directed — _you set the pace_.
> Celebrate effort and momentum; never nag, never shame a missed deadline.

> **Borrows the platform's single celebratory motion moment.** When a goal is
> met (`currentCount` reaches `targetCount`), this screen fires the shared
> `CelebrationBurst` (spring-pop + marigold `spark` burst) — the same one
> governed by `gamification-xp-streaks.md` §6/§8. It is _triggered_ here on goal
> completion but not _owned_ here; everywhere else on this screen, motion stays
> subtle (FOUNDATION §4).

---

## 1. Purpose & primary user

**Primary user:** a learner (B2B school student, role `student`; also the B2C
consumer learner) who wants to _own their learning cadence_ — set a concrete,
time-boxed target ("finish 5 spaces by Friday", "study 300 minutes this week",
"pass 2 exams this month"), watch a progress ring fill as they work, and look
back at their study history to see they're showing up. **Job-to-be-done:**
_"Help me set my own goals, see how close I am, and feel the momentum of my own
consistency — on my terms."_

This is the **self-directed counterweight** to the teacher-assigned work
(assignments, scheduled tests). Assignments are given _to_ the learner; **goals
are chosen _by_ the learner.** The framing must make that ownership feel good,
and never read as a deadline whip. Today the page (`StudyPlannerPage.tsx`)
exists but is **unrouted** and writes Firestore directly — the rebuild wires it
at `/goals` and routes all reads/writes through `@levelup/api-client`.

The screen has two intertwined data stories:

1. **Goals** — the `StudyGoal` records the learner creates and tracks (target
   ring + due date).
2. **Study history** — the `StudySession` ledger (minutes / items / points per
   day) that contextualizes goals and aligns with the daily streak.

---

## 2. Entry points & route

**Route:** `/goals` (B2B student tree, behind `RequireAuth allow=['student']`,
`onMissingMembership: 'consumerRedirect'`; B2C consumer reaches the identical
view through `LearnerContext`, data scoped to the `platform_public` tenant +
`user.consumerProfile`). **This route must be wired** — `StudyPlannerPage` is
currently an unrouted dead page (app-student-web §4; webapps-design §5.2 fix
#14, alongside `/achievements`/`/progress`).

**Entry points:**

- Sidebar nav item "Goals" (desktop) / Tabbar or overflow (mobile).
- Student Home Dashboard — a "Your goals" summary card linking here ("Set a goal
  ▸" when empty; "3 active ▸" when populated).
- The Streak surface (`gamification-xp-streaks.md`) cross-links here, since a
  "study N minutes" goal aligns with the daily streak.
- CommandPalette (⌘K) → "Go to Goals".

**Reads** (all via `@levelup/api-client` → `shared-hooks/headless`; **never
Firestore directly**; tenant derived from the active-tenant claim, never the
request body):

- **Study goals** — `studyGoals` repo read behind the api-client (e.g.
  `v1.levelup.listStudyGoals`, or folded into the gamification read surface).
  Returns `StudyGoal[]` (`gamification/achievement.ts`): `id`, `title`,
  `description?`, `targetType`
  (`spaces | story_points | items | exams | minutes`), `targetCount`,
  `currentCount`, `startDate`/`endDate` (ISO date), `completed`, `completedAt?`,
  `createdAt`. Timestamps normalized to epoch-ms at the repo edge; ISO date
  strings kept as-is for date math.
- **Study sessions** — `studySessions` repo read (e.g.
  `v1.levelup.listStudySessions`, windowed to the last ~8 weeks). Returns
  `StudySession[]`: `date` (ISO), `minutesStudied`, `spacesWorked[]`,
  `itemsCompleted`, `pointsEarned`. Powers the history heatmap/timeline and the
  weekly "this session" rollup.
- **Progress summary** — `v1.analytics.getSummary { scope: 'student' }` →
  `StudentProgressSummary` for `levelup.streakDays` (streak alignment),
  `levelup.completedSpaces`/`totalSpaces`, `autograde.completedExams`. Used for
  the at-a-glance "This week" rollup and to corroborate goal `currentCount`
  where a goal mirrors a system metric.

**Writes** (all via callables; the screen never `addDoc`s Firestore as it does
today):

- **Create / update goal** — `v1.levelup.saveStudyGoal` (a `save*` upsert: no
  `id` = create, `id` present = update; `data.deleted = true` = soft-delete for
  the goal-removal flow). Request body carries `title`, `targetType`,
  `targetCount`, `startDate`/`endDate`, optional `description`;
  `userId`/`tenantId` derived server-side from `ctx`, not passed. Response
  `SaveResponse{ id, created }`.
- **Delete goal** — same `saveStudyGoal` with `deleted: true` (soft-delete),
  behind a `ConfirmDialog`.
- **`currentCount` is advanced server-side**, not by this screen. As the learner
  completes items/spaces/exams or logs study minutes, server triggers/services
  increment matching goals' `currentCount` and flip `completed`/`completedAt`
  when the target is met. This screen is **read-reactive** for progress: it
  renders the new ring value and, when an incoming `completed` crosses
  false→true, fires the `CelebrationBurst` (§6/§8). The learner directly writes
  only the goal _definition_ and its deletion.

---

## 3. Layout — wireframe-as-text

Rendered inside **AppShell** (Sidebar + Topbar on `lg`; Topbar + bottom
**Tabbar** on mobile). Content column max-width 1200, page gutters 16/24/32
(mobile/tablet/desktop), vertical rhythm `gap` space-6 between regions. Page on
`bg.canvas`; cards on `bg.surface` with `border.subtle` + `e1`, radius `lg`.

```
┌────────────────────────────────────────────────────────────────────────┐
│ HEADER                                                                   │
│  Fraunces h2 "Your goals"  ·  text.secondary "You set the pace."         │
│                                              [ + New goal ]  (Button spark)│
├────────────────────────────────────────────────────────────────────────┤
│ THIS-WEEK ROLLUP  (3 Stat cards, grid)                                   │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐                  │
│  │ ◎ 3           │ │ 📅 1          │ │ ✓ 5           │                  │
│  │ Active goals  │ │ Due this week │ │ Completed     │                  │
│  └───────────────┘ └───────────────┘ └───────────────┘                  │
├────────────────────────────────────────────────────────────────────────┤
│ WEEK STRIP  (7 day cells, due-dots; tap a day to filter active goals)    │
│  Mon  Tue [WED·you] Thu  Fri••  Sat  Sun        ( Clear filter ▸ )        │
├────────────────────────────────────────────────────────────────────────┤
│ ACTIVE GOALS                                                             │
│  ┌─────────────────────────┐  ┌─────────────────────────┐               │
│  │ StudyGoalCard           │  │ StudyGoalCard           │               │
│  │  ◴ ProgressRing 3/5     │  │  ◴ ProgressRing 180/300 │               │
│  │  "Finish Math spaces"   │  │  "Study this week"      │               │
│  │  Spaces · due Fri       │  │  Minutes · due Sun      │               │
│  │            [⋯ edit/del]  │  │            [⋯ edit/del] │               │
│  └─────────────────────────┘  └─────────────────────────┘               │
├────────────────────────────────────────────────────────────────────────┤
│ STUDY HISTORY  (heatmap strip + recent sessions Timeline)                │
│  ▢▢▣▣▢▤▣  ▣▤▢▢▣▣▤  …  "You studied 6 of the last 7 days 🔥"             │
│   · Jun 19 — 45 min · 8 items · 60 pts  (Recursion, Arrays)              │
│   · Jun 18 — 30 min · 5 items · 40 pts  (Sorting)                        │
├────────────────────────────────────────────────────────────────────────┤
│ COMPLETED GOALS  (collapsed Accordion; muted, celebratory check)         │
│  ✓ "Pass 2 exams"   ✓ "10 items in DSA"   … (up to 6, "See all ▸")       │
└────────────────────────────────────────────────────────────────────────┘
```

**Create/Edit goal** opens in a **Modal/Dialog** (desktop) or bottom
**Drawer/Sheet** (mobile): fields = Title (Input), Target type (Select: Spaces /
Sections / Items / Exams / Minutes), Target count (Input number, min 1), Start
date (defaults today, read-only chip), Due date (**DatePicker**, min = today).
Primary "Create goal" / "Save changes" (Button `spark`), secondary "Cancel"
(ghost).

**Responsive behavior:**

- **`lg ≥1024`:** Stat rollup 3-up; Active/Completed goal cards 2-up grid;
  history heatmap + Timeline side-by-side (heatmap left, sessions right).
- **`md 768–1023`:** Stat rollup 3-up; goal cards 2-up; history stacks (heatmap
  above Timeline).
- **`sm <768`:** everything single-column stacked; Stat rollup becomes a
  horizontal scroll row of 3 compact stats; week strip horizontally scrollable
  (`overflow-x`); goal cards full-width; create/edit in a bottom Sheet. Touch
  targets ≥44px.

---

## 4. Components used (FOUNDATION §5)

- **Domain / gamification:** `StudyGoalCard` (title + targetType + counts +
  dates + `ProgressRing`), `MilestoneCard` (completed-goal celebratory variant
  in the Completed region), `CelebrationBurst` (fired on goal completion —
  borrowed, governed by gamification spec), `StreakFlame` (inline in the history
  "you studied N of 7 days" line, aligning goals to the streak).
- **Data / containers:** `ProgressRing` (the goal completion ring) +
  `ProgressBar` fallback (minutes-type goals where a linear bar reads clearer),
  `Stat`/`KPI` (the 3 rollup tiles), `Timeline` (recent study sessions),
  `Card`/`Section`, `Accordion` (Completed goals), `EmptyState`, `Skeleton`,
  `Badge`/`Chip` (targetType label, "Due Fri", "Overdue").
- **Primitives:** `Button` (`spark` for "New goal" / save; `ghost` for cancel;
  `danger` inside delete confirm), `IconButton` (the per-card `⋯` overflow →
  edit/delete), `Input`, `Select` (target type), `DatePicker` (due date),
  `Modal/Dialog` + `Drawer/Sheet` (create/edit), `DropdownMenu` (card `⋯` menu),
  `Popover`/`Tooltip` (heatmap day detail).
- **Feedback:** `ConfirmDialog` (delete goal), `Toast` (sonner — "Goal created",
  "Goal updated", "Goal removed", error recovery), `FormFieldError` (date/count
  validation), `InlineAlert` (load error banner).
- **Navigation:** `AppShell` (Sidebar/Topbar/Tabbar), `CommandPalette` (⌘K route
  entry).

**Proposed FOUNDATION additions** (flagged, not silently invented):

- **`StudyHistoryHeatmap`** — a GitHub-style contribution-grid component (day
  cells colored by `StudySession` intensity, e.g. minutes-studied bucketed into
  4 levels). FOUNDATION §5 lists `ClassHeatmap` (teacher class grid) but no
  learner day-streak/contribution heatmap. Either generalize `ClassHeatmap` into
  a reusable `Heatmap` primitive (cells × intensity scale × tooltip) that both
  consume, or add `StudyHistoryHeatmap` to the gamification component set. Until
  promoted, this screen falls back to a horizontal row of `StreakFlame`/day
  chips + the `Timeline` (both already in §5), so the screen ships without the
  addition.
- **`WeekStrip`** (the 7-day due-date filter strip) — a small, screen-local
  composition of day cells; not a foundation primitive. If reused on the
  dashboard it should be promoted; for now treat it as a local composite built
  from `Button`/`Chip` + the dot-indicator pattern, no new tokens.

No new colors, fonts, radii, shadows, or motion are introduced.

---

## 5. States

- **Loading:** `Skeleton` — header static; 3 stat tiles as skeleton rects; a
  2-up grid of 4 `StudyGoalCard` skeletons (ring as a circular skeleton);
  history region as a skeleton heatmap row + 3 timeline-row skeletons. No layout
  shift on resolve.
- **Empty (no goals at all):** `EmptyState` with `Target` icon, Fraunces title
  and a `spark` "Create your first goal" CTA (copy in §7). The history region
  still renders if `StudySession`s exist (a learner can have study history
  before setting any goal) — so "empty" is per-region, not whole-page.
- **Empty (no study history):** history region shows a gentle `EmptyState`
  ("Your study days will show up here") — never an error; absence of logged
  minutes is normal for a new learner.
- **Partial (goals load, history fails, or vice-versa):** each region resolves
  independently; a failed region shows an inline `ErrorState`/`InlineAlert` with
  "Try again", the other region renders normally. Goal cards whose
  `currentCount` mirrors a not-yet-loaded summary metric show the ring from the
  goal doc's own `currentCount` (authoritative) and never block on the summary
  read.
- **Error (goals read fails):** `ErrorState` (distinct from empty) with retry;
  toast carries `error.details.code` recovery copy (`ERROR_MESSAGES`).
  Create/save failure: dialog stays open, fields preserved, inline
  `FormFieldError` + toast; optimistic card is rolled back.
- **Success:** populated grid; due chips colored by proximity (`status.info`
  "Due Fri", `status.warning` "Due tomorrow", `status.error` + "Overdue" label
  for past-due active goals — **framed kindly**, see §7). Completed goals
  collapse into the muted Accordion with a `status.success` check.
- **Permission / role-gated:** **B2B student** sees tenant-scoped goals +
  history. **B2C consumer** sees the identical layout, data from
  `platform_public` + `consumerProfile`; `targetType: 'exams'` may be
  empty/hidden for consumers who have no exams — the Select omits options with
  no underlying data source so a learner can't set an unreachable goal. No
  teacher/admin variant — this surface is learner-only.

---

## 6. Interactions & motion

- **Create goal:** "New goal" opens Dialog/Sheet with `motion.base` entrance
  (`ease.entrance`). On submit: **optimistic insert** of the new `StudyGoalCard`
  (ring at 0/target) with a subtle `motion.fast` fade-in (`AnimatedListItem`);
  `v1.levelup.saveStudyGoal` resolves → reconcile real `id`; on failure → card
  removed, dialog reopens with values, toast. Success toast "Goal set — you've
  got this." (`motion.base`).
- **Edit goal:** `⋯` → "Edit" reopens the same Dialog pre-filled. Save →
  optimistic field update on the card; reconcile/rollback as above.
- **Delete goal:** `⋯` → "Remove" opens `ConfirmDialog` (copy §7). Confirm →
  optimistic card exit (`motion.fast`, `ease.exit`) +
  `saveStudyGoal { deleted: true }`; failure restores the card + toast. Never
  delete without confirm.
- **Progress advance (reactive):** when a goal's `currentCount` increases
  (server-driven, arriving via the live read / refetch), the `ProgressRing`
  animates the arc from old→new with `motion.slow`/`ease.standard` — felt, not
  flashy. Numeric label (Spline Mono) counts up.
- **Goal completion — THE celebratory moment:** when an incoming update flips
  `completed` false→true, fire the shared `CelebrationBurst` (spring pop +
  marigold `spark` burst) centered on that card; the card transitions to its
  `MilestoneCard`/completed treatment with the `status.success` check; a toast
  "Goal met! 🎉 You set it, you crushed it." This is the **only** celebratory
  burst on the screen — goal creation, edit, and progress ticks stay subtle
  (FOUNDATION §4). Respect `prefers-reduced-motion`: the burst degrades to a
  static `spark`-tinted badge + the success state with no spring/particles.
- **Week-strip filter:** tapping a day cell filters Active goals to that
  due-date (`aria-pressed` toggles); "Clear filter" resets. Pure client filter,
  `motion.fast` list reflow.
- **Heatmap hover/press:** `Popover`/`Tooltip` shows that day's `StudySession`
  detail (minutes · items · points · spaces). Hover on web; press/long-press on
  mobile.
- **Date validation:** Due date < today blocks submit with inline
  `FormFieldError` ("Pick a date in the future") — no toast spam; the field is
  the source of correction.

---

## 7. Content & copy

**Voice:** empowering, self-directed, warm. The learner is the author of these
goals — copy reinforces agency ("you set the pace") and frames lateness as a
nudge, never a failure.

- **Header:** title "Your goals" (Fraunces h2); subtitle "You set the pace." CTA
  button "New goal".
- **Stat rollup labels:** "Active goals" · "Due this week" · "Completed".
- **Create/Edit dialog:** title "Set a study goal" / "Edit goal". Fields — "What
  are you aiming for?" (Title, placeholder "e.g. Finish the Recursion space"),
  "Track by" (Target type), "How many?" (Target count, placeholder "e.g. 5"),
  "By when?" (Due date). Submit "Set goal" / "Save changes"; secondary "Cancel".
  Helper under target type: "Pick what you want to count — spaces, sections,
  items, exams, or study minutes."
- **Empty (no goals):** title "Set your first goal" (Fraunces); body "Goals are
  yours to choose. Pick a target and a date — we'll track the rest while you
  learn."; CTA "Create a goal".
- **Empty (no history):** "Your study days will show up here. Complete a few
  items and watch this fill in."
- **Due chips:** "Due Fri" (`status.info`), "Due tomorrow" (`status.warning`),
  and for past-due active goals **"Past your date — no rush, finish strong ▸"**
  (`status.error` accent but encouraging text; never "OVERDUE" in red shouting).
- **History line:** "You studied 6 of the last 7 days 🔥" / for one day "You
  studied yesterday — nice." Never "You missed N days."
- **Goal-met toast:** "Goal met! 🎉 You set it, you crushed it." · **Completed
  region header:** "Done and dusted".
- **Delete confirm (`ConfirmDialog`):** title "Remove this goal?"; body "This
  goal will be removed from your planner. Your study history stays."; confirm
  "Remove" (danger), cancel "Keep it".
- **Toasts:** create "Goal set — you've got this." · update "Goal updated." ·
  delete "Goal removed." · error "Couldn't save your goal — let's try that
  again." (with `ERROR_RECOVERY_HINTS`).
- **Validation:** count "Aim for at least 1." · date "Pick a date in the
  future."

---

## 8. Domain rules surfaced

- **Goal completion is the gamification celebratory moment.** When
  `currentCount` reaches `targetCount` and the server flips `completed`, this
  screen fires the shared `CelebrationBurst` (spring pop + marigold `spark`). It
  is the **only** celebratory burst here; it is _governed_ by
  `gamification-xp-streaks.md` (§6/§8) and merely _triggered_ on this surface —
  do not invent a second/variant burst. Respect `prefers-reduced-motion`.
- **`currentCount` is server-authoritative.** The learner authors the goal
  _definition_ (title/type/target/dates) but never edits progress; progress is
  incremented by server triggers/services on real learning events
  (item/space/exam completion, logged study minutes). The UI is read-reactive
  for progress — it cannot fake a goal toward completion. This keeps goals
  honest, matching the "motivating chrome over honest data" principle.
- **Streak alignment.** A `targetType: 'minutes'` goal aligns with the daily
  streak (`StudentProgressSummary.levelup.streakDays`) and the `StudySession`
  ledger; the history region's `StreakFlame` line reflects the same source of
  truth as the gamification streak surface — no divergent streak math.
- **Tenant isolation.** B2B reads are tenant-scoped
  (`tenants/{tenantId}/studyGoals`, `/studySessions`); B2C reads come from
  `platform_public` + `consumerProfile`, resolved by `LearnerContext`.
  `tenantId`/`userId` are derived server-side from the auth claim, never passed
  in the request body.
- **All data through `@levelup/api-client`.** No direct `firebase/firestore`
  `addDoc`/`collection` (replacing the current `StudyPlannerPage` direct write).
  Reads/writes are Zod-validated; timestamps normalized to epoch-ms at the repo
  edge; ISO date strings preserved for date math.
- **No answer-key / timer surfaces here** — this screen has neither assessments
  nor server-deadline countdowns, so those global rules don't apply (noted for
  completeness).

---

## 9. Accessibility

- **Forms:** every field has a programmatic `<Label htmlFor>` (Title, Type,
  Count, Due date). The **DatePicker** is fully keyboard-operable (type a date
  into the bound `<input type="date">` / arrow-key the calendar grid; never
  mouse-only). Required fields use `aria-required`; validation errors wired via
  `aria-describedby` to `FormFieldError`, announced politely
  (`aria-live="polite"`).
- **Focus order:** Header → New goal → stat tiles → week strip cells → active
  goal cards (each card: ring → title → `⋯` menu) → history → completed
  accordion. Dialog/Sheet traps focus; focus returns to the invoking trigger on
  close.
- **Week strip & day cells:** `role="group"`, each day a `button` with
  descriptive `aria-label` ("Wed, Jun 18 — 2 goals due") and `aria-pressed` for
  the active filter.
- **ProgressRing:** `role="img"` (or `progressbar` with `aria-valuenow/min/max`)
  and an accessible label "3 of 5 spaces · 60%". Never color-only — the ring is
  paired with the explicit "3 / 5" numeric and the targetType text label.
- **Status by more than color:** due chips and overdue state carry an icon +
  text label (not just `status.warning`/`status.error` hue), per FOUNDATION §2
  contrast rule.
- **Contrast:** all text/bg pairs meet WCAG AA (`text.primary`/`text.secondary`
  on `bg.surface`); `spark`/`status.*` accents used for fills, never as the sole
  carrier of meaning.
- **Reduced motion:** `prefers-reduced-motion` disables the ring fill animation,
  list reflow springs, and the `CelebrationBurst` particles (degrades to a
  static success badge). Count-up numerics snap to final value.
- **Heatmap:** each cell is keyboard-focusable with an `aria-label` ("Jun 19 —
  45 minutes studied"); the `Popover` detail is reachable without hover.

---

## 10. Web ↔ mobile divergence (FOUNDATION §6)

- **Shell:** web = Sidebar + Topbar (AppShell); mobile = Topbar + bottom
  **Tabbar**; `⌘K` CommandPalette is **web-only** (absent on mobile — entry via
  Tabbar/overflow).
- **Create/edit container:** web = centered **Modal/Dialog**; mobile = bottom
  **Drawer/Sheet** (thumb-reachable, larger touch targets).
- **DatePicker:** web = popover calendar; mobile = the native date wheel/picker
  (`ui-native` DatePicker with matching props), still keyboard/AT-accessible.
- **Card overflow menu:** web = hover-reveal `⋯` + `DropdownMenu`; mobile =
  always-visible `⋯` tapped to open an action sheet (no hover).
- **Goal-card grid:** web 2-up (`md`+); mobile single-column stacked, full-width
  cards.
- **Week strip & heatmap:** horizontally scrollable on mobile (`overflow-x`),
  with momentum scroll; tooltips become press/long-press popovers.
- **Stat rollup:** web 3-up grid; mobile horizontal scroll row of compact stats.
- Component **names/props are 1:1** between `shared-ui` (web) and `ui-native`
  (mobile) per FOUNDATION §6; only the renderer differs.

---

## 11. Claude-design prompt (ready to paste)

```
Design the "Study Goals & Planner" screen for the Auto-LevelUp STUDENT (learner) web app,
strictly conforming to the Lyceum design system in
docs/rebuild-spec/design/00-FOUNDATION.md (Direction A — "Modern Scholarly").
Do NOT invent colors, fonts, spacing, radii, shadows, motion, or component variants — compose
only from FOUNDATION §2/§3/§4/§5 and cite tokens by semantic name (bg.canvas, bg.surface,
text.primary/secondary/muted, brand.primary, spark, border.subtle, status.success/warning/error/info,
radius.lg, e1, motion.base/slow, ease.standard/entrance/exit).

ROUTE: /goals (B2B student; B2C consumer via LearnerContext on platform_public). Rendered inside
AppShell (Sidebar+Topbar on lg; Topbar+bottom Tabbar on mobile). Content max-width 1200, gutters
16/24/32, vertical rhythm gap space-6, cards on bg.surface + border.subtle + e1 + radius.lg.

PURPOSE: a self-directed planner where the learner authors time-boxed StudyGoal records
(targetType: spaces | story_points | items | exams | minutes; targetCount; due date) and watches a
ProgressRing fill as server-driven currentCount advances. Tone: empowering — "You set the pace."
Never punitive about missed dates.

LAYOUT (top→bottom): Header (Fraunces h2 "Your goals" + subtitle "You set the pace." + spark
Button "New goal"); a 3-tile Stat rollup (Active goals / Due this week / Completed); a 7-day WeekStrip
that filters active goals by due-date; an Active-goals 2-up grid of StudyGoalCard (each = ProgressRing
+ title + targetType chip + due chip + ⋯ overflow → edit/remove); a Study-history region (a
contribution-style heatmap of StudySession days + a Timeline of recent sessions showing minutes·items·
points, plus a StreakFlame "you studied 6 of 7 days" line); a collapsed Accordion of Completed goals
(MilestoneCard treatment, status.success check).

COMPONENTS (FOUNDATION §5 only): StudyGoalCard, MilestoneCard, ProgressRing/ProgressBar,
CelebrationBurst, StreakFlame, Stat/KPI, Timeline, Accordion, EmptyState, Skeleton, Badge/Chip,
Button (spark/ghost/danger), IconButton, Input, Select, DatePicker, Modal/Dialog (web) + Drawer/Sheet
(mobile), DropdownMenu, Popover/Tooltip, ConfirmDialog, Toast, FormFieldError, AppShell.
NOTE the proposed additions explicitly (do not silently invent): a learner StudyHistoryHeatmap
(generalize teacher ClassHeatmap into a reusable Heatmap, or fall back to StreakFlame day chips +
Timeline) and a local WeekStrip composite.

STATES: per-region loading skeletons; empty (no goals → EmptyState with spark CTA; no history →
gentle history empty, never error); partial (goals/history resolve independently); error (ErrorState
distinct from empty, retry + recovery toast); success (due chips colored by proximity with icon+text,
overdue framed kindly). B2C variant hides exams targetType when no exam source exists.

INTERACTIONS & MOTION: create/edit in a Dialog (web) / Sheet (mobile) with optimistic insert/update
and rollback-on-failure; delete behind ConfirmDialog with optimistic exit; ProgressRing arc animates
old→new with motion.slow on server-driven progress; ON GOAL COMPLETION fire the shared CelebrationBurst
(spring pop + marigold spark) — the ONLY celebratory burst here, borrowed from the gamification spec;
everything else stays subtle (FOUNDATION §4). Respect prefers-reduced-motion (burst → static badge).

DOMAIN RULES: currentCount is server-authoritative — learner edits only the goal definition, never
progress (goals stay honest). Streak-aligned minutes goals share the gamification streak source.
Tenant-scoped (B2B) vs platform_public (B2C) via LearnerContext; tenantId/userId from auth claim, never
the body. ALL reads/writes via @levelup/api-client (v1.levelup.listStudyGoals / listStudySessions /
saveStudyGoal upsert; v1.analytics.getSummary{scope:'student'}) — never firebase/firestore directly.

A11Y: labeled form fields; keyboard-operable DatePicker; ProgressRing as progressbar with valuenow/
min/max + a "3 of 5 · 60%" label; week-strip cells as buttons with aria-pressed + descriptive labels;
status never color-only (icon+text); WCAG AA contrast; reduced-motion honored; focus trap+return on
dialog/sheet.

COPY (warm, self-directed): subtitle "You set the pace."; empty "Set your first goal — goals are yours
to choose."; overdue "Past your date — no rush, finish strong"; goal-met toast "Goal met! 🎉 You set it,
you crushed it."; delete confirm "Remove this goal? Your study history stays."

Deliver: a responsive React + Tailwind implementation using the shared-ui components, with the three
breakpoints (sm 640 / md 768 / lg 1024) behaving as specified.
```
