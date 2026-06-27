# Global Evaluation Presets — List + Create/Edit Preset

> **Area:** Admin (super-admin control plane) · **Route:** `/presets` ·
> **Audience:** `superAdmin` Conforms to **Lyceum** foundation
> (`docs/rebuild-spec/design/00-FOUNDATION.md`). Tokens are cited by semantic
> name only; no hex is re-pasted. Register: the **serious /
> precision-instrument** end of Lyceum (restraint in chrome, no gamification
> spark, no student warmth — this is staff tooling).

---

## 1. Purpose & primary user

**Primary user:** Platform **super-admin** — the only role that can reach this
screen. Identity is the `isSuperAdmin === true` flag on `/users/{uid}` plus the
verified custom-claim path (`role === "superAdmin"`). This user has **no
`tenantId` scope**; they operate **cross-tenant** on the platform control plane.
Tenant admins and all lower roles never see this route.

**Job-to-be-done:** "Let me define and maintain a small library of reusable **AI
grading / evaluation rubric presets** — which evaluation **dimensions**
(Clarity, Accuracy, Depth, Grammar, Relevance, Critical Thinking) are on, how
each is **weighted**, and how feedback is **displayed** — so that every tenant
on the platform can adopt a known-good, consistent rubric instead of
hand-rolling their own. Let me mark one as the platform **default** and control
which presets are **public** (visible to all tenants)."

This is a **curation / standards** screen, not a per-submission grading screen.
It governs the `EvaluationSettings` / `EvaluationDimension` shape (autograde
domain) that the grading pipeline and the `RubricBreakdown` domain component
consume downstream. It is **global**: a preset created here is a platform-wide
artifact stored in the top-level `evaluationSettings` collection, **not** scoped
to any tenant.

---

## 2. Entry points & route

**Route:** `/presets` — lazy-loaded, wrapped by `RequireAuth` (super-admin
guard) → `AppShell` (`AppSidebar` "Global Presets" item under the **Platform**
nav group; active state = `brand.primary`).

**Entry points:**

- Sidebar "Global Presets" nav item.
- `⌘K` command palette (web only): "Create evaluation preset", "Go to presets".
- Settings (`/settings`) may cross-link here as "Manage evaluation presets".

**Common-API reads/writes** (per `specs/common-api.md` — the rebuild routes
**all** reads through the typed client; **no direct `firebase/firestore`
`getDocs(collection(db,"evaluationSettings"))` in the page**, unlike today's
`GlobalPresetsPage.tsx:192-204`):

| Action                 | Callable (registry name)                                                              | Notes                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Create / update preset | `v1.identity.saveGlobalEvaluationPreset`                                              | The named super-admin callable (`common-api.md` §3.3, identity module). `save*` upsert: **no `id`** ⇒ create branch; `id` present ⇒ update. Writes `evaluationSettings/{id}`. Server-authoritative; rate-limited (`rateTier: write`); audited (`writePlatformActivity` → `platformActivityLog`). Maps directly from today's `callSaveGlobalEvaluationPreset({ id?, data })`. |
| Delete preset          | `v1.identity.saveGlobalEvaluationPreset`                                              | Same callable, `{ id, delete: true }` (matches current `GlobalPresetsPage.tsx:264`). See §8 — recommend this become a **soft archive** server-side, not a hard delete, given downstream tenant references.                                                                                                                                                                   |
| List presets           | `v1.identity.listGlobalEvaluationPresets` _(proposed read endpoint — see flag below)_ | Returns the platform-wide list of `EvaluationSettings`, ordered by `name asc`. Replaces the current direct-Firestore scan.                                                                                                                                                                                                                                                   |

**Proposed foundation/API addition (flag):** `app-super-admin.md` §5.1 mandates
moving platform reads behind callables; the common-API inventory names
`saveGlobalEvaluationPreset` but **does not yet name a list-read endpoint**.
This spec assumes and flags `v1.identity.listGlobalEvaluationPresets` as a
**required new contract entry** (`module: identity`, `authMode: authed`,
super-admin only, `rateTier: read`, request = `PageRequest` [presets are few —
pagination optional, may return full set], response =
`pageResponse(EvaluationSettings)`). The client validates the response against
the shared `EvaluationSettings` Zod schema at the boundary (no
`as EvaluationSettings` cast — closes the type-erosion gap in
`app-super-admin.md` §4.13).

**Server-canonical dimension catalog (flag):** today the six dimensions
(`DEFAULT_DIMENSIONS`, `GlobalPresetsPage.tsx:43-116`) are **hardcoded in the
client**. Recommend the canonical dimension catalog
(`id, name, description, priority, promptGuidance, scoringScale, default-enabled`)
live server-side and be returned by a small read
(`v1.identity.getEvaluationDimensionCatalog`) so the editor renders from one
source of truth and `promptGuidance` is never authored ad-hoc in the browser.

---

## 3. Layout — wireframe-as-text

Rendered inside **AppShell** (`§5 Navigation`): persistent left **Sidebar**
(role-driven nav, "Global Presets" active) + **Topbar** (tenant switcher is
**hidden/disabled** for super-admin platform routes — there is no active tenant
here; search, notifications, profile remain). Page content sits in the AppShell
main region with desktop gutter `space.8` (32) and `max content width 1200`.

### Region map

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ AppShell Topbar  ·  (no tenant switcher on platform routes) · search · ⌘K · ●  │
├────────────┬─────────────────────────────────────────────────────────────────┤
│            │  PAGE HEADER                                                       │
│  Sidebar   │  ┌────────────────────────────────────────────────────────────┐  │
│            │  │ Global Evaluation Presets               [ + Create preset ] │  │
│  Overview  │  │ Reusable AI-grading rubric presets available to all tenants │  │
│ ▸Platform  │  └────────────────────────────────────────────────────────────┘  │
│   Tenants  │                                                                    │
│ ▸ Global   │  [ search presets… ]            (count: 6 presets · 1 default)     │
│   Presets  │                                                                    │
│   LLM Usage│  PRESET LIST  (stacked cards, gap space.3)                         │
│   …        │  ┌────────────────────────────────────────────────────────────┐  │
│  System    │  │ Standard RELMS Rubric   [Default] [Public]      [✎] [🗑]    │  │
│            │  │ Balanced rubric for written long-answer grading.            │  │
│            │  │ DIMENSIONS                                                   │  │
│            │  │ ◆Clarity  ◆Accuracy 2× ◆Depth  ◇Grammar  ◆Relevance         │  │
│            │  │ ● Strengths   ● Key takeaway   ○ Priority sort               │  │
│            │  └────────────────────────────────────────────────────────────┘  │
│            │  ┌────────────────────────────────────────────────────────────┐  │
│            │  │ Concise Feedback Rubric          [Public]       [✎] [🗑]    │  │
│            │  │ …                                                           │  │
│            │  └────────────────────────────────────────────────────────────┘  │
└────────────┴─────────────────────────────────────────────────────────────────┘
```

### Create / Edit — right **Drawer/Sheet** (preferred over center Modal)

The form is long (name, description, two flags, three display toggles, six
weighted dimension rows). Lyceum `§5` offers both Drawer/Sheet and Modal/Dialog.
**Use Drawer/Sheet anchored right** (width `min(560px, 100vw)`, elevation `e3`,
scrim) so the preset list stays visible behind it for reference — better for a
"compare while editing" curation task than today's center `Dialog`
(`GlobalPresetsPage.tsx:437`). Internal layout:

```
┌── Drawer: Create preset / Edit “Standard RELMS Rubric” ──────────────┐
│ Header: title + close (✕)                                            │
│ ─ scrollable body (space.5 between groups) ─────────────────────────│
│  Name *            [ Standard RELMS Rubric                        ]  │
│  Description       [ Optional…                                    ]  │
│                                                                     │
│  ◻ Set as default preset                                            │
│  ◻ Public (visible to all tenants)                                  │
│                                                                     │
│  DISPLAY SETTINGS            (Panel, border.subtle, radius lg)       │
│   ◻ Show strengths   ◻ Show key takeaway   ◻ Prioritize by import.  │
│                                                                     │
│  EVALUATION DIMENSIONS       (Panel)                                 │
│   ◻ Clarity   — communicates ideas clearly        Weight [ 1 ]      │
│   ◻ Accuracy  — factual correctness               Weight [ 2 ]      │
│   ◻ Depth     — thoroughness / detail              Weight [ 1 ]      │
│   ◻ Grammar   — language correctness               Weight [ 1 ]      │
│   ◻ Relevance — addresses the question             Weight [ 1 ]      │
│   ◻ Critical Thinking — reasoning quality          Weight [ – ]     │
│                                                                     │
│  [inline error banner if submit fails]                              │
│ ─ sticky footer ───────────────────────────────────────────────────│
│                                   [ Cancel ]   [ Save preset ]      │
└─────────────────────────────────────────────────────────────────────┘
```

### Responsive

- **lg (≥1024) / xl:** as drawn. Sidebar persistent; preset list single column
  at `max-width 720` reading measure for the description text, card spans the
  content column; drawer overlays right at 560px.
- **md (768–1023):** Sidebar collapses to icon rail or off-canvas (AppShell
  behavior). Preset cards full content width. Drawer becomes near-full-width
  (`min(560px,100vw)`) right sheet.
- **sm (<768):** Admin is desktop-first (see §10) but must not break. Sidebar →
  off-canvas + mobile bottom-nav. Cards stack; dimension chips wrap. The
  create/edit surface becomes a **bottom Sheet** (full-width, ≤90vh, internal
  scroll). Dimension rows: the inline description
  (`— communicates ideas clearly`) hides on `sm` (matches current
  `hidden sm:inline`, `GlobalPresetsPage.tsx:590`); name + weight stepper
  remain. Weight inputs and checkboxes keep ≥44px touch targets.

---

## 4. Components used (FOUNDATION §5 only)

**Navigation:** `AppShell` (sidebar + topbar), `Sidebar`, `Topbar`, `Breadcrumb`
(Platform › Global Presets), `CommandPalette` (⌘K, web only).

**Containers:** `Card` (one per preset in the list), `Panel` (Display Settings
group, Dimensions group inside the editor), `Drawer/Sheet` (create/edit
surface), `ConfirmDialog` (delete — see Feedback), `Tooltip` (weight /
dimension-priority hints).

**Primitives:** `Button` (`primary` = "Create preset" / "Save preset";
`secondary`/`ghost` = "Cancel"; `danger` = "Delete"; **no `spark` variant** —
this is the serious register), `IconButton` (row edit ✎ / delete 🗑, `ghost`),
`Input` (name; numeric weight stepper, min 1 max 5), `Textarea` (description),
`Checkbox` (`isDefault`, `isPublic`, three display toggles, per-dimension
enable).

**Data:** `Badge` — **Default** badge (`brand.primary` subtle fill) and
**Public** badge (`status.success` subtle fill) on each card; `Chip/Tag` — one
per dimension in the card summary (enabled = `brand.primary` / indigo subtle
outline + optional `Nx` weight suffix; disabled = `text.muted`, strikethrough;
never color-only — see §9); `Skeleton` (loading); `EmptyState` (no presets);
`DefinitionList` could render the strengths/key-takeaway/priority row as labeled
status dots.

**Feedback:** `Toast` (sonner — save/delete success), `InlineAlert/Banner`
(list-load error; in-form submit error), `ConfirmDialog` (delete confirmation),
`FormFieldError` (per-field validation), `LoadingOverlay` (optional, on the
drawer during save).

**Domain components:** `RubricBreakdown` (cross-app, `§5`) is **referenced** as
a read-only **preview** inside the editor drawer — render the in-progress
dimensions/weights through the same component the grading UI uses, so the admin
sees exactly how this preset will surface in `ResultSummary` downstream.
`ConfidenceBadge` / `GradePill` are **not** used here (no live submissions on
this screen).

**No new component variants are introduced.** The only deviation from today's
code is swapping the center `Dialog` for `Drawer/Sheet` and the raw ad-hoc
colored `<span>` pills for the inventory `Chip/Tag` + `Badge` — both already in
`§5`, so this is conformance, not addition.

---

## 5. States

**Loading (skeleton):** Page header renders immediately (static). Below it, **3
`Skeleton` cards** matching the preset-card shape — a title bar (`h-5 w-48`), a
description line (`h-4 w-64`), and a row of 4 pill-shaped dimension skeletons
(mirrors `GlobalPresetsPage.tsx:304-318`). Shimmer uses `bg.surface-sunken`; no
spinner.

**Empty (no presets):** Centered `EmptyState` — `Sliders` icon in a `bg.inset`
circle, **Fraunces** title "No global presets yet", secondary line, and a
`secondary` "Create preset" button. (See §7 copy.)

**Error (list load failed):** `InlineAlert/Banner` (`variant=error`,
`status.error`) above the list with an `AlertCircle` icon, the error message,
and an inline **"Try again"** ghost/link button that re-runs the read (mirrors
`GlobalPresetsPage.tsx:291-302`). The page header and Create action remain
usable.

**Partial:** Presets loaded but one card has a malformed/legacy
`enabledDimensions` array (missing fields from schema drift). Render the card
with whatever validates; show a small `status.warning` chip "Legacy rubric —
re-save to update" instead of crashing. A preset with **zero enabled
dimensions** renders a `status.warning` hint "No dimensions enabled — grading
will use platform fallback" (it is still saveable; flag, don't block).

**Success:** The stacked list of preset cards. Each card shows name +
**Default**/**Public** badges, optional description, the dimension chip set
(enabled vs disabled, with `Nx` weight where ≠1), and the three display-setting
status dots. Hover raises the card from `e1` → `e2` (motion `fast`).

**Submit (drawer) states:** idle → submitting (footer **Save preset** →
"Saving…", disabled; Cancel disabled) → success (drawer closes, toast, list
re-validates & re-orders by name) → error (`InlineAlert` inside the drawer body,
drawer stays open, fields preserved).

**Permission-gated variations by role:** This route is **super-admin-only** end
to end. There is no "tenant-admin read-only" variation — a tenant admin who
somehow reaches `/presets` is **denied by `RequireAuth`** and never renders the
page (redirect to login / 403). So there is exactly one rendered variation; the
access decision is binary and server-enforced (the callable re-checks
`isSuperAdmin` regardless of client routing).

---

## 6. Interactions & motion (uses §4 motion tokens)

**Open create:** "Create preset" → form resets to server-default dimension state
→ **Drawer slides in from right** over `base` (220ms) `ease.entrance`; scrim
fades `fast`. Focus moves to the **Name** field. Respect
`prefers-reduced-motion` → drawer **fades** in place (no slide),
`instant`/`fast`.

**Open edit:** Row `IconButton` (✎) → form hydrates from the selected
`EvaluationSettings` (`presetToFormValues`), drawer slides in, header reads
"Edit '{name}'". Same motion.

**Toggle a dimension:** Unchecking a dimension dims the row (`text.muted`) and
**disables its weight input** (`fast` color transition; matches current
`disabled={!isEnabled}` at `GlobalPresetsPage.tsx:609`). The live
`RubricBreakdown` preview re-weights instantly. Weight is a 1–5 stepper Input;
out-of-range coerces to 1.

**Optimistic updates:** **Avoid optimistic mutation** for save/delete here —
these are server-authoritative, audited, low-frequency, low-latency curation
writes. On submit, show the in-drawer pending state, await the callable, then
`invalidate`/re-read the list (matches today's `invalidateQueries`,
`GlobalPresetsPage.tsx:250`). New/edited card animates in / reorders with a
`base` `ease.standard` position transition. This keeps the list provably
consistent with server state (no flicker-then-revert on a rules rejection).

**Save feedback:** success `Toast` (sonner, bottom): "Preset saved." Drawer
closes `fast` `ease.exit`. If the saved preset was marked **default**, the
previously-default card's badge clears on re-read (server enforces
single-default — see §8).

**Delete flow:** Row `IconButton` (🗑, `danger`) → **`ConfirmDialog`** (center
modal, `e3`): "Delete '{name}'?" → confirm runs
`saveGlobalEvaluationPreset({ id, delete:true })` with a pending "Deleting…"
state → success `Toast` "Preset deleted." → card animates out (`fast`,
`ease.exit`, height collapse). Cancel closes with no effect. Delete is **never**
one-click; it always passes through the confirm step.

**Default-reassignment confirmation:** if the admin marks a preset default while
another is already default, the Save action surfaces an inline note ("This will
replace 'Standard RELMS Rubric' as the platform default.") so the side effect is
explicit, not silent.

All motion stays in the **subtle** band — no spring, no marigold burst. The one
celebratory Lyceum moment is reserved for student gamification and must **not**
appear in admin tooling.

---

## 7. Content & copy (precise admin tone)

**Page header**

- Title (Fraunces): **Global Evaluation Presets**
- Description: **Reusable AI-grading rubric presets available to every tenant.
  Mark one as the platform default and choose which presets are public.**
- Primary action button: **Create preset**

**List meta line:** `{n} presets · {m} default` (e.g. "6 presets · 1 default").

**Card**

- Badges: **Default**, **Public**
- Dimensions group label (overline, uppercase, `text.muted`): **Dimensions**
- Display-setting dots: **Strengths**, **Key takeaway**, **Priority sort**
- Weight suffix on a chip: **2×** (only shown when weight ≠ 1 and dimension
  enabled)
- Row actions (aria-labels): **Edit preset**, **Delete preset**

**Empty state**

- Title (Fraunces): **No global presets yet**
- Body: **Create an evaluation preset to give tenants a consistent, ready-to-use
  grading rubric.**
- Button: **Create preset**

**Create/Edit drawer**

- Header: **Create preset** / **Edit "{name}"**
- Subhead: **Configure a reusable evaluation rubric.** / **Update this
  evaluation preset.**
- Field labels: **Name \*** (placeholder "e.g. Standard RELMS Rubric"),
  **Description** (placeholder "Optional — when to use this rubric")
- Flags: **Set as default preset**, **Public (visible to all tenants)**
- Group header: **Display settings** → **Show strengths**, **Show key
  takeaway**, **Prioritize by importance**
- Group header: **Evaluation dimensions** · per row: dimension name, em-dash
  description, **Weight** stepper
- Footer: **Cancel**, **Save preset** (pending: **Saving…**)

**Validation copy**

- Name required: **Preset name is required.**
- Weight range: **Weight must be between 1 and 5.**
- Zero enabled (non-blocking warn): **No dimensions enabled — grading will fall
  back to platform defaults.**

**Error copy**

- List load failed (banner): **Couldn't load evaluation presets.** + **Try
  again**
- Submit failed (in-drawer): **Couldn't save preset. {server message}** (surface
  the server-authoritative message verbatim, e.g. a rules/permission rejection.)

**Delete confirm**

- Title: **Delete preset?**
- Body: **Delete "{name}"? Tenants currently using it will fall back to their
  own rubric. This can't be undone.** (If soft-archive is adopted per §8, change
  to "This preset will be archived and hidden from new tenants.")
- Confirm: **Delete** · Cancel: **Cancel**

---

## 8. Domain rules surfaced

- **Cross-tenant scope (not tenant-isolated by storage, gated by role).**
  Presets are **global** — stored in the top-level `evaluationSettings`
  collection, deliberately **outside** any `tenants/{id}` subtree. They are the
  one legitimate cross-tenant authoring surface, which is precisely why **only
  super-admin** may write them. Tenant isolation is preserved by **RBAC at the
  API**, not by data partition: `saveGlobalEvaluationPreset` re-asserts
  `isSuperAdmin` server-side and `firestore.rules` gates `evaluationSettings` on
  `isSuperAdmin()` (`app-super-admin.md` §2.4). The client guard is convenience;
  the server is authoritative.
- **Public flag governs tenant visibility.** `isPublic === true` ⇒ the preset is
  selectable by all tenants' grading config; `false` ⇒ platform-internal /
  draft. Toggling public is a deliberate, audited act.
- **Single platform default.** At most one preset may be `isDefault`. The
  **server** enforces single-default (clearing the prior default in the same
  transaction); the UI must not assume client-side exclusivity. Surface the
  reassignment explicitly (§6).
- **Server-authoritative values & audit logging.** Every create/update/delete
  goes through the callable, is rate-limited, and writes a `platformActivityLog`
  entry (`writePlatformActivity`) — preset governance is an auditable platform
  action. The dimension `promptGuidance` strings (which steer the AI grader) are
  security-relevant prompt content and should be **server-validated/canonical**,
  not free-authored client-side.
- **Answer-key isolation (untouched).** A rubric preset defines **how** answers
  are evaluated (dimensions, weights, feedback display) — it **never** contains
  or exposes answer keys. Answer keys live in the server-only subcollection and
  are stripped at write (`common-api.md` `saveItem`). This screen has no access
  to and never renders any answer key (`AnswerKeyLock` invariant holds trivially
  here).
- **Delete safety (recommendation, flag).** A hard delete of a preset that
  tenants reference creates dangling references. Recommend the callable
  implement **soft archive** (`status: 'archived'`, hidden from new adoption,
  existing references preserved) consistent with the platform's soft-lifecycle
  philosophy (`app-super-admin.md` §3.5 / §5.5). The UI copy should reflect
  whichever the server commits to.
- **Schema-validated reads.** Responses validate against the shared
  `EvaluationSettings` Zod schema at the client boundary; legacy/drifted docs
  are rendered defensively (§5 Partial), not cast blindly.

---

## 9. Accessibility (WCAG AA)

- **Focus order (list):** Skip-to-content → Sidebar → page header → Create
  button → list-search → each preset card (card actions Edit then Delete) in DOM
  order. Roving focus is linear and visible.
- **Focus order (drawer):** On open, focus moves to **Name**. Tab cycles through
  fields → display toggles → each dimension's checkbox then its weight input →
  Cancel → Save. **Focus is trapped** in the drawer; `Esc` closes (equiv.
  Cancel) and **returns focus** to the triggering row button. The
  `ConfirmDialog` traps focus on the **Cancel** control (safer default for a
  destructive action).
- **Keyboard:** All interactive elements reachable and operable by keyboard.
  Checkboxes toggle on `Space`; weight stepper supports ↑/↓ and typed entry;
  buttons activate on `Enter`/`Space`. ⌘K palette is keyboard-first (web only).
- **ARIA:** Drawer = `role="dialog"` `aria-modal="true"` with `aria-labelledby`
  → header. Each preset card is a group with an accessible name = preset name.
  Row icon-buttons carry `aria-label="Edit preset"` / `"Delete preset"`
  (icon-only — labels required). Display-setting dots and dimension chips have
  **text labels beside them** so state is never conveyed by the dot/chip color
  alone. The list-load error banner is `role="alert"`; the "Saving…" /
  "Deleting…" pending states set `aria-busy` and are announced.
- **Status never by color alone (§2 rule):** **Default**/**Public** are word
  badges, not just colored fills. Enabled vs disabled dimensions differ by
  **icon/affordance + strikethrough text + the word**, not hue alone. The
  strengths/key-takeaway/priority indicators pair the dot with its text label
  and an on/off affordance.
- **Contrast:** All text/badge/chip pairs meet AA — body 4.5:1, large/UI 3:1 —
  using the semantic tokens (`brand.primary`, `status.success`,
  `status.warning`, `status.error`, `text.muted` on `bg.surface`). The subtle
  indigo/green badge fills are validated against their text foreground.
- **Reduced motion:** `prefers-reduced-motion` ⇒ drawer/sheet **fades** rather
  than slides; card enter/exit and reorder use opacity only; no position
  springs. (No gamification motion exists here regardless.)

---

## 10. Web ↔ mobile divergence

**Admin is primarily web / desktop.** The super-admin control plane is a desktop
tool; there is **no dedicated native super-admin app**. State this explicitly:
the canonical experience is the responsive web app at **lg/xl**, on a pointer
device.

- **⌘K command palette is web-only.** No equivalent on touch; presets are
  reached via sidebar/bottom-nav.
- **List → cards is already card-based** (no DataTable to collapse), so it
  degrades cleanly to a single column on small screens.
- **Create/Edit surface:** right **Drawer/Sheet** on web (lg/md) → **bottom
  Sheet** on `sm`/touch (full-width, ≤90vh, internal scroll), per AppShell
  responsive Drawer behavior.
- **Hover → press:** card hover-elevation and icon-button hover states map to
  active/pressed states on touch; row Edit/Delete remain ≥44px touch targets.
- **Dimension-row description** hides at `sm` (already in code) to keep the
  name + weight controls usable on a narrow viewport.
- No offline/PWA-specific behavior is required for this screen beyond AppShell's
  existing PWA shell; preset authoring assumes connectivity (it's a
  server-authoritative write).

---

## 11. Claude-design prompt (ready to paste)

```
You are designing ONE screen for the Auto-LevelUp admin (super-admin) web app, using the
"Lyceum" design system. READ docs/rebuild-spec/design/00-FOUNDATION.md FIRST and conform
EXACTLY: compose only from its §2 color tokens (cite semantic names like brand.primary,
bg.surface, status.success, text.muted — never raw hex), §3 typography (Fraunces display,
Schibsted Grotesk UI, Spline Sans Mono numerics), §4 spacing/radius/elevation/motion tokens,
and the §5 component inventory. Invent NOTHING new (no colors/fonts/radii/variants); if you
think something is missing, flag it as a proposed foundation addition instead of inventing it.

REGISTER: serious / precision-instrument. This is staff tooling — restrained chrome, NO
gamification spark, NO marigold burst, NO student warmth.

SCREEN: "Global Evaluation Presets" — route /presets, audience: superAdmin only (cross-tenant
platform control plane; no active tenant). Render inside AppShell (sidebar + topbar; the tenant
switcher is hidden on platform routes).

BUILD:
1. A PageHeader: Fraunces title "Global Evaluation Presets", a one-line description, and a
   primary "Create preset" button (primary Button variant — NOT spark).
2. A stacked list of preset Cards (one per EvaluationSettings). Each card shows: name, a
   "Default" Badge (brand.primary subtle) and/or "Public" Badge (status.success subtle), an
   optional description, a "Dimensions" overline + a wrapping set of Chip/Tag (enabled dimensions
   = indigo/brand subtle outline with an optional "2×" weight suffix; disabled = text.muted with
   strikethrough — never color-only, always with the dimension word), and a row of three labeled
   on/off indicators: Strengths, Key takeaway, Priority sort. Card hover lifts e1→e2 (motion
   fast). Right-aligned ghost IconButtons: Edit (✎, aria-label "Edit preset") and Delete (🗑,
   danger, aria-label "Delete preset").
3. Loading state = 3 Skeleton cards. Empty state = centered EmptyState (Sliders icon in bg.inset
   circle, Fraunces title "No global presets yet", body, secondary "Create preset"). Error state =
   an InlineAlert/Banner (status.error) with "Try again".
4. A Create/Edit Drawer/Sheet anchored RIGHT (≈560px; bottom sheet on small screens), elevation
   e3, with: Name* (Input), Description (Textarea), two Checkboxes ("Set as default preset",
   "Public (visible to all tenants)"), a "Display settings" Panel with three Checkboxes (Show
   strengths, Show key takeaway, Prioritize by importance), and an "Evaluation dimensions" Panel
   listing six rows (Clarity, Accuracy, Depth, Grammar, Relevance, Critical Thinking) — each row:
   an enable Checkbox, the name + em-dash description, and a 1–5 numeric Weight stepper that is
   disabled when the row is unchecked. Include a read-only RubricBreakdown preview reflecting the
   in-progress dimensions/weights. Sticky footer: secondary "Cancel" + primary "Save preset"
   (pending label "Saving…"). Drawer slides in over motion.base/ease.entrance; fades instead under
   prefers-reduced-motion; focus moves to Name on open, traps, returns focus on close.
5. A ConfirmDialog for delete ("Delete preset?", body warns tenants fall back to their own rubric,
   confirm "Delete" danger / "Cancel"; focus defaults to Cancel).

ACCESSIBILITY: WCAG AA contrast on all token pairs; status never by color alone (word badges +
labeled dots/chips); full keyboard operability; dialog/drawer aria-modal with labelledby; icon-only
buttons carry aria-labels; respect prefers-reduced-motion.

DATA SHAPE (autograde domain): EvaluationSettings { id, name, description?, isDefault, isPublic,
displaySettings{ showStrengths, showKeyTakeaway, prioritizeByImportance }, enabledDimensions:
EvaluationDimension[] } where EvaluationDimension { id, name, description, priority, promptGuidance,
enabled, weight (1–5), scoringScale }. Reads via v1.identity.listGlobalEvaluationPresets; writes via
v1.identity.saveGlobalEvaluationPreset ({id?, data} to upsert, {id, delete:true} to remove) —
super-admin only, server-authoritative, audited. Do NOT render any answer keys (not present here).

Output a single accessible React + Tailwind screen consuming Lyceum tokens via CSS custom
properties / @theme. Keep all motion subtle — no spring, no marigold/spark on this admin screen.
```
