/**
 * Mounts the `@levelup/query` `ApiProvider` with the composed SDK + an RN-native
 * `notify` adapter. `ApiProvider` owns the QueryClientProvider (one shared default
 * cache policy), so the app does NOT mount its own `@tanstack/react-query` client.
 */
import { ApiProvider, type NotifyAdapter } from "@levelup/query";
import type { ReactNode } from "react";
import { Alert, LogBox, Platform } from "react-native";

import { getSdk } from "./api";

// Capture/visual-test only: silence the dev LogBox overlay so transient query
// warnings (e.g. an unauthenticated read during the brief pre-autologin window,
// or a not-found on a derived doc) don't cover the screen during screenshots.
// Inert in production builds (LogBox is dev-only).
if (process.env.EXPO_PUBLIC_AUTOLOGIN_EMAIL) {
  LogBox.ignoreAllLogs(true);
}

// Lightweight notifier: errors surface as an Alert on-device; both log in dev.
// A polished toast/snackbar lands in Phase 1 (component library).
const notify: NotifyAdapter = {
  error(message, opts) {
    if (__DEV__) console.warn("[notify:error]", message, opts?.description ?? "");
    if (Platform.OS !== "web") Alert.alert(message, opts?.description);
  },
  success(message, opts) {
    if (__DEV__) console.log("[notify:success]", message, opts?.description ?? "");
  },
};

export function SdkProvider({ children }: { children: ReactNode }) {
  const { api, repos, transport } = getSdk();
  return (
    <ApiProvider
      api={api}
      repos={repos}
      transport={transport}
      notify={notify}
      isDev={__DEV__}
      // Read errors must NOT throw to the React root. A fresh real account has
      // no derived docs yet (progress/summary/level → NOT_FOUND) and a read
      // fired before auto-login settles is UNAUTHENTICATED; the default policy
      // throws those to an error boundary, which — with no RN boundary mounted —
      // red-screens the whole app. Off → they land in `query.isError`, where the
      // screens degrade to a zero/empty state (see lib/query-status). The
      // per-screen ApiErrorBoundary (lib/screens) catches any residual throw.
      queryClientOptions={{ throwReadErrorsToBoundary: false }}
    >
      {children}
    </ApiProvider>
  );
}
