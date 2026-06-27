# Create Space (new-space flow) — Design Spec

> Conforms to the **Lyceum** foundation
> (`docs/rebuild-spec/design/00-FOUNDATION.md`). All colors, type, spacing,
> radius, elevation, motion, and components are cited by token/component name —
> never re-defined. This screen is the **create branch of the consolidated
> `saveSpace` upsert** (absent `id` = create).

---

## 1. Purpose & primary user

**Primary user:** `teacher` and `tenantAdmin`.

**Job-to-be-done:** "I want to spin up a new learning/assessment Space with just
enough metadata to be real, assign it to the right classes/teachers, and land
directly in the content editor so I can start building story points — without a
long form blocking me."

This is the _first-creation_ flow: a deliberately **minimal required-field
form** (only Title is hard-required). Everything else (assessment behavior,
store listing, thumbnails) is deferred to `SpaceSettingsPanel` inside the
editor. The flow optimizes for **time-to-first-content**, not completeness.

---

## 2. Entry points & route

**Entry points:**

- Primary CTA **"New Space"** in the Spaces topbar action slot on `/spaces` (the
  `SpaceListPage` header button).
- **Empty-state** CTA "Create your first space" on `/spaces` when the tenant has
  zero spaces.
- (Optional) `CommandPalette` (⌘K) action "New space" — web only.

**Route / presentation:** Presented as a centered **Modal/Dialog** layered over
`/spaces` with URL `/spaces/new` (modal route — preserves deep-linkability and
back-button dismissal). On confirm it **redirects to `/spaces/:id/edit`** (the
Space editor / `SpaceEditorPage`).

**Common-API reads/writes** (cite `docs/rebuild-spec/specs/common-api.md`):

- **Write:** `v1.levelup.saveSpace` — create branch (`id` omitted ⇒ create).
  Request shape = `SaveSpaceRequestSchema`
  (`packages/shared-types/src/schemas/callable-schemas.ts`); `tenantId` now
  derives from the auth claim, not the body (common-api §"tenantId from claim").
  Returns `SaveResponse{ id, created }`. Side effects (store-listing mirror,
  etc.) are deferred — none fire for a plain draft create.
- **Reads (assignment pickers):**
  - `v1.identity.listClasses` → class options for the `classIds` EntityPicker.
  - `v1.identity.listTeachers` → teacher options for the `teacherIds`
    EntityPicker.
  - `v1.identity.listAcademicSessions` (or current-session default) →
    `academicSessionId` Select.
  - Pickers use the standard cursor pagination fragment (common-api §pagination)
    and a server-side name search; both reads carry `rateTier: 'read'`.

---

## 3. Layout — wireframe-as-text

Rendered as `Modal/Dialog` (§5 Containers) at elevation **e3** (modal shadow),
centered over a dimmed `bg.canvas` scrim. It does **not** use the full
`AppShell` content region — it floats above the current `/spaces` route within
`AppShell`'s `Sidebar`+`Topbar` chrome. Max dialog width ≈ 640 (`reading` is
720; this is narrower for a focused form). Internal vertical rhythm uses spacing
`5`/`6`; dialog padding `6`.

```
┌─ Modal/Dialog  (radius lg, e3, bg.surface) ───────────────────────────┐
│  Header                                                                │
│   ◇ "Create a new space"            (Fraunces, text-xl/h2)        [✕]  │
│   Sub: "Name it and pick where it lives. …"  (Schibsted, text-sm,     │
│                                                text.secondary)         │
│  ─────────────────────────────────────────────────────────────────    │
│  Body  (scrollable, gap-5)                                             │
│   ┌ Title *  ──────────────────────────────────────────────────────┐  │
│   │ [ Input  "e.g. Algebra I — Semester 1" ]                        │  │
│   │ help: shown on cards & dashboards                               │  │
│   └─────────────────────────────────────────────────────────────────┘ │
│   ┌ Type  ─────────────────────┐  ┌ Subject (optional) ────────────┐  │
│   │ [ Select  Learning ▾ ]     │  │ [ Input "e.g. Mathematics" ]   │  │
│   │ help: <type description>   │  │                                │  │
│   └────────────────────────────┘  └────────────────────────────────┘  │
│   ┌ Description (optional) ─────────────────────────────────────────┐  │
│   │ [ Textarea, 3 rows, 0/600 counter ]                             │  │
│   └─────────────────────────────────────────────────────────────────┘ │
│   ┌ Access ────────────────────────────────────────────────────────┐  │
│   │ [ Select  Class Assigned ▾ ]   help: <access description>       │  │
│   │  ↓ if Class Assigned:                                           │  │
│   │   Classes  [ EntityPicker → Chips: 7B · 8A  (+search) ]         │  │
│   │   Teachers [ EntityPicker → AvatarGroup + names ]               │  │
│   └─────────────────────────────────────────────────────────────────┘ │
│   ┌ Labels (optional) ──────────────────────────────────────────────┐ │
│   │ [ Input "algebra, semester-1"  → Chip/Tag tokenizer ]           │  │
│   └─────────────────────────────────────────────────────────────────┘ │
│   ┌ Academic session ──────────────────────────────────────────────┐  │
│   │ [ Select  2025–26 ▾ ]  (defaults to active session)            │  │
│   └─────────────────────────────────────────────────────────────────┘ │
│  ─────────────────────────────────────────────────────────────────    │
│  Footer  (sticky, justify-end, gap-3)                                  │
│   "You can change all of this later."        [ Cancel ]  [ Create ▸ ] │
└────────────────────────────────────────────────────────────────────────┘
```

**Responsive:**

- **lg (≥1024):** dialog 640px; Type/Subject share a 2-col grid (`gap-4`).
- **md (768):** dialog ~92vw; Type/Subject stack to 1 column; pickers remain
  inline.
- **sm (<640) / mobile RN:** full-screen `Drawer/Sheet` slide-up (not a centered
  modal); all fields single-column; footer becomes a sticky bottom bar; touch
  targets ≥44px.

---

## 4. Components used (from §5)

- **Containers:** `Modal/Dialog` (web), `Drawer/Sheet` (mobile/sm), `Section`
  for grouped field blocks.
- **Primitives:** `Input` (Title, Subject, Labels), `Textarea` (Description,
  auto-resize + char counter), `Select` (Type, Access Type, Academic session),
  `Button` (`secondary` Cancel, `primary` Create), `IconButton` (dialog close
  ✕), `Combobox` (inside EntityPicker search).
- **Data / display:** `Chip/Tag` (label tokens, selected class chips),
  `AvatarGroup` (selected teachers), `Badge` (Type indicator preview),
  `Skeleton` (picker option loading), `EmptyState` (no classes/teachers).
- **Feedback:** `FormFieldError` (`FormFieldError`), `InlineAlert/Banner`
  (permission/quota notices), `Toast` (sonner) for create success/failure,
  `LoadingOverlay`/button-spinner while saving.
- **Proposed addition — `EntityPicker`** (multi-select people/class chooser): a
  `Combobox`-driven multi-select that renders selected entities as `Chip/Tag`s
  (classes) or `AvatarGroup` (teachers), with async-paginated options from
  `listClasses` / `listTeachers`. **Justification:** assignment over
  classes/teachers recurs across Spaces, Exams, and roster screens; it composes
  existing primitives (`Combobox` + `Chip/Tag` + `Avatar`) and adds no new
  tokens. Add it to §5 domain components alongside `SpaceCard`. Until added, it
  is the canonical name used here.

No new colors/fonts/components beyond the justified `EntityPicker`.

---

## 5. States

- **Loading (pickers):** Type/Access/Session selects render immediately (static
  enums). Class/Teacher EntityPickers show 3–4 `Skeleton` option rows while
  `listClasses`/`listTeachers` resolve. The form is interactive during this —
  pickers are progressive, not blocking.
- **Empty:** If the tenant has **no classes**, the Classes EntityPicker shows an
  `EmptyState` inline ("No classes yet — create one in Roster, or choose Tenant
  Wide access."). If **no teachers**, Teachers picker shows a muted "Only you
  are assigned" note (creator is implicit owner).
- **Error:** Picker read failure → `InlineAlert` (`status.error`) above the
  picker with a Retry `Button` (ghost). The form still submits with whatever is
  selected. `saveSpace` failure → see §6.
- **Partial:** Only Title entered → **Create** is enabled (Title is the single
  required field). All optional fields submit as `undefined` and are filled
  later in the editor. This is the deliberate minimal path.
- **Success:** Optimistic create → redirect to `/spaces/:id/edit`; a `Toast`
  confirms.
- **Permission-gated by role:**
  - `teacher` without the create permission → "New Space" entry is hidden; if
    deep-linked to `/spaces/new`, show a `Modal` with `InlineAlert` "You don't
    have permission to create spaces" + Cancel only.
  - `teacher`: the Teachers picker pre-selects **self** and may be restricted to
    teachers sharing their classes; `accessType: 'public_store'` is hidden
    (store publishing is admin-gated → deferred to editor).
  - `tenantAdmin`: full Access Type set; Teachers picker spans the whole tenant.

---

## 6. Interactions & motion

- **Open:** Dialog enters with `ease.entrance` over `base` (220ms) — scrim
  fades, panel scales 0.98→1 + fade. Mobile Sheet slides up over `slow` (320ms).
  Respects `prefers-reduced-motion` (fade only, no scale).
- **Type Select change:** the field `help` text swaps to the selected type's
  description with an `instant` (100ms) crossfade (mirrors
  `SpaceSettingsPanel`'s `selectedTypeMeta.description` behavior).
- **Access Select change:** choosing `class_assigned` reveals the Classes +
  Teachers pickers with a `fast`/`base` height+fade reveal (`ease.standard`);
  `tenant_wide` / `public_store` collapse them.
- **Label tokenizer:** typing comma/Enter commits a `Chip/Tag` with a subtle pop
  (`fast`); Backspace on an empty input removes the last chip.
- **Create (optimistic):** On submit — button enters loading (spinner, label
  "Creating…"), the dialog **optimistically closes** and routes to
  `/spaces/:id/edit` using the predicted id from the create response. A `Toast`
  "Space created — start adding story points" appears (`spark`-tinted success
  icon, the one allowed celebratory accent for creation). If `saveSpace`
  rejects: roll back the navigation, reopen the dialog with preserved field
  values, surface a `FormFieldError`/`InlineAlert` (`status.error`), refocus the
  first offending field.
- **Validation timing:** Title validates on blur and on submit (not
  per-keystroke). Submit is disabled while `!title.trim()` (matches
  `SpaceSettingsPanel` save-guard).
- **Cancel / dismiss:** `Esc`, scrim click, ✕, or Cancel close with `ease.exit`.
  If any field is dirty, a `ConfirmDialog` ("Discard this new space?") guards
  accidental loss; clean form closes immediately.
- **No destructive confirmation on Create** — create is non-destructive (a
  draft).

---

## 7. Content & copy

Tone: **precise and quietly encouraging** (staff-facing, but this is the
optimistic "let's build" moment).

- **Heading (h2, Fraunces):** "Create a new space"
- **Subhead:** "Name it and pick where it lives — you can refine everything else
  in the editor."
- **Labels:** `Title` (required, marked with the standard required indicator) ·
  `Type` · `Subject (optional)` · `Description (optional)` · `Access` ·
  `Classes` · `Teachers` · `Labels (optional)` · `Academic session`.
- **Placeholders:** Title "e.g. Algebra I — Semester 1"; Subject "e.g.
  Mathematics"; Description "Briefly describe what students will learn or do
  here."; Labels "e.g. algebra, semester-1, honors".
- **Field help:** Type → live type description (Learning / Practice / Assessment
  / Resource / Hybrid, verbatim from `SpaceSettingsPanel.SPACE_TYPES`); Access →
  live access description (Class Assigned / Tenant Wide / Public Store, verbatim
  from `ACCESS_TYPES`); Academic session → "Defaults to your active session."
- **Footer note:** "You can change all of this later."
- **Buttons:** `Cancel` · `Create space` (loading: "Creating…").
- **Empty-state copy:** Classes "No classes yet — create one in Roster, or
  choose Tenant Wide access."
- **Error copy:** Title missing → "Give your space a title to continue." ·
  Create failed → "Couldn't create the space. Your details are saved here — try
  again." · Permission → "You don't have permission to create spaces. Ask a
  tenant admin."
- **Success toast:** "Space created — let's add some story points."

---

## 8. Domain rules surfaced

Grounded in `be-levelup` / `SaveSpaceRequestSchema` / `SpaceSettingsPanel`:

- **Upsert convention:** absent `id` ⇒ **create**; the create branch initializes
  `status: 'draft'` (common-api §"save\* upsert" + `ALLOWED_TRANSITIONS`: a new
  space starts `draft`, never published here).
- **Tenant isolation:** `tenantId` comes from the **auth claim**, not the form
  (common-api §tenantId-from-claim); the space is written under
  `tenants/{tenantId}/spaces/{id}`. Cross-tenant class/teacher ids are
  impossible — pickers only list entities in the caller's tenant.
- **Schema bounds (enforced server-side):** `title` ≤ `MAX_SHORT_TEXT`;
  `description` ≤ `MAX_MEDIUM_TEXT` (UI caps at 600 to stay well under);
  `labels`/`classIds`/`teacherIds`/`sectionIds` arrays ≤ `MAX_ARRAY_ITEMS`.
- **Enums are closed:**
  `type ∈ {learning, practice, assessment, resource, hybrid}`;
  `accessType ∈ {class_assigned, tenant_wide, public_store}` — the Selects
  render exactly these, no free text.
- **Access ⇒ assignment coupling:** `classIds`/`teacherIds` are only meaningful
  for `class_assigned`. For `tenant_wide` the space is visible to every class in
  the tenant; for `public_store` it surfaces on the store **only after publish**
  (the store mirror is a publish-time side effect, deferred out of create).
- **Store / pricing deferred:** `price`, `currency`, `publishedToStore`,
  `storeDescription` are accepted by the schema but intentionally **omitted from
  this minimal create** — set later in `SpaceSettingsPanel`.
- **Creator ownership:** the creating teacher is the implicit owner/teacher even
  if the Teachers picker is left empty.
- **Answer-key / assessment config** never appears here — it lives on story
  points / settings, not space creation. No student-facing answer-key surface
  exists on this screen.

---

## 9. Accessibility (WCAG AA)

- **Dialog semantics:** `role="dialog"` + `aria-modal="true"`, `aria-labelledby`
  → heading id, `aria-describedby` → subhead id. Focus is **trapped** within the
  dialog; on open, focus moves to the Title `Input`; on close, focus returns to
  the triggering "New Space" button.
- **Focus order:** Title → Type → Subject → Description → Access → (Classes →
  Teachers when revealed) → Labels → Academic session → Cancel → Create.
- **Keyboard:** `Esc` dismisses (guarded by `ConfirmDialog` if dirty); `Enter`
  in the Title field submits; `Cmd/Ctrl+Enter` submits from anywhere;
  Selects/Combobox are arrow-navigable with type-ahead; label chips removable
  via Backspace and have per-chip remove buttons reachable by Tab.
- **Errors:** `FormFieldError` linked via `aria-describedby`; invalid field gets
  `aria-invalid="true"`; the char counter and any async picker status use
  `aria-live="polite"` (matches `SpaceSettingsPanel`).
- **Contrast:** `text.primary`/`text.secondary` on `bg.surface`, `brand.primary`
  Create button, and all status colors meet AA (body 4.5:1, large/UI 3:1).
  Required state is conveyed by label text + indicator, **never color alone**;
  status in pickers pairs icon + label.
- **Reduced motion:** all reveals/pops collapse to opacity fades under
  `prefers-reduced-motion`; the creation success accent shows without the spring
  burst.
- Touch targets ≥44px; visible `border.focus` ring (focus-ring token) on every
  interactive element.

---

## 10. Web ↔ mobile divergence

`shared-ui` (web) and `ui-native` (mobile) keep **1:1 component names/props**;
only the renderer differs.

- **Container:** web = centered `Modal/Dialog` (e3, scrim); mobile = full-screen
  `Drawer/Sheet` slide-up with a drag handle and a fixed bottom action bar.
- **Layout:** Type/Subject 2-col grid (web lg) → always single column on mobile.
- **EntityPicker:** web = `Combobox` dropdown with chip results; mobile = tap
  opens a full-screen searchable selection sheet, selections shown as
  chips/avatars back on the form (press, not hover).
- **No ⌘K:** the CommandPalette entry point is web-only; mobile reaches this
  flow via the Spaces tab FAB / header "+".
- **Hover → press:** any hover affordance (e.g. chip remove reveal) becomes
  always-visible on mobile.
- **Redirect target** `/spaces/:id/edit` maps to the native editor route; the
  success Toast is identical (sonner web / native toast).

---

## 11. A Claude-design prompt

```
Design the "Create Space" modal for Auto-LevelUp, conforming EXACTLY to the Lyceum design system
(docs/rebuild-spec/design/00-FOUNDATION.md). Use ONLY its tokens and components — cite them by name,
invent nothing. Respect the AI-slop ban (no Inter/Roboto, no #3B82F6, no glass morphism).

Context: teacher/tenantAdmin first-creation flow. Centered Modal/Dialog over /spaces at route
/spaces/new, elevation e3, radius lg, bg.surface on a dimmed bg.canvas scrim, ~640px wide.
It is the create branch of v1.levelup.saveSpace (no id = create); on confirm it redirects to
/spaces/:id/edit. tenantId comes from the auth claim, NOT the form.

Type:
- Heading "Create a new space" in Fraunces at text-xl. Subhead + all body/labels in Schibsted
  Grotesk (text-sm/base). Any numerics/counters in Spline Sans Mono.

Fields (minimal — only Title required):
1. Title* (Input, placeholder "e.g. Algebra I — Semester 1").
2. Type (Select: Learning/Practice/Assessment/Resource/Hybrid) + live help text.
3. Subject (optional Input).
4. Description (optional auto-resizing Textarea, 0/600 mono counter, aria-live).
5. Access (Select: Class Assigned / Tenant Wide / Public Store). When "Class Assigned",
   reveal — with a fast ease.standard height+fade — two EntityPickers:
     • Classes  → Combobox multi-select rendering selected as Chip/Tag.
     • Teachers → Combobox multi-select rendering selected as AvatarGroup + names.
   (EntityPicker = Combobox + Chip/Tag/Avatar; async options from
    v1.identity.listClasses / listTeachers, with Skeleton option rows while loading.)
6. Labels (optional Input that tokenizes commas into Chip/Tags).
7. Academic session (Select, defaults to active session).

Footer: muted note "You can change all of this later." + secondary "Cancel" + primary "Create space"
(spark-accented success on creation). Create is disabled until Title is non-empty. On submit: button
spinner "Creating…", optimistic close + route, sonner toast "Space created — let's add some story
points." On failure: reopen with values preserved + FormFieldError in status.error.

Use semantic colors only (brand.primary for Create, text.primary/secondary, border.subtle/focus,
status.error). Spacing 5/6, gap-4 for the Type/Subject grid. Motion: enter ease.entrance @ base,
exit ease.exit; honor prefers-reduced-motion (fades only).

A11y: role="dialog" aria-modal, focus trap, focus to Title on open, return focus on close,
Esc/Cmd+Enter handling, aria-describedby errors, AA contrast, status never by color alone.

Show three states: (a) default with Class Assigned revealed and two classes + one teacher selected,
(b) pickers loading (Skeleton rows), (c) Create-failed with a preserved form + inline error.

Responsive: lg centered 640px dialog; md ~92vw single-column Type/Subject; sm/mobile a full-screen
Drawer/Sheet slide-up with a sticky bottom action bar (press, not hover; no ⌘K).
```
