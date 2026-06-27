/**
 * Mounts the `@levelup/query` `ApiProvider` with the composed SDK + a WEB
 * `notify` adapter wrapping `sonner` (shared-ui's `sonnerToast`). `ApiProvider`
 * owns the QueryClientProvider, so the app does NOT mount its own
 * `@tanstack/react-query` client (removed from main.tsx).
 */
import { ApiProvider, type NotifyAdapter } from "@levelup/query";
import { sonnerToast } from "@levelup/shared-ui";
import type { ReactNode } from "react";

import { getSdk } from "./api";

// Web notifier: errors/success surface as sonner toasts (top-right, configured
// in main.tsx via <SonnerToaster richColors />). Both log in dev.
const notify: NotifyAdapter = {
  error(message, opts) {
    if (import.meta.env.DEV)
      // eslint-disable-next-line no-console
      console.warn("[notify:error]", message, opts?.description ?? "");
    sonnerToast.error(message, { description: opts?.description });
  },
  success(message, opts) {
    if (import.meta.env.DEV)
      // eslint-disable-next-line no-console
      console.log("[notify:success]", message, opts?.description ?? "");
    sonnerToast.success(message, { description: opts?.description });
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
      // Read errors must NOT throw to the React root — they land in
      // `query.isError` where screens degrade to empty/error states. The
      // per-route RouteErrorBoundary catches any residual throw.
      queryClientOptions={{ throwReadErrorsToBoundary: false }}
    >
      {children}
    </ApiProvider>
  );
}
