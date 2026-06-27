/**
 * CheckoutScreen — B2C purchase / enrollment flow for a single store space.
 *
 * Design:  docs/rebuild-spec/design/build/app/mobile-family/_build/checkout.viewjs
 *          (web prototype — translated to RN + NativeWind; its multi-line cart,
 *          toast host, confirm/clear modals and "Other states" showcase blocks
 *          are intentionally NOT replicated. This is the single-space, modal
 *          checkout the router param implies: one space in, one order summary.)
 *
 * Data:
 *   - useStoreSpace(spaceId)  → the space being purchased (title / price / tax /
 *                               total for the order summary). Read defensively
 *                               (hook data is `unknown`).
 *   - usePurchaseSpace()      → mutation that records the purchase. `isPending`
 *                               drives the Pay button spinner; `isSuccess` flips
 *                               the screen to the "You're enrolled!" success view.
 *
 * States: loading (Skeleton summary) · error (EmptyState retry → refetch) ·
 *         success (EmptyState "You're enrolled!" + Continue) · default (summary
 *         card + payment-method rows + Pay). Purchase error shows inline retry.
 */
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useStoreSpace, usePurchaseSpace } from "@levelup/query";

import {
  Badge,
  Button,
  Card,
  Divider,
  EmptyState,
  Icon,
  Screen,
  SectionHeader,
  Skeleton,
} from "../../components";
import { routes } from "../../lib/routes";

// ── defensive readers (hook data is `unknown`) ───────────────────────────────
const num = (v: unknown, d = 0): number => (typeof v === "number" && isFinite(v) ? v : d);
const str = (v: unknown, d = ""): string => (typeof v === "string" ? v : d);
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" ? (v as Record<string, unknown>) : {};

/** Pick the first defined value among candidate keys. */
const pick = (o: Record<string, unknown>, keys: string[]): unknown => {
  for (const k of keys) if (o[k] !== undefined && o[k] !== null) return o[k];
  return undefined;
};

type PaymentMethod = {
  id: string;
  label: string;
  sub: string;
  icon: string;
};

const PAYMENT_METHODS: PaymentMethod[] = [
  {
    id: "beta",
    label: "Free during beta",
    sub: "No card required yet",
    icon: "sparkles",
  },
  {
    id: "card",
    label: "Credit or debit card",
    sub: "Added at general availability",
    icon: "credit-card",
  },
];

export default function CheckoutScreen(): JSX.Element {
  const router = useRouter();
  const { spaceId = "" } = useLocalSearchParams<{ spaceId: string }>();

  const query = useStoreSpace(spaceId);
  const purchase = usePurchaseSpace();

  const [method, setMethod] = useState<string>(PAYMENT_METHODS[0]!.id);

  const space = obj(query.data);
  const title = str(pick(space, ["title", "name", "spaceName"]), "This space");
  const subject = str(pick(space, ["subject", "category", "subtitle"]));
  const currency = str(pick(space, ["currency", "currencyCode"]), "US$");
  const price = num(pick(space, ["price", "priceAmount", "amount"]), 0);
  const tax = num(pick(space, ["tax", "taxAmount", "taxes"]), 0);
  const totalRaw = pick(space, ["total", "totalAmount"]);
  const total = totalRaw !== undefined ? num(totalRaw, price + tax) : price + tax;
  const free = total <= 0;

  const money = (n: number): string => `${currency} ${n.toFixed(2)}`;

  const onPay = (): void => {
    if (!spaceId) return;
    purchase.mutate({ spaceId, method, total });
  };

  // ── success ────────────────────────────────────────────────────────────────
  if (purchase.isSuccess) {
    return (
      <Screen>
        <EmptyState
          icon="party-popper"
          title="You're enrolled!"
          body={`${title} is now in your library. Time to dive in.`}
          action={
            <Button
              variant="spark"
              block
              leadingIcon={<Icon name="graduation-cap" size={16} />}
              onPress={() => router.push(spaceId ? routes.space(spaceId) : routes.home())}
            >
              Continue
            </Button>
          }
        />
      </Screen>
    );
  }

  // ── loading ─────────────────────────────────────────────────────────────────
  if (query.isLoading) {
    return (
      <Screen>
        <Card className="gap-4 p-5">
          <Skeleton width={140} height={20} variant="text" />
          <Skeleton width="100%" height={56} variant="rect" />
          <Divider />
          <Skeleton width="60%" height={16} variant="text" />
          <Skeleton width="40%" height={16} variant="text" />
          <Skeleton width="100%" height={28} variant="rect" />
        </Card>
        <Card className="mt-4 gap-3 p-5">
          <Skeleton width={120} height={16} variant="text" />
          <Skeleton width="100%" height={48} variant="rect" />
          <Skeleton width="100%" height={48} variant="rect" />
        </Card>
        <View className="mt-4">
          <Skeleton width="100%" height={48} variant="rect" />
        </View>
      </Screen>
    );
  }

  // ── error (failed to load the order) ─────────────────────────────────────────
  if (query.isError || !spaceId) {
    return (
      <Screen>
        <EmptyState
          icon="alert-triangle"
          title="We couldn't load your order"
          body="Something went wrong fetching this space. Please try again."
          action={
            <Button
              variant="primary"
              block
              leadingIcon={<Icon name="rotate-cw" size={16} />}
              onPress={() => void query.refetch()}
            >
              Retry
            </Button>
          }
        />
      </Screen>
    );
  }

  // ── default: order summary + payment + pay ───────────────────────────────────
  return (
    <Screen>
      <Text className="font-display text-text-primary text-2xl">Checkout</Text>
      <Text className="text-text-secondary mt-1 text-sm">
        Review your space before you start learning.
      </Text>

      {/* Order summary */}
      <Card className="mt-4 gap-4 p-5">
        <SectionHeader title="Order summary" />

        <View className="flex-row items-start gap-3">
          <View
            className="bg-brand-subtle items-center justify-center rounded-lg"
            style={{ width: 48, height: 48 }}
          >
            <Text className="font-display text-brand text-lg">
              {(title.trim()[0] ?? "S").toUpperCase()}
            </Text>
          </View>
          <View className="flex-1">
            <Text className="font-display text-text-primary text-base" numberOfLines={2}>
              {title}
            </Text>
            {subject ? (
              <View className="mt-1 flex-row">
                <Badge variant="neutral">{subject}</Badge>
              </View>
            ) : null}
          </View>
          {free ? (
            <Badge variant="success" icon={<Icon name="gift" size={12} />}>
              Free
            </Badge>
          ) : (
            <Text className="text-text-primary font-mono text-base">{money(price)}</Text>
          )}
        </View>

        <Divider />

        <View className="gap-2">
          <View className="flex-row items-center justify-between">
            <Text className="text-text-secondary text-sm">Subtotal</Text>
            <Text className="text-text-primary font-mono text-sm">{money(price)}</Text>
          </View>
          <View className="flex-row items-center justify-between">
            <Text className="text-text-secondary text-sm">Taxes</Text>
            <Text className="text-text-primary font-mono text-sm">{money(tax)}</Text>
          </View>
        </View>

        <Divider />

        <View className="flex-row items-center justify-between">
          <Text className="font-display text-text-primary text-base">Total</Text>
          <Text className="text-text-primary font-mono text-xl">{money(total)}</Text>
        </View>
      </Card>

      {/* Payment method */}
      <Card className="mt-4 gap-3 p-5">
        <SectionHeader title="Payment method" />
        {PAYMENT_METHODS.map((pm) => {
          const selected = pm.id === method;
          return (
            <Pressable
              key={pm.id}
              onPress={() => setMethod(pm.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              className={`flex-row items-center gap-3 rounded-lg border p-3 ${
                selected ? "border-brand bg-brand-subtle" : "border-border-subtle bg-surface"
              }`}
            >
              <View
                className={`items-center justify-center rounded-full border-2 ${
                  selected ? "border-brand" : "border-border-strong"
                }`}
                style={{ width: 20, height: 20 }}
              >
                {selected ? (
                  <View className="bg-brand rounded-full" style={{ width: 10, height: 10 }} />
                ) : null}
              </View>
              <Icon name={pm.icon} size={18} />
              <View className="flex-1">
                <Text className="text-text-primary text-sm">{pm.label}</Text>
                <Text className="text-text-muted text-xs">{pm.sub}</Text>
              </View>
            </Pressable>
          );
        })}
      </Card>

      {/* Purchase error (inline retry) */}
      {purchase.isError ? (
        <Card className="bg-surface mt-4 gap-3 border border-red-200 p-4">
          <View className="flex-row items-center gap-2">
            <Icon name="alert-circle" size={16} color="#dc2626" />
            <Text className="text-text-primary flex-1 text-sm">
              Your payment didn't go through. No charge was made — please try again.
            </Text>
          </View>
          <Button
            variant="secondary"
            size="sm"
            block
            leadingIcon={<Icon name="rotate-cw" size={15} />}
            onPress={onPay}
          >
            Try again
          </Button>
        </Card>
      ) : null}

      {/* Pay */}
      <View className="mt-4">
        <Button
          variant="spark"
          block
          size="lg"
          loading={purchase.isPending}
          disabled={purchase.isPending}
          leadingIcon={purchase.isPending ? undefined : <Icon name="sparkles" size={16} />}
          onPress={onPay}
        >
          {purchase.isPending ? "Processing…" : free ? "Enroll now" : `Pay ${money(total)}`}
        </Button>
        <View className="mt-3 flex-row items-center justify-center gap-1.5">
          <Icon name="lock" size={13} color="#6b7280" />
          <Text className="text-text-muted text-xs">
            Secure checkout · cancel anytime before you start.
          </Text>
        </View>
      </View>
    </Screen>
  );
}
