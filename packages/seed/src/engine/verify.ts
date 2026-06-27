/**
 * verify() — re-reads the written tree and asserts counts match the config (the idempotency +
 * write-success check). Compares EXPECTED entity counts (derived from the SeedConfig) against
 * ACTUAL Firestore collection counts. Used both as a post-seed gate and as the body of the
 * `seed.idempotency.test.ts` re-run=no-op invariant (counts are identical after a second run).
 */

import type { SeedContext } from "./context.js";
import { Paths } from "./paths.js";
import { IdResolver } from "./resolver.js";
import type { SeedConfig, TenantConfig } from "../config/types.js";

export interface VerifyEntry {
  collection: string;
  expected: number;
  actual: number;
  ok: boolean;
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

export async function verify(ctx: SeedContext, config: SeedConfig): Promise<VerifyReport> {
  const log = ctx.logger.child("verify");
  const entries: VerifyEntry[] = [];

  if (ctx.dryRun) {
    log.warn("dry-run: skipping read-back verification (no docs were written)");
    // Surface expected counts for visibility even in dry-run.
    for (const [collection, expected] of expectedTenantCounts(config)) {
      entries.push({ collection, expected, actual: -1, ok: true });
    }
    return { ok: true, entries, failures: [] };
  }

  // top-level tenants
  const tenantsActual = await ctx.countCollection(Paths.tenants());
  entries.push({
    collection: "tenants",
    expected: config.tenants.length,
    actual: tenantsActual,
    ok: tenantsActual >= config.tenants.length,
  });

  // per-tenant collections
  for (const tc of config.tenants) {
    for (const { path, expected } of tenantCollections(tc)) {
      if (expected === 0) continue;
      const actual = await ctx.countCollection(path);
      const ok = actual >= expected;
      entries.push({ collection: path, expected, actual, ok });
      if (!ok) log.error(`count mismatch ${path}: expected ${expected}, got ${actual}`);
    }
  }

  const failures = entries.filter((e) => !e.ok);
  const ok = failures.length === 0;
  log[ok ? "info" : "error"](
    `verify ${ok ? "PASSED" : "FAILED"} — ${entries.length} collections checked, ${failures.length} failure(s)`
  );
  return { ok, entries, failures };
}
