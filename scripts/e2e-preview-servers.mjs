/**
 * Boots all five web apps via `vite preview` for Playwright E2E in CI.
 * Playwright's webServer hook runs this script and waits on student-web (:4570).
 */
import { spawn } from "node:child_process";
import { accessSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const APPS = [
  { pkg: "@levelup/super-admin", port: 4567, dist: "apps/super-admin/dist" },
  { pkg: "@levelup/admin-web", port: 4568, dist: "apps/admin-web/dist" },
  { pkg: "@levelup/teacher-web", port: 4569, dist: "apps/teacher-web/dist" },
  { pkg: "@levelup/student-web", port: 4570, dist: "apps/student-web/dist" },
  { pkg: "@levelup/parent-web", port: 4571, dist: "apps/parent-web/dist" },
];

/** @param {number} port */
function waitForPort(port, timeoutMs = 120_000) {
  const host = "127.0.0.1";
  const started = Date.now();

  return new Promise((resolve, reject) => {
    const tryConnect = () => {
      const socket = net.createConnection({ port, host }, () => {
        socket.end();
        resolve(undefined);
      });
      socket.on("error", () => {
        socket.destroy();
        if (Date.now() - started > timeoutMs) {
          reject(new Error(`Timed out waiting for ${host}:${port}`));
          return;
        }
        setTimeout(tryConnect, 500);
      });
    };
    tryConnect();
  });
}

/** @type {import('node:child_process').ChildProcess[]} */
const children = [];

function shutdown(signal) {
  for (const child of children) {
    if (!child.killed) child.kill(signal);
  }
}

process.on("SIGINT", () => {
  shutdown("SIGINT");
  process.exit(0);
});
process.on("SIGTERM", () => {
  shutdown("SIGTERM");
  process.exit(0);
});

for (const app of APPS) {
  const distPath = path.join(root, app.dist);
  const indexHtml = path.join(distPath, "index.html");
  try {
    accessSync(indexHtml);
  } catch {
    console.error(`[e2e-preview] Missing build output: ${indexHtml}`);
    console.error("[e2e-preview] Run `pnpm run build` before E2E tests.");
    process.exit(1);
  }

  const child = spawn(
    "pnpm",
    [
      "--filter",
      app.pkg,
      "exec",
      "vite",
      "preview",
      "--host",
      "127.0.0.1",
      "--port",
      String(app.port),
      "--strictPort",
    ],
    {
      cwd: root,
      stdio: "inherit",
      shell: process.platform === "win32",
      env: { ...process.env, NODE_ENV: "production" },
    },
  );

  child.on("exit", (code, signal) => {
    if (code && code !== 0) {
      console.error(`[e2e-preview] ${app.pkg} exited with code ${code} (${signal ?? ""})`);
      shutdown("SIGTERM");
      process.exit(code ?? 1);
    }
  });

  children.push(child);
}

await Promise.all(APPS.map((app) => waitForPort(app.port)));
console.log("[e2e-preview] All apps ready on ports 4567–4571");

// Keep process alive for Playwright
await new Promise(() => {});
