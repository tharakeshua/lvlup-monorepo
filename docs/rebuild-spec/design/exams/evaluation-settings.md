# Evaluation Settings

_The tenant-level control room where staff define grading dimensions,
confidence-routing thresholds, display preferences, and AI usage budgets that
govern how every AutoGrade exam is evaluated and reviewed._

---

## 1. Purpose & primary user

**Primary user:** Tenant admin / lead teacher (role: `teacher` with settings
privileges, or `admin`). Job-to-be-done: _"Define one or more named evaluation
profiles — the rubric dimensions the AI scores against, the confidence
thresholds that decide what I must review by hand, what feedback students
eventually see, and the monthly AI spend ceiling — so that grading across all my
exams behaves consistently and predictably, and so I can trade rigor for cost
deliberately."_

This screen is the upstream authority for the entire grading pipeline. The
thresholds set here (`confidenceConfig.confidenceThreshold`,
`confidenceConfig.autoApproveThreshold`) directly drive the per-question routing
that the Grading Review screen surfaces (`needs_review` vs auto-approved). The
`enabledDimensions[]` defined here become the scoring axes RELMS uses. Exams
reference a profile by `gradingConfig.evaluationSettingsId`; the default profile
applies when none is chosen.

Secondary user: an admin auditing AI cost (cross-links to `/ai-usage`).

---

## 2. Entry points & route

**Route:** `/evaluation-settings` (tenant-level list + editor). Also reachable
as a **selectable panel** inside the exam wizard and exam Settings tab
(`/exams/new` review step, `/exams/:examId` Settings tab) where the teacher
picks `gradingConfig.evaluationSettingsId`.

**Entry points:**

- AppShell Sidebar → Exams group → "Evaluation Settings".
- CommandPalette (⌘K) → "Evaluation Settings", "Edit grading profile",
  "Confidence thresholds".
- From `/exams/:examId` Settings tab: an "Evaluation profile" Select with a
  "Manage profiles →" link deep-linking to `/evaluation-settings?profile=:id`.
- From `/ai-usage` (admin): "Adjust usage quota" links into the active profile's
  Usage tab.

**Reads / writes (common-API):**

- **Read:** `evaluationSettings.list` (live, tenant-scoped) → all profiles;
  `evaluationSettings.get(:id)` for the editor. AI usage meter reads from the
  analytics layer (current-period spend vs `usageQuota.monthlyBudgetUsd`, daily
  call count vs `dailyCallLimit`) — same source `/ai-usage` consumes.
- **Write:** `saveEvaluationSettings` callable (consolidated CRUD — create /
  update / set-default / duplicate / delete), server-validated and
  tenant-scoped. The default-profile flip is server-authoritative (only one
  `isDefault: true` per tenant; the server clears the prior default in the same
  transaction).
- The exam-side selection writes via `saveExam` (sets
  `gradingConfig.evaluationSettingsId`); changing it post-publish is gated by
  `POST_PUBLISH_LOCKED_FIELDS` (see §8).

> Note: if `saveEvaluationSettings` does not yet exist in the common-API
> contract, propose it there — it mirrors `saveExam`'s consolidated-CRUD +
> server-status pattern. All other behavior composes from existing repos.

---

## 3. Layout — wireframe-as-text

Rendered inside **AppShell** (Sidebar + Topbar). Two-pane master/detail at `lg`,
collapsing to stacked navigation below.

### lg (≥1024) — master/detail, max content width 1200

```
┌ AppShell ───────────────────────────────────────────────────────────────┐
│ Sidebar │ Topbar (tenant switcher · ⌘K · notifications · profile)        │
│         ├──────────────────────────────────────────────────────────────┤
│         │ Breadcrumb: Exams / Evaluation Settings                       │
│         │ ┌ Page header ───────────────────────────────────────────┐   │
│         │ │ Evaluation Settings (h1)        [+ New profile] (Button)│   │
│         │ │ Grading dimensions, confidence routing & AI budget …    │   │
│         │ └─────────────────────────────────────────────────────────┘   │
│         │ ┌ Profiles (Panel, 320) ┐ ┌ Editor (Panel, flex) ─────────┐  │
│         │ │ ⌕ Filter profiles      │ │ Tabs: Dimensions · Display · │  │
│         │ │ ┌───────────────────┐  │ │       Confidence · Usage     │  │
│         │ │ │ Standard  ★Default │  │ │ ┌──────────────────────────┐ │  │
│         │ │ │ used by 12 exams   │  │ │ │ [active tab body]        │ │  │
│         │ │ ├───────────────────┤  │ │ │                          │ │  │
│         │ │ │ Strict (Boards)    │  │ │ │                          │ │  │
│         │ │ │ Public ·  4 exams  │  │ │ │                          │ │  │
│         │ │ ├───────────────────┤  │ │ └──────────────────────────┘ │  │
│         │ │ │ Lenient (Practice) │  │ │ ┌ sticky action bar ───────┐ │  │
│         │ │ └───────────────────┘  │ │ │ Unsaved changes  [Discard]│ │  │
│         │ │ [+ New profile]        │ │ │            [Save changes] │ │  │
│         │ └────────────────────────┘ └──┴──────────────────────────┴─┘  │
└─────────┴──────────────────────────────────────────────────────────────┘
```

**Dimensions tab** (the meatiest): an ordered, reorderable list of
`EvaluationDimension` rows (DataTable-as-cards). Each row: drag handle · enable
Switch · name · priority Chip (HIGH/MED/LOW) · weight (numeric) ·
`isDefault`/`isCustom` Badge · expand to edit (`description`, `icon`,
`promptGuidance`, `scoringScale`, `expectedFeedbackCount`). Header actions: "+
Add custom dimension", "Restore defaults".

**Display tab:** Section with three Switch rows (`showStrengths`,
`showKeyTakeaway`, `prioritizeByImportance`) each with helper copy and a live
preview of a `FeedbackPanel` reflecting the toggles.

**Confidence tab:** the flagship. A horizontal **routing band** visual
(red→amber→green) with two draggable Sliders for `confidenceThreshold` and
`autoApproveThreshold`, a `requireReviewForPartialCredit` Switch, and a
`DefinitionList` explaining the three outcomes tied to
`confidence.low/med/high`.

**Usage tab:** `usageQuota` inputs (`monthlyBudgetUsd`, `dailyCallLimit`,
`warningThresholdPercent`) + a live **AI usage meter** (ProgressBar/KPI) and a
deep-link to `/ai-usage`.

### md (768–1023)

Profiles collapse to a top **Select/Combobox** ("Editing: Standard ★"); editor
takes full width; tab bar scrolls horizontally if needed. Sticky save bar stays
pinned to bottom.

### sm (<768)

Single column. Profile list becomes a full-screen route (`/evaluation-settings`
list) → tapping a profile pushes the editor (`/evaluation-settings/:id`). Tabs
become a horizontally scrollable Tabbar. Dimension rows stack; drag-reorder
replaced by an explicit "Move up / Move down" overflow menu (no fine drag on
touch). Save bar is a fixed bottom bar (≥44px).

---

## 4. Components used (Lyceum inventory)

- **Navigation:** AppShell, Sidebar, Topbar, Breadcrumb, CommandPalette, Tabbar
  (mobile).
- **Containers:** Panel (profiles list, editor), Section, Tabs
  (Dimensions/Display/Confidence/Usage), Accordion (expand a dimension row),
  Modal/Dialog (new profile, delete confirm), Drawer/Sheet (mobile dimension
  editor), Popover (priority help), Tooltip.
- **Primitives:** Button (primary "Save changes", secondary "Discard", ghost row
  actions, danger "Delete profile", spark NOT used here — this is staff chrome,
  no gamification), IconButton (drag handle, overflow), Input/Textarea (name,
  description, promptGuidance), Select/Combobox (profile picker on md/sm,
  scoringScale), Switch (enable dimension, display toggles,
  `requireReviewForPartialCredit`, `isDefault`, `isPublic`), Slider (the two
  confidence thresholds), Checkbox.
- **Data:** DataTable (dimension list with reorder/select), DefinitionList
  (routing explainer, usage breakdown), Stat/KPI (current spend, calls today),
  Badge (`★ Default`, `Public`, `Custom`, `Built-in`), Chip/Tag (priority
  HIGH/MED/LOW), ProgressBar (budget meter), Skeleton, EmptyState, Pagination
  (if many profiles).
- **Feedback:** Toast (sonner) (save success), InlineAlert/Banner (over-budget
  warning, "used by N exams" caution, post-publish lock notice), ConfirmDialog
  (delete, restore defaults, lower auto-approve threshold), FormFieldError,
  LoadingOverlay.
- **Domain (cross-app):** `ConfidenceBadge` and `ConfidenceBar` (from the
  feedback pkg) to render the routing band preview; `FeedbackPanel` for the
  Display-tab live preview; `InsightCard` optional for "this profile
  auto-approves 71% of questions" stat.

**Proposed addition (justify):** **`ThresholdRoutingBand`** — a specialized
double-handle Slider rendering the red/amber/green routing zones with live "X%
auto-approved / Y% spot-check / Z% needs review" labels. It composes Slider +
`ConfidenceBar` tokens; if not generalizable, keep it local to this screen. No
new tokens introduced — it reuses `confidence.low/med/high`.

---

## 5. States

- **Loading:** Profiles Panel shows 3–4 Skeleton rows; editor body shows
  tab-shaped Skeletons. Topbar/Breadcrumb render immediately. Usage meter shows
  a shimmer until the analytics read resolves.
- **Empty (no profiles):** EmptyState (Fraunces title) "No evaluation profiles
  yet" + body "Create a profile to define how AI grades your exams." + primary
  Button "Create your first profile" which seeds a profile pre-filled with the
  built-in default dimensions (`isDefault: true`, `isCustom: false`).
- **Empty (dimensions within a profile):** inline EmptyState in Dimensions tab
  "No dimensions enabled — grading will fall back to holistic scoring." with
  "Add a dimension" / "Restore defaults".
- **Error (load):** InlineAlert/Banner "Couldn't load evaluation settings." +
  Retry. Tenant-scoped failure never falls back to another tenant's data (see
  §8).
- **Error (save):** Toast error + keep the editor dirty (no data loss);
  FormFieldError on the offending field (e.g. `autoApproveThreshold` ≤
  `confidenceThreshold`, budget < 0).
- **Partial:** usage meter unavailable (analytics lag) → meter shows "Usage data
  unavailable" placeholder while the rest of the editor stays fully editable;
  saving is not blocked.
- **Success:** Toast "Profile saved", save bar collapses, dirty state clears.
  Setting a new default shows a confirm + Toast "Standard is now the default
  profile."
- **Permission / role-gated:**
  - Read-only viewer (teacher without settings privilege, or a `isPublic`
    profile owned by another teacher): all inputs disabled, save bar hidden, a
    Banner "You can view but not edit this profile. Duplicate it to customize."
    with a "Duplicate" Button.
  - Scanner / student roles: no route access (route not in their manifest).
  - Profile **in use** (`used by N exams` > 0): destructive edits (delete,
    removing a dimension) gate behind ConfidenceDialog warning about downstream
    regrade impact.

---

## 6. Interactions & motion

- **Profile select:** clicking a profile row swaps the editor with a
  `fast 160ms` cross-fade (`ease.standard`); active row gets a `brand.primary`
  left border. Selection is reflected in the URL (`?profile=:id`).
- **Dirty tracking / save:** any field edit reveals the sticky save bar via a
  `base 220ms` slide-up (`ease.entrance`). "Save changes" → optimistic: bar
  shows inline spinner, fields stay interactive; on success Toast + collapse
  (`fast`); on failure rollback + error Toast. Navigating away while dirty
  triggers a ConfirmDialog ("Discard unsaved changes?").
- **Dimension reorder:** drag handle reorders within the list; the dragged row
  lifts to `e2` elevation, others reflow at `fast`. Order persists to
  `enabledDimensions[]` ordering on save. Touch: explicit Move up/down (no
  drag).
- **Enable toggle:** Switch animates at `instant 100ms`; disabling a dimension
  dims the row to `text.muted` but keeps its config.
- **Confidence Sliders:** dragging either handle live-updates the routing band
  fill and the "% auto-approved / spot-check / needs review" labels at
  `instant`. Constraint enforced live:
  `autoApproveThreshold ≥ confidenceThreshold` (the high handle cannot cross
  below the low handle). Lowering `autoApproveThreshold` below a safe floor
  surfaces an InlineAlert ("More questions will auto-accept without review").
  Lowering it for a profile already in use prompts a ConfirmDialog.
- **Set default:** toggling `isDefault` on opens a ConfirmDialog (it demotes the
  current default); confirmed → Toast.
- **Delete / restore defaults:** ConfirmDialog (danger). Delete blocked with
  explanation if the profile is the tenant default or in use by exams; offer
  "Reassign exams" guidance instead.
- **Usage meter:** crossing `warningThresholdPercent` flips the ProgressBar to
  `status.warning`; at/over budget → `status.error` + Banner. No celebratory
  motion anywhere on this screen — all transitions are subtle, respecting
  `prefers-reduced-motion` (cross-fades/slides reduce to instant opacity swaps).

---

## 7. Content & copy (precise, staff tone)

- **Page title:** "Evaluation Settings" · subtitle: "Define how AI grades your
  exams — scoring dimensions, confidence routing, what students see, and your AI
  budget."
- **Tabs:** "Dimensions" · "Display" · "Confidence" · "Usage".
- **Dimensions tab:** "These are the axes RELMS scores each answer against." Row
  labels: "Priority" (HIGH/MED/LOW), "Weight", "Scoring scale", "Prompt
  guidance" (helper: "Instructions the grader follows for this dimension — never
  shown to students."). Add: "Add custom dimension". Restore: "Restore default
  dimensions".
- **Display tab:** "Control what feedback students see in their released
  results." Toggles: "Show strengths" / "Show key takeaway" / "Prioritize
  feedback by importance" — each with one-line helper. Reminder Banner: "Model
  answers and rubric guidance are never shown to students, regardless of these
  settings."
- **Confidence tab (flagship copy):**
  - "Confidence routing decides what the AI grades automatically and what you
    must review by hand."
  - DefinitionList:
    - "Needs review (confidence below {threshold})" → "Routed to you. Human
      grading required." — `confidence.low` red, with review icon + label.
    - "Spot-check ({threshold}–{autoApprove})" → "Graded, but flagged for a
      quick look." — `confidence.med` amber.
    - "Auto-accept (above {autoApprove})" → "Accepted automatically." —
      `confidence.high` green.
  - `requireReviewForPartialCredit` label: "Always review partial-credit
    answers" · helper: "Any answer scored between 0 and full marks is routed to
    you, ignoring confidence."
  - Defaults stated inline: "Default threshold 0.7 · auto-accept 0.9."
- **Usage tab:** "Monthly AI budget (USD)", "Daily call limit", "Warn me at (%
  of budget)" (default 80). Meter caption: "Spent ${x} of ${budget} this month ·
  {n} calls today." Over-budget Banner: "You've reached your monthly AI budget.
  New grading runs will queue as needs_review until the budget resets or is
  raised."
- **Empty state:** "No evaluation profiles yet" / "Create a profile to define
  how AI grades your exams."
- **Errors:** load "Couldn't load evaluation settings." · save "Couldn't save —
  your changes are still here. Try again." · validation "Auto-accept must be at
  or above the review threshold."
- **In-use caution:** "Used by {n} exams. Changes affect future grading;
  already-graded submissions aren't re-scored automatically."

---

## 8. Domain rules surfaced

- **Answer key / rubric guidance never reaches students:** `promptGuidance`,
  `modelAnswer`, `evaluatorGuidance` are grading-only. The Display tab
  explicitly reminds that model answers and rubric guidance are excluded from
  released results regardless of `displaySettings` (mirrors `AnswerKeyLock`).
- **Confidence routing is the contract:** the two thresholds here are the
  _source_ of the `needs_review` / spot-check / auto-accept routing rendered on
  Grading Review. Copy ties each band to `confidence.low/med/high`. Service
  errors (quota/circuit/rate-limit) always degrade to `needs_review` — surfaced
  in the over-budget Banner so staff understand why grading queues.
- **Tenant isolation:** every read/write is tenant-scoped; a load failure never
  shows another tenant's profiles. `isPublic` shares a profile _within_ the
  tenant only.
- **Server-authoritative default:** exactly one `isDefault: true` per tenant;
  the server enforces the single-default invariant transactionally (client
  cannot end up with two defaults).
- **Post-publish lock:** changing an exam's `gradingConfig.evaluationSettingsId`
  after publish is governed by `POST_PUBLISH_LOCKED_FIELDS` via `saveExam`; the
  exam-side picker disables with a lock note. Editing the _profile itself_ is
  allowed, but the "used by N exams" caution warns that already-graded
  submissions are not auto-rescored.
- **Status-machine respect:** this screen does not move exam status; it only
  configures the rules the pipeline applies. Defaults (`confidenceThreshold`
  0.7, `autoApproveThreshold` 0.9, `warningThresholdPercent` 80) are server
  defaults echoed in copy.

---

## 9. Accessibility

- **Focus order:** Breadcrumb → page actions → profile list (arrow-key navigable
  list, Enter to select) → tab list (roving tabindex, ←/→ to switch) → active
  tab body → sticky save bar last. Dirty-state save bar is announced via
  `aria-live="polite"` ("Unsaved changes").
- **Keyboard:** all Switches/Sliders fully operable (Space to toggle; ←/→ and
  Home/End on Sliders, step announced). Dimension reorder has a keyboard path
  (focus drag handle → Space to grab → ↑/↓ to move → Space to drop) plus the
  explicit Move up/down menu as a non-drag fallback. ⌘K opens CommandPalette.
- **ARIA:** Tabs use `role="tablist"`/`tab`/`tabpanel`; the routing band exposes
  each threshold Slider with `aria-valuetext` describing the band ("Review
  threshold 0.7; below this, answers need human review"). ConfidenceBadge/band
  never rely on color alone — each band has icon + text label. ConfirmDialogs
  trap focus and return it on close.
- **Contrast:** all confidence/grade/status colors paired with icon + label meet
  WCAG AA (`confidence.*`, `status.*`). Disabled (read-only) states keep ≥3:1 UI
  contrast.
- **Reduced motion:** save-bar slide, tab cross-fade, and reorder reflow degrade
  to instant opacity changes under `prefers-reduced-motion`.

---

## 10. Web ↔ mobile divergence

| Aspect            | teacher-web (today)     | future RN / scanner-web                                               |
| ----------------- | ----------------------- | --------------------------------------------------------------------- |
| Layout            | Two-pane master/detail  | Stacked: profile list route → editor route                            |
| Profile picker    | Persistent left Panel   | Top Select/Combobox or list screen                                    |
| Dimension reorder | Drag handle             | Move up/down overflow menu (no fine drag)                             |
| Tabs              | Horizontal Tabs         | Scrollable Tabbar                                                     |
| Dimension editor  | Inline Accordion expand | Drawer/Sheet                                                          |
| Hover affordances | Hover popovers/tooltips | Press → Popover/long-press                                            |
| ⌘K CommandPalette | Available               | None (no command palette on mobile)                                   |
| Save bar          | Sticky in editor pane   | Fixed bottom bar (≥44px)                                              |
| scanner-web       | n/a                     | Read-only at most; scanner role typically has no access to this route |

Component **names/props match 1:1** across `shared-ui` and `ui-native`; only
renderers differ.

---

## 11. Claude-design prompt

```
Design the "Evaluation Settings" screen for the Auto-LevelUp teacher-web app.
STRICTLY conform to the Lyceum design system (docs/rebuild-spec/design/00-FOUNDATION.md):
Modern Scholarly aesthetic — warm paper neutrals (bg.canvas/bg.surface), deep indigo
brand.primary, Fraunces serif for h1/empty-state titles, Schibsted Grotesk for UI/body/
labels/buttons, Spline Sans Mono for numbers/IDs/thresholds. No gamification spark here —
this is calm staff chrome. Cite tokens by name; do not invent colors, fonts, or variants.

Render inside AppShell (Sidebar + Topbar + Breadcrumb "Exams / Evaluation Settings").
Build a two-pane master/detail at lg: a left Panel listing EvaluationSettings profiles
(name, ★Default Badge, Public/Custom/Built-in Badges, "used by N exams") with a
"+ New profile" Button; a right editor Panel with Tabs: Dimensions · Display · Confidence
· Usage, and a sticky "Unsaved changes / Discard / Save changes" action bar.

- Dimensions tab: a reorderable list of EvaluationDimension rows (drag handle, enable
  Switch, name, priority Chip HIGH/MED/LOW, weight, Custom/Built-in Badge) that expand
  (Accordion) to edit description, icon, promptGuidance (Textarea), scoringScale.
- Display tab: three Switch rows (showStrengths, showKeyTakeaway, prioritizeByImportance)
  with a live FeedbackPanel preview and a Banner reminding that model answers/rubric
  guidance are NEVER shown to students.
- Confidence tab (flagship): a red→amber→green routing band with two draggable Sliders for
  confidenceThreshold (default 0.7) and autoApproveThreshold (default 0.9), a
  requireReviewForPartialCredit Switch, and a DefinitionList mapping each band to
  confidence.low (needs_review), confidence.med (spot-check), confidence.high (auto-accept)
  — always icon + label, never color alone. Enforce autoApprove ≥ threshold.
- Usage tab: usageQuota inputs (monthlyBudgetUsd, dailyCallLimit, warningThresholdPercent
  default 80) plus a live AI usage meter (ProgressBar/KPI) that turns status.warning at the
  warn threshold and status.error over budget, with a link to /ai-usage.

States: loading (Skeleton), empty ("No evaluation profiles yet"), error Banner + Retry,
read-only (disabled inputs + "Duplicate to customize" Banner), in-use caution. Motion:
subtle save-bar slide (base/ease.entrance), tab cross-fade (fast), reorder reflow; respect
prefers-reduced-motion. Tokens: bg.canvas, bg.surface, brand.primary, text.primary/
secondary/muted, border.subtle/strong/focus, confidence.low/med/high, status.warning/error/
success, radius lg cards / md inputs / pill chips, elevation e1 cards / e2 drag-lift / e3
modal, focus ring indigo@35%. WCAG AA, full keyboard support (roving-tabindex tabs,
keyboard reorder), aria-live on the dirty save bar. Output clean React + Tailwind reading
Lyceum CSS variables.
```
