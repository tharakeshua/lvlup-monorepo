# Auto-LevelUp Domain Glossary

> Canonical definitions for the Auto-LevelUp EdTech platform ubiquitous
> language. All type names in code MUST match these terms exactly.

---

## Identity & Multi-Tenancy

| Term               | Definition                                                                                                       | Firestore Path                      | Type Name         |
| ------------------ | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ----------------- |
| **UnifiedUser**    | Platform-level user identity. Document ID = Firebase Auth UID.                                                   | `/users/{uid}`                      | `UnifiedUser`     |
| **Tenant**         | A school, institution, or organization. The multi-tenancy root entity. All domain data is scoped under a tenant. | `/tenants/{tenantId}`               | `Tenant`          |
| **TenantCode**     | A unique short code (e.g., "SPR001") used for tenant lookup and join flows.                                      | `/tenantCodes/{code}`               | `TenantCodeIndex` |
| **UserMembership** | Links a user to a tenant with a specific role. Composite key: `{uid}_{tenantId}`.                                | `/userMemberships/{uid}_{tenantId}` | `UserMembership`  |
| **PlatformClaims** | Firebase Auth custom claims for fast authorization checks in security rules.                                     | (JWT, not Firestore)                | `PlatformClaims`  |

## Tenant Entities

| Term                | Definition                                                                                          | Firestore Path                                     | Type Name         |
| ------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ----------------- |
| **Class**           | A class or section within a tenant (e.g., "Grade 10-A"). Contains lists of teacher and student IDs. | `/tenants/{tenantId}/classes/{classId}`            | `Class`           |
| **Student**         | A student profile within a tenant. Linked to a user via `uid`.                                      | `/tenants/{tenantId}/students/{studentId}`         | `Student`         |
| **Teacher**         | A teacher profile within a tenant. Has granular permissions.                                        | `/tenants/{tenantId}/teachers/{teacherId}`         | `Teacher`         |
| **Parent**          | A parent/guardian profile within a tenant. Linked to one or more students.                          | `/tenants/{tenantId}/parents/{parentId}`           | `Parent`          |
| **AcademicSession** | An academic year or term (e.g., "2025-2026"). Used to scope classes and content.                    | `/tenants/{tenantId}/academicSessions/{sessionId}` | `AcademicSession` |

## LevelUp (Digital Learning)

| Term                                 | Definition                                                                                                                                         | Firestore Path                                                                | Type Name            |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | -------------------- |
| **Space**                            | A learning space (course, module, or content collection). Contains StoryPoints. Types: learning, practice, assessment, resource, hybrid.           | `/tenants/{tenantId}/spaces/{spaceId}`                                        | `Space`              |
| **StoryPoint**                       | A section or chapter within a Space. Contains Items. Types: standard, timed_test, quiz, practice, test.                                            | `/tenants/{tenantId}/spaces/{spaceId}/storyPoints/{storyPointId}`             | `StoryPoint`         |
| **Item** (UnifiedItem)               | The canonical content atom. 7 top-level types: question, material, interactive, assessment, discussion, project, checkpoint. 15 question subtypes. | `/tenants/{tenantId}/spaces/{spaceId}/storyPoints/{spId}/items/{itemId}`      | `UnifiedItem`        |
| **Agent**                            | An AI tutor or evaluator agent configured for a Space.                                                                                             | `/tenants/{tenantId}/spaces/{spaceId}/agents/{agentId}`                       | `Agent`              |
| **DigitalTestSession** (TestSession) | Tracks a student's test, quiz, or practice attempt within a StoryPoint.                                                                            | `/tenants/{tenantId}/digitalTestSessions/{sessionId}`                         | `DigitalTestSession` |
| **SpaceProgress**                    | Tracks a student's overall progress through a Space, including per-StoryPoint and per-Item progress.                                               | `/tenants/{tenantId}/spaceProgress/{userId}_{spaceId}`                        | `SpaceProgress`      |
| **ChatSession**                      | An AI tutor conversation session for a specific Item.                                                                                              | `/tenants/{tenantId}/chatSessions/{sessionId}`                                | `ChatSession`        |
| **AnswerKey**                        | Server-only answer data for timed test verification.                                                                                               | `/tenants/{tenantId}/spaces/{spaceId}/storyPoints/{spId}/answerKeys/{itemId}` | `AnswerKey`          |

## AutoGrade (Physical Exam Grading)

| Term                       | Definition                                                                                                  | Firestore Path                                                                    | Type Name                |
| -------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------ |
| **Exam**                   | A physical exam document. Contains metadata, grading config, and lifecycle status.                          | `/tenants/{tenantId}/exams/{examId}`                                              | `Exam`                   |
| **ExamQuestion**           | A question extracted from a physical exam paper, with rubric.                                               | `/tenants/{tenantId}/exams/{examId}/questions/{questionId}`                       | `ExamQuestion`           |
| **Submission**             | A student's answer sheet submission for an exam. Tracks pipeline status through OCR, scouting, and grading. | `/tenants/{tenantId}/submissions/{submissionId}`                                  | `Submission`             |
| **QuestionSubmission**     | Per-question grading result within a Submission. Contains evaluation result and manual override data.       | `/tenants/{tenantId}/submissions/{submissionId}/questionSubmissions/{questionId}` | `QuestionSubmission`     |
| **EvaluationSettings**     | Configurable feedback dimensions for AI grading.                                                            | `/tenants/{tenantId}/evaluationSettings/{settingsId}`                             | `EvaluationSettings`     |
| **GradingDeadLetterEntry** | Failed grading pipeline entries for manual resolution.                                                      | `/tenants/{tenantId}/gradingDeadLetter/{entryId}`                                 | `GradingDeadLetterEntry` |
| **ExamAnalytics**          | Computed analytics for an exam (score distribution, per-question analysis).                                 | `/tenants/{tenantId}/examAnalytics/{examId}`                                      | `ExamAnalytics`          |

## Shared Content Types

| Term                        | Definition                                                                                                                                     | Type Name                 |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| **UnifiedRubric**           | Canonical grading criteria structure supporting 4 scoring modes (criteria, dimension, holistic, hybrid). Shared between AutoGrade and LevelUp. | `UnifiedRubric`           |
| **UnifiedEvaluationResult** | Canonical AI/manual grading result with structured feedback, rubric breakdown, and cost tracking.                                              | `UnifiedEvaluationResult` |
| **ItemMetadata**            | Rich metadata for Items including educational dimensions, PYQ info, and migration source.                                                      | `ItemMetadata`            |
| **ItemAnalytics**           | Multi-dimensional analytics attached to Items for filtering, reporting, and AI recommendations.                                                | `ItemAnalytics`           |

## Progress & Analytics

| Term                       | Definition                                                             | Firestore Path                                             | Type Name                |
| -------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------ |
| **StudentProgressSummary** | Cross-system aggregation of a student's AutoGrade and LevelUp metrics. | `/tenants/{tenantId}/studentProgressSummaries/{studentId}` | `StudentProgressSummary` |
| **ClassProgressSummary**   | Cross-system aggregation of a class's performance metrics.             | `/tenants/{tenantId}/classProgressSummaries/{classId}`     | `ClassProgressSummary`   |
| **DailyCostSummary**       | Daily LLM cost tracking by purpose and model.                          | `/tenants/{tenantId}/dailyCostSummaries/{date}`            | `DailyCostSummary`       |
| **LearningInsight**        | Personalized recommendation generated by the Insight Engine.           | `/tenants/{tenantId}/insights/{insightId}`                 | `LearningInsight`        |
| **AtRiskDetectionResult**  | Result of nightly at-risk student detection.                           | (computed, stored on summary)                              | `AtRiskDetectionResult`  |
| **LLMCallLog**             | Audit record for every LLM invocation with cost and latency data.      | `/tenants/{tenantId}/llmCallLogs/{logId}`                  | `LLMCallLog`             |

## Notifications

| Term                        | Definition                                                      | Firestore Path                                         | Type Name                 |
| --------------------------- | --------------------------------------------------------------- | ------------------------------------------------------ | ------------------------- |
| **Notification**            | In-app notification for exam results, assignments, alerts, etc. | `/tenants/{tenantId}/notifications/{notificationId}`   | `Notification`            |
| **NotificationPreferences** | User's notification type preferences and mute settings.         | `/tenants/{tenantId}/notificationPreferences/{userId}` | `NotificationPreferences` |
| **NotificationRTDBState**   | Lightweight RTDB state for real-time unread badge updates.      | `/notifications/{tenantId}/{userId}/`                  | `NotificationRTDBState`   |

## Branded ID Types

All entity IDs use branded types for compile-time safety:

| Branded Type   | Base Type | Usage                   |
| -------------- | --------- | ----------------------- |
| `TenantId`     | `string`  | Tenant document IDs     |
| `ClassId`      | `string`  | Class document IDs      |
| `StudentId`    | `string`  | Student document IDs    |
| `TeacherId`    | `string`  | Teacher document IDs    |
| `ParentId`     | `string`  | Parent document IDs     |
| `SpaceId`      | `string`  | Space document IDs      |
| `StoryPointId` | `string`  | StoryPoint document IDs |
| `ItemId`       | `string`  | Item document IDs       |
| `ExamId`       | `string`  | Exam document IDs       |
| `SubmissionId` | `string`  | Submission document IDs |
| `UserId`       | `string`  | Firebase Auth UIDs      |
| `SessionId`    | `string`  | Test/Chat session IDs   |
| `AgentId`      | `string`  | Agent document IDs      |

---

## Key Relationships

```
UnifiedUser (1) ──→ (N) UserMembership ──→ (1) Tenant
Tenant (1) ──→ (N) Class
Tenant (1) ──→ (N) Student, Teacher, Parent
Tenant (1) ──→ (N) Space ──→ (N) StoryPoint ──→ (N) Item
Tenant (1) ──→ (N) Exam ──→ (N) ExamQuestion
Tenant (1) ──→ (N) Submission ──→ (N) QuestionSubmission
Student (1) ──→ (N) SpaceProgress, DigitalTestSession
Space (1) ──→ (N) Agent
```
