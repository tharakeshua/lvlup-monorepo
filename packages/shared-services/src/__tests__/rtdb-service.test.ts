import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock firebase/database
const mockRef = vi.fn();
const mockGet = vi.fn();
const mockSet = vi.fn();
const mockUpdate = vi.fn();
const mockRemove = vi.fn();
const mockPush = vi.fn();
const mockOnValue = vi.fn();
const mockOff = vi.fn();

vi.mock("firebase/database", () => ({
  ref: (...args: any[]) => mockRef(...args),
  get: (...args: any[]) => mockGet(...args),
  set: (...args: any[]) => mockSet(...args),
  update: (...args: any[]) => mockUpdate(...args),
  remove: (...args: any[]) => mockRemove(...args),
  push: (...args: any[]) => mockPush(...args),
  onValue: (...args: any[]) => mockOnValue(...args),
  off: (...args: any[]) => mockOff(...args),
}));

vi.mock("../firebase", () => ({
  getFirebaseServices: () => ({
    rtdb: { app: {}, _isDatabase: true },
  }),
}));

import { RealtimeDBService } from "../realtime-db/index";

describe("RealtimeDBService", () => {
  let service: RealtimeDBService;
  const mockDb = { app: {}, _isDatabase: true } as any;
  const orgId = "org-456";

  beforeEach(() => {
    vi.clearAllMocks();
    service = new RealtimeDBService(mockDb);
    mockRef.mockImplementation((_db: any, path: string) => ({
      key: path.split("/").pop(),
      toString: () => path,
      _path: path,
    }));
  });

  describe("getOrgPath", () => {
    it("prefixes path with organizations/{orgId}/", () => {
      expect(service.getOrgPath(orgId, "users/u1")).toBe("organizations/org-456/users/u1");
    });
  });

  describe("getRef", () => {
    it("returns a valid database reference with org-scoped path", () => {
      const dbRef = service.getRef(orgId, "settings");

      expect(mockRef).toHaveBeenCalledWith(mockDb, "organizations/org-456/settings");
      expect(dbRef).toEqual(expect.objectContaining({ _path: "organizations/org-456/settings" }));
    });
  });

  describe("getData", () => {
    it("reads value at org-scoped path", async () => {
      const snapshot = { exists: () => true, val: () => ({ name: "Test" }) };
      mockGet.mockResolvedValue(snapshot);

      const result = await service.getData(orgId, "config");

      expect(mockRef).toHaveBeenCalledWith(mockDb, "organizations/org-456/config");
      expect(result).toEqual({ name: "Test" });
    });

    it("returns null for non-existing path", async () => {
      const snapshot = { exists: () => false, val: () => null };
      mockGet.mockResolvedValue(snapshot);

      const result = await service.getData(orgId, "nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("setData", () => {
    it("writes value at path", async () => {
      mockSet.mockResolvedValue(undefined);

      await service.setData(orgId, "config", { theme: "dark" });

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({ _path: "organizations/org-456/config" }),
        { theme: "dark" }
      );
    });

    it("overwrites existing value", async () => {
      mockSet.mockResolvedValue(undefined);

      await service.setData(orgId, "config", { theme: "light" });
      await service.setData(orgId, "config", { theme: "dark", lang: "en" });

      expect(mockSet).toHaveBeenCalledTimes(2);
      expect(mockSet).toHaveBeenLastCalledWith(
        expect.objectContaining({ _path: "organizations/org-456/config" }),
        { theme: "dark", lang: "en" }
      );
    });
  });

  describe("updateData", () => {
    it("updates specific fields at a location", async () => {
      mockUpdate.mockResolvedValue(undefined);

      await service.updateData(orgId, "profile", { displayName: "New Name" });

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ _path: "organizations/org-456/profile" }),
        { displayName: "New Name" }
      );
    });
  });

  describe("deleteData", () => {
    it("removes data at path", async () => {
      mockRemove.mockResolvedValue(undefined);

      await service.deleteData(orgId, "temp");

      expect(mockRemove).toHaveBeenCalledWith(
        expect.objectContaining({ _path: "organizations/org-456/temp" })
      );
    });
  });

  describe("pushData", () => {
    it("adds child to list and returns the generated key", async () => {
      const newRef = { key: "-NaBC123", _path: "organizations/org-456/messages/-NaBC123" };
      mockPush.mockReturnValue(newRef);
      mockSet.mockResolvedValue(undefined);

      const key = await service.pushData(orgId, "messages", { text: "hello" });

      expect(mockPush).toHaveBeenCalledWith(
        expect.objectContaining({ _path: "organizations/org-456/messages" })
      );
      expect(mockSet).toHaveBeenCalledWith(newRef, { text: "hello" });
      expect(key).toBe("-NaBC123");
    });
  });

  describe("subscribe", () => {
    it("fires callback on value change", () => {
      const mockUnsubscribe = vi.fn();
      mockOnValue.mockImplementation((_ref: any, cb: (snap: any) => void) => {
        // Simulate an immediate value event
        cb({ exists: () => true, val: () => ({ count: 5 }) });
        return mockUnsubscribe;
      });

      const callback = vi.fn();
      service.subscribe(orgId, "counter", callback);

      expect(mockOnValue).toHaveBeenCalledWith(
        expect.objectContaining({ _path: "organizations/org-456/counter" }),
        expect.any(Function)
      );
      expect(callback).toHaveBeenCalledWith({ count: 5 });
    });

    it("passes null to callback when snapshot does not exist", () => {
      mockOnValue.mockImplementation((_ref: any, cb: (snap: any) => void) => {
        cb({ exists: () => false, val: () => null });
        return vi.fn();
      });

      const callback = vi.fn();
      service.subscribe(orgId, "missing", callback);

      expect(callback).toHaveBeenCalledWith(null);
    });

    it("returns an unsubscribe function", () => {
      const mockUnsubscribe = vi.fn();
      mockOnValue.mockReturnValue(mockUnsubscribe);

      const unsub = service.subscribe(orgId, "data", vi.fn());

      expect(unsub).toBe(mockUnsubscribe);
    });
  });

  describe("unsubscribe", () => {
    it("calls off with the correct ref to stop listening", () => {
      service.unsubscribe(orgId, "counter");

      expect(mockRef).toHaveBeenCalledWith(mockDb, "organizations/org-456/counter");
      expect(mockOff).toHaveBeenCalledWith(
        expect.objectContaining({ _path: "organizations/org-456/counter" })
      );
    });
  });

  describe("lazy database initialization", () => {
    it("resolves database from getFirebaseServices when not injected", () => {
      const lazyService = new RealtimeDBService();
      lazyService.getRef("org-1", "test");

      expect(mockRef).toHaveBeenCalled();
    });
  });
});
