# Space Detail / Overview

> The read-oriented landing for a single LevelUp **Space** — header identity
> (title, type, status, access, store/pricing, rating), authoritative key stats,
> the story-point track at a glance, default rubric + default agents summary,
> version / last-published info, and the primary action rail (Edit,
> Publish/Unpublish, Duplicate, Archive, Preview, View analytics). Conforms to
> the Lyceum foundation (`00-FOUNDATION.md`); cite §2/§3/§4/§5 by
> token/component name.

---

## 1. Purpose & primary user

**Primary user — Teacher (content author).** Job-to-be-done: _"Before I dive
into editing, I want to confirm what this Space is, how complete it is, whether
it's published, and jump confidently to the right action."_ This screen is the
**pre-edit landing** — a calm, scannable summary that answers "is this ready?"
and routes to Edit, Preview, Publish, or Analytics without the editor's
cognitive load.

**Secondary user — Tenant Admin (oversight).** Job-to-be-done: _"Audit content
across the tenant read-only — see status, ownership, completeness, and store
exposure without mutating anything."_ Reached from `/content`; the same screen
renders with all mutating actions hidden/disabled (see §5).

**Out of scope for consumers/students:** students never see this view. A
consumer-store equivalent (price, ratings, enroll CTA) is a _separate_ spec;
this screen is staff-facing and never exposes answer keys or unpublished content
to non-staff (see §8).

---

## 2. Entry points & route

**Routes**

- Teacher: `/spaces/:spaceId` (overview tab) — entry from a `SpaceCard` on
  `/spaces`.
- Tenant admin (read-only): `/content/spaces/:spaceId` — entry from the
  ContentOverview table on `/content`.

Both render inside **AppShell** (§5 Navigation: Sidebar + Topbar). Breadcrumb:
`Spaces / {space.title}`.

**Reads (common-api.md, typed read endpoints — UI never touches Firestore
directly):**

- `v1.levelup.getSpace` → full `Space` (header, stats, defaultRubric, default
  agent ids, store fields, ratingAggregate, status, publishedAt, version).
- `v1.levelup.listStoryPoints` → ordered `StoryPoint[]` for the track (title,
  type, difficulty, estimatedTimeMinutes, `stats`).
- `v1.levelup.listVersions` (paginated, lazy) → recent `ContentVersion[]` for
  the "Version & history" card (first page only on this screen; full history is
  its own view).

**Writes (versioned callables — only the status mutations live here; all content
edits happen in the editor):**

- `v1.levelup.saveSpace` with `{ status }` — Publish (`draft→published`),
  Unpublish (`published→draft`), Archive (`published→archived` /
  `draft→archived`), Restore (`archived→draft`). Server enforces
  `ALLOWED_TRANSITIONS` + `validatePublish`.
- **Duplicate** → `v1.levelup.saveSpace` (server-side clone path; new draft
  Space) then navigate to the clone's overview.
- **Edit** → navigate to `/spaces/:spaceId/edit` (SpaceEditorPage).
- **Preview** → navigate to the student-preview route (read-only
  `ContentRenderer` path).
- **View analytics** → navigate to the Space analytics route (separate spec).

`tenantId` is derived **server-side from auth claims** — never sent in the
request body (§8 tenant isolation).

---

## 3. Layout — wireframe-as-text

Inside **AppShell**: left **Sidebar** (role-driven), top **Topbar** (tenant
switcher, ⌘K search, notifications, profile). Content column max-width 1200
(§4), page gutters 32 desktop / 24 tablet / 16 mobile.

```
┌─ AppShell ───────────────────────────────────────────────────────────────┐
│ Sidebar │ Topbar (tenant · ⌘K · notif · profile)                          │
│         ├──────────────────────────────────────────────────────────────  │
│         │ Breadcrumb: Spaces / Algorithms & Data Structures               │
│         │                                                                  │
│         │ ┌─ HEADER BAND (Card, e1, radius lg) ──────────────────────────┐│
│         │ │ [thumb]  H1 Title (Fraunces)            [ Edit ] [ Publish ▾ ]││
│         │ │          Badge:type  Badge:status  Badge:access   [⋯ more]   ││
│         │ │          ★ 4.6 (128)   ·  Store: ₹1,499   ·  v12 · pub 3d ago ││
│         │ │          subject · label · label                             ││
│         │ └──────────────────────────────────────────────────────────────┘│
│         │                                                                  │
│         │ ┌─ KPI ROW (4× Stat/KPI, grid) ───────────────────────────────┐ │
│         │ │ [Story points 6] [Items 142] [Enrolled 38] [Completion 71%] │ │
│         │ └──────────────────────────────────────────────────────────────┘│
│         │                                                                  │
│         │ ┌─ MAIN (lg: 2-col 8/4 grid; md/sm: stacked) ─────────────────┐ │
│         │ │ ┌ Left (col-8) ─────────────┐ ┌ Right (col-4) ────────────┐ │ │
│         │ │ │ Section "Story-point track"│ │ Card "Default rubric"     │ │ │
│         │ │ │  <StoryPointTrack>         │ │  mode · N criteria · src  │ │ │
│         │ │ │   ●─●─●─●─●─●  nodes       │ │  [View rubric]            │ │ │
│         │ │ │   (read-only, type/diff)  │ ├───────────────────────────┤ │ │
│         │ │ │                            │ │ Card "Default agents"     │ │ │
│         │ │ │ Section "Description"      │ │  Tutor · Evaluator        │ │ │
│         │ │ │  <ContentRenderer>        │ │  model · temp             │ │ │
│         │ │ │                            │ ├───────────────────────────┤ │ │
│         │ │ │                            │ │ Card "Version & history"  │ │ │
│         │ │ │                            │ │  v12 · pub 3d ago         │ │ │
│         │ │ │                            │ │  Timeline (last 3)        │ │ │
│         │ │ │                            │ │  [View all versions]      │ │ │
│         │ │ └────────────────────────────┘ └───────────────────────────┘ │ │
│         │ └──────────────────────────────────────────────────────────────┘│
└─────────┴──────────────────────────────────────────────────────────────────┘
```

**Responsive**

- **lg (≥1024):** header band full-width; KPI row 4-up; main as 8/4 two-column
  grid (`gap` 24, §4).
- **md (768–1023):** KPI row 2×2; main collapses to a single column — track +
  description first, then rubric / agents / version cards stacked.
- **sm (<768):** Sidebar → mobile Tabbar; header band stacks (thumb above title;
  actions become a sticky bottom action bar — primary `Edit` + overflow `⋯`);
  KPI row horizontal-scroll snap or 2×2; `StoryPointTrack` renders vertically
  (see §10).

---

## 4. Components used (FOUNDATION §5 only)

- **AppShell, Sidebar, Topbar, Breadcrumb** (Navigation).
- **Card, Panel, Section, Timeline, DefinitionList** (Containers / Data) —
  header band, summary cards, version timeline, rubric/agent key-value
  summaries.
- **Stat/KPI** ×4 — story points, items, enrolled, completion. Numerics in
  `Spline Sans Mono` (§3).
- **Badge** — `type`, `status`, `accessType`. **Chip/Tag** — subject + labels.
- **Button** — `primary` (Edit), `spark` reserved for the publish hero moment
  only (Publish when in draft), `secondary` (Preview, View analytics), `ghost`
  (overflow trigger), `danger` inside ConfirmDialog (Archive). **IconButton** —
  overflow `⋯`.
- **Popover / Menu** — the `Publish ▾` / overflow `⋯` action menu (Duplicate,
  Archive, Unpublish, Restore).
- **ProgressBar** or **ProgressRing** — completion rate inside the Completion
  KPI.
- **StoryPointTrack** + **StoryPointNode** (Domain) — the path at a glance,
  **read-only** here (no drag, no add; nodes are tap-to-navigate-into-editor at
  most).
- **ContentRenderer** (Domain, md+KaTeX) — the Space description; the ONE
  canonical renderer (§ground-truth; no second TipTap path).
- **RubricBreakdown** (Domain, summary variant) — default rubric mode + criteria
  count + inheritance source.
- **GradePill / Badge** — rubric scoring-mode label; **ConfidenceBadge** is
  _not_ used here (no evaluation results on this screen).
- **EmptyState, Skeleton, InlineAlert/Banner, Toast (sonner), ConfirmDialog,
  LoadingOverlay** (Data / Feedback).
- **Avatar** — `createdBy` / owner identicon in the version card.
- **AnswerKeyLock** (Domain) — only referenced indirectly: this screen never
  surfaces keys; a small lock affordance on `timed_test` nodes signals "keys are
  server-only" (see §8).

_No proposed additions to FOUNDATION required — the screen composes entirely
from §5._

---

## 5. States

**Loading (skeleton).** Header band → Skeleton title bar + 3 badge pills +
action-button placeholders. KPI row → 4 Skeleton stat cards. Track → Skeleton
row of 5–6 node circles. Right column → 3 Skeleton cards. No layout shift on
resolve.

**Empty (sub-regions, not whole screen).**

- No story points yet: `StoryPointTrack` region shows **EmptyState** — title "No
  story points yet", body "Add your first story point to start building the
  path.", primary `Edit Space`.
- No description: muted inline "No description added."
- No default rubric: rubric card shows "No default rubric — items inherit from
  tenant." (inheritance note, §8).
- No agents configured: agent card shows "Using tenant defaults — no Space-level
  tutor or evaluator set."
- Store not published: store row omitted; a subtle "Not in store" chip if
  `accessType = public_store` but `publishedToStore` is false.

**Error.** `getSpace` failure → full-screen **EmptyState** (error variant):
"Couldn't load this Space", `status.error` icon, `Retry` + `Back to Spaces`.
Partial failures (e.g. `listVersions` fails but `getSpace` succeeds) → scope the
failure to that card with an **InlineAlert** ("Couldn't load version history ·
Retry") so the rest of the page stays usable.

**Partial.** `getSpace` resolved but `listStoryPoints` still pending → header +
KPIs render; track shows its own skeleton. Stats are **server-authoritative**
(trigger-maintained) — never recompute counts client-side; if `space.stats` is
absent, show "—" not a client count.

**Success.** Fully populated as in §3.

**Permission-gated variations**

- **Teacher (owner / `teacherIds` includes me):** all actions enabled.
  Publish/Unpublish/Archive/Duplicate/Edit/Preview/Analytics available per
  status (see §6 transition map).
- **Teacher (not owner):** read-only unless tenant policy grants edit; mutating
  actions hidden, `Preview` + `View analytics` remain.
- **Tenant Admin (read-only ContentOverview):** header shows an `InlineAlert`
  "Read-only — content overview." All mutating buttons hidden; only
  `View analytics` (and `Preview` if policy allows) remain. Owner attribution
  (`createdBy`, `teacherIds`) is surfaced for audit.
- **Student / consumer:** no access to this route (route-guarded). N/A.

---

## 6. Interactions & motion

**Status transitions (the core interaction).** Buttons reflect the live `status`
and `ALLOWED_TRANSITIONS`:

- `draft` → `Publish` (**spark** button, the one celebratory CTA) + overflow
  `Archive`.
- `published` → `Unpublish` (secondary) + overflow `Archive`.
- `archived` → `Restore to draft` (secondary). No direct archive→published.

**Publish flow.** Click `Publish` → call `saveSpace { status: 'published' }`.
Server runs `validatePublish`. On success: status Badge animates draft→published
(color cross-fade `base` 220ms, `ease.standard`), a single **spark** burst
micro-moment on the badge (marigold, §2 `spark`; the ONE gamified pop, §4),
Toast "Space published". `publishedAt` + `version` refresh from the response. On
`validatePublish` failure: **ConfirmDialog**-style error or InlineAlert listing
blockers (e.g. "Add at least one story point", "Resolve 2 items missing answer
keys") — do **not** optimistically flip the badge.

**Unpublish / Archive.** Both are guarded by **ConfirmDialog** (Archive uses
`danger` confirm): "Archive 'Algorithms & Data Structures'? Students lose access
until you restore it." On confirm → `saveSpace`, Toast, status badge updates.
Archive is reversible (Restore), so framed as recoverable, not
destructive-permanent.

**Optimistic updates.** Status changes update the badge **after** the callable
resolves (status is a gated server decision — do not pre-flip). Non-gated,
idempotent UI (e.g. re-fetch of versions) may refresh in place. Stats are never
optimistically edited (trigger-owned).

**Duplicate.** Overflow → `Duplicate` → LoadingOverlay on the action menu while
`saveSpace` clones → navigate (`page` 420ms route transition, `ease.entrance`)
to the new draft's overview + Toast "Duplicated as draft".

**Navigation feedback.** `Edit`, `Preview`, `View analytics`, and tapping a
`StoryPointNode` route away with the standard `page` transition. Hover on cards:
`e1→e2` elevation lift over `fast` 160ms (desktop only).

**Reduced motion.** `prefers-reduced-motion` disables the spark burst and
elevation lifts; status change becomes an instant swap with the Toast still
announced (§9).

---

## 7. Content & copy

Tone: **precise for staff** — declarative, no fluff.

- **H1:** `{space.title}` (Fraunces, §3).
- **Badges:** Type — `Learning` / `Practice` / `Assessment` / `Resource` /
  `Hybrid`. Status — `Draft` / `Published` / `Archived`. Access —
  `Class-assigned` / `Tenant-wide` / `Public store`.
- **Store row:** `★ {ratingAggregate.average} ({ratingAggregate.count})` ·
  `Store: {currency}{price}` · `In store` / `Not in store`.
- **Version line:** `v{version} · Published {relativeTime}` or
  `v{version} · Draft — never published`.
- **KPI labels:** "Story points", "Items", "Enrolled", "Completion" (value
  `{avgCompletionRate}%`).
- **Section titles:** "Story-point track", "Description", "Default rubric",
  "Default agents", "Version & history".
- **Rubric card:** "Scoring mode: Criteria-based · 5 criteria · inherited from
  Space" (or "from Tenant").
- **Agents card:** "Tutor: Socratic (gemini-1.5-pro, temp 0.7)", "Evaluator:
  Strict (gemini-1.5-flash, temp 0.2)", or "Using tenant defaults".
- **Empty states:** "No story points yet — Add your first story point to start
  building the path." · "No description added." · "No default rubric — items
  inherit from tenant."
- **Error copy:** "Couldn't load this Space. Check your connection and try
  again." · "Couldn't load version history."
- **Confirms:** Archive — "Archive '{title}'? Students lose access until you
  restore it." · Unpublish — "Unpublish '{title}'? It returns to draft and is
  hidden from students."
- **Publish-block copy (validatePublish):** "Can't publish yet:" + bulleted
  blockers.
- **Toasts:** "Space published" · "Returned to draft" · "Space archived" ·
  "Duplicated as draft".

---

## 8. Domain rules surfaced

- **Answer keys are never shown.** This is a read-overview; for `timed_test`
  story points, correct answers live in the server-only `answerKeys`
  subcollection that `firestore.rules` denies to all clients. The screen shows
  neither keys nor key contents; a small **AnswerKeyLock** affordance on
  `timed_test` nodes communicates "keys are server-protected". Even the teacher
  only re-merges keys inside the editor via `getItemForEdit` — not here.
- **Status transitions are server-gated.** Only `ALLOWED_TRANSITIONS`
  (draft→published, published→{archived,draft}, archived→draft) are offered;
  `validatePublish` runs server-side and its failures are surfaced verbatim —
  the UI never bypasses the gate.
- **Rubric inheritance chain.** The default-rubric card always states its
  **source** in the tenant → space → storyPoint → item chain (e.g. "inherited
  from Tenant" when the Space has no `defaultRubric`), so authors understand
  what items will resolve to (`resolveRubric`).
- **Stats are authoritative.** `space.stats` (story points, items, enrolled,
  completion) and `storyPoint.stats` are trigger-maintained; the UI displays
  them as-is and never recomputes counts client-side.
- **Tenant isolation.** Every read/write is tenant-scoped; `tenantId` is derived
  from auth claims server-side, never from the URL or request body. Tenant admin
  sees only their tenant's Spaces.
- **Store exposure.** Store/pricing/rating fields render only when
  `accessType = public_store`; `publishedToStore` gates the "In store" badge
  independent of `status`.
- **Server-authoritative timers / assessment config** are summarized read-only
  on `timed_test` / `quiz` nodes (duration, attempts) — configuration happens in
  the editor, not here.

---

## 9. Accessibility

- **Focus order:** Breadcrumb → header actions (Edit → Publish/Unpublish →
  overflow ⋯) → KPI cards (each a labelled region, not a tab stop unless
  interactive) → track nodes (each focusable, `Enter` navigates) → right-column
  card links (View rubric, View all versions). Logical top-to-bottom,
  left-to-right within the grid.
- **Keyboard:** all actions reachable via Tab/Shift-Tab; overflow menu is a
  proper menu (`role="menu"`, arrow-key navigation, `Esc` closes, focus returns
  to trigger). ConfirmDialog traps focus and `Esc` cancels. ⌘K opens the global
  CommandPalette (Topbar).
- **ARIA:** H1 is the document landmark heading; KPIs use `role="group"` with
  `aria-label` ("Story points: 6"). Status change announced via
  `aria-live="polite"` region + Toast. Track is `role="list"`, nodes
  `role="listitem"` / link with descriptive `aria-label` ("Story point 3:
  Sorting — quiz, medium difficulty"). The AnswerKeyLock affordance has an
  accessible label "Answer keys are server-protected".
- **Contrast:** all text/badge pairs meet WCAG AA (4.5:1 body, 3:1 large/UI) per
  §2; badge text on tinted fills uses the verified semantic pairs.
- **Never status-by-color-alone (§2):** every status/type/access/difficulty
  Badge pairs an **icon + text label** with its color. Completion
  ProgressBar/Ring shows the numeric `%` alongside the fill.
- **Reduced motion:** spark burst and elevation lifts suppressed under
  `prefers-reduced-motion`; status swaps instantly; live-region announcements
  remain.

---

## 10. Web ↔ mobile divergence

Shared component **names/props match 1:1** between `shared-ui` (web) and
`ui-native` (RN); only the renderer differs (§6 cross-platform rule).

- **Shell:** web Sidebar+Topbar → mobile Tabbar + compact header; tenant
  switcher moves into a profile sheet.
- **Header actions:** web inline button row + `Publish ▾` Popover → mobile
  **sticky bottom action bar** (primary `Edit`) + `⋯` **Drawer/Sheet** for
  Publish/Duplicate/Archive.
- **StoryPointTrack:** web horizontal path → mobile **vertical** track
  (top-to-bottom nodes) for thumb-scrolling; nodes are **press** targets (≥44px,
  §4) instead of hover.
- **KPI row:** web 4-up grid → mobile 2×2 grid or horizontal snap-scroll.
- **Main grid:** web 8/4 two-column → mobile single stacked column (track →
  description → rubric → agents → version).
- **Hover → press:** elevation-lift hover affordances are desktop-only; mobile
  uses press feedback.
- **⌘K absent** on mobile (no CommandPalette); navigation via Tabbar + back.
- **Confirms:** web ConfirmDialog (centered modal) → mobile bottom Sheet
  confirm.
- **Toast (sonner)** → native toast/snackbar equivalent in `ui-native`.

---

## 11. Claude-design prompt (ready to paste)

```
You are designing the "Space Detail / Overview" screen for Auto-LevelUp, a multi-tenant
EdTech platform. STRICTLY conform to the Lyceum design system in
docs/rebuild-spec/design/00-FOUNDATION.md — use ONLY its semantic color tokens
(§2: bg.canvas/surface, text.primary/secondary/muted, brand.primary, spark,
status.success/warning/error/info, plus domain scales grade.*/mastery.*/confidence.*),
typography (§3: Fraunces display for h1–h3 and the title; Schibsted Grotesk for UI/body/
buttons/labels; Spline Sans Mono for all numerics/stats/version ids), spacing/radius/
elevation/motion (§4), and components (§5). Do NOT invent colors, fonts, spacing, radii,
shadows, or component names.

SCREEN: A staff-facing, read-oriented overview of one LevelUp Space, rendered inside
AppShell (Sidebar + Topbar + Breadcrumb "Spaces / {title}"), content max-width 1200,
desktop gutter 32.

BUILD THESE REGIONS:
1. Header band (Card, elevation e1, radius lg): thumbnail, H1 title (Fraunces), a row of
   Badges for type (Learning/Practice/Assessment/Resource/Hybrid), status
   (Draft/Published/Archived), and access (Class-assigned/Tenant-wide/Public store) —
   each badge pairs an icon + text label, never color alone. Below: store row
   (★ rating (count) · price · In store) and a version line "v12 · Published 3d ago".
   Right-aligned actions: primary "Edit" button; a spark-styled "Publish" button when
   status is Draft (the single celebratory CTA), else secondary "Unpublish"; an overflow
   "⋯" menu with Duplicate / Archive / Restore.
2. KPI row: four Stat/KPI cards — Story points, Items, Enrolled, Completion (Completion
   shows a ProgressBar + numeric %). Numerics in Spline Sans Mono.
3. Main area, lg 2-column grid 8/4 (stacks on md/sm):
   - Left: Section "Story-point track" rendering a READ-ONLY StoryPointTrack of
     StoryPointNodes (show type + difficulty; timed_test nodes show a small lock
     affordance meaning "answer keys are server-protected"); Section "Description"
     rendered via the single ContentRenderer (Markdown + KaTeX).
   - Right: Card "Default rubric" (scoring mode + criteria count + inheritance source,
     e.g. "inherited from Tenant"); Card "Default agents" (Tutor + Evaluator with model +
     temperature, or "Using tenant defaults"); Card "Version & history" with a short
     Timeline (last 3 ContentVersions) and "View all versions".

REQUIREMENTS:
- Provide loading (Skeleton), scoped empty states ("No story points yet", "No description
  added", "No default rubric — items inherit from tenant"), and an error EmptyState with
  Retry.
- Status changes are SERVER-GATED: only offer draft→published, published→{archived,draft},
  archived→draft. Publish triggers a single spark micro-burst on the status badge
  (suppressed under prefers-reduced-motion); Archive/Unpublish use a ConfirmDialog.
- NEVER show answer keys (timed_test keys are server-only). Stats are server-authoritative
  — display them, never recompute. tenantId is server-derived, not in the UI.
- WCAG AA contrast; full keyboard nav; aria-live status announcements; never status-by-
  color-alone. Motion uses §4 tokens (fast 160 / base 220 / page 420; ease.standard,
  ease.entrance).
- Also provide the mobile variant: bottom action bar + ⋯ Sheet, vertical StoryPointTrack,
  2×2 KPI grid, press instead of hover, no ⌘K.

Deliver clean, accessible React + Tailwind (tokens via @theme CSS variables) composing the
shared-ui components named above. Match the editorial, precision-instrument Lyceum tone.
```
