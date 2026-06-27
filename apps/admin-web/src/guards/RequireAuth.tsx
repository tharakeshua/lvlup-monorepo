import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Skeleton } from "@levelup/shared-ui";
import type { TenantRole } from "@levelup/shared-types";
import { useSession, useCurrentMembership, useCurrentTenantId } from "@/sdk/identity";

interface RequireAuthProps {
  allowedRoles?: TenantRole[];
}

export default function RequireAuth({ allowedRoles }: RequireAuthProps) {
  const { user: firebaseUser, loading } = useSession();
  const currentMembership = useCurrentMembership();
  const currentTenantId = useCurrentTenantId();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-screen">
        {/* Sidebar skeleton */}
        <div className="bg-sidebar hidden w-64 space-y-4 border-r p-4 md:block">
          <Skeleton className="h-8 w-32" />
          <div className="mt-6 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        </div>
        {/* Content skeleton */}
        <div className="flex-1 space-y-4 p-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
          <div className="mt-6 grid grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!firebaseUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (
    allowedRoles &&
    (!currentMembership ||
      !allowedRoles.includes(currentMembership.role as TenantRole) ||
      currentMembership.tenantId !== currentTenantId)
  ) {
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
