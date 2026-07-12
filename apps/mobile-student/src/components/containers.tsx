/**
 * Containers: Tabs (segmented), Accordion (collapsible), Alert (inline banner),
 * ContentRenderer (lightweight markdown + code + LaTeX-ish text).
 */
import { Fragment, type ReactNode, useState } from "react";
import {
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  Text,
  UIManager,
  View,
} from "react-native";

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
export function ContentRenderer({
  children,
  body,
  html,
  math,
  className,
  textClassName,
}: ContentRendererProps) {
  const paragraphClass = textClassName ?? "font-ui text-text-secondary text-base leading-6";
  const raw = body ?? html ?? (typeof children === "string" ? children : "");
  if (!raw)
    return <View className={className}>{typeof children === "string" ? null : children}</View>;

  // Real content is markdown, but `<pre>/<code>` HTML may sneak in — normalize it
  // to fences/backticks first so a single code path handles both.
  const normalized = htmlCodeToMarkdown(raw.replace(/\r\n/g, "\n"));
  // Extract fenced code from the RAW text BEFORE the blank-line split, so blank
  // lines inside code don't tear a fence apart. Only non-code spans get split.
  const segments = splitFencedCode(normalized);

  const nodes: ReactNode[] = [];
  segments.forEach((seg, si) => {
    if (seg.code) {
      nodes.push(
        <View key={`code-${si}`} className="bg-ink-900 rounded-md p-3">
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Text className="text-paper-100 font-mono text-sm">{seg.text}</Text>
          </ScrollView>
        </View>
      );
      return;
    }
    seg.text.split(/\n{2,}/).forEach((block, bi) => {
      const trimmed = block.trim();
      if (!trimmed) return;
      const key = `${si}-${bi}`;
      // headings
      const h = /^(#{1,3})\s+(.*)$/.exec(trimmed);
      if (h) {
        const size = h[1].length === 1 ? "text-2xl" : h[1].length === 2 ? "text-xl" : "text-lg";
        nodes.push(
          <Text key={key} className={cx("font-display text-text-primary font-bold", size)}>
            {h[2]}
          </Text>
        );
        return;
      }
      // list block
      if (/^\s*[-*]\s+/m.test(trimmed) && trimmed.split("\n").every((l) => /^\s*[-*]\s+/.test(l))) {
        nodes.push(
          <View key={key} className="gap-1">
            {trimmed.split("\n").map((l, j) => (
              <View key={j} className="flex-row gap-2">
                <Text className="font-ui text-text-muted text-base">•</Text>
                <Text className={cx("flex-1", paragraphClass)}>
                  {renderInline(l.replace(/^\s*[-*]\s+/, ""), math)}
                </Text>
              </View>
            ))}
          </View>
        );
        return;
      }
      nodes.push(
        <Text key={key} className={paragraphClass}>
          {renderInline(trimmed, math)}
        </Text>
      );
    });
  });

  return <View className={cx("gap-3", className)}>{nodes}</View>;
}

/**
 * Split text into alternating non-code / fenced-code segments, scanning the whole
 * body line-by-line so blank lines and any language tag on the opening fence are
 * tolerated. An unterminated fence flushes its collected lines as a code block.
 */
function splitFencedCode(src: string): Array<{ code: boolean; text: string }> {
  const segments: Array<{ code: boolean; text: string }> = [];
  let inCode = false;
  let buf: string[] = [];
  const flush = (code: boolean) => {
    if (buf.length === 0) return;
    segments.push({ code, text: buf.join("\n") });
    buf = [];
  };
  for (const line of src.split("\n")) {
    if (/^\s*```/.test(line)) {
      flush(inCode); // close current text or code span at the fence
      inCode = !inCode;
      continue;
    }
    buf.push(line);
  }
  flush(inCode); // trailing text, or an unterminated fence treated as code
  return segments;
}

/** Minimal `<pre>/<code>` → markdown fence/backtick conversion (no-op for pure markdown). */
function htmlCodeToMarkdown(src: string): string {
  if (!/<\/?(pre|code)\b/i.test(src)) return src;
  const decode = (s: string) =>
    s
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#0?39;/g, "'")
      .replace(/&amp;/g, "&");
  return src
    .replace(
      /<pre[^>]*>\s*<code[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi,
      (_, c) => `\n\`\`\`\n${decode(c)}\n\`\`\`\n`
    )
    .replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_, c) => `\n\`\`\`\n${decode(c)}\n\`\`\`\n`)
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (_, c) => `\`${decode(c)}\``);
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
