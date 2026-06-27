# Phase 2: Cross-Domain Mapping & Gap Analysis

**Date**: 2026-02-19 **Analyst**: Domain Architect (Maestro Worker) **Sources**:

- `docs/phase1-autograde-extraction.md` — AutoGrade Expert (Phase 1A)
- `docs/phase1-levelup-extraction.md` — LevelUp Expert (Phase 1B) **Purpose**:
  Authoritative mapping between AutoGrade and LevelUp domains, identifying
  equivalences, overlaps, gaps, and conflicts for the unified platform design.

---

## Table of Contents

1. [AutoGrade → LevelUp Concept Map](#1-autograde--levelup-concept-map)
2. [LevelUp → AutoGrade Concept Map](#2-levelup--autograde-concept-map)
3. [Overlapping Features — Must Merge / Reconcile](#3-overlapping-features--must-merge--reconcile)
4. [Gap Analysis — AutoGrade Provides, LevelUp Lacks](#4-gap-analysis--autograde-provides-levelup-lacks)
5. [Gap Analysis — LevelUp Provides, AutoGrade Lacks](#5-gap-analysis--levelup-provides-autograde-lacks)
6. [Conflict Analysis — Same Concept, Different Models](#6-conflict-analysis--same-concept-different-models)
7. [Summary Matrix](#7-summary-matrix)

---

## 1. AutoGrade → LevelUp Concept Map

For every AutoGrade concept, what is the closest equivalent in LevelUp?

| AutoGrade Concept                            | AutoGrade Collection                                       | LevelUp Equivalent                                       | LevelUp Collection                 | Mapping Type                                          |
| -------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------- | ---------------------------------- | ----------------------------------------------------- |
| **Client**                                   | `/clients`                                                 | `OrgDTO`                                                 | `orgs`                             | Near-equivalent (see §6.2)                            |
| **Class**                                    | `/clients/{id}/classes`                                    | `OrgGroupDTO` + `CourseDTO` (split)                      | `orgGroups` + `courses`            | Partial / structural split                            |
| **Student**                                  | `/clients/{id}/students`                                   | `AppUser` + `UserOrgRecord` (role='student')             | `users` + `userOrgs`               | Partial (role fields differ)                          |
| **Teacher**                                  | `/clients/{id}/teachers`                                   | `UserOrgRecord` (role='tutor'/'courseAdmin')             | `userOrgs`                         | Partial (no distinct Teacher entity in LevelUp)       |
| **Parent**                                   | `/clients/{id}/parents`                                    | **No equivalent**                                        | —                                  | AutoGrade-unique                                      |
| **Exam**                                     | `/clients/{id}/exams`                                      | `StoryPointDTO` (type='timed_test'/'test')               | `storyPoints`                      | Partial overlap (digital-only vs paper-capable)       |
| **Question** (exam question)                 | `/clients/{id}/exams/{id}/questions`                       | `ItemDTO` (type='question')                              | `items`                            | Near-equivalent (different field depth)               |
| **Submission**                               | `/clients/{id}/submissions`                                | `TimedTestSession`                                       | `timedTestSessions`                | Partial overlap (no physical paper in LevelUp)        |
| **QuestionSubmission**                       | `/clients/{id}/submissions/{id}/questionSubmissions`       | `AttemptDTO`                                             | `attempts`                         | Near-equivalent                                       |
| **EvaluationFeedbackRubric**                 | `/evaluationSettings` + `/clients/{id}/evaluationSettings` | `AgentDTO` (type='evaluator')                            | `course_agents`                    | Partial overlap (different configuration granularity) |
| **Scanner**                                  | `/scanners`                                                | **No equivalent**                                        | —                                  | AutoGrade-unique (hardware device)                    |
| **LLMUsageLog**                              | `/llm-usage`                                               | **No equivalent** (planned via `activityLog`)            | `activityLog` (planned)            | AutoGrade-unique                                      |
| **UserMembership**                           | `/userMemberships`                                         | `UserOrgRecord` + `UserRolesDTO`                         | `userOrgs` + `userRoles`           | Near-equivalent (split across two collections)        |
| **User** (auth identity)                     | `/users`                                                   | `AppUser`                                                | `users`                            | Near-equivalent (different scope of profile data)     |
| **Rubric** (embedded in Question)            | —                                                          | `ItemPayload.assessment.rubric[]`                        | —                                  | Partial (different schema)                            |
| **EvaluationFeedbackDimension**              | —                                                          | `AgentDTO.evaluationObjectives[]`                        | —                                  | Partial (conceptual equivalent)                       |
| **Submission.summary** (score rollup)        | —                                                          | `UserStoryPointProgressDoc` (aggregate progress)         | `userStoryPointProgress`           | Partial (marks vs points model)                       |
| **GradingResult / RELMS output**             | —                                                          | `AttemptDTO.evaluation`                                  | `attempts`                         | Near-equivalent                                       |
| **QuestionEvaluation.structuredFeedback**    | —                                                          | `AttemptDTO.evaluation` (structured feedback from agent) | `attempts`                         | Near-equivalent                                       |
| **Exam.topics[]**                            | —                                                          | `ItemDTO.analytics.topics[]` + `ItemDTO.topics[]`        | —                                  | Near-equivalent                                       |
| **Exam.subject**                             | —                                                          | `CourseDTO.labels[]`                                     | —                                  | Partial (category vs free tag)                        |
| **Exam.classIds[]** (multi-class assignment) | —                                                          | `CourseDTO.orgId` + `orgGroupIds[]`                      | —                                  | Conceptual equivalent (org-group assignment)          |
| **PlatformStats**                            | `/platformStats` (unimplemented)                           | `OrgAnalyticsDoc` / `CourseAnalyticsDoc` (planned)       | `orgAnalytics` / `courseAnalytics` | Conceptual equivalent                                 |

---

## 2. LevelUp → AutoGrade Concept Map

For every LevelUp concept, what is the closest equivalent in AutoGrade?

| LevelUp Concept                                                      | LevelUp Collection                                 | AutoGrade Equivalent                                                                          | AutoGrade Collection                                 | Mapping Type                                                                       |
| -------------------------------------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------- |
| **AppUser**                                                          | `users`                                            | `User` + role-specific doc (Student/Teacher/Parent)                                           | `/users` + `/clients/{id}/{role}s`                   | Near-equivalent (different structural depth)                                       |
| **CourseDTO**                                                        | `courses`                                          | **No direct equivalent** (closest: Class, but fundamentally different — Class has no content) | `/clients/{id}/classes`                              | LevelUp-unique (content container)                                                 |
| **StoryPointDTO** (standard/practice)                                | `storyPoints`                                      | **No equivalent**                                                                             | —                                                    | LevelUp-unique (learning path node)                                                |
| **StoryPointDTO** (timed_test/test)                                  | `storyPoints`                                      | `Exam` (digital-only subset)                                                                  | `/clients/{id}/exams`                                | Partial overlap                                                                    |
| **ItemDTO** (type='question')                                        | `items`                                            | `Question`                                                                                    | `/clients/{id}/exams/{id}/questions`                 | Near-equivalent                                                                    |
| **ItemDTO** (type='material')                                        | `items`                                            | **No equivalent**                                                                             | —                                                    | LevelUp-unique (learning material)                                                 |
| **ItemDTO** (type='assessment')                                      | `items`                                            | `Exam` (partial, embedded mini-exam)                                                          | —                                                    | Partial                                                                            |
| **ItemDTO** (type='interactive','discussion','project','checkpoint') | `items`                                            | **No equivalent**                                                                             | —                                                    | LevelUp-unique                                                                     |
| **UserStoryPointProgressDoc**                                        | `userStoryPointProgress`                           | `Submission.summary` (partial)                                                                | `/clients/{id}/submissions`                          | Partial (different depth and model)                                                |
| **AttemptDTO**                                                       | `attempts`                                         | `QuestionSubmission`                                                                          | `/clients/{id}/submissions/{id}/questionSubmissions` | Near-equivalent                                                                    |
| **ChatSession**                                                      | `chatSessions`                                     | **No equivalent** (experimental `ai-chat` callable exists)                                    | —                                                    | LevelUp-unique                                                                     |
| **TimedTestSession**                                                 | `timedTestSessions`                                | `Submission`                                                                                  | `/clients/{id}/submissions`                          | Near-equivalent (digital only in LevelUp)                                          |
| **OrgDTO**                                                           | `orgs`                                             | `Client`                                                                                      | `/clients`                                           | Near-equivalent (see §6.2)                                                         |
| **OrgGroupDTO**                                                      | `orgGroups`                                        | `Class` (partial)                                                                             | `/clients/{id}/classes`                              | Partial (different semantics)                                                      |
| **UserOrgRecord**                                                    | `userOrgs`                                         | `UserMembership`                                                                              | `/userMemberships`                                   | Near-equivalent                                                                    |
| **UserRolesDTO**                                                     | `userRoles`                                        | Firebase Custom Claims (embedded in Auth token)                                               | —                                                    | Equivalent (different storage layer)                                               |
| **AgentDTO** (type='evaluator')                                      | `course_agents`                                    | `EvaluationFeedbackRubric`                                                                    | `/evaluationSettings`                                | Partial overlap (different scope: item-level vs client-level)                      |
| **AgentDTO** (type='tutor')                                          | `course_agents`                                    | **No equivalent**                                                                             | —                                                    | LevelUp-unique (AI tutoring)                                                       |
| **PracticeRangeItemDTO**                                             | `practiceRangeItems`                               | **No equivalent**                                                                             | —                                                    | LevelUp-unique                                                                     |
| **UserCourseRecord**                                                 | `user_courses`                                     | `UserMembership` (partial)                                                                    | `/userMemberships`                                   | Partial (different intent: inventory vs access control)                            |
| **UserProgressDTO**                                                  | `progress`                                         | Embedded in `Submission` + `QuestionSubmission`                                               | —                                                    | Partial (AutoGrade doesn't have a separate progress document for non-exam content) |
| **ItemAnalytics** (bloomsLevel, cognitiveLoad, etc.)                 | embedded in `items`                                | **No equivalent**                                                                             | —                                                    | LevelUp-unique                                                                     |
| **RedemptionCode**                                                   | `redemptionCodes`                                  | **No equivalent**                                                                             | —                                                    | LevelUp-unique (B2C access control)                                                |
| **Leaderboard** (RTDB)                                               | RTDB: `storyPointLeaderboard`, `courseLeaderboard` | **No equivalent**                                                                             | —                                                    | LevelUp-unique                                                                     |
| **WillApp (UserHabit, Group, RTDBHabitData)**                        | Firestore + RTDB                                   | **No equivalent**                                                                             | —                                                    | LevelUp-unique (habit tracker sub-domain)                                          |
| **OrgAnalyticsDoc** (planned)                                        | `orgAnalytics`                                     | **No equivalent** (partially covered by `PlatformStats`, unimplemented)                       | —                                                    | LevelUp-unique (partially)                                                         |
| **VisualAnalyticsDashboard** (UI)                                    | —                                                  | **No equivalent**                                                                             | —                                                    | LevelUp-unique (6-tab analytics UX)                                                |
| **Course.defaultEvaluatorAgentId**                                   | `courses`                                          | `Client.defaultEvaluationSettingsId`                                                          | `/clients`                                           | Near-equivalent (default evaluator pointer)                                        |

---

## 3. Overlapping Features — Must Merge / Reconcile

These are features where both apps model the same concept. They **cannot coexist
as-is** in a unified platform — one canonical model must be chosen, or a
superset must be designed.

---

### 3.1 User Identity & Profiles

| Dimension                    | AutoGrade                                                             | LevelUp                                               |
| ---------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------- |
| Auth system                  | Firebase Auth + custom claims                                         | Firebase Auth + Google OAuth                          |
| Profile collection           | `/users/{uid}` + role-specific subdocs under client                   | `users/{uid}` (single flat document)                  |
| Role storage                 | Firebase Custom Claims (JWT) + `UserMembership.role`                  | `userRoles/{userId}` collection + `userOrgs.roles[]`  |
| Multi-org support            | Yes — via `UserMembership` (one per client)                           | Yes — via `UserOrgRecord` + `UserRolesDTO.orgAdmin{}` |
| Role-specific profile fields | Yes — `Teacher.subjects`, `Student.rollNumber`, `Parent.studentIds[]` | No — single `AppUser` with flat fields                |

**Resolution needed**: Unified user model must preserve role-specific profile
data (rollNumber, subjects, employeeId) while supporting LevelUp's flat AppUser
for consumer/B2C contexts.

---

### 3.2 Organization / Tenant Hierarchy

| Dimension        | AutoGrade                                             | LevelUp                                                          |
| ---------------- | ----------------------------------------------------- | ---------------------------------------------------------------- | -------------------- | ----------------------------------------- |
| Top-level tenant | `Client` (schoolCode, geminiApiKey, subscriptionPlan) | `OrgDTO` (code, isPublic, address)                               |
| Sub-grouping     | `Class` (subject + grade + section, teacher-assigned) | `OrgGroupDTO` (named group, courseIds array)                     |
| Access boundary  | All data in `/clients/{clientId}/...`                 | Data referenced by `orgId` on `CourseDTO`, `userOrgs` membership |
| Billing          | `subscriptionPlan: 'trial'                            | 'basic'                                                          | 'premium'` on Client | `OrgSubscriptionDoc` (planned, not built) |
| Login flow       | 2-step: schoolCode → credentials                      | Standard Firebase/Google login                                   |

**Resolution needed**: Unified tenant model must support both AutoGrade's strict
isolation (`schoolCode` login, sub-collections) and LevelUp's more open org
model (join codes, public orgs).

---

### 3.3 Assessment / Test Model

| Dimension           | AutoGrade                                               | LevelUp                                                                          |
| ------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Container           | `Exam` (classIds[], duration, totalMarks, passingMarks) | `StoryPointDTO` (type='timed_test', testDurationMinutes)                         |
| Question storage    | `Question` subcollection under Exam                     | `ItemDTO` (type='question') in flat `items` collection, linked by `storyPointId` |
| Answer ingestion    | Physical paper scanned, uploaded as images              | Digital answer entered in-app                                                    |
| Session tracking    | `Submission` (one per student per exam)                 | `TimedTestSession` (multi-attempt, per student per story point)                  |
| Per-question result | `QuestionSubmission` (marks, feedback, AI evaluation)   | `AttemptDTO` (correctness 0-1, pointsEarned, evaluation)                         |
| AI grading          | RELMS with image-based answer grading                   | Agent-based with text/image/audio answer evaluation                              |
| Multi-attempt       | Not supported (one submission per student per exam)     | Yes — `attemptNumber` field on `TimedTestSession`                                |
| Question ordering   | `Question.order` field                                  | `TimedTestSession.questionOrder[]` (server-set)                                  |

**Resolution needed**: Unified assessment model must bridge physical paper +
digital, marks-based scoring + points-based scoring, and single-attempt +
multi-attempt paradigms.

---

### 3.4 AI Evaluation Frameworks

| Dimension           | AutoGrade                                                                 | LevelUp                                                                  |
| ------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Framework name      | RELMS (dynamic, dimension-based)                                          | Agent-based (evaluator agents with objectives)                           |
| Configuration scope | Per-client (`EvaluationFeedbackRubric`)                                   | Per-course (`AgentDTO`) and per-item (evaluatorAgentId)                  |
| Evaluation criteria | `FeedbackDimension[]` (Critical Issues, Structure, Clarity, Completeness) | `evaluationObjectives: [{id, name, points}]`                             |
| Output format       | `QuestionEvaluation` with `structuredFeedback` map + `rubricBreakdown[]`  | `AttemptDTO.evaluation` (agent-defined) + `AttemptDTO.correctness` (0-1) |
| AI models used      | Gemini 2.5 Flash / Pro (client's own API key)                             | Gemini/Claude via Cloud Functions (platform key)                         |
| API key ownership   | Per-client (school manages own key)                                       | Platform-owned (LevelUp manages key)                                     |
| Dual evaluation     | No                                                                        | Yes — question objectives + agent objectives shown separately            |
| Image-based answers | Yes (core feature, base64 images sent to Gemini)                          | Yes (image_evaluation question type)                                     |
| Audio answers       | No                                                                        | Yes (`evaluateAudioAnswer()`)                                            |
| Usage tracking      | Comprehensive `LLMUsageLog`                                               | No cost tracking                                                         |

**Resolution needed**: Unified evaluation must support both client-owned API
keys and platform-managed keys, and reconcile RELMS dimensions with agent
objectives.

---

### 3.5 Progress Tracking

| Dimension         | AutoGrade                                                     | LevelUp                                                                    |
| ----------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Unit of progress  | Per exam (Submission)                                         | Per story point (UserStoryPointProgressDoc) + per item (ItemProgressEntry) |
| Score model       | Marks (integer, out of totalMarks)                            | Points (integer, earned vs totalPoints) + percentage (0-1)                 |
| Status values     | `pending → scouting → grading → completed → failed`           | `not_started → in_progress → completed`                                    |
| Granularity       | Per question (QuestionSubmission)                             | Per item (ItemProgressEntry in map, AttemptDTO)                            |
| Attempt history   | One submission only (no re-attempt)                           | Full attempt history (`attempts` collection)                               |
| Aggregation       | `Submission.summary` (total score, percentage, grade, status) | `UserStoryPointProgressDoc.percentage` + `pointsEarned`                    |
| Non-exam progress | Not applicable                                                | Yes — materials, interactive items tracked separately                      |

**Resolution needed**: Unified progress model must accommodate both marks-based
(AutoGrade) and points-based (LevelUp), with attempt history and
multi-content-type tracking.

---

### 3.6 Rubric / Grading Criteria

| Dimension            | AutoGrade                                                        | LevelUp                                                               |
| -------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------- |
| Where stored         | `Question.rubric` (Rubric criteria array with description+marks) | `ItemPayload.assessment.rubric[]` (criterion, maxPoints, description) |
| Configuration level  | Exam-level rubric extracted by AI, editable by admin             | Assessment item-level rubric, manually defined                        |
| Feedback dimensions  | `EvaluationFeedbackRubric` with 4 default + custom dimensions    | `AgentDTO.evaluationObjectives[]`                                     |
| Output per criterion | `QuestionEvaluation.rubricBreakdown: RubricScore[]`              | Agent-defined (free-form)                                             |
| LaTeX support        | Yes (question text stored as raw LaTeX)                          | Yes (KaTeX/MathJax rendering)                                         |

**Resolution needed**: Unified rubric model must preserve AI-extracted rubric
criteria AND manually-configured agent objectives.

---

## 4. Gap Analysis — AutoGrade Provides, LevelUp Lacks

These are capabilities AutoGrade has that LevelUp does not. In the unified
platform, they would need to be added to LevelUp's domain model.

| #   | AutoGrade Feature                          | Description                                                                                        | Impact for Unified Platform                                                                               |
| --- | ------------------------------------------ | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------ |
| 1   | **Physical answer sheet ingestion**        | Scanner device captures paper answer sheets as images; cloud storage upload pipeline               | Must add Scanner entity, image upload flow, storage path conventions                                      |
| 2   | **AI page scouting / routing map**         | "Panopticon" algorithm: Gemini identifies which exam questions appear on which answer pages        | Entirely new pipeline — no LevelUp equivalent. Must add `scoutingResult.routingMap` to unified Submission |
| 3   | **Parent role & parent-student linkage**   | Parents can view their children's exam results, linked via `parentIds / studentIds`                | Must add Parent entity (or role) + linkage to unified user model                                          |
| 4   | **School-code login flow**                 | 2-step login: schoolCode → credentials. Prevents cross-school credential reuse                     | Must preserve this in unified auth flow for school contexts                                               |
| 5   | **Bulk student CSV import**                | Admin uploads CSV with student + parent data, auto-creates accounts and sends credentials          | Must add bulk import pipeline to unified platform                                                         |
| 6   | **Scanner device accounts**                | Physical scanner devices registered as Firebase Auth accounts with `role: 'scanner'`               | Must add Scanner entity and device auth flow                                                              |
| 7   | **Client-managed Gemini API keys**         | Each school provides their own Gemini key, enabling cost attribution                               | Must add `geminiApiKey` to unified tenant model (or per-client AI config)                                 |
| 8   | **LLM usage cost tracking**                | Every Gemini call logged with tokens, cost, latency, resource attribution                          | Must add unified LLM usage logging to unified platform                                                    |
| 9   | **Subscription plan tiers**                | `subscriptionPlan: 'trial'                                                                         | 'basic'                                                                                                   | 'premium'` on Client, affecting feature access | Must merge with LevelUp's planned `OrgSubscriptionDoc` |
| 10  | **Multi-class exam assignment**            | One exam assigned to multiple classes via `classIds[]` — no content duplication                    | Must carry forward this pattern in unified assessment model                                               |
| 11  | **QuestionPaper type variants**            | 4 exam types: Standard, Integrated Diagram-Heavy, High Volume, Manual Rubric — different pipelines | Must represent in unified assessment metadata                                                             |
| 12  | **Type 2 zero-LLM page mapping**           | For diagram-heavy question papers, page N question → page N answer, no AI call                     | Must preserve this optimization in unified platform                                                       |
| 13  | **RELMS structured feedback dimensions**   | 4 default feedback dimensions (Critical Issues, Structure, Clarity, Completeness) per client       | Must reconcile with LevelUp agent objectives in unified evaluation model                                  |
| 14  | **Student portal (exam results)**          | Students view per-exam scores with structured feedback per question                                | Must be part of unified student experience                                                                |
| 15  | **Teacher-specific submission grading UI** | Admin/teacher can manually override AI grades                                                      | Must add manual override capability to unified platform                                                   |

---

## 5. Gap Analysis — LevelUp Provides, AutoGrade Lacks

These are capabilities LevelUp has that AutoGrade does not. In the unified
platform, they would enrich the AutoGrade domain.

| #   | LevelUp Feature                                                                     | Description                                                                                                | Impact for Unified Platform                                                    |
| --- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 1   | **Learning content types (material, interactive, discussion, project, checkpoint)** | Rich content beyond questions: videos, articles, PDFs, simulations, discussions, assignments               | Must add to unified content model alongside exam questions                     |
| 2   | **AI tutoring chat (ChatSession)**                                                  | Context-aware multi-language AI tutor, session history, agent selection                                    | Entirely new for AutoGrade — can be attached to exam questions and content     |
| 3   | **15 question types**                                                               | MCQ, MCAQ, true-false, code, fill-blanks, matching, jumbled, audio, image_evaluation, etc.                 | AutoGrade has only standard/MCQ/diagram-heavy — huge expansion                 |
| 4   | **Practice Range**                                                                  | PYQ-focused flat item list with RTDB-backed fast progress tracking                                         | New mode for unified platform (exam prep practice)                             |
| 5   | **Rich content authoring**                                                          | Blog-style editor with 9 block types (heading, paragraph, image, video, audio, code, quote, list, divider) | AutoGrade has no content authoring — only question/rubric capture              |
| 6   | **Bloom's taxonomy tagging**                                                        | Items tagged with Bloom's level (remember, understand, apply, analyze, evaluate, create)                   | Adds pedagogical depth to unified assessment questions                         |
| 7   | **Per-item analytics dimensions**                                                   | bloomsLevel, cognitiveLoad, skillsAssessed, applicationDomain, questionComplexity, etc.                    | AutoGrade questions have only text, maxMarks, rubric — need metadata expansion |
| 8   | **Visual Analytics Dashboard**                                                      | 6-tab results analytics (AI Insights, Overview, Performance, Topics, Cognitive, Timeline)                  | AutoGrade has no advanced analytics UX for students/teachers                   |
| 9   | **AI-powered insights**                                                             | Pattern detection across attempts (7 categories, 3-phase learning paths)                                   | No equivalent in AutoGrade                                                     |
| 10  | **Custom evaluator agents per course/item**                                         | Each course or item can have a specific AI evaluator agent with custom objectives                          | AutoGrade uses client-wide EvaluationFeedbackRubric — no per-item override     |
| 11  | **Multi-attempt support**                                                           | `TimedTestSession.attemptNumber` — students can retake tests                                               | AutoGrade has one Submission per student per exam                              |
| 12  | **Story points (learning path structure)**                                          | Sequential content containers with sections, ordering, prerequisites                                       | AutoGrade has no learning path — only exam → questions                         |
| 13  | **Real-time leaderboards**                                                          | Course and story point leaderboards via RTDB                                                               | No equivalent in AutoGrade                                                     |
| 14  | **Course marketplace / redemption codes**                                           | Public store, B2C redemption codes (master + single-use)                                                   | AutoGrade is pure B2B, no self-serve access                                    |
| 15  | **WillApp (habit tracker)**                                                         | Separate sub-domain: habits, groups, daily RTDB tracking                                                   | Entirely independent of AutoGrade                                              |
| 16  | **Google OAuth**                                                                    | Social login (in addition to email/password)                                                               | AutoGrade only supports email/phone+password                                   |
| 17  | **Org-level analytics (pre-computed)**                                              | Cloud-Function-computed daily/weekly/monthly aggregates per org and course                                 | AutoGrade has no analytics aggregation pipeline                                |
| 18  | **Section-based item organization**                                                 | Items within a story point grouped into named sections                                                     | AutoGrade questions are just ordered by `order` field                          |
| 19  | **Timed test 5-status question tracking**                                           | Not Visited / Not Answered / Answered / Marked for Review / Answered+Marked                                | AutoGrade only tracks whether a question is graded or not                      |
| 20  | **Previous Year Questions (PYQ) metadata**                                          | `pyqInfo: PreviousYearOccurrence[]` on practice items                                                      | AutoGrade has no PYQ concept                                                   |
| 21  | **Course Admin dashboard**                                                          | Detailed analytics per course: enrollment, completion rate, story point metrics                            | AutoGrade admin sees only exam + submission stats                              |
| 22  | **Audio question type**                                                             | Students record audio responses, AI evaluates via `evaluateAudioAnswer()`                                  | AutoGrade supports only written/visual answers                                 |

---

## 6. Conflict Analysis — Same Concept, Different Models

These are the critical design conflicts where both apps model the same
real-world concept, but the data models are **incompatible**. The unified
platform must resolve each conflict with a canonical design choice.

---

### Conflict 1: User Identity Model

**Problem**: AutoGrade has four separate role-specific entities (Student,
Teacher, Parent, User), each with role-specific fields. LevelUp has one
`AppUser` document plus a roles system.

|                      | AutoGrade                                                                                  | LevelUp                                                             |
| -------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| Profile storage      | `/users/{uid}` (basic auth identity) + `/clients/{id}/students/{studentId}` (role profile) | `users/{uid}` (complete profile in one document)                    |
| Role-specific fields | `Student.rollNumber`, `Teacher.subjects[]`, `Teacher.employeeId`, `Parent.studentIds[]`    | Not present — single flat profile                                   |
| Multiple roles       | Handled via `UserMembership.role` (one role per client)                                    | Handled via `UserOrgRecord.roles[]` (array, multiple roles per org) |
| Profile linkage      | `UserMembership.studentId → Student doc`                                                   | Not applicable                                                      |

**Unresolved questions**:

- Can a user be both a student at School A and a teacher at School B? (AutoGrade
  allows this via separate UserMemberships)
- Where do `rollNumber`, `employeeId`, `subjects[]` live in the unified model?

**Resolution options**:

1. **Keep separate role profiles** (AutoGrade approach): Unified `User` +
   role-specific extension docs under each tenant
2. **Flat user with role metadata** (LevelUp approach): Add `roleProfile` map to
   `AppUser` keyed by tenant

---

### Conflict 2: Organizational Hierarchy Depth

**Problem**: AutoGrade and LevelUp have different depth models for how
schools/orgs are structured.

| Level        | AutoGrade                                | LevelUp                                     |
| ------------ | ---------------------------------------- | ------------------------------------------- |
| L1 (Tenant)  | `Client` (entire school or school group) | `OrgDTO` (school or institute)              |
| L2 (Group)   | `Class` (Grade + Section + Subject)      | `OrgGroupDTO` (Grade / Semester)            |
| L3 (Content) | `Exam` (assessment event)                | `CourseDTO` (learning content container)    |
| L4 (Unit)    | `Question` (assessment item)             | `StoryPointDTO` (learning unit) → `ItemDTO` |

**Critical conflict**: AutoGrade's `Class` is a _classroom grouping_ (students +
teacher + subject). LevelUp's `OrgGroupDTO` is a _course grouping_ (courses).
These serve different purposes:

- AutoGrade Class has `teacherIds[]`, `subject`, `academicYear`, `grade`,
  `section` — it's a cohort
- LevelUp OrgGroup has `courseIds[]`, `displayOrder` — it's a catalog folder

**Resolution options**:

1. **Two-level grouping in unified**:
   `Org > Cohort (Class) > ContentGroup (OrgGroup) > Course`
2. **Collapse to single level**: `Org > Class` where Class both enrolls students
   AND groups content
3. **AutoGrade hierarchy wins**: `Client > Class > Exam` as primary, LevelUp
   content assigned to classes

---

### Conflict 3: Assessment as Physical Paper vs Digital Experience

**Problem**: AutoGrade exams are designed around physical paper answer sheets
that get scanned. LevelUp timed tests are digital-first.

|                     | AutoGrade Exam                                                | LevelUp Timed Test                                                 |
| ------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------ |
| Answer medium       | Physical paper → scanned images                               | Digital in-app answer (text, choice, code, audio)                  |
| Question display    | Extracted from uploaded question paper PDF                    | Digital items pre-authored in-app                                  |
| AI pipeline         | Image scouting → image grading (Panopticon + RELMS)           | Digital answer evaluation (Agent-based)                            |
| Multi-attempt       | No                                                            | Yes                                                                |
| Timer               | `duration` on Exam (metadata)                                 | `testDurationMinutes` on StoryPoint + server-side session tracking |
| Student interaction | None during exam (takes paper exam offline)                   | Full in-app experience with navigation, mark-for-review            |
| Partial credit      | Yes (`maxMarks` per question, `score` per QuestionSubmission) | Yes (`correctness: 0-1`, `pointsEarned`)                           |

**Resolution options**:

1. **Unified Assessment entity** with `mode: 'physical' | 'digital'` — physical
   flows use AutoGrade pipeline, digital flows use LevelUp pipeline
2. **Keep separate domain paths** — Exam (physical) and StoryPoint/Test
   (digital) remain distinct entities with shared progress tracking layer

---

### Conflict 4: AI Evaluation Configuration Scope

**Problem**: AutoGrade configures evaluation at the **client (school) level**.
LevelUp configures at the **course or item level**.

|                      | AutoGrade                                                              | LevelUp                                                                                  |
| -------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Config unit          | `EvaluationFeedbackRubric` → applies to all exams in client            | `AgentDTO` → applies to a course or single item                                          |
| Override granularity | Per-exam: `Exam.evaluationSettingsId?` (one level of override)         | Per-item: `ItemDTO.meta.evaluatorAgentId?` overrides `CourseDTO.defaultEvaluatorAgentId` |
| Criteria model       | 4 named dimensions (Critical Issues, Structure, Clarity, Completeness) | Named objectives with point values (freeform)                                            |
| API key              | Client's own Gemini key (decentralized)                                | Platform-managed key (centralized)                                                       |

**Unresolved question**: In the unified platform, does the school admin
configure evaluation settings (AutoGrade model), or does the course creator
configure agents (LevelUp model)?

**Resolution options**:

1. **Two-tier config**: School admin sets default dimensions (RELMS) +
   Course/item can override with agent objectives
2. **Migrate to agent model**: EvaluationFeedbackRubric becomes a special type
   of AgentDTO at the client scope

---

### Conflict 5: Progress & Scoring Model

**Problem**: AutoGrade tracks marks (integer scores out of totalMarks). LevelUp
tracks points (gamified accumulation, leaderboard-friendly).

|                              | AutoGrade                                              | LevelUp                                                           |
| ---------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------- |
| Score unit                   | Marks (e.g., 47/60)                                    | Points (e.g., 850 points earned)                                  |
| Aggregation                  | `Submission.summary.percentage` = totalScore/maxScore  | `UserStoryPointProgressDoc.percentage` = pointsEarned/totalPoints |
| Grade                        | `summary.grade` (letter grade derived from percentage) | Not present                                                       |
| Passing threshold            | `Exam.passingMarks`                                    | `ItemPayload.assessment.passingScore` (0-100 %)                   |
| Display                      | Academic (marks, grade, percentage)                    | Gamified (points, leaderboard rank, completion %)                 |
| Storage of historical scores | Only latest submission stored                          | Full `attempts` collection with all historical attempts           |

**Resolution options**:

1. **Dual scoring**: Store both marks (for academic reporting) and points (for
   gamified UX)
2. **Marks-to-points conversion**: Define a conversion formula at the
   exam/course level
3. **Context-aware**: Exam context shows marks, learning context shows points

---

### Conflict 6: Multi-Tenancy & Data Isolation Strategy

**Problem**: AutoGrade isolates all data under `/clients/{clientId}/...` (hard
Firestore path isolation). LevelUp uses `orgId` fields on documents without path
isolation.

|                     | AutoGrade                                           | LevelUp                                                     |
| ------------------- | --------------------------------------------------- | ----------------------------------------------------------- |
| Isolation mechanism | Firestore sub-collection path (`/clients/{id}/...`) | Field-based (`orgId` on documents in shared collections)    |
| Cross-tenant query  | Impossible by Firestore path                        | Possible (must rely on Firestore security rules to prevent) |
| Security model      | Path-based rules enforced at DB level               | Field-based rules (more complex, easier to misconfigure)    |
| Data migration      | Moving data = complex path restructure              | Moving data = update `orgId` field                          |
| Shared content      | Not supported — all content is per-client           | Supported — public courses can be accessed by any org       |

**Resolution options**:

1. **Adopt AutoGrade path isolation** for B2B school data; use LevelUp
   field-based approach for shared/public content
2. **Hybrid**: Per-tenant collections for sensitive exam/submission data; shared
   collections for courses and content

---

### Conflict 7: Authentication Flow

**Problem**: AutoGrade uses a 2-step school-code login flow. LevelUp uses
standard Firebase/Google login.

|                       | AutoGrade                                              | LevelUp                                     |
| --------------------- | ------------------------------------------------------ | ------------------------------------------- |
| Step 1                | Enter school code → verify client exists               | Direct email/password or Google OAuth       |
| Step 2                | Enter email/password within school context             | (single step)                               |
| School code purpose   | Identifies which client/tenant to authenticate against | Not present                                 |
| Social auth           | Not supported                                          | Google OAuth supported                      |
| Session context       | `UserMembership` sets `currentClientId`                | `userOrgs` sets org membership context      |
| Multi-school handling | User can switch client via school code + login         | User can be in multiple orgs via `userOrgs` |

**Resolution options**:

1. **Preserve school-code flow for school contexts** + standard flow for
   B2C/consumer contexts
2. **Org-code replaces school-code**: LevelUp's `OrgDTO.code` (join code)
   replaces AutoGrade's `schoolCode` for unified auth

---

### Conflict 8: Content Ownership Model

**Problem**: AutoGrade content is institutionally owned. LevelUp content is
creator-owned.

|                     | AutoGrade                                        | LevelUp                                            |
| ------------------- | ------------------------------------------------ | -------------------------------------------------- |
| Exam creator        | Client Admin (institution owns the exam)         | Course creator (`CourseDTO.ownerUid` — individual) |
| Content portability | Exam cannot be shared across clients             | Course can be marked `isPublic`, sold in store     |
| Admin delegation    | Teacher can grade, cannot create exams (partial) | `adminUids[]` on Course (multiple co-admins)       |
| Version control     | No versioning                                    | No explicit versioning either                      |

**Resolution options**:

1. **Institution-owned for exams** (AutoGrade model), **creator-owned for
   courses** (LevelUp model) — two separate ownership models coexist
2. **Unified ownership**: All content has both `ownerUid` (creator) and
   `clientId` (institution), with institution taking precedence in B2B context

---

### Conflict 9: Feedback Dimension vs Evaluator Objective

**Problem**: Both systems have a concept of "what gets evaluated and how" — but
they're stored and applied differently.

|                 | AutoGrade (`FeedbackDimension`)                               | LevelUp (`evaluationObjective`)                       |
| --------------- | ------------------------------------------------------------- | ----------------------------------------------------- | ------ | ------------- |
| Named criteria  | 4 standard: Critical Issues, Structure, Clarity, Completeness | Free-form: any name + point value                     |
| Scope           | Client-wide (applies to all exams in the school)              | Per-agent (applies to courses/items using that agent) |
| Priority        | `priority: 'high'                                             | 'medium'                                              | 'low'` | Not specified |
| Point value     | Marks per criterion (via `RubricCriterion.marks`)             | `points` on objective                                 |
| Output grouping | `structuredFeedback` map keyed by dimension ID                | Agent-defined evaluation output                       |

**Resolution options**:

1. **RELMS as foundation**: Use AutoGrade's named dimensions as the standard
   rubric framework; agent objectives map to custom dimensions
2. **Objectives as foundation**: Convert RELMS dimensions to
   evaluationObjectives in a "default evaluator agent" per client

---

## 7. Summary Matrix

### Concept Status Overview

| Concept                      |             AutoGrade              |              LevelUp               |                         Status                          |
| ---------------------------- | :--------------------------------: | :--------------------------------: | :-----------------------------------------------------: |
| Top-level tenant             |             ✅ Client              |             ✅ OrgDTO              | 🔄 **Conflict** — different fields, isolation strategy  |
| User identity                |        ✅ User + role docs         |             ✅ AppUser             |          🔄 **Conflict** — structural mismatch          |
| Role membership              |         ✅ UserMembership          |  ✅ UserOrgRecord + UserRolesDTO   | 🔄 **Conflict** — split across 2 collections in LevelUp |
| Class/Cohort grouping        |              ✅ Class              |      ⚠️ OrgGroupDTO (partial)      |      🔄 **Conflict** — different semantic meaning       |
| Teacher role                 |         ✅ Teacher entity          |      ⚠️ Role only (no entity)      |                  🔄 **Gap in LevelUp**                  |
| Parent role                  |          ✅ Parent entity          |              ❌ None               |                 🆕 **AutoGrade-unique**                 |
| Physical exam assessment     |              ✅ Exam               |              ❌ None               |                 🆕 **AutoGrade-unique**                 |
| Digital timed test           |   ✅ Partial (no multi-attempt)    |        ✅ TimedTestSession         |         🔄 **Conflict** — different model depth         |
| Question/Item                |        ✅ Question (narrow)        |    ✅ ItemDTO (rich, 15 types)     |           🔄 **Conflict** — LevelUp superset            |
| Answer submission            | ✅ Submission + QuestionSubmission |  ✅ TimedTestSession + AttemptDTO  |           🔄 **Conflict** — different schemas           |
| AI evaluation                |      ✅ RELMS (client-level)       | ✅ Agent-based (course/item-level) |        🔄 **Conflict** — different config scopes        |
| Evaluation rubric            |    ✅ EvaluationFeedbackRubric     |  ⚠️ AgentDTO evaluationObjectives  |           🔄 **Conflict** — different models            |
| Scanner device               |         ✅ Scanner entity          |              ❌ None               |                 🆕 **AutoGrade-unique**                 |
| LLM usage tracking           |           ✅ LLMUsageLog           |              ❌ None               |                 🆕 **AutoGrade-unique**                 |
| Progress tracking            |       ✅ Submission.summary        |    ✅ UserStoryPointProgressDoc    |            🔄 **Conflict** — marks vs points            |
| Learning materials           |              ❌ None               |    ✅ ItemDTO (material types)     |                  🆕 **LevelUp-unique**                  |
| Learning path structure      |              ❌ None               |          ✅ StoryPointDTO          |                  🆕 **LevelUp-unique**                  |
| AI tutor chat                |        ⚠️ Experimental only        |     ✅ ChatSession + AgentDTO      |                  🆕 **LevelUp-unique**                  |
| Practice range               |              ❌ None               |      ✅ PracticeRangeItemDTO       |                  🆕 **LevelUp-unique**                  |
| Content marketplace          |              ❌ None               |     ✅ RedemptionCodes + store     |                  🆕 **LevelUp-unique**                  |
| Bloom's taxonomy tagging     |              ❌ None               |    ✅ ItemAnalytics.bloomsLevel    |                  🆕 **LevelUp-unique**                  |
| Real-time leaderboards       |              ❌ None               |     ✅ RTDB leaderboard paths      |                  🆕 **LevelUp-unique**                  |
| Multi-attempt testing        |              ❌ None               |    ✅ attemptNumber on sessions    |                  🆕 **LevelUp-unique**                  |
| Visual analytics dashboard   |              ❌ None               |    ✅ VisualAnalyticsDashboard     |                  🆕 **LevelUp-unique**                  |
| Bulk student CSV import      |             ✅ Defined             |              ❌ None               |                 🆕 **AutoGrade-unique**                 |
| Page scouting pipeline       |           ✅ Panopticon            |              ❌ None               |                 🆕 **AutoGrade-unique**                 |
| School-code login            |               ✅ Yes               |              ❌ None               |         🔄 **Conflict** — auth flow difference          |
| Client API key management    |     ✅ per-client geminiApiKey     |      ❌ Platform-managed only      |           🔄 **Conflict** — API key ownership           |
| Habit tracker (WillApp)      |              ❌ None               |        ✅ WillApp entities         |                  🆕 **LevelUp-unique**                  |
| Org analytics (pre-computed) |              ❌ None               |       ⚠️ Planned (not built)       |                  🆕 **LevelUp-unique**                  |
| Subscription management      |   ✅ subscriptionPlan on Client    |  ⚠️ OrgSubscriptionDoc (planned)   |                 🔄 **Partial overlap**                  |

**Legend**:

- 🔄 **Conflict** — both exist, incompatible models, must reconcile
- 🆕 **X-unique** — only one app has this, straightforward adoption
- ⚠️ **Partial** — exists in one app but incomplete or mismatched scope
- ✅ Feature present and functional
- ❌ Feature absent

---

### Critical Conflicts — Priority for Phase 3 Resolution

| Priority | Conflict                                                    | Why Critical                                                              |
| :------: | ----------------------------------------------------------- | ------------------------------------------------------------------------- |
|  🔴 P0   | **User identity model**                                     | Every feature depends on who the user is and what roles they have         |
|  🔴 P0   | **Multi-tenancy isolation strategy**                        | Firestore path isolation vs field-based — affects every collection design |
|  🔴 P0   | **Assessment model** (physical vs digital)                  | Core business function of both apps; cannot be left ambiguous             |
|  🟡 P1   | **AI evaluation config scope** (client-level vs item-level) | Affects grading architecture, AI cost model, and feedback UX              |
|  🟡 P1   | **Progress & scoring model** (marks vs points)              | Academic reporting vs gamified UX — fundamental UX direction              |
|  🟡 P1   | **Organizational hierarchy depth**                          | School > Class > Section vs Org > Group > Course                          |
|  🟢 P2   | **Authentication flow** (school-code vs standard)           | Can be additive (both flows for different user types)                     |
|  🟢 P2   | **Content ownership** (institutional vs creator)            | Can coexist — exam=institutional, course=creator                          |
|  🟢 P2   | **Feedback dimension vs evaluator objective**               | Technical reconciliation, not user-facing                                 |

---

_Document generated: 2026-02-19_ _Next step: Phase 3 — Unified ERD design
resolving all conflicts identified in this document_ _Output:
`docs/UNIFIED_ERD.md`_
