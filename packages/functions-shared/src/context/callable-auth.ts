/**
 * Minimal structural shape of the callable `request.auth` (firebase-functions v2
 * `CallableRequest['auth']`). Declared structurally so `buildAuthContext` is
 * testable without constructing a real `CallableRequest`.
 */
export interface AuthInfo {
  uid: string;
  token: Record<string, unknown> & { uid?: string };
}
