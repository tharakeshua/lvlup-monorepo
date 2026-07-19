/**
 * Icon — thin wrapper over lucide-react-native.
 *
 * Accepts a kebab-case `name` (e.g. "book-open", "flame", "check-circle") to
 * match how the Lyceum web designs reference icons (`<Icon name="..." />`). The
 * name is resolved to lucide's PascalCase component; unknown names fall back to
 * a neutral circle so a typo never crashes a screen.
 *
 * Color defaults to the primary ink token; pass `color` for accents or
 * `className` (NativeWind, via css-interop) to tint contextually.
 */
import { type ComponentType, type ReactNode, isValidElement } from "react";
import * as Lucide from "lucide-react-native";

import { colors } from "../theme";
import type { IconName, IconProps } from "./_types";

type LucideComponent = ComponentType<{
  size?: number;
  color?: string;
  strokeWidth?: number;
  fill?: string;
  className?: string;
}>;

const registry = Lucide as unknown as Record<string, LucideComponent>;

/** "book-open" → "BookOpen"; "Flame" passes through. */
function toPascal(name: string): string {
  if (name.length > 0 && name[0] === name[0].toUpperCase() && !name.includes("-")) {
    return name; // already PascalCase
  }
  return name
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((seg) => seg.charAt(0).toUpperCase() + seg.slice(1))
    .join("");
}

const Fallback = (registry.Circle ?? registry.HelpCircle) as LucideComponent;

export function Icon({
  name,
  size = 20,
  color = colors.textPrimary,
  strokeWidth = 2,
  fill = "none",
  className,
}: IconProps) {
  const Cmp = registry[toPascal(name)] ?? Fallback;
  return (
    <Cmp size={size} color={color} strokeWidth={strokeWidth} fill={fill} className={className} />
  );
}

/**
 * Render an icon-or-node prop. Components accept `IconName | ReactNode` for icon
 * slots; pass the value through this to get a consistent element either way.
 */
export function renderIcon(
  icon: IconName | ReactNode | undefined,
  opts?: { size?: number; color?: string; strokeWidth?: number }
): ReactNode {
  if (icon == null || icon === false) return null;
  if (typeof icon === "string") {
    return (
      <Icon name={icon} size={opts?.size} color={opts?.color} strokeWidth={opts?.strokeWidth} />
    );
  }
  if (isValidElement(icon)) return icon;
  return null;
}
