/**
 * Default Gemini model ids (FIX-1 addendum). `gemini-1.5-*` is RETIRED on the
 * live API — calls against it fail — so the platform defaults live HERE, in one
 * place, and are env-overridable so a future retirement is a config change, not
 * a redeploy of every prompt:
 *
 *   LEVELUP_AI_MODEL_PRO   — deep-reasoning tier (extraction / grading)
 *   LEVELUP_AI_MODEL_FLASH — fast tier (scouting / chat / insights)
 *
 * The prompt registry's per-template `defaultModel` and the Gemini provider's
 * fallback both read these; a per-request `model` override still wins.
 */

export interface ModelDefaults {
  pro: string;
  flash: string;
}

/** Resolve the model defaults from the environment (exported for tests). */
export function resolveModelDefaults(env: Record<string, string | undefined>): ModelDefaults {
  return {
    pro: env["LEVELUP_AI_MODEL_PRO"] || "gemini-2.5-pro",
    flash: env["LEVELUP_AI_MODEL_FLASH"] || "gemini-2.5-flash",
  };
}

// Functions env is fixed at deploy time, so module-load resolution is safe.
const DEFAULTS = resolveModelDefaults(process.env);

export const DEFAULT_PRO_MODEL: string = DEFAULTS.pro;
export const DEFAULT_FLASH_MODEL: string = DEFAULTS.flash;
