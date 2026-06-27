/**
 * `evaluationSettingsRepo` (SDK-LAYERS-PLAN §4.1, domain plan autograde.md).
 *
 *   list(includePublic?)       — over listEvaluationSettings → EvaluationSettingsView[]
 *   save(input)                — over saveEvaluationSettings (D2: never injects tenantId)
 *   computeDefaultSettings     — derived: the single isDefault entry (or null)
 *   computeEnabledDimensionIds — derived: ids of enabled dimensions
 *
 * Per-entity repo — imports `api` ONLY; never a sibling repo (R6). Thresholds /
 * `promptGuidance` are projected out server-side for non-authoring roles (⚷).
 */
import type {
  ApiClient,
  EvaluationSettingsView,
  SaveEvaluationSettingsInput,
  SaveResponse,
} from "./api-types.js";

/** Minimal settings shape the derived helpers read. */
interface SettingsLike {
  id?: string;
  isDefault?: boolean;
  enabledDimensions?: { id?: string }[];
}

export interface EvaluationSettingsRepo {
  list(includePublic?: boolean): Promise<EvaluationSettingsView[]>;
  save(input: SaveEvaluationSettingsInput): Promise<SaveResponse>;

  // derived (computed once; no wire call)
  computeDefaultSettings<T extends SettingsLike>(settings: readonly T[]): T | null;
  computeEnabledDimensionIds(s: SettingsLike): string[];
}

export function createEvaluationSettingsRepo(api: ApiClient): EvaluationSettingsRepo {
  const ag = api.autograde;

  return {
    list: async (includePublic) => {
      const req = includePublic === undefined ? {} : { includePublic };
      return (await ag.listEvaluationSettings(req)).settings;
    },
    save: (input) => ag.saveEvaluationSettings(input),

    computeDefaultSettings: (settings) => settings.find((s) => s.isDefault === true) ?? null,
    computeEnabledDimensionIds: (s) =>
      (s.enabledDimensions ?? [])
        .map((d) => d.id)
        .filter((id): id is string => typeof id === "string"),
  };
}
