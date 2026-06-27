/**
 * Data + status display: Badge, Chip, Pill, Avatar, ProgressBar, ProgressRing
 * (aliased Ring/Meter), StatTile (aliased Stat), ListRow, SectionHeader,
 * Skeleton, EmptyState.
 */
import { Image, Pressable, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { colors } from "../theme";
import { cx } from "./cx";
import { Icon, renderIcon } from "./Icon";
import type {
  AvatarProps,
  BadgeProps,
  ChipProps,
  EmptyStateProps,
  ListRowProps,
  PillProps,
  ProgressBarProps,
  RingProps,
  SectionHeaderProps,
  SkeletonProps,
  StatTileProps,
} from "./_types";

// --- Badge ------------------------------------------------------------------
const BADGE_VARIANT: Record<string, { box: string; text: string; dot: string }> = {
  brand: { box: "bg-brand-subtle", text: "text-brand", dot: "bg-brand" },
  neutral: { box: "bg-surface-sunken", text: "text-text-secondary", dot: "bg-text-muted" },
  success: { box: "bg-green-200", text: "text-success", dot: "bg-success" },
  warning: { box: "bg-marigold-200", text: "text-warning", dot: "bg-warning" },
  error: { box: "bg-red-200", text: "text-error", dot: "bg-error" },
  info: { box: "bg-sky-500/15", text: "text-info", dot: "bg-info" },
  spark: { box: "bg-marigold-50", text: "text-marigold-600", dot: "bg-spark" },
};

export function Badge({ variant = "neutral", dot, icon, children, className }: BadgeProps) {
  const v = BADGE_VARIANT[variant] ?? BADGE_VARIANT.neutral;
  return (
    <View
      className={cx(
        "rounded-pill flex-row items-center gap-1.5 self-start px-2.5 py-1",
        v.box,
        className
      )}
    >
      {dot && <View className={cx("h-1.5 w-1.5 rounded-full", v.dot)} />}
      {renderIcon(icon, { size: 13, color: colors.textSecondary })}
      <Text className={cx("font-ui text-xs font-semibold", v.text)}>{children}</Text>
    </View>
  );
}

// --- Chip -------------------------------------------------------------------
export function Chip({
  active,
  removable,
  onPress,
  onRemove,
  leadingIcon,
  children,
  className,
}: ChipProps) {
  const Wrap = onPress ? Pressable : View;
  return (
    <Wrap
      onPress={onPress}
      className={cx(
        "rounded-pill flex-row items-center gap-1.5 self-start border px-3 py-1.5",
        active ? "border-brand bg-brand-subtle" : "border-border-strong bg-surface",
        className
      )}
    >
      {renderIcon(leadingIcon, { size: 14, color: active ? colors.brand : colors.textMuted })}
      <Text
        className={cx(
          "font-ui text-sm",
          active ? "text-brand font-semibold" : "text-text-secondary"
        )}
      >
        {children}
      </Text>
      {removable && (
        <Pressable onPress={onRemove} hitSlop={6}>
          <Icon name="x" size={14} color={active ? colors.brand : colors.textMuted} />
        </Pressable>
      )}
    </Wrap>
  );
}

// --- Pill / Tag -------------------------------------------------------------
export function Pill({ variant = "neutral", children, className }: PillProps) {
  return (
    <Badge variant={variant} className={className}>
      {children}
    </Badge>
  );
}

// --- Avatar -----------------------------------------------------------------
const AVATAR_SIZE: Record<string, number> = { sm: 32, md: 40, lg: 56, xl: 72 };

export function Avatar({ uri, src, initials, size = "md", className }: AvatarProps) {
  const px = typeof size === "number" ? size : (AVATAR_SIZE[size] ?? 40);
  const source = uri ?? src;
  const fontSize = Math.round(px * 0.38);
  return (
    <View
      style={{ width: px, height: px, borderRadius: px / 2 }}
      className={cx("items-center justify-center overflow-hidden bg-indigo-200", className)}
    >
      {source ? (
        <Image source={{ uri: source }} style={{ width: px, height: px }} />
      ) : (
        <Text style={{ fontSize }} className="font-ui font-bold text-indigo-700">
          {(initials ?? "?").slice(0, 2).toUpperCase()}
        </Text>
      )}
    </View>
  );
}

// --- ProgressBar ------------------------------------------------------------
const BAR_FILL: Record<string, string> = {
  brand: "bg-brand",
  spark: "bg-spark",
  success: "bg-success",
  warning: "bg-warning",
  error: "bg-error",
};

export function ProgressBar({
  value = 0,
  variant = "brand",
  height = 8,
  trackClassName,
  className,
}: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <View
      style={{ height }}
      className={cx(
        "rounded-pill bg-surface-sunken w-full overflow-hidden",
        trackClassName,
        className
      )}
    >
      <View
        style={{ width: `${pct}%` }}
        className={cx("rounded-pill h-full", BAR_FILL[variant] ?? BAR_FILL.brand)}
      />
    </View>
  );
}

// --- ProgressRing (Ring / Meter) -------------------------------------------
export function ProgressRing({
  value = 0,
  size = 56,
  strokeWidth = 6,
  color = colors.brand,
  label,
  children,
  className,
}: RingProps) {
  const pct = Math.max(0, Math.min(100, value));
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct / 100);
  const center = label ?? children ?? (
    <Text className="font-ui text-text-primary text-xs font-bold">{Math.round(pct)}</Text>
  );
  return (
    <View
      style={{ width: size, height: size }}
      className={cx("items-center justify-center", className)}
    >
      <Svg
        width={size}
        height={size}
        style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}
      >
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors.surfaceSunken}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </Svg>
      {center}
    </View>
  );
}

/** Aliases per the contract (`Meter`/`Ring`). */
export const Ring = ProgressRing;
export const Meter = ProgressRing;

// --- StatTile (Stat) --------------------------------------------------------
export function StatTile({ label, value, delta, trend, icon, className }: StatTileProps) {
  const trendColor =
    trend === "up" ? "text-success" : trend === "down" ? "text-error" : "text-text-muted";
  const trendIcon = trend === "up" ? "trending-up" : trend === "down" ? "trending-down" : null;
  return (
    <View className={cx("border-border-subtle bg-surface rounded-lg border p-3", className)}>
      <View className="flex-row items-center justify-between">
        <Text className="font-ui text-text-muted text-xs">{label}</Text>
        {renderIcon(icon, { size: 16, color: colors.textMuted })}
      </View>
      <Text className="font-display text-text-primary mt-1 text-2xl font-bold">{value}</Text>
      {delta != null && (
        <View className="mt-0.5 flex-row items-center gap-1">
          {trendIcon && (
            <Icon
              name={trendIcon}
              size={13}
              color={trend === "up" ? colors.success : colors.error}
            />
          )}
          <Text className={cx("font-ui text-xs font-semibold", trendColor)}>{delta}</Text>
        </View>
      )}
    </View>
  );
}

export const Stat = StatTile;

// --- ListRow ----------------------------------------------------------------
export function ListRow({
  title,
  subtitle,
  sub,
  leading,
  trailing,
  chevron,
  onPress,
  className,
}: ListRowProps) {
  const secondary = subtitle ?? sub;
  const showChevron = chevron ?? !!onPress;
  const Wrap = onPress ? Pressable : View;
  return (
    <Wrap
      onPress={onPress}
      className={cx(
        "flex-row items-center gap-3 rounded-md px-1 py-3",
        onPress && "active:bg-surface-sunken",
        className
      )}
    >
      {leading != null && <View>{leading}</View>}
      <View className="flex-1">
        {typeof title === "string" ? (
          <Text className="font-ui text-text-primary text-base font-semibold">{title}</Text>
        ) : (
          title
        )}
        {secondary != null &&
          (typeof secondary === "string" ? (
            <Text className="font-ui text-text-muted mt-0.5 text-sm">{secondary}</Text>
          ) : (
            secondary
          ))}
      </View>
      {trailing != null && <View>{trailing}</View>}
      {showChevron && <Icon name="chevron-right" size={18} color={colors.textMuted} />}
    </Wrap>
  );
}

// --- SectionHeader ----------------------------------------------------------
export function SectionHeader({
  title,
  subtitle,
  actions,
  action,
  right: rightProp,
  className,
}: SectionHeaderProps) {
  const right = actions ?? action ?? rightProp;
  return (
    <View className={cx("flex-row items-end justify-between", className)}>
      <View className="flex-1">
        {typeof title === "string" ? (
          <Text className="font-display text-text-primary text-lg font-semibold">{title}</Text>
        ) : (
          title
        )}
        {subtitle != null && (
          <Text className="font-ui text-text-muted mt-0.5 text-sm">{subtitle}</Text>
        )}
      </View>
      {right != null && <View className="ml-3">{right}</View>}
    </View>
  );
}

// --- Skeleton ---------------------------------------------------------------
export function Skeleton({
  width = "100%",
  height = 16,
  radius,
  variant = "rect",
  className,
}: SkeletonProps) {
  const br = radius ?? (variant === "circle" ? 999 : variant === "text" ? 6 : 8);
  const h = variant === "text" ? 12 : height;
  return (
    <View
      style={{ width: width as number, height: h as number, borderRadius: br }}
      className={cx("bg-surface-sunken opacity-70", className)}
    />
  );
}

// --- EmptyState -------------------------------------------------------------
export function EmptyState({ icon, title, body, action, className }: EmptyStateProps) {
  return (
    <View className={cx("items-center justify-center gap-3 px-6 py-12", className)}>
      {icon != null && (
        <View className="bg-surface-sunken h-14 w-14 items-center justify-center rounded-full">
          {renderIcon(icon, { size: 26, color: colors.textMuted })}
        </View>
      )}
      {title != null &&
        (typeof title === "string" ? (
          <Text className="font-display text-text-primary text-center text-lg font-semibold">
            {title}
          </Text>
        ) : (
          title
        ))}
      {body != null &&
        (typeof body === "string" ? (
          <Text className="font-ui text-text-muted max-w-xs text-center text-sm">{body}</Text>
        ) : (
          body
        ))}
      {action != null && <View className="mt-2">{action}</View>}
    </View>
  );
}
