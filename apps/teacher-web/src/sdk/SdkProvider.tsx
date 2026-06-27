/**
 * Mounts the `@levelup/query` `ApiProvider` with the composed SDK + a web `notify`
 * adapter backed by `sonner` (the app already renders `<SonnerToaster>`). Ported
 * from apps/mobile-student/src/sdk/SdkProvider.tsx.
 *
 * `ApiProvider` owns the `QueryClientProvider` (one shared default cache policy),
 * so the app no longer mounts its own `@tanstack/react-query` client (removed from
 * main.tsx).
 */
import { ApiProvider, type NotifyAdapter } from "@levelup/query";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { getSdk } from "./api";

// Web notifier: errors/success surface through sonner toasts.
const notify: NotifyAdapter = {
  error(message, opts) {
    toast.error(message, { description: opts?.description, duration: opts?.durationMs });
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
      // Read errors must NOT throw to the React root. A read fired before auth
      // settles is UNAUTHENTICATED and a derived doc may be NOT_FOUND; the default
      // policy throws those to an error boundary. Off → they land in `query.isError`,
      // where pages degrade to an empty/error state. Per-route RouteErrorBoundary
      // still catches any residual throw.
      queryClientOptions={{ throwReadErrorsToBoundary: false }}
    >
      {children}
    </ApiProvider>
  );
}
