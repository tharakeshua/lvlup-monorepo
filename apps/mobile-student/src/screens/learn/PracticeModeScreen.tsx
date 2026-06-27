/**
 * PracticeModeScreen — low-stakes drill over a story point's questions.
 *
 * Design: docs/rebuild-spec/design/build/app/mobile-family/_build/practice-mode.viewjs
 * Data:   useItems (questions only) + useRecordItemAttempt. Practice is just the
 *         item flow with immediate per-question feedback and a session tally; it
 *         shares the item-render kit (QuestionView) with the content viewer.
 *
 * Owned by the Learn lane; the shell mounts this default export at
 * routes.practice(spaceId, storyPointId).
 */
import { useCallback, useMemo, useRef, useState } from "react";
import { Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useItems, useRecordItemAttempt } from "@levelup/query";
import { asItemId, asSpaceId, asStoryPointId } from "@levelup/domain";

import {
  Alert,
  Badge,
  Breadcrumb,
  Button,
  Card,
  Icon,
  ProgressBar,
  QuestionView,
  Screen,
  Skeleton,
} from "../../components";
import { routes } from "../../lib/routes";
import { ErrorState } from "./_shared/states";
import { asArray, byOrder, isQuestion } from "./_shared/normalize";
import type { ItemView } from "./_shared/types";

export default function PracticeModeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ spaceId?: string; storyPointId?: string }>();
  const spaceId = String(params.spaceId ?? "");
  const storyPointId = String(params.storyPointId ?? "");

  const itemsQ = useItems<unknown>(spaceId, storyPointId);
  const recordAttempt = useRecordItemAttempt();

  const questions = useMemo(
    () => asArray<ItemView>(itemsQ.data).slice().sort(byOrder).filter(isQuestion),
    [itemsQ.data]
  );

  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState<unknown>(undefined);
  const [outcome, setOutcome] = useState<{ correct: boolean; partial: boolean } | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [doneCount, setDoneCount] = useState(0);
  const startRef = useRef<number>(Date.now());

  const item = questions[index];
  const total = questions.length;

  const submit = useCallback(() => {
    if (!item) return;
    const timeSpent = Math.round((Date.now() - startRef.current) / 1000);
    recordAttempt.mutate(
      {
        spaceId: asSpaceId(spaceId),
        storyPointId: asStoryPointId(storyPointId),
        itemId: asItemId(item.id),
        answer,
        timeSpent,
      },
      {
        onSuccess: (data) => {
          const d = (data ?? {}) as {
            completed?: boolean;
            progress?: { questionData?: { status?: string } };
          };
          const status = d.progress?.questionData?.status;
          const correct = status === "correct" || (Boolean(d.completed) && !status);
          const partial = status === "partial";
          setOutcome({ correct, partial });
          setDoneCount((c) => c + 1);
          if (correct) setCorrectCount((c) => c + 1);
        },
      }
    );
  }, [item, answer, recordAttempt, spaceId, storyPointId]);

  const next = useCallback(() => {
    setOutcome(null);
    setAnswer(undefined);
    startRef.current = Date.now();
    setIndex((i) => Math.min(total - 1, i + 1));
  }, [total]);

  if (itemsQ.isLoading)
    return (
      <Screen className="bg-canvas" contentClassName="p-5 gap-4">
        <Skeleton width="50%" height={22} />
        <Skeleton width="100%" height={12} radius={999} />
        <Skeleton width="100%" height={200} radius={14} />
      </Screen>
    );
  if (itemsQ.isError)
    return <ErrorState title="We couldn't start practice" onRetry={() => itemsQ.refetch()} />;

  if (total === 0)
    return (
      <Screen className="bg-canvas" contentClassName="p-5 gap-4">
        <Breadcrumb
          items={[
            { label: "Spaces", onPress: () => router.push(routes.spaces()) },
            { label: "Practice", onPress: () => router.push(routes.space(spaceId)) },
          ]}
        />
        <Card className="items-center gap-2 py-8">
          <Icon name="dumbbell" size={28} color="#756E61" />
          <Text className="font-display text-text-primary text-base">
            No practice questions here yet
          </Text>
          <Button
            variant="secondary"
            size="sm"
            onPress={() => router.push(routes.spaceContent(spaceId, storyPointId))}
          >
            Back to lesson
          </Button>
        </Card>
      </Screen>
    );

  const finished = doneCount >= total && outcome != null && index === total - 1;
  const progressPct = Math.round((doneCount / total) * 100);

  return (
    <Screen className="bg-canvas" contentClassName="p-5 gap-4">
      <Breadcrumb
        items={[
          { label: "Spaces", onPress: () => router.push(routes.spaces()) },
          { label: "Practice", onPress: () => router.push(routes.space(spaceId)) },
        ]}
      />

      <View className="flex-row items-center justify-between">
        <Text className="font-display text-text-primary text-xl">Practice</Text>
        <Badge variant="spark" icon={<Icon name="zap" size={12} />}>
          {correctCount} correct
        </Badge>
      </View>

      <View className="gap-1">
        <View className="flex-row justify-between">
          <Text className="text-text-muted text-xs">
            Question {index + 1} of {total}
          </Text>
          <Text className="text-text-muted text-xs">{progressPct}%</Text>
        </View>
        <ProgressBar value={progressPct} variant="spark" />
      </View>

      {finished ? (
        <Card className="items-center gap-3 py-8">
          <Icon name="party-popper" size={32} color="#E8972B" />
          <Text className="font-display text-text-primary text-lg">Practice complete!</Text>
          <Text className="text-text-muted text-sm">
            You got {correctCount} of {total} right. Keep the momentum.
          </Text>
          <View className="flex-row gap-2">
            <Button
              variant="secondary"
              size="sm"
              leadingIcon={<Icon name="arrow-left" size={15} />}
              onPress={() => router.push(routes.spaceContent(spaceId, storyPointId))}
            >
              Back to lesson
            </Button>
            <Button variant="primary" size="sm" onPress={() => router.push(routes.space(spaceId))}>
              Done
            </Button>
          </View>
        </Card>
      ) : (
        <Card className="gap-4">
          <QuestionView
            item={item}
            value={answer}
            onChange={setAnswer}
            disabled={outcome != null}
            showResult={outcome != null}
          />

          {outcome ? (
            <Alert
              variant={outcome.correct ? "success" : outcome.partial ? "warning" : "error"}
              title={outcome.correct ? "Correct!" : outcome.partial ? "Partly there" : "Not quite"}
              icon={<Icon name={outcome.correct ? "check-circle" : "rotate-ccw"} size={18} />}
            >
              {outcome.correct
                ? "Nice — onto the next one."
                : "Review it and keep going — practice is how it sticks."}
            </Alert>
          ) : null}

          <View className="flex-row justify-end gap-2">
            {!outcome ? (
              <Button
                variant="spark"
                leadingIcon={<Icon name="send" size={16} />}
                disabled={answer == null || recordAttempt.isPending}
                loading={recordAttempt.isPending}
                onPress={submit}
              >
                Check
              </Button>
            ) : index < total - 1 ? (
              <Button
                variant="primary"
                trailingIcon={<Icon name="arrow-right" size={16} />}
                onPress={next}
              >
                Next question
              </Button>
            ) : (
              <Button
                variant="primary"
                trailingIcon={<Icon name="flag" size={16} />}
                onPress={() => setIndex(index)}
              >
                Finish
              </Button>
            )}
          </View>
        </Card>
      )}
    </Screen>
  );
}
