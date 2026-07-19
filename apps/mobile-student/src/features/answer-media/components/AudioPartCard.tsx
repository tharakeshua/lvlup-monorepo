/**
 * AudioPartCard — one recorded spoken-answer clip in the parts stack (`.part`
 * with a waveform body, from D3 in `capability-variants.card.html`). Play/pause
 * of the LOCAL clip (expo-av) + duration; failed uploads flip to the
 * `.part--failed` treatment with an inline retry; uploading shows the dashed
 * border + spinner. Remove is always available (answers are never lost).
 */
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Audio } from "expo-av";

import { colors } from "../../../theme";
import { Icon } from "../../../components/Icon";
import { cx } from "../../../components/cx";
import { Waveform } from "./Waveform";
import type { AnswerPart } from "../../../components/ai-question/answer-bundle";

function fmt(sec?: number): string {
  if (!sec || sec <= 0) return "";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return ` · ${m}:${s.toString().padStart(2, "0")}`;
}

export interface AudioPartCardProps {
  part: AnswerPart;
  onRemove?: (id: string) => void;
  onRetry?: (id: string) => void;
  disabled?: boolean;
}

export function AudioPartCard({ part, onRemove, onRetry, disabled }: AudioPartCardProps) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [playing, setPlaying] = useState(false);
  const failed = part.status === "error";
  const uploading = part.status === "uploading";
  const canPlay = !!part.localUri;

  useEffect(() => {
    return () => {
      void soundRef.current?.unloadAsync().catch(() => {});
      soundRef.current = null;
    };
  }, []);

  const togglePlay = async () => {
    if (!part.localUri) return;
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
        setPlaying(false);
        return;
      }
      const { sound } = await Audio.Sound.createAsync({ uri: part.localUri }, { shouldPlay: true });
      soundRef.current = sound;
      setPlaying(true);
      sound.setOnPlaybackStatusUpdate((s) => {
        if (s.isLoaded && s.didJustFinish) {
          void sound.unloadAsync().catch(() => {});
          soundRef.current = null;
          setPlaying(false);
        }
      });
    } catch {
      setPlaying(false);
    }
  };

  return (
    <View
      className={cx(
        "bg-surface flex-row items-center gap-3 rounded-md border px-3 py-2",
        uploading ? "border-border-subtle border-dashed" : "",
        failed ? "border-error" : "border-border-subtle"
      )}
      style={{ minHeight: 56 }}
      accessibilityLabel={`Audio answer${fmt(part.durationSec)}`}
    >
      <Pressable
        onPress={failed ? undefined : togglePlay}
        disabled={!canPlay || failed}
        accessibilityRole="button"
        accessibilityLabel={playing ? "Pause recording" : "Play recording"}
        style={{
          width: 48,
          height: 48,
          borderRadius: 8,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: failed ? colors.surfaceSunken : colors.brandSubtle,
        }}
      >
        <Icon
          name={failed ? "mic" : playing ? "pause" : "play"}
          size={18}
          color={failed ? colors.textMuted : colors.brand}
        />
      </Pressable>

      <View className="flex-1" style={{ minWidth: 0 }}>
        {failed ? (
          <>
            <Text className="font-ui text-text-primary text-sm font-medium">
              {part.name ?? "Recording"}
            </Text>
            <Text className="text-error text-2xs font-mono">upload failed — tap to retry</Text>
          </>
        ) : (
          <>
            <Waveform bars={20} height={22} />
            <Text className="text-text-muted text-2xs font-mono">
              {part.name ?? "Your answer"}
              {fmt(part.durationSec)}
              {uploading ? " · uploading…" : ""}
            </Text>
          </>
        )}
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
          accessibilityLabel="Remove recording"
          hitSlop={8}
          style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center" }}
        >
          <Icon name="x" size={16} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}
