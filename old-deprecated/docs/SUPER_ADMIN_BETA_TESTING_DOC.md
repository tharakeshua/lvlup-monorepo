# Super Admin App — Beta Testing Doc

> **Date:** 2026-02-25 **Platform:** Auto LevelUp — AI-First LMS **App:**
> `apps/super-admin` | **Port:** `http://localhost:4567` **Stack:** React 18 +
> Vite + Firebase + TailwindCSS (Monorepo via pnpm/Turborepo)

---

## 1. What is Auto LevelUp?

Auto LevelUp is an **AI-first Learning Management System (LMS)** built as a
multi-tenant SaaS platform. It supports:

- **Schools/Institutions** (tenants) as isolated units with their own admins,
  teachers, students, and parents
- **AI-powered grading** via Gemini for evaluation and feedback
- **Multi-role portals:** Super Admin, School Admin, Teacher, Student, Parent
- **Autograde module** for scanning and grading physical answer sheets

The platform is built as a **pnpm monorepo** (`Turborepo`) with:

```
apps/
  super-admin/       ← You are here (port 4567)
  admin-web/         ← School Admin (port 4568)
  teacher-web/       ← Teacher portal (port 4569)
  student-web/       ← Student portal (port 4570)
  parent-web/        ← Parent portal (port 4571)
packages/
  shared-ui/         ← Shared React components (AppShell, AppSidebar, Dialog, Button, etc.)
  shared-stores/     ← Zustand auth/user stores
  shared-services/   ← Firebase init + service layer
  shared-types/      ← TypeScript types (Tenant, EvaluationSettings, etc.)
  shared-hooks/      ← Shared React hooks
  shared-utils/      ← Utility functions
  eslint-config/     ← Shared ESLint rules
  tailwind-config/   ← Shared design system + Tailwind tokens
```

---

## 2. What is the Super Admin App?

The Super Admin app is the **platform-operator control panel** — a "God mode"
dashboard used exclusively by the LevelUp team (not by any school, teacher, or
student).

### Purpose

| Goal                        | Details                                                                              |
| --------------------------- | ------------------------------------------------------------------------------------ |
| Monitor the entire platform | See all tenants, users, exams, and spaces across every school                        |
| Tenant management           | View, search, and inspect all registered tenant (school) accounts                    |
| Global configuration        | Create/edit/delete evaluation preset templates shared with all tenants               |
| System oversight            | Monitor live service health (Firebase Auth, Firestore, Cloud Functions, AI Pipeline) |

### Access Control

- Protected by `RequireAuth` guard: checks `user.isSuperAdmin === true` on the
  Firestore `/users/{uid}` document
- Firebase Auth custom claims also set `role: 'superAdmin'`
- Non-super-admin users see **"Access Denied"** screen — no data is exposed

---

## 3. Current Implementation Status

### Pages

| Page               | Route                | Status              | What it does                                                                                                                                                                                                                                                                        |
| ------------------ | -------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Login**          | `/login`             | ✅ Fully Functional | Email + password login via Firebase Auth. Guards redirect unauthenticated users here. Wrong password shows inline error.                                                                                                                                                            |
| **Dashboard**      | `/`                  | ✅ Fully Functional | Live stats from Firestore: total tenants (active/trial split), total users, total exams, total spaces. Shows 5 most recent tenants with status badges. Sign Out button in header.                                                                                                   |
| **Tenants List**   | `/tenants`           | ✅ Fully Functional | Searchable, filterable table of all tenant documents. Filters: all / active / trial / suspended / expired. Search by name, code, or email. Click "View" → Tenant Detail.                                                                                                            |
| **Tenant Detail**  | `/tenants/:tenantId` | ✅ Fully Functional | Per-tenant view: stats cards (students/teachers/exams/spaces), subscription plan & limits, contact info, feature flags grid, AI settings (Gemini key status, model, timezone, locale). Back link to list.                                                                           |
| **Global Presets** | `/presets`           | ✅ Fully Functional | Full CRUD for `globalEvaluationPresets` Firestore collection. Create/Edit dialog with name, description, default/public flags, display settings, and evaluation dimension toggles with weights. Delete with confirmation dialog. Calls `saveGlobalEvaluationPreset` Cloud Function. |
| **System Health**  | `/system`            | ✅ Fully Functional | Live health probes: Firestore (real latency timing), Firebase Auth (current user check), Cloud Functions (endpoint reachability), AI Pipeline (checks if any tenant has Gemini configured). Manual refresh button.                                                                  |

### Auth + Security

- `RequireAuth.tsx` guard: redirects to `/login` if unauthenticated; shows
  "Access Denied" if authenticated but not super admin
- Login form with error display (wrong password → inline error)
- Sign Out button in Dashboard header

### Navigation Sidebar

Uses shared `AppSidebar` + `AppShell` components from `@levelup/shared-ui`:

```
Overview
  └── Dashboard

Platform
  ├── Tenants
  └── Global Presets

System
  └── System Health
```

### Data Sources

| Data                                 | Where     | Operation                                                                  |
| ------------------------------------ | --------- | -------------------------------------------------------------------------- |
| `tenants` collection                 | Firestore | Read (Dashboard, Tenants List, Tenant Detail, System Health)               |
| `globalEvaluationPresets` collection | Firestore | Read via SDK; Write/Delete via Cloud Function `saveGlobalEvaluationPreset` |

### Global Presets — Evaluation Dimensions

The preset system supports 6 built-in RELMS dimensions:

| Dimension         | Priority | Default Enabled |
| ----------------- | -------- | --------------- |
| Clarity           | HIGH     | ✅              |
| Accuracy          | HIGH     | ✅              |
| Depth             | MEDIUM   | ✅              |
| Grammar           | MEDIUM   | ✅              |
| Relevance         | HIGH     | ✅              |
| Critical Thinking | MEDIUM   | ❌              |

Each dimension can be toggled on/off and given a weight (1–5x) per preset.

---

## 4. Known Gaps / Not Yet Implemented

| Feature                                         | Status                   | Priority            |
| ----------------------------------------------- | ------------------------ | ------------------- |
| Tenant status change (suspend/activate) from UI | ❌ Read-only             | High                |
| Create new tenant from UI                       | ❌ Seed script only      | Medium              |
| Tenant list pagination                          | ❌ Loads all docs        | Low (fine for beta) |
| Error Rate metric in System Health              | ❌ No logging system yet | Low                 |
| Audit log / activity history                    | ❌ Not built             | Low                 |
| DAU (Daily Active Users) metric                 | ❌ Not built             | Low                 |

---

## 5. How to Test — Step-by-Step

### Prerequisites

```bash
node --version    # >= 20
pnpm --version    # >= 9
firebase --version  # Firebase CLI installed
java --version    # Required for Firebase Emulator
```

Install Firebase CLI if needed:

```bash
npm install -g firebase-tools
```

---

### Step 1 — Install Dependencies

```bash
cd /Users/subhang/Desktop/Projects/auto-levleup
pnpm install
```

---

### Step 2 — Start Firebase Emulators

```bash
firebase emulators:start
```

Services started: | Service | Port | |---------|------| | Auth Emulator |
`localhost:9099` | | Firestore Emulator | `localhost:8080` | | Functions
Emulator | `localhost:5001` | | Realtime DB | `localhost:9000` | | **Emulator
UI** | **`http://localhost:4000`** |

---

### Step 3 — Seed Test Data

In a new terminal:

```bash
pnpm seed:emulator
```

This creates all test users, tenants, and memberships in the local emulators.

**Test Accounts Created:**

| Role            | Email                       | Password          |
| --------------- | --------------------------- | ----------------- |
| **Super Admin** | `superadmin@levelup.test`   | `SuperAdmin123!`  |
| School Admin    | `admin@springfield.test`    | `TenantAdmin123!` |
| Teacher         | `teacher1@springfield.test` | `Teacher123!`     |
| Student         | `student1@springfield.test` | `Student123!`     |
| Parent          | `parent1@springfield.test`  | `Parent123!`      |

**Test Tenants Created:**

- **Springfield Academy** (code: `SPR001`) — active
- **Riverside School** — active

---

### Step 4 — Start the Super Admin App

Option A — Only super-admin:

```bash
pnpm --filter @levelup/super-admin dev
```

Option B — All apps at once:

```bash
pnpm dev
# or
./start.sh
```

App opens at: **`http://localhost:4567`**

---

### Step 5 — Manual Test Checklist

#### Authentication

- [ ] Visit `http://localhost:4567` → redirects to `/login`
- [ ] Submit wrong password → inline error shows
- [ ] Login with `superadmin@levelup.test` / `SuperAdmin123!` → lands on
      Dashboard
- [ ] Login with `admin@springfield.test` (non-super-admin) → "Access Denied"
      screen
- [ ] Click Sign Out → redirects to `/login`

#### Dashboard (`/`)

- [ ] Stat cards load: Total Tenants, Total Users, Total Exams, Total Spaces
- [ ] Tenant count shows active/trial breakdown in subtitle
- [ ] Recent Tenants section shows up to 5 tenants with status badges

#### Tenants List (`/tenants`)

- [ ] All seeded tenants appear in the table (name, code, plan, users, status)
- [ ] Search "Spring" → only Springfield Academy shows
- [ ] Filter by "active" → only active tenants shown
- [ ] Filter by "trial" → empty or trial tenants shown
- [ ] Click "View" for a tenant → navigates to detail page

#### Tenant Detail (`/tenants/:id`)

- [ ] Tenant name, code, email show correctly in header
- [ ] Status badge (green active, blue trial, etc.) displays top-right
- [ ] Stats cards: Students, Teachers, Exams, Spaces
- [ ] Subscription section: plan name, maxStudents, maxTeachers, maxSpaces
- [ ] Contact section: email, phone, contact person, website
- [ ] Features grid: enabled features show green dot, disabled show grey
- [ ] Settings: Gemini key status, AI model, timezone, locale
- [ ] "Back" link returns to tenants list

#### Global Presets (`/presets`)

- [ ] Page loads without error
- [ ] Empty state shows "No global presets" if none seeded
- [ ] "Create Preset" button opens dialog
- [ ] Dialog has: Name field, Description textarea, Default checkbox, Public
      checkbox
- [ ] Dialog has Display Settings: Show strengths, Show key takeaway, Prioritize
      by importance
- [ ] Dialog has Dimensions list with checkboxes + weight inputs (1–5)
- [ ] Save → preset appears in list with dimension badges
- [ ] Edit button → dialog pre-filled with existing data
- [ ] Delete → confirmation dialog → preset removed
- [ ] Preset cards show: name, default/public badges, dimension chips, display
      settings summary

#### System Health (`/system`)

- [ ] Page loads and shows "Running health checks…" briefly
- [ ] Firebase Auth card shows `operational` (current user is logged in)
- [ ] Firestore card shows `operational` + latency in ms
- [ ] Cloud Functions card shows `operational` (endpoint reachable)
- [ ] AI Pipeline card shows `operational` or `degraded` (degraded if no tenant
      has Gemini key set)
- [ ] Platform Metrics: Avg Response Time shows real ms, Total Users shows count
- [ ] "Refresh" button re-runs all checks

---

### Step 6 — Automated E2E Tests

Ensure emulators are running + data seeded, then:

```bash
# Super admin tests only
pnpm test:e2e:super-admin

# With visible browser
pnpm test:e2e:headed

# All E2E tests
pnpm test:e2e
```

**Existing E2E test coverage** (`tests/e2e/super-admin.spec.ts`):

1. Unauthenticated visit → redirect to `/login`
2. Successful login with super admin credentials
3. Dashboard shows correct user info + "Platform-wide" context
4. Sign out → redirect to `/login`
5. Invalid credentials → error displayed, stays on `/login`

---

## 6. Environment Config

File: `apps/super-admin/.env.local`

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=lvlup-ff6fa.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=lvlup-ff6fa
VITE_FIREBASE_STORAGE_BUCKET=lvlup-ff6fa.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_DATABASE_URL=...
VITE_USE_EMULATORS=true   # Routes traffic to local emulators
```

> `VITE_USE_EMULATORS=true` makes the app talk to local Firebase emulators
> instead of production.

---

## 7. Debugging with Emulator UI

Visit `http://localhost:4000` while emulators are running to:

- Browse all Firestore documents (`tenants`, `users`, `memberships`,
  `globalEvaluationPresets`)
- Inspect auth users and check custom claims (`isSuperAdmin`, `role`)
- View Cloud Functions invocation logs (useful for Global Presets save/delete)

Useful when:

- Login fails → check auth user exists and `isSuperAdmin` flag is set on
  `/users/{uid}`
- Dashboard shows empty stats → inspect `tenants` collection documents
- Access Denied screen → verify `isSuperAdmin: true` on `/users/{uid}` document
- Global Preset save fails → check Functions emulator logs for
  `saveGlobalEvaluationPreset`
- System Health shows "down" → check if emulators are running

---

## 8. Architecture — File Map

```
apps/super-admin/src/
├── main.tsx                  # Firebase init, React/Router/Query provider setup
├── App.tsx                   # Route tree definition
├── guards/
│   └── RequireAuth.tsx       # Auth guard: checks firebaseUser + isSuperAdmin flag
├── layouts/
│   ├── AppLayout.tsx         # Sidebar nav (Dashboard / Tenants / Presets / Health) + AppShell
│   └── AuthLayout.tsx        # Centered card layout for login
├── pages/
│   ├── LoginPage.tsx         # Email/password form → Firebase Auth
│   ├── DashboardPage.tsx     # Aggregates stats from all tenant docs
│   ├── TenantsPage.tsx       # Searchable/filterable tenant table
│   ├── TenantDetailPage.tsx  # Full tenant detail: stats, subscription, contact, features, settings
│   ├── GlobalPresetsPage.tsx # Full CRUD for globalEvaluationPresets via Cloud Function
│   └── SystemHealthPage.tsx  # Live health probes: Auth, Firestore, Functions, AI Pipeline
└── lib/
    └── utils.ts              # cn() helper (clsx + tailwind-merge)
```

**Data Flow:**

```
Super Admin App
    ↓ reads directly
Firestore (Firebase SDK)
    ├── /tenants/{tenantId}            → Dashboard, Tenants List, Tenant Detail, System Health
    └── /globalEvaluationPresets/{id}  → Global Presets page (list)

Super Admin App
    ↓ calls via httpsCallable
Cloud Functions
    └── saveGlobalEvaluationPreset     → Create / Edit / Delete presets
```

---

## 9. Beta Testing Priority Order

Run tests in this sequence for maximum coverage efficiency:

1. **Login flow** — everything depends on auth working
2. **Access denial** — security check (non-super-admin gets blocked)
3. **Dashboard stats** — verifies Firestore data model + seed is correct
4. **Tenants list + search/filter** — core use case
5. **Tenant detail** — inspect all data sections
6. **Global Presets CRUD** — create, edit, delete a preset; verify dimension
   toggles
7. **System Health** — verify live probes run and refresh works

---

## 10. Quick Reference

| Item                                 | Value                                        |
| ------------------------------------ | -------------------------------------------- |
| App URL                              | `http://localhost:4567`                      |
| Super Admin login                    | `superadmin@levelup.test` / `SuperAdmin123!` |
| Non-admin login (access denied test) | `admin@springfield.test` / `TenantAdmin123!` |
| Emulator UI                          | `http://localhost:4000`                      |
| Firestore port                       | `localhost:8080`                             |
| Auth emulator port                   | `localhost:9099`                             |
| Functions emulator port              | `localhost:5001`                             |
| Start command (super-admin only)     | `pnpm --filter @levelup/super-admin dev`     |
| Start command (all apps)             | `./start.sh`                                 |
| Seed command                         | `pnpm seed:emulator`                         |
| E2E tests                            | `pnpm test:e2e:super-admin`                  |

---

_Doc updated by Claude Code | Auto LevelUp Super Admin Beta Testing_
