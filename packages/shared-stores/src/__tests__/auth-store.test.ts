/**
 * Unit tests for auth-store.ts
 * Mocks Firebase Auth, Firestore, and shared-services to test auth state management.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock setup
// ---------------------------------------------------------------------------

const mockGetIdToken = vi.fn().mockResolvedValue('token');
const mockFirebaseUser = {
  uid: 'user-1',
  email: 'test@test.com',
  getIdToken: mockGetIdToken,
};

let authStateCallback: ((user: any) => void) | null = null;
const _callbacks: { userDoc: ((snap: any) => void) | null } = { userDoc: null };
const mockAuthUnsub = vi.fn();
const mockUserDocUnsub = vi.fn();

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  onSnapshot: vi.fn((_ref: any, onNext: any) => {
    _callbacks.userDoc = onNext;
    return mockUserDocUnsub;
  }),
}));

vi.mock('firebase/auth', () => ({
  getIdTokenResult: vi.fn().mockResolvedValue({
    claims: {},
  }),
}));

const mockSignIn = vi.fn();
const mockSignInWithGoogle = vi.fn();
const mockSignOut = vi.fn();
const mockOnAuthStateChange = vi.fn((cb: any) => {
  authStateCallback = cb;
  return mockAuthUnsub;
});

vi.mock('@levelup/shared-services', () => ({
  getFirebaseServices: vi.fn(() => ({
    db: { type: 'firestore' },
  })),
  authService: {
    signIn: (...args: unknown[]) => mockSignIn(...(args as [any])),
    signInWithGoogle: (...args: unknown[]) => mockSignInWithGoogle(...(args as [any])),
    signOut: (...args: unknown[]) => mockSignOut(...(args as [any])),
    onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...(args as [any])),
  },
  getUserMemberships: vi.fn().mockResolvedValue([]),
  getMembership: vi.fn().mockResolvedValue(null),
  lookupTenantByCode: vi.fn().mockResolvedValue(null),
  deriveStudentEmail: vi.fn((roll: string, tenantId: string) => `${roll}@${tenantId}.levelup.internal`),
  callSwitchActiveTenant: vi.fn().mockResolvedValue({ success: true, role: 'student' }),
}));

import { getIdTokenResult } from 'firebase/auth';
import { useAuthStore } from '../auth-store';
import {
  getUserMemberships,
  getMembership,
  lookupTenantByCode,
  callSwitchActiveTenant,
} from '@levelup/shared-services';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getState() {
  return useAuthStore.getState();
}

function resetStore() {
  useAuthStore.setState({
    user: null,
    firebaseUser: null,
    currentMembership: null,
    allMemberships: [],
    currentTenantId: null,
    loading: true,
    error: null,
  });
}

const mockMembership = (tenantId: string, role = 'student') => ({
  uid: 'user-1',
  tenantId,
  tenantCode: 'TST',
  role,
  status: 'active' as const,
  joinSource: 'admin_created',
  createdAt: new Date(),
  updatedAt: new Date(),
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('auth-store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authStateCallback = null;
    _callbacks.userDoc = null;
    resetStore();
  });

  // -------------------------------------------------------------------------
  // Initial state
  // -------------------------------------------------------------------------

  it('has correct initial state', () => {
    const state = getState();
    expect(state.user).toBeNull();
    expect(state.firebaseUser).toBeNull();
    expect(state.currentMembership).toBeNull();
    expect(state.allMemberships).toEqual([]);
    expect(state.currentTenantId).toBeNull();
    expect(state.loading).toBe(true);
    expect(state.error).toBeNull();
  });

  // -------------------------------------------------------------------------
  // login
  // -------------------------------------------------------------------------

  describe('login', () => {
    it('calls authService.signIn and sets firebaseUser on success', async () => {
      mockSignIn.mockResolvedValueOnce({ user: mockFirebaseUser });

      await getState().login('test@test.com', 'password');

      expect(mockSignIn).toHaveBeenCalledWith('test@test.com', 'password');
      expect(getState().firebaseUser).toBe(mockFirebaseUser);
    });

    it('sets loading true during login', async () => {
      mockSignIn.mockImplementationOnce(() => {
        expect(getState().loading).toBe(true);
        return Promise.resolve({ user: mockFirebaseUser });
      });

      await getState().login('test@test.com', 'password');
    });

    it('sets error and re-throws on failure', async () => {
      mockSignIn.mockRejectedValueOnce(new Error('Invalid credentials'));

      await expect(
        getState().login('bad@test.com', 'wrong'),
      ).rejects.toThrow('Invalid credentials');

      expect(getState().error).toBe('Invalid credentials');
      expect(getState().loading).toBe(false);
    });

    it('clears previous error on new login attempt', async () => {
      useAuthStore.setState({ error: 'Old error' });
      mockSignIn.mockResolvedValueOnce({ user: mockFirebaseUser });

      await getState().login('test@test.com', 'password');

      expect(getState().error).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // loginWithGoogle
  // -------------------------------------------------------------------------

  describe('loginWithGoogle', () => {
    it('calls authService.signInWithGoogle and sets firebaseUser', async () => {
      mockSignInWithGoogle.mockResolvedValueOnce({ user: mockFirebaseUser });

      await getState().loginWithGoogle();

      expect(mockSignInWithGoogle).toHaveBeenCalled();
      expect(getState().firebaseUser).toBe(mockFirebaseUser);
    });

    it('sets error on failure', async () => {
      mockSignInWithGoogle.mockRejectedValueOnce(new Error('Popup closed'));

      await expect(getState().loginWithGoogle()).rejects.toThrow('Popup closed');

      expect(getState().error).toBe('Popup closed');
    });
  });

  // -------------------------------------------------------------------------
  // loginWithSchoolCode
  // -------------------------------------------------------------------------

  describe('loginWithSchoolCode', () => {
    it('resolves tenant, signs in, and sets membership', async () => {
      const tenant = { id: 'tenant-1', name: 'School', status: 'active' };
      const membership = mockMembership('tenant-1');

      vi.mocked(lookupTenantByCode).mockResolvedValueOnce(tenant as any);
      mockSignIn.mockResolvedValueOnce({ user: mockFirebaseUser });
      vi.mocked(getUserMemberships).mockResolvedValueOnce([membership] as any);
      vi.mocked(getMembership).mockResolvedValueOnce(membership as any);

      await getState().loginWithSchoolCode('SPR001', 'STU-001', 'pass');

      expect(lookupTenantByCode).toHaveBeenCalledWith('SPR001');
      expect(callSwitchActiveTenant).toHaveBeenCalledWith('tenant-1');
      expect(getState().currentTenantId).toBe('tenant-1');
      expect(getState().currentMembership).toBe(membership);
    });

    it('throws when school code is invalid', async () => {
      vi.mocked(lookupTenantByCode).mockResolvedValueOnce(null);

      await expect(
        getState().loginWithSchoolCode('BAD', 'stu', 'pass'),
      ).rejects.toThrow('Invalid school code');
    });

    it('throws when school is not active', async () => {
      vi.mocked(lookupTenantByCode).mockResolvedValueOnce({
        id: 't1',
        status: 'suspended',
      } as any);

      await expect(
        getState().loginWithSchoolCode('SPR', 'stu', 'pass'),
      ).rejects.toThrow('School is not active');
    });

    it('throws when no active membership exists', async () => {
      vi.mocked(lookupTenantByCode).mockResolvedValueOnce({
        id: 't1',
        status: 'active',
      } as any);
      mockSignIn.mockResolvedValueOnce({ user: mockFirebaseUser });
      vi.mocked(getUserMemberships).mockResolvedValueOnce([]);
      vi.mocked(getMembership).mockResolvedValueOnce(null);

      await expect(
        getState().loginWithSchoolCode('SPR', 'stu', 'pass'),
      ).rejects.toThrow('No active membership for this school');
    });
  });

  // -------------------------------------------------------------------------
  // logout
  // -------------------------------------------------------------------------

  describe('logout', () => {
    it('calls authService.signOut', async () => {
      mockSignOut.mockResolvedValueOnce(undefined);

      await getState().logout();

      expect(mockSignOut).toHaveBeenCalled();
    });

    it('sets error on failure but does not throw', async () => {
      mockSignOut.mockRejectedValueOnce(new Error('Network error'));

      await getState().logout();

      expect(getState().error).toBe('Network error');
    });
  });

  // -------------------------------------------------------------------------
  // switchTenant
  // -------------------------------------------------------------------------

  describe('switchTenant', () => {
    it('switches to a valid tenant and updates state', async () => {
      const membership = mockMembership('tenant-2', 'teacher');
      useAuthStore.setState({
        firebaseUser: mockFirebaseUser as any,
        allMemberships: [mockMembership('tenant-1'), membership] as any[],
      });

      await getState().switchTenant('tenant-2');

      expect(callSwitchActiveTenant).toHaveBeenCalledWith('tenant-2');
      expect(mockGetIdToken).toHaveBeenCalledWith(true);
      expect(getState().currentTenantId).toBe('tenant-2');
      expect(getState().currentMembership).toBe(membership);
      expect(getState().loading).toBe(false);
    });

    it('throws when not authenticated', async () => {
      useAuthStore.setState({ firebaseUser: null });

      await expect(getState().switchTenant('t1')).rejects.toThrow(
        'Not authenticated',
      );
    });

    it('throws when user has no membership for target tenant', async () => {
      useAuthStore.setState({
        firebaseUser: mockFirebaseUser as any,
        allMemberships: [mockMembership('tenant-1')] as any[],
      });

      await expect(getState().switchTenant('tenant-999')).rejects.toThrow(
        'No membership for this tenant',
      );
    });
  });

  // -------------------------------------------------------------------------
  // loadMemberships
  // -------------------------------------------------------------------------

  describe('loadMemberships', () => {
    it('fetches memberships and updates store', async () => {
      const memberships = [mockMembership('t1'), mockMembership('t2')];
      vi.mocked(getUserMemberships).mockResolvedValueOnce(memberships as any);
      useAuthStore.setState({ firebaseUser: mockFirebaseUser as any });

      const result = await getState().loadMemberships();

      expect(getUserMemberships).toHaveBeenCalledWith('user-1');
      expect(result).toHaveLength(2);
      expect(getState().allMemberships).toBe(memberships);
    });

    it('returns empty array when not authenticated', async () => {
      useAuthStore.setState({ firebaseUser: null });

      const result = await getState().loadMemberships();

      expect(result).toEqual([]);
      expect(getUserMemberships).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // refreshToken
  // -------------------------------------------------------------------------

  describe('refreshToken', () => {
    it('forces token refresh when authenticated', async () => {
      useAuthStore.setState({ firebaseUser: mockFirebaseUser as any });

      await getState().refreshToken();

      expect(mockGetIdToken).toHaveBeenCalledWith(true);
    });

    it('does nothing when not authenticated', async () => {
      useAuthStore.setState({ firebaseUser: null });

      await getState().refreshToken();

      expect(mockGetIdToken).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // clearError
  // -------------------------------------------------------------------------

  describe('clearError', () => {
    it('clears the error state', () => {
      useAuthStore.setState({ error: 'Something failed' });

      getState().clearError();

      expect(getState().error).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // initialize
  // -------------------------------------------------------------------------

  describe('initialize', () => {
    it('subscribes to auth state and returns cleanup function', () => {
      const cleanup = getState().initialize();

      expect(mockOnAuthStateChange).toHaveBeenCalled();
      expect(typeof cleanup).toBe('function');
    });

    it('clears state when user signs out (null auth state)', async () => {
      useAuthStore.setState({
        user: { uid: 'x' } as any,
        firebaseUser: mockFirebaseUser as any,
        currentTenantId: 'old-tenant',
      });

      getState().initialize();
      // Simulate sign-out
      await authStateCallback!(null);

      expect(getState().user).toBeNull();
      expect(getState().firebaseUser).toBeNull();
      expect(getState().currentMembership).toBeNull();
      expect(getState().currentTenantId).toBeNull();
      expect(getState().loading).toBe(false);
    });

    it('loads memberships and restores tenant from claims on sign-in', async () => {
      const memberships = [mockMembership('tenant-claimed')];
      vi.mocked(getUserMemberships).mockResolvedValueOnce(memberships as any);
      vi.mocked(getIdTokenResult).mockResolvedValueOnce({
        claims: { tenantId: 'tenant-claimed' },
      } as any);

      getState().initialize();
      await authStateCallback!(mockFirebaseUser);

      // Allow microtasks to settle
      await vi.waitFor(() => {
        expect(getState().currentTenantId).toBe('tenant-claimed');
      });
      expect(getState().allMemberships).toBe(memberships);
    });

    it('auto-selects tenant when user has exactly one membership', async () => {
      const memberships = [mockMembership('only-tenant')];
      vi.mocked(getUserMemberships).mockResolvedValueOnce(memberships as any);
      vi.mocked(getIdTokenResult).mockResolvedValueOnce({
        claims: {},
      } as any);

      getState().initialize();
      await authStateCallback!(mockFirebaseUser);

      await vi.waitFor(() => {
        expect(getState().currentTenantId).toBe('only-tenant');
      });
    });

    it('does not auto-select when user has multiple memberships and no claim', async () => {
      const memberships = [mockMembership('t1'), mockMembership('t2')];
      vi.mocked(getUserMemberships).mockResolvedValueOnce(memberships as any);
      vi.mocked(getIdTokenResult).mockResolvedValueOnce({
        claims: {},
      } as any);

      getState().initialize();
      await authStateCallback!(mockFirebaseUser);

      await vi.waitFor(() => {
        expect(getState().loading).toBe(false);
      });
      expect(getState().currentTenantId).toBeNull();
    });

    it('sets error when initialization fails', async () => {
      vi.mocked(getUserMemberships).mockRejectedValueOnce(
        new Error('Firestore unavailable'),
      );

      getState().initialize();
      await authStateCallback!(mockFirebaseUser);

      await vi.waitFor(() => {
        expect(getState().error).toBe('Firestore unavailable');
      });
      expect(getState().loading).toBe(false);
    });

    it('cleanup function unsubscribes from auth listener', () => {
      const cleanup = getState().initialize();
      cleanup();
      expect(mockAuthUnsub).toHaveBeenCalled();
    });
  });
});
