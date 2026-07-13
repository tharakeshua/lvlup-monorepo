/**
 * `assignContent` (LVL-2) — assign a space or an exam to one or more classes.
 *
 * Side effect: fan-out in-app notifications to assigned students and their linked
 * parents (authUid recipients) via `emitNotificationService`. Notify failures do
 * not roll back the assignment write.
 */
import type { ReqOf, ResOf } from "@levelup/api-contract";
import { authorize } from "@levelup/access";
import type { AuthContext } from "../shared/context.js";
import { requireTenant, fail } from "../shared/context.js";
import { xrepos } from "../shared/extended-repos.js";
import { emitNotificationService } from "../notification/notifications.js";

export function assignmentRowId(contentType: string, contentId: string, classId: string): string {
  return `${contentType}_${contentId}_${classId}`;
}

async function notifyAssignmentRecipients(
  input: ReqOf<"v1.levelup.assignContent">,
  target: Record<string, unknown>,
  tenantId: string,
  ctx: AuthContext
): Promise<void> {
  const studentAuthUids = new Set<string>();
  const parentAuthUids = new Set<string>();
  const parentChildName = new Map<string, string>();

  for (const classId of input.classIds) {
    const cls = await ctx.repos.classes.get(tenantId, classId);
    if (!cls) continue;
    const studentIds = Array.isArray(cls["studentIds"])
      ? (cls["studentIds"] as unknown[]).map(String)
      : [];
    for (const studentId of studentIds) {
      const student = await ctx.repos.students.get(tenantId, studentId);
      if (!student) continue;
      const childName =
        String(
          student["displayName"] ??
            `${String(student["firstName"] ?? "")} ${String(student["lastName"] ?? "")}`.trim()
        ) || "Your child";
      const studentUid =
        typeof student["authUid"] === "string" && student["authUid"]
          ? String(student["authUid"])
          : null;
      if (studentUid) studentAuthUids.add(studentUid);

      const parentIds = Array.isArray(student["parentIds"])
        ? (student["parentIds"] as unknown[]).map(String)
        : [];
      for (const parentId of parentIds) {
        const parent = await xrepos(ctx).parents.get(tenantId, parentId);
        const parentUid =
          typeof parent?.["authUid"] === "string" && parent["authUid"]
            ? String(parent["authUid"])
            : null;
        if (!parentUid) continue;
        parentAuthUids.add(parentUid);
        if (!parentChildName.has(parentUid)) parentChildName.set(parentUid, childName);
      }
    }
  }

  const contentTitle = String(target["title"] ?? "an assignment");
  const isExam = input.contentType === "exam";
  const notifType = isExam ? "new_exam_assigned" : "new_space_assigned";
  const classKey = [...input.classIds].sort().join(",");

  if (studentAuthUids.size > 0) {
    await emitNotificationService(
      {
        tenantId,
        recipientUids: [...studentAuthUids],
        recipientRole: "student",
        type: notifType,
        title: isExam ? "New Exam Assigned" : "New Space Assigned",
        body: isExam
          ? `"${contentTitle}" has been assigned to you.`
          : `"${contentTitle}" was assigned to your class.`,
        entityType: isExam ? "exam" : "space",
        entityId: input.contentId,
        actionUrl: isExam ? "/tests" : `/spaces/${input.contentId}`,
        dedupeKey: `assign:${input.contentType}:${input.contentId}:${classKey}:student`,
      },
      ctx
    );
  }

  for (const parentUid of parentAuthUids) {
    const childName = parentChildName.get(parentUid) ?? "Your child";
    await emitNotificationService(
      {
        tenantId,
        recipientUids: [parentUid],
        recipientRole: "parent",
        type: notifType,
        title: isExam ? "Test assigned to your child" : "Learning space assigned",
        body: isExam
          ? `${childName} was assigned the test "${contentTitle}".`
          : `${childName} was assigned "${contentTitle}" for test prep.`,
        entityType: isExam ? "exam" : "space",
        entityId: input.contentId,
        actionUrl: isExam ? "/results" : "/children",
        dedupeKey: `assign:${input.contentType}:${input.contentId}:${classKey}:parent:${parentUid}`,
      },
      ctx
    );
  }
}

export async function assignContentService(
  input: ReqOf<"v1.levelup.assignContent">,
  ctx: AuthContext
): Promise<ResOf<"v1.levelup.assignContent">> {
  const tenantId = requireTenant(ctx);

  const repo = input.contentType === "space" ? ctx.repos.spaces : ctx.repos.exams;
  if (input.contentType === "space") {
    authorize(ctx, "space.write", { spaceId: input.contentId, tenantId });
  } else {
    authorize(ctx, "exam.write", { examId: input.contentId, tenantId });
  }

  const target = await repo.get(tenantId, input.contentId);
  if (!target) fail("NOT_FOUND", `${input.contentType} not found`);

  const existing = Array.isArray(target["classIds"]) ? (target["classIds"] as unknown[]) : [];
  const classIds = [...new Set([...existing.map(String), ...input.classIds])];
  await repo.upsert(tenantId, { id: input.contentId, classIds, updatedBy: ctx.uid }, ctx.now());

  const now = ctx.now();
  for (const classId of input.classIds) {
    await xrepos(ctx).assignments.upsert(tenantId, {
      id: assignmentRowId(input.contentType, input.contentId, classId),
      contentType: input.contentType,
      contentId: input.contentId,
      classId,
      startAt: input.window?.startAt ?? null,
      dueAt: input.window?.dueAt ?? null,
      visibility: input.visibility ?? "visible",
      assignedBy: ctx.uid,
      assignedAt: now,
    });
  }

  try {
    await notifyAssignmentRecipients(input, target as Record<string, unknown>, tenantId, ctx);
  } catch {
    // Assignment must succeed even if notification fan-out fails.
  }

  return { id: input.contentId, created: false } as unknown as ResOf<"v1.levelup.assignContent">;
}
