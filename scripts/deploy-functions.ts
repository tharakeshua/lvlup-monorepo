#!/usr/bin/env node
/**
 * Deploy Cloud Functions with prepare/cleanup that always preserves the
 * firebase deploy exit code (unlike `cmd; cleanup` which can mask failures).
 */
import { spawnSync } from "node:child_process";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function run(command: string, args: string[]): number {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
  });
  if (result.error) {
    console.error(result.error);
    return 1;
  }
  return result.status ?? 1;
}

const prepareStatus = run("pnpm", [
  "exec",
  "tsx",
  "scripts/prepare-functions-deploy.ts",
  "prepare",
]);
if (prepareStatus !== 0) {
  process.exit(prepareStatus);
}

const deployStatus = run("pnpm", [
  "exec",
  "firebase",
  "deploy",
  "--only",
  "functions",
  "--project",
  process.env.FIREBASE_PROJECT || "lvlup-ff6fa",
  "--non-interactive",
  // Allow pruning functions removed from source (e.g. legacy manageNotifications).
  "--force",
]);

const cleanupStatus = run("pnpm", [
  "exec",
  "tsx",
  "scripts/prepare-functions-deploy.ts",
  "cleanup",
]);

if (cleanupStatus !== 0) {
  console.error("Functions deploy cleanup failed with status", cleanupStatus);
}

process.exit(deployStatus !== 0 ? deployStatus : cleanupStatus);
