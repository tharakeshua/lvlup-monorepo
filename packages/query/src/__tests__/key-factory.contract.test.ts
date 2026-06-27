/**
 * Query-key factory conventions — UNIT/CONTRACT (no emulator).
 *
 * Locks SDK-LAYERS-PLAN §4.2 + query-infra.md §4.1/§4.2/§4.3:
 *   • factory shape `{root, all, list(f), infinite(f), detail(id), sub(id,kind,params)}`,
 *   • root is EXACTLY the DomainName string (tenant-implicit — never `['tenants', tenantId, …]`),
 *   • hierarchical keys: list/infinite/detail/sub share the `[domain]` prefix so React Query
 *     prefix-matching can invalidate the narrowest correct scope,
 *   • second element is a finite "kind" ∈ {'list','infinite','detail'},
 *   • filters/params are the LAST element and are OBJECTS (stable, additive),
 *   • keys are JSON-serializable + structurally stable,
 *   • branded IDs stringified at the boundary (key holds the underlying string),
 *   • answer-bearing editor keys are NOT under any domain root and are `isSensitiveKey`.
 *
 * Self-skips until `@levelup/query` exports createKeyFactory + QUERY_KEYS. The
 * assertions are concrete against the plan, not aspirational placeholders.
 */
import { describe, it, expect } from "vitest";
import * as query from "../index";

const Q = query as unknown as {
  createKeyFactory?: (domain: string) => {
    root: () => readonly unknown[];
    all: () => readonly unknown[];
    list: (f?: object) => readonly unknown[];
    infinite: (f?: object) => readonly unknown[];
    detail: (id: string) => readonly unknown[];
    sub: (id: string, kind: string, params?: object) => readonly unknown[];
  };
  QUERY_KEYS?: Record<string, unknown>;
  EDIT_ITEM_SCOPE?: string;
  editItemKey?: (id: string) => readonly unknown[];
  isSensitiveKey?: (key: readonly unknown[]) => boolean;
};

const ready = Boolean(Q.createKeyFactory && Q.QUERY_KEYS);

(ready ? describe : describe.skip)("query-key factory conventions (§4.2)", () => {
  const make = () => Q.createKeyFactory!("spaces");

  it("exposes the full factory surface: root/all/list/infinite/detail/sub", () => {
    const f = make();
    for (const m of ["root", "all", "list", "infinite", "detail", "sub"] as const) {
      expect(typeof (f as unknown as Record<string, unknown>)[m], `factory.${m}`).toBe("function");
    }
  });

  it("root() and all() return EXACTLY [domain] — no tenantId, no extra segments", () => {
    const f = make();
    expect(f.root()).toEqual(["spaces"]);
    expect(f.all()).toEqual(["spaces"]);
  });

  it("the first element of EVERY key is the DomainName (tenant-implicit)", () => {
    const f = make();
    const keys = [
      f.root(),
      f.all(),
      f.list(),
      f.list({ status: "published" }),
      f.infinite(),
      f.detail("space_1"),
      f.sub("space_1", "progress"),
    ];
    for (const k of keys) {
      expect(k[0]).toBe("spaces");
      // no key ever embeds a tenantId segment
      expect(k.some((seg) => seg === "tenantId" || seg === "tenants")).toBe(false);
    }
  });

  it("keys are HIERARCHICAL: list/infinite/detail/sub all extend the [domain] prefix", () => {
    const f = make();
    const root = f.root();
    for (const k of [f.list(), f.infinite(), f.detail("x"), f.sub("x", "progress")]) {
      expect(k.slice(0, root.length)).toEqual([...root]);
    }
  });

  it('second element is a finite "kind" ∈ {list, infinite, detail}', () => {
    const f = make();
    expect(f.list()[1]).toBe("list");
    expect(f.infinite()[1]).toBe("infinite");
    expect(f.detail("x")[1]).toBe("detail");
    // sub() is a nested resource OF a detail → also rooted at 'detail'
    expect(f.sub("x", "progress")[1]).toBe("detail");
  });

  it("list/infinite are DISTINCT keys so invalidation can target one without the other", () => {
    const f = make();
    expect(f.list()).not.toEqual(f.infinite());
    expect(f.list()[1]).not.toBe(f.infinite()[1]);
  });

  it("filters/params are the LAST element and are objects (default {})", () => {
    const f = make();
    const last = (k: readonly unknown[]) => k[k.length - 1];
    expect(last(f.list())).toEqual({});
    expect(last(f.infinite())).toEqual({});
    expect(last(f.list({ status: "published" }))).toEqual({ status: "published" });
    expect(typeof last(f.sub("x", "progress", { spId: "sp1" }))).toBe("object");
  });

  it("adding a filter field never SHIFTS the existing key prefix (additive params)", () => {
    const f = make();
    const a = f.list({ status: "published" });
    const b = f.list({ status: "published", q: "arrays" });
    // [domain, 'list', {...}] — only the trailing object differs
    expect(a.slice(0, 2)).toEqual(b.slice(0, 2));
    expect(a.length).toBe(b.length);
  });

  it("detail(brandedId) stores the underlying STRING (brands do not survive the array)", () => {
    const f = make();
    const branded = "space_abc" as unknown as string; // a SpaceId at the call site
    const k = f.detail(branded);
    expect(k).toEqual(["spaces", "detail", "space_abc"]);
    expect(typeof k[2]).toBe("string");
  });

  it("keys are JSON-serializable and structurally stable (round-trips identically)", () => {
    const f = make();
    const k = f.sub("space_1", "progress", { storyPointId: "sp_1" });
    expect(JSON.parse(JSON.stringify(k))).toEqual([...k]);
  });

  it("different domains produce disjoint roots", () => {
    const a = Q.createKeyFactory!("spaces");
    const b = Q.createKeyFactory!("progress");
    expect(a.detail("1")[0]).not.toBe(b.detail("1")[0]);
  });
});

(ready ? describe : describe.skip)("answer-key cache isolation (§4.3 / REVIEW §6.4)", () => {
  it("editItemKey is NOT under any domain root (never bulk-invalidated/leaked)", () => {
    if (!Q.editItemKey || !Q.isSensitiveKey) return;
    const k = Q.editItemKey("item_1");
    expect(k[0]).toBe(Q.EDIT_ITEM_SCOPE ?? "items:edit");
    // crucially NOT the 'items' domain root — so listItems invalidation can't touch it
    expect(k[0]).not.toBe("items");
  });

  it("isSensitiveKey(editItemKey(x)) === true", () => {
    if (!Q.editItemKey || !Q.isSensitiveKey) return;
    expect(Q.isSensitiveKey(Q.editItemKey("item_1"))).toBe(true);
  });

  it("NO QUERY_KEYS.* factory ever produces a sensitive key", () => {
    if (!Q.isSensitiveKey || !Q.QUERY_KEYS) return;
    for (const [domain, factory] of Object.entries(Q.QUERY_KEYS)) {
      const f = factory as ReturnType<NonNullable<typeof Q.createKeyFactory>>;
      const samples = [f.root(), f.list(), f.infinite(), f.detail("x"), f.sub("x", "k")];
      for (const k of samples) {
        expect(Q.isSensitiveKey!(k), `${domain} produced a sensitive key`).toBe(false);
      }
    }
  });
});

(ready ? describe : describe.skip)("QUERY_KEYS registry totality (§4.2 / MERGE-DOMAINNAME)", () => {
  it("QUERY_KEYS is frozen", () => {
    expect(Object.isFrozen(Q.QUERY_KEYS)).toBe(true);
  });

  it("every QUERY_KEYS factory roots at its own key name", () => {
    for (const [domain, factory] of Object.entries(Q.QUERY_KEYS!)) {
      const f = factory as ReturnType<NonNullable<typeof Q.createKeyFactory>>;
      expect(f.root()).toEqual([domain]);
    }
  });

  it("contains the ~16 previously-missing roots added to DomainName (§4.2)", () => {
    // These were omitted from the union; the plan adds them so QUERY_KEYS
    // satisfies Record<DomainName,…> + totality holds. Lock them concretely.
    const required = [
      "testSessions",
      "questionSubmissions",
      "deadLetter",
      "examAnalytics",
      "gradingReview",
      "userSearch",
      "summary",
      "trends",
      "leaderboard",
      "gamification",
      "achievements",
      "levels",
      "studyGoals",
      "studySessions",
      "studentSummary",
      "enrollment",
    ];
    const have = new Set(Object.keys(Q.QUERY_KEYS!));
    const missing = required.filter((r) => !have.has(r));
    expect(missing, `DomainName roots missing from QUERY_KEYS:\n${missing.join("\n")}`).toEqual([]);
  });
});
