/** @type {import('tailwindcss').Config} */
// Lyceum design tokens ("Modern Scholarly") ported to a NativeWind v4 theme.
// Source of truth: docs/rebuild-spec/design/build/tokens/lyceum.css (light theme).
// RN has no CSS variables, so semantic roles are flattened to concrete hex here;
// a future dark-theme pass can layer a second palette via a theme provider.
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // primitives
        paper: {
          50: "#FBF8F3",
          100: "#F4EEE4",
          200: "#E8DFD0",
          300: "#D6C9B4",
          400: "#B3A487",
          500: "#8A7B5E",
        },
        ink: {
          900: "#1C1A16",
          800: "#2A2620",
          700: "#3D382F",
          600: "#565046",
          500: "#756E61",
          400: "#9A9486",
        },
        indigo: {
          700: "#322C63",
          600: "#423A82",
          500: "#564BA6",
          400: "#7A6FC9",
          200: "#CFC9EC",
          50: "#EEEBF8",
        },
        marigold: {
          600: "#C97A14",
          500: "#E8972B",
          400: "#F4B45A",
          200: "#FBE0B0",
          50: "#FDF4E3",
        },
        green: { 600: "#2F7D5B", 500: "#3EA876", 200: "#BFE6D2" },
        amber: { 600: "#B7791F", 500: "#E0A12E" },
        red: { 600: "#B23A36", 500: "#D85650", 200: "#F3CFCD" },
        sky: { 600: "#2D6E8E", 500: "#3F92B8" },
        // semantic roles (light theme)
        canvas: "#FBF8F3",
        surface: "#FFFDFA",
        "surface-sunken": "#F4EEE4",
        inset: "#F4EEE4",
        "text-primary": "#1C1A16",
        "text-secondary": "#565046",
        "text-muted": "#756E61",
        "text-on-accent": "#FFFDFA",
        "border-subtle": "#E8DFD0",
        "border-strong": "#D6C9B4",
        brand: "#423A82",
        "brand-hover": "#322C63",
        "brand-subtle": "#EEEBF8",
        spark: "#E8972B",
        success: "#2F7D5B",
        warning: "#B7791F",
        error: "#B23A36",
        info: "#2D6E8E",
        // mastery scale (Lyceum §2.3) — the learning-journey status colors
        "mastery-mastered": "#3EA876",
        "mastery-in-progress": "#564BA6",
        "mastery-not-started": "#D6C9B4",
      },
      borderRadius: {
        sm: "6px",
        md: "10px",
        lg: "14px",
        xl: "20px",
        pill: "999px",
      },
      fontFamily: {
        display: ["Fraunces", "Georgia", "serif"],
        "display-regular": ["Fraunces-Regular", "Georgia", "serif"],
        ui: ["Schibsted Grotesk", "System", "sans-serif"],
        "ui-medium": ["SchibstedGrotesk-Medium", "System", "sans-serif"],
        "ui-bold": ["SchibstedGrotesk-Bold", "System", "sans-serif"],
        mono: ["Spline Sans Mono", "monospace"],
        "mono-medium": ["SplineSansMono-Medium", "monospace"],
      },
      letterSpacing: {
        caps: "1.5px",
      },
      fontSize: {
        "2xs": ["11px", "16px"],
        xs: ["12px", "18px"],
        sm: ["13px", "20px"],
        base: ["16px", "24px"],
        lg: ["20px", "28px"],
        xl: ["25px", "32px"],
        "2xl": ["31px", "38px"],
        "3xl": ["39px", "46px"],
      },
    },
  },
  plugins: [],
};
