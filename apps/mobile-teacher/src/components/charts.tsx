/**
 * Pure RN/SVG analytics primitives for the teacher app — no heavy chart deps.
 * Everything draws with `react-native-svg` (ships in Expo Go).
 *
 *   MiniBarChart   — compact column chart (histograms, trends, difficulty)
 *   Sparkline      — single-series line/area for inline trends (MetricCard etc.)
 *   DistributionBar — stacked proportions OR labelled rows (grade A–F spread)
 *
 * Colors come from the Lyceum tokens; charts default to brand with graceful
 * empty/zero handling so a screen with no data never crashes.
 */
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import Svg, { Circle, Line, Path, Rect } from "react-native-svg";

import { colors } from "../theme";
import { cx } from "./cx";
import type {
  ChartDatum,
  DistributionBarProps,
  DistributionSegment,
  MiniBarChartProps,
  SparklineProps,
} from "./_types";

/** A–F grade ramp + generic categorical ramp for distribution charts. */
export const GRADE_COLORS: Record<string, string> = {
  A: colors.success,
  B: "#3EA876",
  C: colors.warning,
  D: "#C97A14",
  F: colors.error,
};

const RAMP = [colors.brand, "#7A6FC9", colors.spark, colors.success, colors.info, colors.error];

function toData(props: { data?: ChartDatum[]; values?: number[] }): ChartDatum[] {
  if (props.data && props.data.length > 0) return props.data;
  if (props.values && props.values.length > 0) return props.values.map((value) => ({ value }));
  return [];
}

// --- MiniBarChart -----------------------------------------------------------
export function MiniBarChart({
  data,
  values,
  height = 96,
  color = colors.brand,
  showValues = false,
  showLabels = false,
  maxValue,
  onSelect,
  className,
}: MiniBarChartProps) {
  const rows = toData({ data, values });
  if (rows.length === 0) {
    return <View style={{ height }} className={cx("w-full", className)} />;
  }
  const max = Math.max(maxValue ?? 0, ...rows.map((d) => d.value), 1);
  const barH = height - (showValues ? 16 : 0) - (showLabels ? 16 : 0);

  return (
    <View className={cx("w-full", className)}>
      <View className="w-full flex-row items-end justify-between" style={{ gap: 6 }}>
        {rows.map((d, i) => {
          const pct = Math.max(0, d.value) / max;
          const h = Math.max(2, pct * Math.max(barH, 2));
          const fill = d.color ?? (d.active ? colors.brand : color);
          const Wrap = onSelect ? Pressable : View;
          return (
            <Wrap
              key={i}
              onPress={onSelect ? () => onSelect(i) : undefined}
              className="flex-1 items-center"
              style={{ gap: 4 }}
            >
              {showValues && (
                <Text className="text-2xs text-text-primary font-mono">{d.value}</Text>
              )}
              <View
                style={{ height: h, opacity: d.active === false ? 0.55 : 1 }}
                className="w-full rounded-t-sm"
              >
                <View style={{ flex: 1, backgroundColor: fill, borderRadius: 6 }} />
              </View>
              {showLabels && (
                <Text numberOfLines={1} className="text-2xs text-text-muted font-mono">
                  {d.label ?? ""}
                </Text>
              )}
            </Wrap>
          );
        })}
      </View>
    </View>
  );
}

// --- Sparkline --------------------------------------------------------------
export function Sparkline({
  values = [],
  width = 96,
  height = 28,
  color = colors.brand,
  fill = false,
  showEnd = true,
  strokeWidth = 2,
  className,
}: SparklineProps) {
  if (values.length < 2) {
    return <View style={{ width, height }} className={className} />;
  }
  const pad = strokeWidth + 1;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = (width - pad * 2) / (values.length - 1);
  const pts = values.map((v, i) => {
    const x = pad + i * stepX;
    const y = pad + (1 - (v - min) / span) * (height - pad * 2);
    return { x, y };
  });
  const line = pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
  const area = `${line} L${pts[pts.length - 1].x.toFixed(1)},${height - pad} L${pts[0].x.toFixed(1)},${height - pad} Z`;
  const last = pts[pts.length - 1];

  return (
    <Svg width={width} height={height} className={className}>
      {fill && <Path d={area} fill={color} opacity={0.12} />}
      <Path
        d={line}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {showEnd && <Circle cx={last.x} cy={last.y} r={strokeWidth + 0.5} fill={color} />}
    </Svg>
  );
}

// --- DistributionBar --------------------------------------------------------
function segColor(seg: DistributionSegment, i: number): string {
  if (seg.color) return seg.color;
  const label = typeof seg.label === "string" ? seg.label.trim().toUpperCase() : "";
  return GRADE_COLORS[label] ?? RAMP[i % RAMP.length];
}

export function DistributionBar({
  segments = [],
  rows = false,
  height = 12,
  showValues = true,
  className,
}: DistributionBarProps) {
  const total = segments.reduce((s, d) => s + Math.max(0, d.value), 0) || 1;

  if (rows) {
    const max = Math.max(...segments.map((d) => d.value), 1);
    return (
      <View className={cx("w-full", className)} style={{ gap: 8 }}>
        {segments.map((seg, i) => {
          const pct = Math.max(0, seg.value) / max;
          return (
            <View key={i} className="flex-row items-center" style={{ gap: 10 }}>
              <Text className="text-text-secondary w-6 font-mono text-xs font-semibold">
                {seg.label}
              </Text>
              <View
                className="rounded-pill bg-surface-sunken flex-1 overflow-hidden"
                style={{ height: height + 8 }}
              >
                <View
                  style={{
                    width: `${pct * 100}%`,
                    backgroundColor: segColor(seg, i),
                    height: "100%",
                    borderRadius: 999,
                  }}
                />
              </View>
              {showValues && (
                <Text className="text-text-muted w-8 text-right font-mono text-xs">
                  {seg.value}
                </Text>
              )}
            </View>
          );
        })}
      </View>
    );
  }

  // stacked single bar
  return (
    <View className={cx("w-full", className)} style={{ gap: 8 }}>
      <View
        className="rounded-pill bg-surface-sunken w-full flex-row overflow-hidden"
        style={{ height }}
      >
        {segments.map((seg, i) => {
          const w = (Math.max(0, seg.value) / total) * 100;
          if (w <= 0) return null;
          return <View key={i} style={{ width: `${w}%`, backgroundColor: segColor(seg, i) }} />;
        })}
      </View>
      {showValues && (
        <View className="flex-row flex-wrap" style={{ gap: 12 }}>
          {segments.map((seg, i) => (
            <View key={i} className="flex-row items-center" style={{ gap: 5 }}>
              <View
                style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: segColor(seg, i) }}
              />
              <Text className="font-ui text-2xs text-text-muted">
                {seg.label} {seg.value}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
