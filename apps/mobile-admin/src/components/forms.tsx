/**
 * Form inputs: TextField (labelled, hint/error, optional icons, multiline) and
 * SearchField (rounded search with clear affordance).
 */
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { colors } from "../theme";
import { cx } from "./cx";
import { Icon, renderIcon } from "./Icon";
import type { SearchFieldProps, TextFieldProps } from "./_types";

// --- TextField --------------------------------------------------------------
export function TextField({
  label,
  hint,
  error,
  required,
  leadingIcon,
  trailingIcon,
  className,
  multiline,
  ...input
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View className={cx("gap-1.5", className)}>
      {label != null && (
        <Text className="font-ui text-text-secondary text-sm font-semibold">
          {label}
          {required && <Text className="text-error"> *</Text>}
        </Text>
      )}
      <View
        className={cx(
          "bg-surface flex-row items-center gap-2 rounded-md border px-3",
          multiline ? "py-2" : "py-0.5",
          error ? "border-error" : focused ? "border-brand" : "border-border-strong"
        )}
      >
        {renderIcon(leadingIcon, { size: 18, color: colors.textMuted })}
        <TextInput
          {...input}
          multiline={multiline}
          placeholderTextColor={colors.textMuted}
          onFocus={(e) => {
            setFocused(true);
            input.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            input.onBlur?.(e);
          }}
          style={multiline ? { minHeight: 88, textAlignVertical: "top" } : undefined}
          className="font-ui text-text-primary flex-1 py-2.5 text-base"
        />
        {renderIcon(trailingIcon, { size: 18, color: colors.textMuted })}
      </View>
      {error != null ? (
        <Text className="font-ui text-error text-xs">{error}</Text>
      ) : hint != null ? (
        <Text className="font-ui text-text-muted text-xs">{hint}</Text>
      ) : null}
    </View>
  );
}

// --- SearchField ------------------------------------------------------------
export function SearchField({
  value,
  onChangeText,
  placeholder = "Search…",
  onClear,
  autoFocus,
  className,
}: SearchFieldProps) {
  return (
    <View
      className={cx(
        "rounded-pill border-border-subtle bg-surface-sunken flex-row items-center gap-2 border px-3.5 py-2.5",
        className
      )}
    >
      <Icon name="search" size={18} color={colors.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        autoFocus={autoFocus}
        returnKeyType="search"
        className="font-ui text-text-primary flex-1 p-0 text-base"
      />
      {value ? (
        <Pressable onPress={onClear ?? (() => onChangeText?.(""))} hitSlop={8}>
          <Icon name="x" size={16} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}
