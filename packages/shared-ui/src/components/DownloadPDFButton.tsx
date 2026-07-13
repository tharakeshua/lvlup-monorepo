/**
 * DownloadPDFButton — Shared component for triggering PDF report generation
 * and opening the resulting signed URL.
 *
 * Accepts an `onGenerate` callback that performs the actual Cloud Function call,
 * keeping firebase imports out of shared-ui.
 */

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

export interface DownloadPDFButtonProps {
  /** Async callback that calls the appropriate Cloud Function and returns the download URL. */
  onGenerate: () => Promise<{ downloadUrl: string }>;
  label?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "md";
}

const VARIANT_CLASSES: Record<string, string> = {
  default: "bg-primary text-primary-foreground hover:bg-primary/90",
  outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
  ghost: "hover:bg-accent hover:text-accent-foreground",
};

export function DownloadPDFButton({
  onGenerate,
  label = "Download PDF",
  variant = "outline",
  size = "sm",
}: DownloadPDFButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await onGenerate();
      window.open(result.downloadUrl, "_blank");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to generate PDF";
      setError(message);
      console.error("[DownloadPDFButton]", err);
    } finally {
      setLoading(false);
    }
  };

  const sizeClasses = size === "sm" ? "h-8 px-3 text-xs" : "h-9 px-4 text-sm";

  return (
    <div className="inline-flex flex-col items-start">
      <button
        onClick={handleClick}
        disabled={loading}
        className={`inline-flex items-center gap-1.5 rounded-md font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 ${sizeClasses} ${VARIANT_CLASSES[variant]}`}
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Download className="h-3.5 w-3.5" />
        )}
        {loading ? "Generating..." : label}
      </button>
      {error && <p className="text-destructive mt-1 text-xs">{error}</p>}
    </div>
  );
}
