/**
 * MaterialBlock — renders a `material` UnifiedItem across all 7 materialTypes:
 * text, video, pdf, link, interactive, story, rich.
 *
 * Media that needs a player/embed (video/pdf/interactive) renders a tappable
 * launch card that opens the URL via Linking — keeping the component dependency-
 * free; screens wanting inline playback can special-case those types.
 */
import { type ReactNode } from "react";
import { Linking, Pressable, Text, View } from "react-native";

import { colors } from "../theme";
import { cx } from "./cx";
import { Icon } from "./Icon";
import { ContentRenderer } from "./containers";
import { asArray, asString, getMaterialData } from "./item-data";
import type { MaterialBlockProps } from "./_types";

function LaunchCard({
  icon,
  label,
  hint,
  url,
}: {
  icon: string;
  label: string;
  hint?: string;
  url?: string;
}) {
  return (
    <Pressable
      onPress={url ? () => Linking.openURL(url).catch(() => {}) : undefined}
      className="border-border-subtle bg-surface active:bg-surface-sunken flex-row items-center gap-3 rounded-lg border p-4"
    >
      <View className="bg-brand-subtle h-11 w-11 items-center justify-center rounded-lg">
        <Icon name={icon} size={22} color={colors.brand} />
      </View>
      <View className="flex-1">
        <Text className="font-ui text-text-primary text-base font-semibold">{label}</Text>
        {hint != null && (
          <Text className="font-ui text-text-muted text-xs" numberOfLines={1}>
            {hint}
          </Text>
        )}
      </View>
      {url != null && <Icon name="external-link" size={18} color={colors.textMuted} />}
    </Pressable>
  );
}

export function MaterialBlock({ item, materialData, className }: MaterialBlockProps) {
  const data = getMaterialData(item, materialData);
  if (!data) {
    return (
      <View className={cx("bg-surface-sunken rounded-lg p-4", className)}>
        <Text className="font-ui text-text-muted text-sm">No material content.</Text>
      </View>
    );
  }

  const type = asString(data.materialType, "text");

  let inner: ReactNode;
  switch (type) {
    case "text":
      inner = <ContentRenderer body={asString(data.body)} math />;
      break;

    case "video": {
      const url = asString(data.url);
      const dur =
        typeof data.durationSeconds === "number"
          ? `${Math.round(data.durationSeconds / 60)} min`
          : undefined;
      inner = <LaunchCard icon="play-circle" label="Watch video" hint={dur ?? url} url={url} />;
      break;
    }

    case "pdf":
      inner = (
        <LaunchCard
          icon="file-text"
          label="Open PDF"
          hint={asString(data.url)}
          url={asString(data.url)}
        />
      );
      break;

    case "link":
      inner = (
        <LaunchCard
          icon="link"
          label={asString(data.label) || "Open link"}
          hint={asString(data.url)}
          url={asString(data.url)}
        />
      );
      break;

    case "interactive":
      inner = (
        <LaunchCard
          icon="mouse-pointer-click"
          label="Open interactive"
          hint={asString(data.embedUrl)}
          url={asString(data.embedUrl)}
        />
      );
      break;

    case "story": {
      const slides = asArray<{ title?: string; body?: string }>(data.slides);
      inner = (
        <View className="gap-3">
          {slides.map((s, i) => (
            <View key={i} className="border-border-subtle bg-surface rounded-lg border p-4">
              {s.title ? (
                <Text className="font-display text-text-primary mb-1 text-base font-semibold">
                  {s.title}
                </Text>
              ) : null}
              <ContentRenderer body={asString(s.body)} math />
            </View>
          ))}
        </View>
      );
      break;
    }

    case "rich": {
      const blocks = asArray(data.blocks);
      inner = (
        <View className="gap-3">
          {blocks.map((b, i) => {
            if (typeof b === "string") return <ContentRenderer key={i} body={b} math />;
            const bd = b as Record<string, unknown>;
            const text = asString(bd.text ?? bd.body ?? bd.content);
            return text ? <ContentRenderer key={i} body={text} math /> : null;
          })}
        </View>
      );
      break;
    }

    default:
      inner = <ContentRenderer body={asString(data.body)} math />;
  }

  return <View className={className}>{inner}</View>;
}
