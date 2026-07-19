import type { Config } from "tailwindcss";
import sharedConfig from "@levelup/tailwind-config";
import sharedSafelist from "@levelup/tailwind-config/safelist";
import lyceumPreset from "@levelup/lyceum-preset";

export default {
  // Lyceum last — it wins where the presets overlap (type scale, radius).
  presets: [sharedConfig, lyceumPreset],
  content: ["./index.html", "./src/**/*.{ts,tsx}", "../../packages/shared-ui/src/**/*.{ts,tsx}"],
  safelist: sharedSafelist,
} satisfies Config;
