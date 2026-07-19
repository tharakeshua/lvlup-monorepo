import { Outlet } from "react-router-dom";
import { Shield } from "lucide-react";

export default function AuthLayout() {
  return (
    <div className="flex min-h-screen">
      {/* Left branding panel — hidden on mobile */}
      <div className="bg-primary text-primary-foreground hidden flex-col justify-between p-10 lg:flex lg:w-1/2">
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6" />
          <span className="text-lg font-bold tracking-tight">LevelUp</span>
        </div>
        <div className="space-y-3">
          <h1 className="text-3xl font-bold leading-tight">
            Super Admin
            <br />
            Control Center
          </h1>
          <p className="text-primary-foreground/70 max-w-sm">
            Manage tenants, monitor system health, and configure platform-wide settings from a
            single dashboard.
          </p>
        </div>
        <p className="text-primary-foreground/50 text-xs">
          &copy; {new Date().getFullYear()} LevelUp Platform
        </p>
      </div>

      {/* Right form panel */}
      <div className="bg-background flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Mobile logo — visible only on small screens */}
          <div className="mb-8 flex items-center justify-center gap-2 lg:hidden">
            <Shield className="text-primary h-6 w-6" />
            <span className="text-lg font-bold tracking-tight">LevelUp Super Admin</span>
          </div>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
