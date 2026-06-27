import { Link } from "react-router-dom";
import { useAuthStore, useCurrentUser } from "@levelup/shared-stores";
import { useSpaces } from "@levelup/query";
import { BookOpen, ShoppingBag, User } from "lucide-react";
import { LogoutButton, Skeleton } from "@levelup/shared-ui";
import type { Space } from "@levelup/shared-types";

export default function ConsumerDashboardPage() {
  const { logout } = useAuthStore();
  const user = useCurrentUser();

  const enrolledIds = user?.consumerProfile?.enrolledSpaceIds ?? [];
  const plan = user?.consumerProfile?.plan ?? "free";

  // Fetch the public catalog and narrow to the spaces this learner is enrolled in.
  const { data: spacesPage, isLoading } = useSpaces<{ items: Space[] }>(
    { status: "published" },
    { enabled: enrolledIds.length > 0 }
  );
  const enrolledSpaces = (spacesPage?.items ?? []).filter((s) => enrolledIds.includes(s.id));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Learning</h1>
          <p className="text-muted-foreground text-sm">
            Welcome, {user?.displayName || user?.email || "Learner"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/profile"
            className="hover:bg-accent inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium"
          >
            <User className="h-4 w-4" />
            Profile
          </Link>
          <LogoutButton
            onLogout={logout}
            className="hover:bg-accent inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium"
          >
            Sign Out
          </LogoutButton>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="bg-card rounded-lg border p-4">
          <p className="text-muted-foreground text-sm">Plan</p>
          <p className="text-lg font-semibold capitalize">{plan}</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <p className="text-muted-foreground text-sm">Enrolled Spaces</p>
          <p className="text-lg font-semibold">{enrolledIds.length}</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <p className="text-muted-foreground text-sm">Total Spend</p>
          <p className="text-lg font-semibold">
            ${user?.consumerProfile?.totalSpend?.toFixed(2) ?? "0.00"}
          </p>
        </div>
      </div>

      {/* Enrolled Spaces */}
      <div className="bg-card rounded-lg border">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="font-semibold">My Enrolled Spaces</h2>
          <Link
            to="/store"
            className="text-primary inline-flex items-center gap-1 text-sm hover:underline"
          >
            <ShoppingBag className="h-3.5 w-3.5" />
            Browse Store
          </Link>
        </div>

        {isLoading && (
          <div className="space-y-4 p-6">
            <div className="grid gap-4 sm:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 rounded-lg" />
              ))}
            </div>
          </div>
        )}

        {!isLoading && enrolledIds.length === 0 && (
          <div className="px-6 py-8 text-center">
            <BookOpen className="text-muted-foreground mx-auto h-10 w-10" />
            <p className="text-muted-foreground mt-3 text-sm">
              You haven't enrolled in any spaces yet.
            </p>
            <Link
              to="/store"
              className="bg-primary text-primary-foreground hover:bg-primary/90 mt-3 inline-flex h-9 items-center rounded-md px-4 text-sm font-medium"
            >
              Explore the Store
            </Link>
          </div>
        )}

        {!isLoading && (enrolledSpaces ?? []).length > 0 && (
          <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
            {(enrolledSpaces ?? []).map((space) => (
              <Link
                key={space.id}
                to={`/consumer/spaces/${space.id}`}
                className="group rounded-lg border transition-shadow hover:shadow-md"
              >
                {space.storeThumbnailUrl || space.thumbnailUrl ? (
                  <img
                    src={space.storeThumbnailUrl || space.thumbnailUrl}
                    alt={space.title}
                    loading="lazy"
                    decoding="async"
                    className="h-32 w-full rounded-t-lg object-cover"
                  />
                ) : (
                  <div className="bg-muted flex h-32 items-center justify-center rounded-t-lg">
                    <BookOpen className="text-muted-foreground h-8 w-8" />
                  </div>
                )}
                <div className="p-3">
                  <h3 className="group-hover:text-primary text-sm font-semibold">{space.title}</h3>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {space.stats?.totalStoryPoints ?? 0} lessons
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
