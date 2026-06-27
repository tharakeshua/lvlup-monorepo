# Space Review & Publish Flow — Design Spec

> Conforms to the **Lyceum** foundation
> (`docs/rebuild-spec/design/00-FOUNDATION.md`). All tokens, type, spacing,
> motion and components are cited by name — never re-pasted or invented.

The lifecycle control surface for a `Space`: a **pre-publish review/validation
checklist** (mirroring backend `validatePublish`), the **status transition
control** governed by `ALLOWED_TRANSITIONS` (draft→published,
published→{archived,draft}, archived→draft), a **publish confirmation** that
names the side effects (student notifications, optional B2C store mirror), and
the **unpublish/archive** paths with their own consequences (store de-listing,
active-session expiry). It is the one screen where an author commits content to
learners — so it is deliberate, legible, and consequence-forward.

---

## 1. Purpose & primary user

**Primary user:** `teacher` and `tenantAdmin` (content authors / space owners).

**Job-to-be-done:** "When my space is ready, I want to see exactly what's
missing before students can see it, flip it from draft to published in one
confident action, understand who gets notified and whether it lists on the store
— and just as safely pull it back to draft or archive it, knowing what that does
to in-progress students."

This is a **high-consequence staff surface**: tone is precise, declarative, and
consequence-forward — never breezy. The single spark of energy is reserved for
the successful **Publish** moment (the act of going live), not decoration.

---

## 2. Entry points & route

**Primary entry — Space editor header:** a persistent **status Badge + "Review &
Publish" Button** in `SpaceEditorPage` header. On `draft` the button reads
**"Publish…"**; on `published` a kebab/menu exposes **"Unpublish"** and
**"Archive…"**; on `archived` it exposes **"Restore to draft"**.

**Secondary entry — Space overview / `SpaceCard`:** a quick **status Chip** with
an overflow menu offering the same transitions (no full review panel — the
overview action defers the validation checklist to a Drawer).

**Route:** `/spaces/:spaceId/edit` → **Review & Publish** is a right-docked
**Drawer/Sheet** (foundation §5) over the active editor, so the author keeps
context. (It is a flow, not its own route; deep-link support via
`/spaces/:spaceId/edit?panel=publish`.)

**Common-API reads/writes** (cite `docs/rebuild-spec/specs/common-api.md`):

- **Read — checklist source:** the panel runs a **client-side pre-flight**
  mirroring `validatePublish` using already-loaded data: `v1.levelup.getSpace`
  (title, type, accessType, store fields), `v1.levelup.listStoryPoints` (≥1
  story point; each `timed_test`/`test` needs
  `assessmentConfig.durationMinutes > 0`), and `v1.levelup.listItems` (≥1 item
  per story point). The pre-flight is **advisory** — the server's
  `validatePublish` is the authority (see §8).
- **Read — store readiness:** if `accessType === 'public_store'`, the panel
  checks store fields (`price ≥ 0`, `currency`, `storeDescription`,
  `storeThumbnailUrl`) before enabling the "List on store" toggle.
- **Read — history:** `v1.levelup.listVersions` (paginated) renders the recent
  lifecycle timeline (publish/archive/restore entries written by
  `writeContentVersion`).
- **Write — every transition:** `v1.levelup.saveSpace` with
  `{ id, tenantId, data: { status } }`. Same callable performs the transition
  guard (`ALLOWED_TRANSITIONS`), the publish gate (`validatePublish`), the
  store-mirror upsert/delete, active-session expiry on archive, and the
  content-version write. `tenantId` is derived server-side from auth claims in
  the rebuild — the UI passes it but the server does not trust the body.
- **Write — store listing:** the same `saveSpace` call carries
  `{ publishedToStore: true, price, currency, storeDescription, storeThumbnailUrl }`;
  server requires the space be (or become) `published` first, else
  `failed-precondition`.

**No new callable required** — `saveSpace` already consolidates
`createSpace/updateSpace/publishSpace/archiveSpace/publishToStore`.

---

## 3. Layout — wireframe-as-text

Hosted inside **AppShell** (foundation §5: Sidebar + Topbar) over
`SpaceEditorPage`. The flow is a right **Drawer/Sheet** at `lg`, a full-height
bottom **Sheet** at `sm/md`. Internal max reading width ~`560` so the
consequence copy stays legible.

```
┌─ AppShell ───────────────────────────────────────────────────────────────────┐
│ Sidebar (role nav)                Topbar (tenant switcher · search · profile) │
├───────────────────────────────────────────────────────────────────────────── │
│ SpaceEditorPage header:  {Space title}   [ Badge: Draft ]   [ Publish… ▸ ]    │
│                                                            ⋯ (Archive/Unpub)  │
│                                                                               │
│        ╔═ Drawer: Review & Publish ════════════════════════════════════╗      │
│        ║  ◂ {Space title}              [ Badge: Draft ]            ✕    ║      │
│        ║  Lifecycle stepper:  ● Draft ── ○ Published ── ○ Archived    ║      │
│        ║                                                              ║      │
│        ║  ── Pre-publish checklist (DefinitionList) ──               ║      │
│        ║   ✔ Title set                                               ║      │
│        ║   ✔ At least 1 story point          (4 story points)        ║      │
│        ║   ✔ Every story point has ≥1 item                           ║      │
│        ║   ⚠ Timed test "Final" needs a duration   → [ Fix ]         ║      │
│        ║   — Rubric for assessment items    (recommended)            ║      │
│        ║   ◻ Store fields (price, description)  [only if public]     ║      │
│        ║                                                              ║      │
│        ║  ── Side effects (InlineAlert, info) ──                     ║      │
│        ║   • Notifies {N} students in {M} classes                    ║      │
│        ║   • [Switch] Also list on B2C store  (public_store only)    ║      │
│        ║                                                              ║      │
│        ║  ── Recent lifecycle (Timeline, listVersions) ──            ║      │
│        ║   · Restored to draft · 2d ago · by A. Rao                  ║      │
│        ║                                                              ║      │
│        ║  [ Cancel ]                          [ Publish space ]      ║      │
│        ╚══════════════════════════════════════════════════════════════╝      │
└───────────────────────────────────────────────────────────────────────────── ┘
```

**Confirmation** is a centered **ConfirmDialog** (e3 elevation) layered above
the Drawer — the Drawer is the _review_, the Dialog is the _commit_.

**Responsive (foundation §4 breakpoints):**

- **`sm` (<640):** full-height bottom **Sheet**, gutters `16`; checklist rows
  stack; sticky footer action bar (Cancel / Publish) pinned to bottom (≥44px
  targets).
- **`md` (768):** wider bottom Sheet or right Drawer at ~`440`; same
  single-column body.
- **`lg` (1024+):** right **Drawer** ~`480–520` over the dimmed editor;
  lifecycle Timeline visible inline.

---

## 4. Components used (from §5)

- **AppShell**, **Sidebar**, **Topbar** — page chrome; **Drawer/Sheet** — the
  review surface.
- **Badge** (status) — Draft / Published / Archived, each `icon + label + color`
  (never color-alone): Draft → `text.muted` + dot; Published →
  `status.success` + check; Archived → `text.secondary` + archive glyph.
- **DefinitionList** + status icons — the checklist (term = rule, detail =
  current value / Fix link).
- **InlineAlert/Banner** — side-effect summary (info), blocking validation
  summary (error), store-readiness (warning).
- **Switch** — "Also list on the B2C store" (only enabled when
  `accessType === 'public_store'` and store fields valid).
- **Timeline** (§5 Data) — recent lifecycle from `listVersions`.
- **Button** — primary **"Publish space"**; **spark** variant used _only_ on the
  final ConfirmDialog confirm (the one go-live celebratory CTA); danger
  **"Archive"**; secondary **"Unpublish"** / "Cancel".
- **ConfirmDialog** — the commit step for publish, unpublish, and archive (each
  with its own consequence copy).
- **Toast** (sonner) — success/error after the callable resolves.
- **Stat/KPI** — small "Notifies N students · M classes" readout (Spline Sans
  Mono for the numerals).
- **Skeleton**, **EmptyState**, **LoadingOverlay**, **FormFieldError** — states
  (§5).
- **AnswerKeyLock** (domain, §5) — referenced (not edited here) in the
  timed-test checklist row note: "Answer keys are stored server-side and never
  published to students."

**Proposed addition (justified):** **`LifecycleStepper`** — a 3-node horizontal
stepper (Draft → Published → Archived) that highlights the current status, dims
unreachable nodes per `ALLOWED_TRANSITIONS`, and labels each legal next step. It
is a thin composition of Chip + connector + Badge but recurs anywhere a
space/exam status is shown for transition (Space header, overview, exam
lifecycle), so it earns a named domain component. Added to §5 inventory pending
review.

---

## 5. States

- **Loading:** while the pre-flight reads resolve, render **Skeleton** rows in
  the checklist and a disabled primary button. Lifecycle Timeline shows skeleton
  entries.
- **Ready to publish (all required pass):** checklist all `✔`; primary
  **"Publish space"** enabled (`brand.primary`). Side-effect alert shows the
  student/class count.
- **Blocked (validation fails):** failing rows show `⚠`/`✖` with `status.error`
  icon + the exact reason + a **"Fix"** link that navigates the editor to the
  offending story point/item; primary button **disabled** with a top
  **InlineAlert** (error): "Resolve {n} item(s) before publishing." This mirrors
  the backend `failed-precondition` payload so client and server agree.
- **Partial / recommended-only:** required rules pass but advisory rules (e.g.
  "no rubric on an assessment space", "no thumbnail") show `⚠` warning rows that
  **do not block** publish — copy: "Recommended, not required." Publish stays
  enabled.
- **Server rejects despite green pre-flight:** if `saveSpace` returns
  `failed-precondition` (data changed under us, or a rule the client doesn't
  replicate), the ConfirmDialog surfaces the server's message verbatim in an
  **InlineAlert** and re-runs the pre-flight. The client never claims success
  the server didn't grant.
- **Published state:** Badge `Published`; checklist collapses to a summary;
  actions become **"Unpublish"** (→ draft) and **"Archive…"**. If
  `publishedToStore`, a store row shows the listing + price (Spline Mono) with a
  **"Remove from store"** affordance (achieved via unpublish or explicit
  toggle).
- **Archived state:** Badge `Archived`; only **"Restore to draft"** offered; an
  InlineAlert notes the space is hidden from students and the store listing (if
  any) was removed.
- **Save error (network):** **Toast** error ("Couldn't update the space —
  retry") with retry; status Badge does not change until the callable confirms.
- **Permission-gated by role:**
  - `teacher` (space owner / in `teacherIds`) — full lifecycle within their
    tenant.
  - `tenantAdmin` — same, plus may publish spaces they don't own; only role that
    may enable **public_store** listing if tenant policy restricts B2C (policy
    gate noted in §8).
  - Read-only / non-owner roles — see status Badge + checklist read-only; all
    transition controls hidden, with a Tooltip "Only space owners can change
    status."

---

## 6. Interactions & motion (cite §4 motion)

- **Open the flow:** "Publish…" slides the **Drawer** in from the right with
  `ease.entrance` / `base 220ms` (bottom Sheet on mobile, same timing); editor
  dims behind it. Close exits `ease.exit`.
- **Live checklist:** the pre-flight runs on open and re-runs when the editor
  mutates underlying data; rows that flip from `⚠`→`✔` animate the icon swap
  with `instant 100ms` + a subtle `status.success` tint pulse (no spring — that
  is reserved for go-live).
- **Publish confirm:** "Publish space" opens a **ConfirmDialog**
  (`ease.entrance`/`fast`) that restates consequences: notifies N students,
  optionally lists on store. Confirm button is the **spark** variant. On confirm
  → button → loading spinner (`instant`), `saveSpace` runs.
- **Go-live success — the one celebratory moment (§4):** on resolved publish,
  the status Badge transitions Draft→Published with a single **spring marigold
  pop** + a brief `spark glow` on the new Published Badge, and a success
  **Toast** ("Published — {N} students notified."). This is the only spark
  animation on the screen.
- **Unpublish:** ConfirmDialog warns "Students lose access; store listing (if
  any) will be removed." Confirm → `saveSpace {status:'draft'}`; Badge reverts
  with opacity-only motion (no spark — this is a retraction, not a celebration).
- **Archive:** **danger** ConfirmDialog warns "In-progress test sessions will be
  auto-submitted/expired and students lose access." Confirm →
  `saveSpace {status:'archived'}`; Badge → Archived. The active-session count
  (if any) is shown in the dialog so the author knows the blast radius.
- **Store toggle:** flipping "Also list on store" reveals the store-field
  summary inline (`fast 160ms` height); if fields are incomplete, the toggle is
  disabled with a "Complete store details" link.
- **Optimistic posture:** the screen is **not** optimistic for status — because
  the server can reject (`validatePublish`, transition guard) and the side
  effects are real (notifications, store mirror), the Badge changes **only
  after** the callable resolves. The button shows progress instead.
- **Reduced motion:** Drawer/Sheet slide → fade; the go-live spring pop → a
  non-animated `status.success` Badge swap + Toast, per `prefers-reduced-motion`
  (§4).

---

## 7. Content & copy

- **Panel title:** "Review & Publish" (Fraunces, text-xl). Subhead (Schibsted,
  text-sm, `text.secondary`): "Check what's ready, then make this space
  available to students."
- **Stepper labels:** Draft · Published · Archived.
- **Checklist rows (mirror `validatePublish`, verbatim intent):**
  - "Title set" · "At least one story point" → detail "{n} story points" ·
    "Every story point has at least one item" · "Timed tests have a duration" →
    on fail: ‘Timed test "{title}" needs a duration greater than 0 minutes.’
  - Advisory: "Rubric for assessment items (recommended)" · "Cover image
    (recommended)".
  - Store-only: "Price set" · "Store description" · "Store thumbnail".
- **Side-effect alert:** "Publishing notifies {N} students across {M} assigned
  classes." If no classes: "No classes are assigned — no students will be
  notified." (mirrors the `classIds.length === 0` skip path).
- **Publish ConfirmDialog:** title "Publish this space?" · body "Students in {M}
  classes will be notified and can start immediately." · confirm "Publish"
  (spark) · cancel "Not yet".
- **Unpublish ConfirmDialog:** title "Unpublish and return to draft?" · body
  "Students will lose access. Any B2C store listing will be removed." · confirm
  "Unpublish" · cancel "Keep published".
- **Archive ConfirmDialog (danger):** title "Archive this space?" · body "{K}
  in-progress test session(s) will be auto-submitted. Students lose access and
  the store listing (if any) is removed. You can restore to draft later." ·
  confirm "Archive" (danger) · cancel "Cancel".
- **Restore:** button "Restore to draft" · helper "This space will become
  editable again and hidden from students until you re-publish."
- **Errors:** transition guard — "You can't go from {current} to {requested}." ·
  publish gate — "Resolve {n} requirement(s) before publishing." · store — "Set
  a non-negative price before listing on the store." · network — "Couldn't
  update the space. Nothing changed — retry."
- **Tone:** precise, second-person, consequence-forward; no exclamation except
  the go-live success Toast.

---

## 8. Domain rules surfaced

- **Status machine is server-authoritative:** `ALLOWED_TRANSITIONS` =
  `draft→[published]`, `published→[archived,draft]`, `archived→[draft]`. The
  `LifecycleStepper` and action menu must only offer legal next states; an
  illegal request returns `failed-precondition` with
  `{currentStatus, requestedStatus, allowedTransitions}` — surfaced verbatim.
  (Notably there is **no** direct published↔store or archived→published; restore
  goes through draft first.)
- **Publish gate (`validatePublish`):** the server enforces — (1) non-empty
  `title`; (2) ≥1 story point; (3) each `timed_test`/`test` story point has
  `assessmentConfig.durationMinutes > 0`; (4) each story point has ≥1 item. The
  client checklist is a **faithful preview** of these exact rules; the server is
  the final word, so green-pre-flight never auto-publishes — the author still
  confirms and the server re-validates.
- **Student notification side effect (double path — design must not imply
  duplicate sends):** `saveSpace` fires `notifyStudentsOfPublish`
  (fire-and-forget, derives student `authUid`s from `tenants/{t}/students` by
  `classIds`), **and** the `onSpacePublished` Firestore trigger independently
  sends on the status-change write (resolving students via
  `classes/{id}.studentIds`). The UI surfaces **one** "students notified"
  affordance and must not promise an exact delivery count as a guarantee — copy
  says "notifies students in assigned classes," and the Toast count is
  best-effort. (Proposed FOUNDATION/back-end note: these two paths should be
  reconciled to a single source to avoid double-notification; flagged for the
  rebuild, not designed around.)
- **Store mirror side effect:** listing requires the space be `published` first;
  `saveSpace` writes a mirror doc at `tenants/platform_public/spaces/{id}` with
  `accessType:'public_store'`, `price`, `currency`, `storeDescription`.
  Returning to **draft** deletes that mirror and clears `publishedToStore`. The
  UI must show store state as **derived from** the space lifecycle, never as an
  independent toggle that can drift.
- **Archive expires sessions:** `published→archived` runs `expireActiveSessions`
  — all `in_progress` digital test sessions for the space are set `expired` +
  `autoSubmitted`. The archive ConfirmDialog must state this blast radius (and
  ideally the count) so an author never silently auto-submits live test-takers.
- **Answer-key isolation:** publishing never exposes answer keys; they live in
  the server-only `answerKeys` subcollection denied to all clients (foundation
  §8). The timed-test checklist row carries an **AnswerKeyLock** note making
  this explicit.
- **Stats are authoritative:** the "{N} students / {M} classes" readout is
  derived from authoritative space `stats` / class membership, not client
  recompute.
- **Tenant isolation:** `tenantId` is derived server-side from auth claims in
  the rebuild; all reads/writes are tenant-scoped; the store mirror is the only
  cross-tenant write (into `platform_public`) and is server-mediated.
- **Audit trail:** every transition writes a `ContentVersion`
  (`spaces/{id}/versions`) with a human `changeSummary` — the lifecycle Timeline
  reads these via `listVersions`.

---

## 9. Accessibility

- **Drawer/Dialog semantics:** the review panel is a labelled
  `dialog`/`complementary` with focus trapped; opening moves focus to the panel
  title, closing returns focus to the triggering "Publish…" button. The
  ConfirmDialog is a nested modal `dialog` with `aria-describedby` pointing at
  its consequence copy; focus lands on the safest action (Cancel) by default.
- **Focus order:** stepper → checklist rows (each Fix link reachable) →
  side-effect switch → Timeline → Cancel → primary action. Linear and
  predictable.
- **Status never color-alone (§2):** every Badge, checklist row, and stepper
  node pairs an icon + text label with color (Draft dot / Published check /
  Archived archive glyph; checklist ✔ / ⚠ / ✖ with SR text "Passed / Recommended
  / Failed").
- **Checklist as a list:** rendered as a real list with each row's pass/fail
  state in accessible text; failing rows expose the reason inline and the "Fix"
  link has an `aria-label` naming the target ("Fix duration for timed test
  Final").
- **Live updates:** when the pre-flight re-runs after edits, the checklist
  region is `aria-live="polite"` (debounced) so SR users hear "3 of 4
  requirements met" without spam.
- **Destructive confirmation:** archive/unpublish dialogs require explicit
  button activation (no Enter-to-confirm shortcut on the danger action); the
  danger button is labelled and uses `status.error` + an icon, not color alone.
- **Contrast:** all text/UI pairs meet WCAG AA (§2); the spark go-live Badge
  meets contrast in both themes (it's a Badge swap, not the only signal — the
  Toast and stepper also confirm).
- **Reduced motion:** honor `prefers-reduced-motion` — Drawer slide → fade;
  go-live spring pop → static success state (§4).
- **Targets:** all controls ≥44px (§4), important on the mobile bottom Sheet
  footer.

---

## 10. Web ↔ mobile divergence

- Component **names/props match 1:1** between `shared-ui` (web) and `ui-native`
  (mobile) (§6); only the renderer differs.
- **Surface:** web uses a right **Drawer** over the dimmed editor; mobile uses a
  full-height bottom **Sheet** with a sticky footer action bar.
- **Trigger:** web header "Publish…" button + kebab; mobile collapses
  transitions into a single bottom-anchored primary button + an overflow `Sheet`
  of secondary actions (Unpublish/Archive).
- **Lifecycle Timeline:** full on web; on mobile collapses behind a "History"
  disclosure to preserve vertical space.
- **Hover → press:** checklist "Fix" links and store toggles use press states +
  larger targets on mobile.
- **No ⌘K / CommandPalette** on mobile (§6) — publish is never a palette action.
- **The go-live spark pop** uses CSS transition on web and Reanimated `spring`
  on mobile (§4) — same felt moment, platform-native physics.
- **Authoring caveat:** the **teacher mobile app** primarily _reviews/monitors_;
  heavy editing of failing items (the "Fix" deep-links) is steered to web, with
  mobile showing a "Best edited on web" hint when a Fix target is a complex
  editor.

---

## 11. Claude-design prompt

```
Design the "Space Review & Publish" flow for the Auto-LevelUp teacher web app,
conforming EXACTLY to the Lyceum design system in
docs/rebuild-spec/design/00-FOUNDATION.md. Do NOT invent colors, fonts, or
components — compose only from its tokens and §5 inventory. No Inter/Roboto, no
SaaS blue #3B82F6, no glass morphism. Precise, consequence-forward staff tone —
NOT playful. The ONE allowed spark (marigold) is the successful go-live moment only.

CONTEXT: A teacher/tenantAdmin commits a content Space to learners. The flow is a
right Drawer over the SpaceEditorPage (full-height bottom Sheet on mobile) with:
- A status Badge (Draft / Published / Archived — each icon + label + color) and a
  LifecycleStepper (Draft → Published → Archived) that only offers LEGAL next states
  per ALLOWED_TRANSITIONS (draft→published, published→{archived,draft}, archived→draft).
- A pre-publish checklist as a DefinitionList with pass/warn/fail rows mirroring the
  backend validatePublish: Title set; ≥1 story point; every story point has ≥1 item;
  timed tests have duration > 0. Advisory rows (rubric, cover image) warn but don't block.
  Failing rows show the exact reason + a "Fix" link.
- A side-effects InlineAlert: "Publishing notifies N students across M classes," plus a
  Switch "Also list on the B2C store" (enabled only for public_store + valid price/desc).
- A recent-lifecycle Timeline (from listVersions).
- Footer: secondary "Cancel" + primary "Publish space". Published state shows "Unpublish"
  and danger "Archive…"; archived shows "Restore to draft".

COMMIT STEP: a centered ConfirmDialog above the Drawer restating consequences. Publish
confirm uses the SPARK button variant; Archive uses a DANGER dialog stating "in-progress
test sessions will be auto-submitted" and the count; Unpublish states "students lose
access; store listing removed."

TOKENS: bg.canvas / bg.surface; Fraunces for the "Review & Publish" title (text-xl),
Schibsted Grotesk for body/labels/checklist, Spline Sans Mono for counts/price/percentages.
Drawer/Dialog radius lg, buttons md, Badges pill; elevation e2 for the Drawer, e3 for the
ConfirmDialog. brand.primary for "Publish space"; status.success for the Published Badge;
status.error for failing checklist rows + Archive danger; marigold spark ONLY on the
go-live ConfirmDialog confirm + the success Badge pop + success Toast. Motion: Drawer
ease.entrance/base 220ms; checklist icon swaps instant 100ms; the go-live success is the
single spring marigold pop + spark glow on the new Published Badge. Respect prefers-reduced-motion.

STATES to show: loading Skeleton checklist; ready (all green, Publish enabled); blocked
(failing rows + disabled Publish + top error InlineAlert); recommended-only warnings
(non-blocking); server-reject-despite-green (server message surfaced verbatim);
published (Unpublish/Archive); archived (Restore only); network error Toast.
Status is NEVER optimistic — the Badge changes only after the callable resolves. Every
status cue = icon + label + color (never color alone). Make the Drawer and ConfirmDialog
WCAG-AA accessible (focus trap, focus return, aria-live checklist, safe default focus on
Cancel for destructive dialogs). Deliver responsive sm/md/lg.
```
