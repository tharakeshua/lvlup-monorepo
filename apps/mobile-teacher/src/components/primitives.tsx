/**
 * Layout + action primitives: Screen, Card, Button, IconButton, Divider.
 * Lyceum look — paper surfaces, soft borders, indigo brand, marigold spark.
 */
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "../theme";
import { cx } from "./cx";
import { renderIcon } from "./Icon";
import type { ButtonProps, CardProps, DividerProps, IconButtonProps, ScreenProps } from "./_types";

// --- Screen -----------------------------------------------------------------
export function Screen({
  children,
  className,
  scroll = true,
  contentClassName,
  edges = ["top", "bottom"],
  background = "canvas",
}: ScreenProps) {
  const bg = background === "surface" ? "bg-surface" : "bg-canvas";
  const body = scroll ? (
    <ScrollView
      className={cx("flex-1", bg)}
      contentContainerClassName={cx("px-5 pb-8 pt-5 gap-5", contentClassName)}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View className={cx("flex-1 px-5 pb-8 pt-5", bg, contentClassName)}>{children}</View>
  );

  return (
    <SafeAreaView edges={edges} className={cx("flex-1", bg, className)}>
      {body}
    </SafeAreaView>
  );
}

// --- Card -------------------------------------------------------------------
export function Card({ children, className, interactive, onPress, style }: CardProps) {
  const base = "rounded-xl border border-border-subtle bg-surface p-4";
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={style}
        className={cx(base, "active:bg-surface-sunken shadow-sm active:opacity-95", className)}
      >
        {children}
      </Pressable>
    );
  }
  return (
    <View style={style} className={cx(base, interactive && "shadow-sm", className)}>
      {children}
    </View>
  );
}

// --- Button -----------------------------------------------------------------
const BTN_VARIANT: Record<string, { box: string; text: string; spinner: string }> = {
  primary: {
    box: "bg-brand active:bg-brand-hover",
    text: "text-text-on-accent",
    spinner: colors.textOnAccent,
  },
  secondary: {
    box: "bg-surface border border-border-strong active:bg-surface-sunken",
    text: "text-text-primary",
    spinner: colors.textPrimary,
  },
  ghost: {
    box: "bg-transparent active:bg-brand-subtle",
    text: "text-brand",
    spinner: colors.brand,
  },
  danger: {
    box: "bg-error active:opacity-90",
    text: "text-text-on-accent",
    spinner: colors.textOnAccent,
  },
  spark: { box: "bg-spark active:opacity-90", text: "text-ink-900", spinner: colors.textPrimary },
};

const BTN_SIZE: Record<string, { box: string; text: string; icon: number }> = {
  sm: { box: "min-h-11 px-3 py-2 gap-1.5", text: "text-sm", icon: 16 },
  md: { box: "min-h-12 px-4 py-3 gap-2", text: "text-base", icon: 18 },
  lg: { box: "min-h-14 px-5 py-4 gap-2", text: "text-lg", icon: 20 },
};

export function Button({
  variant = "primary",
  size = "md",
  block,
  loading,
  disabled,
  leadingIcon,
  trailingIcon,
  onPress,
  className,
  children,
}: ButtonProps) {
  const v = BTN_VARIANT[variant] ?? BTN_VARIANT.primary;
  const s = BTN_SIZE[size] ?? BTN_SIZE.md;
  const isOff = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isOff}
      className={cx(
        "flex-row items-center justify-center rounded-lg",
        v.box,
        s.box,
        block && "w-full",
        isOff && "opacity-50",
        (variant === "primary" || variant === "spark") && "shadow-sm",
        className
      )}
    >
      {loading ? (
        <ActivityIndicator size="small" color={v.spinner} />
      ) : (
        renderIcon(leadingIcon, { size: s.icon, color: v.spinner })
      )}
      {typeof children === "string" ? (
        <Text className={cx("font-ui font-semibold", v.text, s.text)}>{children}</Text>
      ) : (
        children
      )}
      {!loading && renderIcon(trailingIcon, { size: s.icon, color: v.spinner })}
    </Pressable>
  );
}

// --- IconButton -------------------------------------------------------------
const IB_SIZE: Record<string, { box: string; icon: number }> = {
  sm: { box: "h-11 w-11", icon: 16 },
  md: { box: "h-11 w-11", icon: 20 },
  lg: { box: "h-12 w-12", icon: 24 },
};

export function IconButton({
  icon,
  label,
  size = "md",
  variant = "ghost",
  solid,
  disabled,
  onPress,
  className,
}: IconButtonProps) {
  const s = IB_SIZE[size] ?? IB_SIZE.md;
  const effective = solid ? "solid" : variant;
  const styles: Record<string, { box: string; color: string }> = {
    ghost: { box: "bg-transparent active:bg-brand-subtle", color: colors.textSecondary },
    subtle: { box: "bg-surface-sunken active:bg-paper-200", color: colors.textPrimary },
    solid: { box: "bg-brand active:bg-brand-hover", color: colors.textOnAccent },
    danger: { box: "bg-transparent active:bg-red-200", color: colors.error },
  };
  const st = styles[effective] ?? styles.ghost;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={cx(
        "items-center justify-center rounded-full",
        s.box,
        st.box,
        disabled && "opacity-40",
        className
      )}
    >
      {renderIcon(icon, { size: s.icon, color: st.color })}
    </Pressable>
  );
}

// --- Divider ----------------------------------------------------------------
export function Divider({ vertical, className }: DividerProps) {
  return (
    <View className={cx(vertical ? "h-full w-px" : "h-px w-full", "bg-border-subtle", className)} />
  );
}
