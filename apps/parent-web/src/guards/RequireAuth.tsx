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
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  if (!firebaseUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && (!currentMembership || !allowedRoles.includes(currentMembership.role))) {
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
