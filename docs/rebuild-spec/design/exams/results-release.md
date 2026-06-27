# Results Release

_The deliberate, gated flow where a teacher makes graded exam submissions
visible to students and parents — per-submission or in bulk — with a pre-release
checklist, an explicit "what students will and won't see" preview, and
irreversible-feeling confirmation that fans out notifications._

---

## 1. Purpose & primary user

**Primary user:** Teacher (role `teacher`) — secondarily a tenant Admin acting
on a teacher's behalf. Both must hold the `canReleaseResults` permission within
the active tenant.

**Job-to-be-done:** _"I've graded and reviewed this exam's submissions. Now I
want to push results to my students and their parents — confidently, in one
controlled action — without accidentally releasing answers that are still
pending human review, and without ever exposing the answer key, model answers,
or AI confidence/cost internals to students."_

This screen is the **trust boundary** between staff-only grading workspace and
student/parent-visible results. It exists to make release _intentional,
auditable, and reversible-enough_ (per-submission state, timestamps, actor)
while warning loudly when the data isn't ready.

---

## 2. Entry points & route

**Route:** `/exams/:examId` — the release flow lives on the Exam Detail page as
a primary status action and an inline panel on the **Submissions** tab. The
full-screen confirmation surfaces as a `Modal/Dialog` over that route. A
deep-linked variant `/exams/:examId/submissions?release=1` opens the panel
directly.

**Entry points:**

- Exam Detail **status action bar** → primary `Button` "Release results"
  (visible when `Exam.status` ∈ {`grading`, `completed`} and at least one
  submission is `reviewed` / `grading_complete` and unreleased).
- **Submissions** tab → per-row `IconButton`/menu "Release" on a
  `SubmissionCard` / `DataTable` row.
- **Submissions** tab → bulk action bar after row selection → "Release
  selected".
- Exam **Settings** tab → `gradingConfig.releaseResultsAutomatically` `Switch`
  (auto-release future submissions as they reach `reviewed`).

**Common-API reads/writes:**

- `exams.get(examId)` (live) — `Exam.status`, `gradingConfig`, `stats`.
- `submissions.listLive(examId)` — drives the checklist counts and the release
  table: `pipelineStatus`, `resultsReleased`, `resultsReleasedAt/By`, `summary`.
- `examAnalytics.get(examId)` — optional, to show `gradedSubmissions` /
  `totalSubmissions` and `passRate` in the release summary.
- **Write — bulk / exam-level:**
  `saveExam({ examId, status: 'results_released', gradingConfig: { releaseResultsAutomatically } })`
  — server-enforced status machine; transitions exam to `results_released` and
  stamps eligible submissions.
- **Write — per-submission:** `saveExam` (or the dedicated release path) sets
  `Submission.resultsReleased = true`, `resultsReleasedAt`,
  `resultsReleasedBy = uid`. Server is authoritative; client performs an
  optimistic UI flip then reconciles from the live read.
- **Side effect (server):** `onResultsReleased` trigger fans out notifications
  to students, parents, and the releasing teacher. Client does NOT send these.

All reads/writes are **tenant-scoped**; `examId` is resolved within the active
tenant only.

---

## 3. Layout — wireframe-as-text

Rendered inside **AppShell** (Sidebar + Topbar). Breadcrumb:
`Exams / {Exam.title} / Release`.

### lg (≥1024) — Exam Detail, Submissions tab with Release panel open

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Topbar: tenant switcher · search · notifications · profile                      │
├──────────┬───────────────────────────────────────────────────────────────────┤
│          │ Breadcrumb: Exams / Midterm — Algebra II / Release                  │
│ Sidebar  │ ┌─────────────────────────────────────────────────────────────┐   │
│ (nav)    │ │ H1  Midterm — Algebra II        [StatusBadge: Grading]       │   │
│          │ │ subj · 40 marks · 14 Mar      [Release results ▸ primary btn]│   │
│          │ ├─────────────────────────────────────────────────────────────┤   │
│          │ │ Tabs:  Questions │ ‹Submissions› │ Settings                  │   │
│          │ └─────────────────────────────────────────────────────────────┘   │
│          │ ┌──────────────────────────┐ ┌──────────────────────────────────┐ │
│          │ │ RELEASE PANEL (right Sheet│ │ Submissions DataTable            │ │
│          │ │  or inline Panel, 360–420)│ │ ☐ Student   Roll  Status  Score  │ │
│          │ │                          │ │ ☑ Asha P.   12    Reviewed 34/40 │ │
│          │ │ Pre-release checklist     │ │ ☑ Ravi K.   07    Reviewed 28/40 │ │
│          │ │  ✓ 18 reviewed & ready    │ │ ☐ Mira S.   19    Needs review — │ │
│          │ │  ⚠ 3 need review (excl.)  │ │ ☐ Dev T.    04    Grading… —     │ │
│          │ │  ⚠ 2 ungraded (excl.)     │ │ ☑ ...                            │ │
│          │ │  ◔ 1 already released      │ │           [Pagination]           │ │
│          │ │                          │ └──────────────────────────────────┘ │
│          │ │ What students WILL see:    │  Bulk bar: 16 selected              │
│          │ │  • score / grade / %      │  [Release selected ▸]               │
│          │ │  • rubric feedback (text) │                                     │
│          │ │ Won't see (AnswerKeyLock):│                                     │
│          │ │  🔒 model answer          │                                     │
│          │ │  🔒 AI confidence / cost  │                                     │
│          │ │                          │                                     │
│          │ │ Switch: Auto-release new  │                                     │
│          │ │ [ Release 16 results ▸ ]  │                                     │
│          │ └──────────────────────────┘                                     │
└──────────┴───────────────────────────────────────────────────────────────────┘
```

**ConfirmDialog (Modal/Dialog, e3 elevation, centered, max 560):**

```
┌────────────────────────────────────────────────────┐
│  Release results to 16 students?                    │  ← Fraunces h3
│                                                     │
│  Students and their parents will be notified and    │
│  can view their score, grade, and written feedback. │
│                                                     │
│  ⚠ 3 submissions still need review and 2 are        │
│    ungraded — these will NOT be released.           │  ← InlineAlert warning
│                                                     │
│  🔒 Model answers, AI confidence, and cost stay     │
│     staff-only.                                     │
│                                                     │
│        [ Cancel ]   [ Release 16 results ▸ ]        │  ← danger-tinted primary
└────────────────────────────────────────────────────┘
```

### md (768–1023)

Release panel becomes a **Drawer/Sheet** from the right (full height, width
~420). DataTable keeps core columns (Student, Status, Score, select); Roll
number collapses into the Student cell. Checklist sits at the top of the sheet,
scrolls with content.

### sm (<768)

- DataTable → stacked **SubmissionCard** list, each with a checkbox,
  `StatusBadge`, `GradePill`/score, and a per-card "Release" affordance.
- Release panel → full-screen **Sheet** (slides up). Checklist first, then the
  WILL/WON'T preview as an `Accordion`, then a sticky bottom bar with the
  primary release `Button`.
- Bulk bar pins to the bottom above the Tabbar.

---

## 4. Components used (Lyceum inventory)

- **AppShell**, **Sidebar**, **Topbar**, **Breadcrumb**, **Tabs**
  (Questions/Submissions/Settings).
- **Panel** / **Drawer/Sheet** — the release panel (inline on lg, sheet on
  md/sm).
- **DataTable** (sort/filter/paginate/**select**) — submissions list with
  checkbox selection; **Pagination**.
- **SubmissionCard** (domain) — mobile/stacked variant and the per-row entity.
- **DefinitionList** — the WILL-see / WON'T-see preview pairs.
- **AnswerKeyLock** (domain) — the server-only-guard visual on every WON'T-see
  item (model answer, confidence, cost).
- **Badge** + **StatusBadge** pattern — release state (`Released` /
  `Not released` / `Auto`), pipeline status; **GradePill** (domain) and
  **ConfidenceBadge** referenced for the staff-side context (never in the
  student-preview block).
- **InlineAlert/Banner** — pre-release checklist warnings (needs-review /
  ungraded exclusions).
- **Checkbox** — row + "select all" selection.
- **Switch** — `gradingConfig.releaseResultsAutomatically`.
- **Button** (primary for release; **danger**-tinted inside the ConfirmDialog to
  signal gravity; secondary for Cancel), **IconButton** (per-row release/menu).
- **Modal/Dialog** + **ConfirmDialog** — the release confirmation.
- **Stat/KPI** — "18 ready · 3 need review · 2 ungraded" summary trio.
- **Toast (sonner)** — success/error after release; **LoadingOverlay** on the
  panel during the write.
- **Skeleton** — loading rows and checklist; **EmptyState** — nothing to
  release.
- **Tooltip** — explains why a row is disabled ("Still needs review — can't
  release").

**Proposed addition (justified):** `ReleasePreviewList` — a thin composition
(not a new primitive) of `DefinitionList` + `AnswerKeyLock` rows specialized to
"what students see vs. what stays staff-only." It introduces no new tokens; it
standardizes this WILL/WON'T pattern so it can be reused on
`/exams/:examId/submissions/:submissionId`. Composed entirely from existing
components.

---

## 5. States

**Loading:** Release panel shows `Skeleton` for the checklist counts (three KPI
placeholders) and 5–6 skeleton table rows. Primary "Release results" button is
disabled with a subtle pulse until `submissions.listLive` resolves.

**Empty (nothing releasable):** `EmptyState` (Fraunces title) — _"No results
ready to release."_ Body explains submissions must reach **Reviewed** (or
grading-complete) before they can be released; CTA "Go to grading". Shown when
zero submissions are `reviewed`/`grading_complete` AND unreleased.

**Empty (all already released):** Distinct `EmptyState` — _"All results are
released."_ Shows count + last released timestamp/actor; the primary action
degrades to a `Badge` "Released" and a secondary "View released results".
`Exam.status` is `results_released`.

**Partial (the common, important case):** Some submissions ready, some pending.
Checklist surfaces:

- ✓ `N reviewed & ready` (will release)
- ⚠ `M need review` (excluded — `pipelineStatus` ∈ {`needs_review`,
  `manual_review_needed`, `grading_partial`})
- ⚠ `K ungraded` (excluded — {`uploaded`, `scouting`, `scouting_complete`,
  `grading`})
- ◔ `J already released` Release proceeds on the ready set only; excluded rows
  are visibly tagged and **non-selectable** (Checkbox disabled + Tooltip
  reason).

**Error:** Write failure (server rejects status transition, permission lost
mid-flight, network) → `Toast` error + `InlineAlert` in the panel: _"Couldn't
release results. No students were notified. Try again."_ Optimistic row flips
revert from the live read. Per-row partial failure in a bulk release → success
Toast names the count released and an `InlineAlert` lists the rows that failed
with a "Retry failed" action.

**Success:** Optimistic per-row `Released` badge flip → reconciled by live read
→ success `Toast` _"Results released to {N} students. Parents notified."_ If
exam-level, `StatusBadge` flips to `Results released`. Auto-release `Switch` ON
shows a persistent helper line.

**Permission / role-gated variations:**

- **No `canReleaseResults`:** All release controls render **disabled** with a
  Tooltip _"You don't have permission to release results."_ The checklist is
  still readable (transparency), the WILL/WON'T preview is visible, but no write
  affordance. No optimistic state.
- **Admin acting cross-class:** Same controls; bulk selection may span sections
  the admin owns within the tenant. Out-of-tenant exam IDs never resolve.
- **Auto-release already ON:** Bulk button copy shifts to _"Release current
  backlog"_; future-submission language clarifies new arrivals release
  automatically once `reviewed`.

---

## 6. Interactions & motion

**Open panel:** Sheet/Drawer enters with `ease.entrance` at `base` (220ms); on
lg the inline Panel cross-fades at `fast` (160ms). Respects
`prefers-reduced-motion` (opacity-only, no translate).

**Row selection:** Checkbox toggles update the bulk bar count instantly
(`instant` 100ms). "Select all" selects only **eligible** (ready, unreleased)
rows — disabled rows never enter the selection set. Bulk bar slides up with
`ease.standard`.

**Primary release click → ConfirmDialog:** Modal enters at `base` with backdrop
fade; focus moves to the dialog. This is the **deliberate friction point** —
required because release is student-visible and fans out notifications.

**Confirm → write:**

1. Optimistic: selected rows flip to `Released` badge immediately; panel shows a
   `LoadingOverlay` (subtle, `e2` popover-level), the primary button enters
   loading state.
2. `saveExam` resolves → live read reconciles; on success the `Toast` celebrates
   the count. There is **no marigold celebration burst** here — release is staff
   gravity, not gamification; motion stays subtle per foundation.
3. On failure, rows revert (`ease.exit`), `InlineAlert` appears.

**Auto-release Switch:** Toggling writes
`gradingConfig.releaseResultsAutomatically` via `saveExam` immediately
(optimistic), `Toast` confirms. Turning it ON when a backlog exists prompts an
inline question: _"Release the {K} ready now as well?"_ with an inline secondary
action.

**Per-row release:** IconButton → compact `ConfirmDialog` ("Release Asha P.'s
result?") → optimistic flip. Single releases skip the multi-count summary but
keep the WON'T-see lock reminder.

**Keyboard:** `⌘K` palette offers "Release results for this exam". In the
dialog, `Enter` confirms only when focus is on the primary; `Esc` cancels.

---

## 7. Content & copy (precise, staff tone)

**Headings:**

- Panel: `Release results` (Schibsted h4).
- Checklist section: `Pre-release checklist`.
- Preview: `What students will see` / `What stays staff-only`.
- ConfirmDialog: `Release results to {N} students?` (Fraunces h3).

**Checklist lines:**

- `{N} reviewed & ready to release`
- `{M} still need review — won't be released`
- `{K} ungraded — won't be released`
- `{J} already released`

**Preview — WILL see (DefinitionList):**

- `Score & grade` — "Their total, percentage, and letter grade."
- `Written feedback` — "Rubric feedback, strengths, and what to fix."
- `Pass / fail` — "Against this exam's passing marks."

**Preview — WON'T see (AnswerKeyLock rows):**

- 🔒 `Model answer` — "The answer key is never shown to students."
- 🔒 `AI confidence` — "Grading confidence stays staff-only."
- 🔒 `AI cost & tokens` — "Internal grading metrics are hidden."

**Switch label:** `Auto-release new results` — helper: "New submissions release
automatically once they're reviewed."

**Primary buttons:** `Release {N} results ▸` (bulk) · `Release results ▸`
(single/exam) · Cancel.

**Empty:** _"No results ready to release."_ / _"All results are released."_

**Error:** _"Couldn't release results. No students were notified. Try again."_
(reassurance that nothing leaked is intentional and load-bearing.)

**Success Toast:** _"Results released to {N} students. Parents notified."_

**Tone:** factual, reassuring on safety ("no students were notified"), never
playful. No exclamation marks except the celebratory-but-restrained success.

---

## 8. Domain rules surfaced

- **Answer key never shown to students.** The WON'T-see block makes this
  explicit and repeats it in the ConfirmDialog. `modelAnswer` /
  `UnifiedRubric.modelAnswer` / `showModelAnswer` are staff-only;
  `AnswerKeyLock` is the visual contract.
- **AI internals hidden from students:** `UnifiedEvaluationResult.confidence`,
  `tokensUsed`, `costUsd`, `mistakeClassification` (raw) never cross the
  boundary. `ConfidenceBadge` appears only on staff-side rows, never in the
  preview.
- **Confidence routing gates readiness:** submissions in `needs_review` /
  `manual_review_needed` (driven by `confidence < confidenceThreshold` 0.7, or
  service-error degradation) are **excluded** and surfaced as warnings — the UI
  actively discourages releasing pending-review work.
- **Server-authoritative status machine:** release is a `saveExam` transition
  (`results_released`) and per-submission `resultsReleased` stamp; the client
  only requests it. `POST_PUBLISH_LOCKED_FIELDS` are not editable here. The live
  read is the source of truth; optimistic UI always reconciles.
- **Explicit release before visibility:** students/parents cannot read results
  until `resultsReleased` (or `releaseResultsAutomatically`) is true — this
  screen is the only gate.
- **Audit & "reversible-enough":** `resultsReleasedAt` / `resultsReleasedBy` are
  stamped; `manualOverride.originalScore` is preserved upstream so released
  scores remain auditable (OverrideTimeline elsewhere).
- **Notifications are a server side-effect:** `onResultsReleased` fans out to
  students/parents/teacher; the client must not claim notification success until
  the write resolves.
- **Tenant isolation:** every read/write is tenant-scoped; cross-tenant exam IDs
  never resolve.
- **Permission gating:** `canReleaseResults` gates all write affordances;
  absence renders read-only.

---

## 9. Accessibility

- **Focus order:** Breadcrumb → Tabs → checklist (read-only, focusable for SR) →
  preview list → auto-release Switch → table (select-all → rows) → bulk bar →
  primary Release. ConfirmDialog **traps focus**, lands on the dialog heading,
  returns focus to the trigger on close.
- **Keyboard:** all controls reachable; Checkbox space-toggles; Switch
  space/enter; DataTable arrow-key cell nav; `Esc` closes Sheet/Dialog; `Enter`
  confirms only from the primary button.
- **ARIA:** ConfirmDialog `role="alertdialog"` `aria-describedby` the
  consequence text + warning. Checklist warnings use `InlineAlert` with
  `role="status"` (not assertive — they're not interrupting). Release success
  `Toast` announced via `aria-live="polite"`. Disabled rows expose
  `aria-disabled` + Tooltip reason via `aria-describedby`.
- **Status never by color alone:** every state pairs **icon + label** —
  `Released` badge has a lock/check glyph + text; warnings carry ⚠ + text; lock
  rows carry 🔒 + "staff-only". Confidence/grade colors
  (confidence.low/med/high, grade.A–F) always accompany a label.
- **Contrast:** all pairs meet WCAG AA per foundation; the danger-tinted confirm
  button keeps `text.on-accent` contrast ≥4.5:1.
- **Reduced motion:** `prefers-reduced-motion` removes slide/translate
  (opacity-only); no LoadingOverlay shimmer, static spinner instead.

---

## 10. Web ↔ mobile divergence

| Aspect             | teacher-web (today)                             | Future RN / scanner-web                                                                                     |
| ------------------ | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Submissions list   | `DataTable` with multi-select, sort, pagination | Stacked `SubmissionCard` list, swipe/long-press to select                                                   |
| Release panel      | Inline `Panel` (lg) / `Drawer` (md)             | Full-screen bottom `Sheet`, sticky release bar                                                              |
| WILL/WON'T preview | `DefinitionList` two-column                     | `Accordion` collapsed sections                                                                              |
| Confirm            | centered `Modal/Dialog`                         | bottom-sheet `ConfirmDialog`                                                                                |
| Hover affordances  | hover tooltips on disabled rows                 | press-and-hold reveals reason                                                                               |
| Command palette    | `⌘K` "Release results"                          | none (no CommandPalette on mobile)                                                                          |
| Bulk bar           | floats above content                            | pinned above Tabbar                                                                                         |
| scanner-web        | n/a                                             | scanner role uploads (`uploadSource: 'scanner'`) but **cannot** release — read-only, no `canReleaseResults` |

Component **names/props match 1:1** across `shared-ui` and `ui-native`; only the
renderer differs.

---

## 11. Claude-design prompt (ready to paste)

```
Design the "Results Release" screen for Auto-LevelUp's teacher-web app, conforming EXACTLY to
the Lyceum design system (docs/rebuild-spec/design/00-FOUNDATION.md — "Modern Scholarly"). Do
not invent tokens, fonts, or component variants; compose only from the Lyceum inventory and cite
tokens by name (e.g. brand.primary, status.warning, confidence.low, e3, ease.entrance).

CONTEXT: This is the release-results flow on /exams/:examId (Submissions tab). A teacher with the
canReleaseResults permission makes graded submissions visible to students and parents, per-submission
or in bulk. Only submissions that are Reviewed / grading_complete AND not yet released are eligible.
Releasing calls the saveExam callable (status → results_released, per-submission resultsReleased +
resultsReleasedAt/By), which server-side fans out onResultsReleased notifications. Everything is
tenant-scoped and server-authoritative; the client uses optimistic UI reconciled from a live read.

BUILD inside AppShell (Sidebar + Topbar + Breadcrumb "Exams / {title} / Release"), with Tabs
(Questions / Submissions / Settings). On the Submissions tab show a DataTable of submissions
(Checkbox select, Roll, StatusBadge for pipelineStatus, score/GradePill, release-state Badge) plus
a Release Panel (inline on lg, Drawer on md, full-screen Sheet on sm) containing:
  1. A Pre-release checklist (Stat/KPI trio + InlineAlert warnings): "{N} reviewed & ready",
     "{M} still need review — won't be released", "{K} ungraded — won't be released",
     "{J} already released". Excluded rows are non-selectable with a Tooltip reason.
  2. A WILL-see / WON'T-see preview: DefinitionList for what students see (score, grade, written
     feedback) and AnswerKeyLock rows for what stays staff-only (🔒 model answer, 🔒 AI confidence,
     🔒 AI cost/tokens). NEVER show ConfidenceBadge/cost in the student-preview block.
  3. A Switch: "Auto-release new results" (gradingConfig.releaseResultsAutomatically).
  4. A primary Button "Release {N} results ▸".

The primary action opens a ConfirmDialog (role="alertdialog", e3, danger-tinted primary): heading
"Release results to {N} students?", consequence copy "Students and their parents will be notified
and can view their score, grade, and written feedback.", a warning InlineAlert repeating the
excluded counts, and a 🔒 reminder that model answers / confidence / cost stay staff-only.

STATES: loading (Skeleton checklist + rows), empty ("No results ready to release." / "All results
are released."), partial (mixed readiness — the default), error ("Couldn't release results. No
students were notified. Try again."), success (optimistic Released badge flip → Toast "Results
released to {N} students. Parents notified."), and a permission-gated read-only variant (no
canReleaseResults → all release controls disabled with explanatory Tooltips, checklist still readable).

MOTION: Sheet/Modal ease.entrance at base; row toggles instant; NO marigold celebration burst
(this is staff gravity, not gamification); respect prefers-reduced-motion. TYPE: Fraunces for the
H1 and dialog heading and empty-state titles, Schibsted Grotesk for UI/labels/table, Spline Sans
Mono for scores/roll numbers/IDs. Never encode status by color alone — always icon + label.
Meet WCAG AA. Output clean, accessible React + Tailwind reading Lyceum CSS custom properties.
```
