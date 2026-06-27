# Exam Questions Editor

_The teacher's review surface for AI-extracted exam questions — correct what
Panopticon's Gemini extraction got wrong, set marks, order, and rubrics, then
trust the grading pipeline downstream._

---

## 1. Purpose & Primary User

**Primary user:** Teacher (or tenant admin acting as teacher) who owns or
co-manages an `Exam`.

**Job-to-be-done:** _"After I upload a scanned question paper and Gemini
extracts the questions, I need to quickly verify the extraction is correct — fix
garbled text, set/confirm `maxMarks`, fix the order, split multi-part questions,
attach rubrics — so that when student answer sheets are graded by RELMS, every
question is graded against a correct, trustworthy rubric. I also need to add or
remove questions the AI missed or hallucinated."_

This screen is the **trust gate** between AI extraction
(`question_paper_extracted`) and publishing (`published`). Garbage here
propagates into every submission's grade, so the editor is built for fast
scanning, high signal on low-confidence extractions, and minimal friction to
correct.

Secondary: re-run extraction on a single question (`extractQuestions` mode
`single`) when a question's source image is readable but the AI mangled it;
cross-link a question to a LevelUp learning `linkedItemId` for
analytics/remediation.

---

## 2. Entry Points & Route

**Route:** `/exams/:examId` — **Questions** tab (default tab once
`status >= question_paper_extracted`). Sibling tabs: Submissions, Settings.

**Entry points:**

- From the new-exam wizard `/exams/new` step "Review" → lands here after
  extraction completes.
- From `/exams` list → row click → ExamDetail → Questions tab.
- From a `question_paper_uploaded` exam where extraction is mid-flight →
  Questions tab shows the in-progress/extraction state.
- Breadcrumb: `Exams / {exam.title} / Questions`.

**Common-API reads/writes** (see `specs/common-api.md`):

- **Read** — `exams.get(examId)` (live) for the `Exam` doc (status,
  `gradingConfig.allowRubricEdit`, `questionPaper`, `stats`). Questions read
  live from the `questions/` subcollection via the exam repo's question stream
  (ordered by `order`). `mapping`/`imageUrls` and `questionPaper.images[]`
  resolve to **HTTPS URLs from the API**, never raw Storage paths.
- **Write** — all mutations go through **`saveExam`** callable (consolidated
  CRUD): edit question `text`/`maxMarks`/`order`, add/remove questions, edit
  `subQuestions[]`, set `linkedItemId`, set `questionType`. `saveExam` is
  **server-authoritative** for the status machine and enforces
  `POST_PUBLISH_LOCKED_FIELDS`.
- **Re-extract** — **`extractQuestions`** callable, `mode: 'single'`, with the
  target `questionId` (re-runs Gemini against that question's source image
  region).
- **Rubric edits** — open the dedicated rubric editor (`subquestion-rubric`
  screen); persists `UnifiedRubric` back through `saveExam`.

---

## 3. Layout — Wireframe-as-Text

Rendered inside **AppShell** (Sidebar + Topbar). The exam header + tab strip is
shared across all ExamDetail tabs; only the tab body differs.

### Desktop (lg ≥ 1024) — max content width 1200

```
┌─ AppShell ─────────────────────────────────────────────────────────────────┐
│ Sidebar │ Topbar (tenant switcher · search · ⌘K · notifications · profile)  │
│         ├──────────────────────────────────────────────────────────────────┤
│  Exams  │ Breadcrumb: Exams / Algebra Mid-Term / Questions                  │
│  Spaces │                                                                    │
│  ...    │ ┌─ Exam Header (Section, shared across tabs) ───────────────────┐ │
│         │ │ H2 "Algebra Mid-Term"   [StatusBadge: question_paper_extracted]│ │
│         │ │ Math · Class 9-A,9-B · 60 min · 50 marks · pass 18            │ │
│         │ │                         [Re-extract all] [Publish exam ▸]     │ │
│         │ └───────────────────────────────────────────────────────────────┘ │
│         │ [ Questions* | Submissions | Settings ]   ← Tabs                   │
│         │                                                                    │
│         │ ┌─ Toolbar row ─────────────────────────────────────────────────┐ │
│         │ │ "12 questions · 50 / 50 marks"   [⚠ 2 need review]            │ │
│         │ │                         [Reorder ⠿] [+ Add question]          │ │
│         │ └───────────────────────────────────────────────────────────────┘ │
│         │                                                                    │
│         │ ┌─ QuestionCard (order 1) ──────────────────────────────────────┐ │
│         │ │ ⠿  Q1   [type: standard ▾]      maxMarks [ 5 ]   ▸ marks/order │ │
│         │ │ ┌─ ContentRenderer (md+KaTeX) ─────────┐  ┌ source thumb ─┐   │ │
│         │ │ │ Solve for x:  $2x + 3 = 11$          │  │ [img p.1 ▦]   │   │ │
│         │ │ └──────────────────────────────────────┘  └───────────────┘   │ │
│         │ │ [ConfidenceBadge: high 0.96]  extractedBy: ai                 │ │
│         │ │ [Edit text] [Edit rubric ▸] [Re-extract] [⋯ remove]           │ │
│         │ └───────────────────────────────────────────────────────────────┘ │
│         │                                                                    │
│         │ ┌─ QuestionCard (order 2) — LOW CONFIDENCE ─────────────────────┐ │
│         │ │ ⠿  Q2   [type: multi-part ▾]    maxMarks [ 10 ]               │ │
│         │ │ ⚠ InlineAlert: "Readability issue — verify extracted text"    │ │
│         │ │ [ContentRenderer ...]   [ConfidenceBadge: low 0.42]           │ │
│         │ │ ┌ Sub-parts (Accordion) ───────────────────────────────────┐  │ │
│         │ │ │ (a) Define ...        [4]  [Edit rubric ▸]                │  │ │
│         │ │ │ (b) Prove ...         [6]  [Edit rubric ▸]                │  │ │
│         │ │ │                            [+ Add sub-part]               │  │ │
│         │ │ └───────────────────────────────────────────────────────────┘  │ │
│         │ │ [Edit text] [Re-extract] [⋯]                                  │ │
│         │ └───────────────────────────────────────────────────────────────┘ │
│         │                                  [+ Add question]                  │
│         └────────────────────────────────────────────────────────────────────┘
```

- Single-column stack of `QuestionCard`s (cards read better than a table for
  rich math content + thumbnails). Max width 1200; the card inner content column
  caps at ~720 reading measure for the `ContentRenderer`.
- Source-image thumbnail sits in a right rail inside each card on lg, revealing
  the scanned region the question was extracted from (Popover → full-res on
  click).

### Tablet (md 768–1023)

- Same single-column card stack; source thumbnail moves **below** the rendered
  text within the card (stacked, not side rail). Header actions collapse
  `[Re-extract all]` into a `⋯` overflow `Popover`.

### Mobile (sm < 768)

- Tabs become a horizontally scrollable segmented control under the header. Each
  `QuestionCard` is full-bleed (gutter 16). Inline marks/order/type controls
  collapse into a per-card "Edit details" `Sheet`. Drag-reorder replaced by ▴/▾
  move buttons (touch ≥ 44px). `[+ Add question]` is a sticky bottom bar button.

---

## 4. Components Used (Lyceum inventory only)

**Navigation / shell:** AppShell, Sidebar, Topbar, Breadcrumb, Tabs
(Questions/Submissions/Settings), CommandPalette (⌘K).

**Containers:** Section (exam header + toolbar), Card (via `QuestionCard`),
Accordion (sub-parts of multi-part questions), Popover (source-image full view,
type/overflow menus), Drawer/Sheet (mobile "Edit details"), Modal/Dialog (Add
question, confirm remove, re-extract-all confirm), Tooltip.

**Primitives:** Button (`primary` Publish, `secondary` Add question, `ghost`
Edit/Re-extract, `danger` Remove), IconButton (drag handle ⠿, overflow ⋯), Input
(maxMarks numeric, order), Textarea (edit question text — markdown/KaTeX),
Select (`questionType`: standard | diagram | multi-part), Combobox
(`linkedItemId` cross-domain search), FileDrop (attach/replace `imageUrls` on a
manual question).

**Data / feedback:** Stat (header KPIs: question count, total marks, "N need
review"), Badge (`ExamStatus`), Chip/Tag (`extractedBy: ai | manual`,
`questionType`), EmptyState, Skeleton, InlineAlert/Banner (`readabilityIssue`,
post-publish lock, allowRubricEdit-off), Toast (sonner — save success/failure),
ConfirmDialog (remove question, re-extract overwrites edits), FormFieldError,
LoadingOverlay (re-extract in flight).

**Domain components:**

- `QuestionCard` — primary repeating unit (reused; here in "editor" affordance
  mode with inline controls).
- `ContentRenderer` — renders question `text` (Markdown + KaTeX), sub-part text,
  and any `modelAnswer` preview inside the rubric editor entry. **Never**
  renders answer-key/model-answer in a student-reachable context.
- `ConfidenceBadge` — surfaces `extractionConfidence` (icon + label + numeric,
  mapped to `confidence.low/med/high`).
- `RubricBreakdown` — read-only preview of the attached `UnifiedRubric`
  (criterion names + maxPoints) shown collapsed per question; "Edit rubric"
  routes to `subquestion-rubric`.
- `AnswerKeyLock` — guard visual on any `modelAnswer`/rubric model-answer field,
  reinforcing server-side gating.

**Proposed addition (justified):** `ReorderList` — a thin wrapper providing
keyboard-accessible drag-reorder (handle ⠿, `aria-grabbed`, arrow-key
reordering) over a list of `QuestionCard`s. Not in §5 inventory; justified
because reordering rich cards with a11y is a recurring need (also used in
space-editor) and should be a shared primitive rather than ad-hoc per screen.
Add to foundation §5 Data group.

---

## 5. States

| State                         | Trigger                                                                                     | UI                                                                                                                                                                                                                                                                                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Loading**                   | `exams.get` / question stream pending                                                       | Header `Skeleton` (title, badges, KPIs) + 3 `QuestionCard` skeletons (text lines + thumb block). No layout shift on resolve.                                                                                                                                                                                                               |
| **Extracting (in-progress)**  | `status == question_paper_uploaded` and extraction running                                  | Banner `InlineAlert(info)`: "Extracting questions from the uploaded paper…" with `ProgressBar` if `questionPaper` count is streaming; cards stream in as Gemini emits them. `[Publish]` disabled.                                                                                                                                          |
| **Empty (no extraction yet)** | `status == draft` / no `questionPaper`                                                      | `EmptyState` (Fraunces title): "No questions yet" — body: "Upload a scanned question paper to extract questions automatically, or add questions manually." Actions: `[Upload question paper]` (→ wizard upload step) · `[Add question manually]`.                                                                                          |
| **Empty (extracted 0)**       | extraction returned `questionCount == 0`                                                    | `EmptyState(warning)`: "We couldn't find any questions in this paper." Actions: `[Re-extract all]` · `[Add manually]` · link "Check the uploaded image".                                                                                                                                                                                   |
| **Success / loaded**          | questions present                                                                           | Toolbar KPIs + ordered `QuestionCard` stack.                                                                                                                                                                                                                                                                                               |
| **Partial / needs-review**    | one+ questions have `readabilityIssue` or `extractionConfidence < confidence.low threshold` | Toolbar shows `[⚠ N need review]` chip (status.warning); affected cards float to attention via a left border in status.warning and an `InlineAlert` inside the card. Clicking the chip filters/scrolls to flagged cards.                                                                                                                   |
| **Error (load)**              | repo/callable error                                                                         | `InlineAlert(error)`: "Couldn't load this exam's questions." `[Retry]`. Tenant-scoped: if not in tenant, show generic not-found (no leakage).                                                                                                                                                                                              |
| **Error (save)**              | `saveExam` rejects                                                                          | Inline `FormFieldError` on the offending field + `Toast(error)`. Optimistic edit rolls back.                                                                                                                                                                                                                                               |
| **Re-extract in flight**      | `extractQuestions(single)` pending on a card                                                | Per-card `LoadingOverlay` + spinner on the button; rest of list interactive.                                                                                                                                                                                                                                                               |
| **Post-publish locked**       | `status >= published`                                                                       | Read-mostly: `text`/order/`maxMarks` controls disabled with lock affordance; persistent `Banner`: "This exam is published. Questions and marks are locked. Editing here is disabled to protect released grading." Only non-locked fields (e.g. `linkedItemId`, allowed metadata) remain editable, per server `POST_PUBLISH_LOCKED_FIELDS`. |
| **Rubric editing disabled**   | `gradingConfig.allowRubricEdit == false`                                                    | "Edit rubric" buttons disabled with Tooltip: "Rubric editing is turned off for this exam (Settings)." `RubricBreakdown` still shown read-only.                                                                                                                                                                                             |

**Permission/role gating:**

- **Teacher who is `createdBy` or co-teacher of the exam's classes:** full edit
  (pre-publish).
- **Tenant admin:** same as owner.
- **Read-only role (e.g. observer/parent never routes here; scanner role has no
  editor access):** if somehow reached, editor renders read-only with all mutate
  actions hidden, not merely disabled.
- All actions additionally gated by exam `status` (server is the authority;
  client mirrors).

---

## 6. Interactions & Motion

**Edit question text:** Click `[Edit text]` → inline `Textarea` expands in place
(height grow, `base` 220ms `ease.standard`) with a live `ContentRenderer`
preview pane (split or toggle). Save on blur/`⌘↵`; optimistic update — card text
swaps instantly, `saveExam` fires; on reject, revert + `Toast(error)`. `Esc`
cancels.

**Edit maxMarks / order:** Inline numeric `Input`. Marks change recomputes the
header "N / total marks" Stat optimistically. If sum of `maxMarks` ≠
`Exam.totalMarks`, header Stat shows a soft `status.warning` mismatch hint
("Marks total 48 of 50") — non-blocking, surfaced before publish.

**Reorder:** Drag handle ⠿ (or ▴/▾ on touch). On drop, cards animate to new
positions (`fast` 160ms, `ease.standard`); `order` fields renumber and a single
batched `saveExam` persists the new ordering. Reduced-motion → instant snap, no
slide.

**Add question:** `[+ Add question]` → `Modal`: fields `text`
(Textarea+preview), `maxMarks`, `questionType`, optional `FileDrop` for source
image. On create → `saveExam` appends with `extractedBy: 'manual'`,
`extractionConfidence` omitted (no `ConfidenceBadge`, shows `manual` chip). New
card enters with a brief `entrance` (220ms) highlight, no celebratory motion
(this is staff tooling, not gamification).

**Remove question:** `⋯ → Remove` → `ConfirmDialog`: "Remove Q{n}? This deletes
its rubric and can't be undone." `danger` confirm. Optimistic removal; trailing
cards renumber.

**Re-extract single:** `[Re-extract]` → `ConfirmDialog` if the question has
manual edits: "Re-extracting will replace your edits to this question with a
fresh AI extraction." On confirm → per-card `LoadingOverlay`;
`extractQuestions(mode:'single')`. Result swaps in with updated
`ConfidenceBadge`; `Toast(success/error)`. `[Re-extract all]` in header →
`ConfirmDialog` warning it overwrites all manual edits.

**Manage sub-parts (multi-part):** Switching `questionType` to `multi-part`
reveals the sub-parts `Accordion`. Add/remove `subQuestions[]` rows (label,
text, maxMarks, optional rubric). Sub-part marks roll up; parent `maxMarks`
shows derived sum.

**Edit rubric:** `[Edit rubric ▸]` navigates to `subquestion-rubric` (push
transition `page` 420ms). Returning restores scroll position and shows updated
`RubricBreakdown` preview.

**Publish:** Header `[Publish exam ▸]` (`primary`). Enabled only when
validations pass (≥1 question, every question has a `maxMarks > 0` and an
attached rubric, no unresolved `readabilityIssue` is hard-blocking — soft-warn
otherwise). `ConfirmDialog` summarizing the lock consequence. Server runs the
status machine; on success status badge transitions to `published` and the lock
banner appears.

All motion respects `prefers-reduced-motion`; no marigold/spark anywhere on this
screen (reserved for gamification — staff exam tooling is calm and precise).

---

## 7. Content & Copy (precise, staff tone)

- **Tab label:** "Questions".
- **Toolbar KPI:** "{n} questions · {sum} / {totalMarks} marks". Mismatch hint:
  "Marks total {sum} of {totalMarks}."
- **Needs-review chip:** "{n} need review".
- **Confidence badge labels:** "High confidence", "Spot-check", "Needs review"
  (mapped to `confidence.high/med/low`) — always icon + label, never color
  alone.
- **Source chip:** "AI-extracted" / "Added manually".
- **Readability alert:** "Readability issue — the scan was hard to read here.
  Verify the text and marks before publishing."
- **allowRubricEdit-off tooltip:** "Rubric editing is turned off for this exam.
  Change it in Settings."
- **Post-publish banner:** "This exam is published. Questions and marks are
  locked to protect grading already in progress. To change them, you'd need to
  unpublish (this re-grades affected submissions)."
- **Re-extract confirm:** "Re-extract this question? This replaces your manual
  edits with a fresh AI extraction."
- **Remove confirm:** "Remove Q{n}? This also deletes its rubric. This can't be
  undone."
- **Empty (no questions):** Title "No questions yet". Body "Upload a scanned
  question paper to extract questions automatically, or add them by hand."
- **Empty (0 extracted):** Title "We couldn't find any questions". Body "The
  paper may be blurry, rotated, or blank. Re-extract, add questions manually, or
  re-upload a clearer scan."
- **Load error:** "Couldn't load this exam's questions. Check your connection
  and try again."
- **Save error toast:** "Couldn't save your change. Nothing was lost — try
  again."

Tone: direct, second-person, consequence-aware. No exclamation, no emoji, no
encouragement language (that register is for students).

---

## 8. Domain Rules Surfaced

- **Answer-key never shown to students:** model answers and rubric model-answers
  live behind `AnswerKeyLock`; `ContentRenderer` only renders them in this
  teacher-authenticated editor context. This screen is structurally teacher-only
  — students/parents never route here, and the `subquestion-rubric` editor it
  links to is server-guarded.
- **Confidence routing is upstream of grading:** `extractionConfidence` shown
  here is _extraction_ confidence (paper → question), distinct from the
  per-answer grading `confidence` that later routes `QuestionSubmission`s to
  `needs_review`. Correcting low-confidence extractions here is what makes
  downstream RELMS grading trustworthy. Surface both clearly but don't conflate.
- **Server-authoritative status machine:** `saveExam` owns `ExamStatus`
  transitions; the client never sets status locally. Publish/lock behavior is
  enforced server-side; the UI mirrors `POST_PUBLISH_LOCKED_FIELDS`.
- **Post-publish field locks:** once `published`,
  `text`/`maxMarks`/`order`/rubric structure are locked server-side. The UI
  disables and explains rather than letting an edit fail.
- **`allowRubricEdit` gating:** when false, rubric edits are blocked (UI +
  server). `RubricBreakdown` remains visible read-only.
- **Tenant isolation:** every read is tenant-scoped; per-tenant Gemini key
  drives `extractQuestions`. Cross-tenant exam IDs resolve to not-found, never a
  leak.
- **Cross-domain link:** `linkedItemId` ties a question to a LevelUp learning
  `Item`/story point for analytics and remediation; it's metadata only and
  (typically) editable post-publish.
- **Manual provenance preserved:** `extractedBy: 'manual'` questions carry no
  confidence badge; re-extraction overwrites manual edits (hence the confirm).

---

## 9. Accessibility

- **Focus order:** Breadcrumb → header actions → tab strip → toolbar (KPI, add)
  → each `QuestionCard` in DOM order matching visual `order` (drag handle → type
  select → marks input → edit text → edit rubric → re-extract → overflow).
  Modals/Sheets trap focus; on close, focus returns to the invoking control.
- **Keyboard:** All inline edits keyboard-operable. Reorder via `ReorderList`:
  focus handle, `Space` to grab (`aria-grabbed=true`), `↑/↓` to move,
  `Space`/`Enter` to drop, `Esc` to cancel. `⌘↵` saves an open Textarea; `Esc`
  cancels. Tabs are roving-tabindex with `←/→`.
- **ARIA:** Each card is `role="article"` with `aria-labelledby` to its "Q{n}"
  heading. `ConfidenceBadge`/status use `aria-label` carrying full text ("Needs
  review, confidence 0.42"). `readabilityIssue` alert uses `role="alert"`
  (polite for the count chip, assertive only on direct flag). Numeric `Input`s
  have `aria-describedby` linking to the marks-total hint.
- **Contrast:** all confidence/status/grade pairings meet WCAG AA (foundation
  §2.3); status is never color-only — every badge/border has icon + text.
  Disabled locked controls keep ≥3:1 and pair with the explanatory banner so
  state isn't conveyed by dimming alone.
- **Reduced motion:** reorder/insert/remove animations become instant;
  LoadingOverlay uses a static spinner without easing flourish. No parallax, no
  spark.
- **Targets:** all interactive controls ≥44px touch target on mobile; drag
  handles get an enlarged hit area.

---

## 10. Web ↔ Mobile Divergence

| Aspect              | teacher-web (today)                                  | Future RN / scanner-web                                                                                                  |
| ------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Layout              | Single-column cards, source thumb in right rail (lg) | Stacked cards, thumb below text; full-bleed gutters                                                                      |
| Reorder             | Drag handle ⠿ + keyboard                             | ▴/▾ move buttons (no precise drag); long-press to enter reorder mode                                                     |
| Inline detail edits | Inline Input/Select in card                          | Per-card "Edit details" Sheet/Drawer                                                                                     |
| Hover affordances   | Hover reveals overflow/tooltips                      | Press; overflow always-visible `⋯`; tooltips → long-press Popover                                                        |
| Command palette     | ⌘K CommandPalette                                    | None (Tabbar nav)                                                                                                        |
| Add question        | `[+ Add question]` button → Modal                    | Sticky bottom-bar button → full-screen Sheet                                                                             |
| Source image view   | Popover → full-res                                   | Full-screen viewer with pinch-zoom                                                                                       |
| Re-extract          | Inline per-card + header bulk                        | Same; bulk behind `⋯` overflow                                                                                           |
| scanner-web         | n/a (editor not exposed)                             | scanner-web is **intake only** (`uploadSource: scanner`) — no question editing; this screen stays teacher-web/RN-teacher |

Component **names/props match 1:1** across `shared-ui` and `ui-native`; only the
renderer and reorder interaction differ.

---

## 11. Claude-Design Prompt (ready to paste)

```
You are designing the "Exam Questions Editor" screen for Auto-LevelUp (AutoGrade area),
conforming EXACTLY to the Lyceum design system in
docs/rebuild-spec/design/00-FOUNDATION.md. Do not invent tokens, fonts, or component
variants — compose only from the Lyceum inventory and cite tokens by name.

CONTEXT
- Route: /exams/:examId, "Questions" tab, inside AppShell (Sidebar + Topbar + Breadcrumb).
- Role: Teacher/admin reviewing AI-extracted ExamQuestions before publishing an exam.
- Reads: exams.get(examId) live + questions/ subcollection stream ordered by `order`.
  Image URLs come back as HTTPS from the API (never Storage paths).
- Writes: ALL mutations via the saveExam callable (server-authoritative status machine +
  POST_PUBLISH_LOCKED_FIELDS). Single re-extract via extractQuestions(mode:'single').
- Each ExamQuestion: text (render via ContentRenderer = Markdown + KaTeX), maxMarks, order,
  questionType (standard | diagram | multi-part), imageUrls (source thumbnail),
  extractedBy (ai | manual), extractionConfidence (→ ConfidenceBadge, confidence.low/med/high),
  readabilityIssue (→ InlineAlert warning), subQuestions[] (multi-part → Accordion),
  rubric: UnifiedRubric (preview via RubricBreakdown; "Edit rubric" routes to subquestion-rubric),
  linkedItemId (cross-domain Combobox to a LevelUp learning item).

BUILD
- Shared exam header Section: title (Fraunces), ExamStatus Badge, metadata line,
  [Re-extract all] (secondary) + [Publish exam] (primary). Tabs: Questions | Submissions | Settings.
- Toolbar: Stat "{n} questions · {sum}/{totalMarks} marks", "{n} need review" warning chip,
  [Reorder] + [+ Add question].
- Single-column stack of QuestionCards (NOT a table — rich math + thumbnails). Inner text capped
  to ~720 reading measure. Each card: drag handle, Q number heading, questionType Select,
  maxMarks Input, ContentRenderer body, source thumbnail (right rail lg / below on md/sm),
  ConfidenceBadge + provenance chip, [Edit text][Edit rubric][Re-extract][⋯ Remove], and a
  sub-parts Accordion when multi-part.

STATES: skeleton load; extracting (info banner + streaming cards); empty (upload-or-add-manually);
0-extracted (warning); needs-review partial (warning left-border + InlineAlert on flagged cards);
load/save errors; per-card LoadingOverlay during re-extract; POST-PUBLISH LOCKED (disabled controls
+ persistent lock banner); allowRubricEdit=false (rubric buttons disabled + tooltip).

DOMAIN RULES TO HONOR: answer-key/model-answer behind AnswerKeyLock, never student-reachable;
extraction confidence is distinct from grading confidence; status is server-authoritative;
post-publish field locks; tenant isolation; manual questions carry no confidence badge;
re-extract overwrites manual edits (ConfirmDialog).

MOTION: subtle only (no spark/marigold — staff tooling). Reorder fast 160ms ease.standard,
inline edits base 220ms, route to rubric editor page 420ms. Respect prefers-reduced-motion.

A11Y: keyboard reorder (aria-grabbed + arrows), focus return after modals, role="article" cards
with aria-labelledby, status via icon+label (never color alone), WCAG AA, ≥44px touch targets.

Responsive: lg side-rail thumb; md stacked thumb + overflow header; sm full-bleed cards, ▴/▾
reorder, Edit-details Sheet, sticky Add button, no ⌘K.

Output clean React + Tailwind reading Lyceum CSS custom properties, reusing QuestionCard,
ContentRenderer, ConfidenceBadge, RubricBreakdown, AnswerKeyLock.
```
