/**
 * config/index.ts — the AUTHORITATIVE seed assembler.
 *
 * It merges every authored data fragment into ONE ordered `SeedConfig` (dependency order),
 * applies the analytics·gamification·notification overlay, validates cross-fragment FK
 * consistency (`assertFkConsistency`) + the input schema (`validateSeedConfig`), and exposes:
 *
 *   • `seedConfig`        — the assembled, validated SeedConfig (the default the CLI seeds).
 *   • `buildSeedConfig()` — the pure builder (compose → overlay → validate) for tests/tools.
 *   • `derivedSeedDocs(clock)` — the rich DERIVED `{ path, data }` docs the inline-array pipeline
 *                               does not synthesize (ExamAnalytics, full Student/Class summaries,
 *                               LlmCallLog, byModel cost, NotificationPreferences, leaderboards).
 *   • `notificationBadgeStates(clock)` — the RTDB unread-badge projection (epoch-ms fenced).
 *
 * Dependency order (the order fragments are composed AND the order the pipeline writes):
 *   superAdmins → globalPresets → tenants[ identity → greenwood → riverside → autograde
 *   → content-levelup ] → analytics overlay (concatenated onto greenwood/riverside).
 *
 * Shapes mirror the @levelup/domain Zod-first entities (SDK-LAYERS-PLAN §2 + §8 drift). Every
 * cross-reference is by logical KEY; the engine resolves keys → deterministic branded ids in
 * dependency order, so re-seeding is idempotent. Validation runs at module load so any drift in
 * the fragments fails fast (before a single write).
 */

import type { Clock } from "../engine/clock.js";
import type { SeedConfig, TenantConfig } from "./types.js";
import { validateSeedConfig } from "./schema.js";
import { assertFkConsistency } from "./fk.js";

// ── fragments ──
import { demoSuperAdmin, demoTenant } from "../data/identity.js";
import { greenwoodTenant } from "../data/greenwood.js";
import { riversideTenant } from "../data/riverside.js";
import { autogradeTenant } from "../data/autograde.js";
import { contentLevelupTenant } from "../data/content-levelup.js";
import { testsessionProgressTenant } from "../data/testsession-progress.js";
import {
  mergeAnalyticsGamificationNotification,
  analyticsGamificationNotificationDocs,
  notificationBadgeStates,
  type SeedDoc,
} from "../data/analytics-gamification-notification.js";

// ─────────────────────────────────────────────────────────────────────────────
// Platform-root actors (super-admins + global presets)
// ─────────────────────────────────────────────────────────────────────────────

const SUPER_ADMINS: NonNullable<SeedConfig["superAdmins"]> = [
  demoSuperAdmin,
  {
    key: "platform-owner",
    email: "owner@levelup.dev",
    password: "SuperAdmin@123",
    displayName: "Platform Owner",
  },
];

const GLOBAL_PRESETS: NonNullable<SeedConfig["globalEvaluationPresets"]> = [
  {
    key: "default-essay",
    name: "Default Essay Rubric",
    description: "Platform-wide essay grading preset",
    status: "active",
    rubric: {
      dimensions: [
        {
          key: "content",
          label: "Content & Accuracy",
          weight: 0.5,
          promptGuidance: "Reward correct, complete reasoning.",
        },
        { key: "clarity", label: "Clarity", weight: 0.3 },
        { key: "structure", label: "Structure", weight: 0.2 },
      ],
      totalPoints: 10,
      passingScore: 6,
    },
  },
];

/**
 * The ordered tenant subtrees. Order is the WRITE order (identity demo tenant first so the
 * canonical demo logins land before the richer feature tenants). All five use tenant-scoped
 * emails, so Firebase Auth accounts never collide across tenants.
 *
 * NOTE: `testsessionProgressTenant` is intentionally NOT in the default set — it reuses some
 * REAL-world parent emails (e.g. `rajesh.patel@gmail.com`) that also appear in Greenwood, which
 * would collide in Firebase Auth (one email → one account). It is exported separately so it can
 * be seeded standalone against its own (empty) project/emulator.
 */
const TENANTS: TenantConfig[] = [
  demoTenant,
  greenwoodTenant,
  riversideTenant,
  autogradeTenant,
  contentLevelupTenant,
];

// ─────────────────────────────────────────────────────────────────────────────
// Builder
// ─────────────────────────────────────────────────────────────────────────────

export interface BuildSeedConfigOptions {
  /** Skip the analytics·gamification·notification overlay (base fragments only). */
  withoutAnalyticsOverlay?: boolean;
  /** Skip validation (schema + FK). Default: validate. */
  skipValidation?: boolean;
}

/**
 * Compose all fragments into one ordered, validated SeedConfig.
 * Pure + deterministic — the same fragments always produce the same config.
 */
export function buildSeedConfig(options: BuildSeedConfigOptions = {}): SeedConfig {
  const base: SeedConfig = {
    version: "1.0.0",
    superAdmins: SUPER_ADMINS,
    globalEvaluationPresets: GLOBAL_PRESETS,
    tenants: TENANTS,
  };

  const composed = options.withoutAnalyticsOverlay
    ? base
    : mergeAnalyticsGamificationNotification(base);

  if (!options.skipValidation) {
    validateSeedConfig(composed); // input-shape guard (typos fail fast)
    assertFkConsistency(composed); // cross-fragment key references resolve
  }

  return composed;
}

/**
 * The assembled, validated SeedConfig the CLI seeds by default. Built (and validated) at module
 * load so any fragment drift surfaces immediately on import.
 */
export const seedConfig: SeedConfig = buildSeedConfig();

/**
 * The rich DERIVED docs (analytics/gamification projections) the inline-array pipeline does not
 * synthesize. The engine writes these with a thin idempotent `ensureDoc` loop AFTER the pipeline,
 * using the SAME `Paths.*`/`seedId(...)` conventions so ids/paths line up byte-for-byte.
 */
export function derivedSeedDocs(clock?: Clock): SeedDoc[] {
  return analyticsGamificationNotificationDocs(clock);
}

export { notificationBadgeStates };
export type { SeedDoc };

/** The standalone testsession-progress tenant (opt-in — see TENANTS note on email collisions). */
export { testsessionProgressTenant };

// re-exports (the authoring surface)
export * from "./types.js";
export { SeedConfigSchema, validateSeedConfig } from "./schema.js";
export { assertFkConsistency } from "./fk.js";
