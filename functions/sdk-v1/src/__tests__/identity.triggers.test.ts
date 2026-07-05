/**
 * IDN-7 pin: memberships are written by the single-writer `makeMembershipRepo`
 * at the FLAT top-level `userMemberships/{uid}_{tenantId}` collection — so
 * `onMembershipWritten` must register on the flat path (the old nested
 * `users/{uid}/memberships/{tenantId}` registration never received an event,
 * so role changes/downgrades never re-minted or revoked claims).
 *
 * uid/tenantId extraction is fields-first: the repo stamps both fields on every
 * upsert, and the composite doc id is ambiguous (tenant ids contain underscores,
 * e.g. `tenant_subhang` — a last-`_` split would be WRONG). The first-`_` id
 * split is a defensive fallback only.
 *
 * Runs with no LVLUP_COLLECTION_PREFIX (unit env) — prefixing itself is pinned
 * in @levelup/functions-adapters' on-document.prefix.test.ts.
 */
import { describe, it, expect } from "vitest";
import {
  membershipEventIdentity,
  onMembershipWritten,
  onStudentArchived,
  onClassArchived,
  onTenantDeactivated,
  onAnnouncementPublished,
} from "../identity.js";

type Endpointed = {
  __endpoint: { eventTrigger: { eventFilterPathPatterns: { document: string } } };
};

const docPath = (fn: unknown): string =>
  (fn as Endpointed).__endpoint.eventTrigger.eventFilterPathPatterns.document;

const ev = (
  membershipId: string,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null
) => ({ params: { membershipId }, before, after, id: membershipId });

describe("onMembershipWritten registration (IDN-7)", () => {
  it("listens on the FLAT top-level userMemberships collection, not the nested users path", () => {
    expect(docPath(onMembershipWritten)).toBe("userMemberships/{membershipId}");
    expect(docPath(onMembershipWritten)).not.toContain("users/");
  });

  it("keeps the other identity triggers on their repo-write paths", () => {
    expect(docPath(onStudentArchived)).toBe("tenants/{tenantId}/students/{id}");
    expect(docPath(onClassArchived)).toBe("tenants/{tenantId}/classes/{id}");
    expect(docPath(onTenantDeactivated)).toBe("tenants/{tenantId}");
    expect(docPath(onAnnouncementPublished)).toBe("tenants/{tenantId}/announcements/{id}");
  });
});

describe("membershipEventIdentity (uid/tenantId extraction)", () => {
  it("prefers the doc fields the single-writer repo always stamps", () => {
    expect(
      membershipEventIdentity(
        ev("u1_tenant_subhang", null, { uid: "u1", tenantId: "tenant_subhang" })
      )
    ).toEqual({ uid: "u1", tenantId: "tenant_subhang" });
  });

  it("reads fields from before on a delete (after=null)", () => {
    expect(
      membershipEventIdentity(
        ev("u1_tenant_subhang", { uid: "u1", tenantId: "tenant_subhang" }, null)
      )
    ).toEqual({ uid: "u1", tenantId: "tenant_subhang" });
  });

  it("falls back to a FIRST-underscore id split (tenant ids contain underscores)", () => {
    // No fields at all → the composite id is the only source. First-`_` split keeps
    // the full underscored tenant id intact; a last-`_` split would yield "subhang".
    expect(membershipEventIdentity(ev("abc123_tenant_subhang", null, {}))).toEqual({
      uid: "abc123",
      tenantId: "tenant_subhang",
    });
  });

  it("returns empty identity when neither fields nor a composite id exist", () => {
    expect(membershipEventIdentity(ev("no-separator", null, {}))).toEqual({
      uid: "",
      tenantId: "",
    });
  });
});
