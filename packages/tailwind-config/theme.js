/**
 * LevelUp Design System - HSL Color Theme
 *
 * This theme uses HSL color variables for maximum flexibility
 * All colors are defined as CSS variables in your global styles
 */

const levelUpColors = {
  border: "hsl(var(--border))",
  input: "hsl(var(--input))",
  ring: "hsl(var(--ring))",
  background: "hsl(var(--background))",
  foreground: "hsl(var(--foreground))",
  primary: {
    DEFAULT: "hsl(var(--primary))",
    foreground: "hsl(var(--primary-foreground))",
    glow: "hsl(var(--primary-glow))",
  },
  secondary: {
    DEFAULT: "hsl(var(--secondary))",
    foreground: "hsl(var(--secondary-foreground))",
  },
  destructive: {
    DEFAULT: "hsl(var(--destructive))",
    foreground: "hsl(var(--destructive-foreground))",
  },
  muted: {
    DEFAULT: "hsl(var(--muted))",
    foreground: "hsl(var(--muted-foreground))",
  },
  accent: {
    DEFAULT: "hsl(var(--accent))",
    foreground: "hsl(var(--accent-foreground))",
  },
  popover: {
    DEFAULT: "hsl(var(--popover))",
    foreground: "hsl(var(--popover-foreground))",
  },
  card: {
    DEFAULT: "hsl(var(--card))",
    foreground: "hsl(var(--card-foreground))",
    border: "hsl(var(--card-border))",
  },
  // Semantic Colors
  success: {
    DEFAULT: "hsl(var(--success))",
    foreground: "hsl(var(--success-foreground))",
  },
  warning: {
    DEFAULT: "hsl(var(--warning))",
    foreground: "hsl(var(--warning-foreground))",
  },
  info: {
    DEFAULT: "hsl(var(--info))",
    foreground: "hsl(var(--info-foreground))",
  },
  // Chart Colors
  chart: {
    1: "hsl(var(--chart-1))",
    2: "hsl(var(--chart-2))",
    3: "hsl(var(--chart-3))",
    4: "hsl(var(--chart-4))",
    5: "hsl(var(--chart-5))",
  },
  // Skill Progression Tiers
  tier: {
    silver: "hsl(var(--tier-silver))",
    gold: "hsl(var(--tier-gold))",
    platinum: "hsl(var(--tier-platinum))",
    diamond: "hsl(var(--tier-diamond))",
  },
  // Learning States
  state: {
    locked: "hsl(var(--state-locked))",
    available: "hsl(var(--state-available))",
    progress: "hsl(var(--state-progress))",
    completed: "hsl(var(--state-completed))",
  },
  sidebar: {
    DEFAULT: "hsl(var(--sidebar-background))",
    foreground: "hsl(var(--sidebar-foreground))",
    primary: "hsl(var(--sidebar-primary))",
    "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
    accent: "hsl(var(--sidebar-accent))",
    "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
    border: "hsl(var(--sidebar-border))",
    ring: "hsl(var(--sidebar-ring))",
  },
};

const levelUpBorderRadius = {
  lg: "var(--radius)",
  md: "calc(var(--radius) - 2px)",
  sm: "calc(var(--radius) - 4px)",
};

const levelUpKeyframes = {
  "accordion-down": {
    from: { height: "0" },
    to: { height: "var(--radix-accordion-content-height)" },
  },
  "accordion-up": {
    from: { height: "var(--radix-accordion-content-height)" },
    to: { height: "0" },
  },
  // Premium Learning Platform Animations
  glow: {
    "0%, 100%": {
      boxShadow: "0 0 20px hsl(var(--primary-glow) / 0.5)",
    },
    "50%": {
      boxShadow: "0 0 30px hsl(var(--primary-glow) / 0.8)",
    },
  },
  float: {
    "0%, 100%": {
      transform: "translateY(0px)",
    },
    "50%": {
      transform: "translateY(-10px)",
    },
  },
  "pulse-glow": {
    "0%, 100%": {
      opacity: "0.8",
      transform: "scale(1)",
    },
    "50%": {
      opacity: "1",
      transform: "scale(1.05)",
    },
  },
  "slide-up": {
    from: {
      opacity: "0",
      transform: "translateY(20px)",
    },
    to: {
      opacity: "1",
      transform: "translateY(0)",
    },
  },
  "cosmic-spin": {
    from: {
      transform: "rotate(0deg)",
    },
    to: {
      transform: "rotate(360deg)",
    },
  },
  // Micro-interaction animations
  "scale-in": {
    from: {
      opacity: "0",
      transform: "scale(0.95)",
    },
    to: {
      opacity: "1",
      transform: "scale(1)",
    },
  },
  wiggle: {
    "0%, 100%": { transform: "rotate(0deg)" },
    "25%": { transform: "rotate(-3deg)" },
    "75%": { transform: "rotate(3deg)" },
  },
  "bounce-in": {
    "0%": { transform: "scale(0.3)", opacity: "0" },
    "50%": { transform: "scale(1.05)" },
    "70%": { transform: "scale(0.95)" },
    "100%": { transform: "scale(1)", opacity: "1" },
  },
  "progress-fill": {
    from: { width: "0%" },
    to: { width: "var(--progress-width, 100%)" },
  },
};

const levelUpAnimation = {
  "accordion-down": "accordion-down 0.2s ease-out",
  "accordion-up": "accordion-up 0.2s ease-out",
  glow: "glow 2s ease-in-out infinite",
  float: "float 3s ease-in-out infinite",
  "pulse-glow": "pulse-glow 2s ease-in-out infinite",
  "slide-up": "slide-up 0.5s ease-out",
  "cosmic-spin": "cosmic-spin 20s linear infinite",
  "scale-in": "scale-in 0.2s ease-out",
  wiggle: "wiggle 0.3s ease-in-out",
  "bounce-in": "bounce-in 0.4s ease-out",
  "progress-fill": "progress-fill 0.8s ease-out forwards",
};

const levelUpBoxShadow = {
  card: "var(--shadow-card)",
  glow: "var(--shadow-glow)",
  "tier-gold": "var(--shadow-tier-gold)",
  "tier-diamond": "var(--shadow-tier-diamond)",
};

const levelUpBackgroundImage = {
  "gradient-cosmic": "var(--gradient-cosmic)",
  "gradient-space": "var(--gradient-space)",
  "gradient-progress": "var(--gradient-progress)",
  "gradient-glow": "var(--gradient-glow)",
};

// ─── Typography Scale ───
const levelUpFontSize = {
  "display-xl": ["3rem", { lineHeight: "1.1", letterSpacing: "-0.02em", fontWeight: "700" }],
  "display-lg": ["2.25rem", { lineHeight: "1.2", letterSpacing: "-0.01em", fontWeight: "700" }],
  "display-md": ["1.875rem", { lineHeight: "1.25", letterSpacing: "-0.01em", fontWeight: "600" }],
  "heading-lg": ["1.5rem", { lineHeight: "1.3", fontWeight: "600" }],
  "heading-md": ["1.25rem", { lineHeight: "1.4", fontWeight: "600" }],
  "heading-sm": ["1.125rem", { lineHeight: "1.4", fontWeight: "600" }],
  "body-lg": ["1.125rem", { lineHeight: "1.6" }],
  "body-md": ["1rem", { lineHeight: "1.5" }],
  "body-sm": ["0.875rem", { lineHeight: "1.5" }],
  caption: ["0.75rem", { lineHeight: "1.4" }],
};

// ─── Spacing Scale ───
const levelUpSpacing = {
  "page-x": "var(--spacing-page-x)",
  "page-y": "var(--spacing-page-y)",
  section: "var(--spacing-section)",
  "card-p": "var(--spacing-card)",
  "stack-sm": "var(--spacing-stack-sm)",
  "stack-md": "var(--spacing-stack-md)",
  "stack-lg": "var(--spacing-stack-lg)",
};

// ─── Z-Index Scale ───
const levelUpZIndex = {
  dropdown: "50",
  sticky: "100",
  overlay: "200",
  modal: "300",
  popover: "400",
  toast: "500",
  tooltip: "600",
};

module.exports = {
  levelUpColors,
  levelUpBorderRadius,
  levelUpKeyframes,
  levelUpAnimation,
  levelUpBoxShadow,
  levelUpBackgroundImage,
  levelUpFontSize,
  levelUpSpacing,
  levelUpZIndex,
};
