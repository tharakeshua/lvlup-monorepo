/**
 * Central route map for the mobile-student (learner) app.
 *
 * Owned by the **shell lane**. Every screen lane imports `routes` from here and
 * calls a builder to navigate — never hand-writes a path string. This keeps the
 * expo-router file tree (an implementation detail of the shell lane) decoupled
 * from the screens: if the shell reshapes the tree, only this file changes.
 *
 * Usage:
 *   import { routes } from '../../lib/routes';
 *   router.push(routes.space(spaceId));
 *   <Link href={routes.tests()} />
 *
 * Notes on expo-router semantics used here:
 *  - The learner tab shell lives under a real `learner/` segment (matching the
 *    design's `#/learner/*` namespace), so tab routes are `/learner/home`, … .
 *  - The timed-test **runner** and the **modals** (notifications, tutor, store,
 *    checkout) live at the router ROOT (outside the tab shell) so they render
 *    over / instead of the tab bar.
 *  - `checkout` carries its space via a query param so it can present as a modal
 *    from anywhere without a nested dynamic segment.
 */
import type { Href } from "expo-router";

export type TutorRouteParams =
  | { scope: "space"; spaceId: string; sessionId?: string }
  | { scope: "story_point"; spaceId: string; storyPointId: string; sessionId?: string }
  | {
      scope: "item";
      spaceId: string;
      storyPointId: string;
      itemId: string;
      sessionId?: string;
    };

const href = (path: string): Href => path as Href;

export const routes = {
  // ── entry / auth ────────────────────────────────────────────────
  /** Auth gate / first-run + post-logout. Full-screen (no tab bar). */
  login: () => href("/auth/login"),

  // ── tab: Home ───────────────────────────────────────────────────
  home: () => href("/learner/home"),
  /** B2C learner home variant. */
  consumer: () => href("/learner/home/consumer"),

  // ── tab: Learn (Spaces) ─────────────────────────────────────────
  spaces: () => href("/learner/learn"),
  space: (spaceId: string) => href(`/learner/learn/${spaceId}`),
  // content + practice are FLAT single-segment routes taking their ids as query
  // params (not nested path segments). Deeply-nested routes render outside the
  // navigator on Android (bridgeless + react-native-screens) and throw a
  // navigation-context error; a flat route behaves like the working SpaceDetail.
  spaceContent: (spaceId: string, storyPointId: string) =>
    href(
      `/learner/learn/content?spaceId=${encodeURIComponent(spaceId)}&storyPointId=${encodeURIComponent(storyPointId)}`
    ),
  practice: (spaceId: string, storyPointId: string) =>
    href(
      `/learner/learn/practice?spaceId=${encodeURIComponent(spaceId)}&storyPointId=${encodeURIComponent(storyPointId)}`
    ),

  // ── tab: Tests ──────────────────────────────────────────────────
  tests: () => href("/learner/tests"),
  /** Pre-test gate (rules / consent, no clock). */
  testGate: (storyPointId: string) => href(`/learner/tests/${storyPointId}/gate`),
  /** Full-screen focus runner (no tab bar) — root-level takeover. */
  testRun: (storyPointId: string) => href(`/run/${storyPointId}`),
  testResults: (storyPointId: string) => href(`/learner/tests/${storyPointId}/results`),
  testAnalytics: (storyPointId: string) => href(`/learner/tests/${storyPointId}/analytics`),
  /** Physical / AutoGrade exams list — the learner's exams + submission status (B2B). */
  exams: () => href("/learner/tests/exams"),
  /** Physical / AutoGrade exam results (B2B). */
  examResults: (examId: string) => href(`/learner/tests/exams/${examId}/results`),

  // ── tab: Progress ───────────────────────────────────────────────
  progress: () => href("/learner/progress"),
  rewards: () => href("/learner/progress/rewards"),
  achievements: () => href("/learner/progress/achievements"),
  leaderboard: () => href("/learner/progress/leaderboard"),
  goals: () => href("/learner/progress/goals"),

  // ── tab: Profile ────────────────────────────────────────────────
  profile: () => href("/learner/profile"),
  settings: () => href("/learner/profile/settings"),
  /** B2C account variant. */
  consumerProfile: () => href("/learner/profile/consumer"),

  // ── modals / drawers (root-level, present over the active tab) ──
  notifications: () => href("/notifications"),
  /** Scope picker; select a valid space before a tutor session can begin. */
  tutorPicker: () => href("/tutor"),
  /** AI tutor chat panel, always scoped to an authorized learning context. */
  tutor: (params: TutorRouteParams) => {
    const query = [
      `scope=${encodeURIComponent(params.scope)}`,
      `spaceId=${encodeURIComponent(params.spaceId)}`,
      ...(params.scope !== "space"
        ? [`storyPointId=${encodeURIComponent(params.storyPointId)}`]
        : []),
      ...(params.scope === "item" ? [`itemId=${encodeURIComponent(params.itemId)}`] : []),
      ...(params.sessionId ? [`sessionId=${encodeURIComponent(params.sessionId)}`] : []),
    ].join("&");
    return href(`/tutor?${query}`);
  },

  // ── store (B2C purchase flow, root-level) ───────────────────────
  store: () => href("/store"),
  storeSpace: (spaceId: string) => href(`/store/${spaceId}`),
  /** Checkout modal; pass the space being purchased via query param. */
  checkout: (spaceId?: string) =>
    href(spaceId ? `/store/checkout?spaceId=${spaceId}` : "/store/checkout"),
} as const;

export type Routes = typeof routes;

/**
 * The five learner bottom-tab base routes (longest-prefix match → active tab).
 * The tab navigator and any custom tab bar read from this single source.
 */
export const TAB_ROUTES = {
  home: "/learner/home",
  learn: "/learner/learn",
  tests: "/learner/tests",
  progress: "/learner/progress",
  profile: "/learner/profile",
} as const;

export type TabKey = keyof typeof TAB_ROUTES;
