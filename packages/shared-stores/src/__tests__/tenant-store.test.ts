/**
 * Unit tests for tenant-store.ts
 * Mocks Firebase Firestore onSnapshot to test tenant state management.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock Firebase SDK & shared-services
// ---------------------------------------------------------------------------

let snapshotCallback: ((snap: any) => void) | null = null;
let snapshotErrorCallback: ((err: any) => void) | null = null;
const mockUnsubscribe = vi.fn();

vi.mock("firebase/firestore", () => ({
  doc: vi.fn((_db: any, _collection: string, _id: string) => ({
    path: `${_collection}/${_id}`,
  })),
  onSnapshot: vi.fn((_ref: any, onNext: any, onError?: any) => {
    snapshotCallback = onNext;
    snapshotErrorCallback = onError ?? null;
    return mockUnsubscribe;
  }),
}));

vi.mock("@levelup/shared-services", () => ({
  getFirebaseServices: vi.fn(() => ({
    db: { type: "firestore" },
  })),
}));

import { useTenantStore } from "../tenant-store";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getState() {
  return useTenantStore.getState();
}

function emitSnapshot(data: Record<string, unknown> | null, id = "tenant-1") {
  if (!snapshotCallback) throw new Error("No snapshot listener registered");
  if (data === null) {
    snapshotCallback({ exists: () => false, id, data: () => null });
  } else {
    snapshotCallback({ exists: () => true, id, data: () => data });
  }
}

function emitSnapshotError(message: string) {
  if (!snapshotErrorCallback) throw new Error("No error callback registered");
  snapshotErrorCallback(new Error(message));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("tenant-store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    snapshotCallback = null;
    snapshotErrorCallback = null;
    useTenantStore.setState({
      tenant: null,
      settings: null,
      features: null,
      loading: true,
      error: null,
    });
  });

  // -------------------------------------------------------------------------
  // Initial state
  // -------------------------------------------------------------------------

  it("has correct initial state", () => {
    const state = getState();
    expect(state.tenant).toBeNull();
    expect(state.settings).toBeNull();
    expect(state.features).toBeNull();
    expect(state.loading).toBe(true);
    expect(state.error).toBeNull();
  });

  // -------------------------------------------------------------------------
  // subscribe
  // -------------------------------------------------------------------------

  describe("subscribe", () => {
    it("sets loading true and returns an unsubscribe function", () => {
      const unsub = getState().subscribe("tenant-1");
      expect(getState().loading).toBe(true);
      expect(typeof unsub).toBe("function");
    });

    it("populates tenant, settings, and features when snapshot arrives", () => {
      getState().subscribe("tenant-1");

      emitSnapshot({
        name: "Springfield School",
        tenantCode: "SPR001",
        status: "active",
        settings: { geminiKeySet: true },
        features: { levelUpEnabled: true, autoGradeEnabled: false },
        subscription: { plan: "pro" },
      });

      const state = getState();
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.tenant).not.toBeNull();
      expect(state.tenant!.id).toBe("tenant-1");
      expect(state.tenant!.name).toBe("Springfield School");
      expect(state.settings).toEqual({ geminiKeySet: true });
      expect(state.features).toEqual({ levelUpEnabled: true, autoGradeEnabled: false });
    });

    it("sets error when tenant document does not exist", () => {
      getState().subscribe("nonexistent");

      emitSnapshot(null, "nonexistent");

      const state = getState();
      expect(state.loading).toBe(false);
      expect(state.tenant).toBeNull();
      expect(state.error).toBe("Tenant not found");
    });

    it("handles missing settings/features gracefully (sets null)", () => {
      getState().subscribe("tenant-1");

      emitSnapshot({ name: "Bare Tenant", status: "active" });

      expect(getState().settings).toBeNull();
      expect(getState().features).toBeNull();
    });

    it("handles Firestore errors via error callback", () => {
      getState().subscribe("tenant-1");

      emitSnapshotError("Permission denied");

      const state = getState();
      expect(state.loading).toBe(false);
      expect(state.error).toBe("Permission denied");
    });

    it("updates state when tenant document changes (real-time)", () => {
      getState().subscribe("tenant-1");

      emitSnapshot({ name: "Version 1", settings: { geminiKeySet: false } });
      expect(getState().tenant!.name).toBe("Version 1");

      emitSnapshot({ name: "Version 2", settings: { geminiKeySet: true } });
      expect(getState().tenant!.name).toBe("Version 2");
      expect(getState().settings).toEqual({ geminiKeySet: true });
    });

    it("unsubscribe function calls the Firestore unsubscribe", () => {
      const unsub = getState().subscribe("tenant-1");
      unsub();
      expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // reset
  // -------------------------------------------------------------------------

  describe("reset", () => {
    it("clears all tenant state back to initial values", () => {
      // First populate state
      useTenantStore.setState({
        tenant: { id: "x", name: "Test" } as any,
        settings: { geminiKeySet: true } as any,
        features: { levelUpEnabled: true } as any,
        loading: false,
        error: null,
      });

      getState().reset();

      const state = getState();
      expect(state.tenant).toBeNull();
      expect(state.settings).toBeNull();
      expect(state.features).toBeNull();
      expect(state.loading).toBe(true);
      expect(state.error).toBeNull();
    });

    it("clears error state", () => {
      useTenantStore.setState({ error: "Some error", loading: false });
      getState().reset();
      expect(getState().error).toBeNull();
    });
  });
});
