import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "@levelup/shared-stores";
import type { TenantRole } from "@levelup/shared-types";
import { Button } from "@levelup/shared-ui";

interface RequireAuthProps {
  allowedRoles?: TenantRole[];
}

export default function RequireAuth({ allowedRoles }: RequireAuthProps) {
  const { firebaseUser, currentMembership, allMemberships, loading, switchTenant } = useAuthStore();
  const location = useLocation();
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);

  const eligible =
    allowedRoles && !currentMembership && !loading && firebaseUser
      ? allMemberships.filter((m) => m.status === "active" && allowedRoles.includes(m.role))
      : [];

  // Auto-select when exactly one eligible school membership and no active tenant.
  useEffect(() => {
    if (eligible.length !== 1 || switching || switchError) return;
    const tenantId = eligible[0]!.tenantId;
    let cancelled = false;
    setSwitching(true);
    void (async () => {
      try {
        await switchTenant(tenantId);
      } catch (err) {
        if (!cancelled) {
          setSwitchError(err instanceof Error ? err.message : "Failed to switch school");
        }
      } finally {
        if (!cancelled) setSwitching(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when eligibility collapses to one
  }, [eligible.length === 1 ? eligible[0]?.tenantId : null]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="border-primary mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-t-transparent" />
          <p className="text-muted-foreground text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!firebaseUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && (!currentMembership || !allowedRoles.includes(currentMembership.role))) {
    if (!currentMembership && eligible.length > 0) {
      const pick = async (tenantId: string) => {
        setSwitchError(null);
        setSwitching(true);
        try {
          await switchTenant(tenantId);
        } catch (err) {
          setSwitchError(err instanceof Error ? err.message : "Failed to switch school");
        } finally {
          setSwitching(false);
        }
      };

      if (eligible.length === 1) {
        return (
          <div className="flex h-screen items-center justify-center">
            <div className="text-center">
              <div className="border-primary mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-t-transparent" />
              <p className="text-muted-foreground text-sm">Connecting to your school...</p>
            </div>
          </div>
        );
      }

      return (
        <div className="flex h-screen items-center justify-center p-6">
          <div className="w-full max-w-md space-y-4 text-center">
            <h2 className="text-lg font-semibold">Select your school</h2>
            <p className="text-muted-foreground text-sm">
              Choose which school account to use for this session.
            </p>
            {switchError && (
              <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
                {switchError}
              </div>
            )}
            <div className="space-y-2">
              {eligible.map((m) => (
                <Button
                  key={m.tenantId}
                  variant="outline"
                  className="w-full"
                  disabled={switching}
                  onClick={() => void pick(m.tenantId)}
                >
                  {m.tenantCode || m.tenantId}
                </Button>
              ))}
            </div>
          </div>
        </div>
      );
    }

    // Pure consumer (no school membership) → B2C shell
    if (!currentMembership) {
      return <Navigate to="/consumer" replace />;
    }

    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-semibold">Access Denied</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            You don&apos;t have permission to access this page.
          </p>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
