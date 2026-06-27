import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { ErrorBoundary, SonnerToaster } from "@levelup/shared-ui";
import { reportWebVitals } from "@levelup/shared-utils/web-vitals";
import { SdkProvider } from "./sdk/SdkProvider";
import { SessionProvider } from "./sdk/session";
import App from "./App";
import "./index.css";
import "katex/dist/katex.min.css";

// Firebase init + the QueryClient are now owned by the SDK composition root:
// `SdkProvider` mounts `@levelup/query`'s `ApiProvider` (which owns the
// QueryClientProvider), and `SessionProvider` (inside it) replaces the legacy
// auth/tenant stores.
createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <SdkProvider>
        <SessionProvider>
          <BrowserRouter>
            <App />
            <SonnerToaster richColors position="top-right" />
          </BrowserRouter>
        </SessionProvider>
      </SdkProvider>
    </ThemeProvider>
  </ErrorBoundary>
);

// Report Web Vitals (FCP, LCP, CLS, FID, TTFB)
reportWebVitals();

// Register service worker for PWA support
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        setInterval(() => registration.update(), 60 * 60 * 1000);
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              window.dispatchEvent(new CustomEvent("sw-update-available"));
            }
          });
        });
      })
      .catch(() => {
        // SW registration failed silently
      });
  });
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    window.location.reload();
  });
}
