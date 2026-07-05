# Auto-LevelUp — All Tables (Firestore + RTDB)

Complete data dictionary of every Firestore collection / subcollection and every
Realtime Database (RTDB) node across all apps (admin-web, parent-web,
student-web, super-admin, teacher-web, mobile-student, mobile-admin,
mobile-teacher) plus Cloud Functions.

**Sources of truth**

- `firestore.rules` — declared collections + access control
- `database.rules.json` — RTDB node tree
- `firestore.indexes.json` — composite indexes (confirms collections + queried
  fields)
- `packages/domain/src/entities/**` — Zod schemas = field definitions
- `packages/repositories`, `packages/shared-services`,
  `packages/transport-firebase`, `functions/` — runtime path construction

**Conventions**

- Almost everything is **tenant-scoped** under `tenants/{tenantId}/…`
  (multi-tenant SaaS).
- Top-level collections are **prefixable** via `LVLUP_COLLECTION_PREFIX` env var
  (empty by default; e.g. `v2_`).
- Timestamps are **ISO 8601 strings at rest** (`createdAt`, `updatedAt`, etc.).
- IDs are **branded strings** (`UserId`, `TenantId`, `SpaceId`, …).
- `money` = `{ amount, currency }`. `nullable` = explicitly `null`-able;
  `optional` = field may be absent.
- Every entity carries the audit quartet
  `createdAt / updatedAt / createdBy / updatedBy` unless noted.

> ⚠️ **Rules vs. repo divergence:** the security rules still declare a few
> legacy paths (`tenants/{t}/spaces/{s}/items` direct, `testSessions`,
> `progress`, top-level `scanners`, `auditLogs`) alongside the canonical repo
> paths (`…/storyPoints/{sp}/items`, `digitalTestSessions`, `spaceProgress`,
> `tenants/{t}/scanners`). Both are listed below and flagged. Canonical = what
> the repositories layer writes today.

---

## 1. Platform-Root Collections (NOT tenant-scoped)

| Collection                               | Doc ID            | Entity                  | Purpose                                            |
| ---------------------------------------- | ----------------- | ----------------------- | -------------------------------------------------- |
| `users/{uid}`                            | Firebase Auth UID | **UnifiedUser**         | Global user profile (one per human, spans tenants) |
| `userMemberships/{uid}_{tenantId}`       | composite         | **UserMembership**      | A user's role/permissions within one tenant        |
| `tenants/{tenantId}`                     | tenantId          | **Tenant**              | Organization / school / consumer container         |
| `tenantCodes/{code}`                     | school code       | **TenantCodeIndex**     | Pre-auth lookup of tenant by join code             |
| `globalEvaluationPresets/{id}`           | presetId          | **EvaluationSettings**  | Platform-wide grading presets                      |
| `platformActivityLog/{id}`               | auto              | **PlatformActivityLog** | Super-admin / platform audit trail                 |
| `scanners/{scannerId}` _(legacy, rules)_ | scannerId         | **Scanner**             | OMR scanner device (now tenant-scoped, see §2)     |

### UnifiedUser — `users/{uid}`

`uid` (id) · `email?` · `phone?` · `authProviders[]` · `displayName` ·
`firstName?` · `lastName?` · `photoURL?` · `country?` · `age?` · `grade?` ·
`onboardingCompleted?` · `preferences?{theme,language,notificationsEnabled}` ·
`isSuperAdmin` ·
`consumerProfile?{plan, enrolledSpaceIds[], purchaseHistory[], totalSpend?}` ·
`activeTenantId?` · `status` · audit-quartet · `lastLogin?`

- **Security:** self-read/write only; cannot self-elevate `isSuperAdmin`, change
  `status`, or edit `consumerProfile.enrolledSpaceIds` (payments via CF).

### UserMembership — `userMemberships/{uid}_{tenantId}`

`id` · `uid` · `tenantId` · `tenantCode` · `role`
(tenantAdmin|teacher|student|parent|staff|scanner) · `status` (active|…) ·
`joinSource` · role-specific ids
`teacherId?/studentId?/parentId?/staffId?/scannerId?` ·
`permissions?{managedClassIds[], managedSpaceIds[], …}` · `staffPermissions?{}`
· `parentLinkedStudentIds?[]` · audit · `lastActive?`

- **Write:** Admin SDK / Cloud Functions only.

### Tenant — `tenants/{tenantId}`

`id` · `name` · `shortName?` · `slug` · `tenantCode` · `ownerUid` · `status`
(active|trial|…) ·
`subscription{plan,maxStudents?,maxTeachers?,maxExamsPerMonth?,maxAiCallsPerMonth?,renewsAt?}`
· `features{autograde?,levelup?,analytics?,store?}` ·
`settings{geminiKeyRef?,timezone?,locale?,gradingScale?}` ·
`stats{totalStudents,totalTeachers,totalClasses,totalExams,totalSpaces}` ·
`usage?{examsThisMonth,aiCallsThisMonth,resetAt?}` ·
`branding?{logoUrl,bannerUrl,faviconUrl,primaryColor,secondaryColor}` ·
`onboarding?` · `deactivation?` · `contactEmail?` · `contactPhone?` ·
`trialEndsAt?` · audit

- **Security:** public single-`get` (pre-auth login); create/update/delete =
  SuperAdmin only.

### TenantCodeIndex — `tenantCodes/{code}` · `PlatformActivityLog` · `globalEvaluationPresets`

- TenantCodeIndex: `tenantId` · `createdAt`. Public `get`, CF-only write.
- PlatformActivityLog: `id` · `action` · `actorUid` · `actorEmail` · `tenantId?`
  · `metadata{}` · `createdAt`.
- globalEvaluationPresets: full **EvaluationSettings** shape (see §7).

---

## 2. Tenant-Scoped Identity & Roster

| Path                                         | Entity                      | Key fields                                                                                                                                                                |
| -------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tenants/{t}/students/{id}`                  | **Student**                 | firstName?/lastName?/displayName? · email? · rollNumber? · section? · `classIds[]` · `parentIds[]` · grade? · admissionNumber? · dateOfBirth? · authUid? · status · audit |
| `tenants/{t}/teachers/{id}`                  | **Teacher**                 | firstName/lastName · email?/phone? · employeeId? · department? · `subjects[]` · designation? · `classIds[]` · `sectionIds?[]` · authUid? · status · lastLogin? · audit    |
| `tenants/{t}/parents/{id}`                   | **Parent**                  | firstName/lastName · email?/phone? · `studentIds[]` · `linkedStudentNames?[]` · authUid? · status · lastLogin? · audit                                                    |
| `tenants/{t}/staff/{id}`                     | **Staff**                   | firstName/lastName · email? · department? · authUid? · status · audit                                                                                                     |
| `tenants/{t}/scanners/{id}`                  | **Scanner**                 | name · `authUid` (req) · status · audit                                                                                                                                   |
| `tenants/{t}/classes/{id}`                   | **Class**                   | name · grade · section? · academicSessionId? · `teacherIds[]` · `studentIds[]` · studentCount · status · audit                                                            |
| `tenants/{t}/academicSessions/{id}`          | **AcademicSession**         | name · startDate · endDate · isCurrent · status · audit                                                                                                                   |
| `tenants/{t}/notifications/{id}`             | **Notification**            | recipientUid · recipientRole · type · title · body · entityType?/entityId? · actionUrl? · isRead · createdAt · readAt?                                                    |
| `tenants/{t}/notificationPreferences/{uid}`  | **NotificationPreferences** | userId · `enabledTypes[]` · muteUntil?                                                                                                                                    |
| `tenants/{t}/announcements/{id}`             | **Announcement**            | title · body · authorUid · authorName · scope · targetRoles?[] · targetClassIds?[] · status · publishedAt? · expiresAt? · archivedAt? · audit                             |
| `tenants/{t}/announcements/{id}/reads/{uid}` | Announcement read-receipt   | per-user read marker                                                                                                                                                      |
| `tenants/{t}/users/{uid}/devices/{token}`    | Device token                | FCM push token registration                                                                                                                                               |
| `tenants/{t}/auditLogs/{id}` _(rules)_       | Audit log                   | CF-only write; admin read                                                                                                                                                 |

**Index highlights:** students `(classIds,status)`,`(grade,section,status)`;
classes `(academicSessionId,status)`,`(grade,status)`,`(status,name)`;
academicSessions `(isCurrent,status)`,`(status,startDate↓)`; notifications
`(recipientId,createdAt↓)`,`(recipientId,isRead,createdAt↓)`.

**Claims** (Firebase custom claims, not a collection — `PlatformClaims`):
`role?` · `tenantId?` · `tenantCode?` ·
`teacherId?/studentId?/parentId?/scannerId?/staffId?` · `classIds?[]` ·
`classIdsOverflow?` · `studentIds?[]` · `permissions?{}` · `staffPermissions?{}`
· `isSuperAdmin?`.

---

## 3. LevelUp — Learning Content

| Path                                                  | Entity               | Key fields                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ----------------------------------------------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tenants/{t}/spaces/{spaceId}`                        | **Space**            | title · description? · thumbnailUrl? · slug? · type · subject? · labels?[] · `classIds[]` · `sectionIds?[]` · `teacherIds[]` · accessType (tenant_wide\|class\|public_store\|…) · academicSessionId? · defaultEvaluatorAgentId? · defaultTutorAgentId? · defaultRubric?/defaultRubricId? · price? (money) · publishedToStore? · storeDescription?/storeThumbnailUrl? · status · publishedAt? · stats{storyPointCount,itemCount,enrolledCount,completionCount} · ratingAggregate{averageRating,totalReviews,distribution} · version? · audit · archivedAt? |
| `…/spaces/{s}/storyPoints/{id}`                       | **StoryPoint**       | title · description? · orderIndex · type · `sections[]{id,title,description?,orderIndex}` · assessmentConfig?{durationMinutes,maxAttempts,shuffle,passingPercentage,adaptiveConfig?,schedule?,retryConfig?} · defaultRubric?/defaultRubricId? · difficulty? · estimatedTimeMinutes? · stats{itemCount,completionCount} · audit · archivedAt?                                                                                                                                                                                                              |
| `…/storyPoints/{sp}/items/{id}` ✅ canonical          | **UnifiedItem**      | spaceId · storyPointId · sectionId? · type · `payload` (discriminated union, see §3a) · title?/content? · difficulty? · topics?[]/labels?[] · orderIndex · meta? · analytics? · rubric?/rubricId? · linkedQuestionId? · attachments?[] · version? · audit · archivedAt?                                                                                                                                                                                                                                                                                   |
| `…/items/{itemId}/answerKeys/{keyId}`                 | **AnswerKey**        | itemId · questionType · correctAnswer · acceptableAnswers?[] · evaluationGuidance? · modelAnswer? · timestamps — **server-only (deny-all)**                                                                                                                                                                                                                                                                                                                                                                                                               |
| `tenants/{t}/spaces/{s}/items/{id}` _(legacy, rules)_ | UnifiedItem          | direct (non-storyPoint) item path; superseded by nested                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `…/spaces/{s}/reviews/{uid}`                          | **SpaceReview**      | spaceId · userId · userName? · rating (1–5) · comment? · audit                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `tenants/{t}/agents/{id}`                             | **Agent**            | spaceId · type (evaluator\|tutor) · name · identity? · isActive · systemPrompt? · supportedLanguages?[] · defaultLanguage? · maxConversationTurns? · rules?[] · evaluationObjectives?[] · strictness? · feedbackStyle? · modelOverride?/temperatureOverride? · audit                                                                                                                                                                                                                                                                                      |
| `tenants/{t}/rubricPresets/{id}`                      | **RubricPreset**     | name · description? · rubric (UnifiedRubric) · category · questionTypes?[] · isDefault · timestamps                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `tenants/{t}/questionBank/{id}`                       | **QuestionBankItem** | questionType · title? · content · explanation? · basePoints? · questionData · subject · topics[] · difficulty · bloomsLevel? · usageCount · averageScore? · lastUsedAt? · tags[] · timestamps                                                                                                                                                                                                                                                                                                                                                             |

### 3a. ItemPayload — discriminated union on `type`

- **question** → `basePoints?` + `questionData` (QuestionTypeData, see §3b)
- **material** → `materialData`
  (text\|video\|pdf\|link\|interactive\|story\|rich)
- **interactive** → `interactiveType` · `config?` · `embedUrl?`
- **assessment** → `assessmentType` · `durationMinutes?` · `passingPercentage?`
- **discussion** → `threadType` · `prompt`
- **project** → `brief` · `deliverables?[]` · `rubricDriven?`
- **checkpoint** → `message?` · `requiresAcknowledgement?`

### 3b. QuestionTypeData — 15 question types (discriminated on `questionType`)

`mcq` · `mcaq` · `true-false` · `numerical` · `text` · `paragraph` · `code` ·
`fill-blanks` · `fill-blanks-dd` · `matching` · `jumbled` · `audio` ·
`image_evaluation` · `group-options` · `chat_agent_question` (each carries its
own options/answer/config shape — e.g. mcq
`options[]{id,text,imageUrl?,isCorrect?}`, code
`language?/starterCode?/testCases[]`, fill-blanks `template+blanks[]`).

### 3c. Supporting content schemas

- **UnifiedRubric**: scoringMode · criteria?[]{name,maxScore,weight?,levels[]} ·
  dimensions?[]{name,priority,weight?,scoringScale?} ·
  holisticGuidance?/holisticMaxScore? · passingPercentage? ·
  showModelAnswer?/modelAnswer? · evaluatorGuidance?
- **ItemMetadata**: totalPoints?/maxMarks?/estimatedTime? ·
  learningObjectives?[]/skillsAssessed?[] · bloomsLevel? · prerequisites?[] ·
  isRetriable? · evaluatorAgentId? · pyqInfo?[]{year,examName,marks?} ·
  featured? · viewCount? · successRate? · migrationSource?
- **ContentVersion**: version · entityType · entityId · changeType ·
  changeSummary · changedBy · changedAt

**Index highlights:** spaces
`(accessType,status,updatedAt↓)`,`(classIds,status)`,`(createdBy,status)`,`(status,updatedAt↓)`,`(type,status)`;
storyPoints `(order,status)`; items `(storyPointId,orderIndex)` +
collection-group `(spaceId,storyPointId,tenantId)`.

---

## 4. LevelUp — Chat / AI Tutor

| Path                                          | Entity          | Key fields                                                                                                                                                                                               |
| --------------------------------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tenants/{t}/chatSessions/{id}`               | **ChatSession** | userId · spaceId · storyPointId · itemId · questionType? · agentId?/agentName? · sessionTitle · previewMessage · messageCount · language · isActive · `messages[]` (ChatMessage) · systemPrompt? · audit |
| `…/chatSessions/{sessionId}/messages/{msgId}` | **ChatMessage** | role (user\|assistant\|system) · text · timestamp · mediaUrls?[] · tokensUsed?                                                                                                                           |

**Index:** chatSessions `(studentId,spaceId,createdAt↓)`.

---

## 5. Progress & Test Sessions

| Path                                                     | Doc ID    | Entity                    | Key fields                                                                                                                                                                                                                                                                                                                                                                             |
| -------------------------------------------------------- | --------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tenants/{t}/spaceProgress/{userId}_{spaceId}` ✅        | composite | **SpaceProgress**         | userId · spaceId · status · pointsEarned/totalPoints · marksEarned?/totalMarks? · percentage · `storyPoints{}` (map→StoryPointProgress) · startedAt?/completedAt? · updatedAt                                                                                                                                                                                                          |
| `…/spaceProgress/{id}/storyPointProgress/{spId}`         |           | **StoryPointProgressDoc** | storyPointId · status · pointsEarned/totalPoints · percentage · completedItems/totalItems · completedAt? · `items{}` (map→ItemProgressEntry)                                                                                                                                                                                                                                           |
| `tenants/{t}/storyPointProgress/{userId}_{storyPointId}` | composite | StoryPointProgressDoc     | flattened variant (repo path)                                                                                                                                                                                                                                                                                                                                                          |
| `tenants/{t}/digitalTestSessions/{id}` ✅                |           | **DigitalTestSession**    | userId · spaceId · storyPointId · sessionType · attemptNumber · status · isLatest · startedAt/endedAt? · durationMinutes · serverDeadline? · totalQuestions/answeredQuestions · questionOrder[] · visitedQuestions{}/markedForReview{} · points/marks/percentage · sectionMapping? · adaptiveState? · difficultyProgression?[] · analytics? · submittedAt?/autoSubmitted? · timestamps |
| `…/digitalTestSessions/{sid}/submissions/{itemId}`       |           | **TestSubmission**        | itemId · questionType · answer · submittedAt · timeSpentSeconds? · evaluation? · correct? · pointsEarned?/totalPoints?                                                                                                                                                                                                                                                                 |
| `…/digitalTestSessions/{sid}/live/current`               | fixed     | live status               | RTDB-style live mirror doc                                                                                                                                                                                                                                                                                                                                                             |
| `tenants/{t}/testSessions/{id}` _(legacy, rules)_        |           | TestSession               | superseded by digitalTestSessions                                                                                                                                                                                                                                                                                                                                                      |
| `tenants/{t}/progress/{id}` _(legacy, rules)_            |           | progress                  | keyed by studentId; superseded by spaceProgress                                                                                                                                                                                                                                                                                                                                        |

**ItemProgressEntry**: itemId · itemType · completed · completedAt? · timeSpent?
· interactions? · lastUpdatedAt ·
questionData?{status,attemptsCount,bestScore?,solved,latestScore?} ·
progress?/score?/feedback? · lastAnswer?/lastEvaluation? ·
`attempts?[]`{attemptNumber,answer,evaluation,score,maxScore,timestamp}

**Index highlights:** digitalTestSessions
`(userId,spaceId)`,`(userId,spaceId,storyPointId,createdAt↓)`,`(spaceId,status)` +
collection-group `(status,serverDeadline)`; spaceProgress
`(studentId,spaceId)`,`(studentId,updatedAt↓)`,`(spaceId,completionPercentage↓)`.

---

## 6. Autograde — Exams & Grading

| Path                                            | Entity                     | Key fields                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----------------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tenants/{t}/exams/{id}`                        | **Exam**                   | title · subject · topics[] · `classIds[]` · sectionIds?[] · examDate · duration · academicSessionId? · totalMarks · passingMarks · status (draft\|published\|grading\|completed\|results_released) · questionPaper?{images[],questionCount,examType} · gradingConfig{autoGrade,allowRubricEdit,allowManualOverride,requireOverrideReason,releaseResultsAutomatically,evaluationSettingsId?} · evaluationSettingsId? · linkedSpaceId?/linkedStoryPointId? · stats{totalSubmissions,gradedSubmissions,avgScore,passRate} · createdBy · timestamps |
| `…/exams/{examId}/questions/{qid}`              | **ExamQuestion**           | examId · text · imageUrls?[] · maxMarks · order · rubric (UnifiedRubric) · questionType? · subQuestions?[]{label,text,maxMarks,rubric?} · linkedItemId? · extractedBy?/extractedAt?/extractionConfidence? · readabilityIssue? · timestamps                                                                                                                                                                                                                                                                                                      |
| `tenants/{t}/submissions/{id}`                  | **Submission**             | examId · studentId · studentName · rollNumber · classId · answerSheets{images[],uploadedAt,uploadedBy,uploadSource} · scoutingResult?{routingMap,confidence,completedAt} · summary{totalScore,maxScore,percentage,grade,questionsGraded,totalQuestions,completedAt?} · pipelineStatus · pipelineError? · retryCount/watchdogRetryCount? · gradingProgress?{graded,total,batchIndex?} · resultsReleased · resultsReleasedAt?/resultsReleasedBy? · timestamps                                                                                     |
| `…/submissions/{sid}/questionSubmissions/{qid}` | **QuestionSubmission**     | submissionId · questionId · examId · mapping{pageIndices[],imageUrls[],scoutedAt} · evaluation? (UnifiedEvaluationResult) · gradingStatus · gradingError? · gradingRetryCount · manualOverride?{score,reason,overriddenBy,overriddenAt,originalScore} · timestamps                                                                                                                                                                                                                                                                              |
| `…/submissions/{sid}/live/current`              | live grading status        | progress mirror                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `tenants/{t}/gradingDeadLetter/{id}`            | **GradingDeadLetterEntry** | submissionId · questionSubmissionId? · pipelineStep (scouting\|grading) · error · errorStack? · attempts · lastAttemptAt · resolvedAt?/resolvedBy?/resolutionMethod? · createdAt                                                                                                                                                                                                                                                                                                                                                                |
| `tenants/{t}/examGradingProgress/{examId}`      | exam grading progress      | aggregate progress counter                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

**UnifiedEvaluationResult** (used by both autograde & levelup): score · maxScore
· correctness · percentage · structuredFeedback? ·
strengths[]/weaknesses[]/missingConcepts[] · rubricBreakdown?[] · summary? ·
confidence · mistakeClassification? · tokensUsed?/costUsd? · evaluationRubricId?
· dimensionsUsed? · gradedAt

**Index highlights:** exams
`(classIds,status,examDate↓)`,`(status,examDate)`,`(createdBy,status)`,`(spaceId,updatedAt↓)`;
submissions
`(examId,status)`,`(examId,studentId)`,`(examId,resultsReleased,classId)`,`(studentId,submittedAt↓)`,`(examId,submittedAt↓)`.

---

## 7. Settings & Config

| Path                                  | Entity                 | Key fields                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tenants/{t}/evaluationSettings/{id}` | **EvaluationSettings** | name · description? · isDefault · isPublic? · `enabledDimensions[]`{name,priority,weight?,scoringScale?,promptGuidance?} · displaySettings{showStrengths,showKeyTakeaway,prioritizeByImportance} · confidenceConfig?{confidenceThreshold,autoApproveThreshold,requireReviewForPartialCredit} · usageQuota?{monthlyBudgetUsd,dailyCallLimit,warningThresholdPercent} · createdBy? · timestamps |
| `globalEvaluationPresets/{id}`        | EvaluationSettings     | platform-wide variant (root)                                                                                                                                                                                                                                                                                                                                                                  |

**Index:** evaluationSettings `(scope,scopeId)`.

---

## 8. Analytics

| Path                                               | Doc ID    | Entity                     | Key fields                                                                                                                                                                                                                                                                                                                                                                   |
| -------------------------------------------------- | --------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tenants/{t}/studentProgressSummaries/{studentId}` | studentId | **StudentProgressSummary** | studentId · autograde{totalExams,completedExams,averageScore,averagePercentage,totalMarks*,subjectBreakdown{},recentExams[]} · levelup{totalSpaces,completedSpaces,averageCompletion,totalPoints*,averageAccuracy,streakDays,subjectBreakdown{},recentActivity[]} · overallScore · strengthAreas[]/weaknessAreas[] · isAtRisk · atRiskReasons[] · lastUpdatedAt · recompute? |
| `tenants/{t}/classProgressSummaries/{classId}`     | classId   | **ClassProgressSummary**   | className · studentCount · autograde{averageScore,averagePercentage,examCount,passRate} · levelup{averageCompletion,totalPointsEarned,activeStudents} · atRiskStudentIds[]/atRiskCount · lastUpdatedAt                                                                                                                                                                       |
| `tenants/{t}/examAnalytics/{examId}`               | examId    | **ExamAnalytics**          | totalSubmissions/gradedSubmissions · avgScore/avgPercentage/passRate/medianScore · scoreDistribution{buckets[],gradeDistribution?} · questionAnalytics{} · classBreakdown{} · topicPerformance{} · computedAt/lastUpdatedAt                                                                                                                                                  |
| `tenants/{t}/insights/{id}`                        | auto      | **LearningInsight**        | studentId · type · priority · title · description · actionType · actionEntityId?/actionEntityTitle? · createdAt · dismissedAt?                                                                                                                                                                                                                                               |
| `tenants/{t}/costSummaries/daily_{YYYY-MM-DD}`     | encoded   | **DailyCostSummary**       | date · totalCalls/totalInputTokens/totalOutputTokens/totalCostUsd · byPurpose{}/byModel{} (CostBucket) · budgetLimitUsd?/budgetUsedPercent?/budgetAlertSent? · computedAt                                                                                                                                                                                                    |
| `tenants/{t}/costSummaries/monthly_{YYYY-MM}`      | encoded   | **MonthlyCostSummary**     | month · same shape as daily                                                                                                                                                                                                                                                                                                                                                  |
| `tenants/{t}/llmCallLogs/{id}`                     | auto      | **LlmCallLog**             | functionName · model · inputTokens/outputTokens/totalTokens · costUSD · latencyMs · status · errorMessage? · userId?/examId?/spaceId? · createdAt — CF-only write                                                                                                                                                                                                            |
| `healthSnapshots/{id}` _(platform)_                | date      | **HealthSnapshot**         | status · services{} · checkedAt                                                                                                                                                                                                                                                                                                                                              |

**Index:** llmCallLogs `(taskType,createdAt↓)`.

---

## 9. Gamification

| Path                                                         | Doc ID          | Entity                 | Key fields                                                                                                                                              |
| ------------------------------------------------------------ | --------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tenants/{t}/achievements/{id}`                              | auto            | **Achievement**        | title · description · icon · category · rarity · tier · criteria{type,threshold,subject?,spaceId?} · pointsReward · isActive · timestamps · archivedAt? |
| `tenants/{t}/students/{userId}/achievements/{achievementId}` | achievementId   | **StudentAchievement** | userId · achievementId · achievement (denormalized snapshot) · earnedAt · seen                                                                          |
| `tenants/{t}/students/{userId}/level/current`                | fixed `current` | **StudentLevel**       | userId · level · currentXP · xpToNextLevel · totalXP · tier · achievementCount · updatedAt                                                              |
| `tenants/{t}/students/{userId}/studyGoals/{goalId}`          | auto            | **StudyGoal**          | title · description? · targetType · targetCount · currentCount · startDate · endDate · completed · completedAt? · timestamps · archivedAt?              |
| `tenants/{t}/students/{userId}/studySessions/{sessionId}`    | date            | **StudySession**       | date · minutesStudied · spacesWorked[] · itemsCompleted · pointsEarned                                                                                  |

---

## 10. Realtime Database (RTDB)

Declared in `database.rules.json` + written by repos/CF. Used for low-latency
live data (leaderboards, presence, badge counts) that Firestore is too
slow/costly for.

| Node Path                                                                      | Entity                              | Shape                                                                                                                                               |
| ------------------------------------------------------------------------------ | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `practiceProgress/{tenantId}/{userId}`                                         | Live practice progress              | per-user practice state; user-write, teacher/admin-read                                                                                             |
| `leaderboards/{tenantId}/tenant/entries/{userId}`                              | **LeaderboardEntry** (tenant scope) | `{userId,displayName,avatarUrl?,score,overallScore?,examAvg?,spaceCompletion?,totalPoints,streakDays,tier?,countsByTier?,rank,isAtRisk?,updatedAt}` |
| `leaderboards/{tenantId}/class/{classId}/entries/{userId}`                     | LeaderboardEntry (class scope)      | same shape, class-scoped                                                                                                                            |
| `leaderboards/{tenantId}/space/{spaceId}/entries/{userId}`                     | LeaderboardEntry (space scope)      | same shape, space-scoped                                                                                                                            |
| `leaderboards/{tenantId}/storyPoint/{spaceId}/{storyPointId}/entries/{userId}` | LeaderboardEntry (storyPoint scope) | same shape                                                                                                                                          |
| `notifications/{tenantId}/{userId}`                                            | **NotificationBadgeState**          | `{unreadCount, latest?{id,title,type,createdAt(epoch-ms)}}`                                                                                         |

**RTDB security:** leaderboards & notifications are **read-only to clients**
(CF-write only); practiceProgress is writable by the owning user only.

---

## 11. Other (Mirror / Live docs)

Several collections have a `…/live/current` child doc that mirrors hot state for
realtime subscription (seen in transport-firebase subscription sources):

- `…/digitalTestSessions/{sid}/live/current` — session timer/answered count
- `…/spaceProgress/{id}/live/current` — live progress
- `…/submissions/{sid}/live/current` — live grading progress

---

## Appendix A — Collection count summary

- **Platform-root:** 6–7 (`users`, `userMemberships`, `tenants`, `tenantCodes`,
  `globalEvaluationPresets`, `platformActivityLog`, legacy `scanners`)
- **Identity (tenant):** ~11 (students, teachers, parents, staff, scanners,
  classes, academicSessions, notifications, notificationPreferences,
  announcements(+reads), devices, auditLogs)
- **LevelUp:** spaces (+storyPoints +items +answerKeys +reviews), agents,
  rubricPresets, questionBank, chatSessions(+messages)
- **Progress:** spaceProgress(+storyPointProgress), storyPointProgress,
  digitalTestSessions(+submissions)
- **Autograde:** exams(+questions), submissions(+questionSubmissions),
  gradingDeadLetter, examGradingProgress
- **Settings:** evaluationSettings
- **Analytics:** studentProgressSummaries, classProgressSummaries,
  examAnalytics, insights, costSummaries, llmCallLogs, healthSnapshots
- **Gamification:** achievements, students/{}/achievements, students/{}/level,
  students/{}/studyGoals, students/{}/studySessions
- **RTDB:** practiceProgress, leaderboards (4 scopes), notifications

## Appendix B — Apps → tables (read/write surface)

| App                              | Primary collections used                                                                                                                                                                        |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **student-web / mobile-student** | spaces, storyPoints, items, spaceProgress, digitalTestSessions, chatSessions, notifications, gamification (achievements/level/goals), leaderboards (RTDB), submissions (own), exams (published) |
| **teacher-web / mobile-teacher** | classes, students, spaces (author), exams(+questions), submissions(+questionSubmissions) grading, evaluationSettings, rubricPresets, examAnalytics, classProgressSummaries, announcements       |
| **admin-web / mobile-admin**     | tenants(read), students/teachers/parents/staff/scanners roster, classes, academicSessions, userMemberships, llmCallLogs, costSummaries, auditLogs, all analytics                                |
| **parent-web**                   | students (linked), submissions (results_released), spaceProgress (children), studentProgressSummaries, notifications                                                                            |
| **super-admin**                  | tenants (CRUD), tenantCodes, globalEvaluationPresets, platformActivityLog, healthSnapshots, cross-tenant analytics                                                                              |
| **functions (CF)**               | write-side for everything server-gated: userMemberships, tenantCodes, answerKeys, notifications create, llmCallLogs, leaderboards (RTDB), grading pipeline, claims                              |
