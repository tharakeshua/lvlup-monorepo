/**
 * Page / Money / Audit primitives — domain-core.md §4 + §6 + §9 row "Page/Money/Audit".
 *
 * Locks: zPageParams default limit 20 / max 100 / int≥1; zPage(item) wire shape with
 * nullable opaque cursor + optional int total; Money minor-units integer model
 * (money() rounds, addMoney throws on currency mismatch, MoneySchema rejects floats);
 * withAudit injects the 6 audit/soft-delete fields (createdAt/updatedAt/createdBy/
 * updatedBy + archivedAt nullable) and that a schema using them is strict.
 */
import { describe, it, expect } from "vitest";
import { z } from "zod";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT, asCursor, type Page } from "../primitives/page.js";
import { zPageParams, zPage, zCursor } from "../primitives/page.zod.js";
import { CURRENCIES, money, addMoney, formatMoney, type Money } from "../primitives/money.js";
import { MoneySchema, zMoney, zCurrency } from "../primitives/money.zod.js";
import { zAuditFields, zSoftDeletable, zTenantScoped, withAudit } from "../primitives/audit.zod.js";
import { zObject } from "../authoring/strict.js";

describe("pagination params (zPageParams)", () => {
  it("defaults limit to DEFAULT_PAGE_LIMIT (20) when omitted", () => {
    expect(DEFAULT_PAGE_LIMIT).toBe(20);
    expect(zPageParams.parse({}).limit).toBe(20);
  });

  it("accepts cursor + limit within [1, MAX_PAGE_LIMIT]", () => {
    expect(MAX_PAGE_LIMIT).toBe(100);
    const parsed = zPageParams.parse({ cursor: "c1", limit: 50 });
    expect(parsed.limit).toBe(50);
    expect(parsed.cursor).toBe("c1");
  });

  it("rejects limit < 1, limit > 100, and non-integer limit", () => {
    expect(zPageParams.safeParse({ limit: 0 }).success).toBe(false);
    expect(zPageParams.safeParse({ limit: 101 }).success).toBe(false);
    expect(zPageParams.safeParse({ limit: 10.5 }).success).toBe(false);
  });

  it("is strict — rejects an unknown param", () => {
    expect(zPageParams.safeParse({ limit: 20, foo: 1 }).success).toBe(false);
  });
});

describe("page response factory (zPage)", () => {
  const PageOfStrings = zPage(z.string());

  it("accepts items + nextCursor:null (end-of-stream) without total", () => {
    const page: Page<string> = { items: ["a", "b"], nextCursor: null };
    expect(PageOfStrings.safeParse(page).success).toBe(true);
  });

  it("accepts a non-null opaque cursor + optional int total", () => {
    expect(PageOfStrings.safeParse({ items: [], nextCursor: "next", total: 5 }).success).toBe(true);
  });

  it("rejects a non-integer total and an unknown extra field", () => {
    expect(PageOfStrings.safeParse({ items: [], nextCursor: null, total: 1.5 }).success).toBe(
      false
    );
    expect(PageOfStrings.safeParse({ items: [], nextCursor: null, sneaky: 1 }).success).toBe(false);
  });

  it("zCursor / asCursor produce an opaque branded cursor (string at runtime)", () => {
    expect(zCursor.parse("abc")).toBe("abc");
    expect(asCursor("abc")).toBe("abc");
  });
});

describe("Money — minor-units integer model (no float currency math)", () => {
  it("CURRENCIES contains INR and USD", () => {
    expect([...CURRENCIES].sort()).toEqual(["INR", "USD"]);
  });

  it("money() rounds to integer minor units", () => {
    expect(money(149.6, "INR")).toEqual({ amountMinor: 150, currency: "INR" });
    expect(money(100, "USD")).toEqual({ amountMinor: 100, currency: "USD" });
  });

  it("addMoney sums same-currency amounts", () => {
    const a: Money = money(100, "INR");
    const b: Money = money(250, "INR");
    expect(addMoney(a, b)).toEqual({ amountMinor: 350, currency: "INR" });
  });

  it("addMoney throws on a currency mismatch", () => {
    expect(() => addMoney(money(100, "INR"), money(100, "USD"))).toThrow(/currency mismatch/);
  });

  it("formatMoney renders minor→major", () => {
    const out = formatMoney({ amountMinor: 12345, currency: "USD" });
    expect(out).toMatch(/123\.45/);
  });

  it("MoneySchema / zMoney rejects a non-integer amountMinor and unknown currency", () => {
    expect(MoneySchema.safeParse({ amountMinor: 100, currency: "INR" }).success).toBe(true);
    expect(zMoney.safeParse({ amountMinor: 1.5, currency: "INR" }).success).toBe(false);
    expect(zMoney.safeParse({ amountMinor: 100, currency: "EUR" }).success).toBe(false);
    expect(zCurrency.safeParse("GBP").success).toBe(false);
  });

  it("MoneySchema is strict (rejects an extra field)", () => {
    expect(MoneySchema.safeParse({ amountMinor: 1, currency: "INR", symbol: "₹" }).success).toBe(
      false
    );
  });
});

describe("audit / soft-delete / tenant-scope mixins", () => {
  const TS = "2026-01-01T00:00:00.000Z";

  it("zAuditFields has the 4 audit keys; zSoftDeletable has archivedAt; zTenantScoped has tenantId", () => {
    expect(Object.keys(zAuditFields).sort()).toEqual(
      ["createdAt", "createdBy", "updatedAt", "updatedBy"].sort()
    );
    expect(Object.keys(zSoftDeletable)).toEqual(["archivedAt"]);
    expect(Object.keys(zTenantScoped)).toEqual(["tenantId"]);
  });

  it("withAudit injects all 6 audit + soft-delete fields into a shape", () => {
    const shape = withAudit({ id: zCursor });
    expect(Object.keys(shape).sort()).toEqual(
      ["archivedAt", "createdAt", "createdBy", "id", "updatedAt", "updatedBy"].sort()
    );
  });

  it("a schema authored with withAudit accepts a full audited doc and rejects a missing audit field", () => {
    const Audited = zObject(withAudit({ title: z.string() }));
    const valid = {
      title: "x",
      createdAt: TS,
      updatedAt: TS,
      createdBy: "uid_1",
      updatedBy: "uid_1",
      archivedAt: null,
    };
    expect(Audited.safeParse(valid).success).toBe(true);
    // archivedAt may be a Timestamp (set = archived) — D5 single soft-delete convention
    expect(Audited.safeParse({ ...valid, archivedAt: TS }).success).toBe(true);
    // missing an audit field fails
    const { updatedBy: _omit, ...missing } = valid;
    expect(Audited.safeParse(missing).success).toBe(false);
  });

  it("audited schema is strict — rejects a legacy soft-delete field (deleted:boolean)", () => {
    const Audited = zObject(withAudit({ title: z.string() }));
    const valid = {
      title: "x",
      createdAt: TS,
      updatedAt: TS,
      createdBy: "uid_1",
      updatedBy: "uid_1",
      archivedAt: null,
      deleted: true,
    };
    expect(Audited.safeParse(valid).success).toBe(false);
  });
});
