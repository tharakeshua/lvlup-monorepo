# mobile-student — Navigation Shell (shell lane deliverable)

**Gate: MOUNTABLE ✓** — proven by a real Metro/Hermes export:
`EXPO_NO_TELEMETRY=1 npx expo export --platform ios` →
`iOS Bundled (3055 modules)`, 8.28 MB `.hbc`, `Exported`.

## What landed

- **expo-router tree** under `src/app` (learner half of the ROUTE-TREE).
- **Bottom tab navigator** `src/app/learner/_layout.tsx` — 5 tabs Home · Learn ·
  Tests · Progress · Profile (lucide icons, Lyceum tokens).
- **Per-tab Stacks** so sub-routes keep the tab bar; **full-screen runner** +
  **modals** live at root (no tab bar).
- **Auth gate** `src/app/index.tsx` (redirect) + real **login**
  `src/app/auth/login.tsx` (seeded creds + `EXPO_PUBLIC_SMOKE_AUTOLOGIN` for
  GATE-0).
- **`src/lib/routes.ts`** — the flat navigation API every screen lane imports.
- **`src/lib/screens.tsx`** — screen registry (the ONLY seam to screen lanes).
- Providers (`SdkProvider`/`SessionProvider`) preserved in root `_layout.tsx`;
  added `GestureHandlerRootView`.
- Deps added to `package.json`: `lucide-react-native ^0.460.0`,
  `react-native-svg 15.8.0`.

## Route map (file → URL → screen symbol)

```
index.tsx                                    /                         → redirect (auth gate)
auth/login.tsx                               /auth/login               → LoginScreen (shell-owned, real)
learner/_layout.tsx                          —                         → Tabs (5)
learner/home/index.tsx                       /learner/home             → HomeScreen
learner/home/consumer.tsx                    /learner/home/consumer    → ConsumerDashboardScreen
learner/learn/index.tsx                      /learner/learn            → SpacesListScreen
learner/learn/[spaceId]/index.tsx            /learner/learn/:s         → SpaceDetailScreen
learner/learn/[spaceId]/content/[storyPointId].tsx  …/content/:sp      → ContentViewerScreen
learner/learn/[spaceId]/practice/[storyPointId].tsx …/practice/:sp     → PracticeModeScreen
learner/tests/index.tsx                      /learner/tests            → TestsListScreen
learner/tests/[storyPointId]/gate.tsx        …/:sp/gate                → TimedTestLandingScreen
learner/tests/[storyPointId]/results.tsx     …/:sp/results             → TestResultsReviewScreen
learner/tests/[storyPointId]/analytics.tsx   …/:sp/analytics           → TestSessionAnalyticsScreen
learner/tests/exams/[examId]/results.tsx     …/exams/:e/results        → ExamResultsViewScreen
learner/progress/index.tsx                   /learner/progress         → ProgressAnalyticsScreen
learner/progress/rewards.tsx                 …/rewards                 → GamificationRewardsScreen
learner/progress/achievements.tsx            …/achievements            → AchievementsScreen
learner/progress/leaderboard.tsx             …/leaderboard             → LeaderboardScreen
learner/progress/goals.tsx                   …/goals                   → GoalsScreen
learner/profile/index.tsx                    /learner/profile          → ProfileScreen
learner/profile/settings.tsx                 …/settings                → SettingsScreen
learner/profile/consumer.tsx                 …/consumer                → ConsumerProfileScreen
run/[storyPointId].tsx                       /run/:sp   (FULL-SCREEN)  → TimedTestRunnerScreen
notifications.tsx                            /notifications  (modal)   → NotificationsScreen
tutor.tsx                                    /tutor          (modal)   → AiTutorChatScreen
store/index.tsx                              /store                    → StoreBrowseScreen
store/[spaceId].tsx                          /store/:s                 → StoreSpaceDetailScreen
store/checkout.tsx                           /store/checkout (modal)   → CheckoutScreen
```

All 27 learner ROUTE-TREE nodes placed. Navigation via `routes.*` builders (see
`routes.ts`).

## Integration: flipping placeholders → real screens

Every route mounts a **placeholder** from `src/lib/screens.tsx` so the shell is
mountable standalone. To wire a real screen, change ONE line in `screens.tsx`:

```ts
// from:
export const HomeScreen = makePlaceholder("Home", "/learner/home", "home lane");
// to (only once the file is confirmed present):
export { default as HomeScreen } from "../screens/home/HomeScreen";
```

The router tree imports ONLY `../lib/screens` — never `src/screens/*` or
`src/components/*` directly — so the shared Metro bundle never reaches an
in-flight sibling file. Flips are the sole coupling; do them at each lane's
gate.

## Gotcha fixed

expo-router route **groups with parens** `(learner)` break Metro's pnpm module
resolution in this monorepo (fails to resolve `expo-router` from inside the
group). Use a **real `learner/` segment** (also matches `#/learner/*` design
namespace). Mountability is proven by `expo export`, not `tsc`.
