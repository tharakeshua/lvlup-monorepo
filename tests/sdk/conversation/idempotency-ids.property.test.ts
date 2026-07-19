/**
 * T-I — Deterministic-identity + idempotency property tests (LLD §20.1 "brands/ID
 * deterministic vectors/collision mismatch", §20.2, §22.2 "same client message id
 * returns one accepted message/result", §22.5 "optimistic messages reconcile by UUID").
 *
 * Runtime-independent: exercises the pure id derivation in
 * `packages/services/src/conversation/ids.ts`. The whole exactly-once story rests
 * on these ids being a PURE FUNCTION of durable client inputs — a retry after a
 * mobile process-kill must resolve to the SAME session/turn/message document.
 */
import { describe, it, expect } from "vitest";
import {
  conversationSessionId,
  conversationTurnId,
  learnerMessageId,
  assistantMessageId,
  openingMessageId,
  conversationEvidenceId,
  itemSubmissionId,
  contextKey,
  contextBaseKey,
  makeLease,
  isLeaseExpired,
  canonicalHash,
  canonicalJson,
} from "../../../packages/services/src/conversation/ids.js";

describe("session id is a pure function of (tenant, owner, clientRequestId)", () => {
  it("identical inputs → identical id (retry after restart resolves same session)", () => {
    const a = conversationSessionId("t1", "u1", "req-abc");
    const b = conversationSessionId("t1", "u1", "req-abc");
    expect(a).toBe(b);
    expect(a).toMatch(/^c_[A-Za-z0-9_-]{26}$/);
  });

  it("any component change → different id (no cross-tenant/user/request collision)", () => {
    const base = conversationSessionId("t1", "u1", "req-abc");
    expect(conversationSessionId("t2", "u1", "req-abc")).not.toBe(base); // tenant
    expect(conversationSessionId("t1", "u2", "req-abc")).not.toBe(base); // owner
    expect(conversationSessionId("t1", "u1", "req-xyz")).not.toBe(base); // request
  });
});

describe("turn / message ids reconcile a duplicate clientMessageId to one document", () => {
  it("same (session, clientMessageId) → same turn id AND same learner message id", () => {
    expect(conversationTurnId("c_s", "msg-1")).toBe(conversationTurnId("c_s", "msg-1"));
    expect(learnerMessageId("c_s", "msg-1")).toBe(learnerMessageId("c_s", "msg-1"));
  });

  it("different clientMessageId → different ids (distinct optimistic bubbles)", () => {
    expect(conversationTurnId("c_s", "msg-1")).not.toBe(conversationTurnId("c_s", "msg-2"));
    expect(learnerMessageId("c_s", "msg-1")).not.toBe(learnerMessageId("c_s", "msg-2"));
  });

  it("turn and learner-message id namespaces never collide", () => {
    const t = conversationTurnId("c_s", "msg-1");
    const m = learnerMessageId("c_s", "msg-1");
    expect(t.startsWith("ct_")).toBe(true);
    expect(m.startsWith("cm_u_")).toBe(true);
    expect(t).not.toBe(m);
  });

  it("assistant / opening / evidence / submission ids are deterministic & namespaced", () => {
    expect(assistantMessageId("ct_x", 0)).toBe("cm_a_ct_x_0");
    expect(assistantMessageId("ct_x", 0)).not.toBe(assistantMessageId("ct_x", 1));
    expect(openingMessageId("c_s")).toBe("cm_open_c_s");
    expect(conversationEvidenceId("ct_x", 0)).toBe("ce_ct_x_0");
    expect(itemSubmissionId("c_s")).toBe(itemSubmissionId("c_s"));
    expect(itemSubmissionId("c_s")).toMatch(/^cis_/);
  });
});

describe("context keys encode the one-resumable-session policy (LLD §9/§5.1)", () => {
  it("tutor/question_help contextKey == contextBaseKey (a single resumable thread)", () => {
    const tutor = {
      kind: "tutor",
      scope: "item",
      spaceId: "s",
      storyPointId: "sp",
      itemId: "i",
    } as const;
    expect(contextKey(tutor as never)).toBe(contextBaseKey(tutor as never));
    const help = { kind: "question_help", spaceId: "s", storyPointId: "sp", itemId: "i" } as const;
    expect(contextKey(help as never)).toBe(contextBaseKey(help as never));
  });

  it("assessment contextKey appends attemptNumber so each attempt is a NEW session", () => {
    const a1 = {
      kind: "agent_assessment",
      spaceId: "s",
      storyPointId: "sp",
      itemId: "i",
      attemptNumber: 1,
    } as const;
    const a2 = {
      kind: "agent_assessment",
      spaceId: "s",
      storyPointId: "sp",
      itemId: "i",
      attemptNumber: 2,
    } as const;
    expect(contextBaseKey(a1 as never)).toBe(contextBaseKey(a2 as never)); // same base
    expect(contextKey(a1 as never)).not.toBe(contextKey(a2 as never)); // distinct attempts
    expect(contextKey(a1 as never)).toContain("attempt:1");
  });

  it("question_help distinguishes attemptId in the base key", () => {
    const withAttempt = {
      kind: "question_help",
      spaceId: "s",
      storyPointId: "sp",
      itemId: "i",
      attemptId: "att-1",
    } as const;
    const without = {
      kind: "question_help",
      spaceId: "s",
      storyPointId: "sp",
      itemId: "i",
    } as const;
    expect(contextBaseKey(withAttempt as never)).not.toBe(contextBaseKey(without as never));
  });
});

describe("lease fencing math (LLD §9.5 / §22.2 leases are fenced)", () => {
  it("a fresh lease is not expired before its window; expired after", () => {
    const lease = makeLease("req-1", "2026-07-19T00:00:00.000Z", 60_000);
    expect(isLeaseExpired(lease, "2026-07-19T00:00:30.000Z")).toBe(false);
    expect(isLeaseExpired(lease, "2026-07-19T00:01:00.001Z")).toBe(true);
  });

  it("each lease carries a unique fencing token", () => {
    const a = makeLease("req-1", "2026-07-19T00:00:00.000Z", 60_000);
    const b = makeLease("req-1", "2026-07-19T00:00:00.000Z", 60_000);
    expect(a.token).not.toBe(b.token);
  });

  it("a missing lease is treated as expired (reclaimable)", () => {
    expect(isLeaseExpired(undefined, "2026-07-19T00:00:00.000Z")).toBe(true);
  });
});

describe("canonical hashing is stable and order-independent (transcript/config freeze)", () => {
  it("key order does not change the hash", () => {
    expect(canonicalHash({ a: 1, b: 2 })).toBe(canonicalHash({ b: 2, a: 1 }));
    expect(canonicalJson({ b: 2, a: 1 })).toBe('{"a":1,"b":2}');
  });

  it("distinct payloads hash differently (collision-mismatch guard)", () => {
    expect(canonicalHash({ a: 1 })).not.toBe(canonicalHash({ a: 2 }));
  });

  it("rejects non-finite numbers rather than silently coercing", () => {
    expect(() => canonicalJson({ x: Number.NaN })).toThrow();
  });
});
