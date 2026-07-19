/**
 * Provider-side key validation. Called by the key-management service BEFORE a key
 * is stored, so an invalid key is rejected and never persisted. A DEFINITIVE
 * provider rejection (bad/forbidden key) returns `{ ok: false }`; a network/unknown
 * failure (offline, emulator) returns `{ ok: true, validated: false }` so local dev
 * is never blocked — the key is stored but marked unvalidated.
 */
import type { KeyProvider } from "@levelup/domain";

export interface KeyValidationResult {
  /** false ONLY for a definitive provider rejection (invalid/forbidden key). */
  ok: boolean;
  /** true when the provider affirmatively accepted the key. */
  validated: boolean;
  reason?: string;
}

const GEMINI_MODELS_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

async function validateGeminiKey(key: string): Promise<KeyValidationResult> {
  try {
    const res = await fetch(`${GEMINI_MODELS_ENDPOINT}?key=${encodeURIComponent(key)}`, {
      method: "GET",
    });
    if (res.ok) return { ok: true, validated: true };
    // 400 (INVALID_ARGUMENT) / 403 (PERMISSION_DENIED) ⇒ the key is bad. Reject.
    if (res.status === 400 || res.status === 401 || res.status === 403) {
      return { ok: false, validated: false, reason: `provider_${res.status}` };
    }
    // Other statuses (429/5xx) are not a verdict on the key — allow, unvalidated.
    return { ok: true, validated: false, reason: `provider_${res.status}` };
  } catch (cause) {
    // Network/offline/emulator — do not block; store unvalidated.
    return { ok: true, validated: false, reason: `network:${String(cause).slice(0, 80)}` };
  }
}

/** Validate a provider key. Extend the switch as providers are added. */
export async function validateProviderKey(
  provider: KeyProvider | string,
  key: string
): Promise<KeyValidationResult> {
  const trimmed = key.trim();
  if (!trimmed) return { ok: false, validated: false, reason: "empty" };
  switch (provider) {
    case "google":
      return validateGeminiKey(trimmed);
    default:
      // Unknown provider: cannot affirmatively validate — allow, unvalidated.
      return { ok: true, validated: false, reason: "unsupported_provider" };
  }
}
