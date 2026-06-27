/**
 * ensureAuthUser — idempotent create-or-update of a Firebase Auth user + custom claims.
 *
 * - Deterministic uid: when a `uid` is supplied we create the user WITH that uid (so the
 *   seed's stable `seedId('user', key)` is the Auth uid, making re-runs no-ops and letting
 *   Firestore `/users/{uid}` docs be written deterministically before/independent of Auth).
 * - Emulator-aware: works identically against FIREBASE_AUTH_EMULATOR_HOST.
 * - Claims: sets PlatformClaims-shaped custom claims (MAX_CLAIM_CLASS_IDS handled by the caller
 *   via buildPlatformClaims). Setting claims is idempotent (last-writer-wins on the same shape).
 */

import type { Auth } from "./admin.js";
import type { PlatformClaims } from "./claims.js";
import type { Logger } from "./logger.js";

export interface EnsureAuthUserInput {
  email: string;
  password: string;
  displayName?: string;
  photoURL?: string;
  phoneNumber?: string;
  emailVerified?: boolean;
  disabled?: boolean;
  /** Deterministic uid to bind the user to (recommended — drives idempotency). */
  uid?: string;
  /** PlatformClaims to set after create/update. Omit to leave claims untouched. */
  claims?: PlatformClaims;
}

export interface EnsureAuthUserResult {
  uid: string;
  created: boolean;
  claimsSet: boolean;
}

export interface EnsureAuthUserDeps {
  auth: Auth;
  dryRun?: boolean;
  logger?: Logger;
}

function isUserNotFound(err: unknown): boolean {
  return (err as { code?: string })?.code === "auth/user-not-found";
}

export async function ensureAuthUser(
  input: EnsureAuthUserInput,
  deps: EnsureAuthUserDeps
): Promise<EnsureAuthUserResult> {
  const { auth, dryRun, logger } = deps;
  const log = logger?.child("auth");

  if (dryRun) {
    const uid = input.uid ?? `dryrun_${input.email}`;
    log?.debug(`[dry-run] ensureAuthUser ${input.email} -> ${uid}`);
    return { uid, created: false, claimsSet: Boolean(input.claims) };
  }

  // 1) Resolve existing user — prefer uid lookup (deterministic), fall back to email.
  let existing: { uid: string } | null = null;
  if (input.uid) {
    try {
      existing = await auth.getUser(input.uid);
    } catch (err) {
      if (!isUserNotFound(err)) throw err;
    }
  }
  if (!existing) {
    try {
      existing = await auth.getUserByEmail(input.email);
    } catch (err) {
      if (!isUserNotFound(err)) throw err;
    }
  }

  let uid: string;
  let created: boolean;

  if (existing) {
    uid = existing.uid;
    created = false;
    // Reconcile mutable fields (password/displayName/etc.) — keeps re-runs convergent.
    await auth.updateUser(uid, {
      email: input.email,
      password: input.password,
      displayName: input.displayName,
      photoURL: input.photoURL,
      phoneNumber: input.phoneNumber,
      emailVerified: input.emailVerified ?? true,
      disabled: input.disabled ?? false,
    });
    log?.debug(`auth user exists, reconciled: ${input.email} (${uid})`);
  } else {
    const record = await auth.createUser({
      uid: input.uid, // deterministic uid when provided
      email: input.email,
      password: input.password,
      displayName: input.displayName,
      photoURL: input.photoURL,
      phoneNumber: input.phoneNumber,
      emailVerified: input.emailVerified ?? true,
      disabled: input.disabled ?? false,
    });
    uid = record.uid;
    created = true;
    log?.info(`auth user created: ${input.email} (${uid})`);
  }

  // 2) Set custom claims (PlatformClaims). Idempotent — same shape => no observable change.
  let claimsSet = false;
  if (input.claims) {
    await auth.setCustomUserClaims(uid, input.claims as Record<string, unknown>);
    claimsSet = true;
    log?.debug(`claims set for ${uid}: role=${input.claims.role ?? "-"}`);
  }

  return { uid, created, claimsSet };
}
