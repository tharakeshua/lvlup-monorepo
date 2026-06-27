import { useState, useMemo, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useSpace, useRepos } from "@levelup/query";
import {
  Button,
  Skeleton,
  Badge,
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Switch,
  Label,
} from "@levelup/shared-ui";
import { Clock, Eye, ChevronLeft, ChevronRight, CheckCircle } from "lucide-react";
import type {
  StoryPoint,
  UnifiedItem,
  QuestionPayload,
  StoryPointSection,
} from "@levelup/shared-types";
import { useEffect } from "react";

export default function TestPreviewPage() {
  const { spaceId, storyPointId } = useParams<{ spaceId: string; storyPointId: string }>();
  const navigate = useNavigate();
  const { data: space } = useSpace<{ title?: string }>(spaceId ?? "");
  const { storyPointRepo, itemRepo } = useRepos();

  const [storyPoint, setStoryPoint] = useState<StoryPoint | null>(null);
  const [items, setItems] = useState<UnifiedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [showAnswers, setShowAnswers] = useState(false);
  const startTime = useRef(Date.now());

  // Load story point and items. The list read is answer-stripped, so we re-merge
  // each item via getForEdit (authoring-only) — the teacher preview's "Show
  // Answers" toggle needs the answer-bearing payloads.
  useEffect(() => {
    if (!spaceId || !storyPointId) return;
    let cancelled = false;
    (async () => {
      try {
        const spPage = (await storyPointRepo.list({ spaceId })) as { items: StoryPoint[] };
        const sp = (spPage?.items ?? []).find((s) => s.id === storyPointId) ?? null;

        const itemPage = (await itemRepo.list({ spaceId, storyPointId })) as {
          items: UnifiedItem[];
        };
        const stripped = itemPage?.items ?? [];
        const full = await Promise.all(
          stripped.map(async (it) => {
            try {
              const edit = await itemRepo.getForEdit({ spaceId, storyPointId, itemId: it.id });
              return (edit.item ?? it) as UnifiedItem;
            } catch {
              return it;
            }
          })
        );
        if (cancelled) return;
        setStoryPoint(sp);
        setItems(full);
      } catch {
        // Handled via empty state
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [spaceId, storyPointId, storyPointRepo, itemRepo]);

  const questionItems = useMemo(() => items.filter((i) => i.type === "question"), [items]);

  const currentItem = questionItems[currentIndex] ?? null;
  const payload = currentItem?.payload as QuestionPayload | undefined;

  const sections: StoryPointSection[] = storyPoint?.sections ?? [];
  const currentSection = currentItem?.sectionId
    ? sections.find((s) => s.id === currentItem.sectionId)
    : null;

  const elapsedMinutes = Math.round((Date.now() - startTime.current) / 60000);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!storyPoint || questionItems.length === 0) {
    return (
      <div className="mx-auto max-w-3xl py-12 text-center">
        <p className="text-muted-foreground">No questions found in this story point.</p>
        <Button variant="link" onClick={() => navigate(`/spaces/${spaceId}/edit`)}>
          Back to Editor
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* Preview Banner */}
      <div className="flex items-center gap-3 rounded-md border border-blue-200 bg-blue-500/10 p-3 dark:border-blue-800">
        <Eye className="h-5 w-5 flex-shrink-0 text-blue-600" />
        <div className="flex-1">
          <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
            Preview Mode — answers are not saved
          </p>
          <p className="text-xs text-blue-600/80 dark:text-blue-400/80">
            This simulates the student experience. No test session is created.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate(`/spaces/${spaceId}/edit`)}>
          Exit Preview
        </Button>
      </div>

      {/* Breadcrumbs */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/spaces">Spaces</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to={`/spaces/${spaceId}/edit`}>{space?.title ?? "Space"}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Preview: {storyPoint.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Timer & Progress Bar */}
      <div className="bg-background sticky top-0 z-10 flex items-center justify-between border-b py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            Q{currentIndex + 1}/{questionItems.length}
          </span>
          {currentSection && (
            <span className="text-muted-foreground bg-muted rounded px-2 py-0.5 text-xs">
              {currentSection.title}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="text-muted-foreground flex items-center gap-1.5 text-sm">
            <Clock className="h-4 w-4" />
            <span>{storyPoint.assessmentConfig?.durationMinutes ?? "--"} min</span>
            <span className="text-xs">({elapsedMinutes}m elapsed)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Switch checked={showAnswers} onCheckedChange={setShowAnswers} id="show-answers" />
            <Label htmlFor="show-answers" className="cursor-pointer text-xs">
              Show Answers
            </Label>
          </div>
        </div>
      </div>

      {/* Question Navigator (inline) */}
      <div className="flex flex-wrap gap-1">
        {questionItems.map((q, idx) => (
          <button
            key={q.id}
            onClick={() => setCurrentIndex(idx)}
            className={`h-8 w-8 rounded border text-xs transition-colors ${
              idx === currentIndex
                ? "bg-primary text-primary-foreground border-primary"
                : answers[q.id] !== undefined
                  ? "border-emerald-300 bg-emerald-100 dark:bg-emerald-900/30"
                  : "bg-background hover:bg-muted"
            }`}
          >
            {idx + 1}
          </button>
        ))}
      </div>

      {/* Question Content */}
      {currentItem && (
        <div className="space-y-4 rounded-lg border p-6">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs capitalize">
              {payload?.questionType?.replace(/[-_]/g, " ") ?? "question"}
            </Badge>
            {currentItem.difficulty && (
              <Badge
                variant="outline"
                className={`text-xs ${
                  currentItem.difficulty === "easy"
                    ? "border-emerald-300 text-emerald-700"
                    : currentItem.difficulty === "hard"
                      ? "border-red-300 text-red-700"
                      : "border-amber-300 text-amber-700"
                }`}
              >
                {currentItem.difficulty}
              </Badge>
            )}
            {payload?.basePoints && (
              <span className="text-muted-foreground text-xs">{payload.basePoints} pts</span>
            )}
          </div>

          <div className="whitespace-pre-wrap text-sm">
            {currentItem.title && <h3 className="mb-2 font-medium">{currentItem.title}</h3>}
            <p>{payload?.content ?? currentItem.content}</p>
          </div>

          {/* MCQ Options Preview */}
          {(payload?.questionType === "mcq" || payload?.questionType === "mcaq") && (
            <div className="space-y-2">
              {(
                (payload?.questionData as Record<string, unknown>)?.options as
                  | Array<{ id: string; text: string; isCorrect?: boolean }>
                  | undefined
              )?.map((opt, idx) => (
                <div
                  key={opt.id ?? idx}
                  className={`flex cursor-pointer items-center gap-2 rounded border p-3 text-sm transition-colors ${
                    showAnswers && opt.isCorrect
                      ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30"
                      : "hover:bg-muted"
                  }`}
                  onClick={() => setAnswers((prev) => ({ ...prev, [currentItem.id]: opt.id }))}
                >
                  <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border text-xs">
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <span className="flex-1">{opt.text}</span>
                  {showAnswers && opt.isCorrect && (
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* True/False Preview */}
          {payload?.questionType === "true-false" && (
            <div className="flex gap-3">
              {["True", "False"].map((val) => {
                const isCorrect =
                  showAnswers &&
                  (payload?.questionData as Record<string, unknown>)?.correctAnswer ===
                    (val === "True");
                return (
                  <button
                    key={val}
                    className={`flex-1 rounded border p-3 text-center text-sm transition-colors ${
                      isCorrect
                        ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30"
                        : "hover:bg-muted"
                    }`}
                    onClick={() =>
                      setAnswers((prev) => ({ ...prev, [currentItem.id]: val === "True" }))
                    }
                  >
                    {val}
                    {isCorrect && <CheckCircle className="ml-2 inline h-4 w-4 text-emerald-500" />}
                  </button>
                );
              })}
            </div>
          )}

          {/* Show explanation when answers are revealed */}
          {showAnswers && payload?.explanation && (
            <div className="rounded bg-blue-50 p-3 text-sm dark:bg-blue-950/30">
              <p className="mb-1 font-medium text-blue-700 dark:text-blue-300">Explanation</p>
              <p className="text-blue-600/80 dark:text-blue-400/80">{payload.explanation}</p>
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
          disabled={currentIndex === 0}
          className="gap-1"
        >
          <ChevronLeft className="h-4 w-4" /> Previous
        </Button>
        <span className="text-muted-foreground text-sm">
          {currentIndex + 1} / {questionItems.length}
        </span>
        <Button
          onClick={() => setCurrentIndex(Math.min(questionItems.length - 1, currentIndex + 1))}
          disabled={currentIndex === questionItems.length - 1}
          className="gap-1"
        >
          Next <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
