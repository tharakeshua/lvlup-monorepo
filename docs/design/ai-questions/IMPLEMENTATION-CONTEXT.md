# AIQ Implementation Context — design system, existing files, per-worker change maps

Coordinator-authored context for the 5 AIQ workers (W1 core, W2 feedback, W3
media, W4 chat, W5 discuss/history). Read alongside:
`lvlup-ai-questions-design/ai-questions/` (visual truth) and
`docs/design/ai-questions/` 00–09 (requirements + owner-locked decisions).

## 1. Design system (the pasted folder)

Location:
`/Users/subhang/Desktop/Projects/auto-levleup/lvlup-ai-questions-design/ai-questions/`

| File                   | What it is                                                                                                                                                                                                                                                                                                                                                            |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tokens/lyceum.css`    | Token SSOT. Key vars: `--brand-primary/-hover/-subtle/-muted` (indigo), `--bg-canvas/surface/surface-sunken/inset`, `--border-subtle/strong/focus`, `--text-*`, `--grade-a…f`, `--confidence-high/med/low`, `--dur-instant/fast/base/slow/page`, `--ease-standard/entrance/exit`, `--font-display/ui/mono`, `--glow-spark`, spacing `--space-*`, radius `--radius-*`. |
| `tokens/fonts.css`     | Font faces (display/ui/mono).                                                                                                                                                                                                                                                                                                                                         |
| `components.css`       | Web reference kit (571 lines): `.btn` variants, `.chip`, `.card`, `.rubric__*` (criterion/score full/partial/zero), `.grade-pill--a…f`, `.confidence--*`, `.option--correct/incorrect`, `.progress`, `.toast`, `.timeline`, `.upload-item--*`, `.bubble--tutor/user`. Use as semantic reference for RN equivalents — most already have Lyceum RN counterparts.        |
| `mobile/mobile-ai.css` | THE mobile AI-question kit (251 lines). Class → component map below.                                                                                                                                                                                                                                                                                                  |
| `mobile/*.card.html`   | 6 surface cards = screen-by-screen truth incl. motion notes in `<p class="frame__note">`.                                                                                                                                                                                                                                                                             |

### mobile-ai.css → RN component map (who builds what)

| CSS classes                                                                                                                                                                                | Component (owner)                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `.composer .write .ph .caret .wordcount(--near)`                                                                                                                                           | UnifiedComposer (W1)                                                                       |
| `.cap .cap--brand .cap-row`                                                                                                                                                                | CapabilityPills (W1)                                                                       |
| `.prompt .prompt--collapsed .eyebrow .chip-diff .chip-pts .m-top .pos`                                                                                                                     | QuestionPrompt + top bar (W1)                                                              |
| `.hye .hye__head/__chips/__sec .hye-chip(--dim,--hi) .hye-crit .ladder .ladder-step(--aim) .passbar`                                                                                       | HowYoullBeEvaluated card (W1); scored re-render on result (W2)                             |
| `.banner(--warn) .dock(--flat)`                                                                                                                                                            | Banners + submit dock (W1)                                                                 |
| `.kbd-*`                                                                                                                                                                                   | keyboard-docking behavior spec only (W1)                                                   |
| `.overlay(--center) .eval-dots .aurora .sealed`                                                                                                                                            | Evaluating state (W1)                                                                      |
| `.verdict(--good/--close/--grow) .verdict__icon .scorebar(--ok/--mid/--low) .fb-sec .fb-item .growth .takeaway .mistake-chip .sev--*` `.dim-ring .conf--*` `.pctbar .rubric-row .best-tag` | FeedbackResult (W2)                                                                        |
| `.part(--uploading/--failed) .part__thumb/__body/__x .parts .upbar .wave(--live) .rec-btn(--live) .rec-timer .rec-stage .rec-hint .audio-pill`                                             | Parts stack visuals (W1 renders stack shell; W3 owns capture UIs, waveform, upload states) |
| `.code-head .code-surface`                                                                                                                                                                 | Code-type composer variant (W1)                                                            |
| `.bubble(--ai/--me) .bubble__meta .chat-flow .chat-composer .typing .starter`                                                                                                              | Chat surface (W4)                                                                          |
| `.att(--current) .att__body .meta-row .sheet .sheet__grab`                                                                                                                                 | Attempt history + discuss sheet (W5)                                                       |
| `.ref-row .ref-tile`                                                                                                                                                                       | Reference/source tiles (W5 discuss)                                                        |

### Surface cards → screens

| Card                             | Surface                                                                                                                                                           | Owner                   |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `answer-page.card.html`          | A1–A6: empty/writing/attachments/rubric-expanded/validation/keyboard                                                                                              | W1                      |
| `capability-variants.card.html`  | Per-type pill/composer variants: text, paragraph (full-screen default), code (mono surface), audio (Record primary + rec-stage), image (Camera/Add photo primary) | W1 (+W3 capture stages) |
| `focus-and-evaluating.card.html` | Focus mode full-screen + Evaluating (commit-once, backgroundable, eval-dots/aurora) + sealed state                                                                | W1                      |
| `feedback-result.card.html`      | Verdict, scorebar, scored HYE chips, strengths/growth/takeaway, rubric rows w/ ladder, severity chips, confidence, try-again                                      | W2                      |
| `chat-question.card.html`        | Chat-agent interview: bubbles, typing, starters, objectives, finish flow                                                                                          | W4                      |
| `history-and-discuss.card.html`  | Attempt history list + discuss bottom sheet                                                                                                                       | W5                      |

## 2. Existing app files (what changes)

App: `apps/mobile-student` (Expo SDK 52 / React 18 / nativewind / expo-router
real segments only).

### W1 — owns edits to these existing files

- `src/screens/learn/ContentViewerScreen.tsx` — TODAY: renders prompt + per-type
  inputs via `question-view.tsx`, submit at ~line 176 (`recordAttempt.mutate`
  with onSuccess→`toOutcome`, onError + pending states landed by mob-eval-fix —
  MUST survive), `AttemptFeedback`/`FeedbackPanel` result block (will be
  replaced by W2's FeedbackResult), chat_agent delegation guard
  (`isAgentAssessment` — untouched). CHANGE: replace the answering region with
  the new UnifiedComposer + HYE + banners + capability pills; keep the
  authoritative read path `progress.evaluation`.
- `src/screens/learn/PracticeModeScreen.tsx` — same composer integration for
  practice flow (`useItems` + `useRecordItemAttempt`).
- `src/components/question-view.tsx` — current per-type input routing; refactor
  to capability-config-driven composer variants (registry-driven:
  `packages/domain/src/entities/content/question-types/registry.ts`).
- `src/components/attempt-bar.tsx` — status strip; restyle to tokens.
- `src/components/lyceum.tsx` — RN Lyceum kit (UI-3). EXTEND with the ported
  tokens (motion durations/easings, brand vars already partially exist in
  `src/theme/colors.ts` + `tailwind.config.js`); do not fork.
- NEW: `src/components/ai-question/**` (composer.tsx, capability-pills.tsx,
  hye-card.tsx, prompt.tsx, banners.tsx, evaluating.tsx, focus-mode.tsx,
  tokens.ts).
- Config data: `useEvaluationConfig`-equivalent — callable
  `v1.levelup.getEvaluationConfig` (check `packages/query` for an existing hook;
  add one there if missing, following defineQuery pattern).

### W2 — owns NEW `src/components/ai-question/feedback/**`

- Reference existing: `FeedbackPanel`/`toFeedbackProps` used by
  ContentViewerScreen (in `src/components/` — find via question-view/feedback
  imports) = the component being superseded; StoredEvaluation schema at
  `packages/domain/src/entities/content/stored-evaluation.ts`; real payload
  fixtures in mob-eval-fix's tests/report (AG evaluation: score/maxScore,
  summary object|string, structuredFeedback severity items,
  strengths/weaknesses/missingConcepts, confidence).

### W3 — owns NEW `src/features/answer-media/**`

- Existing seams to study: how ChatAgentQuestion/tutor handled media
  (`src/components/questions/ChatAgentQuestion.tsx` media handling pre-redesign;
  the Issue4b memory: media captured but not evaluated — verify FIXED path),
  storage transport in `packages/api-client` (`createApiClient(...).storage` —
  DP-1), services `media-eval-seam` tests (packages/services), gateway image
  seam (`AiImageStore`, 14MB budget, storagePath→bytes). Upload path shape for
  levelup content vs autograde (`tenants/{t}/...` scoping rule).
- Answer payload schema per type: `packages/domain` question payloads
  (audio/image_evaluation `questionData` + expected learner answer shape —
  verify what `recordItemAttempt` accepts, `packages/api-contract`
  record-item-attempt callable schema).

### W4 — owns existing conversation PRESENTATION files

- `src/components/conversation/ConversationScaffold.tsx`,
  `ConversationTranscript.tsx`, `ConversationComposer.tsx`,
  `ConversationStatusCard.tsx`, `ConversationResult.tsx`,
  `ConversationModeHeader.tsx`, `index.ts` +
  `src/components/questions/ChatAgentQuestion.tsx` (thin adapter).
- FORBIDDEN: `src/features/conversation/**`
  (useConversationController/useConversationOperations/reducer/persistence/ProjectionSync)
  — live prod runtime, behavior tests in `src/features/conversation/__tests__/`
  must stay green.

### W5 — owns

- `src/components/questions/QuestionHelpSheet.tsx` (discuss sheet — uses
  useConversationController in question_help mode; visual-only on mechanics).
- NEW `src/components/ai-question/history/**`. Data reality check:
  `useStoryPointProgress` → `progress.items[itemId]` (attempts count,
  lastEvaluation/evaluation, status) — see
  `src/screens/learn/_shared/normalize.ts` + the storyPointProgress items record
  shape (fake-vs-real gotcha in LVL-1). If only last-evaluation is stored, build
  for that and report the per-attempt-history backend gap.

## 3. Data contracts (Layer-2 locked)

- Student feedback = `StoredEvaluation` (domain `content/stored-evaluation.ts`);
  tolerate summary object|string.
- Eval config = `v1.levelup.getEvaluationConfig` student projection:
  `{scoringMode, dimensions, passingPercentage, criteria+levels[]}` —
  `holisticGuidance`/modelAnswer/evaluatorGuidance are stripped (G13, live).
  Objectives from item payload `publicLearningObjectives`/`typeData.objectives`.
- NO `dimensionBreakdown[]` yet (owner decision D3 pending) — build the slot,
  render existing fields.
- **Criteria vs dimensions on the RESULT surface (Layer-2 authority note,
  W1/W2):** CRITERION scores exist TODAY via
  `StoredEvaluation.rubricBreakdown[] = {criterionId?, criterionName, score, maxScore, comment?}`
  → the scored rubric rows/ladder render now; join to HYE criteria by
  `criterionId` when present, FALLBACK to `criterionName` (id is optional).
  DIMENSION scores do NOT exist yet — dimensions carry only qualitative
  `structuredFeedback[dimId] = {severity, message, suggestion}`; so scored dim
  chips show feedback presence/severity only, and the score-ring is the
  pending-D3 placeholder. Do not invent per-dimension numbers.
- AnswerPart seam:
  `{id, kind:'image'|'audio', storagePath, mimeType, name?, sizeBytes?, durationSec?, status:'uploading'|'ready'|'error'}`;
  bundle `{text, parts[]}`.

## 4. Owner-locked UX decisions (from Layer-1 review)

Per-question capability toggles now · try-again pre-fills last answer ·
paragraph = full-screen default · evaluating = commit-once + backgroundable ·
discuss always available · audio is LLM-input-only v1 · holistic rubric shows
mode+max+pass% only (no guidance) · motion per card notes (stagger-in, 600ms
settle, shake on disabled submit).

## 5. Gates (every worker)

mobile tsc clean · expo export mountability · behavior tests green (W4:
conversation reducer suite) · screenshots vs the card designs (harness pattern
`scripts/ui3-*.mjs`; login student.test@subhang.academy / Test@12345; content =
AI Assessment Lab `spc_subhang-ai-lab-space-ai-assessment-lab_09dd3311c0`, 6
story points, one per type) · report to task + aiq-w1-core (integration/release
owner, sess_1784462470282_xv68h6lm3).
