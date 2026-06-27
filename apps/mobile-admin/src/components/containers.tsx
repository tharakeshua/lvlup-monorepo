/**
 * Containers: Tabs (segmented), Accordion (collapsible), Alert (inline banner),
 * ContentRenderer (lightweight markdown + code + LaTeX-ish text).
 */
import { Fragment, useState } from "react";
import { LayoutAnimation, Platform, Pressable, Text, UIManager, View } from "react-native";

import { colors } from "../theme";
import { cx } from "./cx";
import { Icon, renderIcon } from "./Icon";
import type { AccordionProps, AlertProps, ContentRendererProps, TabsProps } from "./_types";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// --- Tabs (segmented) -------------------------------------------------------
export function Tabs({ items = [], defaultIndex = 0, onChange, className }: TabsProps) {
  const [active, setActive] = useState(defaultIndex);
  const current = items[active];
  return (
    <View className={cx("gap-3", className)}>
      <View className="rounded-pill bg-surface-sunken flex-row gap-1 p-1">
        {items.map((it, i) => {
          const on = i === active;
          return (
            <Pressable
              key={it.key ?? i}
              onPress={() => {
                setActive(i);
                onChange?.(i);
              }}
              className={cx(
                "rounded-pill flex-1 items-center px-3 py-2",
                on && "bg-surface shadow-sm"
              )}
            >
              <Text
                className={cx(
                  "font-ui text-sm",
                  on ? "text-text-primary font-semibold" : "text-text-muted"
                )}
              >
                {it.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {current?.content != null && <View>{current.content}</View>}
    </View>
  );
}

// --- Accordion --------------------------------------------------------------
export function Accordion({ items = [], defaultOpen = null, multiple, className }: AccordionProps) {
  const [open, setOpen] = useState<number[]>(defaultOpen == null ? [] : [defaultOpen]);
  const toggle = (i: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((prev) => {
      const isOpen = prev.includes(i);
      if (multiple) return isOpen ? prev.filter((x) => x !== i) : [...prev, i];
      return isOpen ? [] : [i];
    });
  };
  return (
    <View className={cx("border-border-subtle overflow-hidden rounded-lg border", className)}>
      {items.map((it, i) => {
        const isOpen = open.includes(i);
        return (
          <View key={it.key ?? i} className={cx(i > 0 && "border-border-subtle border-t")}>
            <Pressable
              onPress={() => toggle(i)}
              className="bg-surface flex-row items-center justify-between px-4 py-3"
            >
              <Text className="font-ui text-text-primary flex-1 text-base font-semibold">
                {it.title}
              </Text>
              <Icon
                name={isOpen ? "chevron-up" : "chevron-down"}
                size={18}
                color={colors.textMuted}
              />
            </Pressable>
            {isOpen && it.content != null && (
              <View className="bg-surface px-4 pb-4">{it.content}</View>
            )}
          </View>
        );
      })}
    </View>
  );
}

// --- Alert ------------------------------------------------------------------
const ALERT_VARIANT: Record<
  string,
  { box: string; icon: string; tint: string; defaultIcon: string }
> = {
  info: {
    box: "bg-sky-500/10 border-sky-500/30",
    icon: "text-info",
    tint: colors.info,
    defaultIcon: "info",
  },
  success: {
    box: "bg-green-200/50 border-green-500/40",
    icon: "text-success",
    tint: colors.success,
    defaultIcon: "check-circle",
  },
  warning: {
    box: "bg-marigold-50 border-marigold-200",
    icon: "text-warning",
    tint: colors.warning,
    defaultIcon: "alert-triangle",
  },
  error: {
    box: "bg-red-200/50 border-red-200",
    icon: "text-error",
    tint: colors.error,
    defaultIcon: "alert-circle",
  },
  brand: {
    box: "bg-brand-subtle border-indigo-200",
    icon: "text-brand",
    tint: colors.brand,
    defaultIcon: "sparkles",
  },
};

export function Alert({ variant = "info", title, icon, children, className }: AlertProps) {
  const v = ALERT_VARIANT[variant] ?? ALERT_VARIANT.info;
  return (
    <View className={cx("flex-row gap-3 rounded-md border p-3.5", v.box, className)}>
      <View className="pt-0.5">
        {renderIcon(icon ?? v.defaultIcon, { size: 18, color: v.tint })}
      </View>
      <View className="flex-1 gap-0.5">
        {title != null && (
          <Text className="font-ui text-text-primary text-sm font-semibold">{title}</Text>
        )}
        {typeof children === "string" ? (
          <Text className="font-ui text-text-secondary text-sm">{children}</Text>
        ) : (
          children
        )}
      </View>
    </View>
  );
}

// --- ContentRenderer --------------------------------------------------------
/**
 * Lightweight block renderer for learning material: paragraphs, ATX headings
 * (`#`–`###`), fenced/inline code, list items, bold/italic, and (when `math`)
 * a graceful mono styling of `$…$` / `$$…$$` spans. Full KaTeX needs a WebView;
 * screens needing true LaTeX can wrap this. Pass `body`/`html` string or children.
 */
export function ContentRenderer({ children, body, html, math, className }: ContentRendererProps) {
  const raw = body ?? html ?? (typeof children === "string" ? children : "");
  if (!raw)
    return <View className={className}>{typeof children === "string" ? null : children}</View>;

  const blocks = raw.replace(/\r\n/g, "\n").split(/\n{2,}/);
  return (
    <View className={cx("gap-3", className)}>
      {blocks.map((block, i) => {
        const trimmed = block.trim();
        // fenced code
        if (trimmed.startsWith("```")) {
          const code = trimmed.replace(/^```[^\n]*\n?/, "").replace(/```$/, "");
          return (
            <View key={i} className="bg-ink-900 rounded-md p-3">
              <Text className="text-paper-100 font-mono text-sm">{code}</Text>
            </View>
          );
        }
        // headings
        const h = /^(#{1,3})\s+(.*)$/.exec(trimmed);
        if (h) {
          const size = h[1].length === 1 ? "text-2xl" : h[1].length === 2 ? "text-xl" : "text-lg";
          return (
            <Text key={i} className={cx("font-display text-text-primary font-bold", size)}>
              {h[2]}
            </Text>
          );
        }
        // list block
        if (
          /^\s*[-*]\s+/m.test(trimmed) &&
          trimmed.split("\n").every((l) => /^\s*[-*]\s+/.test(l))
        ) {
          return (
            <View key={i} className="gap-1">
              {trimmed.split("\n").map((l, j) => (
                <View key={j} className="flex-row gap-2">
                  <Text className="font-ui text-text-muted text-base">•</Text>
                  <Text className="font-ui text-text-secondary flex-1 text-base leading-6">
                    {renderInline(l.replace(/^\s*[-*]\s+/, ""), math)}
                  </Text>
                </View>
              ))}
            </View>
          );
        }
        return (
          <Text key={i} className="font-ui text-text-secondary text-base leading-6">
            {renderInline(trimmed, math)}
          </Text>
        );
      })}
    </View>
  );
}

/** Inline spans: **bold**, *italic*, `code`, and $math$ (mono fallback). */
function renderInline(text: string, math?: boolean) {
  const pattern = math
    ? /(\$\$[^$]+\$\$|\$[^$]+\$|\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g
    : /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
  const parts = text.split(pattern).filter((s) => s !== "");
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <Text key={i} className="text-text-primary font-semibold">
          {part.slice(2, -2)}
        </Text>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <Text key={i} className="text-brand font-mono text-sm">
          {part.slice(1, -1)}
        </Text>
      );
    }
    if (math && (part.startsWith("$$") || part.startsWith("$"))) {
      const inner = part.replace(/^\$\$?|\$\$?$/g, "");
      return (
        <Text key={i} className="text-text-primary font-mono italic">
          {inner}
        </Text>
      );
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return (
        <Text key={i} className="italic">
          {part.slice(1, -1)}
        </Text>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}
