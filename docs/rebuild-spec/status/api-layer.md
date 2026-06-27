# API Layer — Status Report

**Scope:** The RPC / callable API contract layer of the `auto-levelup` monorepo
— the typed request/response definitions in
`packages/shared-types/src/callable-types.ts`, the Zod validation schemas in
`packages/shared-types/src/schemas/callable-schemas.ts`, the client-side
wrappers in `packages/shared-services`, the React Query consumption layer in
`packages/shared-hooks`, and the Cloud Function `onCall` implementations in
`functions/{identity,levelup,autograde,analytics}/src/callable/`.

---

## 1. What Currently Exists & How It's Architected

The platform uses **Firebase Callable Functions (`onCall`)** as its sole RPC
mechanism — there is no REST/HTTP layer, no GraphQL, no OpenAPI spec. The API is
RPC-style: each backend operation is a named callable that takes a JSON request
and returns a JSON response, invoked client-side via `firebase/functions`
`httpsCallable`.

The layer is organized into five conceptual tiers:

1. **Contract types** — `packages/shared-types/src/callable-types.ts` (621
   lines) defines the `*Request`/`*Response` TypeScript interfaces shared by
   client and server. This is the source of truth for the _shapes_ of the
   consolidated API.
2. **Validation schemas** —
   `packages/shared-types/src/schemas/callable-schemas.ts` (749 lines) holds Zod
   schemas (`SaveSpaceRequestSchema`, `SaveClassRequestSchema`, etc.) used
   server-side to validate inbound request data.
3. **Client wrappers** —
   `packages/shared-services/src/{auth,levelup,autograde,reports}/*-callables.ts`
   wrap each callable in a thin `async function call<Name>(data): Promise<Res>`
   helper using a shared `getCallable<Req,Res>(name)` factory.
4. **React Query hooks** — `packages/shared-hooks/src/queries/*.ts` and
   `use*.ts` wrap callables in `useMutation`/`useQuery` for the web apps.
5. **Backend implementations** — `functions/<module>/src/callable/<name>.ts`,
   each an `onCall({ region: 'asia-south1', cors: true }, ...)` handler that
   authenticates, validates via `parseRequest(...)`, applies business rules, and
   writes to Firestore.

### The "consolidated `save*`" redesign was implemented

`API_REDESIGN.md` proposed collapsing ~53 CRUD/lifecycle endpoints into ~25
using an **upsert `save*` pattern** (no `id` → create, `id` present → update;
status transitions and assignments are field updates, not separate endpoints).
This redesign **is live in the codebase**, not just a plan:

- `saveSpace` (`functions/levelup/src/callable/save-space.ts`) genuinely
  replaces `createSpace`, `updateSpace`, `publishSpace`, `archiveSpace`,
  `publishToStore`. It contains an `ALLOWED_TRANSITIONS` state machine
  (`draft→published`, `published→{archived,draft}`, `archived→draft`),
  `validatePublish()` business rules, and store-listing side effects under
  `tenants/platform_public/spaces/{id}`.
- `saveExam`, `saveStudent`, `saveTeacher`, `saveClass`, `saveParent`,
  `saveStoryPoint`, `saveItem`, etc. follow the same shape:
  `{ id?, tenantId, data: {...partial} }` → `SaveResponse { id, created }`.
- Combined-mode endpoints exist: `gradeQuestion`
  (`mode: 'manual'|'retry'|'ai'`), `getSummary`
  (`scope: 'student'|'class'|'platform'|'health'`), `generateReport`
  (`type: 'exam-result'|'progress'|'class'`), `manageNotifications`
  (`action: 'list'|'markRead'`).

### Registered callables (actual count, by module index)

Counting `onCall` handlers actually exported from each module's `index.ts`:

| Module    | Path                               | Callables (approx)                                                                                                                                                                                                                                                                                                                           |
| --------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| identity  | `functions/identity/src/index.ts`  | ~23 (saveTenant/Class/Student/Teacher/Parent/AcademicSession/Staff, bulkImport{Students,Teachers}, bulkUpdateStatus, rolloverSession, manageNotifications, createOrgUser, switchActiveTenant, joinTenant, deactivate/reactivateTenant, exportTenantData, save/listAnnouncements, searchUsers, saveGlobalEvaluationPreset, uploadTenantAsset) |
| levelup   | `functions/levelup/src/index.ts`   | ~18 (saveSpace, saveStoryPoint, saveItem, getItemForEdit, listVersions, manageNotifications, startTestSession, submitTestSession, evaluateAnswer, recordItemAttempt, saveQuestionBankItem, listQuestionBank, importFromBank, saveRubricPreset, sendChatMessage, saveSpaceReview, listStoreSpaces, purchaseSpace)                             |
| autograde | `functions/autograde/src/index.ts` | 4 (saveExam, gradeQuestion, extractQuestions, uploadAnswerSheets)                                                                                                                                                                                                                                                                            |
| analytics | `functions/analytics/src/index.ts` | 2 (getSummary, generateReport)                                                                                                                                                                                                                                                                                                               |

So the real surface is **~47 callables** (plus triggers/schedulers which are not
part of the public API). The `API_REDESIGN.md` "25 endpoints" target was
partially met for the core CRUD entities but the actual deployed surface grew
with additional features (question bank, reviews, store, bulk ops,
announcements, asset upload, global presets, join-tenant).

### Region & transport

All callables are pinned to `region: 'asia-south1'` (verified across
`functions/*/src/callable/*.ts`). The client matches this in
`packages/shared-services/src/firebase/config.ts:99`
(`getFunctions(app, 'asia-south1')`) with an emulator hook
(`connectFunctionsEmulator(functions, '127.0.0.1', 5001)`). CORS is enabled on
every callable (`cors: true`).

### Server-side request pipeline (representative)

`functions/levelup/src/callable/save-space.ts` shows the canonical handler flow:

1. `assertAuth(request.auth)` → caller uid
2. `parseRequest(request.data, SaveSpaceRequestSchema)` → Zod-validated
   `{ id, tenantId, data }`
3. `assertTeacherOrAdmin(callerUid, tenantId)` → role check
4. `enforceRateLimit(tenantId, callerUid, 'write', 30)` → per-tenant/user rate
   limit
5. branch on `isCreate = !id`, apply transition/field validation, write
   Firestore, fire side effects (notifications, content version) as
   fire-and-forget.

`parseRequest` (`functions/shared/src/parse-request.ts`) converts Zod
`safeParse` failures into `HttpsError('invalid-argument', ...)` with a
structured `validationErrors` detail array.

### Error handling contract

Client-side `packages/shared-hooks/src/use-api-error.ts` maps Firebase callable
error codes (`functions/<code>`) to an internal `AppErrorCode` via
`HTTPS_TO_APP_ERROR` + `ERROR_MESSAGES` + `ERROR_RECOVERY_HINTS` (all from
`shared-types`), surfacing them through Sonner toasts. `API_REDESIGN.md` §"Error
Response Format" specifies a richer `{ error: { code, message, details } }`
shape with machine-readable codes (`INVALID_TRANSITION`, `VALIDATION_ERROR`),
but the actual implementation uses Firebase's native `HttpsError` codes
(`failed-precondition`, `invalid-argument`) — the documented richer envelope is
aspirational, not fully realized.

---

## 2. Entities / Schemas / Collections / APIs / Routes

### Contract types (`packages/shared-types/src/callable-types.ts`)

- Generic: `SaveResponse { id, created }`
- Identity: `SaveTenantRequest`, `SaveClassRequest`, `SaveStudentRequest`,
  `SaveTeacherRequest`, `SaveParentRequest`, `SaveAcademicSessionRequest`,
  `SaveStaffRequest`, `ManageNotificationsRequest/Response`,
  `DeactivateTenantRequest`, `ReactivateTenantRequest`,
  `ExportTenantDataRequest/Response`, `BulkImportTeachersRequest/Response`,
  `BulkUpdateStatusRequest/Response`, `RolloverSessionRequest/Response`,
  `SearchUsersRequest/Response`, `UploadTenantAssetRequest/Response`
- LevelUp: `SaveSpaceRequest`, `SaveStoryPointRequest`, `SaveItemRequest`
- AutoGrade: `SaveExamRequest`, `GradeQuestionRequest/Response`
- Analytics: `GetSummaryRequest/Response` (+ `PlatformSummaryResponse`,
  `HealthSummaryResponse`), `GenerateReportRequest/Response`
- Announcements: `SaveAnnouncementRequest/Response`,
  `ListAnnouncementsRequest/Response`

### Validation schemas (`packages/shared-types/src/schemas/`)

- `callable-schemas.ts` (749 lines) — Zod schemas with shared validation
  constants (`MAX_SHORT_TEXT=200`, `MAX_MEDIUM_TEXT=2000`,
  `MAX_LONG_TEXT=10000`, `MAX_ARRAY_ITEMS=100`, `MAX_BULK_ITEMS=500`,
  `firestoreId` pattern) and reusable fragments (`UnifiedRubricSchema`,
  `RubricCriterionSchema`, `EvaluationDimensionSchema`, `ItemMetadataSchema`).
- `announcement.schema.ts`, `index.ts`.

### Client wrappers (`packages/shared-services/src/`)

- `auth/auth-callables.ts` — all identity callables + some cross-module
  (`callSaveSpace`, `callSaveStoryPoint`, `callSaveItem` are oddly re-exported
  through the auth module). Defines local request types not in `shared-types`
  (`CreateOrgUserRequest/Response`, `StudentImportRow`,
  `BulkImportStudentsRequest/Response`, `SaveGlobalPresetRequest/Response`,
  `JoinTenantRequest/Response`, `SwitchActiveTenantResponse`).
- `levelup/{assessment,content,chat,store}-callables.ts` —
  `callStartTestSession`, `callSubmitTestSession`, `callEvaluateAnswer`,
  `callRecordItemAttempt`, `callSaveQuestionBankItem`, `callListQuestionBank`,
  `callImportFromBank`, `callSaveRubricPreset`, `callSaveSpaceReview`,
  `callListVersions`, `callGetItemForEdit`, `callSendChatMessage`,
  `callListStoreSpaces`, `callPurchaseSpace`. Several request/response types
  (`StartTestSessionRequest`, `EvaluateAnswerRequest`,
  `SaveQuestionBankItemRequest`, `SendChatMessageRequest`,
  `ListStoreSpacesRequest`, etc.) are defined **inline in the service package**,
  not in `shared-types`.
- `autograde/exam-callables.ts` — `callSaveExam`, `callGradeQuestion`,
  `callUploadAnswerSheets`, `callExtractQuestions` (the latter two with
  locally-defined types).
- `reports/pdf-callables.ts` — `callGetSummary`, `callGenerateReport`,
  `callGetPlatformSummary`.
- Shared factory: `getCallable<Req,Res>(name)` is **duplicated in every
  callables file** (identical `httpsCallable(functions, name)` implementation).

### React Query layer (`packages/shared-hooks/src/`)

~34 hook files (`useSpaceMutations.ts`, `useItemMutations.ts`,
`useExamMutations.ts`, `useClasses.ts`, `useTeachers.ts`, `useStudents.ts`,
`useTenant.ts`, `useSubmissions.ts`, etc.). Consumed by 26+ files across
`apps/*/src`.

### Backend handlers (`functions/<module>/src/callable/<name>.ts`)

One file per callable. Shared utils per module: `utils/parse-request.ts`
(re-exports `@levelup/functions-shared` `parseRequest`), `utils/auth.ts`
(`assertAuth`, `assertTeacherOrAdmin`), `utils/rate-limit.ts`
(`enforceRateLimit`). `functions/shared/src/{parse-request,rate-limit}.ts` is
the cross-module shared lib.

### Collections touched (path-based tenant isolation)

`tenants/{tenantId}/spaces/{id}`, `.../spaces/{id}/storyPoints/{id}`,
`.../spaces/{id}/items/{id}`, `.../digitalTestSessions/{id}`, `.../students`,
`.../classes`, `.../teachers`, `.../parents`,
`tenants/platform_public/spaces/{id}` (store mirror). Tenant counters
denormalized on `tenants/{tenantId}` (`stats.totalSpaces`,
`usage.currentSpaces`).

---

## 3. Strengths Worth Keeping

1. **The `save*` upsert pattern is the right idea and is genuinely
   implemented.** Collapsing create/update/publish/archive/assign into one
   endpoint per entity (driven server-side by `id` presence + a `status` state
   machine) dramatically reduces the function count and centralizes
   audit/permission/validation logic. `saveSpace`'s `ALLOWED_TRANSITIONS` +
   `validatePublish` is a good model.
2. **Shared, validated contracts.** `callable-types.ts` and
   `callable-schemas.ts` give client and server a single typed source of truth,
   and Zod validation at the boundary (`parseRequest`) produces structured
   `validationErrors`.
3. **Consistent server pipeline.** Auth → validate → authorize → rate-limit →
   mutate → fire side effects is uniform across handlers and easy to reason
   about.
4. **Path-based tenant isolation** baked into every callable
   (`tenants/{tenantId}/...`), reinforced by `tenantId` being a required field
   on nearly every request.
5. **Combined-mode endpoints** (`gradeQuestion`, `getSummary`, `generateReport`,
   `manageNotifications`) sensibly group related operations behind a
   discriminator field.
6. **Region pinning is consistent** (`asia-south1` on both client config and
   every callable) — no region-mismatch bugs.
7. **Error-code translation layer** (`HTTPS_TO_APP_ERROR`, `ERROR_MESSAGES`,
   `ERROR_RECOVERY_HINTS`) gives a clean seam for localized, user-friendly error
   messaging.

---

## 4. Pain Points / Tech Debt / Inconsistencies

1. **Contract types are scattered across two packages.** Some request/response
   types live in `shared-types/src/callable-types.ts` (the "official"
   contracts), but many others are defined **inline in `shared-services`**
   (`CreateOrgUserRequest`, `BulkImportStudentsRequest`,
   `StartTestSessionRequest`, `EvaluateAnswerRequest`,
   `SaveQuestionBankItemRequest`, `SendChatMessageRequest`,
   `ListStoreSpacesRequest`, `ExtractQuestionsRequest`,
   `SaveGlobalPresetRequest`, `JoinTenantRequest`, etc.). There is no single
   registry of "what callables exist and their I/O." This makes a React-Native
   client harder to build because the contract isn't fully centralized.

2. **Zod validation is partial.** `callable-schemas.ts` only covers the core
   `save*` entities. Two callables have **no `parseRequest` / Zod validation at
   all** (`functions/levelup/src/callable/create-item.ts`,
   `functions/levelup/src/callable/list-versions.ts`), and many feature
   callables (question bank, store, chat, bulk ops) validate ad-hoc inside the
   handler. Response types are never validated.

3. **Two competing consumption styles for the same callables.**
   `shared-services` exposes typed `call*()` wrappers, but `shared-hooks` (e.g.
   `useSpaceMutations.ts`) **bypasses them and calls
   `httpsCallable(functions, 'saveSpace')` directly**, re-importing
   `getFirebaseServices` and re-declaring the callable name string. The same
   `getCallable<Req,Res>(name)` factory is also copy-pasted into every
   `*-callables.ts` file. Endpoint names are stringly-typed in 3+ places
   (wrapper, hook, backend export), with no shared name enum.

4. **`API_REDESIGN.md` drift.** The doc's stated "53 → 25" reduction does not
   match reality (~47 deployed callables). New features (announcements, store,
   reviews, question bank, asset upload, global presets, search, bulk teacher
   import, rollover, staff) were added without folding into the documented
   model. The doc also references fields that diverge from the live schema
   (e.g., doc uses `classId`/`spaceId`/`listedInStore`/`storePrice`; the
   implemented `SaveSpaceRequest` uses
   `classIds`/`linkedSpaceId`/`publishedToStore`/`price`).

5. **The standardized error envelope is aspirational.** `API_REDESIGN.md`
   specifies `{ error: { code: 'INVALID_TRANSITION', message, details } }`, but
   handlers throw raw `HttpsError('failed-precondition', ...)` /
   `HttpsError('invalid-argument', ...)`. Clients parse Firebase-native codes,
   not the documented machine codes — so the contract on the wire is
   inconsistent with the docs.

6. **Cross-module leakage in the service layer.**
   `packages/shared-services/src/auth/auth-callables.ts` exports
   `callSaveSpace`, `callSaveStoryPoint`, `callSaveItem` (LevelUp concerns) from
   the **auth** module — a layering smell. Module boundaries in
   `shared-services` don't match the function-module boundaries.

7. **No pagination / list contract consistency.** List endpoints use
   inconsistent cursor conventions: `manageNotifications` uses
   `cursor`/`nextCursor`; `listQuestionBank`/`listStoreSpaces`/`listVersions`
   use `startAfter`/`lastId`/`hasMore`; `listAnnouncements` uses
   `cursor`/`nextCursor`. Three different pagination shapes.

8. **`tenantId` passed in the request body instead of being derived from the
   caller's claims.** Every request carries `tenantId` as a client-supplied
   field; the server re-validates membership, but this is redundant and
   error-prone (the active tenant is already known from custom claims). It also
   bloats every request shape.

9. **No API versioning.** Callable names are unversioned; there is no `v1`/`v2`
   namespacing, so the documented "Phase 1: add `save*` alongside old" migration
   leaves no room for future breaking changes without renaming functions.

10. **Side effects are fire-and-forget with `.catch(log)`** (e.g. notifications,
    content versioning in `save-space.ts`). No outbox/retry — a dropped
    notification or missing content-version is silently logged. The architecture
    review (`docs/REVIEW-UNIFIED-ARCHITECTURE-BLUEPRINT.md` A5/A7) already
    flagged the lack of a retry/dead-letter strategy.

11. **Response types are loosely typed.** Several responses use
    `unknown`/`Record<string, unknown>`
    (`PlatformSummaryResponse.recentActivity[].metadata`,
    `ListQuestionBankResponse.items`, `ExtractQuestionsResponse.questions`),
    defeating end-to-end type safety.

---

## 5. Recommendations for a Fresh Rebuild (keep core concepts, improve design, support a common API layer + React Native)

### Keep

- The **`save*` upsert + server-validated status-transition** model. It is
  sound; carry it forward as the default mutation pattern.
- **Path-based tenant isolation** and the
  auth→validate→authorize→rate-limit→mutate→side-effect pipeline.
- **Zod at the boundary** and the **error-code translation** seam.

### Rebuild improvements

1. **Single API contract package, codegen-friendly.** Consolidate ALL
   request/response types AND their Zod schemas into one package (e.g.
   `packages/api-contract`), one file per callable colocating the Zod schema and
   the inferred TS type
   (`type SaveSpaceRequest = z.infer<typeof SaveSpaceRequestSchema>`). Eliminate
   inline types in `shared-services`. This package becomes the shared dependency
   for web, React Native, Cloud Functions, and seed/test tooling.

2. **Generate a typed callable registry.** Define a single `CALLABLES` map (name
   → `{ requestSchema, responseSchema }`) and a generic
   `createCallableClient(registry)` that produces fully-typed, platform-agnostic
   methods. Web and RN import the same client; the only platform difference is
   the injected Firebase `Functions` instance. This removes the duplicated
   `getCallable` factory and the stringly-typed names in `shared-hooks`.

3. **One consumption path, not two.** Either delete the `call*` wrappers in
   favor of hooks, or (better) make the hooks call the typed client. Move
   React-Query hooks into a platform-neutral `packages/shared-hooks` that
   depends only on `@tanstack/react-query` (works in RN) and the generated
   client — never `httpsCallable` directly. Standardize query-key factories so
   cache invalidation is consistent.

4. **Validate responses too, in dev.** Run the response schema through
   `safeParse` behind a dev flag so contract drift between server and client is
   caught early — critical when two client platforms consume the same API.

5. **Derive `tenantId` from claims; stop passing it in the body.** Read active
   tenant from the auth context server-side; only accept an explicit tenant
   override for super-admin cross-tenant operations. Shrinks every request shape
   and removes a class of "wrong tenant" bugs.

6. **Standardize pagination** into one shape across every list endpoint:
   `{ cursor?, limit? } → { items, nextCursor }`. Encode it as a reusable Zod
   fragment in the contract package.

7. **Standardize the error envelope on the wire.** Wrap `HttpsError` so
   `details` always carries `{ code: AppErrorCode, ... }`, matching the
   documented `INVALID_TRANSITION`/`VALIDATION_ERROR` codes. Make
   `use-api-error` read the structured code first, fall back to the Firebase
   code. Move state machines (`ALLOWED_TRANSITIONS`) into the shared contract
   package so both client and server agree on valid transitions and the client
   can pre-validate.

8. **Introduce explicit versioning.** Namespace the callable registry (e.g.
   `apiVersion: 1`) or prefix function names, so future breaking changes don't
   require renaming and the documented dual-run migration is actually possible.

9. **Make side effects reliable.** Replace fire-and-forget `.catch(log)`
   notification/content-version writes with Firestore triggers or a
   transactional outbox so they retry and aren't silently dropped (addresses
   blueprint review A5).

10. **Reconcile or retire `API_REDESIGN.md`.** Regenerate the endpoint inventory
    from the contract package (single source of truth) so docs can't drift. Fold
    the post-redesign features (store, reviews, question bank, announcements,
    bulk ops, asset upload, presets, search) into the documented module
    taxonomy.

11. **Tighten response types.** Replace `unknown`/`Record<string, unknown>`
    payloads with concrete schemas (notably analytics summaries, question-bank
    items, extracted questions).

12. **Keep Firebase Callable as transport, but abstract it.** A thin transport
    interface in the generated client (`invoke(name, data)`) lets RN reuse the
    same contract while leaving room to swap to HTTPS/REST later if a
    non-Firebase client (e.g. the planned scanner-app device) needs it. This
    directly supports the "common API layer shared by web + future React Native"
    goal without a rewrite.
