# Exam Detail — Overview & Status Hub

_The persistent workspace shell for a single exam: title/subject/status header,
server-authoritative lifecycle actions, KPI strip from `exam.stats`, and
deep-linked Questions / Submissions / Settings tabs that host every downstream
AutoGrade workflow._

---

## 1. Purpose & primary user

**Primary user:** Teacher / Exam owner (also Tenant Admin and the `scanner`
intake role with reduced rights). Role from tenant membership; gating below is
per-status **and** per-permission.

**Job-to-be-done:** "Give me one place to see where this exam is in its
lifecycle, what the grading pipeline has produced so far, and the single correct
next action I'm allowed to take — without ever exposing the answer key, breaking
tenant isolation, or letting me edit a field that's locked after publish."

This screen is the **hub shell**: it owns the header, the lifecycle
visualization, the KPI strip, and tab orchestration. It does **not** itself
render the question editor, submissions queue, settings form, or GradingReview —
those are the tab bodies / child routes it hosts.

---

## 2. Entry points & route

**Route:** `/exams/:examId` (default tab Questions; tabs deep-link to
`?tab=questions|submissions|settings`, with `/exams/:examId/submissions` and
`/exams/:examId/submissions/:submissionId` as nested routes that keep this shell
mounted).

**Entry points:**

- `/exams` list → row / `SubmissionCard` click.
- `/exams/new` wizard → on publish, redirect here.
- CommandPalette (⌘K) "Go to exam…" → resolves to this route.
- Notification toast deep-links (e.g. "Grading complete for {exam}").
- Breadcrumb from any child (GradingReview "back to exam").

**Common-API reads/writes** (`specs/common-api.md`):

- `exams.get(examId)` — live read of the `Exam` doc (header, `status`,
  `gradingConfig`, `stats`, `linkedSpace*`). Tenant-scoped by the repo; a
  cross-tenant `examId` resolves to not-found.
- `submissions.listLive(examId)` — drives the Submissions tab badge count + KPI
  fallbacks; subscribed only when that tab is active or for the header count.
- `examAnalytics.get(examId)` — lazy, gates the "View analytics" affordance
  (links to `/analytics/exams/:examId`).
- **Writes (all status transitions go through one callable):**
  `saveExam({ examId, ...patch })` — consolidated CRUD that runs the
  server-enforced `VALID_STATUS_TRANSITIONS` state machine and rejects edits to
  `POST_PUBLISH_LOCKED_FIELDS`. The header action buttons are thin wrappers over
  `saveExam` with a target `status`:
  - Extract questions → `extractQuestions({ examId, mode: 'full' })` (Gemini
    QP→questions+rubric), which advances
    `question_paper_uploaded → question_paper_extracted`.
  - Publish → `saveExam({ examId, status: 'published' })` (notifies students;
    locks fields).
  - Start grading → `saveExam({ examId, status: 'grading' })`.
  - Release results → `saveExam({ examId, status: 'results_released' })`.
  - Archive → `saveExam({ examId, status: 'archived' })`.

The client never sets `status` optimistically as truth — it sends intent and
re-renders from the server-returned `Exam` (status is **server-authoritative**).

---

## 3. Layout — wireframe-as-text

Rendered inside **AppShell** (Sidebar + Topbar with tenant switcher / search /
notifications / profile). Content max-width 1200; gutters mobile 16 / tablet 24
/ desktop 32.

### lg (≥1024)

```
┌ AppShell ───────────────────────────────────────────────────────────────┐
│ Sidebar │ Topbar (tenant · search · ⌘K · notifications · profile)        │
│         ├──────────────────────────────────────────────────────────────  │
│         │ Breadcrumb: Exams / {exam.title}                                │
│         │                                                                 │
│         │ ┌ HEADER (Section, bg.surface, radius lg, e1) ───────────────┐  │
│         │ │ {title — Fraunces 2xl}        [StatusBadge: icon+label]     │  │
│         │ │ {subject · examDate · duration · totalMarks} (Schibsted sm) │  │
│         │ │ {Linked space chip → LevelUp}      [⋯ overflow IconButton]  │  │
│         │ │ ─────────────────────────────────────────────────────────  │  │
│         │ │ LIFECYCLE Timeline (horizontal, server status)             │  │
│         │ │ draft▸QP uploaded▸extracted▸published▸grading▸completed▸    │  │
│         │ │       released   (current node = brand.primary, dot+label) │  │
│         │ │ ─────────────────────────────────────────────────────────  │  │
│         │ │ PRIMARY ACTION ROW (gated by status+permission):           │  │
│         │ │  [Primary Button: next action]  [secondary…]  [danger…]    │  │
│         │ └────────────────────────────────────────────────────────────┘  │
│         │                                                                 │
│         │ ┌ KPI STRIP (4× Stat/KPI cards, grid) ──────────────────────┐  │
│         │ │ Submissions | Graded | Avg score (mono) | Pass rate %     │  │
│         │ └────────────────────────────────────────────────────────────┘  │
│         │                                                                 │
│         │ ┌ Tabs ──────────────────────────────────────────────────────┐ │
│         │ │ [ Questions ] [ Submissions ·N ] [ Settings ]              │ │
│         │ ├────────────────────────────────────────────────────────────┤ │
│         │ │   « child route / tab body renders here »                  │ │
│         │ └────────────────────────────────────────────────────────────┘ │
└─────────┴─────────────────────────────────────────────────────────────────┘
```

### md (768–1023)

Sidebar collapses to icon rail (AppShell default). KPI strip becomes 2×2 grid.
Action row wraps; overflow actions move under the `⋯` Popover. Lifecycle
Timeline stays horizontal but scrolls-x if cramped.

### sm (<768)

Single column, page gutter 16. Header stacks: title → StatusBadge (full-width
Chip) → meta DefinitionList. Lifecycle Timeline becomes **vertical** (Timeline
component, top→bottom). Primary action becomes a full-width sticky bottom
Button; secondary/danger collapse into the `⋯` Sheet. KPI strip = horizontal
scroll-snap of Stat cards. Tabs become a scrollable Tabbar; tab body full-width.

---

## 4. Components used (Lyceum inventory only)

- **AppShell** (Sidebar + Topbar), **Breadcrumb**.
- **Section / Panel / Card** — header container + KPI cards.
- **Badge** — `StatusBadge` for `ExamStatus` (icon + label, never color-only).
- **Timeline** — lifecycle visualization (horizontal lg / vertical sm), current
  node highlighted.
- **Stat/KPI** ×4 —
  `exam.stats.totalSubmissions / gradedSubmissions / avgScore / passRate`;
  numeric values in **Spline Sans Mono** (tabular).
- **Button** (primary / secondary / danger / ghost) + **IconButton** for
  overflow `⋯`.
- **Popover / Sheet** — overflow action menu (Archive, View analytics,
  Duplicate, Export).
- **Tabs** — Questions / Submissions / Settings; badge count on Submissions.
- **Chip/Tag** — linked-space chip, subject/topic chips.
- **ConfirmDialog** — destructive / irreversible transitions (Publish, Release,
  Archive).
- **Modal/Dialog** — pre-flight checklists (e.g. extract requires uploaded QP;
  release requires all `needs_review` resolved).
- **InlineAlert/Banner** — blocking conditions (e.g. "3 questions still need
  review before you can release").
- **Toast (sonner)** — transition success/failure.
- **Skeleton / LoadingOverlay** — load + in-flight transition.
- **EmptyState** — tab-level empties (no questions / no submissions yet).
- **Tooltip** — explains why an action is disabled.
- **AnswerKeyLock** (domain) — visual guard on the header indicating
  model-answer/rubric is server-only and never shown to students.
- **ConfidenceBadge / GradePill** (domain) — used in the KPI/Submissions summary
  preview surfaces hosted here.

**Proposed addition (justify):** `LifecycleStepper` — a thin **domain preset of
Timeline** bound to `ExamStatus` (maps each status to label + icon + token,
marks failure branches like `grading_partial` as a warning fork). Justified
because the status set, ordering, and failure forks are AutoGrade-specific and
reused on the Exams list and analytics; better as one shared mapping than ad-hoc
Timeline config per screen. Add to §5 domain components.

---

## 5. States

**Loading:** Skeleton header (title bar, badge pill, 7-node timeline shimmer) +
4 KPI Skeletons + tab strip skeleton. No layout shift on resolve.

**Empty (per status):**

- `draft` / `question_paper_uploaded`: Questions tab `EmptyState` — "No
  questions yet. Upload a question paper to extract them." Primary action
  surfaces in header.
- No submissions yet (`published`+): Submissions tab `EmptyState` — "Waiting on
  answer sheets." KPI strip shows zeros (mono `0`), not skeletons.

**Partial:** Pipeline mid-flight — `status: grading` with `grading_partial` on
some submissions. KPI "Graded" shows `gradedSubmissions / totalSubmissions`; an
`InlineAlert` (status.warning) summarizes "N submissions need review, M failed
(DLQ)." Header shows a **non-blocking** progress affordance (ProgressBar from
aggregate `gradingProgress`). Release action stays **disabled** with Tooltip
until reviews clear.

**Error:**

- `exams.get` fail / not-found / cross-tenant → full-screen `EmptyState` (error
  variant): "Exam not found or you don't have access." + back-to-Exams Button.
  (Tenant isolation: never reveal existence of another tenant's exam.)
- Transition rejected by server (`saveExam` throws — invalid transition, locked
  field, quota) → Toast (status.error) + `InlineAlert` with the server reason;
  UI re-syncs to the authoritative status (no optimistic stick).

**Success:** Resolved header, accurate StatusBadge, live KPI strip, correct
enabled primary action, active tab body rendered.

**Permission / role-gated:** | Role | Header actions | Tabs | |---|---|---| |
Exam owner / Admin | All transitions (gated by status) | Questions (edit),
Submissions, Settings | | Teacher (non-owner, same tenant) | Read +
grade/review; **no** Publish/Release/Archive | Questions (read), Submissions
(review/override per `gradingConfig.allowManualOverride`), Settings (read) | |
`scanner` intake role | None | Submissions (upload only); Questions/Settings
hidden | Disabled actions render as disabled Buttons with explanatory Tooltips
(never hidden silently for the owner — clarity over surprise).

---

## 6. Interactions & motion

**Tab switch:** instant (`fast 160ms`, `ease.standard`) cross-fade of tab body;
URL `?tab=` updates; scroll position per-tab preserved. Active tab underline
slides (`base 220ms`).

**Status transition (the core flow):**

1. Click primary action (e.g. "Publish").
2. **ConfirmDialog** for irreversible/notifying actions — Publish ("This
   notifies enrolled students and locks exam metadata"), Release results
   ("Students and parents will be able to see scores and feedback"), Archive
   ("Hides this exam from active lists").
3. On confirm → button enters `loading`; `LoadingOverlay` over header action row
   only (tabs stay interactive).
4. `saveExam`/`extractQuestions` resolves → re-render from server `Exam`;
   StatusBadge + Timeline current node animate (node fill
   `base 220ms ease.entrance`); success Toast.
5. On reject → button resets, Toast(error) + InlineAlert with reason; **no
   optimistic status change** ever persists.

**Pre-flight gating:** Actions with prerequisites open a **Modal checklist**
instead of immediately calling the callable — e.g. Release results lists
unresolved `needs_review` question submissions; teacher must clear them
(deep-link into GradingReview) before the call is allowed. Extract questions is
disabled until `questionPaper.images` exist.

**Optimistic updates:** Only for **non-authoritative** UI (active-tab highlight,
overflow menu open). Status/KPIs are **never** optimistic — they reflect server
reads.

**Reduced motion:** timeline node + tab underline use opacity-only fades; no
slide. Gamification spring is **not** used here (staff context — restraint).

---

## 7. Content & copy (tone: precise, for staff)

- **Breadcrumb:** `Exams / {exam.title}`.
- **Header meta:**
  `{subject} · {examDate, e.g. "12 Jun 2026"} · {duration} min · {totalMarks} marks · Pass {passingMarks}`.
- **StatusBadge labels** (icon + text): Draft · QP uploaded · Questions
  extracted · Published · Grading… · Completed · Results released · Archived.
  Failure forks surfaced as InlineAlerts, not badge labels.
- **KPI labels:** "Submissions" · "Graded" · "Avg score" · "Pass rate".
- **Primary action verbs by status:** draft→"Upload question paper" ·
  question_paper_uploaded→"Extract questions" ·
  question_paper_extracted→"Publish exam" · published→"Start grading" ·
  grading→"View grading progress" · completed→"Release results" ·
  results_released→"View analytics" · archived→"Unarchive".
- **Confirm copy:** Publish — "Publish this exam? Enrolled students will be
  notified and exam metadata will be locked." Release — "Release results to
  students and parents? They'll be able to see scores and feedback. This can't
  be undone." Archive — "Archive {title}? It moves out of active exams; you can
  unarchive later."
- **Empty:** "No questions yet — upload a question paper to extract them." /
  "Waiting on answer sheets."
- **Blocking alert:** "{n} questions still need review. Resolve them before
  releasing results." with "Go to review" link.
- **Error:** "Exam not found or you don't have access." / "Couldn't {action}:
  {server reason}. Nothing changed."
- **Locked-field hint (Settings/header, post-publish):** "Locked after
  publishing." on `POST_PUBLISH_LOCKED_FIELDS`.

Numbers/IDs/scores/dates in **Spline Sans Mono**; title in **Fraunces**;
everything else **Schibsted Grotesk**.

---

## 8. Domain rules surfaced

- **Answer key never to students:** `AnswerKeyLock` visual on header;
  `rubric.modelAnswer` / `evaluatorGuidance` only exist in teacher tabs. This
  shell never has a student render path.
- **Server-authoritative status:** every transition is `saveExam` enforcing
  `VALID_STATUS_TRANSITIONS`; client renders the returned status, never invents
  one. Invalid transitions are rejected and surfaced verbatim.
- **Post-publish field locks:** once `status ≥ published`,
  `POST_PUBLISH_LOCKED_FIELDS` (e.g. classIds, totalMarks, examDate) are
  read-only; UI disables + labels them rather than silently dropping edits.
- **Confidence routing drives review priority:** KPI/partial state reflect
  per-question routing — `confidence < confidenceThreshold(0.7)` →
  `needs_review` (blocks release), `> autoApproveThreshold(0.9)` → auto-approve.
  Surfaced as the release gating checklist.
- **Results released explicitly:** students/parents can only read after
  `results_released` (or `gradingConfig.releaseResultsAutomatically`). The
  Release action is the one gate; ConfirmDialog makes irreversibility explicit.
- **Manual override audit:** override keeps `originalScore` (OverrideTimeline
  lives in GradingReview); `gradingConfig.requireOverrideReason` is honored
  downstream — this hub only exposes the entry point.
- **Tenant isolation:** `exams.get` is tenant-scoped; cross-tenant ids resolve
  to not-found with no existence leak.
- **Vestigial states hidden:** `ocr_*` pipeline states are never surfaced.
- **uploadSource web|scanner:** scanner-role intake is read-limited (Submissions
  upload only).

---

## 9. Accessibility

- **Focus order:** Breadcrumb → header title (h1) → StatusBadge → primary action
  → secondary → overflow → KPI cards (group) → Tabs → tab body. Single visible
  h1 (`{title}`).
- **Tabs:** WAI-ARIA tab pattern — `role="tablist"`, arrow-key navigation,
  `aria-selected`, `aria-controls`/`aria-labelledby` tying tab↔panel; active
  panel `tabindex=0`. Tab URL state announced via `aria-current`.
- **Timeline:** `<ol>` with each step `aria-current="step"` on the active node;
  status conveyed by **icon + text label**, never color alone (Lyceum rule).
- **Actions:** disabled Buttons keep `aria-disabled` + Tooltip text linked via
  `aria-describedby` so screen readers get the "why". ConfirmDialog is a
  focus-trapped `role="dialog"` with labelled title/description, ESC +
  overlay-click cancel, focus returns to invoking Button.
- **Live regions:** transition success/failure and grading-progress updates
  announced via `aria-live="polite"`; Toasts mirrored politely.
- **Contrast:** all status/grade/confidence tokens meet WCAG AA (4.5:1 text, 3:1
  UI) per foundation; KPI mono numerals on `bg.surface` verified.
- **Reduced motion:** honor `prefers-reduced-motion` — opacity fades only, no
  slides/springs.
- **Touch:** all targets ≥44px; sticky mobile primary action ≥44px tall.

---

## 10. Web↔mobile divergence

| Aspect      | teacher-web (today)           | Future RN / scanner-web                                |
| ----------- | ----------------------------- | ------------------------------------------------------ |
| Shell       | AppShell sidebar + topbar     | Tabbar + RoleSwitcher; header collapses                |
| Lifecycle   | horizontal Timeline           | vertical Timeline (Stepper)                            |
| KPI strip   | 4-up grid                     | horizontal scroll-snap Stat cards                      |
| Actions     | inline Button row + ⋯ Popover | primary = sticky full-width; rest in ⋯ Sheet           |
| Tabs        | Tabs w/ underline             | scrollable Tabbar; swipe between panels                |
| Overflow    | hover Tooltip + Popover       | press → bottom Sheet (no hover)                        |
| Command     | ⌘K CommandPalette             | none (no palette on mobile)                            |
| Confirms    | centered Modal                | bottom Sheet ConfirmDialog                             |
| scanner-web | n/a                           | reduced shell: Submissions-upload only, no transitions |

Component **names/props match 1:1** across `shared-ui` / `ui-native`; only the
renderer differs.

---

## 11. Claude-design prompt (ready to paste)

```
Design the "Exam Detail — Overview & Status Hub" screen for Auto-LevelUp's teacher-web app,
conforming EXACTLY to the Lyceum design system (docs/rebuild-spec/design/00-FOUNDATION.md).
Do NOT invent tokens/fonts/variants — compose only from Lyceum. Cite tokens by name (brand.primary,
spark, status.warning, confidence.low/med/high, grade.*); never paste hex.

Context: Route /exams/:examId. It is the persistent hub SHELL for one Exam (AutoGrade). It hosts
deep-linked Tabs (Questions / Submissions / Settings) but renders only the header, lifecycle,
KPI strip, and tab orchestration.

Build inside AppShell (Sidebar + Topbar: tenant switcher, search, ⌘K, notifications, profile).
Layout, top→bottom: Breadcrumb (Exams / {title}); a header Section (Fraunces 2xl title, StatusBadge
with icon+label for ExamStatus, meta line subject·examDate·duration·totalMarks·passingMarks in
Schibsted Grotesk, a linked-space Chip, an AnswerKeyLock guard visual, and an ⋯ IconButton Popover);
a horizontal lifecycle Timeline mapping ExamStatus (draft→question_paper_uploaded→
question_paper_extracted→published→grading→completed→results_released→archived) with the current node
filled in brand.primary and conveyed by icon+text (never color alone); a primary action row gated by
status+permission; then a 4-up Stat/KPI strip (Submissions, Graded, Avg score, Pass rate) with numeric
values in Spline Sans Mono; then a Tabs strip (Submissions tab shows a count Badge) with the tab body
region beneath.

Behavior: header actions are thin wrappers over the saveExam callable that runs server-enforced
VALID_STATUS_TRANSITIONS; show the single correct next action per status (Extract questions / Publish /
Start grading / Release results / Archive). Status is server-authoritative — never optimistic.
Irreversible/notifying actions (Publish, Release results, Archive) open a focus-trapped ConfirmDialog.
Release is disabled with a Tooltip until all needs_review question submissions are resolved (confidence
routing: <0.7 needs_review, >0.9 auto-approve). Post-publish, POST_PUBLISH_LOCKED_FIELDS are disabled
and labeled "Locked after publishing." Never show answer-key/model-answer here; tenant isolation means a
cross-tenant examId renders a not-found EmptyState with no existence leak.

States: Skeleton load; per-status EmptyStates; partial (grading_partial → status.warning InlineAlert +
ProgressBar, Graded shows gradedSubmissions/totalSubmissions); error Toast + InlineAlert that re-syncs to
server status. Permission variants: owner/admin (all), teacher (review only), scanner (Submissions upload
only). Hide vestigial ocr_* states.

Use Lyceum radii (cards lg, buttons md, chips pill), warm-tinted elevation (e1 cards, e3 modals), focus
ring indigo@35%, motion tokens (tab fade fast 160ms, node fill base 220ms ease.entrance), and honor
prefers-reduced-motion (opacity only; no gamification spring — staff context). Full WAI-ARIA tab pattern,
Timeline as an ordered list with aria-current="step", disabled buttons with aria-describedby tooltips,
all targets ≥44px, WCAG AA contrast. Provide responsive behavior at sm (vertical timeline, sticky
full-width primary action, scroll-snap KPIs) / md (icon rail, 2×2 KPIs) / lg (full layout).
```
