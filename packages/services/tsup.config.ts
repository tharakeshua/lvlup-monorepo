import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/repo-admin/index.ts", "src/repo-admin/testing/index.ts"],
  format: ["cjs", "esm"],
  outExtension: ({ format }) => ({ js: format === "cjs" ? ".cjs" : ".js" }),
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: false,
  treeshake: true,
  platform: "node",
  target: "node20",
});
