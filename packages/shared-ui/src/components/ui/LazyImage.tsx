import { useState, type ImgHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export interface LazyImageProps extends Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  "loading" | "decoding"
> {
  /** Image source URL */
  src: string;
  /** Alt text for accessibility */
  alt: string;
  /** Width to prevent layout shift */
  width?: number | string;
  /** Height to prevent layout shift */
  height?: number | string;
  /** CSS class name */
  className?: string;
  /** Fallback element shown on error */
  fallback?: React.ReactNode;
  /** Use eager loading for above-fold images */
  eager?: boolean;
}

const defaultFallback = (
  <div className="bg-muted text-muted-foreground flex h-full w-full items-center justify-center">
    <svg
      className="h-8 w-8"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z"
      />
    </svg>
  </div>
);

export function LazyImage({
  src,
  alt,
  width,
  height,
  className,
  fallback = defaultFallback,
  eager = false,
  ...props
}: LazyImageProps) {
  const [hasError, setHasError] = useState(false);

  if (hasError || !src) {
    return (
      <div
        className={cn("overflow-hidden", className)}
        style={{ width, height }}
        role="img"
        aria-label={alt}
      >
        {fallback}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      className={className}
      onError={() => setHasError(true)}
      {...props}
    />
  );
}
