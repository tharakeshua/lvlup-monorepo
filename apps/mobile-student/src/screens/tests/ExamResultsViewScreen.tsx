/**
 * Exam results view (B2B / AutoGrade physical exams). Keyed by `examId`.
 *
 * Reads `useExam(examId)` for the paper + `useSubmissions({ examId })` for the
 * student's OWN graded submission (sanitized projection — scan crops, feedback,
 * rubric, "graded by" provenance; never the answer key). Results are gated:
 * until the teacher releases them no score reaches the device, so we render a
 * calm "not ready" state. All reads are defensive and timestamps coerced
 * (Firestore Timestamp | ISO | epoch — REAL-DATA fallback §2.4).
 */
import { useMemo, useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";

import { useExam, useExamQuestions, useQuestionSubmissions, useSubmissions } from "@levelup/query";

import {
  Accordion,
  Badge,
  Button,
  Chip,
  ContentRenderer,
  EmptyState,
  Icon,
  Modal,
  ProgressRing,
  Screen,
  Skeleton,
} from "../../components";
import {
  AnswerKeyLock,
  ConfidenceBadge,
  InsightCard,
  Panel,
  RubricBreakdown,
  flattenPages,
  gradeTone,
  useExamParams,
  useTestNav,
} from "./_components";

type Dict = Record<string, unknown>;
const o = (v: unknown): Dict => (v && typeof v === "object" ? (v as Dict) : {});
const n = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;
const s = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);

function coerceDate(t: unknown): Date | null {
  if (!t) return null;
  const withToDate = t as { toDate?: () => Date };
  if (typeof withToDate.toDate === "function") return withToDate.toDate();
  if (typeof t === "string" || typeof t === "number") return new Date(t);
  return null;
}

const STATUS_META: Record<string, { icon: string; label: string; variant: "success" | "warning" }> =
  {
    full: { icon: "check-circle", label: "Full marks", variant: "success" },
    almost: { icon: "sparkles", label: "Almost there", variant: "success" },
    partial: { icon: "compass", label: "Partial credit", variant: "warning" },
    look: { icon: "compass", label: "Let's look again", variant: "warning" },
  };

interface ExamQuestionVM {
  n: number;
  marks: number;
  max: number;
  status: keyof typeof STATUS_META;
  prompt: string;
  /** Scanned-answer page image URLs (mapping.imageUrls) — the learner's own sheet. */
  scanUrls: string[];
  feedback: string;
  gradedBy: string;
  grow?: string;
  rubric?: { label: string; desc?: string; score: number; max: number }[];
  manualOverride?: boolean;
}

interface QMeta {
  text?: string;
  order?: number;
  maxMarks?: number;
}

/**
 * The AI grader's headline verdict is stored as `{ keyTakeaway, overallComment }`
 * (EvaluationSummarySchema). A legacy STRING summary may still arrive from a
 * not-yet-redeployed backend, so read both shapes.
 */
function readEvalSummary(v: unknown): string | undefined {
  if (typeof v === "string") return v;
  const obj = o(v);
  return s(obj.overallComment) ?? s(obj.keyTakeaway);
}

/**
 * Map `listQuestionSubmissions` rows (QuestionSubmissionView) into the per-question
 * view model, joining question text/order from `listQuestions` (ExamQuestionView)
 * by `questionId`. Per-question marks come from `evaluation.{score,maxScore}`;
 * rubric criteria from `evaluation.rubricBreakdown` (`criterionName` + `comment`);
 * the scanned answer from `mapping.imageUrls`. All reads defensive.
 */
function readExamQuestions(list: unknown[], meta: Record<string, QMeta>): ExamQuestionVM[] {
  const rows = list.map((raw) => {
    const q = o(raw);
    const evalr = o(q.evaluation);
    const mapping = o(q.mapping);
    const m = meta[s(q.questionId) ?? ""] ?? {};
    const marks = n(evalr.score) ?? 0;
    const max = n(evalr.maxScore) ?? n(m.maxMarks) ?? 0;
    const ratio = max > 0 ? marks / max : 0;
    const status: keyof typeof STATUS_META =
      ratio >= 1 ? "full" : ratio >= 0.75 ? "almost" : ratio > 0 ? "partial" : "look";
    const rubricSrc = Array.isArray(evalr.rubricBreakdown)
      ? (evalr.rubricBreakdown as unknown[])
      : [];
    const weaknesses = Array.isArray(evalr.weaknesses) ? (evalr.weaknesses as unknown[]) : [];
    const scanUrls = Array.isArray(mapping.imageUrls)
      ? (mapping.imageUrls as unknown[]).map(String).filter((u) => /^https?:\/\//.test(u))
      : [];
    const manualOverride = q.manualOverride != null && typeof q.manualOverride === "object";
    const confidence = n(evalr.confidence);
    return {
      order: n(m.order) ?? Number.MAX_SAFE_INTEGER,
      n: 0,
      marks,
      max,
      status,
      prompt: s(m.text) ?? "",
      scanUrls,
      feedback: readEvalSummary(evalr.summary) ?? "",
      gradedBy: manualOverride
        ? "review"
        : confidence != null && confidence < 0.66
          ? "med"
          : "high",
      grow: typeof weaknesses[0] === "string" ? (weaknesses[0] as string) : undefined,
      rubric: rubricSrc.length
        ? rubricSrc.map((r) => {
            const rb = o(r);
            return {
              label: s(rb.criterionName) ?? s(rb.label) ?? s(rb.criterion) ?? "",
              desc: s(rb.comment) ?? s(rb.description) ?? s(rb.desc),
              score: n(rb.score) ?? 0,
              max: n(rb.maxScore) ?? n(rb.max) ?? 0,
            };
          })
        : undefined,
      manualOverride,
    };
  });
  rows.sort((a, b) => a.order - b.order);
  return rows.map((r, i): ExamQuestionVM => {
    const { order: _order, ...rest } = r;
    void _order;
    return { ...rest, n: i + 1 };
  });
}

const GRADED_BY: Record<string, string> = {
  high: "Auto-graded",
  med: "Auto-graded, teacher spot-checked",
  review: "Reviewed by your teacher",
};

export default function ExamResultsViewScreen() {
  const nav = useTestNav();
  const { examId } = useExamParams();
  const examQ = useExam(examId);
  const subsQ = useSubmissions({ examId } as never);
  const [lightbox, setLightbox] = useState<ExamQuestionVM | null>(null);

  const exam = useMemo(() => o(examQ.data), [examQ.data]);
  const submission = useMemo(() => o(flattenPages(subsQ.data)[0]), [subsQ.data]);
  // Score lives under `summary` in SubmissionListView (nested projection).
  const summary = useMemo(() => o(submission.summary), [submission]);

  // Per-question detail comes from `listQuestionSubmissions` (never embedded in the
  // submission projection), joined with `listQuestions` for prompt text + order.
  const submissionId = s(submission.id) ?? "";
  const qsubsQ = useQuestionSubmissions(submissionId);
  const examQsQ = useExamQuestions(examId);

  const questionMeta = useMemo(() => {
    const raw = o(examQsQ.data).questions;
    const arr = Array.isArray(raw) ? (raw as unknown[]) : [];
    const map: Record<string, QMeta> = {};
    for (const item of arr) {
      const q = o(item);
      const id = s(q.id);
      if (id) map[id] = { text: s(q.text), order: n(q.order), maxMarks: n(q.maxMarks) };
    }
    return map;
  }, [examQsQ.data]);

  const questions = useMemo(() => {
    const raw = o(qsubsQ.data).questionSubmissions;
    const arr = Array.isArray(raw) ? (raw as unknown[]) : [];
    return readExamQuestions(arr, questionMeta);
  }, [qsubsQ.data, questionMeta]);

  const examTitle = s(exam.title) ?? s(exam.name) ?? "Exam results";
  const subject = s(exam.subject) ?? "";
  // Release gate: SubmissionListView carries `resultsReleased` top-level; the exam
  // reaches `results_released` status. Neither `percentage` nor `resultsReleased`
  // sits at the submission top level.
  const released = submission.resultsReleased === true || s(exam.status) === "results_released";
  const percentage = Math.round(n(summary.percentage) ?? 0);
  const grade = s(summary.grade) ?? "";
  const totalScore = n(summary.totalScore);
  const maxScore = n(summary.maxScore);
  const questionsGraded = n(summary.questionsGraded);
  const totalQuestions = n(summary.totalQuestions);
  const releasedDate = coerceDate(
    exam.resultsReleasedAt ?? exam.releasedAt ?? submission.resultsReleasedAt
  );
  const growTopics = questions
    .map((q) => q.grow)
    .filter((x): x is string => Boolean(x))
    .slice(0, 3);

  if (examQ.isLoading || subsQ.isLoading) {
    return (
      <Screen>
        <View className="gap-4 px-4 py-4">
          <View className="flex-row items-center gap-4">
            <Skeleton width={96} height={96} variant="circle" />
            <View className="flex-1 gap-2">
              <Skeleton width="50%" height={14} />
              <Skeleton width="80%" height={26} />
              <Skeleton width="60%" height={13} />
            </View>
          </View>
          <Skeleton width="100%" height={78} radius={12} />
          <Skeleton width="100%" height={78} radius={12} />
        </View>
      </Screen>
    );
  }

  if (examQ.isError) {
    return (
      <Screen>
        <View className="px-4 py-8">
          <EmptyState
            icon="cloud-off"
            title="We couldn't load your results right now"
            body="Something hiccuped on our end. Your grade is safe — give it another go."
            action={
              <Button
                variant="primary"
                leadingIcon={<Icon name="rotate-ccw" size={16} />}
                onPress={() => examQ.refetch()}
              >
                Try again
              </Button>
            }
          />
        </View>
      </Screen>
    );
  }

  // ── Gated — results not yet released ──────────────────────────────────────
  if (!released) {
    return (
      <Screen>
        <View className="gap-4 px-4 py-8">
          <AnswerKeyLock title="Results sealed until your teacher releases them.">
            No score is sent to your device yet.
          </AnswerKeyLock>
          <Text className="font-display text-text-primary text-center text-xl font-semibold">
            Your results aren't ready just yet
          </Text>
          <Text className="text-text-secondary text-center text-sm">
            Your teacher is still finishing grading{subject ? ` the ${subject} paper` : ""}. We'll
            let you know the moment it's released.
          </Text>
          <View className="flex-row justify-center">
            <Button
              variant="ghost"
              leadingIcon={<Icon name="arrow-left" size={16} />}
              onPress={nav.back}
            >
              Back
            </Button>
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerClassName="gap-5 px-4 py-4">
        <Pressable
          className="flex-row items-center gap-1"
          onPress={nav.back}
          accessibilityRole="button"
        >
          <Icon name="arrow-left" size={16} color="#423A82" />
          <Text className="text-brand text-sm">Back</Text>
        </Pressable>

        {/* Verdict hero */}
        <Panel>
          <View className="items-center gap-4">
            <ProgressRing
              value={percentage}
              size={132}
              color={gradeTone(percentage) === "success" ? "#2F7D5B" : "#B7791F"}
              label={`${percentage}%`}
            >
              {grade ? (
                <Badge variant={gradeTone(percentage) === "success" ? "success" : "warning"}>
                  {grade}
                </Badge>
              ) : undefined}
            </ProgressRing>
            <View className="items-center gap-2">
              <Text className="font-display text-text-primary text-center text-xl font-semibold">
                Solid work on your {subject || examTitle} paper.
              </Text>
              {totalScore != null && maxScore != null ? (
                <Text className="text-text-muted text-center text-sm">
                  {totalScore} / {maxScore} marks
                  {questionsGraded != null && totalQuestions != null
                    ? ` · ${questionsGraded} of ${totalQuestions} questions graded`
                    : ""}
                </Text>
              ) : null}
              {releasedDate ? (
                <Text className="text-text-muted text-center text-xs">
                  Released {releasedDate.toLocaleDateString()} · Graded by AutoGrade and reviewed by
                  your teacher.
                </Text>
              ) : null}
            </View>
            <AnswerKeyLock title="Answer keys stay with your teacher —">
              you're seeing your own answers and feedback.
            </AnswerKeyLock>
          </View>
        </Panel>

        {/* Where to grow next */}
        {growTopics.length ? (
          <InsightCard icon="sprout" title="A little practice on these will pay off">
            <View className="gap-3">
              <Text className="text-text-secondary text-sm">
                These topics tripped you up a little today — a short session will help them click
                for the next paper.
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {growTopics.map((t, i) => (
                  <Chip key={i}>{t}</Chip>
                ))}
              </View>
            </View>
          </InsightCard>
        ) : null}

        {/* Per-question review */}
        {questions.length ? (
          <View className="gap-3">
            <View className="flex-row items-center justify-between">
              <Text className="font-display text-text-primary text-base font-semibold">
                Per-question review
              </Text>
              <Text className="text-2xs text-text-muted font-mono">
                {questions.length} questions
              </Text>
            </View>
            <Accordion
              defaultOpen={0}
              items={questions.map((q) => {
                const sm = STATUS_META[q.status];
                return {
                  title: (
                    <View className="flex-1 flex-row items-center justify-between gap-2 pr-2">
                      <View className="flex-row items-center gap-2">
                        <Text className="text-text-muted font-mono text-xs">Q{q.n}</Text>
                        <Badge variant={sm.variant} icon={<Icon name={sm.icon} size={12} />}>
                          {sm.label}
                        </Badge>
                        {q.manualOverride ? (
                          <Badge variant="brand" icon={<Icon name="user-check" size={12} />}>
                            Teacher final
                          </Badge>
                        ) : null}
                      </View>
                      <Text className="text-text-secondary font-mono text-xs">
                        {q.marks} / {q.max}
                      </Text>
                    </View>
                  ),
                  content: (
                    <View className="gap-4">
                      {q.prompt ? <ContentRenderer math>{q.prompt}</ContentRenderer> : null}

                      {q.scanUrls.length ? (
                        <Pressable
                          onPress={() => setLightbox(q)}
                          accessibilityRole="button"
                          accessibilityLabel={`Zoom your scanned answer for question ${q.n}`}
                          className="border-border-subtle bg-surface-sunken gap-2 rounded-md border p-3"
                        >
                          <Text className="text-2xs text-text-muted uppercase">
                            Your answer (from your sheet)
                          </Text>
                          <Image
                            source={{ uri: q.scanUrls[0] }}
                            resizeMode="cover"
                            className="bg-surface h-40 w-full rounded"
                          />
                          <Text className="text-2xs text-brand mt-1">
                            <Icon name="zoom-in" size={11} /> Tap to zoom
                            {q.scanUrls.length > 1 ? ` · ${q.scanUrls.length} pages` : ""}
                          </Text>
                        </Pressable>
                      ) : null}

                      <View
                        className={`gap-2 rounded-md border p-3 ${
                          sm.variant === "success"
                            ? "border-success/40 bg-green-200/30"
                            : "border-warning/40 bg-marigold-50"
                        }`}
                      >
                        <View className="flex-row items-center gap-2">
                          <Icon
                            name={sm.icon}
                            size={18}
                            color={sm.variant === "success" ? "#2F7D5B" : "#B7791F"}
                          />
                          <Text className="text-text-primary font-semibold">{sm.label}</Text>
                        </View>
                        {q.feedback ? <ContentRenderer math>{q.feedback}</ContentRenderer> : null}
                        <View className="mt-1 flex-row items-center gap-2">
                          <ConfidenceBadge
                            level={q.gradedBy}
                            value={GRADED_BY[q.gradedBy] ?? "Graded"}
                          />
                          {q.gradedBy === "review" ? (
                            <Text className="text-text-muted text-xs">
                              Your teacher set the final score on this question.
                            </Text>
                          ) : null}
                        </View>
                      </View>

                      {q.rubric ? (
                        <View className="gap-2">
                          <Text className="text-2xs text-text-muted uppercase">
                            Rubric breakdown
                          </Text>
                          <RubricBreakdown criteria={q.rubric} />
                        </View>
                      ) : null}

                      {q.grow ? (
                        <View className="flex-row items-center gap-2">
                          <Text className="text-text-muted text-xs">Area to grow:</Text>
                          <Chip>{q.grow}</Chip>
                        </View>
                      ) : null}

                      <AnswerKeyLock title="Answer keys stay with your teacher —">
                        you're seeing your own answers and feedback.
                      </AnswerKeyLock>
                    </View>
                  ),
                };
              })}
            />
          </View>
        ) : null}

        <Button
          variant="ghost"
          leadingIcon={<Icon name="arrow-left" size={16} />}
          onPress={nav.back}
        >
          Back to results
        </Button>
      </ScrollView>

      {/* Scanned-answer lightbox */}
      <Modal
        open={!!lightbox}
        onClose={() => setLightbox(null)}
        title={lightbox ? `Your scanned answer — Q${lightbox.n}` : ""}
      >
        {lightbox ? (
          <View className="gap-3">
            <View
              className="border-border-subtle bg-surface-sunken gap-2 rounded-md border p-3"
              accessibilityLabel={`Your scanned answer for question ${lightbox.n}`}
            >
              {lightbox.scanUrls.map((uri, i) => (
                <Image
                  key={i}
                  source={{ uri }}
                  resizeMode="contain"
                  className="bg-surface h-96 w-full rounded"
                />
              ))}
            </View>
            <Text className="text-text-muted text-xs">
              This is your own scanned sheet — the answer key is never shown.
            </Text>
          </View>
        ) : null}
      </Modal>
    </Screen>
  );
}
