/**
 * Structural api-client / transport-seam slice the `views-and-storage-auth`
 * repos consume (SDK-LAYERS-PLAN §3.7 Storage seam C1; §9 C3 Auth seam; §9 C4
 * device-token; §9 C22 avatar upload).
 *
 * Repos import `@levelup/api-client` + `@levelup/domain` ONLY. The Storage and
 * Auth seams are NOT plain callables — they are transport-level capabilities the
 * api-client re-exposes (`StorageTransport`, the auth-handle). Those seams are
 * being added to `@levelup/api-client` + `@levelup/transport-firebase` in the
 * same parallel wave; this file pins the plan-specified public surface so this
 * domain typechecks against the declared shape and the typecheck/fix wave
 * reconciles field-level drift.
 *
 * `StoragePath` is a server-scoped object path string (`tenants/{t}/…`,
 * §3.7 path grammar). The domain may later brand it; here it stays a plain
 * `string` so the seam is forward-compatible.
 */
import type { ExamId, StudentId, ClassId, UserId } from "@levelup/domain";

// ---------------------------------------------------------------------------
// Storage seam (C1 — MERGE-C9-ORPHANED §3.7). Canonical mechanism: signed PUT
// URL. The ONLY client Storage site is `@levelup/transport-firebase`; the repo
// drives it through the api-client's `storage` capability.
// ---------------------------------------------------------------------------

/** Server-scoped Storage object path (`tenants/{t}/…`). */
export type StoragePath = string;

/** Upload kinds the signed-URL grant supports (§3.7 path grammar + predicates). */
export type UploadKind = "answer-sheet" | "question-paper" | "avatar" | "tenant-asset";

/**
 * `requestUploadUrl` input. Mirrors `v1.autograde.requestUploadUrl` for the exam
 * kinds plus the identity avatar/tenant-asset kinds (§3.7). `tenantId` is NEVER
 * present (claim-derived server-side); the server pins the path scope, TTL ≤10m,
 * `contentType` + max-bytes at sign time.
 */
export interface RequestUploadUrlInput {
  kind: UploadKind;
  contentType: string;
  examId?: ExamId | string;
  studentId?: StudentId | string;
  classId?: ClassId | string;
}

/** Signed-PUT-URL grant returned by the server (§3.7). */
export interface UploadUrlGrant {
  uploadUrl: string;
  path: StoragePath;
  expiresAt: string;
}

/** Bytes accepted by the signed-PUT upload (web `Blob`/RN `Uint8Array`/base64). */
export type UploadBody = Blob | Uint8Array | ArrayBuffer | string;

/**
 * The Storage capability the api-client re-exposes over the transport's
 * `StorageTransport` (the only client firebase/storage site lives in
 * transport-firebase). `requestUploadUrl` invokes the signing callable;
 * `upload` PUTs bytes to the signed URL (no Firestore, no auth decision here).
 */
export interface StorageCapability {
  requestUploadUrl(input: RequestUploadUrlInput): Promise<UploadUrlGrant>;
  upload(uploadUrl: string, body: UploadBody, contentType: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Auth seam (C3 — §9.2 / UC-4). Wraps Firebase Auth on the transport handle so
// NO app imports `firebase/auth` (R7). Server already covers beforeSignIn /
// beforeUserCreated; this is the client sign-in/out/reset/restore surface.
// ---------------------------------------------------------------------------

/** The resolved session after a successful sign-in / restore. */
export interface AuthSession {
  uid: UserId | string;
  email?: string;
  displayName?: string;
  /** True once email verification (or equivalent) has cleared. */
  emailVerified?: boolean;
}

export interface SignInInput {
  email: string;
  password: string;
}

/** Unsubscribe handle for an auth-state listener. */
export interface AuthStateHandle {
  unsubscribe(): void;
}

/**
 * The Auth capability the api-client re-exposes over the transport auth-handle.
 * No callables (C3 is explicitly NOT a callable surface) — pure transport seam.
 */
export interface AuthCapability {
  signIn(input: SignInInput): Promise<AuthSession>;
  signOut(): Promise<void>;
  sendPasswordReset(email: string): Promise<void>;
  /** Resolve the persisted session on boot (`null` when signed-out). */
  restoreSession(): Promise<AuthSession | null>;
  /** Reactive auth-state stream (sign-in/out, token refresh). */
  onAuthState(cb: (session: AuthSession | null) => void): AuthStateHandle;
}

// ---------------------------------------------------------------------------
// Identity callables this domain invokes directly (C4 device-token, C22 avatar).
// ---------------------------------------------------------------------------

/** `v1.identity.registerDeviceToken` (C4). */
export interface RegisterDeviceTokenInput {
  token: string;
  platform: "ios" | "android" | "web";
  appKey: string;
}
export interface UnregisterDeviceTokenInput {
  token: string;
}
export interface DeviceTokenResponse {
  ok: boolean;
}

/** `v1.identity.uploadUserAsset` avatar (C22). */
export interface UploadUserAssetInput {
  kind: "avatar";
  contentType: string;
  bytesBase64: string;
}
export interface UploadUserAssetResponse {
  assetUrl: string;
}

type Callable<Req, Res> = (req: Req) => Promise<Res>;

/** The identity namespace slice this domain invokes (permissive tail). */
export interface IdentitySeam {
  registerDeviceToken: Callable<RegisterDeviceTokenInput, DeviceTokenResponse>;
  unregisterDeviceToken: Callable<UnregisterDeviceTokenInput, DeviceTokenResponse>;
  uploadUserAsset: Callable<UploadUserAssetInput, UploadUserAssetResponse>;
  [op: string]: (req: never) => Promise<unknown>;
}

/**
 * The structural slice of `ApiClient` the storage/auth/device repos consume. The
 * real client (a superset that also carries `levelup`/`autograde`/`analytics`
 * namespaces, `subscribe`, `refreshToken`, and the `storage`/`auth` capability
 * seams) is assignable to this view.
 */
export interface ApiClientSeam {
  identity: IdentitySeam;
  storage: StorageCapability;
  auth: AuthCapability;
}
