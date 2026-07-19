/**
 * Navigation chrome: Tabbar (bottom), TopBar, Breadcrumb.
 * The Tabbar is presentational — the shell lane owns route wiring and feeds
 * `activeKey` + `onTabPress`.
 */
import { Fragment } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors } from "../theme";
import { cx } from "./cx";
import { Icon } from "./Icon";
import type { BreadcrumbProps, TabbarProps, TopBarProps } from "./_types";

// --- Tabbar -----------------------------------------------------------------
export function Tabbar({ items = [], activeKey, onTabPress, className }: TabbarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{ paddingBottom: Math.max(insets.bottom, 8) }}
      className={cx("border-border-subtle bg-surface flex-row border-t px-2 pt-2", className)}
    >
      {items.map((it) => {
        const active = activeKey != null ? it.key === activeKey : it.active;
        const isCreate = it.key === "create";
        return (
          <Pressable
            key={it.key}
            onPress={() => onTabPress?.(it.key)}
            className="min-h-12 flex-1 items-center gap-1 py-1"
            accessibilityRole="tab"
            accessibilityState={{ selected: !!active }}
          >
            <View
              className={cx(
                "rounded-pill h-8 min-w-10 items-center justify-center px-2",
                active && !isCreate && "bg-brand-subtle",
                isCreate && "bg-spark shadow-sm"
              )}
            >
              <Icon
                name={it.icon}
                size={isCreate ? 20 : 21}
                color={isCreate ? colors.textPrimary : active ? colors.brand : colors.textMuted}
                strokeWidth={active || isCreate ? 2.5 : 2}
              />
              {it.badge != null && it.badge > 0 && (
                <View
                  style={{ minWidth: 16 }}
                  className="bg-error absolute -right-2 -top-1 h-4 items-center justify-center rounded-full px-1"
                >
                  <Text className="font-ui text-2xs text-text-on-accent font-bold">
                    {it.badge > 99 ? "99+" : it.badge}
                  </Text>
                </View>
              )}
            </View>
            <Text
              className={cx(
                "font-ui text-2xs",
                isCreate
                  ? "text-text-primary font-semibold"
                  : active
                    ? "text-brand font-semibold"
                    : "text-text-muted"
              )}
            >
              {it.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// --- TopBar -----------------------------------------------------------------
export function TopBar({
  title,
  subtitle,
  left,
  right,
  onBack,
  transparent,
  className,
}: TopBarProps) {
  return (
    <View
      className={cx(
        "flex-row items-center gap-2 px-4 py-3",
        !transparent && "border-border-subtle bg-surface border-b",
        className
      )}
    >
      <View style={{ minWidth: 36 }} className="flex-row items-center">
        {onBack ? (
          <Pressable
            onPress={onBack}
            hitSlop={8}
            className="active:bg-surface-sunken h-9 w-9 items-center justify-center rounded-full"
          >
            <Icon name="chevron-left" size={24} color={colors.textPrimary} />
          </Pressable>
        ) : (
          left
        )}
      </View>
      <View className="flex-1 items-center">
        {typeof title === "string" ? (
          <Text
            numberOfLines={1}
            className="font-display text-text-primary text-base font-semibold"
          >
            {title}
          </Text>
        ) : (
          title
        )}
        {subtitle != null && (
          <Text numberOfLines={1} className="font-ui text-text-muted text-xs">
            {subtitle}
          </Text>
        )}
      </View>
      <View style={{ minWidth: 36 }} className="flex-row items-center justify-end">
        {right}
      </View>
    </View>
  );
}

// --- Breadcrumb -------------------------------------------------------------
export function Breadcrumb({ items = [], className }: BreadcrumbProps) {
  return (
    <View className={cx("flex-row flex-wrap items-center gap-1", className)}>
      {items.map((it, i) => {
        const last = i === items.length - 1;
        return (
          <Fragment key={i}>
            <Pressable onPress={it.onPress} disabled={!it.onPress || last}>
              <Text
                className={cx(
                  "font-ui text-sm",
                  last ? "text-text-primary font-semibold" : "text-text-muted"
                )}
              >
                {it.label}
              </Text>
            </Pressable>
            {!last && <Icon name="chevron-right" size={14} color={colors.textMuted} />}
          </Fragment>
        );
      })}
    </View>
  );
}
