/**
 * App-local auth/session context for admin-web.
 *
 * Wraps Firebase Auth (the only client auth seam) for sign-in/out and exposes the
 * reactive session PLUS the parsed custom claims. After sign-in the ID token
 * carries the user's claims (role + tenantId, minted by the seed), which the
 * transport auto-forwards on every callable — so server-side tenant scoping needs
 * no explicit `tenantId` argument from pages. Richer membership/profile hydration
 * comes from `useMe()` (see `./identity`).
 *
 * This file (under `src/sdk/`) is allowed to import `firebase/*` directly; pages
 * and app hooks must not.
 */
import {
  getIdTokenResult,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  type User,
} from "firebase/auth";
import { evaluateTenantAccess } from "@levelup/domain";
import { resetForTenantSwitch } from "@levelup/query";
import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { getSdk } from "./api";
import { getFirebaseServices } from "./firebase";

/** Parsed identity claims off the ID token (seed-minted). */
export interface SessionClaims {
  tenantId: string | null;
  role: string | null;
  isSuperAdmin: boolean;
}

export interface SessionState {
  user: User | null;
  claims: SessionClaims | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  loginWithSchoolCode: (schoolCode: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const FRIENDLY_AUTH_ERRORS: Record<string, string> = {
  "auth/wrong-password": "Incorrect password. Please try again.",
  "auth/user-not-found": "No account found with this email.",
  "auth/invalid-email": "Please enter a valid email address.",
  "auth/too-many-requests": "Too many attempts. Please try again later.",
  "auth/invalid-credential": "Invalid email or password.",
  "auth/user-disabled": "This account has been disabled.",
  "auth/network-request-failed": "Network error. Please check your connection.",
};

function friendlyAuthError(err: unknown, fallback: string): string {
  if (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    typeof (err as { code: string }).code === "string"
  ) {
    const code = (err as { code: string }).code;
    const mapped = FRIENDLY_AUTH_ERRORS[code];
    if (mapped) return mapped;
  }
  if (err instanceof Error && err.message && err.message !== "internal") return err.message;
  if (
    err &&
    typeof err === "object" &&
    "message" in err &&
    typeof (err as { message: unknown }).message === "string" &&
    (err as { message: string }).message &&
    (err as { message: string }).message !== "internal"
  ) {
    return (err as { message: string }).message;
  }
  return fallback;
}

function parseClaims(raw: Record<string, unknown>): SessionClaims {
  const tenantId =
    (raw.tenantId as string | undefined) ?? (raw.currentTenantId as string | undefined) ?? null;
  const role = (raw.role as string | undefined) ?? null;
  const isSuperAdmin = raw.isSuperAdmin === true || role === "superAdmin" || role === "super_admin";
  return { tenantId, role, isSuperAdmin };
}

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const { auth } = getFirebaseServices();
  const { repos } = getSdk();
  const qc = useQueryClient();
  const meRepo = repos.meRepo as {
    get(): Promise<{
      memberships?: Array<{ tenantId: string; tenantCode?: string; status: string }>;
    }>;
    switchTenant(targetTenantId: string): Promise<unknown>;
  };
  const tenantRepo = repos.tenantRepo as {
    lookupByCode(code: string): Promise<{ tenantId: string; name: string; status: string } | null>;
  };

  const [user, setUser] = useState<User | null>(null);
  const [claims, setClaims] = useState<SessionClaims | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        setUser(null);
        setClaims(null);
        setLoading(false);
        return;
      }
      setUser(fbUser);
      try {
        const token = await getIdTokenResult(fbUser);
        setClaims(parseClaims(token.claims as Record<string, unknown>));
      } catch {
        setClaims({ tenantId: null, role: null, isSuperAdmin: false });
      }
      setLoading(false);
    });
    return unsub;
  }, [auth]);

  const login = useCallback(
    async (email: string, password: string) => {
      setError(null);
      try {
        await signInWithEmailAndPassword(auth, email, password);
      } catch (e) {
        const msg = friendlyAuthError(e, "Sign-in failed");
        setError(msg);
        throw e;
      }
    },
    [auth]
  );

  const loginWithSchoolCode = useCallback(
    async (schoolCode: string, email: string, password: string) => {
      setError(null);
      try {
        const tenant = await tenantRepo.lookupByCode(schoolCode.trim());
        if (!tenant) throw new Error("Invalid school code");
        const access = evaluateTenantAccess(tenant);
        if (!access.allowed) {
          throw new Error(
            access.reason === "trial_expired"
              ? "This school's trial has ended. Please contact your administrator to reactivate."
              : "This school is currently inactive."
          );
        }

        await signInWithEmailAndPassword(auth, email, password);

        let targetTenantId = tenant.tenantId;
        try {
          const me = await meRepo.get();
          const code = schoolCode.trim().toUpperCase();
          const active = (me.memberships ?? []).filter((m) => m.status === "active");
          const byCode = active.find((m) => (m.tenantCode || "").toUpperCase() === code);
          if (byCode) targetTenantId = byCode.tenantId;
        } catch {
          // keep lookup tenantId
        }

        await meRepo.switchTenant(targetTenantId);
        resetForTenantSwitch(qc);
      } catch (e) {
        const msg = friendlyAuthError(e, "School login failed");
        setError(msg);
        throw e;
      }
    },
    [auth, meRepo, qc, tenantRepo]
  );

  const logout = useCallback(async () => {
    await fbSignOut(auth);
  }, [auth]);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo<SessionState>(
    () => ({ user, claims, loading, error, login, loginWithSchoolCode, logout, clearError }),
    [user, claims, loading, error, login, loginWithSchoolCode, logout, clearError]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within <SessionProvider>");
  return ctx;
}
