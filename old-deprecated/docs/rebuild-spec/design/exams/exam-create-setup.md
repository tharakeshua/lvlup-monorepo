# Exam Create — Setup (Wizard)

_Step 1 of the 4-step exam-creation wizard: a precise metadata form that creates
the draft `Exam` and frames the shared stepper (Setup → Upload QP → Review →
Publish), conforming exactly to the Lyceum foundation._

---

## 1. Purpose & primary user

**Primary user:** Teacher (or tenant Admin acting as a teacher). Role gate: any
authenticated member with exam-create permission inside the active tenant.

**Job-to-be-done:** _"I have a physical/scanned exam I'm about to grade with
AutoGrade. Before I upload the question paper, I need to record what this exam
is — its title, subject, topics, which classes/sections sit it, the date, marks,
and (optionally) which LevelUp learning space it reinforces — so the system can
scope grading, analytics, and cross-domain linking correctly."_

The Setup step is the **identity + scope** of the exam. It produces a persisted
`draft` `Exam` so the teacher can leave and return, and so subsequent steps
(question-paper upload, Gemini extraction, publish) have a real `examId` to
attach to. It is deliberately low-stakes: nothing here is destructive,
everything is editable until publish, and most fields are re-editable after
publish too (only `POST_PUBLISH_LOCKED_FIELDS` lock — see §8).

---

## 2. Entry points & route

**Route:** `/exams/new` — renders the full wizard shell; the Setup step is the
default (`?step=setup` or step index `0`). Re-entry to an existing draft uses
`/exams/new?draftId=<examId>` (or the wizard reads the draft from route state
when navigated from the exams list "resume draft" action).

**Entry points:**

- `/exams` list page → **"New Exam"** primary `Button` (spark variant for the
  hero CTA).
- `CommandPalette (⌘K)` → "Create exam".
- Empty-state CTA on `/exams` when the tenant has zero exams.
- Resume: a `draft`-status `SubmissionCard`-less row in the exams `DataTable`
  exposes a "Continue setup" action → `/exams/new?draftId=…`.

**Common-API reads/writes** (clients call Firebase callables / live repos —
`region asia-south1`, all tenant-scoped):

- **Write — `saveExam`** (consolidated CRUD + server-enforced status machine):
  on first valid "Continue" / autosave, called with no `examId` to **create**
  the draft `Exam` (`status: 'draft'`, `createdBy`, tenant from auth context).
  Returns `examId`. Subsequent edits call `saveExam` with that `examId` to
  **patch** metadata. Server applies the status machine and
  `POST_PUBLISH_LOCKED_FIELDS` guard.
- **Read — classes/sections repo** (`classes.list` / `sections.listByClass`):
  populates the `classIds[]` multi-select and dependent `sectionIds[]`.
  Tenant-scoped.
- **Read — academic sessions repo** (`academicSessions.list`): populates
  `academicSessionId` select (optional).
- **Read — spaces repo** (LevelUp cross-domain, `spaces.list` /
  `spaces.search`): populates the optional `linkedSpaceId` Combobox; on select,
  the wizard caches `linkedSpaceTitle` for denormalized display.
- **Read — `exams.get`** when resuming a draft (`draftId`) to hydrate the form.

No grading, submission, or answer-key data is read or written by this screen.

---

## 3. Layout — wireframe-as-text

Rendered inside **AppShell** (Sidebar + Topbar). The wizard occupies the main
content region; the Sidebar shows `/exams` as the active nav root. Content is
centered to `max content width 1200`, with the form column constrained toward
the `reading 720` measure. Page gutters: mobile 16 / tablet 24 / desktop 32.

### lg (≥1024) — two-region: stepper rail + form

```
┌─AppShell────────────────────────────────────────────────────────────────┐
│ Sidebar │ Topbar (tenant switcher · search · ⌘K · notifications · profile)│
│         ├──────────────────────────────────────────────────────────────┤
│ [Exams] │ Breadcrumb:  Exams ›  New Exam                                  │
│  active │ ┌──────────────────────────────────────────────────────────┐  │
│         │ │ WIZARD HEADER                                             │  │
│         │ │  h1 "New Exam"   ·   Stepper (horizontal)                 │  │
│         │ │  ①Setup ──── ②Upload QP ──── ③Review ──── ④Publish        │  │
│         │ │   ▲active        (locked)       (locked)      (locked)    │  │
│         │ │            "Draft saved · 2s ago"  (autosave chip, right) │  │
│         │ ├──────────────────────────────────────────────────────────┤  │
│         │ │ ┌─ Card: "Exam details" ─────────────────────────────┐   │  │
│         │ │ │  Title*            [Input...................]        │   │  │
│         │ │ │  Subject*          [Select ▾]                       │   │  │
│         │ │ │  Topics            [Chip input: +add topic]         │   │  │
│         │ │ │                    (algebra)(calculus)(× )          │   │  │
│         │ │ └────────────────────────────────────────────────────┘   │  │
│         │ │ ┌─ Card: "Audience" ─────────────────────────────────┐   │  │
│         │ │ │  Classes*          [Multi-select ▾  3 selected]     │   │  │
│         │ │ │  Sections          [Multi-select ▾ (dep. on class)] │   │  │
│         │ │ │  Academic session  [Select ▾  optional]            │   │  │
│         │ │ └────────────────────────────────────────────────────┘   │  │
│         │ │ ┌─ Card: "Schedule & marks" ─────────────────────────┐   │  │
│         │ │ │  Exam date*  [DatePicker]   Duration [__ min]       │   │  │
│         │ │ │  Total marks* [___]         Passing marks* [___]    │   │  │
│         │ │ └────────────────────────────────────────────────────┘   │  │
│         │ │ ┌─ Card: "Reinforces (optional)" ────────────────────┐   │  │
│         │ │ │  LevelUp space  [Combobox ▾  search spaces…]        │   │  │
│         │ │ │  ↳ linked: "DSA — Arrays & Hashing"  (chip, ×)      │   │  │
│         │ │ └────────────────────────────────────────────────────┘   │  │
│         │ ├──────────────────────────────────────────────────────────┤  │
│         │ │ FOOTER NAV (sticky)                                       │  │
│         │ │  [Cancel/Discard]            [Save draft] [Continue ▸]    │  │
│         │ └──────────────────────────────────────────────────────────┘  │
└─────────┴──────────────────────────────────────────────────────────────┘
```

### md (768–1023) — stepper collapses to compact

- Sidebar collapses to icon rail (AppShell default). Stepper becomes a single
  horizontal compact bar `"Step 1 of 4 · Setup"` with a thin `ProgressBar`
  underneath; tapping it opens a `Popover` listing all steps with lock state.
- Cards stack full-width within the 720-ish measure; Schedule & marks fields go
  from 2-up to 2-up still (they fit), Audience fields stack 1-up.
- Footer nav remains sticky at viewport bottom.

### sm (<768) — stacked, mobile form

- AppShell uses Tabbar (mobile) instead of Sidebar; Topbar condenses.
- Stepper renders as **dots + label** (`● ○ ○ ○  Setup`) pinned under the `h1`.
- Every field is full-width, single column. `DatePicker` opens a native-friendly
  sheet. Multi-selects open a full-height `Drawer/Sheet` with search + checkbox
  list rather than an inline dropdown.
- Footer nav: `Continue` is full-width primary; `Save draft` becomes a `ghost`
  text button above it; `Discard` moves into an overflow `IconButton`/`Popover`
  in the header.

---

## 4. Components used (Lyceum inventory only)

**Navigation / shell:** AppShell, Sidebar, Topbar, Breadcrumb, Tabbar (mobile),
CommandPalette (entry only).

**Wizard frame:** `Stepper` — **proposed addition** (justified below). Card,
Section, Panel for the autosave/header strip.

**Form primitives:** Input (title, duration, total marks, passing marks), Select
(subject, academic session), Combobox (`linkedSpaceId` — searchable, async),
DatePicker (exam date), Checkbox (inside multi-select option rows), Button
(primary `Continue`, secondary `Save draft`, ghost/danger `Discard`).

**Topics + audience:** `Chip/Tag` (topics list + removable, `pill` radius) with
an Input-driven add affordance; multi-select for `classIds`/`sectionIds`
composed from Combobox + Checkbox rows (or `Select` in multi mode) rendering
selected items as `Chip`s. `Badge` for "N selected".

**Feedback:** Toast (sonner) for save success/failure, FormFieldError
(per-field), InlineAlert/Banner (top-of-form validation summary + draft-restore
notice), ConfirmDialog (discard / leave-with-unsaved), LoadingOverlay (during
draft hydrate on resume), Skeleton (loading), EmptyState (no classes
configured).

**Data:** `Chip` autosave-status indicator ("Draft saved · 2s ago" / "Saving…" /
"Save failed — retry"), ProgressBar (md/sm stepper progress).

**Proposed addition — `Stepper`:** the inventory has Tabs but not a gated,
sequential, progress-bearing stepper. A wizard stepper differs from Tabs: steps
are **ordered and lock-gated** (you cannot jump to Upload QP before Setup
validates / a draft exists), each carries a **completion state** (done / current
/ locked), and it owns the shared per-step nav contract. **Add `Stepper` to the
Lyceum container set**, composed from existing tokens — node = `pill`-radius
numbered circle (current: `brand.primary` fill + `text.on-accent`; done:
`status.success` check icon; locked: `bg.surface-sunken` + `text.muted`);
connectors use `border.subtle` (incomplete) → `brand.primary` (complete); labels
in Schibsted Grotesk `sm`. This `Stepper` is the shared wizard frame reused by
all four steps.

---

## 5. States

| State                     | Trigger                                               | Treatment                                                                                                                                                                                                                                                                                            |
| ------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Loading (fresh)**       | `/exams/new` with no draft                            | Form renders immediately (no remote data needed for shell). The `classIds`/`sections`/`sessions`/`spaces` selects show inline Skeleton shimmer in their menus until their repos resolve; the form is interactable for title/marks meanwhile.                                                         |
| **Loading (resume)**      | `?draftId=…`                                          | `LoadingOverlay` over the form Cards while `exams.get` hydrates; stepper header visible. On resolve, fields populate + InlineAlert "Resuming your draft."                                                                                                                                            |
| **Empty — no classes**    | tenant has zero classes/sections                      | Audience card shows `EmptyState` inside it: "No classes yet" + secondary `Button` "Set up classes" (deep-links to class admin). `Continue` is allowed only if classes are optional? No — `classIds` is required, so `Continue` stays disabled with helper text "Add at least one class to continue." |
| **Empty — no spaces**     | LevelUp has no spaces                                 | `linkedSpaceId` Combobox shows "No learning spaces found — this exam won't be linked." Field stays optional; no block.                                                                                                                                                                               |
| **Partial / invalid**     | required field missing or `passingMarks > totalMarks` | Inline `FormFieldError` under each offending field; a top `InlineAlert` (status.error) summarizes ("3 fields need attention"); `Continue` disabled. `Save draft` stays **enabled** (drafts may be incomplete).                                                                                       |
| **Saving**                | autosave or explicit save in flight                   | Autosave `Chip` → "Saving…" with a subtle spinner; `Continue` shows in-button spinner + disabled; optimistic field values retained.                                                                                                                                                                  |
| **Save error**            | `saveExam` rejects (network / quota / permission)     | Autosave Chip → "Save failed" (status.error) with retry `IconButton`; Toast (error) "Couldn't save draft — your changes are kept locally. Retry?"; form values preserved, nothing lost.                                                                                                              |
| **Success / advance**     | all valid + `saveExam` resolves with `examId`         | Toast (success, brief) "Draft saved"; stepper marks ①Setup **done** (success check), unlocks ②Upload QP; route advances to step 2.                                                                                                                                                                   |
| **Permission-gated**      | member without exam-create perm reaches route         | Whole wizard replaced by `EmptyState` "You don't have permission to create exams" + link back to `/exams`. (Server `saveExam` also rejects — defense in depth.)                                                                                                                                      |
| **Post-publish re-entry** | navigating "edit" into a published exam's setup       | Locked fields (`POST_PUBLISH_LOCKED_FIELDS`) render disabled with a lock icon + Tooltip "Locked after publish"; editable fields remain live.                                                                                                                                                         |

---

## 6. Interactions & motion

**Core flow:** fill metadata → first valid pause triggers **debounced autosave**
(creates draft) → continue editing (patches) → press **Continue** → validate →
`saveExam` → advance.

- **Draft autosave:** debounced ~`base 220ms` idle after the last keystroke, but
  actual network save throttled to ~every few seconds. First successful create
  swaps the URL to include `draftId` (replaceState, no nav flash). The autosave
  `Chip` cross-fades states (`fast 160ms`, `ease.standard`). This is the safety
  net — the teacher can close the tab anytime.
- **Stepper transitions:** node fill + connector fill animate `base 220ms`
  `ease.entrance`; the completing node's check uses a single subtle scale-in
  (NOT the marigold gamification burst — this is staff chrome, restraint
  applies). Page-level step change animates `page 420ms` with a horizontal slide
  (`ease.standard`), respecting reduced-motion (cross-fade fallback).
- **Topic chips:** typing + Enter/comma commits a chip with an entrance scale
  (`fast 160ms`); removing animates exit (`ease.exit`, `instant 100ms`).
  Duplicate topic shakes subtly + inline hint.
- **Class → Section dependency:** selecting/deselecting classes re-derives the
  Sections options; if a previously-selected section no longer belongs to a
  selected class, it's auto-removed with a Toast "Removed sections no longer in
  scope."
- **`passingMarks` vs `totalMarks`:** live cross-field validation; the error
  appears the moment `passingMarks` exceeds `totalMarks`, clears optimistically
  when corrected.
- **Continue (optimistic-ish):** button enters loading state; on resolve,
  advance. On reject, stay on step, surface error, keep all input. No optimistic
  _advance_ — we don't move forward until the server confirms the draft, because
  step 2 needs a real `examId`.
- **Discard:** `Discard` opens `ConfirmDialog` ("Discard this draft? This can't
  be undone."). Confirm → delete draft via `saveExam` (or discard endpoint) →
  route to `/exams`. If there are unsaved local edits and the user navigates
  away, a `ConfirmDialog` ("Leave without saving? Your latest changes aren't
  saved.") guards the route.
- **Toasts** via sonner, bottom-right (web), auto-dismiss `slow 320ms` enter.

---

## 7. Content & copy

Tone: **precise, calm, staff-facing**. No exclamation chrome (gamification
energy belongs to student surfaces only).

- **h1:** "New Exam" (Fraunces). On resume: still "New Exam" with InlineAlert
  "Resuming your draft."
- **Stepper labels:** `Setup` · `Upload question paper` · `Review` · `Publish`.
- **Card titles (h4, Schibsted):** "Exam details" · "Audience" · "Schedule &
  marks" · "Reinforces (optional)".
- **Field labels:** Title* · Subject* · Topics · Classes* · Sections · Academic
  session · Exam date* · Duration (min) · Total marks* · Passing marks* ·
  LevelUp space.
- **Placeholders / helpers:**
  - Title: "e.g. Unit 3 — Algebra Mid-term"
  - Topics: "Add a topic and press Enter" (helper: "Tag the concepts this paper
    covers — used for analytics and weak-area insights.")
  - Classes: "Select one or more classes" (helper if empty: "Add at least one
    class to continue.")
  - LevelUp space: "Search learning spaces…" (helper: "Optionally link this exam
    to a learning space to connect results back to mastery.")
  - Duration: "Optional"; Passing marks helper: "Must be less than or equal to
    total marks."
- **Validation copy:** "Title is required." · "Select at least one class." ·
  "Total marks must be greater than 0." · "Passing marks can't exceed total
  marks." · "Exam date is required."
- **Top InlineAlert (invalid):** "A few details need attention before you
  continue."
- **Empty (no classes):** title "No classes yet", body "Set up your classes and
  sections first, then come back to create this exam."
- **Autosave chip:** "Saving…" / "Draft saved · {relative time}" / "Save failed
  — retry".
- **Buttons:** `Continue` / `Save draft` / `Discard`. Discard confirm: title
  "Discard draft?", body "This draft and its details will be removed. This can't
  be undone.", confirm "Discard", cancel "Keep editing".
- **Save error toast:** "Couldn't save your draft. Your changes are kept —
  retry?"

---

## 8. Domain rules surfaced

- **Server-authoritative status machine:** the draft `Exam` is created with
  `status: 'draft'` by `saveExam`; the client never sets status directly.
  Advancing steps does not change `ExamStatus` here —
  `draft → question_paper_uploaded → question_paper_extracted → published` are
  driven by later steps' server actions.
- **`POST_PUBLISH_LOCKED_FIELDS`:** if this Setup form is re-entered for a
  `published`+ exam, `saveExam` rejects changes to locked fields. UI mirrors
  this by disabling those fields with a lock icon + Tooltip "Locked after
  publish." Editable fields (e.g. topics, linked space) stay live.
- **Tenant isolation:** every read (classes, sections, sessions, spaces, the
  draft itself) and the `saveExam` write are tenant-scoped from the
  authenticated context. The Topbar tenant switcher is the only tenant boundary;
  switching tenants mid-wizard discards/guards the draft.
- **Cross-domain link is denormalized + safe:** selecting `linkedSpaceId` caches
  `linkedSpaceTitle` (and optional `linkedStoryPointId`) on the `Exam` for
  display; the link is one-directional metadata — it never exposes LevelUp
  internals or student space progress on this screen.
- **No answer-key / rubric / grading data here.** Setup precedes question-paper
  upload and Gemini extraction; `UnifiedRubric`, model answers, and confidence
  routing do not exist yet for this exam. The
  **answer-key-never-shown-to-students** rule is upheld trivially (no key
  exists; nothing student-readable is produced — drafts are not released).
- **`passingMarks ≤ totalMarks`** and **`totalMarks > 0`** are enforced
  client-side for UX and re-validated server-side in `saveExam`.
- **Drafts are private to staff:** a `draft` exam is never visible to
  students/parents; results-release gating (`resultsReleased`) is a much later,
  explicit action.

---

## 9. Accessibility

- **Focus order:** Breadcrumb → Stepper (current step focusable; locked steps
  `aria-disabled`) → form fields top-to-bottom in DOM order (title → … → linked
  space) → footer nav (Save draft → Continue, with Discard reachable). Sticky
  footer does not trap focus.
- **Stepper semantics:** `<nav aria-label="Exam creation steps">` containing an
  ordered list; current step `aria-current="step"`; completed steps labelled
  "Setup, completed"; locked steps `aria-disabled="true"` and not in tab order.
  Status conveyed by **icon + text label**, never color alone (per Lyceum).
- **Form a11y:** every Input/Select/Combobox/DatePicker has an associated
  `<label>`; required fields marked `aria-required` and visually with `*` +
  "required" in the accessible name. Errors linked via `aria-describedby` to
  `FormFieldError`; the top InlineAlert uses `role="alert"` /
  `aria-live="assertive"` on first appearance, with focus moved to it on a
  failed Continue. Autosave Chip uses `aria-live="polite"` ("Draft saved").
- **Keyboard:** Topic chips removable via Backspace (when input empty) and
  per-chip × is a focusable `IconButton` with
  `aria-label="Remove topic {name}"`. Multi-select drawers (mobile) and
  dropdowns are arrow-key navigable with type-ahead; Combobox follows ARIA
  combobox pattern. DatePicker fully keyboard-operable. ConfirmDialog traps
  focus, Esc cancels, returns focus to trigger.
- **Contrast:** all field text, helper text (`text.secondary`/`text.muted`), and
  status chips meet WCAG AA (4.5:1 body, 3:1 UI/large). Disabled locked fields
  still meet 3:1 for their lock affordance + Tooltip.
- **Reduced motion:** `prefers-reduced-motion` replaces the step slide and chip
  cross-fades with instant/opacity-only changes; no autosave shimmer animation.
- **Targets:** all interactive controls ≥44px touch target on mobile.

---

## 10. Web ↔ mobile divergence

| Aspect                           | teacher-web (today)                             | Future RN / scanner-web                                                                                                         |
| -------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Shell                            | AppShell w/ Sidebar + Topbar                    | Tabbar (mobile) + condensed Topbar; RoleSwitcher if merged app                                                                  |
| Stepper                          | Horizontal numbered rail w/ connectors          | Dots + "Step 1 of 4 · Setup" + ProgressBar; tap → step list Sheet                                                               |
| Multi-selects (classes/sections) | Inline dropdown w/ Checkbox rows + Chips        | Full-height Drawer/Sheet w/ search + checkbox list                                                                              |
| DatePicker                       | Popover calendar                                | Native-style date Sheet                                                                                                         |
| LinkedSpace Combobox             | Inline async search dropdown                    | Full-screen search Sheet                                                                                                        |
| Hover affordances                | Hover states on chips/buttons, Tooltips on lock | Press states; lock reason via long-press / inline text (no hover)                                                               |
| ⌘K entry                         | CommandPalette "Create exam"                    | No command palette — entry via Tabbar/FAB                                                                                       |
| Footer nav                       | Sticky inline (Save draft + Continue)           | Full-width stacked: Continue primary, Save draft ghost above, Discard in header overflow                                        |
| Autosave chip                    | Inline header chip                              | Compact toast/inline under header; same `aria-live`                                                                             |
| Scanner-web note                 | n/a                                             | scanner-web is intake-only (`uploadSource: 'scanner'`); it does **not** expose exam creation — this wizard stays teacher-web/RN |

Component **names + props match 1:1** between `shared-ui` and `ui-native`; only
the renderer differs (per Foundation §6).

---

## 11. Claude-design prompt (ready to paste)

```
You are designing ONE screen for "Auto-LevelUp", conforming EXACTLY to the
"Lyceum" design system (Modern Scholarly). Do not invent tokens, fonts, or
component variants — compose only from Lyceum.

LYCEUM (cite by name, don't reinvent):
- Color (semantic): bg.canvas, bg.surface, bg.surface-sunken, bg.inset,
  text.primary/secondary/muted/on-accent, border.subtle/strong/focus,
  brand.primary (indigo-600) + brand.primary-hover, spark (marigold — hero CTA /
  gamification ONLY), status.success/warning/error/info.
- Type: Fraunces (display h1–h3, empty-state titles), Schibsted Grotesk
  (UI/body, h4–h6, labels, buttons, tables), Spline Sans Mono (numbers/IDs).
  Scale 1.25 major-third base 16. Display ≥31 → -0.02em tracking.
- Space 4px base; page gutters 16/24/32; max width 1200, reading 720.
  Radius: cards lg(14), inputs/buttons md(10), chips pill. Elevation e1 cards,
  e2 popovers, e3 modals; focus ring 3px indigo@35%; spark glow hero-CTA only.
- Motion: instant100/fast160/base220/slow320/page420; ease.standard/entrance/
  exit; respect prefers-reduced-motion; the ONE celebratory marigold burst is
  reserved for student gamification — staff chrome stays subtle.
- Components: AppShell, Sidebar, Topbar, Breadcrumb, Card, Section, Panel,
  Input, Select, Combobox, DatePicker, Checkbox, Chip/Tag, Badge, Button
  (primary/secondary/ghost/danger), InlineAlert/Banner, FormFieldError, Toast
  (sonner), ConfirmDialog, Skeleton, EmptyState, ProgressBar, LoadingOverlay.
  Plus a NEW shared "Stepper" container (numbered, ordered, lock-gated,
  done/current/locked nodes; connectors border.subtle→brand.primary).

SCREEN: "Exam Create — Setup" at /exams/new — Step 1 of a 4-step wizard
(Setup → Upload question paper → Review → Publish). Build the shared wizard
frame (horizontal Stepper header + sticky footer nav: "Save draft" secondary,
"Continue" primary) AND the Setup step in full.

SETUP FORM (grouped in Cards):
- "Exam details": Title* (Input), Subject* (Select), Topics (removable Chip
  input — Enter to add).
- "Audience": Classes* (multi-select → Chips, "N selected" Badge), Sections
  (multi-select, dependent on selected classes), Academic session (Select,
  optional).
- "Schedule & marks": Exam date* (DatePicker), Duration (Input, min, optional),
  Total marks* (Input), Passing marks* (Input).
- "Reinforces (optional)": LevelUp space (async searchable Combobox → linked
  Chip).

BEHAVIOR: Debounced draft autosave (header Chip: "Saving…" / "Draft saved ·
2s ago" / "Save failed — retry") — the draft Exam is created server-side via a
`saveExam` callable (status 'draft', tenant-scoped). Live cross-field rule:
passingMarks ≤ totalMarks and totalMarks > 0. "Continue" disabled until valid;
"Save draft" allowed while incomplete. Discard → ConfirmDialog. On valid
Continue, mark Setup done (success check) and unlock step 2.

STATES to show: fresh loading (select menus skeleton), resume (LoadingOverlay +
"Resuming your draft" InlineAlert), empty-no-classes (EmptyState inside Audience
card + "Set up classes"), invalid/partial (per-field FormFieldError + top
status.error InlineAlert), saving, save-error (toast, changes preserved),
success/advance, no-permission (EmptyState), post-publish re-entry (locked
fields disabled + lock Tooltip "Locked after publish").

DOMAIN RULES: server-authoritative status machine (client never sets status);
POST_PUBLISH_LOCKED_FIELDS disable on re-entry; strict tenant isolation on all
reads/writes; linkedSpaceId caches linkedSpaceTitle (denormalized, one-way, no
student data); NO answer-key/rubric/grading on this screen; drafts never visible
to students.

A11Y: labelled fields, aria-required, aria-describedby errors, role="alert"
top alert with focus-on-fail, aria-current="step" + aria-disabled locked steps,
status by icon+label never color alone, polite aria-live autosave chip, full
keyboard (chip Backspace-remove, combobox ARIA pattern), AA contrast, reduced-
motion fallbacks, ≥44px targets.

RESPONSIVE: lg = stepper rail + form Cards (reading-width); md = compact
"Step 1 of 4" bar + ProgressBar, stacked cards; sm = dots+label stepper,
single-column, multi-selects as full-height Sheets, full-width sticky Continue.

Output: a clean, production-grade React + Tailwind screen using Lyceum tokens by
name, the component inventory above, and the new Stepper. Restrained, editorial,
precise — staff tooling, not playful.
```
