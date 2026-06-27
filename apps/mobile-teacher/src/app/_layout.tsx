// `react-native-get-random-values` MUST be the first import: `uuid` (v7, used by
// @levelup/api-client for idempotency keys) needs crypto.getRandomValues under
// Hermes. This polyfill must load before any SDK module.
import "react-native-get-random-values";
import "../global.css";

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { SdkProvider } from "../sdk/SdkProvider";
import { SessionProvider } from "../sdk/session";

/**
 * Root layout — owns provider wiring (from src/sdk) and the ROOT stack.
 *
 * The root stack holds, as siblings:
 *  - `index`         the auth gate (redirects to the tabs or to login)
 *  - `learner`       the bottom-tab shell (segment matching the #/learner/* design namespace)
 *  - `auth/login`    full-screen auth gate (no tab bar)
 *  - `run/[…]`       the timed-test runner — full-screen focus mode (no tab bar)
 *  - `notifications` / `tutor`  modal sheets that float over the active tab
 *  - `store`         the B2C purchase flow (its own nested stack)
 *
 * Tab-level sub-routes (space detail, content viewer, test gate/results, etc.)
 * live INSIDE each tab's stack so they keep the tab bar; only the runner and the
 * modals deliberately escape it by living here at the root.
 */
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SdkProvider>
          <SessionProvider>
            <StatusBar style="dark" />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="teacher" />
              <Stack.Screen name="auth/login" options={{ gestureEnabled: false }} />
            </Stack>
          </SessionProvider>
        </SdkProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
