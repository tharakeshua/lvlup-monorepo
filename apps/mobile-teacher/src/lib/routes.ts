/**
 * Central route map for the mobile-teacher app (TEACHER role).
 *
 * Owned by the SHELL (coordinator). Every screen lane imports `routes` and calls
 * a builder to navigate — never hand-writes a path string. Decouples the
 * expo-router file tree from the screens.
 *
 * Route tree mirrors docs/.../app/mobile-staff/ROUTE-TREE.md (TEACHER half),
 * namespace `#/teacher/*`. 5 bottom tabs: Home · Classes · Review · Insights · More.
 *
 * ⚠ FLATTENING RULE (from memory mobile-student-build): expo-router routes deeper
 * than ~3 segments render OUTSIDE the navigator on Android (bridgeless +
 * react-native-screens) and throw a navigation-context error. So every DETAIL /
 * sub-detail screen is a FLAT single-segment route under `/teacher/` that takes
 * its ids as QUERY PARAMS (not nested path segments). Tab roots + one-level
 * sub-routes (insights/at-risk) stay nested (proven safe ≤3 segments).
 */
import type { Href } from "expo-router";

const href = (path: string): Href => path as Href;
const qp = (path: string, params: Record<string, string | undefined>) => {
  const q = Object.entries(params)
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `${k}=${encodeURIComponent(v as string)}`)
    .join("&");
  return href(q ? `${path}?${q}` : path);
};

export const routes = {
  // ── entry / auth ────────────────────────────────────────────────
  login: () => href("/auth/login"),

  // ── TAB 1: Home ─────────────────────────────────────────────────
  home: () => href("/teacher/home"),
  /** Cross-class assignment tracker (linked from Home + Review). */
  assignments: () => href("/teacher/assignments"),

  // ── TAB 2: Classes (+ roster, students) ─────────────────────────
  classes: () => href("/teacher/classes"),
  classDetail: (classId: string) => qp("/teacher/class", { classId }),
  /** Assign content to a class — bottom sheet (⟶web for heavy authoring). */
  assignContent: (classId: string) => qp("/teacher/assign", { classId }),
  students: () => href("/teacher/students"),
  studentDetail: (studentId: string) => qp("/teacher/student", { studentId }),

  // ── TAB 3: Review (exams monitor + grading/review flow) ─────────
  review: () => href("/teacher/review"), // exams-overview (teacher monitor list)
  gradingQueue: () => href("/teacher/grading"), // submissions-grading-queue (live monitor)
  gradingReview: (examId: string) => qp("/teacher/grading-review", { examId }), // confidence-routed queue
  submissionDetail: (examId: string, submissionId: string) =>
    qp("/teacher/submission", { examId, submissionId }),
  /** Manual override — modal over submission-detail. */
  manualOverride: (examId: string, submissionId: string) =>
    qp("/teacher/override", { examId, submissionId }),
  /** Sub-question rubric breakdown — drawer over submission-detail. */
  rubricBreakdown: (examId: string, submissionId: string) =>
    qp("/teacher/rubric", { examId, submissionId }),
  examAnalytics: (examId: string) => qp("/teacher/exam-analytics", { examId }),
  /** Approve + publish results — modal. */
  resultsRelease: (examId: string) => qp("/teacher/release", { examId }),

  // ── TAB 4: Insights (class analytics hub) ───────────────────────
  insights: () => href("/teacher/insights"),
  // Flat single-segment routes (no nested folder) — keeps the router tree flat
  // and bridgeless-safe; the design's `#/teacher/insights/*` namespace maps here.
  atRisk: () => href("/teacher/at-risk"),
  classTests: () => href("/teacher/class-tests"),
  spaceAnalytics: () => href("/teacher/space-analytics"),

  // ── TAB 5: More (menu) ──────────────────────────────────────────
  more: () => href("/teacher/more"),
  announcements: () => href("/teacher/announcements"),
  notifications: () => href("/teacher/notifications"),
  settings: () => href("/teacher/settings"),
  /** Switch tenant/school — bottom sheet (from top bar + More). */
  tenantSwitcher: () => href("/teacher/tenant"),
} as const;

export type Routes = typeof routes;

/**
 * The five teacher bottom-tab base routes (longest-prefix match → active tab).
 * The tab navigator and the custom tab bar read from this single source.
 */
export const TAB_ROUTES = {
  home: "/teacher/home",
  classes: "/teacher/classes",
  review: "/teacher/review",
  insights: "/teacher/insights",
  more: "/teacher/more",
} as const;

export type TabKey = keyof typeof TAB_ROUTES;
