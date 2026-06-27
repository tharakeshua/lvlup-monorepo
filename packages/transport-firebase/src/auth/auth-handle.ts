/**
 * `FirebaseAuthHandle` — the auth seam backing `authRepo` (transport-realtime.md §0
 * / PLAN §3.7 auth-handle seam). This is the ONLY client-side place
 * `firebase/auth`'s sign-in/out/reset/state primitives are wrapped, mirroring the
 * single-Firestore-source rule for the read/write path.
 *
 * The repository layer (`@levelup/repositories` `authRepo`) consumes this handle; it
 * never imports `firebase/auth` itself. The handle deliberately exposes a thin,
 * platform-neutral surface (no firebase types leak past `AuthUserSnapshot`) so the
 * future `transport-http` can supply a structurally identical handle.
 */
import {
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type Auth,
  type User,
} from "firebase/auth";

/** Platform-neutral snapshot of the signed-in user (no raw firebase `User` leak). */
export interface AuthUserSnapshot {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
}

export interface SignInResult {
  user: AuthUserSnapshot;
}

/** The thin auth seam `authRepo` is built on. */
export interface FirebaseAuthHandle {
  /** Email/password sign-in. Errors rethrow unchanged (api-client/repos normalize). */
  signIn(email: string, password: string): Promise<SignInResult>;
  /** Sign the current user out. */
  signOut(): Promise<void>;
  /** Send a password-reset email. */
  sendPasswordReset(email: string): Promise<void>;
  /**
   * Subscribe to auth-state changes. `cb` fires with the current snapshot (or null
   * when signed out). Returns an unsubscriber.
   */
  onAuthState(cb: (user: AuthUserSnapshot | null) => void): () => void;
  /** The current user snapshot, or null when signed out. */
  currentUser(): AuthUserSnapshot | null;
}

function toSnapshot(user: User | null): AuthUserSnapshot | null {
  if (!user) return null;
  return {
    uid: user.uid,
    email: user.email,
    emailVerified: user.emailVerified,
    displayName: user.displayName,
  };
}

export function createFirebaseAuthHandle(auth: Auth): FirebaseAuthHandle {
  return {
    async signIn(email, password) {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      return { user: toSnapshot(cred.user)! };
    },
    async signOut() {
      await firebaseSignOut(auth);
    },
    async sendPasswordReset(email) {
      await sendPasswordResetEmail(auth, email);
    },
    onAuthState(cb) {
      return onAuthStateChanged(auth, (user) => cb(toSnapshot(user)));
    },
    currentUser() {
      return toSnapshot(auth.currentUser);
    },
  };
}
