# API Redesign: auto-levelup Platform

## Current State Summary

| Module                       | Endpoints | Notes                                         |
| ---------------------------- | --------- | --------------------------------------------- |
| LevelUp (Content & Learning) | 17        | Spaces, items, tests, chat, store             |
| Identity (Users & Tenants)   | 21        | Tenants, classes, students, teachers, parents |
| AutoGrade (Exam Grading)     | 9         | Exams, answer sheets, grading                 |
| Analytics                    | 5         | Summaries, PDF reports                        |
| **Total**                    | **53**    |                                               |

---

## Problems Identified

### 1. Separate create/update for every entity (unnecessary duplication)

Every entity has its own `createX` + `updateX` callable — even though the
request shapes are nearly identical (partial fields with an ID for update). This
doubles the endpoint count for no gain.

**Current (Identity module alone = 13 mutation endpoints):**

```
createTenant, createOrgUser, setTenantApiKey,
createClass, updateClass, deleteClass,
createStudent, updateStudent, deleteStudent,
createTeacher, updateTeacher,
createParent,
createAcademicSession, updateAcademicSession
```

### 2. Assignment/linking endpoints that should be part of update

These are just field updates on an existing entity:

- `assignStudentToClass` → update student's `classId`
- `assignTeacherToClass` → update teacher's `classIds`
- `linkParentToStudent` → update parent's `studentIds`
- `linkExamToSpace` → update exam's `spaceId`
- `switchActiveTenant` → update user's `activeTenantId`
- `updateTeacherPermissions` → update teacher's `permissions`

Six endpoints that are just PATCH operations in disguise.

### 3. Lifecycle/status endpoints that should be a status update

- `publishSpace` → update space `status: 'published'`
- `archiveSpace` → update space `status: 'archived'`
- `publishExam` → update exam `status: 'published'`
- `releaseExamResults` → update exam `status: 'results_released'`
- `publishToStore` → update space `listedInStore: true`

Five endpoints that are just status transitions.

### 4. No consistent pattern across modules

Each module invents its own conventions. LevelUp uses `createSpace/updateSpace`,
AutoGrade uses `createExam/updateExam`, Identity uses `createClass/updateClass`.
The patterns are the same but reimplemented everywhere.

---

## Redesigned API

### Design Principles

1. **One endpoint per resource for mutations** — use `upsert` semantics (create
   if no ID, update if ID provided)
2. **Status transitions via the same update endpoint** — pass `status` field,
   server validates the transition
3. **Assignments are just field updates** — no separate endpoints
4. **Action endpoints only for genuinely distinct operations** (start test,
   submit test, evaluate, grade, etc.)
5. **Keep Firebase Callable** — no need to switch to REST; just reduce the
   function count

---

### Module 1: Identity (21 → 8 endpoints)

| #   | Endpoint              | Replaces                                                                     | Notes                                                   |
| --- | --------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------- |
| 1   | `saveTenant`          | createTenant                                                                 | Upsert. Also handles setTenantApiKey via `apiKey` field |
| 2   | `saveClass`           | createClass, updateClass, deleteClass                                        | Upsert + soft-delete via `status: 'deleted'`            |
| 3   | `saveStudent`         | createStudent, updateStudent, deleteStudent, assignStudentToClass            | Upsert. `classId` is just a field                       |
| 4   | `saveTeacher`         | createTeacher, updateTeacher, assignTeacherToClass, updateTeacherPermissions | Upsert. `classIds` and `permissions` are just fields    |
| 5   | `saveParent`          | createParent, linkParentToStudent                                            | Upsert. `studentIds` is just a field                    |
| 6   | `saveAcademicSession` | createAcademicSession, updateAcademicSession                                 | Upsert                                                  |
| 7   | `bulkImportStudents`  | bulkImportStudents                                                           | Keep — bulk is genuinely different                      |
| 8   | `manageNotifications` | markNotificationRead, getNotifications                                       | Combined read+action. `action: 'list' \| 'markRead'`    |

**Also handled without a separate endpoint:**

- `createOrgUser` → handled inside `saveTenant` when `initialUser` is provided,
  OR just `saveTeacher`/`saveStudent` with role
- `switchActiveTenant` → client writes to their own user doc (no cloud function
  needed), or fold into a `saveUserPreferences` if server validation is required
- `setTenantApiKey` → fold into `saveTenant`

---

### Module 2: LevelUp (17 → 9 endpoints)

| #   | Endpoint            | Replaces                                                             | Notes                                                                                                                              |
| --- | ------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `saveSpace`         | createSpace, updateSpace, publishSpace, archiveSpace, publishToStore | Upsert. Status transitions (`draft→published→archived`) and `listedInStore` are just fields — server validates allowed transitions |
| 2   | `saveStoryPoint`    | createStoryPoint, updateStoryPoint                                   | Upsert                                                                                                                             |
| 3   | `saveItem`          | createItem, updateItem, deleteItem                                   | Upsert + soft-delete via `status: 'deleted'`                                                                                       |
| 4   | `startTestSession`  | startTestSession                                                     | Keep — has side effects (timer, question shuffle)                                                                                  |
| 5   | `submitTestSession` | submitTestSession                                                    | Keep — triggers grading pipeline                                                                                                   |
| 6   | `evaluateAnswer`    | evaluateAnswer                                                       | Keep — AI call with rate limiting                                                                                                  |
| 7   | `recordItemAttempt` | recordItemAttempt                                                    | Keep — progress tracking                                                                                                           |
| 8   | `sendChatMessage`   | sendChatMessage                                                      | Keep — AI call with rate limiting                                                                                                  |
| 9   | `listStoreSpaces`   | listStoreSpaces                                                      | Keep — public query                                                                                                                |

**How status transitions work in `saveSpace`:**

```typescript
// Client sends:
{ spaceId: 'abc', status: 'published' }

// Server validates:
// 1. Current status must be 'draft' to transition to 'published'
// 2. All required fields must be present (storyPoints, items, etc.)
// 3. User must have publish permission
// Then updates the status field
```

**How store listing works:**

```typescript
// Client sends:
{ spaceId: 'abc', listedInStore: true, storePrice: 499 }

// Server validates:
// 1. Space must be 'published'
// 2. Store metadata must be complete
// Then updates store fields
```

---

### Module 3: AutoGrade (9 → 5 endpoints)

| #   | Endpoint             | Replaces                                                                 | Notes                                                                                                 |
| --- | -------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| 1   | `saveExam`           | createExam, updateExam, publishExam, releaseExamResults, linkExamToSpace | Upsert. Status transitions (`draft→published→grading→results_released`) and `spaceId` are just fields |
| 2   | `extractQuestions`   | extractQuestions                                                         | Keep — OCR pipeline                                                                                   |
| 3   | `uploadAnswerSheets` | uploadAnswerSheets                                                       | Keep — file processing pipeline                                                                       |
| 4   | `gradeQuestion`      | manualGradeQuestion, retryFailedQuestions                                | Combined. `mode: 'manual' \| 'retry'`                                                                 |
| 5   | `purchaseSpace`      | purchaseSpace                                                            | Keep — payment transaction                                                                            |

---

### Module 4: Analytics (5 → 3 endpoints)

| #   | Endpoint         | Replaces                                                                 | Notes                                                       |
| --- | ---------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------- |
| 1   | `getSummary`     | getStudentSummary, getClassSummary                                       | Combined. `scope: 'student' \| 'class'` with appropriate ID |
| 2   | `generateReport` | generateExamResultPdf, generateProgressReportPdf, generateClassReportPdf | Combined. `type: 'exam-result' \| 'progress' \| 'class'`    |

_Note: `getSummary` could also just be a Firestore read on the client side if
the summary docs are pre-computed (which they are). In that case, this drops to
just 1 endpoint._

---

## Before vs After

| Module    | Before | After  | Reduction |
| --------- | ------ | ------ | --------- |
| Identity  | 21     | 8      | -62%      |
| LevelUp   | 17     | 9      | -47%      |
| AutoGrade | 9      | 5      | -44%      |
| Analytics | 5      | 3      | -40%      |
| **Total** | **53** | **25** | **-53%**  |

---

## `save*` Endpoint Pattern (Reference Implementation)

Every `save*` endpoint follows the same pattern:

```typescript
interface SaveRequest<T> {
  id?: string; // If present → update. If absent → create.
  tenantId: string; // Always required for tenant-scoped entities
  data: Partial<T>; // Fields to set/update
}

interface SaveResponse {
  id: string; // The created or updated entity ID
  created: boolean; // true if new entity was created
}
```

### Server-side logic:

```typescript
async function saveEntity<T>(req: SaveRequest<T>, config: EntityConfig<T>) {
  // 1. Auth check
  const caller = await authenticate(req);

  // 2. If ID provided → update mode
  if (req.id) {
    const existing = await getDoc(config.collection, req.id);
    if (!existing) throw new NotFoundError();

    // 3. Validate status transitions (if status field changed)
    if (req.data.status && req.data.status !== existing.status) {
      config.validateTransition(existing.status, req.data.status);
    }

    // 4. Validate permissions for this update
    config.authorizeUpdate(caller, existing, req.data);

    // 5. Validate fields
    config.validateUpdate(existing, req.data);

    // 6. Apply update
    await updateDoc(config.collection, req.id, {
      ...req.data,
      updatedAt: serverTimestamp(),
      updatedBy: caller.uid,
    });

    // 7. Run side effects (e.g., publish triggers notifications)
    await config.onAfterSave?.(existing, req.data);

    return { id: req.id, created: false };
  }

  // 8. Create mode
  config.authorizeCreate(caller, req.data);
  config.validateCreate(req.data);

  const id = await createDoc(config.collection, {
    ...config.defaults,
    ...req.data,
    createdAt: serverTimestamp(),
    createdBy: caller.uid,
  });

  await config.onAfterSave?.(null, req.data);

  return { id, created: true };
}
```

### Why this is better:

- **One function to deploy, test, and maintain** per entity instead of 2-4
- **Consistent behavior** — every entity gets audit fields, permission checks,
  validation the same way
- **Status transitions are validated server-side** — client just sends
  `{ status: 'published' }` and the server enforces the state machine
- **Assignments are natural** — `{ studentId: 'x', data: { classId: 'y' } }`
  instead of a separate `assignStudentToClass` endpoint

---

## Migration Strategy

### Phase 1: Add `save*` endpoints alongside existing ones

- Implement new endpoints
- Both old and new endpoints work simultaneously
- Update frontend to use new endpoints one screen at a time

### Phase 2: Deprecate old endpoints

- Add deprecation warnings to old endpoints
- Monitor usage to confirm all clients have migrated

### Phase 3: Remove old endpoints

- Delete old callable functions
- Clean up unused code

---

## Request/Response Examples

### saveSpace — Create

```json
// Request
{
  "tenantId": "tenant_abc",
  "data": {
    "title": "Algebra Basics",
    "type": "learning",
    "subject": "Mathematics",
    "grade": "8"
  }
}

// Response
{ "id": "space_xyz", "created": true }
```

### saveSpace — Update (publish)

```json
// Request
{
  "id": "space_xyz",
  "tenantId": "tenant_abc",
  "data": {
    "status": "published"
  }
}

// Response
{ "id": "space_xyz", "created": false }
```

### saveSpace — Update (list on store)

```json
// Request
{
  "id": "space_xyz",
  "tenantId": "tenant_abc",
  "data": {
    "listedInStore": true,
    "storePrice": 499,
    "storeDescription": "Complete algebra course for grade 8"
  }
}

// Response
{ "id": "space_xyz", "created": false }
```

### saveStudent — Create with class assignment

```json
// Request
{
  "tenantId": "tenant_abc",
  "data": {
    "name": "John Doe",
    "email": "john@school.com",
    "classId": "class_123",
    "rollNumber": "42"
  }
}

// Response
{ "id": "student_xyz", "created": true }
```

### saveStudent — Reassign to different class

```json
// Request
{
  "id": "student_xyz",
  "tenantId": "tenant_abc",
  "data": {
    "classId": "class_456"
  }
}

// Response
{ "id": "student_xyz", "created": false }
```

### saveExam — Create and then publish

```json
// Create
{
  "tenantId": "tenant_abc",
  "data": {
    "title": "Mid-term Mathematics",
    "classId": "class_123",
    "totalMarks": 100,
    "spaceId": "space_xyz"
  }
}

// Publish (later)
{
  "id": "exam_abc",
  "tenantId": "tenant_abc",
  "data": { "status": "published" }
}

// Release results (after grading)
{
  "id": "exam_abc",
  "tenantId": "tenant_abc",
  "data": { "status": "results_released" }
}
```

### getSummary

```json
// Student summary
{
  "tenantId": "tenant_abc",
  "scope": "student",
  "studentId": "student_xyz"
}

// Class summary
{
  "tenantId": "tenant_abc",
  "scope": "class",
  "classId": "class_123"
}
```

### generateReport

```json
{
  "tenantId": "tenant_abc",
  "type": "exam-result",
  "examId": "exam_abc",
  "studentId": "student_xyz"
}
// Response: { "pdfUrl": "https://storage.../report.pdf" }
```

### gradeQuestion

```json
// Manual grade
{
  "tenantId": "tenant_abc",
  "mode": "manual",
  "submissionId": "sub_123",
  "questionId": "q_456",
  "score": 8,
  "feedback": "Good approach but missed edge case"
}

// Retry failed AI grading
{
  "tenantId": "tenant_abc",
  "mode": "retry",
  "examId": "exam_abc",
  "questionIds": ["q_789", "q_012"]
}
```

---

## Status Transition State Machines

### Space Lifecycle

```
draft → published → archived
                  ↘ (listedInStore: true/false — independent toggle, requires published)
```

### Exam Lifecycle

```
draft → published → grading → results_released
```

### Submission Pipeline

```
uploaded → scouting_completed → grading_in_progress → grading_completed → results_released
```

These transitions are enforced server-side. Invalid transitions (e.g.,
`archived → draft`) return a `400` with a clear error message.

---

## Error Response Format (Standardized)

```typescript
interface ErrorResponse {
  error: {
    code: string; // Machine-readable: 'INVALID_TRANSITION', 'NOT_FOUND', 'FORBIDDEN'
    message: string; // Human-readable explanation
    details?: Record<string, any>; // Optional context
  };
}
```

**Examples:**

```json
// Invalid status transition
{
  "error": {
    "code": "INVALID_TRANSITION",
    "message": "Cannot transition space from 'archived' to 'published'",
    "details": {
      "currentStatus": "archived",
      "requestedStatus": "published",
      "allowedTransitions": ["draft"]
    }
  }
}

// Missing required fields for publish
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Space cannot be published without at least one story point",
    "details": {
      "missingRequirements": ["storyPoints", "items"]
    }
  }
}
```
