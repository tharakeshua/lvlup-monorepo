# Fix: "Exam not found" after creating an autograde exam (teacher-web)

## Symptom

In teacher-web, creating an exam via the wizard — **when a question paper is
uploaded** — succeeds server-side but navigates to a blank
`Exam not found / Back to Exams` page. Creating an exam **without** a question
paper works.

## Root cause

The strict domain schema `ExamQuestionPaperSchema`
(`packages/domain/.../exam.ts`) requires four keys — it is a `.strict()`
`zObject`:

```
{ images, extractedAt (nullable, REQUIRED), questionCount, examType: "standard" }
```

The v1 create/upload write path `saveExamService → buildQuestionPaper`
(`packages/services/src/autograde/save-exam.ts`) persisted only
`{ images, questionCount, examType }` — **omitting `extractedAt`**.

`getExam` projects the stored `questionPaper` into the detail view, and the web
api-client is constructed with `validateResponses: true` (literal, not dev-gated
— `apps/teacher-web/src/sdk/api.ts:66`). So the strict `GetExamResponseSchema`
(→ `ExamQuestionPaperSchema`) parse **threw client-side**. `useExam` errored,
`exam` became `undefined`, and `ExamDetailPage` rendered "Exam not found".

Why only with a question paper: without one, `questionPaper` is `null`/absent
and the field is `.optional()`, so validation passes. The list view
(`ExamListViewSchema`) has no `questionPaper` field, so the exam still appeared
in the Exams list — only the detail read failed.

## Fix (two parts)

1. **Writer** — `buildQuestionPaper` now writes
   `extractedAt: prev.extractedAt ?? null` (null until `extract-questions` runs)
   and no longer spreads stray legacy keys.
2. **Reader (defensive)** — `toExamDetailView` now normalizes `questionPaper`
   through `canonQuestionPaper`, whitelisting the 4 canonical fields and
   defaulting `extractedAt` to `null`. This makes **already-created broken
   exams** viewable without a data migration.

## Tests

`packages/services/src/autograde/save-exam.question-paper-view.regression.test.ts`
(3 tests): writer persists a strict-valid `questionPaper`; `getExam` view parses
against the wire response schema; a legacy `questionPaper` missing `extractedAt`
is normalized so the view still validates.

## Deploy note

The fix lives in `@levelup/services`; it takes effect in production only after
the **sdk-v1** functions codebase is redeployed (pinned firebase-tools 13.35.1
per the DEP-1 deploy runbook). The reader-side normalization repairs exams
already created by the buggy writer once redeployed.
