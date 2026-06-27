# Teacher-Web Application — Functional & Non-Functional Requirements

> Auto-generated from codebase analysis on 2026-03-22

---

## Table of Contents

1. [Authentication & Authorization](#1-authentication--authorization)
2. [Navigation & Layout](#2-navigation--layout)
3. [Dashboard](#3-dashboard)
4. [Spaces Management](#4-spaces-management)
5. [Space Creation & Editing](#5-space-creation--editing)
6. [Story Points](#6-story-points)
7. [Content Items — Questions (15 Types)](#7-content-items--questions-15-types)
8. [Content Items — Materials (7 Types)](#8-content-items--materials-7-types)
9. [Question Bank](#9-question-bank)
10. [AI Agent Configuration](#10-ai-agent-configuration)
11. [Exam Creation & Management](#11-exam-creation--management)
12. [Submissions & Grading Pipeline](#12-submissions--grading-pipeline)
13. [Grading Review](#13-grading-review)
14. [Batch Grading](#14-batch-grading)
15. [Rubrics](#15-rubrics)
16. [Classes & Students](#16-classes--students)
17. [Analytics](#17-analytics)
18. [Assignment Tracking](#18-assignment-tracking)
19. [Notifications](#19-notifications)
20. [Settings](#20-settings)
21. [Non-Functional Requirements](#21-non-functional-requirements)

---

## 1. Authentication & Authorization

| ID     | Requirement                                                                                                                                                          | Priority |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-001 | The system SHALL authenticate users via Firebase Authentication and redirect unauthenticated users to `/login`, preserving the original URL for post-login redirect. | P0       |
| FR-002 | The system SHALL enforce role-based access control, allowing only users with `teacher` or `tenantAdmin` roles to access protected routes.                            | P0       |
| FR-003 | The system SHALL display an "Access Denied" screen when an authenticated user lacks the required role.                                                               | P0       |
| FR-004 | The system SHALL support multi-tenant context, filtering all data queries by the current tenant ID.                                                                  | P0       |
| FR-005 | The system SHALL allow users with memberships in multiple tenants to switch between tenants via a role switcher in the sidebar footer.                               | P1       |

---

## 2. Navigation & Layout

| ID     | Requirement                                                                                                                                                                                        | Priority |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-006 | The system SHALL provide a sidebar navigation grouped into: Overview, Content, Analytics, People, and System sections.                                                                             | P0       |
| FR-007 | The sidebar SHALL contain links to: Dashboard, Spaces, Question Bank, Exams, Rubric Presets, Assignments, Batch Grading, Class Analytics, Exam Analytics, Space Analytics, Students, and Settings. | P0       |
| FR-008 | The system SHALL provide a mobile bottom navigation bar with 5 primary destinations: Home, Spaces, Exams, Students, Analytics.                                                                     | P1       |
| FR-009 | The header SHALL include a theme toggle (light/dark mode) and a notification bell with unread count badge.                                                                                         | P1       |
| FR-010 | The system SHALL prefetch common routes on link hover for faster navigation.                                                                                                                       | P2       |
| FR-011 | The system SHALL apply tenant branding (colors) via CSS custom properties.                                                                                                                         | P1       |
| FR-012 | The system SHALL provide skip-to-content link and route announcer for accessibility.                                                                                                               | P1       |
| FR-013 | The system SHALL display an offline banner and PWA install/update notifications.                                                                                                                   | P2       |
| FR-014 | All pages SHALL be lazy-loaded with a Suspense fallback (PageLoader).                                                                                                                              | P1       |

---

## 3. Dashboard

| ID     | Requirement                                                                                                                                                  | Priority |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| FR-015 | The dashboard SHALL display 4 stat cards: Total Students, Active Exams (non-archived, non-draft), Total Spaces, and At-Risk Students.                        | P0       |
| FR-016 | The dashboard SHALL show a personalized greeting using the teacher's display name or email.                                                                  | P2       |
| FR-017 | The dashboard SHALL display a Class Performance bar chart showing average exam score (0-100) per class.                                                      | P1       |
| FR-018 | The dashboard SHALL display an At-Risk Students alert listing classes with at-risk students and a red badge count, shown only when at-risk count > 0.        | P1       |
| FR-019 | The dashboard SHALL display a Class Performance Heatmap when multiple classes exist.                                                                         | P2       |
| FR-020 | The dashboard SHALL show Recent Spaces (up to 5) with title, type, status, and story point count, linking to the space editor.                               | P1       |
| FR-021 | The dashboard SHALL show Recent Exams (up to 5) with title, subject, status, and total marks, linking to the exam detail page.                               | P1       |
| FR-022 | The dashboard SHALL show a Grading Queue (up to 5 submissions with `ready_for_review` status) with student name, roll number, pipeline status, and progress. | P1       |

---

## 4. Spaces Management

| ID     | Requirement                                                                                                                                                                                      | Priority |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| FR-023 | The Space List page SHALL display all spaces with thumbnail, title, description, status badge, type, subject, story point/item/student counts, and labels (max 3 shown with "+N more" overflow). | P0       |
| FR-024 | The Space List SHALL support filtering by status tabs: All, Draft, Published, Archived.                                                                                                          | P0       |
| FR-025 | The Space List SHALL support text search by title.                                                                                                                                               | P1       |
| FR-026 | The system SHALL provide 4 space creation templates: Blank Space (learning), Course (learning), Assessment (assessment), Practice (practice).                                                    | P0       |
| FR-027 | The system SHALL support space duplication, copying all story points and items (ordered by orderIndex), and navigating to the new space editor.                                                  | P1       |
| FR-028 | Spaces SHALL follow a lifecycle state machine: Draft → Published → Archived, with a restore-to-Draft option from Archived.                                                                       | P0       |

---

## 5. Space Creation & Editing

| ID     | Requirement                                                                                                                                                                                                                                                  | Priority |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| FR-029 | The Space Editor SHALL provide a 5-tab interface: Settings, Content, Rubric, Agent Config, and Versions.                                                                                                                                                     | P0       |
| FR-030 | **Settings tab**: The system SHALL allow editing: Title (required), Description, Type (learning/practice/assessment/resource/hybrid), Subject, Labels (comma-separated tags), and Access Type (class_assigned/tenant_wide/public_store).                     | P0       |
| FR-031 | **Settings tab**: The system SHALL support thumbnail upload (max 2MB, PNG/JPEG/WebP) via drag-drop, file picker, or URL paste, using server-side signed upload URLs.                                                                                         | P1       |
| FR-032 | **Settings tab**: The system SHALL allow configuring assessment defaults: default time limit (0 = unlimited), allow retakes toggle, max retakes (conditional), and show correct answers toggle.                                                              | P1       |
| FR-033 | **Settings tab**: The system SHALL support optional Store Listing with: publish-to-store toggle, price (0 = free), currency (USD/INR/EUR/GBP), store description, and store thumbnail. Store fields SHALL only be persisted when `publishedToStore` is true. | P2       |
| FR-034 | **Content tab**: The system SHALL support creating, editing, deleting, and reordering story points via drag-and-drop (@dnd-kit), with orderIndex tracked in Firestore.                                                                                       | P0       |
| FR-035 | **Content tab**: The system SHALL display inline story point stats: item count, questions, materials, points, and difficulty.                                                                                                                                | P1       |
| FR-036 | **Content tab**: The system SHALL support creating questions (15 types) and materials (7 types) within story points, with drag-and-drop reordering.                                                                                                          | P0       |
| FR-037 | **Content tab**: The system SHALL support bulk item selection with actions: delete and move to another story point.                                                                                                                                          | P1       |
| FR-038 | **Content tab**: The system SHALL support importing items from the Question Bank via an import dialog.                                                                                                                                                       | P1       |
| FR-039 | **Versions tab**: The system SHALL display a version history (lazy-loaded) tracking publication, archival, and content edit events.                                                                                                                          | P2       |
| FR-040 | The Space Editor SHALL support keyboard shortcuts: Ctrl/Cmd+N (new story point), Ctrl/Cmd+Enter (close item editor), Escape (cancel).                                                                                                                        | P2       |

---

## 6. Story Points

| ID     | Requirement                                                                                                                                                                                                                                   | Priority |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-041 | A Story Point SHALL have: Title (required), Description (optional), Type (standard/timed_test/quiz/practice/test), Difficulty (easy/medium/hard/expert), and Estimated Time (minutes).                                                        | P0       |
| FR-042 | Story Points SHALL support sections with: id, title, orderIndex, and optional description.                                                                                                                                                    | P1       |
| FR-043 | Assessment-type story points (timed_test/quiz/test) SHALL support: Duration (minutes), Max Attempts (default 1), Passing Percentage Threshold, Instructions, Shuffle Questions flag, Shuffle Options flag, and Show Results Immediately flag. | P0       |
| FR-044 | Story Points SHALL support optional scheduling: Available From, Available Until (datetime), and Late Submission Grace Period (minutes).                                                                                                       | P1       |
| FR-045 | Story Points SHALL support retry settings: Cooldown Between Attempts (minutes) and Lock After Passing flag.                                                                                                                                   | P1       |
| FR-046 | Story Points SHALL support Adaptive Testing with: Enable toggle, Initial Difficulty, Adjustment Mode (gradual: 3 consecutive / aggressive: 2 consecutive), Min Questions Per Difficulty (1-10), Max Consecutive Same Difficulty (2-20).       | P2       |
| FR-047 | Assessment-type story points SHALL show a "Preview as Student" button linking to the Test Preview page.                                                                                                                                       | P1       |

---

## 7. Content Items — Questions (15 Types)

### Common Question Fields

| ID     | Requirement                                                                                                                                                                                        | Priority |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-048 | All questions SHALL have: Content (required), Title (optional), Difficulty (easy/medium/hard), Base Points (default 1), Explanation (optional), and Attachments (max 10MB each, images/PDF/audio). | P0       |
| FR-049 | All questions SHALL support optional Bloom's Level classification: remember, understand, apply, analyze, evaluate, create.                                                                         | P1       |
| FR-050 | The Item Editor SHALL auto-save after 2 seconds of inactivity, showing status indicators: Saved (green), Saving (yellow), Unsaved Changes (orange).                                                | P0       |
| FR-051 | The Item Editor SHALL warn before closing if unsaved changes exist.                                                                                                                                | P1       |

### Auto-Evaluatable Question Types (9)

| ID     | Type                                         | Key Fields                                                                                                     | Priority |
| ------ | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------- |
| FR-052 | **MCQ** (Multiple Choice, Single Answer)     | `options[]` with id/text/isCorrect/explanation, `shuffleOptions` flag. Requires ≥2 options, exactly 1 correct. | P0       |
| FR-053 | **MCAQ** (Multiple Choice, Multiple Answers) | Same as MCQ + `minSelections`, `maxSelections`. Requires ≥2 options, ≥1 correct.                               | P0       |
| FR-054 | **True-False**                               | `correctAnswer: boolean`, optional `explanation`.                                                              | P0       |
| FR-055 | **Numerical**                                | `correctAnswer: number`, `tolerance?`, `unit?`, `decimalPlaces?`. Auto-evaluated with tolerance matching.      | P0       |
| FR-056 | **Fill Blanks**                              | `textWithBlanks`, `blanks[]` with correctAnswer, acceptableAnswers, caseSensitive flag.                        | P0       |
| FR-057 | **Fill Blanks Dropdown**                     | `textWithBlanks`, `blanks[]` with correctOptionId and options (≥2 per blank).                                  | P0       |
| FR-058 | **Matching**                                 | `pairs[]` with left/right strings, `shufflePairs` flag. Requires ≥2 pairs.                                     | P0       |
| FR-059 | **Jumbled** (Ordering)                       | `correctOrder[]`, `items[]` with id/text. Requires ≥3 items.                                                   | P0       |
| FR-060 | **Group Options** (Categorization)           | `groups[]` with name and correctItems, `items[]`. Every item must be assigned to ≥1 group.                     | P0       |

### AI-Evaluatable Question Types (6)

| ID     | Type                        | Key Fields                                                                                                                   | Priority |
| ------ | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-061 | **Text** (Short Answer)     | `correctAnswer?`, `caseSensitive?`, `acceptableAnswers[]`, `maxLength?`. AI evaluates if no correct answer specified.        | P0       |
| FR-062 | **Paragraph** (Long Answer) | `maxLength?`, `minLength?`, `modelAnswer?`, `evaluationGuidance?`. AI-evaluated with model answer reference.                 | P0       |
| FR-063 | **Code**                    | `language` (required), `starterCode?`, `testCases[]` (input/expectedOutput/isHidden/points), `timeoutMs?`, `memoryLimitMb?`. | P0       |
| FR-064 | **Audio**                   | `maxDurationSeconds?`, `language?`, `evaluationGuidance?`. AI-evaluated.                                                     | P1       |
| FR-065 | **Image Evaluation**        | `instructions` (required), `maxImages?`, `evaluationGuidance?`. AI-evaluated.                                                | P1       |
| FR-066 | **Chat Agent Question**     | `agentId?`, `objectives[]`, `conversationStarters[]`, `maxTurns?`, `evaluationGuidance?`. AI multi-turn evaluation.          | P1       |

---

## 8. Content Items — Materials (7 Types)

| ID     | Type            | Key Fields                           | Priority |
| ------ | --------------- | ------------------------------------ | -------- |
| FR-067 | **Text**        | Plain text content.                  | P0       |
| FR-068 | **Video**       | URL, duration (seconds).             | P0       |
| FR-069 | **PDF**         | URL, downloadable flag.              | P0       |
| FR-070 | **Link**        | External URL.                        | P0       |
| FR-071 | **Interactive** | URL + content.                       | P1       |
| FR-072 | **Story**       | URL + content.                       | P1       |
| FR-073 | **Rich**        | Title, markdown content with blocks. | P1       |

---

## 9. Question Bank

| ID     | Requirement                                                                                                                                                                                                                            | Priority |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-074 | The system SHALL provide a global Question Bank for the tenant, storing questions with: questionType, title, content, subject, topics, difficulty, Bloom's level, tags, usageCount, averageScore, and audit timestamps.                | P0       |
| FR-075 | The Question Bank SHALL support filtering by: text search, difficulty, Bloom's level, question type, with a clear-filters action.                                                                                                      | P0       |
| FR-076 | The Question Bank SHALL support CRUD operations: add, edit, duplicate (blanks ID), and soft-delete (mark deleted flag).                                                                                                                | P0       |
| FR-077 | The Question Bank SHALL display: type badge, difficulty badge (color-coded: emerald/amber/red), Bloom's level, usage count, subject tag, and average score per question.                                                               | P1       |
| FR-078 | The Question Bank SHALL provide a preview dialog showing full question details and metadata.                                                                                                                                           | P1       |
| FR-079 | The Question Bank Import Dialog SHALL support bulk import from the bank into a story point, with search, multi-select checkboxes, and metadata display. Import queries SHALL be ordered by createdAt descending, limited to 100 items. | P1       |

---

## 10. AI Agent Configuration

| ID     | Requirement                                                                                                                                                                            | Priority |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-080 | The system SHALL support configuring AI agents per space, stored as a Firestore subcollection (`tenants/{tenantId}/spaces/{spaceId}/agents/{agentId}`).                                | P0       |
| FR-081 | Two agent types SHALL be supported: `evaluator` (AI grader) and `tutor` (AI helper).                                                                                                   | P0       |
| FR-082 | Each agent SHALL have: Name, Type, Model selector (gpt-4, gpt-4o, claude-sonnet, claude-opus, gemini-pro), System Prompt, and Enabled toggle.                                          | P0       |
| FR-083 | The system SHALL support adding, saving, and deleting agents with `createdAt` and `updatedAt` server timestamps. Default model SHALL be gpt-4; agent ID format: `{type}_{Date.now()}`. | P1       |

---

## 11. Exam Creation & Management

| ID     | Requirement                                                                                                                                                                                                 | Priority |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-084 | The Exam Create page SHALL provide a 4-step wizard: Metadata → Upload → Review → Publish.                                                                                                                   | P0       |
| FR-085 | Exam metadata SHALL include: title, subject, topics, total marks (>0), passing marks (0 ≤ passing ≤ total), duration (>0), class IDs, and optional linked space ID (published spaces only).                 | P0       |
| FR-086 | The system SHALL support question paper upload via drag-and-drop or file selection (image/PDF), with upload to Firebase Storage.                                                                            | P0       |
| FR-087 | Exam defaults: auto-grading enabled, rubric editing allowed, manual overrides allowed (with reason requirement), results not auto-released.                                                                 | P0       |
| FR-088 | The Exam Detail page SHALL provide a 3-tab interface: Questions, Submissions, and Settings.                                                                                                                 | P0       |
| FR-089 | The system SHALL support AI-powered question extraction from uploaded question papers with confidence scoring: ≥90% green, 70-90% amber, <70% red. Low-confidence questions SHALL show a re-extract button. | P0       |
| FR-090 | Extracted questions SHALL be editable (text + max marks) with per-question rubric editing.                                                                                                                  | P0       |
| FR-091 | The system SHALL display real-time exam statistics: submissions count, pass rate, average score, and grading cost.                                                                                          | P1       |
| FR-092 | The system SHALL support PDF report generation for exam results.                                                                                                                                            | P1       |
| FR-093 | Exam status transitions: draft → question_paper_uploaded → question_paper_extracted → published → completed → results_released.                                                                             | P0       |

---

## 12. Submissions & Grading Pipeline

| ID     | Requirement                                                                                                                                                                                               | Priority |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-094 | The Submissions page SHALL support uploading student answer sheets (PDF/images) with student metadata: name, roll number, class ID.                                                                       | P0       |
| FR-095 | The system SHALL visualize the grading pipeline with real-time status: uploaded → ocr_processing → scouting → scouting_complete → grading → grading_complete/grading_partial/ready_for_review → reviewed. | P0       |
| FR-096 | The Submissions page SHALL display summary statistics: total, graded, in progress, needs review, and average score.                                                                                       | P1       |
| FR-097 | The system SHALL support CSV export of all results (client-side generation).                                                                                                                              | P1       |
| FR-098 | The system SHALL support bulk result release with timestamp and user ID tracking. Results can only be released after reviewed status.                                                                     | P0       |

---

## 13. Grading Review

| ID     | Requirement                                                                                                                                                                                  | Priority |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-099 | The Grading Review page SHALL provide a question-by-question review interface for individual submissions.                                                                                    | P0       |
| FR-100 | Each question SHALL display: AI-generated grade, student answer, AI confidence score, and model answer.                                                                                      | P0       |
| FR-101 | The system SHALL support manual score override requiring: valid reason (text), score within [0, maxMarks]. Overrides SHALL be tracked with: score, reason, userId, timestamp, originalScore. | P0       |
| FR-102 | The system SHALL support bulk approval, changing all "graded" questions to "manual" status and marking the submission as "reviewed".                                                         | P0       |
| FR-103 | The system SHALL support filtering questions by: all, needs review, low confidence.                                                                                                          | P1       |
| FR-104 | The system SHALL support retrying failed gradings with `mode: 'retry'`.                                                                                                                      | P1       |
| FR-105 | The system SHALL provide keyboard shortcuts: j/k (navigate questions), Enter (expand), a (accept grade), o (override), ? (toggle hints).                                                     | P2       |
| FR-106 | The system SHALL support navigating to next/previous submission.                                                                                                                             | P1       |
| FR-107 | The system SHALL provide an answer sheet lightbox preview.                                                                                                                                   | P1       |

---

## 14. Batch Grading

| ID     | Requirement                                                                                                  | Priority |
| ------ | ------------------------------------------------------------------------------------------------------------ | -------- |
| FR-108 | The Batch Grading page SHALL list pending submissions with filters: all, needs review, auto-graded, flagged. | P0       |
| FR-109 | The Batch Grading page SHALL support exam-specific filtering.                                                | P1       |
| FR-110 | The system SHALL display status badges: Auto-Graded, Needs Review, Flagged.                                  | P0       |
| FR-111 | The system SHALL support quick-approve action per submission.                                                | P0       |
| FR-112 | The system SHALL display progress indicator: pending vs reviewed submissions.                                | P1       |
| FR-113 | Results SHALL be paginated at 10 per page.                                                                   | P1       |

---

## 15. Rubrics

| ID     | Requirement                                                                                                                                                                                                    | Priority |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-114 | The Rubric Editor SHALL support 4 scoring modes: criteria-based, dimension-based, holistic, and hybrid.                                                                                                        | P0       |
| FR-115 | **Criteria-based**: Criteria with name, max points, and scoring levels (score/label/description). Support adding/removing criteria and levels dynamically.                                                     | P0       |
| FR-116 | **Dimension-based**: Dimensions with name, priority, weight, scoring scale, and prompt guidance for AI evaluation.                                                                                             | P0       |
| FR-117 | **Holistic**: Max score and guidance text (single-score rubric).                                                                                                                                               | P0       |
| FR-118 | **Hybrid**: Combination of criteria-based and holistic elements.                                                                                                                                               | P1       |
| FR-119 | All rubric modes SHALL support: passing percentage, evaluator guidance, and model answer.                                                                                                                      | P0       |
| FR-120 | The system SHALL provide a Rubric Preset library with categories: general, math, science, language, coding, essay, custom.                                                                                     | P1       |
| FR-121 | Teachers SHALL be able to save current rubric as a preset (name + category) and apply presets to questions. Presets SHALL be tenant-scoped.                                                                    | P1       |
| FR-122 | The Rubric Presets page SHALL support CRUD for presets with: name, description, category, scoring mode, grading guidance, max score, and passing percentage. Non-default presets can be deleted (soft delete). | P1       |

---

## 16. Classes & Students

| ID     | Requirement                                                                                                                                                                                                                                                                       | Priority |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-123 | The Class Detail page SHALL provide a 5-tab interface: Overview, Spaces, Exams, Students, and Analytics.                                                                                                                                                                          | P0       |
| FR-124 | The Overview tab SHALL show overview cards, recent spaces (up to 5), and recent exams (up to 5).                                                                                                                                                                                  | P1       |
| FR-125 | The Spaces tab SHALL display a grid of assigned spaces with type, story point count, and item count.                                                                                                                                                                              | P0       |
| FR-126 | The Exams tab SHALL display a table with title, subject, total marks, and status.                                                                                                                                                                                                 | P0       |
| FR-127 | The Students tab SHALL display a table with name, roll number, admission number, grade, section, and status.                                                                                                                                                                      | P0       |
| FR-128 | The Students page SHALL provide a student roster with full-text search across: displayName, uid, rollNumber, and admissionNumber (case-insensitive).                                                                                                                              | P0       |
| FR-129 | The Student Report page SHALL display: student header (name, roll number, grade, section), at-risk badge with reasons, score cards (overall, exam avg, space completion, streak), performance rings, subject breakdown chart, strengths/weaknesses tags, and recent exam results. | P0       |
| FR-130 | The Student Report page SHALL support PDF export via server-side `callGenerateReport()`.                                                                                                                                                                                          | P1       |

---

## 17. Analytics

| ID     | Requirement                                                                                                                                                                                                                                                                                                                           | Priority |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-131 | **Class Analytics**: Class selector, dual-panel view (AutoGrade exams + LevelUp spaces), overview cards (student count, avg exam score, space completion rate, at-risk count), top/bottom 3 performers, top point earners. At-risk indicator: "Needs attention" if count > 0.                                                         | P0       |
| FR-132 | **Exam Analytics**: Exam selector (filtered to graded/results_released only), overview cards (submissions, avg score %, pass rate, median score), score distribution bar chart (color-coded: green ≥70%, yellow ≥40%, red <40%), per-question analysis table (avg score, difficulty index, common mistakes), topic performance chart. | P0       |
| FR-133 | **Space Analytics**: Space selector (published only), overview cards (total students, completed students, avg completion %, avg engagement minutes), completion overview, engagement metrics with progress rings.                                                                                                                     | P0       |
| FR-134 | **Class Test Analytics**: Class selector + optional exam selector, overview cards (total exams, spaces, avg pass rate, avg score), weak topics alert (<50% avg), score distribution histogram, per-question insights with difficulty/discrimination index and common mistakes.                                                        | P1       |
| FR-135 | Difficulty index thresholds: Easy ≥0.7, Medium ≥0.4, Hard <0.4. Color-coded: green/yellow/red.                                                                                                                                                                                                                                        | P0       |

---

## 18. Assignment Tracking

| ID     | Requirement                                                                                                                                                                          | Priority |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| FR-136 | The Assignment Tracker SHALL display 4 summary cards: Active Assignments, Pending Grading, In-Review, and Completed.                                                                 | P0       |
| FR-137 | Assignments SHALL be grouped into: Active, Needs Grading, and Completed sections.                                                                                                    | P0       |
| FR-138 | Each assignment row SHALL show: title, status badge (Draft/Active/Grading/Completed), subject, submission count, grading progress bar (for in-review), and average score percentage. | P0       |
| FR-139 | Status mapping: draft = initial, active = published, grading = grading/evaluation_complete, completed = completed/archived.                                                          | P0       |
| FR-140 | Grading progress SHALL be calculated as `(gradedSubmissions / totalSubmissions) * 100`. Average score SHALL be calculated from graded submissions only.                              | P1       |
| FR-141 | Completed assignments SHALL be limited to 10 displayed.                                                                                                                              | P2       |

---

## 19. Notifications

| ID     | Requirement                                                                                   | Priority |
| ------ | --------------------------------------------------------------------------------------------- | -------- |
| FR-142 | The Notifications page SHALL display notifications filtered by "all" or "unread" (limit: 50). | P1       |
| FR-143 | The system SHALL support marking individual notifications as read and marking all as read.    | P1       |
| FR-144 | Clicking a notification SHALL navigate to its `actionUrl` if available.                       | P1       |

---

## 20. Settings

| ID     | Requirement                                                                                                                                                                                                                                            | Priority |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| FR-145 | The Settings page SHALL allow configuring evaluation settings (stored in tenant's evaluationSettings collection): Auto Grade toggle, Require Override Reason toggle, Auto-release Results toggle, and Default AI Strictness (lenient/moderate/strict). | P0       |
| FR-146 | Settings changes SHALL be persisted to Firestore with server timestamps and display toast feedback on success/error.                                                                                                                                   | P0       |

---

## 21. Non-Functional Requirements

### Performance

| ID      | Requirement                                                                            | Priority |
| ------- | -------------------------------------------------------------------------------------- | -------- |
| NFR-001 | All pages SHALL be lazy-loaded with code splitting to minimize initial bundle size.    | P0       |
| NFR-002 | Common navigation routes SHALL be prefetched on hover for sub-second page transitions. | P1       |
| NFR-003 | The Item Editor SHALL auto-save with a 2-second debounce to prevent excessive writes.  | P0       |
| NFR-004 | Analytics data SHALL be cached using React Query to prevent redundant Firestore reads. | P1       |
| NFR-005 | The Question Bank Import Dialog SHALL limit queries to 100 items per request.          | P1       |

### Usability

| ID      | Requirement                                                                                  | Priority |
| ------- | -------------------------------------------------------------------------------------------- | -------- |
| NFR-006 | The system SHALL support drag-and-drop reordering for story points and items using @dnd-kit. | P0       |
| NFR-007 | The system SHALL provide keyboard shortcuts for power users in the Grading Review page.      | P2       |
| NFR-008 | The system SHALL provide responsive layouts: desktop sidebar + mobile bottom navigation.     | P0       |
| NFR-009 | The system SHALL display skeleton loading placeholders during data fetches.                  | P1       |
| NFR-010 | All destructive actions (delete, archive) SHALL require confirmation dialogs.                | P0       |

### Accessibility

| ID      | Requirement                                                                        | Priority |
| ------- | ---------------------------------------------------------------------------------- | -------- |
| NFR-011 | The system SHALL provide skip-to-content navigation link.                          | P1       |
| NFR-012 | The system SHALL provide a route announcer for screen readers on page transitions. | P1       |
| NFR-013 | The system SHALL support light and dark theme modes.                               | P1       |

### Security

| ID      | Requirement                                                                                                                          | Priority |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| NFR-014 | All data queries SHALL be scoped to the current tenant ID to prevent cross-tenant data access.                                       | P0       |
| NFR-015 | File uploads SHALL enforce size limits (thumbnails: 2MB; attachments: 10MB) and MIME type validation (PNG/JPEG/WebP for thumbnails). | P0       |
| NFR-016 | Role-based access control SHALL be enforced at the route level via the RequireAuth guard.                                            | P0       |

### Reliability

| ID      | Requirement                                                                                                                 | Priority |
| ------- | --------------------------------------------------------------------------------------------------------------------------- | -------- |
| NFR-017 | The system SHALL display an offline banner when network connectivity is lost.                                               | P2       |
| NFR-018 | The system SHALL wrap all protected routes in an error boundary (RouteErrorBoundary) to gracefully handle rendering errors. | P0       |
| NFR-019 | The system SHALL provide service worker update notifications for new version deployments.                                   | P2       |

### Data Integrity

| ID      | Requirement                                                                                                | Priority |
| ------- | ---------------------------------------------------------------------------------------------------------- | -------- |
| NFR-020 | Grade overrides SHALL be immutably tracked with: original score, new score, reason, userId, and timestamp. | P0       |
| NFR-021 | Space version history SHALL track publication, archival, and content edit events.                          | P1       |
| NFR-022 | Rubric presets SHALL use soft delete (`deleted: true`) to preserve historical references.                  | P1       |
| NFR-023 | Question Bank items SHALL use soft delete to preserve usage history and analytics.                         | P1       |

---

## Appendix A: Unified Evaluation Result Schema

All grading results (both AutoGrade and LevelUp) produce:

| Field                 | Type                  | Description                                     |
| --------------------- | --------------------- | ----------------------------------------------- |
| score                 | number                | Points awarded                                  |
| maxScore              | number                | Maximum possible points                         |
| correctness           | number                | 0-1 correctness ratio                           |
| percentage            | number                | Score as percentage                             |
| structuredFeedback    | Record                | Per-criteria feedback items                     |
| strengths             | string[]              | Identified strong areas                         |
| weaknesses            | string[]              | Identified weak areas                           |
| missingConcepts       | string[]              | Gaps in understanding                           |
| rubricBreakdown       | RubricBreakdownItem[] | Per-rubric-criterion scores                     |
| summary               | object                | keyTakeaway + overallComment                    |
| confidence            | number                | AI grading confidence (0-1)                     |
| mistakeClassification | enum                  | Conceptual / Silly Error / Knowledge Gap / None |
| tokensUsed            | object                | Input/output token counts                       |
| costUsd               | number                | Grading cost in USD                             |
| gradedAt              | Timestamp             | When grading occurred                           |

## Appendix B: Route Map

| Route                                                 | Page                   | Auth Required |
| ----------------------------------------------------- | ---------------------- | ------------- |
| `/login`                                              | LoginPage              | No            |
| `/`                                                   | DashboardPage          | Yes           |
| `/spaces`                                             | SpaceListPage          | Yes           |
| `/spaces/:spaceId/edit`                               | SpaceEditorPage        | Yes           |
| `/spaces/:spaceId/story-points/:storyPointId/preview` | TestPreviewPage        | Yes           |
| `/question-bank`                                      | QuestionBankPage       | Yes           |
| `/exams`                                              | ExamListPage           | Yes           |
| `/exams/new`                                          | ExamCreatePage         | Yes           |
| `/exams/:examId`                                      | ExamDetailPage         | Yes           |
| `/exams/:examId/submissions`                          | SubmissionsPage        | Yes           |
| `/exams/:examId/submissions/:submissionId`            | GradingReviewPage      | Yes           |
| `/grading`                                            | BatchGradingPage       | Yes           |
| `/rubric-presets`                                     | RubricPresetsPage      | Yes           |
| `/classes/:classId`                                   | ClassDetailPage        | Yes           |
| `/assignments`                                        | AssignmentTrackerPage  | Yes           |
| `/students`                                           | StudentsPage           | Yes           |
| `/students/:studentId/report`                         | StudentReportPage      | Yes           |
| `/analytics/classes`                                  | ClassAnalyticsPage     | Yes           |
| `/analytics/exams`                                    | ExamAnalyticsPage      | Yes           |
| `/analytics/spaces`                                   | SpaceAnalyticsPage     | Yes           |
| `/analytics/tests`                                    | ClassTestAnalyticsPage | Yes           |
| `/notifications`                                      | NotificationsPage      | Yes           |
| `/settings`                                           | SettingsPage           | Yes           |
| `*`                                                   | NotFoundPage           | Yes           |
