import { create } from "zustand";
import { persist } from "zustand/middleware";

// ---------------------------------------------------------------------------
// Cart item type
// ---------------------------------------------------------------------------

export interface CartItem {
  spaceId: string;
  title: string;
  price: number;
  currency: string;
  thumbnailUrl: string | null;
}

// ---------------------------------------------------------------------------
// State interface
// ---------------------------------------------------------------------------

export interface ConsumerState {
  cart: CartItem[];
  recentlyPurchased: string[];

  // Actions
  addToCart: (item: CartItem) => void;
  removeFromCart: (spaceId: string) => void;
  clearCart: () => void;
  isInCart: (spaceId: string) => boolean;
  cartTotal: () => number;
  markPurchased: (spaceIds: string[]) => void;
  resetConsumerState: () => void;
}

// ---------------------------------------------------------------------------
// Store (cart persisted to localStorage)
// ---------------------------------------------------------------------------

export const useConsumerStore = create<ConsumerState>()(
  persist(
    (set, get) => ({
      cart: [],
      recentlyPurchased: [],

      addToCart: (item) => {
        const { cart } = get();
        if (cart.some((c) => c.spaceId === item.spaceId)) return;
        set({ cart: [...cart, item] });
      },

      removeFromCart: (spaceId) => {
        set((state) => ({
          cart: state.cart.filter((c) => c.spaceId !== spaceId),
        }));
      },

      clearCart: () => set({ cart: [] }),

      isInCart: (spaceId) => {
        return get().cart.some((c) => c.spaceId === spaceId);
      },

      cartTotal: () => {
        return get().cart.reduce((sum, item) => sum + item.price, 0);
      },

      markPurchased: (spaceIds) => {
        set((state) => ({
          cart: state.cart.filter((c) => !spaceIds.includes(c.spaceId)),
          recentlyPurchased: [...new Set([...state.recentlyPurchased, ...spaceIds])],
        }));
      },

      resetConsumerState: () => set({ cart: [], recentlyPurchased: [] }),
    }),
    {
      name: "levelup-consumer",
      partialize: (state) => ({
        cart: state.cart,
      }),
    }
  )
);

// ---------------------------------------------------------------------------
// Convenience selectors
// ---------------------------------------------------------------------------

export const useCart = () => useConsumerStore((s) => s.cart);
export const useCartCount = () => useConsumerStore((s) => s.cart.length);
