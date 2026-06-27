# Identity Domain — Full Vertical-Slice SDK + Server Plan

> **Domain key:** `identity` **Bounded context / codebase:** `identity-fn`
> (`functions/identity`) **Owns (authoritative):** users, tenants, tenant-codes,
> memberships, **custom claims**, role entity docs (student / teacher / parent /
> staff / scanner), classes, academic sessions, tenant lifecycle, bulk import,
> data export, announcements, notifications. **Sources reconciled:**
> `status/be-identity.md`, `status/auth-access.md`,
> `specs/SDK-SERVER-DESIGN.md`, `specs/common-api.md`,
> `status/REVIEW-domain-data-model.md`, live
> `packages/shared-types/src/{identity,tenant,notification}`, live
> `functions/identity/src/callable`.
>
> **Principle applied:** LEAN UI + LEAN-AUTHORITATIVE SERVER + FAT SDK. Identity
> is the **most authority-heavy domain** — claims, memberships, tenant
> resolution, and lifecycle are all server-only (⚷). The SDK reads projections
> and _requests_ changes; it never mints claims, writes memberships, or supplies
> `tenantId`.

---

## Domain entities (`@levelup/domain`)

All entities are **Zod-first** (`z.object({...}).strict()`), with the TS type
derived via `z.infer`. All persisted IDs are **branded**. All timestamps are the
domain `Timestamp` = **ISO-8601 string** (replacing the live
`FirestoreTimestamp {seconds,nanoseconds}` / epoch / ISO trichotomy — REVIEW
D4). Shared primitives consumed from `@levelup/domain/primitives`: `Timestamp`,
`AuditFields` (`createdAt`, `updatedAt`, `createdBy?`, `updatedBy?`), `Page<T>`.

### Branded IDs (this domain)

`UserId` (= Firebase Auth UID), `TenantId`, `TenantCode` (the
`/tenantCodes/{CODE}` doc id), `MembershipId` (`{uid}_{tenantId}`), `StudentId`,
`TeacherId`, `ParentId`, `StaffId` _(NEW — REVIEW §4)_, `ScannerId` _(NEW)_,
`ClassId`, `AcademicSessionId`, `AnnouncementId`, `NotificationId`. Brand
factories `asUserId(...)` etc. live in `@levelup/domain/branded`.

### Enums (exported `as const` unions)

- `TenantRole` =
  `superAdmin | tenantAdmin | teacher | student | parent | scanner | staff`.
- `TenantStatus` = `active | suspended | trial | expired | deactivated`.
- `TenantPlan` = `free | trial | basic | premium | enterprise`.
- `MembershipStatus` = `active | inactive | suspended`.
- `JoinSource` =
  `admin_created | bulk_import | invite_code | self_register | migration | tenant_code`.
- `UserStatus` = `active | suspended | deleted`.
- `EntityStatus` = `active | archived`
  (student/teacher/parent/staff/scanner/class/session).
- `AuthProvider` = `email | phone | google | apple`.
- `ConsumerPlan` = `free | pro | premium`.
- `AnnouncementScope` = `platform | tenant`; `AnnouncementStatus` =
  `draft | published | archived`.
- `NotificationType` (11 values: `exam_results_released … system_announcement`),
  `NotificationEntityType`, `NotificationRecipientRole`.
- `TeacherPermissionKey` (8 boolean keys) and `StaffPermissionKey` (6 boolean
  keys) — **exported key unions** so rules-gen + TS + claims share ONE key list
  (auth-access rec #2; REVIEW §1). Replaces stringly-typed
  `Record<string,boolean>`.

### Entities

| Entity                                                                                                                                        | Schema                                                                    | Branded ID                      | Collection                                                           | Key fields / notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **UnifiedUser**                                                                                                                               | `UnifiedUserSchema.strict()`                                              | `UserId` (`uid`)                | `/users/{uid}`                                                       | `uid`, `email?`, `phone?`, `authProviders: AuthProvider[]` (drop singular `authProvider` — REVIEW §1/D), `displayName`, `firstName?`, `lastName?`, `photoURL?`, B2C (`country?`,`age?`,`grade?`,`onboardingCompleted?`,`preferences?`), `isSuperAdmin`, `consumerProfile?`, `activeTenantId?: TenantId`, `status: UserStatus`, `AuditFields`, `lastLogin?`.                                                                                                                                                           |
| **ConsumerProfile**                                                                                                                           | `ConsumerProfileSchema.strict()`                                          | — (embedded)                    | embedded in UnifiedUser                                              | `plan: ConsumerPlan`, `enrolledSpaceIds: SpaceId[]`, `purchaseHistory: PurchaseRecord[]`, `totalSpend`. **⚷ all fields server-only** (REVIEW §6.8).                                                                                                                                                                                                                                                                                                                                                                   |
| **PurchaseRecord**                                                                                                                            | `PurchaseRecordSchema.strict()`                                           | — (embedded)                    | embedded                                                             | `spaceId`, `spaceTitle`, `amount`, `currency`, `purchasedAt: Timestamp`, `transactionId`. Written only by `purchaseSpace` (levelup domain).                                                                                                                                                                                                                                                                                                                                                                           |
| **UserMembership**                                                                                                                            | `UserMembershipSchema.strict()`                                           | `MembershipId`                  | `/userMemberships/{uid}_{tenantId}`                                  | `id`, `uid: UserId`, `tenantId`, `tenantCode`, `role: TenantRole`, `status: MembershipStatus`, `joinSource`, exactly-one-of link ids (`teacherId?/studentId?/parentId?/staffId?/scannerId?`), `permissions?: Partial<Record<TeacherPermissionKey,boolean>> & {managedSpaceIds?,managedClassIds?}`, `staffPermissions?: Partial<Record<StaffPermissionKey,boolean>>`, `parentLinkedStudentIds?: StudentId[]` (**canonical parent→child name** — REVIEW D10), `AuditFields`, `lastActive?`. **⚷ Admin-SDK write only.** |
| **MembershipClaimsInput**                                                                                                                     | `Pick<>` (type only)                                                      | —                               | —                                                                    | minimal subset used by `syncMembershipClaims` to build claims pre-persist.                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **PlatformClaims**                                                                                                                            | `PlatformClaimsSchema.strict()`                                           | — (JWT projection, never a doc) | Firebase Auth custom claims                                          | `role?`, `tenantId?: TenantId`, `tenantCode?`, `teacherId?`/`studentId?`/`parentId?`/`scannerId?`/`staffId?` (branded), `classIds?: ClassId[]` (cap `MAX_CLAIM_CLASS_IDS=15`), `classIdsOverflow?`, `studentIds?: StudentId[]`, `permissions?: Partial<Record<TeacherPermissionKey,boolean>>`, `staffPermissions?: Partial<Record<StaffPermissionKey,boolean>>`, **`isSuperAdmin?: boolean`** _(NEW claim — auth-access §4.5, REVIEW §1; removes the per-rule `get()`)_. **⚷ minted server-only.**                    |
| **Tenant**                                                                                                                                    | `TenantSchema.strict()`                                                   | `TenantId`                      | `/tenants/{tenantId}`                                                | `id`, `name`, `shortName?`, `slug`, `tenantCode`, `ownerUid: UserId`, `status: TenantStatus`, nested `subscription`, `features`, `settings` (`geminiKeyRef?` — **never the key value**), `stats`, `usage?`, `branding?`, `onboarding?`, `deactivation?`, `contact*`, `trialEndsAt?`, `AuditFields`. Drops `@deprecated logoUrl/bannerUrl` (use `branding.*`). **`stats`/`usage` ⚷ trigger-maintained (REVIEW §6.9).**                                                                                                 |
| **TenantSubscription / TenantFeatures / TenantSettings / TenantStats / TenantBranding / TenantUsage / TenantOnboarding / TenantDeactivation** | each `.strict()`                                                          | — (embedded)                    | embedded in Tenant                                                   | unchanged shapes; `TenantSettings.geminiKeyRef` is a Secret Manager ref only.                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **TenantCodeIndex**                                                                                                                           | `TenantCodeIndexSchema.strict()`                                          | `TenantCode` (doc id)           | `/tenantCodes/{CODE}`                                                | `tenantId: TenantId`, `createdAt`. Uniqueness index. **⚷ CF write only; pre-auth `get` removed** (moved behind `lookupTenantByCode` — REVIEW §6.12).                                                                                                                                                                                                                                                                                                                                                                  |
| **TenantPublicView**                                                                                                                          | `TenantPublicViewSchema.strict()`                                         | — (projection)                  | derived                                                              | `{ tenantId, name, status, branding }` — the ONLY shape returned pre-auth (REVIEW §6.12).                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **Student**                                                                                                                                   | `StudentSchema.strict()`                                                  | `StudentId`                     | `/tenants/{t}/students/{id}`                                         | `id`, `tenantId`, **`authUid?: UserId`** (canonical; drop bare `uid` — REVIEW D3), `rollNumber?`, `section?`, `classIds: ClassId[]`, `parentIds: ParentId[]`, `grade?`, `admissionNumber?`, `dateOfBirth?` (ISO date), `status: EntityStatus`, `AuditFields`.                                                                                                                                                                                                                                                         |
| **Teacher**                                                                                                                                   | `TeacherSchema.strict()`                                                  | `TeacherId`                     | `/tenants/{t}/teachers/{id}`                                         | `id`, `tenantId`, `authUid?: UserId`, `email?`, `phone?`, `firstName`, `lastName`, `displayName?`, `employeeId?`, `department?`, `subjects: string[]`, `designation?`, `classIds: ClassId[]`, `sectionIds?`, `status`, `lastLogin?`, `AuditFields`. Removes `@deprecated uid`.                                                                                                                                                                                                                                        |
| **Parent**                                                                                                                                    | `ParentSchema.strict()`                                                   | `ParentId`                      | `/tenants/{t}/parents/{id}`                                          | `id`, `tenantId`, `authUid?: UserId`, `email?`, `phone?`, `firstName`, `lastName`, `displayName?`, `studentIds: StudentId[]` (canonical; drop `@deprecated childStudentIds` — REVIEW D10), `linkedStudentNames?`, `status`, `lastLogin?`, `AuditFields`.                                                                                                                                                                                                                                                              |
| **Staff**                                                                                                                                     | `StaffSchema.strict()` _(NEW shared type — REVIEW §4, be-identity §4.10)_ | `StaffId`                       | `/tenants/{t}/staff/{id}`                                            | `id`, `tenantId`, `authUid?: UserId`, `email?`, `firstName`, `lastName`, `displayName?`, `department?`, `status`, `AuditFields`.                                                                                                                                                                                                                                                                                                                                                                                      |
| **Scanner**                                                                                                                                   | `ScannerSchema.strict()` _(NEW shared type)_                              | `ScannerId`                     | `/tenants/{t}/scanners/{id}` _(tenant-scoped, unify — REVIEW D11)_   | `id`, `tenantId`, **`authUid: UserId`** (add — fixes the rule mismatch), `name`, `status`, `AuditFields`.                                                                                                                                                                                                                                                                                                                                                                                                             |
| **Class**                                                                                                                                     | `ClassSchema.strict()`                                                    | `ClassId`                       | `/tenants/{t}/classes/{id}`                                          | `id`, `tenantId`, `name`, `grade`, `section?`, `academicSessionId?: AcademicSessionId`, `teacherIds: TeacherId[]`, `studentIds: StudentId[]`, `studentCount`, `status`, `AuditFields`. (`studentIds`/`studentCount` denorm = trigger-maintained projections, not source of truth — REVIEW D7.)                                                                                                                                                                                                                        |
| **AcademicSession**                                                                                                                           | `AcademicSessionSchema.strict()`                                          | `AcademicSessionId`             | `/tenants/{t}/academicSessions/{id}`                                 | `id`, `tenantId`, `name`, `startDate`, `endDate`, `isCurrent`, `status`, `AuditFields`.                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **Announcement**                                                                                                                              | `AnnouncementSchema.strict()` _(NEW Zod — REVIEW §4 had none)_            | `AnnouncementId`                | `/announcements` (platform) or `/tenants/{t}/announcements` (tenant) | `id`, `tenantId?`, `title`, `body`, `authorUid: UserId`, `authorName`, `scope: AnnouncementScope`, `targetRoles?: TenantRole[]`, `targetClassIds?: ClassId[]`, `status: AnnouncementStatus`, `publishedAt?`, `archivedAt?`, `expiresAt?`, `readBy: UserId[]`, `AuditFields`.                                                                                                                                                                                                                                          |
| **Notification**                                                                                                                              | `NotificationSchema.strict()`                                             | `NotificationId`                | `/tenants/{t}/notifications/{id}`                                    | `id`, `tenantId`, **`recipientId: UserId`** (canonical; schema/live both used `recipientId`, NOT `recipientUid` — REVIEW D12 flagged a schema/interface schism, reconcile to `recipientId`), `recipientRole`, `type`, `title`, `body`, `entityType?`, `entityId?`, `actionUrl?`, `isRead`, `createdAt`, `readAt?`. **⚷ CF create only; recipient may only flip `isRead`.**                                                                                                                                            |
| **NotificationPreferences**                                                                                                                   | `NotificationPreferencesSchema.strict()` _(NEW Zod)_                      | —                               | `/tenants/{t}/notificationPreferences/{userId}`                      | `id`, `tenantId`, `userId: UserId`, `enabledTypes: NotificationType[]`, `muteUntil?`.                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **NotificationState** _(realtime payload)_                                                                                                    | `NotificationStateSchema.strict()`                                        | —                               | RTDB `/notifications/{t}/{uid}`                                      | `unreadCount`, `latest?: { id, title, type, createdAt }`. Drives the badge subscription.                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **GlobalEvaluationPreset**                                                                                                                    | `GlobalEvaluationPresetSchema.strict()`                                   | —                               | `/globalEvaluationPresets/{id}`                                      | super-admin curated grading presets (rubric snapshot referenced from autograde/levelup). Identity owns the CRUD shell; rubric body shape lives in the content/levelup domain.                                                                                                                                                                                                                                                                                                                                         |

### ALLOWED_TRANSITIONS state machines (this domain)

Build-time-checked data in `@levelup/api-contract` (imported by SDK for UX
pre-check, **enforced by server**):

- `ALLOWED_TRANSITIONS.tenant`:
  `trial → {active, expired, suspended, deactivated}`,
  `active → {suspended, deactivated, expired}`,
  `suspended → {active, deactivated}`, `expired → {active, deactivated}`,
  `deactivated → {active}`. (Reconciles the lifecycle scattered across
  `deactivateTenant`/`reactivateTenant`/`tenantLifecycleCheck`.)
- `ALLOWED_TRANSITIONS.membership`: `active → {inactive, suspended}`,
  `inactive → {active}`, `suspended → {active, inactive}`.
- `ALLOWED_TRANSITIONS.announcement`: `draft → {published, archived}`,
  `published → {archived}`, `archived → {draft}`.
- `ALLOWED_TRANSITIONS.entityStatus`
  (student/teacher/parent/staff/scanner/class/session): `active → {archived}`,
  `archived → {active}`.

---

## API contract (`@levelup/api-contract`)

Each callable is a `CallableDef` (`name`, `module:'identity'`,
`requestSchema.strict()`, `responseSchema.strict()`, `authMode`, `rateTier`,
`idempotent?`, `invalidates[]`). **No request schema declares a `tenantId`
field** (derived from claims — REVIEW D2/§6.1); only super-admin cross-tenant
ops carry `tenantOverride?`. All `list*` use `PageRequest` +
`pageResponse(item)`.

### Tenant lifecycle (super-admin)

| name                             | request fields (no tenantId)                                                                                                                        | response                                                | authMode                                 | rateTier                                          | idempotent           | invalidates              |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------- | -------------------- | ------------------------ | --- | --------- |
| `v1.identity.saveTenant`         | `id?`, `data: { name, shortName?, contactEmail, contactPhone?, plan?, features?, settings?, branding?, geminiApiKey?(→Secret Manager) }`, `delete?` | `SaveResponse { id, created }`                          | authed (super-admin)                     | write                                             | no                   | `tenants`                |
| `v1.identity.deactivateTenant`   | `tenantOverride: TenantId`, `reason?`                                                                                                               | `{ tenantId, status }`                                  | authed (super-admin)                     | write                                             | no                   | `tenants`, `memberships` |
| `v1.identity.reactivateTenant`   | `tenantOverride: TenantId`                                                                                                                          | `{ tenantId, status }`                                  | authed (super-admin)                     | write                                             | no                   | `tenants`, `memberships` |
| `v1.identity.exportTenantData`   | `tenantOverride?`, `scope: 'students'                                                                                                               | 'teachers'                                              | 'all'`                                   | `{ downloadUrl, expiresAt }` (signed Storage URL) | authed (admin/super) | report                   | no  | —         |
| `v1.identity.uploadTenantAsset`  | `kind: 'logo'                                                                                                                                       | 'banner'                                                | 'favicon'`, `contentType`, `bytesBase64` | `{ assetUrl }`                                    | authed (admin)       | write                    | no  | `tenants` |
| `v1.identity.lookupTenantByCode` | `tenantCode`                                                                                                                                        | `TenantPublicView { tenantId, name, status, branding }` | **public**                               | auth                                              | no                   | —                        |

### Tenant-scoped entity upserts (consolidated `save*` upsert pattern)

All use `SaveResponse { id, created }`; create branch provisions membership +
claims via the single `provisionMembership` factory (be-identity rec #3).

| name                              | request fields                                                                                                                                           | response       | authMode                              | rateTier | idempotent | invalidates                                    |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ------------------------------------- | -------- | ---------- | ---------------------------------------------- |
| `v1.identity.saveStudent`         | `id?`, `data: { firstName, lastName, email?, rollNumber?, section?, grade?, classIds?, parentIds?, dateOfBirth?, admissionNumber?, status? }`, `delete?` | `SaveResponse` | authed (admin/staff:canManageUsers)   | write    | no         | `students`, `classes`, `memberships`, `claims` |
| `v1.identity.saveTeacher`         | `id?`, `data: { firstName, lastName, email?, phone?, subjects?, department?, designation?, classIds?, permissions?, status? }`, `delete?`                | `SaveResponse` | authed (admin/staff)                  | write    | no         | `teachers`, `classes`, `memberships`, `claims` |
| `v1.identity.saveParent`          | `id?`, `data: { firstName, lastName, email?, phone?, studentIds?(canonical), status? }`, `delete?`                                                       | `SaveResponse` | authed (admin/staff)                  | write    | no         | `parents`, `students`, `memberships`, `claims` |
| `v1.identity.saveStaff`           | `id?`, `data: { firstName, lastName, email?, department?, staffPermissions?, status? }`, `delete?`                                                       | `SaveResponse` | authed (admin)                        | write    | no         | `staff`, `memberships`, `claims`               |
| `v1.identity.saveClass`           | `id?`, `data: { name, grade, section?, academicSessionId?, teacherIds?, status? }`, `delete?`                                                            | `SaveResponse` | authed (admin/staff:canManageClasses) | write    | no         | `classes`, `students`, `teachers`, `claims`    |
| `v1.identity.saveAcademicSession` | `id?`, `data: { name, startDate, endDate, isCurrent?, status? }`, `delete?`                                                                              | `SaveResponse` | authed (admin)                        | write    | no         | `academicSessions`, `classes`                  |

### Multi-tenant user management

| name                             | request fields                                                                                                                             | response                                                | authMode             | rateTier | idempotent                                  | invalidates                   |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- | -------------------- | -------- | ------------------------------------------- | ----------------------------- | -------- | ------- | -------------------------------------------------- |
| `v1.identity.createOrgUser`      | `role: TenantRole`, `firstName`, `lastName`, `email?`, `rollNumber?`, `password?`, `phone?`, `classIds?`, `subjects?`, `linkedStudentIds?` | `{ uid, entityId, membershipId }`                       | authed (admin/super) | write    | **yes** (saga + idempotencyKey — REVIEW §1) | `students                     | teachers | parents | staff`, `memberships`, `claims`, `tenants` (stats) |
| `v1.identity.switchActiveTenant` | `targetTenantId: TenantId`                                                                                                                 | `{ tenantId, role }` → client forces `getIdToken(true)` | authed               | auth     | no                                          | `claims`, `memberships`, `me` |
| `v1.identity.joinTenant`         | `tenantCode`                                                                                                                               | `{ tenantId, membershipId, role }`                      | authed               | auth     | **yes**                                     | `memberships`, `claims`, `me` |

### Bulk operations (super-admin / admin)

| name                             | request                                         | response                                            | authMode                | rateTier       | idempotent | invalidates                                               |
| -------------------------------- | ----------------------------------------------- | --------------------------------------------------- | ----------------------- | -------------- | ---------- | --------------------------------------------------------- | --------- | ---------------------------------- |
| `v1.identity.bulkImportStudents` | `rows: StudentImportRow[]`, `defaultClassIds?`  | `{ created, skipped, errors[] }`                    | authed (admin)          | write          | **yes**    | `students`, `classes`, `memberships`, `claims`, `tenants` |
| `v1.identity.bulkImportTeachers` | `rows: TeacherImportRow[]`                      | `{ created, skipped, errors[] }`                    | authed (admin)          | write          | **yes**    | `teachers`, `memberships`, `claims`, `tenants`            |
| `v1.identity.bulkUpdateStatus`   | `entityType: 'student'                          | 'teacher'`, `ids: string[]`, `status: EntityStatus` | `{ updated, errors[] }` | authed (admin) | write      | **yes**                                                   | `students | teachers`, `memberships`, `claims` |
| `v1.identity.rolloverSession`    | `fromSessionId`, `toSessionId`, `promotionMap?` | `{ classesCreated, studentsMoved }`                 | authed (admin)          | write          | **yes**    | `classes`, `academicSessions`, `students`                 |

### Announcements & notifications

| name                              | request                                                                                                                    | response                                                          | authMode                            | rateTier | idempotent | invalidates                       |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------- | -------- | ---------- | --------------------------------- |
| `v1.identity.saveAnnouncement`    | `id?`, `data: { scope?, title?, body?, targetRoles?, targetClassIds?, status?, expiresAt? }`, `delete?`, `tenantOverride?` | `SaveResponse`                                                    | authed (admin / super for platform) | write    | no         | `announcements`                   |
| `v1.identity.listAnnouncements`   | `scope?`, `status?`, `PageRequest`                                                                                         | `pageResponse(Announcement)`                                      | authed                              | read     | no         | —                                 |
| `v1.identity.manageNotifications` | discriminated on `action`: `{action:'list'} & PageRequest` \| `{action:'markRead', notificationId?, markAllRead?}`         | `'list' → pageResponse(Notification)`; `'markRead' → { success }` | authed                              | read     | no         | `notifications` (markRead branch) |

### Read endpoints replacing direct Firestore reads (NEW — common-api §3.3 + REVIEW)

| name                               | request                                        | response                                                                                              | authMode                        | rateTier | invalidates |
| ---------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------- | -------- | ----------- |
| `v1.identity.getMe`                | `{}`                                           | `{ user: UnifiedUser, memberships: UserMembership[], claims: PlatformClaims, activeTenant?: Tenant }` | authed                          | read     | —           |
| `v1.identity.getTenant`            | `tenantOverride?`                              | `Tenant`                                                                                              | authed                          | read     | —           |
| `v1.identity.listStudents`         | `classId?`, `status?`, `q?`, `PageRequest`     | `pageResponse(Student)`                                                                               | authed (admin/teacher-by-class) | read     | —           |
| `v1.identity.getStudent`           | `id: StudentId`                                | `Student`                                                                                             | authed                          | read     | —           |
| `v1.identity.listTeachers`         | `status?`, `PageRequest`                       | `pageResponse(Teacher)`                                                                               | authed (admin)                  | read     | —           |
| `v1.identity.getTeacher`           | `id: TeacherId`                                | `Teacher`                                                                                             | authed                          | read     | —           |
| `v1.identity.listParents`          | `studentId?`, `PageRequest`                    | `pageResponse(Parent)`                                                                                | authed (admin)                  | read     | —           |
| `v1.identity.listStaff`            | `PageRequest`                                  | `pageResponse(Staff)`                                                                                 | authed (admin)                  | read     | —           |
| `v1.identity.listClasses`          | `academicSessionId?`, `status?`, `PageRequest` | `pageResponse(Class)`                                                                                 | authed                          | read     | —           |
| `v1.identity.getClass`             | `id: ClassId`                                  | `ClassDetailView { class, students, teachers }`                                                       | authed                          | read     | —           |
| `v1.identity.listAcademicSessions` | `PageRequest`                                  | `pageResponse(AcademicSession)`                                                                       | authed (admin)                  | read     | —           |

### Super-admin platform reads

| name                                     | request                                 | response                                                                                                                                                                       | authMode             | rateTier |
| ---------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------- | -------- |
| `v1.identity.listTenants`                | `status?`, `plan?`, `q?`, `PageRequest` | `pageResponse(TenantSummary)`                                                                                                                                                  | authed (super-admin) | read     |
| `v1.identity.searchUsers`                | `query`, `PageRequest`                  | `pageResponse(UserSearchResult { uid, email, displayName, isSuperAdmin, activeTenantId, memberships: {tenantId,tenantCode,role}[] })` — **batched, no N+1** (be-identity §4.9) | authed (super-admin) | read     |
| `v1.identity.saveGlobalEvaluationPreset` | `id?`, `data`, `delete?`                | `SaveResponse`                                                                                                                                                                 | authed (super-admin) | write    |

### SUBSCRIPTIONS (realtime registry — identity)

- `v1.notification.badge`: `params: {}` → `payload: NotificationStateSchema`
  (RTDB `/notifications/{t}/{uid}`). Drives the unread badge across all apps.

---

## Repositories (`@levelup/repositories`)

Per-entity repos + a few cross-entity **view** repos. Repos own shaping,
batching/N+1 collapse, opaque cursor management (`paginate()`), transition
pre-checks (read `ALLOWED_TRANSITIONS`), and derived fields. Repos never import
each other except declared view repos.

### `meRepo` (session/identity view — ⚷-read)

- `get()` → `api.identity.getMe()` → assembles
  `{ user, memberships, claims, activeTenant }` view-model (collapses the live
  `auth-store` + `useAuth` double-source — auth-access §4.6).
- `switchTenant(targetTenantId)` → `api.identity.switchActiveTenant` then
  signals the transport to `getIdToken(true)`.
- `joinByCode(tenantCode)` → `api.identity.joinTenant`.
- `activeRole()`, `hasPermission(key)` — derived selectors over claims (UX only;
  server enforces).

### `tenantRepo`

- `list(filter?)` →
  `paginate(c => api.identity.listTenants({...filter, cursor:c}))`
  (super-admin).
- `get(override?)` → `api.identity.getTenant`.
- `save(input)`, `deactivate(id, reason)`, `reactivate(id)`,
  `exportData(scope)`, `uploadAsset(input)`.
- `lookupByCode(code)` → `api.identity.lookupTenantByCode` (pre-auth; returns
  only `TenantPublicView`).
- `canTransition(from, to)` → `ALLOWED_TRANSITIONS.tenant[from]?.includes(to)`.
- **Derived:** `seatsRemaining(tenant)` = `subscription.max* - usage.current*`;
  `isWritable(tenant)` from status set.

### `studentRepo`

- `list(filter)` (cursor), `get(id)`, `save(input)`, `archive(id)`.
- **Batching:** `getMany(ids)` → `where('id','in',chunks of 10)` collapsing N+1
  for class rosters / parent children.
- `canArchive(student)` via `entityStatus` transitions.

### `teacherRepo`, `parentRepo`, `staffRepo`

- Mirror `studentRepo` (`list/get/save/archive/getMany`).
  `parentRepo.byStudent(studentId)` for parent-portal linkage.

### `classRepo` (cross-entity **view** repo)

- `list(filter)`, `get(id)` → `ClassDetailView` assembling class + batched
  `studentRepo.getMany` + `teacherRepo.getMany` (kills the per-student fan-out
  flagged for admin/teacher dashboards).
- `save(input)`, `archive(id)`.
- **Derived:** `rosterCount`, `unassignedStudents`.

### `academicSessionRepo`

- `list()`, `get(id)`, `save(input)`, `rollover(input)` →
  `api.identity.rolloverSession`.

### `orgUserRepo` (write-side provisioning)

- `create(input)` → `api.identity.createOrgUser` (idempotencyKey attached by
  client).
- `bulkImportStudents(rows)`, `bulkImportTeachers(rows)`,
  `bulkUpdateStatus(input)` — accept parsed CSV rows; return per-row
  `{created,skipped,errors}` shaped for the import UI.

### `announcementRepo`

- `list(filter)` (cursor), `save(input)`, `archive(id)`,
  `canTransition(from,to)` via `announcement` machine.

### `notificationRepo`

- `list()` →
  `paginate(c => api.identity.manageNotifications({action:'list',cursor:c}))`.
- `markRead(id)`, `markAllRead()` → `manageNotifications({action:'markRead'})`.
  **On the conservative optimistic allow-list** (mark-read).
- `subscribeBadge(cb)` → realtime `v1.notification.badge`.

### `userSearchRepo` (view, super-admin)

- `search(query)` → `api.identity.searchUsers` (server returns batched
  memberships; repo shapes to the search UI row).

---

## Query hooks (`@levelup/query`)

Query-key factories (hierarchical, narrowest-correct invalidation):

```
meKeys        = { all:['me'], detail:() }
tenantKeys    = { all:['tenants'], list:(f), detail:(id) }
studentKeys   = { all:['students'], list:(f), detail:(id) }
teacherKeys / parentKeys / staffKeys  (same shape)
classKeys     = { all:['classes'], list:(f), detail:(id) }
sessionKeys   = { all:['academicSessions'], list, detail }
announcementKeys = { all:['announcements'], list:(f) }
notificationKeys = { all:['notifications'], list:(), badge:() }
userSearchKeys   = { all:['userSearch'], query:(q) }
```

| Hook                                                            | Repo call                                                 | Invalidates                                                         | Optimistic allow-list                                             |
| --------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `useMe()`                                                       | `meRepo.get`                                              | —                                                                   | —                                                                 |
| `useSwitchTenant()`                                             | `meRepo.switchTenant`                                     | `meKeys.all`, `claims`, **all** (tenant context changes everything) | ❌                                                                |
| `useJoinTenant()`                                               | `meRepo.joinByCode`                                       | `meKeys.all`                                                        | ❌                                                                |
| `useLookupTenantByCode()`                                       | `tenantRepo.lookupByCode`                                 | — (public, pre-auth)                                                | —                                                                 |
| `useTenants(f)` / `useTenant(o)`                                | `tenantRepo.list/get`                                     | —                                                                   | —                                                                 |
| `useSaveTenant()`                                               | `tenantRepo.save`                                         | `tenantKeys.all`                                                    | ❌ (lifecycle)                                                    |
| `useDeactivateTenant()` / `useReactivateTenant()`               | `tenantRepo.*`                                            | `tenantKeys.all`                                                    | ❌                                                                |
| `useExportTenantData()`                                         | `tenantRepo.exportData`                                   | —                                                                   | —                                                                 |
| `useStudents(f)` / `useStudent(id)`                             | `studentRepo.list/get`                                    | —                                                                   | —                                                                 |
| `useSaveStudent()`                                              | `studentRepo.save`                                        | `studentKeys.all`, `classKeys.all`                                  | ❌ (claims-affecting)                                             |
| `useTeachers/useSaveTeacher`                                    | `teacherRepo.*`                                           | `teacherKeys.all`, `classKeys.all`                                  | ❌                                                                |
| `useParents/useSaveParent`                                      | `parentRepo.*`                                            | `parentKeys.all`, `studentKeys.all`                                 | ❌                                                                |
| `useStaff/useSaveStaff`                                         | `staffRepo.*`                                             | `staffKeys.all`                                                     | ❌                                                                |
| `useClasses/useClass/useSaveClass`                              | `classRepo.*`                                             | `classKeys.all`, `studentKeys.all`, `teacherKeys.all`               | ❌                                                                |
| `useAcademicSessions/useSaveAcademicSession/useRolloverSession` | `academicSessionRepo.*`                                   | `sessionKeys.all`, `classKeys.all`                                  | ❌                                                                |
| `useCreateOrgUser()`                                            | `orgUserRepo.create`                                      | role-list keys, `tenantKeys.detail`                                 | ❌ (provisioning)                                                 |
| `useBulkImportStudents/Teachers`, `useBulkUpdateStatus`         | `orgUserRepo.*`                                           | role-list keys, `claims`                                            | ❌                                                                |
| `useAnnouncements(f)` / `useSaveAnnouncement()`                 | `announcementRepo.*`                                      | `announcementKeys.all`                                              | ❌ (publish lifecycle)                                            |
| `useNotifications()`                                            | `notificationRepo.list`                                   | —                                                                   | —                                                                 |
| `useMarkNotificationRead()` / `useMarkAllNotificationsRead()`   | `notificationRepo.markRead/markAllRead`                   | `notificationKeys.all`                                              | ✅ **conservative optimistic** (flip `isRead`, rollback on error) |
| `useNotificationBadge()`                                        | `notificationRepo.subscribeBadge` (via `useSubscription`) | —                                                                   | —                                                                 |
| `useSearchUsers(q)`                                             | `userSearchRepo.search`                                   | —                                                                   | —                                                                 |

---

## Server services (`@levelup/services`)

Every service is `fn(input, ctx: AuthContext)` — no `firebase-functions` import.
`tenantId = ctx.tenantId` (claims); super-admin `tenantOverride` honored only if
`ctx.isSuperAdmin`. `authorize(ctx, policyKey, resource)` from
`@levelup/access`.

### `services/server` (server-only — ⚷ claims, memberships, secrets, counters)

| Service                                                         | Authorize policy key                 | Notes / authority                                                                                                                                                                                                 |
| --------------------------------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `provisionMembershipService(input, ctx)`                        | `membership.create`                  | **THE single membership+entity+claims factory** (be-identity rec #3). Used by createOrgUser, save\* create branch, joinTenant, bulkImport. Mints claims via `syncMembershipClaims`.                               |
| `syncMembershipClaimsService(uid, tenantId, ctx)`               | `claims.sync`                        | re-derives `managedClassIds` from authoritative docs, rewrites claims, `revokeRefreshTokens` on role/status change (auth-access rec #3/#5). Single primitive every role/status/class/perm-changing service calls. |
| `createOrgUserService`                                          | `user.create`                        | saga: Auth user → entity → membership → claims → counters → user doc; compensating delete; idempotencyKey dedupe.                                                                                                 |
| `saveTenantService`                                             | `tenant.create`/`tenant.update`      | super-admin; transactional tenant + tenantCode (auto-suffix on collision — be-identity rec #9) + creator membership; Gemini key → Secret Manager.                                                                 |
| `deactivateTenantService` / `reactivateTenantService`           | `tenant.lifecycle`                   | `assertTransition(tenant)`; suspends/restores memberships; `revokeRefreshTokens` fan-out (via outbox/Cloud Tasks).                                                                                                |
| `saveStudent/Teacher/Parent/Staff/ClassService`                 | `student.write` etc.                 | upsert; create branch → `provisionMembershipService`; class-reassignment branch → `syncMembershipClaimsService` (fixes the live stale-claim drift — auth-access §4.2).                                            |
| `saveAcademicSessionService` / `rolloverSessionService`         | `session.write` / `session.rollover` | rollover = multi-step → Cloud Tasks orchestration.                                                                                                                                                                |
| `bulkImportStudents/TeachersService`, `bulkUpdateStatusService` | `bulk.import` / `bulk.status`        | batched, idempotent; per-row error collection.                                                                                                                                                                    |
| `exportTenantDataService`                                       | `tenant.export`                      | union-of-keys CSV (be-identity rec #9); signed Storage URL; cleanup via scheduler.                                                                                                                                |
| `uploadTenantAssetService`                                      | `tenant.update`                      | Storage write under tenant path; returns asset URL.                                                                                                                                                               |
| `saveGlobalEvaluationPresetService`                             | `platform.preset`                    | super-admin only.                                                                                                                                                                                                 |
| `markNotificationsReadService`                                  | `notification.markOwn`               | owner-only; decrements RTDB badge. (the `markRead` half of manageNotifications.)                                                                                                                                  |

### `services/shared` (client-safe reads / lookups)

| Service                                                             | Authorize policy key                     | Notes                                                                                                              |
| ------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `getMeService`                                                      | (self)                                   | user + memberships + claims + active tenant.                                                                       |
| `getTenantService` / `listTenantsService`                           | `tenant.read` / `platform.read`          |                                                                                                                    |
| `listStudents/Teachers/Parents/Staff/ClassesService`, `get*Service` | `*.read` (tenant + role + class scoping) | teacher list scoped to claim `classIds`.                                                                           |
| `getClassService`                                                   | `class.read`                             | view assembly (class + roster batch).                                                                              |
| `listAcademicSessionsService`                                       | `session.read`                           |                                                                                                                    |
| `listAnnouncementsService`                                          | `announcement.read`                      | scope/role filtered.                                                                                               |
| `saveAnnouncementService`                                           | `announcement.write`                     | publish = `assertTransition(announcement)`. _(write but non-secret — lives in shared with server-side authorize.)_ |
| `listNotificationsService`                                          | `notification.readOwn`                   | recipient-scoped.                                                                                                  |
| `searchUsersService`                                                | `platform.searchUsers`                   | super-admin; batched membership `where('uid','in',...)`.                                                           |
| `lookupTenantByCodeService`                                         | **public**                               | returns ONLY `TenantPublicView`.                                                                                   |
| `switchActiveTenantService` / `joinTenantService`                   | (self, active-membership check)          | rebuild claims for target tenant; both call `syncMembershipClaims`.                                                |

---

## Function shells (callable / trigger / scheduler)

### Callable onCall adapters (`functions/identity/src/callable/*`)

Each is the 3-line thin adapter:

```ts
export const saveStudent = onCall(
  { region: REGION, cors: true },
  async (req) => {
    const ctx = buildAuthContext(req.auth);
    const input = parseRequest(req.data, SaveStudentRequestSchema);
    return saveStudentService(input, ctx);
  }
);
```

One shell per contract callable above: `saveTenant`, `deactivateTenant`,
`reactivateTenant`, `exportTenantData`, `uploadTenantAsset`,
`lookupTenantByCode` (public), `saveStudent`, `saveTeacher`, `saveParent`,
`saveStaff`, `saveClass`, `saveAcademicSession`, `createOrgUser`,
`switchActiveTenant`, `joinTenant`, `bulkImportStudents`, `bulkImportTeachers`,
`bulkUpdateStatus`, `rolloverSession`, `saveAnnouncement`, `listAnnouncements`,
`manageNotifications`, `searchUsers`, `saveGlobalEvaluationPreset`, plus read
shells `getMe`, `getTenant`, `listTenants`, `listStudents`, `getStudent`,
`listTeachers`, `getTeacher`, `listParents`, `listStaff`, `listClasses`,
`getClass`, `listAcademicSessions`.

### Triggers (single-writer, idempotent, outbox)

- **`beforeUserCreated` / `beforeSignIn`** (Gen 2 blocking — migrate off Gen 1
  v1 `onUserCreated`; be-identity rec #8): seed `/users/{uid}` synchronously
  with `authProviders` array; seed claims; eliminates the
  `onUserCreated`-vs-`createOrgUser` race.
- **`onUserDeleted`** → `userDeletedService`: soft-delete user, suspend all
  memberships, decrement counters (single counter helper — be-identity rec #6).
- **`onMembershipWritten`** (`/userMemberships/{id}`) →
  `syncMembershipClaimsService`: single-writer claim sync so callables can't
  forget (auth-access rec #3). Idempotent (re-derive from authoritative docs).
- **`onStudentArchived`** → fan-out removal of `studentId` from parent/class
  arrays (idempotent array-remove).
- **`onClassArchived`** → roster cleanup.
- **`onTenantDeactivated`** (`status → suspended|expired|deactivated`) → suspend
  active memberships + `revokeRefreshTokens` fan-out via **outbox**
  (must-deliver, not fire-and-forget).
- **`onAnnouncementPublished`** → notification fan-out to
  `targetRoles`/`targetClassIds` recipients via outbox.

### Schedulers / cron

- **`tenantLifecycleCheck`** (daily) → `tenantLifecycleService`: trial→expired
  transitions (`assertTransition`), flags long-expired.
- **`monthlyUsageReset`** (monthly) → resets `usage.examsThisMonth` /
  `aiCallsThisMonth`.
- **`cleanupExpiredExports`** (every 30 min) → deletes Storage export files past
  `deleteAfter`.

### Cloud Tasks orchestration (multi-step)

- `rolloverSession` → Cloud Tasks queue: per-class create + per-student
  promotion as discrete idempotent steps (avoids one giant non-atomic write).
- `bulkImport*` → chunked Cloud Tasks batches (idempotent per chunk via
  idempotencyKey + `getUserByEmail` fallback).
- Tenant-deactivation `revokeRefreshTokens` fan-out → outbox-driven Tasks
  (per-uid revoke is independently retryable).

---

## Authority boundary (server-only ⚷)

Maps to REVIEW §6. For the identity domain, the SDK may **read projections** and
**request** changes, but the server is the sole writer of:

1. **`tenantId` for any tenant-scoped op** — from verified claims, never from
   SDK body (REVIEW §6.1; no request schema has a `tenantId` field; super-admin
   `tenantOverride` only).
2. **All of `PlatformClaims`** — `role`, `permissions`, `staffPermissions`,
   `isSuperAdmin`, `classIds`, `studentIds`, entity ids. Minted via Admin SDK;
   token revocation server-driven (REVIEW §6.2).
3. **`UserMembership` docs** — role / status / permissions /
   `parentLinkedStudentIds` are Admin-SDK write only; rules `write: if false`
   (REVIEW §6.3).
4. **`UnifiedUser` protected fields** — `isSuperAdmin`, `status`,
   `consumerProfile.enrolledSpaceIds` (purchases via `purchaseSpace` only —
   REVIEW §6.8); self-elevation blocked.
5. **`Tenant.stats` / `Tenant.usage`** — trigger-maintained denormalized
   counters; SDK reads, never writes (REVIEW §6.9).
6. **Tenant + membership + announcement lifecycle transitions** —
   `ALLOWED_TRANSITIONS` enforced server-side (REVIEW §6.10 analog); SDK
   pre-checks for UX only.
7. **`tenantCode` / `TenantCodeIndex`** — CF write only; pre-auth lookup returns
   only `TenantPublicView` (no enumeration leak — REVIEW §6.12).
8. **Gemini API key / `geminiKeyRef`** — Secret Manager; never in client bundle
   or response.
9. **Cross-entity link integrity** — `classIds`, `parentIds`/`studentIds`,
   `teacherIds` existence-validated in-tenant server-side (REVIEW §6.11); SDK
   requests links, server validates referents.
10. **Storage paths** (exports, tenant assets) — per-path tenant + role +
    ownership scoping (REVIEW §6.13).
11. **Notification create** — CF only; recipient may only flip own `isRead`.

---

## Drift & open questions

### Reconciliations applied (from REVIEW drift table)

- **D2 — tenantId from body:** removed from every request schema; derived from
  `ctx.tenantId` (claims). The #1 boundary fix.
- **D3 — uid vs authUid:** canonical **`authUid: UserId`** on every entity
  (Student/Teacher/Parent/Staff/Scanner). Drop bare `uid` and `@deprecated uid`.
  Writers, readers, rules all use `authUid`.
- **D4 — timestamp trichotomy:** all timestamps → ISO-8601 `Timestamp`; edge
  adapter in the repository admin adapter converts Firestore Timestamps at the
  boundary.
- **D5 — soft-delete:** entities keep `status: 'active'|'archived'`; transitions
  are data (`ALLOWED_TRANSITIONS.entityStatus`); `save*` `delete?` flag maps to
  archive, not hard delete (except announcements which truly delete).
- **D8 — branded IDs:** every persisted id field branded; adds `StaffId`,
  `ScannerId`.
- **D9 — Zod-first `.strict()`:** every entity authored schema-first; kills
  `.passthrough()` drift. New schemas added for Announcement,
  NotificationPreferences, Staff, Scanner (REVIEW §4 had none).
- **D10 — parent→child naming:** canonical **`parentLinkedStudentIds`** on
  membership + **`studentIds`** on Parent entity + claim `studentIds`. Drop
  `childStudentIds`. `saveParent`/`createOrgUser` request use
  `studentIds`/`linkedStudentIds` mapped to the canonical field.
- **D11 — scanner location:** unify to tenant-scoped
  `/tenants/{t}/scanners/{id}` with `authUid` + matching rule; delete top-level
  `/scanners` rule.
- **D12 — schema↔interface drift:** Notification reconciled to `recipientId`
  (live writer + reader both use `recipientId`; the schema's `recipientUid` was
  the drifting side). `authProviders` array canonical (drop singular
  `authProvider`).

### Open questions

1. **`joinTenant` lazy entity doc.** REVIEW open-Q + be-identity rec #3: should
   a code-joined student get a `/students/{id}` profile? **Recommend: yes,
   created lazily inside `provisionMembershipService`** so every membership has
   a backing entity (the SDK never assumes a missing entity doc).
2. **`superAdmin` as membership role.** Now that `isSuperAdmin` is a claim, the
   `superAdmin` value in `TenantRole` is effectively dead (carried on
   `UnifiedUser`). Keep the enum value for back-compat or remove? **Recommend:
   keep in enum, never mint as a membership role.**
3. **Counter model unification.** `stats.total*` vs `usage.current*` diverge
   (be-identity §4.6). **Recommend: single `adjustTenantCounters(delta)` helper
   called from every create/delete/join/leave path incl. `joinTenant` + deletion
   trigger, or a scheduled reconciler.** Affects which fields the SDK can trust
   without round-trip.
4. **`getMe` vs realtime claims.** `switchActiveTenant` re-stamps claims; the
   SDK must `getIdToken(true)` then refetch `getMe`. Confirm the transport
   exposes a `refreshToken()` seam the `meRepo.switchTenant` can await before
   invalidation.
5. **`tenantCode` collision policy.** Live throws on collision; **recommend
   auto-suffix retry** in `saveTenantService` (be-identity rec #9) — confirm the
   response still returns the final assigned code so the admin UI shows it.
6. **Notification `recipientUid` vs `recipientId`** (D12) — confirmed reconcile
   to `recipientId`; flag for the autograde/analytics domains (which create
   notifications) to use the same field name.
