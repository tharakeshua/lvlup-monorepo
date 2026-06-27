/**
 * Single ingestion path + Storage signed-URL path-scope (autograde-analytics).
 *
 * Locks:
 *   • §3.7 / C1 — `requestUploadUrl` is the only client Storage site; the signed
 *     PUT URL is server-scoped to `tenants/{ctx.tenantId}/…` with per-kind
 *     ownership. A caller CANNOT get a URL outside its own tenant/ownership.
 *   • autograde plan — `uploadAnswerSheets` is the SINGLE canonical ingestion
 *     path (scanner-allowed); the removed `onAnswerSheetUpload` GCS trigger means
 *     there is no second ingestion route.
 *   • REVIEW §6.13 — `uploadAnswerSheetsService` validates the storage path is
 *     within the caller's tenant; cross-tenant / cross-class paths are rejected.
 *
 * `requestUploadUrl` returns a `{ uploadUrl, path, expiresAt }`; the authority
 * facts we lock are: the returned `path` is always under the caller's tenant, the
 * scanner may only scope to its own class/student, and an unauthenticated caller
 * is rejected. (The signed URL itself is exercised by the transport seam; here we
 * assert the server-enforced SCOPE, the security-relevant half.)
 *
 * Self-skips when emulators/seed are unavailable.
 */
import { describe, it, beforeAll, expect } from "vitest";
import { requireFunctions } from "../../harness/per-test-setup";
import { IDS, TENANT, callAs, expectDenied } from "./_helpers";

interface UploadUrlResponse {
  uploadUrl: string;
  path: string;
  expiresAt: string;
}

describe("autograde-analytics · ingestion path + requestUploadUrl path-scope", () => {
  let skip: string | null = null;
  beforeAll(() => {
    skip = requireFunctions();
  });
  const maybe = (name: string, fn: () => Promise<void> | void) =>
    it(name, async (c) => {
      if (skip) {
        c.skip();
        return;
      }
      await fn();
    });

  // --- requestUploadUrl: returned path is ALWAYS within the caller's tenant ----

  maybe("scanner requestUploadUrl returns a path scoped to its OWN tenant", async () => {
    const res = await callAs<unknown, UploadUrlResponse>(
      "v1.autograde.requestUploadUrl",
      {
        kind: "answer-sheet",
        examId: IDS.exam,
        studentId: IDS.student,
        classId: IDS.class,
        contentType: "image/jpeg",
      },
      "scanner"
    );
    expect(res.path, "signed-URL path must be under tenants/{ctx.tenantId}/").toContain(
      `tenants/${TENANT}/`
    );
    expect(res.path, "answer-sheet path must be under the exam it targets").toContain(IDS.exam);
    expect(res.uploadUrl, "must return an upload URL").toBeTruthy();
    expect(res.expiresAt, "must return a TTL (≤10 min, server-pinned)").toBeTruthy();
  });

  maybe(
    "requestUploadUrl IGNORES any client-supplied tenant in the body (no tenantId field — D2)",
    async () => {
      // A forged `tenantId` in the body must be rejected by .strict() (unknown key).
      await expectDenied(
        "v1.autograde.requestUploadUrl",
        {
          kind: "answer-sheet",
          examId: IDS.exam,
          studentId: IDS.student,
          classId: IDS.class,
          contentType: "image/jpeg",
          tenantId: "tenant__evil",
        } as unknown,
        "scanner",
        "invalid-argument"
      );
    }
  );

  maybe(
    "scanner CANNOT request a URL for a class outside its scope (ownership scope)",
    async () => {
      // The scanner is scoped to its own classIds; a different class → permission denied.
      await expectDenied(
        "v1.autograde.requestUploadUrl",
        {
          kind: "answer-sheet",
          examId: IDS.exam,
          studentId: IDS.studentOther,
          classId: "class__not_mine",
          contentType: "image/jpeg",
        },
        "scanner",
        "permission-denied"
      );
    }
  );

  maybe("unauthenticated caller CANNOT request an upload URL", async () => {
    await expectDenied(
      "v1.autograde.requestUploadUrl",
      {
        kind: "answer-sheet",
        examId: IDS.exam,
        studentId: IDS.student,
        classId: IDS.class,
        contentType: "image/jpeg",
      },
      "public",
      "unauthenticated"
    );
  });

  maybe(
    "a STUDENT cannot request an answer-sheet upload URL (only scanner/teacher ingestion)",
    async () => {
      await expectDenied(
        "v1.autograde.requestUploadUrl",
        {
          kind: "answer-sheet",
          examId: IDS.exam,
          studentId: IDS.student,
          classId: IDS.class,
          contentType: "image/jpeg",
        },
        "student",
        "permission-denied"
      );
    }
  );

  // --- uploadAnswerSheets: single canonical ingestion path --------------------

  maybe("scanner can upload answer sheets through the single canonical callable path", async () => {
    const res = (await callAs(
      "v1.autograde.uploadAnswerSheets",
      {
        examId: IDS.exam,
        studentId: IDS.student,
        classId: IDS.class,
        imageUrls: [`tenants/${TENANT}/exams/${IDS.exam}/submissions/new/p1.jpg`],
      },
      "scanner"
    )) as { submissionId?: string };
    expect(
      res.submissionId,
      "uploadAnswerSheets must return the created submissionId"
    ).toBeTruthy();
  });

  maybe(
    "uploadAnswerSheets REJECTS image paths outside the caller tenant (§6.13 path scoping)",
    async () => {
      await expectDenied(
        "v1.autograde.uploadAnswerSheets",
        {
          examId: IDS.exam,
          studentId: IDS.student,
          classId: IDS.class,
          imageUrls: ["tenants/some_other_tenant/exams/e/submissions/s/p1.jpg"],
        },
        "scanner",
        "permission-denied"
      );
    }
  );

  maybe("uploadAnswerSheets is DENIED to an unauthenticated caller", async () => {
    await expectDenied(
      "v1.autograde.uploadAnswerSheets",
      {
        examId: IDS.exam,
        studentId: IDS.student,
        classId: IDS.class,
        imageUrls: [`tenants/${TENANT}/exams/${IDS.exam}/submissions/s/p1.jpg`],
      },
      "public",
      "unauthenticated"
    );
  });
});
