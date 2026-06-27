/**
 * App-local tenant-branding hook (parity gap workaround).
 *
 * `@levelup/query` has no branding equivalent and the legacy hooks-package import
 * must be removed. This thin copy reads tenant branding from
 * `@levelup/shared-stores` (which stays) and applies the colors as validated CSS
 * custom properties on `:root`. Mirrors the legacy `use-tenant-branding` hook.
 */
import { useEffect } from "react";
import { useTenantStore } from "@levelup/shared-stores";

const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

function isValidHexColor(value: string | undefined): value is string {
  return typeof value === "string" && HEX_COLOR_RE.test(value);
}

/**
 * Applies tenant branding colors as CSS custom properties on `:root`.
 * Validates colors are valid hex values to prevent CSS injection.
 * Call once in the app layout component.
 */
export function useTenantBranding(): void {
  const branding = useTenantStore((s) => s.tenant?.branding);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;

    if (isValidHexColor(branding?.primaryColor)) {
      root.style.setProperty("--tenant-primary", branding.primaryColor);
    } else {
      root.style.removeProperty("--tenant-primary");
    }

    if (isValidHexColor(branding?.accentColor)) {
      root.style.setProperty("--tenant-accent", branding.accentColor);
    } else {
      root.style.removeProperty("--tenant-accent");
    }

    return () => {
      root.style.removeProperty("--tenant-primary");
      root.style.removeProperty("--tenant-accent");
    };
  }, [branding?.primaryColor, branding?.accentColor]);
}
