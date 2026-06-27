# AI Agent Configuration (Tutor / Evaluator) — Design Spec

> Conforms to the **Lyceum** foundation
> (`docs/rebuild-spec/design/00-FOUNDATION.md`). All tokens, type, spacing,
> motion and components are cited by name — never re-pasted or invented.

The **Agents** tab of the space editor: author the per-space AI agents that
power Socratic tutoring (`sendChatMessage`) and AI grading (`evaluateAnswer`).
For each `Agent` (`packages/shared-types/src/levelup/agent.ts`) the staff user
sets name, role (`tutor` | `evaluator`), system prompt / identity, per-subject
guidance, model + temperature override, role-specific rules, an active flag, and
which agent is the space default. The screen surfaces the **safety posture**
(prompt-injection guarding, blocked topics, cost implications) and a **live
tutor-chat preview** built on `TutorChatBubble`, so an author can feel the
agent's voice before students ever do.

---

## 1. Purpose & primary user

**Primary user:** `teacher` and `tenantAdmin` (content authors / space owners).

**Job-to-be-done:** "When I want AI to tutor or grade inside this space, I want
to define each agent's persona, rules, model and safety boundaries in one place
— and try the tutor live before students touch it — so the AI behaves the way
_I_ intend, grades to _my_ standard, never leaks answers, and the cost is
something I chose on purpose."

This is a precision-instrument surface for staff: tone is **precise,
declarative, and safety-forward**, not playful. The single permitted spark of
energy (marigold) is reserved for the "Default agent" marker and the
save-success toast — never for decorative chrome. Because agent text is
_executed_ as LLM instructions, every field that changes model behavior (system
prompt, rules, per-subject guidance, temperature) is labelled with explicit
consequence copy.

---

## 2. Entry points & route

**Route:** `/spaces/:spaceId/edit` → **Agents** tab. (Sibling tabs: Overview ·
Story Points · Items · Rubric · **Agents** · Settings.)

**Powers downstream:** the configured tutor agent feeds `sendChatMessage`
(`functions/levelup/src/callable/send-chat-message.ts`) which resolves `agentId`
→ falls back to `space.defaultTutorAgentId`; the evaluator agent feeds
`evaluateAnswer`. `modelOverride` / `temperatureOverride` from the agent are
passed verbatim to the `LLMWrapper.call` options
(`model: agent?.modelOverride || 'gemini-2.5-flash'`,
`temperature: agent?.temperatureOverride ?? 0.7`).

**Common-API reads/writes** (cite `docs/rebuild-spec/specs/common-api.md`):

- **Read:** the parent editor page loads the space via the spaces read hooks;
  agents are listed via a **NEW** `v1.levelup.listAgents(spaceId)` typed read
  (today the live `AgentConfigPanel.tsx` reads `getDocs` on
  `tenants/{tenantId}/spaces/{spaceId}/agents` directly — **the rebuild forbids
  client→Firestore**, so this read MUST move behind a typed endpoint).
- **Write:** **NEW** `v1.levelup.saveAgent` callable — upsert convention
  (`save*`, id present = update). Today the panel uses raw
  `setDoc(..., { merge: true })`; the rebuild replaces this with `saveAgent`,
  which also derives `tenantId` from auth claims (not the request body) and
  stamps `createdBy` / `updatedAt`. **Call this out as a required new
  callable.**
- **Delete:** **NEW** `v1.levelup.deleteAgent(agentId)` (replaces the live
  `deleteDoc`). Must reject deletion of an agent still set as
  `space.defaultTutorAgentId` / `defaultEvaluatorAgentId` until the default is
  reassigned or cleared (see §8).
- **Set default:** setting the space default writes `space.defaultTutorAgentId`
  / `defaultEvaluatorAgentId` via `v1.levelup.saveSpace` (the existing space
  write), not on the agent doc.
- **Live preview:** the tutor preview calls the same `sendChatMessage` callable
  students use, in an **author preview session** (ephemeral `chatSession`, never
  surfaced to learners) so the preview is byte-for-byte the runtime path — same
  prompt builder (`buildTutorSystemPrompt`), same safety filter, same model.

---

## 3. Layout — wireframe-as-text

Hosted inside **AppShell** (foundation §5: Sidebar + Topbar) → SpaceEditorPage
tab strip. The tab is a master/detail: a left **agent list rail** (tutors +
evaluators grouped) and a right **agent editor Panel**; on `lg` a **live preview
rail** docks far-right for the selected tutor.

```
┌─ AppShell ───────────────────────────────────────────────────────────────────┐
│ Sidebar (role nav)               Topbar (tenant switcher · search · profile)  │
├────────────────────────────────────────────────────────────────────────────── │
│ Breadcrumb: Spaces / {Space name} / Edit                                       │
│ Tabs: Overview · Story Points · Items · Rubric · [Agents] · Settings           │
│                                                                                │
│ ┌─ Header row ───────────────────────────────────────────────────────────┐    │
│ │ "Agents"  · subhead              [ + Add tutor ]  [ + Add evaluator ]    │    │
│ └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                │
│ lg grid: [ List rail 260px ][ Editor Panel · 1fr ][ Preview rail · 380px ]    │
│ ┌──────────────┐ ┌──────────────────────────────┐ ┌──────────────────────┐    │
│ │ TUTORS       │ │ ┌ Card header ──────────────┐ │ │ Live tutor preview   │    │
│ │ ▸ AI Tutor ★ │ │ │ [Bot] Role Badge  Switch  │ │ │ (TutorChatBubble x N)│    │
│ │ ▸ Mentor     │ │ │ Active  · [Set default ★] │ │ │ ┌──────────────────┐ │    │
│ │              │ │ └────────────────────────────┘ │ │ │ tutor: Let's ... │ │    │
│ │ EVALUATORS   │ │ Name [______]  Identity [____] │ │ │ you:   ...       │ │    │
│ │ ▸ Grader ★   │ │ Model [Select▾]  Temp [Slider] │ │ └──────────────────┘ │    │
│ │ ▸ Strict     │ │ System Prompt  [Textarea]      │ │ [ type a message…→ ] │    │
│ │              │ │ Per-subject guidance (chips)   │ │ SafetyPosture note   │    │
│ │ [ + add… ]   │ │ — role-specific Section —      │ │ Cost: ~{n} tok/msg   │    │
│ │              │ │   tutor: languages, maxTurns   │ └──────────────────────┘    │
│ │              │ │   eval: rules, strictness,     │                             │
│ │              │ │         feedbackStyle, objectives                          │
│ │              │ │ SafetyPosture panel            │  (Preview rail collapses to │
│ │              │ │ [Delete]        [Save agent]   │   a "Preview" toggle md/sm) │
│ └──────────────┘ └──────────────────────────────┘                             │
└────────────────────────────────────────────────────────────────────────────── ┘
```

**Responsive (foundation §4 breakpoints):**

- **`sm` (<640):** single column, gutters `16`. List rail becomes a top
  **Select**/segmented switcher ("Tutors | Evaluators") + a horizontally
  scrollable chip list of agents. Editor is full-width. Preview collapses into
  an **Accordion** ("Try the tutor") below the form. Sticky bottom action bar
  (Save / Delete).
- **`md` (768):** two columns — list rail `240px` + editor `1fr`; preview is a
  toggle (Drawer/Sheet) launched from a "Live preview" button.
- **`lg` (1024+):** three-zone grid (list `260px` / editor `1fr` / preview
  `380px`), gutters `32`. Editor body capped at the reading measure (~`720`) so
  long prompts stay legible.

---

## 4. Components used (from §5)

- **AppShell**, **Sidebar**, **Topbar**, **Breadcrumb**, **Tabs** — page chrome.
- **Panel**, **Section**, **Card** — the agent list cards (rail) and the editor
  body. Editor groups: Identity, Model & sampling, Persona, Per-subject
  guidance, Role-specific, Safety. Cards radius `lg`, elevation `e1` at rest,
  `e2` on hover (rail) and on the preview rail.
- **Drawer/Sheet** — the live preview on `md`/`sm`.
- **Input** (Name, Identity), **Textarea** (System Prompt, Rules), **Select**
  (Model — GPT-4 / GPT-4o / Claude Sonnet / Claude Opus / Gemini Pro / Gemini
  Flash per current options; Strictness; Feedback style; Default language),
  **Slider** (Temperature 0–1, step 0.05, with a **Spline Sans Mono** numeric
  **Input** echo), **Switch** (Active / `enabled`), **Combobox** or multi-select
  **Chip/Tag** group (Supported languages, Per-subject guidance keys).
- **Badge** — role marker (`tutor` / `evaluator`), `Default` marker, `Inactive`
  marker.
- **Chip/Tag** — per-subject guidance keys (mathematics, physics, chemistry,
  biology, english, history, computer_science — verbatim from
  `SUBJECT_GUIDANCE`), languages, evaluation objectives.
- **Button** (primary "Save agent", secondary "Add tutor" / "Add evaluator",
  danger-ghost "Delete"), **IconButton** (add/remove objective rows, "Set
  default" star toggle).
- **TutorChatBubble** (domain, §5) — the live preview transcript, reused
  verbatim so author preview === student render.
- **ContentRenderer** (domain, §5) — renders tutor reply Markdown + KaTeX inside
  each `TutorChatBubble`, identical to the student tutor surface (single
  canonical renderer; no dual path).
- **InlineAlert/Banner** — the **SafetyPosture** explainer and the "no API key
  configured" / "model not available for tenant" warnings.
- **ConfirmDialog** — delete confirmation; "Change default agent" confirmation;
  destructive role/persona edits.
- **Toast** (sonner) — save / delete success & error.
- **Skeleton**, **EmptyState**, **LoadingOverlay**, **FormFieldError** — states
  (§5).
- **Tooltip** — consequence help ("Temperature controls creativity vs.
  determinism — keep evaluators low for consistent grading").

**Proposed addition to FOUNDATION (justified):** **`SafetyPosture`** — a compact
read-only panel that states, in plain language, the platform-enforced guardrails
that ALWAYS apply regardless of the author's prompt: prompt-injection stripping
(student input wrapped in `<student_message>` / `<student_answer>` and ignored
as instructions), blocked-topic filtering (`checkMessageSafety`), rate limits
(10 msg/min, 50 msg/hr), and an estimated per-message **cost** (tokens × model).
It is a thin composition of **InlineAlert** + **DefinitionList** + **Badge**,
but it recurs anywhere staff configure LLM behavior (Agents here, plus future
Exam AI settings), so it earns a named domain component. Added to the §5
inventory pending review.

---

## 5. States

- **Loading:** while `listAgents` resolves, render **Skeleton** cards in the
  list rail (2–3 placeholder rows) and skeleton fields in the editor Panel; use
  `bg.surface-sunken` placeholders. (The live code already shows two pulsing
  card skeletons — keep that intent, restyle to Lyceum.)
- **Empty (no agents):** **EmptyState** with a `Bot` glyph, title "No agents
  configured yet" (Fraunces), body "Add an evaluator or tutor to enable AI
  tutoring and AI grading in this space." Two primary CTAs: **Add tutor**, **Add
  evaluator**. Until at least one tutor exists, the live preview rail shows its
  own empty state ("Add a tutor to preview a chat").
- **Selected / editing (success):** all fields editable; role-specific Section
  swaps by `type`; **Default** star filled for the space default agent.
- **Partial / incomplete:** an agent saved with an empty `systemPrompt` and
  empty `identity` → **InlineAlert** "This tutor will fall back to the default
  persona" (mirrors `buildTutorSystemPrompt`'s `DEFAULT_TUTOR_PERSONA`
  fallback). An evaluator with no `rules` and no `strictness` → "Grading will
  use default fairness rules." Neither blocks save.
- **Validation error:** temperature outside 0–1; duplicate agent name within the
  same role; an evaluation objective with `points ≤ 0` or blank name →
  **FormFieldError** + Save disabled, summarized in a top **InlineAlert**.
- **Save error:** **Toast** error ("Couldn't save the agent — your changes are
  kept, retry"); form stays dirty; optimistic state rolls back (§6).
- **Preview error / unavailable:** if the tenant has no AI key or the chosen
  model is unavailable, the preview rail shows an **InlineAlert** "Live preview
  unavailable: no AI provider key for this tenant" (does not block
  editing/saving). Safety-blocked preview messages render the platform refusal
  copy inline, demonstrating the guardrail.
- **Permission-gated by role:**
  - `teacher` — full create/edit/delete of agents within their tenant's space;
    can set the space default.
  - `tenantAdmin` — same, plus governs which models are permitted at the tenant
    level (a disallowed model is greyed in the **Select** with a Tooltip "Not
    enabled for this tenant").
  - Read-only viewer roles — see agents with all inputs disabled, no
    Save/Delete, no preview composer.

---

## 6. Interactions & motion (cite §4 motion)

- **Add agent:** "Add tutor" / "Add evaluator" inserts a new card into the rail
  (expand `fast 160ms` height+opacity) and auto-selects it, seeding defaults
  (`name` "AI Tutor"/"AI Evaluator", a sensible default model, `enabled: true`,
  tutor `temperature 0.7`, evaluator `temperature 0.2`). Focus moves to the Name
  field.
- **Select agent:** clicking a rail card slides the editor content in with
  `ease.entrance` / `base 220ms`; outgoing exits `ease.exit`. Unsaved edits
  prompt a **ConfirmDialog** before switching.
- **Switch role-specific fields:** changing `type` (rarely; usually fixed at
  create) cross-fades the role Section `base 220ms`; a **ConfirmDialog** warns
  that role-only fields (rules / objectives vs. languages / maxTurns) will be
  cleared on save.
- **Temperature Slider:** dragging updates the mono numeric echo live
  (`instant 100ms`); a subtle inline hint shifts between "Deterministic" ↔
  "Creative" as the value crosses 0.3 / 0.7 (text + position, never color
  alone).
- **Set default:** tapping the star toggles
  `space.defaultTutorAgentId`/`defaultEvaluatorAgentId`. A **ConfirmDialog**
  appears only when _replacing_ an existing default ("Make 'Mentor' the default
  tutor? Students' new chats will use it."). On confirm, the old default's star
  fades out and the new one's marigold star springs in (the one allowed
  celebratory pop, per §4).
- **Live preview:** typing in the preview composer and pressing Enter calls
  `sendChatMessage` in the author preview session; an outgoing
  **TutorChatBubble** appears immediately (optimistic, `fast`), the tutor reply
  arrives and animates in `ease.entrance`. A typing indicator (three-dot,
  reduced-motion → static "Thinking…") shows while the call is in flight.
  Editing the system prompt and re-sending demonstrates the change instantly —
  no save required to preview (preview uses live form state).
- **Optimistic save:** "Save agent" treats local state as source-of-truth
  immediately (button → spinner, `instant`); `saveAgent` runs in background.
  Success → **Toast** "Agent saved" with the single permitted spring marigold
  pop (§4). Failure → rollback + error Toast.
- **Delete:** **ConfirmDialog** ("Delete 'Strict Grader'? This can't be
  undone."); if the agent is a current default, the dialog blocks with "Reassign
  the default evaluator first." On confirm, the card collapses `ease.exit`.
- **Reduced motion:** all transitions degrade to opacity-only / no spring per
  `prefers-reduced-motion` (§4); the save pop becomes a static checkmark.

---

## 7. Content & copy

- **Tab / heading:** "Agents" (Fraunces, text-xl). Subhead (Schibsted, text-sm,
  `text.secondary`): "Configure the AI tutor and evaluator that help and grade
  students in this space."
- **List rail group labels:** "Tutors" · "Evaluators". Card subtitle shows
  model + `Default` / `Inactive` badges.
- **Field labels:** Name · Identity · Model · Temperature · System prompt ·
  Per-subject guidance · **(tutor)** Supported languages · Default language ·
  Max conversation turns · **(evaluator)** Grading rules · Strictness (Lenient /
  Moderate / Strict) · Feedback style (Brief / Detailed / Encouraging) ·
  Evaluation objectives (Name · Points · Description).
- **Consequence help (Tooltips):**
  - System prompt — "This becomes the agent's instructions. The tutor uses the
    Socratic method and never gives the direct answer."
  - Temperature — "Lower = more consistent (best for grading). Higher = more
    varied phrasing."
  - Max conversation turns — "Caps how long a single tutoring chat can run
    before the student starts a new one."
  - Per-subject guidance — "Adds subject-specific coaching (e.g. LaTeX for
    maths, SI units for physics) when an item is tagged with that subject."
- **SafetyPosture copy (read-only, always shown):**
  - "Student input is always treated as content, never instructions —
    prompt-injection attempts are stripped before the model sees them."
  - "Off-topic and unsafe requests are blocked automatically: ‘This topic is
    outside the scope of academic tutoring.'"
  - "Rate limits apply: 10 messages/minute and 50/hour per student."
  - "Estimated cost: ~{tokens} tokens per message on {model}." (informational,
    mono numerals)
- **Empty state:** "No agents configured yet." / "Add an evaluator or tutor to
  enable AI tutoring and AI grading in this space."
- **Error copy:** "Temperature must be between 0 and 1." · "Two tutors share the
  same name — names must be unique." · "Objective points must be greater than
  0." · Save fail — "Couldn't save the agent. Your changes are kept — retry." ·
  Delete-default block — "This agent is the space default. Choose another
  default before deleting."
- **Tone:** precise, declarative, second-person; safety stated as fact, not
  warning-shouting. No exclamation except the save Toast.

---

## 8. Domain rules surfaced

- **Default-agent resolution:** `sendChatMessage` resolves the tutor by
  `agentId`, else falls back to `space.defaultTutorAgentId`, else a built-in
  default persona. The "Set default" star directly governs that fallback, so the
  UI must make the current default unmistakable (filled star + `Default` Badge)
  and warn before changing it. Defaults live on the **space** doc, not the agent
  — set via `saveSpace`.
- **Persona fallback chain:** `buildTutorSystemPrompt` uses `agent.systemPrompt`
  → `agent.identity` → `DEFAULT_TUTOR_PERSONA`. The editor surfaces this as the
  "will fall back to default persona" InlineAlert so authors understand an empty
  prompt is valid but generic.
- **Server-enforced safety is non-negotiable:** prompt-injection guarding
  (student input wrapped in `<student_message>`/`<student_answer>` and
  explicitly ignored), blocked-topic filtering (`checkMessageSafety`), and rate
  limits are applied server-side **regardless of the author's prompt**. The
  SafetyPosture panel is read-only — authors cannot disable these. This is shown
  as a platform guarantee, not an author setting.
- **Answer-key isolation (evaluator):** the evaluator's grading rules and
  `modelAnswer` references are **evaluator-only**. Per foundation §8, answer
  keys for timed tests are stripped server-side into a denied subcollection and
  never reach students; the evaluator agent operates on server-side context
  only. The Agents tab never displays student-facing keys and must label
  evaluator guidance as "used for grading, never shown to students."
- **Model & temperature override are live levers:** `modelOverride` and
  `temperatureOverride` are passed straight into the LLM call. Changing the
  model changes cost and capability; changing temperature changes grading
  consistency. Both carry explicit consequence copy and a cost estimate.
- **Tenant isolation:** `tenantId` is derived server-side from auth claims in
  `saveAgent` (not the request body, per the rebuild seam) — the UI never sends
  it. All reads/writes are tenant-scoped.
- **Cost awareness:** tutoring runs on the agent's model with a 2048-token cap
  and triggers fire-and-forget summarization/insight extraction on cheap models;
  long conversations get summarized at 20 messages. The SafetyPosture cost line
  communicates that AI usage is metered so authors pick models deliberately.

---

## 9. Accessibility

- **Master/detail semantics:** the list rail is a labelled `listbox` (agents =
  options); arrow keys move selection, `Enter`/`Space` opens, `aria-selected` on
  the active agent. The editor is the associated panel region with
  `aria-live="polite"` on save status.
- **Focus order:** Add buttons → list rail (agent by agent) → editor: Name →
  Identity → Model → Temperature (Slider + numeric Input) → System prompt →
  Per-subject guidance chips → role Section (top to bottom) → SafetyPosture
  (read-only, focusable for SR) → Delete → Save. Logical and linear.
- **Set-default control:** the star is a real toggle button (`aria-pressed`),
  `aria-label` "Set as default tutor" / "Default tutor (current)"; default state
  conveyed by Badge text + filled-star glyph, never color alone.
- **Temperature Slider:** `aria-valuemin=0 / aria-valuemax=1 / aria-valuenow`,
  paired numeric **Input** for exact entry; the "Deterministic ↔ Creative" hint
  is text, not color.
- **Status cues:** `Default`, `Inactive`, `tutor`/`evaluator`, safety states all
  pair icon + label + color (§2) — never color alone.
- **Live preview:** the transcript region is `aria-live="polite"` (announces new
  tutor replies without spamming each token); the typing indicator has an SR
  label "Tutor is responding". Each **TutorChatBubble** sender is announced via
  visually-hidden "Tutor:" / "You:" prefixes.
- **Contrast:** all text/UI pairs meet WCAG AA (§2). The marigold `Default`
  star/badge uses `marigold-600` text/glyph on `marigold-200` for ≥4.5:1.
- **Errors:** **FormFieldError** linked via `aria-describedby`; the top summary
  **InlineAlert** receives focus on failed save.
- **Reduced motion:** honor `prefers-reduced-motion` for card transitions,
  default-star pop, typing indicator, and save toast (§4).
- **Touch targets:** add/remove objective IconButtons and the star toggle ≥44px
  (§4).

---

## 10. Web ↔ mobile divergence

- Component **names/props match 1:1** between `shared-ui` (web) and `ui-native`
  (mobile) (§6); only the renderer differs. `TutorChatBubble` and
  `ContentRenderer` are shared verbatim.
- **Layout:** the `lg` three-zone master/detail (list + editor + preview) is
  **web-only**. On mobile the list rail becomes a top role switcher + horizontal
  agent chips; the editor is full-screen; the preview is a bottom **Sheet**
  ("Try the tutor").
- **Selection:** web click/hover on rail cards → mobile **press**; hover
  Tooltips (consequence help) → mobile tap-to-reveal Popover or inline helper
  text under the field.
- **Live preview composer:** web inline composer with Enter-to-send → mobile
  full-height bottom **Sheet** chat with a send IconButton and the device
  keyboard; numeric fields (temperature, points, max turns) trigger numeric
  keypads.
- **No ⌘K / CommandPalette** on mobile (§6) — "Add tutor"/"Add evaluator" are
  buttons, not palette actions.
- **Sticky bottom action bar** (Save / Delete) on mobile replaces the inline
  desktop buttons; destructive Delete always behind a **ConfirmDialog** on both
  platforms.
- **Dense evaluation-objective rows** (Name / Points / Description inline on
  web) reflow to stacked fields on mobile to preserve ≥44px targets.

---

## 11. Claude-design prompt

```
Design the "AI Agent Configuration" screen (Agents tab of the space editor) for the
Auto-LevelUp teacher web app, conforming EXACTLY to the Lyceum design system in
docs/rebuild-spec/design/00-FOUNDATION.md. Do NOT invent colors, fonts, or components
— compose only from its tokens and §5 inventory. No Inter/Roboto, no SaaS blue
#3B82F6, no glass morphism.

CONTEXT: Staff (teacher / tenantAdmin) configure per-space AI agents — a Socratic
TUTOR (powers chat) and an EVALUATOR (powers AI grading). Per agent: name, identity,
role badge, system prompt, per-subject guidance, model + temperature override, role-
specific rules, an Active switch, and a "Default agent" star. Precise, safety-forward,
instrument-like tone — NOT playful. The one allowed spark (marigold) is the Default
star/badge and the save-success toast.

LAYOUT (inside AppShell: Sidebar + Topbar + Breadcrumb + Tabs, Agents tab active):
- Header row: "Agents" (Fraunces text-xl) + subhead; right-aligned "Add tutor" and
  "Add evaluator" secondary Buttons.
- lg: three zones — list rail (260px, agents grouped Tutors / Evaluators as a listbox,
  each a Card with role Badge, model, Default/Inactive markers), editor Panel (1fr,
  body capped ~720 reading width), and a live preview rail (380px). md/sm: collapse the
  rail to a role switcher + chips and the preview to a bottom Sheet / Accordion.
- Editor Panel sections: Identity (Name, Identity Inputs) · Model & sampling (Model
  Select: GPT-4 / GPT-4o / Claude Sonnet / Claude Opus / Gemini Pro/Flash, Temperature
  Slider 0–1 with a Spline Sans Mono numeric echo + "Deterministic ↔ Creative" hint) ·
  Persona (System prompt Textarea) · Per-subject guidance (Chip multi-select:
  mathematics, physics, chemistry, biology, english, history, computer_science) ·
  role-specific Section — TUTOR: Supported languages, Default language, Max conversation
  turns; EVALUATOR: Grading rules Textarea, Strictness Select (Lenient/Moderate/Strict),
  Feedback style Select (Brief/Detailed/Encouraging), Evaluation objectives rows
  (Name / Points / Description with add/remove IconButtons).
- SafetyPosture panel (read-only InlineAlert + DefinitionList): prompt-injection
  stripping, blocked-topic filtering, rate limits (10/min, 50/hr), and an estimated
  per-message token cost on the chosen model.
- Live preview rail: a TutorChatBubble transcript + composer that calls the real tutor
  path using the live form state (no save needed). Show a typing indicator and a
  safety-refusal example.
- Footer actions: danger-ghost "Delete", primary "Save agent". A "Set default" star
  toggle in the card header.

TOKENS: bg.canvas / bg.surface; Fraunces for "Agents" heading, Schibsted Grotesk for
body/labels/buttons, Spline Sans Mono for temperature value / token counts. Cards radius
lg, inputs/buttons md, chips pill; elevation e1 at rest, e2 on hover and on the preview
rail. brand.primary for the active rail card + Save; marigold spark ONLY for the Default
star/badge and the save toast. Motion: agent-switch ease.entrance/base 220ms, add/remove
fast 160ms, default-star a single spring marigold pop, preview reply ease.entrance.
Respect prefers-reduced-motion.

STATES to show: empty (no agents, Bot EmptyState + two CTAs), loading Skeleton rail,
selected/editing, partial (empty prompt → "falls back to default persona" InlineAlert),
validation FormFieldError (temperature out of range / duplicate name / objective points
≤ 0), preview unavailable (no tenant AI key), save-error Toast, and a read-only viewer
role. Render the tutor preview identically to the student chat (shared TutorChatBubble +
ContentRenderer with Markdown + KaTeX). Make the list a real WCAG-AA listbox (arrow-key
nav, aria-selected), the star a toggle (aria-pressed), all status cues = icon + label +
color (never color alone). Deliver responsive sm/md/lg.
```
