/**
 * `getAssignmentMatrix` (C12 — §9.2) — the class tracker grid: one row per
 * assigned content (space/exam), one cell per student with
 * `{status, completionPct}`.
 *
 * Sources (all canonical):
 *   • roster    — `students` where classIds ∋ classId
 *   • rows      — `spaces`/`exams` where classIds ∋ classId
 *   • dueAt     — LVL-2 `assignments` rows (`{contentType}_{contentId}_{classId}`)
 *   • space cells — `spaceProgress` docs keyed `{authUid}_{spaceId}`
 *   • exam cells  — `submissions` where examId, keyed by studentId
 */
import type { ReqOf, ResOf } from "@levelup/api-contract";
import { authorize } from "@levelup/access";
import type { AuthContext } from "../shared/context.js";
import { requireTenant, fail } from "../shared/context.js";
import { isTeacherish, tsOrNull } from "../shared/projections.js";
import { xrepos } from "../shared/extended-repos.js";

type Doc = Record<string, unknown>;

type CellStatus = "not_started" | "in_progress" | "completed" | "overdue";

function cellStatus(
  started: boolean,
  completed: boolean,
  dueAt: string | null,
  now: string
): CellStatus {
  if (completed) return "completed";
  if (dueAt && dueAt < now) return "overdue";
  return started ? "in_progress" : "not_started";
}

const includesClass = (classId: string) => (d: Doc) =>
  Array.isArray(d["classIds"]) && (d["classIds"] as unknown[]).map(String).includes(classId);

export async function getAssignmentMatrixService(
  input: ReqOf<"v1.analytics.getAssignmentMatrix">,
  ctx: AuthContext
): Promise<ResOf<"v1.analytics.getAssignmentMatrix">> {
  const tenantId = requireTenant(ctx);
  // The matrix exposes EVERY student's standing — teacher/staff/admin only.
  if (!ctx.isSuperAdmin && !isTeacherish(ctx)) {
    fail("PERMISSION_DENIED", "assignment matrix is a teaching-staff read");
  }
  authorize(ctx, "summary.read", { classId: input.classId, tenantId });
  const classId = String(input.classId);
  const now = ctx.now();

  // Roster (classIds is an array field → in-memory predicate, no index needed).
  const roster = (
    await ctx.repos.students.list(tenantId, { filter: includesClass(classId), limit: 500 })
  ).items as Doc[];
  const students = roster.map((s) => ({
    studentId: String(s["id"]),
    name:
      (typeof s["displayName"] === "string" && s["displayName"]) ||
      [s["firstName"], s["lastName"]].filter((p) => typeof p === "string" && p).join(" ") ||
      String(s["id"]),
  }));

  // Assigned content + the LVL-2 assignment metadata rows (dueAt).
  const [spaces, exams, assignments] = await Promise.all([
    ctx.repos.spaces.list(tenantId, { filter: includesClass(classId), limit: 200 }),
    ctx.repos.exams.list(tenantId, { filter: includesClass(classId), limit: 200 }),
    xrepos(ctx).assignments.list(tenantId, { where: { classId }, limit: 400 }),
  ]);
  const dueByContent = new Map<string, string | null>(
    (assignments.items as Doc[]).map((a) => [
      `${String(a["contentType"])}_${String(a["contentId"])}`,
      tsOrNull(a["dueAt"]),
    ])
  );

  const rows: Doc[] = [];

  // Space rows — spaceProgress docs are keyed `{authUid}_{spaceId}`.
  for (const space of spaces.items as Doc[]) {
    const spaceId = String(space["id"]);
    const dueAt = dueByContent.get(`space_${spaceId}`) ?? null;
    const cells = await Promise.all(
      roster.map(async (s) => {
        const uid = (s["authUid"] as string | undefined) ?? (s["userId"] as string | undefined);
        const progress = uid ? await ctx.repos.progress.get(tenantId, uid, spaceId) : null;
        const pct =
          typeof progress?.["percentage"] === "number" ? (progress["percentage"] as number) : 0;
        const completed = Boolean(progress?.["completedAt"]) || pct >= 100;
        return {
          studentId: String(s["id"]),
          status: cellStatus(Boolean(progress), completed, dueAt, now),
          completionPct: Math.max(0, Math.min(100, pct)),
        };
      })
    );
    rows.push({
      contentId: spaceId,
      contentTitle: String(space["title"] ?? spaceId),
      contentType: "space",
      dueAt,
      cells,
    });
  }

  // Exam rows — submissions keyed by studentId.
  for (const exam of exams.items as Doc[]) {
    const examId = String(exam["id"]);
    const dueAt = dueByContent.get(`exam_${examId}`) ?? tsOrNull(exam["examDate"]);
    const subs = (await ctx.repos.submissions.list(tenantId, { where: { examId }, limit: 500 }))
      .items as Doc[];
    const byStudent = new Map<string, Doc>(subs.map((s) => [String(s["studentId"]), s]));
    const cells = students.map((s) => {
      const sub = byStudent.get(s.studentId);
      const status = String(sub?.["status"] ?? "");
      const completed = status === "graded" || status === "released";
      const pct = typeof sub?.["percentage"] === "number" ? (sub["percentage"] as number) : 0;
      return {
        studentId: s.studentId,
        status: cellStatus(Boolean(sub), completed, dueAt, now),
        completionPct: completed ? 100 : Math.max(0, Math.min(100, pct)),
      };
    });
    rows.push({
      contentId: examId,
      contentTitle: String(exam["title"] ?? examId),
      contentType: "exam",
      dueAt,
      cells,
    });
  }

  return {
    classId: input.classId,
    students,
    rows,
  } as unknown as ResOf<"v1.analytics.getAssignmentMatrix">;
}
