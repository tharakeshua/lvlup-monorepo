# Academic Sessions & Rollover — Design Spec

> **Area:** admin-web (Tenant / Academy Admin console) · **Route:**
> `/academic-sessions` · **Role:** `tenantAdmin` Conforms to **Lyceum**
> foundation (`docs/rebuild-spec/design/00-FOUNDATION.md`). All tokens cited by
> semantic name; no new colors/fonts/spacing/radii/motion are introduced except
> where explicitly flagged as a **proposed foundation addition**. Register: the
> **serious/admin** register — restraint in chrome, precision-instrument tone,
> _no_ student-facing playfulness or marigold **spark** celebration. This is a
> **destructive/confirm-heavy** governance surface: the chrome must read as a
> careful, auditable instrument.

---

## 1. Purpose & primary user

**Primary user:** `tenantAdmin` (school / academy administrator), scoped to
exactly **one** tenant.

**Job-to-be-done:** _"Let me define and govern the academic years/terms my
school runs on — create a session, see which one is active, and at the term
boundary roll everything forward (promote students, carry classes + teacher
assignments, archive the old year) in one deliberate,
reversible-by-understanding step — without ever touching another school's
data."_

Concretely this screen lets the admin:

- See the **current (active)** session at a glance and the full list of
  past/future sessions.
- **Create** a new session (name, start date, end date; optionally mark
  current).
- **Edit** a session's name/dates and **set any session as current** (server
  enforces exactly-one-current).
- **Roll over** a source session into a brand-new one via
  `SessionRolloverDialog`: copy active classes, carry teacher assignments, and
  (optionally) **promote students** to the next grade and reassign them. The new
  session is created and set current; the source is archived.

This is a low-frequency, high-consequence surface. A rollover touches the entire
roster — classes, teacher assignments, every student's grade and class
membership. The design's job is to make the **scope and consequences legible
before commit**, not to make the action feel quick or fun. No XP, streaks,
mastery rings, or **spark** accents appear anywhere on this screen.

---

## 2. Entry points & route

**Route:** `/academic-sessions` (declared in `apps/admin-web/src/App.tsx`,
lazy-loaded). Rendered inside `AppLayout` → `AppShell`. Page component today:
`apps/admin-web/src/pages/AcademicSessionPage.tsx`; rollover flow:
`apps/admin-web/src/components/sessions/SessionRolloverDialog.tsx`.

**Entry points:**

- Sidebar → **Configuration** nav group → "Academic Sessions" (active-nav uses
  `brand.primary`).
- Onboarding wizard step 2 (`OnboardingWizardPage` → `callSaveAcademicSession`)
  — the first session is created there; this page is where it is subsequently
  governed.
- Cross-links: the term/session **filter** on class-management (`/classes`) and
  the `academicSessionId` binding on classes/exams trace back here; "Manage
  sessions" deep-links to this route.
- `⌘K` Command Palette → "Go to Academic Sessions" / "Roll over session" (web
  only — see §10).

**Common-API reads/writes that power it** (per `specs/common-api.md`; today's
callable/hook names shown where the rebuild renames them). `tenantId` is
**derived server-side from `ctx.activeTenantId`** (claim) for the rebuild
callables — it is sent in the request body only by today's live code, never
trusted from the client server-side (§ tenant isolation, below).

| Action            | Rebuild callable / read                                                                  | Today (live code)                               | Contract                                                                               |
| ----------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------- |
| List sessions     | `v1.identity.listAcademicSessions` _(typed read replacing direct Firestore read)_        | `useAcademicSessions(tenantId)`                 | `AcademicSession[]` from `/tenants/{tenantId}/academicSessions/{sessionId}`            |
| Create session    | `v1.identity.saveAcademicSession` (create branch, `SaveResponse{ id, created }`)         | `useCreateAcademicSession`                      | `SaveAcademicSessionRequest{ tenantId, data:{ name, startDate, endDate, isCurrent } }` |
| Edit session      | `v1.identity.saveAcademicSession` (update branch, `id` present)                          | `useUpdateAcademicSession`                      | same request, `id` set                                                                 |
| Set as current    | `v1.identity.saveAcademicSession` (`data.isCurrent: true`)                               | `useUpdateAcademicSession({ isCurrent: true })` | server demotes the previously-current session in the same transaction                  |
| Roll over session | `v1.identity.rolloverSession` (bulk, batched, **idempotent** — accepts `idempotencyKey`) | `callRolloverSession`                           | `RolloverSessionRequest` → `RolloverSessionResponse` (see §8)                          |

> **Contract — `saveAcademicSession`** (`callable-types.ts:147`):
> `{ id?, tenantId, data: { name?, startDate?, endDate?, isCurrent?, status?: 'active'|'archived' } }`.
> Create vs. edit is the presence of `id`. The rebuild folds the legacy
> `createAcademicSession` + `updateAcademicSession` into this one upsert.
>
> **Contract — `rolloverSession`** (`callable-types.ts:267`): request
> `{ tenantId, sourceSessionId, newSession:{ name, startDate, endDate }, copyClasses, copyTeacherAssignments, promoteStudents }`;
> response
> `{ newSessionId, classesCreated, teacherAssignments, studentsPromoted, studentsUnassigned }`.
> Per common-api §bulk ops, this is **batched and idempotent** — the rebuild
> adds an `idempotencyKey` so a retried submit cannot double-create the new
> year. **All five response counts are server-authoritative** and drive the
> success summary; the client never computes them.

---

## 3. Layout — wireframe-as-text

Rendered inside **AppShell** (`Sidebar` + `Topbar`): the page owns only the
content column (max content width 1200, desktop gutter 32). Vertical rhythm uses
`gap` from the spacing scale (`6=24` between major regions); no ad-hoc margins.

```
┌─ AppShell ───────────────────────────────────────────────────────────────┐
│ Sidebar (Configuration ▸ Academic Sessions active)   Topbar (tenant, ⌘K)  │
│ ┌─ Content column (≤1200, gutter 32) ─────────────────────────────────┐   │
│ │  Breadcrumb: Home › Academic Sessions                               │   │
│ │                                                                      │   │
│ │  REGION A — Page header (flex, space-between, align-center)          │   │
│ │   ┌ h1 "Academic Sessions" (Fraunces) ┐        ┌ Button[primary] ┐   │   │
│ │   │ sub: "Define and govern your…"    │        │ + New Session   │   │   │
│ │   └───────────────────────────────────┘        └─────────────────┘   │   │
│ │                                                                      │   │
│ │  REGION B — Current-session Stat/KPI Card (e1, radius lg)            │   │
│ │   ┌──────────────────────────────────────────────────────────────┐  │   │
│ │   │ [cal icon] CURRENT SESSION                    [Badge: Active] │  │   │
│ │   │  2025–2026  (Fraunces lg)                                     │  │   │
│ │   │  01 Jun 2025 — 31 May 2026   (Spline Mono, text.secondary)   │  │   │
│ │   │  ─────────────────────────────────────────────────────────── │  │   │
│ │   │  Button[secondary] Edit    Button[secondary] Roll over ▸     │  │   │
│ │   └──────────────────────────────────────────────────────────────┘  │   │
│ │                                                                      │   │
│ │  REGION C — DataTable "All sessions"                                 │   │
│ │   ┌──────────────────────────────────────────────────────────────┐  │   │
│ │   │ Name │ Start │ End │ Current │ Status │            Actions    │  │   │
│ │   ├──────────────────────────────────────────────────────────────┤  │   │
│ │   │ 2025–2026 │ 01 Jun 25 │ 31 May 26 │ ●Current │ Active │ ⤺ ✎  │  │   │
│ │   │ 2024–2025 │ 01 Jun 24 │ 31 May 25 │ [Set]    │ Archived│ ⤺ ✎ │  │   │
│ │   └──────────────────────────────────────────────────────────────┘  │   │
│ │                                                            Pagination │   │
│ └──────────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────────┘
```

**Regions:** A page header (title + primary CTA), B the current-session
**Stat/KPI Card** (the one piece of visual emphasis on the page — a session is
only "active" if `isCurrent`), C the **DataTable** of all sessions with row
actions (Roll over, Edit) and the inline "Set as current" affordance.

**Responsive:**

- **lg (≥1024):** as drawn. DataTable full 6 columns; current-session card spans
  the content width; header is a single horizontal row.
- **md (768–1023):** content gutter 24. Header wraps the CTA below the title if
  cramped. DataTable keeps all columns but the Start/End dates may truncate;
  horizontal scroll container preserved (today's `overflow-x-auto`).
- **sm (<768, rare for admin — web-first):** gutter 16. Header stacks (title
  then full-width **New Session** button). The DataTable degrades to **stacked
  SessionCards** (one Card per session per the §6 web↔mobile rule): name as
  title, dates as a `DefinitionList`, Current/Status as Badges, actions as a row
  of `IconButton`s. The current-session Card (Region B) stays at top.

**Dialogs (overlay, not in flow):** Create / Edit use **Modal/Dialog** (`e3`);
**Rollover** uses a wider Modal/Dialog (`max-w-lg`) containing the multi-step
confirm flow described in §6.

---

## 4. Components used — from FOUNDATION §5 only

**Navigation / shell:** `AppShell`, `Sidebar` (Configuration group), `Topbar`,
`Breadcrumb`, `CommandPalette` (⌘K, web-only).

**Containers:** `Card` (current-session KPI; sm-breakpoint session cards),
`Modal/Dialog` (Create, Edit, Rollover), `Section` (grouping within the rollover
dialog body).

**Data:** `DataTable` (the all-sessions table — owns sort/paginate/select per
§5; replaces today's bespoke `Table` + manual rows), `Stat/KPI` (current-session
figure framing), `DefinitionList` (source-session facts + rollover preview;
stacked-card date rows), `Badge` (`Active` / `Archived` / `Current`), `Chip/Tag`
(per-row "Current" marker), `EmptyState` (no sessions), `Skeleton` (loading),
`Pagination`.

**Primitives:** `Button` (primary "New Session" / "Start Rollover"; secondary
"Edit"/"Cancel"; **danger** is _not_ used here — rollover is destructive in
effect but not a delete, so it uses **primary** with a confirm gate, see note),
`IconButton` (row actions: Roll over ⤺, Edit ✎), `Input` (session name),
`DatePicker` (start/end dates — replaces today's raw `<input type="date">`),
`Switch` ("Set as current" in Create/Edit), `Checkbox` (rollover options: copy
classes / copy teacher assignments / promote students), `Label`.

**Feedback:** `Toast` (sonner — create/edit/set-current success + error;
rollover success summary + failure), `ConfirmDialog` (the final rollover commit
gate — see §6), `InlineAlert/Banner` (rollover consequence warning;
permission-denied; partial-result notice), `LoadingOverlay` (rollover
in-progress — the dialog is non-dismissable while processing), `FormFieldError`
(date-order validation).

**Domain components:** none of the learning/assessment domain components
(`SpaceCard`, `XPMeter`, `StreakFlame`, etc.) appear — this is governance
chrome.

**Proposed foundation additions (flagged):**

1. **`ConsequencePreview`** — a structured "What will happen" block (icon +
   plural-aware count line per effect) used by the rollover dialog. Today this
   is an ad-hoc `<ul class="list-disc">`. It is essentially a
   `DefinitionList`/`InlineAlert` composition; if reused (it is the natural
   pattern for any destructive bulk admin op — bulk archive, tenant
   deactivation, data export), promote it to §5 as a feedback component. **Until
   ratified, compose it from `InlineAlert` + `DefinitionList` using existing
   tokens — introduce no new ones.**
2. **Stepper/segmented confirm affordance** inside the rollover dialog
   (Configure → Review → Confirm). If a generic `Wizard`/`Stepper` is not
   already implied by `OnboardingWizardPage`, flag it; otherwise reuse that
   pattern. No new tokens required.

---

## 5. States — loading / empty / error / partial / success (permission-gated)

**Permission gate (first):** the entire route is gated to
`allowedRoles={["tenantAdmin"]}` via `RequireAuth`, which asserts
`currentMembership.tenantId === currentTenantId` (audit A1 fixed). `superAdmin`
bypasses. A `staff` member without `canManageSessions` (rebuild
`StaffPermissions` enforcement, see §8) sees the page **read-only**: the **New
Session** CTA, row "Roll over"/"Edit", and "Set as current" controls are hidden
(not merely disabled), and an `InlineAlert` notes "You have view-only access to
academic sessions."

| State                      | Treatment                                                                                                                                                                                                                                                                                                                                                           |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Loading**                | Region B and C render `Skeleton` (today: `TableSkeleton columns={6}`). No spinner-only screens. Page header renders immediately (static).                                                                                                                                                                                                                           |
| **Empty**                  | No current-session Card. Region C shows an `EmptyState` (icon = calendar) with title + body + primary action — see §7. This is the post-onboarding edge (sessions normally seeded in onboarding step 2).                                                                                                                                                            |
| **Error (read)**           | `InlineAlert` (`status.error`, error icon + label, never color alone) in place of the table: "Couldn't load academic sessions." with a **Retry** `Button`. Topbar/sidebar stay intact.                                                                                                                                                                              |
| **Partial**                | Rollover may report mixed counts (e.g. `classesCreated > 0` but `studentsUnassigned > 0`). On success the toast summary enumerates **all non-zero** server counts; if `studentsUnassigned > 0`, an additional `InlineAlert` (`status.warning`) surfaces "N students could not be auto-assigned to a class — assign them in Classes" with a deep-link to `/classes`. |
| **Success (mutation)**     | Create/Edit/Set-current: optimistic row update + success `Toast`; dialog closes. Rollover: dialog closes, table refetches, the new session appears as `Current`, prior source flips to `Archived`; success `Toast` carries the count summary.                                                                                                                       |
| **In-progress (rollover)** | Dialog enters a non-dismissable processing state: `LoadingOverlay` over the dialog body, footer **Start Rollover** → spinner + label "Processing…", Cancel disabled (today: `processing` guards both). Backdrop click + Esc are suppressed (see §9).                                                                                                                |
| **Validation**             | Date order (`endDate <= startDate`) blocks submit with `FormFieldError` on the End date field (today this is a post-hoc `toast.error`; rebuild moves it inline + disables submit). Name required.                                                                                                                                                                   |

---

## 6. Interactions & motion (§4 motion tokens)

**Open/close dialogs:** Modals enter with `ease.entrance` at `base` (220ms) —
backdrop fade + content scale-from-98%; exit `ease.exit` at `fast` (160ms).
`prefers-reduced-motion` → opacity-only, no scale.

**Create / Edit:** open Dialog → fill `Input`/`DatePicker`, optional `Switch`
"Set as current" → submit. **Optimistic:** the new/updated row appears
immediately with a subtle `bg.surface-sunken` "pending" tint; on server confirm
the tint clears at `fast`; on error the row reverts and an error `Toast` shows.
Setting `isCurrent` optimistically moves the `Current` chip to the new row and
demotes the old — but the demotion is **server-authoritative**
(exactly-one-current is enforced server-side, §8), so the UI reconciles to the
server response.

**Set as current (inline, table):** a low-emphasis `Button[ghost]` "Set as
current" on non-current rows. Click → optimistic chip move + success `Toast`. No
confirm dialog — it is reversible and non-destructive.

**Rollover — the deliberate flow** (the heart of this screen). Triggered from
the row `IconButton` (⤺) or the current-session Card's "Roll over"
`Button[secondary]`. A three-beat flow inside one `max-w-lg` Dialog:

1. **Configure.** Source-session facts shown read-only at top (`DefinitionList`:
   name + `Current` badge + date range). New-session fields (`Input` name, two
   `DatePicker`s). Three `Checkbox` options with **dependency cascade** (today's
   exact behavior, preserved): _Copy classes_ is the parent; unchecking it
   auto-unchecks and **disables** _Copy teacher assignments_ and _Promote
   students_ (they are meaningless without target classes). Visual: child
   checkboxes indented (spacing `6=24` left pad) and `disabled` styling when the
   parent is off.
2. **Review — `ConsequencePreview`.** A live, plural-aware "What will happen"
   block updating as options toggle: _"A new session «{name}» will be created
   and set as current"_, then conditional lines for classes copied / teacher
   assignments preserved / students promoted-and-reassigned / "No classes will
   be copied." This block is wrapped in an `InlineAlert` at `status.warning`
   emphasis because the effect is roster-wide and the source year will be
   **archived**.
3. **Confirm.** Submit (**Start Rollover**, `Button[primary]`) opens a final
   `ConfirmDialog` — _because student promotion and class duplication are bulk,
   roster-wide, and not trivially undoable._ Copy spells the
   irreversible-feeling parts explicitly (§7). Confirm → dialog locks
   (`LoadingOverlay`, non-dismissable), calls `rolloverSession` with an
   `idempotencyKey`. On resolve: close, refetch, success `Toast` with the
   **server-returned counts**; on reject: stay open, error `Toast`, re-enable
   controls so the admin can retry (same `idempotencyKey` → server dedupes, no
   double year).

**Why primary, not danger, button:** rollover _creates_ (a year) rather than
_deletes_; styling it `danger` (red) would mis-signal. It uses `Button[primary]`
gated by an explicit `ConfirmDialog`, with the warning carried by the
`InlineAlert` consequence block — color is never the sole signal of consequence.

**Feedback timing:** toasts use `Toast` (sonner) defaults; the rollover success
toast persists longer (it carries a multi-count summary the admin will read).
Row "pending" tints clear at `fast`; nothing on this page uses the celebratory
**spark** spring pop reserved for student gamification.

---

## 7. Content & copy (precise admin tone)

**Page header**

- h1: **Academic Sessions**
- Sub: _Define and govern the academic years and terms your school runs on._
- Primary CTA: **New Session**

**Current-session Card**

- Eyelet label (`Spline Mono`, uppercase, tracking +0.01em): **CURRENT SESSION**
- Figure: session name (e.g. _2025–2026_) · date range in mono · `Badge`
  **Active**
- Actions: **Edit** · **Roll over**

**DataTable headers:** Name · Start Date · End Date · Current · Status ·
Actions. Status badge values: **Active** / **Archived**. Current marker:
**Current** chip, or **Set as current** ghost action on non-current rows.

**Create / Edit dialog**

- Title: **Create Academic Session** / **Edit Academic Session**
- Description: _Add a new academic year or term._ / _Update session details._
- Fields: **Session Name** (placeholder _e.g. 2025–2026_) · **Start Date** ·
  **End Date** · Switch **Set as current session**
- Submit: **Create** / **Save Changes**; busy: **Creating…** / **Saving…**
- Validation error (inline on End Date): _End date must be after the start
  date._

**Rollover dialog**

- Title: **Roll Over Session**
- Description: _Create a new academic session from «{source name}» and carry
  forward your classes, teachers, and students._
- Source block label: **Source session**
- New fields: **New Session Name** (placeholder _e.g. 2026–2027_) · **Start
  Date** · **End Date**
- Options heading: **What to carry forward**
  - **Copy classes to the new session**
  - **Copy teacher assignments** (disabled hint when unchecked parent: _Requires
    copying classes._)
  - **Promote students** _(increment grade and reassign to the new classes)_
- Consequence block heading: **What will happen**
  - _A new session «{name}» will be created and set as the current session._
  - _Active classes from «{source}» will be duplicated into the new session._
  - _Teacher assignments will be preserved in the new classes._
  - _Students will be promoted to the next grade and reassigned._
  - _No classes will be copied._ (when parent off)
- Submit: **Start Rollover**; busy: **Processing…**

**Final ConfirmDialog (commit gate)**

- Title: **Roll over to a new academic year?**
- Body: _This will create «{name}», set it as the current session, and archive
  «{source}». {N if known} classes will be duplicated and students will be
  promoted to the next grade. This affects your entire roster and is not undone
  automatically._
- Confirm: **Roll over** · Cancel: **Cancel**

**Empty state**

- Title (Fraunces): **No academic sessions yet**
- Body: _Create your first session to organize your school year — classes,
  exams, and rollover all key off it._
- Action: **Create session**

**Error copy**

- Read failure: _Couldn't load academic sessions._ / **Retry**
- Mutation failure toast: _Failed to create session_ / _Failed to update
  session_ / _Couldn't set the current session_ / **Rollover failed** — each
  with the server message as the toast description.
- Partial warning: _{N} students couldn't be auto-assigned to a class. Assign
  them in Classes._ / **Go to Classes**

Tone throughout: declarative, consequence-forward, no exclamation, no emoji.
"Roll over" as the verb; "rollover" as the noun.

---

## 8. Domain rules surfaced

- **Tenant isolation (hard rule).** A `tenantAdmin` is scoped to exactly one
  tenant. Sessions live at `/tenants/{tenantId}/academicSessions/{sessionId}`
  and are gated by `isTenantAdmin(tenantId)` in `firestore.rules`. In the
  rebuild, `tenantId` for every callable here is **derived server-side from
  `ctx.activeTenantId`** (custom claim), never trusted from the request body.
  The rollover never reads or writes another tenant's classes/teachers/students;
  all source and target documents are within the active tenant. `RequireAuth`
  additionally asserts `currentMembership.tenantId === currentTenantId` before
  render (audit A1).
- **RBAC / permissions.** Route allowed only for `tenantAdmin` (and `superAdmin`
  bypass). The rebuild enforces `StaffPermissions` (e.g. a `canManageSessions`
  flag) so a `staff` member without it gets the read-only variant (§5) — driven
  by `useCan('manageSessions')`, not hard-coded visibility. No
  teacher/parent/student/scanner role can reach this route.
- **Exactly-one-current invariant (server-authoritative).** Only one session may
  have `isCurrent: true`. The client never demotes the old session itself;
  `saveAcademicSession({ isCurrent: true })` performs the demote-old +
  promote-new transactionally server-side. Optimistic UI is reconciled to the
  server result.
- **Rollover is server-authoritative and idempotent.** All five
  `RolloverSessionResponse` counts (`classesCreated`, `teacherAssignments`,
  `studentsPromoted`, `studentsUnassigned`) come from the server's batched
  transaction and drive the summary copy verbatim — the client computes none of
  them. Per common-api §bulk ops the op is **batched + idempotent**; the rebuild
  adds an `idempotencyKey` so a retried submit cannot create a duplicate year.
  Student promotion mutates each student's grade and `classIds[]` and the source
  session flips to `status: 'archived'`; these are roster-wide effects, hence
  the confirm gate.
- **Server-authoritative dates/status.** `status` ('active' | 'archived') and
  the canonical `startDate`/`endDate` timestamps are owned by the server
  document; the UI formats Firestore timestamps for display (today's
  `formatDate` handles `toDate()`/`seconds`) and never derives status locally.
- **Audit.** Rollover and set-current are governance events; the rebuild records
  them to the tenant audit trail (actor uid, tenantId, sourceSessionId,
  newSessionId, option flags, resulting counts, timestamp) so a school can
  answer "who promoted the students and when." The UI surfaces _that_ it is
  auditable via the confirm copy ("This affects your entire roster…") rather
  than exposing the log here.
- **Cost / quota.** A rollover that duplicates classes and promotes students can
  materially change tenant counts that feed quota (`TenantUsage`). If a tenant
  is at/over a seat or class quota, the server may reject or warn; the UI
  surfaces such a server warning via the existing `QuotaWarningBanner` / an
  `InlineAlert` in the dialog. No new client-side quota math.

---

## 9. Accessibility (WCAG AA)

- **Focus order.** Page: Breadcrumb → h1 → New Session → current-session Card
  (Edit, Roll over) → DataTable (header sort controls → rows → row actions) →
  Pagination. Logical, left-to-right, top-to-bottom.
- **Dialogs.** Focus traps inside each Modal; initial focus on the first field
  (session name) for Create/Rollover, on the confirm action for `ConfirmDialog`.
  Esc closes Create/Edit and the rollover **Configure** stage; Esc is
  **suppressed while processing** (the rollover is mid-flight and must not be
  abandoned ambiguously). On close, focus returns to the trigger (the row
  `IconButton` or Card button). `role="dialog"`, `aria-modal="true"`,
  `aria-labelledby` → title, `aria-describedby` → description.
- **Keyboard.** All controls reachable/operable by keyboard: DataTable sort
  headers are buttons; row `IconButton`s have visible `:focus-visible` rings
  (`focus` ring token, indigo @35%); checkbox dependency cascade is
  keyboard-operable and announces the disabled state of children via
  `aria-disabled` + the "Requires copying classes" hint text
  (`aria-describedby`). Date inputs use an accessible `DatePicker`
  (label-associated).
- **ARIA / live regions.** The route announcer (in `AppLayout`) announces page
  title on navigation. The rollover **ConsequencePreview** updates inside an
  `aria-live="polite"` region so toggling options is announced. Processing state
  sets `aria-busy="true"` on the dialog. Toasts (sonner) post to a polite live
  region.
- **Status never by color alone.** Every status uses **icon + text label**:
  `Active`/`Archived` Badges carry the word, not just
  `status.success`/`text.secondary` fill; `Current` is a labeled chip; the
  rollover warning `InlineAlert` pairs a warning icon + heading with
  `status.warning`. The destructive emphasis of rollover is carried by copy +
  confirm gate + icon, never by red alone.
- **Contrast.** All text/background pairs meet AA (4.5:1 body, 3:1 large/UI) per
  foundation §2; mono date strings in `text.secondary` on `bg.surface` are
  verified ≥4.5:1. Disabled child checkboxes retain a ≥3:1 perceivable boundary
  (`border.subtle`).
- **Reduced motion.** `prefers-reduced-motion` → dialog transitions become
  opacity-only (no scale), row "pending" tint cross-fades without movement, no
  spring anywhere (none is used here regardless).
- **Touch targets.** Row `IconButton`s and the inline "Set as current" action
  meet ≥44px hit area even though admin is web-first.

---

## 10. Web ↔ mobile divergence

Admin is **web-first**. There is no dedicated admin React Native app; a
`tenantAdmin` performing a rollover does so on the web console. Therefore:

- **⌘K Command Palette is web-only** — the entry points "Go to Academic
  Sessions" / "Roll over session" exist only on web.
- **Hover affordances are web-only** (sidebar route prefetch on hover, row-hover
  action emphasis); the mobile/narrow rendering exposes actions as
  always-visible `IconButton`s.
- **Table → stacked cards** at the sm breakpoint per foundation §6 (DataTable on
  web → one `Card` per session): the only place this screen meaningfully
  reshapes. The rollover dialog itself stays a single full-width sheet on narrow
  widths but keeps the identical Configure → Review → Confirm flow.
- **Component parity:** all components used are the cross-platform §5 set with
  1:1 names/props between `shared-ui` (web) and `ui-native` — so if an
  admin-capable mobile surface is ever added, this screen ports without
  redesign. No web-only component (beyond `CommandPalette`) is load-bearing
  here.

Explicit statement: **this screen ships web-only today; the spec is written so
the components are mobile-ready, but no mobile admin target is in scope.**

---

## 11. A Claude-design prompt (ready-to-paste)

```
You are designing one screen for the Auto-LevelUp admin console ("admin-web"), conforming
EXACTLY to the Lyceum design system in docs/rebuild-spec/design/00-FOUNDATION.md. Read that
foundation first and compose ONLY from its tokens (cite by semantic name — brand.primary,
bg.surface, status.warning, border.subtle, etc.; never paste hex) and its §5 component
inventory. Introduce NO new colors, fonts, spacing, radii, shadows, motion, or component
variants. Register: the SERIOUS / admin register — restrained chrome, precision-instrument
tone, NO student playfulness and NO marigold "spark" celebration.

SCREEN: Academic Sessions & Rollover
ROLE: tenantAdmin (scoped to exactly ONE tenant — tenant isolation is a hard domain rule)
ROUTE: /academic-sessions, rendered inside AppShell (Sidebar Configuration group + Topbar).

BUILD:
1. Page header: Fraunces h1 "Academic Sessions" + Schibsted sub "Define and govern the
   academic years and terms your school runs on." + Button[primary] "New Session".
2. A current-session Stat/KPI Card (e1, radius lg): eyelet "CURRENT SESSION" (Spline Mono,
   uppercase), session name as the figure, date range in mono text.secondary, a labeled
   Badge "Active", and Button[secondary] Edit + Roll over.
3. A DataTable "All sessions": columns Name · Start Date · End Date · Current · Status ·
   Actions. Status Badges read "Active"/"Archived" (icon + word, never color alone). Non-
   current rows show a ghost "Set as current" action; current rows show a "Current" chip.
   Row actions = IconButtons (Roll over, Edit). Pagination beneath.
4. Create/Edit Modal: Input (name) + two DatePickers + Switch "Set as current session".
   Inline FormFieldError if end date <= start date; disable submit until valid.
5. Roll Over Modal (max-w-lg), a 3-beat flow in one dialog:
   - Configure: read-only source-session DefinitionList (name + Current badge + dates),
     new-session Input + 2 DatePickers, and 3 Checkboxes with a DEPENDENCY CASCADE —
     "Copy classes" is the parent; unchecking it disables + unchecks "Copy teacher
     assignments" and "Promote students" (indent the children).
   - Review: a live, plural-aware "What will happen" consequence block wrapped in an
     InlineAlert at status.warning emphasis (the source year gets archived; roster-wide).
   - Confirm: Button[primary] "Start Rollover" opens a ConfirmDialog ("Roll over to a new
     academic year?") before committing. While processing, lock the dialog with a
     LoadingOverlay, disable Cancel, suppress Esc/backdrop.
   On success show a Toast summarizing SERVER-RETURNED counts (classes copied, teacher
   assignments, students promoted, students unassigned). If students unassigned > 0, add a
   status.warning InlineAlert linking to /classes.

STATES: skeleton loading; EmptyState ("No academic sessions yet") with a "Create session"
action; read error InlineAlert + Retry; read-only variant for staff lacking manage-sessions
permission (hide the mutating controls, show a view-only InlineAlert).

RULES TO HONOR VISUALLY: rollover uses Button[primary] (it CREATES a year) gated by a
ConfirmDialog — NOT a red danger button; consequence is signaled by copy + icon + confirm,
never by color alone. Exactly-one-current and all rollover counts are server-authoritative.
Status is always icon + text label. tenantId is server-derived (do not surface it in the UI).

A11Y: focus trap + return-focus on dialogs; Esc closes except while processing; aria-live
polite on the consequence preview and toasts; aria-busy during rollover; AA contrast;
prefers-reduced-motion → opacity-only transitions, no scale, no spring.

RESPONSIVE: lg as drawn; sm collapses the DataTable into stacked session Cards (foundation
§6) and stacks the header. ⌘K and hover affordances are web-only.

Output: a single React + Tailwind screen using @levelup/shared-ui components, Tailwind
@theme reading the Lyceum CSS custom properties. No invented tokens.
```
