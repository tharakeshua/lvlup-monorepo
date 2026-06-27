# Question Bank — Design Spec

> Conforms to the **Lyceum** foundation
> (`docs/rebuild-spec/design/00-FOUNDATION.md`). All colors, type, spacing,
> radius, elevation, motion, and components are cited by token/component name —
> never re-defined. This is a **staff** surface, so the tone is **precise,
> instrument-like** throughout.

---

## 1. Purpose & primary user

**Primary user:** `teacher` and `tenantAdmin`.

**Job-to-be-done:** _"I want one tenant-wide library of reusable questions —
classified by type, difficulty, topic, and Bloom's level — that I can search,
curate, and pull into any space, so I never re-author the same question twice."_

The Question Bank **decouples question authoring from any single space**. A
teacher builds a durable, reusable repository; spaces _import_ from it. Editing
a bank item never mutates copies already imported into spaces (see §8). This is
the staff "raw materials" warehouse that feeds the `SpaceEditor` and
`ExamCreate` flows.

---

## 2. Entry points & route

**Route:** `/question-bank` → `QuestionBankPage`
(`apps/teacher-web/src/pages/spaces/QuestionBankPage.tsx`).

**Entry points:**

- Sidebar nav (`Sidebar`, route manifest, role-gated to `teacher` /
  `tenantAdmin`), `Library` icon.
- "Import from Bank" affordance inside `SpaceEditorPage` / `ItemEditor`
  (deep-links here, or opens a bank picker reusing `listQuestionBank`).
- Topbar `CommandPalette` (⌘K) → "Question Bank".

**Common-API reads/writes** (cite `docs/rebuild-spec/specs/common-api.md`):

- **Read** —
  `listQuestionBank({ tenantId, search?, difficulty?, bloomsLevel?, questionType?, limit, startAfter? }) → { items: QuestionBankItem[], nextCursor? }`.
  Maps to `QuestionBankFilter`; cursor pagination via `startAfter`. Backed by
  the `questionBankRepo` over `/tenants/{tenantId}/questionBank/{itemId}`.
- **Write** —
  `saveQuestionBankItem({ id?, tenantId, data: Partial<QuestionBankItem> })`.
  Used for **create** (no `id`), **edit** (with `id`), **duplicate** (clone with
  cleared `id`), and **soft-delete** (`data: { deleted: true }`). On write, the
  repo stamps `updatedAt`; on create it stamps `createdBy`/`createdAt` and
  initializes `usageCount: 0`.

> The editor form is delegated to `QuestionBankEditor`
> (`apps/teacher-web/src/components/question-bank/QuestionBankEditor.tsx`),
> which embeds the shared item-editor question form so authoring parity with
> `ItemEditor` is guaranteed.

---

## 3. Layout — wireframe-as-text

Rendered inside **AppShell** (`Sidebar` + `Topbar`); this page owns the main
content region only. Page gutters per §4 (16 / 24 / 32). Max content width 1200.

```
┌──────────────────────────────────────────────────────────────────┐
│ AppShell: Sidebar (Question Bank active) │ Topbar (tenant, ⌘K)    │
├──────────────────────────────────────────────────────────────────┤
│  HEADER ROW                                                        │
│  [Library icon·brand.primary]  Question Bank        [+ Add ▸spark] │
│  "Reusable questions across all your spaces"  (text.secondary)     │
│                                                                    │
│  FILTER BAR  (flex-wrap, gap-3)                                    │
│  [🔍 Search questions…              ] [Difficulty▾][Bloom▾][Type▾] │
│                                                  [Filter ✕ Clear]  │
│                                                                    │
│  RESULTS  (DataTable on lg / stacked rows on sm·md)                │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │ Title / content preview …  [Type][Diff][Bloom] · subject ·  │   │
│  │ Used 4× · 78% avg          [✎][⧉][🗑]            ›           │   │
│  └────────────────────────────────────────────────────────────┘   │
│  …rows…                                                            │
│  PAGINATION  ‹ Load more / cursor ›                                │
└──────────────────────────────────────────────────────────────────┘
```

**Grid / responsive:**

- **lg (≥1024):** results render as a true **DataTable** — columns _Question_
  (title + 2-line preview), _Type_, _Difficulty_, _Bloom_, _Topics_, _Usage_,
  _Avg score_, _Updated_, _Actions_. Sortable on Usage / Avg / Updated (maps to
  `sortBy`/`sortDir`). Row-click opens preview.
- **md (768–1023):** table collapses to dense **Card rows** (the current row
  pattern): title, preview, badge cluster, inline action `IconButton`s, chevron.
- **sm (<768):** single-column stacked `Card`s; action buttons move into a
  row-level overflow `Popover` (no hover); filter `Select`s wrap full-width;
  search spans full width.

Filter bar is sticky below header on scroll at `md+`.

---

## 4. Components used (from §5)

| Region          | Component(s)                                                                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frame           | `AppShell`, `Sidebar`, `Topbar`, `Breadcrumb` (Spaces ▸ Question Bank)                                                                                  |
| Header          | `Button` (variant **spark** for "Add Question" — it is the primary creative CTA), Section heading (Fraunces `text-2xl`)                                 |
| Filters         | `Input` (search, leading `Search` icon), three `Select` (Difficulty, Bloom's, Type), `Button` ghost "Clear", `Chip`/`Tag` for active-filter readout     |
| Results (lg)    | `DataTable` (sort / filter / paginate / row-select), `Badge`, `Chip/Tag`, `GradePill`-adjacent cell for avg score                                       |
| Results (md/sm) | `Card`, `Badge`, `Chip/Tag`, `IconButton` (Edit / Duplicate / Delete), `Popover` (mobile overflow)                                                      |
| Preview         | `Modal/Dialog` ("Question Preview") wrapping `ContentRenderer` (md + KaTeX) for `content`/`explanation`, `QuestionCard` preview-mode for the typed body |
| Editor          | `Modal/Dialog` / `Drawer` hosting `QuestionBankEditor` → embeds `QuestionCard` + `AnswerInput` authoring form                                           |
| Confirm         | `ConfirmDialog` (delete)                                                                                                                                |
| Feedback        | `Toast` (sonner), `Skeleton` (loading), `EmptyState`, `Pagination` (cursor "Load more"), `LoadingOverlay` (save)                                        |

**Proposed addition (justified):** a small **`UsageStat`** inline cell =
`Stat/KPI` rendered in `Spline Sans Mono` ("Used 4×" / "78% avg"). This is a
composition of existing `Stat/KPI` + mono numerics, not a new token — noted for
consistency only.

**Banned-list check:** difficulty/Bloom badges must use the §2.3 / §2 semantic
scales (`status.success` green / `status.warning` amber / `status.error` red /
`status.info` sky), **not** the literal Tailwind `emerald-/red-/blue-` classes
currently hard-coded in the legacy page. No SaaS blue, no glass,
Fraunces/Schibsted/Spline only.

---

## 5. States

- **Loading:** four `Skeleton` rows at `radius.lg`, height ≈ row height; filter
  bar stays interactive (disabled while first fetch resolves). On lg, skeleton
  mirrors `DataTable` column rhythm.
- **Empty — no items at all:** `EmptyState` centered on `bg.surface-sunken`,
  `Library` glyph in `text.muted`, Fraunces title "Your question bank is empty",
  body copy (§7), primary **spark** `Button` "Add Question" + secondary "Import
  from a space".
- **Empty — filtered/no match:** same `EmptyState` shell, copy "No questions
  match your filters", action `Button` ghost "Clear filters".
- **Error:** `InlineAlert` (status.error) above results: "Couldn't load the
  question bank." + `Button` "Retry" (re-runs `listQuestionBank`). Editor save
  error → `Toast` error "Couldn't save question", form retains values.
- **Partial:** first page loaded, more available → `Pagination` "Load more"
  appends via `startAfter` cursor; appended rows fade-in (motion.fast). Mutation
  in-flight (delete/save) → optimistic row dim + `LoadingOverlay` on editor.
- **Success:** populated `DataTable`/rows; saved item flashes a brief
  marigold-tinted highlight (one-time, motion.base) then settles.

**Permission-gated variations by role:**

- `teacher`: full CRUD on items within their tenant.
- `tenantAdmin`: same, plus may curate items authored by any teacher in the
  tenant; `createdBy` surfaced as an "Author" column (hidden for plain teachers
  to reduce noise).
- Cross-tenant items are never returned — `tenantId` scoping is enforced
  server-side (§8). No student-facing variation exists; this route is **not** in
  any student role manifest.

---

## 6. Interactions & motion

- **Search:** debounced on type (or Enter) → re-keys the `listQuestionBank`
  query; results cross-fade (motion.fast `160ms`, `ease.standard`). Active
  filters render as removable `Chip`s; removing one re-queries.
- **Filter selects:** changing Difficulty / Bloom's / Type re-queries
  immediately; "Clear" appears only when any filter is set and resets all three
  (motion.instant).
- **Open preview:** row/title click → `Modal/Dialog` entrance (motion.base,
  `ease.entrance`, elevation `e3`, focus ring per §4). Renders `content` +
  `explanation` through `ContentRenderer`, badge cluster, topics/tags,
  `Used N×`, `avg score`. Esc/overlay closes (motion.exit).
- **Add / Edit / Duplicate:** opens `QuestionBankEditor` modal. **Duplicate**
  pre-fills the form with the source item and a cleared `id` so save creates a
  new record. Save → `saveQuestionBankItem` → `Toast` success "Question saved" →
  list `invalidateQueries(['questionBank'])` refetch; the saved/new row gets the
  one-time marigold highlight (the single celebratory accent allowed by §4, kept
  subtle for a staff tool).
- **Delete:** `ConfirmDialog` (danger). Confirm → optimistic row removal
  (motion.exit collapse) → `saveQuestionBankItem({ data:{ deleted:true } })`; on
  failure the row springs back + `Toast` error. Copy must reassure that imported
  copies are unaffected (§7/§8).
- **Optimistic updates:** delete and inline edits update the cache immediately;
  reconciled on settle. Save uses a `LoadingOverlay`, not optimism, because
  server stamps (`usageCount`, timestamps) must round-trip.
- **Reduced motion:** all cross-fades/collapses degrade to instant opacity
  swaps; no marigold highlight pulse.

---

## 7. Content & copy

Tone: **precise, professional** (staff register) — confident, never cute.

- **H1 (Fraunces text-2xl):** "Question Bank"
- **Subtitle (text.secondary):** "Reusable questions across all your spaces"
- **Primary CTA:** "Add Question"
- **Filter placeholders:** "Search questions…", "Difficulty", "Bloom's Level",
  "Type" / "All Types"; clear: "Clear filters"
- **Column headers (lg):** Question · Type · Difficulty · Bloom's · Topics ·
  Usage · Avg score · Updated · _(Author for admin)_
- **Usage cell:** "Used {usageCount}×", "{round(averageScore×100)}% avg" (mono)
- **Empty (no items) — title:** "Your question bank is empty" · **body:** "Save
  questions from your spaces or author new ones here. Anything you add becomes
  reusable across every space in your tenant."
- **Empty (filtered):** "No questions match your filters." · action "Clear
  filters"
- **Preview modal title:** "Question Preview"
- **Delete confirm — title:** "Delete this question?" · **body:** "This
  permanently removes the question from your bank. Questions already imported
  into spaces are not affected." · confirm "Delete" / cancel "Cancel"
- **Toasts:** success "Question saved" · "Question deleted"; error "Couldn't
  save question" · "Couldn't load the question bank."

---

## 8. Domain rules surfaced

Real backend invariants (be-levelup / domain-model):

1. **Tenant isolation.** Items live at
   `/tenants/{tenantId}/questionBank/{itemId}`; `listQuestionBank` and
   `saveQuestionBankItem` always scope by `tenantId` (from
   `useAuthStore().currentTenantId`). No cross-tenant read/write — enforced by
   Firestore rules, not the client.
2. **Authoring is decoupled from spaces.** A `QuestionBankItem` is a _source_.
   Importing into a space produces an independent content item — editing or
   deleting the bank item does **not** retroactively mutate imported copies. The
   delete copy states this explicitly.
3. **Soft delete.** "Delete" writes `{ deleted: true }` via
   `saveQuestionBankItem` rather than hard-deleting, preserving usage analytics
   integrity. Deleted items are filtered out of `listQuestionBank` results.
4. **Usage tracking is server-owned.** `usageCount`, `averageScore`,
   `lastUsedAt` are computed/incremented server-side when an item is imported or
   its derived questions are answered. The client renders them read-only; the
   editor never sets them.
5. **Audit fields immutable post-create.** `createdBy` / `createdAt` are stamped
   once; only `updatedAt` advances on edit.
6. **Type fidelity.** `questionType` ∈ the 15 supported `QuestionType`s;
   `questionData: QuestionTypeData` is a discriminated union — the embedded
   `QuestionBankEditor` must keep `questionType` and `questionData` in sync
   (same invariant as `ItemEditor`).
7. **Answer-key safety.** `questionData` may contain correct answers / rubrics.
   This is a staff-only surface, so the `AnswerKeyLock` visual is _not_ needed —
   but the bank API must never be exposed to student roles (route is absent from
   student manifests).

---

## 9. Accessibility

- **Focus order:** Skip-link → Sidebar → H1 → Add button → Search → Difficulty →
  Bloom's → Type → Clear → first result row → row actions → pagination. Modals
  trap focus; on close, focus returns to the triggering control.
- **Keyboard:** Search Enter submits; `Select`s are arrow-navigable Radix
  listboxes; result rows are real `button`/`<tr>` elements — Enter/Space opens
  preview; row action `IconButton`s are individually tabbable with `aria-label`
  ("Edit question", "Duplicate question", "Delete question"). `DataTable`
  headers expose `aria-sort`. ⌘K opens `CommandPalette`.
- **ARIA:** results region `aria-busy` during fetch; `EmptyState` is a labeled
  region; toasts via polite live region; delete `ConfirmDialog` uses
  `role="alertdialog"`.
- **Contrast (WCAG AA):** difficulty/Bloom `Badge`s use §2.3 semantic scales
  meeting 4.5:1 (body) / 3:1 (UI). **Never status-by-color-alone** — every
  difficulty/Bloom badge pairs color with its text label (and an icon where
  space allows).
- **Reduced motion:** honors `prefers-reduced-motion` — no marigold highlight
  pulse, no collapse animation; instant opacity only.

---

## 10. Web↔mobile divergence

Component names/props match 1:1 between `shared-ui` and `ui-native`; only
renderer differs (§6 foundation rule). This is a power-staff curation tool —
primarily a web/tablet experience, but parity is preserved:

- **Table → cards.** `DataTable` (lg web) collapses to stacked `Card` rows on
  mobile; sortable columns become a single `Select` "Sort by" (Usage / Avg /
  Newest → `sortBy`/`sortDir`).
- **Hover → press.** Row hover-shadow (e1→e2) becomes press-state highlight;
  inline action `IconButton`s move into a row-level overflow `Popover`/`Sheet`
  (Edit / Duplicate / Delete) since hover affordances don't exist.
- **No ⌘K.** Mobile uses the `Tabbar` + in-page search; no `CommandPalette`.
- **Editor → full-screen Sheet.** `QuestionBankEditor` opens as a `Drawer/Sheet`
  from the bottom on mobile instead of a centered `Modal`.
- **Filters → Sheet.** The three `Select`s collapse behind a single "Filters"
  `Button` that opens a bottom `Sheet` with the controls; active-filter `Chip`s
  remain inline.
- **Touch targets ≥44px** on all row actions and filter controls.

---

## 11. Claude-design prompt

```
Design the "Question Bank" screen for the Auto-LevelUp teacher web app, strictly conforming to
the Lyceum design system (docs/rebuild-spec/design/00-FOUNDATION.md — "Modern Scholarly").
Compose ONLY from Lyceum tokens and components; invent nothing.

Type: Fraunces (h1 "Question Bank", text-2xl, tracking -0.02em), Schibsted Grotesk (UI/body/labels/
table), Spline Sans Mono (usage counts + avg-score numerics). NO Inter/Roboto/Space Grotesk.
Color: warm paper bg.canvas (paper-50), bg.surface cards, text.primary ink-900, brand.primary
(indigo-600) for the Library icon + active nav, spark (marigold-500) ONLY on the "Add Question"
primary CTA. NO SaaS blue #3B82F6, no glass morphism, no gradients.

Layout (in AppShell: Sidebar with "Question Bank" active + Topbar):
- Header row: Library icon (brand.primary) + "Question Bank" (Fraunces) with subtitle
  "Reusable questions across all your spaces" (text.secondary); right-aligned spark Button "Add Question".
- Filter bar (flex-wrap, gap-3): search Input with leading Search icon ("Search questions…"),
  then Select "Difficulty", Select "Bloom's Level", Select "Type"; a ghost "Clear filters" Button
  appears only when a filter is active, plus removable filter Chips.
- Results as a DataTable on lg (columns: Question [title + 2-line preview], Type, Difficulty,
  Bloom's, Topics, Usage "Used 4×", Avg score "78%", Updated, Actions [Edit/Duplicate/Delete
  IconButtons + chevron]); sortable Usage/Avg/Updated. Difficulty & Bloom render as Badges using
  the semantic status scales (green easy, amber medium, red hard) — ALWAYS color + text label,
  never color alone.
- On md/sm collapse the table to stacked Cards; move row actions into an overflow Popover; filters
  into a bottom Sheet; CTA opens QuestionBankEditor as a bottom Sheet.
- Cursor "Load more" Pagination at the bottom.

States to show: skeleton-loading (4 rows, radius.lg), empty ("Your question bank is empty" Fraunces
title + spark "Add Question"), filtered-empty ("No questions match your filters" + Clear), and
populated success. Include the "Question Preview" Modal (ContentRenderer for the question body +
badge cluster + topics/tags + usage) and a danger ConfirmDialog "Delete this question?" noting that
imported copies are unaffected.

Radius lg cards / md inputs / pill badges; elevation e1 at rest, e2 on hover, e3 on modal; motion
fast 160ms cross-fade on filter/search, base 220ms ease.entrance on modal; respect prefers-reduced-
motion. WCAG AA contrast, full keyboard nav, aria-sort on sortable headers, aria-labels on icon
actions. Tone: precise and professional (staff register), not playful.
```
