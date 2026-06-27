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
import { Pressable, ScrollView, Text, View } from "react-native";

import { useExam, useSubmissions } from "@levelup/query";

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
  scan: string[];
  feedback: string;
  gradedBy: string;
  grow?: string;
  rubric?: { label: string; desc?: string; score: number; max: number }[];
  manualOverride?: boolean;
}

function readExamQuestions(submission: Dict): ExamQuestionVM[] {
  const list = Array.isArray(submission.questions)
    ? (submission.questions as unknown[])
    : Array.isArray(submission.questionSubmissions)
      ? (submission.questionSubmissions as unknown[])
      : [];
  return list.map((raw, i) => {
    const q = o(raw);
    const evalr = o(q.evaluation);
    const marks = n(q.pointsEarned) ?? n(evalr.score) ?? 0;
    const max = n(q.totalPoints) ?? n(evalr.maxScore) ?? 0;
    const ratio = max > 0 ? marks / max : 0;
    const status: keyof typeof STATUS_META =
      ratio >= 1 ? "full" : ratio >= 0.75 ? "almost" : ratio > 0 ? "partial" : "look";
    const rubricSrc = Array.isArray(evalr.rubricBreakdown)
      ? (evalr.rubricBreakdown as unknown[])
      : [];
    const weaknesses = Array.isArray(evalr.weaknesses) ? (evalr.weaknesses as unknown[]) : [];
    return {
      n: n(q.questionNumber) ?? i + 1,
      marks,
      max,
      status,
      prompt: s(q.prompt) ?? s(o(q.question).prompt) ?? "",
      scan: Array.isArray(q.scanLines) ? (q.scanLines as unknown[]).map(String) : [],
      feedback: s(evalr.summary) ?? s(q.feedback) ?? "",
      gradedBy: s(q.gradedBy) ?? (q.manualOverride ? "review" : "high"),
      grow: typeof weaknesses[0] === "string" ? (weaknesses[0] as string) : undefined,
      rubric: rubricSrc.length
        ? rubricSrc.map((r) => {
            const rb = o(r);
            return {
              label: s(rb.label) ?? s(rb.criterion) ?? "",
              desc: s(rb.description) ?? s(rb.desc),
              score: n(rb.score) ?? n(rb.pointsEarned) ?? 0,
              max: n(rb.maxScore) ?? n(rb.max) ?? 0,
            };
          })
        : undefined,
      manualOverride: q.manualOverride === true,
    };
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
  const questions = useMemo(() => readExamQuestions(submission), [submission]);

  const examTitle = s(exam.title) ?? s(exam.name) ?? "Exam results";
  const subject = s(exam.subject) ?? "";
  const released =
    (exam.resultsReleased ?? exam.released) === true || submission.percentage != null;
  const percentage = n(submission.percentage) ?? 0;
  const grade = s(submission.grade) ?? s(submission.finalGrade) ?? "";
  const totalScore = n(submission.totalScore) ?? n(submission.marksEarned);
  const maxScore = n(submission.maxScore) ?? n(submission.totalMarks);
  const releasedDate = coerceDate(
    exam.resultsReleasedAt ?? exam.releasedAt ?? submission.releasedAt
  );
  const growTopics = Array.isArray(submission.weaknesses)
    ? (submission.weaknesses as unknown[])
        .filter((x): x is string => typeof x === "string")
        .slice(0, 3)
    : questions.map((q) => q.grow).filter((x): x is string => Boolean(x));

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
                  {totalScore} / {maxScore} marks · {questions.length} questions graded
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

                      {q.scan.length ? (
                        <Pressable
                          onPress={() => setLightbox(q)}
                          accessibilityRole="button"
                          accessibilityLabel={`Zoom your scanned answer for question ${q.n}`}
                          className="border-border-subtle bg-surface-sunken gap-1.5 rounded-md border p-3"
                        >
                          <Text className="text-2xs text-text-muted uppercase">
                            Your answer (from your sheet)
                          </Text>
                          {q.scan.map((line, i) => (
                            <Text
                              key={i}
                              className={`font-mono ${i === 0 ? "text-base" : "text-sm"} text-text-primary`}
                            >
                              {line}
                            </Text>
                          ))}
                          <Text className="text-2xs text-brand mt-1">
                            <Icon name="zoom-in" size={11} /> Tap to zoom
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
              className="border-border-subtle bg-surface-sunken gap-1 rounded-md border p-4"
              accessibilityLabel={`Your scanned answer for question ${lightbox.n}`}
            >
              {lightbox.scan.map((line, i) => (
                <Text key={i} className="text-text-primary font-mono text-base">
                  {line}
                </Text>
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
