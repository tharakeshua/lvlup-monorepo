/**
 * pagination (SDK-LAYERS-PLAN.md §3.5 / api-contract-core.md §5 + §10.6).
 *
 * Locks the unified pagination fragment every list endpoint uses:
 *   • PageRequest = { cursor?: string, limit: int.min(1).max(100).default(20) }.strict()
 *   • pageResponse(item) = { items: item[], nextCursor: string|null, total?: int≥0 }.strict()
 *   • withPaging(filter) merges paging onto a filter and stays .strict()
 *
 * Contract guarantees asserted: limit defaults to 20, hard-capped at [1,100],
 * cursors are opaque strings, `nextCursor:null` is the canonical end-of-stream,
 * strict-ness rejects stray keys on both request and response.
 *
 * Self-skips until the contract surfaces PageRequest/pageResponse/withPaging.
 */
import { describe, it, expect } from "vitest";
import { z } from "zod";
import * as contract from "../index";

const C = contract as unknown as {
  PageRequest?: z.ZodTypeAny;
  pageResponse?: (item: z.ZodTypeAny) => z.ZodTypeAny;
  withPaging?: (shape: z.ZodObject<z.ZodRawShape>) => z.ZodTypeAny;
};

const ready = Boolean(C.PageRequest && C.pageResponse);
const d = ready ? describe : describe.skip;

d("PageRequest — defaults & clamping (§5)", () => {
  const PageRequest = C.PageRequest!;

  it("parse({}) yields limit:20 (the default)", () => {
    const r = PageRequest.parse({});
    expect((r as { limit: number }).limit).toBe(20);
  });

  it("cursor is optional and accepted as an opaque string", () => {
    const r = PageRequest.parse({ cursor: "OPAQUE_BASE64==" });
    expect((r as { cursor?: string }).cursor).toBe("OPAQUE_BASE64==");
  });

  it("accepts limit at the boundaries (1 and 100)", () => {
    expect(PageRequest.safeParse({ limit: 1 }).success).toBe(true);
    expect(PageRequest.safeParse({ limit: 100 }).success).toBe(true);
  });

  it("rejects limit below 1", () => {
    expect(PageRequest.safeParse({ limit: 0 }).success).toBe(false);
    expect(PageRequest.safeParse({ limit: -5 }).success).toBe(false);
  });

  it("rejects limit above 100 (hard cap)", () => {
    expect(PageRequest.safeParse({ limit: 101 }).success).toBe(false);
    expect(PageRequest.safeParse({ limit: 1000 }).success).toBe(false);
  });

  it("rejects a non-integer limit", () => {
    expect(PageRequest.safeParse({ limit: 20.5 }).success).toBe(false);
  });

  it("is .strict() — rejects a stray key", () => {
    expect(PageRequest.safeParse({ limit: 20, page: 3 }).success).toBe(false);
  });

  it("rejects a non-string cursor", () => {
    expect(PageRequest.safeParse({ cursor: 123 }).success).toBe(false);
  });
});

d("pageResponse(item) — envelope shape (§5)", () => {
  const pageResponse = C.pageResponse!;
  const Item = z.object({ id: z.string() });
  const Page = pageResponse(Item);

  it("accepts an empty page with nextCursor:null (end-of-stream)", () => {
    expect(Page.safeParse({ items: [], nextCursor: null }).success).toBe(true);
  });

  it("accepts a populated page with a string nextCursor", () => {
    expect(
      Page.safeParse({ items: [{ id: "a" }, { id: "b" }], nextCursor: "NEXT==" }).success
    ).toBe(true);
  });

  it("accepts an optional non-negative integer total", () => {
    expect(Page.safeParse({ items: [], nextCursor: null, total: 0 }).success).toBe(true);
    expect(Page.safeParse({ items: [{ id: "a" }], nextCursor: null, total: 42 }).success).toBe(
      true
    );
  });

  it("rejects a negative total", () => {
    expect(Page.safeParse({ items: [], nextCursor: null, total: -1 }).success).toBe(false);
  });

  it("rejects a non-integer total", () => {
    expect(Page.safeParse({ items: [], nextCursor: null, total: 1.5 }).success).toBe(false);
  });

  it("rejects a MISSING nextCursor (must be present, even if null)", () => {
    expect(Page.safeParse({ items: [] }).success).toBe(false);
  });

  it("rejects a missing items array", () => {
    expect(Page.safeParse({ nextCursor: null }).success).toBe(false);
  });

  it("rejects items whose elements fail the item schema", () => {
    expect(Page.safeParse({ items: [{ id: 123 }], nextCursor: null }).success).toBe(false);
  });

  it("is .strict() — rejects a stray top-level key", () => {
    expect(Page.safeParse({ items: [], nextCursor: null, hasMore: true }).success).toBe(false);
  });

  it("nextCursor accepts string|null only (not a number/undefined)", () => {
    expect(Page.safeParse({ items: [], nextCursor: 0 }).success).toBe(false);
    expect(Page.safeParse({ items: [], nextCursor: undefined }).success).toBe(false);
  });
});

(ready && C.withPaging ? describe : describe.skip)(
  "withPaging(filter) — merge & strictness (§5)",
  () => {
    const withPaging = C.withPaging!;
    const Filtered = withPaging(
      z.object({ status: z.enum(["draft", "published"]).optional() }).strict()
    );

    it("merges paging onto a filter (filter + cursor + limit accepted)", () => {
      const r = Filtered.safeParse({ status: "draft", cursor: "C==", limit: 10 });
      expect(r.success).toBe(true);
    });

    it("applies the limit default through the merge", () => {
      const r = Filtered.parse({ status: "published" });
      expect((r as { limit: number }).limit).toBe(20);
    });

    it("keeps the filter constraints (rejects a bad filter value)", () => {
      expect(Filtered.safeParse({ status: "nope" }).success).toBe(false);
    });

    it("stays .strict() after merge (rejects a stray key)", () => {
      expect(Filtered.safeParse({ status: "draft", bogus: 1 }).success).toBe(false);
    });

    it("enforces the paging limit cap through the merge", () => {
      expect(Filtered.safeParse({ limit: 101 }).success).toBe(false);
    });
  }
);
