/**
 * Unit tests for consumer-store.ts
 * Tests cart management, purchase tracking, and state reset.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { useConsumerStore } from "../consumer-store";
import type { CartItem } from "../consumer-store";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getState() {
  return useConsumerStore.getState();
}

function makeCartItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    spaceId: "space-1",
    title: "Test Space",
    price: 9.99,
    currency: "USD",
    thumbnailUrl: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("consumer-store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store to initial state
    useConsumerStore.setState({
      cart: [],
      recentlyPurchased: [],
    });
  });

  // ── Initial state ───────────────────────────────────────────────────

  it("starts with empty cart and recentlyPurchased", () => {
    expect(getState().cart).toEqual([]);
    expect(getState().recentlyPurchased).toEqual([]);
  });

  // ── addToCart ───────────────────────────────────────────────────────

  describe("addToCart", () => {
    it("adds an item to the cart", () => {
      const item = makeCartItem({ spaceId: "space-1" });
      getState().addToCart(item);

      expect(getState().cart).toHaveLength(1);
      expect(getState().cart[0]).toEqual(item);
    });

    it("skips duplicate item with same spaceId", () => {
      const item = makeCartItem({ spaceId: "space-1" });
      getState().addToCart(item);
      getState().addToCart(item);

      expect(getState().cart).toHaveLength(1);
    });

    it("adds multiple items with different spaceIds", () => {
      getState().addToCart(makeCartItem({ spaceId: "space-1" }));
      getState().addToCart(makeCartItem({ spaceId: "space-2" }));

      expect(getState().cart).toHaveLength(2);
    });
  });

  // ── removeFromCart ──────────────────────────────────────────────────

  describe("removeFromCart", () => {
    it("removes the correct item by spaceId", () => {
      getState().addToCart(makeCartItem({ spaceId: "space-1", title: "First" }));
      getState().addToCart(makeCartItem({ spaceId: "space-2", title: "Second" }));

      getState().removeFromCart("space-1");

      expect(getState().cart).toHaveLength(1);
      expect(getState().cart[0]!.spaceId).toBe("space-2");
    });

    it("is a no-op when spaceId is not in cart", () => {
      getState().addToCart(makeCartItem({ spaceId: "space-1" }));
      getState().removeFromCart("nonexistent");

      expect(getState().cart).toHaveLength(1);
    });
  });

  // ── clearCart ───────────────────────────────────────────────────────

  describe("clearCart", () => {
    it("empties the entire cart", () => {
      getState().addToCart(makeCartItem({ spaceId: "space-1" }));
      getState().addToCart(makeCartItem({ spaceId: "space-2" }));

      getState().clearCart();

      expect(getState().cart).toEqual([]);
    });
  });

  // ── isInCart ────────────────────────────────────────────────────────

  describe("isInCart", () => {
    it("returns true when item is in cart", () => {
      getState().addToCart(makeCartItem({ spaceId: "space-1" }));

      expect(getState().isInCart("space-1")).toBe(true);
    });

    it("returns false when item is not in cart", () => {
      expect(getState().isInCart("space-99")).toBe(false);
    });
  });

  // ── cartTotal ──────────────────────────────────────────────────────

  describe("cartTotal", () => {
    it("sums prices correctly", () => {
      getState().addToCart(makeCartItem({ spaceId: "space-1", price: 10 }));
      getState().addToCart(makeCartItem({ spaceId: "space-2", price: 20.5 }));

      expect(getState().cartTotal()).toBe(30.5);
    });

    it("returns 0 when cart is empty", () => {
      expect(getState().cartTotal()).toBe(0);
    });
  });

  // ── markPurchased ──────────────────────────────────────────────────

  describe("markPurchased", () => {
    it("removes purchased items from cart", () => {
      getState().addToCart(makeCartItem({ spaceId: "space-1" }));
      getState().addToCart(makeCartItem({ spaceId: "space-2" }));

      getState().markPurchased(["space-1"]);

      expect(getState().cart).toHaveLength(1);
      expect(getState().cart[0]!.spaceId).toBe("space-2");
    });

    it("adds purchased spaceIds to recentlyPurchased", () => {
      getState().addToCart(makeCartItem({ spaceId: "space-1" }));

      getState().markPurchased(["space-1"]);

      expect(getState().recentlyPurchased).toContain("space-1");
    });

    it("deduplicates recentlyPurchased entries", () => {
      useConsumerStore.setState({ recentlyPurchased: ["space-1"] });

      getState().markPurchased(["space-1", "space-2"]);

      const purchased = getState().recentlyPurchased;
      expect(purchased.filter((id) => id === "space-1")).toHaveLength(1);
      expect(purchased).toContain("space-2");
    });
  });

  // ── resetConsumerState ─────────────────────────────────────────────

  describe("resetConsumerState", () => {
    it("clears both cart and recentlyPurchased", () => {
      getState().addToCart(makeCartItem({ spaceId: "space-1" }));
      getState().markPurchased(["space-1"]);

      getState().resetConsumerState();

      expect(getState().cart).toEqual([]);
      expect(getState().recentlyPurchased).toEqual([]);
    });
  });
});
