import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { initializeFirebase } from "@levelup/shared-services";
import { ErrorBoundary, SonnerToaster } from "@levelup/shared-ui";
import { reportWebVitals } from "@levelup/shared-utils/web-vitals";
import { SdkProvider } from "./sdk/SdkProvider";
import App from "./App";
import "./index.css";

// `initializeFirebase` must run BEFORE the SDK composition root mounts: the SDK's
// firebase.ts reuses this same default app via getApp(), so legacy useAuthStore
// (shared-stores) and the @levelup/query SDK share one auth instance.
initializeFirebase({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
});

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <SdkProvider>
        <BrowserRouter>
          <App />
          <SonnerToaster position="top-right" richColors />
        </BrowserRouter>
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
        // Check for updates periodically (every 60 minutes)
        setInterval(() => registration.update(), 60 * 60 * 1000);

        // Notify user when a new version is available
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              // New content available — dispatch custom event for UI to handle
              window.dispatchEvent(new CustomEvent("sw-update-available"));
            }
          });
        });
      })
      .catch(() => {
        // SW registration failed silently
      });
  });

  // Reload when the new SW takes control
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    window.location.reload();
  });
}
