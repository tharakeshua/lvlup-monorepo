import { Outlet } from "react-router-dom";

export default function AuthLayout() {
  return (
    <div className="bg-canvas flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Outlet />
      </div>
    </div>
  );
}
