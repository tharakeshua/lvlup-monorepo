# Phase 4: Firestore Composite Indexes — Implementation Report

**Task:** `task_1771884218472_zy4b59s3u` **Completed by:** Identity Auth
Engineer (`sess_1771913587630_orbso7e5i`) **Date:** 2026-02-24

---

## 1. Files Modified

| File                                    | Action   | Description                                     |
| --------------------------------------- | -------- | ----------------------------------------------- |
| `firestore.indexes.json` (project root) | Modified | Expanded from 2 indexes to 42 composite indexes |

No new files were created. Only `firestore.indexes.json` was edited.

---

## 2. All Composite Indexes Added

### Previously Existing (2 indexes — preserved)

| #   | Collection        | Fields                             | Scope      |
| --- | ----------------- | ---------------------------------- | ---------- |
| 1   | `userMemberships` | uid ASC, status ASC                | COLLECTION |
| 2   | `userMemberships` | tenantId ASC, role ASC, status ASC | COLLECTION |

---

### Exams (7 indexes)

| #   | Collection | Fields                          | Scope      | Source                        |
| --- | ---------- | ------------------------------- | ---------- | ----------------------------- |
| 3   | `exams`    | status ASC, createdAt DESC      | COLLECTION | Task spec #1                  |
| 4   | `exams`    | classIds (CONTAINS), status ASC | COLLECTION | Task spec #2 — array-contains |
| 5   | `exams`    | createdBy ASC, status ASC       | COLLECTION | Task spec #3                  |
| 6   | `exams`    | status ASC, examDate ASC        | COLLECTION | Task spec #4                  |
| 7   | `exams`    | spaceId ASC, updatedAt DESC     | COLLECTION | Found in `useExams.ts`        |
| 8   | `exams`    | classId ASC, updatedAt DESC     | COLLECTION | Found in `useExams.ts`        |
| 9   | `exams`    | status ASC, updatedAt DESC      | COLLECTION | Found in `useExams.ts`        |

---

### Submissions (8 indexes)

| #   | Collection    | Fields                                       | Scope      | Source                                   |
| --- | ------------- | -------------------------------------------- | ---------- | ---------------------------------------- |
| 10  | `submissions` | examId ASC, studentId ASC                    | COLLECTION | Task spec #5 + `upload-answer-sheets.ts` |
| 11  | `submissions` | examId ASC, status ASC                       | COLLECTION | Task spec #6                             |
| 12  | `submissions` | examId ASC, createdAt DESC                   | COLLECTION | Task spec #7                             |
| 13  | `submissions` | studentId ASC, createdAt DESC                | COLLECTION | Task spec #8                             |
| 14  | `submissions` | examId ASC, submittedAt DESC                 | COLLECTION | Found in `useSubmissions.ts`             |
| 15  | `submissions` | studentId ASC, submittedAt DESC              | COLLECTION | Found in `useSubmissions.ts`             |
| 16  | `submissions` | status ASC, submittedAt DESC                 | COLLECTION | Found in `useSubmissions.ts`             |
| 17  | `submissions` | examId ASC, resultsReleased ASC, classId ASC | COLLECTION | Found in `release-exam-results.ts`       |

---

### Spaces (4 indexes)

| #   | Collection | Fields                          | Scope      | Source                         |
| --- | ---------- | ------------------------------- | ---------- | ------------------------------ |
| 18  | `spaces`   | status ASC, updatedAt DESC      | COLLECTION | Task spec #9 + `useSpaces.ts`  |
| 19  | `spaces`   | classIds (CONTAINS), status ASC | COLLECTION | Task spec #10 — array-contains |
| 20  | `spaces`   | createdBy ASC, status ASC       | COLLECTION | Task spec #11                  |
| 21  | `spaces`   | type ASC, status ASC            | COLLECTION | Task spec #12                  |

---

### StoryPoints (1 index)

| #   | Collection    | Fields                | Scope      | Source        |
| --- | ------------- | --------------------- | ---------- | ------------- |
| 22  | `storyPoints` | order ASC, status ASC | COLLECTION | Task spec #13 |

---

### Items (4 indexes)

| #   | Collection | Fields                            | Scope      | Source                                                   |
| --- | ---------- | --------------------------------- | ---------- | -------------------------------------------------------- |
| 23  | `items`    | storyPointId ASC, order ASC       | COLLECTION | Task spec #14                                            |
| 24  | `items`    | storyPointId ASC, orderIndex ASC  | COLLECTION | Found in `firestore.ts` (`loadItems`) + `create-item.ts` |
| 25  | `items`    | storyPointId ASC, orderIndex DESC | COLLECTION | Found in `create-item.ts` (get last item)                |
| 26  | `items`    | type ASC, storyPointId ASC        | COLLECTION | Task spec #15                                            |

> **Note:** Both `order` and `orderIndex` are indexed — task spec used `order`
> but actual code uses `orderIndex`. Both are covered to avoid missing queries.

---

### TestSessions (3 indexes)

| #   | Collection     | Fields                                    | Scope      | Source        |
| --- | -------------- | ----------------------------------------- | ---------- | ------------- |
| 27  | `testSessions` | studentId ASC, spaceId ASC                | COLLECTION | Task spec #16 |
| 28  | `testSessions` | spaceId ASC, status ASC                   | COLLECTION | Task spec #17 |
| 29  | `testSessions` | studentId ASC, status ASC, createdAt DESC | COLLECTION | Task spec #18 |

---

### DigitalTestSessions (3 indexes)

| #   | Collection            | Fields                         | Scope                | Source                                                            |
| --- | --------------------- | ------------------------------ | -------------------- | ----------------------------------------------------------------- |
| 30  | `digitalTestSessions` | userId ASC, storyPointId ASC   | COLLECTION           | Found in `start-test-session.ts`                                  |
| 31  | `digitalTestSessions` | spaceId ASC, status ASC        | COLLECTION           | Found in `archive-space.ts`                                       |
| 32  | `digitalTestSessions` | status ASC, serverDeadline ASC | **COLLECTION_GROUP** | Found in `on-test-session-expired.ts` (uses `.collectionGroup()`) |

> **Note:** `digitalTestSessions` is the actual collection name used in LevelUp
> Cloud Functions. It is distinct from `testSessions` in the task spec — both
> are indexed.

---

### SpaceProgress (2 indexes)

| #   | Collection      | Fields                                 | Scope      | Source        |
| --- | --------------- | -------------------------------------- | ---------- | ------------- |
| 33  | `spaceProgress` | studentId ASC, spaceId ASC             | COLLECTION | Task spec #19 |
| 34  | `spaceProgress` | spaceId ASC, completionPercentage DESC | COLLECTION | Task spec #20 |

---

### Progress (1 index)

| #   | Collection | Fields                     | Scope      | Source                                                           |
| --- | ---------- | -------------------------- | ---------- | ---------------------------------------------------------------- |
| 35  | `progress` | studentId ASC, spaceId ASC | COLLECTION | Found in `useProgress.ts` — actual collection name used in hooks |

> **Note:** `useProgress.ts` queries `tenants/{tenantId}/progress`, not
> `spaceProgress`. Both are indexed to cover the actual hook query.

---

### Classes (2 indexes)

| #   | Collection | Fields                            | Scope      | Source        |
| --- | ---------- | --------------------------------- | ---------- | ------------- |
| 36  | `classes`  | grade ASC, status ASC             | COLLECTION | Task spec #21 |
| 37  | `classes`  | academicSessionId ASC, status ASC | COLLECTION | Task spec #22 |

---

### Students (2 indexes)

| #   | Collection | Fields                             | Scope      | Source                         |
| --- | ---------- | ---------------------------------- | ---------- | ------------------------------ |
| 38  | `students` | classIds (CONTAINS), status ASC    | COLLECTION | Task spec #23 — array-contains |
| 39  | `students` | grade ASC, section ASC, status ASC | COLLECTION | Task spec #24                  |

---

### EvaluationSettings (1 index)

| #   | Collection           | Fields                 | Scope      | Source        |
| --- | -------------------- | ---------------------- | ---------- | ------------- |
| 40  | `evaluationSettings` | scope ASC, scopeId ASC | COLLECTION | Task spec #25 |

---

### LLM Call Logs (1 index)

| #   | Collection    | Fields                       | Scope      | Source        |
| --- | ------------- | ---------------------------- | ---------- | ------------- |
| 41  | `llmCallLogs` | taskType ASC, createdAt DESC | COLLECTION | Task spec #26 |

> **Note:** Task spec #27 (`createdAt` alone for daily aggregation) is a
> single-field sort — Firestore does not require a composite index for
> single-field queries. Omitted intentionally.

---

### Chat Sessions (1 index)

| #   | Collection     | Fields                                     | Scope      | Source        |
| --- | -------------- | ------------------------------------------ | ---------- | ------------- |
| 42  | `chatSessions` | studentId ASC, spaceId ASC, createdAt DESC | COLLECTION | Task spec #28 |

---

## 3. Decisions Made

### D1: Kept both `testSessions` and `digitalTestSessions`

The task spec referenced `testSessions` but the actual Cloud Functions in
`functions/levelup/src/` use `digitalTestSessions` as the collection name. Both
are indexed. This ensures no queries fail at runtime regardless of which name is
canonical in the final schema.

### D2: Kept both `spaceProgress` and `progress`

Task spec referenced `spaceProgress` but
`packages/shared-hooks/src/queries/useProgress.ts` queries a collection
literally named `progress`. Both are indexed to cover both naming conventions
until the codebase is normalized.

### D3: Indexed both `order` and `orderIndex` on items

Task spec used `order` as the sort field but actual functions (`create-item.ts`,
`firestore.ts`) use `orderIndex`. Both variants are indexed (4 items indexes
total: asc+desc for orderIndex, plus one for `order`) to avoid index-miss errors
on either variant.

### D4: COLLECTION_GROUP for `digitalTestSessions` expiry trigger

`on-test-session-expired.ts` uses `db.collectionGroup('digitalTestSessions')` to
query across all tenant subcollections for stale sessions. This requires
`queryScope: "COLLECTION_GROUP"` — the only COLLECTION_GROUP index in the file.

### D5: Omitted single-field-only indexes

Indexes where only one field is involved (e.g., `spaceId` alone, `createdAt`
alone) were not added — Firestore handles single-field queries automatically
without composite indexes.

### D6: Equality fields ordered before range/sort fields

All indexes follow Firestore's recommended field ordering: equality filters
first, then range/inequality/orderBy fields last. This ensures Firestore can use
the index efficiently.

### D7: Array-contains fields placed first

For `classIds (CONTAINS) + status` indexes on `exams`, `spaces`, and `students`,
the array field is placed before the equality field. Firestore requires the
`array-contains` field to be first in the index definition.

---

## 4. Verification Results

All checks passed post-implementation:

```
✓ JSON is valid
✓ Total indexes: 42
✓ All indexes have valid structure (collectionGroup, queryScope, fields)
✓ All queryScope values are valid (COLLECTION or COLLECTION_GROUP)
✓ No duplicate indexes
✓ Within Firestore 200-index limit (42/200)
✓ All 27 task-spec required indexes present
✓ COLLECTION_GROUP: digitalTestSessions [status+serverDeadline]
✓ Array-contains: exams.classIds, spaces.classIds, students.classIds
```

---

## 5. Deploy Command

```bash
firebase deploy --only firestore:indexes
```
