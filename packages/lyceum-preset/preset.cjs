/**
 * @levelup/lyceum-preset — Tailwind (v3) preset for the Lyceum design system.
 *
 * Stack it AFTER the base shared preset so Lyceum wins where they overlap:
 *
 *   // tailwind.config.ts
 *   import sharedConfig from "@levelup/tailwind-config";
 *   import lyceumPreset from "@levelup/lyceum-preset";
 *   export default { presets: [sharedConfig, lyceumPreset], ... };
 *
 * And import the CSS side once in the app's index.css (see README).
 *
 * Semantic colors reference the --ly-* HSL twins from tokens.css so they
 * theme-flip under .dark AND support Tailwind alpha modifiers (bg-brand/20).
 * Primitive scales (paper/ink/marigold/indigo) are static hex — primitives
 * never flip with theme. NOTE: the 6 Lyceum indigo stops (50/200/400/500/
 * 600/700) intentionally override Tailwind's built-in indigo at those stops.
 */
const { primitives } = require("./tokens.cjs");

const T = (name) => `hsl(var(--ly-${name}) / <alpha-value>)`;
const pick = (prefix, stops) =>
  Object.fromEntries(stops.map((s) => [s, primitives[`${prefix}-${s}`]]));

/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        /* ── Semantic backgrounds ── */
        canvas: T("bg-canvas"),
        surface: {
          DEFAULT: T("bg-surface"),
          sunken: T("bg-surface-sunken"),
          inset: T("bg-inset"),
        },
        /* ── Semantic text (use as text-fg / text-fg-secondary / …) ── */
        fg: {
          DEFAULT: T("text-primary"),
          secondary: T("text-secondary"),
          muted: T("text-muted"),
          "on-accent": T("text-on-accent"),
        },
        /* ── Semantic borders (use as border-subtle / border-strong) ── */
        subtle: T("border-subtle"),
        strong: T("border-strong"),
        /* ── Brand & spark ── */
        brand: {
          DEFAULT: T("brand-primary"),
          hover: T("brand-primary-hover"),
          subtle: T("brand-subtle"),
          muted: T("brand-muted"),
        },
        spark: {
          DEFAULT: T("spark"),
          hover: T("spark-hover"),
          subtle: T("spark-subtle"),
        },
        /* ── Status (DEFAULTs shadow the shared preset's shadcn vars with
              alpha-capable twins; `foreground` keys from the base preset
              survive the deep merge) ── */
        success: { DEFAULT: T("status-success"), subtle: T("status-success-subtle") },
        warning: { DEFAULT: T("status-warning"), subtle: T("status-warning-subtle") },
        error: { DEFAULT: T("status-error"), subtle: T("status-error-subtle") },
        info: { DEFAULT: T("status-info"), subtle: T("status-info-subtle") },
        /* ── Domain scales (§2.3) ── */
        confidence: {
          low: T("confidence-low"),
          med: T("confidence-med"),
          high: T("confidence-high"),
        },
        grade: {
          a: T("grade-a"),
          b: T("grade-b"),
          c: T("grade-c"),
          d: T("grade-d"),
          f: T("grade-f"),
        },
        mastery: {
          "not-started": T("mastery-not-started"),
          "in-progress": T("mastery-in-progress"),
          mastered: T("mastery-mastered"),
        },
        xp: T("xp"),
        streak: T("streak"),
        /* ── Primitives (static; escape hatch — prefer semantic) ── */
        paper: pick("paper", [50, 100, 200, 300, 400, 500]),
        ink: pick("ink", [400, 500, 600, 700, 800, 900]),
        marigold: pick("marigold", [50, 200, 400, 500, 600]),
        indigo: pick("indigo", [50, 200, 400, 500, 600, 700]),
      },

      /* ── Typography (§3) ── */
      fontFamily: {
        sans: [
          "Schibsted Grotesk",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "sans-serif",
        ],
        display: [
          "Fraunces",
          "Iowan Old Style",
          "Georgia",
          "Times New Roman",
          "serif",
        ],
        mono: [
          "Spline Sans Mono",
          "ui-monospace",
          "SF Mono",
          "Cascadia Code",
          "monospace",
        ],
      },
      /* 1.25 major-third scale, base 16 — overrides Tailwind's default
         text-* stops so the whole app snaps to the Lyceum scale. */
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.01em" }],
        xs: ["0.75rem", { lineHeight: "1.125rem", letterSpacing: "0.01em" }],
        sm: ["0.8125rem", { lineHeight: "1.25rem", letterSpacing: "0.01em" }],
        base: ["1rem", { lineHeight: "1.5rem" }],
        lg: ["1.25rem", { lineHeight: "1.75rem" }],
        xl: ["1.5625rem", { lineHeight: "2rem" }],
        "2xl": ["1.9375rem", { lineHeight: "2.375rem", letterSpacing: "-0.02em" }],
        "3xl": ["2.4375rem", { lineHeight: "2.875rem", letterSpacing: "-0.02em" }],
        "4xl": ["3.0625rem", { lineHeight: "3.375rem", letterSpacing: "-0.02em" }],
        "5xl": ["3.8125rem", { lineHeight: "4rem", letterSpacing: "-0.02em" }],
      },
      letterSpacing: {
        caps: "0.14em", // uppercase kicker/eyebrow idiom
      },

      /* ── Radius (§4): sm 6 · md 10 · lg 14 · xl 20 · pill 999.
            Overrides the base preset's var(--radius) mapping with exact
            Lyceum stops (cards lg=14, inputs/buttons md=10). ── */
      borderRadius: {
        sm: "6px",
        md: "10px",
        lg: "14px",
        xl: "20px",
        pill: "999px",
      },

      /* ── Elevation (§4) — warm-tinted, never pure black ── */
      boxShadow: {
        e1: "0 1px 2px rgba(28, 26, 22, 0.06)",
        e2: "0 4px 12px rgba(28, 26, 22, 0.08)",
        e3: "0 12px 28px rgba(28, 26, 22, 0.12)",
        "glow-spark": "0 6px 20px rgba(232, 151, 43, 0.30)",
      },

      /* ── Motion (§4) — felt, not seen ── */
      transitionDuration: {
        instant: "100ms",
        fast: "160ms",
        base: "220ms",
        slow: "320ms",
        page: "420ms",
      },
      transitionTimingFunction: {
        standard: "cubic-bezier(0.2, 0, 0, 1)",
        entrance: "cubic-bezier(0.05, 0.7, 0.1, 1)",
        exit: "cubic-bezier(0.3, 0, 0.8, 0.15)",
      },
      keyframes: {
        "ly-rise": {
          from: { opacity: "0", transform: "translateY(14px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "ly-pop": {
          "0%": { transform: "scale(0.6)", opacity: "0" },
          "60%": { transform: "scale(1.06)", opacity: "1" },
          "100%": { transform: "scale(1)" },
        },
      },
      animation: {
        "ly-rise": "ly-rise 640ms cubic-bezier(0.05, 0.7, 0.1, 1) both",
        "ly-pop": "ly-pop 420ms cubic-bezier(0.05, 0.7, 0.1, 1) both",
      },

      /* ── Layout (§4) ── */
      maxWidth: {
        content: "1200px",
        reading: "720px",
      },
    },
  },
};
