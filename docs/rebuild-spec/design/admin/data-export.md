# Data Export — Screen Spec (admin-web)

> **Foundation:** conforms to `docs/rebuild-spec/design/00-FOUNDATION.md`
> ("Lyceum"). All colors, type, spacing, radii, elevation, motion, and
> components are cited by their semantic token / component name from that file —
> never re-pasted. Any proposed addition is flagged inline.
>
> **Register:** the _serious_ register (restraint in chrome). This is a
> staff/admin governance screen — precise, credible, calm. No marigold `spark`
> celebration here; `spark` is reserved for the single primary CTA accent only
> where the foundation already allows it (hero CTA), and on this screen we
> deliberately keep the CTA in `brand.primary`, not `spark`, because export is
> an operational action, not a gamification moment.

- **Title:** Data Export
- **Area:** admin (tenant administrator console, `apps/admin-web`)
- **Route:** `/data-export`
- **Audience / role:** `tenantAdmin` (and `staff` carrying
  `staffPermissions.canExportData`)
- **Live code today:** `apps/admin-web/src/pages/DataExportPage.tsx`

---

## 1. Purpose & primary user

**Primary user:** a **tenant administrator** (school/academy admin) —
occasionally a delegated **staff** member with the `canExportData` permission —
who needs to extract this tenant's records (users, classes, exams, submissions,
analytics) as a downloadable file.

**Job-to-be-done:** _"Get a portable, machine-readable copy of my school's data
— for a data subject's GDPR portability/access request, for a migration, for an
audit, or for an offline analysis — scoped to exactly my tenant, in the format
my downstream tool needs, without waiting at a frozen screen or accidentally
pulling another school's data."_

This is a **governance / compliance** surface, not a daily workflow. It must
read as trustworthy: the tenant-isolation guarantee, the data scope, and the
file's expiry must be explicit, because the output may leave the platform and
satisfy a legal obligation. The register is precise and credible (per Foundation
§1), with chrome restraint — not the encouraging student register.

---

## 2. Entry points & route

**Route:** `/data-export`, rendered inside the authenticated `AppLayout`
(AppShell). Declared in `apps/admin-web/src/App.tsx`; nav entry lives in the
**Configuration** nav group of `AppSidebar`
(`apps/admin-web/src/layouts/AppLayout.tsx`), where Data Export already exists.

**Entry points:**

1. Sidebar → Configuration → **Data Export**.
2. `CommandPalette` (⌘K, web-only) → "Export data" / "Data Export" → navigates
   to `/data-export`.
3. Deep link from a compliance/audit runbook.
4. (Proposed) a "Export" affordance on `/users` and `/settings` deep-linking
   here with the relevant scope preselected via query param (e.g.
   `/data-export?scope=students`). Flag as a small future enhancement — not
   required for parity.

**API reads/writes** (per `docs/rebuild-spec/specs/common-api.md` §3.3, identity
module):

- **Primary write/job:** `v1.identity.exportTenantData` →
  `{ downloadUrl, expiresAt }` (common-api §3.3 identity; returns a **signed
  Storage URL**). This replaces today's `callExportTenantData` wrapper. Per
  common-api §4.4, `tenantId` is **derived server-side from
  `ctx.activeTenantId`** — it is **not** sent in the request body (today's code
  sends `tenantId`; the rebuild drops it). Request carries
  `{ collections: string[], format: 'json' | 'csv', idempotencyKey? }`.
  `rateTier: 'report'` is appropriate (heavy, async, low-frequency) — propose
  the registry tag this export under the `report` tier alongside
  `generateReport`.
- **Analytics scope (new):** to honor the screen's "users, results,
  **analytics**" scope, the analytics summary collections
  (`studentProgressSummaries`, `classProgressSummaries`, `examAnalytics`,
  `costSummaries`, `insights`) are export-able. These have **no direct client
  read rules** (`be-analytics.md` §4.5) and must be assembled server-side.
  **Proposed contract addition:** extend `exportTenantData`'s `collections` enum
  to include `analytics` (server expands it into the materialized summary
  collections it owns), OR add a dedicated `v1.analytics.exportAnalytics`. Flag
  as a foundation/contract addition for the API spec — the UI treats it as one
  selectable scope either way.
- **Read — export history:** today the page keeps history only in component
  state (lost on reload). **Proposed read endpoint:**
  `v1.identity.listExportJobs` (paginated via the §7 PageRequest fragment)
  returning prior export job records
  `{ id, collections[], format, status, requestedBy, requestedAt, completedAt, expiresAt, downloadUrl?, sizeBytes? }`.
  This makes export an auditable, durable job (see §8). Flag as contract
  addition.

**Hooks:** consumed through `@levelup/shared-hooks` over `@levelup/api-client`
(never `httpsCallable` or `firebase/firestore` directly — common-api §2, §5.3):
`useExportTenantData()` (mutation), `useExportJobs()` (query). `useApiError()`
maps `error.details.code` → copy (common-api §6.3).

---

## 3. Layout — wireframe-as-text

Rendered inside **AppShell**: persistent `Sidebar` (left), `Topbar` (tenant
switcher, ⌘K search, `NotificationBell`, `RoleSwitcher`, `ThemeToggle`,
profile), `Breadcrumb` (Home / Configuration / Data Export), and the
`QuotaWarningBanner` slot. Page gutters per Foundation §4 (mobile 16 / tablet 24
/ desktop 32); max content width **1200**; this is a focused form, so the
working column caps at ~**760–840** (reading-width discipline) and is
left-aligned within the content area, not stretched.

Regions, top → bottom:

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Breadcrumb: Home / Configuration / Data Export                               │
│                                                                              │
│ H1  Data Export                                       (Fraunces, text.primary)│
│ Sub  Export this school's records as JSON or CSV.     (text.secondary)        │
│                                                                              │
│ ┌── InlineAlert (info, status.info) ─────────────────────────────────────┐  │
│ │  ⓘ Scoped to {Tenant name} only. Exports never include data from        │  │
│ │    other schools. Files are signed links that expire after 1 hour.      │  │
│ └─────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│ ┌── Panel: "Configure export" (Card, radius lg, e1) ─────────────────────┐  │
│ │ Section 1 — Select data to export                  (label, base 500)    │  │
│ │   [▣ Students] [▢ Teachers] [▢ Parents] [▢ Classes]                     │  │
│ │   [▢ Exams]    [▢ Submissions] [▢ Analytics]        (Checkbox grid)     │  │
│ │   ↳ helper: "Submissions includes released results only."  (text.muted) │  │
│ │                                                                          │  │
│ │ Section 2 — Format                                  (label)             │  │
│ │   ( • CSV )  ( ○ JSON )                              (Radio chips)      │  │
│ │   ↳ helper for JSON/CSV tradeoff                    (text.muted)        │  │
│ │                                                                          │  │
│ │ ── divider (border.subtle) ──                                           │  │
│ │ [ Export data ]  (Button primary)   3 collections · CSV  (text.muted)   │  │
│ └─────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│ ┌── Panel: "Export history" (Card) ───────────────────────────────────────┐  │
│ │ DataTable / stacked list of prior jobs:                                  │  │
│ │  Students, Classes (CSV) · 2.4 MB                                         │  │
│ │     ⦿ Ready  ·  expires 14:32   [Download]   (GradePill-style Badge)     │  │
│ │  Submissions (JSON)                                                       │  │
│ │     ◷ Preparing… (ProgressBar / Skeleton)                                 │  │
│ │  Exams (CSV)                                                              │  │
│ │     ⦸ Expired  (Badge, text.muted)   [Re-export]                          │  │
│ └─────────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
```

**Responsive (Foundation §4 breakpoints sm 640 / md 768 / lg 1024):**

- **lg (≥1024):** as drawn. Collection Checkbox grid = 3–4 columns. History
  rendered as a compact `DataTable` (columns: Scope · Format · Size · Status ·
  Expiry · Action). Sidebar persistent.
- **md (768–1023):** content full-width within gutters; Checkbox grid = 3
  columns; history table drops the Size column into the Scope cell.
- **sm (<768):** sidebar collapses to `Tabbar`/MobileBottomNav; single content
  column; Checkbox grid = 2 columns; **history table → stacked cards**
  (Foundation §6 table→cards rule), each row a `Card` with scope/format as
  title, a status `Badge`, expiry line, and a full-width Download `Button`. CTA
  `Button` goes full-width.

---

## 4. Components used (Foundation §5 only)

**Containers:** `AppShell`, `Sidebar`, `Topbar`, `Breadcrumb`, `Card`, `Panel`,
`Section`, divider via `border.subtle`.

**Primitives:** `Checkbox` (collection multi-select — replaces today's raw
`<input type=checkbox>`), `Radio` (format selector — replaces today's raw
radio), `Button` (variant **primary** for "Export data"; variant
**secondary/ghost** for "Download" / "Re-export" row actions), `IconButton`
(copy link).

**Feedback:** `InlineAlert/Banner` (variant **info**, `status.info`, for the
tenant-isolation + expiry guarantee; variant **warning**, `status.warning`, for
the no-selection / quota cases), `Toast` (sonner) for success/failure,
`ConfirmDialog` (large-scope confirmation — see §6), `LoadingOverlay` is **not**
used (async job, not a blocking spinner), `FormFieldError`.

**Data:** `DataTable` (export history on lg/md — sort by requestedAt; no filter
needed at this volume), `EmptyState` (no exports yet), `Skeleton` (history
loading + in-progress job row), `Badge` (status: Ready / Preparing / Expired /
Failed — pill radius), `ProgressBar` (preparing job), `Stat`/`DefinitionList`
not required.

**Navigation:** `CommandPalette` (⌘K entry, web-only).

**Domain components:** none of the assessment domain components apply (this is
governance, not learning/grading). The status `Badge` borrows the same visual
grammar as `GradePill`/`ConfidenceBadge` (icon + label + token color) but is a
plain `Badge`, not those domain components.

**Proposed additions (flagged):**

- None new are strictly required — the screen composes entirely from §5. The
  **export status `Badge` color mapping** (Ready=`status.success`,
  Preparing=`status.info`, Expired=`text.muted`/ `border.strong`,
  Failed=`status.error`) reuses existing semantic tokens; if the team wants a
  named `job.*` status scale it should be added to Foundation §2.3 first. Until
  then, use the listed semantic tokens directly — do not invent hex.

---

## 5. States

| State                              | Trigger                                                                   | Rendering                                                                                                                                                                                                                                                                                                       |
| ---------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Permission-denied (role-gated)** | caller is not `tenantAdmin` and lacks `staffPermissions.canExportData`    | Full-page `EmptyState` (no form): H1 "Data Export", body "You don't have permission to export data. Ask a school administrator with export rights." Render an `InlineAlert` (info), no CTA. Mirrors today's `canExport` guard, but the rebuild also relies on server `PERMISSION_DENIED` as the real gate (§8). |
| **Idle / ready**                   | page loaded, nothing selected                                             | Form enabled; "Export data" `Button` **disabled** (`disabled` state, Foundation §5) until ≥1 collection selected. CTA caption shows live "N collections · FORMAT".                                                                                                                                              |
| **Submitting (per-job)**           | `Export data` clicked                                                     | The clicked `Button` enters **loading** state (spinner + "Preparing export…"); the form stays interactive for a _next_ export only after the job is enqueued. A new **Preparing** row is optimistically prepended to history with a `ProgressBar`/`Skeleton`.                                                   |
| **Async preparing**                | job accepted, file not yet ready                                          | History row shows `Badge` **Preparing** (`status.info`) + `ProgressBar`. Polls `useExportJobs()` (or realtime job status per common-api §10) until `status: ready`. No frozen screen.                                                                                                                           |
| **Success (ready)**                | job completes                                                             | Row flips to `Badge` **Ready** (`status.success`, check icon + label), shows size + `expires HH:MM`, and a **Download** `Button`. `Toast` success: "Export ready — download expires in 1 hour."                                                                                                                 |
| **Partial**                        | some requested collections empty/unavailable (e.g. tenant has no parents) | Job still succeeds; row sub-line notes "Teachers, Parents — Parents had no records." `InlineAlert` (info) on the row, not an error. Analytics scope unavailable on a tenant without the `analytics` feature flag → that scope is omitted with a note.                                                           |
| **Empty (history)**                | no prior exports                                                          | History panel `EmptyState`: serif title (Fraunces) "No exports yet", body "Choose what to export above. Your generated files appear here." Icon `FileDown`.                                                                                                                                                     |
| **Error — validation**             | no collection selected and submit forced                                  | `FormFieldError` under the collection grid + CTA stays disabled; `InlineAlert` warning. Maps `VALIDATION_ERROR` (common-api §6).                                                                                                                                                                                |
| **Error — quota / rate**           | `QUOTA_EXCEEDED` / `RATE_LIMITED` (`report` tier)                         | `InlineAlert` warning (`status.warning`) above the CTA with `ERROR_RECOVERY_HINTS` copy; CTA disabled with a cooldown note. `QuotaWarningBanner` may already be showing in the shell.                                                                                                                           |
| **Error — feature disabled**       | `FEATURE_DISABLED` (e.g. analytics scope, tenant lacks feature)           | that scope's `Checkbox` is `disabled` with a tooltip "Analytics export isn't enabled for this school."                                                                                                                                                                                                          |
| **Error — tenant suspended**       | `TENANT_SUSPENDED`                                                        | whole form disabled; `InlineAlert` error explaining the tenant is suspended and to contact platform support.                                                                                                                                                                                                    |
| **Error — job failed**             | server job error                                                          | History row `Badge` **Failed** (`status.error`, alert icon + label) + "Try again" `Button`; `Toast` error.                                                                                                                                                                                                      |
| **Expired link**                   | `expiresAt` < now                                                         | Download replaced by `Badge` **Expired** (icon + label, `text.muted`) + **Re-export** `Button`. (Today's code already computes `isExpired`.)                                                                                                                                                                    |

All status indicators pair **icon + text label + token color** — never color
alone (Foundation §2.3, §9).

---

## 6. Interactions & motion (Foundation §4 motion tokens)

**Select collections.** Click/tap a `Checkbox` card → selected state uses
`bg.surface-sunken` + `border.focus`/`brand.primary` border; transition
`fast 160ms` `ease.standard` on background/border. CTA caption ("N collections ·
FORMAT") updates instantly (`instant 100ms`). The "Export data" `Button`
un-disables the moment count ≥ 1 (`fast`).

**Pick format.** Radio chip toggle; selected chip `border.focus` +
`bg.surface-sunken`, `fast 160ms`.

**Large-scope confirmation.** If the selection includes high-sensitivity
collections (**Submissions** or **Analytics**, which can contain personal
results), clicking "Export data" first opens a `ConfirmDialog` (`Modal`
elevation `e3`, entrance `ease.entrance`, `base 220ms`): title "Export sensitive
data?", body naming the scopes and reaffirming the 1-hour signed-link expiry and
tenant scope, primary `Button` "Export", secondary "Cancel". For low-sensitivity
scopes (e.g. Classes only) no confirmation — submit directly. This is a
deliberate friction point appropriate to the serious register; it is **not**
present in today's code and is a recommended add.

**Submit → async job (no optimistic file).** On confirm, the CTA enters
**loading**; a new history row is **optimistically prepended** in **Preparing**
state with a `ProgressBar` (this is the only optimistic update — the _file
itself is never optimistic_; the download appears only when the server returns a
`downloadUrl`). Row reveal uses `entrance` `base 220ms`. The job is
server-authoritative: the client shows progress but the URL, size, and
`expiresAt` are server values (§8).

**Completion.** Row flips Preparing→Ready: `Badge` swaps with a `fast 160ms`
cross-fade; the **Download** `Button` slides in (`entrance`, `fast`). `Toast`
(sonner) success, `base`. **No marigold burst / spring pop** — this is
governance, not gamification (Foundation §4 reserves the celebratory moment for
XP/streak/level-up only).

**Download.** Clicking **Download** opens the signed URL (`target=_blank`,
`rel=noopener noreferrer`, today's behavior) or triggers the browser download.
An `IconButton` "Copy link" copies the signed URL with a `Toast` "Link copied —
expires HH:MM".

**Expiry tick.** A row near expiry shows a live "expires in Nm" that recomputes
on a cheap interval; on crossing `expiresAt` it flips to **Expired** +
**Re-export** (`fast`).

**Reduced motion.** With `prefers-reduced-motion`, all reveals/cross-fades
become instant opacity swaps; `ProgressBar` stays (it conveys real state, not
decoration) but its shimmer is disabled.

---

## 7. Content & copy (precise admin tone)

- **H1:** `Data Export`
- **Sub:** `Export this school's records as JSON or CSV.`
- **Isolation/expiry InlineAlert:**
  `Scoped to {Tenant name} only. Exports never include data from other schools. Download links are signed and expire 1 hour after the file is ready.`
- **Section 1 label:** `Select data to export`
  - Collection labels: `Students`, `Teachers`, `Parents`, `Classes`, `Exams`,
    `Submissions`, `Analytics`. (Today's code lacks Parents and Analytics; add
    for full scope.)
  - Helper:
    `Submissions includes released results only. Analytics includes progress and exam summaries.`
- **Section 2 label:** `Format`
  - `CSV` helper: `One file per collection — best for spreadsheets.`
  - `JSON` helper: `Structured export — best for migration and developers.`
- **CTA:** `Export data` · loading: `Preparing export…` · caption:
  `{N} collections · {FORMAT}`
- **ConfirmDialog (sensitive):** title `Export sensitive data?` · body
  `This export includes {scopes}. The file may contain personal results. It stays scoped to {Tenant name} and the download link expires in 1 hour.`
  · primary `Export` · secondary `Cancel`
- **History panel heading:** `Export history`
- **Empty state:** title `No exports yet` · body
  `Choose what to export above. Your generated files appear here.`
- **Status badges:** `Ready` · `Preparing` · `Expired` · `Failed`
- **Row meta:** `Expires {HH:MM}` · `Expired` · `{size}` ·
  `Requested by {name} · {date}`
- **Permission-denied:** title `Data Export` · body
  `You don't have permission to export data. Ask a school administrator with export rights.`
- **Errors (from `ERROR_MESSAGES`, common-api §6):**
  - validation (no selection): `Select at least one collection to export.`
  - quota:
    `Your export quota for today is used up. Try again tomorrow or contact support.`
  - rate-limited:
    `Too many exports in a short time. Please wait a moment and try again.`
  - feature disabled: `Analytics export isn't enabled for this school.`
  - tenant suspended:
    `This school is suspended. Exports are unavailable — contact platform support.`
  - job failed: `That export couldn't be generated. Try again.`

Tone: declarative, no exclamation, no emoji, no "Oops". Numbers (sizes, counts,
times) render in `Spline Sans Mono` per Foundation §3.

---

## 8. Domain rules surfaced

1. **Tenant isolation (hard rule).** The export is scoped to exactly one tenant.
   Per common-api §4.4 the **server derives `tenantId` from
   `ctx.activeTenantId`** (the JWT claim), **not** from the request body — the
   UI must not send `tenantId` (today's `DataExportPage` does; the rebuild
   removes it, eliminating the "wrong tenant" bug class). The isolation
   guarantee is surfaced visibly in the info `InlineAlert` naming the current
   tenant. Cross-tenant export is impossible for a `tenantAdmin`; only
   super-admin has `tenantOverride` (and super-admin uses the super-admin app,
   not this screen).
2. **RBAC.** Allowed callers: `tenantAdmin`, or `staff` with
   `staffPermissions.canExportData` (auth-access §2). The UI gate is **UX
   only**; the real gate is the server callable returning `PERMISSION_DENIED`
   (common-api §6, auth-access §1.6). Never rely on hiding the route alone.
3. **Server-authoritative outputs.** `downloadUrl`, `expiresAt`, `sizeBytes`,
   and job `status` are **server values** — the client renders them, never
   fabricates them. The file is a **signed Storage URL** with a **1-hour** TTL
   (mirrors `generateReport`'s signed-URL pattern, be-analytics §1). The UI must
   reflect the server's `expiresAt`, not assume a duration.
4. **Storage scoping.** Export files live under `tenants/{tenantId}/exports/...`
   and the signed URL is the only access path. Per auth-access §4.1/§5.4
   (storage-rules hardening), exports are readable only by tenant admins of that
   tenant — the UI must treat the signed URL as a secret (don't log it,
   copy-to-clipboard is explicit, link expires).
5. **Answer-key invisibility.** Submissions/Exams exports must **never** include
   the server-only answer-key subcollection (`…/items/{id}/answerKeys`,
   `…/questions` keys — auth-access §2, common-api §3.3 `saveItem` strips keys
   into a server-only subcollection). The export service excludes answer keys;
   the UI should state "Exam exports never include answer keys." in the Exams
   helper/tooltip.
6. **Released-results gate.** Submissions export contains **released** results
   only (the `resultsReleased` projection, common-api §3.3 autograde read
   endpoints) — surfaced in the helper copy so admins don't expect un-released
   grades.
7. **Quota / cost budget.** Export is heavy and tagged `rateTier: 'report'`
   (common-api §9). Quota exhaustion surfaces as `QUOTA_EXCEEDED`; the shell's
   `QuotaWarningBanner` and the per-screen warning `InlineAlert` communicate
   caps. Exports count against tenant usage (`TenantUsage`).
8. **Audit.** Every export is a mutating governance action and **must** be
   audit-logged (common-api §9 "Audit"; `tenants/{tenantId}/auditLogs`, write
   `if false` from client / Admin-SDK only — auth-access §2). The audit entry
   records `{ actorUid, collections, format, requestedAt, jobId }`. The
   (proposed) `listExportJobs` history view is the admin-facing reflection of
   this audit trail — a compliance affordance, not just convenience.
9. **GDPR/portability framing.** Because output may satisfy a data subject
   access/portability request, the format choice (JSON = structured/portable)
   and the explicit scope selection map directly to "what data, in what form" a
   controller must provide. The copy avoids legal claims but gives the admin the
   controls a controller needs.
10. **Idempotency.** Per common-api §9, the export request may carry an
    `idempotencyKey` so a double-click does not enqueue two heavy jobs; the UI
    generates one key per submit attempt.

---

## 9. Accessibility (WCAG AA)

- **Focus order:** Breadcrumb → H1 region → info `InlineAlert` → collection
  `Checkbox` group (in reading order) → format `Radio` group → "Export data"
  `Button` → history items (each row's Download/Re-export) . `ConfirmDialog`
  traps focus; on close, focus returns to the CTA.
- **Keyboard:** `Checkbox` cards are real checkboxes — `Space` toggles, `Tab`
  moves between them. Format is a single `Radio` group — arrow keys move
  selection, `Tab` exits the group (replace today's `sr-only` raw radios with
  the §5 `Radio` primitive so arrow-key semantics work). CTA and row actions are
  `Enter`/`Space` activable. ⌘K opens `CommandPalette` (web-only).
- **ARIA / semantics:** collection group = `role="group"` with `aria-labelledby`
  → "Select data to export"; format = `role="radiogroup"`. CTA loading sets
  `aria-busy="true"` and announces "Preparing export" via an
  `aria-live="polite"` region. Job completion ("Export ready — download expires
  HH:MM") and failures are announced via the same polite live region (the route
  announcer already exists in `AppLayout`). The download `Button` has an
  accessible name including scope + format ("Download Students, Classes CSV").
  Status `Badge`s expose their text label to AT (not icon only).
- **Contrast:** all text/bg pairs meet AA (Foundation §2.2 tokens are AA by
  construction); status badges use icon + label so the 3:1 UI-contrast
  requirement isn't the sole carrier of meaning.
- **Never status-by-color-alone:** Ready/Preparing/Expired/Failed each carry an
  icon **and** a text label in addition to token color (Foundation §2.3, §9).
- **Reduced motion:** honor `prefers-reduced-motion` — reveals/cross-fades
  become instant; the meaningful `ProgressBar` remains but loses shimmer.
- **Targets:** Checkbox cards, format chips, and row buttons are ≥44px touch
  targets (Foundation §4).

---

## 10. Web↔mobile divergence

admin-web is **web-first**; there is no dedicated tenant-admin React Native app.
Stated explicitly:

- **Primary surface is web.** ⌘K `CommandPalette` entry is **web-only**
  (Foundation §6) — no command palette on mobile/RN.
- **Responsive web ≠ a separate mobile app.** At `sm`, the same React app
  reflows: history `DataTable` → **stacked `Card`s**, hover states → press
  states, multi-column Checkbox grid → 2 columns, full-width CTA (Foundation §6
  parity rules).
- **No RN export screen is in scope.** If a future RN admin client appears, it
  would consume the identical `useExportTenantData()` / `useExportJobs()` hooks
  over `api-client` (common-api §5.3, zero-DOM), render the same component names
  from `ui-native`, and rely on the OS download/share sheet for the signed URL
  instead of `<a target=_blank>`. Tokens/components match 1:1; only the
  download-link handoff differs.

---

## 11. Claude-design prompt (ready to paste)

```
You are designing ONE admin screen for Auto-LevelUp's rebuild, conforming EXACTLY to the
"Lyceum" design system in docs/rebuild-spec/design/00-FOUNDATION.md. Read that foundation
first and compose ONLY from its tokens and its §5 component inventory. Do not invent colors,
fonts, spacing, radii, shadows, motion, or component variants. Cite tokens by semantic name
(brand.primary, bg.surface, bg.surface-sunken, border.subtle, border.focus, status.info,
status.success, status.warning, status.error, text.primary/secondary/muted) — never hex.

SCREEN: "Data Export" — route /data-export — audience: tenantAdmin (or staff with
canExportData). REGISTER: the SERIOUS register — precise, credible, restrained chrome. This is
a GDPR/portability + governance screen, NOT a gamification moment: NO marigold spark
celebration, NO spring pop. Keep the primary CTA in brand.primary.

RENDER INSIDE AppShell (Sidebar + Topbar + Breadcrumb Home / Configuration / Data Export).
Content column ~760–840px, left-aligned, within 1200 max.

BUILD these regions:
1. H1 "Data Export" (Fraunces) + sub "Export this school's records as JSON or CSV." (text.secondary).
2. An info InlineAlert (status.info) stating: scoped to {Tenant name} only, never includes other
   schools' data, download links are signed and expire 1 hour after the file is ready.
3. A "Configure export" Card (radius lg, e1) containing:
   - Section "Select data to export": a Checkbox grid (3–4 cols on lg, 2 on sm) of
     Students / Teachers / Parents / Classes / Exams / Submissions / Analytics, selected cards using
     bg.surface-sunken + border.focus. Helper (text.muted): "Submissions includes released results
     only. Exam exports never include answer keys."
   - Section "Format": a Radio group of CSV / JSON as chips, with one-line helper each.
   - A divider (border.subtle), then a primary Button "Export data" (disabled until ≥1 collection),
     with a mono caption "{N} collections · {FORMAT}".
4. An "Export history" Card: on lg/md a DataTable (Scope · Format · Size · Status · Expiry ·
   Action); on sm, stacked Cards. Status as Badge with ICON + LABEL + token color:
   Ready=status.success, Preparing=status.info (+ ProgressBar), Expired=text.muted, Failed=
   status.error. Ready rows show size + "expires HH:MM" + a Download button; expired rows show
   "Re-export". Empty state: Fraunces title "No exports yet".

STATES to show: permission-denied (full EmptyState, no form), idle (CTA disabled), submitting
(CTA loading "Preparing export…" + optimistic Preparing row — file itself NOT optimistic),
preparing (async, ProgressBar, no frozen screen), ready (Toast "Export ready — download expires in
1 hour."), validation error (no selection), quota/rate error (warning InlineAlert), feature-disabled
(Analytics checkbox disabled w/ tooltip), expired link, failed job.

INTERACTIONS/MOTION (Foundation §4 tokens): selecting collections fast 160ms ease.standard;
selecting sensitive scopes (Submissions/Analytics) opens a ConfirmDialog (Modal e3, ease.entrance,
base 220ms) reaffirming 1-hour expiry + tenant scope before submit; completion = fast cross-fade
Badge swap + Toast, NO celebration. Respect prefers-reduced-motion (instant swaps; keep ProgressBar,
drop shimmer).

ACCESSIBILITY: real Checkbox group (role=group) + Radio group (role=radiogroup, arrow keys); CTA
aria-busy while preparing; announce "Export ready — expires HH:MM" via aria-live=polite; every
status Badge carries icon+label (never color alone); all pairs meet WCAG AA; ≥44px targets.

DOMAIN RULES TO SURFACE: tenant isolation (server derives tenantId from the active-tenant claim —
do NOT include a tenantId field in the form), RBAC gate is UX-only with server PERMISSION_DENIED as
truth, downloadUrl/expiresAt/size/status are server-authoritative signed values (1-hour TTL),
answer keys never exported, Submissions = released results only, export is audit-logged and
quota/rate-limited (report tier).

Numbers/sizes/times in Spline Sans Mono. Output: a single responsive screen (lg + sm) using the
Lyceum tokens and §5 components only.
```
