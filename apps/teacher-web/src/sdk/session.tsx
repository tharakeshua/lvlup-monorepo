/**
 * App-local auth/session context for teacher-web.
 *
 * Replaces the legacy shared-stores `useAuthStore` + `useTenantStore`
 * (both direct-Firestore) with a thin context composed over the SDK:
 *   • sign-in/out via the firebase auth handle (`@levelup/transport-firebase`),
 *   • memberships / active tenant / role / profile via `useMe()` (the collapsed
 *     `getMe` bootstrap view from `@levelup/query`),
 *   • multi-tenant school-code login + tenant switch via `meRepo`/`tenantRepo`.
 *
 * It deliberately preserves the legacy auth-store SHAPE (`firebaseUser`,
 * `currentMembership`, `allMemberships`, `currentTenantId`, `currentTenantName`,
 * `loading`, `error`, `login`, `loginWithSchoolCode`, `logout`, `switchTenant`,
 * `clearError`) so consuming pages swap only the import + hook name.
 *
 * `useAuthSession(selector?)` mirrors the old `useAuthStore(selector?)` call shapes:
 *   useAuthSession()                  → whole value (destructure)
 *   useAuthSession((s) => s.field)    → selected field
 */
import { useMe, resetForTenantSwitch, useApi } from "@levelup/query";
import { evaluateTenantAccess } from "@levelup/domain";
import { createFirebaseAuthHandle, type FirebaseAuthHandle } from "@levelup/transport-firebase";
import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { getFirebaseServices } from "./firebase";

// ── Loosely-typed views over the `getMe` bootstrap (read defensively) ──────────
interface MembershipLike {
  id: string;
  uid: string;
  tenantId: string;
  tenantCode: string;
  role: string;
  status: string;
}
interface UnifiedUserLike {
  uid: string;
  email?: string;
  displayName: string;
  activeTenantId?: string;
  [k: string]: unknown;
}
interface GetMeLike {
  user: UnifiedUserLike;
  memberships: MembershipLike[];
  claims?: { tenantId?: string; role?: string } | null;
  activeTenant?: { id?: string; name?: string } | null;
}
interface FirebaseUserLike {
  uid: string;
  email?: string;
  displayName?: string;
}

export interface AuthSessionValue {
  user: UnifiedUserLike | null;
  firebaseUser: FirebaseUserLike | null;
  currentMembership: MembershipLike | null;
  allMemberships: MembershipLike[];
  currentTenantId: string | null;
  currentTenantName: string | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  loginWithSchoolCode: (schoolCode: string, credential: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  switchTenant: (tenantId: string) => Promise<void>;
  clearError: () => void;
}

// ── Friendly Firebase Auth error messages (ported from the legacy store) ───────
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  "auth/wrong-password": "Incorrect password. Please try again.",
  "auth/user-not-found": "No account found with this email.",
  "auth/invalid-email": "Please enter a valid email address.",
  "auth/too-many-requests": "Too many attempts. Please try again later.",
  "auth/invalid-credential": "Invalid email or password.",
  "auth/user-disabled": "This account has been disabled.",
  "auth/network-request-failed": "Network error. Please check your connection.",
};
function authErrorMessage(err: unknown, fallback: string): string {
  if (
    err &&
    typeof err === "object" &&
    "code" in err &&
    typeof (err as { code: unknown }).code === "string"
  ) {
    return AUTH_ERROR_MESSAGES[(err as { code: string }).code] ?? fallback;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

// Minimal repo surface this context drives imperatively.
interface SessionRepos {
  tenantRepo: {
    lookupByCode(code: string): Promise<{ tenantId: string; name: string; status: string } | null>;
  };
  meRepo: { switchTenant(targetTenantId: string): Promise<unknown> };
}

const SessionContext = createContext<AuthSessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const handleRef = useRef<FirebaseAuthHandle>();
  if (!handleRef.current) {
    handleRef.current = createFirebaseAuthHandle(getFirebaseServices().auth);
  }
  const handle = handleRef.current;

  const { repos } = useApi();
  const sessionRepos = repos as unknown as SessionRepos;
  const qc = useQueryClient();

  const [firebaseUser, setFirebaseUser] = useState<FirebaseUserLike | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reactive firebase auth state — the single source of "is someone signed in".
  useEffect(() => {
    const unsub = handle.onAuthState((snap) => {
      setFirebaseUser(
        snap
          ? {
              uid: snap.uid,
              email: snap.email ?? undefined,
              displayName: snap.displayName ?? undefined,
            }
          : null
      );
      setAuthLoading(false);
    });
    return unsub;
  }, [handle]);

  // Identity bootstrap (user + memberships + claims + activeTenant). Only meaningful
  // once authed; pre-auth it resolves to UNAUTHENTICATED → isError (degrade to null).
  const meQuery = useMe();
  const me = (firebaseUser ? (meQuery.data as GetMeLike | undefined) : undefined) ?? undefined;

  const allMemberships = me?.memberships ?? [];
  const currentTenantId = me?.claims?.tenantId ?? me?.user?.activeTenantId ?? null;
  const currentMembership = currentTenantId
    ? (allMemberships.find((m) => m.tenantId === currentTenantId) ?? null)
    : allMemberships.length === 1
      ? allMemberships[0]!
      : null;
  const currentTenantName = me?.activeTenant?.name ?? null;
  const user = me?.user ?? null;

  const loading = authLoading || (!!firebaseUser && meQuery.isLoading);

  const login = useCallback(
    async (email: string, password: string) => {
      setError(null);
      try {
        await handle.signIn(email, password);
        await qc.invalidateQueries();
      } catch (e) {
        setError(authErrorMessage(e, "Login failed"));
        throw e;
      }
    },
    [handle, qc]
  );

  const loginWithSchoolCode = useCallback(
    async (schoolCode: string, credential: string, password: string) => {
      setError(null);
      try {
        const tenant = await sessionRepos.tenantRepo.lookupByCode(schoolCode.trim());
        if (!tenant) throw new Error("Invalid school code");
        const access = evaluateTenantAccess(tenant);
        if (!access.allowed) {
          throw new Error(
            access.reason === "trial_expired"
              ? "This school's trial has ended. Please contact your administrator to reactivate."
              : "This school is currently inactive."
          );
        }

        // Teachers/staff sign in with email (roll-number derivation is student-only).
        const email = credential.trim();
        await handle.signIn(email, password);

        // Set the active-tenant claims server-side, then force a fresh ID token
        // (meRepo.switchTenant calls api.refreshToken) before refetching getMe.
        await sessionRepos.meRepo.switchTenant(tenant.tenantId);
        await qc.invalidateQueries();
      } catch (e) {
        setError(authErrorMessage(e, "School login failed"));
        throw e;
      }
    },
    [handle, qc, sessionRepos]
  );

  const logout = useCallback(async () => {
    setError(null);
    try {
      await handle.signOut();
      resetForTenantSwitch(qc);
    } catch (e) {
      setError(authErrorMessage(e, "Logout failed"));
    }
  }, [handle, qc]);

  const switchTenant = useCallback(
    async (tenantId: string) => {
      setError(null);
      try {
        await sessionRepos.meRepo.switchTenant(tenantId);
        resetForTenantSwitch(qc);
      } catch (e) {
        setError(authErrorMessage(e, "Failed to switch tenant"));
        throw e;
      }
    },
    [qc, sessionRepos]
  );

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo<AuthSessionValue>(
    () => ({
      user,
      firebaseUser,
      currentMembership,
      allMemberships,
      currentTenantId,
      currentTenantName,
      loading,
      error,
      login,
      loginWithSchoolCode,
      logout,
      switchTenant,
      clearError,
    }),
    [
      user,
      firebaseUser,
      currentMembership,
      allMemberships,
      currentTenantId,
      currentTenantName,
      loading,
      error,
      login,
      loginWithSchoolCode,
      logout,
      switchTenant,
      clearError,
    ]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

/**
 * Read the auth session. Mirrors the legacy `useAuthStore(selector?)`:
 *   useAuthSession()               → whole value
 *   useAuthSession((s) => s.field) → selected slice
 */
export function useAuthSession(): AuthSessionValue;
export function useAuthSession<T>(selector: (s: AuthSessionValue) => T): T;
export function useAuthSession<T>(selector?: (s: AuthSessionValue) => T): T | AuthSessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useAuthSession must be used within <SessionProvider>");
  return selector ? selector(ctx) : ctx;
}
