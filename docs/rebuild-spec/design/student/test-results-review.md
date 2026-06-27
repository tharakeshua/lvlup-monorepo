# Screen Spec — Timed Test: Results Review (student-web)

> Conforms to **Lyceum / Direction A — "Modern Scholarly"**
> (`design/00-FOUNDATION.md`). Tokens are cited by semantic name, never
> re-pasted. Tone: warm, encouraging, growth-framed. This is the **gamification
> reward surface** — it owns the one celebratory motion moment.

---

## 1. Purpose & primary user

**Primary user:** A learner (B2B school **student**, role `student`; or B2C
**consumer**, no tenant role) who has just submitted — or is revisiting — a
timed test for a story point.

**Job-to-be-done:** _"I finished. Did I pass, and where do I grow next?"_ The
screen must (a) deliver the verdict (score / percentage / pass-fail) instantly
and legibly, (b) celebrate genuine progress when earned, (c) make a non-pass
feel like a next step, not a failure, and (d) let the learner review each
question with server-provided feedback — **without ever exposing the raw answer
key**.

This is a **read-and-reflect** surface, not an authoring or test-taking surface.
No timer runs here; the assessment is complete.

---

## 2. Entry points & route

**Routes**

- Post-submit transition: the `results` branch of `TimedTestPage` (state machine
  `landing | test | results`) flips to `results` immediately after
  `submitTestSession` resolves — no navigation, same route
  `/spaces/:spaceId/test/:storyPointId`.
- Direct revisit / deep link: `/spaces/:spaceId/test/:storyPointId` resolves to
  `results` when a completed session exists for the learner (and the test is
  locked or out of attempts). A "deeper dive" link routes to
  `/spaces/:spaceId/test/:storyPointId/analytics` (TestAnalytics — separate
  spec).
- B2C mirror: `/consumer/spaces/:spaceId/test/:storyPointId` (same page; data
  source resolved by `LearnerContext`, not path).

**Reads / writes (all via `@levelup/api-client` — never `firebase/firestore`):**

- **Write that produced this view:** `v1.levelup.submitTestSession` → returns
  the graded `DigitalTestSession` (score, `totalMarks`, `percentage`,
  `analytics: TestAnalytics`, `difficultyProgression`, `sectionMapping`,
  per-question results). This is the authoritative result payload.
- **Read on revisit / refresh:** `TestSessionRepo.get(sessionId)`
  (`v1.levelup.getTestSession`) for the completed session;
  `v1.levelup.getStoryPointProgress` for `assessmentConfig.passingPercentage`,
  `retryConfig.lockAfterPassing`, prior best percentage (for the personal-best
  check), and attempts remaining.
- **Per-question feedback** comes from the server-graded result embedded in the
  session (server-provided `feedback`, `explanation`, `isCorrect`/`status`,
  `rubricBreakdown[]`, `confidence`) — the `UnifiedEvaluationResult` shape from
  `content/evaluation.ts`. **No answer-key read** — the client physically cannot
  fetch `answerKeys/*` (denied by `firestore.rules`).
- **Story point + item context** (titles, section labels, per-question prompts)
  via `ProgressRepo`/`items.list` for rendering; question prompts re-rendered
  through `ContentRenderer`.

`tenantId` is derived server-side from the auth claim — never passed in the
request body. Timestamps arrive normalized to epoch-ms at the repo edge.

---

## 3. Layout — wireframe-as-text

Rendered inside **AppShell** (Sidebar + Topbar on web; bottom **Tabbar** on
mobile). Content column max reading width ~720, verdict hero may breathe wider
to 1200. Page gutters per FOUNDATION §4 (mobile 16 / tablet 24 / desktop 32).
Vertical rhythm uses the spacing scale; cards are `radius.lg` at `e1`.

```
┌─ AppShell ───────────────────────────────────────────────────────────────┐
│ Topbar: ‹ Back to space · "Geometry · Triangles — Test"  · [Review]      │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│   ╔═══════════════ VERDICT HERO (ResultSummary) ═══════════════╗          │
│   ║  [CelebrationBurst overlay — pass / personal-best ONLY]      ║          │
│   ║                                                              ║          │
│   ║     ProgressRing(percentage)        GradePill[ Passed ✓ ]    ║          │
│   ║        78%   (Fraunces, mono digits, animated count-up)      ║          │
│   ║     "Nice work — you passed!"  (h2, Fraunces)                ║          │
│   ║     39 / 50 marks · Pass mark 70%   (Spline Mono)            ║          │
│   ║     [ Review answers ↓ ]  [ Practice weak topics → ]         ║          │
│   ║     AnswerKeyLock chip: "Answer keys stay sealed"            ║          │
│   ╚══════════════════════════════════════════════════════════════╝          │
│                                                                           │
│   ── Breakdowns (responsive grid: lg = 2-col, md/sm = 1-col stack) ──      │
│   ┌─ By difficulty ──────────┐  ┌─ By Bloom's level ───────────┐          │
│   │ Easy   ▓▓▓▓▓▓▓▓░ 8/9      │  │ Remember ▓▓▓▓▓░ 5/6           │          │
│   │ Medium ▓▓▓▓▓░░░ 6/10      │  │ Apply    ▓▓▓░░░ 3/7           │          │
│   │ Hard   ▓▓░░░░░░ 2/8       │  │ Analyze  ▓▓░░░░ 2/6           │          │
│   └──────────────────────────┘  └──────────────────────────────┘          │
│   ┌─ By section ─────────────┐  ┌─ By topic ───────────────────┐          │
│   │ A: Basics  ▓▓▓▓▓ 90%     │  │ Congruence ▓▓▓░ 60%           │          │
│   │ B: Proofs  ▓▓░░░ 40%     │  │ Similarity ▓▓░░ 45%           │          │
│   └──────────────────────────┘  └──────────────────────────────┘          │
│                                                                           │
│   ┌─ Difficulty progression (adaptive path) ───────────────────┐          │
│   │  Q1 Q2 Q3 Q4 …   ● easy/med/hard dots · ✓/✗ icon+label     │          │
│   │  small line/step chart, legible without color              │          │
│   └─────────────────────────────────────────────────────────────┘          │
│                                                                           │
│   ── "What to review next" (warm nudge) ─────────────────────────         │
│   InsightCard: "Let's revisit Proofs together"                            │
│      [ Practice this story point → ]   [ Ask the tutor → ]                 │
│                                                                           │
│   ══ Per-question review (anchor target of "Review answers") ══           │
│   QuestionCard  Q1  [✓ Correct]  · section A · medium                     │
│     ContentRenderer(prompt) · your answer · FeedbackPanel(explanation)    │
│   QuestionCard  Q2  [Let's look again]  ConfidenceBadge[high]            │
│     RubricBreakdown(dimensions) · FeedbackPanel(server feedback)          │
│     AnswerKeyLock where the model answer would be (sealed)                 │
│   … (collapsible accordion; one expanded at a time)                       │
└───────────────────────────────────────────────────────────────────────────┘
```

**Responsive behavior**

- **sm (640):** single column; verdict hero stacks ProgressRing above GradePill
  above marks; CTAs full-width stacked; breakdown cards stack; per-question
  review collapses into an accordion (one open). Bottom Tabbar.
- **md (768):** breakdown grid becomes 2-col; CTAs sit inline; per-question
  cards still accordion.
- **lg (1024+):** verdict hero centered with ring + pill side-by-side;
  breakdowns 2×2 grid; per-question review can show first card expanded by
  default with the rest collapsed; persistent Sidebar.

---

## 4. Components used (FOUNDATION §5 only)

**Domain components**

- **ResultSummary** — the verdict hero (score, percentage, marks, pass/fail
  framing). Owns the count-up.
- **GradePill** — pass/fail + letter where applicable (`grade.A…F` /
  pass=`status.success`, non-pass=`status.warning` framing, never `status.error`
  punitively — see §7).
- **ProgressRing** (data) — animated percentage ring, mono numerals.
- **RubricBreakdown** — per-dimension score + server `feedback` for
  AI/subjective items (`rubricBreakdown[]` from `UnifiedEvaluationResult`).
- **ConfidenceBadge** — confidence routing for AI-graded items
  (`confidence.low/med/high`), icon + label.
- **QuestionCard** — per-question review row (dispatch over the 15 types for
  prompt/answer display, read-only).
- **ContentRenderer** — Markdown + KaTeX for every prompt, explanation, and
  rubric note.
- **AnswerKeyLock** — the server-only guard visual, rendered where a
  model/correct answer would otherwise appear.
- **InsightCard** — "what to review next" nudge.
- **CelebrationBurst** — the ONE celebratory moment (pass / personal-best only).
- **TutorChatBubble** (entry affordance) — "Ask the tutor" deep-links into the
  chat tutor for a weak topic.

**Primitives / containers / data / navigation**

- **AppShell**, **Sidebar**, **Topbar**, **Tabbar**, **Breadcrumb** (back to
  space).
- **Card / Panel / Section / Accordion** (breakdown cards, per-question review).
- **ProgressBar** (per-row breakdown bars), **Stat/KPI** (marks, %), **Badge /
  Chip** (difficulty, section, correctness).
- **Button** (`spark` for the primary "Practice weak topics" CTA on a non-pass;
  `secondary`/`ghost` for "Review answers", "Ask the tutor"), **IconButton**.
- **EmptyState**, **Skeleton**, **InlineAlert/Banner**, **Toast (sonner)**.

**FeedbackPanel** — the per-question server-feedback container. _Note:_
FeedbackPanel is named in `webapps-design.md §2.2` (`shared-ui/feedback`) but is
not in the FOUNDATION §5 domain list. See **Proposed FOUNDATION additions**
below.

**Difficulty progression chart** — `DifficultyProgressionChart` is named in
`webapps-design.md §2.2` (`shared-ui/charts`) but is not in FOUNDATION §5. See
**Proposed FOUNDATION additions**.

### Proposed FOUNDATION additions

1. **`FeedbackPanel`** — promote into FOUNDATION §5 domain components. Anatomy:
   titled panel holding server-provided per-question feedback/explanation (via
   ContentRenderer), correctness chip (icon+label), optional ConfidenceBadge +
   RubricBreakdown slot, and an AnswerKeyLock slot. Used here and on
   StoryPointViewer/PracticeMode/GradingReview. It already exists in
   `shared-ui/feedback`; FOUNDATION should bless it so screens stop hand-rolling
   feedback containers.
2. **`DifficultyProgressionChart`** — promote into FOUNDATION §5 (data/charts).
   Anatomy: ordered per-question dots/steps mapped to difficulty bands, each
   marked correct/incorrect by **icon + label** (not color alone), tooltip per
   point. Reused by TestAnalytics. Tokens: `mastery.*` / `confidence.*` for
   bands, `border.subtle` gridlines.

No new colors, fonts, spacing, radii, shadows, or motion are introduced — both
additions compose entirely from existing tokens.

---

## 5. States

- **Loading (skeleton):** On direct revisit, show a ResultSummary skeleton (gray
  ProgressRing + pill + two stat lines) and three breakdown-card skeletons
  (`Skeleton`, shimmer at `motion.base`). The post-submit transition arrives
  with data already in hand — no skeleton, animate straight into the verdict.
- **Submitting → results handoff:** while `submitTestSession` is in flight
  (owned by the test-taking spec), this screen mounts only once the graded
  session resolves. If the mutation is slow, a `LoadingOverlay` with "Grading
  your test…" copy precedes mount.
- **Empty / no result:** if no completed session exists for this story point,
  render an `EmptyState`: title (Fraunces) "No results yet", body "You haven't
  finished this test. Ready when you are." + primary Button "Start the test →".
  (Mirrors the current `"No results available."` guard, warmed.)
- **Partial:** if `analytics` breakdowns are absent (legacy session) but
  score/percentage exist, render the verdict hero + per-question review and
  **omit** breakdown cards silently (don't show empty chart shells). If
  `difficultyProgression` is empty, hide that chart. If a per-question item
  failed to grade server-side, that QuestionCard shows a neutral "We're still
  grading this one" InlineAlert rather than a verdict.
- **Error:** if the session read fails, show `ErrorState` (distinct from empty):
  "We couldn't load your results right now." + Retry Button. Errors surface via
  the global React Query error boundary mapped through `useApiError`
  (`error.details.code`).
- **Locked (passed + `lockAfterPassing`):** verdict hero shows a sealed/lock
  affordance and an InlineAlert: "You've passed and locked this test — your best
  result is saved." No retake CTA; "Review answers" and "Practice / Tutor"
  remain available.
- **Role-gated variations:** B2B student and B2C consumer render identically —
  only the `LearnerContext` data source differs. No teacher/admin affordances
  appear here. Leaderboard/XP context (if surfaced) is gamification-only and
  never punitive.

---

## 6. Interactions & motion

- **Score count-up:** ProgressRing + percentage animate from 0 → final over
  `motion.slow` with `ease.entrance`; mono digits tick up (tabular). Hero card
  enters with a subtle fade/translate at `motion.base`. Respect
  `prefers-reduced-motion` → numbers snap to final, no count-up.
- **THE celebratory moment (CelebrationBurst):** fires **only** on a **pass** or
  a **personal-best** (current `percentage` > prior best from
  `getStoryPointProgress`). Spring pop + marigold `spark` burst / confetti,
  fired once on mount. This is the single gamification reward beat — do **not**
  fire on a non-pass, on revisit of an already-celebrated result (debounce via a
  "seen" flag), or on any non-gamification interaction. Reduced-motion → replace
  the burst with a static `spark`-tinted ribbon + "Personal best!" / "Passed!"
  label (no particles).
- **No bursts on a non-pass.** A non-pass mounts calmly: hero fades in at
  `motion.base`, GradePill in a warm `status.warning` framing, and the "What to
  review next" InsightCard gets gentle emphasis (a single `ease.standard`
  highlight), never a celebratory pop.
- **"Review answers" CTA:** smooth-scrolls (`motion.base`, `ease.standard`) to
  the per-question review anchor and expands the first card.
- **Per-question accordion:** open/close at `motion.fast`, `ease.standard`; only
  one expanded on mobile. Expanding lazily renders the heavy
  `ContentRenderer`/RubricBreakdown for that item.
- **Confidence reveal:** ConfidenceBadge appears on AI-graded cards with a
  `motion.instant` fade — no attention-grabbing motion (it's informational, not
  celebratory).
- **CTA routing:** "Practice weak topics" →
  `/spaces/:spaceId/practice/:storyPointId`; "Ask the tutor" → opens
  TutorChatBubble/chat keyed to the weakest topic; "Deeper analytics" →
  `/…/analytics`. Hover (web) raises cards to `e2`; mobile uses press feedback.
  No optimistic writes here — this surface is read-only; no confirmations
  needed.

---

## 7. Content & copy (warm, growth-framed)

**Verdict hero**

- Pass: h2 "Nice work — you passed!" · subline "78% · 39 / 50 marks · Pass mark
  70%".
- Personal best (passed or not): a `spark` chip "Personal best!" + "You beat
  your previous best of 71%."
- Non-pass: h2 "Good effort — let's close the gap." (never "Failed", never
  "Wrong"). Subline "62% · 31 / 50 marks · Pass mark 70% — you're close."
  GradePill label reads "Not yet passed" in `status.warning`, paired with an
  icon, **never** a red "FAIL".
- Locked: InlineAlert "You've passed and locked this test — your best result is
  saved."

**Breakdowns**

- Section headers (Fraunces): "By difficulty", "By Bloom's level", "By section",
  "By topic". Row format "Medium · 6 / 10 · 60%" with an icon-bearing bar.

**Difficulty progression**

- Caption: "How the test adapted to you — each step shows the difficulty you
  reached." Correct/incorrect marked "✓ Correct" / "Review" with icons.

**What to review next**

- InsightCard title: "Let's revisit **Proofs** together." Body: "This was the
  trickiest area today — a few minutes of practice will help it click." CTAs:
  "Practice this story point →", "Ask the tutor →".

**Per-question review**

- Correct chip: "✓ Correct". Incorrect chip: "Let's look at this one again"
  (icon + label) — never "Wrong"/"Incorrect" as the primary label.
- FeedbackPanel intro: "Here's what the grader noted:" then server
  `feedback`/`explanation` via ContentRenderer.
- AnswerKeyLock copy: "Answer keys stay sealed — your feedback above shows what
  to improve."

**Empty:** "No results yet — you haven't finished this test. Ready when you
are." · "Start the test →". **Error:** "We couldn't load your results right
now." · "Try again".

All numerics (scores, %, marks, pass mark) in **Spline Sans Mono**;
headings/empty titles in **Fraunces**; labels/body in **Schibsted Grotesk**.

---

## 8. Domain rules surfaced

- **Answer key is NEVER shown to students (raw).** Correct answers live in the
  server-only `answerKeys` subcollection denied to all clients by
  `firestore.rules`. This screen shows **only** server-returned `feedback`,
  `explanation`, correctness (`isCorrect`/`status`), and `rubricBreakdown` from
  the graded `submitTestSession` result. Wherever a model/correct answer would
  naturally sit, render **AnswerKeyLock** so the absence is legible and
  intentional — not a missing-data bug. Even post-submission, the raw key is
  never surfaced; only derived feedback is.
- **Confidence routing for AI-graded items.** Subjective/AI-graded answers carry
  a server `confidence` score surfaced via **ConfidenceBadge** (`confidence.low`
  <0.7 → flagged for human review, `confidence.med` 0.7–0.9 → spot-check,
  `confidence.high` >0.9 → auto-accepted). Low-confidence items may show "A
  teacher will take a second look at this one" — framed as care, not doubt.
- **Timer is server-authoritative — and already past.** No TimerBar here; the
  assessment is complete. The displayed score/marks are the server's
  authoritative grade (from `submitTestSession`), not a client recomputation. If
  the session was auto-submitted on timeout, a neutral note appears ("Time was
  up, so we submitted automatically").
- **Gamification owns the ONE celebratory moment.** CelebrationBurst here is
  reserved for pass / personal-best. No other surface on this screen celebrates;
  everything else stays subtle (FOUNDATION §4).
- **Lock-after-passing.** If `retryConfig.lockAfterPassing` and the learner
  passed, the test is locked — no retake CTA; the best result is preserved and
  shown as locked.
- **Tenant isolation.** B2B reads are tenant-scoped (`tenants/{tenantId}/...`);
  B2C reads come from `platform_public` + `user.consumerProfile`. Resolved by
  `LearnerContext` — the page does not branch on path.
- **Read-only.** This surface performs no writes; all data flows through
  `@levelup/api-client`, Zod-validated, timestamps epoch-ms normalized.

---

## 9. Accessibility

- **Status legible without color (AA):** every correctness/pass/confidence
  indicator pairs an **icon + text label** (FOUNDATION §2.3) — "✓ Correct",
  "Review", "Passed", "Not yet passed", confidence "High / Medium / Low".
  Breakdown bars carry numeric labels, not just fill.
- **Focus order:** Topbar back → verdict heading → primary CTA(s) → breakdown
  cards (left-to-right, top-to-bottom) → progression chart → InsightCard CTAs →
  per-question accordion headers → expanded card contents. Each per-question
  card is a button-headed `Accordion` (`aria-expanded`, `aria-controls`).
- **Keyboard:** all CTAs and accordion headers reachable/operable via
  Tab/Enter/Space; "Review answers" moves focus to the review region after
  scroll (`tabindex=-1` target + focus). Arrow keys move between accordion
  headers.
- **ARIA:** ProgressRing exposes `role="img"` with an `aria-label` "Score 78
  percent, passed". Live region (`aria-live="polite"`) announces the verdict on
  mount ("You scored 78 percent — passed"). CelebrationBurst is `aria-hidden`
  (decorative). Each breakdown row is a labeled group; charts have a text
  summary alternative.
- **Contrast:** all text/bg pairs meet AA; the `spark` accent is used for
  emphasis, never as the sole carrier of meaning.
- **Reduced motion:** `prefers-reduced-motion` disables count-up and the
  CelebrationBurst particles (static `spark` ribbon + label instead); accordion
  uses instant open.

---

## 10. Web ↔ mobile divergence (FOUNDATION §6)

- **Shell:** web = Sidebar + Topbar; mobile = bottom **Tabbar**, no persistent
  sidebar; back via Topbar/native back.
- **Breakdown grid → stacked cards:** lg 2×2 grid collapses to a single-column
  vertical stack on mobile.
- **Per-question review:** web may show the first card expanded with others
  collapsed; mobile is a strict one-open accordion to conserve height.
- **Hover → press:** card `e2` hover-raise on web; press/active feedback on
  mobile (touch targets ≥44px).
- **No ⌘K CommandPalette on mobile.**
- **CelebrationBurst:** web uses CSS/Framer particles; RN uses Reanimated
  `spring` for the pop (FOUNDATION §4) — same trigger rule (pass / personal-best
  only), same reduced-motion fallback.
- **Component parity:** ResultSummary, GradePill, ConfidenceBadge,
  RubricBreakdown, FeedbackPanel, AnswerKeyLock, InsightCard, CelebrationBurst
  share names/props 1:1 between `shared-ui` (web) and `ui-native` (mobile); only
  the renderer differs.

---

## 11. Claude-design prompt (ready to paste)

```
Design the "Timed Test — Results Review" screen for the Auto-LevelUp STUDENT web app.
Strictly conform to the Lyceum design system (Direction A — "Modern Scholarly") in
docs/rebuild-spec/design/00-FOUNDATION.md. Use ONLY its tokens (cite by semantic name:
bg.canvas, bg.surface, text.primary/secondary/muted, brand.primary, spark, border.subtle,
status.success/warning, confidence.low/med/high, grade.A–F, mastery.*, radius.lg, e1/e2,
motion.fast/base/slow, ease.standard/entrance) and ONLY its components. Fonts: Fraunces
(display/headings/hero numbers), Schibsted Grotesk (UI/body/labels), Spline Sans Mono
(scores, %, marks). Do not invent colors, fonts, spacing, radii, shadows, motion, or variants.

Context: this is the post-submission results view at /spaces/:spaceId/test/:storyPointId
(results branch of TimedTestPage). It is READ-ONLY; the timed test is already over and graded
server-side. Tone: warm, encouraging, growth-framed — celebrate progress; frame mistakes as
"Let's look at this one again", never "Wrong"/"Failed".

Build, inside AppShell (Sidebar+Topbar on web, bottom Tabbar on mobile):
1. A ResultSummary verdict hero: ProgressRing + animated count-up percentage (mono digits),
   GradePill (Passed in status.success / "Not yet passed" in status.warning — icon+label, never
   a red FAIL), marks "39 / 50", pass mark, and primary CTAs (spark Button "Practice weak topics"
   on a non-pass; secondary "Review answers", "Ask the tutor"). Include an AnswerKeyLock chip
   "Answer keys stay sealed".
2. Breakdown cards in a responsive 2×2 grid (stack on mobile): By difficulty, By Bloom's level,
   By section, By topic — each row = labeled ProgressBar with "6 / 10 · 60%" and an icon.
3. A DifficultyProgressionChart showing the adaptive path, correctness marked by icon+label
   (legible without color).
4. An InsightCard "what to review next" with Practice + Tutor CTAs.
5. A per-question review Accordion (one open on mobile) of read-only QuestionCards: prompt via
   ContentRenderer, the learner's answer, a FeedbackPanel with server feedback/explanation, plus
   RubricBreakdown + ConfidenceBadge (confidence.low/med/high, icon+label) for AI-graded items.
   Render AnswerKeyLock where a correct/model answer would otherwise appear.

THE ONE celebratory moment: fire CelebrationBurst (spring pop + marigold spark/confetti) ONLY on
a pass or a personal-best — once, on mount, debounced on revisit. Never on a non-pass and nowhere
else on the screen. Respect prefers-reduced-motion (static spark ribbon + label; no count-up).

Hard rules: NEVER show a raw answer key (server-denied) — only server-provided feedback,
explanations, correctness, and rubric breakdowns; use AnswerKeyLock where the key would sit.
Encode every status with icon + text label, not color alone (WCAG AA). Add aria-live verdict
announcement and an aria-label'd ProgressRing. Provide loading-skeleton, empty ("No results yet —
ready when you are · Start the test"), error ("We couldn't load your results right now · Try again"),
partial (omit absent breakdowns silently), and locked (passed + lockAfterPassing) states.
All data is read via @levelup/api-client (submitTestSession result / getTestSession /
getStoryPointProgress); the UI never touches Firestore.
```
