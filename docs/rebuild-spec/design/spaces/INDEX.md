# SPACES Area — Design Specs Index

This area covers **LevelUp content authoring & structure** — the surfaces where
staff build and govern the learning hierarchy **Space → StoryPoint →
UnifiedItem**, configure assessment policy, rubrics, answer keys, and per-space
AI agents, then review, version, publish, and list their work. It also includes
the **B2C store / purchase** surfaces where self-directed consumers browse,
rate, and buy published spaces from the `platform_public` mirror. Every screen
here is a precise, instrument-grade authoring tool for `teacher` /
`tenantAdmin`, except the consumer-facing store flows, which carry a warmer
shopfront register.

> **Conformance.** Every spec in this directory conforms to the **Lyceum**
> foundation — [`../00-FOUNDATION.md`](../00-FOUNDATION.md) — and follows its
> **§7 11-point template** (Purpose · Route/API · Layout · Components · States ·
> Interactions/Motion · Content/Copy · Domain rules · Accessibility · Web↔mobile
> · Claude-design prompt). Tokens, type, spacing, motion, and components are
> **cited by name** in each spec, never re-pasted or re-invented. Where a screen
> genuinely needs something new, it is flagged as a _Proposed addition to
> FOUNDATION_ (summarized at the bottom of this index).

---

## Table of Contents

### Library & Overview

| Screen                        | Spec                                                     | Role(s)                    | Route                                                     | Key API                                                                |
| ----------------------------- | -------------------------------------------------------- | -------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------- |
| Spaces Library                | [./spaces-library.md](./spaces-library.md)               | teacher · tenantAdmin      | `/spaces`                                                 | `listSpaces` · `saveSpace`                                             |
| Space Detail / Overview       | [./space-detail-overview.md](./space-detail-overview.md) | teacher · tenantAdmin (RO) | `/spaces/:spaceId` (admin RO `/content/spaces/:spaceId`)  | `getSpace` · `listStoryPoints` · `listVersions` · `saveSpace` (status) |
| Create Space (new-space flow) | [./space-create.md](./space-create.md)                   | teacher · tenantAdmin      | `/spaces/new` (modal over `/spaces` → `/spaces/:id/edit`) | `saveSpace` (no `id`)                                                  |

### Space Editor (tabs)

| Screen                                | Spec                                                         | Role(s)               | Route                              | Key API                                                                                                                 |
| ------------------------------------- | ------------------------------------------------------------ | --------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Space Editor Tabbed Shell             | [./space-editor-shell.md](./space-editor-shell.md)           | teacher · tenantAdmin | `/spaces/:spaceId/edit?tab=…`      | `getSpace` · `saveSpace` (incl. status transitions)                                                                     |
| Settings Tab                          | [./space-editor-settings.md](./space-editor-settings.md)     | teacher · tenantAdmin | `/spaces/:spaceId/edit` → Settings | `getSpace` · `saveSpace`                                                                                                |
| Content Structure (Story Point Track) | [./space-content-structure.md](./space-content-structure.md) | teacher · tenantAdmin | `/spaces/:spaceId/edit` → Content  | `listStoryPoints` · `listItems` · `saveStoryPoint` · `saveItem` · `reorderStoryPoints`\* · `reorderItems` · `moveItems` |
| Content Version History               | [./content-version-history.md](./content-version-history.md) | teacher · tenantAdmin | `/spaces/:spaceId/edit` → History  | `listVersions` · `getVersionSnapshot`_ · `restoreVersion`_                                                              |
| AI Agent Configuration                | [./agent-config.md](./agent-config.md)                       | teacher · tenantAdmin | `/spaces/:spaceId/edit` → Agents   | `listAgents`_ · `saveAgent`_ · `deleteAgent`\* · `sendChatMessage` (preview)                                            |

### Story Points & Assessment

| Screen                   | Spec                                             | Role(s)               | Route                                                         | Key API                                         |
| ------------------------ | ------------------------------------------------ | --------------------- | ------------------------------------------------------------- | ----------------------------------------------- |
| Story Point Editor       | [./storypoint-editor.md](./storypoint-editor.md) | teacher · tenantAdmin | `/spaces/:spaceId/edit?tab=content&sp=:spId` (Drawer)         | `saveStoryPoint` · `listItems` · `reorderItems` |
| Assessment Configuration | [./assessment-config.md](./assessment-config.md) | teacher · tenantAdmin | `/spaces/:spaceId/story-points/:storyPointId/edit#assessment` | `getStoryPoint` · `saveStoryPoint`              |

### Items & Answer Keys

| Screen                                       | Spec                                                     | Role(s)               | Route                                                            | Key API                                          |
| -------------------------------------------- | -------------------------------------------------------- | --------------------- | ---------------------------------------------------------------- | ------------------------------------------------ |
| Add Item Type Picker                         | [./item-type-picker.md](./item-type-picker.md)           | teacher · tenantAdmin | Modal over `/spaces/:spaceId/story-points/:storyPointId/content` | `saveItem` (stub) · `importFromBank` (handoff)   |
| Item Editor (15 question + 7 material types) | [./item-editor.md](./item-editor.md)                     | teacher · tenantAdmin | `/spaces/:spaceId/edit?item=:itemId` (Sheet)                     | `getItemForEdit` · `saveItem`                    |
| Item / Story Point Preview                   | [./item-preview.md](./item-preview.md)                   | teacher · tenantAdmin | `/spaces/:spaceId/story-points/:storyPointId/preview`            | `getItemForEdit` · `getStoryPoint` · `listItems` |
| Answer Key Management                        | [./answer-key-management.md](./answer-key-management.md) | teacher · tenantAdmin | within Item Editor (not independently routed)                    | `getItemForEdit` (re-merge) · `saveItem` (strip) |

### Rubrics

| Screen                          | Spec                                       | Role(s)               | Route                            | Key API                                                                            |
| ------------------------------- | ------------------------------------------ | --------------------- | -------------------------------- | ---------------------------------------------------------------------------------- |
| Rubric Editor (4 scoring modes) | [./rubric-editor.md](./rubric-editor.md)   | teacher · tenantAdmin | `/spaces/:spaceId/edit` → Rubric | `saveSpace` / `saveStoryPoint` / `saveItem` (scope-dependent) · `saveRubricPreset` |
| Rubric Presets Library          | [./rubric-presets.md](./rubric-presets.md) | teacher · tenantAdmin | `/rubric-presets`                | `listRubricPresets` · `saveRubricPreset` (apply = client-side clone)               |

### AI & Reuse

| Screen                      | Spec                                                     | Role(s)               | Route                                                        | Key API                                                   |
| --------------------------- | -------------------------------------------------------- | --------------------- | ------------------------------------------------------------ | --------------------------------------------------------- |
| AI Content Generation       | [./ai-content-generation.md](./ai-content-generation.md) | teacher · tenantAdmin | `/spaces/:spaceId/edit?generate=1&storyPoint=:spId` (Drawer) | `generateContent` (via `callLLM`, streaming) · `saveItem` |
| Question Bank               | [./question-bank.md](./question-bank.md)                 | teacher · tenantAdmin | `/question-bank`                                             | `listQuestionBank`                                        |
| Question Bank Import Dialog | [./question-bank-import.md](./question-bank-import.md)   | teacher · tenantAdmin | Modal within Space Editor (not routed)                       | `listQuestionBank` · `importFromBank`                     |

### Versioning & Publish

| Screen                          | Spec                                                     | Role(s)                                        | Route                                                           | Key API                                                            |
| ------------------------------- | -------------------------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------ |
| Space Review & Publish Flow     | [./space-review-publish.md](./space-review-publish.md)   | teacher · tenantAdmin                          | `/spaces/:spaceId/edit?panel=publish` (Drawer)                  | `saveSpace` (status transition + `validatePublish` + store mirror) |
| Space Reviews & Ratings (Store) | [./space-reviews-ratings.md](./space-reviews-ratings.md) | consumer · learner (read+write) · teacher (RO) | `/store/spaces/:spaceId#reviews` · `/spaces/:spaceId` → Reviews | `getSpace` (reviews read) · `saveSpaceReview`                      |

### B2C Store

| Screen                    | Spec                                           | Role(s)                          | Route                                       | Key API                                                              |
| ------------------------- | ---------------------------------------------- | -------------------------------- | ------------------------------------------- | -------------------------------------------------------------------- |
| B2C Store Browse          | [./b2c-store-browse.md](./b2c-store-browse.md) | consumer / self-directed learner | `/store`                                    | `listStoreSpaces`                                                    |
| B2C Store Space Detail    | [./b2c-store-detail.md](./b2c-store-detail.md) | consumer / self-directed learner | `/store/:spaceId`                           | `getSpace` (store projection) · `listStoryPoints` · `purchaseSpace`  |
| Space Purchase / Checkout | [./space-purchase.md](./space-purchase.md)     | consumer / student               | `/store/:spaceId` (Buy) · `/store/checkout` | `listStoreSpaces` / `getSpace` · `purchaseSpace({ idempotencyKey })` |

\* Callable proposed/required by the rebuild (not yet in the audited live
callable list) — see the originating spec and the _Proposed FOUNDATION
additions_ section.

---

## Cross-cutting domain rules

These invariants are shared across the area; individual specs surface them in
their §8:

- **Answer-key server-only protection.** `saveItem` strips correct-answer fields
  into a **server-only subcollection**; they are never returned on student read
  paths. Only `getItemForEdit` (teacher/admin-only) re-merges them for
  authoring/preview. The `AnswerKeyLock` visual makes this boundary explicit;
  the Item Editor's `answerKeyLooksStripped()` guard prevents overwriting a
  stripped key with blanks (P0-1).
- **Rubric inheritance.** The live grading rubric resolves nearest-scope-wins:
  `resolveRubric(tenantDefault → space.defaultRubric → storyPoint.defaultRubric → item.rubric)`.
  The UI shows which scope supplied each effective value so authors don't
  double-edit; the backend resolver is preserved verbatim per common-api.
- **Status transitions are gated.** Every lifecycle change flows through
  `saveSpace`, which enforces `ALLOWED_TRANSITIONS` (draft→published,
  published→{archived,draft}, archived→draft) and the `validatePublish` publish
  gate. Status is **never optimistic** — the badge changes only after the
  callable resolves.
- **Server-authoritative timed-test timing.** `TimerBar` countdowns are driven
  by the server; the Item/Story-Point Preview's timer is an explicit **mock**
  and must never be surfaced as authoritative.
- **Single canonical Markdown ContentRenderer.** All rich/math content
  (Markdown + KaTeX) renders through the one `ContentRenderer`; no per-screen
  renderers.
- **Tenant isolation via server-derived `tenantId`.** All reads/writes are
  path-scoped to `tenants/{tenantId}/spaces/{spaceId}/…`; `tenantId` is derived
  **server-side from auth claims**, never trusted from the request body. The
  browser never touches Firestore directly — all access goes through the typed
  API seam.
- **Authoritative, trigger-maintained stats.** Counters and `stats.*` are owned
  by backend triggers; the UI never recomputes or optimistically edits them.
  Version history is append-only and trigger-produced (even _restore_ writes a
  new forward version, never mutating the past).
- **B2C `platform_public` mirror.** Listing a space to the store requires it be
  `published`; `saveSpace` upserts a mirror doc at
  `tenants/platform_public/spaces/{id}` (`accessType: public_store`, `price`,
  `currency`, `storeDescription`). Returning to draft deletes the mirror. Store
  state is **derived from** the space lifecycle, never an independent toggle.

---

## Key shared & domain components (FOUNDATION §5)

Used across this area:

- **Domain:** `SpaceCard` · `StoryPointTrack` · `StoryPointNode` (mastery
  states) · `ContentRenderer` (md + KaTeX) · `QuestionCard` (dispatch over 15
  types) · `AnswerInput` (per type) · `TimerBar` · `RubricBreakdown` ·
  `GradePill` · `ConfidenceBadge` · `TutorChatBubble` · `AnswerKeyLock`.
- **Navigation / chrome:** `AppShell` (Sidebar + Topbar) · `Breadcrumb` ·
  `CommandPalette` (⌘K) · `Tabbar` (mobile).
- **Containers:** `Card` · `Panel` · `Section` · `Accordion` · `Tabs` ·
  `Drawer/Sheet` · `Modal/Dialog` · `Popover` · `Tooltip`.
- **Data / feedback:** `DataTable` · `DefinitionList` · `Stat/KPI` · `Timeline`
  · `EmptyState` · `Skeleton` · `Pagination` · `Badge` · `Chip/Tag` ·
  `ProgressBar` · `ProgressRing` · `Toast` (sonner) · `InlineAlert/Banner` ·
  `ConfirmDialog` · `LoadingOverlay`.
- **Primitives:** `Button` (incl. spark variant) · `IconButton` · `Input` ·
  `Textarea` · `Select` · `Combobox` · `Slider` · `Switch` · `FileDrop`.

---

## Proposed FOUNDATION additions

Scanned across the specs; the following are flagged (not silently invented) and
pending review for FOUNDATION §5:

- **`SegmentedControl`** (primitive) — requested by **spaces-library** (status
  filter All/Draft/Published/Archived) and **assessment-config** (Order mode).
  Until added, fall back to pill-styled `Tabs` / a `Radio` group.
- **`AutosaveIndicator`** (micro-component) — from **space-editor-shell**;
  standardized save-state chip (`Saving…` / `Saved {time}` / `Unsaved changes` /
  `Save failed — retry`) used on every authoring shell. Compose from Chip +
  Tooltip + spinner/check until adopted.
- **`SafetyPosture`** (domain component) — from **agent-config**; read-only
  panel stating platform-enforced LLM guardrails (prompt-injection stripping,
  blocked-topic filtering, rate limits, per-message cost). Composed from
  InlineAlert + DefinitionList + Badge.
- **`GenerationConfigPanel` + `DraftReviewCard`** (domain pair) — from
  **ai-content-generation**; composition glue for the AI generation
  Configure/Review flow, sharing the Item Editor's `{ data, onChange, errors }`
  registry contract.
- **`SortableList` / `DragHandle`** + **`SplitButton`** — from
  **space-content-structure**; a reusable reorderable-list pattern (grip
  IconButton + `border.focus` drop indicator + `e2` lift) and a split
  primary-action button for `+ Add ▾`. Compose from IconButton + rule line /
  Select + Button until added.
- **`DifficultyScale` + `SectionRow`** — from **storypoint-editor**; a 4-detent
  labeled Slider wrapper (`easy → expert` color ramp) and a draggable Accordion
  section-header row. Both compose from §5 primitives.

API-side proposals (flagged in specs, not yet in the audited callable list):
`listAgents` / `saveAgent` / `deleteAgent` (agent-config), `getVersionSnapshot`
/ `restoreVersion` + user-batch resolver (content-version-history),
`reorderStoryPoints` (space-content-structure / storypoint-editor), plus real
payment-gateway + server idempotency for `purchaseSpace` (space-purchase).
