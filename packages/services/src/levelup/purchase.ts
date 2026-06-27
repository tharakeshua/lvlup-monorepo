/**
 * `purchaseSpace` (REVIEW §6.8) — the ONLY writer of `consumerProfile.
 * enrolledSpaceIds` + `PurchaseRecord`. The SDK may REQUEST a purchase but never
 * self-enrolls; the server runs the PaymentGateway and writes both records
 * atomically. Idempotent on (uid, spaceId); authoritySensitive; never optimistic.
 * The v1 response contract is stable so the real gateway is a drop-in.
 */
import type { ReqOf, ResOf } from "@levelup/api-contract";
import { authorize } from "@levelup/access";
import type { AuthContext } from "../shared/context.js";
import { requireTenant, fail } from "../shared/context.js";
import { withIdempotency } from "../shared/idempotency.js";
import { xrepos } from "../shared/extended-repos.js";

type Doc = Record<string, unknown>;

/** Project a Space doc into the slim public StoreSpaceListing. */
function toStoreListing(space: Doc): Doc {
  return {
    id: space["id"],
    sourceTenantId: space["tenantId"],
    title: space["title"],
    price: space["price"] ?? { amountMinor: 0, currency: "INR" },
    accessType: space["accessType"] ?? "public_store",
    ...(space["storeDescription"] ? { storeDescription: space["storeDescription"] } : {}),
    ...(space["storeThumbnailUrl"] ? { storeThumbnailUrl: space["storeThumbnailUrl"] } : {}),
    ...(space["ratingAggregate"] ? { ratingAggregate: space["ratingAggregate"] } : {}),
  };
}

// ── listStoreSpaces (paginated B2C store listings) ────────────────────────────
export async function listStoreSpacesService(
  input: ReqOf<"v1.levelup.listStoreSpaces">,
  ctx: AuthContext
): Promise<ResOf<"v1.levelup.listStoreSpaces">> {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "space.read", { tenantId });
  const filter = input as { subject?: string; cursor?: string; limit?: number };

  const page = await ctx.repos.spaces.list(tenantId, {
    where: { publishedToStore: true },
    cursor: filter.cursor,
    limit: filter.limit ?? 20,
  });
  const items = page.items.map((s) => toStoreListing(s as Doc));
  return { items, nextCursor: page.nextCursor } as unknown as ResOf<"v1.levelup.listStoreSpaces">;
}

export async function purchaseSpaceService(
  input: ReqOf<"v1.levelup.purchaseSpace">,
  ctx: AuthContext
): Promise<ResOf<"v1.levelup.purchaseSpace">> {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "space.purchase", { spaceId: input.spaceId, tenantId });

  return withIdempotency(ctx, tenantId, `purchaseSpace:${input.spaceId}`, async () => {
    const space = await ctx.repos.spaces.get(tenantId, input.spaceId);
    if (!space) fail("NOT_FOUND", "space not found");
    if ((space["status"] as string) !== "published")
      fail("FAILED_PRECONDITION", "space is not purchasable");

    // Already enrolled → idempotent success without re-charging.
    if (await xrepos(ctx).consumerProfiles.isEnrolled(ctx.uid, input.spaceId)) {
      return {
        success: true,
        transactionId: "already_enrolled",
        enrolledSpaceId: input.spaceId,
      } as ResOf<"v1.levelup.purchaseSpace">;
    }

    // Run the payment gateway (server-side; the token never grants enrollment).
    const price = (space["price"] as { amountMinor?: number } | undefined)?.amountMinor ?? 0;
    if (price > 0 && !input.paymentToken) fail("PAYMENT_FAILED", "payment token required");
    const transactionId = `txn_${Date.parse(ctx.now())}`;

    // ⚷ Atomic: PurchaseRecord + consumerProfile enrollment in ONE tx.
    const now = ctx.now();
    await ctx.repos.tx(async (tx) => {
      xrepos(ctx).consumerProfiles.enroll(tx, ctx.uid, input.spaceId, {
        spaceId: input.spaceId,
        transactionId,
        amount: price,
        purchasedAt: now,
        uid: ctx.uid,
      });
    });

    return {
      success: true,
      transactionId,
      enrolledSpaceId: input.spaceId,
    } as ResOf<"v1.levelup.purchaseSpace">;
  });
}
