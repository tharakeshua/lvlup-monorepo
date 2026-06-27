import { useState } from "react";
import { useAuthStore } from "@levelup/shared-stores";
import { useSpaceReviews, useSaveSpaceReview } from "@levelup/query";
import { Button, Skeleton } from "@levelup/shared-ui";
import { Star, MessageSquare, Send } from "lucide-react";
import type { SpaceRatingAggregate, SpaceReview } from "@levelup/shared-types";

interface SpaceReviewSectionProps {
  spaceId: string;
  ratingAggregate?: SpaceRatingAggregate;
}

function StarRating({
  value,
  onChange,
  readonly = false,
  size = "md",
}: {
  value: number;
  onChange?: (rating: number) => void;
  readonly?: boolean;
  size?: "sm" | "md";
}) {
  const [hover, setHover] = useState(0);
  const starSize = size === "sm" ? "h-3.5 w-3.5" : "h-5 w-5";

  return (
    <div
      className="flex items-center gap-0.5"
      role="radiogroup"
      aria-label={`Rating: ${value} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role={readonly ? undefined : "radio"}
          aria-checked={readonly ? undefined : star === value}
          disabled={readonly}
          onClick={() => onChange?.(star)}
          onMouseEnter={() => !readonly && setHover(star)}
          onMouseLeave={() => !readonly && setHover(0)}
          className={`${readonly ? "cursor-default" : "cursor-pointer hover:scale-110"} transition-transform`}
          aria-label={`${star} star${star !== 1 ? "s" : ""}`}
        >
          <Star
            className={`${starSize} ${
              star <= (hover || value)
                ? "fill-yellow-400 text-yellow-400"
                : "text-muted-foreground/30"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

export default function SpaceReviewSection({ spaceId, ratingAggregate }: SpaceReviewSectionProps) {
  const { user } = useAuthStore();
  const userId = user?.uid ?? null;
  const { data: reviewsPage, isLoading } = useSpaceReviews<{ items: SpaceReview[] }>(spaceId);
  const reviews = reviewsPage?.items;
  const saveReview = useSaveSpaceReview();

  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");

  // Find user's existing review
  const userReview = reviews?.find((r) => r.userId === userId);

  const handleSubmit = () => {
    if (rating < 1 || !userId) return;
    saveReview.mutate(
      { spaceId, rating, comment: comment.trim() || undefined },
      {
        onSuccess: () => {
          setShowForm(false);
          setRating(0);
          setComment("");
        },
      }
    );
  };

  const handleEdit = () => {
    if (userReview) {
      setRating(userReview.rating);
      setComment(userReview.comment ?? "");
    }
    setShowForm(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <MessageSquare className="text-muted-foreground h-5 w-5" />
          Reviews
        </h2>
        {ratingAggregate && ratingAggregate.totalReviews > 0 && (
          <div className="flex items-center gap-2">
            <StarRating value={Math.round(ratingAggregate.averageRating)} readonly size="sm" />
            <span className="text-sm font-medium">{ratingAggregate.averageRating}</span>
            <span className="text-muted-foreground text-xs">
              ({ratingAggregate.totalReviews} review{ratingAggregate.totalReviews !== 1 ? "s" : ""})
            </span>
          </div>
        )}
      </div>

      {/* Add/Edit Review */}
      {userId && !showForm && (
        <Button variant="outline" size="sm" onClick={handleEdit} className="gap-1.5">
          <Star className="h-3.5 w-3.5" />
          {userReview ? "Edit Your Review" : "Write a Review"}
        </Button>
      )}

      {showForm && (
        <div className="bg-card space-y-3 rounded-lg border p-4">
          <p className="text-sm font-medium">Your Rating</p>
          <StarRating value={rating} onChange={setRating} />
          <label htmlFor="review-comment" className="sr-only">
            Review comment
          </label>
          <textarea
            id="review-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share your experience (optional)"
            aria-label="Review comment"
            className="bg-background placeholder:text-muted-foreground focus:ring-ring w-full resize-none rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2"
            rows={3}
          />
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={rating < 1 || saveReview.isPending}
              className="gap-1.5"
            >
              <Send className="h-3.5 w-3.5" />
              {saveReview.isPending ? "Submitting..." : userReview ? "Update" : "Submit"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Reviews List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      ) : !reviews?.length ? (
        <p className="text-muted-foreground text-sm">No reviews yet. Be the first to review!</p>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <div key={review.id} className="bg-card space-y-1 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{review.userName ?? "Student"}</span>
                  {review.userId === userId && (
                    <span className="bg-primary/10 text-primary rounded px-1.5 py-0.5 text-[10px]">
                      You
                    </span>
                  )}
                </div>
                <StarRating value={review.rating} readonly size="sm" />
              </div>
              {review.comment && <p className="text-muted-foreground text-sm">{review.comment}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
