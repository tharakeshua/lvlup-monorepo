/**
 * verify() — re-reads the written tree and asserts counts match the config (the idempotency +
 * write-success check). Compares EXPECTED entity counts (derived from the SeedConfig) against
 * ACTUAL Firestore collection counts. Used both as a post-seed gate and as the body of the
 * `seed.idempotency.test.ts` re-run=no-op invariant (counts are identical after a second run).
 */

import type { SeedContext } from "./context.js";
import { canonicalHash, type SeedManifestEntry } from "./manifest.js";
import { Paths } from "./paths.js";
import { IdResolver } from "./resolver.js";
import type { SeedConfig, TenantConfig } from "../config/types.js";

export interface VerifyEntry {
  collection: string;
  expected: number;
  actual: number;
  ok: boolean;
  /** Present for canonical nested document verification. */
  exactPath?: string;
  expectedHash?: string;
  actualHash?: string;
  verificationKind?: string;
}

export interface VerifyReport {
  ok: boolean;
  entries: VerifyEntry[];
  /** Collections whose actual < expected (missing writes). */
  failures: VerifyEntry[];
}

/** Sum the EXPECTED count of a per-tenant top-level collection across the config. */
function expectedTenantCounts(config: SeedConfig): Map<string, number> {
  const m = new Map<string, number>();
  const add = (col: string, n: number) => m.set(col, (m.get(col) ?? 0) + n);

  for (const t of config.tenants) {
    add("tenants", 1);
    add("academicSessions", t.academicSessions?.length ?? 0);
    add("classes", t.classes?.length ?? 0);
    add("teachers", t.teachers?.length ?? 0);
    add("students", t.students?.length ?? 0);
    add("parents", t.parents?.length ?? 0);
    add("staff", (t.staff?.length ?? 0) + (t.admins?.length ?? 0));
    add("scanners", t.scanners?.length ?? 0);
    add("agents", t.agents?.length ?? 0);
    add("rubricPresets", t.rubricPresets?.length ?? 0);
    add("questionBank", t.questionBank?.length ?? 0);
    add("spaces", t.spaces?.length ?? 0);
    add("exams", t.exams?.length ?? 0);
    add("submissions", t.submissions?.length ?? 0);
    add("digitalTestSessions", t.testSessions?.length ?? 0);
    add("achievements", t.achievements?.length ?? 0);
    add("announcements", t.announcements?.length ?? 0);
    add("notifications", t.notifications?.length ?? 0);
    add("insights", t.insights?.length ?? 0);
  }
  return m;
}

/** Build the (tenantId-scoped) collection-path → expected-count list for one tenant. */
function tenantCollections(tc: TenantConfig): { path: string; expected: number }[] {
  const r = new IdResolver(tc.key);
  const t = r.tenantId;
  return [
    { path: Paths.academicSessions(t), expected: tc.academicSessions?.length ?? 0 },
    { path: Paths.classes(t), expected: tc.classes?.length ?? 0 },
    { path: Paths.teachers(t), expected: tc.teachers?.length ?? 0 },
    { path: Paths.students(t), expected: tc.students?.length ?? 0 },
    { path: Paths.parents(t), expected: tc.parents?.length ?? 0 },
    { path: Paths.staffs(t), expected: (tc.staff?.length ?? 0) + (tc.admins?.length ?? 0) },
    { path: Paths.scanners(t), expected: tc.scanners?.length ?? 0 },
    { path: Paths.agents(t), expected: tc.agents?.length ?? 0 },
    { path: Paths.rubricPresets(t), expected: tc.rubricPresets?.length ?? 0 },
    { path: Paths.questionBank(t), expected: tc.questionBank?.length ?? 0 },
    { path: Paths.spaces(t), expected: tc.spaces?.length ?? 0 },
    { path: Paths.exams(t), expected: tc.exams?.length ?? 0 },
    { path: Paths.submissions(t), expected: tc.submissions?.length ?? 0 },
    { path: Paths.testSessions(t), expected: tc.testSessions?.length ?? 0 },
    { path: Paths.achievements(t), expected: tc.achievements?.length ?? 0 },
    { path: Paths.announcements(t), expected: tc.announcements?.length ?? 0 },
    { path: Paths.notifications(t), expected: tc.notifications?.length ?? 0 },
  ];
}

/** Exact nested collection checks — counts alone cannot prove parent/path correctness. */
function nestedCollections(tc: TenantConfig): { path: string; expected: number }[] {
  const r = new IdResolver(tc.key);
  const tenantId = r.tenantId;
  const entries: { path: string; expected: number }[] = [];
  for (const space of tc.spaces ?? []) {
    const spaceId = r.spaceId(space.key);
    const storyPoints = space.storyPoints ?? [];
    entries.push({ path: Paths.storyPoints(tenantId, spaceId), expected: storyPoints.length });
    for (const storyPoint of storyPoints) {
      const storyPointId = r.storyPointId(space.key, storyPoint.key);
      const items = storyPoint.items ?? [];
      entries.push({ path: Paths.items(tenantId, spaceId, storyPointId), expected: items.length });
      for (const item of items) {
        if (item.kind !== "question") continue;
        const itemId = r.itemId(space.key, storyPoint.key, item.key);
        entries.push({
          path: Paths.answerKeys(tenantId, spaceId, storyPointId, itemId),
          expected: 1,
        });
      }
    }
  }
  return entries;
}

const EXACT_KINDS = new Set([
  "storyPoint",
  "item",
  "answerKey",
  "agent",
  "assessmentConfiguration",
]);

export async function verify(
  ctx: SeedContext,
  config: SeedConfig,
  manifest: readonly SeedManifestEntry[] = ctx.manifest.entries()
): Promise<VerifyReport> {
  const log = ctx.logger.child("verify");
  const entries: VerifyEntry[] = [];

  if (ctx.dryRun) {
    log.warn("dry-run: skipping read-back verification (no docs were written)");
    // Surface expected counts for visibility even in dry-run.
    for (const [collection, expected] of expectedTenantCounts(config)) {
      entries.push({ collection, expected, actual: -1, ok: true });
    }
    for (const entry of manifest) {
      for (const verificationKind of entry.verifyAs) {
        if (!EXACT_KINDS.has(verificationKind)) continue;
        entries.push({
          collection: entry.exactPath,
          exactPath: entry.exactPath,
          expected: 1,
          actual: -1,
          ok: true,
          expectedHash: entry.canonicalHash,
          verificationKind,
        });
      }
    }
    return { ok: true, entries, failures: [] };
  }

  // top-level tenants
  const tenantsActual = await ctx.countCollection(Paths.tenants());
  entries.push({
    collection: "tenants",
    expected: config.tenants.length,
    actual: tenantsActual,
    ok: tenantsActual === config.tenants.length,
  });

  // per-tenant collections
  for (const tc of config.tenants) {
    for (const { path, expected } of tenantCollections(tc)) {
      if (expected === 0) continue;
      const actual = await ctx.countCollection(path);
      const ok = actual === expected;
      entries.push({ collection: path, expected, actual, ok });
      if (!ok) log.error(`count mismatch ${path}: expected ${expected}, got ${actual}`);
    }
    for (const { path, expected } of nestedCollections(tc)) {
      const actual = await ctx.countCollection(path);
      const ok = actual === expected;
      entries.push({ collection: path, expected, actual, ok });
      if (!ok) log.error(`nested count mismatch ${path}: expected ${expected}, got ${actual}`);
    }
  }

  // Every relevant document must exist exactly at the canonical path and hash to
  // the authored payload.  This catches wrong parents, stale merged fields, and
  // an independently-derived answer-key id that top-level count checks miss.
  for (const entry of manifest) {
    for (const verificationKind of entry.verifyAs) {
      if (!EXACT_KINDS.has(verificationKind)) continue;
      const actual = await ctx.read(entry.exactPath);
      const actualHash = actual ? canonicalHash(actual) : undefined;
      const ok = actualHash === entry.canonicalHash;
      entries.push({
        collection: entry.exactPath,
        exactPath: entry.exactPath,
        expected: 1,
        actual: actual ? 1 : 0,
        ok,
        expectedHash: entry.canonicalHash,
        actualHash,
        verificationKind,
      });
      if (!ok) {
        log.error(`canonical mismatch ${verificationKind} ${entry.exactPath}`);
      }
    }
  }

  const failures = entries.filter((e) => !e.ok);
  const ok = failures.length === 0;
  log[ok ? "info" : "error"](
    `verify ${ok ? "PASSED" : "FAILED"} — ${entries.length} collections checked, ${failures.length} failure(s)`
  );
  return { ok, entries, failures };
}
