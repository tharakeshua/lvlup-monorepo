/**
 * ai-question/composer — the writing area at the heart of the unified composer
 * (Surface A zone 3; capability-variants C). Two bodies: the quiet prose "write"
 * area (the dominant notebook page) and the dark-ink monospace "code" surface.
 * Word count + an optional gentle word target (paragraph) live here.
 */
import { Pressable, Text, TextInput, View } from "react-native";

import { colors } from "../../theme";
import { cx } from "../cx";
import { Icon } from "../Icon";
import { wordCount } from "./answer-bundle";

const writeBase = "font-ui text-base text-text-primary";

export interface WordTarget {
  min?: number;
  max?: number;
}

function WordCount({ count, target }: { count: number; target?: WordTarget }) {
  const near = target?.max != null && count >= Math.round(target.max * 0.9);
  const label =
    target && (target.min != null || target.max != null)
      ? `${count} / ${target.min ?? ""}${target.min != null && target.max != null ? "–" : ""}${target.max ?? ""} words`
      : `${count} words`;
  return (
    <Text className={cx("text-2xs font-mono", near ? "text-warning" : "text-text-muted")}>
      {label}
    </Text>
  );
}

/* ── prose write area ────────────────────────────────────────────────────── */
export function WriteArea({
  value,
  onChangeText,
  disabled,
  placeholder = "Write your answer… take your time.",
  target,
  minHeight = 180,
  autoFocus,
  onFocus,
  showWordCount = true,
  bare,
}: {
  value: string;
  onChangeText: (t: string) => void;
  disabled?: boolean;
  placeholder?: string;
  target?: WordTarget;
  minHeight?: number;
  autoFocus?: boolean;
  onFocus?: () => void;
  showWordCount?: boolean;
  /** full-bleed focus-mode variant (bigger type + line height, no frame). */
  bare?: boolean;
}) {
  const count = wordCount(value);
  return (
    <View className="gap-2" style={{ flex: bare ? 1 : undefined }}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        editable={!disabled}
        onFocus={onFocus}
        autoFocus={autoFocus}
        multiline
        scrollEnabled={bare}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        textAlignVertical="top"
        style={{
          minHeight,
          flex: bare ? 1 : undefined,
          fontSize: bare ? 18 : 16,
          lineHeight: bare ? 30 : 26,
        }}
        className={writeBase}
      />
      {showWordCount ? (
        <View className="flex-row justify-end">
          <WordCount count={count} target={target} />
        </View>
      ) : null}
    </View>
  );
}

/* ── monospace dark-ink code editor ──────────────────────────────────────── */
export function CodeArea({
  value,
  onChangeText,
  disabled,
  language,
  onExpand,
  minHeight = 200,
  autoFocus,
}: {
  value: string;
  onChangeText: (t: string) => void;
  disabled?: boolean;
  language?: string;
  onExpand?: () => void;
  minHeight?: number;
  autoFocus?: boolean;
}) {
  return (
    <View className="bg-ink-900 gap-2 overflow-hidden rounded-lg p-4">
      <View className="flex-row items-center gap-2">
        {language ? (
          <View className="bg-ink-800 rounded-pill px-2.5 py-0.5">
            <Text className="text-ink-400 text-2xs tracking-caps font-mono uppercase">
              {language}
            </Text>
          </View>
        ) : null}
        <View className="flex-1" />
        {onExpand ? (
          <Pressable
            onPress={onExpand}
            accessibilityRole="button"
            accessibilityLabel="Expand code editor"
            hitSlop={8}
          >
            <Icon name="maximize-2" size={15} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        editable={!disabled}
        autoFocus={autoFocus}
        multiline
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        placeholder="// your code"
        placeholderTextColor={colors.textMuted}
        textAlignVertical="top"
        style={{ minHeight, lineHeight: 22 }}
        className="text-paper-100 font-mono text-sm"
      />
    </View>
  );
}
