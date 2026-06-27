# Screen Spec — Physical Exam Results / AutoGrade (student-web)

> Conforms to **Lyceum / Direction A — "Modern Scholarly"**
> (`design/00-FOUNDATION.md`). Tokens are cited by semantic name, never
> re-pasted. Tone: warm, encouraging, growth-framed — precise on the numbers,
> kind in the framing. This is a **read-and-reflect** surface for a
> teacher-graded paper, **not** a gamification reward surface, so it does
> **not** own a celebratory burst (see §6/§8).

---

## 1. Purpose & primary user

**Primary user:** A learner (B2B school **student**, role `student`) who sat a
_physical / scanned_ exam — a paper answer sheet uploaded and graded by the
**AutoGrade** pipeline (AI grading + optional teacher manual override). (B2C
consumers do not take proctored physical exams; this route is effectively
B2B-only — see §5.)

**Job-to-be-done:** _"My paper was graded — how did I do, where did I lose
marks, and what should I work on?"_ The screen must (a) deliver the verdict
(overall score / percentage / grade) clearly and humanely, (b) walk the learner
through each question showing **their own scanned answer**, the marks awarded,
the rubric breakdown, and structured feedback, (c) make weak topics feel like a
next step rather than a verdict, and (d) be clean to **print or share** —
without **ever** exposing the answer key.

Critically, results exist behind a **release gate**: the teacher decides when
results go live (`resultsReleased`). Before release, the student sees a calm
"not yet released" state — never a half-graded paper, never a leaked score.

---

## 2. Entry points & route

**Route:** `/exams/:examId/results` (B2B student tree, role `student`). Reached
from:

- The **dashboard** "Recent exam results" list (`student-home-dashboard`).
- The **Tests** page / a results list (the `/results` and per-exam links the
  rebuild wires up — see `webapps-design.md` §5.2 fix #14).
- A notification deep-link ("Your results for _Mid-term — Mathematics_ are
  ready").

**Reads / writes (all via `@levelup/api-client` — never `firebase/firestore`):**

- `v1.autograde.getExam` → exam title, subject, total marks, grading scheme,
  schedule context (header + breadcrumb).
- `v1.autograde.listSubmissions` (filtered to this exam + the caller) /
  `v1.autograde.getSubmission` → the student's `Submission`: `summary`
  (`totalScore`, `maxScore`, `percentage`, `grade`, `questionsGraded`,
  `totalQuestions`), `resultsReleased` + `resultsReleasedAt`, `pipelineStatus`.
  **The server folds the `resultsReleased` gate into the projection** — an
  unreleased submission returns a released-only shape that withholds
  scores/feedback and carries a "not released" flag, so the client physically
  cannot render a leaked grade.
- `v1.autograde.listQuestionSubmissions` (**released-only projection for
  students**) → per-question `QuestionSubmission[]`: `evaluation`
  (`UnifiedEvaluationResult` — `score`, `maxScore`, `correctness`, `percentage`,
  `rubricBreakdown[]`, `structuredFeedback`, `strengths`, `weaknesses`,
  `missingConcepts`, `summary`, `confidence`, `mistakeClassification`),
  `manualOverride` (final score surfaced), `gradingStatus`, and
  `mapping.imageUrls` — **resolvable HTTPS URLs** of the student's own scanned
  answer crops (resolved once at the API edge, never raw Storage paths). The
  projection **omits the `answerKeys` subcollection entirely** (denied to
  clients by `firestore.rules`).
- **Optional, on demand:** `v1.analytics.generateReport` (`type: 'exam-result'`)
  → `{ pdfUrl, expiresAt }` for "Download PDF" (a server-rendered report; the
  in-browser print path is the no-download fallback).

`tenantId` is derived server-side from the auth claim — never in the request
body. Timestamps arrive normalized to epoch-ms at the repo edge. All responses
Zod-validated before entering React state (kills the `as QuestionSubmission`
casts in today's `ExamResultPage.tsx`).

---

## 3. Layout — wireframe-as-text

Rendered inside **AppShell** (Sidebar + Topbar on web; bottom **Tabbar** on
mobile). Content column max reading width ~720 (per FOUNDATION §4 reading
measure); the verdict hero may breathe to ~960. Page gutters per FOUNDATION §4
(mobile 16 / tablet 24 / desktop 32). Cards are `radius.lg` at `e1`; surfaces
`bg.surface` on `bg.canvas`.

```
┌─ AppShell ────────────────────────────────────────────────────────────────┐
│ Topbar: ‹ Back · Breadcrumb: Results › "Mid-term · Mathematics"  [Print] │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│   ╔════════════════ VERDICT HERO (ResultSummary) ═══════════════╗          │
│   ║   ProgressRing(percentage)         GradePill[ B+ ]           ║          │
│   ║       72%   (Fraunces hero numeral, mono digits)             ║          │
│   ║   "Solid work on your Mathematics paper."  (h2, Fraunces)    ║          │
│   ║   36 / 50 marks · 14 of 14 questions graded   (Spline Mono)  ║          │
│   ║   Released 12 Jun · graded by AutoGrade + your teacher       ║          │
│   ║   AnswerKeyLock chip: "Answer keys stay with your teacher"   ║          │
│   ╚═══════════════════════════════════════════════════════════════╝          │
│                                                                            │
│   ── "Where to grow next" (warm nudge, only if weak topics) ───────         │
│   InsightCard: "A little practice on these will pay off"                   │
│     Chips: [ Congruence ] [ Trigonometric ratios ]                        │
│     [ Practice these topics → ]   (links to matching spaces, if any)       │
│                                                                            │
│   ══ Per-question review (the heart of the page) ══════════════            │
│   SubmissionCard  Q1   [ Full marks ✓ ]            5 / 5                   │
│     • Your answer (scanned):  [ scanned crop thumbnail → lightbox ]        │
│     • FeedbackPanel: server overallComment / keyTakeaway                   │
│                                                                            │
│   SubmissionCard  Q2   [ Let's look again ]        2 / 6   ConfidenceBadge │
│     • Your answer (scanned):  [ scanned crop thumbnail → lightbox ]        │
│     • RubricBreakdown:                                                     │
│         Method        ▓▓▓░░  2/3   "Right setup — check the final step"    │
│         Accuracy      ░░░░░  0/3   "Arithmetic slip near the end"          │
│     • FeedbackPanel(structuredFeedback): issue · why it matters · how to fix│
│     • "Areas to grow": Trigonometric ratios   (chip)                       │
│     • [ override badge ] "Final score set by your teacher" (if manualOverride)│
│     • AnswerKeyLock where a model answer would sit (sealed)                │
│   … (accordion list; one open at a time on sm/md, multi-open on lg)        │
│                                                                            │
│   ── Footer actions ──                                                     │
│   [ Print results ]   [ Download PDF ]   [ Back to results ]              │
└────────────────────────────────────────────────────────────────────────────┘
```

**GATED STATE (results not yet released)** — replaces the whole body below the
breadcrumb:

```
   ╔═══════════════ EmptyState (warm, not an error) ════════════════╗
   ║   AnswerKeyLock / lock illustration (calm, not alarming)        ║
   ║   "Your results aren't ready just yet"  (Fraunces, h2)          ║
   ║   "Your teacher is still finishing grading the Mathematics      ║
   ║    paper. We'll let you know the moment it's released."         ║
   ║   [ Notify me when ready ]   [ Back to results ]                ║
   ╚════════════════════════════════════════════════════════════════╝
```

**Responsive behavior**

- **sm (640):** single column; verdict hero stacks ProgressRing above GradePill
  above marks line; InsightCard chips wrap; per-question review is an accordion
  (one open at a time); scanned-answer thumbnail full-width; footer actions
  stack full-width. Bottom **Tabbar**, no Sidebar, no ⌘K.
- **md (768):** hero ring + GradePill sit side-by-side; SubmissionCards still
  accordion; RubricBreakdown rows full-width.
- **lg (1024+):** persistent Sidebar; hero centered with ring + pill paired;
  per-question review may show the first (or lowest-scoring) card expanded by
  default with the rest collapsed, multi-open allowed; scanned crop and feedback
  can sit two-column within a card.

---

## 4. Components used (FOUNDATION §5 only)

- **AppShell** + **Sidebar** / **Topbar** (web) / **Tabbar** (mobile) +
  **Breadcrumb** ("Results › {exam title}").
- **ResultSummary** — the verdict hero (overall score / percentage / grade).
- **ProgressRing** — percentage dial (color paired with the numeral + label;
  never color-only).
- **GradePill** — letter grade, using the domain `grade.*` scale (A→F). Reflects
  the **final** score (post manual-override).
- **SubmissionCard** — per-question container: the student's **scanned answer**
  image, marks awarded, status, feedback. (This is the AutoGrade-domain
  per-question card, distinct from the LevelUp `QuestionCard`.)
- **RubricBreakdown** — per-criterion `awarded / max` + per-criterion feedback
  (from `evaluation.rubricBreakdown[]`).
- **ConfidenceBadge** — grading confidence indicator on AI-graded questions
  (`confidence.low/med/high`), framed for students (see §7).
- **ContentRenderer** — renders the question prompt and any markdown/KaTeX in
  feedback (single canonical renderer).
- **InsightCard** — the "Where to grow next" nudge built from `missingConcepts`
  / `weaknesses` of below-threshold questions.
- **AnswerKeyLock** — the server-only-guard visual: makes the **absence** of the
  answer key legible and intentional ("kept with your teacher"), in the hero
  chip, in each SubmissionCard where a model answer would sit, and as the icon
  of the gated empty state.
- **AtRiskBadge** — _not_ shown to the student here (that lives in the
  teacher/parent surfaces); omitted by design.
- **EmptyState** — for the gated "not released" view and the "no submission
  found" view.
- **ErrorState** (distinct from empty) — load/permission failures.
- **Skeleton** — loading placeholders.
- **Chip/Tag** — weak-topic tags.
- **Badge** — "Final score set by your teacher" manual-override marker, and the
  per-question status pill ("Full marks" / "Let's look again" / "Partial").
- **Button** (secondary / ghost / spark for the single primary action),
  **IconButton** (print), **Tooltip**, **Accordion** (per-question list),
  **Card**, **Lightbox** (Modal variant — zoom the scanned crop).
- **Toast** (sonner) — "We'll notify you when results are released" / "PDF
  ready".

**Proposed FOUNDATION additions:** none required. One thing to flag for the
foundation owner (not invented here, just called out): the **scanned-answer
image viewer** inside `SubmissionCard` reuses a generic **Modal/Dialog →
Lightbox** pattern with `loading="lazy"` thumbnails; if a dedicated `ScanCrop` /
`ImageLightbox` primitive is wanted as a first-class §5 entry (it already exists
informally in `src/components/questions/ImageLightbox.tsx`), promote it into
FOUNDATION §5 first rather than letting each screen re-roll it.

---

## 5. States

- **Loading (skeleton):** hero as one `radius.lg` Skeleton block (ring + title +
  marks placeholders); 3–4 SubmissionCard skeletons below. No layout shift when
  data lands. Use `bg.surface-sunken` shimmer.
- **Gated — results not yet released (`resultsReleased === false`):** the
  **primary domain state**. The released-only projection returns no
  scores/feedback, only a `released: false` flag + exam title. Render the warm
  `EmptyState` (see §3 wireframe / §7 copy) with `AnswerKeyLock` iconography,
  "Notify me when ready", and "Back to results". **No score, no grade, no
  per-question data is shown or even present client-side.** This is also the
  print/PDF state — printing the gated view prints the friendly message, never a
  blank scorecard.
- **Empty — no submission found:** student has no submission for this exam
  (absent, not enrolled, or sheet never uploaded). `EmptyState`: "We couldn't
  find your paper for this exam" + "If you sat this exam, check with your
  teacher." + back link. Never implies a zero score.
- **Partial — graded-but-incomplete:**
  `summary.questionsGraded < summary.totalQuestions` (some questions still in
  `gradingStatus: pending/failed`, or `pipelineStatus` mid-run but released).
  Show the hero with an honest "X of Y questions graded so far" line and an
  InlineAlert ("A few questions are still being graded — check back soon");
  ungraded SubmissionCards render a quiet "Being graded" placeholder rather than
  a 0. Never display 0/max for an ungraded question.
- **Success (released, fully graded):** full hero + InsightCard + per-question
  review as in §3.
- **Manual-override present:** when a `QuestionSubmission.manualOverride`
  exists, the SubmissionCard shows the **override score as the final score**
  (not the original AI score) with a calm "Final score set by your teacher"
  Badge; the hero `summary`/GradePill already reflect overrides
  (server-recomputed). The original AI score is **not** dangled at the student.
- **Error:** `ErrorState` (distinct from empty) with a retry; permission/auth
  failures map via `useApiError` to a friendly message, never a stack trace.
- **Role / context variations:**
  - **B2B student (role `student`):** the supported path. Sees only their
    **own** submission (server enforces caller-scoped projection).
  - **B2C consumer (no tenant role):** physical exams are a B2B-only feature; if
    this route is ever reached in consumer context (`LearnerContext` resolves
    `platform_public`), render an EmptyState ("Exam results live in your school
    account"), not a broken page.

---

## 6. Interactions & motion

- **Entrance:** hero and cards fade/translate-in with `motion.base` on
  `ease.entrance`; the percentage numeral **counts up** to its value over
  `motion.slow` (mono digits) — a subtle, dignified reveal, **not** a
  celebration. Respects `prefers-reduced-motion` (instantly shows the final
  number).
- **No CelebrationBurst here.** Per the global gamification rule (§8), the one
  celebratory burst is reserved for XP / streak / level-up / achievement / 100%
  completion gamification surfaces. A teacher-graded paper is a serious,
  reflective surface — even a great score reveals **calmly** (count-up + warm
  copy), never a marigold spark burst. (If the exam result feeds an XP award
  elsewhere, that burst fires on the _dashboard/gamification_ surface, not
  here.)
- **Per-question accordion:** tapping a SubmissionCard header expands it
  (`motion.fast`, `ease.standard`); chevron rotates. On sm/md one card open at a
  time; on lg multi-open. Keyboard-operable (§9).
- **Scanned-answer lightbox:** tapping the scanned crop opens a Modal lightbox
  at `e3` (zoom/pan the student's own answer image); `Esc`/backdrop closes;
  focus returns to the thumbnail. Thumbnails `loading="lazy"`.
- **"Notify me when ready" (gated state):** optimistic — button flips to "We'll
  let you know ✓" immediately, fires the notification-preference subscribe in
  the background, confirms with a Toast; reverts + error Toast on failure.
- **Print:** the Print button (`window.print()`) triggers a **print stylesheet**
  (§9/§10) — expands all accordion cards, hides AppShell
  chrome/Sidebar/Topbar/buttons, switches to ink-on-paper, keeps scanned crops
  and rubric tables legible without color.
- **Download PDF:** calls `v1.analytics.generateReport`; button shows an inline
  spinner (`motion.base`), then opens `pdfUrl`; Toast on ready; falls back to
  print if generation fails.
- **"Practice these topics":** routes to a matching space/story-point if one
  exists; otherwise the InsightCard chips are informational (no dead link).

---

## 7. Content & copy (warm, encouraging, growth-framed)

- **Page / breadcrumb:** `Results` › `{exam.title}` (e.g. "Mid-term ·
  Mathematics").
- **Hero heading (released):** warm, score-aware but never punitive —
  - high: _"Strong work on your {subject} paper."_
  - mid: _"Solid effort — and a clear place or two to grow."_
  - low: _"Let's turn this paper into your next win."_ (never "You failed".)
- **Hero meta:**
  `{totalScore} / {maxScore} marks · {questionsGraded} of {totalQuestions} questions graded`
  · `Released {date}` · _"Graded by AutoGrade and reviewed by your teacher."_
- **AnswerKeyLock chip:** _"Answer keys stay with your teacher — you're seeing
  your own answers and feedback."_
- **Per-question status pills (never "Wrong"):** `Full marks ✓` · `Almost there`
  · `Let's look again` · `Partial credit`. Marks shown as `{score} / {maxScore}`
  in mono.
- **Scanned answer label:** _"Your answer (from your sheet)"_.
- **RubricBreakdown:** criterion name · `{awarded} / {max}` · short feedback
  (e.g. _"Right setup — check the final step"_).
- **ConfidenceBadge (student framing):** describe how the AI was checked, not
  "low confidence about you" — e.g. high → _"Auto-graded"_; med → _"Auto-graded,
  teacher spot-checked"_; low → _"Reviewed by your teacher"_. (Never surface a
  raw confidence number to the student.)
- **Manual-override badge:** _"Final score set by your teacher."_ (Reassuring,
  authoritative — not "AI was overridden".)
- **InsightCard:** _"A little practice on these will pay off"_ + topic chips
  drawn from `missingConcepts` / `weaknesses`.
- **Gated empty state:** title _"Your results aren't ready just yet"_; body
  _"Your teacher is still finishing grading the {subject} paper. We'll let you
  know the moment it's released."_; actions _"Notify me when ready"_, _"Back to
  results"_.
- **No-submission empty:** _"We couldn't find your paper for this exam."_ + _"If
  you sat this exam, check with your teacher."_
- **Partial banner:** _"A few questions are still being graded — your score may
  go up. Check back soon."_
- **Error:** _"We hit a snag loading your results."_ + _"Try again"_ (retry),
  never a code.

---

## 8. Domain rules surfaced

- **ANSWER-KEY IS NEVER SHOWN.** The `answerKeys` subcollection is server-only
  and denied to all clients by `firestore.rules`; the **released-only
  projection** of `listQuestionSubmissions` omits it entirely. The student sees
  **only their own scanned answer + rubric-based feedback + score** — never the
  correct/model answer for any question. `AnswerKeyLock` makes this absence
  intentional and legible (hero chip, per-card slot, gated-state icon).
- **RESULTS VISIBLE ONLY WHEN RELEASED.** The `resultsReleased` gate is enforced
  **server-side, folded into the projection** — before release the client
  receives no scores/feedback at all and renders the warm gated EmptyState. The
  client never decides releasability and never has releasable-but-hidden data to
  leak. `resultsReleasedAt` drives the "Released {date}" line.
- **MANUAL OVERRIDE IS THE FINAL SCORE.** Where a `manualOverride` exists, the
  override score is the score shown (per question and in the server-recomputed
  `summary`/GradePill); the original AI score is not surfaced to the student.
- **NO CELEBRATORY BURST HERE.** Per the gamification rule, the single
  spring-pop + marigold burst is reserved for
  XP/streak/level-up/achievement/100%-completion gamification surfaces. This
  graded-paper surface reveals calmly (count-up + warm copy) and uses subtle
  motion only.
- **TIMER:** not applicable — physical exams have no live client countdown on
  this results surface (no `TimerBar`).
- **TENANT ISOLATION:** B2B reads are tenant-scoped
  (`tenants/{tenantId}/submissions/...`); `tenantId` is derived from the
  caller's active-tenant claim server-side. The student sees only their own
  caller-scoped submission. Physical exams are B2B-only (consumer context
  degrades to a friendly EmptyState).
- **DATA FLOWS VIA `@levelup/api-client`** only — no direct
  `firebase/firestore`. Responses Zod-validated; `mapping.imageUrls` are
  resolvable HTTPS URLs from the API (one resolution point), never raw Storage
  paths.

---

## 9. Accessibility

- **Print stylesheet (first-class):** `@media print` expands every accordion
  card, removes AppShell chrome (Sidebar/Topbar/Tabbar/buttons), sets
  ink-on-paper (`text.primary` on white), keeps scanned crops and
  RubricBreakdown tables, and adds a header line (exam title · student name ·
  date) + page numbers. The verdict, every question's marks, rubric, and
  feedback must be fully legible on paper.
- **Legible without color (WCAG AA):** never status-by-color-alone — every
  status pairs an **icon + text label** (`Full marks ✓`, `Let's look again`),
  ProgressRing pairs the dial with the numeral + label, GradePill shows the
  letter (not just a hue), RubricBreakdown shows `awarded/max` numerals (not
  just a bar), ConfidenceBadge shows a word. All text/bg pairs meet AA (4.5:1
  body, 3:1 large/UI).
- **Focus order:** breadcrumb → Print/Download → hero (read as a labelled
  summary region) → InsightCard CTA → each SubmissionCard header (in question
  order) → footer actions. Visible focus ring (`border.focus`, 3px) on every
  interactive element.
- **Keyboard:** accordion headers are buttons — `Enter`/`Space` toggle, `↑/↓`
  (or `Tab`) move between them, `aria-expanded` reflects state. Lightbox traps
  focus, `Esc` closes, focus returns to the trigger. Print/Download reachable
  and operable.
- **ARIA / semantics:** hero is a labelled `region` ("Exam result summary");
  per-question list is a list of disclosure widgets; the scanned-answer image
  has descriptive `alt` ("Your scanned answer for question 2"); the
  AnswerKeyLock conveys its meaning via text, not icon alone; ConfidenceBadge
  has an accessible label; live `aria-live="polite"` announces the "Notify me"
  confirmation and "PDF ready".
- **Reduced motion:** `prefers-reduced-motion` disables the percentage count-up
  (shows final value), accordion/lightbox transitions become instant.

---

## 10. Web ↔ mobile divergence (FOUNDATION §6)

- **Shell:** web = persistent Sidebar + Topbar + ⌘K CommandPalette; mobile =
  bottom **Tabbar**, no Sidebar, **no ⌘K**. Header back-affordance instead of
  breadcrumb chain on narrow widths.
- **Per-question review:** web (lg) may show multiple cards open / two-column
  card internals; mobile is a strict one-open-at-a-time accordion, scanned crop
  full-width above feedback.
- **Hover → press:** web hover tooltips (e.g. ConfidenceBadge explanation,
  override badge) become tap-to-reveal Popover/tooltip on mobile; touch targets
  ≥44px.
- **Print vs share:** web's primary export is **Print** (browser print →
  stylesheet); mobile leans on **Download PDF** (`generateReport`) into the OS
  share sheet — Print is hidden/secondary on mobile. The scanned-crop lightbox
  uses pinch-zoom on mobile vs click-zoom/pan on web.
- **Component parity:** `ResultSummary`, `SubmissionCard`, `RubricBreakdown`,
  `ConfidenceBadge`, `GradePill`, `AnswerKeyLock`, `InsightCard`,
  `ContentRenderer` keep identical names/props across `shared-ui` (web) and
  `ui-native` (mobile) per FOUNDATION §6; only the renderer differs.

---

## 11. Claude-design prompt (ready to paste)

```
Design the "Physical Exam Results" screen for the Auto-LevelUp STUDENT web app, conforming
to the Lyceum design system (Direction A — "Modern Scholarly"), defined in
docs/rebuild-spec/design/00-FOUNDATION.md. Cite tokens by semantic name only
(bg.canvas, bg.surface, text.primary/secondary, brand.primary, spark, border.subtle,
status.*, grade.A–F, confidence.low/med/high, radius.lg, e1/e3, motion.fast/base/slow,
ease.entrance/standard). Fonts: Fraunces (display/hero numeral), Schibsted Grotesk (UI/body),
Spline Sans Mono (scores/marks/dates). Do NOT invent colors, fonts, radii, shadows, or
component variants.

Context: results for a PHYSICAL/scanned exam graded by AutoGrade (AI grading + optional
teacher manual override), route /exams/:examId/results. The student sees their OWN scanned
answers plus rubric-based feedback and a score — NEVER the answer key (it is server-only and
omitted from the released-only projection). Render inside AppShell (Sidebar+Topbar on web,
bottom Tabbar on mobile).

Compose ONLY from FOUNDATION §5 components: AppShell, Breadcrumb, ResultSummary (verdict hero
with ProgressRing + GradePill, animated count-up percentage), SubmissionCard (per question:
the student's scanned answer crop with lightbox, marks awarded, status pill, feedback),
RubricBreakdown (criterion · awarded/max · feedback), ConfidenceBadge (student-framed:
"Auto-graded" / "Teacher spot-checked" / "Reviewed by your teacher" — never a raw number),
ContentRenderer (markdown+KaTeX prompts/feedback), InsightCard ("Where to grow next" weak-topic
chips), AnswerKeyLock (make the sealed answer key legible), EmptyState, ErrorState, Skeleton,
Accordion, Chip, Badge, Button/IconButton, Toast.

Build these states: (1) loading skeleton; (2) GATED "results not yet released" — a warm
EmptyState with AnswerKeyLock iconography, NO score/grade/feedback present at all, "Notify me
when ready" + "Back to results"; (3) no-submission empty; (4) partial (some questions still
grading — honest "X of Y graded", never show 0 for ungraded); (5) success (released, fully
graded); (6) manual-override (show the teacher's final score with a calm "Final score set by
your teacher" badge, hide the original AI score); (7) error.

Tone: warm, encouraging, growth-framed — precise on numbers, kind in framing. Status pills say
"Full marks ✓" / "Almost there" / "Let's look again" / "Partial credit" — NEVER "Wrong".
Hero copy adapts to score band without ever saying "failed".

Motion: subtle only — fade/translate-in at motion.base, a dignified percentage count-up at
motion.slow. This is NOT a gamification surface: NO CelebrationBurst / marigold spark burst.
Respect prefers-reduced-motion.

Accessibility: first-class PRINT stylesheet (expand all cards, drop chrome, ink-on-paper, keep
scanned crops + rubric tables, add a printed header + page numbers); legible without color
(icon+label on every status, numerals on rubric, letter on GradePill); full keyboard accordion
+ lightbox with focus return; aria-live for "notify me"/"PDF ready"; AA contrast.

Responsive: sm = single column, one-open accordion, full-width crops, stacked actions, bottom
Tabbar; md = ring+pill side-by-side; lg = persistent Sidebar, first/lowest-scoring card expanded,
multi-open, two-column card internals. All data flows via @levelup/api-client (never
firebase/firestore): v1.autograde.getExam, getSubmission/listSubmissions, listQuestionSubmissions
(released-only), v1.analytics.generateReport for PDF.
```
