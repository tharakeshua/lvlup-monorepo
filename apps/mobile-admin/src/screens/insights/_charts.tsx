/**
 * Lane-local lightweight charts for the Insights screens. Pure NativeWind +
 * View (no chart lib) — a column bar chart and a horizontal-bar breakdown, both
 * matching the prototype-card look (Lyceum tokens via theme colors).
 *
 * Owned by M-admin-home-insights (src/screens/insights/).
 */
import { Text, View } from "react-native";
import { colors } from "../../components";

export interface BarDatum {
  label: string;
  value: number;
  /** Optional secondary value label (e.g. "$4.18"); defaults to the value. */
  display?: string;
}

/** Vertical column chart. Heights are normalized to the max value. */
export function ColumnChart({ data, height = 160 }: { data: BarDatum[]; height?: number }) {
  const max = Math.max(1, ...data.map((d) => (Number.isFinite(d.value) ? d.value : 0)));
  return (
    <View
      className="border-border-subtle flex-row items-end gap-2 border-b pb-0 pt-3"
      style={{ height }}
      accessibilityRole="image"
    >
      {data.map((d, i) => {
        const pct = Math.max(2, Math.round(((d.value || 0) / max) * 100));
        return (
          <View
            key={`${d.label}-${i}`}
            className="flex-1 items-center justify-end gap-1"
            style={{ height: "100%" }}
          >
            <Text className="text-2xs text-text-secondary font-mono">
              {d.display ?? String(d.value)}
            </Text>
            <View
              className="w-full rounded-t-sm"
              style={{ height: `${pct}%`, maxWidth: 46, backgroundColor: colors.brand }}
            />
            <Text className="text-2xs text-text-muted" numberOfLines={1}>
              {d.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export interface HBarDatum {
  label: string;
  value: number;
  display?: string;
  color?: string;
}

/** Horizontal-bar breakdown (e.g. cost by purpose / model). */
export function HBarList({ data }: { data: HBarDatum[] }) {
  const max = Math.max(1, ...data.map((d) => (Number.isFinite(d.value) ? d.value : 0)));
  return (
    <View className="gap-3">
      {data.map((d, i) => {
        const pct = Math.max(2, Math.round(((d.value || 0) / max) * 100));
        return (
          <View key={`${d.label}-${i}`} className="gap-1">
            <View className="flex-row items-center justify-between">
              <Text className="text-text-secondary text-sm" numberOfLines={1}>
                {d.label}
              </Text>
              <Text className="text-text-primary font-mono text-sm">
                {d.display ?? String(d.value)}
              </Text>
            </View>
            <View className="rounded-pill bg-surface-sunken h-2 overflow-hidden">
              <View
                className="rounded-pill h-full"
                style={{ width: `${pct}%`, backgroundColor: d.color ?? colors.brand }}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}
