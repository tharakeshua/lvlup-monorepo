/**
 * Mounts the `@levelup/query` `ApiProvider` with the composed SDK + a web `notify`
 * adapter backed by `sonner` toasts. `ApiProvider` OWNS the QueryClientProvider
 * (one shared default cache policy), so the app must NOT mount its own
 * `@tanstack/react-query` client — main.tsx drops the legacy `QueryClientProvider`.
 *
 * WEB DIFF vs apps/mobile-student/src/sdk/SdkProvider.tsx: `notify` wraps the
 * `sonner` toast (the app already renders <SonnerToaster/>) instead of RN `Alert`.
 */
import { ApiProvider, type NotifyAdapter } from "@levelup/query";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { getSdk } from "./api";

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
      // Read errors must NOT throw to the React root. A fresh real account has no
      // derived docs yet (progress/summary/level → NOT_FOUND) and a read fired
      // before auth settles is UNAUTHENTICATED; off → they land in `query.isError`
      // where screens degrade to empty/error state.
      queryClientOptions={{ throwReadErrorsToBoundary: false }}
    >
      {children}
    </ApiProvider>
  );
}
