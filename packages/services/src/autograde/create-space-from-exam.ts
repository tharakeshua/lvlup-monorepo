/**
 * `createSpaceFromExamService` (EXAM-SPACE-INTEGRATION MVP §A/§B). Teacher action
 * that transforms a published exam into a learning Space:
 *
 *   1. a draft Space (type `practice`) is created,
 *   2. one StoryPoint (type `practice`) representing the exam is added,
 *   3. one Item per extracted exam question is added (best-effort mapping — every
 *      OCR'd exam question is long-form/rubric-graded, so it becomes an
 *      AI-evaluated `paragraph` question item carrying the SAME rubric the exam
 *      question is graded against; `saveItemService` extracts any answer-bearing
 *      rubric fields — `modelAnswer`/`evaluatorGuidance` — into the ⚷ answer key /
 *      authoring-only projection exactly as it does for hand-authored content),
 *   4. the Space is published (publish-ready once its story point + items exist),
 *   5. the exam is patched with `linkedSpaceId`/`linkedStoryPointId` and each exam
 *      question is patched with `linkedItemId` (bidirectional link — REVIEW
 *      `Exam.linkedSpaceId` / `UnifiedItem.linkedQuestionId`).
 *
 * Idempotent by design: an exam already carrying `linkedSpaceId` +
 * `linkedStoryPointId` short-circuits and returns the existing ids (`created:
 * false`) rather than creating a second space on a repeat click.
 *
 * Reuses the existing `@levelup/services` levelup content verbs
 * (`saveSpaceService`/`saveStoryPointService`/`saveItemService`) rather than
 * writing raw repo docs, so authorization, version-logging, publish-readiness,
 * and answer-key extraction stay single-sourced (mirrors `duplicateSpaceService`'s
 * compound-operation pattern). `tenantId` from ctx (D2).
 */
import type { ReqOf, ResOf } from "@levelup/api-contract";
import { authorize } from "@levelup/access";
import type { AuthContext } from "../shared/context.js";
import { requireTenant, fail } from "../shared/context.js";
import { listExamQuestions } from "./pipeline/questions.js";
import { saveSpaceService, saveStoryPointService, saveItemService } from "../levelup/content.js";
import { saveExamService } from "./save-exam.js";

type Req = ReqOf<"v1.autograde.createSpaceFromExam">;
type Res = ResOf<"v1.autograde.createSpaceFromExam">;

type Doc = Record<string, unknown>;

/** An exam must be published (questions extracted + locked) before conversion. */
const CONVERTIBLE_EXAM_STATUSES = new Set(["published", "grading", "results_released"]);

/** Best-effort item-attachment mapping for exam question images. */
function toAttachments(imageUrls: unknown): Doc[] | undefined {
  if (!Array.isArray(imageUrls) || imageUrls.length === 0) return undefined;
  return imageUrls.map((url, i) => ({ id: `img_${i + 1}`, type: "image", url: String(url) }));
}

export async function createSpaceFromExamService(input: Req, ctx: AuthContext): Promise<Res> {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "exam.write", { examId: input.examId, tenantId });

  const exam = await ctx.repos.exams.get(tenantId, input.examId);
  if (!exam) fail("NOT_FOUND", `exam ${input.examId} not found`);

  // Idempotent short-circuit: already converted — return the existing link.
  const existingSpaceId = exam["linkedSpaceId"] as string | undefined;
  const existingStoryPointId = exam["linkedStoryPointId"] as string | undefined;
  if (existingSpaceId && existingStoryPointId) {
    const questions = await listExamQuestions(ctx, tenantId, input.examId);
    return {
      spaceId: existingSpaceId,
      storyPointId: existingStoryPointId,
      itemsCreated: questions.filter((q) => Boolean(q["linkedItemId"])).length,
      created: false,
    } as Res;
  }

  const examStatus = (exam["status"] as string | undefined) ?? "draft";
  if (!CONVERTIBLE_EXAM_STATUSES.has(examStatus)) {
    fail(
      "FAILED_PRECONDITION",
      "exam must be published (with extracted questions) before a space can be created from it"
    );
  }

  const questions = await listExamQuestions(ctx, tenantId, input.examId);
  if (questions.length === 0) {
    fail("FAILED_PRECONDITION", "exam has no extracted questions to convert into items");
  }

  const examTitle = String(exam["title"] ?? "Exam");
  const spaceTitle = `${examTitle} — Practice`;

  // 1) Draft Space. `practice` fits the "reattempt wrong answers" MVP intent
  // (space-level assessment defaults apply cleanly to a practice story point).
  const { id: spaceId } = (await saveSpaceService(
    {
      data: {
        title: spaceTitle,
        type: "practice",
        description: `Auto-generated from the "${examTitle}" exam. Reattempt any question here to practice.`,
        subject: exam["subject"] as string | undefined,
        classIds: (exam["classIds"] as string[] | undefined) ?? [],
        accessType: "class_assigned",
        academicSessionId: exam["academicSessionId"] as string | undefined,
        evaluationSettingsId: exam["evaluationSettingsId"] as string | undefined,
      },
    } as never,
    ctx
  )) as { id: string; created: boolean };

  // 2) One StoryPoint representing the whole exam.
  const { id: storyPointId } = (await saveStoryPointService(
    {
      spaceId,
      data: {
        title: examTitle,
        description: `Questions from the "${examTitle}" exam.`,
        orderIndex: 0,
        type: "practice",
      },
    } as never,
    ctx
  )) as { id: string; created: boolean };

  // 3) One Item per exam question (best-effort mapping — see module doc).
  let itemsCreated = 0;
  for (const q of questions) {
    const questionId = String(q["id"]);
    const { id: itemId } = (await saveItemService(
      {
        spaceId,
        storyPointId,
        data: {
          type: "question",
          payload: {
            type: "question",
            basePoints: q["maxMarks"] as number | undefined,
            questionData: { questionType: "paragraph" },
          },
          content: q["text"] as string | undefined,
          orderIndex: q["order"] as number | undefined,
          rubric: q["rubric"] as Doc | undefined,
          linkedQuestionId: questionId as never,
          attachments: toAttachments(q["imageUrls"]) as never,
        },
      } as never,
      ctx
    )) as { id: string; created: boolean };
    itemsCreated += 1;

    // Bidirectional back-reference. `saveExamQuestionService`'s request schema has
    // no `linkedItemId` field (structural fields are post-publish-locked), so this
    // is a direct, minimal repo patch — `upsert` merges and never clobbers siblings.
    await ctx.repos.exams.upsert(tenantId, { id: questionId, linkedItemId: itemId });
  }

  // 4) Publish — publish-ready now that the space has a story point + items.
  await saveSpaceService({ id: spaceId, data: { status: "published" } } as never, ctx);

  // 5) Link the exam → space/storyPoint (surfaces on the exam detail page).
  await saveExamService(
    {
      id: input.examId,
      data: {
        linkedSpaceId: spaceId as never,
        linkedSpaceTitle: spaceTitle,
        linkedStoryPointId: storyPointId as never,
      },
    } as never,
    ctx
  );

  return { spaceId, storyPointId, itemsCreated, created: true } as Res;
}
