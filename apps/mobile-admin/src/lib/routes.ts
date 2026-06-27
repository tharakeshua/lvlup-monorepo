/**
 * Central route map for the mobile-admin (tenant-admin) app.
 *
 * Owned by the **shell lane** (coordinator). Every screen lane imports `routes`
 * from here and calls a builder to navigate — never hand-writes a path string.
 *
 * Mirrors the design's `#/admin/*` namespace (app/mobile-staff/ROUTE-TREE.md,
 * ADMIN half). The admin tab shell lives under a real `admin/` segment (the
 * `(group)` paren form breaks Metro's pnpm resolution — see mobile-student
 * memory), so tab routes are `/admin/home`, `/admin/people`, … .
 *
 * Detail screens use FLAT routes with query params (not deep dynamic segments):
 * deeply-nested routes render outside the navigator on Android bridgeless and
 * throw a navigation-context error. A flat `?id=` route behaves correctly.
 */
import type { Href } from "expo-router";

const href = (path: string): Href => path as Href;
const q = (path: string, params: Record<string, string | undefined>): Href => {
  const qs = Object.entries(params)
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `${k}=${encodeURIComponent(v as string)}`)
    .join("&");
  return href(qs ? `${path}?${qs}` : path);
};

export const routes = {
  // ── entry / auth ────────────────────────────────────────────────
  login: () => href("/auth/login"),

  // ── tab: Home ───────────────────────────────────────────────────
  home: () => href("/admin/home"),

  // ── tab: People ─────────────────────────────────────────────────
  people: () => href("/admin/people"),
  staff: () => href("/admin/people/staff"),
  roles: () => href("/admin/people/roles"),
  parents: () => href("/admin/people/parents"),
  /** User detail — kind = student|teacher|parent|staff. */
  userDetail: (userId: string, kind?: string) => q("/admin/people/user", { userId, kind }),

  // ── tab: Academics ──────────────────────────────────────────────
  academics: () => href("/admin/academics"),
  classDetail: (classId: string) => q("/admin/academics/class", { classId }),
  content: () => href("/admin/academics/content"),
  courses: () => href("/admin/academics/courses"),
  exams: () => href("/admin/academics/exams"),
  sessions: () => href("/admin/academics/sessions"),

  // ── tab: Insights ───────────────────────────────────────────────
  insights: () => href("/admin/insights"),
  reports: () => href("/admin/insights/reports"),
  aiUsage: () => href("/admin/insights/ai-usage"),

  // ── tab: More (settings / comms / data) ─────────────────────────
  more: () => href("/admin/more"),
  announcements: () => href("/admin/more/announcements"),
  notifications: () => href("/admin/more/notifications"),
  settings: () => href("/admin/more/settings"),
  dataExport: () => href("/admin/more/data-export"),

  // ── modals / sheets (root-level, present over the active tab) ────
  /** Onboarding wizard — sheet/modal, "Continue on web" for heavy steps. */
  onboarding: () => href("/onboarding"),
  /** Tenant / role switcher sheet. */
  switcher: () => href("/switcher"),
} as const;

export type Routes = typeof routes;

/**
 * The five admin bottom-tab base routes (longest-prefix match → active tab).
 */
export const TAB_ROUTES = {
  home: "/admin/home",
  people: "/admin/people",
  academics: "/admin/academics",
  insights: "/admin/insights",
  more: "/admin/more",
} as const;

export type TabKey = keyof typeof TAB_ROUTES;
