# 09 · Evaluation Config Visibility — requirements

**Owner mandate:** on **every** AI question surface, the student should be able
to **see how they'll be evaluated** — the objectives, the rubric, the enabled
dimensions — presented as **fun, friendly icons** on the page. The learner sees
the "config" of the question up front and while answering: what matters, what
they're graded on, what to aim for. This is a first‑class requirement and
applies to all six types (01–06).

**Coordination:** the evaluation contract is owned by **Layer‑2
(`layer2-eval-prompts`, sess_1784443737179_l0h5rhlw4)**. The exact schema, the
client‑safe projection, and which fields must never reach the student
(answer‑key leak risk) are being confirmed with them — see §4. **Do not expose
any field before Layer‑2 confirms it's student‑safe.**

---

## 1. Why

Transparency = better answers + trust. If a student knows the rubric rewards
"clear structure" and "evidence," they write toward it. Showing objectives and
dimensions turns grading from a black box into a coaching contract. It also
makes the _feedback_ (Surface G) legible — the same dimensions the student saw
up front are the ones scored afterward. **Up‑front config and after‑the‑fact
feedback should visibly be the same rubric.**

## 2. What to show (per question)

Presented as a compact, friendly, iconified panel — call it the **"How you'll be
evaluated"** card / expandable strip on the answer page.

- **Learning objectives** — what this question is checking (icon: target /
  flag). Source: item payload (`publicLearningObjectives` /
  `typeData.objectives`), **not** the config callable — see §4.
- **Rubric criteria** — each criterion the answer is scored against: `name` +
  short `description` + `maxScore` (+ `weight`). Same set that becomes the
  **rubric breakdown** in feedback.
- **Criterion score ladder (`levels[]`)** — the standout "fun icons": each
  criterion's `levels[]{ label, description, score }` = a friendly ladder of
  what each score level looks like. Great for a tappable, gamified "aim for
  this" visual.
- **Enabled evaluation dimensions** — e.g. Clarity, Correctness, Depth,
  Structure — each a labeled icon chip, with `priority` (HIGH/MED/LOW) as
  emphasis/weight.
- **Passing bar** — `passingPercentage` if set.
- **Points available** — total, already have `PointsChip`.
- **Do NOT show** `modelAnswer`, `evaluatorGuidance`, `promptGuidance`,
  `confidenceConfig`, `holisticGuidance` (see §4 leak flag), or any answer‑key
  field.

Each item is an **icon + label**, tappable to reveal a one‑line description. Fun
and light — not a legal rubric table. Think "badges of what counts."

## 3. Where it lives on each surface

- **Answer page (Surface A):** a collapsible **"How you'll be evaluated"**
  section under the prompt — glanceable icon row by default, expandable to see
  descriptions. Available in focus mode too (a peek).
- **Evaluating state (Surface F):** the rotating hints tie directly to these
  dimensions ("Looking at Clarity…") — reinforces the contract.
- **Feedback (Surface G):** the rubric breakdown + per‑dimension feedback are
  the _same_ dimensions, now scored — visually echo the up‑front card so the
  student sees the loop close.
- **Pure chat (Surface J):** the "What to cover" objectives already exist in the
  conversation intro — align that with this iconified language.

## 4. Data contract (CONFIRMED with Layer‑2)

There is **no new backend needed** — the read already exists and is student‑safe
by server‑side projection.

**Callable:** `v1.levelup.getEvaluationConfig` (offline‑exam twin:
`v1.autograde.getEvaluationConfig`).

- Contract:
  `packages/api-contract/src/callables/levelup/get-evaluation-config.ts`
- Service: `packages/services/src/levelup/evaluation-config.ts`
- View builder: `packages/services/src/evaluation/config-view.ts`
  (`buildEvaluationConfigView`)
- **Input:** `{ spaceId, itemId? }` · **Output:**
  `{ config: { agent, rubric, settings, provenance } }`
- **Gate:** `space.read` = `any-authed` → **students can call it.** It
  **auto‑role‑projects**: for a student `authoring=false`, so every ⚷ secret is
  stripped **server‑side**. You _cannot_ leak by calling it — the projection is
  the guarantee.

**Student‑safe fields (post‑projection):**

- **`rubric`** (`projectRubric`): `scoringMode`;
  `criteria[]{ id, name, description, maxScore, weight, levels[]{ label, description, score } }`;
  `dimensions[]{ id, name, description, priority(HIGH|MEDIUM|LOW), weight, scoringScale }`;
  `passingPercentage`; `showModelAnswer`. → **criterion `levels[]` are the
  perfect "fun icons" — a score ladder** (label + what each score level means).
  Show these.
- **`settings`** (`projectEvaluationSettings`):
  `enabledDimensions[]{ id, name, description, priority, weight, scoringScale }`;
  `displaySettings{ showStrengths, showKeyTakeaway, prioritizeByImportance }`.
- **`agent`** (`projectAgent`):
  `id, type, name, publicDescription, identity, openingMessage, strictness, feedbackStyle, supportedLanguages, defaultLanguage, maxConversationTurns`
  (relevant for chat questions).

**Dimension labels for feedback:** join `Object.keys(structuredFeedback)` (the
scored dimension ids) against `settings.enabledDimensions[].name` from this
callable — that's how the up‑front dimensions and the after‑the‑fact feedback
become visibly the _same_ set.

**NEVER student‑safe (projection strips these — do not source them elsewhere):**
`rubric.modelAnswer`, `rubric.evaluatorGuidance`, `dimension.promptGuidance`,
`criterion.evaluatorGuidance`, `settings.confidenceConfig`,
`agent.systemPrompt`/`rules`/`evaluationObjectives`, and
`privateEvaluationObjectives` (answer‑key, never in this view).

### Learning objectives come from a DIFFERENT place (NOT this callable)

`getEvaluationConfig` returns rubric/settings/agent but **not** the question's
objectives. Learner‑safe objectives ride on the **item question payload you
already load**:

- **`chat_agent_question`** → `publicLearningObjectives[]{ id, label }`
  (learner‑safe by design).
- **Generic AI questions** → `typeData.objectives[]`.
- **NEVER** render `privateEvaluationObjectives` (server‑only answer‑key).

### `holisticGuidance` is a SECRET — never render (Layer‑2 confirmed + patched, live in prod)

`rubric.holisticGuidance` is a scoring hint ("award full marks when…") = an
answer‑key leak. Layer‑2 has **stripped it from the student view** (live). **Do
NOT surface `holisticGuidance`** — rendering it re‑opens the leak that was just
closed.

**Consequence for holistic rubrics:** for `scoringMode = 'holistic'`, the only
student‑safe fields today are
`{ scoringMode, holisticMaxScore, passingPercentage }` — there is **no
learner‑safe descriptive prose**. So a "what holistic grading means here"
blurb/icon has nothing safe to read yet. Holistic rubrics show **mode + max +
pass %** only.

- **`criteria_based` / `dimension_based` / `hybrid`** rubrics are **fully
  unblocked** with rich safe fields (`criteria[]` + `levels[]`, `dimensions[]`)
  — the full icon experience works.
- **Holistic** shows **mode + max + pass % only** for v1. The `holisticSummary`
  enrichment is **NOT prioritized** (owner decision, 2026‑07‑19) — no
  descriptive holistic icon in v1.

## 5. States & edge cases

- **No config authored** — hide the card gracefully (don't show an empty
  rubric).
- **Config present but display‑gated** — respect `EvaluationDisplaySettings`.
- **Long rubric** — collapse to top‑N by priority (`prioritizeByImportance`),
  "show all."
- **Chat questions** — objectives already shown; don't double up.

## 6. Accessibility

- Every icon has a text label (icon‑alone never conveys meaning).
- Expand/collapse is keyboard/screen‑reader operable; descriptions announced.
- Priority/weight conveyed by more than color.

## 7. Motion (ties to [08](08-experience-and-motion.md))

- Config chips enter with the shared stagger‑in.
- Tapping a chip smoothly reveals its description.
- The up‑front dimensions and the feedback dimensions can share a subtle visual
  identity (same icon/color) so the student _feels_ the loop close between
  asking and grading.

---

**For Claude Design:** design the **"How you'll be evaluated"** card (glanceable
icon row + expanded detail) as a reusable component present on every AI answer
surface, and make the feedback rubric visibly the _same_ dimensions. Fun,
iconified, trustworthy — not a spreadsheet.
