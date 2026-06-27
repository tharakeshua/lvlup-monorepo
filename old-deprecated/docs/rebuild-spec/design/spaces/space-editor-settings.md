# Space Settings Tab — Design Spec

> Conforms to the **Lyceum** foundation
> (`docs/rebuild-spec/design/00-FOUNDATION.md`). All colors, type, spacing,
> radius, elevation, motion, and components are cited by token/name — none
> invented. Register: **precise for staff** (this is a teacher/admin
> configuration surface, not a student view).

---

## 1. Purpose & primary user

**Primary role:** `teacher` (space owner / co-teacher) and `tenantAdmin`.
**Job-to-be-done:** _"Configure the identity, audience, and default behavior of
a Space so its story points, tutoring, and graded attempts behave the way I
intend — without touching content."_

This is the **Settings tab** of the Space Editor. It edits the `Space`
document's metadata and config fields: core identity, classification,
assignment/audience, AI agent defaults, and assessment defaults. It is
deliberately scoped **away from** content authoring (StoryPoint/Item editing —
separate specs) and **away from** store/B2C listing (`space-store-listing.md`).
The single write is an upsert of `Space`.

---

## 2. Entry points & route

**Route:** `/spaces/:spaceId/edit` → **Settings** tab (the `SpaceSettingsPanel`
component). **Entry points:**

- Space Editor top tabs (`Settings` sits beside `Content`, `Assignments`,
  `Store`, `Versions`).
- "Edit settings" action on a `SpaceCard` overflow menu (teacher dashboard /
  class detail).
- Deep-link from a publish-validation banner ("fix required fields before
  publishing").

**Common-API (cite `docs/rebuild-spec/specs/common-api.md`):**

- **Read:** `v1.levelup.getSpace` (`{ spaceId, tenantOverride? }` → `Space`) —
  wrapped by `useSpace(spaceId)`. Reads `tenants/{tenantId}/spaces/{spaceId}`
  behind the API seam (common-api §144).
- **Write:** `v1.levelup.saveSpace` (upsert; `id` present ⇒ update) via
  `useSaveSpace()` (common-api §248–253). On success it invalidates
  `spaceKeys.detail(spaceId)` + `spaceKeys.list(tenantId)` (narrowest correct
  scope).
- **Thumbnail upload side-channel:**
  `callUploadTenantAsset({ tenantId, assetType: "space_thumbnail", contentType })`
  → signed `uploadUrl` + `publicUrl`; the client PUTs the file, then stores
  `publicUrl` into `thumbnailUrl`.
- AI agent pickers read the tenant agent registry (`v1.identity.listAgents` /
  equivalent) filtered by role (`tutor` vs `evaluator`). Class/section/session
  pickers read `listClasses` / `listSections` / `listAcademicSessions`.

`saveSpace` enforces `ALLOWED_TRANSITIONS` + `validatePublish` (common-api §134)
— relevant when a settings edit is the precondition that unblocks publishing.

---

## 3. Layout — wireframe-as-text

Rendered inside **AppShell** (Sidebar + Topbar). The Space Editor owns a sticky
sub-header (space title + status `Badge` + tab row); this tab fills the content
region. Single reading column, **max-width 768** (`md` container, foundation §4
reading width), centered, page gutters 16/24/32 (mobile/tablet/desktop).

```
┌─ AppShell ───────────────────────────────────────────────────────────────┐
│ Sidebar │ Topbar (tenant switcher · ⌘K · notifications · profile)         │
│         ├──────────────────────────────────────────────────────────────── │
│         │ Breadcrumb: Spaces / {title}                                     │
│         │ ┌ Editor sub-header (sticky) ──────────────────────────────────┐│
│         │ │ {title}  [Badge: draft]      [Content][Settings*][Store][…]   ││
│         │ └──────────────────────────────────────────────────────────────┘│
│         │                                                                  │
│         │   ── reading column (max-w 768, gap-6) ──                        │
│         │   ┌ Section: Core ───────────────────────[Info]┐                 │
│         │   │ Title*  · Slug · Description (count) · Thumb │                │
│         │   └─────────────────────────────────────────────┘               │
│         │   ┌ Section: Classification ─────────────[Tag]──┐                │
│         │   │ Type (Select) · Subject · Labels (Chip[])   │                │
│         │   └─────────────────────────────────────────────┘               │
│         │   ┌ Section: Assignment / Access ────────[Users]┐                │
│         │   │ Access Type · Classes · Sections · Teachers │                │
│         │   │ · Academic session                          │                │
│         │   └─────────────────────────────────────────────┘               │
│         │   ┌ Section: AI defaults ────────────[Sparkles]─┐                │
│         │   │ Default tutor agent · Default evaluator     │                │
│         │   └─────────────────────────────────────────────┘               │
│         │   ┌ Section: Assessment defaults ──[ClipboardList]┐              │
│         │   │ Time limit · Allow retakes(+max) · Show answers│             │
│         │   └─────────────────────────────────────────────┘               │
│         │                                                                  │
│         │ ┌ Sticky SaveBar (bottom) ─────────────────────────────────────┐│
│         │ │ "Changes apply to all teachers & students" · [Save settings] ││
│         │ └──────────────────────────────────────────────────────────────┘│
└─────────┴──────────────────────────────────────────────────────────────────┘
```

**Responsive:**

- **lg (≥1024):** sidebar expanded; reading column centered at 768 with ~32
  gutters.
- **md (768–1023):** sidebar collapses to icon rail; column fluid to gutter;
  Assignment dual-pickers (e.g. Price/Currency analog) stay `sm:grid-cols-2`
  where paired, else single column.
- **sm (<768):** Tabbar replaces sidebar; tab row scrolls horizontally; all
  fields full-width single column; SaveBar pins to bottom above the Tabbar with
  safe-area inset.

Each grouping is a `Card` (radius `lg`, `e1` at rest) with a `SectionHeader`
(lucide icon in `text.muted`

- `CardTitle` h4/Schibsted 600 + `CardDescription` xs). Vertical rhythm =
  spacing `6` (24) between cards, `5` (20) between fields within a card.

---

## 4. Components used (from §5)

**Containers:** `AppShell`, `Tabs` (editor sub-nav), `Card` + Section header
pattern, `Section`, `Breadcrumb`. **Primitives:** `Input` (title, slug, subject,
numeric time-limit/max-retakes), `Textarea` (description, auto-resize), `Select`
(Type, Access Type), `Combobox` (Subject suggest, Default tutor/evaluator agent,
Academic session — single-select typeahead), `Combobox` multi (Classes,
Sections, Teachers, Labels → token entry), `Switch` (Allow retakes, Show correct
answers), `Checkbox` (n/a default), `FileDrop` (thumbnail upload), `Button`
(Save = `primary`; thumbnail mode toggles = `secondary`/`ghost`), `IconButton`
(remove thumbnail). **Data / feedback:** `Chip/Tag` (label + assigned
class/teacher pills), `Badge` (status in sub-header), `Skeleton` (load),
`EmptyState` (no classes to assign), `InlineAlert/Banner` (publish-blocking
warnings), `FormFieldError`, `Toast` (sonner — save success/fail, upload
result), `Tooltip` (field help on staff-dense fields), `LoadingOverlay` (none —
inline `saving` preferred), `DefinitionList` (read-only audit footer:
created/updated by). **Domain:** `AnswerKeyLock` is **not** rendered here (no
answer-key surface); referenced only conceptually in §8 to justify why
`showCorrectAnswers` is a _post-submission_ default, not an authoring leak.

**Proposed addition (justified):** **`SaveBar`** — a sticky bottom action bar
(left: scope hint text; right: dirty indicator + primary Save, optional
Discard). The current code hand-rolls this with a
`sticky bottom-0 backdrop-blur` div. Promote it to a foundation component
because Exam editor, Agent editor, and Tenant settings all need the identical
"scoped autosave/save" affordance. Tokens: `bg.surface` @ 80–95% + backdrop
blur, `border.subtle` top, `e2` when content scrolls beneath it.

**Note:** glass/`backdrop-blur` on the SaveBar is permitted only as a thin
functional scrim over a _solid_ `bg.surface` fallback — never decorative glass
morphism (foundation §1 banned list).

---

## 5. States

- **Loading:** `Skeleton` cards mirroring each section's field heights;
  sub-header title is a 1-line shimmer, status `Badge` hidden until loaded. No
  layout shift (reserve column width).
- **Empty (new draft routed here):** all fields blank/defaulted (`type` defaults
  `learning`, `accessType` `class_assigned`, `showCorrectAnswers` true, time
  limit `0`). Assignment section shows `EmptyState` "No classes assigned yet —
  students won't see this space until you assign at least one class." with a
  CTA.
- **Error (load):** full-card `InlineAlert` (status.error) "Couldn't load this
  space" + Retry. Sub-header stays so the user can switch tabs.
- **Partial:** thumbnail uploading → `FileDrop` shows inline "Uploading…"
  spinner while the rest of the form stays interactive; agent/class pickers can
  load lazily (their own per-field skeleton in the `Combobox`).
- **Success (saved):** sonner `Toast` "Settings saved", SaveBar returns to clean
  (Save disabled until next edit), dirty-dot clears.
- **Dirty:** any field change enables Save and shows a marigold (`spark`) 6px
  dirty-dot beside the Save label; navigating away with unsaved changes triggers
  a `ConfirmDialog`.
- **Validation:** per-field `FormFieldError` under the offending field (zod
  `SaveSpaceRequest`); Save stays enabled but on submit failing fields scroll
  into view and focus the first error.

**Permission-gated variations:**

- `teacher` (owner/co-teacher): full edit on Core, Classification, AI defaults,
  Assessment defaults; may edit Assignment **only** within classes they teach.
  `accessType: tenant_wide` / `public_store` options are **disabled** (Tooltip:
  "Tenant admins control organization-wide and store visibility").
- `tenantAdmin`: all of the above plus `tenant_wide`, full teacher list, and
  academic session reassignment.
- Non-owner teacher (read-only): inputs render `disabled`, SaveBar hidden, an
  `InlineAlert` notes view-only.

---

## 6. Interactions & motion

**Save flow (explicit Save, optional debounced autosave):**

1. User edits → field updates local RHF state; SaveBar enables (`fast` 160ms
   opacity/transform on the dirty-dot appearing, `ease.standard`).
2. Click **Save settings** → button enters loading ("Saving…", spinner),
   `saveSpace` mutation fires.
3. **Optimistic:** the editor sub-header reflects new title/status immediately;
   on error, revert + error Toast.
4. Success → sonner Toast slides in (`base` 220ms, `ease.entrance`), SaveBar
   clears.

**Autosave (recommended):** debounce `slow` (320ms after last keystroke) →
silent `saveSpace`; show a quiet "Saved" micro-label in the SaveBar with
`instant`(100ms) fade. Explicit Save remains for confidence. Autosave never
fires while a field is in an invalid state.

**Thumbnail:** drag-over highlights `FileDrop` border to `border.focus`
(`fast`); on drop/select, validate type (PNG/JPEG/WebP) + size (≤2MB) → Toast on
reject; on accept, upload → preview fades in (`base`). Remove = `IconButton`
(danger) on hover/focus of preview.

**Retake dependency:** toggling **Allow retakes** Switch reveals **Maximum
retakes** with a height/opacity expand (`base`, `ease.entrance`); collapsing
clears `maxRetakes` from the payload.

**Confirmations:** leaving the tab dirty → `ConfirmDialog` "Discard unsaved
changes?" (Cancel / Discard). Changing `accessType` to a narrower audience that
would unassign students → inline `InlineAlert` warning (no hard confirm;
reversible until Save).

**Motion discipline:** no celebratory motion here (staff surface). Reserve the
spring/marigold burst for student gamification only (foundation §4). Respect
`prefers-reduced-motion`: replace expands/fades with instant state swaps.

---

## 7. Content & copy

Tone: **precise, operator-grade**, second person, no exclamation. Field help is
one calm sentence.

- **Section headings (h4):** "Core", "Classification", "Assignment", "AI
  defaults", "Assessment defaults".
- **Title** — label "Title", placeholder "e.g. Algebra I — Semester 1", help
  "Shown on cards, breadcrumbs, and student dashboards." Error: "A title is
  required."
- **Slug** — help "URL-safe identifier. Lowercase letters, numbers, and
  hyphens." Error: "Use only lowercase letters, numbers, and hyphens."
  (auto-suggested from title; editable).
- **Description** — placeholder "Briefly describe what students will learn or do
  in this space.", counter `{n}/600` (amber within 50 of cap).
- **Type** — help echoes the selected type's description
  (Learning/Practice/Assessment/Resource/Hybrid).
- **Subject** — help "Used for filtering and discovery."
- **Labels** — help "Comma-separated tags for grouping in search and reports."
  (token chips).
- **Access Type** — help echoes selected: Class Assigned / Tenant Wide / Public
  Store descriptions.
- **Default tutor agent / evaluator agent** — help "Applied to story points
  unless overridden per item." Empty option label: "None (use tenant default)".
- **Default time limit** — suffix "minutes", help "Set to `0` for no limit."
- **Allow retakes** — help "Students can re-attempt graded story points up to
  the limit below."
- **Maximum retakes** — help "Total attempts allowed, including the first."
- **Show correct answers after submission** — help "Students see correct answers
  and explanations once they submit."
- **SaveBar:** left "Changes apply to all teachers and students of this space.";
  button "Save settings" → "Saving…". Save Toast: "Settings saved". Upload
  Toasts: "Thumbnail uploaded" / "Image must be under 2MB".
- **Empty assignment:** "No classes assigned yet — students won't see this space
  until you assign at least one class."
- **Error (load):** "Couldn't load this space. Check your connection and try
  again."

---

## 8. Domain rules surfaced

Grounded in `Space` (`packages/shared-types/src/levelup/space.ts`) and
be-levelup `saveSpace`:

- **Tenant isolation:** Space lives at `tenants/{tenantId}/spaces/{spaceId}`;
  `tenantId` is immutable and injected server-side. Class/section/teacher/agent
  pickers are scoped to the active tenant only.
- **Upsert convention:** `id` present ⇒ update (common-api §84). No client-side
  delete here; archival is a lifecycle transition on the Versions/status
  control, not a settings field.
- **Publish gating:** `validatePublish` requires a valid title (and, for store,
  listing fields). Settings is where those preconditions are satisfied; a
  publish attempt elsewhere may deep-link back here.
- **Access vs assignment:** `accessType: class_assigned` ⇒ visibility derives
  from `classIds`/`sectionIds`; `tenant_wide`/`public_store` are admin-gated
  (store config itself lives in `space-store-listing.md`).
- **AI defaults are inheritance roots:** `defaultTutorAgentId` /
  `defaultEvaluatorAgentId` seed story points/items but are overridable
  downstream — copy must say "unless overridden", never imply hard lock.
- **`showCorrectAnswers` is post-submission only:** it governs _review after
  submit_, never exposes the answer key during an attempt. The
  answer-key-never-shown-to-students invariant (the `AnswerKeyLock` guard,
  foundation §5) is unaffected by this toggle.
- **Retake semantics:** `maxRetakes` counts the **first attempt** in the total;
  only persisted when `allowRetakes` is true (server drops `maxRetakes`
  otherwise).
- **Time limit `0` = unlimited** (not "zero minutes"); the server-authoritative
  `TimerBar` honors this default.
- **Audit fields** (`createdBy/createdAt/updatedBy/updatedAt`, `version`) are
  server-managed and shown read-only; never client-writable.

---

## 9. Accessibility

- **Focus order:** Tab row → Core fields top-to-bottom → … → Assessment →
  SaveBar Save. Logical DOM order matches visual order; sticky SaveBar is last
  and reachable.
- **Labels:** every control has a programmatic `<Label htmlFor>`; help text
  linked via `aria-describedby`; errors via `aria-describedby` + `aria-invalid`
  on the field.
- **Counters / async status:** description/store counters and upload status use
  `aria-live="polite"`.
- **Switches:** `role="switch"` with `aria-checked`; the "Maximum retakes"
  reveal is announced (the toggle controls a region via `aria-controls` /
  `aria-expanded`).
- **Combobox/Select:** keyboard typeahead, Arrow/Enter/Esc,
  `aria-activedescendant`; multi-select chips are removable via keyboard
  (Backspace / Delete on focused chip) with `aria-label="Remove {label}"`.
- **Thumbnail FileDrop:** keyboard-activatable (Enter/Space opens picker); not
  mouse-only; remove button has `aria-label`.
- **Contrast:** all text/bg pairs meet WCAG AA (foundation §2.3) — body 4.5:1,
  UI/large 3:1. Status never by color alone: errors pair red with icon + text;
  near-cap counter pairs `status.warning` amber with the count.
- **Focus ring:** `border.focus` 3px indigo @35% ring on all interactive
  elements; visible in dark theme too.
- **Reduced motion:** honor `prefers-reduced-motion` — disable
  expands/fades/blur transitions, keep instant state changes; SaveBar appears
  without slide.

---

## 10. Web ↔ mobile divergence

`shared-ui` ↔ `ui-native` keep names/props 1:1 (foundation §6); only the
renderer differs.

- **Editor tabs:** web = horizontal `Tabs`; mobile = horizontally scrollable
  segmented control or a `Select`-driven tab switcher (no room for 5 tabs).
- **SaveBar:** web = sticky bottom bar; mobile = same, pinned above the `Tabbar`
  with safe-area inset; on mobile prefer **explicit Save** (autosave-on-blur)
  over keystroke autosave to spare battery/network.
- **Hover → press:** thumbnail remove button and field tooltips are
  hover-revealed on web; on mobile the remove `IconButton` is always visible and
  help is a tappable `Info` icon opening a `Popover`/sheet.
- **No ⌘K** on mobile (Topbar command palette omitted); search reached via
  Tabbar.
- **Pickers:** web `Combobox` popovers → mobile bottom-sheet selectors
  (`Drawer/Sheet`) for Classes/Teachers/ Agents; multi-select chips wrap to
  multiple rows.
- **FileDrop:** drag-and-drop is web-only; mobile shows "Choose image" → native
  camera/library picker.
- **Numeric inputs:** mobile uses `inputmode="numeric"` for
  time-limit/max-retakes.

---

## 11. Claude-design prompt

```text
Design the "Space Settings" tab of the Space Editor for Auto-LevelUp, a multi-tenant education platform.
STRICTLY conform to the Lyceum design system in docs/rebuild-spec/design/00-FOUNDATION.md — do not invent
colors, fonts, or components. Use ONLY foundation tokens by name.

Audience & tone: a TEACHER or TENANT-ADMIN configuring a learning Space. Register = precise, operator-grade,
calm — NOT the warm student register. No gamification motion here.

Surface: render inside AppShell (Sidebar + Topbar). A sticky editor sub-header shows the space title, a
status Badge (draft/published/archived), and a Tabs row (Content · Settings* · Store · Versions). The
Settings tab is a single centered reading column, max-width 768 (foundation §4), cards stacked with gap-6.

Type: Fraunces for any display heading; Schibsted Grotesk for labels/help/buttons; Spline Sans Mono for the
description character counter and numeric inputs (tabular). Cards = radius lg, elevation e1, bg.surface.
Section headers = lucide icon in text.muted + h4 title + xs CardDescription.

Sections (each its own Card):
1) Core — Title (required), Slug (auto-suggested, url-safe), Description (Textarea auto-resize, 600-char
   counter, amber within 50 of cap), Thumbnail (FileDrop: drag/drop or browse, PNG/JPEG/WebP ≤2MB, with
   16:9 preview + remove IconButton, plus a "URL" mode toggle).
2) Classification — Type (Select: learning/practice/assessment/resource/hybrid, help echoes selection),
   Subject (Combobox typeahead), Labels (token/chip multi-entry).
3) Assignment — Access Type (Select: class_assigned/tenant_wide/public_store; the latter two DISABLED for
   plain teachers with a Tooltip), Classes / Sections / Teachers (multi Combobox → bottom-sheet on mobile),
   Academic session (single Combobox).
4) AI defaults — Default tutor agent, Default evaluator agent (single Combobox, "None (use tenant default)").
5) Assessment defaults — Default time limit (numeric + "minutes", 0 = no limit), Allow retakes (Switch that
   reveals Maximum retakes), Show correct answers after submission (Switch).

Sticky SaveBar at the bottom: left hint "Changes apply to all teachers and students of this space.", right
a primary Button "Save settings" with a marigold (spark) dirty-dot when there are unsaved changes. Use a
thin functional backdrop scrim over solid bg.surface — NOT decorative glass.

States to show: loading skeletons per section; empty-assignment EmptyState; field-level FormFieldError
(zod SaveSpaceRequest); read-only/disabled variant for non-owner teachers; sonner success Toast "Settings
saved". Motion per foundation §4 (fast/base, ease.standard/entrance); respect prefers-reduced-motion.
Accessibility: WCAG AA contrast, full keyboard nav, aria-live counters, switch aria-controls for the retake
reveal, never status-by-color-alone.

Data: this writes a Space upsert via v1.levelup.saveSpace (fields: title, slug, description, thumbnailUrl,
type, subject, labels[], accessType, classIds[], sectionIds[], teacherIds[], academicSessionId,
defaultTutorAgentId, defaultEvaluatorAgentId, defaultTimeLimitMinutes, allowRetakes, maxRetakes,
showCorrectAnswers). Do NOT render any answer-key surface; showCorrectAnswers only governs post-submission
review. Exclude store/B2C listing fields (separate spec). Output clean React + Tailwind reading Lyceum
tokens via @theme.
```
