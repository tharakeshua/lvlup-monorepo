/**
 * App-local auth/session context.
 *
 * Wraps the firebase auth handle (the only client auth seam) for sign-in/out and
 * exposes the reactive session. After sign-in the ID token carries the user's
 * custom claims (role + tenantId, minted by the seed), which the transport
 * auto-forwards on every callable — so server-side authority needs no extra
 * client bootstrap for reads. Richer profile/membership hydration via `useMe`
 * (bootstrap callable) lands when the Home/Profile screens are wired.
 */
import {
  createFirebaseAuthHandle,
  type AuthUserSnapshot,
  type FirebaseAuthHandle,
} from "@levelup/transport-firebase";
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

export interface SessionState {
  user: AuthUserSnapshot | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const handleRef = useRef<FirebaseAuthHandle>();
  if (!handleRef.current) {
    handleRef.current = createFirebaseAuthHandle(getFirebaseServices().auth);
  }
  const handle = handleRef.current;

  const [user, setUser] = useState<AuthUserSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = handle.onAuthState((snap: AuthUserSnapshot | null) => {
      setUser(snap);
      setLoading(false);
    });
    return unsub;
  }, [handle]);

  const login = useCallback(
    async (email: string, password: string) => {
      setError(null);
      try {
        await handle.signIn(email, password);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Sign-in failed";
        setError(msg);
        throw e;
      }
    },
    [handle]
  );

  const logout = useCallback(async () => {
    await handle.signOut();
  }, [handle]);

  // Dev/test-only auto-login (env-gated; inert unless the EXPO_PUBLIC_AUTOLOGIN_*
  // vars are set). Used by the simulator visual-capture flow to sign in without
  // UI typing. No effect on normal builds.
  const autoEmail = process.env.EXPO_PUBLIC_AUTOLOGIN_EMAIL;
  const autoPassword = process.env.EXPO_PUBLIC_AUTOLOGIN_PASSWORD;
  useEffect(() => {
    if (autoEmail && autoPassword && !loading && !user) {
      void login(autoEmail, autoPassword).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, autoEmail, autoPassword]);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo<SessionState>(
    () => ({ user, loading, error, login, logout, clearError }),
    [user, loading, error, login, logout, clearError]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within <SessionProvider>");
  return ctx;
}
