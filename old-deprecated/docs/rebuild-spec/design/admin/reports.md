# Reports — Screen Spec

> Area: **admin (tenant control plane)** · Route: `/reports` · Audience:
> **tenantAdmin** (scoped to ONE tenant) Conforms to the Lyceum foundation
> (`docs/rebuild-spec/design/00-FOUNDATION.md`). All visual values cite semantic
> tokens by name; nothing new is invented except where explicitly flagged as a
> **proposed foundation addition** (§4). Register: **precise / credible admin
> chrome** (the serious register — restraint in chrome, not the playful student
> spark), per Foundation §1.

---

## 1. Purpose & primary user

**Primary user:** the **tenantAdmin** — a school / academy administrator
operating a single tenant's console (`apps/admin-web`). Identity is a
`UserMembership` row with `role: 'tenantAdmin'` for exactly one
`(uid, tenantId)` pair; the active tenant comes from claims, not the URL
(auth-access §1, common-API §4.4).

**Job-to-be-done:** _"As the academy admin, I need to generate and download a
polished, shareable PDF report for a specific exam, class, or student — to send
to parents, archive for records, or review with staff — without exporting raw
data or touching a spreadsheet."_

This screen is a **report builder + download surface**. The user (1) picks a
**report type** (exam result, progress, class), (2) supplies the **parameters**
that type requires (which exam / class / student, optional academic session),
and (3) **generates** a server-rendered PDF and downloads it via a short-lived
signed URL. The heavy lifting — reading exams/questions/submissions/summaries,
laying out the PDF with `pdfkit`, uploading to Cloud Storage — is entirely
**server-side** (be-analytics §1, `generate-report.ts`). The client only
collects parameters, triggers, and hands back a download link.

**Today vs rebuild.** The live `ReportsPage.tsx` is a two-tab list (Exam Reports
/ Class Reports) that renders one `DownloadPDFButton` per row, hardcoding
`type: 'exam-result'` (class-summary form, no student) and `type: 'class'`. It
never exposes `type: 'progress'`, never lets you pick a student, and never
surfaces signed-URL expiry. The rebuild promotes this to an explicit **type →
parameters → generate** builder that covers all three report types the callable
supports, while keeping the at-a-glance list of "what's reportable right now."

---

## 2. Entry points & route

- **Route:** `/reports` inside the **admin-web** `AppShell`. Guarded by
  `RequireAuth` with `allowedRoles={['tenantAdmin']}` and the tenant-match
  assertion `currentMembership.tenantId === currentTenantId` (app-admin-web §1,
  auth-access). A non-admin who reaches this URL gets the standard Access-Denied
  panel; a `staff` user is gated by `StaffPermissions` (see §8).
- **Entry points:**
  - **Sidebar** → "Analytics" group → "Reports"
    (`apps/admin-web/src/layouts/AppLayout.tsx` nav groups).
  - **CommandPalette (⌘K)** → "reports", "report card", "exam result PDF",
    "progress report" (web only).
  - **Deep-links** (pre-fill the builder, do not auto-generate):
    - From **Exams Overview** / **Exam Detail** → "Generate report" →
      `/reports?type=exam-result&examId=…`.
    - From **Class Detail** → "Class report card" →
      `/reports?type=class&classId=…`.
    - From a **Student** record → "Progress report" →
      `/reports?type=progress&studentId=…`.

### Common-API reads/writes (`specs/common-api.md`)

This screen goes entirely through the typed client SDK — **no
`firebase/firestore` in the UI** (common-API §2 "Key shift", §5.3). The one
mutation-style call is the report generator; the parameter pickers are populated
by ordinary read callables.

| Need                                              | Callable                                                                                                                                                                  | Notes                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| List exams to pick from (exam-result type)        | `v1.autograde.listExams` (new read endpoint, common-API §3.3)                                                                                                             | Replaces today's `useExams` direct read. Filter client-side to reportable statuses (`grading` \| `completed` \| `results_released`).                                                                                                                                                                                    |
| List classes to pick from (class type)            | `v1.identity` class list read (the rebuilt equivalent of today's `useClasses`)                                                                                            | Used to populate the class Combobox and, for `progress`, to scope the student picker.                                                                                                                                                                                                                                   |
| List students in the chosen class (progress type) | `v1.autograde.listSubmissions` / class-scoped student read                                                                                                                | Student Combobox is **scoped to the chosen class** so the admin never enumerates the whole tenant roster in one control.                                                                                                                                                                                                |
| **Generate the report (the action)**              | **`v1.analytics.generateReport`** (`type: 'exam-result' \| 'progress' \| 'class'`, discriminated combined-mode endpoint, common-API §3.1, §3.3) → `{ pdfUrl, expiresAt }` | `rateTier: 'report'` (common-API §2.4; be-analytics §1 `'report',5`). Server reads exams/questions/submissions/summaries, **re-validates each with Zod**, renders the PDF via `pdfkit`, uploads to `tenants/{tenantId}/reports/{exams\|progress\|classes}/…pdf`, and returns a **1-hour signed URL** (be-analytics §1). |

**Request shape (rebuild).** `tenantId` is **omitted from the body**; the server
derives it from `ctx.activeTenantId` (common-API §4.4), which closes the "wrong
tenant" bug class. Per-type required parameters (ground truth —
`GenerateReportRequest`, `packages/shared-types/src/callable-types.ts:512`):

| `type`        | Required params                                                                        | Optional            |
| ------------- | -------------------------------------------------------------------------------------- | ------------------- |
| `exam-result` | `examId` (+ `studentId` ⇒ individual result; **omit `studentId` ⇒ class-summary PDF**) | `academicSessionId` |
| `progress`    | `studentId`                                                                            | `academicSessionId` |
| `class`       | `classId`                                                                              | `academicSessionId` |

**Response (rebuild).** `{ pdfUrl, expiresAt }`. The live type is `{ pdfUrl }`
only (`callable-types.ts:525`); the common-API contract (§3.3) and the 1-hour
signed-URL behaviour (be-analytics §1) mean **`expiresAt` must be added to
`GenerateReportResponse`** so the UI can show, and re-fetch past, expiry.

> **Proposed contract addition (flag to backend):** add `expiresAt: string`
> (ISO) to `GenerateReportResponse` so the client can render the "link valid
> until …" affordance and trigger regeneration after expiry, instead of guessing
> one hour. Until then, the UI assumes a 1-hour TTL from generation time and
> labels it as approximate.

---

## 3. Layout — wireframe-as-text

Hosted in the admin `AppShell` (Sidebar + Topbar + content). This screen owns
only the content region; the tenant switcher, search, notifications, and profile
live in the Topbar (§5 Navigation).

```
┌─ AppShell ──────────────────────────────────────────────────────────────────┐
│ Sidebar (Analytics ▸ Reports active) │ Topbar: tenant · ⌘K · 🔔 · avatar     │
├──────────────────────────────────────┴───────────────────────────────────────┤
│  CONTENT (max-width 1200, gutter 32 @lg)                                       │
│                                                                               │
│  H1  Reports                                                                  │
│  sub Generate and download PDF reports for this academy.                      │
│                                                                               │
│  ┌─ Builder Panel (Card, radius lg, e1) ───────────────────────────────────┐ │
│  │  REPORT TYPE  (segmented / radio-group — 3 options)                      │ │
│  │   ○ Exam result   ○ Class report card   ○ Student progress              │ │
│  │  ───────────────────────────────────────────────────────────────────── │ │
│  │  PARAMETERS  (fields swap by type)                                       │ │
│  │   [Exam ▾ Combobox]   [Scope: ○ Whole class  ○ One student]            │ │
│  │   [Student ▾ Combobox (shown only when scope=one student)]             │ │
│  │   [Academic session ▾ Select (optional)]                                │ │
│  │  ───────────────────────────────────────────────────────────────────── │ │
│  │  EXPORT FORMAT  PDF (only format today — see §4 note)                   │ │
│  │                                          [ Generate report ]  (primary) │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
│  ┌─ Result strip (appears after generate) ─────────────────────────────────┐ │
│  │  ✓ Report ready · class-summary · "Algebra Unit 2"                       │ │
│  │  Link valid until 14:32 (≈1 hr).   [ Download PDF ] [ Open ] [ Regen ]   │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
│  ── Tabs: Reportable exams · Classes (quick-pick list, optional) ──────────── │
│  DataTable rows → "Use" pre-fills the builder above (does NOT auto-generate). │
└───────────────────────────────────────────────────────────────────────────────┘
```

**Grid / responsive (Foundation §4 breakpoints, gutters mobile 16 / tablet 24 /
desktop 32):**

- **lg (≥1024):** Builder Panel is a single full-width Card (max-width 1200).
  Parameter fields sit on a 12-col grid: exam/class picker spans 6,
  scope/student 6, academic session 4. The quick-pick list below is a full
  DataTable.
- **md (768–1023):** Same single-column Card; parameter fields stack to 2-up
  then 1-up as they wrap. DataTable keeps columns but drops secondary metadata
  into a sub-line.
- **sm (<768):** Single column throughout. Report-type radio-group becomes a
  stacked list (not a tight segmented control). Parameter fields full-width,
  ≥44px touch targets. The quick-pick DataTable collapses to **stacked
  SubmissionCard-style rows** (title + meta + "Use" Button), per Foundation §6
  (table → stacked cards on narrow). The result strip pins above the builder
  after generation so the download is reachable without scrolling.

---

## 4. Components used (Foundation §5 only)

**Containers / layout:** `AppShell`, `Card` (Builder Panel + result strip,
radius `lg`, elevation `e1`), `Section`, `Tabs` (quick-pick Reportable exams /
Classes), `Panel`.

**Form primitives:** `Radio` group (report type — 3 mutually-exclusive options;
the segmented look is the Radio group's horizontal variant, not a new
component), `Combobox` (exam picker, student picker — searchable because a
tenant can have many), `Select` (academic session, format), `Button` (primary
"Generate report"; ghost "Open", "Regenerate"; the download itself is a `Button`
driving an anchor — see note).

**Feedback:** `Toast` (sonner) for success / error, `InlineAlert`/`Banner` for
partial and feature-gated states, `FormFieldError` for missing required params,
`LoadingOverlay` (or inline spinner on the Generate button) during the report
job, `Skeleton` for the picker-loading state.

**Data:** `DataTable` (the quick-pick "Reportable exams" / "Classes" lists —
owns search/sort/paginate per the rebuild's shared DataTable, app-admin-web rec
B4), `Badge` (status of each exam: `grading` / `completed` / `results_released`,
always icon + label, §9), `EmptyState` (no reportable exams / no classes),
`DefinitionList` (result strip metadata: type, scope, target, expiry).

**Navigation:** `Sidebar`, `Topbar`, `CommandPalette` (⌘K, web-only),
`Breadcrumb` (Analytics ▸ Reports).

**Domain components:** `GradePill` may appear inside the quick-pick row meta
where a class/exam already has a released aggregate, but the **answer key is
never shown** here (§8). No student-facing gamification components on this admin
screen.

**Proposed foundation note — download/anchor button:** the live code uses a
bespoke `DownloadPDFButton` that owns the generate-then-download dance.
Foundation §5 has `Button` but no "async-action-returning-a-URL" variant. **This
is not a new visual component** — it is `Button` (primary) with a loading state
composed with the anchor that opens `pdfUrl`. No new token/variant required;
flag only that the spec reuses `Button` + an internal hook rather than the
legacy `DownloadPDFButton`.

**Proposed foundation note — export format:** the backend renders **PDF only**
(`pdfkit`, be-analytics §1). The "Export format" control is therefore a `Select`
with a single enabled option (`PDF`) and any future format (CSV/XLSX) shown
disabled with a tooltip. **No new component**; if CSV export of underlying data
is wanted, that is the separate `/data-export` screen (`callExportTenantData`),
not this one — keep them distinct.

---

## 5. States — loading / empty / error / partial / success (permission-gated by role)

**Permission gate (before any state):** if the caller is not `tenantAdmin` (or a
`staff` user without the relevant permission, §8), the route never mounts —
`RequireAuth` renders Access-Denied. The states below assume an authorized
admin.

- **Loading (pickers).** On mount, the report-type Radio group is immediately
  interactive; the parameter `Combobox`es show `Skeleton` rows while `listExams`
  / class list resolve. The Generate button is `disabled` until required params
  for the chosen type are present.
- **Empty.**
  - _No reportable exams_ (exam-result type, list empty): `EmptyState` — title
    "No exams ready to report", body "Reports become available once an exam
    reaches grading, completion, or released results." The exam-result type
    stays selectable but Generate is disabled with a helper line.
  - _No classes_ (class type): `EmptyState` — "No classes yet", body "Create a
    class to generate class report cards."
  - _No students in the chosen class_ (progress type): inline empty inside the
    student `Combobox` — "No students in this class."
- **Error.** Surfaced from the typed error envelope `error.details.code`
  (common-API §6.3) via `useApiError`:
  - `VALIDATION_ERROR` (missing required param the client should have caught) →
    `FormFieldError` on the offending field, no toast.
  - `NOT_FOUND` (exam/class/student/submission missing or `Data integrity error`
    from server Zod re-validation, be-analytics §3) → `InlineAlert` (error) in
    the result strip: "This report could not be built — some underlying records
    are missing or invalid."
  - `RATE_LIMITED` (the `'report',5` limiter tripped, be-analytics §1) → `Toast`
    (warning): "You're generating reports quickly — please wait a moment and try
    again." Generate button enters a short cooldown.
  - `FEATURE_DISABLED` (tenant `analytics` feature flag off) → see partial
    below.
  - `PERMISSION_DENIED` / `TENANT_SUSPENDED` → `InlineAlert` (error), generate
    disabled.
- **Partial.**
  - _Analytics feature flag off_ (`tenant.features.analytics === false`): the
    whole builder renders **disabled** under a `Banner` (info): "Reporting is
    part of the Analytics feature, which is not enabled for this academy.
    Contact your administrator." (Drives off `tenant.features`, app-admin-web
    rec E9.)
  - _`expiresAt` not yet returned by the backend_ (until the §2 contract
    addition ships): the result strip shows "Link valid for about 1 hour" rather
    than an exact time, and a "Regenerate" affordance is always offered.
- **Success.** The result strip animates in (entrance, §6) with
  `✓ Report ready`, a `DefinitionList` of type / scope / target / expiry, and
  `Download PDF` (primary) + `Open` (ghost) + `Regenerate` (ghost). A `Toast`
  confirms "Report generated." The builder remains populated so the admin can
  tweak one param and regenerate.

---

## 6. Interactions & motion (Foundation §4 motion tokens)

- **Type switch.** Selecting a report-type Radio swaps the parameter region.
  Fields cross-fade with **fast 160ms / ease.standard**; height settles with
  **base 220ms**. The previously-entered params for an unrelated type are
  discarded (cleared), so no stale `examId` rides along on a `class` request.
- **Scope toggle (exam-result).** Choosing "One student" reveals the student
  `Combobox` with an entrance slide (**base 220ms / ease.entrance**); choosing
  "Whole class" collapses it and clears `studentId`. The request maps exactly to
  the callable contract (presence of `studentId` discriminates individual vs
  class-summary, §2).
- **Generate (the action — NOT optimistic).** Report generation is a real server
  job (PDF render + upload); there is **nothing to optimistically show**. On
  click: Generate button enters loading (spinner + label "Generating…",
  disabled), other controls lock. Because a typical render is
  sub-second-to-a-few-seconds, a `LoadingOverlay` on the Builder Panel is used
  only if the request exceeds ~600ms (to avoid a flash). On resolve, the button
  restores and the result strip enters with **slow 320ms / ease.entrance**. This
  is admin chrome — **no marigold/spark celebration**; the one celebratory
  moment in Lyceum is reserved for student gamification (Foundation §4).
- **Download.** "Download PDF" opens `pdfUrl` (signed URL) in a way that
  triggers a browser download; "Open" opens it in a new tab. No confirmation
  dialog (non-destructive).
- **Regenerate after expiry.** If the user clicks Download after `expiresAt`,
  the client treats the link as stale, re-invokes `generateReport` with the same
  params, and then downloads — surfaced as a brief "Refreshing link…" on the
  Download button. A `Toast` confirms the refreshed link.
- **Confirmation.** None required — generating a report is non-destructive and
  idempotent. (Contrast with `/data-export`, which may warn about PII scope.)
- **Quick-pick "Use".** Clicking "Use" on a DataTable row sets the type + params
  in the builder and scrolls/focuses it; it **does not auto-generate** (the
  admin still confirms scope/session). Feedback: the builder Card flashes a
  subtle border.focus pulse (**instant 100ms**).
- **Reduced motion.** With `prefers-reduced-motion`, all cross-fades/slides
  become instant opacity swaps; the result strip appears without translate. No
  motion encodes meaning (§9).

---

## 7. Content & copy (precise admin tone)

- **H1:** "Reports"
- **Subhead:** "Generate and download PDF reports for this academy."
- **Report type labels:** "Exam result", "Class report card", "Student
  progress".
  - Helper under each (one line): Exam result — "Per-exam results, for the whole
    class or one student." Class report card — "A class-level summary card."
    Student progress — "A learner's cross-space progress over time."
- **Parameter labels:** "Exam", "Scope" ("Whole class" / "One student"),
  "Student", "Academic session (optional)", "Export format".
- **Primary action:** "Generate report" → while running: "Generating…".
- **Result strip:** heading "Report ready"; metadata via `DefinitionList` —
  "Type", "Scope", "Subject of report", "Link valid until {time}". Actions:
  "Download PDF", "Open", "Regenerate".
- **Empty states:**
  - Exams: title "No exams ready to report" · body "Reports become available
    once an exam reaches grading, completion, or released results."
  - Classes: title "No classes yet" · body "Create a class to generate class
    report cards."
- **Error copy (mapped from `ERROR_MESSAGES`, common-API §6):**
  - Integrity / not-found: "This report couldn't be built — some underlying
    records are missing or invalid. Try a different exam, or contact support if
    this persists."
  - Rate limited: "You're generating reports quickly. Please wait a moment and
    try again."
  - Feature disabled: "Reporting is part of the Analytics feature, which isn't
    enabled for this academy."
  - Generic: "Something went wrong generating this report. Please try again."
- **Tone:** declarative, no exclamation marks, no student-register playfulness.
  Always name _what_ and _what next_.

---

## 8. Domain rules surfaced

- **Tenant isolation (hard rule).** Reports are generated for **the caller's
  active tenant only**. `tenantId` is derived server-side from
  `ctx.activeTenantId` (claims), **never** from the request body (common-API
  §4.4), and PDFs are written to `tenants/{tenantId}/reports/…` (be-analytics
  §1). A tenantAdmin can never target another tenant's exam/class/student; there
  is **no** `tenantOverride` affordance on this admin screen (that is a
  super-admin-only, audited capability and does not appear here).
- **RBAC.** Route is `tenantAdmin`-gated. For `staff` users,
  visibility/enablement is driven by `StaffPermissions` (app-admin-web rec E9) —
  a staff member without reporting/analytics permission does not see the Reports
  nav entry and is denied the route. `superAdmin` may reach it via tenant
  impersonation but is operating _as_ that tenant.
- **Server-authoritative values.** Everything in the PDF (marks, grades,
  summaries, class aggregates) is computed and re-validated **server-side with
  Zod** at the boundary (be-analytics §3 — callables `safeParse` every doc and
  throw `Data integrity error` on drift). The client never assembles report
  content; it only chooses parameters.
- **Answer keys & PII.** Reports must **never** embed answer keys (Foundation
  domain rule; `AnswerKeyLock`). The exam-result PDF shows scored outcomes, not
  the canonical answer key. Student-progress and class reports are
  staff/parent-facing artifacts; treat the resulting signed URL as sensitive.
- **Quota / cost & rate budgets.** `generateReport` is `rateTier: 'report'`
  (5/window per the limiter, be-analytics §1); the UI must respect
  `RATE_LIMITED` with a cooldown rather than hammering. Report generation is
  **not** an LLM cost driver (no model call), so it does not consume the AI
  budget surfaced on `/ai-usage`.
- **Signed-URL lifecycle.** `pdfUrl` is a **1-hour** signed Cloud Storage URL
  (be-analytics §1). The UI surfaces expiry (`expiresAt`, §2 proposed addition)
  and regenerates rather than serving a dead link. Links are not bookmarked as
  permanent.
- **Audit.** Report generation is an auditable admin action (who generated which
  report, for which subject, when). The screen assumes server-side audit logging
  on `generateReport`; the UI itself records nothing client-side.
- **Feature gating.** Reporting is gated by `tenant.features.analytics`; when
  off, the builder is disabled with the Banner copy in §5/§7.

---

## 9. Accessibility (WCAG AA)

- **Focus order:** H1 → report-type Radio group (arrow-key navigable, single tab
  stop) → first parameter field → subsequent params in DOM order → Export format
  → Generate button → (after success) result strip: Download → Open → Regenerate
  → quick-pick Tabs → DataTable. Focus moves to the **result strip heading** on
  successful generation so screen-reader users learn the report is ready; an
  `aria-live="polite"` region announces "Report ready. Download available."
- **Keyboard:** Radio group via arrow keys + Space; `Combobox` fully
  keyboard-operable (type-ahead, Up/Down, Enter, Esc) with
  `aria-expanded`/`aria-activedescendant`; Generate reachable and activatable
  via Enter/Space; the download anchor is a real focusable control. ⌘K opens
  CommandPalette (web only).
- **ARIA:** report-type group has `role="radiogroup"` +
  `aria-label="Report type"`; each parameter field has a programmatic `<label>`
  and `aria-describedby` pointing at its helper line; required fields use
  `aria-required`; validation errors use `aria-invalid` + `FormFieldError`
  linked by `aria-describedby`. The Generating state sets `aria-busy` on the
  Builder Panel. The result strip is an `aria-live` region.
- **Status never by color alone (Foundation §2.2):** exam `Badge`es and the
  success/error strip pair **icon + text label** with the color (e.g. ✓ "Report
  ready" in `status.success`; ⚠ "Couldn't generate" in `status.error`). Color is
  reinforcement, never the sole signal.
- **Contrast:** all text/background and UI pairs meet WCAG AA (4.5:1 body, 3:1
  large/UI) using semantic tokens (`text.primary` on `bg.surface`,
  `text.secondary` for helper lines, `brand.primary` for the primary Button,
  focus ring `border.focus`). Disabled controls keep a perceptible, AA-compliant
  disabled treatment plus the explanatory Banner so "why is this off" is never
  color/dimming alone.
- **Reduced motion:** honor `prefers-reduced-motion` (§6) — instant opacity
  swaps, no translate, no spinner-implied meaning beyond the textual
  "Generating…".
- **Targets:** ≥44px touch targets on sm; the segmented Radio is not compressed
  below that on narrow widths.

---

## 10. Web ↔ mobile divergence

Admin-web is **web-first**; there is no React-Native admin app. This screen is
therefore **web-only** by default, but the spec respects Foundation §6 parity so
it could be ported:

- **⌘K CommandPalette is web-only** (Foundation §5). No mobile equivalent.
- **Quick-pick lists:** DataTable on web → **stacked cards** on a narrow/mobile
  viewport (Foundation §6), each with a "Use" Button; hover affordances become
  press.
- **Builder layout:** the 12-col parameter grid (web) collapses to a single
  stacked column on mobile; the segmented report-type control becomes a stacked
  Radio list.
- **Download behaviour:** on web, "Download PDF" triggers a browser download and
  "Open" a new tab. On a hypothetical RN port, both resolve to the platform
  share/open sheet for the signed URL (the callable contract is identical; only
  the consume-the-URL step differs).
- **Tenant switcher / Topbar** live in `AppShell`; on mobile they move to the
  `Tabbar` + a tenant `RoleSwitcher` (Foundation §5), but the Reports content
  region is unchanged in structure.

---

## 11. Claude-design prompt (ready to paste)

> Design the **Reports** screen for the Auto-LevelUp **admin-web** app
> (tenantAdmin, route `/reports`), strictly conforming to the **Lyceum** design
> foundation in `docs/rebuild-spec/design/00-FOUNDATION.md`. Use the **precise /
> credible admin register** (restraint in chrome — NOT the playful student
> spark). Compose **only** from the Foundation §5 component inventory and cite
> semantic tokens by name (`bg.surface`, `text.primary`, `text.secondary`,
> `brand.primary`, `border.focus`, `status.success`, `status.error`,
> `status.warning`) — never invent colors, fonts, spacing, radii, shadows,
> motion, or new component variants.
>
> Build a **report builder** inside the admin `AppShell` content region: an H1
> "Reports" + subhead, then a single `Card` (radius `lg`, elevation `e1`)
> containing (a) a **report-type Radio group** with three options — "Exam
> result", "Class report card", "Student progress"; (b) a **parameters** region
> whose fields swap by type — exam-result: an exam `Combobox` + a "Whole class /
> One student" scope Radio that conditionally reveals a student `Combobox`;
> class: a class `Combobox`; progress: a class-scoped student `Combobox`; plus
> an optional "Academic session" `Select` and a single-option "Export format =
> PDF" `Select`; (c) a primary `Button` "Generate report". Below the builder, a
> **result strip** `Card` that appears after generation with a `DefinitionList`
> (type / scope / subject / "Link valid until …") and `Button`s "Download PDF"
> (primary), "Open" (ghost), "Regenerate" (ghost). Below that, `Tabs`
> ("Reportable exams" / "Classes") wrapping a `DataTable` whose rows have a
> "Use" button that pre-fills the builder (never auto-generates).
>
> Wire it to `v1.analytics.generateReport`
> (`type: 'exam-result' | 'progress' | 'class'`, request omits `tenantId` —
> server derives it from claims; presence of `studentId` discriminates
> individual vs class-summary; response `{ pdfUrl, expiresAt }`, a 1-hour signed
> URL). Populate pickers from read callables (`v1.autograde.listExams`,
> class/student reads). NO Firestore in the UI. Generation is a real server job
> — **not optimistic**: loading state on the Generate button, `LoadingOverlay`
> only past ~600ms, result strip enters at **slow 320ms / ease.entrance**, and
> **no marigold/spark celebration** (admin chrome).
>
> Cover all states: loading skeletons on pickers; empty ("No exams ready to
> report" / "No classes yet"); errors mapped from the typed envelope
> (`VALIDATION_ERROR` → `FormFieldError`; `NOT_FOUND`/integrity → `InlineAlert`;
> `RATE_LIMITED` → warning `Toast` + cooldown; `FEATURE_DISABLED` → disabled
> builder under an info `Banner`); success → `Toast` + result strip. Enforce
> **tenant isolation** (no `tenantOverride` here), RBAC
> (`tenantAdmin`/`StaffPermissions` gate), the `'report'` rate tier,
> server-authoritative report content, and the rule that **answer keys never
> appear**. Accessibility: `role="radiogroup"`, labelled/`aria-describedby`
> fields, `aria-live` result strip with focus moved to it on success, status by
> icon+label (never color alone), WCAG AA contrast, and `prefers-reduced-motion`
> honored. Responsive per Foundation §4: 12-col params at lg, stacked single
> column at sm, DataTable → stacked cards on narrow. ⌘K is web-only.
