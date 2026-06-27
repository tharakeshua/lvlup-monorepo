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
 * Root stack siblings:
 *  - `index`          the auth gate (redirects to the admin tabs or to login)
 *  - `admin`          the bottom-tab admin shell (segment matching `#/admin/*`)
 *  - `auth/login`     full-screen auth gate (no tab bar)
 *  - `onboarding`     onboarding wizard — modal sheet over the active tab
 *  - `switcher`       tenant / role switcher — modal sheet
 *
 * Tab-level sub-routes (people detail, class detail, settings, …) live INSIDE
 * each tab's stack so they keep the tab bar; only the modals escape it here.
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
              <Stack.Screen name="admin" />
              <Stack.Screen name="auth/login" options={{ gestureEnabled: false }} />
              <Stack.Screen name="onboarding" options={{ presentation: "modal" }} />
              <Stack.Screen name="switcher" options={{ presentation: "modal" }} />
            </Stack>
          </SessionProvider>
        </SdkProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
