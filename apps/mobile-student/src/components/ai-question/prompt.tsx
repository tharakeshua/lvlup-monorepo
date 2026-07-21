/**
 * ai-question/prompt — the calm prompt block for Surface A (answer-page card,
 * zones 1–2). A slim top bar (back · position · points · Discuss) and a prompt
 * block that collapses to a one-line header once the student starts writing
 * (A2), tap to peek the full prompt back. Reference media renders as tappable
 * tiles / a play control.
 */
import { Image, Linking, Pressable, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { colors } from "../../theme";
import { cx } from "../cx";
import { Icon } from "../Icon";
import { ContentRenderer } from "../containers";
import { DifficultyChip } from "../lyceum";
import { REDUCE_MOTION } from "./tokens";

/** Extract markdown-embedded images (`![alt](url)`) from a prompt string. */
export function splitPromptImages(raw: string): {
  text: string;
  images: Array<{ url: string; alt: string }>;
} {
  const RE = /!\[([^\]]*)\]\(([^)\s]+)\)/g;
  const images: Array<{ url: string; alt: string }> = [];
  for (const m of raw.matchAll(RE)) images.push({ url: m[2], alt: m[1] || "diagram" });
  const text = raw
    .replace(/<!--\s*imgs:auto\s*-->/g, "")
    .replace(RE, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { text, images };
}

/* ── Slim top bar (m-top) ────────────────────────────────────────────────── */
export function AiTopBar({
  position,
  total,
  points,
  onBack,
  onDiscuss,
  compact,
}: {
  position?: number;
  total?: number;
  points?: number | null;
  onBack?: () => void;
  onDiscuss?: () => void;
  /** hide the points chip when the keyboard is up (A6). */
  compact?: boolean;
}) {
  return (
    <View className="flex-row items-center gap-2 px-1 py-1">
      {onBack ? (
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={8}
          className="h-11 w-11 items-center justify-center"
        >
          <Icon name="arrow-left" size={20} color={colors.textPrimary} />
        </Pressable>
      ) : null}
      {position != null && total != null ? (
        <Text className="text-text-muted font-mono text-sm">
          {position} / {total}
        </Text>
      ) : null}
      <View className="flex-1" />
      {!compact && points != null ? (
        <View className="bg-marigold-50 rounded-pill flex-row items-center gap-1 px-2.5 py-1">
          <Text className="text-marigold-600 text-2xs font-mono font-medium">{points} pts</Text>
        </View>
      ) : null}
      {onDiscuss ? (
        <Pressable
          onPress={onDiscuss}
          accessibilityRole="button"
          accessibilityLabel="Discuss this question"
          hitSlop={8}
          className="h-11 w-11 items-center justify-center"
        >
          <Icon name="message-circle" size={20} color={colors.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );
}

/* ── Collapsed one-line prompt (prompt--collapsed) ───────────────────────── */
export function CollapsedPrompt({ text, onExpand }: { text: string; onExpand?: () => void }) {
  return (
    <Pressable
      onPress={onExpand}
      accessibilityRole="button"
      accessibilityLabel="Show the full question"
      className="border-border-subtle flex-row items-center gap-2 border-b pb-3"
    >
      <Text
        className="font-display text-text-secondary flex-1 text-sm"
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {text}
      </Text>
      <Icon name="chevron-down" size={16} color={colors.textMuted} />
    </Pressable>
  );
}

/* ── Full prompt block (prompt) ──────────────────────────────────────────── */
export function QuestionPrompt({
  eyebrow,
  prompt,
  difficulty,
  promptImages = [],
  referenceImages = [],
  promptAudioUrl,
  imgMaxHeight = 320,
}: {
  eyebrow?: string;
  prompt: string;
  difficulty?: string | null;
  promptImages?: Array<{ url: string; alt: string }>;
  referenceImages?: string[];
  promptAudioUrl?: string;
  imgMaxHeight?: number;
}) {
  return (
    <Animated.View entering={FadeIn.duration(220).reduceMotion(REDUCE_MOTION)} className="gap-3">
      {eyebrow ? (
        <Text className="text-brand tracking-caps text-2xs font-mono uppercase">{eyebrow}</Text>
      ) : null}
      {prompt ? (
        <ContentRenderer
          body={prompt}
          math
          textClassName="font-display text-text-primary text-xl leading-8"
        />
      ) : null}

      {/* inline prompt images (markdown-embedded diagrams) */}
      {promptImages.length > 0 ? (
        <View className="gap-2">
          {promptImages.map((img, i) => (
            <Pressable
              key={`${img.url}-${i}`}
              onPress={() => Linking.openURL(img.url).catch(() => {})}
              accessibilityRole="imagebutton"
              accessibilityLabel={img.alt}
            >
              <Image
                source={{ uri: img.url }}
                resizeMode="contain"
                style={{ width: "100%", height: imgMaxHeight, borderRadius: 8 }}
                className="border-border-subtle border"
              />
            </Pressable>
          ))}
        </View>
      ) : null}

      {/* reference media tiles (image_evaluation: compare-against pages) */}
      {referenceImages.length > 0 ? (
        <View className="flex-row flex-wrap gap-2">
          {referenceImages.map((u, i) => (
            <Pressable
              key={`${u}-${i}`}
              onPress={() => Linking.openURL(u).catch(() => {})}
              accessibilityRole="imagebutton"
              accessibilityLabel={`Reference ${i + 1}`}
              className="border-border-subtle bg-surface-sunken h-16 w-20 items-center justify-center overflow-hidden rounded-md border"
            >
              <Image
                source={{ uri: u }}
                resizeMode="cover"
                style={{ width: "100%", height: "100%" }}
              />
            </Pressable>
          ))}
        </View>
      ) : null}

      {/* prompt audio to listen to first (audio type) */}
      {promptAudioUrl ? (
        <Pressable
          onPress={() => Linking.openURL(promptAudioUrl).catch(() => {})}
          accessibilityRole="button"
          accessibilityLabel="Play prompt audio"
          className="border-border-subtle bg-surface rounded-pill flex-row items-center gap-2 self-start border px-3 py-2"
        >
          <Icon name="play" size={16} color={colors.brand} />
          <Text className="text-text-secondary font-mono text-xs">Prompt audio</Text>
        </Pressable>
      ) : null}

      <View className="flex-row items-center gap-2">
        <DifficultyChip difficulty={difficulty} />
      </View>
    </Animated.View>
  );
}
