/**
 * Lyceum design tokens — single source of truth (JS).
 *
 * Derived 1:1 from the frozen Lyceum core:
 *   old-deprecated/docs/rebuild-spec/design/build/tokens/lyceum.css
 *   old-deprecated/docs/rebuild-spec/design/00-FOUNDATION.md §2–§4
 *
 * tokens.css and bridge.css are GENERATED from this file by
 * scripts/generate-css.cjs — edit here, then `node scripts/generate-css.cjs`.
 * preset.cjs also reads primitives from here for static utility colors.
 */

/* ── Primitives (§2.1) — raw hex scales ─────────────────────────────── */
const primitives = {
  "paper-50": "#FBF8F3",
  "paper-100": "#F4EEE4",
  "paper-200": "#E8DFD0",
  "paper-300": "#D6C9B4",
  "paper-400": "#B3A487",
  "paper-500": "#8A7B5E",

  "ink-400": "#9A9486",
  "ink-500": "#756E61",
  "ink-600": "#565046",
  "ink-700": "#3D382F",
  "ink-800": "#2A2620",
  "ink-900": "#1C1A16",

  "indigo-50": "#EEEBF8",
  "indigo-200": "#CFC9EC",
  "indigo-400": "#7A6FC9",
  "indigo-500": "#564BA6",
  "indigo-600": "#423A82",
  "indigo-700": "#322C63",

  "marigold-50": "#FDF4E3",
  "marigold-200": "#FBE0B0",
  "marigold-400": "#F4B45A",
  "marigold-500": "#E8972B",
  "marigold-600": "#C97A14",

  "green-200": "#BFE6D2",
  "green-500": "#3EA876",
  "green-600": "#2F7D5B",

  "amber-500": "#E0A12E",
  "amber-600": "#B7791F",

  "red-200": "#F3CFCD",
  "red-500": "#D85650",
  "red-600": "#B23A36",

  "sky-500": "#3F92B8",
  "sky-600": "#2D6E8E",

  "warm-white": "#FFFDFA",
  // one-off values from lyceum.css (dark bg-inset, light info-subtle)
  "ink-inset": "#232019",
  "sky-subtle": "#DCEAF1",
};

/* ── Semantic (§2.2/§2.3) — role → primitive, light and dark ────────── */
/* Keys use the EXACT Lyceum custom-property names (minus the leading --) */
const semantic = {
  light: {
    "bg-canvas": "paper-50",
    "bg-surface": "warm-white",
    "bg-surface-sunken": "paper-100",
    "bg-inset": "paper-100",

    "text-primary": "ink-900",
    "text-secondary": "ink-600",
    "text-muted": "ink-500",
    "text-on-accent": "warm-white",

    "border-subtle": "paper-200",
    "border-strong": "paper-300",
    "border-focus": "indigo-500",

    "brand-primary": "indigo-600",
    "brand-primary-hover": "indigo-700",
    "brand-subtle": "indigo-50",
    "brand-muted": "indigo-200",
    spark: "marigold-500",
    "spark-hover": "marigold-600",
    "spark-subtle": "marigold-50",

    "status-success": "green-600",
    "status-warning": "amber-600",
    "status-error": "red-600",
    "status-info": "sky-600",
    "status-success-subtle": "green-200",
    "status-warning-subtle": "marigold-50",
    "status-error-subtle": "red-200",
    "status-info-subtle": "sky-subtle",

    "confidence-low": "red-500",
    "confidence-med": "amber-500",
    "confidence-high": "green-500",

    "grade-a": "green-600",
    "grade-b": "green-500",
    "grade-c": "amber-500",
    "grade-d": "marigold-600",
    "grade-f": "red-600",

    "mastery-not-started": "paper-300", // = border.strong (light)
    "mastery-in-progress": "indigo-500",
    "mastery-mastered": "green-500",

    xp: "marigold-500",
    streak: "marigold-500",
  },
  dark: {
    "bg-canvas": "ink-900",
    "bg-surface": "ink-800",
    "bg-surface-sunken": "ink-900",
    "bg-inset": "ink-inset",

    "text-primary": "paper-100",
    "text-secondary": "ink-400",
    "text-muted": "ink-500",
    "text-on-accent": "warm-white",

    "border-subtle": "ink-700",
    "border-strong": "ink-600",
    "border-focus": "indigo-400",

    "brand-primary": "indigo-400",
    "brand-primary-hover": "indigo-500",
    "brand-subtle": "ink-700",
    "brand-muted": "indigo-500",
    spark: "marigold-400",
    "spark-hover": "marigold-500",
    "spark-subtle": "marigold-50",

    "status-success": "green-500",
    "status-warning": "amber-500",
    "status-error": "red-500",
    "status-info": "sky-500",
    "status-success-subtle": "green-200",
    "status-warning-subtle": "marigold-50",
    "status-error-subtle": "red-200",
    "status-info-subtle": "sky-subtle",

    "confidence-low": "red-500",
    "confidence-med": "amber-500",
    "confidence-high": "green-500",

    "grade-a": "green-600",
    "grade-b": "green-500",
    "grade-c": "amber-500",
    "grade-d": "marigold-600",
    "grade-f": "red-600",

    "mastery-not-started": "ink-600", // = border.strong (dark)
    "mastery-in-progress": "indigo-400",
    "mastery-mastered": "green-500",

    xp: "marigold-400",
    streak: "marigold-400",
  },
};

/* ── shadcn variable bridge (variables.css override) ─────────────────────
 * Maps every HSL variable consumed by @levelup/tailwind-config/theme.js
 * (and thus by all shared-ui/shadcn components) onto Lyceum primitives.
 * Values are emitted as HSL TRIPLETS ("H S% L%") by the generator because
 * theme.js wraps them in hsl(var(--x)).                                   */
const bridge = {
  light: {
    background: "paper-50",
    foreground: "ink-900",
    card: "warm-white",
    "card-foreground": "ink-900",
    "card-border": "paper-200",
    popover: "warm-white",
    "popover-foreground": "ink-900",
    primary: "indigo-600",
    "primary-foreground": "warm-white",
    "primary-glow": "indigo-400",
    secondary: "paper-100",
    "secondary-foreground": "ink-800",
    muted: "paper-100",
    "muted-foreground": "ink-500",
    accent: "indigo-50",
    "accent-foreground": "indigo-700",
    destructive: "red-600",
    "destructive-foreground": "warm-white",
    success: "green-600",
    "success-foreground": "warm-white",
    warning: "amber-600",
    "warning-foreground": "ink-900",
    info: "sky-600",
    "info-foreground": "warm-white",
    border: "paper-200",
    input: "paper-300",
    ring: "indigo-500",
    "chart-1": "indigo-500",
    "chart-2": "green-500",
    "chart-3": "marigold-500",
    "chart-4": "sky-500",
    "chart-5": "paper-500",
    "sidebar-background": "warm-white",
    "sidebar-foreground": "ink-600",
    "sidebar-primary": "indigo-600",
    "sidebar-primary-foreground": "warm-white",
    "sidebar-accent": "indigo-50",
    "sidebar-accent-foreground": "indigo-700",
    "sidebar-border": "paper-200",
    "sidebar-ring": "indigo-500",
  },
  dark: {
    background: "ink-900",
    foreground: "paper-100",
    card: "ink-800",
    "card-foreground": "paper-100",
    "card-border": "ink-700",
    popover: "ink-800",
    "popover-foreground": "paper-100",
    primary: "indigo-400",
    "primary-foreground": "warm-white",
    "primary-glow": "indigo-500",
    secondary: "ink-700",
    "secondary-foreground": "paper-100",
    muted: "ink-700",
    "muted-foreground": "ink-400",
    accent: "ink-700",
    "accent-foreground": "paper-100",
    destructive: "red-500",
    "destructive-foreground": "warm-white",
    success: "green-500",
    "success-foreground": "ink-900",
    warning: "amber-500",
    "warning-foreground": "ink-900",
    info: "sky-500",
    "info-foreground": "ink-900",
    border: "ink-700",
    input: "ink-600",
    ring: "indigo-400",
    "chart-1": "indigo-400",
    "chart-2": "green-500",
    "chart-3": "marigold-400",
    "chart-4": "sky-500",
    "chart-5": "paper-400",
    "sidebar-background": "ink-800",
    "sidebar-foreground": "ink-400",
    "sidebar-primary": "indigo-400",
    "sidebar-primary-foreground": "warm-white",
    "sidebar-accent": "ink-700",
    "sidebar-accent-foreground": "paper-100",
    "sidebar-border": "ink-700",
    "sidebar-ring": "indigo-400",
  },
};

/* ── Non-color scales (§3–§4), emitted verbatim into tokens.css ──────── */
const staticTokens = `
  /* Typography (§3) */
  --font-display: 'Fraunces', 'Iowan Old Style', Georgia, 'Times New Roman', serif;
  --font-ui:      'Schibsted Grotesk', system-ui, -apple-system, 'Segoe UI', sans-serif;
  --font-mono:    'Spline Sans Mono', ui-monospace, 'SF Mono', 'Cascadia Code', monospace;

  --text-2xs: 0.6875rem;  --leading-2xs: 1rem;       /* 11/16 */
  --text-xs:  0.75rem;    --leading-xs:  1.125rem;   /* 12/18 */
  --text-sm:  0.8125rem;  --leading-sm:  1.25rem;    /* 13/20 */
  --text-base: 1rem;      --leading-base: 1.5rem;    /* 16/24 */
  --text-lg:  1.25rem;    --leading-lg:  1.75rem;    /* 20/28 */
  --text-xl:  1.5625rem;  --leading-xl:  2rem;       /* 25/32 */
  --text-2xl: 1.9375rem;  --leading-2xl: 2.375rem;   /* 31/38 */
  --text-3xl: 2.4375rem;  --leading-3xl: 2.875rem;   /* 39/46 */
  --text-4xl: 3.0625rem;  --leading-4xl: 3.375rem;   /* 49/54 */
  --text-5xl: 3.8125rem;  --leading-5xl: 4rem;       /* 61/64 */

  --weight-regular: 400;
  --weight-medium:  500;
  --weight-semibold: 600;
  --weight-bold:    700;

  --tracking-display: -0.02em;
  --tracking-body:    0;
  --tracking-caption: 0.01em;
  --tracking-caps:    0.14em;

  /* Spacing (4px base, §4) */
  --space-0: 0;
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-5: 1.25rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-10: 2.5rem;
  --space-12: 3rem;
  --space-16: 4rem;
  --space-20: 5rem;
  --space-24: 6rem;

  --gutter-mobile:  1rem;
  --gutter-tablet:  1.5rem;
  --gutter-desktop: 2rem;
  --content-max: 1200px;
  --reading-max: 720px;

  /* Radius (§4) */
  --radius-sm:   6px;
  --radius-md:   10px;
  --radius-lg:   14px;
  --radius-xl:   20px;
  --radius-pill: 999px;

  /* Elevation — warm-tinted shadows, never pure black (§4) */
  --shadow-e0: none;
  --shadow-e1: 0 1px 2px rgba(28, 26, 22, 0.06);
  --shadow-e2: 0 4px 12px rgba(28, 26, 22, 0.08);
  --shadow-e3: 0 12px 28px rgba(28, 26, 22, 0.12);
  --ring-focus: 0 0 0 3px rgba(86, 75, 166, 0.35);
  --glow-spark: 0 6px 20px rgba(232, 151, 43, 0.30);

  /* Hairlines (website idiom, reused platform-wide) */
  --hairline:      1px solid var(--border-subtle);
  --hairline-dark: 1px solid rgba(251, 248, 243, 0.14);

  /* Motion (§4) */
  --dur-instant: 100ms;
  --dur-fast:    160ms;
  --dur-base:    220ms;
  --dur-slow:    320ms;
  --dur-page:    420ms;
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);
  --ease-entrance: cubic-bezier(0.05, 0.7, 0.1, 1);
  --ease-exit:     cubic-bezier(0.3, 0, 0.8, 0.15);
`;

/* ── hex → "H S% L%" (HSL triplet, 1-decimal precision) ──────────────── */
function hexToHslTriplet(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`bad hex: ${hex}`);
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
    if (h < 0) h += 360;
  }
  const f = (x) => {
    const v = Math.round(x * 10) / 10;
    return Number.isInteger(v) ? String(v) : v.toFixed(1);
  };
  return `${f(h)} ${f(s * 100)}% ${f(l * 100)}%`;
}

const resolve = (key) => {
  const hex = primitives[key];
  if (!hex) throw new Error(`unknown primitive: ${key}`);
  return hex;
};

module.exports = { primitives, semantic, bridge, staticTokens, hexToHslTriplet, resolve };
