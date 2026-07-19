import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useStoreSpaces } from "@levelup/query";
import { useConsumerStore, useAuthStore } from "@levelup/shared-stores";
import {
  BookOpen,
  Search,
  Users,
  ShoppingCart,
  Check,
  Tag,
  LayoutGrid,
  List,
  ArrowUpDown,
  Sparkles,
} from "lucide-react";
import {
  Button,
  Input,
  Skeleton,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@levelup/shared-ui";

interface StoreSpace {
  id: string;
  title: string;
  storeDescription: string;
  storeThumbnailUrl: string | null;
  subject: string | null;
  labels: string[];
  price: number;
  currency: string;
  totalStudents: number;
  totalStoryPoints: number;
}

type SortOption = "newest" | "popular" | "price-low" | "price-high";

export default function StoreListPage() {
  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const user = useAuthStore((s) => s.user);
  const enrolledIds = user?.consumerProfile?.enrolledSpaceIds ?? [];
  const { addToCart, removeFromCart, isInCart } = useConsumerStore();
  const cartCount = useConsumerStore((s) => s.cart.length);

  const { data, isLoading, isError } = useStoreSpaces<{
    items: StoreSpace[];
    nextCursor: string | null;
  }>({ subject: subjectFilter || undefined, limit: 50 }, { staleTime: 5 * 60 * 1000 });

  const spaces = useMemo(() => data?.items ?? [], [data?.items]);
  const hasMore = !!data?.nextCursor;

  // Dynamic subjects derived from data
  const availableSubjects = useMemo(() => {
    const subjects = new Set<string>();
    spaces.forEach((s) => {
      if (s.subject) subjects.add(s.subject);
    });
    return Array.from(subjects).sort();
  }, [spaces]);

  // Filter and sort
  const processedSpaces = useMemo(() => {
    let result = spaces;

    // Search filter
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) => s.title.toLowerCase().includes(q) || s.storeDescription.toLowerCase().includes(q)
      );
    }

    // Sort
    result = [...result];
    switch (sortBy) {
      case "popular":
        result.sort((a, b) => b.totalStudents - a.totalStudents);
        break;
      case "price-low":
        result.sort((a, b) => a.price - b.price);
        break;
      case "price-high":
        result.sort((a, b) => b.price - a.price);
        break;
      case "newest":
      default:
        // Already sorted by publishedAt desc from API
        break;
    }

    return result;
  }, [spaces, search, sortBy]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Space Store</h1>
          <p className="text-muted-foreground text-sm">Browse and enroll in learning spaces</p>
        </div>
        {cartCount > 0 && (
          <Button asChild>
            <Link to="/store/checkout" className="gap-2">
              <ShoppingCart className="h-4 w-4" />
              Cart ({cartCount})
            </Link>
          </Button>
        )}
      </div>

      {/* Search, Filters & Sort */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            type="text"
            placeholder="Search spaces..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={subjectFilter || "all"}
          onValueChange={(v) => setSubjectFilter(v === "all" ? "" : v)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Subjects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Subjects</SelectItem>
            {availableSubjects.filter(Boolean).map((subject) => (
              <SelectItem key={subject} value={subject}>
                {subject}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
          <SelectTrigger className="w-[160px]">
            <ArrowUpDown className="mr-1.5 h-3.5 w-3.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="popular">Most Popular</SelectItem>
            <SelectItem value="price-low">Price: Low to High</SelectItem>
            <SelectItem value="price-high">Price: High to Low</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex rounded-lg border p-0.5">
          <button
            onClick={() => setViewMode("grid")}
            className={`rounded-md p-1.5 ${viewMode === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            aria-label="Grid view"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`rounded-md p-1.5 ${viewMode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            aria-label="List view"
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Loading / Error */}
      {isLoading && (
        <div
          className={viewMode === "grid" ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3" : "space-y-3"}
        >
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="rounded-lg border">
              {viewMode === "grid" && <Skeleton className="h-40 rounded-t-lg" />}
              <div className="space-y-2 p-4">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="mt-2 h-8 w-full" />
              </div>
            </div>
          ))}
        </div>
      )}
      {isError && (
        <div className="bg-destructive/10 text-destructive rounded-md p-4 text-sm">
          Failed to load store spaces. Please try again.
        </div>
      )}

      {/* Empty state */}
      {!isLoading && processedSpaces.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
          <Sparkles className="text-muted-foreground h-10 w-10" />
          <p className="mt-3 text-sm font-medium">No spaces found</p>
          <p className="text-muted-foreground mt-1 text-xs">
            {search
              ? "Try adjusting your search or filters"
              : subjectFilter
                ? "No spaces available for this subject yet"
                : "New spaces are added regularly. Check back soon!"}
          </p>
          {(search || subjectFilter) && (
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => {
                setSearch("");
                setSubjectFilter("");
              }}
            >
              Clear Filters
            </Button>
          )}
        </div>
      )}

      {/* Space Grid/List */}
      <div
        className={viewMode === "grid" ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3" : "space-y-3"}
      >
        {processedSpaces.map((space) => {
          const isEnrolled = enrolledIds.includes(space.id);
          const inCart = isInCart(space.id);

          if (viewMode === "list") {
            return (
              <div
                key={space.id}
                className="bg-card flex items-center gap-4 rounded-lg border p-4 transition-shadow hover:shadow-sm"
              >
                <Link to={`/store/${space.id}`} className="flex-shrink-0">
                  {space.storeThumbnailUrl ? (
                    <img
                      src={space.storeThumbnailUrl}
                      alt={space.title}
                      loading="lazy"
                      decoding="async"
                      className="h-20 w-28 rounded-md object-cover"
                    />
                  ) : (
                    <div className="bg-muted flex h-20 w-28 items-center justify-center rounded-md">
                      <BookOpen className="text-muted-foreground h-6 w-6" />
                    </div>
                  )}
                </Link>
                <div className="min-w-0 flex-1">
                  <Link to={`/store/${space.id}`}>
                    <h3 className="hover:text-primary truncate font-semibold">{space.title}</h3>
                  </Link>
                  <p className="text-muted-foreground line-clamp-1 text-sm">
                    {space.storeDescription}
                  </p>
                  <div className="text-muted-foreground mt-1 flex items-center gap-3 text-xs">
                    {space.subject && <span>{space.subject}</span>}
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {space.totalStudents}
                    </span>
                    <span>{space.totalStoryPoints} lessons</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="font-bold">
                    {space.price === 0 ? "Free" : `${space.currency} ${space.price}`}
                  </span>
                  {isEnrolled ? (
                    <Button variant="secondary" size="sm" asChild>
                      <Link to={`/consumer/spaces/${space.id}`}>
                        <Check className="h-3 w-3" /> Continue
                      </Link>
                    </Button>
                  ) : inCart ? (
                    <Button variant="outline" size="sm" onClick={() => removeFromCart(space.id)}>
                      Remove
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() =>
                        addToCart({
                          spaceId: space.id,
                          title: space.title,
                          price: space.price,
                          currency: space.currency,
                          thumbnailUrl: space.storeThumbnailUrl,
                        })
                      }
                    >
                      {space.price === 0 ? "Enroll Free" : "Add to Cart"}
                    </Button>
                  )}
                </div>
              </div>
            );
          }

          return (
            <div
              key={space.id}
              className="bg-card group rounded-lg border transition-shadow hover:shadow-md"
            >
              <Link to={`/store/${space.id}`}>
                {space.storeThumbnailUrl ? (
                  <img
                    src={space.storeThumbnailUrl}
                    alt={space.title}
                    loading="lazy"
                    decoding="async"
                    className="h-40 w-full rounded-t-lg object-cover"
                  />
                ) : (
                  <div className="bg-muted flex h-40 items-center justify-center rounded-t-lg">
                    <BookOpen className="text-muted-foreground h-10 w-10" />
                  </div>
                )}
              </Link>
              <div className="space-y-2 p-4">
                <Link to={`/store/${space.id}`}>
                  <h3 className="group-hover:text-primary font-semibold">{space.title}</h3>
                </Link>
                <p className="text-muted-foreground line-clamp-2 text-sm">
                  {space.storeDescription}
                </p>

                {/* Labels */}
                {space.labels.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {space.labels.slice(0, 3).map((label) => (
                      <span
                        key={label}
                        className="bg-muted inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs"
                      >
                        <Tag className="h-2.5 w-2.5" />
                        {label}
                      </span>
                    ))}
                    {space.labels.length > 3 && (
                      <span className="text-muted-foreground text-xs">
                        +{space.labels.length - 3}
                      </span>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  <span className="text-lg font-bold">
                    {space.price === 0 ? "Free" : `${space.currency} ${space.price}`}
                  </span>
                  <div className="text-muted-foreground flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {space.totalStudents}
                    </span>
                    <span className="flex items-center gap-1">
                      <BookOpen className="h-3.5 w-3.5" />
                      {space.totalStoryPoints} lessons
                    </span>
                  </div>
                </div>

                {space.subject && (
                  <span className="bg-muted inline-block rounded-full px-2.5 py-0.5 text-xs">
                    {space.subject}
                  </span>
                )}

                {/* Action Button */}
                <div className="pt-1">
                  {isEnrolled ? (
                    <Button variant="secondary" size="sm" className="w-full gap-1.5" asChild>
                      <Link to={`/consumer/spaces/${space.id}`}>
                        <Check className="h-3.5 w-3.5" />
                        Continue Learning
                      </Link>
                    </Button>
                  ) : inCart ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-1.5"
                      onClick={() => removeFromCart(space.id)}
                    >
                      <ShoppingCart className="h-3.5 w-3.5" />
                      Remove from Cart
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="w-full gap-1.5"
                      onClick={() =>
                        addToCart({
                          spaceId: space.id,
                          title: space.title,
                          price: space.price,
                          currency: space.currency,
                          thumbnailUrl: space.storeThumbnailUrl,
                        })
                      }
                    >
                      <ShoppingCart className="h-3.5 w-3.5" />
                      {space.price === 0 ? "Enroll Free" : "Add to Cart"}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Load More */}
      {hasMore && (
        <div className="text-center">
          <Button variant="outline" asChild>
            <Link to={`/store?after=${data?.nextCursor}`}>Load more spaces</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
