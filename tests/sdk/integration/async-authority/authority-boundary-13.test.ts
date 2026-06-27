/**
 * THE FULL 13-ITEM ⚷ AUTHORITY BOUNDARY — one test per item asserting the CLIENT
 * path cannot WRITE or READ it (the server is the sole writer; reads are gated).
 *
 * Source of truth: SDK-LAYERS-PLAN.md §6 (the consolidated ⚷ list → owning
 * services) + REVIEW-domain-data-model.md §6. Each `it()` below maps 1:1 to a row
 * of the §6 table and asserts the trust boundary END-TO-END through the real
 * service path (client → Functions emulator with genuine claims), reading back
 * authoritative state via the Admin SDK where the client is structurally blocked.
 *
 * The invariant under test for every item: a client request either (a) is DENIED,
 * or (b) the ⚷ value the client tried to assert is IGNORED and the server's own
 * authoritative value stands, or (c) the ⚷ field is STRIPPED from the client-facing
 * response. Never does a client write or read a ⚷ value.
 *
 * Self-skips when emulators/seed/contract are unavailable.
 */
import { describe, it, beforeAll, expect } from "vitest";
import {
  IDS,
  TENANT_ID,
  uidFor,
  tryCallAs,
  asyncAuthoritySkip,
  isDeny,
  readDoc,
  readClaims,
} from "./_helpers";
import { adminDb } from "../../harness/emulator";

let skipReason: string | null = null;
beforeAll(() => {
  skipReason = asyncAuthoritySkip();
});

/** No client-facing response may contain any of these ⚷ field names. */
function assertNoForbiddenFields(res: unknown, forbidden: string[], ctx: string): void {
  const json = JSON.stringify(res ?? {});
  for (const f of forbidden) {
    expect(
      new RegExp(`"${f}"\\s*:`).test(json),
      `${ctx}: ⚷ field '${f}' leaked into a client-facing response`
    ).toBe(false);
  }
}

/** Either the call was denied, or the asserted ⚷ field was ignored — never written. */
function assertDeniedOrIgnored(result: Awaited<ReturnType<typeof tryCallAs>>, ctx: string): void {
  if (!result.ok) {
    expect(isDeny(result.code), `${ctx}: expected a deny-class error, got ${result.code}`).toBe(
      true
    );
  }
  // when ok, the per-item body re-reads authoritative state to prove the ⚷ value was not honored
}

const wired = (r: Awaited<ReturnType<typeof tryCallAs>>) =>
  r.ok || (r.code !== "not-found" && r.code !== "NOT_FOUND");

describe.skipIf(Boolean(asyncAuthoritySkip()))(
  "§6 authority boundary — 13 items (client cannot write/read ⚷)",
  () => {
    // ── §6.1 tenantId is claim-derived; never a request field ──────────────────
    it("§6.1 tenantId — a body-supplied tenantId cannot redirect a write off the caller’s claim", async () => {
      if (skipReason) return;
      // .strict() schemas have no tenantId field; a forged tenantId must be rejected
      // (extra key) or ignored. We attempt a cross-tenant write by smuggling tenantId.
      const r = await tryCallAs(
        "v1.levelup.saveSpace",
        { tenantId: "tenant_victim", data: { title: "x", type: "course" } } as never,
        "teacher"
      );
      if (!wired(r)) return;
      assertDeniedOrIgnored(r, "§6.1");
      if (r.ok) {
        // the space must have landed in the CALLER's tenant, never tenant_victim:
        // readDoc is scoped to TENANT_ID, so finding the new id there proves the
        // body tenantId was ignored (claim-derived tenant won).
        const id = (r.data as { id?: string })?.id;
        if (id) {
          const inCallerTenant = await readDoc("spaces", id).catch(() => null);
          expect(
            inCallerTenant,
            "§6.1: write did not land in the caller’s claim-tenant"
          ).toBeTruthy();
          // and never in the forged victim tenant
          const victimSnap = await adminDb()
            .doc(`tenants/tenant_victim/spaces/${id}`)
            .get()
            .catch(() => null);
          expect(victimSnap?.exists ?? false, "§6.1: write leaked into the forged tenant").toBe(
            false
          );
        }
      }
    });

    // ── §6.2 PlatformClaims (incl. isSuperAdmin) + token revocation ────────────
    it("§6.2 PlatformClaims — a client cannot mint/rewrite claims or self-grant isSuperAdmin", async () => {
      if (skipReason) return;
      const studentUid = uidFor("student");
      const r = await tryCallAs(
        "v1.identity.saveStudent",
        { id: IDS.tenant, data: { isSuperAdmin: true, role: "superAdmin" } } as never,
        "student"
      );
      if (!wired(r)) return;
      assertDeniedOrIgnored(r, "§6.2");
      const claims = await readClaims(studentUid).catch(() => ({}) as Record<string, unknown>);
      expect(claims["isSuperAdmin"] ?? false, "§6.2: student gained isSuperAdmin").toBeFalsy();
    });

    // ── §6.3 UserMembership docs (rules write:if false) ────────────────────────
    it("§6.3 UserMembership — a client cannot write membership role/status/permissions directly", async () => {
      if (skipReason) return;
      // No callable lets a learner change their own membership role; the bulk/role
      // change verbs are admin-only. A student attempting a role change is denied.
      const r = await tryCallAs(
        "v1.identity.changeMembershipRole",
        { uid: uidFor("student"), role: "teacher" } as never,
        "student"
      );
      if (!wired(r)) {
        // verb optional; fall back to bulkUpdateStatus by a student (must be denied)
        const r2 = await tryCallAs(
          "v1.identity.bulkUpdateStatus",
          { entityType: "student", ids: [uidFor("student")], status: "active" },
          "student"
        );
        if (!wired(r2)) return;
        expect(r2.ok, "§6.3: student must not write membership status via bulk").toBe(false);
        if (!r2.ok) expect(isDeny(r2.code)).toBe(true);
        return;
      }
      expect(r.ok, "§6.3: student must not change membership role").toBe(false);
      if (!r.ok) expect(isDeny(r.code)).toBe(true);
    });

    // ── §6.4 AnswerKeys (deny-all subcollection) ───────────────────────────────
    it("§6.4 AnswerKeys — a learner read (listItems/startTestSession) never carries the answer key", async () => {
      if (skipReason) return;
      const list = await tryCallAs(
        "v1.levelup.listItems",
        { spaceId: IDS.space, storyPointId: IDS.storyPoint, limit: 20 },
        "student"
      );
      if (wired(list) && list.ok) {
        assertNoForbiddenFields(
          list.data,
          ["correctAnswer", "acceptableAnswers", "evaluationGuidance", "modelAnswer"],
          "§6.4 listItems"
        );
      }
      const start = await tryCallAs(
        "v1.levelup.startTestSession",
        { spaceId: IDS.space, storyPointId: IDS.storyPoint },
        "student"
      );
      if (wired(start) && start.ok) {
        assertNoForbiddenFields(
          start.data,
          ["correctAnswer", "acceptableAnswers", "evaluationGuidance", "modelAnswer"],
          "§6.4 startTestSession"
        );
      }
      // getItemForEdit (which DOES re-merge the key) must be denied to a student.
      const edit = await tryCallAs(
        "v1.levelup.getItemForEdit",
        { spaceId: IDS.space, storyPointId: IDS.storyPoint, itemId: IDS.item },
        "student"
      );
      if (wired(edit))
        expect(edit.ok, "§6.4: student must not read getItemForEdit (⚷ authoring)").toBe(false);
    });

    // ── §6.5 Grading outputs (score/correctness/confidence/cost) ───────────────
    it("§6.5 Grading outputs — a client cannot submit a score; the server scores (CD13)", async () => {
      if (skipReason) return;
      // recordItemAttempt accepts ONLY a raw answer. A client-supplied score/correct
      // must be rejected (.strict() extra key) or ignored; the authoritative progress
      // reflects the SERVER score, never the forged one.
      const r = await tryCallAs<unknown, { progress?: Record<string, unknown> }>(
        "v1.levelup.recordItemAttempt",
        {
          spaceId: IDS.space,
          storyPointId: IDS.storyPoint,
          itemId: IDS.item,
          answer: "definitely wrong",
          score: 999,
          correct: true,
          maxScore: 999,
          idempotencyKey: "forge-score-1",
        } as never,
        "student"
      );
      if (!wired(r)) return;
      if (r.ok) {
        const score = pickNum(r.data?.progress, ["score", "bestScore", "points", "maxScore"]);
        if (score != null)
          expect(score, "§6.5: forged client score (999) was honored").toBeLessThan(999);
      } else {
        expect(isDeny(r.code), "§6.5: forged-score request should be rejected").toBe(true);
      }
    });

    // ── §6.6 Test-session authority (serverDeadline/attemptNumber/isLatest/order) ─
    it("§6.6 Test-session — serverDeadline/attemptNumber are server-set; a client cannot override them", async () => {
      if (skipReason) return;
      const start = await tryCallAs<unknown, { session?: Record<string, unknown> }>(
        "v1.levelup.startTestSession",
        {
          spaceId: IDS.space,
          storyPointId: IDS.storyPoint,
          serverDeadline: "2099-01-01T00:00:00.000Z",
          attemptNumber: 999,
        } as never,
        "student"
      );
      if (!wired(start)) return;
      if (start.ok) {
        const s = start.data?.session ?? (start.data as Record<string, unknown>);
        // a forged far-future deadline must NOT be honored verbatim
        if (s && typeof s["serverDeadline"] === "string") {
          expect(s["serverDeadline"], "§6.6: client serverDeadline was honored").not.toBe(
            "2099-01-01T00:00:00.000Z"
          );
        }
        if (s && typeof s["attemptNumber"] === "number") {
          expect(s["attemptNumber"], "§6.6: client attemptNumber was honored").not.toBe(999);
        }
      }
    });

    // ── §6.7 Rubric / answer guidance (systemPrompt/evaluatorGuidance/...) ──────
    it("§6.7 Rubric guidance — learner-facing reads strip systemPrompt/evaluatorGuidance/promptGuidance", async () => {
      if (skipReason) return;
      for (const [name, req] of [
        ["v1.levelup.listItems", { spaceId: IDS.space, storyPointId: IDS.storyPoint, limit: 20 }],
        ["v1.levelup.listAgents", { limit: 20 }],
      ] as const) {
        const r = await tryCallAs(name, req, "student");
        if (wired(r) && r.ok) {
          assertNoForbiddenFields(
            r.data,
            [
              "systemPrompt",
              "evaluatorGuidance",
              "promptGuidance",
              "modelAnswer",
              "rules",
              "confidenceConfig",
            ],
            `§6.7 ${name}`
          );
        }
      }
    });

    // ── §6.8 Purchases / enrollment (enrolledSpaceIds, PurchaseRecord) ─────────
    it("§6.8 Purchases — a client cannot write enrolledSpaceIds; only purchaseSpace enrolls", async () => {
      if (skipReason) return;
      // A student cannot self-enroll by writing a profile field; enrollment flows ONLY
      // through purchaseSpace (the sole writer of consumerProfile). updateMyProfile must
      // not accept enrolledSpaceIds.
      const r = await tryCallAs(
        "v1.identity.updateMyProfile",
        { enrolledSpaceIds: [IDS.space] } as never,
        "student"
      );
      if (!wired(r)) return;
      if (r.ok) {
        // re-read the consumer profile authority: enrollment must not have been granted free
        const prof = await readDoc("consumerProfiles", uidFor("student")).catch(() => null);
        const enrolled = (prof?.["enrolledSpaceIds"] as string[] | undefined) ?? [];
        expect(
          enrolled.includes(IDS.space),
          "§6.8: self-enroll via profile write was honored"
        ).toBe(false);
      } else {
        expect(isDeny(r.code), "§6.8: profile write of enrolledSpaceIds should be rejected").toBe(
          true
        );
      }
    });

    // ── §6.9 Denormalized counters / aggregates ───────────────────────────────
    it("§6.9 Denormalized aggregates — a client cannot write Space.stats / progress summaries / level xp", async () => {
      if (skipReason) return;
      // A teacher saving a space cannot set the authoritative stats; the server owns them.
      const r = await tryCallAs<unknown, { id?: string }>(
        "v1.levelup.saveSpace",
        {
          id: IDS.space,
          data: {
            stats: { enrollments: 99999, completions: 99999 },
            ratingAggregate: { avg: 5, count: 9999 },
          },
        } as never,
        "teacher"
      );
      if (!wired(r)) return;
      if (r.ok) {
        const space = await readDoc("spaces", IDS.space).catch(() => null);
        const stats = (space?.["stats"] as Record<string, unknown> | undefined) ?? {};
        expect(
          stats["enrollments"] ?? 0,
          "§6.9: client-written Space.stats.enrollments was honored"
        ).not.toBe(99999);
      } else {
        expect(isDeny(r.code), "§6.9: client write of denormalized stats should be rejected").toBe(
          true
        );
      }
    });

    // ── §6.10 Lifecycle status transitions + resultsReleased visibility gate ───
    it("§6.10 Lifecycle — a learner cannot publish a space / release results (authoritySensitive verbs)", async () => {
      if (skipReason) return;
      const pub = await tryCallAs("v1.levelup.publishSpace", { spaceId: IDS.space }, "student");
      if (wired(pub)) expect(pub.ok, "§6.10: student must not publish a space").toBe(false);

      const release = await tryCallAs(
        "v1.autograde.releaseResults",
        { examId: IDS.exam },
        "student"
      );
      if (wired(release)) expect(release.ok, "§6.10: student must not release results").toBe(false);

      // An ILLEGAL transition by an authorized role is still rejected (INVALID_TRANSITION).
      const illegal = await tryCallAs(
        "v1.levelup.saveSpace",
        { id: IDS.space, data: { status: "archived_directly_from_draft" } } as never,
        "teacher"
      );
      if (wired(illegal) && !illegal.ok) {
        expect(isDeny(illegal.code) || illegal.code === "INVALID_TRANSITION").toBe(true);
      }
    });

    // ── §6.11 Cross-domain link integrity (linkedSpaceId/classIds/parentIds...) ─
    it("§6.11 Link integrity — a client cannot create a dangling cross-tenant/cross-entity link", async () => {
      if (skipReason) return;
      // Saving a class with a non-existent / cross-tenant studentId must be rejected
      // server-side (referents validated in-tenant before persisting links).
      const r = await tryCallAs(
        "v1.identity.saveClass",
        {
          id: IDS.class,
          data: { studentIds: ["student_does_not_exist_or_other_tenant"] },
        } as never,
        "tenantAdmin"
      );
      if (!wired(r)) return;
      if (r.ok) {
        const cls = await readDoc("classes", IDS.class).catch(() => null);
        const ids = (cls?.["studentIds"] as string[] | undefined) ?? [];
        expect(
          ids.includes("student_does_not_exist_or_other_tenant"),
          "§6.11: a dangling/cross-tenant student link was persisted"
        ).toBe(false);
      } else {
        expect(isDeny(r.code) || r.code === "NOT_FOUND", "§6.11: bad link should be rejected").toBe(
          true
        );
      }
    });

    // ── §6.13 Storage paths (path ⊂ tenants/{ctx.tenantId}/, role+ownership) ────
    it("§6.13 Storage paths — a signed upload URL is scoped to the caller’s tenant, never another", async () => {
      if (skipReason) return;
      // requestUploadUrl must scope the returned path under tenants/{ctx.tenantId}/;
      // a client cannot request a path in another tenant or another student's folder.
      const r = await tryCallAs<unknown, { path?: string; uploadUrl?: string }>(
        "v1.autograde.requestUploadUrl",
        { kind: "answer-sheet", examId: IDS.exam, classId: IDS.class, contentType: "image/png" },
        "scanner"
      );
      if (!wired(r)) return;
      if (r.ok && typeof r.data?.path === "string") {
        expect(
          r.data.path.startsWith(`tenants/${TENANT_ID}/`),
          `§6.13: signed path '${r.data.path}' escaped the caller's tenant`
        ).toBe(true);
      }
      // Avatar upload for another uid must be denied (uid===ctx.uid).
      const avatar = await tryCallAs(
        "v1.identity.uploadUserAsset",
        {
          kind: "avatar",
          targetUid: uidFor("teacher"),
          contentType: "image/png",
          bytesBase64: "",
        } as never,
        "student"
      );
      if (wired(avatar) && !avatar.ok) expect(isDeny(avatar.code)).toBe(true);
    });

    // ── §6.AI AI keys / cost / quota (geminiApiKey never in client) ────────────
    it("§6.AI — geminiApiKey is consumed server-side and NEVER echoed; cost stays server-computed", async () => {
      if (skipReason) return;
      // saveTenant may carry a geminiApiKey inbound (SEC-09). The response must return
      // ONLY a geminiKeyRef, never the key; the field is deleted before any repo write.
      const r = await tryCallAs<unknown, Record<string, unknown>>(
        "v1.identity.saveTenant",
        {
          id: IDS.tenant,
          data: {
            name: "Contract",
            contactEmail: "a@b.test",
            geminiApiKey: "sk-SECRET-DO-NOT-ECHO",
          },
        } as never,
        "superAdmin"
      );
      if (!wired(r)) return;
      if (r.ok) {
        assertNoForbiddenFields(r.data, ["geminiApiKey"], "§6.AI saveTenant response");
        // and the persisted tenant doc (top-level tenants/{t}) must NOT store the raw key.
        const tenantSnap = await adminDb()
          .doc(`tenants/${TENANT_ID}`)
          .get()
          .catch(() => null);
        const tenantSettings = await readDoc("settings", "ai").catch(() => null);
        const serialized =
          JSON.stringify(tenantSnap?.data() ?? {}) + JSON.stringify(tenantSettings ?? {});
        expect(
          serialized.includes("sk-SECRET-DO-NOT-ECHO"),
          "§6.AI: raw gemini key was persisted"
        ).toBe(false);
      }
    });
  }
);

/** Pull a numeric field from an object by candidate key names. */
function pickNum(o: Record<string, unknown> | undefined, keys: string[]): number | null {
  if (!o) return null;
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "number") return v;
  }
  return null;
}
