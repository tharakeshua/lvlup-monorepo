/**
 * Mounts the `@levelup/query` `ApiProvider` with the composed SDK + a web
 * `notify` adapter backed by `sonner`. `ApiProvider` OWNS the QueryClientProvider
 * (one shared default cache policy), so the app does NOT mount its own
 * `@tanstack/react-query` client (the old `main.tsx` QueryClientProvider is gone).
 */
import { ApiProvider, type NotifyAdapter } from "@levelup/query";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { getSdk } from "./api";

// Web notifier: errors/success surface as sonner toasts (the app already renders
// <SonnerToaster/>). RN apps use Alert; here we wrap the existing toast.
const notify: NotifyAdapter = {
  error(message, opts) {
    toast.error(message, {
      description: opts?.description,
      duration: opts?.durationMs,
    });
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
      // Read errors must NOT throw to the React root. A fresh tenant has no
      // derived docs yet (summary/cost → NOT_FOUND) and a read fired before
      // auth settles is UNAUTHENTICATED; the default policy throws those to an
      // error boundary. Off → they land in `query.isError`, where pages degrade
      // to an empty/error state.
      queryClientOptions={{ throwReadErrorsToBoundary: false }}
    >
      {children}
    </ApiProvider>
  );
}
