# RUL-1 — Firestore Rules + Index Audit (v1 autograde release model)

**Scope (locked):** autograde sections of `firestore.rules` (~349–432 +
evaluationSettings 574–585) and the autograde entries of
`firestore.indexes.json`. **Verdict:** No file edits applied. **No missing
composite indexes. No keying bug. Rules compile clean, indexes JSON valid.** The
one issue that matters is the **DEP-1 prefix mismatch** — reported below with an
explicit recommendation for Core's U2.4.

---

## 🔴 CRITICAL — DEP-1 prefix pre-check (headline finding)

**The deployed `sdk-v1` functions run with `LVLUP_COLLECTION_PREFIX=v2_`.**

- Configured in: **`functions/sdk-v1/.env.lvlup-ff6fa`** → single line
  `LVLUP_COLLECTION_PREFIX=v2_`.
- Consumed by: `packages/services/src/repo-admin/paths.ts` `collectionPrefix()`
  (`process.env["LVLUP_COLLECTION_PREFIX"] ?? ""`) → `topLevel()` prefixes the
  **`tenants` root**, so every tenant-scoped path becomes **`v2_tenants/{t}/…`**
  in production project `lvlup-ff6fa`.
- Corroborated by `packages/seed/seed-credentials.json`: _"v2 client rules stay
  deny-all — all reads go through the callable SDK (Admin-side, prefix-aware)."_

**Impact:** `firestore.rules` is static and prefix-UNAWARE — every autograde
match is `tenants/{tenantId}/…`. Against a `v2_tenants/…` deploy **no rule
matches → all direct client reads/writes fail closed** (the U2.4 blind spot).

**This is BY DESIGN, not a break:** the v1 autograde model is **callable-only**.
Every read/write goes through v1 callables running on the **Admin SDK, which
bypasses rules entirely**. Verified end-to-end: the SDK repos
(`packages/repositories/src/autograde/*`) import `api` only and call
`api.autograde.*`; the actual Firestore queries live server-side in `repo-admin`
under the Admin SDK. So the deny-all-by-mismatch outcome _aligns_ with the
intended "v2 client rules stay deny-all" design.

**⚠️ The trap for U2.4 (must warn Core):** the prefix mismatch is currently the
_only_ thing making the rule-level ⚷ gaps harmless in prod (see §3). **Do NOT
naively duplicate the current autograde blocks under `v2_tenants`.** A verbatim
duplication would REINTRODUCE raw client read of ⚷ content into production. For
autograde, the correct `v2_` posture is **deny-all client read**
(projection-only via callables), matching the seed-credentials intent. I did
**not** apply the generic prefix fix (that's Core's U2.4) — recommendation only.

---

## 1. Index audit — NO new composite indexes required

Every v1 autograde read (`packages/services/src/autograde/reads.ts` +
`pipeline/questions.ts` + `save-evaluation-settings.ts`) flows through the
generic Admin repo `makeEntityRepo(...).list()` (`repo-admin/entity-repo.ts`).
That builder applies **equality-only** `where(field,'==',v)` clauses and
**orders by `__name__` (documentId)** — role/status/class/student narrowing is
done **in-memory** via the `filter` callback, not in the query.

| Service read                   | Firestore query shape                                                                        | Index need                                                              |
| ------------------------------ | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `listExams`                    | `exams` where {status?, \_classId?, academicSessionId?, linkedSpaceId?} · orderBy `__name__` | none (equality + docId; zigzag-merge auto-served)                       |
| `listExamQuestions`            | `exams` where {examId} · orderBy `__name__`                                                  | none (single equality)                                                  |
| `listSubmissions`              | `submissions` where {examId} · orderBy `__name__`                                            | none (single equality)                                                  |
| `listQuestionSubmissions`      | `submissions` where {submissionId} · orderBy `__name__`                                      | none (single equality)                                                  |
| `getSubmissionForExam`         | `submissions` where {examId, studentId} · orderBy `__name__`                                 | none (2× equality; also already covered by existing `examId+studentId`) |
| `getExam` / `getExamAnalytics` | doc `get()` (`analytics_<examId>`)                                                           | none (point read)                                                       |
| `listEvaluationSettings`       | `evaluationSettings` no-where · orderBy `__name__`                                           | none                                                                    |
| `listDeadLetter`               | `outbox.drain()` collection read                                                             | none                                                                    |

Firestore serves _equality filters + orderBy(`__name__`)_ from single-field
indexes (zigzag merge join for multi-equality). **Nothing here requires a
composite index.**

**Note on existing entries:** the many `exams`/`submissions` composite indexes
in `firestore.indexes.json` (e.g. `examId+submittedAt`, `status+createdAt`,
`classIds CONTAINS + status`) are **legacy artifacts of the old field-ordered
`functions/autograde` backend** (now under `old-deprecated/`). They are **unused
by v1 but harmless** — I left them untouched (removal is out of scope and would
be pure churn).

---

## 2. Keying-bug check (the chatSessions `studentId`-vs-`userId` class) — CLEAN

Claims are minted **flat** (`sync-membership-claims.ts` →
`PlatformClaimsSchema`): `token.studentId`, `token.studentIds`,
`token.classIds`, `token.classIdsOverflow`, `token.role`, `token.tenantId`. The
autograde rules read exactly these flat claims:

- `submissions` student read:
  `resource.data.studentId == request.auth.token.studentId` — submission doc
  field `studentId` = student **entity id**; token claim = same entity id
  (matches service `ctx.entityIds.studentId`). ✅
- `submissions` parent read:
  `token.studentIds.hasAny([resource.data.studentId]) && resource.data.resultsReleased == true`.
  ✅ matches ground truth.
- `questionSubmissions` student read: via parent-submission's
  `studentId == token.studentId`. ✅ consistent.

No entityId-vs-authUid drift in the autograde block. (The chatSessions
`studentId`→`userId` fix does **not** recur here.)

---

## 3. Structural drift — nested rule paths are DEAD in v1 (flag for Core's U2.x / U2.4)

**v1 stores exam questions and question-submissions FLAT, not nested.**
`listExamQuestions` reads
`repos.exams.list(where:{examId}, filter:_kind==='examQuestion')`;
`listQuestionSubmissions` reads
`repos.submissions.list(where:{submissionId}, filter:_kind==='questionSubmission')`
(written with `_kind` across `grade-question.ts`, `process-answer-grading.ts`,
`process-answer-mapping.ts`). So:

- `tenants/{t}/exams/{examId}/questions/{questionId}` (rules 376–391) → **DEAD
  path, no v1 data.**
- `tenants/{t}/submissions/{subId}/questionSubmissions/{qsId}` (rules 418–431) →
  **DEAD path, no v1 data.**
- Real examQuestion / questionSubmission docs live in the **`exams` /
  `submissions` flat collections** and are therefore governed by the
  _parent-collection_ read rules. Under prefix `''` a direct client query on
  `exams`/`submissions` is only _incidentally_ blocked from ⚷ leakage
  (examQuestion docs lack `classIds`/`status`; qsub docs lack `studentId`, so
  the student clauses evaluate false). This is **implicit, not intentional** —
  and moot in prod only because of the v2\_ mismatch (§critical).

**Recommendation for the `v2_` autograde rules (U2.4):** deny-all client
read/write on autograde collections (`v2_tenants/{t}/exams`, `…/submissions`,
`…/evaluationSettings`, and the nested question paths). All autograde surface is
callable/Admin-SDK served; there is no legitimate direct client access to
protect, and raw docs carry ⚷ answer-key/rubric-guidance/eval-cost fields that
only the callable projections strip.

---

## 4. FLAG-ONLY items (confirmed present; NOT fixed — Core's U2.x)

1. **scanners path root-vs-tenant divergence** — rule is top-level
   `/scanners/{scannerId}` (line 225). Confirmed present; left for Core.
2. **root-level `storyPointProgress` unprotected** — the only
   `storyPointProgress` match in rules is the _nested_ one under `spaceProgress`
   (line 456, correctly gated). Any _root-level_ `storyPointProgress` collection
   has **no matching rule**. Confirmed; Core's U2.x.
3. **dead flat `spaces/{spaceId}/items/{itemId}` block** (rules 320–343) —
   canonical D1 path is nested `spaces/{s}/storyPoints/{sp}/items/{item}` (line
   296); the flat block is legacy/dead. Confirmed; Core's U2.x.

---

## 5. Verification

- `firebase emulators:exec --only firestore` → **`RULES_LOADED_OK`** (rules
  compiled + loaded clean, CLI 13.7.2).
- `node -e JSON.parse(firestore.indexes.json)` → **valid**, 59 indexes.

## Summary of deltas

- **Rules:** 0 edits (all drift is moot under the v2\_ callable-only deny-all
  deploy and belongs to Core's U2.4/U2.x on the same file; unilateral edits
  would conflict).
- **Indexes:** 0 additions (v1 equality + documentId ordering needs none).
- **Deliverable:** this audit + the explicit v2\_ deny-all recommendation for
  autograde.
