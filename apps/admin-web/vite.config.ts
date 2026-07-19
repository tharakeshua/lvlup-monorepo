import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import viteCompression from "vite-plugin-compression";
import { visualizer } from "rollup-plugin-visualizer";
import path from "path";

const isAnalyze = process.env.ANALYZE === "true";

export default defineConfig({
  server: {
    port: 4568,
    strictPort: true,
    // Bind IPv4 so http://127.0.0.1 and tools that skip ::1 work on Windows
    host: "127.0.0.1",
  },
  plugins: [
    react(),
    viteCompression({ algorithm: "gzip", threshold: 1024 }),
    viteCompression({ algorithm: "brotliCompress", threshold: 1024, ext: ".br" }),
    isAnalyze &&
      visualizer({
        open: true,
        filename: "dist/bundle-report.html",
        gzipSize: true,
        brotliSize: true,
      }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react-router-dom"],
  },
  define: {
    "process.env": "{}",
  },
  build: {
    target: "es2020",
    cssCodeSplit: true,
    sourcemap: true,
    chunkSizeWarningLimit: 800,
    minify: "terser",
    terserOptions: {
      compress: { drop_console: true, drop_debugger: true },
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes("node_modules/react-dom") ||
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-router")
          ) {
            return "vendor-react";
          }
          if (id.includes("node_modules/firebase") || id.includes("node_modules/@firebase")) {
            return "vendor-firebase";
          }
          if (id.includes("node_modules/@tanstack/react-query")) {
            return "vendor-query";
          }
          if (id.includes("node_modules/@radix-ui")) {
            return "vendor-radix";
          }
        },
        assetFileNames: "assets/[name]-[hash][extname]",
        chunkFileNames: "chunks/[name]-[hash].js",
        entryFileNames: "entries/[name]-[hash].js",
      },
    },
  },
});
