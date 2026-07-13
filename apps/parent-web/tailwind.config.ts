import type { Config } from "tailwindcss";
import sharedConfig from "@levelup/tailwind-config";
import sharedSafelist from "@levelup/tailwind-config/safelist";

export default {
  presets: [sharedConfig],
  content: ["./index.html", "./src/**/*.{ts,tsx}", "../../packages/shared-ui/src/**/*.{ts,tsx}"],
  safelist: sharedSafelist,
  theme: {
    extend: {
      colors: {
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
      },
    },
  },
} satisfies Config;
