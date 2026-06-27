# Rubric Presets Library — Design Spec

> Conforms to the **Lyceum** foundation
> (`docs/rebuild-spec/design/00-FOUNDATION.md`). Tokens, type, spacing, motion,
> and components are cited by name — not re-pasted. Sibling: `rubric-editor.md`
> (the embedded form), `space-editor-settings.md` (consumer of presets),
> `question-bank.md` (parallel tenant-level library).

## 1. Purpose & primary user

**Primary user:** `teacher` and `tenantAdmin` (staff register — _precise_, not
encouraging).

**Job-to-be-done:** "As a teacher/admin, I want a tenant-wide library of
reusable rubric templates so my team grades consistently and I don't re-author
the same criteria on every space, story point, item, or exam." This screen is
the **top of the rubric inheritance chain** —
`tenant default → space → storyPoint → item` (LevelUp) and
`tenant default → exam → question` (AutoGrade). Presets seed that chain;
downstream editors `applyPreset` to clone a starting `UnifiedRubric` they can
then override locally.

## 2. Entry points & route

- **Route:** `/rubric-presets` → `RubricPresetsPage` (teacher-web). Lazy-loaded,
  role-gated to `teacher`/`tenantAdmin` by the route manifest; rendered inside
  **AppShell** (Sidebar + Topbar).
- **Sidebar entry:** under a "Content" / "Library" group, sibling to **Question
  Bank** (`/question-bank`).
- **Cross-entry (Apply flow):** the **Use preset** affordance in
  `space-editor-settings.md`, `storypoint-editor.md`, `item-editor.md`, and
  AutoGrade `assessment-config.md` opens a preset **Picker** (Combobox/Drawer)
  that reads the same list and clones a preset's `rubric` into the local editor.

**Common-API (cite `specs/common-api.md`):**

- **Read:** `v1.levelup.listRubricPresets` (the list; per task brief
  `rubricPresets.list`) → `RubricPreset[]` scoped to
  `tenants/{tenantId}/rubricPresets`. Returns `isDefault` system presets +
  tenant-authored ones.
- **Read (edit):** load is from the list payload (preset doc is self-contained —
  `rubric` is embedded, no answer-key stripping applies here, unlike
  `getItemForEdit`).
- **Write:** `v1.levelup.saveRubricPreset` — consolidated upsert (create +
  edit + delete via `{ deleted: true }` or a soft branch), returns
  `SaveResponse{ id, created }`. Tenant isolation + `createdBy` audit set
  server-side.
- **Apply:** no dedicated callable — "apply" is a **client-side clone** of
  `preset.rubric` into the consuming editor, then persisted by that editor's own
  save (`saveSpace` / `saveStoryPoint` / `saveItem` / `saveExam`).

## 3. Layout — wireframe-as-text

Inside **AppShell**: persistent **Sidebar** (left), **Topbar** (tenant switcher
/ search / profile), main column capped at max content width 1200 (foundation
§4), page gutters mobile 16 / tablet 24 / desktop 32.

```
┌─ AppShell ───────────────────────────────────────────────────────────────┐
│ Sidebar │ Topbar (tenant · ⌘K search · notifications · profile)           │
│         ├──────────────────────────────────────────────────────────────── │
│         │  Breadcrumb: Library / Rubric Presets                            │
│         │                                                                  │
│         │  ┌ Header row ──────────────────────────────────────────────┐   │
│         │  │ H1 "Rubric Presets"   [search ◰] [category ▾]  [+ New ⟂] │   │  ← Button spark = New
│         │  │ sub: "Reusable grading templates for your tenant."        │   │
│         │  └───────────────────────────────────────────────────────────┘   │
│         │                                                                  │
│         │  ┌ DataTable (lg) ─────────────────────────────────────────┐    │
│         │  │ Name            Mode     Criteria  Category  Usage  ⋯    │    │
│         │  │ ─────────────────────────────────────────────────────── │    │
│         │  │ ◆ Essay – IELTS  dimension  6 dim   essay    14    [⋯]   │    │
│         │  │ ◆ Code Review    criteria   4 crit  coding    8    [⋯]   │    │
│         │  │ 🔒 Default Holistic holistic  —     general  sys    —    │    │  ← isDefault lock chip
│         │  └──────────────────────────────────────────────────────────┘    │
│         │                                          Pagination ‹ 1 2 ›       │
└─────────┴──────────────────────────────────────────────────────────────────┘
```

**Grid / responsive (foundation §4 breakpoints):**

- **lg ≥1024:** full **DataTable** — columns Name · Scoring mode (Badge) ·
  Criteria/Dimension count · Category (Chip) · Usage · Updated · row-overflow
  `⋯`. Sortable Name / Updated / Usage.
- **md 768–1023:** condensed table — drop _Updated_, fold count + category under
  Name as secondary line.
- **sm <768:** table → **stacked Cards** (one Card per preset: title row + mode
  Badge + category Chip + count + usage stat + tap-target `⋯`). Filters collapse
  into a Drawer triggered by a filter IconButton.

**Create/Edit surface:** a right-side **Drawer/Sheet** (lg/md) or full-screen
**Modal/Sheet** (sm). It embeds the **`rubric-editor.md`** form (the
`RubricEditor` component) plus preset metadata (name, description, category,
applicable `questionTypes`). The library list stays mounted behind the Drawer
scrim.

## 4. Components used (from §5)

- **AppShell**, **Sidebar**, **Topbar**, **Breadcrumb** — chrome.
- **DataTable** (sort/filter/paginate) — preset list (lg/md); **Card** stack on
  sm.
- **Button** — `spark` variant for **New preset** (primary CTA energy, §2
  `spark`); `secondary` for Apply; `danger` for Delete; **IconButton** for row
  `⋯` and mobile filter.
- **Input** (search), **Select**/**Combobox** (category filter + scoring-mode
  metadata), **Textarea** (description), **Chip/Tag** (category), **Badge**
  (scoring mode), **Stat** (usage count).
- **Drawer/Sheet** + **Modal** (create/edit container), **Tabs** (optional
  inside editor: Metadata / Rubric).
- **EmptyState**, **Skeleton**, **Pagination**, **InlineAlert/Banner**,
  **ConfirmDialog**, **Toast (sonner)**, **LoadingOverlay**, **Tooltip**,
  **FormFieldError**.
- **Domain:** **`RubricBreakdown`** — read-only preview of a preset's
  `UnifiedRubric` (criteria/dimensions/levels) in the row-expand or Drawer
  preview, reusing the exact renderer that grading review uses.
- **Proposed addition (justify):** **`ScoringModeBadge`** — a thin, named
  wrapper over **Badge** mapping the four `RubricScoringMode` values
  (`criteria_based` / `dimension_based` / `holistic` / `hybrid`) to consistent
  label + icon + token, so the library, the editor, and `assessment-config.md`
  render mode identically. It adds no new tokens (reuses Badge tokens) — only a
  fixed enum→label map. Add to §5 domain inventory.

## 5. States

- **Loading:** **Skeleton** table — 6 shimmer rows matching column widths (name,
  mode pill, count, chip, stat). No spinner; skeleton respects
  `prefers-reduced-motion` (static placeholder, no shimmer when reduced).
- **Empty (no tenant presets, only system defaults):** **EmptyState** — Fraunces
  title, body copy, a `spark` **Create your first preset** CTA, and a faint list
  of the available `isDefault` system presets the team can start from. (See §7
  copy.)
- **Empty (truly zero, incl. no system defaults):** EmptyState with only the
  create CTA.
- **Error (list fetch failed):** **InlineAlert** (`status.error`) with
  **Retry**; table region replaced, chrome intact. Toast on transient retry
  success.
- **Partial:** list resolved but a row's `usage` count is still aggregating →
  show a small **Skeleton** chip in the Usage cell only, rest of row
  interactive.
- **Save in-flight:** Drawer footer **Save** shows inline spinner;
  **LoadingOverlay** on the Drawer body; optimistic row insert/update in the
  table behind it (rolled back on error).
- **Success:** Toast "Preset saved", Drawer closes, affected row flashes a
  subtle `spark`-tinted highlight (220ms `base`, fades) — the _only_ lively
  beat; everything else stays calm (staff register).

**Permission-gated variations:**

- `tenantAdmin`: full CRUD on tenant presets; may also **edit** tenant-scoped
  behavior. Cannot edit `isDefault` system presets (those are platform-seeded) —
  **Duplicate to tenant** is offered instead.
- `teacher`: create/edit/delete **own** tenant presets; can **Apply** any preset
  (system + tenant). `⋯` on a preset authored by another teacher shows
  **Duplicate** + **Apply** but greys **Delete** (tooltip: only the author or an
  admin can delete) unless tenant policy allows shared editing.
- Any role landing here without `teacher`/`tenantAdmin` claim → route guard
  redirects (never renders).

## 6. Interactions & motion (cite §4 motion)

- **Open create:** New (`spark`) → Drawer slides in `slow 320ms` /
  `ease.entrance`; scrim fades `base 220ms`.
- **Embedded RubricEditor:** switching `scoringMode` via Select cross-fades the
  active field group (criteria list ↔ dimensions list ↔ holistic textarea)
  `fast 160ms`; add criterion/dimension rows animate height-in
  `base`/`ease.standard`. Mirrors `rubric-editor.md` exactly.
- **Save (optimistic):** on submit, the row updates immediately;
  `saveRubricPreset` reconciles. On failure, row reverts + **InlineAlert**
  inside the Drawer + Toast (`status.error`). Server is source of truth for `id`
  / `createdBy` / `updatedAt`.
- **Delete:** `⋯ → Delete` opens **ConfirmDialog** (`danger`) naming the preset
  and its **usage** count ("Used by 14 items"). Confirm → optimistic row
  removal, `saveRubricPreset({ deleted })`; Toast with **Undo** (re-issues the
  upsert) for ~6s.
- **Apply (from a consuming editor):** Picker lists presets; selecting one
  clones `preset.rubric` into the local editor and shows a Banner "Applied
  'Essay – IELTS' — edit below to override." No write happens until the
  consuming editor saves. Re-applying warns it will overwrite local rubric edits
  (ConfirmDialog).
- **Filter/search:** debounced `fast 160ms`; category Select + name Input filter
  client-side over the loaded list; result count updates live in the header
  sub-line.
- **Reduced motion:** Drawer/scrim/cross-fades collapse to instant; the success
  row-flash is suppressed.

## 7. Content & copy (precise / staff tone)

- **H1 (Fraunces, text-2xl):** "Rubric Presets"
- **Sub (Schibsted, text-sm, `text.secondary`):** "Reusable grading templates
  for your tenant. Apply them to spaces, story points, items, and exams."
- **Primary CTA:** "New preset" · **Picker CTA (in consumers):** "Use a preset"
- **Column headers:** Name · Scoring mode · Criteria · Category · Usage ·
  Updated
- **Usage cell tooltip:** "Used by {n} spaces / story points / items / exams
  (inherited or applied)."
- **System preset chip:** "System default" (with `AnswerKeyLock`-style lock
  glyph for visual _read-only_ — see §8).
- **Empty-state title (Fraunces):** "No presets yet"
- **Empty-state body:** "Build a rubric once and reuse it everywhere. Presets
  seed the rubric your spaces, story points, and exams inherit — author it here,
  override it locally when you need to."
- **Empty-state CTA:** "Create your first preset"
- **Delete confirm:** Title "Delete '{name}'?" Body "This preset is used by {n}
  items. Deleting it won't change existing rubrics — they keep their copied
  criteria — but it can no longer be applied to new content." Confirm "Delete
  preset" / Cancel "Keep it".
- **Save success Toast:** "Preset saved." · **Apply Banner:** "Applied '{name}'.
  Edit below to override for this {space|story point|item|exam}."
- **List error:** "Couldn't load rubric presets. Check your connection and try
  again." + "Retry".
- **Editor validation (FormFieldError):** "Name is required." · "Add at least
  one {criterion|dimension}." · "Passing percentage must be 0–100."

## 8. Domain rules surfaced (backend invariants)

- **Inheritance chain is by COPY, not reference.** A preset is a _template_.
  Applying clones `preset.rubric` into the target's own `rubric` field; the
  target does not link back. So **deleting a preset does not mutate or break any
  downstream rubric** — only future Apply is affected. The library is the _seed_
  of `tenant default → space → storyPoint → item` /
  `tenant default → exam → question` (be-levelup rubric model; common-api
  §"rubric inheritance" kept verbatim).
- **Tenant isolation:** presets live at
  `tenants/{tenantId}/rubricPresets/{presetId}`; `listRubricPresets` and
  `saveRubricPreset` are tenant-scoped server-side. No cross-tenant read/write;
  `tenantId` is never client-trusted.
- **System defaults (`isDefault: true`)** are platform-seeded, **read-only in
  this UI** — render with the `AnswerKeyLock`-style lock visual to signal
  _server-guarded, not editable here_. Edit path offers **Duplicate to tenant**
  which creates a mutable `isDefault:false` copy authored by the current user.
- **`UnifiedRubric` scoring-mode field gating** (mirrors `RubricEditor`): only
  the active mode's fields persist — `criteria` for `criteria_based`/`hybrid`,
  `dimensions` for `dimension_based`, `holisticGuidance`/`holisticMaxScore` for
  `holistic`/`hybrid`. The library's count column reflects this (criteria vs
  dimension count vs "—").
- **Audit:** `createdBy`, `createdAt`, `updatedAt` are set/maintained
  server-side on `saveRubricPreset`; the UI shows Updated and gates Delete on
  `createdBy` + role.
- **No answer-key surface here.** A rubric may carry `modelAnswer` /
  `showModelAnswer`, but presets are staff-only and never reach a student; the
  answer-key isolation that applies to _items_ (`saveItem` stripping) is not in
  play for preset docs. Still, the editor labels `modelAnswer` as "reference
  answer (staff-only)".

## 9. Accessibility (WCAG AA)

- **Focus order:** Breadcrumb → search Input → category Select → New (spark) →
  table header (sortable buttons) → rows top-to-bottom → row `⋯` menu →
  Pagination. Drawer **traps focus**; on close, focus returns to the trigger
  (New button or the originating row `⋯`).
- **Keyboard:** table rows reachable by Tab; `↑/↓` moves row focus, `Enter`
  opens preview/edit, `Delete` opens the ConfirmDialog (with confirm). `⋯` menu
  is a roving-tabindex menu (`role="menu"`). Drawer **Esc** closes (with
  unsaved-changes guard). No ⌘K dependency for core actions.
- **ARIA:** DataTable uses real `<table>` semantics with `aria-sort` on sortable
  headers; each ScoringModeBadge and category Chip exposes a text label (status
  **never color-alone** — §2). The system-default lock has
  `aria-label="System default, read-only"`. ConfirmDialog uses
  `role="alertdialog"` with labelled title/description.
- **Contrast:** all pairs meet AA — Badge/Chip text on tinted fills uses the §2
  semantic pairs; `spark` CTA text is `text.on-accent`. Usage Stat in Spline
  Sans Mono keeps tabular legibility.
- **Reduced motion:** honor `prefers-reduced-motion` —
  Drawer/scrim/flash/cross-fades become instant (§4).

## 10. Web ↔ mobile divergence (React Native parity)

- This is primarily a **web (teacher-web)** management surface. On the merged
  **mobile** teacher app, the screen reaches parity via the
  `shared-ui ↔ ui-native` 1:1 component contract (§6):
  - **DataTable → stacked Cards** (one preset per Card, tap to preview/edit).
  - **Hover → press**; row `⋯` overflow → long-press / trailing IconButton →
    bottom **Sheet** action menu.
  - **Drawer (side) → bottom Sheet** for create/edit; full-screen on small
    phones. The embedded `RubricEditor` renders its mode-switching field groups
    vertically stacked.
  - **No ⌘K / CommandPalette** on mobile — search is the in-header Input;
    filters open a bottom Sheet.
  - Touch targets ≥44px (§4); usage Stat and ScoringModeBadge unchanged
    (token-driven, NativeWind reads the same token JSON).
- **Apply** flow is more common on web (authoring happens there); on mobile the
  Picker is a bottom Sheet list.

## 11. Claude-design prompt

```text
Design the "Rubric Presets Library" screen for Auto-LevelUp, STRICTLY conforming to the Lyceum design system
(docs/rebuild-spec/design/00-FOUNDATION.md). Modern Scholarly direction: warm paper neutrals (bg.canvas paper-50,
bg.surface warm-white), deep indigo brand.primary (NOT SaaS blue #3B82F6), single marigold `spark` accent reserved
for the primary CTA. Type: Fraunces for the H1/empty-state title, Schibsted Grotesk for UI/body/labels/table,
Spline Sans Mono for the usage count and any numerics. Use ONLY foundation tokens and the §5 component inventory —
no Inter/Roboto, no glass morphism, no invented colors.

Role: teacher / tenantAdmin (precise staff tone). Route /rubric-presets inside AppShell (Sidebar + Topbar +
Breadcrumb "Library / Rubric Presets"). Main column max-width 1200, desktop gutter 32.

Build:
- Header: H1 "Rubric Presets" + secondary sub-line; right-aligned search Input, category Select, and a `spark`
  Button "New preset".
- A DataTable (lg) with columns Name · Scoring mode (a ScoringModeBadge mapping criteria_based/dimension_based/
  holistic/hybrid to icon+label+token) · Criteria/Dimension count · Category (Chip) · Usage (mono Stat) · Updated ·
  row `⋯` IconButton. Sortable Name/Updated/Usage. System-default rows show a read-only lock chip
  (AnswerKeyLock-style) and offer "Duplicate to tenant" instead of edit.
- Create/Edit in a right Drawer/Sheet embedding the RubricEditor form (scoringMode Select + criteria list /
  dimensions list / holistic textarea, gated by mode) plus name, description, category, questionTypes. Footer
  Save (spark) / Cancel.
- States: Skeleton table (loading), EmptyState ("No presets yet" Fraunces title + body + "Create your first preset"
  spark CTA, listing available system defaults), InlineAlert + Retry (error), optimistic row update on save with a
  subtle spark-tinted 220ms flash, ConfirmDialog (danger) for delete showing usage count + an Undo Toast.
- Responsive: md drops Updated and folds count/category under Name; sm collapses the table into stacked Cards and
  moves filters into a Drawer; no ⌘K on mobile.
- Motion per §4 (Drawer slow 320ms ease.entrance, cross-fades fast 160ms), full prefers-reduced-motion support.
- A11y: real table semantics with aria-sort, focus-trapped Drawer returning focus to its trigger, status never by
  color alone, WCAG AA contrast, ≥44px touch targets.

Surface the domain truth: presets are TEMPLATES seeding the rubric inheritance chain
(tenant default → space → storyPoint → item / exam → question) by COPY — deleting a preset never breaks existing
rubrics. Tenant-isolated (tenants/{tenantId}/rubricPresets). Reads v1.levelup.listRubricPresets, writes
v1.levelup.saveRubricPreset. Deliver clean, production-grade React + Tailwind (@theme reading Lyceum CSS variables).
```
