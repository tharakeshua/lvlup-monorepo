/**
 * `requestUploadUrlService` (SDK-LAYERS-PLAN §3.7 Storage seam C1). Validates the
 * caller may upload to the requested kind/exam and returns a tenant-scoped storage
 * PATH + a signed-PUT URL grant. The PATH is always under
 * `tenants/{ctx.tenantId}/...` (⚷ path-scope enforcement, REVIEW §6.13) so a
 * later `uploadAnswerSheets({imageUrls})` call passes its tenant-scope check.
 * The actual signing is done by the Storage adapter the ctx carries; here we
 * compute the deterministic scoped path + delegate signing through a ctx hook.
 */
import type { ReqOf, ResOf } from "@levelup/api-contract";
import { authorize } from "@levelup/access";
import type { AuthContext } from "../shared/context.js";
import { requireTenant, fail } from "../shared/context.js";

type Req = ReqOf<"v1.autograde.requestUploadUrl">;
type Res = ResOf<"v1.autograde.requestUploadUrl">;

/** Default signed-URL TTL (15 min) for an upload grant. */
const UPLOAD_URL_TTL_MS = 15 * 60 * 1000;

interface SignUploadHook {
  signUploadUrl(path: string, contentType: string, ttlMs: number): Promise<string>;
}

export async function requestUploadUrlService(input: Req, ctx: AuthContext): Promise<Res> {
  const tenantId = requireTenant(ctx);

  // Authorize per kind: answer-sheets allow scanner; question-paper is authoring;
  // content-source / item-media require content-management (item.write) authority.
  if (input.kind === "answer-sheet") {
    authorize(ctx, "answerSheets.upload", {
      examId: input.examId,
      classId: input.classId,
      tenantId,
    });
    // Ownership scope (§6.13): a SCANNER may only request a URL for a class it is
    // assigned to. Teacher/admin (full authoring authority) are not class-bound.
    if (
      ctx.role === "scanner" &&
      input.classId &&
      !ctx.classIds.map(String).includes(String(input.classId))
    ) {
      fail("PERMISSION_DENIED", `class ${input.classId} is outside the scanner's scope`);
    }
  } else if (input.kind === "question-paper") {
    authorize(ctx, "questions.extract", { examId: input.examId, tenantId });
  } else if (input.kind === "answer-media") {
    // Student answer media (audio/image): the ONLY learner-usable upload kind.
    // Path is pinned to ctx.uid server-side, so a student can only write their
    // own answer artifacts (the authoring kinds below stay teacher-scoped).
    authorize(ctx, "answerMedia.upload", { tenantId });
  } else {
    // content-source / item-media — content authoring authority.
    authorize(ctx, "item.write", { tenantId });
  }

  const path = buildScopedPath(tenantId, input, ctx.uid);

  const hook = (ctx as unknown as { storage?: SignUploadHook }).storage;
  const expiresAtMs = Date.parse(ctx.now()) + UPLOAD_URL_TTL_MS;
  const expiresAt = new Date(
    Number.isNaN(expiresAtMs) ? Date.now() + UPLOAD_URL_TTL_MS : expiresAtMs
  ).toISOString();
  const uploadUrl = hook
    ? await hook.signUploadUrl(path, input.contentType, UPLOAD_URL_TTL_MS)
    : `https://storage.local/${path}`; // emulator/test fallback

  return { uploadUrl, path, expiresAt } as Res;
}

/** Deterministic tenant-scoped storage path for an upload grant. */
export function buildScopedPath(tenantId: string, input: Req, uid?: string): string {
  const ext = extFor(input.contentType);
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  if (input.kind === "answer-media") {
    if (!input.spaceId) fail("INVALID_ARGUMENT", "spaceId required for answer-media upload");
    if (!input.itemId) fail("INVALID_ARGUMENT", "itemId required for answer-media upload");
    // uid-scoped so a learner can only ever write under their own answer prefix.
    const owner = uid ?? "self";
    return `tenants/${tenantId}/spaces/${input.spaceId}/items/${input.itemId}/answers/${owner}/${stamp}-${rand}.${ext}`;
  }
  if (input.kind === "question-paper") {
    if (!input.examId) fail("INVALID_ARGUMENT", "examId required for question-paper upload");
    return `tenants/${tenantId}/exams/${input.examId}/question-paper/${stamp}-${rand}.${ext}`;
  }
  if (input.kind === "content-source") {
    if (!input.spaceId) fail("INVALID_ARGUMENT", "spaceId required for content-source upload");
    return `tenants/${tenantId}/spaces/${input.spaceId}/sources/${stamp}-${rand}.${ext}`;
  }
  if (input.kind === "item-media") {
    if (!input.spaceId) fail("INVALID_ARGUMENT", "spaceId required for item-media upload");
    if (!input.itemId) fail("INVALID_ARGUMENT", "itemId required for item-media upload");
    return `tenants/${tenantId}/spaces/${input.spaceId}/items/${input.itemId}/media/${stamp}-${rand}.${ext}`;
  }
  // answer-sheet (default)
  if (!input.examId) fail("INVALID_ARGUMENT", "examId required for answer-sheet upload");
  if (!input.studentId) fail("INVALID_ARGUMENT", "studentId required for answer-sheet upload");
  return `tenants/${tenantId}/exams/${input.examId}/answer-sheets/${input.studentId}/${stamp}-${rand}.${ext}`;
}

function extFor(contentType: string): string {
  // images / docs
  if (contentType.includes("png")) return "png";
  if (contentType.includes("pdf")) return "pdf";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("heic")) return "heic";
  if (contentType.includes("gif")) return "gif";
  // audio (answer-media spoken answers)
  if (contentType.includes("mp4") || contentType.includes("m4a") || contentType.includes("aac"))
    return "m4a";
  if (contentType.includes("mpeg") || contentType.includes("mp3")) return "mp3";
  if (contentType.includes("wav")) return "wav";
  if (contentType.includes("ogg") || contentType.includes("opus")) return "ogg";
  if (contentType.includes("webm")) return "webm";
  if (contentType.includes("flac")) return "flac";
  // caf → m4a so the server's extension→mime guess (practice.ts) stays in-table.
  if (contentType.includes("caf")) return "m4a";
  return "jpg";
}
