# Frontend Architecture — LevelUp + AutoGrade Unified Platform

> **Version:** 1.0 **Date:** February 2026 **Status:** Approved for
> Implementation **Author:** Architecture Team

---

## Table of Contents

1. [Overview & Guiding Principles](#1-overview--guiding-principles)
2. [React Application Architecture](#2-react-application-architecture)
   - 2.1 [Monorepo App Structure](#21-monorepo-app-structure)
   - 2.2 [Routing Architecture](#22-routing-architecture)
   - 2.3
     [Code Splitting & Lazy Loading Strategy](#23-code-splitting--lazy-loading-strategy)
3. [State Management Architecture](#3-state-management-architecture)
   - 3.1 [Zustand Stores](#31-zustand-stores)
   - 3.2 [TanStack Query Patterns](#32-tanstack-query-patterns)
   - 3.3 [Real-time Subscriptions](#33-real-time-subscriptions)
   - 3.4 [State Layer Decision Matrix](#34-state-layer-decision-matrix)
4. [Component Hierarchy & Design System](#4-component-hierarchy--design-system)
   - 4.1 [shared-ui Package Architecture](#41-shared-ui-package-architecture)
   - 4.2 [Component Taxonomy](#42-component-taxonomy)
   - 4.3 [Design Token System](#43-design-token-system)
   - 4.4 [Component Composition Patterns](#44-component-composition-patterns)
5. [Role-Based UI Routing](#5-role-based-ui-routing)
   - 5.1 [Role Definitions & Capabilities](#51-role-definitions--capabilities)
   - 5.2 [Route Guard Architecture](#52-route-guard-architecture)
   - 5.3 [Role-Specific Layout Trees](#53-role-specific-layout-trees)
6. [Real-Time Feature Patterns](#6-real-time-feature-patterns)
   - 6.1 [Leaderboards](#61-leaderboards)
   - 6.2 [Live Progress Tracking](#62-live-progress-tracking)
   - 6.3 [Exam Timers](#63-exam-timers)
   - 6.4 [AI Chat Streaming](#64-ai-chat-streaming)
7. [Performance Optimization Strategy](#7-performance-optimization-strategy)
8. [Accessibility Compliance](#8-accessibility-compliance)
9. [Inter-Package Dependency Map](#9-inter-package-dependency-map)
10. [Migration Notes from Legacy Systems](#10-migration-notes-from-legacy-systems)

---

## 1. Overview & Guiding Principles

### What We Are Building

A **unified, multi-tenant, role-adaptive React application** that replaces two
separate systems:

| System    | Old Approach                          | Unified Approach                            |
| --------- | ------------------------------------- | ------------------------------------------- |
| LevelUp   | Redux + Context, 132 components       | Zustand + TanStack Query, 6 shared packages |
| AutoGrade | Zustand + Context, per-app components | Single web app, shared-ui, shared services  |

### Guiding Principles

1. **Role-first architecture** — Each user role (student, teacher, admin,
   parent, scanner) gets a code-split bundle. Students never download teacher
   code.
2. **Server state vs. client state separation** — Firestore data lives in
   TanStack Query. UI ephemeral state lives in Zustand. These do not mix.
3. **Accessibility is structural, not additive** — Radix UI primitives provide
   ARIA semantics by default. Do not bolt on accessibility after the fact.
4. **Component composition over inheritance** — Compound components, render
   props, and slots over subclassing.
5. **Performance budgets are enforced at build time** — Bundle analyzer is run
   in CI; chunks exceeding limits fail the build.
6. **Real-time is opt-in** — Components subscribe to RTDB only when mounted; all
   subscriptions are cleaned up on unmount.
7. **Multi-tenancy is structural** — Every Firestore query is org-scoped. The UI
   cannot accidentally show cross-tenant data.

---

## 2. React Application Architecture

### 2.1 Monorepo App Structure

```
apps/
├── web/                        # Main app: student, teacher, parent
│   ├── src/
│   │   ├── App.tsx             # Root router, providers
│   │   ├── main.tsx            # Entry point, env validation
│   │   ├── routes/             # Route definitions (no components here)
│   │   │   ├── index.tsx       # Root route tree
│   │   │   ├── student/        # Student route segment
│   │   │   ├── teacher/        # Teacher route segment
│   │   │   └── parent/         # Parent route segment
│   │   ├── features/           # Feature-first modules
│   │   │   ├── spaces/         # Learning spaces (from LevelUp courses)
│   │   │   ├── exams/          # Exam management
│   │   │   ├── submissions/    # Grading & review
│   │   │   ├── leaderboards/   # Real-time rankings
│   │   │   ├── progress/       # Progress analytics
│   │   │   ├── chat/           # AI tutor chat
│   │   │   └── notifications/  # Notification center
│   │   ├── layouts/
│   │   │   ├── StudentLayout.tsx
│   │   │   ├── TeacherLayout.tsx
│   │   │   ├── ParentLayout.tsx
│   │   │   └── AuthLayout.tsx
│   │   ├── stores/             # Zustand stores
│   │   │   ├── auth.store.ts
│   │   │   ├── org.store.ts
│   │   │   └── ui.store.ts
│   │   ├── queries/            # TanStack Query definitions
│   │   │   ├── spaces.queries.ts
│   │   │   ├── exams.queries.ts
│   │   │   ├── progress.queries.ts
│   │   │   └── users.queries.ts
│   │   ├── hooks/              # App-specific hooks
│   │   ├── lib/                # Config, utils
│   │   │   ├── firebase.ts     # Firebase init (uses shared-services)
│   │   │   └── queryClient.ts  # TanStack Query client config
│   │   └── types/              # Local type overrides (minimal)
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
│
├── admin/                      # Org admin dashboard
│   └── src/
│       ├── features/
│       │   ├── users/          # User management
│       │   ├── classes/        # Class management
│       │   ├── analytics/      # Org-level analytics
│       │   ├── settings/       # Org settings, branding
│       │   └── billing/        # Subscription management
│       └── ...
│
├── super-admin/                # Platform super-admin
│   └── src/
│       ├── features/
│       │   ├── organizations/  # Multi-org management
│       │   ├── platform/       # Platform health/metrics
│       │   └── subscriptions/
│       └── ...
│
└── scanner/                    # Lightweight mobile scanning app
    └── src/
        ├── features/
        │   ├── capture/        # Camera / file upload
        │   └── queue/          # Upload queue status
        └── ...

packages/
├── shared-ui/                  # Design system (see §4)
├── shared-types/               # TypeScript interfaces
├── shared-services/            # Firebase service layer
├── shared-hooks/               # Reusable React hooks
├── shared-utils/               # Pure utility functions
├── eslint-config/              # Shared lint rules
└── tailwind-config/            # Shared Tailwind config
```

### 2.2 Routing Architecture

The **main web app** uses React Router v6 with a nested route tree. Each role
gets its own top-level segment protected by a role guard.

#### Root Route Tree (`apps/web/src/routes/index.tsx`)

```tsx
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { lazy, Suspense } from "react";

// Lazy-load entire role segments
const StudentRoot = lazy(() => import("../features/student/StudentRoot"));
const TeacherRoot = lazy(() => import("../features/teacher/TeacherRoot"));
const ParentRoot = lazy(() => import("../features/parent/ParentRoot"));

export const router = createBrowserRouter([
  // ── Public routes ──────────────────────────────────────────────────
  {
    path: "/",
    element: <PublicLayout />,
    children: [
      { index: true, element: <LandingPage /> },
      { path: "login", element: <LoginPage /> },
      { path: "signup", element: <SignupPage /> },
      { path: "join/:code", element: <JoinOrgPage /> },
    ],
  },

  // ── Auth callback ───────────────────────────────────────────────────
  { path: "/auth/callback", element: <AuthCallbackPage /> },

  // ── Onboarding ──────────────────────────────────────────────────────
  {
    path: "/onboarding",
    element: (
      <RequireAuth>
        <OnboardingLayout />
      </RequireAuth>
    ),
    children: [
      { path: "profile", element: <SetupProfileStep /> },
      { path: "org", element: <JoinOrCreateOrgStep /> },
      { path: "role", element: <SelectRoleStep /> },
    ],
  },

  // ── Student workspace ───────────────────────────────────────────────
  {
    path: "/s",
    element: (
      <RequireAuth roles={["student"]}>
        <Suspense fallback={<AppShell skeleton />}>
          <StudentRoot />
        </Suspense>
      </RequireAuth>
    ),
    children: studentRoutes, // see §5.3
  },

  // ── Teacher workspace ───────────────────────────────────────────────
  {
    path: "/t",
    element: (
      <RequireAuth roles={["teacher"]}>
        <Suspense fallback={<AppShell skeleton />}>
          <TeacherRoot />
        </Suspense>
      </RequireAuth>
    ),
    children: teacherRoutes,
  },

  // ── Parent workspace ────────────────────────────────────────────────
  {
    path: "/p",
    element: (
      <RequireAuth roles={["parent"]}>
        <Suspense fallback={<AppShell skeleton />}>
          <ParentRoot />
        </Suspense>
      </RequireAuth>
    ),
    children: parentRoutes,
  },

  // ── Immersive / full-screen routes (no layout chrome) ───────────────
  {
    path: "/exam/:examId/take",
    element: (
      <RequireAuth roles={["student"]}>
        <Suspense fallback={<FullScreenLoader />}>
          {lazy(() => import("../features/exams/ExamTakingPage"))}
        </Suspense>
      </RequireAuth>
    ),
  },
  {
    path: "/space/:spaceId/timed",
    element: (
      <RequireAuth roles={["student"]}>
        <Suspense fallback={<FullScreenLoader />}>
          {lazy(() => import("../features/spaces/TimedTestPage"))}
        </Suspense>
      </RequireAuth>
    ),
  },

  // ── Global fallbacks ────────────────────────────────────────────────
  { path: "/unauthorized", element: <UnauthorizedPage /> },
  { path: "*", element: <NotFoundPage /> },
]);
```

#### Route Segment Example — Student Routes

```tsx
// features/student/routes.tsx
export const studentRoutes = [
  {
    index: true,
    element: lazy(() => import("./pages/StudentDashboard")),
  },
  {
    path: "spaces",
    children: [
      { index: true, element: lazy(() => import("./pages/SpacesListPage")) },
      {
        path: ":spaceId",
        element: lazy(() => import("./pages/SpaceDetailPage")),
      },
      {
        path: ":spaceId/items/:itemId",
        element: lazy(() => import("./pages/ItemViewPage")),
      },
    ],
  },
  {
    path: "exams",
    children: [
      { index: true, element: lazy(() => import("./pages/ExamsListPage")) },
      {
        path: ":examId/results",
        element: lazy(() => import("./pages/ExamResultsPage")),
      },
    ],
  },
  {
    path: "leaderboard",
    element: lazy(() => import("./pages/LeaderboardPage")),
  },
  { path: "chat", element: lazy(() => import("./pages/AITutorPage")) },
  { path: "progress", element: lazy(() => import("./pages/ProgressPage")) },
  {
    path: "settings",
    element: lazy(() => import("./pages/StudentSettingsPage")),
  },
];
```

### 2.3 Code Splitting & Lazy Loading Strategy

#### Split Points and Bundle Targets

| Chunk             | Split Trigger                      | Target Size        |
| ----------------- | ---------------------------------- | ------------------ |
| `vendor-react`    | React, ReactDOM, React Router      | ≤ 150 KB gz        |
| `vendor-ui`       | Radix UI, shadcn, Tailwind runtime | ≤ 180 KB gz        |
| `vendor-firebase` | Firebase SDK                       | ≤ 200 KB gz        |
| `vendor-query`    | TanStack Query                     | ≤ 40 KB gz         |
| `student-bundle`  | All student feature code           | ≤ 200 KB gz        |
| `teacher-bundle`  | All teacher feature code           | ≤ 250 KB gz        |
| `parent-bundle`   | All parent feature code            | ≤ 80 KB gz         |
| `exam-taking`     | Immersive exam mode                | ≤ 120 KB gz        |
| `editor`          | Rich content editor                | ≤ 180 KB gz        |
| `pdf-viewer`      | PDF.js viewer                      | Async, ≤ 300 KB gz |

#### Vite Configuration

```ts
// apps/web/vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Vendor splits
          if (id.includes("node_modules/react")) return "vendor-react";
          if (id.includes("@radix-ui") || id.includes("shadcn"))
            return "vendor-ui";
          if (id.includes("firebase")) return "vendor-firebase";
          if (id.includes("@tanstack")) return "vendor-query";
          if (id.includes("node_modules/pdfjs")) return "pdf-viewer";

          // Feature splits (role-based)
          if (id.includes("/features/student/")) return "student-bundle";
          if (id.includes("/features/teacher/")) return "teacher-bundle";
          if (id.includes("/features/parent/")) return "parent-bundle";
        },
      },
    },
    chunkSizeWarningLimit: 300, // KB
  },
});
```

#### Lazy Loading Patterns

```tsx
// Pattern 1: Route-level lazy (standard)
const SpaceDetailPage = lazy(() => import('./pages/SpaceDetailPage'));

// Pattern 2: Heavy component lazy (PDF viewer, chart, editor)
const PDFViewer = lazy(() =>
  import('../components/PDFViewer').then((m) => ({ default: m.PDFViewer }))
);

// Pattern 3: Prefetch on hover (faster perceived navigation)
function SpaceCard({ spaceId }: { spaceId: string }) {
  const handleMouseEnter = () => {
    import('./pages/SpaceDetailPage'); // prefetch
  };
  return <Card onMouseEnter={handleMouseEnter} ...>...</Card>;
}

// Pattern 4: Skeleton boundary (unified loading UX)
<Suspense fallback={<SkeletonLayout variant="dashboard" />}>
  <StudentDashboard />
</Suspense>
```

---

## 3. State Management Architecture

**Decision rationale:** Redux Toolkit was used in LevelUp for only 1 slice
(courses). AutoGrade already used Zustand. The unified platform drops Redux
entirely in favor of **Zustand (client state) + TanStack Query (server state)**.

### 3.1 Zustand Stores

Three global stores shared across the web app. Stores do NOT contain any
Firestore data.

#### `auth.store.ts` — Authentication & Session

```ts
// packages/shared-hooks/src/stores/auth.store.ts
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { User, UserMembership } from "@levelup/shared-types";

interface AuthState {
  // State
  user: User | null;
  memberships: UserMembership[];
  currentOrgId: string | null;
  isLoading: boolean;
  error: string | null;
  isInitialized: boolean; // Firebase auth state resolved

  // Actions
  setUser: (user: User | null) => void;
  setMemberships: (memberships: UserMembership[]) => void;
  setCurrentOrg: (orgId: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setInitialized: () => void;
  reset: () => void; // call on logout
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      memberships: [],
      currentOrgId: null,
      isLoading: true,
      error: null,
      isInitialized: false,

      setUser: (user) => set({ user }),
      setMemberships: (memberships) => set({ memberships }),
      setCurrentOrg: (orgId) => set({ currentOrgId: orgId }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
      setInitialized: () => set({ isInitialized: true, isLoading: false }),
      reset: () => set({ user: null, memberships: [], currentOrgId: null }),
    }),
    {
      name: "levelup-auth",
      storage: createJSONStorage(() => localStorage),
      // Only persist safe, non-sensitive fields
      partialize: (s) => ({ currentOrgId: s.currentOrgId }),
    }
  )
);

// Selectors (use outside React too — no hooks dependency)
export const selectCurrentMembership = (s: AuthState) =>
  s.memberships.find((m) => m.orgId === s.currentOrgId) ?? null;

export const selectCurrentRole = (s: AuthState) =>
  selectCurrentMembership(s)?.role ?? null;
```

#### `org.store.ts` — Organization Context

```ts
interface OrgState {
  currentOrg: Organization | null;
  settings: OrgSettings | null;
  branding: OrgBranding | null; // colors, logo — drives CSS variable injection
  subscription: Subscription | null;
  isLoading: boolean;

  setOrg: (org: Organization) => void;
  setSettings: (s: OrgSettings) => void;
  setBranding: (b: OrgBranding) => void;
  setSubscription: (sub: Subscription) => void;
}

export const useOrgStore = create<OrgState>()((set) => ({
  currentOrg: null,
  settings: null,
  branding: null,
  subscription: null,
  isLoading: false,
  setOrg: (currentOrg) => set({ currentOrg }),
  setSettings: (settings) => set({ settings }),
  setBranding: (branding) => set({ branding }),
  setSubscription: (subscription) => set({ subscription }),
}));
```

#### `ui.store.ts` — UI State

```ts
interface UIState {
  // Sidebar
  sidebarOpen: boolean;
  sidebarCollapsed: boolean; // icon-only mode on desktop

  // Modals — keyed by modal name, value is optional payload
  modals: Record<string, unknown | null>;

  // Theme
  theme: "light" | "dark" | "system";

  // Onboarding
  onboarding: {
    active: boolean;
    currentStep: number;
    totalSteps: number;
  };

  // Actions
  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;
  openModal: <T>(name: string, payload?: T) => void;
  closeModal: (name: string) => void;
  setTheme: (theme: UIState["theme"]) => void;
  setOnboardingStep: (step: number) => void;
  completeOnboarding: () => void;
}
```

#### Store Initialization Pattern

All three stores are bootstrapped by a single `<AppInitializer>` component that
sits just inside the router, avoiding the need for prop drilling or effects
scattered across the app.

```tsx
// src/components/AppInitializer.tsx
export function AppInitializer({ children }: { children: React.ReactNode }) {
  const { setUser, setMemberships, setInitialized, reset } = useAuthStore();
  const { setOrg, setBranding } = useOrgStore();
  const { currentOrgId } = useAuthStore();

  // 1. Sync Firebase auth state → Zustand
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const [user, memberships] = await Promise.all([
          UsersService.getById(firebaseUser.uid),
          MembershipsService.listForUser(firebaseUser.uid),
        ]);
        setUser(user);
        setMemberships(memberships);
      } else {
        reset();
      }
      setInitialized();
    });
    return unsub;
  }, []);

  // 2. Load org data when currentOrgId changes
  useEffect(() => {
    if (!currentOrgId) return;
    OrgsService.getById(currentOrgId).then(setOrg);
    OrgsService.getBranding(currentOrgId).then(setBranding);
  }, [currentOrgId]);

  // 3. Apply branding CSS variables
  const { branding } = useOrgStore();
  useEffect(() => {
    if (!branding) return;
    applyOrgBranding(branding); // injects --accent-primary etc.
  }, [branding]);

  return <>{children}</>;
}
```

### 3.2 TanStack Query Patterns

All Firestore / Cloud Function data goes through TanStack Query. **No component
calls Firebase directly.**

#### Query Client Configuration

```ts
// src/lib/queryClient.ts
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 min default
      gcTime: 1000 * 60 * 10, // 10 min cache retention
      retry: (failureCount, error: any) => {
        if (error?.code === "permission-denied") return false; // don't retry auth errors
        return failureCount < 2;
      },
      refetchOnWindowFocus: false, // RTDB handles live updates
    },
    mutations: {
      onError: (error) => {
        toast.error(formatFirestoreError(error));
      },
    },
  },
});
```

#### Query Key Factory Pattern

All query keys are typed and co-located with their queries:

```ts
// src/queries/spaces.queries.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SpacesService } from "@levelup/shared-services";

// ── Key factory (prevents typos, enables targeted invalidation) ──────
export const spacesKeys = {
  all: (orgId: string) => ["spaces", orgId] as const,
  list: (orgId: string, filters?: SpaceFilters) =>
    [...spacesKeys.all(orgId), "list", filters] as const,
  detail: (orgId: string, spaceId: string) =>
    [...spacesKeys.all(orgId), "detail", spaceId] as const,
  items: (orgId: string, spaceId: string) =>
    [...spacesKeys.detail(orgId, spaceId), "items"] as const,
  progress: (orgId: string, spaceId: string, userId: string) =>
    [...spacesKeys.detail(orgId, spaceId), "progress", userId] as const,
};

// ── Queries ─────────────────────────────────────────────────────────
export function useSpaces(orgId: string, filters?: SpaceFilters) {
  return useQuery({
    queryKey: spacesKeys.list(orgId, filters),
    queryFn: () => SpacesService.list(orgId, filters),
    enabled: !!orgId,
  });
}

export function useSpace(orgId: string, spaceId: string) {
  return useQuery({
    queryKey: spacesKeys.detail(orgId, spaceId),
    queryFn: () => SpacesService.getById(orgId, spaceId),
    enabled: !!(orgId && spaceId),
  });
}

// ── Mutations ────────────────────────────────────────────────────────
export function useCreateSpace() {
  const qc = useQueryClient();
  const { currentOrgId } = useAuthStore();

  return useMutation({
    mutationFn: (data: CreateSpaceDTO) =>
      SpacesService.create(currentOrgId!, data),
    onSuccess: () => {
      // Invalidate list, new space will appear
      qc.invalidateQueries({ queryKey: spacesKeys.all(currentOrgId!) });
    },
  });
}

export function useUpdateSpaceItem() {
  const qc = useQueryClient();
  const { currentOrgId } = useAuthStore();

  return useMutation({
    mutationFn: ({ spaceId, itemId, data }: UpdateItemArgs) =>
      ItemsService.update(currentOrgId!, spaceId, itemId, data),
    // Optimistic update
    onMutate: async ({ spaceId, itemId, data }) => {
      await qc.cancelQueries({
        queryKey: spacesKeys.items(currentOrgId!, spaceId),
      });
      const previous = qc.getQueryData(
        spacesKeys.items(currentOrgId!, spaceId)
      );
      qc.setQueryData(spacesKeys.items(currentOrgId!, spaceId), (old: Item[]) =>
        old.map((item) => (item.id === itemId ? { ...item, ...data } : item))
      );
      return { previous };
    },
    onError: (_err, { spaceId }, context) => {
      qc.setQueryData(
        spacesKeys.items(currentOrgId!, spaceId),
        context?.previous
      );
    },
    onSettled: (_data, _err, { spaceId }) => {
      qc.invalidateQueries({
        queryKey: spacesKeys.items(currentOrgId!, spaceId),
      });
    },
  });
}
```

#### Infinite Query Pattern (Leaderboard, Submission List)

```ts
export function useSubmissions(orgId: string, examId: string) {
  return useInfiniteQuery({
    queryKey: ["submissions", orgId, examId],
    queryFn: ({ pageParam }) =>
      SubmissionsService.list(orgId, examId, { cursor: pageParam, limit: 20 }),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
}
```

### 3.3 Real-time Subscriptions

Real-time Firestore listeners and Firebase RTDB subscriptions are wrapped as
TanStack Query **external store** hooks so they integrate with the existing
cache:

```ts
// packages/shared-hooks/src/data/useRealtimeDoc.ts
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { onSnapshot, doc } from "firebase/firestore";
import { db } from "@levelup/shared-services";

/**
 * Subscribe to a Firestore document and push updates into the TanStack Query cache.
 * The initial data is fetched via a normal useQuery; this hook keeps it fresh.
 */
export function useRealtimeDoc<T>(
  queryKey: readonly unknown[],
  path: string,
  enabled = true
) {
  const qc = useQueryClient();
  const unsubRef = useRef<() => void>();

  useEffect(() => {
    if (!enabled) return;
    const ref = doc(db, path);
    unsubRef.current = onSnapshot(ref, (snap) => {
      qc.setQueryData(queryKey, snap.exists() ? (snap.data() as T) : null);
    });
    return () => unsubRef.current?.();
  }, [path, enabled]);
}
```

### 3.4 State Layer Decision Matrix

| Data Type                | Where it Lives                      | Why                                                   |
| ------------------------ | ----------------------------------- | ----------------------------------------------------- |
| Auth user (Firebase)     | `useAuthStore` (Zustand)            | Needs to be accessible outside React components       |
| Current org / role       | `useAuthStore` (Zustand)            | Same — used by route guards before React renders      |
| Org settings / branding  | `useOrgStore` (Zustand)             | Drives CSS variable injection (non-React side effect) |
| Sidebar open/closed      | `useUIStore` (Zustand)              | Pure UI ephemeral state                               |
| Modal open/closed + data | `useUIStore` (Zustand)              | Decouple trigger from renderer                        |
| Spaces list              | TanStack Query                      | Firestore data, benefits from caching/dedup           |
| Space items              | TanStack Query                      | Firestore data                                        |
| Exam results             | TanStack Query                      | Firestore data                                        |
| Student progress         | TanStack Query + RTDB live          | Cached snapshot + live updates                        |
| Leaderboard              | RTDB subscription → Query cache     | Must be real-time; RTDB is faster than Firestore      |
| Exam timer               | Local component state + `useEffect` | Pure UI, no persistence needed                        |
| AI chat messages         | Local component state               | Ephemeral; persisted to Firestore on message send     |
| Form state               | React Hook Form (local)             | Forms are self-contained, no global concern           |

---

## 4. Component Hierarchy & Design System

### 4.1 shared-ui Package Architecture

```
packages/shared-ui/src/
├── index.ts                          # Barrel — export everything
│
├── primitives/                       # Raw shadcn/Radix components
│   ├── accordion.tsx
│   ├── alert.tsx
│   ├── alert-dialog.tsx
│   ├── avatar.tsx
│   ├── badge.tsx
│   ├── button.tsx
│   ├── card.tsx
│   ├── checkbox.tsx
│   ├── command.tsx                   # cmdk (command palette)
│   ├── context-menu.tsx
│   ├── dialog.tsx
│   ├── drawer.tsx
│   ├── dropdown-menu.tsx
│   ├── form.tsx                      # React Hook Form integration
│   ├── hover-card.tsx
│   ├── input.tsx
│   ├── label.tsx
│   ├── navigation-menu.tsx
│   ├── popover.tsx
│   ├── progress.tsx
│   ├── radio-group.tsx
│   ├── scroll-area.tsx
│   ├── select.tsx
│   ├── separator.tsx
│   ├── sheet.tsx
│   ├── skeleton.tsx
│   ├── slider.tsx
│   ├── switch.tsx
│   ├── table.tsx
│   ├── tabs.tsx
│   ├── textarea.tsx
│   ├── toast.tsx                     # Sonner integration
│   ├── toggle.tsx
│   ├── toggle-group.tsx
│   └── tooltip.tsx
│
├── composite/                        # Multi-primitive compositions
│   ├── AppShell.tsx                  # Sidebar + header + main layout
│   ├── DataTable.tsx                 # TanStack Table + shadcn Table
│   ├── EmptyState.tsx
│   ├── ErrorBoundary.tsx
│   ├── FileUpload.tsx                # Drag-drop + click upload
│   ├── ImageViewer.tsx               # Lightbox
│   ├── InfiniteList.tsx              # Scroll-triggered pagination
│   ├── MarkdownRenderer.tsx          # react-markdown + KaTeX
│   ├── PageHeader.tsx                # Breadcrumb + title + actions
│   ├── RichTextEditor.tsx            # Tiptap-based WYSIWYG
│   ├── SearchBar.tsx                 # Debounced search input
│   ├── SortableList.tsx              # DnD kit drag-and-drop list
│   └── StatCard.tsx                  # Metric card with trend
│
├── domain/                           # Domain-specific composite components
│   ├── questions/                    # Question renderers (15+ types)
│   │   ├── QuestionRenderer.tsx      # Factory — dispatches by type
│   │   ├── MCQQuestion.tsx
│   │   ├── TextQuestion.tsx
│   │   ├── CodeQuestion.tsx          # CodeMirror + execution
│   │   ├── MatchingQuestion.tsx      # DnD kit matching
│   │   ├── FillBlanksQuestion.tsx
│   │   ├── AudioQuestion.tsx         # MediaStream API
│   │   ├── ImageQuestion.tsx
│   │   ├── NumericalQuestion.tsx
│   │   ├── TrueFalseQuestion.tsx
│   │   └── MaterialBlock.tsx         # Reading/video content
│   ├── leaderboard/
│   │   ├── LeaderboardTable.tsx
│   │   └── LeaderboardRow.tsx
│   ├── progress/
│   │   ├── ProgressRing.tsx          # SVG donut chart
│   │   ├── MasteryBadge.tsx
│   │   └── StreakCounter.tsx
│   └── exam/
│       ├── ExamCard.tsx
│       ├── SubmissionStatus.tsx
│       └── GradeSummary.tsx
│
├── charts/                           # Recharts wrappers
│   ├── BarChart.tsx
│   ├── LineChart.tsx
│   ├── RadarChart.tsx                # RELMS dimensional feedback
│   └── HeatMap.tsx                   # Activity heatmap
│
└── lib/
    ├── utils.ts                      # cn() helper, cva setup
    ├── variants.ts                   # Shared cva variant definitions
    └── branding.ts                   # applyOrgBranding() function
```

### 4.2 Component Taxonomy

Components are organized by **abstraction level**. Higher levels compose lower
ones; lower levels are unaware of higher levels.

```
Level 4 ── Pages
           Full route components; orchestrate features, have access to route params
           Example: StudentDashboard, SpaceDetailPage, ExamResultsPage

Level 3 ── Feature Components
           Domain-aware; may use queries/stores directly
           Example: SpaceCard, ExamTable, SubmissionGrader, ProgressWidget

Level 2 ── Domain Composite Components (shared-ui/domain/)
           Domain-typed props; no store/query dependencies
           Example: QuestionRenderer, LeaderboardTable, GradeSummary

Level 1 ── Generic Composite Components (shared-ui/composite/)
           Accepts generic typed props; no domain concepts
           Example: DataTable, InfiniteList, FileUpload

Level 0 ── Primitives (shared-ui/primitives/)
           Thin wrappers over Radix UI; visual-only
           Example: Button, Dialog, Card, Input
```

#### Component Authoring Rules

1. **Level 0–1 components must have zero store/query imports.** They receive all
   data via props.
2. **Level 2 domain components accept typed props, emit typed events.** They may
   use shared utility hooks (`useMediaQuery`, `useDebounce`).
3. **Level 3 feature components own their data fetching.** They import from
   `../../queries/` and `../../stores/`.
4. **Level 4 pages compose features, handle route params, render page layout.**
5. **Error boundaries wrap Level 3 and Level 4.** Components at lower levels
   should not error-boundary themselves.

### 4.3 Design Token System

All visual values are defined as CSS custom properties so that per-org
white-labeling works at runtime without a rebuild.

#### Token Definitions (`packages/tailwind-config/tokens.css`)

```css
:root {
  /* ── Surface ─────────────────────────────────────────────────── */
  --surface-primary: hsl(0, 0%, 100%);
  --surface-secondary: hsl(0, 0%, 96%);
  --surface-tertiary: hsl(0, 0%, 91%);
  --surface-inverse: hsl(224, 71%, 4%);

  /* ── Text ────────────────────────────────────────────────────── */
  --text-primary: hsl(224, 71%, 4%);
  --text-secondary: hsl(215, 16%, 47%);
  --text-disabled: hsl(215, 16%, 67%);
  --text-inverse: hsl(0, 0%, 98%);

  /* ── Accent (org-overridable) ────────────────────────────────── */
  --accent-primary: hsl(221, 83%, 53%); /* brand blue */
  --accent-primary-fg: hsl(0, 0%, 98%);
  --accent-secondary: hsl(221, 83%, 93%); /* light tint */

  /* ── Semantic ────────────────────────────────────────────────── */
  --success: hsl(142, 76%, 36%);
  --success-fg: hsl(0, 0%, 98%);
  --warning: hsl(38, 92%, 50%);
  --warning-fg: hsl(0, 0%, 4%);
  --danger: hsl(0, 84%, 60%);
  --danger-fg: hsl(0, 0%, 98%);
  --info: hsl(200, 98%, 39%);
  --info-fg: hsl(0, 0%, 98%);

  /* ── Border & Ring ───────────────────────────────────────────── */
  --border: hsl(0, 0%, 89%);
  --ring: hsl(221, 83%, 53%);

  /* ── Radius ──────────────────────────────────────────────────── */
  --radius-sm: 0.25rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;

  /* ── Shadow ──────────────────────────────────────────────────── */
  --shadow-sm: 0 1px 2px hsl(0 0% 0% / 0.05);
  --shadow-md: 0 4px 6px hsl(0 0% 0% / 0.07);
  --shadow-lg: 0 10px 15px hsl(0 0% 0% / 0.1);
}

.dark {
  --surface-primary: hsl(224, 71%, 4%);
  --surface-secondary: hsl(215, 28%, 9%);
  --surface-tertiary: hsl(215, 22%, 14%);
  --text-primary: hsl(0, 0%, 98%);
  --text-secondary: hsl(215, 20%, 65%);
  --border: hsl(215, 28%, 17%);
  --accent-primary: hsl(217, 91%, 60%);
}
```

#### Runtime Org Branding Injection

```ts
// packages/shared-ui/src/lib/branding.ts
export function applyOrgBranding(branding: OrgBranding): void {
  const root = document.documentElement;

  if (branding.primaryColor) {
    // Convert hex → HSL and inject
    const [h, s, l] = hexToHSL(branding.primaryColor);
    root.style.setProperty("--accent-primary", `hsl(${h}, ${s}%, ${l}%)`);
    root.style.setProperty("--ring", `hsl(${h}, ${s}%, ${l}%)`);
  }

  if (branding.logoUrl) {
    root.style.setProperty("--org-logo-url", `url('${branding.logoUrl}')`);
  }
}
```

### 4.4 Component Composition Patterns

#### Compound Components (for complex UI)

```tsx
// Usage
<DataTable data={submissions} columns={submissionColumns}>
  <DataTable.Toolbar>
    <DataTable.FilterBar />
    <DataTable.ColumnToggle />
    <Button>Export CSV</Button>
  </DataTable.Toolbar>
  <DataTable.Body />
  <DataTable.Pagination />
</DataTable>

// Implementation pattern
const DataTableContext = createContext<DataTableContextValue>(null!);
export function DataTable<T>({ data, columns, children }: DataTableProps<T>) {
  const table = useReactTable({ data, columns, ... });
  return (
    <DataTableContext.Provider value={{ table }}>
      <div className="flex flex-col gap-2">{children}</div>
    </DataTableContext.Provider>
  );
}
DataTable.Toolbar   = DataTableToolbar;
DataTable.FilterBar = DataTableFilterBar;
DataTable.Body      = DataTableBody;
DataTable.Pagination = DataTablePagination;
```

#### Render Slots (for layout flexibility)

```tsx
// QuestionRenderer accepts optional override slots
<QuestionRenderer
  question={q}
  mode="practice"
  slots={{
    header: <CustomQuestionHeader q={q} />,
    footer: <HintButton questionId={q.id} />,
  }}
/>
```

---

## 5. Role-Based UI Routing

### 5.1 Role Definitions & Capabilities

| Role         | Path Prefix             | Key Capabilities                                                    | Nav Items                                   |
| ------------ | ----------------------- | ------------------------------------------------------------------- | ------------------------------------------- |
| `student`    | `/s`                    | View assigned spaces, take exams, chat with AI, view leaderboard    | Spaces, Exams, Leaderboard, Chat, Progress  |
| `teacher`    | `/t`                    | Create/edit spaces & exams, grade submissions, view class analytics | Spaces, Exams, Students, Analytics, Grading |
| `parent`     | `/p`                    | View children's progress & results                                  | Overview, Reports                           |
| `orgAdmin`   | `/admin` (separate app) | Manage users, classes, billing, settings                            | Users, Classes, Analytics, Settings         |
| `superAdmin` | `/super` (separate app) | Manage all orgs, platform health                                    | Organizations, Platform, Billing            |
| `scanner`    | `/scan` (separate app)  | Upload exam scans                                                   | Upload, Queue                               |

### 5.2 Route Guard Architecture

```tsx
// src/components/RequireAuth.tsx
interface RequireAuthProps {
  children: React.ReactNode;
  roles?: UserRole[]; // if provided, ALSO checks role
  orgId?: string; // if provided, checks org membership
  redirectTo?: string;
}

export function RequireAuth({
  children,
  roles,
  redirectTo = "/login",
}: RequireAuthProps) {
  const { isInitialized, user } = useAuthStore();
  const role = useAuthStore(selectCurrentRole);
  const location = useLocation();

  // Wait for Firebase auth to resolve
  if (!isInitialized) return <FullScreenLoader />;

  // Not authenticated
  if (!user) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  // Not authorized for this role
  if (roles && !roles.includes(role!)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}
```

#### Permission Hook for Fine-Grained UI

```tsx
// packages/shared-hooks/src/auth/usePermissions.ts
export function usePermissions() {
  const membership = useAuthStore(selectCurrentMembership);
  const perms = membership?.permissions;

  return {
    canCreateSpaces: perms?.canCreateSpaces ?? false,
    canManageContent: perms?.canManageContent ?? false,
    canCreateExams: perms?.canCreateExams ?? false,
    canManuallyGrade: perms?.canManuallyGrade ?? false,
    canViewAnalytics: perms?.canViewAnalytics ?? false,
    canManageUsers: perms?.canManageUsers ?? false,
    // Helper
    can: (perm: keyof typeof perms) => perms?.[perm] ?? false,
  };
}

// Usage in UI
function TeacherToolbar() {
  const { canCreateExams } = usePermissions();
  return (
    <Toolbar>
      {canCreateExams && <Button onClick={createExam}>New Exam</Button>}
    </Toolbar>
  );
}
```

### 5.3 Role-Specific Layout Trees

#### Student Layout Tree

```
/s — StudentRoot (StudentLayout: sidebar + header)
├── /           → StudentDashboard          [lazy]
├── /spaces     → SpacesListPage            [lazy]
│   ├── /:id    → SpaceDetailPage           [lazy]
│   │   └── /items/:itemId → ItemViewPage  [lazy]
├── /exams      → ExamsListPage             [lazy]
│   └── /:id/results → ExamResultsPage     [lazy]
├── /leaderboard → LeaderboardPage          [lazy, real-time]
├── /chat        → AITutorPage              [lazy]
├── /progress    → ProgressPage             [lazy]
└── /settings    → StudentSettingsPage      [lazy]

Immersive (no layout):
/exam/:id/take  → ExamTakingPage           [separate chunk]
/space/:id/timed → TimedTestPage           [separate chunk]
```

#### Teacher Layout Tree

```
/t — TeacherRoot (TeacherLayout: sidebar + header)
├── /           → TeacherDashboard         [lazy]
├── /spaces     → TeacherSpacesPage        [lazy]
│   ├── /new    → CreateSpacePage          [lazy]
│   └── /:id    → SpaceEditorPage          [lazy, heavy editor chunk]
│       └── /items/:itemId → ItemEditorPage [lazy]
├── /exams      → TeacherExamsPage         [lazy]
│   ├── /new    → CreateExamPage           [lazy]
│   └── /:id    → ExamDetailPage           [lazy]
│       └── /submissions/:subId → GradingPage [lazy]
├── /students   → StudentsPage             [lazy]
│   └── /:id    → StudentProfilePage       [lazy]
├── /analytics  → AnalyticsDashboard       [lazy, chart chunk]
└── /settings   → TeacherSettingsPage      [lazy]
```

#### Parent Layout Tree

```
/p — ParentRoot (ParentLayout: minimal header)
├── /           → ParentOverviewPage       [lazy]
│   └── /child/:id → ChildProgressPage    [lazy]
├── /reports    → ReportsPage             [lazy]
└── /settings   → ParentSettingsPage      [lazy]
```

---

## 6. Real-Time Feature Patterns

### 6.1 Leaderboards

Leaderboards use Firebase Realtime Database (not Firestore) for sub-second
update latency.

#### Data Shape in RTDB

```
organizations/
  {orgId}/
    leaderboards/
      {spaceId}/
        entries/
          {userId}: {
            displayName: string
            photoURL: string
            score: number
            rank: number
            lastUpdated: number  // unix ms
          }
        meta: {
          updatedAt: number
          totalParticipants: number
        }
```

#### Component Pattern

```tsx
// features/leaderboards/LeaderboardPage.tsx
import { useLeaderboard } from "../../hooks/useLeaderboard";

export function LeaderboardPage() {
  const { spaceId } = useParams();
  const { currentOrgId, user } = useAuthStore();
  const { entries, myRank, isLoading } = useLeaderboard(
    currentOrgId!,
    spaceId!
  );

  return (
    <PageLayout title="Leaderboard">
      {myRank && <MyRankBanner rank={myRank} total={entries.length} />}
      <AnimatedLeaderboardTable entries={entries} highlightUserId={user?.uid} />
    </PageLayout>
  );
}

// packages/shared-hooks/src/data/useLeaderboard.ts
export function useLeaderboard(orgId: string, spaceId: string) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuthStore();

  useEffect(() => {
    const path = `organizations/${orgId}/leaderboards/${spaceId}/entries`;
    const ref = query(
      rtdbRef(rtdb, path),
      orderByChild("score"),
      limitToLast(50) // top 50 only
    );

    const unsub = onValue(ref, (snap) => {
      const raw = snap.val() ?? {};
      const sorted = Object.entries(raw)
        .map(([uid, data]) => ({ uid, ...(data as any) }))
        .sort((a, b) => b.score - a.score)
        .map((e, i) => ({ ...e, rank: i + 1 }));
      setEntries(sorted);
      setIsLoading(false);
    });

    return () => off(ref, "value", unsub);
  }, [orgId, spaceId]);

  const myRank = entries.find((e) => e.uid === user?.uid)?.rank;
  return { entries, myRank, isLoading };
}
```

#### Rank Change Animation

Use a stable `key` to preserve DOM nodes while animating position changes with
CSS `grid-row` transitions:

```tsx
function AnimatedLeaderboardTable({ entries, highlightUserId }) {
  return (
    <div
      className="grid gap-1"
      style={{ gridTemplateRows: "repeat(auto, 1fr)" }}
    >
      {entries.map((entry, idx) => (
        <LeaderboardRow
          key={entry.uid} // stable key = correct animation
          entry={entry}
          position={idx + 1}
          isCurrentUser={entry.uid === highlightUserId}
          style={{ transition: "transform 0.4s ease, opacity 0.4s ease" }}
        />
      ))}
    </div>
  );
}
```

### 6.2 Live Progress Tracking

Teacher's class view shows real-time completion of space items by students.

#### Data Shape in RTDB

```
organizations/
  {orgId}/
    liveProgress/
      {spaceId}/
        {userId}: {
          completedItems: string[]   // item IDs
          currentItemId: string | null
          lastSeen: number
          score: number
        }
```

#### Teacher Live View Hook

```tsx
export function useLiveClassProgress(
  orgId: string,
  spaceId: string,
  classId: string
) {
  const [progress, setProgress] = useState<Record<string, UserProgress>>({});

  // Get enrolled student IDs from TanStack Query (cached)
  const { data: students } = useClassStudents(orgId, classId);

  useEffect(() => {
    if (!students?.length) return;
    const path = `organizations/${orgId}/liveProgress/${spaceId}`;
    const ref = rtdbRef(rtdb, path);

    const unsub = onValue(ref, (snap) => {
      setProgress(snap.val() ?? {});
    });

    return () => off(ref, "value", unsub);
  }, [orgId, spaceId, students]);

  // Combine RTDB live data with student profiles
  const progressWithProfiles =
    students?.map((student) => ({
      student,
      progress: progress[student.uid] ?? null,
    })) ?? [];

  return progressWithProfiles;
}
```

### 6.3 Exam Timers

Timed exams require a reliable countdown that survives tab switches and network
interruptions.

#### Timer Architecture

The timer is **server-anchored**: the exam session start time is stored in
Firestore on creation; the client counts down from that fixed start time, not
from a client-initialized `Date.now()`. This prevents cheating via system clock
manipulation.

```tsx
// features/exams/hooks/useExamTimer.ts
export function useExamTimer(examSession: ExamSession) {
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isExpired, setIsExpired] = useState(false);

  // examSession.startedAt: Firestore Timestamp (server time)
  // examSession.durationSeconds: number
  const endTime = useMemo(() => {
    return (
      examSession.startedAt.toMillis() + examSession.durationSeconds * 1000
    );
  }, [examSession]);

  useEffect(() => {
    function tick() {
      const remaining = Math.max(0, endTime - Date.now());
      setTimeLeft(remaining);
      if (remaining === 0) {
        setIsExpired(true);
      }
    }

    tick(); // immediate
    const interval = setInterval(tick, 1000);

    // Handle tab visibility change (timer was paused by browser)
    const onVisible = () => tick();
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [endTime]);

  return { timeLeft, isExpired, formatted: formatDuration(timeLeft) };
}
```

#### Timer UI Component

```tsx
function ExamTimer({ session }: { session: ExamSession }) {
  const { timeLeft, isExpired, formatted } = useExamTimer(session);
  const isWarning = timeLeft < 5 * 60 * 1000; // < 5 min
  const isCritical = timeLeft < 1 * 60 * 1000; // < 1 min

  return (
    <div
      role="timer"
      aria-live="polite"
      aria-label={`Time remaining: ${formatted}`}
      className={cn(
        "font-mono text-2xl font-bold tabular-nums",
        isWarning && "text-warning",
        isCritical && "text-danger animate-pulse"
      )}
    >
      {formatted}
    </div>
  );
}
```

#### Auto-Submit on Expiry

```tsx
function ExamTakingPage() {
  const { session } = useExamSession();
  const submitMutation = useSubmitExam();

  // Auto-submit when timer expires
  const { isExpired } = useExamTimer(session);
  const didAutoSubmit = useRef(false);

  useEffect(() => {
    if (isExpired && !didAutoSubmit.current) {
      didAutoSubmit.current = true;
      submitMutation.mutate({ sessionId: session.id, autoSubmitted: true });
    }
  }, [isExpired]);
  // ...
}
```

### 6.4 AI Chat Streaming

The AI tutor uses Gemini's streaming API via a Firebase Cloud Function.
Responses are streamed to the client using Server-Sent Events (SSE).

```tsx
// features/chat/hooks/useAIChat.ts
export function useAIChat(contextItemId?: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController>();

  const sendMessage = useCallback(
    async (content: string) => {
      const userMsg: ChatMessage = { role: "user", content, id: nanoid() };
      setMessages((prev) => [...prev, userMsg]);

      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: "",
        id: nanoid(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setIsStreaming(true);

      abortRef.current = new AbortController();
      const token = await getIdToken(auth.currentUser!);

      try {
        const response = await fetch("/api/chat/stream", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages: [...messages, userMsg],
            contextItemId,
          }),
          signal: abortRef.current.signal,
        });

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id
                ? { ...m, content: m.content + chunk }
                : m
            )
          );
        }
      } finally {
        setIsStreaming(false);
      }
    },
    [messages, contextItemId]
  );

  const stopStreaming = () => abortRef.current?.abort();

  return { messages, isStreaming, sendMessage, stopStreaming };
}
```

---

## 7. Performance Optimization Strategy

### Bundle Size Targets

| Metric               | Target      | Measurement               |
| -------------------- | ----------- | ------------------------- |
| Initial JS (student) | < 200 KB gz | Vite bundle report        |
| Initial JS (teacher) | < 250 KB gz | Vite bundle report        |
| LCP (mobile 4G)      | < 2.5 s     | Lighthouse CI             |
| FID / INP            | < 100 ms    | Lighthouse CI             |
| CLS                  | < 0.1       | Lighthouse CI             |
| TTFB                 | < 600 ms    | Vercel / Firebase Hosting |

### Strategies

#### 1. Critical Path Rendering

The initial render must show meaningful content within 1 s on a 4G connection.
Only load what is needed for the above-the-fold content:

```tsx
// AppShell renders immediately with sidebar and header skeleton
// Feature content renders as second paint
<AppShell>
  <Suspense fallback={<DashboardSkeleton />}>
    <StudentDashboard /> {/* data fetching starts here */}
  </Suspense>
</AppShell>
```

#### 2. Image Optimization

All user-uploaded images (course thumbnails, org logos) go through Firebase
Storage resize extensions. The client requests the appropriate size:

```tsx
function CourseImage({ path, size = 400 }: { path: string; size?: number }) {
  // Firebase Storage resize extension appends _200x200 etc.
  const src = `${path}_${size}x${size}`;
  return (
    <img
      src={src}
      loading="lazy"
      decoding="async"
      width={size}
      height={size}
      alt=""
    />
  );
}
```

#### 3. Firestore Query Optimization

- All list queries use composite indexes (defined in `firestore.indexes.json`).
- Use `select()` projection to fetch only needed fields on list views:

```ts
// Only fetch title, thumbnail, lastUpdated for list view
SpacesService.list(orgId, { fields: ["title", "thumbnail", "lastUpdated"] });
```

- Paginate all lists (never `getDocs` without a `limit`).
- Use `orderBy` + `startAfter` cursor pagination (not offset).

#### 4. React Rendering Optimization

```tsx
// Memo expensive domain components
const MemoizedQuestionRenderer = memo(
  QuestionRenderer,
  (prev, next) =>
    prev.question.id === next.question.id && prev.answer === next.answer
);

// Avoid inline function re-creation in render
const handleAnswer = useCallback(
  (answer: string) => {
    updateProgress(answer);
  },
  [updateProgress]
);

// Virtualize long lists (leaderboard, submission queue)
import { useVirtualizer } from "@tanstack/react-virtual";

function SubmissionQueue({ submissions }: { submissions: Submission[] }) {
  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: submissions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
  });
  // ...
}
```

#### 5. TanStack Query Prefetching

Prefetch the next likely screen when the user hovers a nav item or card:

```tsx
function SpaceCard({ space }: { space: Space }) {
  const qc = useQueryClient();
  const { currentOrgId } = useAuthStore();

  const prefetch = () => {
    qc.prefetchQuery({
      queryKey: spacesKeys.detail(currentOrgId!, space.id),
      queryFn: () => SpacesService.getById(currentOrgId!, space.id),
      staleTime: 30_000,
    });
  };

  return <Card onMouseEnter={prefetch} ...>...</Card>;
}
```

#### 6. Service Worker & Offline Support

The web app registers a service worker for:

- Static asset caching (app shell, fonts, icons)
- Firestore offline persistence (`enableIndexedDbPersistence`)
- Background sync for progress submissions (student answers saved offline,
  synced on reconnect)

```ts
// src/main.tsx
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js");
}

// Firebase offline persistence
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === "failed-precondition") {
    // Multiple tabs open — persistence works in first tab only
  }
});
```

---

## 8. Accessibility Compliance

### Target Standard

**WCAG 2.1 Level AA** across all role surfaces.

### Structural Approach

Accessibility is achieved through the component library choice, not through
retrofitted ARIA attributes:

1. **Radix UI primitives** — All interactive primitives (Dialog, Select,
   DropdownMenu, etc.) implement the ARIA design patterns from the WAI-ARIA
   Authoring Practices Guide. We get keyboard navigation, focus management, and
   screen reader announcements for free.
2. **HTML semantics first** — Use `<nav>`, `<main>`, `<aside>`, `<header>`,
   `<section>` with correct landmark roles before reaching for `role=`
   attributes.
3. **Focus visible** — The Tailwind `ring` utilities are used consistently. The
   `:focus-visible` pseudo-class ensures rings only appear on keyboard
   navigation.

### Specific Patterns

#### Exam Accessibility

The exam taking page is the most complex accessibility surface:

```tsx
<main aria-label="Exam: Introduction to Biology, Question 3 of 20">
  {/* Timer: aria-live so screen readers announce time changes */}
  <ExamTimer session={session} /> {/* see §6.3 for aria-live="polite" */}
  {/* Question: unique heading per question */}
  <article aria-labelledby={`q-${question.id}-title`}>
    <h2 id={`q-${question.id}-title`} className="sr-only">
      Question {currentIndex + 1}
    </h2>
    <QuestionRenderer question={question} mode="exam" />
  </article>
  {/* Navigation */}
  <nav aria-label="Question navigation">
    <Button onClick={prev} disabled={currentIndex === 0}>
      Previous
    </Button>
    <Button onClick={next}>{isLast ? "Submit" : "Next"}</Button>
  </nav>
</main>
```

#### Leaderboard Accessibility

```tsx
<section aria-label="Class Leaderboard">
  <table role="grid" aria-rowcount={entries.length}>
    <caption className="sr-only">
      Top {entries.length} students ranked by score
    </caption>
    <thead>
      <tr>
        <th scope="col">Rank</th>
        <th scope="col">Student</th>
        <th scope="col">Score</th>
      </tr>
    </thead>
    <tbody aria-live="polite" aria-atomic="false">
      {entries.map((entry) => (
        <tr
          key={entry.uid}
          aria-current={entry.isCurrentUser ? "true" : undefined}
        >
          <td>#{entry.rank}</td>
          <td>{entry.displayName}</td>
          <td>{entry.score}</td>
        </tr>
      ))}
    </tbody>
  </table>
</section>
```

#### Skip Navigation

```tsx
// AppShell.tsx — rendered first in DOM
<a
  href="#main-content"
  className="focus:bg-accent-primary sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4
             focus:z-50 focus:rounded-md focus:px-4 focus:py-2 focus:text-white"
>
  Skip to main content
</a>
```

#### Colour Contrast

All semantic tokens are tested for WCAG AA contrast:

- `--text-primary` on `--surface-primary`: 15.6:1 (AAA)
- `--text-secondary` on `--surface-primary`: 4.8:1 (AA)
- `--accent-primary-fg` on `--accent-primary`: 4.7:1 (AA)
- Org-overridden accent colours are validated at runtime: if contrast < 4.5:1, a
  fallback colour is used.

#### Motion Preferences

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

#### ESLint A11y Enforcement

The shared ESLint config (`@levelup/eslint-config`) includes
`eslint-plugin-jsx-a11y` at the `recommended` level. Key rules enforced:

- `alt-text` — All `<img>` must have alt
- `interactive-supports-focus` — Clickable elements must be focusable
- `label` — All form inputs must have labels
- `no-autofocus` — No `autoFocus` except in modals
- `anchor-is-valid` — `<a>` must have valid href or button role

---

## 9. Inter-Package Dependency Map

```
apps/web ──────────────────────────────────────────┐
  │                                                  │
  ├── @levelup/shared-ui         (design system)     │
  │     └── @levelup/tailwind-config                 │
  │                                                  │
  ├── @levelup/shared-hooks      (React hooks)       │
  │     ├── @tanstack/react-query                    │
  │     └── firebase (peer)                          │
  │                                                  │
  ├── @levelup/shared-services   (Firebase layer)    │
  │     └── firebase                                 │
  │                                                  │
  ├── @levelup/shared-types      (TypeScript types)  │
  │                                                  │
  └── @levelup/shared-utils      (pure utils)        │
                                                     │
apps/admin ───────────────────────────────────────┤
apps/super-admin ─────────────────────────────────┤
apps/scanner ─────────────────────────────────────┘
  │
  └── (same package deps as apps/web)

Dependency Rules:
  shared-ui       → MAY import shared-types, shared-utils
  shared-ui       → MUST NOT import shared-services, shared-hooks
  shared-hooks    → MAY import shared-types, shared-services
  shared-services → MAY import shared-types
  shared-utils    → MUST NOT import any other @levelup package
  shared-types    → MUST NOT import anything (pure types)

  apps/*          → MAY import any package
  packages/*      → MUST NOT import apps/*
```

---

## 10. Migration Notes from Legacy Systems

### From LevelUp-App

| LevelUp Pattern                     | Unified Pattern                                | Notes                                |
| ----------------------------------- | ---------------------------------------------- | ------------------------------------ |
| Redux Toolkit (`store/slices/`)     | Zustand stores                                 | Drop Redux entirely; migrate 1 slice |
| React Context for auth/org          | `useAuthStore`, `useOrgStore`                  | Same data, simpler API               |
| React Context nesting (6 deep)      | Single `<AppInitializer>`                      | Reduces provider hell                |
| Direct Firebase calls in components | TanStack Query + shared-services               | All data through query layer         |
| 132 components in `src/components/` | Moved to `shared-ui/domain/` + feature folders | Follow taxonomy in §4.2              |
| `src/features/story-point/`         | `features/spaces/`                             | Rename: story-point → space-item     |

### From AutoGrade (client-admin)

| AutoGrade Pattern                     | Unified Pattern                         | Notes                      |
| ------------------------------------- | --------------------------------------- | -------------------------- |
| Custom Button/Modal/Table components  | `@levelup/shared-ui` primitives         | Delete custom; use shadcn  |
| React Hot Toast                       | Sonner (via shared-ui)                  | Better shadcn integration  |
| Per-app Zustand stores                | Shared Zustand stores from shared-hooks | Single source of truth     |
| `allowedRoles` prop on ProtectedRoute | `<RequireAuth roles={[]} />`            | Same pattern, unified impl |
| Firebase direct queries in pages      | TanStack Query + shared-services        | Align with web app pattern |

### Incremental Migration Strategy

Phase 1 (Auth): Migrate auth stores → `useAuthStore`. Both apps continue
working.

Phase 2 (UI): Replace custom components with `shared-ui`. One component at a
time; use snapshot tests to detect regressions.

Phase 3 (Services): Route all Firestore calls through `shared-services`. Replace
direct `getDocs` calls with TanStack Query hooks.

Phase 4 (Route Merge): Merge LevelUp routes into unified `/s`, `/t`, `/p`
prefixes. Set up redirects from old paths.

Phase 5 (Redux Removal): Delete `store/slices/coursesSlice.ts`. Replace any
`useSelector`/`useDispatch` with TanStack Query hooks.

---

_This document is the authoritative reference for all frontend implementation
work on the unified LevelUp+AutoGrade platform. Questions or amendments should
be raised via the architecture review process._
