import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "@levelup/shared-stores";
import type { TenantRole } from "@levelup/shared-types";

interface RequireAuthProps {
  allowedRoles?: TenantRole[];
}

export default function RequireAuth({ allowedRoles }: RequireAuthProps) {
  const { firebaseUser, currentMembership, loading } = useAuthStore();
  const location = useLocation();

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
    // Consumer users (no tenant membership) should be redirected to consumer dashboard
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
