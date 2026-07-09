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
      <div className="border-info/40 bg-info-subtle flex items-center gap-3 rounded-md border p-3">
        <Eye className="text-info h-5 w-5 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-info text-sm font-medium">Preview Mode — answers are not saved</p>
          <p className="text-info/80 text-xs">
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
          <span className="font-mono text-sm font-medium">
            Q{currentIndex + 1}/{questionItems.length}
          </span>
          {currentSection && (
            <span className="text-muted-foreground bg-muted rounded-pill px-2 py-0.5 text-xs">
              {currentSection.title}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="text-muted-foreground flex items-center gap-1.5 text-sm">
            <Clock className="h-4 w-4" />
            <span className="font-mono">
              {storyPoint.assessmentConfig?.durationMinutes ?? "--"} min
            </span>
            <span className="font-mono text-xs">({elapsedMinutes}m elapsed)</span>
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
            className={`duration-fast ease-standard h-8 w-8 rounded border font-mono text-xs transition-colors ${
              idx === currentIndex
                ? "bg-brand text-fg-on-accent border-brand"
                : answers[q.id] !== undefined
                  ? "border-success/40 bg-success-subtle"
                  : "bg-background hover:bg-muted"
            }`}
          >
            {idx + 1}
          </button>
        ))}
      </div>

      {/* Question Content */}
      {currentItem && (
        <div className="bg-card border-subtle shadow-e1 space-y-4 rounded-lg border p-6">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="rounded-pill bg-surface-sunken text-fg-secondary border-transparent text-xs capitalize"
            >
              {payload?.questionType?.replace(/[-_]/g, " ") ?? "question"}
            </Badge>
            {currentItem.difficulty && (
              <Badge
                variant="outline"
                className={`rounded-pill text-xs ${
                  currentItem.difficulty === "easy"
                    ? "border-success/40 text-success"
                    : currentItem.difficulty === "hard"
                      ? "border-error/40 text-error"
                      : "border-warning/40 text-warning"
                }`}
              >
                {currentItem.difficulty}
              </Badge>
            )}
            {payload?.basePoints && (
              <span className="text-muted-foreground font-mono text-xs">
                {payload.basePoints} pts
              </span>
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
                  className={`duration-fast ease-standard flex cursor-pointer items-center gap-2 rounded border p-3 text-sm transition-colors ${
                    showAnswers && opt.isCorrect
                      ? "border-success/40 bg-success-subtle"
                      : "hover:bg-muted"
                  }`}
                  onClick={() => setAnswers((prev) => ({ ...prev, [currentItem.id]: opt.id }))}
                >
                  <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border text-xs">
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <span className="flex-1">{opt.text}</span>
                  {showAnswers && opt.isCorrect && <CheckCircle className="text-success h-4 w-4" />}
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
                    className={`duration-fast ease-standard flex-1 rounded border p-3 text-center text-sm transition-colors ${
                      isCorrect ? "border-success/40 bg-success-subtle" : "hover:bg-muted"
                    }`}
                    onClick={() =>
                      setAnswers((prev) => ({ ...prev, [currentItem.id]: val === "True" }))
                    }
                  >
                    {val}
                    {isCorrect && <CheckCircle className="text-success ml-2 inline h-4 w-4" />}
                  </button>
                );
              })}
            </div>
          )}

          {/* Show explanation when answers are revealed */}
          {showAnswers && payload?.explanation && (
            <div className="bg-info-subtle rounded p-3 text-sm">
              <p className="text-info mb-1 font-medium">Explanation</p>
              <p className="text-info/80">{payload.explanation}</p>
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
        <span className="text-muted-foreground font-mono text-sm">
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
