import type { Config } from "tailwindcss";
import sharedConfig from "@levelup/tailwind-config";
import sharedSafelist from "@levelup/tailwind-config/safelist";

export default {
  presets: [sharedConfig],
  content: ["./index.html", "./src/**/*.{ts,tsx}", "../../packages/shared-ui/src/**/*.{ts,tsx}"],
  safelist: sharedSafelist,
} satisfies Config;
