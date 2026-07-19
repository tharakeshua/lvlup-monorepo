/**
 * ai-question/parts-stack — the answer-parts stack (Surface A zone 4, `.parts`).
 * Cards for each attached image / audio clip: thumbnail or waveform, title,
 * duration/size, an upload progress / failed-retry state, and a remove ✕. All
 * parts submit together as one multimodal bundle. Each card FLIES IN with a soft
 * spring (08 §2). W1 owns this render shell; W3 supplies the AnswerPart data +
 * capture UIs.
 */
import { Image, Pressable, Text, View } from "react-native";
import Animated, { FadeInDown, FadeOut } from "react-native-reanimated";

import { colors } from "../../theme";
import { cx } from "../cx";
import { Icon } from "../Icon";
import type { AnswerPart } from "./answer-bundle";
import { DURATION, REDUCE_MOTION, SPRING } from "./tokens";

/** A tiny static waveform motif for audio parts (matches `.wave`). */
function Waveform({ live }: { live?: boolean }) {
  const heights = [40, 85, 60, 25, 55, 90, 45, 30, 70, 50, 80, 35, 65, 42, 88, 28];
  return (
    <View className="flex-row items-center gap-[2px]" style={{ height: 24 }}>
      {heights.map((h, i) => (
        <View
          key={i}
          style={{ height: `${h}%`, width: 3, borderRadius: 999 }}
          className={cx(live ? "bg-spark" : "bg-brand-muted")}
        />
      ))}
    </View>
  );
}

function PartCard({
  part,
  onRemove,
  onRetry,
  onView,
  index,
}: {
  part: AnswerPart;
  onRemove?: (id: string) => void;
  onRetry?: (id: string) => void;
  onView?: (part: AnswerPart) => void;
  index: number;
}) {
  const uploading = part.status === "uploading";
  const failed = part.status === "error";
  const isAudio = part.kind === "audio";

  const meta = failed
    ? "upload failed — tap to retry"
    : uploading
      ? "uploading…"
      : isAudio
        ? part.durationSec != null
          ? `voice note · ${fmtDur(part.durationSec)}`
          : "voice note"
        : part.sizeBytes != null
          ? `photo · ${fmtSize(part.sizeBytes)}`
          : "photo · tap to view";

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 40)
        .duration(DURATION.slow)
        .springify()
        .damping(SPRING.gentle.damping)
        .reduceMotion(REDUCE_MOTION)}
      exiting={FadeOut.duration(DURATION.fast).reduceMotion(REDUCE_MOTION)}
    >
      <Pressable
        onPress={failed ? () => onRetry?.(part.id) : onView ? () => onView(part) : undefined}
        accessibilityRole="button"
        className={cx(
          "bg-surface flex-row items-center gap-3 rounded-md border px-3 py-2",
          uploading
            ? "border-border-subtle border-dashed"
            : failed
              ? "border-error"
              : "border-border-subtle"
        )}
        style={{ minHeight: 56 }}
      >
        {/* thumb */}
        <View
          className={cx(
            "h-12 w-12 items-center justify-center overflow-hidden rounded-md border",
            isAudio
              ? "bg-brand-subtle border-transparent"
              : "border-border-subtle bg-surface-sunken"
          )}
        >
          {!isAudio && part.localUri ? (
            <Image
              source={{ uri: part.localUri }}
              resizeMode="cover"
              style={{ width: "100%", height: "100%" }}
            />
          ) : (
            <Icon
              name={isAudio ? "mic" : "image"}
              size={18}
              color={isAudio ? colors.brand : colors.textMuted}
            />
          )}
        </View>

        {/* body */}
        <View className="min-w-0 flex-1">
          {isAudio && !failed && !uploading ? (
            <Waveform />
          ) : (
            <Text className="text-text-primary text-sm font-medium" numberOfLines={1}>
              {part.name ?? (isAudio ? "Voice note" : "Photo")}
            </Text>
          )}
          <Text
            className={cx("text-2xs font-mono", failed ? "text-error" : "text-text-muted")}
            numberOfLines={1}
          >
            {meta}
          </Text>
          {uploading ? (
            <View className="bg-surface-sunken mt-1.5 h-[3px] overflow-hidden rounded-full">
              <View className="bg-brand h-full rounded-full" style={{ width: "62%" }} />
            </View>
          ) : null}
        </View>

        {/* action */}
        <Pressable
          onPress={failed ? () => onRetry?.(part.id) : () => onRemove?.(part.id)}
          accessibilityRole="button"
          accessibilityLabel={failed ? "Retry upload" : "Remove attachment"}
          hitSlop={8}
          className="h-8 w-8 items-center justify-center"
        >
          <Icon
            name={failed ? "rotate-ccw" : "x"}
            size={16}
            color={failed ? colors.error : colors.textMuted}
          />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

export function PartsStack({
  parts,
  onRemove,
  onRetry,
  onView,
}: {
  parts: AnswerPart[];
  onRemove?: (id: string) => void;
  onRetry?: (id: string) => void;
  onView?: (part: AnswerPart) => void;
}) {
  if (parts.length === 0) return null;
  return (
    <View className="gap-2">
      {parts.map((p, i) => (
        <PartCard
          key={p.id}
          part={p}
          index={i}
          onRemove={onRemove}
          onRetry={onRetry}
          onView={onView}
        />
      ))}
    </View>
  );
}

function fmtDur(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
