# Backend ↔ Mobile Compatibility

> Shared platform for **web + iOS/Android**. Mobile apps (`apps/mobile-student|teacher|admin`) already use the same Firebase Auth + callable stack as web. Prefer hardening this path over a Railway rewrite.

**Branch / fixes:** `fix/mobile-handover`  
**Date:** 2026-07-12  
**Client entrypoints:** [`CLIENT-API-ENTRYPOINTS.md`](./CLIENT-API-ENTRYPOINTS.md) (`api-contract` + `sdk-v1`)

---

## 1. Architecture recommendation (keep Firebase)

```
Firebase Auth (custom claims: role, tenantId, …)
        ↓ ID token auto-forwarded
createFirebaseTransport  [@levelup/transport-firebase]
        ↓ httpsCallable(v1-<module>-<op>) + RTDB/Firestore subscribe
createApiClient          [@levelup/api-client]
        ↓ Zod · __apiVersion · __idempotencyKey · retry · ApiError
createRepositories       [@levelup/repositories]
        ↓
@levelup/query hooks     (web + Expo RN)
```

| Layer | Role | Mobile? |
|-------|------|---------|
| Firebase Auth + custom claims | Identity / tenant authority | **Required** — RN `initializeAuth` + AsyncStorage |
| Callable Functions (`v1.*`) | All business reads/writes | **Live path** |
| RTDB / Firestore subscriptions | Chat, grading progress, deadlines | Via `transport.subscribe` |
| Signed PUT (`requestUploadUrl`) | Images / answer sheets | `fetch` PUT — RN-safe |
| `@levelup/transport-http` | Future REST/SSE façade | **Stub only** — do not use yet |
| Railway HTTP API | Documented later migration | **Not wired** — multi-week+ |

**Verdict:** Keep the Firebase Auth + Firestore/callable layer as the single platform. A Railway move is premature for a 2-hour window and does not unblock mobile — mobile already needs Firebase Auth tokens and the same claim-derived tenant model.

### Wire conventions (stable for all clients)

- **Contract name:** dotted `v1.<module>.<op>` (`packages/api-contract` registry)
- **Deployed Firebase id:** dashed `v1-<module>-<op>` (`toDeployedCallableId`)
- **Envelope:** `__apiVersion` + optional `__idempotencyKey` (stamped by api-client; server strips)
- **Auth:** no `tenantId` in bodies — server reads claims
- **Errors:** `fail()` → `HttpsError.details: ApiErrorDetails` → client `normalizeError()` → `ApiError`

---

## 2. Compatibility matrix — callables mobile uses vs web

Mobile never calls `api.*` namespaces directly. Screens use `@levelup/query` hooks → repositories → api-client → callables. Web apps use the same stack.

### Legend

| Status | Meaning |
|--------|---------|
| ✅ Live | Wired + expected on prod student slice |
| 🟡 Soft-miss | Hook wired; GATE-B may return NOT_FOUND → empty UI |
| 🔶 Composite | Multiple callables / optional folds |
| 📡 Sub | RTDB/Firestore subscription (not a callable) |

### Student (`apps/mobile-student`) — ~35 callables + 3 subs

| Surface | Callable / sub | Status |
|---------|----------------|--------|
| Spaces / story points / items | `listSpaces`, `getSpace`, `listStoryPoints`, `listItems`, `getSpaceProgress`, `getStoryPointProgress` | ✅ |
| Practice / tests | `recordItemAttempt`, `listTestSessions`, `getTestSession`, `startTestSession`, `submitTestSession`, `evaluateAnswer` | ✅ |
| Test deadline | `v1.levelup.testSessionDeadline` | 📡 |
| Gamification | `getStudentLevel`, `getGamificationSummary`, `listAchievements`, `listStudentAchievements`, `markAchievementsSeen`, `getLeaderboard` | ✅ |
| Leaderboard live | `v1.levelup.leaderboardLive` | 📡 |
| Study goals | `listStudyGoals`, `saveStudyGoal` | ✅ |
| Store | `listStoreSpaces`, `getStoreSpace`, `listSpaceReviews`, `purchaseSpace` | ✅ |
| Chat | `listChatSessions`, `getChatSession`, `sendChatMessage` + `chatStream` | ✅ + 📡 |
| Profile / notifs | `saveStudent`, `listNotifications`, `markNotificationRead`, prefs | ✅ |
| Analytics summary | `getChildSummary` | ✅ |
| Exams (light) | `getExam`, `listSubmissions` | 🟡 |
| Upload | `requestUploadUrl` + signed PUT | ✅ |
| Auth | `api.auth.*` (transport seam, not callable) | ✅ |

### Teacher (`apps/mobile-teacher`) — ~30 callables + 2 subs

| Surface | Callable / sub | Status |
|---------|----------------|--------|
| Me / tenant | `getMe`, `switchActiveTenant`, `joinTenant` | 🟡 GATE-B |
| Classes / students | `listClasses`, `getClass`, `listStudents`, `getStudent` | 🟡 |
| Content / assign | `listSpaces`, `getSpaceProgress`, `assignContent` | 🟡 / ✅ spaces |
| Insights | `listLearningInsights`, `dismissInsight` (`v1.levelup.*`) | 🟡 |
| Class summary | `getSummary` `{scope:'class'}` | 🟡 |
| Announcements / notifs | `listAnnouncements`, `saveAnnouncement`, notification mark-read | 🟡 |
| Autograde | `listExams`, `getExam`, `getExamAnalytics`, `gradeQuestion`, `releaseResults` | 🟡 |
| Grading overview / review | Composite: optional folds → fallback 3-call batches | 🔶 |
| Grading live | `gradingStatus`, `examGrading` | 📡 |

### Admin (`apps/mobile-admin`) — ~40 callables

| Surface | Callable | Status |
|---------|----------|--------|
| Tenant / export | `getTenant`, `saveTenant`, `exportTenantData` | 🟡 GATE-B |
| Rosters | `list/get/save` students, teachers, parents, staff, classes | 🟡 |
| Sessions | `listAcademicSessions`, `saveAcademicSession`, `rolloverSession` | 🟡 |
| Org ops | `searchUsers`, `createOrgUser`, bulk imports | 🟡 |
| Comms | announcements + notification center composite | 🟡 / 🔶 |
| Analytics | `getSummary`, `getPerformanceTrends`, `getCostSummary`, `listLinkedChildren` | 🟡 |
| Content / exams | `listSpaces`, `listStoreSpaces`, `listExams` + grading composite | 🟡 |

### Web apps (same contract)

Web (`student-web`, `teacher-web`, `admin-web`, `parent-web`) uses the **full** registry (~130 callables) via the same packages. Mobile is a **subset** of that registry, not a different API.

Coverage test: `functions/sdk-v1/src/__tests__/callable-coverage.test.ts` — every `CALLABLES` entry must export from sdk-v1.

---

## 3. What blocks mobile parity today

| Blocker | Severity | Notes |
|---------|----------|-------|
| **GATE-B deploy gap** | High (teacher/admin) | Prod historically served student/content slice; identity/autograde/analytics roster callables soft-miss to empty. Screens already defensive (`query-status.ts`). |
| **Repo ↔ contract drift** | High (landmines) | Repos called non-existent `publishSpace` / `getClassSummary` / `getItem` — **fixed on this branch**. |
| **`validateResponses: true` on mobile** | Medium | Strict Zod on every response; legacy shapes → runtime failure even if callable is LIVE. |
| **Dual `useDismissInsight`** | Low | `v1.levelup.dismissInsight` vs `v1.analytics.dismissInsight` both in registry; teacher uses levelup path — both must stay deployed. |
| **No push token wiring** | Medium (product) | `registerDeviceToken` / `unregisterDeviceToken` in contract; no mobile screen hooks yet. |
| **Railway / transport-http** | N/A for parity | Stub; implementing it does not fix GATE-B or contract drift. |

---

## 4. Fixes shipped (`fix/mobile-handover`)

| Fix | File(s) | Why |
|-----|---------|-----|
| `spaceRepo.publish/archive` → `saveSpace` + `status` | `packages/repositories/.../space.ts` | Contract: saveSpace is the lifecycle verb |
| `itemRepo.get` → paginated `listItems` + NOT_FOUND | `packages/repositories/.../item.ts` | No `getItem` callable |
| `studentSummaryRepo` → `getChildSummary` / `getSummary{class}` | `packages/repositories/.../student-summary.ts` | Removed dead `getStudentSummaries` / `getClassSummary` |
| `spaceDetailView` unwrap `{ space }` / `{ progress }` | `packages/repositories/.../space-detail-view.ts` | Contract envelopes vs composite shape |
| `storeRepo.getStoreSpace` unwrap `{ listing }` | `packages/repositories/.../store.ts` | Store detail / checkout |
| Teacher `getClass` claim-scoped like `listClasses` | `packages/services/.../reads.ts` + `list-classes-scope.test.ts` | Stop foreign-class 403 / roster leak |
| Membership permission-denied → empty | `packages/shared-services/.../membership-service.ts` | Missing membership doc ≠ hard fail |
| School login membership resolve + v1 switch tenant | `auth-store.ts`, `auth-callables.ts` | `targetTenantId` + real membership tenant |
| Tests + authority list | `get-save-shape`, `view-repo-assembly`, `authority-flag-coverage` | Align with contract |

---

## 5. Two-hour checklist vs multi-day work

### Do in ~2 hours (this PR class)

- [x] Map mobile hooks → callables (matrix above)
- [x] Fix repo methods that invoke callables **not** in `CALLABLES`
- [x] Document Firebase-first recommendation (this file)
- [x] Typecheck `@levelup/repositories`, `@levelup/api-contract`, transport packages
- [x] Run `packages/repositories` vitest for get-save-shape / related
- [ ] Spot-check mobile smoke scripts still assume envelope without `transport-compat`

### Multi-day / do not cram into 2h

| Work | Why multi-day |
|------|----------------|
| Deploy full GATE-B identity/autograde/analytics slice to prod | Deploy + response canonicalization + soft-miss removal |
| Batch `getStudentSummaries` callable | New contract + service + fan-in in repo-admin |
| Composite grading folds as first-class callables | Server aggregates + cache invalidation |
| Push notifications (FCM + registerDeviceToken) | App permissions, token lifecycle, OS differences |
| Implement `transport-http` + Railway façade | Auth bridge, SSE/WS for subs, ops, dual-run |
| Remove dual dismissInsight namespaces | Product decision + migration |
| Parent mobile app | New app; parent web already uses analytics callables |

---

## 6. Auth path (mobile-friendly)

1. Sign in via Firebase Auth (`api.auth.signIn` → RN Auth SDK).
2. Custom claims (`role`, `tenantId`, …) minted server-side (identity triggers / seed).
3. Every callable receives the ID token automatically; **do not** put `tenantId` in request bodies.
4. Tenant switch: `switchActiveTenant` → refresh token (`createRefreshToken` / path context) so subsequent callables see new claims.
5. Soft-miss: pre-auth `UNAUTHENTICATED` and GATE-B `NOT_FOUND` → empty UI, not crash.

This is the same authority model as web. Mobile does **not** need a separate JWT/Railway auth story for v1.

---

## 7. Key paths

| Purpose | Path |
|---------|------|
| Callable registry | `packages/api-contract/src/registry.ts` |
| Public barrel | `packages/api-contract/src/index.ts` |
| Error vocabulary | `packages/api-contract/src/errors.ts` |
| Client entrypoints doc | `docs/qa/CLIENT-API-ENTRYPOINTS.md` |
| Firebase invoke + id map | `packages/transport-firebase/src/invoke/invoke-via-callable.ts` |
| API client | `packages/api-client/src/create-client.ts` |
| Repositories | `packages/repositories/src/` |
| Query hooks | `packages/query/src/` |
| sdk-v1 entrypoint | `functions/sdk-v1/src/index.ts` (`export const v1`) |
| Mobile composition | `apps/mobile-*/src/sdk/api.ts` |
| Soft-miss policy | `apps/mobile-*/src/lib/query-status.ts` |
| HTTP stub (future) | `packages/transport-http/` |

---

## 8. Bottom line

- **One backend for web + mobile:** Firebase Auth + v1 callables via `@levelup/transport-firebase`.
- **Student mobile** is closest to parity; **teacher/admin** are contract-ready but deploy-gated (GATE-B).
- **Do not** spend the 2-hour window on Railway — harden contracts/repos and deploy the missing callable slice instead.
