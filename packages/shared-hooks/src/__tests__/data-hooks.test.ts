import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

// Mock firebase/firestore
const mockDoc = vi.fn();
const mockOnSnapshot = vi.fn();
const mockCollection = vi.fn();
const mockQuery = vi.fn();

vi.mock("firebase/firestore", () => ({
  doc: (...args: unknown[]) => mockDoc(...args),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
  collection: (...args: unknown[]) => mockCollection(...args),
  query: (...args: unknown[]) => mockQuery(...args),
}));

// Mock firebase/database
const mockRef = vi.fn();
const mockOnValue = vi.fn();

vi.mock("firebase/database", () => ({
  ref: (...args: unknown[]) => mockRef(...args),
  onValue: (...args: unknown[]) => mockOnValue(...args),
}));

// Mock shared-services
vi.mock("@levelup/shared-services", () => ({
  getFirebaseServices: () => ({
    db: { type: "firestore" },
    rtdb: { type: "database" },
  }),
}));

import { useFirestoreDoc } from "../data/useFirestoreDoc";
import { useFirestoreCollection } from "../data/useFirestoreCollection";
import { useRealtimeDB } from "../data/useRealtimeDB";

describe("useFirestoreDoc", () => {
  const mockUnsubscribe = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockDoc.mockReturnValue("doc-ref");
    mockOnSnapshot.mockImplementation(() => mockUnsubscribe);
  });

  it("should start in loading state", () => {
    const { result } = renderHook(() => useFirestoreDoc("org-1", "users", "doc-1"));

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("should set data when document exists", () => {
    mockOnSnapshot.mockImplementation((_ref, onNext) => {
      onNext({ exists: () => true, id: "doc-1", data: () => ({ name: "Test" }) });
      return mockUnsubscribe;
    });

    const { result } = renderHook(() => useFirestoreDoc("org-1", "users", "doc-1"));

    expect(result.current.data).toEqual({ id: "doc-1", name: "Test" });
    expect(result.current.loading).toBe(false);
  });

  it("should set null when document does not exist", () => {
    mockOnSnapshot.mockImplementation((_ref, onNext) => {
      onNext({ exists: () => false, id: "doc-1", data: () => null });
      return mockUnsubscribe;
    });

    const { result } = renderHook(() => useFirestoreDoc("org-1", "users", "doc-1"));

    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("should handle errors", () => {
    mockOnSnapshot.mockImplementation((_ref, _onNext, onError) => {
      onError(new Error("Permission denied"));
      return mockUnsubscribe;
    });

    const { result } = renderHook(() => useFirestoreDoc("org-1", "users", "doc-1"));

    expect(result.current.error?.message).toBe("Permission denied");
    expect(result.current.loading).toBe(false);
  });

  it("should not subscribe when docId is null", () => {
    const { result } = renderHook(() => useFirestoreDoc("org-1", "users", null));

    expect(mockOnSnapshot).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });

  it("should not subscribe when disabled", () => {
    const { result } = renderHook(() =>
      useFirestoreDoc("org-1", "users", "doc-1", { disabled: true })
    );

    expect(mockOnSnapshot).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });

  it("should use correct Firestore path", () => {
    mockOnSnapshot.mockImplementation(() => mockUnsubscribe);

    renderHook(() => useFirestoreDoc("org-1", "users", "doc-1"));

    expect(mockDoc).toHaveBeenCalledWith({ type: "firestore" }, "tenants/org-1/users", "doc-1");
  });

  it("should unsubscribe on unmount", () => {
    mockOnSnapshot.mockImplementation(() => mockUnsubscribe);

    const { unmount } = renderHook(() => useFirestoreDoc("org-1", "users", "doc-1"));

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalled();
  });
});

describe("useFirestoreCollection", () => {
  const mockUnsubscribe = vi.fn();

  beforeEach(() => {
    mockCollection.mockReturnValue("col-ref");
    mockQuery.mockReturnValue("query-ref");
  });

  it("should start in loading state", () => {
    mockOnSnapshot.mockImplementation(() => mockUnsubscribe);

    const { result } = renderHook(() => useFirestoreCollection("org-1", "users"));

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("should set data from snapshot docs", () => {
    mockOnSnapshot.mockImplementation((_q, onNext) => {
      onNext({
        docs: [
          { id: "a", data: () => ({ name: "Alice" }) },
          { id: "b", data: () => ({ name: "Bob" }) },
        ],
      });
      return mockUnsubscribe;
    });

    const { result } = renderHook(() => useFirestoreCollection("org-1", "users"));

    expect(result.current.data).toEqual([
      { id: "a", name: "Alice" },
      { id: "b", name: "Bob" },
    ]);
    expect(result.current.loading).toBe(false);
  });

  it("should handle errors", () => {
    mockOnSnapshot.mockImplementation((_q, _onNext, onError) => {
      onError(new Error("Collection error"));
      return mockUnsubscribe;
    });

    const { result } = renderHook(() => useFirestoreCollection("org-1", "users"));

    expect(result.current.error?.message).toBe("Collection error");
    expect(result.current.loading).toBe(false);
  });

  it("should not subscribe when disabled", () => {
    mockOnSnapshot.mockReset();

    const { result } = renderHook(() =>
      useFirestoreCollection("org-1", "users", undefined, { disabled: true })
    );

    expect(mockOnSnapshot).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });

  it("should unsubscribe on unmount", () => {
    mockOnSnapshot.mockImplementation(() => mockUnsubscribe);

    const { unmount } = renderHook(() => useFirestoreCollection("org-1", "users"));

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalled();
  });
});

describe("useRealtimeDB", () => {
  const mockUnsubscribe = vi.fn();

  beforeEach(() => {
    mockRef.mockReturnValue("db-ref");
    mockOnValue.mockImplementation(() => mockUnsubscribe);
  });

  it("should start in loading state", () => {
    const { result } = renderHook(() => useRealtimeDB("org-1", "counters/visits"));

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
  });

  it("should set data when value exists", () => {
    mockOnValue.mockImplementation((_ref, onValue) => {
      onValue({ exists: () => true, val: () => ({ count: 42 }) });
      return mockUnsubscribe;
    });

    const { result } = renderHook(() => useRealtimeDB("org-1", "counters/visits"));

    expect(result.current.data).toEqual({ count: 42 });
    expect(result.current.loading).toBe(false);
  });

  it("should set null when value does not exist", () => {
    mockOnValue.mockImplementation((_ref, onValue) => {
      onValue({ exists: () => false, val: () => null });
      return mockUnsubscribe;
    });

    const { result } = renderHook(() => useRealtimeDB("org-1", "counters/missing"));

    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("should handle errors", () => {
    mockOnValue.mockImplementation((_ref, _onValue, onError) => {
      onError(new Error("RTDB error"));
      return mockUnsubscribe;
    });

    const { result } = renderHook(() => useRealtimeDB("org-1", "counters/visits"));

    expect(result.current.error?.message).toBe("RTDB error");
    expect(result.current.loading).toBe(false);
  });

  it("should not subscribe when disabled", () => {
    mockOnValue.mockReset();

    const { result } = renderHook(() =>
      useRealtimeDB("org-1", "counters/visits", { disabled: true })
    );

    expect(mockOnValue).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });

  it("should construct correct RTDB path", () => {
    mockOnValue.mockImplementation(() => mockUnsubscribe);

    renderHook(() => useRealtimeDB("org-1", "counters/visits"));

    expect(mockRef).toHaveBeenCalledWith({ type: "database" }, "tenants/org-1/counters/visits");
  });

  it("should unsubscribe on unmount", () => {
    mockOnValue.mockImplementation(() => mockUnsubscribe);

    const { unmount } = renderHook(() => useRealtimeDB("org-1", "counters/visits"));

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalled();
  });
});
