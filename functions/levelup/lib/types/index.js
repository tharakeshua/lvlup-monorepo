"use strict";
/**
 * LevelUp Cloud Functions type surface (U3.2, MIGRATION-PATTERN.md).
 *
 * Vocabulary (enums, grading-type constants) comes from @levelup/domain —
 * verified value-identical to the retired shared-types definitions 2026-07-04.
 * Doc shapes come from ../contracts/legacy-docs — honest LOCAL types for what
 * is actually at rest in the unprefixed collections (NOT domain entities).
 * Wire request schemas live in ../contracts/wire.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AI_EVALUATABLE_TYPES = exports.AUTO_EVALUATABLE_TYPES = void 0;
// ─── Vocabulary from @levelup/domain ─────────────────────────────────────────
var domain_1 = require("@levelup/domain");
Object.defineProperty(exports, "AUTO_EVALUATABLE_TYPES", {
  enumerable: true,
  get: function () {
    return domain_1.AUTO_EVALUATABLE_TYPES;
  },
});
Object.defineProperty(exports, "AI_EVALUATABLE_TYPES", {
  enumerable: true,
  get: function () {
    return domain_1.AI_EVALUATABLE_TYPES;
  },
});
//# sourceMappingURL=index.js.map
