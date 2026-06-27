/**
 * Admin composites — the tenant-admin building blocks layered on the Lyceum kit.
 *
 * Desktop admin screens are dense data tables + KPI grids + segmented role
 * switchers (see docs/rebuild-spec/design/build/prototypes/admin/*.card.html and
 * Lyceum-Mobile-Staff.html). On mobile those collapse to stacked cards/rows. This
 * module ships the reusable pieces every admin screen lane composes:
 *
 *   StatusPill   — status string → toned icon+label badge (never colour-only)
 *   RoleBadge    — role string → toned icon+label badge
 *   MetricCard   — a single KPI tile (icon · label · mono value · trend)
 *   KpiGrid      — even N-column grid of MetricCards
 *   RosterRow    — a person/record row (avatar · name · sub · tags · status)
 *   DataTable    — a desktop table rendered as stacked label→value cards
 *   SegmentedTabs— the segmented role/section switch with count pills
 *   FilterBar    — search field + filter pills toolbar
 *
 * Lyceum tokens only (zero raw hex); NativeWind v4 classes throughout.
 */
import { Fragment, Children } from "react";
import { Pressable, Text, View } from "react-native";

import { colors } from "../theme";
import { Avatar, Badge, Skeleton, EmptyState } from "./data";
import { Card } from "./primitives";
import { SearchField } from "./forms";
import { Icon, renderIcon } from "./Icon";
import { cx } from "./cx";
import type { ReactNode } from "react";
import type {
  BadgeVariant,
  DataTableColumn,
  DataTableProps,
  FilterBarProps,
  KpiGridProps,
  MetricCardProps,
  RoleBadgeProps,
  RosterRowProps,
  SegmentedTabsProps,
  StatusPillProps,
  StatusTone,
} from "./_types";

// --- shared mappings --------------------------------------------------------
const TONE_TO_VARIANT: Record<StatusTone, BadgeVariant> = {
  success: "success",
  warning: "warning",
  error: "error",
  info: "info",
  brand: "brand",
  neutral: "neutral",
};

/** status keyword → tone + default icon. Keys are matched on lowercased status. */
const STATUS_MAP: Record<string, { tone: StatusTone; icon: string }> = {
  active: { tone: "success", icon: "circle-check" },
  enabled: { tone: "success", icon: "circle-check" },
  published: { tone: "success", icon: "circle-check" },
  live: { tone: "success", icon: "circle-check" },
  online: { tone: "success", icon: "circle-check" },
  paid: { tone: "success", icon: "circle-check" },
  completed: { tone: "success", icon: "circle-check" },
  passed: { tone: "success", icon: "circle-check" },
  graded: { tone: "success", icon: "circle-check" },
  approved: { tone: "success", icon: "circle-check" },
  invited: { tone: "info", icon: "mail" },
  pending: { tone: "warning", icon: "clock" },
  processing: { tone: "info", icon: "loader" },
  scheduled: { tone: "info", icon: "calendar-clock" },
  draft: { tone: "neutral", icon: "pencil" },
  inprogress: { tone: "info", icon: "circle-dot" },
  in_progress: { tone: "info", icon: "circle-dot" },
  archived: { tone: "neutral", icon: "archive" },
  inactive: { tone: "neutral", icon: "circle-slash" },
  disabled: { tone: "neutral", icon: "circle-slash" },
  offline: { tone: "neutral", icon: "circle-slash" },
  suspended: { tone: "error", icon: "lock" },
  blocked: { tone: "error", icon: "ban" },
  failed: { tone: "error", icon: "circle-alert" },
  overdue: { tone: "error", icon: "circle-alert" },
  error: { tone: "error", icon: "octagon-alert" },
  unpaid: { tone: "warning", icon: "circle-alert" },
};

/** "in_progress" / "at-risk" → "In progress" / "At risk". */
function humanize(value: string): string {
  const spaced = value
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim();
  if (spaced.length === 0) return value;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2);
  return (parts[0][0] ?? "") + (parts[parts.length - 1][0] ?? "");
}

// --- StatusPill -------------------------------------------------------------
export function StatusPill({ status, tone, icon, label, children, className }: StatusPillProps) {
  const key = (status ?? "").toLowerCase().replace(/[\s-]+/g, "_");
  const mapped = STATUS_MAP[key] ?? STATUS_MAP[key.replace(/_/g, "")];
  const resolvedTone = tone ?? mapped?.tone ?? "neutral";
  const resolvedIcon = icon === false ? undefined : (icon ?? mapped?.icon);
  const content = children ?? label ?? (status ? humanize(status) : null);
  return (
    <Badge variant={TONE_TO_VARIANT[resolvedTone]} icon={resolvedIcon} className={className}>
      {content}
    </Badge>
  );
}

// --- RoleBadge --------------------------------------------------------------
const ROLE_MAP: Record<string, { tone: StatusTone; icon: string; label: string }> = {
  admin: { tone: "brand", icon: "shield-check", label: "Admin" },
  tenant_admin: { tone: "brand", icon: "shield-check", label: "Admin" },
  owner: { tone: "brand", icon: "crown", label: "Owner" },
  super_admin: { tone: "brand", icon: "shield-alert", label: "Super Admin" },
  teacher: { tone: "info", icon: "presentation", label: "Teacher" },
  staff: { tone: "info", icon: "briefcase", label: "Staff" },
  student: { tone: "success", icon: "graduation-cap", label: "Student" },
  parent: { tone: "warning", icon: "users", label: "Parent" },
};

export function RoleBadge({ role, label, icon, className }: RoleBadgeProps) {
  const key = (role ?? "").toLowerCase().replace(/[\s-]+/g, "_");
  const mapped = ROLE_MAP[key];
  const tone = mapped?.tone ?? "neutral";
  const resolvedIcon = icon === false ? undefined : (icon ?? mapped?.icon ?? "user");
  const content = label ?? mapped?.label ?? (role ? humanize(role) : null);
  return (
    <Badge variant={TONE_TO_VARIANT[tone]} icon={resolvedIcon} className={className}>
      {content}
    </Badge>
  );
}

// --- MetricCard -------------------------------------------------------------
const TREND_TONE_COLOR: Record<StatusTone, string> = {
  success: colors.success,
  warning: colors.warning,
  error: colors.error,
  info: colors.info,
  brand: colors.brand,
  neutral: colors.textMuted,
};
const TREND_TONE_TEXT: Record<StatusTone, string> = {
  success: "text-success",
  warning: "text-warning",
  error: "text-error",
  info: "text-info",
  brand: "text-brand",
  neutral: "text-text-muted",
};

export function MetricCard({
  label,
  value,
  icon,
  trend,
  caption,
  accent = "brand",
  onPress,
  className,
}: MetricCardProps) {
  const iconColor =
    accent === "spark" ? colors.spark : accent === "none" ? colors.textMuted : colors.brand;
  const trendTone: StatusTone =
    trend?.tone ??
    (trend?.direction === "up" ? "success" : trend?.direction === "down" ? "error" : "neutral");
  const trendIcon =
    trend?.direction === "up"
      ? "trending-up"
      : trend?.direction === "down"
        ? "trending-down"
        : "minus";

  return (
    <Card onPress={onPress} className={cx("gap-2 p-4", className)}>
      <View className="flex-row items-center gap-2">
        {renderIcon(icon, { size: 15, color: iconColor })}
        {label != null &&
          (typeof label === "string" ? (
            <Text className="font-ui text-text-muted text-xs font-medium">{label}</Text>
          ) : (
            label
          ))}
      </View>
      {typeof value === "string" || typeof value === "number" ? (
        <Text className="text-text-primary font-mono text-2xl font-medium">{value}</Text>
      ) : (
        value
      )}
      {trend != null && (
        <View className="flex-row items-center gap-1">
          <Icon name={trendIcon} size={13} color={TREND_TONE_COLOR[trendTone]} />
          {trend.label != null &&
            (typeof trend.label === "string" ? (
              <Text className={cx("font-ui text-xs", TREND_TONE_TEXT[trendTone])}>
                {trend.label}
              </Text>
            ) : (
              trend.label
            ))}
        </View>
      )}
      {trend == null &&
        caption != null &&
        (typeof caption === "string" ? (
          <Text className="font-ui text-text-muted text-xs">{caption}</Text>
        ) : (
          caption
        ))}
    </Card>
  );
}

// --- KpiGrid ----------------------------------------------------------------
export function KpiGrid({ items, columns = 2, children, className }: KpiGridProps) {
  const cells: ReactNode[] = items
    ? items.map((m, i) => <MetricCard key={i} {...m} />)
    : Children.toArray(children);

  const cols = Math.max(1, columns);
  const rows: ReactNode[][] = [];
  for (let i = 0; i < cells.length; i += cols) {
    rows.push(cells.slice(i, i + cols));
  }

  return (
    <View className={cx("gap-3", className)}>
      {rows.map((row, ri) => (
        <View key={ri} className="flex-row gap-3">
          {row.map((cell, ci) => (
            <View key={ci} className="flex-1">
              {cell}
            </View>
          ))}
          {/* pad the final row so cells keep an even width */}
          {row.length < cols &&
            Array.from({ length: cols - row.length }).map((_, pi) => (
              <View key={`pad-${pi}`} className="flex-1" />
            ))}
        </View>
      ))}
    </View>
  );
}

// --- RosterRow --------------------------------------------------------------
export function RosterRow({
  title,
  subtitle,
  initials,
  avatarUri,
  status,
  statusTone,
  tags,
  leading,
  trailing,
  chevron,
  selected,
  onPress,
  className,
}: RosterRowProps) {
  const derivedInitials = initials ?? (typeof title === "string" ? initialsFrom(title) : undefined);
  const avatar = leading ?? <Avatar uri={avatarUri} initials={derivedInitials} size="md" />;
  const showChevron = chevron ?? !!onPress;
  const Wrap = onPress ? Pressable : View;

  return (
    <Wrap
      onPress={onPress}
      className={cx(
        "flex-row items-center gap-3 rounded-lg border px-3 py-3",
        selected ? "border-brand bg-brand-subtle" : "border-border-subtle bg-surface",
        onPress && "active:bg-surface-sunken",
        className
      )}
    >
      {avatar}
      <View className="flex-1">
        {typeof title === "string" ? (
          <Text className="font-ui text-text-primary text-base font-semibold" numberOfLines={1}>
            {title}
          </Text>
        ) : (
          title
        )}
        {subtitle != null &&
          (typeof subtitle === "string" ? (
            <Text className="font-ui text-text-muted mt-0.5 text-xs" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : (
            subtitle
          ))}
        {tags != null && tags.length > 0 && (
          <View className="mt-1.5 flex-row flex-wrap gap-1">
            {tags.map((t, i) =>
              typeof t === "string" ? (
                <View
                  key={i}
                  className="border-border-subtle bg-surface-sunken self-start rounded-sm border px-2 py-0.5"
                >
                  <Text className="font-ui text-2xs text-text-secondary">{t}</Text>
                </View>
              ) : (
                <Fragment key={i}>{t}</Fragment>
              )
            )}
          </View>
        )}
      </View>
      {status != null && <StatusPill status={status} tone={statusTone} />}
      {trailing != null && <View>{trailing}</View>}
      {showChevron && <Icon name="chevron-right" size={18} color={colors.textMuted} />}
    </Wrap>
  );
}

// --- DataTable --------------------------------------------------------------
function cellValue<T>(col: DataTableColumn<T>, row: T, index: number): ReactNode {
  if (col.render) return col.render(row, index);
  if (col.accessor) return col.accessor(row);
  const raw = (row as Record<string, unknown>)?.[col.key];
  return raw == null ? "—" : (raw as ReactNode);
}

/** A desktop admin table, rendered on mobile as stacked label→value cards. */
export function DataTable<T = Record<string, unknown>>({
  columns = [],
  rows = [],
  keyExtractor,
  onRowPress,
  empty,
  loading,
  skeletonRows = 3,
  className,
}: DataTableProps<T>) {
  if (loading) {
    return (
      <View className={cx("gap-3", className)}>
        {Array.from({ length: skeletonRows }).map((_, i) => (
          <Card key={i} className="gap-3">
            <View className="flex-row items-center gap-3">
              <Skeleton variant="circle" width={32} height={32} />
              <Skeleton width={160} height={12} />
            </View>
            <Skeleton width="80%" height={10} />
            <Skeleton width="55%" height={10} />
          </Card>
        ))}
      </View>
    );
  }

  if (rows.length === 0) {
    return (
      <View className={className}>
        {empty ?? <EmptyState icon="inbox" title="Nothing here yet" />}
      </View>
    );
  }

  const primary = columns.find((c) => c.primary) ?? columns[0];
  const rest = columns.filter((c) => c !== primary);

  return (
    <View className={cx("gap-3", className)}>
      {rows.map((row, index) => {
        const key = keyExtractor ? keyExtractor(row, index) : String(index);
        const titleNode = primary ? cellValue(primary, row, index) : null;
        return (
          <Card
            key={key}
            onPress={onRowPress ? () => onRowPress(row, index) : undefined}
            className="gap-2.5"
          >
            <View className="flex-row items-center justify-between gap-3">
              {typeof titleNode === "string" || typeof titleNode === "number" ? (
                <Text className="font-ui text-text-primary flex-1 text-base font-semibold">
                  {titleNode}
                </Text>
              ) : (
                <View className="flex-1">{titleNode}</View>
              )}
              {onRowPress && <Icon name="chevron-right" size={18} color={colors.textMuted} />}
            </View>
            {rest.map((col) => {
              const v = cellValue(col, row, index);
              return (
                <View key={col.key} className="flex-row items-start justify-between gap-3">
                  <Text className="font-ui text-2xs text-text-muted uppercase tracking-wide">
                    {col.header ?? humanize(col.key)}
                  </Text>
                  {typeof v === "string" || typeof v === "number" ? (
                    <Text
                      className={cx(
                        "font-ui text-text-primary flex-1 text-right text-sm",
                        col.mono && "font-mono"
                      )}
                    >
                      {v}
                    </Text>
                  ) : (
                    <View className="flex-shrink items-end">{v}</View>
                  )}
                </View>
              );
            })}
          </Card>
        );
      })}
    </View>
  );
}

// --- SegmentedTabs ----------------------------------------------------------
export function SegmentedTabs({
  items = [],
  value,
  onChange,
  block,
  className,
}: SegmentedTabsProps) {
  const activeKey = value ?? items[0]?.key;
  return (
    <View
      className={cx(
        "border-border-subtle bg-surface-sunken flex-row gap-1 self-start rounded-md border p-1",
        block && "self-stretch",
        className
      )}
    >
      {items.map((it) => {
        const on = it.key === activeKey;
        return (
          <Pressable
            key={it.key}
            onPress={() => onChange?.(it.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            className={cx(
              "flex-row items-center justify-center gap-1.5 rounded-sm px-3 py-2",
              block && "flex-1",
              on && "bg-surface shadow-sm"
            )}
          >
            {renderIcon(it.icon, {
              size: 14,
              color: on ? colors.textPrimary : colors.textSecondary,
            })}
            {typeof it.label === "string" ? (
              <Text
                className={cx(
                  "font-ui text-sm",
                  on ? "text-text-primary font-semibold" : "text-text-secondary font-medium"
                )}
              >
                {it.label}
              </Text>
            ) : (
              it.label
            )}
            {it.count != null && (
              <View className={cx("rounded-pill px-1.5", on ? "bg-brand-subtle" : "bg-inset")}>
                <Text className={cx("text-2xs font-mono", on ? "text-brand" : "text-text-muted")}>
                  {it.count}
                </Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

// --- FilterBar --------------------------------------------------------------
export function FilterBar({
  search,
  onSearch,
  searchPlaceholder = "Search…",
  onClearSearch,
  filters,
  trailing,
  children,
  className,
}: FilterBarProps) {
  const showSearch = onSearch != null || search != null;
  return (
    <View className={cx("gap-3", className)}>
      {(showSearch || trailing != null) && (
        <View className="flex-row items-center gap-2">
          {showSearch && (
            <View className="flex-1">
              <SearchField
                value={search}
                onChangeText={onSearch}
                placeholder={searchPlaceholder}
                onClear={onClearSearch}
              />
            </View>
          )}
          {trailing != null && <View>{trailing}</View>}
        </View>
      )}
      {((filters != null && filters.length > 0) || children != null) && (
        <View className="flex-row flex-wrap items-center gap-2">
          {filters?.map((f) => (
            <Pressable
              key={f.key}
              onPress={f.onPress}
              className={cx(
                "flex-row items-center gap-1.5 rounded-md border px-3 py-2",
                f.active ? "border-brand bg-brand-subtle" : "border-border-subtle bg-surface"
              )}
            >
              {renderIcon(f.icon, { size: 14, color: f.active ? colors.brand : colors.textMuted })}
              {typeof f.label === "string" ? (
                <Text
                  className={cx(
                    "font-ui text-sm",
                    f.active ? "text-brand font-semibold" : "text-text-secondary"
                  )}
                >
                  {f.label}
                </Text>
              ) : (
                f.label
              )}
              <Icon
                name="chevron-down"
                size={14}
                color={f.active ? colors.brand : colors.textMuted}
              />
            </Pressable>
          ))}
          {children}
        </View>
      )}
    </View>
  );
}
