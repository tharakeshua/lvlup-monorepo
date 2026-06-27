/**
 * `views-and-storage-auth` domain factory — `createViewsStorageAuthRepos(api)`
 * (SDK-LAYERS-PLAN §4.1; §3.7 C1 Storage seam; §9 C3 Auth seam, C4 device-token,
 * C22 avatar).
 *
 * This domain owns the cross-cutting **transport-seam** repos that are NOT plain
 * per-entity callable repos and are owned by no other domain agent:
 *   • `storageRepo`     (C1) — signed-PUT-URL Storage seam (the only client
 *                              Storage site lives in transport-firebase).
 *   • `authRepo`        (C3) — Firebase-Auth transport-handle seam (keeps apps
 *                              off `firebase/auth`, R7).
 *   • `deviceRepo`      (C4) — push device-token register/unregister.
 *   • `meAssetRepo`     (C22) — self-owned avatar upload (folds onto the
 *                              identity-owned `meRepo` in the typecheck/fix wave).
 *
 * Repos import `@levelup/api-client` + `@levelup/domain` ONLY (here via the
 * structural `ApiClientSeam` slice in `./seam`). They never compose sibling
 * repos. The 'identity' agent owns the top-level `createRepositories` assembly in
 * `../index.ts`; this domain exports a factory it spreads (parallel-wave
 * contract).
 */
import type { ApiClientSeam } from "./seam.js";
import { createStorageRepo, type StorageRepo } from "./storage.js";
import { createAuthRepo, type AuthRepo } from "./auth.js";
import { createDeviceRepo, type DeviceRepo } from "./device.js";
import { createMeAssetRepo, type MeAssetRepo } from "./me-asset.js";

export interface ViewsStorageAuthRepos {
  storageRepo: StorageRepo;
  authRepo: AuthRepo;
  deviceRepo: DeviceRepo;
  meAssetRepo: MeAssetRepo;
}

export function createViewsStorageAuthRepos(api: ApiClientSeam): ViewsStorageAuthRepos {
  return {
    storageRepo: createStorageRepo(api),
    authRepo: createAuthRepo(api),
    deviceRepo: createDeviceRepo(api),
    meAssetRepo: createMeAssetRepo(api),
  };
}

export type { ApiClientSeam } from "./seam.js";
export type {
  StoragePath,
  UploadKind,
  RequestUploadUrlInput,
  UploadUrlGrant,
  UploadBody,
  StorageCapability,
  AuthSession,
  SignInInput,
  AuthStateHandle,
  AuthCapability,
  RegisterDeviceTokenInput,
  UnregisterDeviceTokenInput,
  DeviceTokenResponse,
  UploadUserAssetInput,
  UploadUserAssetResponse,
} from "./seam.js";
export { createStorageRepo, type StorageRepo, type UploadImageInput } from "./storage.js";
export { createAuthRepo, type AuthRepo } from "./auth.js";
export { createDeviceRepo, type DeviceRepo } from "./device.js";
export { createMeAssetRepo, type MeAssetRepo, type UploadAvatarInput } from "./me-asset.js";
