/**
 * `extraction-projection` — the ONLY writer of the live question-extraction RTDB
 * ticker (`v1.autograde.extractionStatus`). Mirrors the AG-5 grading-projection
 * seam exactly.
 *
 * The extraction service projects a SLIM, SERVER-MAINTAINED status node
 * (`extractionProgress/{t}/exam/{examId}/status`) as it runs its two passes:
 *
 *   { examId, phase, totalQuestions, rubricsGenerated, mode?, error?, failedPhase?, updatedAt }
 *
 * — counters + phase only. NEVER question text / rubric / modelAnswer /
 * evaluatorGuidance / cost (the ⚷ + release-gate invariant). The UI refetches the
 * authoritative, role-filtered content via `v1.autograde.listQuestions`.
 *
 * **Seam.** Producers reach the writer as an OPTIONAL port on `ctx.repos`
 * (`extractionProjections`). The interface is declared here (services-local); the
 * concrete Admin-RTDB adapter is wired by the composition root
 * (functions-shared/bootstrap). When unwired (tests / bare emulator) every call
 * DEGRADES TO A NO-OP — extraction never fails because the ticker isn't wired.
 *
 * **Idempotency.** `setStatus` is a last-write-wins overwrite of the whole node.
 * `bumpRubrics` is a transaction-based increment (parallel Pass-2 batches complete
 * concurrently; two plain writes could lose a tick).
 */
import type { SystemContext } from "../../shared/context.js";

export type ExtractionPhase =
  | "extracting_questions"
  | "questions_extracted"
  | "generating_rubrics"
  | "complete"
  | "failed";

/** The slim per-exam extraction status projection — mirrors `ExtractionStatusSchema`. */
export interface ExtractionStatusProjection {
  examId: string;
  phase: ExtractionPhase;
  totalQuestions: number;
  rubricsGenerated: number;
  mode?: "full" | "single" | "rubrics";
  error?: string;
  failedPhase?: "questions" | "rubrics";
  updatedAt: string;
}

/**
 * RTDB projection writer port. The composition root supplies the concrete
 * Admin-RTDB adapter on `ctx.repos.extractionProjections`.
 *
 * Node layout the adapter MUST honor (so the subscription-source path resolves):
 *   • `extractionProgress/{t}/exam/{examId}/status`  ← client-read leaf
 */
export interface ExtractionProjectionPort {
  /** Overwrite the whole status node (last-write-wins; resets stale `failed`). */
  setStatus(tenantId: string, examId: string, status: ExtractionStatusProjection): Promise<void>;
  /** Atomically increment `rubricsGenerated` by `delta` (parallel-batch safe). */
  bumpRubrics(tenantId: string, examId: string, delta: number, now: string): Promise<void>;
}

interface WithExtractionProjections {
  extractionProjections?: ExtractionProjectionPort;
}

function port(ctx: SystemContext): ExtractionProjectionPort | null {
  return (ctx.repos as unknown as WithExtractionProjections).extractionProjections ?? null;
}

/** Overwrite the extraction status node. No-op when the port isn't wired. */
export async function projectExtractionStatus(
  ctx: SystemContext,
  tenantId: string,
  status: Omit<ExtractionStatusProjection, "updatedAt"> & { updatedAt?: string }
): Promise<void> {
  const p = port(ctx);
  if (!p) return;
  await p.setStatus(tenantId, status.examId, {
    ...status,
    updatedAt: status.updatedAt ?? ctx.now(),
  });
}

/** Atomically bump the rubric counter (per finished Pass-2 batch). No-op when unwired. */
export async function bumpRubricsGenerated(
  ctx: SystemContext,
  tenantId: string,
  examId: string,
  delta: number
): Promise<void> {
  const p = port(ctx);
  if (!p) return;
  await p.bumpRubrics(tenantId, examId, delta, ctx.now());
}
