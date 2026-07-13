import { useSWUpdate } from "../../hooks/use-sw-update";
import { RefreshCw } from "lucide-react";

export function SWUpdateNotification() {
  const { updateAvailable, applyUpdate } = useSWUpdate();

  if (!updateAvailable) return null;

  return (
    <div className="animate-in slide-in-from-top-4 fixed left-4 right-4 top-4 z-[60] duration-300 md:left-auto md:right-4 md:max-w-sm">
      <div className="bg-background flex items-center gap-3 rounded-lg border p-3 shadow-lg">
        <RefreshCw className="text-primary h-5 w-5 shrink-0" />
        <p className="flex-1 text-sm">A new version is available.</p>
        <button
          onClick={applyUpdate}
          className="bg-primary text-primary-foreground min-h-[44px] min-w-[44px] rounded-md px-3 py-2 text-sm font-medium"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}
