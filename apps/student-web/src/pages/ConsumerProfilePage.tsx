import { useAuthStore, useCurrentUser } from "@levelup/shared-stores";
import { Link } from "react-router-dom";
import { User, CreditCard, School } from "lucide-react";
import { LogoutButton } from "@levelup/shared-ui";

export default function ConsumerProfilePage() {
  const { logout } = useAuthStore();
  const user = useCurrentUser();

  const profile = user?.consumerProfile;
  const purchases = profile?.purchaseHistory ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Profile</h1>
        <LogoutButton
          onLogout={logout}
          className="hover:bg-accent inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium"
        >
          Sign Out
        </LogoutButton>
      </div>

      {/* Account Info */}
      <div className="bg-card space-y-4 rounded-lg border p-6">
        <div className="flex items-center gap-3">
          <div className="bg-muted flex h-12 w-12 items-center justify-center rounded-full">
            <User className="text-muted-foreground h-6 w-6" />
          </div>
          <div>
            <p className="font-semibold">{user?.displayName || "Learner"}</p>
            <p className="text-muted-foreground text-sm">{user?.email || "--"}</p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <p className="text-muted-foreground text-xs">Plan</p>
            <p className="text-sm font-medium capitalize">{profile?.plan ?? "free"}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Enrolled Spaces</p>
            <p className="text-sm font-medium">{profile?.enrolledSpaceIds?.length ?? 0}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Total Spent</p>
            <p className="text-sm font-medium">
              {profile?.totalSpend ? `$${profile.totalSpend.toFixed(2)}` : "$0.00"}
            </p>
          </div>
        </div>
      </div>

      {/* Join a School CTA */}
      <div className="bg-card rounded-lg border border-dashed p-6">
        <div className="flex items-start gap-3">
          <School className="text-muted-foreground mt-0.5 h-5 w-5" />
          <div>
            <h2 className="font-semibold">Join a School</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Have a school code? Link your account to access school-specific content while keeping
              your personal learning progress.
            </p>
            <Link
              to="/login"
              className="hover:bg-accent mt-3 inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium"
            >
              Enter School Code
            </Link>
          </div>
        </div>
      </div>

      {/* Purchase History */}
      <div className="bg-card rounded-lg border">
        <div className="flex items-center gap-2 border-b px-6 py-4">
          <CreditCard className="text-muted-foreground h-4 w-4" />
          <h2 className="font-semibold">Purchase History</h2>
        </div>

        {purchases.length === 0 ? (
          <div className="text-muted-foreground px-6 py-8 text-center text-sm">
            No purchases yet.{" "}
            <Link to="/store" className="text-primary hover:underline">
              Browse the store
            </Link>{" "}
            to find spaces.
          </div>
        ) : (
          <div className="divide-y">
            {purchases.map((p, i) => (
              <div
                key={p.transactionId || i}
                className="flex items-center justify-between px-6 py-3"
              >
                <div>
                  <p className="text-sm font-medium">{p.spaceTitle}</p>
                  <p className="text-muted-foreground text-xs">
                    {p.purchasedAt && "toDate" in p.purchasedAt
                      ? p.purchasedAt.toDate().toLocaleDateString()
                      : "--"}
                  </p>
                </div>
                <span className="text-sm font-medium">
                  {p.amount === 0 ? "Free" : `${p.currency} ${p.amount}`}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
