import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/identity/index.ts", "src/tenant/index.ts", "src/progress/index.ts"],
  format: ["cjs", "esm"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: false,
  treeshake: true,
});
