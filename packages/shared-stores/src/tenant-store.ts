import { create } from "zustand";
import { doc, onSnapshot } from "firebase/firestore";
import type {
  Tenant,
  TenantSettings,
  TenantFeatures,
  TenantBranding,
  TenantUsage,
} from "@levelup/shared-types";
import { getFirebaseServices } from "@levelup/shared-services";

// ---------------------------------------------------------------------------
// State interface
// ---------------------------------------------------------------------------

export interface TenantState {
  tenant: Tenant | null;
  settings: TenantSettings | null;
  features: TenantFeatures | null;
  branding: TenantBranding | null;
  usage: TenantUsage | null;
  loading: boolean;
  error: string | null;

  // Actions
  subscribe: (tenantId: string) => () => void;
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useTenantStore = create<TenantState>((set) => ({
  tenant: null,
  settings: null,
  features: null,
  branding: null,
  usage: null,
  loading: true,
  error: null,

  // ------------------------------------------------------------------
  // subscribe — listen to /tenants/{tenantId} in real-time
  // ------------------------------------------------------------------
  subscribe: (tenantId: string) => {
    set({ loading: true, error: null });

    const { db } = getFirebaseServices();
    const tenantRef = doc(db, "tenants", tenantId);

    const unsubscribe = onSnapshot(
      tenantRef,
      (snap) => {
        if (snap.exists()) {
          const tenantData = { id: snap.id, ...snap.data() } as Tenant;
          set({
            tenant: tenantData,
            settings: tenantData.settings ?? null,
            features: tenantData.features ?? null,
            branding: tenantData.branding ?? null,
            usage: tenantData.usage ?? null,
            loading: false,
            error: null,
          });
        } else {
          set({
            tenant: null,
            settings: null,
            features: null,
            branding: null,
            usage: null,
            loading: false,
            error: "Tenant not found",
          });
        }
      },
      (err) => {
        set({
          error: err instanceof Error ? err.message : "Failed to load tenant",
          loading: false,
        });
      }
    );

    return unsubscribe;
  },

  // ------------------------------------------------------------------
  // reset — clear tenant state (on logout or tenant switch)
  // ------------------------------------------------------------------
  reset: () =>
    set({
      tenant: null,
      settings: null,
      features: null,
      branding: null,
      usage: null,
      loading: true,
      error: null,
    }),
}));

// ---------------------------------------------------------------------------
// Convenience selectors
// ---------------------------------------------------------------------------

export const useTenant = () => useTenantStore((s) => s.tenant);
export const useTenantSettings = () => useTenantStore((s) => s.settings);
export const useTenantFeatures = () => useTenantStore((s) => s.features);
export const useTenantBranding = () => useTenantStore((s) => s.branding);
export const useTenantUsage = () => useTenantStore((s) => s.usage);
export const useTenantName = () => useTenantStore((s) => s.tenant?.name ?? null);
export const useIsTenantLoading = () => useTenantStore((s) => s.loading);
