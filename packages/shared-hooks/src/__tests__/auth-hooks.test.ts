import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Mock firebase/auth
const mockOnAuthStateChanged = vi.fn();
vi.mock("firebase/auth", () => ({
  onAuthStateChanged: (...args: unknown[]) => mockOnAuthStateChanged(...args),
}));

// Mock shared-services
vi.mock("@levelup/shared-services", () => ({
  getFirebaseServices: () => ({
    auth: { currentUser: null },
  }),
}));

import { useAuth, useUserId, useUserEmail } from "../auth/useAuth";

describe("useAuth", () => {
  let authCallback: (user: unknown) => void;
  let errorCallback: (error: Error) => void;
  const mockUnsubscribe = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnAuthStateChanged.mockImplementation((_auth, onUser, onError) => {
      authCallback = onUser;
      errorCallback = onError;
      return mockUnsubscribe;
    });
  });

  it("should start in loading state", () => {
    const { result } = renderHook(() => useAuth());

    expect(result.current.loading).toBe(true);
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("should set user when authenticated", () => {
    const { result } = renderHook(() => useAuth());

    const mockUser = { uid: "user-123", email: "test@example.com" };
    act(() => {
      authCallback(mockUser);
    });

    expect(result.current.user).toEqual(mockUser);
    expect(result.current.loading).toBe(false);
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it("should handle signed-out user (null)", () => {
    const { result } = renderHook(() => useAuth());

    act(() => {
      authCallback(null);
    });

    expect(result.current.user).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.isAuthenticated).toBe(false);
  });

  it("should handle auth error", () => {
    const { result } = renderHook(() => useAuth());

    const error = new Error("Auth failed");
    act(() => {
      errorCallback(error);
    });

    expect(result.current.error).toEqual(error);
    expect(result.current.loading).toBe(false);
  });

  it("should unsubscribe on unmount", () => {
    const { unmount } = renderHook(() => useAuth());

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it("should subscribe to onAuthStateChanged on mount", () => {
    renderHook(() => useAuth());

    expect(mockOnAuthStateChanged).toHaveBeenCalledTimes(1);
    expect(mockOnAuthStateChanged).toHaveBeenCalledWith(
      expect.anything(), // auth
      expect.any(Function), // success callback
      expect.any(Function) // error callback
    );
  });
});

describe("useUserId", () => {
  beforeEach(() => {
    mockOnAuthStateChanged.mockImplementation((_auth, onUser) => {
      onUser(null);
      return vi.fn();
    });
  });

  it("should return null when no user", () => {
    const { result } = renderHook(() => useUserId());

    expect(result.current).toBeNull();
  });

  it("should return uid when user exists", () => {
    mockOnAuthStateChanged.mockImplementation((_auth, onUser) => {
      onUser({ uid: "user-456", email: "test@example.com" });
      return vi.fn();
    });

    const { result } = renderHook(() => useUserId());

    expect(result.current).toBe("user-456");
  });
});

describe("useUserEmail", () => {
  beforeEach(() => {
    mockOnAuthStateChanged.mockImplementation((_auth, onUser) => {
      onUser(null);
      return vi.fn();
    });
  });

  it("should return null when no user", () => {
    const { result } = renderHook(() => useUserEmail());

    expect(result.current).toBeNull();
  });

  it("should return email when user exists", () => {
    mockOnAuthStateChanged.mockImplementation((_auth, onUser) => {
      onUser({ uid: "user-789", email: "hello@world.com" });
      return vi.fn();
    });

    const { result } = renderHook(() => useUserEmail());

    expect(result.current).toBe("hello@world.com");
  });
});
