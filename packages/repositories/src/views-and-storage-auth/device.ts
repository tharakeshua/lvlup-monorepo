/**
 * `deviceRepo` (C4 — SDK-LAYERS-PLAN §9.1 C4, §4.3). Device-token registration
 * for push (Expo/FCM). Backed by the CF-only doc
 * `tenants/{t}/users/{uid}/devices/{token}`; the client never touches it
 * directly — it drives the `v1.identity.registerDeviceToken` /
 * `unregisterDeviceToken` callables. `emitNotificationService` fans these tokens
 * out to FCM/Expo (UC-10).
 *
 * **Never optimistic** (§4.3: `registerDeviceToken/unregisterDeviceToken→{device}`
 * invalidation, not a cache flip). `canRegister` is the one pure pre-check
 * (non-empty token) for UX gating.
 */
import type {
  ApiClientSeam,
  RegisterDeviceTokenInput,
  UnregisterDeviceTokenInput,
  DeviceTokenResponse,
} from "./seam.js";

export interface DeviceRepo {
  register(input: RegisterDeviceTokenInput): Promise<DeviceTokenResponse>;
  unregister(input: UnregisterDeviceTokenInput): Promise<DeviceTokenResponse>;
  /** Pure UX pre-check — a non-empty token is required. No wire call. */
  canRegister(input: Pick<RegisterDeviceTokenInput, "token">): boolean;
}

export function createDeviceRepo(api: ApiClientSeam): DeviceRepo {
  return {
    register: (input) => api.identity.registerDeviceToken(input),
    unregister: (input) => api.identity.unregisterDeviceToken(input),
    canRegister: (input) => input.token.trim().length > 0,
  };
}
