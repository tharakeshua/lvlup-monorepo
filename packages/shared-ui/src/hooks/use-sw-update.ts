import { useState, useEffect, useCallback } from "react";

/**
 * Hook to detect service worker updates and allow users to refresh.
 * Listens for the 'sw-update-available' custom event dispatched by main.tsx
 * when a new service worker is installed.
 */
export function useSWUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    const handler = () => setUpdateAvailable(true);
    window.addEventListener("sw-update-available", handler);
    return () => window.removeEventListener("sw-update-available", handler);
  }, []);

  const applyUpdate = useCallback(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.getRegistration().then((registration) => {
      if (registration?.waiting) {
        registration.waiting.postMessage({ type: "SKIP_WAITING" });
      }
    });
  }, []);

  return { updateAvailable, applyUpdate };
}
