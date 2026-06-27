# Learning Content View (Story Point Viewer) — Student Web Design Spec

> Conforms to **Lyceum** (`docs/rebuild-spec/design/00-FOUNDATION.md`, Direction
> A — "Modern Scholarly"). Token, type, spacing, motion, and component names are
> cited by their FOUNDATION §2/§3/§4/§5 semantic names — never re-defined here.
> Student tone: warm, encouraging, growth-framed.

---

## 1. Purpose & primary user

**Primary user:** A learner working through a standard/learning story point —
either a **B2B school student** (role `student`, tenant-scoped) or a **B2C
consumer learner** (no membership, served from `platform_public`). Same screen,
same components; only the data source differs (resolved by `LearnerContext`).

**Job to be done:** "Let me move through this lesson one piece at a time — read
the material, attempt the questions, see kind feedback that tells me how I did
and how to improve, ask the tutor when I'm stuck, and feel my progress
accumulate." This is the _non-timed_, _unlimited-attempt_, low-pressure learning
surface (distinct from the timed-test and practice screens). Mistakes are framed
as growth, not failure.

---

## 2. Entry points & route

**Route:** `/spaces/:spaceId/story-points/:storyPointId` (B2B) and
`/consumer/spaces/:spaceId/story-points/:storyPointId` (B2C — same page
component, context-routed per `webapps-design.md` §5.2 "route on context, not
path prefix").

**Entered from:**

- SpaceViewer → Contents tab → a `StoryPointNode`/card whose `type` is
  standard/learning (timed_test/test → `/test`, practice → `/practice`).
- `StoryPointTrack` prev/next navigation between adjacent story points.
- Dashboard "Continue learning" recommendation deep link.

**Reads / writes (all via `@levelup/api-client`; UI never touches Firestore —
`common-api.md` §3.3 levelup module):**

| Action                                                                      | Callable / repo read                                                                                     |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Space header                                                                | `v1.levelup.getSpace` (repo: `SpacesRepo.get`)                                                           |
| Story-point list (prev/next, sections)                                      | `v1.levelup.listStoryPoints` (repo: `StoryPointsRepo.list`)                                              |
| Items for this story point (`UnifiedItem[]`)                                | `v1.levelup.listItems`                                                                                   |
| Space-level progress summary                                                | `v1.levelup.getSpaceProgress`                                                                            |
| Per-story-point progress (`questionData.status`, attempts, completed flags) | `v1.levelup.getStoryPointProgress`                                                                       |
| Submit a deterministic answer                                               | shared `auto-evaluate` package (local, instant) → then `v1.levelup.recordItemAttempt`                    |
| Submit an AI/subjective answer                                              | `v1.levelup.evaluateAnswer` (now **persists progress server-side** — no second `recordItemAttempt` call) |
| Mark a material complete                                                    | `v1.levelup.recordItemAttempt` (`itemType: 'material'`)                                                  |
| Inline tutor message                                                        | `v1.levelup.sendChatMessage`                                                                             |

Headless decomposition (FOUNDATION-agnostic, RN-reusable; resolves the "god
component" debt): `useStoryPointViewer` (data + section grouping),
`useItemSubmission` (hybrid eval orchestration + optimistic state),
`useItemChat` — presentational pieces consume them. Responses are Zod-validated
and timestamps normalized to epoch-ms at the repo edge.

---

## 3. Layout — wireframe-as-text

Rendered inside **AppShell** (Sidebar + Topbar on web; Tabbar on mobile).
Content column max reading width per FOUNDATION §4 (reading 720 for material
prose; up to 1200 for the page frame). Page gutters: 16 / 24 / 32 (mobile /
tablet / desktop).

```
┌─ AppShell ────────────────────────────────────────────────────────────┐
│ Topbar: tenant switcher · ⌘K · notifications · profile                 │
├──────────┬─────────────────────────────────────────────────────────────┤
│ Sidebar  │  Breadcrumb: Spaces / {Space title} / {Story point title}    │
│ (nav)    │                                                              │
│          │  ┌─ Story-point header ──────────────────────────────────┐  │
│          │  │ h1 (Fraunces) {storyPoint.title}                       │  │
│          │  │ secondary description · XPMeter delta hint (subtle)    │  │
│          │  └────────────────────────────────────────────────────────┘  │
│          │  ┌─ StoryPointTrack rail (prev ◂ · n/N · ▸ next) ─────────┐  │
│          │  └────────────────────────────────────────────────────────┘  │
│          │                                                              │
│          │  ┌─ Section (Accordion item, collapsible) ───────────────┐  │
│          │  │ ▸ {section.title}      completedCount/total  ✓(mastered)│ │
│          │  │  ── when open ──                                        │  │
│          │  │  ItemNavigator:                                         │  │
│          │  │   [1][2][3][4]…  numbered nodes, status-colored         │  │
│          │  │   ┌─ Current item card ──────────────────────────────┐ │  │
│          │  │   │ type icon · "Item 3 of 7" · difficulty Chip       │ │  │
│          │  │   │                                                   │ │  │
│          │  │   │  material → ContentRenderer (md + KaTeX)          │ │  │
│          │  │   │  question → QuestionCard → AnswerInput (per type) │ │  │
│          │  │   │           → [Submit]  · [Ask tutor] · [History]   │ │  │
│          │  │   │  post-submit → FeedbackPanel (server feedback)    │ │  │
│          │  │   │           → AttemptHistoryPanel (expandable)      │ │  │
│          │  │   └───────────────────────────────────────────────────┘ │  │
│          │  │   [◂ Previous]                         [Next ▸]         │  │
│          │  └────────────────────────────────────────────────────────┘  │
│          │  … more sections … (+ "Other items" if unsectioned)         │
│          │                                                              │
│          │  Footer rail: [◂ Previous SP]            [Next SP ▸]         │
│          └──────────────────────────────────────────────────────────────┘
│  (Inline tutor: ChatTutorPanel docks as Drawer/Sheet, keyed to item)    │
└────────────────────────────────────────────────────────────────────────┘
```

**Responsive behavior:**

- **lg ≥1024:** Sidebar persistent; single reading column centered; section
  accordions full width; ItemNavigator numbered nodes wrap inline; tutor opens
  as a right-side Drawer (does not cover the item).
- **md 768–1023:** Sidebar collapses to icon rail; reading column fills;
  numbered nodes wrap to 2 rows; tutor Drawer becomes a slide-over Sheet.
- **sm <768:** AppShell switches to **Tabbar** (bottom). One section open at a
  time encouraged; ItemNavigator nodes scroll horizontally in a single
  touch-scrollable row; prev/next become full-width stacked buttons (≥44px touch
  targets); tutor is a full-height bottom **Sheet**; difficulty Chip and "n of
  N" stack above the question.

If a story point has **no sections**, render a single ItemNavigator for all
items (no accordion). If sections exist but items carry no `sectionId`, fall
back to the single navigator.

---

## 4. Components used (FOUNDATION §5 only)

**Navigation / containers:** AppShell, Sidebar, Topbar, Tabbar (mobile),
Breadcrumb, Accordion (collapsible sections), Card, Drawer/Sheet (tutor +
attempt history on mobile), Button (primary / secondary / ghost / **spark** for
Submit), IconButton.

**Domain components:**

- **StoryPointTrack** + **StoryPointNode** — the prev/next story-point rail and
  mastery-state nodes.
- **ContentRenderer** — the single Markdown + KaTeX renderer for all material
  items (and for question stems/feedback prose).
- **QuestionCard** — dispatches over the 15 question types; renders stem,
  attachments, and the submit affordances.
- **AnswerInput** — the per-type input (mcq, mcaq, true-false, numerical, text,
  paragraph, code, fill-blanks, fill-blanks-dd, matching, jumbled, audio,
  image_evaluation, group-options, chat_agent_question).
- **TutorChatBubble** (inside the ChatTutorPanel Drawer) — inline AI tutor keyed
  to the current item.
- **ConfidenceBadge** / **GradePill** — surfaced inside FeedbackPanel for
  AI-graded items (confidence._ and grade._ scales).
- **XPMeter** + **CelebrationBurst** — the single celebratory moment on
  item-complete / section-mastered / 100% story-point completion.
- **AnswerKeyLock** — visual where the absence of a stored answer must be
  legible (see §8).
- **Chip/Tag** (difficulty), **ProgressBar/ProgressRing** (section
  completedCount/total), **Skeleton**, **EmptyState**, **ErrorState**,
  **InlineAlert/Banner**, **Toast (sonner)**, **Badge** (status on numbered
  nodes — never color-only; pairs with icon + label).

**FeedbackPanel + AttemptHistoryPanel + ImageLightbox** are composed from the
above (FeedbackPanel = Card + ContentRenderer + ConfidenceBadge/GradePill +
RubricBreakdown when present; AttemptHistoryPanel = Accordion/DefinitionList +
GradePill; ImageLightbox = Modal/Dialog over attachment images).

**Proposed FOUNDATION additions:** none strictly required — but flagging two
compositions for promotion so they don't drift per-app:

- **`ItemNavigator`** (numbered, status-colored, one-item-at-a-time stepper) —
  currently it is an app-local composite. Recommend promoting it to a FOUNDATION
  §5 domain component (anatomy: numbered nodes + current-item Card + prev/next),
  since the same pattern recurs in PracticeMode. Until promoted, it is composed
  from Badge + Card + Button.
- **`FeedbackPanel`** is referenced in the brief as a unit; FOUNDATION §5 lists
  its parts (ConfidenceBadge, GradePill, RubricBreakdown) but not the panel
  wrapper. Recommend adding **`FeedbackPanel`** as a named §5 domain component
  (post-submission server-feedback container) so its "never shows raw answer
  key" contract lives in one spec.

---

## 5. States

- **Loading (skeleton):** Header renders immediately (breadcrumb + title from
  list cache if warm). Below it, 3 `Skeleton` blocks (~h-32, radius.lg) stand in
  for sections. ItemNavigator nodes render as small skeleton pills. No
  spinner-only screens.
- **Empty (story point has no items):** `EmptyState` — Fraunces title "Nothing
  here yet", secondary copy, and a "Back to {space}" Button. Warm, not alarmed.
- **Empty (section open, zero items):** Inline text in section body: "No items
  in this section yet — check back soon." (text.secondary).
- **Error (items failed to load):** `ErrorState` (distinct from empty per
  webapps-design §2.2) — InlineAlert with status.error icon + label, a kind
  message, and a **Retry** Button (re-runs `v1.levelup.listItems`, not a full
  page reload). Header still renders so the user keeps context.
- **Partial:** Story point loaded but a single AI evaluation in flight → that
  item's QuestionCard shows a localized loading state on the Submit button
  (spark Button → spinner) while the rest stays interactive. If
  `getStoryPointProgress` lags `listItems`, render items with neutral
  (notStarted) node status until progress resolves, then reconcile.
- **Success:** Sections render; numbered nodes carry persisted status from
  `questionData.status` (correct → mastery.mastered green; partial →
  status.warning amber; incorrect → status.error red, framed as "revisit";
  material complete → mastery.mastered; untouched → mastery.notStarted). Current
  item card shows material or QuestionCard.
- **Permission / role-gated variation:** B2B vs B2C is data-source only (tenant
  vs `platform_public` via `LearnerContext`) — identical UI. No teacher/admin
  variant of this screen. A B2C learner who hasn't purchased the space never
  reaches this route (gated upstream at the store/space level).
- **Revisit behavior (intentional):** On reload, the answer form is **fresh and
  interactive** (in-memory evaluations are NOT restored) so the learner can
  reattempt; only the **status colors** on numbered nodes persist (from
  `questionData.status`). AttemptHistoryPanel still shows the durable history.

---

## 6. Interactions & motion (cite FOUNDATION §4 tokens)

- **Section expand/collapse:** Accordion height/opacity transition at
  `motion.base` (220ms) `ease.standard`; chevron rotates at `motion.fast`.
  Default: all sections collapsed.
- **Numbered-node selection:** instant content swap (`motion.instant` 100ms) of
  the current-item card; selected node gets a `border.focus` ring. Prev/Next
  buttons step `currentIndex`.
- **Material complete:** "Mark as read/complete" → optimistic node flip to
  mastery.mastered at `motion.fast`; `recordItemAttempt` fires in the
  background; on failure, revert + Toast.
- **Answer submit (deterministic types):** Submit (**spark** Button) → instant
  local `auto-evaluate` result → FeedbackPanel fades in at `motion.base`
  `ease.entrance`; node recolors. Zero network latency for the common case.
  `recordItemAttempt` persists in the background (optimistic).
- **Answer submit (AI/subjective types):** Submit → button enters loading;
  `v1.levelup.evaluateAnswer` runs; FeedbackPanel fades in on resolve (server
  persists progress, so node status reconciles from the response). A kind
  interim copy ("Reading your answer…") shows while awaiting.
- **Celebration (the ONE reserved moment):** On item-correct / section-mastered
  / 100% story-point completion → **CelebrationBurst** spring pop + marigold
  **spark** burst over the XPMeter, exactly per FOUNDATION §4. Not scattered
  onto any other feedback. Honors `prefers-reduced-motion` (burst → a single
  static spark + XP tick).
- **Tutor:** "Ask tutor" opens ChatTutorPanel Drawer at `motion.base` (slide-in
  `ease.entrance`); TutorChatBubble messages stream in; keyed to the current
  item so context follows the navigator.
- **Attachments:** thumbnail → ImageLightbox opens as Modal at `motion.fast`;
  focus trapped; Esc closes.
- **Confirmations:** none destructive here (reattempts are encouraged, not
  gated) — so no ConfirmDialog. Toasts only for background-write failures.

---

## 7. Content & copy (warm, encouraging, growth-framed)

- **Header:** `{storyPoint.title}` (Fraunces). Sub: `{storyPoint.description}`.
  If absent: no filler.
- **Story-point-not-found (rare):** "We couldn't find this lesson — it may have
  moved. Back to {space}."
- **Section meta:** "{completed}/{total} done" + a "All done ✓" affordance when
  complete.
- **Submit button:** "Submit answer" (spark). Material: "Mark as read".
- **AI in-flight:** "Reading your answer…"
- **Deterministic feedback — correct:** "Nice — that's right." (status.success,
  with icon + label).
- **Deterministic feedback — partial:** "You're close. Let's look at this part
  again." (status.warning).
- **Deterministic feedback — incorrect:** "Not quite yet — let's work through
  it." (status.error, never "Wrong"). Always offer **"Try again"** and **"Ask
  the tutor"**.
- **AI feedback:** show the server-returned `summary`, `strengths`,
  `weaknesses`, `missingConcepts` under warm headings: "What you did well",
  "Where to grow", "Worth revisiting". Show ConfidenceBadge/GradePill from
  server.
- **Empty story point:** title "Nothing here yet", body "This lesson doesn't
  have any content yet. We'll let you know when it's ready."
- **Items error:** title "We couldn't load this lesson", body "Something
  hiccuped on our end. Give it another go.", button "Retry".
- **Attempt history (empty):** "No attempts yet — give it a try when you're
  ready."
- **Completion celebration:** "Lesson complete — great work!" with XP delta.

Never display correctness or the stored answer for an item the learner hasn't
yet submitted. Frame every miss as a next step, never a verdict.

---

## 8. Domain rules surfaced

- **Answer-key is NEVER shown to students (global rule).** Correct answers live
  in a server-only `answerKeys` subcollection that `firestore.rules` denies to
  all clients; the client physically cannot read them. This is a _learning_
  (non-timed) surface, so **post-submission** the screen may show the
  server-returned feedback/explanation/correctness and `RubricBreakdown` — but
  it renders only what `auto-evaluate` (deterministic) or
  `v1.levelup.evaluateAnswer` (AI) returns, **never the raw stored key**. Before
  any submission for an item, no correctness is revealed. Where a question type
  would naturally "show the answer" (e.g. matching/fill-blanks review) but the
  learner hasn't earned it, render the **AnswerKeyLock** visual to make the
  absence legible and intentional rather than a bug.
- **Status comes from persisted `questionData.status`, not from a client-held
  key.** Node colors are driven by the server-persisted status
  (correct/partial/incorrect) plus any in-session in-memory evaluation — color
  is always paired with an icon + label (never color-alone), per FOUNDATION §2
  contrast rule.
- **Server-persisted progress for AI items.** `v1.levelup.evaluateAnswer`
  persists progress server-side; the client does NOT make a second
  `recordItemAttempt` call for AI-graded answers (avoids double-write).
  Deterministic items still call `recordItemAttempt` to persist the
  locally-computed attempt.
- **Gamification = the one celebratory motion moment** (CelebrationBurst),
  reserved for XP/completion here; everything else stays subtle.
- **Tenant isolation / LearnerContext.** B2B reads are tenant-scoped
  (`tenants/{tenantId}/...`); B2C reads come from `platform_public` +
  `user.consumerProfile`. The screen resolves the source via `LearnerContext`
  and is otherwise identical.
- **No timer on this screen.** This is the unlimited-attempt learning surface —
  there is no `TimerBar` and no server-deadline pressure (that lives on the
  timed-test screen). Reattempts are unbounded and encouraged.

---

## 9. Accessibility

- **Focus order:** Breadcrumb → SP prev/next rail → first section trigger →
  (when open) numbered nodes → current-item content → Submit → Ask tutor →
  History → Prev/Next → next section → footer SP rail.
- **Keyboard:** Accordion triggers are buttons (Enter/Space toggle,
  `aria-expanded`). Numbered nodes form a roving-tabindex group (Arrow keys move
  between nodes, Enter selects); each node has `aria-label="Item {n}, {status}"`
  (e.g. "Item 3, correct"). Prev/Next reachable by Tab. AnswerInput types follow
  their native a11y patterns (radio group for mcq, checkbox group for mcaq,
  listbox for matching, etc.). Tutor Drawer traps focus, Esc closes, returns
  focus to "Ask tutor". ImageLightbox traps focus, Esc closes.
- **ARIA / status:** status is conveyed by icon + text label, never color alone
  (FOUNDATION §2). FeedbackPanel uses `role="status"` / `aria-live="polite"` so
  screen readers announce results on submit. The AI in-flight state announces
  "Reading your answer". Section completion count is in an accessible label, not
  just visual.
- **Contrast:** all token pairs meet WCAG AA (FOUNDATION §2): body 4.5:1,
  large/UI 3:1. Difficulty Chips and status badges use the semantic scales which
  are AA-verified.
- **Reduced motion:** `prefers-reduced-motion` disables the CelebrationBurst
  spring/particles (replaced by a static spark + XP tick), section transitions
  become instant, and the tutor Drawer fades without slide.
- **Math content:** ContentRenderer (KaTeX) emits accessible MathML alongside
  rendered output.

---

## 10. Web ↔ mobile divergence (FOUNDATION §6)

| Concern              | Web                              | Mobile (RN, future learner app)                 |
| -------------------- | -------------------------------- | ----------------------------------------------- |
| Shell                | AppShell Sidebar + Topbar        | bottom **Tabbar**; header collapses             |
| Section accordions   | full-width; multiple may be open | one-open-at-a-time encouraged; full-width cards |
| ItemNavigator nodes  | wrap inline across rows          | single horizontally-scrollable touch row        |
| Item navigation      | hover states; click              | press states; swipe between items optional      |
| Tutor                | right-side **Drawer**            | full-height bottom **Sheet**                    |
| Attempt history      | inline expandable / Popover      | bottom Sheet                                    |
| Attachments          | ImageLightbox Modal              | native full-screen image viewer                 |
| Command palette      | ⌘K present                       | **absent**                                      |
| Submit / Prev / Next | inline buttons                   | full-width stacked, ≥44px touch targets         |
| Celebration          | CelebrationBurst (framer-motion) | spring pop (Reanimated), same marigold spark    |

Component **names and props are 1:1** between `shared-ui` (web) and `ui-native`
(mobile) — only the renderer differs. Logic lives in the headless
`useStoryPointViewer`/`useItemSubmission`/`useItemChat` hooks, shared verbatim.

---

## 11. Claude-design prompt (ready to paste)

```
Design the "Learning Content View (Story Point Viewer)" screen for the Auto-LevelUp
STUDENT web app, strictly conforming to the Lyceum design system
(docs/rebuild-spec/design/00-FOUNDATION.md, Direction A "Modern Scholarly").
Cite tokens by semantic name only — do NOT invent colors, fonts, spacing, radii,
shadows, motion, or component variants.

CONTEXT
- Route: /spaces/:spaceId/story-points/:storyPointId (B2B) and the context-routed
  B2C twin. A non-timed, unlimited-attempt learning surface for a learner.
- Data via @levelup/api-client only (never Firestore directly): v1.levelup.listItems,
  getStoryPointProgress, getSpace, listStoryPoints; submit via the shared auto-evaluate
  package (deterministic, instant) or v1.levelup.evaluateAnswer (AI; persists progress
  server-side); v1.levelup.recordItemAttempt for materials + deterministic items;
  v1.levelup.sendChatMessage for the tutor.

LAYOUT
- Inside AppShell (Sidebar + Topbar; Tabbar on mobile). Breadcrumb: Spaces / {space} /
  {story point}. Fraunces h1 title + secondary description.
- A StoryPointTrack prev/next rail (with n/N).
- UnifiedItem[] grouped by sectionId into collapsible Accordion sections. Each section:
  title, completedCount/total ProgressRing, "all done" check. Inside each open section,
  an ItemNavigator: a row of numbered, status-colored nodes (one item at a time) +
  a current-item Card + Prev/Next.
- Material items → ContentRenderer (Markdown + KaTeX). Question items → QuestionCard →
  per-type AnswerInput (15 types: mcq, mcaq, true-false, numerical, text, paragraph,
  code, fill-blanks, fill-blanks-dd, matching, jumbled, audio, image_evaluation,
  group-options, chat_agent_question). Below the input: a spark Submit button, an
  "Ask tutor" ghost button, and an expandable AttemptHistoryPanel.
- After submit: FeedbackPanel (server feedback + ConfidenceBadge/GradePill +
  RubricBreakdown when present). ChatTutorPanel opens as a right Drawer (bottom Sheet on
  mobile), keyed to the current item. ImageLightbox Modal for attachments.

STATES: skeleton (header + 3 section blocks), empty (warm EmptyState), error
(ErrorState + Retry), partial (single AI eval in flight, rest interactive), success.
On reload the form is fresh/interactive; only node status colors persist from
questionData.status.

DOMAIN RULES (must honor):
- Answer-key is NEVER shown. Render only server-returned feedback/correctness
  post-submission; show NO correctness before submit; use the AnswerKeyLock visual where
  the absence of an answer must be legible. Node status comes from persisted
  questionData.status (correct=mastery.mastered, partial=status.warning,
  incorrect=status.error), always paired with icon + label, never color alone.
- No timer (this is the unlimited-attempt learning surface).
- The ONE celebratory motion (CelebrationBurst spring pop + marigold spark over the
  XPMeter) is reserved for item-correct / section-mastered / 100% completion. Everywhere
  else motion stays subtle (motion.instant/fast/base, ease.standard/entrance). Respect
  prefers-reduced-motion.

TONE: warm, encouraging, growth-framed. "Not quite yet — let's work through it." and
"You're close. Let's look at this one again." — never "Wrong". Offer "Try again" and
"Ask the tutor" on every miss.

ACCESSIBILITY: roving-tabindex numbered nodes with aria-label "Item {n}, {status}";
Accordion triggers with aria-expanded; FeedbackPanel role=status / aria-live=polite;
focus-trapped Drawer + Lightbox; WCAG AA contrast; reduced-motion fallbacks.

Deliver: a desktop (lg) layout and a mobile (sm) layout, using only Lyceum tokens and the
FOUNDATION §5 components named above (AppShell, Breadcrumb, Accordion, StoryPointTrack/Node,
ItemNavigator, ContentRenderer, QuestionCard, AnswerInput, FeedbackPanel, ConfidenceBadge,
GradePill, RubricBreakdown, AttemptHistoryPanel, TutorChatBubble, XPMeter, CelebrationBurst,
AnswerKeyLock, ImageLightbox, EmptyState, ErrorState, Skeleton).
```
