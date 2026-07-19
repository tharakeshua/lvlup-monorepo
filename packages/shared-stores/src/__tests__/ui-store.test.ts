/**
 * Unit tests for ui-store.ts
 * Tests sidebar, modal, and toast state management.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { useUIStore } from "../ui-store";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getState() {
  return useUIStore.getState();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ui-store", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Reset store to initial state
    useUIStore.setState({
      sidebarCollapsed: false,
      activeModal: null,
      modalData: null,
      toasts: [],
    });
    // Clear any lingering toast timers
    getState().clearToasts();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // Sidebar
  // -------------------------------------------------------------------------

  describe("sidebar", () => {
    it("starts with sidebar expanded", () => {
      expect(getState().sidebarCollapsed).toBe(false);
    });

    it("toggleSidebar flips the collapsed state", () => {
      getState().toggleSidebar();
      expect(getState().sidebarCollapsed).toBe(true);

      getState().toggleSidebar();
      expect(getState().sidebarCollapsed).toBe(false);
    });

    it("setSidebarCollapsed sets explicit value", () => {
      getState().setSidebarCollapsed(true);
      expect(getState().sidebarCollapsed).toBe(true);

      getState().setSidebarCollapsed(false);
      expect(getState().sidebarCollapsed).toBe(false);
    });

    it("setSidebarCollapsed to same value is idempotent", () => {
      getState().setSidebarCollapsed(true);
      getState().setSidebarCollapsed(true);
      expect(getState().sidebarCollapsed).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Modals
  // -------------------------------------------------------------------------

  describe("modals", () => {
    it("starts with no active modal", () => {
      expect(getState().activeModal).toBeNull();
      expect(getState().modalData).toBeNull();
    });

    it("openModal sets active modal id", () => {
      getState().openModal("confirm-delete");
      expect(getState().activeModal).toBe("confirm-delete");
      expect(getState().modalData).toBeNull();
    });

    it("openModal sets modal data when provided", () => {
      getState().openModal("edit-user", { userId: "u1", name: "Alice" });
      expect(getState().activeModal).toBe("edit-user");
      expect(getState().modalData).toEqual({ userId: "u1", name: "Alice" });
    });

    it("closeModal clears active modal and data", () => {
      getState().openModal("edit-user", { userId: "u1" });
      getState().closeModal();
      expect(getState().activeModal).toBeNull();
      expect(getState().modalData).toBeNull();
    });

    it("opening a new modal replaces the current one", () => {
      getState().openModal("modal-a", { a: 1 });
      getState().openModal("modal-b", { b: 2 });
      expect(getState().activeModal).toBe("modal-b");
      expect(getState().modalData).toEqual({ b: 2 });
    });
  });

  // -------------------------------------------------------------------------
  // Toasts
  // -------------------------------------------------------------------------

  describe("toasts", () => {
    it("starts with an empty toasts array", () => {
      expect(getState().toasts).toEqual([]);
    });

    it("addToast appends a toast with a generated id", () => {
      getState().addToast({ title: "Saved" });
      const toasts = getState().toasts;
      expect(toasts).toHaveLength(1);
      expect(toasts[0]!.title).toBe("Saved");
      expect(toasts[0]!.id).toMatch(/^toast-/);
    });

    it("addToast supports description and variant", () => {
      getState().addToast({
        title: "Error",
        description: "Something went wrong",
        variant: "destructive",
      });
      const toast = getState().toasts[0]!;
      expect(toast.description).toBe("Something went wrong");
      expect(toast.variant).toBe("destructive");
    });

    it("multiple toasts are appended in order", () => {
      getState().addToast({ title: "First" });
      getState().addToast({ title: "Second" });
      getState().addToast({ title: "Third" });
      const titles = getState().toasts.map((t) => t.title);
      expect(titles).toEqual(["First", "Second", "Third"]);
    });

    it("removeToast removes a specific toast by id", () => {
      getState().addToast({ title: "Keep" });
      getState().addToast({ title: "Remove" });
      const toRemove = getState().toasts[1]!.id;

      getState().removeToast(toRemove);

      expect(getState().toasts).toHaveLength(1);
      expect(getState().toasts[0]!.title).toBe("Keep");
    });

    it("removeToast with non-existent id is a no-op", () => {
      getState().addToast({ title: "Only" });
      getState().removeToast("nonexistent-id");
      expect(getState().toasts).toHaveLength(1);
    });

    it("clearToasts removes all toasts", () => {
      getState().addToast({ title: "A" });
      getState().addToast({ title: "B" });
      getState().clearToasts();
      expect(getState().toasts).toEqual([]);
    });

    it("auto-removes toast after 5 seconds", () => {
      getState().addToast({ title: "Temporary" });
      expect(getState().toasts).toHaveLength(1);

      vi.advanceTimersByTime(5000);

      expect(getState().toasts).toHaveLength(0);
    });

    it("manual removeToast cancels auto-remove timer", () => {
      getState().addToast({ title: "Manual" });
      const id = getState().toasts[0]!.id;

      getState().removeToast(id);
      expect(getState().toasts).toHaveLength(0);

      // Advancing time should not cause errors
      vi.advanceTimersByTime(5000);
      expect(getState().toasts).toHaveLength(0);
    });
  });
});
