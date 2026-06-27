# V2: API Redesign & Consolidation — Test Report

## Build Verification

| Module                       | Build Status | Notes                                                |
| ---------------------------- | ------------ | ---------------------------------------------------- |
| @levelup/shared-types        | PASS         | All Zod callable schemas compile, DTS emitted (77KB) |
| @levelup/functions-identity  | PASS         | 12 callables with Zod validation                     |
| @levelup/functions-levelup   | PASS         | 11 callables with Zod validation                     |
| @levelup/functions-autograde | PASS         | 4 callables with Zod validation                      |
| @levelup/functions-analytics | PASS         | 2 callables with Zod validation                      |
| @levelup/shared-services     | PASS         | Legacy wrappers removed, new exports clean           |
| admin-web                    | PASS         | Uses callGenerateReport, callCreateOrgUser           |
| teacher-web                  | PASS         | Uses callSaveExam, callGenerateReport                |
| parent-web                   | PASS         | Uses callGenerateReport                              |

## Lint Verification

| Module      | Status                       | Notes                                                                                                            |
| ----------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| admin-web   | PASS (1 warning)             | Pre-existing: useEffect missing dependency in AppLayout                                                          |
| teacher-web | FAIL (5 pre-existing errors) | Pre-existing unused imports in DashboardPage, SpaceAnalyticsPage, SpaceListPage — NOT in modified ExamDetailPage |
| parent-web  | PASS                         | Clean                                                                                                            |
| shared-ui   | FAIL (1 pre-existing error)  | Pre-existing unused VariantProps import in status-badge.tsx                                                      |

All lint issues are **pre-existing** — none introduced by V2 changes.

## Acceptance Criteria

| Criterion                                           | Status                                                                                                                                                                                                                                |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Every callable validates input via Zod schema parse | PASS — 29 callables + parseRequest utility                                                                                                                                                                                            |
| No frontend code imports legacy wrapper functions   | PASS — callPublishExam, callReleaseExamResults, callLinkExamToSpace, callGenerateExamResultPdf, callGenerateClassReportPdf removed from all frontend imports                                                                          |
| No dead/unused callable wrappers in shared-services | PASS — callCreateTenant, callUpdateTeacherPermissions, callUpdateExam, callPublishExam, callReleaseExamResults, callLinkExamToSpace, callGenerateExamResultPdf, callGenerateProgressReportPdf, callGenerateClassReportPdf all removed |
| `pnpm build` passes cleanly                         | PASS — all modules build                                                                                                                                                                                                              |
| Stale `.d.ts` files removed from lib/               | PASS — 39 stale files deleted                                                                                                                                                                                                         |

## Endpoint Summary

### Final Callable Count: 30

| Module    | Count | Endpoints                                                                                                                                                                                                |
| --------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity  | 12    | saveTenant, saveClass, saveStudent, saveTeacher, saveParent, saveAcademicSession, manageNotifications, bulkImportStudents, saveGlobalEvaluationPreset, createOrgUser, switchActiveTenant, joinTenant     |
| LevelUp   | 12    | saveSpace, saveStoryPoint, saveItem, startTestSession, submitTestSession, evaluateAnswer, recordItemAttempt, sendChatMessage, listStoreSpaces, purchaseSpace, manageNotifications, create-item (utility) |
| AutoGrade | 4     | saveExam, gradeQuestion, extractQuestions, uploadAnswerSheets                                                                                                                                            |
| Analytics | 2     | getSummary, generateReport                                                                                                                                                                               |

### Zod Validation Coverage: 100%

Every callable endpoint now validates its request data at entry with a Zod
schema via the `parseRequest` utility. Invalid requests receive a structured
`HttpsError('invalid-argument')` with field-level error details.
