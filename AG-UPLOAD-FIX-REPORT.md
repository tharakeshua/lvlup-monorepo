# AG-UPLOAD fix report

Exam `1m7kU8xD4gDP2enLzvzY` (math, tenant_subhang, prod lvlup-ff6fa). Student
"Test Student" `4ETnX1nentEZZiQ4yYXV`, existing submission
`6omELCriIyCs1ExqgPbr`.

## BUG 2 — submissions page empty → ALREADY RESOLVED LIVE (verified)

Logged in live as `subhang.rocklee@gmail.com` on
https://lvlup-ff6fa-teacher.web.app and opened
`/exams/1m7kU8xD4gDP2enLzvzY/submissions`. The list **renders the submission
correctly** (Total 1, Graded 1, 63% avg; row "Ready For Review · 62.5/100 · 63%
(B) · Released"). No app console errors (only an unrelated MetaMask extension
exception). Fetched the deployed `v1-autograde-listSubmissions` wire response
directly — it is schema-clean:

```
items:[{ id:6omEL…, pipelineStatus:"ready_for_review",
  summary:{totalScore:62.5,maxScore:100,percentage:62.5,grade:"B",questionsGraded:21,totalQuestions:24,…},
  resultsReleased:true, … }], nextCursor:null
```

The earlier "empty list" was the client `validateResponses` throwing on the
object-vs-string `evaluation.summary`; the teacher-web redeploy that shipped the
evaluation-summary object fix (commits 8c96e48 / 2c1ef45 / 52a1ec9) already
cleared it. No further code change needed for BUG 2. Note:
`studentName:"Unknown"` is a denorm miss (student lookup returned no name at
original upload) — the replace flow re-denormalizes studentName/rollNumber so a
replace repairs it.

## BUG 1 — re-upload silently swallowed → FIXED (code landed + gated; needs sdk-v1 redeploy)

Root cause (confirmed): `uploadAnswerSheetsService` wrapped creation in
`withIdempotency` under the PERMANENT business key
`uploadAnswerSheets:{examId}:{studentId}`. Once committed, every later upload
for that student replayed the cached `{submissionId: old}` with HTTP 200 —
Storage PUTs succeeded (orphaned files) but no submission was created/updated,
no error surfaced, the UI cleared silently. (The transport-layer `dedupe` is NOT
the cause: the client mints a fresh uuidv7 `__idempotencyKey` per call, so it
only collapses `withRetry` of one logical call.)

### Fix (design: explicit replace semantics + released-result protection)

Files:

- `packages/api-contract/src/callables/autograde/upload-answer-sheets.ts`
  - Request: `+ replace?: boolean` (optional). Response: `+ replaced?: boolean`
    (optional). Both optional → wire back-compat with the pre-replace backend.
- `packages/services/src/autograde/upload-answer-sheets.ts`
  - Idempotency key is now content-versioned:
    `uploadAnswerSheets:v2:{exam}:{student}:{hash(sorted imageUrls)}`. An
    identical scanner network-retry (same paths) still dedupes; a genuine
    re-upload (new scan paths) gets a fresh key and actually runs. The old
    committed keys are never queried again.
  - Body enforces exactly-one-submission-per-student:
    - No existing submission → create (unchanged) →
      `{submissionId, replaced:false}`.
    - Existing + `replace!==true` → `FAILED_PRECONDITION` with
      `meta:{reason:"submission_exists", existingSubmissionId, resultsReleased, pipelineStatus}`
      and a released-specific message. Released results are NEVER silently
      overwritten.
    - Existing + `replace===true` → re-point answerSheets at the new paths,
      re-denormalize studentName/rollNumber, reset
      summary/pipelineStatus→uploaded/gradingProgress/retryCount and
      `resultsReleased→false, resultsReleasedAt→null`, re-kick
      `enqueuePipelineAdvance(scouting)`. Same doc id (invariant held); the
      re-scout upserts deterministic `${sub}_${qid}` QuestionSubmission ids so
      no duplicates. Exam stats counter NOT bumped (not a new submission). →
      `{submissionId, replaced:true}`.
- `apps/teacher-web/src/pages/exams/SubmissionsPage.tsx`
  - Upload refactored: on `meta.reason==="submission_exists"` it shows an
    explicit **Replace / Cancel** confirm (loud warning when results were
    released) that re-calls with `replace:true` REUSING the already-uploaded
    storage paths (no re-upload). Honest outcome banners: "replaced — previous
    grade cleared, re-grading started" vs "uploaded — grading started".

### Gates (all green)

- services autograde tests: **90 pass** incl. 7 new replace-semantics tests
  (`upload-answer-sheets.gate.test.ts`): scanner-retry dedupes; genuine
  re-upload rejected w/o replace; replace overwrites in place + resets grading +
  keeps one submission; released re-upload carries `resultsReleased:true` in
  meta.
- api-contract registry-completeness: 21 pass. services build: success. dist
  verified to carry the fix.
- teacher-web typecheck: clean. teacher-web tests: 48 pass.
- Pre-existing UNRELATED red:
  `packages/services/src/conversation/submission-evaluation.ts:315`
  (evaluation.summary string→object migration, owned by conv-core; present
  before my edits; I'm constrained not to touch conversation code).

### Deploy ordering (IMPORTANT)

sdk-v1 backend redeploy is owned by conv-release-train. Deploy **sdk-v1 FIRST,
then teacher-web** — shipping the new client against the OLD backend would turn
the silent swallow into a false-positive "success" banner. teacher-web deploy
held until sdk-v1 carries these services + api-contract dists.

## LIVE VERIFICATION (post-deploy, 2026-07-19) — BOTH FIXES CONFIRMED

sdk-v1 redeployed by conv-release-train (v1-autograde-uploadAnswerSheets live,
asia-south1). teacher-web hosting flipped by me (target teacher-web →
lvlup-ff6fa-teacher, 299 files, release complete).

- **Backend (direct callable, as teacher subhang.rocklee):** re-upload WITHOUT
  replace for the existing released student → **HTTP 400 FAILED_PRECONDITION**,
  `details.meta={reason:"submission_exists", existingSubmissionId:6omEL…, resultsReleased:true, pipelineStatus:"ready_for_review"}`
  — NOT a silent 200 replay. Existing submission afterwards: **unchanged**
  (ready_for_review, released, 62.5%/B, still 21 images — the verify path was
  NOT written), and **submissionCount still 1** (no duplicate).
- **UI (teacher portal):** selected Test Student + a file + Upload → the app
  surfaces the new **Replace / Cancel** confirm banner: "This student's results
  were already _released_. Replacing will _discard the released grade_ and
  re-grade the new answer sheets — the student will lose access until you review
  and release again." Clicked **Cancel** → prompt dismissed, submission
  untouched. (Gotcha: the PWA service worker first served the STALE
  `SubmissionsPage-DnqrMcNR.js`; after unregistering the SW + clearing caches,
  the fresh `SubmissionsPage-Ba5vCc1M.js` loaded and the Replace UX rendered.
  Other teachers' browsers will pick up the new SW on their next navigation.)
- **Did NOT execute the destructive replace** on the owner's real released
  62.5%/B grade — that is the owner's explicit call (the UI now protects +
  prompts for it).

## Storage cleanup

- Deleted ONLY my 2 verification artifacts (70-byte 1×1 PNGs at 07:07Z/07:11Z,
  unreferenced) by exact path.
- LEFT the owner's ~54 orphaned answer-sheet JPGs (4 batches, 04:19–04:24Z) in
  place — directive gates their deletion on the owner's intended upload
  succeeding, which hasn't happened (replace not executed). The 21
  live-referenced images (submission 6omEL) were never touched.
- SAFE SWEEP when authorized: after the owner performs their real replace
  (updates answerSheets.images), delete every object in the folder NOT in the
  submission's current answerSheets.images. Can run on request.

## Deferred / owner's call

- Owner to decide: apply the intended re-upload via the now-protected Replace
  flow (discards the released 62.5%/B grade + re-grades) — then the orphan sweep
  can run.
