# Vertical Brief: Teacher Content Creation Module

**Scope:** How a teacher/author builds learning content in Auto-LevelUp.
**Type:** Read-only analysis — plain-English brief, no code changes. **Date:**
2026-07-04

---

## 1. The Authoring Flow (create → publish), simply

A teacher builds content in a **strict 4-level hierarchy**, then flips a status
switch to publish:

```
Space  ──▶  Story Point  ──▶  Item (question | material)  ──▶  Answer Key (server-only)
(course)    (chapter/test)     (the actual content)             (correct answers, hidden)
                                        │
                                        └── every save also writes a ContentVersion (audit log)
```

**Step by step, as the teacher experiences it:**

1. **Create a Space** — From `SpaceListPage`, pick a template (blank / course /
   assessment / practice). This creates a `draft` space. Editing happens in
   `SpaceEditorPage`, a tabbed screen: **Settings · Content · Rubric · Agents ·
   Versions**.
2. **Settings tab** — Title, description, type, subject, labels, access
   (class-assigned / tenant-wide / public store), thumbnail, and optional
   store-listing fields (price, store description) if publishing to the public
   marketplace.
3. **Content tab** — Add **Story Points** (the chapters/tests). Each story point
   has a type, sections, difficulty, estimated time, and — for test types — a
   full assessment config (duration, max attempts, passing %, shuffle, schedule,
   retry cooldown, adaptive testing).
4. **Add Items** to each story point — either a **question** (15 subtypes) or a
   **material** (7 subtypes). Items carry content (rich text w/ KaTeX math), a
   typed payload, base points, difficulty, Bloom's level, topics/labels, section
   assignment, and media attachments. Items reorder via drag-and-drop
   (@dnd-kit).
5. **Reuse via Question Bank** — Instead of authoring from scratch, import
   questions from the tenant's reusable **Question Bank** into a story point
   (`QuestionBankImportDialog` → `importFromBank`).
6. **Rubric tab** — Set a default grading rubric for the space (4 scoring
   modes). Reusable **rubric presets** can be saved tenant-wide.
7. **Agents tab** — Configure per-space evaluator/tutor AI agents (model
   override, system prompt, on/off).
8. **Versions tab** — Read-only timeline of every change
   (created/updated/published/archived), lazy-loaded.
9. **Publish** — A single `saveSpace` call with `status: "published"` runs
   server-side validation (title present, ≥1 story point, each timed_test has
   duration > 0, each story point has ≥1 item), stamps `publishedAt`, mirrors a
   store listing if `publishedToStore`, and fires student notifications.
   Unpublish/archive are the same call with a different status.

**Key safety mechanism — answer stripping:** For `timed_test` story points, when
an item is saved the backend **extracts the correct answers into a separate
`answerKeys/` subcollection** and **strips them from the item payload** students
can read. When the teacher re-opens the item, `getItemForEdit` merges the
answers back in. This is the recurring seam to understand: the _edit_ view and
the _student_ view of an item are deliberately different documents.

---

## 2. Content Taxonomy (what each thing is)

### Space (the course/subject container)

`packages/domain/src/entities/levelup/space.ts`. Types (`enums/space.ts`):
**learning, practice, assessment, resource, hybrid**. Status: **draft →
published → archived**. Access: **class_assigned, tenant_wide, public_store**.
Has store fields (`price`, `publishedToStore`, `storeDescription`,
`storeThumbnailUrl`), `version`, `publishedAt`, denormalized `stats` +
`ratingAggregate`.

### Story Point (the chapter / test unit) — **4 types**

`enums/content.ts` →
`STORY_POINT_TYPES = ["standard", "timed_test", "quiz", "practice"]`

- **standard** — regular sequential learning unit, no time/attempt limits.
- **timed_test** — time-bound assessment; duration enforced; triggers answer-key
  stripping.
- **quiz** — quick assessment with a passing criterion.
- **practice** — ungraded, unlimited retries.

> Note: the UI's `StoryPointEditor` also surfaces a `test` label in places, but
> the **domain SSOT is 4 types**. Assessment config (duration, maxAttempts,
> passingPercentage, shuffle, schedule, retryConfig, adaptiveConfig) only
> applies to the test-style types.

### Item — **7 types** (the content unit)

`enums/content.ts` →
`ITEM_TYPES = ["question", "material", "interactive", "assessment", "discussion", "project", "checkpoint"]`.
Payload is a discriminated union (`item-payload.ts`). In practice the authoring
UI focuses on **question** and **material**; the other five payload shapes exist
in the domain but have thinner UI.

### Question types — **15** (`question-types/registry.ts`)

| #   | Type                                   | Grading |
| --- | -------------------------------------- | ------- |
| 1   | `mcq` — multiple choice                | auto    |
| 2   | `mcaq` — multiple correct answers      | auto    |
| 3   | `true-false`                           | auto    |
| 4   | `numerical` (tolerance, unit)          | auto    |
| 5   | `text` — short answer                  | AI      |
| 6   | `paragraph` — long answer              | AI      |
| 7   | `code` (language, starter, test cases) | AI      |
| 8   | `fill-blanks`                          | auto    |
| 9   | `fill-blanks-dd` — drag & drop blanks  | auto    |
| 10  | `matching`                             | auto    |
| 11  | `jumbled` — reorder tokens             | auto    |
| 12  | `audio` — audio response               | AI      |
| 13  | `image_evaluation`                     | AI      |
| 14  | `group-options`                        | auto    |
| 15  | `chat_agent_question` — conversational | AI      |

**8 auto-evaluatable** (instant): mcq, mcaq, true-false, numerical, fill-blanks,
fill-blanks-dd, matching, jumbled, group-options — _(registry lists
group-options under auto; the content-item-generator skill lists it as auto too,
so treat auto set as these + group-options)_. **7 AI-evaluatable** (needs LLM):
text, paragraph, code, audio, image_evaluation, chat_agent_question,
(+group-options is auto). The AI set drives the evaluator-agent + rubric
machinery.

### Material types — **7** (`enums/content.ts`)

`MATERIAL_TYPES = ["text", "video", "pdf", "link", "interactive", "story", "rich"]`
— text (body), video (url + duration), pdf (url), link (url + label),
interactive (embedUrl), story (slides), rich (block array).

### Supporting entities

- **ContentVersion** (`content-version.ts`) — one row per change:
  `{version, entityType(space|storyPoint|item), entityId, changeType(created|updated|published|archived), changeSummary, changedBy, changedAt}`.
  Version numbers increment **per entity**, not per space snapshot. It's an
  audit log, **not** a revert/restore system.
- **Rubric** (`rubric.ts`) — 4 scoring modes: **criteria_based, dimension_based,
  holistic, hybrid**. Criteria have levels/weights/maxScore; dimensions have
  priority/weight/scale/promptGuidance.
- **RubricPreset** (`rubric-preset.ts`) — reusable tenant-wide rubric templates,
  categorized, optionally scoped to question types, with an `isDefault` guard
  (can't delete the default).
- **AnswerKey** (`answer-key.ts`) — server-only (deny-all rules): correctAnswer,
  acceptableAnswers, tolerance, modelAnswer, evaluationGuidance. Never sent to
  non-authoring roles.
- **QuestionBankItem** (`question-bank-item.ts`) — reusable question template
  with usage stats (`usageCount`, `averageScore`, `lastUsedAt`); imported into
  items which then reference it via `linkedQuestionId`.

---

## 3. Where creation logic lives — the crux & SSOT

Three layers, one source of truth:

| Layer                              | Location                                                                                                                               | Responsibility                                                                                                                                                                                                     |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Editor (UI)**                    | `apps/teacher-web/src` (`SpaceEditorPage`, `StoryPointEditor`, `ItemEditor`, `QuestionBankEditor`, `RubricEditor`, `AgentConfigPanel`) | Form UX, drag-drop reorder, rich-text/KaTeX editing, auto-save debounce, bulk ops, validation display. Calls SDK mutation hooks from `@levelup/query`.                                                             |
| **Backend (callables + triggers)** | `functions/levelup/src/callable/*` and `.../triggers/*`                                                                                | Authoritative writes: validation, versioning, **answer-key extraction/stripping**, store-listing mirror, cascade delete, notifications, rate-limits, role checks (teacher/tenantAdmin).                            |
| **Domain schema (SSOT)**           | `packages/domain/src/entities/content/*` + `enums/content.ts`                                                                          | The **single source of truth** for taxonomy: item/question/material/story-point types, payload discriminated unions, rubric/answer-key/version shapes. Both editor and backend validate against these Zod schemas. |

**The crux:** the domain package is the SSOT. The editor and backend are two
consumers of the same Zod schemas. The one place where they legitimately diverge
is the **answer-stripping seam** — the item a student reads ≠ the item a teacher
edits, mediated by `getItemForEdit` re-merging the `answerKeys` subcollection.
Understanding that split is the key to this vertical.

**Firestore shape written by the backend:**

```
tenants/{tid}/spaces/{sid}                                   ← Space (status-driven)
  /storyPoints/{spid}                                        ← StoryPoint
    /items/{iid}                                             ← Item (answer-stripped for students)
      /answerKeys/{akid}                                     ← server-only correct answers
  /versions/{vid}                                            ← ContentVersion audit log
tenants/{tid}/questionBank/{id}                              ← reusable QuestionBankItem
tenants/{tid}/rubricPresets/{id}                             ← reusable RubricPreset
tenants/platform_public/spaces/{sid}                         ← public store-listing mirror
```

**Implemented callables (all teacher/admin-gated, rate-limited):** `saveSpace`,
`saveStoryPoint`, `saveItem`, `getItemForEdit`, `listVersions`,
`saveQuestionBankItem`, `listQuestionBank`, `importFromBank`,
`saveRubricPreset`. **Triggers:** `onSpacePublished` (notify assigned students),
`onSpaceDeleted` (cascade-clean 6+ related collections/subcollections + RTDB
leaderboard + tenant stat decrement).

---

## 4. AI-Assisted Generation — what exists vs aspirational

**What exists (skill-level, human-driven):**

- The **`content-item-generator` skill**
  (`.agents/skills/content-item-generator/SKILL.md`) is a _reference/prompt
  library_: it documents all 15 question types, 7 material types, 4 story-point
  types, payload templates, and AI-generation patterns for authoring content
  **from a topic**. It's used by an agent/human building seed data or content —
  not an in-app runtime feature.

**What is aspirational (contract-only, NOT wired):**

- **`v1.levelup.generateContent`** — a fully-specified contract
  (`packages/api-contract/src/callables/levelup/generate-content.ts`) for
  AI-gateway draft generation of items from a spec or source PDF. It returns
  **drafts only, no auto-persist** (accept step is `saveItem`), gated behind
  cost/quota/moderation, `authoritySensitive`, `ai` rate tier.
- **There is NO backend implementation.** It appears only in
  `functions/sdk-v1/src/levelup.ts` as a comment listing expected callables — no
  router registration, no handler. So the in-app "generate items with AI from a
  topic/PDF" button is **designed but not built**.

**Bottom line:** AI generation today = a skill an operator/agent uses at
authoring time to hand-produce content. The productized in-app "generate
content" flow is spec-complete on the contract side but has no server
implementation yet.

---

## 5. Known Parity / Contract Gaps & Rough Edges

**Missing backend callables (contract or UI expects, backend absent):**

- **`generateContent`** — contract exists, **no impl** (see §4).
- **`saveExamQuestion`** — not in the levelup module at all. Exam functions live
  in the **autograde** module
  (`api-contract/src/callables/autograde/save-exam.ts`); the teacher-web exam UI
  (`ExamCreatePage`) calls `callSaveExam` via shared-services, i.e. the exam
  vertical is a **separate module** from content authoring, not part of levelup
  content writes.
- **`bulk-approve` / bulkApprove** — not designed or implemented anywhere. No
  content-approval workflow exists. (`saveSpaceReview` is user star-ratings,
  unrelated.)
- **No server-side `duplicateSpace`** — "Duplicate space" is composed
  **client-side** (`SpaceListPage` reads source space + story points +
  answer-bearing items via getForEdit and deep-copies into a fresh draft).
  Fragile; belongs on the server.

**Schema mismatch — `saveSpace` (HIGH):** The implementation's UPDATABLE_FIELDS
include `defaultTimeLimitMinutes`, `allowRetakes`, `maxRetakes`,
`showCorrectAnswers`, `defaultRubric` — **none of these are in the contract
schema** (contract has `defaultRubricId`, not `defaultRubric`). The teacher-web
`SpaceSettingsPanel` deliberately **drops** the legacy
retake/price/time-limit/showCorrectAnswers fields before calling the SDK
(they're not in the contract), so those knobs are effectively **un-editable from
the new UI** even though the backend supports them. Note: the **domain space
entity DOES carry `price`** and store fields, and the contract DOES declare
`price`/store fields — so store pricing works; it's the retake/time-limit family
that's stranded.

**Other rough edges:**

- **QuestionBankEditor** only renders config UI for
  mcq/mcaq/true-false/numerical; other question types are accepted but have no
  editing UI in the bank.
- **RubricEditor** dimension-based mode has a stubbed `addDimension` with no
  full editing UI in the reviewed file (criteria-based path is complete).
- **Versions** are audit-only — **no revert/restore** UI or backend.
- **`importFromBank`** contract claims idempotency (UUIDv7 envelope dedup) but
  the callable body doesn't show the dedup — assumed handled in the api-client
  adapter/envelope layer; worth verifying.
- **`listQuestionBank`** filters arrays (topics, tags) **client-side** due to
  Firestore query limits — pagination + array filters interact imperfectly.
- **Legacy flat item path** (`spaces/{sid}/items/{iid}`) is still read as a
  fallback alongside the canonical nested path — dual-path tech debt.

---

## Appendix — Key file references

- **UI:**
  `apps/teacher-web/src/pages/spaces/{SpaceEditorPage,SpaceListPage,QuestionBankPage}.tsx`,
  `components/spaces/{StoryPointEditor,ItemEditor,ItemPreview,SpaceSettingsPanel,AgentConfigPanel}.tsx`,
  `components/question-bank/QuestionBankEditor.tsx`,
  `components/rubric/RubricEditor.tsx`,
  `pages/exams/{ExamCreatePage,ExamListPage,ExamDetailPage}.tsx`
- **Backend:**
  `functions/levelup/src/callable/{save-space,save-story-point,save-item,create-item,get-item-for-edit,list-versions,save-question-bank-item,list-question-bank,import-from-bank,save-rubric-preset}.ts`,
  `triggers/{on-space-published,on-space-deleted}.ts`,
  `utils/{content-version,auth,rate-limit}.ts`
- **Contract:** `packages/api-contract/src/callables/levelup/*` (incl.
  `generate-content.ts` — unimplemented)
- **Domain (SSOT):** `packages/domain/src/entities/content/*`,
  `entities/levelup/{space,story-point}.ts`, `enums/{content,space}.ts`
- **Skill:** `.agents/skills/content-item-generator/SKILL.md`
