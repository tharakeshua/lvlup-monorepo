# Running the LevelUp Apps

## Quick Start

```bash
./start.sh          # Start all apps
./start.sh stop     # Stop all running apps
./start.sh status   # Check which apps are running
```

---

## Apps & Ports

| App                        | Port | URL                   | Description                                     |
| -------------------------- | ---- | --------------------- | ----------------------------------------------- |
| **Super Admin**            | 4567 | http://localhost:4567 | Platform-wide super admin — manages all schools |
| **School Admin**           | 4568 | http://localhost:4568 | Tenant / school admin portal                    |
| **Teacher Portal**         | 4569 | http://localhost:4569 | Teacher dashboard & class management            |
| **Student Portal**         | 4570 | http://localhost:4570 | Student learning portal                         |
| **Parent Portal**          | 4571 | http://localhost:4571 | Parent progress tracking                        |
| **Autograde Super Admin**  | 4572 | http://localhost:4572 | Autograde platform admin                        |
| **Autograde Client Admin** | 4573 | http://localhost:4573 | Autograde school-level admin                    |
| **Autograde Scanner**      | 4574 | http://localhost:4574 | Answer-sheet scanner app                        |

---

## Default Credentials

> **Prerequisites:** Firebase emulators must be running and seeded before these
> credentials work.
>
> Start emulators: `firebase emulators:start` Seed test data:
> `pnpm run seed:emulator`

### Super Admin

| Field    | Value                                        |
| -------- | -------------------------------------------- |
| URL      | http://localhost:4567                        |
| Email    | `superadmin@levelup.test`                    |
| Password | `SuperAdmin123!`                             |
| Role     | Platform super admin (all schools, all data) |

### School Admin — Springfield Academy (SPR001)

| Field       | Value                    |
| ----------- | ------------------------ |
| URL         | http://localhost:4568    |
| Email       | `admin@springfield.test` |
| Password    | `TenantAdmin123!`        |
| School      | Springfield Academy      |
| Tenant Code | `SPR001`                 |

### Teacher — Springfield Academy

| Field    | Value                       |
| -------- | --------------------------- |
| URL      | http://localhost:4569       |
| Email    | `teacher1@springfield.test` |
| Password | `Teacher123!`               |
| School   | Springfield Academy         |

### Student — Springfield Academy

| Field    | Value                       |
| -------- | --------------------------- |
| URL      | http://localhost:4570       |
| Email    | `student1@springfield.test` |
| Password | `Student123!`               |
| School   | Springfield Academy         |

### Parent — Springfield Academy

| Field    | Value                      |
| -------- | -------------------------- |
| URL      | http://localhost:4571      |
| Email    | `parent1@springfield.test` |
| Password | `Parent123!`               |
| School   | Springfield Academy        |

---

## Step-by-Step: Run the Full Platform Locally

### 1. Install dependencies

```bash
pnpm install
```

### 2. Start Firebase emulators

```bash
firebase emulators:start
```

This starts:

- Auth emulator on port `9099`
- Firestore emulator on port `8080`
- Firebase UI on port `4000`

### 3. Seed test data

```bash
pnpm run seed:emulator
```

This creates all test users, schools, and memberships in the emulators.

### 4. Start all apps

```bash
./start.sh
```

All 8 apps will start in the background. Logs are written to `.start-logs/`.

### 5. Open the app you need

| You want to...                        | Open                                           |
| ------------------------------------- | ---------------------------------------------- |
| Manage the whole platform             | http://localhost:4567 (Super Admin)            |
| Manage a school / teachers / students | http://localhost:4568 (School Admin)           |
| Manage classes and assignments        | http://localhost:4569 (Teacher)                |
| See student experience                | http://localhost:4570 (Student)                |
| See parent experience                 | http://localhost:4571 (Parent)                 |
| Manage Autograde platform             | http://localhost:4572 (Autograde Super Admin)  |
| Manage Autograde for a school         | http://localhost:4573 (Autograde Client Admin) |
| Scan answer sheets                    | http://localhost:4574 (Autograde Scanner)      |

---

## Running Individual Apps

If you only need one app, run it directly from its directory:

```bash
# Super Admin (port 4567)
cd apps/super-admin && pnpm run dev

# School Admin (port 4568)
cd apps/admin-web && pnpm run dev

# Teacher (port 4569)
cd apps/teacher-web && pnpm run dev

# Student (port 4570)
cd apps/student-web && pnpm run dev

# Parent (port 4571)
cd apps/parent-web && pnpm run dev

# Autograde Super Admin (port 4572)
cd autograde/apps/super-admin && npm run dev

# Autograde Client Admin (port 4573)
cd autograde/apps/client-admin && npm run dev

# Autograde Scanner (port 4574)
cd autograde/apps/scanner-app && npm run dev
```

Or use turbo to run all main apps at once:

```bash
pnpm run dev   # runs turbo dev across all workspace apps
```

---

## Stopping Apps

```bash
# If started via start.sh
./start.sh stop

# If started via turbo/pnpm (Ctrl+C in the terminal running it)
```

---

## Logs

When using `./start.sh`, logs for each app are written to:

```
.start-logs/
  super_admin_levelup_.log
  school_admin_.log
  teacher_portal_.log
  student_portal_.log
  parent_portal_.log
  autograde_super_admin_.log
  autograde_client_admin_.log
  autograde_scanner_.log
```

Tail a specific app's log:

```bash
tail -f .start-logs/super_admin_levelup_.log
```

---

## Test Accounts Summary (Quick Reference)

```
Super Admin      superadmin@levelup.test     SuperAdmin123!    :4567
School Admin     admin@springfield.test       TenantAdmin123!   :4568
Teacher          teacher1@springfield.test    Teacher123!       :4569
Student          student1@springfield.test    Student123!       :4570
Parent           parent1@springfield.test     Parent123!        :4571
```
