import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/engine/index.ts", "src/config/index.ts", "src/cli.ts"],
  format: ["cjs", "esm"],
  outExtension: ({ format }) => ({ js: format === "cjs" ? ".cjs" : ".js" }),
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: false,
  treeshake: true,
  // Node-only package (firebase-admin). Not bundled into clients.
  platform: "node",
  target: "node18",
  external: ["firebase-admin"],
});
