import { useState } from "react";
import { Link } from "react-router-dom";
import { usePurchaseSpace, useApiError } from "@levelup/query";
import { useConsumerStore } from "@levelup/shared-stores";
import {
  Button,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@levelup/shared-ui";
import { ArrowLeft, BookOpen, ShoppingCart, Trash2, CheckCircle2 } from "lucide-react";

export default function CheckoutPage() {
  const { cart, removeFromCart, clearCart, markPurchased, cartTotal } = useConsumerStore();
  const purchase = usePurchaseSpace();
  const { toApiError } = useApiError();
  const [purchasing, setPurchasing] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showCheckoutConfirm, setShowCheckoutConfirm] = useState(false);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setPurchasing(true);
    setErrors([]);

    const purchasedIds: string[] = [];
    const failedErrors: string[] = [];

    // Process each cart item sequentially
    for (const item of cart) {
      try {
        await purchase.mutateAsync({ spaceId: item.spaceId });
        purchasedIds.push(item.spaceId);
      } catch (err) {
        const { message } = toApiError(err);
        failedErrors.push(message || `Failed to enroll in "${item.title}"`);
      }
    }

    if (purchasedIds.length > 0) {
      markPurchased(purchasedIds);
    }

    if (failedErrors.length > 0) {
      setErrors(failedErrors);
    }

    if (failedErrors.length === 0) {
      setCompleted(true);
    }

    setPurchasing(false);
  };

  const total = cartTotal();

  if (completed) {
    return (
      <div className="flex flex-col items-center justify-center space-y-4 py-16">
        <CheckCircle2 className="h-16 w-16 text-emerald-600 dark:text-emerald-400" />
        <h1 className="text-2xl font-bold">Enrollment Complete!</h1>
        <p className="text-muted-foreground text-sm">
          You have been enrolled in all selected spaces.
        </p>
        <div className="flex items-center gap-3 pt-4">
          <Link
            to="/consumer"
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-10 items-center rounded-md px-6 text-sm font-medium"
          >
            Go to My Learning
          </Link>
          <Link
            to="/store"
            className="hover:bg-accent inline-flex h-10 items-center rounded-md border px-6 text-sm font-medium"
          >
            Continue Browsing
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        to="/store"
        className="text-primary inline-flex items-center gap-1 text-sm hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Store
      </Link>

      <div className="flex items-center gap-2">
        <ShoppingCart className="h-5 w-5" />
        <h1 className="text-2xl font-bold">Checkout</h1>
      </div>

      {errors.length > 0 && (
        <div className="bg-destructive/10 space-y-1 rounded-md p-4">
          {errors.map((err, i) => (
            <p key={i} className="text-destructive text-sm">
              {err}
            </p>
          ))}
        </div>
      )}

      {cart.length === 0 && !completed && (
        <div className="py-12 text-center">
          <ShoppingCart className="text-muted-foreground mx-auto h-12 w-12" />
          <p className="text-muted-foreground mt-3 text-sm">Your cart is empty.</p>
          <Link
            to="/store"
            className="bg-primary text-primary-foreground hover:bg-primary/90 mt-4 inline-flex h-9 items-center rounded-md px-4 text-sm font-medium"
          >
            Browse Store
          </Link>
        </div>
      )}

      {cart.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Cart Items */}
          <div className="space-y-3 lg:col-span-2">
            {cart.map((item) => (
              <div
                key={item.spaceId}
                className="bg-card flex items-center gap-4 rounded-lg border p-4"
              >
                {item.thumbnailUrl ? (
                  <img
                    src={item.thumbnailUrl}
                    alt={item.title}
                    loading="lazy"
                    decoding="async"
                    className="h-16 w-24 rounded object-cover"
                  />
                ) : (
                  <div className="bg-muted flex h-16 w-24 items-center justify-center rounded">
                    <BookOpen className="text-muted-foreground h-6 w-6" />
                  </div>
                )}
                <div className="flex-1">
                  <Link to={`/store/${item.spaceId}`} className="hover:text-primary font-medium">
                    {item.title}
                  </Link>
                  <p className="text-sm font-semibold">
                    {item.price === 0 ? "Free" : `${item.currency} ${item.price}`}
                  </p>
                </div>
                <button
                  onClick={() => removeFromCart(item.spaceId)}
                  className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive inline-flex h-8 w-8 items-center justify-center rounded-md"
                  aria-label="Remove from cart"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}

            <button
              onClick={() => setShowClearConfirm(true)}
              className="text-muted-foreground hover:text-destructive text-sm"
            >
              Clear cart
            </button>
          </div>

          {/* Order Summary */}
          <div className="bg-card h-fit space-y-4 rounded-lg border p-6">
            <h2 className="font-semibold">Order Summary</h2>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  {cart.length} {cart.length === 1 ? "space" : "spaces"}
                </span>
                <span>
                  {total === 0 ? "Free" : `${cart[0]?.currency ?? "USD"} ${total.toFixed(2)}`}
                </span>
              </div>
              <div className="flex items-center justify-between border-t pt-2 font-semibold">
                <span>Total</span>
                <span className="text-lg">
                  {total === 0 ? "Free" : `${cart[0]?.currency ?? "USD"} ${total.toFixed(2)}`}
                </span>
              </div>
            </div>
            <Button
              onClick={() => setShowCheckoutConfirm(true)}
              disabled={purchasing}
              className="w-full"
            >
              {purchasing ? "Processing..." : total === 0 ? "Enroll Now" : "Complete Purchase"}
            </Button>
            <p className="text-muted-foreground text-center text-xs">
              {total === 0
                ? "No payment required for free spaces."
                : "Payment processing coming soon. Enrollment is free during beta."}
            </p>
          </div>
        </div>
      )}

      {/* Clear cart confirmation */}
      <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear cart?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all {cart.length} item{cart.length !== 1 ? "s" : ""} from your cart.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => clearCart()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Clear Cart
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Checkout confirmation */}
      <AlertDialog open={showCheckoutConfirm} onOpenChange={setShowCheckoutConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm enrollment</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to enroll in {cart.length} space{cart.length !== 1 ? "s" : ""}.
              {total > 0 && ` Total: ${cart[0]?.currency ?? "USD"} ${total.toFixed(2)}.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleCheckout}>
              {total === 0 ? "Enroll Now" : "Complete Purchase"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
