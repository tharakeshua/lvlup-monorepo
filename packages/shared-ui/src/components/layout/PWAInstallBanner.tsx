import { useState, useEffect, useCallback } from "react";
import { X, Download } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PWAInstallBanner() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [pageViews, setPageViews] = useState(0);

  useEffect(() => {
    const stored = sessionStorage.getItem("pwa-install-dismissed");
    if (stored === "true") setDismissed(true);
  }, []);

  useEffect(() => {
    setPageViews((c) => c + 1);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };

    const installedHandler = () => {
      setInstallPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", installedHandler);

    // Already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setInstallPrompt(null);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") {
      setInstallPrompt(null);
    }
  }, [installPrompt]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    sessionStorage.setItem("pwa-install-dismissed", "true");
  }, []);

  // Show only when: install available, not dismissed, after 3+ page views
  if (!installPrompt || dismissed || pageViews < 3) return null;

  return (
    <div className="animate-in slide-in-from-bottom-4 fixed bottom-16 left-4 right-4 z-50 duration-300 md:bottom-4 md:left-auto md:right-4 md:max-w-sm">
      <div className="bg-background flex items-center gap-3 rounded-lg border p-3 shadow-lg">
        <Download className="text-primary h-5 w-5 shrink-0" />
        <div className="flex-1 text-sm">
          <p className="font-medium">Install LevelUp</p>
          <p className="text-muted-foreground">Get faster access and offline support</p>
        </div>
        <button
          onClick={handleInstall}
          className="bg-primary text-primary-foreground min-h-[44px] min-w-[44px] rounded-md px-3 py-2 text-sm font-medium"
        >
          Install
        </button>
        <button
          onClick={handleDismiss}
          className="text-muted-foreground hover:text-foreground min-h-[44px] min-w-[44px] rounded-md p-2"
          aria-label="Dismiss install prompt"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
