/**
 * `INVALIDATION_GRAPH` (query-infra.md §5.1, SDK-LAYERS-PLAN §4.3).
 *
 * The contract's `invalidates` hints are coarse, single-list roots. This layer
 * adds the cross-domain fanouts + precise targets the contract author couldn't
 * express in one string list (e.g. `submitTestSession` dirties progress AND
 * spaces-detail completion AND analytics, plus a precise space-detail key).
 *
 * MERGE-INVALIDATION-COARSE: a rule that narrows a high-churn root (progress /
 * analytics / submissions) provides a `fanout` for the precise key. We still
 * keep the coarse root for cold-cache safety, but the fanout adds the narrow key
 * so warm screens refetch the minimum.
 */
import { CALLABLES } from "@levelup/api-contract";
import { buildGraphFromContract } from "./derive-from-contract.js";
import type { InvalidationRule } from "./types.js";

type Vars = Record<string, unknown>;
const str = (v: unknown): string => (typeof v === "string" ? v : String(v ?? ""));

/**
 * Hand-authored cross-domain rules, merged OVER the contract's `invalidates`
 * hints. Keyed by callable name (plain strings — the contract is the SSOT for
 * which names exist; the totality test guards coverage).
 */
const OVERRIDES: Record<string, InvalidationRule> = {
  // --- levelup: testsession / progress (server is the scoring authority) ---
  "v1.levelup.submitTestSession": {
    roots: ["progress", "spaces", "storyPoints", "analytics"],
    fanout: ({ vars, keys }) => {
      const v = (vars ?? {}) as Vars;
      const out: (readonly unknown[])[] = [];
      if (v.spaceId !== undefined) {
        out.push(keys.spaces.detail(str(v.spaceId)));
        out.push(keys.progress.sub(str(v.spaceId), "space"));
      }
      return out;
    },
  },
  "v1.levelup.recordItemAttempt": {
    roots: ["progress"],
    fanout: ({ vars, keys }) => {
      const v = (vars ?? {}) as Vars;
      const out: (readonly unknown[])[] = [];
      if (v.spaceId !== undefined) {
        out.push(
          keys.progress.sub(str(v.spaceId), "storyPoint", {
            storyPointId: str(v.storyPointId),
          })
        );
      }
      return out;
    },
  },
  "v1.levelup.evaluateAnswer": { roots: ["progress"] }, // server persists progress now

  // --- levelup: content authoring ---
  "v1.levelup.saveItem": { roots: ["items", "storyPoints", "versions"] },
  "v1.levelup.saveStoryPoint": { roots: ["storyPoints", "spaces"] },
  "v1.levelup.saveSpace": { roots: ["spaces", "store"] }, // publish mirrors store listing

  // --- levelup: store / purchase ---
  "v1.levelup.purchaseSpace": { roots: ["store", "spaces"] },

  // --- levelup: chat ---
  "v1.levelup.sendChatMessage": {
    roots: ["chat"],
    fanout: ({ vars, keys }) => {
      const v = (vars ?? {}) as Vars;
      return v.sessionId !== undefined ? [keys.chat.sub(str(v.sessionId), "messages")] : [];
    },
  },

  // --- levelup: gamification ---
  // mark-seen dirties the unlock list + the composed home (unseenCount).
  "v1.levelup.markAchievementsSeen": { roots: ["achievements", "gamification"] },
  // a goal save/archive recomputes derived progress → the composed home's
  // `activeGoals`/summary must refetch alongside the studyGoals list
  // (gamification.md §Query hooks: invalidate studyGoals + gamification summary).
  "v1.levelup.saveStudyGoal": { roots: ["studyGoals", "gamification"] },
  // authoring a badge definition dirties the catalog (+ the home's recent unlocks
  // snapshot uses the definition copy).
  "v1.levelup.saveAchievementDefinition": { roots: ["achievements", "gamification"] },

  // --- autograde ---
  "v1.autograde.gradeQuestion": {
    roots: ["questionSubmissions", "submissions", "analytics"],
  },
  "v1.autograde.uploadAnswerSheets": { roots: ["submissions", "exams"] },
  "v1.autograde.saveExam": { roots: ["exams"] },

  // --- identity ---
  "v1.identity.saveStudent": { roots: ["students", "classes", "memberships"] },
  "v1.identity.saveClass": { roots: ["classes", "students", "teachers"] },
  "v1.identity.markNotificationRead": { roots: ["notifications", "notificationBadge"] },

  // --- reconciled OUTSIDE the graph: `replace:true` suppresses the contract hint ---
  // switchActiveTenant → a full `resetForTenantSwitch(qc)` clear (§4.4); the
  // contract hints `['me','claims','memberships']` but no coarse invalidate runs.
  "v1.identity.switchActiveTenant": { roots: [], replace: true },
  // generateReport → produces a signed download URL; nothing to invalidate.
  "v1.analytics.generateReport": { roots: [], replace: true },
};

/**
 * The full graph: contract hints merged with OVERRIDES (an entry per callable;
 * `replace:true` entries suppress the hint). Typed as an open record so a domain
 * hook can look up any callable name.
 */
export const INVALIDATION_GRAPH: Record<string, InvalidationRule> = buildGraphFromContract(
  CALLABLES as unknown as Record<string, { invalidates?: readonly string[] }>,
  OVERRIDES
);
