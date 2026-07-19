import { create } from "zustand";
import { persist } from "zustand/middleware";

// ---------------------------------------------------------------------------
// Toast type
// ---------------------------------------------------------------------------

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant?: "default" | "destructive" | "success";
}

// ---------------------------------------------------------------------------
// State interface
// ---------------------------------------------------------------------------

export interface UIState {
  sidebarCollapsed: boolean;
  activeModal: string | null;
  modalData: Record<string, unknown> | null;
  toasts: ToastItem[];

  // Actions
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  openModal: (modalId: string, data?: Record<string, unknown>) => void;
  closeModal: () => void;
  addToast: (toast: Omit<ToastItem, "id">) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

// ---------------------------------------------------------------------------
// Store (sidebar state persisted to localStorage)
// ---------------------------------------------------------------------------

let toastCounter = 0;
const toastTimers = new Map<string, ReturnType<typeof setTimeout>>();

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      activeModal: null,
      modalData: null,
      toasts: [],

      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

      openModal: (modalId, data) => set({ activeModal: modalId, modalData: data ?? null }),

      closeModal: () => set({ activeModal: null, modalData: null }),

      addToast: (toast) => {
        const id = `toast-${++toastCounter}-${Date.now()}`;
        set((state) => ({
          toasts: [...state.toasts, { ...toast, id }],
        }));
        // Auto-remove after 5s
        const timer = setTimeout(() => {
          toastTimers.delete(id);
          set((state) => ({
            toasts: state.toasts.filter((t) => t.id !== id),
          }));
        }, 5000);
        toastTimers.set(id, timer);
      },

      removeToast: (id) => {
        const timer = toastTimers.get(id);
        if (timer) {
          clearTimeout(timer);
          toastTimers.delete(id);
        }
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
      },

      clearToasts: () => {
        for (const timer of toastTimers.values()) {
          clearTimeout(timer);
        }
        toastTimers.clear();
        set({ toasts: [] });
      },
    }),
    {
      name: "levelup-ui",
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    }
  )
);

// ---------------------------------------------------------------------------
// Convenience selectors
// ---------------------------------------------------------------------------

export const useSidebarCollapsed = () => useUIStore((s) => s.sidebarCollapsed);
export const useActiveModal = () => useUIStore((s) => s.activeModal);
export const useModalData = () => useUIStore((s) => s.modalData);
export const useToasts = () => useUIStore((s) => s.toasts);
