/**
 * ImagePartCard — one photographed page of work in the parts stack (`.part` with
 * a 60px thumb, from surface E in `capability-variants.card.html`). Tapping the
 * thumb opens a large view (via `onView`); uploading shows the dashed border +
 * spinner; a failed upload flips to `.part--failed` with inline retry. Multiple
 * pages are supported — each is its own card. Remove is always available.
 */
import { ActivityIndicator, Image, Pressable, Text, View } from "react-native";

import { colors } from "../../../theme";
import { Icon } from "../../../components/Icon";
import { cx } from "../../../components/cx";
import type { AnswerPart } from "../../../components/ai-question/answer-bundle";

export interface ImagePartCardProps {
  part: AnswerPart;
  index?: number;
  onRemove?: (id: string) => void;
  onRetry?: (id: string) => void;
  onView?: (part: AnswerPart) => void;
  disabled?: boolean;
}

export function ImagePartCard({
  part,
  index,
  onRemove,
  onRetry,
  onView,
  disabled,
}: ImagePartCardProps) {
  const failed = part.status === "error";
  const uploading = part.status === "uploading";
  const title = part.name ?? `Page ${(index ?? 0) + 1}`;

  return (
    <View
      className={cx(
        "bg-surface flex-row items-center gap-3 rounded-md border px-3 py-2",
        uploading ? "border-border-subtle border-dashed" : "",
        failed ? "border-error" : "border-border-subtle"
      )}
      style={{ minHeight: 72 }}
      accessibilityLabel={`Your submitted image: ${title}`}
    >
      <Pressable
        onPress={failed || !part.localUri ? undefined : () => onView?.(part)}
        disabled={failed || !onView}
        accessibilityRole="imagebutton"
        accessibilityLabel={`View ${title}`}
        style={{
          width: 60,
          height: 60,
          borderRadius: 6,
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
          borderColor: colors.borderSubtle,
          backgroundColor: colors.surfaceSunken,
        }}
      >
        {part.localUri ? (
          <Image
            source={{ uri: part.localUri }}
            resizeMode="cover"
            style={{ width: "100%", height: "100%", opacity: uploading ? 0.55 : 1 }}
          />
        ) : (
          <Icon name="image" size={18} color={colors.textMuted} />
        )}
      </Pressable>

      <View className="flex-1" style={{ minWidth: 0 }}>
        <Text className="font-ui text-text-primary text-sm font-medium" numberOfLines={1}>
          {title}
        </Text>
        <Text className={cx("text-2xs font-mono", failed ? "text-error" : "text-text-muted")}>
          {failed
            ? "upload failed — tap to retry"
            : uploading
              ? "uploading…"
              : "photo · tap to view"}
        </Text>
      </View>

      {uploading ? <ActivityIndicator size="small" color={colors.brand} /> : null}

      {failed && onRetry ? (
        <Pressable
          onPress={() => onRetry(part.id)}
          accessibilityRole="button"
          accessibilityLabel="Retry upload"
          hitSlop={8}
          style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center" }}
        >
          <Icon name="rotate-ccw" size={16} color={colors.error} />
        </Pressable>
      ) : null}

      {!disabled && onRemove ? (
        <Pressable
          onPress={() => onRemove(part.id)}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${title}`}
          hitSlop={8}
          style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center" }}
        >
          <Icon name="x" size={16} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}
