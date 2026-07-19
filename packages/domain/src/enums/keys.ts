import { zEnum } from "./enum.js";

/**
 * LLM provider keys the platform can store/resolve. Gemini (`google`) is the only
 * live provider; the enum is the SSOT so BYOK/tenant/platform key management,
 * contracts, and services all widen together when OpenAI/Anthropic land — no
 * schema migration, just a new member here + a provider adapter in `@levelup/ai`.
 */
export const KEY_PROVIDERS = ["google"] as const;
export type KeyProvider = (typeof KEY_PROVIDERS)[number];
export const zKeyProvider = zEnum(KEY_PROVIDERS);

/** Lifecycle of a stored provider key (metadata only — never the value). */
export const KEY_STATUSES = ["active", "invalid", "revoked"] as const;
export type KeyStatus = (typeof KEY_STATUSES)[number];
export const zKeyStatus = zEnum(KEY_STATUSES);

/** Which principal owns the credential used for a given LLM call. */
export const CREDENTIAL_OWNERS = ["user", "tenant", "platform"] as const;
export type CredentialOwner = (typeof CREDENTIAL_OWNERS)[number];
export const zCredentialOwner = zEnum(CREDENTIAL_OWNERS);
