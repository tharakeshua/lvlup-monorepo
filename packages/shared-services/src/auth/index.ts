import {
  Auth,
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  UserCredential,
} from "firebase/auth";
import { getFirebaseServices } from "../firebase";

/**
 * Auth Service
 * Provides a clean interface for Firebase Authentication operations
 */
export class AuthService {
  private _auth: Auth | null;

  constructor(auth?: Auth) {
    this._auth = auth ?? null;
  }

  private get auth(): Auth {
    if (!this._auth) {
      this._auth = getFirebaseServices().auth;
    }
    return this._auth;
  }

  /**
   * Sign in with email and password
   */
  async signIn(email: string, password: string): Promise<UserCredential> {
    return signInWithEmailAndPassword(this.auth, email, password);
  }

  /**
   * Create new user account
   */
  async signUp(email: string, password: string): Promise<UserCredential> {
    return createUserWithEmailAndPassword(this.auth, email, password);
  }

  /**
   * Sign out current user
   */
  async signOut(): Promise<void> {
    return firebaseSignOut(this.auth);
  }

  /**
   * Send password reset email
   */
  async resetPassword(email: string): Promise<void> {
    return sendPasswordResetEmail(this.auth, email);
  }

  /**
   * Update user profile (display name, photo URL)
   */
  async updateUserProfile(
    user: User,
    profile: { displayName?: string; photoURL?: string }
  ): Promise<void> {
    return updateProfile(user, profile);
  }

  /**
   * Get current authenticated user
   */
  getCurrentUser(): User | null {
    return this.auth.currentUser;
  }

  /**
   * Subscribe to auth state changes
   */
  onAuthStateChange(callback: (user: User | null) => void): () => void {
    return onAuthStateChanged(this.auth, callback);
  }

  /**
   * Sign in with Google via popup
   */
  async signInWithGoogle(): Promise<UserCredential> {
    const provider = new GoogleAuthProvider();
    return signInWithPopup(this.auth, provider);
  }

  /**
   * Get auth instance for advanced usage
   */
  getAuthInstance(): Auth {
    return this.auth;
  }
}

// Export singleton instance
export const authService = new AuthService();

// Tenant lookup & email derivation
export { lookupTenantByCode, deriveStudentEmail } from "./tenant-lookup";

// Cloud Function callable wrappers
export {
  callSwitchActiveTenant,
  callCreateOrgUser,
  callBulkImportStudents,
  callSaveParent,
  callSaveTenant,
  callSaveClass,
  callSaveStudent,
  callSaveTeacher,
  callSaveAcademicSession,
  callManageNotifications,
  callSaveSpace,
  callSaveStoryPoint,
  callSaveItem,
  callDeactivateTenant,
  callReactivateTenant,
  callExportTenantData,
  callSaveGlobalEvaluationPreset,
  callJoinTenant,
  callSearchUsers,
  callBulkImportTeachers,
  callBulkUpdateStatus,
  callRolloverSession,
  callSaveAnnouncement,
  callListAnnouncements,
  callSaveStaff,
  callUploadTenantAsset,
} from "./auth-callables";
export type {
  SwitchActiveTenantResponse,
  CreateOrgUserRequest,
  CreateOrgUserResponse,
  StudentImportRow,
  BulkImportStudentsRequest,
  BulkImportStudentsResponse,
  SaveGlobalPresetRequest,
  SaveGlobalPresetResponse,
  JoinTenantRequest,
  JoinTenantResponse,
} from "./auth-callables";
export type {
  TeacherImportRow,
  BulkImportTeachersRequest,
  BulkImportTeachersResponse,
  BulkUpdateStatusRequest,
  BulkUpdateStatusResponse,
  RolloverSessionRequest,
  RolloverSessionResponse,
} from "@levelup/shared-types";
export type { SaveParentRequest, SaveResponse } from "@levelup/shared-types";

// Membership queries
export { getUserMemberships, getMembership } from "./membership-service";
