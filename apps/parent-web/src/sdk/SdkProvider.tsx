/**
 * Mounts the `@levelup/query` `ApiProvider` with the composed SDK + a web-native
 * `notify` adapter (sonner toasts). `ApiProvider` owns the QueryClientProvider
 * (one shared default cache policy), so the app does NOT mount its own
 * `@tanstack/react-query` client.
 */
import { ApiProvider, type NotifyAdapter } from "@levelup/query";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { getSdk } from "./api";

// Web notifier: errors/success surface as sonner toasts (the app already mounts
// <SonnerToaster/> at the root via @levelup/shared-ui).
const notify: NotifyAdapter = {
  error(message, opts) {
    toast.error(message, { description: opts?.description });
  },
  success(message, opts) {
    toast.success(message, { description: opts?.description });
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
      isDev={import.meta.env.DEV}
      // Read errors must NOT throw to the React root. A fresh real account has
      // no derived docs yet (progress/summary → NOT_FOUND) and a read fired
      // before auth settles is UNAUTHENTICATED; the default policy throws those
      // to an error boundary. Off → they land in `query.isError`, where screens
      // degrade to a zero/empty state.
      queryClientOptions={{ throwReadErrorsToBoundary: false }}
    >
      {children}
    </ApiProvider>
  );
}
