# 04 — Admin & Super-Admin Journeys

## A. School Admin (`apps/admin-web`)

**Port:** `4568`  
**Local URL:** http://localhost:4568  
**Allowed roles:** `tenantAdmin`  
**Credentials:** see [`TEST_CREDENTIALS.md`](../../TEST_CREDENTIALS.md) (e.g. `admin@greenwood.edu` / `Test@12345` / `GRN001`)

### Login start (exact steps)

1. Open http://localhost:4568/login
2. **School code** validated via `useLookupTenantByCode` + `evaluateTenantAccess` — **UX gate only**
3. **Email + password** via `useSession().login(email, password)` — **school code is NOT passed into Auth credentials**
4. Session: Firebase auth + `useMe()` → **`v1.identity.getMe`**
5. Tenant switch: `useSwitchTenant` → **`switchActiveTenant`** + **full React Query cache reset**

### Onboarding guard

- `OnboardingGuard`: if `membership.role === "tenantAdmin"` and `tenant.onboarding.completed !== true` (and not super-admin), redirect **`/onboarding`**
- Super-admin users browsing as elevated: bypass onboarding check

### Guards / error states

| Condition | Behavior |
|-----------|----------|
| Loading | Full sidebar + content skeleton |
| No auth | `/login` |
| Wrong role **OR** `currentMembership.tenantId !== currentTenantId` | **Access Denied** (stricter than teacher/parent) |
| Incomplete onboarding | Forced `/onboarding` |
| Unknown route | `NotFoundPage` |

### Full route tree (`App.tsx`)

| Path | Page | Purpose |
|------|------|---------|
| `/login` | LoginPage | Auth |
| `/` | DashboardPage | School admin dashboard |
| `/users` | UsersPage | User management (students/teachers/parents) |
| `/classes` | ClassesPage | Classes & sections |
| `/classes/:classId` | ClassDetailPage | Class detail / roster |
| `/exams` | ExamsOverviewPage | School-wide exams overview |
| `/spaces` | SpacesOverviewPage | Spaces overview |
| `/courses` | CoursesPage | Courses & spaces management surface |
| `/staff` | StaffPage | Staff & permissions |
| `/announcements` | AnnouncementsPage | School announcements |
| `/analytics` | AnalyticsPage | Analytics |
| `/reports` | ReportsPage | Reports / PDFs |
| `/ai-usage` | AIUsagePage | AI usage & costs |
| `/academic-sessions` | AcademicSessionPage | Sessions + rollover |
| `/data-export` | DataExportPage | Export tenant data |
| `/settings` | SettingsPage | Branding, eval settings, join code |
| `/notifications` | NotificationsPage | Inbox (**not in sidebar**) |
| `/onboarding` | OnboardingWizardPage | First-time school setup (**not in sidebar**) |

### Sidebar nav (`AppLayout.tsx`)

| Group | Label | Path |
|-------|-------|------|
| **Overview** | Dashboard | `/` |
| **Management** | Users | `/users` |
| | Classes | `/classes` |
| | Exams | `/exams` |
| | Spaces | `/spaces` |
| | Courses | `/courses` |
| | Staff & Permissions | `/staff` |
| | Announcements | `/announcements` |
| **Analytics** | Analytics | `/analytics` |
| | Reports | `/reports` |
| | AI Usage | `/ai-usage` |
| **Configuration** | Academic Sessions | `/academic-sessions` |
| | Data Export | `/data-export` |
| | Settings | `/settings` |

**Mobile bottom nav:** Home · Users · Classes · Analytics · **More** (opens sidebar sheet)

### Primary mutations

| Screen | CTAs | Callables (representative) |
|--------|------|----------------------------|
| OnboardingWizard | School info, session, first class, join code | `saveTenant` · `saveAcademicSession` · `saveClass` (+ optional `geminiApiKey` write-only into Secret Manager) |
| Users | CRUD + bulk import | `createOrgUser` · `bulkImportStudents` · `bulkImportTeachers` · `saveStudent` / `saveTeacher` / `saveParent` · `bulkUpdateStatus` |
| Classes | Class CRUD, roster | `saveClass` · `saveStudent` |
| Staff | Teacher permissions | `saveTeacher` / `saveStaff` |
| Announcements | School announcements | `saveAnnouncement` · `listAnnouncements` |
| AcademicSession | Session CRUD + rollover | `saveAcademicSession` · `rolloverSession` |
| DataExport | Export | `exportTenantData` |
| Settings | Branding, eval, join code | `saveTenant` · evaluation settings |
| AI Usage | Quota / cost | cost summary read (`getCostSummary` / analytics) |
| Reports | PDF reports | `generateReport` |
| Courses / Exams / Spaces | Oversight | Mostly read of teacher-authored entities |

### AI on admin journey

- Configures per-tenant Gemini key on onboarding/settings (`geminiApiKey` → Secret Manager `tenant-{tenantId}-gemini`)
- Monitors cost on `/ai-usage`
- Does **not** run extract/grade/tutor from admin UI (those are teacher/student)

### How admin connects to others

Admin is the **provisioning hub**: tenants (via super-admin create), sessions, classes, users (students/teachers/parents), announcements, export. Teacher content and grading feed admin oversight screens.

---

## B. Super-Admin (`apps/super-admin`)

**Port:** `4567`  
**Local URL:** http://localhost:4567  
**Guard:** `user.isSuperAdmin` **AND** JWT `claims.role === "superAdmin"`  
**Credentials:** see [`TEST_CREDENTIALS.md`](../../TEST_CREDENTIALS.md) (e.g. `superadmin@levelup.app` / `Test@12345`)

### Login start

1. Open http://localhost:4567/login
2. **Email + password only** — **no school code**
3. `useAuthStore().login()` → verify Firestore user + claim

### Guards

| Condition | Behavior |
|-----------|----------|
| Loading / claims verifying | “Loading...” |
| No auth | `/login` |
| Missing user, `!isSuperAdmin`, or claim not `superAdmin` | **Access Denied** — “Super admin privileges required.” + **Sign Out** |

### Full route tree + nav

| Nav label | Path | Primary CTAs |
|-----------|------|--------------|
| Dashboard | `/` | Platform KPIs |
| Tenants | `/tenants` | `saveTenant` (create) |
| Tenant detail | `/tenants/:tenantId` | `saveTenant` · `deactivateTenant` · `reactivateTenant` |
| User Analytics | `/analytics` | Read |
| Feature Flags | `/feature-flags` | Tenant flag mutations |
| Global Presets | `/presets` | `saveGlobalPreset` / rubric presets |
| LLM Usage | `/llm-usage` | Platform cost read |
| Announcements | `/announcements` | `saveAnnouncement` |
| Users | `/users` | `searchUsers` |
| System Health | `/system` | Read |
| Settings | `/settings` | Platform config |

**Mobile bottom nav:** Home · Tenants · Health `/system` · Settings

### Marketing note

`APP_URLS` on `apps/website` lists admin/teacher/student/parent only — **super-admin is intentionally omitted** (internal Firebase Hosting target `super-admin`).

### AI

- Platform `/llm-usage` cost visibility
- Does not run classroom AI tutors/grading from this app
