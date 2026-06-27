# Frontend Apps & Shared UI — Comprehensive Design Plan

## Unified LevelUp + AutoGrade B2B SaaS Platform

**Version:** 1.0 **Date:** 2026-02-19 **Author:** Frontend & Apps Engineer
**Status:** Design Plan — Ready for Implementation **References:**
UNIFIED-ARCHITECTURE-BLUEPRINT.md §6-7,
BLUEPRINT-REVIEW-RESPONSES-AND-EXTENSIONS.md §4.5-4.7

---

## Table of Contents

1. [Overview & Scope](#1-overview--scope)
2. [App Architecture](#2-app-architecture)
3. [Shared UI Library](#3-shared-ui-library)
4. [App Surface 1: Admin Web](#4-app-surface-1-admin-web)
5. [App Surface 2: Teacher Web](#5-app-surface-2-teacher-web)
6. [App Surface 3: Student Web](#6-app-surface-3-student-web)
7. [App Surface 4: Parent Web](#7-app-surface-4-parent-web)
8. [App Surface 5: Scanner App](#8-app-surface-5-scanner-app)
9. [App Surface 6: Super Admin](#9-app-surface-6-super-admin)
10. [Consumer / B2C Path](#10-consumer--b2c-path)
11. [State Management Design](#11-state-management-design)
12. [Caching Strategy](#12-caching-strategy)
13. [Routing & Navigation Architecture](#13-routing--navigation-architecture)
14. [Component Hierarchy & Shared Patterns](#14-component-hierarchy--shared-patterns)
15. [Integration Points](#15-integration-points)
16. [Testing Strategy](#16-testing-strategy)
17. [Performance Optimization Plan](#17-performance-optimization-plan)
18. [Dependencies on Other Modules](#18-dependencies-on-other-modules)
19. [Implementation Phasing](#19-implementation-phasing)

---

## 1. Overview & Scope

### 1.1 What This Document Covers

This design plan specifies the complete frontend architecture for the unified
LevelUp + AutoGrade platform. It covers:

- **6 application surfaces** — Admin Web, Teacher Web, Student Web, Parent Web,
  Scanner App, Super Admin
- **1 shared UI library** — `packages/shared-ui` built on shadcn/ui + Tailwind
  CSS
- **1 consumer (B2C) path** — public space browsing, marketplace, enrollment,
  consumer dashboard
- **Cross-cutting concerns** — routing, state management, caching, responsive
  design, authentication UI

### 1.2 Technology Stack

| Layer          | Technology                      | Version           |
| -------------- | ------------------------------- | ----------------- |
| Framework      | React                           | 18.x              |
| Language       | TypeScript                      | 5.x (strict mode) |
| Build Tool     | Vite                            | 5.x (SWC plugin)  |
| Styling        | Tailwind CSS                    | 3.x               |
| Components     | shadcn/ui (Radix UI primitives) | Latest            |
| State (client) | Zustand                         | 5.x               |
| State (server) | TanStack Query                  | 5.x               |
| Forms          | React Hook Form + Zod           | Latest            |
| Routing        | React Router                    | 6.x               |
| Icons          | Lucide React                    | Latest            |
| Charts         | Recharts                        | 2.x               |
| Notifications  | Sonner                          | Latest            |
| Math           | KaTeX                           | Latest            |
| Code Editor    | CodeMirror                      | 6.x               |
| PDF            | @react-pdf/renderer             | Latest            |
| Animations     | Framer Motion                   | 12.x              |
| Monorepo       | pnpm workspaces + Turborepo     | Latest            |

### 1.3 Design Decisions (From User Input)

| Decision               | Choice                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------- |
| App shell architecture | **Shared shell** — one AppShell with role-adaptive sidebar, used across all B2B apps                    |
| B2C pricing model      | **Hybrid marketplace** — space creators set per-space pricing (free or paid), platform commission       |
| Offline support        | **Scanner only** — full offline queue with IndexedDB + background sync; other apps require connectivity |
| Performance budget     | **Relaxed** — ship features first, optimize in Phase 6. No strict bundle limits initially               |

### 1.4 Monorepo Structure

```
auto-levelup/
├── apps/
│   ├── admin-web/          ← TenantAdmin app
│   ├── teacher-web/        ← Teacher app
│   ├── student-web/        ← Student + Consumer app
│   ├── parent-web/         ← Parent app
│   ├── scanner-mobile/     ← Scanner PWA (mobile-first)
│   └── super-admin/        ← SuperAdmin app
├── packages/
│   ├── shared-ui/          ← Component library (shadcn/ui + custom)
│   ├── shared-types/       ← TypeScript interfaces (all entities)
│   ├── shared-services/    ← Firebase service layer
│   ├── shared-hooks/       ← Reusable React hooks
│   ├── shared-utils/       ← Utilities (CSV, PDF, date, formatting)
│   ├── shared-stores/      ← Zustand stores (auth, tenant, ui)
│   ├── eslint-config/      ← ESLint rules
│   └── tailwind-config/    ← Shared Tailwind theme + presets
├── functions/              ← Cloud Functions (separate concern)
└── docs/
```

Each app in `apps/` is a standalone Vite project that imports from `packages/*`.
Apps are deployed independently to Firebase Hosting with separate domains or
subpaths.

---

## 2. App Architecture

### 2.1 Shared App Shell

All 6 B2B app surfaces share a single `AppShell` component from `shared-ui`. The
shell provides:

```
┌─────────────────────────────────────────────────────┐
│  TopBar                                              │
│  ┌────────────┬──────────────────────────────────┐  │
│  │  Logo      │  Org Switcher  │  Search │ Avatar │  │
│  └────────────┴──────────────────────────────────┘  │
├──────────┬──────────────────────────────────────────┤
│ Sidebar  │  Main Content Area                       │
│          │                                          │
│ [Nav]    │  ┌──────────────────────────────────┐   │
│ [Items]  │  │  Page Header (breadcrumb + title) │   │
│ [Per]    │  ├──────────────────────────────────┤   │
│ [Role]   │  │                                  │   │
│          │  │  Page Content                    │   │
│          │  │                                  │   │
│          │  │                                  │   │
│          │  └──────────────────────────────────┘   │
│ [Footer] │                                          │
│ [User]   │                                          │
│ [Menu]   │                                          │
├──────────┴──────────────────────────────────────────┤
│  Mobile Bottom Nav (responsive, shown < 768px)       │
└─────────────────────────────────────────────────────┘
```

**Shell Props:**

```typescript
interface AppShellProps {
  role: UserRole;
  navigation: NavItem[];
  topBarActions?: React.ReactNode;
  children: React.ReactNode;
}

interface NavItem {
  label: string;
  icon: LucideIcon;
  path: string;
  badge?: number | string;
  children?: NavItem[]; // Nested nav groups
  requiredPermission?: string; // Permission-gated visibility
  featureFlag?: string; // Feature-flag gated visibility
}
```

**Sidebar behavior:**

- **Desktop (≥1024px):** Fixed sidebar, collapsible to icon-only rail
- **Tablet (768–1023px):** Sidebar as overlay, toggle via hamburger
- **Mobile (<768px):** No sidebar, bottom tab navigation instead

### 2.2 Org Switcher Component

```
┌─────────────────────────────┐
│  Current: Springfield High   │  ▼
├─────────────────────────────┤
│  🏫 Springfield High        │  ✓
│  🏫 Oak Valley Academy      │
│  🏫 Riverside School        │
├─────────────────────────────┤
│  + Join a school             │
└─────────────────────────────┘
```

**Logic:**

1. On mount: fetch `userMemberships` where `uid == currentUser.uid` and
   `status == 'active'`
2. If 1 membership → auto-select, hide switcher dropdown
3. If 2+ → show dropdown in TopBar
4. On switch: call `switchActiveTenant` Cloud Function → force token refresh →
   update Zustand store → redirect to role dashboard

### 2.3 School-Code Login Flow

```
┌─────────────────────────┐
│   Enter School Code      │
│                          │
│   [ SPR001          ]    │
│                          │
│   [  Continue  →  ]      │
│                          │
│   ─── or ───            │
│   Don't have a code?     │
│   Login as consumer →    │
└─────────────────────────┘
         │
         ▼ (valid code found)
┌─────────────────────────┐
│   Springfield High       │
│   🏫                     │
│                          │
│   Email or Roll Number   │
│   [ student@email.com ]  │
│                          │
│   Password               │
│   [ •••••••••••       ]  │
│                          │
│   [ Sign In ]            │
│   Forgot password?       │
└─────────────────────────┘
         │
         ▼ (auth success)
   → Load memberships
   → Route to role dashboard
```

### 2.4 Responsive Design Strategy

| Breakpoint | Width       | Layout                                   |
| ---------- | ----------- | ---------------------------------------- |
| `xs`       | <640px      | Single column, bottom nav, stacked cards |
| `sm`       | 640–767px   | Single column, wider cards               |
| `md`       | 768–1023px  | Two columns, overlay sidebar             |
| `lg`       | 1024–1279px | Full layout, sidebar + content           |
| `xl`       | ≥1280px     | Full layout, max-width container         |

All data tables become scrollable cards on mobile. Forms stack vertically.
Modals become full-screen sheets on mobile.

---

## 3. Shared UI Library

### 3.1 Package: `packages/shared-ui`

The shared UI library extends the existing LevelUp shadcn/ui components (50+
base components) with platform-specific additions.

### 3.2 Base Components (from shadcn/ui — already ported from LevelUp)

| Category         | Components                                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Layout**       | `Card`, `Separator`, `ScrollArea`, `Collapsible`, `ResizablePanel`, `AspectRatio`                                   |
| **Navigation**   | `NavigationMenu`, `Breadcrumb`, `Tabs`, `Pagination`, `Sidebar`                                                     |
| **Forms**        | `Input`, `Textarea`, `Select`, `Checkbox`, `RadioGroup`, `Switch`, `Slider`, `DatePicker`, `Form` (react-hook-form) |
| **Overlay**      | `Dialog`, `Sheet`, `Drawer`, `Popover`, `Tooltip`, `DropdownMenu`, `ContextMenu`, `AlertDialog`, `HoverCard`        |
| **Data Display** | `Table`, `Badge`, `Avatar`, `Progress`, `Skeleton`, `Accordion`                                                     |
| **Feedback**     | `Alert`, `Toast` (Sonner), `Toaster`                                                                                |
| **Actions**      | `Button`, `Toggle`, `ToggleGroup`, `Command`                                                                        |

### 3.3 Platform-Specific Components (New)

#### Dashboard Components

```typescript
// DashboardCard — stat card with icon, value, trend
<DashboardCard
  title="Total Students"
  value={342}
  icon={Users}
  trend={{ value: 12, direction: 'up', label: 'vs last month' }}
/>

// DashboardGrid — responsive grid for stat cards
<DashboardGrid columns={{ xs: 1, sm: 2, lg: 4 }}>
  <DashboardCard ... />
  <DashboardCard ... />
</DashboardGrid>
```

#### Data Table (Enhanced)

```typescript
// DataTable — built on TanStack Table + shadcn Table
<DataTable
  columns={columns}
  data={students}
  searchable={{ column: 'name', placeholder: 'Search students...' }}
  filterable={[
    { column: 'status', options: ['active', 'inactive'] },
    { column: 'class', options: classes },
  ]}
  selectable              // Checkbox column
  bulkActions={[          // Actions when rows selected
    { label: 'Export CSV', action: handleExport },
    { label: 'Assign Class', action: handleAssign },
  ]}
  pagination={{ pageSize: 25 }}
  emptyState={<EmptyStudents />}
/>
```

#### App Shell Components

```typescript
// AppShell — main layout
<AppShell role={role} navigation={navItems}>
  <Outlet />
</AppShell>

// PageHeader — consistent page headers
<PageHeader
  title="Class Management"
  description="Create and manage classes for your school"
  breadcrumbs={[
    { label: 'Dashboard', href: '/' },
    { label: 'Classes' },
  ]}
  actions={<Button>Create Class</Button>}
/>

// OrgSwitcher — org selection dropdown
<OrgSwitcher
  memberships={memberships}
  currentTenantId={tenantId}
  onSwitch={handleSwitch}
/>
```

#### Role-Based Dashboard Templates

```typescript
// RoleDashboard — template with configurable sections
<RoleDashboard
  greeting={`Welcome back, ${user.displayName}`}
  stats={statsCards}
  quickActions={[
    { label: 'Create Space', icon: Plus, action: () => navigate('/spaces/new') },
    { label: 'Create Exam', icon: FileText, action: () => navigate('/exams/new') },
  ]}
  recentActivity={<ActivityFeed items={activities} />}
  widgets={[
    <UpcomingExams />,
    <ProgressSummary />,
  ]}
/>
```

#### Content Components

```typescript
// SpaceCard — learning space preview
<SpaceCard
  space={space}
  progress={progressPercent}
  onClick={() => navigate(`/spaces/${space.id}`)}
/>

// ExamCard — exam preview
<ExamCard
  exam={exam}
  status="grading"
  submissionCount={45}
  onClick={() => navigate(`/exams/${exam.id}`)}
/>

// ProgressBar — enhanced progress with label
<ProgressBar value={72} label="72% Complete" variant="success" />
```

#### Chart Components

```typescript
// StatChart — reusable chart wrapper
<StatChart
  type="bar"              // bar | line | pie | radar | area
  data={scoreDistribution}
  xKey="range"
  yKey="count"
  title="Score Distribution"
/>
```

#### Empty States

```typescript
// EmptyState — consistent empty state pattern
<EmptyState
  icon={BookOpen}
  title="No spaces yet"
  description="Create your first learning space to get started."
  action={{ label: 'Create Space', onClick: handleCreate }}
/>
```

### 3.4 Component Inventory Summary

| Category           | Count   | Source                                                                 |
| ------------------ | ------- | ---------------------------------------------------------------------- |
| Base shadcn/ui     | 50      | Ported from LevelUp                                                    |
| Dashboard          | 4       | New                                                                    |
| Data Display       | 3       | New (DataTable, StatChart, ProgressBar)                                |
| App Shell          | 4       | New (AppShell, PageHeader, OrgSwitcher, BottomNav)                     |
| Content Cards      | 5       | New (SpaceCard, ExamCard, ResultCard, ClassCard, UserCard)             |
| Feedback           | 3       | New (EmptyState, LoadingState, ErrorState)                             |
| Question Renderers | 15      | Ported from LevelUp (MCQ through chat_agent_question)                  |
| Material Renderers | 7       | Ported from LevelUp (text, video, PDF, link, interactive, story, rich) |
| **Total**          | **~91** |                                                                        |

---

## 4. App Surface 1: Admin Web

**Path:** `apps/admin-web/` **Target User:** TenantAdmin **Primary Purpose:**
School setup, user/class management, analytics, billing

### 4.1 Screen Architecture

```
Admin Web (apps/admin-web)
├── Login (school code → credentials)
├── Dashboard
│   ├── Stats Overview (students, teachers, classes, active spaces, exams)
│   ├── Quick Actions (add users, create class, import CSV)
│   ├── Recent Activity feed
│   └── Alerts (AI budget warnings, at-risk students)
│
├── Users
│   ├── Students List (searchable, filterable by class/status)
│   │   ├── Add Student (form)
│   │   ├── Student Detail (profile + class memberships + progress)
│   │   └── Bulk Import (CSV upload wizard)
│   ├── Teachers List
│   │   ├── Add Teacher (form)
│   │   ├── Teacher Detail (profile + permissions + classes)
│   │   └── Bulk Import
│   ├── Parents List
│   │   ├── Add Parent (form + link to students)
│   │   └── Parent Detail (profile + linked children)
│   └── Scanners List
│       ├── Register Scanner
│       └── Scanner Detail (status, uploads, revoke)
│
├── Classes
│   ├── Classes List (grid or table view)
│   ├── Create Class (name, subject, grade, session)
│   └── Class Detail
│       ├── Overview (student count, teacher assignments, content assigned)
│       ├── Students Tab (enrolled students, add/remove)
│       ├── Teachers Tab (assigned teachers, add/remove)
│       ├── Spaces Tab (LevelUp spaces assigned to this class)
│       ├── Exams Tab (AutoGrade exams for this class)
│       └── Analytics Tab (class-level cross-system analytics)
│
├── Academic Sessions
│   ├── Sessions List
│   ├── Create Session (name, type, dates)
│   └── Session Detail (classes in this session, archive controls)
│
├── Analytics
│   ├── Overview (tenant-wide KPIs)
│   ├── Student Analytics (engagement, performance trends)
│   ├── Content Analytics (space completion, exam pass rates)
│   ├── AI Cost Analytics (daily/monthly usage, per-model breakdown)
│   └── At-Risk Students (flagged by Insight Engine)
│
├── Settings
│   ├── School Profile (name, logo, banner, address, contact)
│   ├── Subscription (current plan, limits, usage)
│   ├── Feature Flags (enable/disable AutoGrade, LevelUp, etc.)
│   ├── AI Configuration (Gemini API key setup, default model, evaluation settings)
│   ├── Evaluation Settings (RELMS feedback dimensions, presets)
│   ├── Notification Preferences (tenant-wide defaults)
│   └── Billing (plan upgrade, usage history)
│
└── Profile & Account
```

### 4.2 Key Screens — Wireframes

#### Dashboard

```
┌──────────────────────────────────────────────────────────┐
│ Dashboard                                    [+ Quick Add]│
├──────────────────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│ │ Students │ │ Teachers │ │ Classes  │ │ AI Cost  │    │
│ │   342    │ │    28    │ │    12    │ │  $45.20  │    │
│ │ +12 ↑    │ │ +2 ↑    │ │ =        │ │ 60% bgt  │    │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘    │
│                                                          │
│ Quick Actions                                            │
│ [📥 Import Students] [➕ Create Class] [⚙️ AI Settings]  │
│                                                          │
│ Recent Activity                    Alerts                │
│ ┌─────────────────────────┐ ┌──────────────────────┐    │
│ │ • Exam "Physics Mid"    │ │ ⚠ AI budget at 60%   │    │
│ │   grading complete      │ │ ⚠ 3 at-risk students │    │
│ │ • 45 students imported  │ │                      │    │
│ │ • Space "Algebra" pub   │ │                      │    │
│ └─────────────────────────┘ └──────────────────────┘    │
└──────────────────────────────────────────────────────────┘
```

#### Bulk Student Import Wizard

```
Step 1: Upload                Step 2: Map Columns          Step 3: Review & Import
┌─────────────────┐          ┌─────────────────┐          ┌─────────────────┐
│                  │          │ CSV Column → Field│         │ 45 valid rows    │
│   Drop CSV here  │          │                  │          │  3 warnings      │
│   or click to    │          │ Col A → firstName │          │  2 errors        │
│   browse         │          │ Col B → lastName  │          │                  │
│                  │          │ Col C → rollNumber│          │ [Review Errors]  │
│  📄 template.csv │          │ Col D → email     │          │                  │
│                  │          │ Col E → classId   │          │ [Import 45 ✓]   │
└─────────────────┘          │ Col F → parentName│          └─────────────────┘
                              │ Col G → parentEmail│
                              └─────────────────┘
```

### 4.3 Navigation Items

```typescript
const adminNavigation: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/" },
  {
    label: "Users",
    icon: Users,
    path: "/users",
    children: [
      { label: "Students", icon: GraduationCap, path: "/users/students" },
      { label: "Teachers", icon: UserCog, path: "/users/teachers" },
      { label: "Parents", icon: Heart, path: "/users/parents" },
      {
        label: "Scanners",
        icon: ScanLine,
        path: "/users/scanners",
        featureFlag: "scannerAppEnabled",
      },
    ],
  },
  { label: "Classes", icon: School, path: "/classes" },
  { label: "Sessions", icon: Calendar, path: "/sessions" },
  { label: "Analytics", icon: BarChart3, path: "/analytics" },
  { label: "Settings", icon: Settings, path: "/settings" },
];
```

### 4.4 Integration Points

| Feature             | Backend Module    | Service Call                                    |
| ------------------- | ----------------- | ----------------------------------------------- |
| User CRUD           | Identity Module   | `createOrgUser`, `updateUser`, `deactivateUser` |
| Bulk import         | Identity Module   | `bulkCreateStudents` (Cloud Function)           |
| Class management    | Tenant Ops Module | `ClassesService.create/update/delete`           |
| AI config           | AI Module         | `setTenantApiKey` (Cloud Function)              |
| Evaluation settings | AutoGrade Module  | `EvaluationSettingsService.update`              |
| Analytics           | Analytics Module  | `TenantAnalyticsService.getOverview`            |
| Billing             | Identity Module   | Subscription read + plan management             |

---

## 5. App Surface 2: Teacher Web

**Path:** `apps/teacher-web/` **Target User:** Teacher **Primary Purpose:**
Content authoring (spaces + exams), grading review, class analytics

### 5.1 Screen Architecture

```
Teacher Web (apps/teacher-web)
├── Login (school code → credentials)
├── Dashboard
│   ├── My Classes (cards: student count, content count, avg progress)
│   ├── Recent Activity (space updates, exam grading status)
│   ├── Quick Actions (create space, create exam)
│   ├── Pending Grading (exams awaiting review)
│   └── At-Risk Students (from Insight Engine)
│
├── Class Detail (per class)
│   ├── Overview (students, teachers, content summary)
│   ├── Spaces Tab (LevelUp spaces assigned — table with progress)
│   ├── Exams Tab (AutoGrade exams — table with grading status)
│   ├── Students Tab (enrolled students + combined progress)
│   └── Analytics Tab (cross-system class insights)
│
├── Spaces (LevelUp Content)
│   ├── My Spaces List (filterable by class, status)
│   ├── Space Editor ← (Rich content authoring)
│   │   ├── Space Settings (title, description, type, class assignment, publish controls)
│   │   ├── Story Point List (drag-to-reorder chapters)
│   │   ├── Story Point Editor
│   │   │   ├── Section Manager (add/reorder sections)
│   │   │   ├── Item Editor (create/edit questions + materials)
│   │   │   │   ├── Question Creator (15 types, AI generation assist)
│   │   │   │   ├── Material Creator (7 types: text, video, PDF, etc.)
│   │   │   │   └── Assessment Config (quiz/test/practice settings)
│   │   │   └── Preview Mode (student view simulation)
│   │   ├── Agent Config (evaluator + tutor agent setup)
│   │   └── Space Analytics (per-space: completion, engagement)
│   └── Space Progress View (student progress per space)
│
├── Exams (AutoGrade Content)
│   ├── My Exams List (filterable by class, status)
│   ├── Exam Editor
│   │   ├── Exam Settings (title, subject, class, marks, date)
│   │   ├── Question Paper Upload (image upload → AI extraction)
│   │   ├── Question Review (extracted questions + rubric editing)
│   │   ├── Exam Link to Space (optional: link to LevelUp space)
│   │   └── Publish / Mark Ready
│   ├── Submission Manager
│   │   ├── Upload Answer Sheets (drag & drop images)
│   │   ├── Grading Status (pipeline progress per student)
│   │   ├── Grading Review (per-student, per-question)
│   │   │   ├── Answer Image Viewer (zoomable, page navigation)
│   │   │   ├── AI Grade Display (score, feedback, confidence)
│   │   │   ├── Manual Override (edit score + reason)
│   │   │   └── Feedback Edit (modify AI-generated feedback)
│   │   └── Results Release (batch release to students)
│   └── Exam Analytics (score distribution, per-question stats, pass rate)
│
├── Analytics
│   ├── Class Overview (all classes combined)
│   ├── Cross-System Insights (LevelUp engagement ↔ exam scores)
│   ├── At-Risk Students
│   └── Topic Performance (subject-level drill-down)
│
└── Profile & Settings
```

### 5.2 Key Screens — Wireframes

#### Space Editor

```
┌──────────────────────────────────────────────────────────────┐
│ ← Back to Spaces    Algebra Fundamentals         [Publish ▼] │
├──────────┬───────────────────────────────────────────────────┤
│ Chapters │  Chapter 2: Linear Equations                      │
│          │                                                    │
│ 1. Intro │  Sections                                         │
│ 2. Linear│  ┌──────────────────────────────────────────────┐ │
│   ≡ drag │  │ 📖 Material: "What is a linear equation?"    │ │
│ 3. Quad  │  │ 🎥 Video: Khan Academy link                 │ │
│ 4. Test  │  │ ❓ Question: Solve 2x + 5 = 15 (Text input) │ │
│          │  │ ❓ Question: Which is linear? (MCQ)          │ │
│ [+ Add]  │  │ 📖 Material: Practice problems PDF          │ │
│          │  │ [+ Add Item]                                  │ │
│          │  └──────────────────────────────────────────────┘ │
│ ─────────│                                                    │
│ Settings │  Item Editor (expanded)                           │
│ Agents   │  ┌──────────────────────────────────────────────┐ │
│ Analytics│  │ Type: [MCQ ▼]  Marks: [2]  Points: [10]     │ │
│          │  │                                              │ │
│          │  │ Question: Which equation is linear?          │ │
│          │  │ ○ A) x² + 2 = 0                            │ │
│          │  │ ● B) 3x + 7 = 22  ← correct               │ │
│          │  │ ○ C) x³ - 1 = 0                            │ │
│          │  │ ○ D) √x = 4                                │ │
│          │  │                                              │ │
│          │  │ Explanation: [A linear equation has...]      │ │
│          │  │ Bloom's: [Understand ▼]                     │ │
│          │  │ [Save] [Cancel]                              │ │
│          │  └──────────────────────────────────────────────┘ │
└──────────┴───────────────────────────────────────────────────┘
```

#### Grading Review

```
┌──────────────────────────────────────────────────────────────┐
│ ← Exam: Physics Midterm     Student: Rahul Sharma    [Next →]│
├──────────────────────────────┬───────────────────────────────┤
│  Answer Sheet                │  Grading                      │
│  ┌────────────────────────┐  │                               │
│  │                        │  │  Q1: Newton's Laws (5 marks)  │
│  │   [Scanned page 1]    │  │  AI Score: 4/5 (conf: 0.89)  │
│  │                        │  │  Feedback: "Correctly stated  │
│  │   ← Page 1 of 4 →     │  │  1st and 3rd law. 2nd law    │
│  │                        │  │  missing F=ma formula."       │
│  │   🔍 Zoom  🔄 Rotate  │  │                               │
│  └────────────────────────┘  │  Override: [ 4 ▼] Reason: [ ]│
│                              │  ──────────────────────────── │
│                              │  Q2: Friction (8 marks)       │
│                              │  AI Score: 6/8 (conf: 0.72)  │
│                              │  ⚠ Low confidence — review    │
│                              │  [View Rubric Breakdown]      │
│                              │                               │
│                              │  Override: [ _ ] Reason: [ ]  │
│                              │  ──────────────────────────── │
│                              │  Total: 32/50 (64%)          │
│                              │  [Approve & Next Student]     │
└──────────────────────────────┴───────────────────────────────┘
```

### 5.3 Navigation Items

```typescript
const teacherNavigation: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/" },
  { label: "Classes", icon: School, path: "/classes" },
  {
    label: "Spaces",
    icon: BookOpen,
    path: "/spaces",
    featureFlag: "levelUpEnabled",
  },
  {
    label: "Exams",
    icon: FileText,
    path: "/exams",
    featureFlag: "autoGradeEnabled",
    requiredPermission: "canCreateExams",
  },
  {
    label: "Analytics",
    icon: BarChart3,
    path: "/analytics",
    requiredPermission: "canViewAnalytics",
  },
];
```

### 5.4 Permission-Gated Features

| Feature             | Required Permission  | Fallback                          |
| ------------------- | -------------------- | --------------------------------- |
| Create/edit spaces  | `canCreateSpaces`    | Read-only view of assigned spaces |
| Create exams        | `canCreateExams`     | Not shown in nav                  |
| Edit rubrics        | `canEditRubrics`     | View rubrics read-only            |
| Override AI grades  | `canManuallyGrade`   | View only, no override controls   |
| Configure AI agents | `canConfigureAgents` | Agent config tab hidden           |
| View all exams      | `canViewAllExams`    | Only see own class exams          |

---

## 6. App Surface 3: Student Web

**Path:** `apps/student-web/` **Target User:** Student (B2B) + Consumer (B2C)
**Primary Purpose:** Learning, assessments, results, AI tutoring

### 6.1 Screen Architecture

```
Student Web (apps/student-web)
├── Login (school code → credentials OR consumer login)
├── Dashboard
│   ├── Progress Overview (combined LevelUp + AutoGrade stats)
│   ├── My Spaces (assigned learning spaces — card grid)
│   ├── My Results (recent exam results — AutoGrade)
│   ├── Recommendations (from Insight Engine — weak topic → space)
│   ├── Upcoming (exams, deadlines)
│   └── Leaderboard Preview (top 5 + user rank)
│
├── Space Viewer
│   ├── Space Home (story points list + overall progress bar)
│   ├── Story Point Viewer
│   │   ├── Material Reader
│   │   │   ├── Text Renderer (markdown + math + code)
│   │   │   ├── Video Player (embedded or linked)
│   │   │   ├── PDF Viewer (in-app preview)
│   │   │   ├── Interactive Content
│   │   │   └── Rich Content (blog-style)
│   │   ├── Question Answerer (per-question interaction)
│   │   │   ├── MCQ / MCAQ / True-False
│   │   │   ├── Text / Paragraph / Code
│   │   │   ├── Fill-in-Blanks / Fill-Blanks-DD
│   │   │   ├── Matching / Jumbled
│   │   │   ├── Numerical
│   │   │   ├── Audio / Image Evaluation
│   │   │   ├── Group Options
│   │   │   └── Chat Agent Question
│   │   └── Section Progress (items completed / total)
│   ├── Timed Test Runner (immersive full-screen)
│   │   ├── Question Navigator (grid with 5-status coloring)
│   │   ├── Answer Area (per question type renderer)
│   │   ├── Timer Display (countdown, server-enforced)
│   │   ├── Mark for Review toggle
│   │   └── Submit / Auto-submit on expiry
│   ├── Practice Mode (infinite drill)
│   │   ├── Question + Immediate Feedback
│   │   ├── Streak Counter
│   │   └── Progress to RTDB (live)
│   └── AI Tutor Chat (slide-over panel)
│       ├── Context: current item / story point
│       ├── Message Thread (user + AI)
│       ├── Input with send
│       └── New Session / History
│
├── Exam Results
│   ├── Results List (all exams with scores)
│   ├── Result Detail
│   │   ├── Score Summary (total score, percentage, grade, pass/fail)
│   │   ├── Per-Question Breakdown
│   │   │   ├── Question Text + Student Answer Image
│   │   │   ├── AI Score + Rubric Breakdown
│   │   │   ├── Structured Feedback (strengths, weaknesses, missing)
│   │   │   └── Mistake Classification (conceptual / silly / knowledge gap)
│   │   ├── Recommendations (linked LevelUp spaces for weak topics)
│   │   └── PDF Download
│   └── Progress Over Time (exam score trend chart)
│
├── Leaderboard
│   ├── Space Leaderboards (per-space rankings)
│   └── Overall Leaderboard (cross-space points)
│
├── Profile
│   ├── Personal Info
│   ├── Progress Summary (visual)
│   └── Settings (theme, notifications)
│
└── [Consumer Only]
    ├── Store (browse public spaces)
    ├── My Enrolled Spaces
    └── Purchase History
```

### 6.2 Key Screens — Wireframes

#### Student Dashboard

```
┌──────────────────────────────────────────────────────────┐
│ Hi, Rahul! 👋                                            │
├──────────────────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│ │ Spaces   │ │ Avg Score│ │ Streak   │ │ Rank     │    │
│ │ 4 active │ │ 78%      │ │ 5 days🔥│ │ #12      │    │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘    │
│                                                          │
│ My Spaces                                   [View All →] │
│ ┌────────────┐ ┌────────────┐ ┌────────────┐           │
│ │ 📐         │ │ ⚛️          │ │ 🧪         │           │
│ │ Algebra    │ │ Physics    │ │ Chemistry  │           │
│ │ ████░░ 72% │ │ ██░░░░ 34% │ │ ░░░░░░ 0%  │           │
│ │ [Continue] │ │ [Continue] │ │ [Start]    │           │
│ └────────────┘ └────────────┘ └────────────┘           │
│                                                          │
│ Recent Results                              [View All →] │
│ ┌──────────────────────────────────────────────────┐    │
│ │ Physics Midterm          78/100  78%    [View →] │    │
│ │ Math Unit Test           45/50   90%    [View →] │    │
│ └──────────────────────────────────────────────────┘    │
│                                                          │
│ Recommendations                                          │
│ 📌 "Practice Linear Equations — weak in last exam"      │
│    [Open Space →]                                        │
└──────────────────────────────────────────────────────────┘
```

#### Timed Test Runner

```
┌──────────────────────────────────────────────────────────┐
│  Physics Quiz — Chapter 3         ⏱ 18:32 remaining     │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Question 5 of 20                                        │
│                                                          │
│  A ball is thrown vertically upward with velocity        │
│  20 m/s. What is the maximum height reached?             │
│  (Take g = 10 m/s²)                                     │
│                                                          │
│  ○ A) 10 m                                               │
│  ○ B) 20 m                                               │
│  ○ C) 30 m                                               │
│  ○ D) 40 m                                               │
│                                                          │
│  [☐ Mark for Review]                                     │
│                                                          │
├──────────────────────────────────────────────────────────┤
│  Question Navigator                                      │
│  ┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐            │
│  │✓1││✓2││✓3││✓4││⬤5││ 6││ 7││ 8││ 9││10│            │
│  └──┘└──┘└──┘└──┘└──┘└──┘└──┘└──┘└──┘└──┘            │
│  ┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐            │
│  │11││12││13││14││15││16││17││18││19││20│            │
│  └──┘└──┘└──┘└──┘└──┘└──┘└──┘└──┘└──┘└──┘            │
│                                                          │
│  ✓ Answered (4)  ⬤ Current  ★ Review  ○ Not visited     │
│                                                          │
│  [← Previous]                    [Next →]    [Submit]    │
└──────────────────────────────────────────────────────────┘
```

### 6.3 Question Renderer Components

All 15 question types have dedicated renderer components:

| #   | Type             | Component              | Interaction                       |
| --- | ---------------- | ---------------------- | --------------------------------- |
| 1   | MCQ              | `MCQRenderer`          | Radio buttons, single select      |
| 2   | MCAQ             | `MCAQRenderer`         | Checkboxes, multi-select          |
| 3   | True/False       | `TrueFalseRenderer`    | Two-option radio                  |
| 4   | Numerical        | `NumericalRenderer`    | Number input with unit            |
| 5   | Text             | `TextRenderer`         | Single-line text input            |
| 6   | Paragraph        | `ParagraphRenderer`    | Multi-line textarea with markdown |
| 7   | Code             | `CodeRenderer`         | CodeMirror editor (Python)        |
| 8   | Fill-Blanks      | `FillBlanksRenderer`   | Inline text inputs in passage     |
| 9   | Fill-Blanks-DD   | `FillBlanksDDRenderer` | Inline dropdowns in passage       |
| 10  | Matching         | `MatchingRenderer`     | Drag-and-drop matching pairs      |
| 11  | Jumbled          | `JumbledRenderer`      | Drag-to-reorder                   |
| 12  | Audio            | `AudioRenderer`        | Audio recorder + playback         |
| 13  | Image Evaluation | `ImageEvalRenderer`    | Image upload + annotation         |
| 14  | Group Options    | `GroupOptionsRenderer` | Categorize items into groups      |
| 15  | Chat Agent       | `ChatAgentRenderer`    | Conversational AI interaction     |

Each renderer implements a common interface:

```typescript
interface QuestionRendererProps {
  item: UnifiedItem;
  mode: "answer" | "review" | "preview";
  value?: StudentAnswer;
  onChange?: (answer: StudentAnswer) => void;
  feedback?: UnifiedEvaluationResult;
  disabled?: boolean;
}
```

---

## 7. App Surface 4: Parent Web

**Path:** `apps/parent-web/` **Target User:** Parent/Guardian **Primary
Purpose:** View children's progress and exam results

### 7.1 Screen Architecture

```
Parent Web (apps/parent-web)
├── Login (school code → credentials)
├── Dashboard
│   ├── Children Selector (tabs or dropdown for multiple children)
│   ├── Child Overview
│   │   ├── Progress Summary (combined LevelUp + AutoGrade)
│   │   ├── Recent Results (latest exam scores)
│   │   ├── Active Spaces (current learning activities)
│   │   └── Alerts (at-risk flags, result releases)
│   └── Org Switcher (if child in multiple schools)
│
├── Child Detail
│   ├── Progress
│   │   ├── Space Progress (per-space completion bars)
│   │   └── Score Trends (line chart over time)
│   ├── Exam Results
│   │   ├── Results List (all exams)
│   │   └── Result Detail (per-question feedback, PDF download)
│   ├── Spaces
│   │   └── Space Progress (read-only view of child's work)
│   └── Recommendations (weak topic → suggested content)
│
├── Notifications
│   ├── Result Release alerts
│   ├── At-Risk alerts
│   └── Weekly Progress Digest
│
└── Profile & Settings
    ├── Notification Preferences
    └── Account Settings
```

### 7.2 Key Screen — Wireframe

#### Parent Dashboard

```
┌──────────────────────────────────────────────────────────┐
│ Your Children                                             │
├──────────────────────────────────────────────────────────┤
│  [Rahul (Grade 10)]  [Priya (Grade 7)]                  │
│                                                          │
│  Rahul's Overview                                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                │
│  │ Avg Score│ │ Spaces   │ │ Attendance│                │
│  │ 78%      │ │ 4/6 done │ │ 95%      │                │
│  └──────────┘ └──────────┘ └──────────┘                │
│                                                          │
│  Recent Exam Results                                     │
│  ┌────────────────────────────────────────────┐          │
│  │ Physics Midterm   78/100   B+   [View →]  │          │
│  │ Math Final        92/100   A    [View →]  │          │
│  │ Chemistry Quiz    65/100   C+   [View →]  │          │
│  └────────────────────────────────────────────┘          │
│                                                          │
│  Score Trend                                             │
│  100│      ●                                             │
│   80│  ●       ●   ●                                    │
│   60│              ●                                     │
│   40│                                                    │
│     └─────────────────────                              │
│      Sep  Oct  Nov  Dec  Jan                             │
└──────────────────────────────────────────────────────────┘
```

### 7.3 Navigation Items

```typescript
const parentNavigation: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/" },
  { label: "Results", icon: FileText, path: "/results" },
  { label: "Progress", icon: TrendingUp, path: "/progress" },
  {
    label: "Notifications",
    icon: Bell,
    path: "/notifications",
    badge: unreadCount,
  },
];
```

---

## 8. App Surface 5: Scanner App

**Path:** `apps/scanner-mobile/` **Target User:** Scanner Operator **Primary
Purpose:** Scan and upload answer sheets with offline support

### 8.1 Screen Architecture

```
Scanner App (apps/scanner-mobile) — Mobile-First PWA
├── Login (school code → scanner device credentials)
├── Exam Selector
│   ├── Active Exams (cards: exam name, class, status)
│   └── Select Exam → Select Class
│
├── Student Selector
│   ├── Student List (for selected exam + class)
│   ├── Search by roll number or name
│   └── Status indicators (uploaded / not uploaded)
│
├── Capture
│   ├── Camera View (full-screen)
│   │   ├── Capture button
│   │   ├── Page counter (Page 1 of N)
│   │   ├── Auto-crop guide overlay
│   │   └── Gallery preview strip (captured pages)
│   ├── Page Review
│   │   ├── Rotate / Retake
│   │   └── Confirm & Add Next
│   └── Upload Confirmation
│       ├── Preview all pages
│       ├── Student assignment
│       └── [Upload] / [Save to Queue]
│
├── Upload Queue (offline support)
│   ├── Pending Uploads (count + details)
│   ├── Upload Progress (per-submission)
│   ├── Retry Failed
│   └── Connectivity Status indicator
│
└── Settings
    ├── Capture Quality (resolution/compression)
    └── Device Info
```

### 8.2 Offline Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Scanner App                         │
│                                                      │
│   [Camera Capture] → [IndexedDB Queue]              │
│                            │                         │
│                   ┌────────┴────────┐               │
│                   │ Online?          │               │
│                   ├── Yes ──────────┤               │
│                   │  Upload now     │               │
│                   │  via CF         │               │
│                   ├── No ───────────┤               │
│                   │  Queue locally  │               │
│                   │  Show "X pend"  │               │
│                   └────────┬────────┘               │
│                            │                         │
│                   [Background Sync API]              │
│                   On reconnect → flush queue         │
│                                                      │
│   Service Worker: Cache shell + static assets        │
│   navigator.onLine → connectivity indicator          │
└─────────────────────────────────────────────────────┘
```

**IndexedDB Schema:**

```typescript
interface QueuedUpload {
  id: string; // UUID
  examId: string;
  classId: string;
  studentId: string;
  pages: Blob[]; // Captured images
  capturedAt: number; // Timestamp
  status: "queued" | "uploading" | "failed" | "completed";
  retryCount: number;
  error?: string;
}
```

### 8.3 Key Screen — Wireframe (Mobile)

```
┌─────────────────────┐
│  Scanner             │
│  Springfield High    │
├─────────────────────┤
│                      │
│  Active Exams        │
│                      │
│  ┌─────────────────┐│
│  │ Physics Midterm  ││
│  │ Grade 10-A      ││
│  │ 23/45 uploaded  ││
│  │ [Scan →]        ││
│  └─────────────────┘│
│                      │
│  ┌─────────────────┐│
│  │ Math Final      ││
│  │ Grade 10-B      ││
│  │ 0/38 uploaded   ││
│  │ [Scan →]        ││
│  └─────────────────┘│
│                      │
├─────────────────────┤
│ 📷 Scan  📤 Queue(3)│
│          ⚙️ Settings │
└─────────────────────┘
```

---

## 9. App Surface 6: Super Admin

**Path:** `apps/super-admin/` **Target User:** SuperAdmin (platform operator)
**Primary Purpose:** Tenant management, platform analytics, global configuration

### 9.1 Screen Architecture

```
Super Admin (apps/super-admin)
├── Login (email/password — no school code)
├── Dashboard
│   ├── Platform Stats (total tenants, users, exams, AI cost)
│   ├── Active Tenants trend chart
│   ├── AI Cost trend chart (daily/monthly)
│   ├── Recent Events (new tenants, suspensions, alerts)
│   └── System Health (function errors, latency)
│
├── Tenants
│   ├── Tenants List (searchable, filterable by status/plan)
│   ├── Create Tenant (name, code, owner email, plan)
│   ├── Tenant Detail
│   │   ├── Profile (name, code, contact, branding)
│   │   ├── Subscription (plan, limits, usage)
│   │   ├── Feature Flags (toggle AutoGrade, LevelUp, etc.)
│   │   ├── Users (tenant's users, browsable)
│   │   ├── AI Usage (cost breakdown, budget)
│   │   ├── Analytics (tenant-specific KPIs)
│   │   └── Actions (suspend / reactivate / delete)
│   └── Tenant Comparison (side-by-side metrics)
│
├── Users
│   ├── Global User Search (cross-tenant)
│   ├── User Detail (memberships, activity)
│   └── Manage Memberships (add/remove from tenants)
│
├── Analytics
│   ├── Platform Overview (aggregated across all tenants)
│   ├── AI Cost Dashboard (per-tenant, per-model breakdown)
│   ├── Growth Metrics (user acquisition, churn)
│   └── Feature Adoption (which features used by which tenants)
│
├── Settings
│   ├── Global Evaluation Presets (default RELMS dimensions)
│   ├── Platform Configuration
│   ├── Scanner Device Registry
│   └── Platform Public Tenant Config
│
└── Profile
```

### 9.2 Navigation Items

```typescript
const superAdminNavigation: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/" },
  { label: "Tenants", icon: Building2, path: "/tenants" },
  { label: "Users", icon: Users, path: "/users" },
  { label: "Analytics", icon: BarChart3, path: "/analytics" },
  { label: "AI Costs", icon: DollarSign, path: "/ai-costs" },
  { label: "Settings", icon: Settings, path: "/settings" },
];
```

---

## 10. Consumer / B2C Path

### 10.1 Overview

The consumer path is integrated into `apps/student-web/` as an alternative entry
point. Consumers are users without any `userMembership` records who access
public/purchased spaces in the `platform_public` tenant.

### 10.2 Consumer Screens

```
Consumer Path (within apps/student-web)
├── Landing Page (marketing — public, no auth required)
│   ├── Hero Section (value proposition)
│   ├── Featured Spaces (curated public spaces)
│   ├── Subject Categories
│   └── CTA: Sign Up / Browse Store
│
├── Store (public space browsing — no auth required to browse)
│   ├── Space Catalog (grid of public spaces)
│   │   ├── Search + Filters (subject, grade, price, rating)
│   │   ├── Sort (popular, newest, highest rated)
│   │   └── Space Preview Cards (thumbnail, title, price, rating)
│   ├── Space Detail (public preview)
│   │   ├── Description, syllabus, instructor info
│   │   ├── Reviews / Ratings
│   │   ├── Price (free or paid)
│   │   ├── [Enroll Free] / [Purchase — ₹X]
│   │   └── Sample Content Preview
│   └── Category Pages (by subject / grade)
│
├── Auth (consumer-specific)
│   ├── Sign Up (email + Google/Apple OAuth)
│   │   └── No school code required
│   ├── Login (email + Google/Apple OAuth)
│   └── Profile Completion (name, grade, preferences)
│
├── Consumer Dashboard (authenticated)
│   ├── My Enrolled Spaces (grid)
│   ├── Continue Learning (recently active)
│   ├── Recommended Spaces
│   └── Leaderboard Preview
│
├── Purchase / Enrollment
│   ├── Enrollment Confirmation (free spaces)
│   ├── Checkout (paid spaces — Razorpay / Stripe)
│   │   ├── Price display
│   │   ├── Payment method selection
│   │   └── Confirmation + Receipt
│   └── Purchase History
│
├── Learning Experience (same as B2B student)
│   ├── Space Viewer (identical to school student)
│   ├── Practice Mode
│   ├── Timed Tests (if space has assessments)
│   └── AI Chat Tutor
│
└── Consumer Leaderboard
    ├── Per-Space Rankings
    └── Global Consumer Rankings
```

### 10.3 Marketplace Model

```
Space Pricing Flow:
┌───────────────────────────────────────────────────────┐
│ Space Creator (Teacher/Admin) sets:                    │
│   accessType: 'public_store'                          │
│   pricing: {                                          │
│     model: 'free' | 'one_time' | 'subscription'      │
│     amount?: number        // in smallest currency unit│
│     currency: 'INR' | 'USD'                           │
│     platformCommission: 0.2  // 20% platform fee      │
│   }                                                   │
│                                                       │
│ Consumer purchases:                                    │
│   1. Select space → Click Purchase                    │
│   2. Razorpay checkout opens                          │
│   3. Payment confirmed via webhook                    │
│   4. Cloud Function adds spaceId to                   │
│      user.consumerProfile.enrolledSpaceIds            │
│   5. Consumer can now access full space content       │
└───────────────────────────────────────────────────────┘
```

### 10.4 Consumer vs School Student Routing

```typescript
// In apps/student-web/src/App.tsx
function App() {
  const { user, memberships, isConsumer } = useAuthStore();

  return (
    <Routes>
      {/* Public routes — no auth */}
      <Route path="/store" element={<StorePage />} />
      <Route path="/store/:spaceId" element={<SpacePreviewPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<ConsumerSignupPage />} />

      {/* Authenticated routes */}
      <Route element={<ProtectedRoute />}>
        {isConsumer ? (
          // Consumer layout — no org context
          <Route element={<ConsumerLayout />}>
            <Route path="/" element={<ConsumerDashboard />} />
            <Route path="/enrolled" element={<EnrolledSpaces />} />
            <Route path="/purchases" element={<PurchaseHistory />} />
            <Route path="/spaces/:id/*" element={<SpaceViewer />} />
            <Route path="/leaderboard" element={<ConsumerLeaderboard />} />
          </Route>
        ) : (
          // School student layout — with org context
          <Route element={<AppShell role="student" navigation={studentNav} />}>
            <Route path="/" element={<StudentDashboard />} />
            <Route path="/spaces" element={<MySpaces />} />
            <Route path="/spaces/:id/*" element={<SpaceViewer />} />
            <Route path="/results" element={<ExamResults />} />
            <Route path="/results/:id" element={<ResultDetail />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
          </Route>
        )}
      </Route>
    </Routes>
  );
}
```

---

## 11. State Management Design

### 11.1 Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                    App Layer                      │
│                                                   │
│  ┌──────────────┐     ┌──────────────────────┐  │
│  │   Zustand     │     │   TanStack Query      │  │
│  │  (Client)     │     │   (Server State)      │  │
│  │               │     │                        │  │
│  │  authStore    │     │  useSpaces()          │  │
│  │  tenantStore  │     │  useExams()           │  │
│  │  uiStore      │     │  useStudents()        │  │
│  │               │     │  useProgress()         │  │
│  └──────┬───────┘     └─────────┬────────────┘  │
│         │                       │                 │
│    localStorage              Firebase SDK         │
│    (persistence)         (Firestore / RTDB)       │
└─────────────────────────────────────────────────┘
```

### 11.2 Zustand Stores

Located in `packages/shared-stores/`:

#### authStore

```typescript
// packages/shared-stores/src/auth.store.ts
interface AuthState {
  // State
  user: UnifiedUser | null;
  memberships: UserMembership[];
  activeMembership: UserMembership | null;
  activeTenantId: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isConsumer: boolean;
  error: string | null;

  // Actions
  setUser: (user: UnifiedUser) => void;
  setMemberships: (memberships: UserMembership[]) => void;
  setActiveTenant: (tenantId: string) => void;
  switchTenant: (tenantId: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginWithSchoolCode: (
    code: string,
    email: string,
    password: string
  ) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // ...implementation
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({
        user: state.user,
        activeTenantId: state.activeTenantId,
        activeMembership: state.activeMembership,
        isConsumer: state.isConsumer,
      }),
    }
  )
);
```

#### tenantStore

```typescript
// packages/shared-stores/src/tenant.store.ts
interface TenantState {
  // State
  tenant: Tenant | null;
  features: Tenant["features"] | null;
  subscription: Tenant["subscription"] | null;
  isLoading: boolean;

  // Actions
  loadTenant: (tenantId: string) => Promise<void>;
  updateSettings: (settings: Partial<Tenant["settings"]>) => Promise<void>;
  clearTenant: () => void;
}
```

#### uiStore

```typescript
// packages/shared-stores/src/ui.store.ts
interface UIState {
  // State
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  theme: "light" | "dark" | "system";
  mobileNavOpen: boolean;

  // Actions
  toggleSidebar: () => void;
  collapseSidebar: () => void;
  setTheme: (theme: "light" | "dark" | "system") => void;
  toggleMobileNav: () => void;
}
```

### 11.3 TanStack Query Patterns

Located in `packages/shared-hooks/`:

#### Query Key Factory

```typescript
// packages/shared-hooks/src/queryKeys.ts
export const queryKeys = {
  // Tenant-scoped keys
  spaces: {
    all: (tenantId: string) => ["spaces", tenantId] as const,
    list: (tenantId: string, filters?: SpaceFilters) =>
      ["spaces", tenantId, "list", filters] as const,
    detail: (tenantId: string, spaceId: string) =>
      ["spaces", tenantId, spaceId] as const,
    storyPoints: (tenantId: string, spaceId: string) =>
      ["spaces", tenantId, spaceId, "storyPoints"] as const,
    items: (tenantId: string, spaceId: string) =>
      ["spaces", tenantId, spaceId, "items"] as const,
  },
  exams: {
    all: (tenantId: string) => ["exams", tenantId] as const,
    list: (tenantId: string, filters?: ExamFilters) =>
      ["exams", tenantId, "list", filters] as const,
    detail: (tenantId: string, examId: string) =>
      ["exams", tenantId, examId] as const,
    questions: (tenantId: string, examId: string) =>
      ["exams", tenantId, examId, "questions"] as const,
    submissions: (tenantId: string, examId: string) =>
      ["exams", tenantId, examId, "submissions"] as const,
  },
  students: {
    all: (tenantId: string) => ["students", tenantId] as const,
    list: (tenantId: string, filters?: StudentFilters) =>
      ["students", tenantId, "list", filters] as const,
    detail: (tenantId: string, studentId: string) =>
      ["students", tenantId, studentId] as const,
  },
  classes: {
    all: (tenantId: string) => ["classes", tenantId] as const,
    list: (tenantId: string) => ["classes", tenantId, "list"] as const,
    detail: (tenantId: string, classId: string) =>
      ["classes", tenantId, classId] as const,
  },
  progress: {
    space: (tenantId: string, userId: string, spaceId: string) =>
      ["progress", tenantId, userId, spaceId] as const,
    summary: (tenantId: string, userId: string) =>
      ["progress", tenantId, userId, "summary"] as const,
  },
  analytics: {
    tenant: (tenantId: string) => ["analytics", tenantId] as const,
    class: (tenantId: string, classId: string) =>
      ["analytics", tenantId, "class", classId] as const,
    exam: (tenantId: string, examId: string) =>
      ["analytics", tenantId, "exam", examId] as const,
  },
} as const;
```

#### Example Hook — useSpaces

```typescript
// packages/shared-hooks/src/spaces/useSpaces.ts
export function useSpaces(filters?: SpaceFilters) {
  const tenantId = useAuthStore((s) => s.activeTenantId);

  return useQuery({
    queryKey: queryKeys.spaces.list(tenantId!, filters),
    queryFn: () => SpacesService.list(tenantId!, filters),
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000, // 5 minutes for lists
  });
}

export function useSpace(spaceId: string) {
  const tenantId = useAuthStore((s) => s.activeTenantId);

  return useQuery({
    queryKey: queryKeys.spaces.detail(tenantId!, spaceId),
    queryFn: () => SpacesService.get(tenantId!, spaceId),
    enabled: !!tenantId && !!spaceId,
    staleTime: 30 * 1000, // 30 seconds for detail views
  });
}

export function useCreateSpace() {
  const tenantId = useAuthStore((s) => s.activeTenantId);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateSpaceInput) =>
      SpacesService.create(tenantId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.spaces.all(tenantId!),
      });
    },
  });
}
```

#### Real-Time Subscription Hook

```typescript
// packages/shared-hooks/src/realtime/useFirestoreSubscription.ts
export function useFirestoreSubscription<T>(
  queryKey: QueryKey,
  subscriptionFn: () => Unsubscribe,
  transform: (snapshot: DocumentSnapshot | QuerySnapshot) => T
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubscribe = subscriptionFn();
    return () => unsubscribe();
  }, [queryKey]);

  return useQuery<T>({
    queryKey,
    queryFn: () => {
      /* initial fetch */
    },
    staleTime: Infinity, // Real-time data never goes stale
  });
}

// Usage for leaderboard (RTDB)
export function useLeaderboard(spaceId: string) {
  const tenantId = useAuthStore((s) => s.activeTenantId);

  return useRTDBSubscription(
    ["leaderboard", tenantId, spaceId],
    ref(rtdb, `leaderboards/${tenantId}/${spaceId}`),
    (snapshot) => parseLeaderboardData(snapshot.val())
  );
}
```

### 11.4 Stale Time Configuration Summary

| Data Type                                | staleTime | Rationale                          |
| ---------------------------------------- | --------- | ---------------------------------- |
| Lists (spaces, exams, students, classes) | 5 min     | Changes infrequently, reduce reads |
| Detail views (space, exam, student)      | 30 sec    | May be collaboratively edited      |
| Progress data (space progress)           | 10 sec    | Actively changing during learning  |
| Real-time (leaderboards, live grading)   | Infinity  | Updated via subscriptions          |
| Analytics (dashboards, charts)           | 10 min    | Pre-aggregated, slow-moving        |
| User profile                             | 30 min    | Rarely changes                     |
| Platform stats (super admin)             | 5 min     | Aggregated, periodic refresh       |

---

## 12. Caching Strategy

### 12.1 Multi-Layer Caching

```
Layer 1: CDN (Firebase Hosting)
  └── Static assets: JS, CSS, images, fonts
  └── Cache-Control: max-age=31536000 for hashed assets (/assets/main.[hash].js)
  └── Cache-Control: no-cache for index.html (always fetch latest)

Layer 2: TanStack Query (in-memory)
  └── Firestore query results cached per query key
  └── Automatic refetch on window focus (configurable)
  └── Garbage collection for unused queries (5 min gcTime)
  └── Optimistic updates for mutations

Layer 3: Zustand + localStorage
  └── User profile (auth state, active tenant, membership)
  └── UI preferences (theme, sidebar state)
  └── Survives page refresh, clears on logout

Layer 4: Firebase SDK Cache
  └── Firestore persistence enabled for offline reads
  └── RTDB keepSynced for leaderboards and practice progress

Layer 5: Service Worker (Scanner app only)
  └── App shell + static assets cached
  └── IndexedDB for queued uploads
```

### 12.2 Cache Invalidation Strategy

| Event                  | Invalidation                                             |
| ---------------------- | -------------------------------------------------------- |
| Space created/updated  | `queryKeys.spaces.all(tenantId)`                         |
| Exam grading complete  | `queryKeys.exams.detail(tenantId, examId)` + submissions |
| Student added to class | `queryKeys.classes.detail(tenantId, classId)` + students |
| Tenant switched        | Clear all tenant-scoped queries                          |
| Logout                 | Clear all queries + localStorage                         |
| Real-time update       | Direct cache update via subscription callback            |

---

## 13. Routing & Navigation Architecture

### 13.1 Route Structure Per App

```typescript
// Route patterns across all apps

// Admin Web
/                           → AdminDashboard
/users/students             → StudentsList
/users/students/:id         → StudentDetail
/users/students/import      → BulkImport
/users/teachers             → TeachersList
/users/teachers/:id         → TeacherDetail
/users/parents              → ParentsList
/users/scanners             → ScannersList
/classes                    → ClassesList
/classes/:id                → ClassDetail
/sessions                   → SessionsList
/analytics                  → AnalyticsDashboard
/analytics/ai-cost          → AICostDashboard
/settings                   → TenantSettings
/settings/evaluation        → EvaluationSettings
/settings/billing           → BillingPage

// Teacher Web
/                           → TeacherDashboard
/classes                    → MyClasses
/classes/:id                → ClassDetail
/spaces                     → MySpaces
/spaces/new                 → SpaceCreator
/spaces/:id/edit            → SpaceEditor
/spaces/:id/analytics       → SpaceAnalytics
/exams                      → MyExams
/exams/new                  → ExamCreator
/exams/:id/edit             → ExamEditor
/exams/:id/submissions      → SubmissionManager
/exams/:id/grading/:subId   → GradingReview
/exams/:id/results          → ExamResults
/exams/:id/analytics        → ExamAnalytics
/analytics                  → AnalyticsDashboard

// Student Web (B2B)
/                           → StudentDashboard
/spaces                     → MySpaces
/spaces/:id                 → SpaceHome
/spaces/:id/sp/:spId        → StoryPointViewer
/spaces/:id/sp/:spId/test   → TimedTestRunner  (full-screen)
/spaces/:id/sp/:spId/practice → PracticeMode
/spaces/:id/chat            → AIChatTutor
/results                    → ExamResultsList
/results/:id                → ResultDetail
/leaderboard                → LeaderboardPage

// Student Web (Consumer / B2C)
/store                      → SpaceStore (public)
/store/:id                  → SpacePreview (public)
/signup                     → ConsumerSignup
/                           → ConsumerDashboard
/enrolled                   → EnrolledSpaces
/enrolled/:id               → SpaceViewer (reuses B2B viewer)
/purchases                  → PurchaseHistory
/leaderboard                → ConsumerLeaderboard

// Parent Web
/                           → ParentDashboard
/children/:id               → ChildDetail
/children/:id/results       → ChildResults
/children/:id/results/:rid  → ResultDetail
/children/:id/progress      → ChildProgress
/notifications              → NotificationsPage

// Scanner App
/                           → ExamSelector
/exam/:id                   → StudentSelector
/exam/:id/capture/:studentId → CaptureScreen
/queue                      → UploadQueue

// Super Admin
/                           → PlatformDashboard
/tenants                    → TenantsList
/tenants/new                → CreateTenant
/tenants/:id                → TenantDetail
/users                      → GlobalUserSearch
/users/:uid                 → UserDetail
/analytics                  → PlatformAnalytics
/ai-costs                   → AICostDashboard
/settings                   → PlatformSettings
```

### 13.2 Route Protection

```typescript
// packages/shared-hooks/src/auth/ProtectedRoute.tsx
interface ProtectedRouteProps {
  requiredRole?: UserRole | UserRole[];
  requiredPermission?: string;
  requiredFeature?: keyof Tenant['features'];
  fallback?: React.ReactNode;
}

function ProtectedRoute({
  requiredRole,
  requiredPermission,
  requiredFeature,
  fallback = <Navigate to="/login" />,
}: ProtectedRouteProps) {
  const { isAuthenticated, activeMembership } = useAuthStore();
  const { features } = useTenantStore();

  if (!isAuthenticated) return <Navigate to="/login" />;

  if (requiredRole) {
    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    if (!roles.includes(activeMembership?.role)) return fallback;
  }

  if (requiredPermission) {
    if (!activeMembership?.permissions?.[requiredPermission]) return fallback;
  }

  if (requiredFeature) {
    if (!features?.[requiredFeature]) return fallback;
  }

  return <Outlet />;
}
```

### 13.3 Code Splitting Strategy

Each app lazy-loads pages at the route level:

```typescript
const SpaceEditor = lazy(() => import("./pages/SpaceEditor"));
const ExamEditor = lazy(() => import("./pages/ExamEditor"));
const GradingReview = lazy(() => import("./pages/GradingReview"));
const AnalyticsDashboard = lazy(() => import("./pages/AnalyticsDashboard"));
```

Heavy components loaded on demand:

- **CodeMirror** — loaded only in `CodeRenderer`
- **Recharts** — loaded only in analytics pages
- **KaTeX** — loaded only when math content detected
- **@react-pdf/renderer** — loaded only on PDF export
- **Framer Motion** — loaded only for animated components

---

## 14. Component Hierarchy & Shared Patterns

### 14.1 Component Architecture

```
packages/shared-ui/
├── primitives/           ← shadcn/ui base (Button, Input, Card, etc.)
├── layout/               ← App shell components
│   ├── AppShell.tsx
│   ├── Sidebar.tsx
│   ├── TopBar.tsx
│   ├── BottomNav.tsx
│   └── PageHeader.tsx
├── data-display/         ← Tables, charts, stats
│   ├── DataTable.tsx
│   ├── StatChart.tsx
│   ├── DashboardCard.tsx
│   └── DashboardGrid.tsx
├── content/              ← Content rendering
│   ├── questions/        ← 15 question renderers
│   ├── materials/        ← 7 material renderers
│   ├── SpaceCard.tsx
│   ├── ExamCard.tsx
│   └── ResultCard.tsx
├── feedback/             ← States and indicators
│   ├── EmptyState.tsx
│   ├── LoadingState.tsx
│   ├── ErrorState.tsx
│   └── ProgressBar.tsx
├── identity/             ← Auth-related UI
│   ├── OrgSwitcher.tsx
│   ├── LoginForm.tsx
│   ├── SchoolCodeInput.tsx
│   └── UserAvatar.tsx
└── index.ts              ← Barrel export
```

### 14.2 Page Composition Pattern

Every page follows this pattern:

```typescript
// Example: Teacher's MySpaces page
function MySpacesPage() {
  const { data: spaces, isLoading, error } = useSpaces({ status: 'published' });

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;
  if (!spaces?.length) return (
    <EmptyState
      icon={BookOpen}
      title="No spaces yet"
      description="Create your first learning space."
      action={{ label: 'Create Space', onClick: () => navigate('/spaces/new') }}
    />
  );

  return (
    <>
      <PageHeader
        title="My Spaces"
        description="Manage your learning content"
        actions={<Button onClick={() => navigate('/spaces/new')}>Create Space</Button>}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {spaces.map((space) => (
          <SpaceCard key={space.id} space={space} />
        ))}
      </div>
    </>
  );
}
```

### 14.3 Form Pattern

All forms use React Hook Form + Zod:

```typescript
const createClassSchema = z.object({
  name: z.string().min(1, 'Class name is required'),
  subject: z.string().optional(),
  grade: z.string().optional(),
  academicSessionId: z.string().optional(),
  teacherIds: z.array(z.string()).min(1, 'Assign at least one teacher'),
});

type CreateClassForm = z.infer<typeof createClassSchema>;

function CreateClassDialog() {
  const form = useForm<CreateClassForm>({
    resolver: zodResolver(createClassSchema),
  });
  const createClass = useCreateClass();

  const onSubmit = async (data: CreateClassForm) => {
    await createClass.mutateAsync(data);
    toast.success('Class created');
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        {/* FormFields using shared-ui Form components */}
      </form>
    </Form>
  );
}
```

---

## 15. Integration Points

### 15.1 Module Integration Map

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend Apps                         │
├────────────┬────────────┬────────────┬─────────────────┤
│ Admin Web  │Teacher Web │Student Web │ Scanner / Parent │
├────────────┴────────────┴────────────┴─────────────────┤
│                  shared-hooks (TanStack Query)           │
│                  shared-stores (Zustand)                 │
│                  shared-services (Firebase SDK)          │
├──────────────────────────────────────────────────────────┤
│                    Firebase SDK                          │
├──────────┬──────────┬──────────┬───────────┬───────────┤
│ Identity │ Tenant   │AutoGrade │ LevelUp   │ Analytics │
│ Module   │ Ops      │ Module   │ Module    │ Module    │
│          │ Module   │          │           │           │
│ Auth     │ Classes  │ Exams    │ Spaces    │ Progress  │
│ Users    │ Students │ Submit.  │ Items     │ Summaries │
│ Members  │ Teachers │ Grading  │ Agents    │ Insights  │
│ Claims   │ Parents  │ Results  │ Chat      │ Cost      │
└──────────┴──────────┴──────────┴───────────┴───────────┘
```

### 15.2 Service Integration Details

| Frontend Feature      | Firebase Service        | Cloud Function         | Data Flow                             |
| --------------------- | ----------------------- | ---------------------- | ------------------------------------- |
| Login                 | `firebase/auth`         | `switchActiveTenant`   | Auth → Claims → Store                 |
| Create student        | `firestore`             | `createOrgUser`        | Form → CF → Firestore                 |
| Bulk import           | `firestore`             | `bulkCreateStudents`   | CSV → CF → Batch write                |
| Space CRUD            | `firestore`             | —                      | Direct Firestore read/write           |
| Question paper upload | `storage` + `firestore` | `extractQuestions`     | Upload → CF → AI → Firestore          |
| Answer sheet upload   | `storage` + `firestore` | `createSubmission`     | Upload → CF → Grading pipeline        |
| AI grading            | —                       | `gradingWorker` (HTTP) | Triggered by submission               |
| AI chat               | —                       | `chatWithAI`           | Callable CF → Gemini → Response       |
| AI evaluation         | —                       | `evaluateAnswer`       | Callable CF → Gemini → Result         |
| Real-time progress    | `rtdb`                  | —                      | Direct RTDB read/write                |
| Leaderboard           | `rtdb`                  | —                      | Direct RTDB subscribe                 |
| Analytics             | `firestore`             | —                      | Read pre-aggregated docs              |
| Notifications         | `firestore`             | —                      | Subscribe to notifications collection |
| Set API key           | —                       | `setTenantApiKey`      | CF → Secret Manager                   |
| Result PDF            | Client-side             | —                      | @react-pdf/renderer                   |

### 15.3 Error Handling Integration

```typescript
// Global error handler for Cloud Function calls
async function callFunction<T>(name: string, data: unknown): Promise<T> {
  try {
    const fn = httpsCallable<typeof data, T>(functions, name);
    const result = await fn(data);
    return result.data;
  } catch (error) {
    if (error instanceof FirebaseError) {
      switch (error.code) {
        case "functions/permission-denied":
          toast.error("You do not have permission for this action");
          break;
        case "functions/resource-exhausted":
          toast.error("Rate limit exceeded. Please try again later.");
          break;
        case "functions/failed-precondition":
          toast.error(error.message); // Budget exceeded, etc.
          break;
        default:
          toast.error("Something went wrong. Please try again.");
      }
    }
    throw error;
  }
}
```

---

## 16. Testing Strategy

### 16.1 Test Types & Tools

| Test Type         | Tool                     | Scope                        | Coverage Target |
| ----------------- | ------------------------ | ---------------------------- | --------------- |
| Component unit    | Vitest + Testing Library | shared-ui components         | 80%             |
| Hook unit         | Vitest + renderHook      | shared-hooks                 | 80%             |
| Store unit        | Vitest                   | shared-stores (Zustand)      | 90%             |
| Page integration  | Vitest + Testing Library | App pages (mount + interact) | Key pages       |
| E2E               | Playwright               | Critical user journeys       | Top 10 flows    |
| Visual regression | Playwright screenshots   | Component library            | Key components  |
| Accessibility     | axe-core + Playwright    | All pages                    | WCAG AA         |

### 16.2 E2E Test Plan

| #   | Journey             | App      | Steps                                                    |
| --- | ------------------- | -------- | -------------------------------------------------------- |
| 1   | School code login   | All      | Enter code → confirm school → login → dashboard          |
| 2   | Create space        | Teacher  | New space → add story points → add items → publish       |
| 3   | Take timed test     | Student  | Open space → start test → answer questions → submit      |
| 4   | View exam result    | Student  | Results list → result detail → per-question feedback     |
| 5   | Grading review      | Teacher  | Exam → submissions → review grades → override → release  |
| 6   | Bulk student import | Admin    | Upload CSV → map columns → review → import               |
| 7   | AI chat tutor       | Student  | Open space → open chat → ask question → receive response |
| 8   | Parent views child  | Parent   | Login → select child → view results                      |
| 9   | Org switch          | Any      | Switch org → verify data changes                         |
| 10  | Consumer purchase   | Consumer | Store → preview → purchase → enroll → access             |

### 16.3 Testing Directory Structure

```
Each app:
apps/admin-web/
├── src/
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   └── __tests__/
│   │       └── Dashboard.test.tsx
│   └── ...
└── e2e/
    ├── admin-login.spec.ts
    ├── student-management.spec.ts
    └── ...

Shared packages:
packages/shared-ui/
├── src/
│   ├── DataTable.tsx
│   └── __tests__/
│       └── DataTable.test.tsx
```

---

## 17. Performance Optimization Plan

### 17.1 Strategy: Ship First, Optimize in Phase 6

Per the design decision, we adopt a "relaxed" performance approach:

- **Phase 0–5:** Focus on functionality. Use lazy loading and code splitting as
  baseline.
- **Phase 6:** Performance audit, bundle analysis, targeted optimizations.

### 17.2 Baseline Optimizations (Built-In)

| Technique                      | Implementation                               | Phase   |
| ------------------------------ | -------------------------------------------- | ------- |
| Route-level code splitting     | `React.lazy()` + `Suspense` on all pages     | Phase 0 |
| Dynamic imports for heavy libs | CodeMirror, Recharts, KaTeX loaded on demand | Phase 0 |
| Image lazy loading             | `loading="lazy"` on all `<img>`              | Phase 0 |
| TanStack Query caching         | staleTime config per data type               | Phase 0 |
| Vite tree-shaking              | Unused code eliminated at build              | Phase 0 |
| Hashed asset URLs              | Long-term CDN caching for static assets      | Phase 0 |

### 17.3 Phase 6 Optimization Targets

| Metric               | Target             | Measurement              |
| -------------------- | ------------------ | ------------------------ |
| Initial JS (gzipped) | <300KB per app     | `vite-bundle-visualizer` |
| LCP                  | <3.0s on 3G        | Lighthouse               |
| FID                  | <200ms             | Web Vitals               |
| CLS                  | <0.1               | Lighthouse               |
| Firestore reads/page | <10 for dashboards | Firebase Console         |

### 17.4 Optimization Techniques (Phase 6)

- **Bundle splitting:** Analyze with `rollup-plugin-visualizer`, split vendor
  chunks
- **Prefetching:** `<link rel="prefetch">` for likely next routes
- **React.memo:** Audit and wrap heavy list item components
- **Virtualization:** `@tanstack/react-virtual` for student lists,
  leaderboards >100 items
- **Image optimization:** WebP conversion, responsive `srcset`, thumbnail
  generation
- **Firestore pagination:** Cursor-based pagination for large collections
- **Service Worker:** (Student web) Cache app shell for faster repeat loads

---

## 18. Dependencies on Other Modules

### 18.1 Hard Dependencies (Must Be Complete Before Frontend Work)

| Frontend Phase    | Depends On      | Module  | Deliverable                                                         |
| ----------------- | --------------- | ------- | ------------------------------------------------------------------- |
| Phase 0           | shared-types    | All     | TypeScript interfaces for all entities                              |
| Phase 1 (Auth UI) | Identity Module | Backend | Auth Cloud Functions: `createOrgUser`, `switchActiveTenant`, claims |
| Phase 1 (Auth UI) | Firestore Rules | Backend | Security rules for `/users`, `/userMemberships`, `/tenants`         |

### 18.2 Soft Dependencies (Can Build UI Before Backend Ready)

| Frontend Phase          | Depends On          | Module  | Notes                                    |
| ----------------------- | ------------------- | ------- | ---------------------------------------- |
| Phase 2 (Admin screens) | Tenant Ops          | Backend | UI can be built with mock data           |
| Phase 3 (AutoGrade UI)  | AutoGrade Core      | Backend | Exam creation UI before grading pipeline |
| Phase 4 (LevelUp UI)    | LevelUp Core        | Backend | Space editor before AI evaluation        |
| Phase 5 (Analytics)     | Analytics Module    | Backend | Charts before aggregation functions      |
| Phase 6 (Consumer)      | Payment integration | Backend | Store UI before payment webhook          |

### 18.3 Module Integration Timeline

```
Phase 0: shared-types ← Types Engineer (parallel)
         shared-ui ← Frontend (build here)
         shared-stores ← Frontend (build here)

Phase 1: Auth UI → waits for Identity Cloud Functions
         └── But login forms, org switcher UI built in parallel

Phase 2: Admin screens → waits for Tenant Ops CRUD
         └── But screen layout, forms, tables built in parallel

Phase 3: Exam editor, grading review → waits for AutoGrade pipeline
         └── But upload UI, question review UI built in parallel

Phase 4: Space editor, viewer → waits for LevelUp services
         └── But item editor, question renderers built in parallel (port from LevelUp-App)

Phase 5: Analytics dashboards → waits for aggregation Cloud Functions
         └── Chart components built with mock data

Phase 6: Consumer path → waits for payment integration (Razorpay)
         └── Store UI, enrollment flow built in parallel
```

---

## 19. Implementation Phasing

### 19.1 Phase 0: Foundations (Week 1-2)

**Frontend deliverables:**

- `packages/shared-ui/` — port 50 shadcn components from LevelUp-App, add
  AppShell, PageHeader, OrgSwitcher
- `packages/shared-stores/` — authStore, tenantStore, uiStore (Zustand)
- `packages/shared-hooks/` — query key factory, ProtectedRoute, usePermission,
  useRole
- `packages/tailwind-config/` — shared theme (HSL tokens, dark mode, semantic
  colors)
- App scaffolds for all 6 apps (Vite + React + TS, import shared packages)

### 19.2 Phase 1: Auth UI (Week 2-4)

**Frontend deliverables:**

- School-code login flow (SchoolCodeInput → credentials form → dashboard
  redirect)
- Consumer login/signup (email + Google/Apple OAuth)
- Org switcher component (TopBar dropdown)
- Roll number login (student variant)
- ProtectedRoute with role + permission + feature-flag gates
- Onboarding flow (profile completion → org join)

### 19.3 Phase 2: Admin Screens (Week 4-6)

**Frontend deliverables:**

- Admin Web — Dashboard, User Management (CRUD + bulk import), Class Management,
  Session Management, Settings
- DataTable component (sortable, filterable, paginated, bulk actions)
- CSV Import Wizard (upload → map → review → import)
- Evaluation Settings editor (RELMS dimensions)
- AI Configuration page (API key setup, model selection)

### 19.4 Phase 3: AutoGrade UI (Week 6-9)

**Frontend deliverables:**

- Exam Editor (settings, question paper upload, question review, rubric editing)
- Submission Manager (upload answer sheets, pipeline status)
- Grading Review (side-by-side answer image + AI grades, override controls)
- Result Release flow
- Student Result View (score summary, per-question feedback, PDF download)
- Parent Result View (read-only child results)
- Exam Analytics (score distribution, question stats)
- Scanner App (exam selector, camera capture, upload queue, offline support)

### 19.5 Phase 4: LevelUp UI (Week 9-12)

**Frontend deliverables:**

- Space Editor (story point management, item editor, all 15 question types + 7
  material types)
- Space Viewer (story point navigation, material reader, question answerer)
- Timed Test Runner (full-screen, 5-status navigation, timer, auto-submit)
- Practice Mode (infinite drill, immediate feedback, streak counter, RTDB
  progress)
- AI Chat Tutor (slide-over panel, message thread, context-aware)
- Leaderboard (real-time RTDB-backed rankings)
- Space Progress tracking UI
- Publish workflow (draft → published → archived)

### 19.6 Phase 5: Cross-System & Analytics (Week 12-14)

**Frontend deliverables:**

- Unified Student Dashboard (combined LevelUp + AutoGrade progress)
- Unified Teacher Dashboard (cross-system class views)
- Cross-System Analytics (LevelUp engagement ↔ exam performance correlation)
- At-Risk Student views
- AI Cost Dashboard (Admin + Super Admin)
- Notification center (in-app notifications)

### 19.7 Phase 6: Consumer & Polish (Week 14-16)

**Frontend deliverables:**

- Consumer Store (space catalog, search, filters, previews)
- Consumer signup + social login (Google/Apple)
- Consumer dashboard (enrolled spaces, continue learning)
- Purchase flow (Razorpay/Stripe integration for paid spaces)
- PWA setup for Scanner App (service worker, install prompt)
- Performance optimization (bundle analysis, code splitting audit)
- Security audit (XSS, auth edge cases)
- Accessibility audit (WCAG AA)

---

## Appendix A: File Naming Conventions

```
Components:   PascalCase.tsx        (e.g., SpaceEditor.tsx)
Pages:        PascalCase.tsx        (e.g., Dashboard.tsx)
Hooks:        camelCase.ts          (e.g., useSpaces.ts)
Stores:       kebab-case.store.ts   (e.g., auth.store.ts)
Services:     PascalCase.service.ts (e.g., Spaces.service.ts)
Types:        kebab-case.types.ts   (e.g., space.types.ts)
Tests:        *.test.tsx            (e.g., SpaceEditor.test.tsx)
E2E:          *.spec.ts             (e.g., student-journey.spec.ts)
```

## Appendix B: Environment Configuration

```typescript
// packages/shared-services/src/config/firebase.ts
const firebaseConfig = {
  development: {
    // Firebase emulator config
    useEmulators: true,
    emulatorHost: "localhost",
  },
  staging: {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    // ...staging project
  },
  production: {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    // ...production project
  },
};
```

## Appendix C: Deployment Strategy

| App         | Domain Pattern                   | Hosting                |
| ----------- | -------------------------------- | ---------------------- |
| Admin Web   | admin.{tenant-slug}.levelup.app  | Firebase Hosting       |
| Teacher Web | teach.{tenant-slug}.levelup.app  | Firebase Hosting       |
| Student Web | app.levelup.app                  | Firebase Hosting       |
| Parent Web  | parent.{tenant-slug}.levelup.app | Firebase Hosting       |
| Scanner App | scan.levelup.app                 | Firebase Hosting (PWA) |
| Super Admin | admin.levelup.app                | Firebase Hosting       |
| Consumer    | www.levelup.app (public)         | Firebase Hosting       |

Each app deploys independently via CI/CD. Shared packages are built as part of
each app's build step (no separate package publishing).

---

**Document Version:** 1.0 **Date:** 2026-02-19 **Status:** Design Plan — Ready
for Implementation
