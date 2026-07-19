import { create } from "zustand";
import { doc, onSnapshot } from "firebase/firestore";
import { User, getIdTokenResult } from "firebase/auth";
import type { UnifiedUser, UserMembership } from "@levelup/shared-types";
import {
  getFirebaseServices,
  authService,
  getUserMemberships,
  getMembership,
  lookupTenantByCode,
  deriveStudentEmail,
  callSwitchActiveTenant,
} from "@levelup/shared-services";

// ---------------------------------------------------------------------------
// Firebase Auth error code → user-friendly message
// ---------------------------------------------------------------------------
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  "auth/wrong-password": "Incorrect password. Please try again.",
  "auth/user-not-found": "No account found with this email.",
  "auth/invalid-email": "Please enter a valid email address.",
  "auth/too-many-requests": "Too many attempts. Please try again later.",
  "auth/invalid-credential": "Invalid email or password.",
  "auth/user-disabled": "This account has been disabled.",
  "auth/network-request-failed": "Network error. Please check your connection.",
};

function getAuthErrorMessage(err: unknown, fallback: string): string {
  // Only map Firebase Auth codes. ApiError/HttpsError also expose `code`
  // (e.g. PERMISSION_DENIED) — fall through to the Error message so callers
  // see the real failure instead of the generic fallback.
  if (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    typeof (err as { code: string }).code === "string"
  ) {
    const code = (err as { code: string }).code;
    const mapped = AUTH_ERROR_MESSAGES[code];
    if (mapped) return mapped;
  }
  if (err instanceof Error && err.message) return err.message;
  if (
    typeof err === "object" &&
    err !== null &&
    "message" in err &&
    typeof (err as { message: string }).message === "string" &&
    (err as { message: string }).message
  ) {
    return (err as { message: string }).message;
  }
  return fallback;
}

// ---------------------------------------------------------------------------
// State interface
// ---------------------------------------------------------------------------

export interface AuthState {
  user: UnifiedUser | null;
  firebaseUser: User | null;
  currentMembership: UserMembership | null;
  allMemberships: UserMembership[];
  currentTenantId: string | null;
  loading: boolean;
  error: string | null;

  // Actions
  initialize: () => () => void;
  login: (email: string, password: string) => Promise<void>;
  loginWithSchoolCode: (schoolCode: string, credential: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  switchTenant: (tenantId: string) => Promise<void>;
  loadMemberships: () => Promise<UserMembership[]>;
  refreshToken: () => Promise<void>;
  clearError: () => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  firebaseUser: null,
  currentMembership: null,
  allMemberships: [],
  currentTenantId: null,
  loading: true,
  error: null,

  // ------------------------------------------------------------------
  // initialize — subscribe to Firebase auth state; returns unsubscribe
  // ------------------------------------------------------------------
  initialize: () => {
    const { db } = getFirebaseServices();

    let userDocUnsub: (() => void) | null = null;

    const authUnsub = authService.onAuthStateChange(async (fbUser) => {
      // Clean up previous user doc listener
      userDocUnsub?.();
      userDocUnsub = null;

      if (!fbUser) {
        set({
          user: null,
          firebaseUser: null,
          currentMembership: null,
          allMemberships: [],
          currentTenantId: null,
          loading: false,
          error: null,
        });
        return;
      }

      set({ firebaseUser: fbUser, loading: true });

      try {
        // Listen to /users/{uid} in real-time
        userDocUnsub = onSnapshot(doc(db, "users", fbUser.uid), (snap) => {
          const userData = snap.exists() ? (snap.data() as UnifiedUser) : null;
          set({ user: userData });
        });

        // Load memberships
        const memberships = await getUserMemberships(fbUser.uid);
        set({ allMemberships: memberships });

        // Restore active tenant from token claims
        const tokenResult = await getIdTokenResult(fbUser);
        const claimTenantId = tokenResult.claims["tenantId"] as string | undefined;

        if (claimTenantId) {
          const membership = memberships.find((m) => m.tenantId === claimTenantId) ?? null;
          set({
            currentTenantId: claimTenantId,
            currentMembership: membership,
          });
        } else if (memberships.length === 1) {
          // Auto-select if only one membership
          const only = memberships[0]!;
          set({
            currentTenantId: only.tenantId,
            currentMembership: only,
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to initialise auth";
        set({ error: message });
      } finally {
        set({ loading: false });
      }
    });

    // Return combined cleanup
    return () => {
      authUnsub();
      userDocUnsub?.();
    };
  },

  // ------------------------------------------------------------------
  // login — standard email + password
  // ------------------------------------------------------------------
  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const cred = await authService.signIn(email, password);
      // Auth state observer will handle the rest
      set({ firebaseUser: cred.user });
    } catch (err) {
      const message = getAuthErrorMessage(err, "Login failed");
      set({ error: message, loading: false });
      throw err;
    }
  },

  // ------------------------------------------------------------------
  // loginWithSchoolCode — school code + roll number/email + password
  // ------------------------------------------------------------------
  loginWithSchoolCode: async (schoolCode, credential, password) => {
    set({ loading: true, error: null });
    try {
      // 1. Resolve tenant
      const tenant = await lookupTenantByCode(schoolCode);
      if (!tenant) throw new Error("Invalid school code");
      // Mirrors `evaluateTenantAccess` (@levelup/domain — the SSOT gate; not a
      // dep of this package): 'trial' has FULL access until trialEndsAt passes.
      if (tenant.status !== "active") {
        const t = tenant as { status?: string; trialEndsAt?: string | null };
        const trialActive =
          t.status === "trial" && !(t.trialEndsAt && Date.parse(t.trialEndsAt) <= Date.now());
        if (!trialActive) {
          throw new Error(
            t.status === "trial" || t.status === "expired"
              ? "This school's trial has ended. Please contact support to reactivate."
              : "School is not active"
          );
        }
      }

      // 2. Determine email — credential may be an email or a roll number
      const isEmail = credential.includes("@");
      const email = isEmail ? credential : deriveStudentEmail(credential, tenant.id);

      // 3. Sign in
      const cred = await authService.signIn(email, password);

      // 4. Prefer a membership the user actually holds for this school code.
      // Seed / v2_ index drift can make lookupTenantByCode resolve a ghost
      // tenantId with no membership doc → permission-denied noise.
      const code = schoolCode.trim().toUpperCase();
      const memberships = await getUserMemberships(cred.user.uid);
      const active = memberships.filter((m) => m.status === "active");
      // Prefer the looked-up tenant when the user has that membership — seed drift
      // leaves multiple GRN001 ghosts; the public code index is the intended tenant.
      const byLookup = active.find((m) => m.tenantId === tenant.id);
      const byCode = active.find((m) => (m.tenantCode || "").toUpperCase() === code);
      const membership = byLookup ?? byCode ?? (await getMembership(cred.user.uid, tenant.id));
      if (!membership || membership.status !== "active") {
        throw new Error("No active membership for this school");
      }
      const targetTenantId = membership.tenantId;

      // 5. Switch active tenant context (sets custom claims server-side)
      await callSwitchActiveTenant(targetTenantId);

      // 6. Force token refresh so client picks up new claims
      await cred.user.getIdToken(true);

      set({
        firebaseUser: cred.user,
        currentTenantId: targetTenantId,
        currentMembership: membership,
        allMemberships: memberships.length ? memberships : [membership],
      });
    } catch (err) {
      const message = getAuthErrorMessage(err, "School login failed");
      set({ error: message, loading: false });
      throw err;
    }
  },

  // ------------------------------------------------------------------
  // loginWithGoogle — OAuth popup flow
  // ------------------------------------------------------------------
  loginWithGoogle: async () => {
    set({ loading: true, error: null });
    try {
      const cred = await authService.signInWithGoogle();
      // Auth state observer will handle user doc + memberships
      set({ firebaseUser: cred.user });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Google login failed";
      set({ error: message, loading: false });
      throw err;
    }
  },

  // ------------------------------------------------------------------
  // logout
  // ------------------------------------------------------------------
  logout: async () => {
    set({ loading: true, error: null });
    try {
      await authService.signOut();
      // Auth state observer will clear state
    } catch (err) {
      const message = err instanceof Error ? err.message : "Logout failed";
      set({ error: message, loading: false });
    }
  },

  // ------------------------------------------------------------------
  // switchTenant
  // ------------------------------------------------------------------
  switchTenant: async (tenantId) => {
    set({ loading: true, error: null });
    try {
      const { firebaseUser, allMemberships } = get();
      if (!firebaseUser) throw new Error("Not authenticated");

      const membership = allMemberships.find((m) => m.tenantId === tenantId) ?? null;
      if (!membership) throw new Error("No membership for this tenant");

      // Call Cloud Function to update claims
      await callSwitchActiveTenant(tenantId);

      // Refresh token
      await firebaseUser.getIdToken(true);

      set({
        currentTenantId: tenantId,
        currentMembership: membership,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to switch tenant";
      set({ error: message });
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  // ------------------------------------------------------------------
  // loadMemberships
  // ------------------------------------------------------------------
  loadMemberships: async () => {
    const { firebaseUser } = get();
    if (!firebaseUser) return [];

    const memberships = await getUserMemberships(firebaseUser.uid);
    set({ allMemberships: memberships });
    return memberships;
  },

  // ------------------------------------------------------------------
  // refreshToken
  // ------------------------------------------------------------------
  refreshToken: async () => {
    const { firebaseUser } = get();
    if (!firebaseUser) return;
    await firebaseUser.getIdToken(true);
  },

  // ------------------------------------------------------------------
  // clearError
  // ------------------------------------------------------------------
  clearError: () => set({ error: null }),
}));

// ---------------------------------------------------------------------------
// Convenience selectors (hook wrappers)
// ---------------------------------------------------------------------------

export const useCurrentUser = () => useAuthStore((s) => s.user);
export const useCurrentMembership = () => useAuthStore((s) => s.currentMembership);
export const useIsAuthenticated = () => useAuthStore((s) => s.firebaseUser !== null);
export const useUserRole = () => useAuthStore((s) => s.currentMembership?.role ?? null);
export const useCurrentTenantId = () => useAuthStore((s) => s.currentTenantId);
export const useIsConsumer = () =>
  useAuthStore((s) => s.firebaseUser !== null && s.allMemberships.length === 0);
