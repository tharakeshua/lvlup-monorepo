# Autograde Exam Lifecycle — UI Flow Map

**App:** `apps/teacher-web` (port `4569`, base URL `http://localhost:4569`)
**Spec:** `tests/e2e/autograde-full-flow.spec.ts` (scaffold) **Playwright
project:** `autograde` (root `playwright.config.ts:46-57`)

> **URL convention note (past lesson):** the teacher-web exam URLs use the
> slash-separated nested pattern `/exams/:id/submissions/:id`, the same family
> as `/spaces/:spaceId/story-points/...`. There is no `/exam/` (singular) or
> `/story/` (without `-points`) route in this app.

---

## 0. Authentication

- **Page:** `/login`
- **Login type:** two-step school-code (admin/teacher/parent share this form)
- **Credentials (seed):**
  - school code: `GRN001`
  - email: `priya.sharma@greenwood.edu`
  - password: `Test@12345`
- **Helper:** `tests/e2e/helpers/auth.ts:15` — `loginWithSchoolCode()`
- **Past lesson:** Firebase Auth rate-limits if every test logs in fresh. The
  scaffold uses a `storageState` reused at `tests/e2e/.auth-state-teacher.json`
  (gitignored pattern, matches `.auth-state-cycle3.json`). One real login per CI
  run, every subsequent context reuses the cookies + IndexedDB tokens.

---

## 1. Exam list — `/exams`

- **File:** `apps/teacher-web/src/pages/exams/ExamListPage.tsx`
- **Entry point** for the teacher to find or create an exam.
- **Key elements:**
  - `<h1>Exams</h1>`
  - "New Exam" link → `/exams/new` (line 50)
  - Status tabs: All / Draft / Published / Grading / Completed / Archived
    (line 70)
  - Search input: placeholder `"Search exams..."` (line 63)
  - Each exam row: `<Link to="/exams/{id}">` (line 112)
- **Empty state:** "No exams yet" + CTA button (line 97)
- **Data hook:** `useExams(tenantId, { status })`

---

## 2. Create exam — `/exams/new`

- **File:** `apps/teacher-web/src/pages/exams/ExamCreatePage.tsx`
- **4-step wizard**, state machine: `metadata → upload → review → publish`
  (lines 23-28)

### 2a. Metadata (lines 172-293)

| Field                    | Selector                                                        | Notes                                                                                                                        |
| ------------------------ | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Title                    | `getByPlaceholder('e.g. Mid-Term Mathematics')`                 | required                                                                                                                     |
| Subject                  | `getByPlaceholder('Mathematics', { exact: true })`              | required                                                                                                                     |
| Topics                   | `getByPlaceholder('Algebra, Geometry')`                         | comma-separated                                                                                                              |
| Total Marks              | `input[type=number]:nth(0)`                                     | required                                                                                                                     |
| Passing Marks            | `input[type=number]:nth(1)`                                     | required                                                                                                                     |
| Duration                 | `input[type=number]:nth(2)`                                     | minutes                                                                                                                      |
| Classes                  | **`<ClassMultiSelect>` — Popover + role="combobox"** (line 253) | **NOT a free-text input anymore**. Old spec at `autograde.spec.ts:117` (`getByPlaceholder('class_10a, class_10b')`) is dead. |
| Link to Space (optional) | `<Select>` with placeholder "None" (line 268)                   | published spaces only                                                                                                        |

**Submit button:** `Next` → calls `validateMetadata()` (line 63), advances to
upload step.

### 2b. Upload question paper (lines 296-359)

- **Dropzone:** `aria-label="Upload question paper files"` (line 311) —
  clickable div
- **Hidden file input:** `<input type="file" multiple accept="image/*,.pdf">`
  (line 320)
- **Selected files render** as `<Badge variant="secondary">{filename}</Badge>`
- **Submit button:** `Upload & Continue` (line 348) — calls `handleUploadFiles`
  (line 76)
- **Spinner state:** `<Loader2>` + text "Uploading..." (line 344)
- **Storage path:** `tenants/{tenantId}/question-papers/{ts}_{filename}`
  (line 84)
- **Alt path:** `Skip (no question paper)` (line 354) → goes to review with
  empty list

### 2c. Review (lines 362-414)

- Read-only `<dl>` summary of all metadata + image count:
  `"N image(s) uploaded"`
- Submit button: `Continue to Publish` (line 410)

### 2d. Publish (lines 417-447)

- Heading text: `"Ready to Create"`
- Submit button: `Create Exam` (line 442) — calls `handlePublish` (line 101)
- **Callable invoked:**
  `callSaveExam({ ...metadata, gradingConfig: { autoGrade: true }, questionPaperImages: [...] })`
  (line 117)
- **On success:** `navigate('/exams/{result.id}')` (line 127)
- **Spinner state:** button text "Creating..." (line 438)

---

## 3. Exam detail — `/exams/:examId`

- **File:** `apps/teacher-web/src/pages/exams/ExamDetailPage.tsx`
- **Data hooks:** `useExam`, `useSubmissions` (line 292), plus direct Firestore
  read of `tenants/{t}/exams/{examId}/questions` ordered by `order` asc
  (line 347)

### Header action buttons (lines 547-628)

| Button                                           | When visible                                                 | Click handler                       | Callable                                       |
| ------------------------------------------------ | ------------------------------------------------------------ | ----------------------------------- | ---------------------------------------------- |
| Edit                                             | always                                                       | opens `ExamMetadataEditDialog`      | —                                              |
| **Extract Questions** ✨ (purple, Sparkles icon) | `status === "question_paper_uploaded"`                       | `handleExtractQuestions` (line 375) | `callExtractQuestions({ tenantId, examId })`   |
| Publish (green, Globe icon)                      | `draft / question_paper_uploaded / question_paper_extracted` | line 361                            | `callSaveExam({ status: "published" })`        |
| Release Results                                  | `status === "completed"`                                     | line 367                            | `callSaveExam({ status: "results_released" })` |
| Link to Space / Submissions                      | always                                                       | —                                   | navigation                                     |
| Download Results PDF                             | post-grading                                                 | line 615                            | `callGenerateReport({ type: "exam-result" })`  |

**Spinner during extract:** button text becomes `"Extracting..."` with
`<Loader2>` (line 565).

### Status state machine (observed)

```
draft
  → question_paper_uploaded     (set by callSaveExam on initial create)
  → question_paper_extracted    (set by extractQuestions on AI completion)
  → published                   (set by Publish button)
  → grading                     (auto, set by pipeline triggers)
  → completed                   (auto, when all submissions reviewed)
  → results_released            (set by Release Results button)
```

### Tabs (lines 675-1078)

- **Questions tab:**
  - Each question card shows: text, marks, confidence badge `confidence%`,
    Re-extract (if confidence < 0.7), Edit, Rubric
  - Per-question edit writes directly to
    `tenants/{t}/exams/{examId}/questions/{id}` (line 420)
  - Re-extract single:
    `callExtractQuestions({ mode: "single", questionNumber })` (line 403)
- **Submissions tab:** mirrors the SubmissionsPage data
- **Settings tab:** advanced metadata

### "Confirm & Publish" banner

When `status === "question_paper_extracted"`, a yellow banner appears with a
`Confirm & Publish` button (line 744) — alternative path to publish.

---

## 4. Submissions — `/exams/:examId/submissions`

- **File:** `apps/teacher-web/src/pages/exams/SubmissionsPage.tsx`
- **Where answer sheets are uploaded** — the second AI-trigger point.

### Upload form (lines 343-461)

| Element            | Selector                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------------------ |
| Card heading       | `getByRole('heading', { name: /Upload Answer Sheet/ })`                                          |
| Class `<Select>`   | placeholder `"Select a class"` (line 360) — auto-picks the only class when one exists (line 100) |
| Student `<Select>` | placeholder `"Select a student"` (line 374) — disabled until class chosen                        |
| Dropzone           | clickable div, text "Click to upload or drag and drop" (line 413)                                |
| Hidden file input  | `<input type="file" multiple accept="image/*,.pdf">` (line 415)                                  |
| Submit button      | "Upload" (line 456), disabled until class + student + files chosen                               |

### Submit handler (`handleUploadSubmission`, line 105)

1. Files uploaded to `tenants/{t}/submissions/{examId}/{ts}_{filename}`
   (line 126)
2. `callUploadAnswerSheets({ tenantId, examId, studentId, classId, imageUrls })`
   (line 132)
3. Server kicks off the OCR + scouting + grading pipeline

### Pipeline status badges (per submission row)

`pipelineStatus` values (lines 43-69):

- `uploaded` (initial)
- `ocr_processing`
- `scouting`
- `scouting_complete`
- `grading`
- `grading_partial`
- `grading_complete`
- `ready_for_review` ← terminal happy path
- `reviewed` ← after teacher approval
- `failed` / `manual_review_needed` ← error/fallback

A purple progress bar reflects `sub.gradingProgress.percentComplete` (lines
515-540). The `PipelineSteps` component (line 577) renders a 4-step bar: Upload
→ Mapping → Grading → Review.

### Batch actions (top-right, lines 281-296)

- `Export CSV`
- `Release All Results (N)` → flips `resultsReleased: true` on each submission
  (lines 151-165)

---

## 5. Grading review — `/exams/:examId/submissions/:submissionId`

- **File:** `apps/teacher-web/src/pages/exams/GradingReviewPage.tsx`
- **Live Firestore listeners:**
  - `onSnapshot(doc(submissions/{submissionId}))` (line 128)
  - `onSnapshot(collection(questionSubmissions))` (line 145)
- One-shot exam.questions fetch (line 110)

### Header actions (lines 544-600)

| Button                                    | Selector / icon                                      | Click handler                                                      | Effect                                                                                                                              |
| ----------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Previous / Next submission                | text "Previous"/"Next"                               | navigation                                                         | switches to neighbouring submission                                                                                                 |
| **Grade N Pending** ✨ (violet, Sparkles) | `getByRole('button', { name: /Grade \d+ Pending/ })` | `handleGradeAllPending` (line 268)                                 | loops `callGradeQuestion({ mode: "ai" })` per pending question                                                                      |
| **Approve All** 👍 (green, ThumbsUp)      | `getByRole('button', { name: /Approve All/ })`       | opens `<AlertDialog>` (line 1269) → `handleBulkApprove` (line 293) | Firestore writeBatch: flip each questionSubmission to `gradingStatus: "manual"` + parent submission to `pipelineStatus: "reviewed"` |

### Summary cards (lines 604-637)

- Total score
- Percentage
- Letter grade
- Questions graded count

### Per-question card (lines 736-1249)

- Header row: `Q{n}.` + truncated text + confidence% badge (line 762) + status
  icon + `X/maxMarks`
- Click row → toggles `expandedQ` (line 748)
- Keyboard shortcuts: `j/k/Enter/a/o/?` (lines 411-462)
- Expanded view: left = student answer images (resolved from Storage via
  `getDownloadURL`, line 854), right = AI evaluation block (score, confidence
  bar, strengths/weaknesses, rubric breakdown, summary)
- **Action buttons** (per question):
  - **Grade with AI / Re-grade with AI** (lines 1136-1157) → `handleAiGrade` →
    `callGradeQuestion({ mode: "ai", … })` (line 248). Disabled when no
    `mapping.imageUrls`.
  - **Accept AI Grade (X/Y)** (lines 1163-1174) → Firestore `updateDoc` on
    `questionSubmissions/{id}` setting `gradingStatus: "manual"` (lines 337-344)
  - **Manual Override form** (lines 1195-1244):
    - Number input — `data-override-input={questionId}` (line 1200) **(the ONLY
      data-\* attribute in the exam pages)**
    - Text input "Reason for override (required)"
    - "Override" button →
      `callGradeQuestion({ mode: "manual", score, feedback })` (line 215)

### Filter pills (lines 709-728)

`All` / `Review` / `Low Confidence` — controls `reviewFilter` state.

---

## 6. AI Strategy — three options for the scaffold

The autograde flow has TWO AI choke-points: (a) `extractQuestions` callable for
the question paper, and (b) the grading pipeline (OCR + scouting + grading)
triggered by `callUploadAnswerSheets`.

| Strategy                            | When to use                          | What it covers                                                                                                       | Effort                                                              |
| ----------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **`live`** (default once green-lit) | acceptance / pre-release             | full real flow, real Vertex/Gemini calls                                                                             | none (just deploy)                                                  |
| **`mock`**                          | CI on every commit                   | UI contract only; `route()` intercepts callables                                                                     | medium — needs canned response fixtures from backend worker         |
| **`seeded`**                        | regression of grading-review UI only | skips both AI steps by pre-writing `questions/`, `submissions/`, `questionSubmissions/` Firestore docs via Admin SDK | high — needs seed helper that mirrors the autograde server contract |

**Scaffold currently supports:**

- `RUN_AI=0` (default) — runs steps 1-3 only (login → create exam shell) and
  skips 4-9. Useful for verifying the UI contract independently of the backend.
- `RUN_AI=1 AI_STRATEGY=live` — runs the whole thing against real AI.
- `RUN_AI=1 AI_STRATEGY=mock` — runs with intercepted callables (TODO: wire real
  fixtures into `installAiMocks()` once backend worker delivers the contract).

---

## 7. Firestore docs that mutate during a full run

```
tenants/{t}/exams/{examId}
  └ status                       ← cycles draft → … → results_released
  └ questionPaperImages          ← storage paths array

tenants/{t}/exams/{examId}/questions/{qid}
  └ text, marks, rubric          ← created by extractQuestions
  └ confidence                   ← AI confidence

tenants/{t}/submissions/{submissionId}
  └ pipelineStatus               ← OCR/grading pipeline
  └ summary                      ← totals
  └ resultsReleased              ← Release All Results

tenants/{t}/submissions/{submissionId}/questionSubmissions/{qsId}
  └ gradingStatus                ← pending | ai_graded | manual
  └ evaluation                   ← AI eval block
  └ mapping.imageUrls            ← scouted answer image refs
  └ manualOverride               ← override audit trail
```

---

## 8. Reusable helpers already in repo

| Path                                   | What it gives you                             |
| -------------------------------------- | --------------------------------------------- |
| `tests/e2e/helpers/auth.ts:15`         | `loginWithSchoolCode(page, code, email, pwd)` |
| `tests/e2e/helpers/auth.ts:121`        | `expectDashboard(page, heading)`              |
| `tests/e2e/helpers/selectors.ts:36-48` | `CREDENTIALS.teacher1` / `SCHOOL_CODE`        |
| `tests/e2e/helpers/seed-guards.ts:29`  | `seedHealthCheck()`                           |
| `tests/e2e/cycle-3-audit.ts:16-77`     | reference storageState reuse pattern          |

---

## 9. Resolved decisions (per coordinator, wave-2 prep)

1. **Tenant / teacher / class / student** are no longer borrowed from ambient
   seed. The spec calls `seedAutogradeTenant()` (helpers/autograde-seed.ts) in
   `beforeAll` to idempotently provision its OWN `AGE2E1` tenant with one
   teacher (`autograde-teacher@e2e.test`), one class, one student. Override via
   `TENANT_CODE / TEACHER_EMAIL / TEACHER_PASSWORD / STUDENT_EMAIL` env vars.
2. **AI mock fixtures** remain TODO placeholders (`installAiMocks()` in the
   spec). Will be wired to the backend worker's CONTRACT REPORT shapes once the
   coordinator routes them.
3. **Pipeline waiter** replaced — now uses Admin-SDK `onSnapshot` via
   `helpers/autograde-pipeline-waiter.ts`:
   - `waitForExtractedQuestions(tenantId, examId)` for step 4
   - `waitForSubmissionStatus(tenantId, submissionId, [...])` for step 7/8
   - `waitForAllQuestionsGraded(tenantId, submissionId)` for step 8 No more
     page-reload polling.
4. **Dev-server lifecycle:** explicitly kept manual (no `webServer` block).
   Pre-flight in the spec header instructs `lsof -i :4569` before running, to
   avoid colliding with an already-running `apps/teacher-web` dev process.

---

## 10. How to run

```bash
# 1. Dev server (separate terminal — NOT auto-started by Playwright)
cd apps/teacher-web && npm run dev    # http://localhost:4569
lsof -i :4569                          # confirm it's up before running tests

# 2a. Emulator backend (recommended for scaffold smoke):
firebase emulators:start --only auth,firestore
export FIRESTORE_EMULATOR_HOST=localhost:8080
export FIREBASE_AUTH_EMULATOR_HOST=localhost:9099

# 2b. OR live Firebase backend (only after coordinator green light):
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
export GOOGLE_CLOUD_PROJECT=lvlup-ff6fa

# 3. Scaffold mode (default — Admin-SDK seed + steps 1-3 only; AI steps skip)
npm run test:e2e -- --project=autograde -g "Autograde Full Flow"

# 4. Full live run (after backend contract delivered + coordinator green light)
RUN_AI=1 AI_STRATEGY=live npm run test:e2e -- --project=autograde \
  -g "Autograde Full Flow"

# 5. With mocked AI (once contract fixtures are wired into installAiMocks)
RUN_AI=1 AI_STRATEGY=mock npm run test:e2e -- --project=autograde \
  -g "Autograde Full Flow"
```

## 11. New helper files

| File                                             | Purpose                                                                                                                                  |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/e2e/helpers/autograde-seed.ts`            | `seedAutogradeTenant()` — idempotent Admin-SDK provisioning of tenant + teacher + class + student with custom claims                     |
| `tests/e2e/helpers/autograde-pipeline-waiter.ts` | `waitForExtractedQuestions` / `waitForSubmissionStatus` / `waitForAllQuestionsGraded` — onSnapshot listeners replacing UI reload polling |
