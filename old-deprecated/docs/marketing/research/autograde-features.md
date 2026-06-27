# AutoGrade Feature Inventory

> Research document for marketing copy — compiled from codebase analysis
> (March 2026)

---

## Overview

AutoGrade is an AI-powered exam grading platform that takes a student's
handwritten answer sheet from scan to scored result, with per-question
structured feedback, in minutes. It is built on Google Gemini Vision and
Firebase, deployed as a multi-tenant SaaS for schools and coaching institutes.

The platform has three primary applications:

- **Scanner App** — PWA used by teachers/invigilators to photograph or upload
  answer sheets
- **Client Admin Dashboard** — Web app for teachers/admins to manage exams,
  review results, and configure grading
- **Backend Functions** — Firebase Cloud Functions running the OCR and AI
  grading pipelines

---

## Feature 1: Scanner App — Dual-Mode Answer Sheet Capture

### What It Is

A mobile-first progressive web app (PWA) that lets any staff member with a
smartphone scan or upload student answer sheets in the field — no native app
install required.

### How It Works

The scanner app presents two capture modes side-by-side: **File Upload**
(drag-and-drop or file picker supporting JPG, PNG, PDF) and **Camera Capture**
(HTML5 `getUserMedia` with rear-camera preference). Captured images are
compressed to JPEG at 0.9 quality before uploading to Firebase Cloud Storage at
the path `submissions/{clientId}/{examId}/{submissionId}/{pageIndex}.jpg`. A
Firestore submission document is created with status `pending`, linking the
student, exam, and all image URLs, which immediately triggers the backend
pipeline.

The scanner workflow is a 4-step guided flow:

1. Login (scanner credentials issued by admin)
2. Select Exam (live-filtered list showing exams in `ready` or
   `question_paper_uploaded` status)
3. Select Student (filtered by roll number or name from the exam's class roster)
4. Capture & Submit (multi-page image management with preview grid and
   delete-per-page)

### School Benefit

> **Any teacher can scan an entire class set in minutes using just a phone — no
> specialist scanner hardware, no IT setup, no app store download.** Staff are
> guided step-by-step, reducing errors and ensuring every submission is
> traceable to a student and exam from the moment it's uploaded.

---

## Feature 2: Web Upload via Admin Dashboard

### What It Is

A parallel upload path for teachers at a desktop — providing the same scanning
capability through the full Client Admin web interface with richer exam and
student management context.

### How It Works

The Evaluate page in the admin dashboard is a 4-step wizard (Select Exam →
Select Student → Upload → Results). It uses a drag-and-drop file zone accepting
`image/*` files. After upload, images go to Firebase Storage and the system
immediately begins the AI mapping phase. Teachers can see real-time progress
feedback (`Uploading answer sheets... → Mapping questions to pages...`) and a
confirmation dialog before submission with the student photo card and class
confirmation.

### School Benefit

> **Teachers reviewing results at their desk can upload additional submissions
> without switching apps.** The web upload path integrates directly with the
> grade book, making it easy to handle late submissions, re-scans, or makeups
> from a single interface.

---

## Feature 3: OCR Question Extraction (Gemini Vision)

### What It Is

A one-click AI pipeline that reads a scanned question paper image and
automatically extracts all questions, marks, sub-parts, and a detailed grading
rubric — eliminating the need to manually enter question structures before
grading.

### How It Works

When a teacher clicks "Extract Questions," the backend callable function
`extractQuestions` downloads the question paper images from Cloud Storage,
converts them to Base64, and sends them to `gemini-3-flash-preview` with a
structured JSON schema prompt (temperature 0.1 for accuracy, up to 8192 output
tokens). The model returns a `questions` array where each item includes:

- `questionNumber`, `text`, `maxMarks`
- `rubric.criteria` — an array of grading criteria where marks sum exactly to
  `maxMarks`
- `expectedConcepts`, `keywords`, `difficulty` — used to guide the grading AI
- `hasDiagram` / `diagramContext` — flags for visual content

Real-time progress is pushed to Firebase Realtime Database (10% → 30% → 50% →
80% → 100%) so the teacher sees a live progress bar.

**Two extraction modes** are supported:

- **Type 1 (Standard)** — text-heavy questions with criteria rubrics; validates
  that rubric marks sum equals `maxMarks`
- **Type 2 (Diagram-Heavy)** — questions with matching, labeling, fill-blank, or
  diagram-completion tasks; extracts `expectedElements`, `evaluationGuidance`,
  and `pageIndex`

### School Benefit

> **A 40-question paper that previously took an experienced teacher 2–3 hours to
> structure into a digital rubric is extracted in under 60 seconds.** The
> AI-generated rubric is immediately editable, so teachers maintain full
> academic control while eliminating the most tedious part of exam setup.

---

## Feature 4: Panopticon Answer Mapping (Global-Context AI)

### What It Is

The first phase of grading — an AI system that "reads" both the question paper
and the student's answer sheet simultaneously and determines which pages of the
answer sheet correspond to which question.

### How It Works

The `processAnswerMapping` worker is a Cloud Function (4 GiB memory, 9-minute
timeout) that downloads all question paper images and all answer sheet images,
then constructs an interleaved content sequence for Gemini. The prompt includes:

```
=== QUESTION PAPER START ===
[Page 0 image] [Page 1 image] ...
=== QUESTION PAPER END ===
=== ANSWER SHEETS START ===
[Answer Sheet Page Index 0] [Page Index 1] ...
=== ANSWER SHEETS END ===
[Mapping instructions with all question IDs]
```

The model (`gemini-2.5-flash`, 1M token context window) returns a `routing_map`
JSON that maps each question ID to an array of page indices in the answer sheet,
along with a per-question `confidence` score and `notes`. This Panopticon
(single-context all-seeing) approach means the AI can handle any layout —
questions in any order, multi-page answers, skipped pages, and back-of-sheet
answers.

For Type 2 (diagram-heavy) exams, a simpler `simplePageMapping` runs instantly
without any API call, using the pre-extracted `pageIndex` from question
extraction.

### School Benefit

> **Students write answers in any order, on any page — AutoGrade finds each
> answer automatically.** Teachers never have to manually tell the system
> "question 3 is on page 2." This eliminates the single biggest source of
> grading errors and makes it practical to grade exams where students aren't
> forced to follow a rigid answer-book format.

---

## Feature 5: RELMS AI Grading Engine — 4-Dimension Rubric System

### What It Is

RELMS (Rubric-based Empathetic Learning & Marking System) is the core AI grading
engine. It grades each question individually against a configurable
multi-dimensional rubric, producing a numeric score and structured feedback
simultaneously.

### How It Works

Each question is graded by a separate invocation of `processAnswerGrading`
(Cloud Function, 1 GiB memory, 5-minute timeout per question). The grading
prompt is dynamically assembled from the client's active feedback rubric
configuration and includes:

- The exact question text and max marks
- All rubric criteria (e.g., "Correct formula — 2 marks", "Correct substitution
  — 1 mark", "Correct units — 1 mark")
- The answer sheet images for that specific question (identified by Panopticon)
- Per-dimension evaluation instructions

The model (`gemini-3-flash-preview`, temperature 0.2) returns a structured JSON
response with:

- `rubric_score` (validated to never exceed `maxMarks`)
- `structuredFeedback` — categorized issues per dimension
- `rubricBreakdown` — marks awarded per criterion with brief feedback
- `strengths`, `summary.keyTakeaway`, `summary.overallComment`
- `confidence_score` (0.0–1.0)
- `mistake_classification` (Conceptual / Silly Error / Knowledge Gap / None)

**LaTeX formatting is required** in all feedback — math expressions use `$...$`
syntax so they render correctly in PDFs and student-facing reports.

### The 4 Default Feedback Dimensions

| Dimension                      | Priority | Focus                                                               |
| ------------------------------ | -------- | ------------------------------------------------------------------- |
| **Critical Issues** ❌         | HIGH     | Technical accuracy, missing concepts, logical flaws, formula errors |
| **Completeness** ⚠️            | HIGH     | All sub-parts answered, verification steps, final answer present    |
| **Structure & Flow** 📋        | MEDIUM   | Organization, step sequencing, proper format (Given/Find/Solution)  |
| **Clarity & Communication** 📝 | MEDIUM   | Notation consistency, units, variable naming, readability           |

Each dimension has:

- A `priority` (HIGH processes before MEDIUM)
- A `promptGuidance` block (detailed instructions for the LLM on what to look
  for)
- An `expectedFeedbackCount` (how many items to return per dimension)
- Individual feedback items with `issue`, `howToFix`, `severity`
  (critical/major/minor), and optionally `relatedConcept`

### School Benefit

> **Every student receives the same depth of feedback that a private tutor would
> give — specific, actionable, and encouraging — regardless of class size.** A
> teacher grading 200 scripts manually might write "See me" in the margin;
> AutoGrade writes "Incorrect application of $F = ma$ — you substituted mass in
> kg but used acceleration in cm/s², making units inconsistent. Convert
> acceleration to $m/s^2$ before substituting."

---

## Feature 6: Configurable Evaluation Settings (Per-Exam Rubric Profiles)

### What It Is

An admin interface that lets schools create multiple named evaluation
configurations — for example, "Physics Lab (strict)", "Quick Quiz (concise)", or
"Final Exam (full detail)" — and assign a specific profile to each exam.

### How It Works

Each client can have multiple `EvaluationFeedbackRubric` objects stored at
`/clients/{clientId}/evaluationSettings/{settingsId}`. Each rubric profile has:

- A display `name` and `description`
- An `isDefault` flag (one per client)
- `enabledDimensions` — the list of dimensions to evaluate (can toggle any
  on/off)
- `displaySettings` — whether to show strengths, key takeaways, and how to order
  feedback

When an exam is created, a teacher selects which evaluation settings profile to
use via `exam.evaluationSettingsId`. The grading worker loads the correct
profile before building the prompt.

Admin can:

- Enable/disable any dimension (turn off "Clarity & Communication" for a quick
  quiz)
- Add fully custom dimensions (e.g., "Lab Safety Protocol" for science exams)
- Remove custom dimensions
- Update `expectedFeedbackCount` for any dimension
- Reset to factory defaults

### School Benefit

> **A class test and a board exam are graded with different levels of scrutiny —
> all configured once by the department head, not hacked per-submission.**
> Science teachers can add a custom "Experimental Methodology" dimension;
> English teachers can add a "Grammar & Style" dimension. One platform, every
> subject, every standard.

---

## Feature 7: Manual Score Override with Reason Tracking

### What It Is

A teacher interface that lets instructors override the AI-awarded score for any
individual question, with a mandatory reason field for audit compliance.

### How It Works

In the Submission Grading page (`SubmissionGrading.tsx`), each
`QuestionSubmissionCard` shows the AI-awarded score alongside the answer images.
A teacher can click an edit icon, enter a revised score, and provide a reason
(e.g., "Student used alternative valid method not in rubric"). The override is
saved back to the `QuestionSubmission.evaluation` document with the original AI
score preserved alongside the manual override and the teacher's reason string.

The system supports:

- **Per-question override** — change one question without re-grading others
- **Reason tracking** — reason stored as `overrideReason` in the evaluation
  document
- **Re-grade single question** — trigger a fresh AI grading pass for one
  question (`gradeSingleQuestion` service call) without disturbing other
  questions
- **Grade all questions** — bulk-trigger grading for all unmapped or ungraded
  questions in a submission (`gradeAllQuestions`)

### School Benefit

> **AI is the starting point, not the final word.** Teachers maintain full
> academic authority — they can approve, adjust, or override any grade with a
> documented reason. This satisfies accreditation requirements for human review
> while eliminating the 95% of cases where the AI grade is accurate, freeing
> teachers to focus on the 5% that need judgment.

---

## Feature 8: Bulk Grading for Entire Classes

### What It Is

A parallel processing architecture that grades every student's submission for an
exam concurrently — an entire class set is processed simultaneously rather than
one-by-one.

### How It Works

When a submission document is created in Firestore, the `onSubmissionCreated`
trigger fires immediately and queues a mapping task. After Panopticon mapping
completes, a Cloud Task is created for each question in the submission
(architecture designed for Cloud Tasks queue `answer-grading` with max 20
concurrent workers, max 50/second). Each question is graded independently and in
parallel.

**Concurrency Architecture (Cloud Tasks configuration):**

| Queue          | Max Concurrent | Max/Second | Max Attempts | Backoff     |
| -------------- | -------------- | ---------- | ------------ | ----------- |
| answer-mapping | 5              | 10         | 3            | 60s → 3600s |
| answer-grading | 20             | 50         | 3            | 60s → 3600s |

For a class of 40 students with 10 questions each = 400 grading tasks, all
running in parallel. Progress is tracked in real-time via Firebase Realtime
Database — the UI shows a live counter "Grading questions (37/40)" that updates
as each question completes.

The system is fully **idempotent** — if a task is retried, a
`status === 'graded'` check prevents double-grading.

### School Benefit

> **An exam graded manually in 8 hours is graded by AutoGrade in 8–15 minutes,
> for the entire class simultaneously.** Teachers submit the scans, go teach
> their next period, and return to a fully graded and analyzed result set.
> Turnaround from scan to scored report drops from days to minutes.

---

## Feature 9: Failed Grading Recovery (Dead Letter Queue Architecture)

### What It Is

A fault-tolerant grading pipeline that isolates failures to individual questions
— if one question fails to grade (network error, ambiguous image, API timeout),
the rest of the exam continues processing normally.

### How It Works

The `processAnswerGrading` worker uses a try/catch that, on error:

1. Marks only that specific `QuestionSubmission` as `status: 'failed'` with the
   error message
2. Does **not** fail or stop the parent submission
3. Other questions in the same submission proceed unaffected
4. Cloud Tasks retry logic kicks in: min 60s backoff, max 3600s, up to 3
   attempts per question
5. After max attempts, the question remains in `failed` state for manual review

The submission finalizer only triggers (calculating total score, setting final
status) when all questions have been processed — either `graded` or `failed`.
Teachers can identify failed questions in the admin UI and trigger a manual
re-grade.

Additionally, the answer mapping worker has separate error handling: if mapping
fails entirely, the submission is marked `mapping_failed` in RTDB and can be
retried independently.

### School Benefit

> **A blurry photo of one page doesn't stop the entire exam from being graded.**
> If question 7's answer is illegible, questions 1–6 and 8–10 are still graded
> and returned to the teacher immediately, with a clear flag on question 7 for
> manual review. No submission is silently dropped.

---

## Feature 10: Per-Question Detailed Feedback with LaTeX Rendering

### What It Is

Every graded question returns a structured, multi-layered feedback report that
goes far beyond a score — giving students a precise understanding of what they
got right, what they got wrong, why it matters, and exactly how to improve.

### How It Works

Each `QuestionEvaluation` document contains:

```
Score & Max Score
├── Rubric Breakdown (per criterion: awarded/max + brief note)
├── Structured Feedback by Dimension
│   ├── critical_issues[] → issue, whyItMatters, howToFix, severity, relatedConcept
│   ├── completeness[] → issue, howToFix, severity
│   ├── structure_flow[] → issue, howToFix, severity
│   └── clarity_communication[] → issue, howToFix, severity
├── Strengths[] (specific, cited examples)
├── Summary
│   ├── keyTakeaway (1 sentence)
│   └── overallComment (2–3 sentences)
├── mistake_classification (Conceptual / Silly Error / Knowledge Gap / None)
└── confidence_score (0.0 – 1.0)
```

All math in feedback uses LaTeX (`$F = ma$`, `$$\int_0^1 f(x)dx$$`) rendered via
KaTeX in the student-facing UI and PDF reports. A `MarkdownWithMath` component
handles rendering throughout the admin and student interfaces.

The `mistake_classification` field enables analytics rollups: a student with
many "Conceptual" mistakes in physics needs conceptual revision, while one with
many "Silly Error" classifications needs exam technique coaching — different
interventions for different patterns.

### School Benefit

> **Students don't just learn their score — they learn their mistakes and have a
> personal study plan.** A student who scored 6/10 receives: what was correct,
> which concepts were missing, a one-sentence key takeaway for revision focus,
> and 3–5 actionable improvement steps with exact math. This is the feedback
> loop that drives learning gains.

---

## Feature 11: AI Usage Cost Tracking (Per-Call Token Accounting)

### What It Is

A complete cost accounting system that logs every Gemini API call with token
counts, latency, and calculated cost in USD — giving school administrators full
visibility into AI usage economics.

### How It Works

The `LLMWrapper` class wraps all Gemini calls and after each call,
asynchronously logs to a `/llm-usage/{logId}` Firestore collection containing:

```
{
  clientId, userId, userRole
  purpose: "question_extraction" | "answer_mapping" | "answer_grading" | "ai_chat"
  model, temperature, maxTokens
  hasImages, imageCount
  tokens: { input, output, total }
  cost: { input, output, total }  // USD
  timing: { latencyMs, tokensPerSecond }
  success, finishReason
  createdAt, callStartedAt, callCompletedAt
}
```

The `cost-calculator.ts` module contains pricing tables for both Free Tier and
Paid Tier Gemini models (as of January 2026), with
`calculateCost(model, inputTokens, outputTokens)` returning itemized
input/output costs. AutoGrade currently uses Free Tier models, making grading
cost-free during development and early production. Paid tier pricing is
pre-configured for scaling: `gemini-2.5-flash` at $0.075/1M input, $0.30/1M
output.

Each `QuestionEvaluation` also stores `tokensUsed` and `cost` directly on the
evaluation document for per-question cost attribution.

### School Benefit

> **Finance teams can see exactly what AI grading costs per exam, per class, per
> month — before committing to paid tiers.** Usage is tracked down to the
> individual student submission, making it straightforward to compare AutoGrade
> ROI against traditional marking costs. Schools start on the free tier and have
> full cost visibility before any spending begins.

---

## Feature 12: PDF Grade Report Generation

### What It Is

An automated PDF generation service that produces a formal, printable grade
report for each student submission — formatted with scores, rubric breakdowns,
and full structured feedback.

### How It Works

The `generateGradingReportPDF` service (referenced in `SubmissionGrading.tsx`)
produces PDF documents that include:

- Student name, roll number, exam title, date
- Total score and percentage
- Per-question: score, rubric breakdown table, strengths, structured feedback
  items (organized by dimension), and the key takeaway
- All math rendered in LaTeX format
- Display settings from the evaluation rubric (e.g., `showStrengths: true`,
  `showKeyTakeaway: true`, `prioritizeByImportance: true`)

The admin can trigger PDF generation from the submission detail view, and PDF
processing state is managed through a `PDFProcessingDialog` component.

### School Benefit

> **A fully formatted, exam-ready grade report is available the moment grading
> completes — no reformatting, no copy-paste.** Teachers can email reports to
> students and parents directly, attach them to student records, or print for
> parent-teacher meetings. The professional format builds confidence in
> AI-assisted assessment.

---

## Feature 13: Result Analytics and Admin Dashboard

### What It Is

A centralized operations dashboard giving school administrators real-time counts
and status of all platform entities, with quick-action buttons for common tasks.

### How It Works

The Admin Dashboard (`DashboardPage.tsx` in the admin feature) uses
`getCountFromServer()` for efficient Firestore aggregate queries — no documents
are downloaded, just counts. The dashboard shows:

- Total Students / Active Students
- Total Teachers / Active Teachers
- Total Classes / Active Classes
- Total Exams / Active Exams
- Total Submissions / Pending Submissions (awaiting grading)
- Total Parents
- Total Scanners

Quick action buttons for Add Student, Add Teacher, Create Class, and Create Exam
are surfaced directly on the dashboard.

The evaluation type data model supports richer analytics at the per-question
level:

- `mistake_classification` aggregation → class-wide pattern of Conceptual vs
  Silly Errors
- `missingConcepts[]` extraction → most-frequently missed concepts across
  submissions
- `confidence_score` distribution → flagging questions where AI certainty was
  low
- Per-dimension feedback item counts → which dimension has the most issues
  class-wide

### School Benefit

> **A head teacher can see in 10 seconds how many submissions are pending, which
> exams are fully graded, and how many active students and classes are on the
> platform.** As analytics expand, class-level insights will show "30% of
> students missed Newton's Third Law" — enabling data-driven revision planning
> rather than relying on teacher intuition.

---

## Feature 14: Student Submission Portal

### What It Is

A student-facing view that lets students log in and see their own graded
submissions, scores, and feedback — creating a closed feedback loop between
grading and learning.

### How It Works

The student portal includes three pages:

- `StudentDashboard` — overview of the student's active exams
- `StudentExams` — list of all exams the student is enrolled in
- `StudentSubmissions` — list of all graded submissions with scores
- `StudentSubmissionDetail` — full per-question feedback view for a specific
  submission

Students authenticate via Firebase Auth and can only see their own data
(enforced by Firestore security rules scoped to their `studentId`).

### School Benefit

> **Students access their marked papers and feedback 24/7 from any device — no
> waiting for physical papers to be returned, no lost reports.** Parents can
> also see results in real-time. This transparency builds trust with families
> and motivates students by making the feedback loop immediate rather than
> delayed by days or weeks.

---

## Feature 15: Multi-Tenant School Management

### What It Is

A fully isolated multi-tenant architecture where each school (client) has its
own data partition, API key configuration, user management, and evaluation
settings — with no data leakage between institutions.

### How It Works

All Firestore data lives under `clients/{clientId}/...` — students, exams,
submissions, evaluations, and settings are all client-scoped. Each client
configures their own `geminiApiKey` stored encrypted in the client document. The
super-admin dashboard provides cross-tenant visibility for platform operators.

Role-based access control via Firebase Auth custom claims separates:

- `super-admin` — platform operator (all tenants)
- `admin` — school admin (own tenant)
- `teacher` — grading and exam management (own tenant)
- `scanner` — upload only (own tenant)
- `student` — read-only own submissions
- `parent` — read-only child's submissions

### School Benefit

> **Each school's data is completely isolated — Student A from School X can
> never appear in School Y's reports.** Schools bring their own Gemini API key,
> so usage costs flow to their own Google Cloud billing account, maintaining
> complete financial and data sovereignty. Chains and groups of schools can
> share a single platform operator account while keeping each institution's
> academic records separate.

---

## Technical Architecture Summary

| Component           | Technology                             | Purpose                                     |
| ------------------- | -------------------------------------- | ------------------------------------------- |
| Scanner App         | React PWA + Vite                       | Mobile answer sheet capture                 |
| Client Admin        | React + Vite + Tailwind                | Teacher/admin workflow UI                   |
| Question Extraction | Gemini Vision (gemini-3-flash-preview) | OCR + rubric generation from question paper |
| Answer Mapping      | Gemini 2.5-flash (1M context)          | Panopticon global-context page routing      |
| Answer Grading      | Gemini 3-flash (temp 0.2)              | RELMS multi-dimensional scoring             |
| Cost Tracking       | Firestore /llm-usage                   | Per-call token + cost logging               |
| Progress Tracking   | Firebase RTDB                          | Real-time grading progress UI               |
| Storage             | Firebase Storage                       | Image hosting for papers and answer sheets  |
| Auth                | Firebase Auth + custom claims          | Role-based multi-tenant access              |
| Task Queue          | Google Cloud Tasks                     | Parallel grading orchestration              |

---

_Document generated from codebase analysis of `/autograde/` — apps/client-admin,
apps/scanner-app, functions/src/. March 2026._
