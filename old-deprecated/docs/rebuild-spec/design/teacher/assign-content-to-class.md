# Assign Content to Class

> A focused, server-authoritative action flow that wires an existing **space**
> (learning / practice / assessment) or an **exam** to one or more classes —
> setting access, an optional availability window, and visibility — then
> confirming. It does **not** author content (authoring lives in SPACES; grading
> lives in EXAMS); it only controls _who sees what_.

**Route** · `/assign` (standalone) + launched as a Drawer overlay from
`/classes` and `/classes/:classId` · **Roles** · `teacher`, `tenantAdmin` ·
**Primary APIs** · reads `spaces.list`, `exams.list`, `classes.list` (via
`@levelup/api-client` repos); writes `v1.levelup.assignContent` (proposed
canonical assign callable) — falls back to `v1.levelup.saveSpace` /
`v1.autograde.saveExam` if the dedicated callable is not yet shipped.

---

## 1. Purpose & primary user

**Primary user:** a `teacher` (managing a subset of classes) or a `tenantAdmin`
(all classes), operating the teacher-web operational portal.

**Job-to-be-done:** "I have already built this space / exam. Now make it visible
to the right class(es), optionally with a start/end window, and confirm exactly
which students will gain access — without leaving the page I'm on."

This is the **assignment wiring surface**, deliberately separated from authoring
and grading:

- Assigning a space sets `space.classIds` (intersection of target classes) and,
  when assigning to classes, `accessType: 'class_assigned'`. Student visibility
  is then governed server-side by `canAccessSpace` (admin/teacher always;
  student only when `accessType == 'tenant_wide'` OR the space's `classIds`
  intersect the student's claim `classIds`).
- Assigning an exam sets `exam.classIds`. Students in those classes become
  eligible to sit the exam (subject to exam `status` and results-release gating,
  which this screen does not change).

The tone is **precise, credible, calm** — no XP/streak chrome. The one place
gamification appears is read-only context (e.g. a class roster preview), never
celebration.

---

## 2. Entry points & route

This screen is an **action surface**, primarily a Drawer
(`@levelup/shared-ui/primitives` `Drawer`/`Sheet`), plus a standalone route for
deep-linking.

**Entry points:**

1. **Class detail** (`/classes/:classId`) → header action **"Assign content"**
   opens the Drawer with the target class **pre-selected** in step 2.
2. **Classes overview** (`/classes`) → toolbar action **"Assign content"** opens
   the Drawer with no class pre-selected.
3. **Standalone** route `/assign` (in nav group _Content_, `navMeta.permission`
   gated) — full-page variant of the same flow for direct linking / "assign
   multiple things in a session".
4. **(Optional contextual)** From a `SpaceCard` overflow menu on `/spaces` and
   an exam row overflow on `/exams` → opens the Drawer with the content
   **pre-selected** in step 1 (skips straight to class selection). This screen
   never lets you _edit_ the content — only assign it.

**Route manifest entry** (`apps/teacher-web/src/routes.ts`):

```ts
{ path: '/assign', lazy: () => import('./pages/AssignContentPage'),
  allow: ['teacher','tenantAdmin'],
  navMeta: { group: 'Content', label: 'Assign', icon: 'share-2',
             permission: 'canManageSpaces' } }
```

The Drawer variant is mounted by a shared `useAssignContent()` headless
controller (state machine:
`pickContent → pickClasses → schedule → review → submitting → done`) so the
Drawer and the `/assign` page render the **same** steps from one source.

**APIs (via `@levelup/api-client`, never Firestore directly):** | Concern | Call
| |---|---| | Assignable spaces |
`spaces.list({ status: 'published', assignable: true })` (repo read →
`v1.levelup.listSpaces`) | | Assignable exams |
`exams.list({ status: ['published','scheduled'] })` (repo read →
`v1.autograde.listExams`) | | Target classes | `classes.list()` (repo read;
server already scopes to caller's `managedClassIds` / all for admin) | | Roster
preview count | `analytics.getSummary({ scope: 'class', classId })` for an
at-a-glance student count, OR `classes.get(classId).studentCount` if cheaply
denormalized | | **Assign (write)** |
`api.levelup.assignContent({ contentType, contentId, classIds, window?, visibility })`
→ `SaveResponse` _(proposed)_ |

> **Proposed callable — note for backend.** Add `v1.levelup.assignContent`
> (module `levelup`, `rateTier: 'write'`) as the single canonical assign
> operation. Request:
> `{ contentType: 'space' | 'exam'; contentId: string; classIds: string[]; mode: 'replace' | 'add' | 'remove'; window?: { startAt?: epochMillis; endAt?: epochMillis }; visibility: 'class_assigned' | 'tenant_wide' }`.
> The server (a) loads the content, (b) authorizes the caller against every
> target class (`canAccessClass`), (c) merges `classIds` per `mode`, (d) sets
> `accessType`/window, (e) recomputes denormalized stats and `space.classIds` on
> child docs (the auth-access spec's denormalization rec), and (f) writes an
> audit-log entry. This is cleaner than overloading `saveSpace`/`saveExam`
> because it (1) is a single permission surface for "who can change visibility",
> (2) keeps assignment idempotent and `mode`-aware, and (3) lets RN reuse one
> method. **Until it ships,** the flow degrades to `saveSpace`/`saveExam` with
> the full merged `classIds` array (`mode: 'replace'` semantics only) — note the
> degradation in the PR.

---

## 3. Layout (wireframe-as-text)

Rendered inside `PlatformLayout` / `AppShell` (sidebar + topbar). The flow
itself is a **right-anchored Drawer** on md+ and a **bottom Sheet** on sm; the
`/assign` route renders the same step stack centered in the content column (max
reading width ~720, per FOUNDATION §4 gutters). Steps are presented as a
**Stepper-as-sections** vertical stack (not a paginated wizard) so a confident
teacher can see the whole flow and jump back; on the standalone page they're
`Section` blocks with a sticky review/submit bar.

```
┌─ AppShell ───────────────────────────────────────────────────────────────┐
│ Sidebar (Content active)  │  Topbar: tenant · search · bell · profile     │
│                           ├───────────────────────────────────────────────┤
│                           │  [Drawer / Sheet anchored right — e3 elevation]│
│                           │  ┌─────────────────────────────────────────┐  │
│                           │  │ Header:  "Assign content"        [X]     │  │
│                           │  │ Breadcrumb-ish subtitle: From Class 10-A │  │
│                           │  ├─────────────────────────────────────────┤  │
│                           │  │ ① CONTENT                       (done ✓) │  │
│                           │  │   EntityPicker over spaces+exams         │  │
│                           │  │   [type ▾][status ▾]  🔍 search…         │  │
│                           │  │   ○ ▢ Algebra Basics  ·space ·practice    │  │
│                           │  │   ● ▣ Unit 3 Exam     ·exam  ·published   │  │
│                           │  │   selected → compact summary chip        │  │
│                           │  ├─────────────────────────────────────────┤  │
│                           │  │ ② CLASSES                                │  │
│                           │  │   ClassMultiSelect (combobox + chips)    │  │
│                           │  │   [Class 10-A ×][Class 10-B ×] (+ add)   │  │
│                           │  ├─────────────────────────────────────────┤  │
│                           │  │ ③ SCHEDULE & VISIBILITY  (optional)      │  │
│                           │  │   Start [DatePicker]  End [DatePicker]   │  │
│                           │  │   Visibility ◉ Class-assigned ○ Tenant   │  │
│                           │  ├─────────────────────────────────────────┤  │
│                           │  │ ④ REVIEW                                 │  │
│                           │  │   DefinitionList: content · classes ·    │  │
│                           │  │   window · who-will-see (N students)     │  │
│                           │  │   InlineAlert if visibility broadens     │  │
│                           │  ├─────────────────────────────────────────┤  │
│                           │  │ Footer (sticky): [Cancel] [Assign ⚡]     │  │
│                           │  └─────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────────┘
```

**Regions:** (a) Drawer header (title + context subtitle + close), (b) the four
step `Section`s, (c) sticky footer with primary/secondary actions. The footer's
primary **Assign** uses `Button` `spark` variant (the one sanctioned spark
accent on this staff screen — it is the committal CTA, FOUNDATION §5 / spark
glow).

**Responsive:**

- **sm (<640):** bottom **Sheet** full-width, ~92vh, internal scroll; steps
  stack; ClassMultiSelect chips wrap; DatePickers stack vertically; footer
  pinned. Touch targets ≥44px.
- **md (768):** right **Drawer** ~min(480px, 90vw); single column; EntityPicker
  list virtualizes past ~20 rows.
- **lg (≥1024):** Drawer ~520–560px; review step may show the roster preview
  inline (who-will-see expandable). The `/assign` standalone page uses the
  centered reading column with the review panel on the right at xl.

Grid inside each section: 4px spacing scale, `gap-4` between fields, `gap-6`
between sections; cards `radius lg`, inputs/buttons `radius md`, chips `pill`.

---

## 4. Components used (from FOUNDATION §5 / shared-ui inventory)

| Component                                     | Subpath                                                                                               | Use                                                                                                                                                                       |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Drawer` / `Sheet`                            | `primitives`                                                                                          | The overlay container (right on md+, bottom on sm). `e3` elevation, focus-trapped.                                                                                        |
| `EntityPicker`                                | `data` (NEW per webapps §2.2)                                                                         | Step ①: searchable, faceted picker over the merged assignable spaces + exams list. Owns search/filter/selection.                                                          |
| `ClassMultiSelect`                            | teacher-web composite (existing `components/exam/ClassMultiSelect.tsx`) → promote to `shared-ui/data` | Step ②: combobox + selected chips; filters to `status==='active'` classes; can inline-create via `ClassFormDialog`.                                                       |
| `DatePicker`                                  | `primitives`                                                                                          | Step ③: start / end window.                                                                                                                                               |
| `RadioGroup` (`Radio`)                        | `primitives`                                                                                          | Step ③: visibility (`class_assigned` vs `tenant_wide`).                                                                                                                   |
| `Section`                                     | `primitives`/containers                                                                               | Each step block, with index badge + title.                                                                                                                                |
| `DefinitionList`                              | `data`                                                                                                | Step ④ review summary.                                                                                                                                                    |
| `Badge` / `Chip`                              | `primitives`                                                                                          | Content-type (`space`/`exam`), space `type`, status, selected classes. Status uses domain status colors (FOUNDATION §2.3) paired with an icon + label (never color-only). |
| `InlineAlert` / `Banner`                      | `feedback`                                                                                            | Visibility-broadening warning, partial-permission warning, degraded-callable notice.                                                                                      |
| `ConfirmDialog`                               | `data`/feedback                                                                                       | Confirmation for _broadening_ actions (tenant-wide, or assigning a published exam students will immediately see).                                                         |
| `Button` (`spark` primary, `ghost` secondary) | `primitives`                                                                                          | Footer Assign (spark) / Cancel (ghost).                                                                                                                                   |
| `Toast` (sonner)                              | `primitives`                                                                                          | Success + error feedback.                                                                                                                                                 |
| `Skeleton`                                    | `data`                                                                                                | Loading state for the two list reads + roster count.                                                                                                                      |
| `EmptyState` / `ErrorState`                   | `data`                                                                                                | No assignable content / no managed classes / load failure.                                                                                                                |
| `Stat`/count inline                           | `charts`                                                                                              | "N students will gain access" in review.                                                                                                                                  |
| `LoadingOverlay`                              | `feedback`                                                                                            | Optional, on the footer region during submit (we prefer optimistic + disabled button — see §6).                                                                           |

**Proposed addition (justified):** `EntityPicker` must support a **merged
heterogeneous source** (spaces + exams in one list) with a `kind` facet and
per-row `type`/`status` sub-facets. If `EntityPicker` is currently
single-collection, extend its `sources` prop to accept
`{ key, label, items, renderRow }[]` rather than inventing a new component —
keep one picker, parameterized. No new color/spacing/type tokens are introduced.

---

## 5. States

All loading uses `Skeleton` (FOUNDATION §5); errors are **distinct** from empty
(webapps §2.2 `ErrorState` vs `EmptyState`).

**Loading (skeleton):** Drawer header renders immediately; step ① shows 3–4
skeleton rows while `spaces.list` + `exams.list` resolve; ClassMultiSelect shows
a skeleton combobox; the review "who-will-see" count shows a shimmer until the
roster count resolves. `Assign` is disabled while any required read is pending.

**Empty:**

- _No assignable content:_ `EmptyState` in step ① — title "Nothing to assign
  yet", body "Published spaces and exams appear here. Build one in **Spaces** or
  **Exams** first." with two `ghost` link-buttons routing to `/spaces` and
  `/exams`. (We do not let teachers author here.)
- _No managed classes (teacher):_ step ② `EmptyState` — "You don't manage any
  classes yet. Ask an admin to assign you a class." `tenantAdmin` instead sees
  an inline **"Create class"** affordance (via `ClassFormDialog`).

**Partial:**

- _Content picked, no class selected:_ `Assign` disabled; review shows "Select
  at least one class to continue."
- _Some target classes outside caller's permission_ (only possible for a teacher
  deep-linked with a stale pre-selection): the out-of-scope class chips render
  disabled with a tooltip "Not in your managed classes" and are excluded from
  submit; an `InlineAlert` notes "1 class was skipped (outside your access)."
- _Mixed-status content:_ a draft space cannot be assigned to be student-visible
  — if somehow surfaced, the row is disabled with reason "Publish in Spaces
  before assigning."

**Error:**

- _List read failed:_ `ErrorState` with "Couldn't load content" + **Retry**
  (refetch). Drawer stays open.
- _Submit failed:_ keep the Drawer open, restore the form, show a `Toast`
  (error) mapped via `useApiError` from `error.details.code` (FOUNDATION error
  model / common-api §6): e.g. `PERMISSION_DENIED` → "You don't have permission
  to assign to one of these classes.", `INVALID_TRANSITION` → "This content
  can't be assigned in its current state.", `RATE_LIMITED` → "Too many changes —
  try again in a moment." Optimistic state is rolled back.

**Success:** Drawer closes, `Toast` (success) "Assigned **{content}** to {N}
class{es}.", with an **Undo** action (re-opens with prior `classIds` to revert,
calling assign with `mode: 'remove'` for the added classes). Relevant query keys
are invalidated narrowly (`spaceKeys.get(id)`/`examKeys.get(id)` + the class's
content list), not the whole tenant.

**Permission-gated variants by role:**

- `teacher`: step ②'s class list is **only** their `managedClassIds` (with the
  15-class overflow fallback resolved server-side). The visibility radio's
  **`tenant_wide`** option is **hidden** unless the teacher holds the relevant
  permission — a teacher assigning tenant-wide would expose content beyond their
  classes, which is an admin decision. EntityPicker only lists spaces/exams the
  teacher owns or co-teaches.
- `tenantAdmin`: sees **all** classes, may pick `tenant_wide`, and sees all
  published assignable content. The `tenant_wide` choice always routes through
  `ConfirmDialog`.
- Cross-tenant data never appears — `tenantId` is derived from claims
  server-side; there is no tenant field in this form.

---

## 6. Interactions & motion

**Key flow:** pick content → pick class(es) → (optional) schedule/visibility →
review → Assign. Steps are a vertical stepper; completing a step collapses it to
a one-line summary with an edit affordance and smoothly reveals the next
(`base 220ms`, `ease.entrance`).

**Motion tokens (FOUNDATION §4):**

- Drawer enter: slide-in `slow 320ms` `ease.entrance`; exit `base 220ms`
  `ease.exit`. Sheet (sm) uses the same durations bottom-up.
- Step collapse/expand: height/opacity `base 220ms` `ease.standard`.
- Selected-row check + chip insert: `fast 160ms`.
- `Assign` spark CTA: rests with the sanctioned `spark glow` only on hover/focus
  (no idle pulsing — this is a staff tool).
- All of the above respect `prefers-reduced-motion` → cross-fades only, no
  translate.

**Feedback & optimistic updates:**

- On **Assign**, optimistically close the Drawer and show the success `Toast`
  immediately while the `assignContent` mutation is in flight; the affected
  `SpaceCard`/exam row reflects the new class chips optimistically. On error,
  the entity reverts and the Drawer **re-opens** with the prior state + error
  alert (we re-open rather than silently fail because assignment changes student
  visibility — the teacher must see it didn't take).
- The footer `Assign` shows a spinner + disabled state for the brief in-flight
  window; double-submit is guarded by the state machine (`submitting` state
  ignores re-clicks).

**Confirmations (`ConfirmDialog`):** required only for **visibility-broadening**
actions — choosing `tenant_wide`, or assigning a **published exam** (students
gain immediate eligibility). Copy names the blast radius: "Assign to **all
classes in this tenant**? Every student in {tenant} will be able to see
**{content}**." Narrowing/equal actions (adding to a class, scheduling a future
window) assign without a confirm.

**Keyboard niceties:** `⌘/Ctrl+Enter` submits from anywhere in the Drawer
(mirrors the authoring autosave shortcut teachers already know); `Esc` cancels
(with a "discard changes?" guard only if the form is dirty).

---

## 7. Content & copy

**Drawer title:** `Assign content` **Context subtitle (when launched from a
class):** `Adding to Class 10-A` · (from `/classes` overview, omit).

**Step headers / helper text:**

- ① `Content` — helper:
  `Pick a published space or exam to assign. Author content in Spaces or Exams.`
  - Facet labels: `Type` (All · Space · Exam), `Status` (Published · Scheduled).
    Search placeholder: `Search spaces and exams…`
  - Row meta example: `Algebra Basics · Space · Practice · Published`
- ② `Classes` — helper: `Choose which class(es) get access.` Combobox
  placeholder: `Select classes…` Inline create: `+ New class`.
- ③ `Schedule & visibility` _(optional)_ — helper:
  `Optionally set when this becomes available and who can see it.`
  - Labels: `Available from`, `Available until`, `Visibility`.
  - Visibility options: `Class-assigned — only students in the selected classes`
    (default) · `Tenant-wide — every student in this organisation`
    (admin/permitted only).
- ④ `Review` — `DefinitionList` rows: `Content`, `Classes`, `Availability` (or
  `Always available`), `Who will see this` → `<N> students across <M> classes`.

**Visibility-broadening InlineAlert (warning):**
`Tenant-wide assignment makes this visible to every student in the organisation, not just your classes.`

**Empty-state copy:**

- Content: title `Nothing to assign yet` · body
  `Published spaces and exams show up here. Build one in Spaces or Exams first.`
- Classes (teacher):
  `You don't manage any classes yet. Ask an admin to add you to a class.`

**Error copy:** (mapped from `error.details.code`)

- Generic: `Couldn't assign content. Your changes weren't saved.`
- Permission: `You don't have permission to assign to one of these classes.`
- State:
  `This content can't be assigned in its current state. Publish it first.`
- Load failure: `Couldn't load spaces and exams.` + `Retry`.

**Success toast:** `Assigned "{title}" to {N} class{es}.` + `Undo`.

Tone throughout: direct, professional, no exclamation marks, no celebration, no
XP/streak language.

---

## 8. Domain rules surfaced

- **Tenant isolation:** `tenantId` is derived from the caller's active-tenant
  claim server-side; it is never a form field, and only same-tenant
  classes/spaces/exams ever appear (auth-access §1.4–1.5, common-api §4.4).
- **Role scoping of classes:** a `teacher` only sees/assigns to
  `managedClassIds` (claim `classIds`, with the `MAX_CLAIM_CLASS_IDS=15`
  overflow fallback to the membership doc resolved server-side); a `tenantAdmin`
  sees all classes (auth-access §1.3).
- **`canAccessSpace` is the visibility contract:** assigning sets
  `space.classIds` + `accessType: 'class_assigned'`. A student gains access iff
  `accessType=='tenant_wide'` OR the space's `classIds` intersect the student's
  claim `classIds`. The review step's "who will see this" makes this
  intersection explicit so the teacher understands the consequence (auth-access
  §1.5 `canAccessSpace`).
- **Exam eligibility:** assigning an exam sets `exam.classIds`; it does **not**
  change exam `status`, the timed-test server-authoritative runtime, or
  results-release gating (`releaseResultsAutomatically` / results-released).
  Answer keys remain server-only and are never touched or shown here
  (auth-access answerKeys deny-all; app-teacher-web §1.9 answer-key protection).
- **Writes go through callables only:** assignment is `v1.levelup.assignContent`
  (proposed) / `saveSpace` / `saveExam` — never a direct client Firestore write.
  Stats and denormalized child `classIds` are recomputed server-side
  (server-authoritative; no client recompute) (webapps §5.1 key fixes,
  common-api §3).
- **Authoring/grading stay elsewhere:** this screen only wires assignment; it
  links out to SPACES (authoring) and EXAMS (grading) and never edits item
  content, rubrics, or grades.
- **Claims drift caveat:** if a class reassignment elsewhere hasn't refreshed
  claims yet, server authorization on `assignContent` is the source of truth —
  the UI's permission gating is UX only (auth-access §4.2, §1.7).

---

## 9. Accessibility

- **Focus order:** on open, focus moves to the Drawer (first heading / close
  button); a focus trap keeps Tab within the Drawer; on close, focus returns to
  the launching control (the class-detail "Assign content" button). Order: close
  → step① picker → step② combobox → step③ fields → review → Cancel → Assign.
- **Keyboard:** EntityPicker and ClassMultiSelect are full combobox patterns —
  `↑/↓` to move, `Enter`/`Space` to toggle, type-to-filter, `Esc` closes the
  popover (not the Drawer). `⌘/Ctrl+Enter` submits; `Esc` at Drawer level
  cancels (dirty-guard). DatePicker is keyboard-operable.
- **ARIA:** Drawer = `role="dialog"` `aria-modal="true"` `aria-labelledby` the
  title. Steps use `aria-current="step"` and `aria-expanded` on collapse.
  Combobox roles (`role="combobox"`, `aria-expanded`, `aria-controls`,
  `aria-activedescendant`) per the existing `ClassMultiSelect`. The "who will
  see this" count is in an `aria-live="polite"` region so it announces when it
  updates. Status badges have text labels (not color-only) and an `aria-label`
  combining type+status. The visibility-broadening alert uses `role="alert"`.
- **Contrast:** all pairs meet WCAG AA (4.5:1 body, 3:1 UI/large) per FOUNDATION
  §2; status never encoded by color alone (always icon + label).
- **Reduced motion:** `prefers-reduced-motion` disables slide/translate; Drawer
  and step transitions become opacity cross-fades; the spark glow does not
  animate.

---

## 10. Web↔mobile divergence (RN parity)

- **Container:** web Drawer (right) / Sheet (bottom on sm) → RN a native bottom
  sheet or full-screen modal (`@react-navigation` modal). Same
  `useAssignContent()` headless state machine drives both; only the
  presentational shell differs (FOUNDATION §6, webapps §1 headless rule).
- **Pickers:** web combobox + popover (hover/keyboard) → RN press-driven
  full-screen searchable lists; no hover states, ≥44px touch targets (already
  satisfied). EntityPicker/ClassMultiSelect logic is shared; renderers differ.
- **No ⌘K / no keyboard submit on RN:** the `⌘/Ctrl+Enter` shortcut is web-only;
  RN uses an explicit footer **Assign** button only.
- **Stepper:** web shows all sections at once (collapse-on-complete); RN may
  paginate the same steps for small screens, driven by the same machine.
- **Data path identical:** both call `@levelup/api-client` (`assignContent` /
  repos) — no Firestore SDK coupling, RN-ready (common-api §2, §5).
- **Toasts/Undo:** web sonner toast with Undo → RN snackbar with the same Undo
  action mapped to `assignContent({ mode:'remove' })`.

---

## 11. Claude-design prompt

```text
You are generating the "Assign Content to Class" screen for the Auto-LevelUp TEACHER
operational web portal. Conform EXACTLY to the Lyceum design system in
docs/rebuild-spec/design/00-FOUNDATION.md (Modern Scholarly): warm paper neutrals,
deep indigo brand, a single marigold "spark" accent reserved for the primary CTA,
Fraunces display / Schibsted Grotesk UI / Spline Sans Mono numerics. Use ONLY semantic
tokens (bg.surface, bg.canvas, text.primary/secondary/muted, border.subtle/strong,
brand.primary, spark, status.error/warning/success/info) — never raw hex, never new
tokens. Radius: cards lg, inputs/buttons md, chips pill. Elevation e3 for the drawer.
Motion: drawer enter slow 320ms ease.entrance, step transitions base 220ms ease.standard,
respect prefers-reduced-motion. Tone is PRECISE, CREDIBLE, CALM — staff operational tool,
NO XP/streak/celebration chrome.

Build a right-anchored Drawer (bottom Sheet < 640px) inside the AppShell/PlatformLayout,
plus a centered standalone /assign page variant, both rendering the SAME 4-step vertical
"stepper-as-sections" flow driven by one useAssignContent() state machine
(pickContent → pickClasses → schedule → review → submitting → done):

1) CONTENT — EntityPicker over a MERGED list of assignable Spaces + Exams (facets: Type
   = All/Space/Exam, Status = Published/Scheduled; search). Rows show title + kind badge +
   space type + status badge (icon + label, never color-only). Read via api-client repos
   spaces.list / exams.list — NEVER firebase/firestore.
2) CLASSES — ClassMultiSelect combobox + selected chips, filtered to active classes the
   caller manages (teacher = managedClassIds with 15-class overflow; admin = all). Inline
   "+ New class".
3) SCHEDULE & VISIBILITY (optional) — DatePicker "Available from"/"Available until";
   RadioGroup visibility: "Class-assigned" (default) vs "Tenant-wide" (HIDDEN unless admin/
   permitted). Choosing Tenant-wide later requires a ConfirmDialog.
4) REVIEW — DefinitionList (Content, Classes, Availability, "Who will see this: N students
   across M classes" in an aria-live region). InlineAlert (warning) when visibility broadens.

Sticky footer: [Cancel] ghost + [Assign] using Button spark variant (the one sanctioned
spark accent; glow only on hover/focus). On Assign, optimistically close + success Toast
("Assigned "{title}" to N classes" + Undo); on error re-open the drawer with the prior
state and an error alert mapped from error.details.code. ConfirmDialog only for
visibility-broadening (tenant-wide / published exam). ⌘/Ctrl+Enter submits; Esc cancels
with a dirty-guard.

States: skeleton (two list reads), distinct EmptyState (nothing to assign → link to Spaces/
Exams; no managed classes), ErrorState with Retry, partial (no class selected → disabled
Assign), permission-gated (teacher: own classes only, no tenant-wide; admin: all + confirm).

Domain rules to honor on screen: tenantId derived from claims (NO tenant field); cross-tenant
data never appears; assignment sets space.classIds + accessType:'class_assigned' (or exam.classIds)
via the api-client write api.levelup.assignContent (proposed) — never a direct Firestore write;
"who will see this" reflects canAccessSpace (class intersection); answer keys and grades are
never shown or edited here; authoring stays in Spaces, grading in Exams (link out only).

Accessibility: role="dialog" aria-modal, focus trap, focus returns to launcher, full combobox
ARIA, aria-live count, WCAG AA contrast, status never color-only, reduced-motion cross-fades.

Compose ONLY from shared-ui: Drawer/Sheet, EntityPicker, ClassMultiSelect, DatePicker,
RadioGroup, Section, DefinitionList, Badge/Chip, InlineAlert, ConfirmDialog, Button(spark/ghost),
Toast, Skeleton, EmptyState/ErrorState. Output a React + Tailwind implementation using the
Lyceum tokens.
```
