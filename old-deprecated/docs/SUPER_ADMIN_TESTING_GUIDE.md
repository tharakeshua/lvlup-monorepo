# Super Admin App — Beta Testing Guide

> **Last Updated:** 2026-02-25 **App:** `apps/super-admin` | **Port:**
> `localhost:3000` **Status:** ✅ Fully functional for manual & E2E testing
> against the Firebase Emulator

---

## 1. What is the Super Admin App?

The Super Admin app is the **God-mode control panel** for the Auto LevelUp
platform. It is used by the **platform operator** (the team running LevelUp) —
not by any school or student.

Its purpose:

- View all tenant (school) accounts registered on the platform
- See platform-wide usage stats (tenants, users, exams, spaces)
- Inspect individual tenant details: subscription plan, feature flags, AI
  settings, contacts
- Manage **Global Evaluation Presets** (feedback rubric templates shared with
  all tenants)
- Monitor system health of Firebase services

> **Multi-tenant Architecture:** Each school/institution is a "tenant." The
> super admin sees across ALL tenants. Regular admin/teacher/student apps are
> scoped to a single tenant.

---

## 2. What Is Ready (Current Implementation Status)

### ✅ Fully Implemented Pages

| Page           | Route                | Status         | Notes                                                                                                                                                                                                          |
| -------------- | -------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Login          | `/login`             | ✅ Ready       | Email + password login. Guard redirects to `/login` if unauthenticated.                                                                                                                                        |
| Dashboard      | `/`                  | ✅ Ready       | Live platform stats from Firestore: tenant count (active/trial), total users, total exams, total spaces. Shows 5 most recent tenants.                                                                          |
| Tenants List   | `/tenants`           | ✅ Ready       | Full searchable/filterable table of all tenant docs. Filter by: all / active / trial / suspended / expired.                                                                                                    |
| Tenant Detail  | `/tenants/:tenantId` | ✅ Ready       | Stats (students, teachers, exams, spaces), subscription plan & limits, contact info, feature flags, AI settings (Gemini key, model, timezone).                                                                 |
| Global Presets | `/presets`           | ✅ UI Ready    | Lists global evaluation presets from `globalEvaluationPresets` Firestore collection. **"Create Preset" and "Edit" buttons exist but are not yet wired** (no form/modal).                                       |
| System Health  | `/system`            | ✅ Placeholder | Shows service status cards (Firebase Auth, Firestore, Cloud Functions, AI Grading). **All hardcoded to "operational"** — real-time monitoring is deferred. Metrics (response time, DAU, error rate) show `--`. |

### Auth / Security

- `RequireAuth` guard enforces `user.isSuperAdmin === true` on the Firestore
  user document
- Users without the flag see "Access Denied" screen (no data exposed)
- Firebase custom claims also set `role: 'superAdmin'` on the auth token

### Navigation (Sidebar)

Three sections:

- **Overview:** Dashboard
- **Platform:** Tenants, Global Presets
- **System:** System Health

---

## 3. Known Gaps / Not Yet Implemented

| Feature                                 | Status                                  |
| --------------------------------------- | --------------------------------------- |
| Create / Edit Global Preset form        | ❌ Buttons exist, no modal/form         |
| Tenant status change (suspend/activate) | ❌ Not implemented (read-only)          |
| Create new tenant from UI               | ❌ Tenants created via seed script only |
| System Health — real metrics            | ❌ Placeholder, hardcoded statuses      |
| Pagination on tenant list               | ❌ Loads all docs (fine for beta scale) |
| Audit log / activity history            | ❌ Not built                            |

---

## 4. How to Run & Test (Step-by-Step)

### Prerequisites

- Node.js >= 20, pnpm >= 9
- Firebase CLI installed: `npm install -g firebase-tools`
- Java (required for Firebase Emulator): `java --version`

---

### Step 1 — Start Firebase Emulators

```bash
cd /Users/subhang/Desktop/Projects/auto-levleup
firebase emulators:start
```

This starts:

- **Auth Emulator:** `localhost:9099`
- **Firestore Emulator:** `localhost:8080`
- **Functions Emulator:** `localhost:5001`
- **Realtime DB:** `localhost:9000`
- **Emulator UI:** `http://localhost:4000`

---

### Step 2 — Seed Test Data

In a new terminal:

```bash
cd /Users/subhang/Desktop/Projects/auto-levleup
pnpm seed:emulator
```

This creates the following test users and tenants:

#### Test Users

| Role            | Email                       | Password          |
| --------------- | --------------------------- | ----------------- |
| **Super Admin** | `superadmin@levelup.test`   | `SuperAdmin123!`  |
| Tenant Admin    | `admin@springfield.test`    | `TenantAdmin123!` |
| Teacher 1       | `teacher1@springfield.test` | `Teacher123!`     |
| Student 1       | `student1@springfield.test` | `Student123!`     |
| Parent 1        | `parent1@springfield.test`  | `Parent123!`      |

#### Test Tenants

- **Springfield Academy** (code: `SPR001`) — active
- **Riverside School** — active

---

### Step 3 — Start the Super Admin App

```bash
cd /Users/subhang/Desktop/Projects/auto-levleup
pnpm --filter @levelup/super-admin dev
```

Or from root (starts all apps):

```bash
pnpm dev
```

App runs at **`http://localhost:3000`**

---

### Step 4 — Manual Testing Checklist

#### Authentication

- [ ] Visit `http://localhost:3000` → redirects to `/login`
- [ ] Login with wrong password → shows error message
- [ ] Login with `superadmin@levelup.test` / `SuperAdmin123!` → lands on
      Dashboard
- [ ] Login with a non-super-admin account (e.g. `admin@springfield.test`) →
      "Access Denied"
- [ ] Click Sign Out → redirects back to `/login`

#### Dashboard

- [ ] Stats cards load (Tenants, Users, Exams, Spaces)
- [ ] "Recent Tenants" table shows seeded schools with correct status badges

#### Tenants Page

- [ ] All seeded tenants appear in the table
- [ ] Search by name (e.g. "Spring") filters results
- [ ] Filter by status badge (active / trial)
- [ ] Click "View" link for a tenant → navigates to detail page

#### Tenant Detail Page

- [ ] Tenant name, code, email in header
- [ ] Stats cards (Students, Teachers, Exams, Spaces)
- [ ] Subscription section shows plan + limits
- [ ] Contact section shows email, phone, contact person
- [ ] Features grid shows enabled/disabled toggles
- [ ] Settings section shows Gemini key status, AI model, timezone

#### Global Presets

- [ ] Page loads without errors
- [ ] If no presets seeded: empty state shows correctly
- [ ] "Create Preset" button visible (no-op for now)

#### System Health

- [ ] All 4 service cards show "operational"
- [ ] Metrics section shows `--` placeholders

---

### Step 5 — Run E2E Tests (Automated)

Make sure emulators are running and data is seeded, then:

```bash
# Run only super-admin tests
pnpm test:e2e:super-admin

# Run with browser UI visible
pnpm test:e2e:headed

# Run all E2E tests
pnpm test:e2e
```

**Covered E2E tests** (`tests/e2e/super-admin.spec.ts`):

1. Unauthenticated visit → redirect to `/login`
2. Successful login with valid credentials
3. Dashboard shows correct user info (role, email, "Platform-wide")
4. Sign out → redirect to `/login`
5. Invalid credentials → shows error, stays on `/login`

---

## 5. Emulator UI for Debugging

Visit `http://localhost:4000` while emulators are running to:

- Browse all Firestore documents (tenants, users, memberships)
- Inspect auth users and custom claims
- View function invocation logs

Useful for debugging why a login fails or why the dashboard shows empty stats.

---

## 6. Architecture Notes

```
apps/super-admin/
├── src/
│   ├── main.tsx              # Firebase init, React/Router/Query setup
│   ├── App.tsx               # Route definitions
│   ├── guards/
│   │   └── RequireAuth.tsx   # Checks firebaseUser + isSuperAdmin flag
│   ├── layouts/
│   │   ├── AppLayout.tsx     # Sidebar nav (Dashboard, Tenants, Presets, Health)
│   │   └── AuthLayout.tsx    # Centered auth card layout
│   └── pages/
│       ├── LoginPage.tsx
│       ├── DashboardPage.tsx     # Aggregates stats from all tenant docs
│       ├── TenantsPage.tsx       # List + search/filter all tenants
│       ├── TenantDetailPage.tsx  # Full tenant detail view
│       ├── GlobalPresetsPage.tsx # Global evaluation presets (read + stub buttons)
│       └── SystemHealthPage.tsx  # Placeholder health dashboard
```

**Data Flow:**

- Reads directly from Firestore collections: `tenants`,
  `globalEvaluationPresets`
- No Cloud Functions called from super-admin (reads only, no mutations yet)
- Auth via Firebase Auth (email/password) + `isSuperAdmin` flag on
  `/users/{uid}` document

---

## 7. Environment Config

File: `apps/super-admin/.env.local`

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=lvlup-ff6fa.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=lvlup-ff6fa
VITE_FIREBASE_STORAGE_BUCKET=lvlup-ff6fa.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_DATABASE_URL=...
VITE_USE_EMULATORS=true   # <-- routes all traffic to localhost emulators
```

`VITE_USE_EMULATORS=true` is what causes the app to talk to local emulators
instead of production Firebase.

---

## 8. Beta Testing Priority Order

For the first beta test session, focus in this order:

1. **Login flow** — most critical, everything depends on it
2. **Dashboard stats** — verifies Firestore data model is correct
3. **Tenants list → Tenant detail** — core use case
4. **Access denial for non-super-admin** — security check
5. **Global Presets list** — lower priority, no mutations yet
6. **System Health** — informational placeholder only

---

_Generated by Claude Code | Auto LevelUp Project_
