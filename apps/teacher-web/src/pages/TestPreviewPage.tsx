import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useRepos, useSpace } from "@levelup/query";
import {
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  Label,
  Skeleton,
  Switch,
} from "@levelup/shared-ui";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  Flag,
  RotateCcw,
  Send,
} from "lucide-react";
import type { StoryPoint, UnifiedItem as CanonicalItem } from "@levelup/domain";
import type { UnifiedItem } from "@levelup/shared-types";
import StudentPreviewItem from "../components/spaces/StudentPreviewItem";
import {
  buildPreviewSessionSummary,
  hasPreviewAnswer,
  validatePreviewItem,
} from "../components/spaces/student-preview-model";
import { toItemEditorModel, type ItemEditView } from "../components/spaces/item-editor-contract";

const formatTime = (totalSeconds: number): string => {
  const seconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
};

export default function TestPreviewPage() {
  const { spaceId = "", storyPointId = "" } = useParams<{
    spaceId: string;
    storyPointId: string;
  }>();
  const navigate = useNavigate();
  const { data: space } = useSpace<{ title?: string }>(spaceId);
  const { storyPointRepo, itemRepo } = useRepos();
  const [storyPoint, setStoryPoint] = useState<StoryPoint | null>(null);
  const [items, setItems] = useState<UnifiedItem[]>([]);
  const [answerItems, setAnswerItems] = useState<Record<string, UnifiedItem>>({});
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [markedForReview, setMarkedForReview] = useState<Set<string>>(new Set());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswers, setShowAnswers] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const startedAt = useRef(Date.now());
  const itemHeading = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!spaceId || !storyPointId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const sp = await storyPointRepo.get({ spaceId, storyPointId });
        let page = (await itemRepo.paginate({ spaceId, storyPointId, limit: 50 })) as {
          items: CanonicalItem[];
          nextCursor: string | null;
          fetchNextPage: () => Promise<unknown>;
        };
        const loaded = [...page.items];
        while (page.nextCursor) {
          page = (await page.fetchNextPage()) as typeof page;
          loaded.push(...page.items);
        }
        if (cancelled) return;
        setStoryPoint(sp);
        setItems(loaded.map((item) => toItemEditorModel(item as ItemEditView)));
        setCurrentIndex(0);
        setAnswers({});
        setMarkedForReview(new Set());
        setSubmitted(false);
        setAnswerItems({});
        startedAt.current = Date.now();
        setNow(Date.now());
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Unable to load this preview.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [itemRepo, reload, spaceId, storyPointId, storyPointRepo]);

  const currentItem = items[currentIndex] ?? null;
  const isAssessment = storyPoint?.type === "quiz" || storyPoint?.type === "timed_test";
  const durationMinutes =
    storyPoint?.type === "timed_test" ? storyPoint.assessmentConfig?.durationMinutes : undefined;
  const durationSeconds = durationMinutes ? durationMinutes * 60 : null;
  const elapsedSeconds = Math.max(0, Math.floor((now - startedAt.current) / 1000));
  const remainingSeconds =
    durationSeconds === null ? null : Math.max(0, durationSeconds - elapsedSeconds);
  const summary = useMemo(
    () => buildPreviewSessionSummary(items, answers, markedForReview),
    [answers, items, markedForReview]
  );
  const validationIssues = currentItem ? validatePreviewItem(currentItem) : [];

  useEffect(() => {
    if (submitted) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [submitted]);

  useEffect(() => {
    if (remainingSeconds === 0 && durationSeconds !== null && !submitted) {
      setSubmitted(true);
    }
  }, [durationSeconds, remainingSeconds, submitted]);

  useEffect(() => {
    if (!showAnswers || !currentItem || currentItem.type !== "question") return;
    if (answerItems[currentItem.id]) return;
    let cancelled = false;
    itemRepo
      .getForEdit({ spaceId, storyPointId, itemId: currentItem.id })
      .then((result) => {
        if (!cancelled) {
          const answerItem = toItemEditorModel((result.item ?? currentItem) as ItemEditView);
          setAnswerItems((previous) => ({ ...previous, [currentItem.id]: answerItem }));
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [answerItems, currentItem, itemRepo, showAnswers, spaceId, storyPointId]);

  const goTo = (index: number) => {
    setCurrentIndex(Math.max(0, Math.min(items.length - 1, index)));
    window.requestAnimationFrame(() => itemHeading.current?.focus());
  };

  const toggleReview = () => {
    if (!currentItem || currentItem.type !== "question") return;
    setMarkedForReview((previous) => {
      const next = new Set(previous);
      if (next.has(currentItem.id)) next.delete(currentItem.id);
      else next.add(currentItem.id);
      return next;
    });
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-4xl space-y-4" aria-busy="true" aria-label="Loading preview">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-96 w-full" />
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-3xl py-12">
        <div
          role="alert"
          className="border-error/40 bg-error-subtle rounded-lg border p-6 text-center"
        >
          <AlertCircle className="text-error mx-auto h-8 w-8" aria-hidden />
          <h1 className="mt-3 font-semibold">Preview could not be loaded</h1>
          <p className="text-muted-foreground mt-1 text-sm">{error}</p>
          <div className="mt-5 flex justify-center gap-2">
            <Button variant="outline" onClick={() => navigate(`/spaces/${spaceId}/edit`)}>
              Back to editor
            </Button>
            <Button onClick={() => setReload((value) => value + 1)}>
              <RotateCcw className="mr-2 h-4 w-4" aria-hidden /> Retry
            </Button>
          </div>
        </div>
      </main>
    );
  }

  if (!storyPoint || items.length === 0) {
    return (
      <main className="mx-auto max-w-3xl py-12 text-center">
        <Eye className="text-muted-foreground mx-auto h-9 w-9" aria-hidden />
        <h1 className="mt-3 font-semibold">Nothing to preview yet</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Add a question or learning material to this story point.
        </p>
        <Button
          className="mt-4"
          variant="outline"
          onClick={() => navigate(`/spaces/${spaceId}/edit`)}
        >
          Back to editor
        </Button>
      </main>
    );
  }

  const displayedItem = showAnswers
    ? (answerItems[currentItem?.id ?? ""] ?? currentItem)
    : currentItem;
  const currentSection = storyPoint.sections?.find(
    (section) => section.id === currentItem?.sectionId
  );
  const currentAnswered = currentItem ? hasPreviewAnswer(answers[currentItem.id]) : false;
  const currentMarked = currentItem ? markedForReview.has(currentItem.id) : false;

  return (
    <main className="mx-auto max-w-4xl space-y-5">
      <section
        aria-label="Author preview notice"
        className="border-info/40 bg-info-subtle flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center"
      >
        <Eye className="text-info h-5 w-5 flex-shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-info text-sm font-semibold">Student preview · no records are saved</p>
          <p className="text-info/80 text-xs">
            Navigation, review flags, submission, and timed auto-submit match an assessment session.
            AI conversations, uploads, scoring, and progress writes stay local.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate(`/spaces/${spaceId}/edit`)}>
          Exit preview
        </Button>
      </section>

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

      <section
        className="bg-background sticky top-0 z-10 space-y-3 border-b py-3"
        aria-label="Preview session status"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-mono font-semibold">
              Item {currentIndex + 1}/{items.length}
            </span>
            <Badge variant="outline" className="capitalize">
              {currentItem?.type}
            </Badge>
            {currentSection && <Badge variant="secondary">{currentSection.title}</Badge>}
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <span
              className={`flex items-center gap-1.5 font-mono text-sm ${
                remainingSeconds !== null && remainingSeconds <= 60
                  ? "text-error font-semibold"
                  : "text-muted-foreground"
              }`}
              aria-live="polite"
              aria-label={
                remainingSeconds === null
                  ? `Elapsed time ${formatTime(elapsedSeconds)}`
                  : `Time remaining ${formatTime(remainingSeconds)}`
              }
            >
              <Clock3 className="h-4 w-4" aria-hidden />
              {remainingSeconds === null
                ? formatTime(elapsedSeconds)
                : formatTime(remainingSeconds)}
            </span>
            <div className="flex items-center gap-2">
              <Switch
                id="show-authoring-answers"
                checked={showAnswers}
                onCheckedChange={setShowAnswers}
              />
              <Label htmlFor="show-authoring-answers" className="cursor-pointer text-xs">
                Author answer key
              </Label>
            </div>
          </div>
        </div>

        <nav aria-label="Preview item navigation" className="flex flex-wrap gap-1.5">
          {items.map((item, index) => {
            const answered = item.type === "material" || hasPreviewAnswer(answers[item.id]);
            const marked = markedForReview.has(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => goTo(index)}
                aria-current={index === currentIndex ? "step" : undefined}
                aria-label={`Item ${index + 1}, ${item.type}${answered ? ", complete" : ", unanswered"}${marked ? ", marked for review" : ""}`}
                className={`focus-visible:ring-brand relative flex h-10 w-10 items-center justify-center rounded-md border font-mono text-xs focus-visible:outline-none focus-visible:ring-2 ${
                  index === currentIndex
                    ? "border-brand bg-brand text-fg-on-accent"
                    : answered
                      ? "border-success/40 bg-success-subtle"
                      : "bg-background hover:bg-muted"
                }`}
              >
                {index + 1}
                {marked && (
                  <Flag
                    className="text-warning absolute -right-1 -top-1 h-3.5 w-3.5 fill-current"
                    aria-hidden
                  />
                )}
              </button>
            );
          })}
        </nav>
      </section>

      {validationIssues.length > 0 && (
        <aside
          role="status"
          className="border-warning/50 bg-warning-subtle rounded-md border p-3"
          aria-labelledby="author-validation-title"
        >
          <p
            id="author-validation-title"
            className="text-warning flex items-center gap-2 text-sm font-semibold"
          >
            <AlertCircle className="h-4 w-4" aria-hidden /> Authoring-only validation
          </p>
          <ul className="text-warning/90 mt-1 list-disc pl-6 text-sm">
            {validationIssues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </aside>
      )}

      {submitted && (
        <section
          role="status"
          aria-live="polite"
          className="border-success/40 bg-success-subtle rounded-lg border p-5"
        >
          <h2 className="text-success flex items-center gap-2 font-semibold">
            <CheckCircle2 className="h-5 w-5" aria-hidden /> Preview submitted
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {summary.answered} answered · {summary.unanswered} unanswered ·{" "}
            {summary.markedForReview} marked for review. No grading or progress record was created.
          </p>
        </section>
      )}

      <div
        ref={itemHeading}
        tabIndex={-1}
        className="bg-card border-subtle shadow-e1 rounded-lg border p-5 outline-none sm:p-7"
      >
        {displayedItem && (
          <StudentPreviewItem
            key={displayedItem.id}
            item={displayedItem}
            answer={answers[displayedItem.id]}
            onAnswer={(answer) =>
              setAnswers((previous) => ({ ...previous, [displayedItem.id]: answer }))
            }
            disabled={submitted}
            showAnswers={showAnswers}
          />
        )}
      </div>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          variant="outline"
          onClick={() => goTo(currentIndex - 1)}
          disabled={currentIndex === 0}
        >
          <ChevronLeft className="mr-1 h-4 w-4" aria-hidden /> Previous
        </Button>
        <div className="flex flex-wrap justify-center gap-2">
          {currentItem?.type === "question" && !submitted && (
            <Button
              variant={currentMarked ? "secondary" : "outline"}
              onClick={toggleReview}
              aria-pressed={currentMarked}
            >
              <Flag className="mr-2 h-4 w-4" aria-hidden />
              {currentMarked ? "Marked for review" : "Mark for review"}
            </Button>
          )}
          {isAssessment && !submitted && (
            <Button onClick={() => setSubmitted(true)}>
              <Send className="mr-2 h-4 w-4" aria-hidden />
              Submit preview
            </Button>
          )}
          {submitted && (
            <Button
              variant="outline"
              onClick={() => {
                setSubmitted(false);
                startedAt.current = Date.now();
                setNow(Date.now());
              }}
            >
              <RotateCcw className="mr-2 h-4 w-4" aria-hidden /> Resume preview
            </Button>
          )}
        </div>
        <Button onClick={() => goTo(currentIndex + 1)} disabled={currentIndex === items.length - 1}>
          Next <ChevronRight className="ml-1 h-4 w-4" aria-hidden />
        </Button>
      </div>

      <p className="sr-only" aria-live="polite">
        {currentItem?.type === "question"
          ? currentAnswered
            ? "Current question answered."
            : "Current question unanswered."
          : "Current learning material."}
      </p>
    </main>
  );
}
