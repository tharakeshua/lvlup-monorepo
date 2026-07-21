import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useStoreSpace, usePurchaseSpace } from "@levelup/query";
import { useAuthStore, useConsumerStore } from "@levelup/shared-stores";
import { Skeleton, Button } from "@levelup/shared-ui";
import type { Space } from "@levelup/shared-types";
import { ArrowLeft, BookOpen, Users, CheckCircle2, ShoppingCart, Tag, Star } from "lucide-react";

export default function StoreDetailPage() {
  const { spaceId } = useParams<{ spaceId: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { addToCart, removeFromCart, isInCart } = useConsumerStore();
  const [purchaseSuccess, setPurchaseSuccess] = useState(false);

  const enrolled = user?.consumerProfile?.enrolledSpaceIds?.includes(spaceId ?? "") ?? false;
  const inCart = isInCart(spaceId ?? "");

  // Fetch store listing (B2C projection). NOTE: StoreSpaceListing is a lean
  // projection — labels/subject/stats/content-preview are not part of it, so the
  // story-point content preview that the legacy firestore read provided is no
  // longer available here (flagged as a parity gap).
  // Repo unwraps `{ listing }` — hook data IS the listing.
  const { data, isLoading, error } = useStoreSpace<Space>(spaceId ?? "");
  const space = data;

  const purchase = usePurchaseSpace();

  const handlePurchase = () => {
    purchase.mutate(
      { spaceId: spaceId! },
      {
        onSuccess: () => {
          setPurchaseSuccess(true);
          useConsumerStore.getState().markPurchased([spaceId!]);
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="overflow-hidden rounded-lg border">
          <Skeleton className="h-56 w-full" />
          <div className="space-y-4 p-6">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !space) {
    return (
      <div className="space-y-4">
        <Link
          to="/store"
          className="text-primary inline-flex items-center gap-1 text-sm hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Store
        </Link>
        <div className="bg-destructive/10 text-destructive rounded-md p-4 text-sm">
          Space not found or failed to load.
        </div>
      </div>
    );
  }

  const price = space.price ?? 0;
  const currency = space.currency ?? "USD";
  const labels: string[] = space.labels ?? [];

  return (
    <div className="space-y-6">
      <Link
        to="/store"
        className="text-primary inline-flex items-center gap-1 text-sm hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Store
      </Link>

      {/* Hero */}
      <div className="bg-card overflow-hidden rounded-lg border">
        {space.storeThumbnailUrl || space.thumbnailUrl ? (
          <img
            src={space.storeThumbnailUrl || space.thumbnailUrl}
            alt={space.title}
            loading="eager"
            decoding="async"
            className="h-56 w-full object-cover"
          />
        ) : (
          <div className="bg-muted flex h-56 items-center justify-center">
            <BookOpen className="text-muted-foreground h-16 w-16" />
          </div>
        )}

        <div className="space-y-4 p-6">
          <div>
            <h1 className="text-2xl font-bold">{space.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {space.subject && (
                <span className="bg-primary/10 text-primary inline-block rounded-full px-3 py-0.5 text-xs font-medium">
                  {space.subject}
                </span>
              )}
              {labels.map((label: string) => (
                <span
                  key={label}
                  className="bg-muted inline-flex items-center gap-0.5 rounded-full px-2.5 py-0.5 text-xs"
                >
                  <Tag className="h-2.5 w-2.5" />
                  {label}
                </span>
              ))}
            </div>
          </div>

          <p className="text-muted-foreground">
            {space.storeDescription || space.description || "No description available."}
          </p>

          <div className="text-muted-foreground flex items-center gap-6 text-sm">
            <span className="flex items-center gap-1">
              <BookOpen className="h-4 w-4" />
              {space.stats?.totalStoryPoints ?? 0} modules
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              {space.stats?.totalStudents ?? 0} enrolled
            </span>
            {space.type && (
              <span className="flex items-center gap-1">
                <Star className="h-4 w-4" />
                {space.type}
              </span>
            )}
          </div>

          {/* CTA */}
          <div className="flex items-center gap-4 pt-2">
            <span className="text-2xl font-bold">
              {price === 0 ? "Free" : `${currency} ${price}`}
            </span>

            {enrolled || purchaseSuccess ? (
              <Button
                onClick={() => navigate(`/consumer/spaces/${spaceId}`)}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700"
              >
                <CheckCircle2 className="h-4 w-4" />
                Continue Learning
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Button onClick={handlePurchase} disabled={purchase.isPending}>
                  {purchase.isPending ? "Enrolling..." : price === 0 ? "Enroll Free" : "Enroll Now"}
                </Button>
                {!inCart && price > 0 && (
                  <Button
                    variant="outline"
                    onClick={() =>
                      addToCart({
                        spaceId: spaceId!,
                        title: space.title,
                        price,
                        currency,
                        thumbnailUrl: space.storeThumbnailUrl || space.thumbnailUrl || null,
                      })
                    }
                    className="gap-2"
                  >
                    <ShoppingCart className="h-4 w-4" />
                    Add to Cart
                  </Button>
                )}
                {inCart && (
                  <Button
                    variant="outline"
                    onClick={() => removeFromCart(spaceId!)}
                    className="gap-2"
                  >
                    <ShoppingCart className="h-4 w-4" />
                    Remove from Cart
                  </Button>
                )}
              </div>
            )}
          </div>

          {purchase.isError && (
            <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
              {(purchase.error as Error)?.message || "Failed to enroll. Please try again."}
            </div>
          )}

          {purchaseSuccess && (
            <div className="rounded-md bg-green-50 p-3 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
              Successfully enrolled! You can now access this space.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
