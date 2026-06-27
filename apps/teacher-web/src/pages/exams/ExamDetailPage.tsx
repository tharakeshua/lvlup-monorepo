import { useMemo, useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  useExam,
  useSubmissions,
  useClasses,
  useApiError,
  useExamQuestions,
  useSpaces,
} from "@levelup/query";
import { useAuthSession } from "../../sdk/session";
import { toast } from "sonner";
import { ref as storageRef, getDownloadURL } from "firebase/storage";
import {
  getFirebaseServices,
  callSaveExam,
  callGenerateReport,
  callExtractQuestions,
} from "@levelup/shared-services";
import type { Exam, Submission, ExamQuestion, UnifiedRubric } from "@levelup/shared-types";
import RubricEditor from "../../components/spaces/RubricEditor";
import ExamMetadataEditDialog from "../../components/exam/ExamMetadataEditDialog";
import ClassMultiSelect from "../../components/exam/ClassMultiSelect";
import {
  ArrowLeft,
  FileText,
  Users,
  Globe,
  Pencil,
  Send,
  LinkIcon,
  Loader2,
  Sparkles,
  RotateCcw,
  Check,
  DollarSign,
  ClipboardCheck,
  Image as ImageIcon,
} from "lucide-react";
import {
  DownloadPDFButton,
  Button,
  StatusBadge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Card,
  CardContent,
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Skeleton,
  MarkdownWithMath,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@levelup/shared-ui";

/** Normalize a query hook result (bare array | PageResponse | infinite query) → array. */
function asArray<T>(d: unknown): T[] {
  if (Array.isArray(d)) return d as T[];
  if (d && typeof d === "object") {
    const o = d as { items?: T[]; pages?: { items?: T[] }[] };
    if (Array.isArray(o.items)) return o.items;
    if (Array.isArray(o.pages)) return o.pages.flatMap((p) => p.items ?? []);
  }
  return [];
}

interface SpaceRow {
  id: string;
  title: string;
  subject?: string;
}

function RubricSummary({ rubric }: { rubric?: UnifiedRubric }) {
  if (!rubric) {
    return (
      <div className="text-muted-foreground mt-3 rounded-md border border-dashed px-3 py-2 text-xs italic">
        No rubric set. Click "Rubric" to define grading criteria.
      </div>
    );
  }

  const {
    scoringMode,
    criteria,
    dimensions,
    holisticGuidance,
    holisticMaxScore,
    passingPercentage,
    modelAnswer,
    showModelAnswer,
    evaluatorGuidance,
  } = rubric;

  const totalPoints =
    (scoringMode === "criteria_based" || scoringMode === "hybrid") && criteria
      ? criteria.reduce((sum, c) => sum + (c.maxPoints || 0), 0)
      : null;

  const showCriteriaTable =
    (scoringMode === "criteria_based" || scoringMode === "hybrid") &&
    criteria &&
    criteria.length > 0;
  const showDimensionsTable =
    scoringMode === "dimension_based" && dimensions && dimensions.length > 0;
  const showHolistic = (scoringMode === "holistic" || scoringMode === "hybrid") && holisticGuidance;

  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-purple-200 bg-gradient-to-b from-purple-50/40 to-transparent dark:border-purple-900/40 dark:from-purple-950/20">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-purple-200 bg-purple-50 px-3 py-2 dark:border-purple-900/40 dark:bg-purple-950/30">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
          <span className="text-xs font-semibold text-purple-900 dark:text-purple-200">
            Rubric &amp; Marking
          </span>
          <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium capitalize text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
            {scoringMode.replace(/_/g, " ")}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-purple-700 dark:text-purple-300">
          {totalPoints != null && (
            <span>
              <span className="font-semibold">{totalPoints}</span> total pts
            </span>
          )}
          {passingPercentage != null && (
            <span>
              Pass <span className="font-semibold">{passingPercentage}%</span>
            </span>
          )}
        </div>
      </div>

      <div className="p-3">
        {showCriteriaTable && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 text-xs">#</TableHead>
                <TableHead className="text-xs">Criterion</TableHead>
                <TableHead className="text-xs">Description / Levels</TableHead>
                <TableHead className="w-24 text-right text-xs">Marks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {criteria!.map((c, idx) => (
                <TableRow key={c.id}>
                  <TableCell className="text-muted-foreground text-xs font-medium">
                    {idx + 1}
                  </TableCell>
                  <TableCell className="text-xs font-medium">
                    <MarkdownWithMath text={c.name} inline />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {c.description && <MarkdownWithMath text={c.description} inline />}
                    {c.levels && c.levels.length > 0 && (
                      <ul className="mt-1 space-y-0.5">
                        {c.levels.map((lv, i) => (
                          <li key={i} className="flex items-baseline gap-2">
                            <span className="bg-muted rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold">
                              {lv.score}
                            </span>
                            <span className="font-medium">
                              <MarkdownWithMath text={lv.label} inline />
                            </span>
                            {lv.description && (
                              <span>
                                — <MarkdownWithMath text={lv.description} inline />
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                    {!c.description && (!c.levels || c.levels.length === 0) && (
                      <span className="italic">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-xs font-semibold tabular-nums">
                    {c.maxPoints}
                    {c.weight != null && (
                      <span className="text-muted-foreground ml-1 text-[10px] font-normal">
                        ×{c.weight}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {showDimensionsTable && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 text-xs">#</TableHead>
                <TableHead className="text-xs">Dimension</TableHead>
                <TableHead className="text-xs">Description</TableHead>
                <TableHead className="w-20 text-xs">Priority</TableHead>
                <TableHead className="w-16 text-right text-xs">Weight</TableHead>
                <TableHead className="w-16 text-right text-xs">Scale</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dimensions!.map((d, idx) => (
                <TableRow key={d.id} className={!d.enabled ? "opacity-50" : ""}>
                  <TableCell className="text-muted-foreground text-xs font-medium">
                    {idx + 1}
                  </TableCell>
                  <TableCell className="text-xs font-medium">
                    <MarkdownWithMath text={d.name} inline />
                    {!d.enabled && (
                      <span className="text-muted-foreground ml-1 text-[10px]">(off)</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {d.description ? (
                      <MarkdownWithMath text={d.description} inline />
                    ) : (
                      <span className="italic">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                        d.priority === "HIGH"
                          ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                          : d.priority === "MEDIUM"
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                            : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      }`}
                    >
                      {d.priority}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-xs font-semibold tabular-nums">
                    {d.weight}
                  </TableCell>
                  <TableCell className="text-right text-xs font-semibold tabular-nums">
                    {d.scoringScale}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {showHolistic && (
          <div className="rounded-md border bg-white/60 p-3 text-xs dark:bg-slate-900/40">
            <div className="text-muted-foreground mb-1 flex items-center justify-between">
              <span className="font-semibold">Holistic guidance</span>
              {holisticMaxScore != null && (
                <span>
                  Max <span className="text-foreground font-semibold">{holisticMaxScore}</span>
                </span>
              )}
            </div>
            <MarkdownWithMath text={holisticGuidance} />
          </div>
        )}

        {evaluatorGuidance && (
          <div className="mt-3 rounded-md border border-blue-200 bg-blue-50/60 p-3 text-xs dark:border-blue-900/40 dark:bg-blue-950/20">
            <p className="mb-1 font-semibold text-blue-800 dark:text-blue-300">
              Evaluator guidance
            </p>
            <div className="text-blue-900/90 dark:text-blue-200/90">
              <MarkdownWithMath text={evaluatorGuidance} />
            </div>
          </div>
        )}

        {showModelAnswer && modelAnswer && (
          <details className="group mt-3 rounded-md border bg-white/60 dark:bg-slate-900/40">
            <summary className="hover:bg-muted/50 cursor-pointer rounded-md px-3 py-2 text-xs font-semibold">
              Model answer
            </summary>
            <div className="border-t px-3 py-2 text-xs">
              <MarkdownWithMath text={modelAnswer} />
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

export default function ExamDetailPage() {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  // currentTenantId is retained: the kept shared-services callables (callSaveExam,
  // callGenerateReport, callExtractQuestions) and the Storage path still need it.
  const tenantId = useAuthSession((s) => s.currentTenantId);
  const { data: examData, isLoading, refetch } = useExam(examId ?? "");
  const exam = examData as Exam | undefined;
  const { data: submissionsData } = useSubmissions({ examId });
  const submissions = useMemo(() => asArray<Submission>(submissionsData), [submissionsData]);
  const { data: questionsData, refetch: refetchQuestions } = useExamQuestions(examId ?? "");
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  // Seed local question state from the query (kept local for in-session edits).
  useEffect(() => {
    setQuestions(asArray<ExamQuestion>(questionsData));
  }, [questionsData]);
  const [editingRubric, setEditingRubric] = useState<string | null>(null);
  const [showSpacePicker, setShowSpacePicker] = useState(false);
  const [linkingSpace, setLinkingSpace] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [reExtracting, setReExtracting] = useState<string | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, { text: string; maxMarks: number }>>(
    {}
  );
  // Query hooks are claims-scoped server-side — no tenantId arg.
  const { data: spacesData } = useSpaces({ status: "published" });
  const allSpaces = useMemo(() => asArray<SpaceRow>(spacesData), [spacesData]);
  const { data: classesData } = useClasses();
  const tenantClasses = useMemo(
    () => asArray<{ id: string; name: string }>(classesData),
    [classesData]
  );
  const { handleError } = useApiError();
  const [showEditMeta, setShowEditMeta] = useState(false);
  const [showEditClasses, setShowEditClasses] = useState(false);
  const [savingClasses, setSavingClasses] = useState(false);
  const [draftClassIds, setDraftClassIds] = useState<string[]>([]);
  const [questionPaperUrls, setQuestionPaperUrls] = useState<Record<string, string>>({});

  const editLocked = exam?.status === "results_released";

  // Question paper images are stored in Firestore as Cloud Storage paths.
  // Resolve them to HTTPS download URLs so <img> can render them.
  useEffect(() => {
    const paths = exam?.questionPaper?.images ?? [];
    if (paths.length === 0) return;
    const { storage } = getFirebaseServices();
    let cancelled = false;
    (async () => {
      const updates: Record<string, string> = {};
      await Promise.all(
        paths.map(async (p) => {
          if (!p || questionPaperUrls[p] !== undefined) return;
          if (/^https?:\/\//.test(p)) {
            updates[p] = p;
            return;
          }
          try {
            updates[p] = await getDownloadURL(storageRef(storage, p));
          } catch {
            updates[p] = "";
          }
        })
      );
      if (!cancelled && Object.keys(updates).length > 0) {
        setQuestionPaperUrls((prev) => ({ ...prev, ...updates }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [exam?.questionPaper?.images, questionPaperUrls]);

  const handlePublish = async () => {
    if (!tenantId || !examId) return;
    await callSaveExam({ id: examId, tenantId, data: { status: "published" } });
    refetch();
  };

  const handleReleaseResults = async () => {
    if (!tenantId || !examId) return;
    await callSaveExam({ id: examId, tenantId, data: { status: "results_released" } });
    refetch();
  };

  const handleExtractQuestions = async () => {
    if (!tenantId || !examId) return;
    setExtracting(true);
    try {
      await callExtractQuestions({ tenantId, examId });
      await refetchQuestions();
      refetch();
    } finally {
      setExtracting(false);
    }
  };

  // PARITY GAP: @levelup/query has no saveExamQuestion callable (no
  // v1.autograde.* verb for editing a question's rubric/text/marks — the autograde
  // domain only exposes list + (re)extract + grade). Until a backend callable
  // exists, question edits are applied to local session state only and flagged.
  const handleSaveQuestionRubric = async (questionId: string, rubric: UnifiedRubric) => {
    setQuestions((prev) => prev.map((q) => (q.id === questionId ? { ...q, rubric } : q)));
    setEditingRubric(null);
    toast.warning(
      "Rubric updated for this session only — persisting question rubric edits needs a backend callable (reported to the team)."
    );
  };

  const handleReExtractQuestion = async (questionNumber: string) => {
    if (!tenantId || !examId) return;
    setReExtracting(questionNumber);
    try {
      await callExtractQuestions({ tenantId, examId, mode: "single", questionNumber });
      await refetchQuestions();
    } finally {
      setReExtracting(null);
    }
  };

  // PARITY GAP (see handleSaveQuestionRubric): no saveExamQuestion callable.
  const handleSaveQuestionEdit = async (questionId: string) => {
    const edits = editValues[questionId];
    if (!edits) return;
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === questionId ? { ...q, text: edits.text, maxMarks: edits.maxMarks } : q
      )
    );
    setEditingQuestion(null);
    setEditValues((prev) => {
      const next = { ...prev };
      delete next[questionId];
      return next;
    });
    toast.warning(
      "Question updated for this session only — persisting question edits needs a backend callable (reported to the team)."
    );
  };

  const handleConfirmAndPublish = async () => {
    if (!tenantId || !examId) return;
    await callSaveExam({ id: examId, tenantId, data: { status: "published" } });
    refetch();
  };

  const handleSaveClassIds = async (next: string[]) => {
    if (!tenantId || !examId) return;
    setSavingClasses(true);
    try {
      await callSaveExam({ id: examId, tenantId, data: { classIds: next } });
      toast.success("Exam classes updated");
      setShowEditClasses(false);
      refetch();
    } catch (err) {
      handleError(err, "Failed to update classes");
    } finally {
      setSavingClasses(false);
    }
  };

  const openEditClasses = () => {
    setDraftClassIds(exam?.classIds ?? []);
    setShowEditClasses(true);
  };

  const cancelEditClasses = () => {
    setShowEditClasses(false);
    setDraftClassIds([]);
  };

  const handleLinkSpace = async (spaceId: string) => {
    if (!tenantId || !examId) return;
    setLinkingSpace(true);
    try {
      await callSaveExam({ id: examId, tenantId, data: { linkedSpaceId: spaceId } });
      setShowSpacePicker(false);
      refetch();
    } finally {
      setLinkingSpace(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="py-24 text-center">
        <p className="text-muted-foreground">Exam not found</p>
        <Button variant="link" onClick={() => navigate("/exams")} className="mt-3">
          Back to Exams
        </Button>
      </div>
    );
  }

  const pendingReview = submissions.filter((s) => s.pipelineStatus === "ready_for_review");

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/exams">Exams</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{exam.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/exams")}
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold">{exam.title}</h1>
            <div className="mt-0.5 flex items-center gap-2">
              <StatusBadge status={exam.status} />
              <span className="text-muted-foreground text-xs">
                {exam.subject} &middot; {exam.totalMarks} marks &middot; {exam.duration} min
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowEditMeta(true)}
            disabled={editLocked}
            title={editLocked ? "Editing locked after results release" : undefined}
          >
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Button>
          {exam.status === "question_paper_uploaded" && (
            <Button
              onClick={handleExtractQuestions}
              disabled={extracting}
              size="sm"
              className="bg-purple-600 text-white hover:bg-purple-700"
            >
              {extracting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Extracting...
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" /> Extract Questions
                </>
              )}
            </Button>
          )}
          {(exam.status === "draft" ||
            exam.status === "question_paper_uploaded" ||
            exam.status === "question_paper_extracted") && (
            <Button
              onClick={handlePublish}
              size="sm"
              className="bg-green-600 text-white hover:bg-green-700"
            >
              <Globe className="h-3.5 w-3.5" /> Publish
            </Button>
          )}
          {exam.status === "completed" && (
            <Button
              onClick={handleReleaseResults}
              size="sm"
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              <Send className="h-3.5 w-3.5" /> Release Results
            </Button>
          )}
          {exam.linkedSpaceId ? (
            <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-3 text-xs font-medium text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-400">
              <LinkIcon className="h-3.5 w-3.5" />
              {exam.linkedSpaceTitle || "Linked Space"}
            </span>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setShowSpacePicker(true)}>
              <LinkIcon className="h-3.5 w-3.5" /> Link to Space
            </Button>
          )}
          {tenantId && examId && submissions.length > 0 && (
            <DownloadPDFButton
              onGenerate={async () => {
                const res = await callGenerateReport({
                  tenantId: tenantId!,
                  type: "exam-result",
                  examId: examId!,
                });
                return { downloadUrl: res.pdfUrl };
              }}
              label="Download Results PDF"
            />
          )}
          <Button variant="outline" size="sm" asChild>
            <Link to={`/exams/${examId}/submissions`}>
              <Users className="h-3.5 w-3.5" /> Submissions
              {pendingReview.length > 0 && (
                <span className="ml-1 rounded-full bg-orange-100 px-1.5 text-[10px] font-semibold text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                  {pendingReview.length}
                </span>
              )}
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats */}
      {exam.stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{exam.stats.totalSubmissions}</p>
              <p className="text-muted-foreground text-xs">Submissions</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{exam.stats.gradedSubmissions}</p>
              <p className="text-muted-foreground text-xs">Graded</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{Math.round(exam.stats.avgScore)}%</p>
              <p className="text-muted-foreground text-xs">Avg Score</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{Math.round(exam.stats.passRate)}%</p>
              <p className="text-muted-foreground text-xs">Pass Rate</p>
            </CardContent>
          </Card>
          {(exam.stats as Record<string, unknown>).totalGradingCostUsd != null && (
            <Card>
              <CardContent className="p-4 text-center">
                <p className="flex items-center justify-center gap-1 text-2xl font-bold">
                  <DollarSign className="h-4 w-4" />
                  {((exam.stats as Record<string, unknown>).totalGradingCostUsd as number).toFixed(
                    2
                  )}
                </p>
                <p className="text-muted-foreground text-xs">AI Grading Cost</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="questions">
        <TabsList>
          <TabsTrigger value="questions">Questions</TabsTrigger>
          <TabsTrigger value="submissions">Submissions</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Questions Tab */}
        <TabsContent value="questions" className="mt-4">
          <div className="space-y-3">
            {/* Uploaded Question Paper preview */}
            {(exam.questionPaper?.images?.length ?? 0) > 0 && (
              <Card>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="text-muted-foreground h-4 w-4" />
                      <h3 className="text-sm font-medium">Question Paper</h3>
                      <span className="text-muted-foreground text-xs">
                        {exam.questionPaper!.images.length} page
                        {exam.questionPaper!.images.length === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                    {exam.questionPaper!.images.map((path, idx) => {
                      const url = questionPaperUrls[path];
                      const resolved = url === undefined ? null : url;
                      return (
                        <a
                          key={path}
                          href={resolved || undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-muted group relative block aspect-[3/4] overflow-hidden rounded-md border"
                          aria-label={`Question paper page ${idx + 1}`}
                        >
                          {resolved === null ? (
                            <Skeleton className="h-full w-full" />
                          ) : resolved === "" ? (
                            <div className="text-muted-foreground flex h-full w-full items-center justify-center text-[11px]">
                              Failed to load
                            </div>
                          ) : (
                            <img
                              src={resolved}
                              alt={`Question paper page ${idx + 1}`}
                              loading="lazy"
                              className="h-full w-full object-contain transition-transform group-hover:scale-[1.02]"
                            />
                          )}
                          <span className="bg-background/80 absolute bottom-1 left-1 rounded px-1.5 py-0.5 text-[10px] font-medium">
                            {idx + 1}
                          </span>
                        </a>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Confirm & Publish button for extracted questions */}
            {exam.status === "question_paper_extracted" && questions.length > 0 && (
              <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950/30">
                <p className="text-sm text-blue-700 dark:text-blue-400">
                  Review the extracted questions below. Edit any inaccuracies, then confirm to
                  publish.
                </p>
                <Button
                  onClick={handleConfirmAndPublish}
                  size="sm"
                  className="bg-green-600 text-white hover:bg-green-700"
                >
                  <Check className="h-3.5 w-3.5" /> Confirm & Publish
                </Button>
              </div>
            )}
            {questions.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
                <FileText className="text-muted-foreground h-8 w-8" />
                <p className="text-muted-foreground mt-2 text-sm">
                  No questions yet. Upload a question paper to extract questions automatically.
                </p>
              </div>
            ) : (
              questions.map((q) => {
                const isEditing = editingQuestion === q.id;
                const edits = editValues[q.id];
                const confidence = (q as ExamQuestion & { extractionConfidence?: number })
                  .extractionConfidence;
                const hasReadabilityIssue = (q as ExamQuestion & { readabilityIssue?: boolean })
                  .readabilityIssue;

                return (
                  <Card key={q.id}>
                    <CardContent className="space-y-2 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-muted-foreground text-sm font-bold">
                              Q{q.order}.
                            </span>
                            {/* Confidence badge */}
                            {confidence != null && (
                              <span
                                className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                                  confidence >= 0.9
                                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                    : confidence >= 0.7
                                      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                      : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                }`}
                              >
                                {Math.round(confidence * 100)}% conf
                              </span>
                            )}
                            {hasReadabilityIssue && (
                              <span className="inline-flex items-center rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-medium text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                                Readability Issue
                              </span>
                            )}
                          </div>
                          {isEditing ? (
                            <div className="mt-2 space-y-2">
                              <textarea
                                value={edits?.text ?? q.text}
                                onChange={(e) =>
                                  setEditValues((prev) => ({
                                    ...prev,
                                    [q.id]: {
                                      text: e.target.value,
                                      maxMarks: prev[q.id]?.maxMarks ?? q.maxMarks,
                                    },
                                  }))
                                }
                                className="bg-background min-h-[60px] w-full resize-y rounded border p-2 text-sm"
                              />
                              <div className="flex items-center gap-2">
                                <label className="text-muted-foreground text-xs">Max Marks:</label>
                                <input
                                  type="number"
                                  value={edits?.maxMarks ?? q.maxMarks}
                                  onChange={(e) =>
                                    setEditValues((prev) => ({
                                      ...prev,
                                      [q.id]: {
                                        text: prev[q.id]?.text ?? q.text,
                                        maxMarks: Number(e.target.value),
                                      },
                                    }))
                                  }
                                  min={1}
                                  className="bg-background h-7 w-16 rounded border px-2 py-1 text-sm"
                                />
                                <Button size="sm" onClick={() => handleSaveQuestionEdit(q.id)}>
                                  <Check className="h-3 w-3" /> Save
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setEditingQuestion(null);
                                  }}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <MarkdownWithMath text={q.text} inline className="text-sm" />
                              <div className="text-muted-foreground mt-1 flex items-center gap-3 text-xs">
                                <span>{q.maxMarks} marks</span>
                                {q.questionType && (
                                  <span className="capitalize">{q.questionType}</span>
                                )}
                                {q.extractedBy && (
                                  <span className="capitalize">Extracted by {q.extractedBy}</span>
                                )}
                                <span className="capitalize">
                                  Rubric: {q.rubric?.scoringMode?.replace(/_/g, " ") ?? "none"}
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          {/* Re-extract button for low confidence */}
                          {confidence != null && confidence < 0.7 && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleReExtractQuestion(q.id)}
                              disabled={reExtracting === q.id}
                            >
                              {reExtracting === q.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <RotateCcw className="h-3 w-3" />
                              )}
                              Re-extract
                            </Button>
                          )}
                          {!isEditing && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingQuestion(q.id);
                                setEditValues((prev) => ({
                                  ...prev,
                                  [q.id]: { text: q.text, maxMarks: q.maxMarks },
                                }));
                              }}
                            >
                              <Pencil className="h-3 w-3" /> Edit
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingRubric(q.id)}
                          >
                            <Pencil className="h-3 w-3" /> Rubric
                          </Button>
                        </div>
                      </div>
                      {q.subQuestions && q.subQuestions.length > 0 && (
                        <div className="ml-6 space-y-1">
                          {q.subQuestions.map((sq) => (
                            <div key={sq.label} className="text-muted-foreground text-xs">
                              <span className="font-medium">{sq.label}</span>:{" "}
                              <MarkdownWithMath text={sq.text} inline /> ({sq.maxMarks} marks)
                            </div>
                          ))}
                        </div>
                      )}
                      {!isEditing && <RubricSummary rubric={q.rubric} />}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>

        {/* Submissions Tab (quick view) */}
        <TabsContent value="submissions" className="mt-4">
          <div className="space-y-3">
            {submissions.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">No submissions yet</p>
            ) : (
              submissions.slice(0, 10).map((sub) => (
                <Link
                  key={sub.id}
                  to={`/exams/${examId}/submissions/${sub.id}`}
                  className="bg-card flex items-center justify-between rounded-lg border p-3 hover:shadow-sm"
                >
                  <div>
                    <p className="text-sm font-medium">{sub.studentName}</p>
                    <p className="text-muted-foreground text-xs">
                      Roll: {sub.rollNumber} &middot; {sub.pipelineStatus.replace(/_/g, " ")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">
                      {sub.summary?.totalScore ?? "-"}/{sub.summary?.maxScore ?? exam.totalMarks}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {sub.summary?.percentage != null
                        ? `${Math.round(sub.summary.percentage)}%`
                        : "Pending"}
                    </p>
                  </div>
                </Link>
              ))
            )}
            {submissions.length > 10 && (
              <Link
                to={`/exams/${examId}/submissions`}
                className="text-primary block text-center text-sm hover:underline"
              >
                View all {submissions.length} submissions
              </Link>
            )}
          </div>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="mt-4 space-y-4">
          <Card className="max-w-xl">
            <CardContent className="space-y-4 p-5">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Classes</h3>
                {!editLocked && !showEditClasses && (
                  <Button variant="outline" size="sm" onClick={openEditClasses}>
                    <Pencil className="h-3.5 w-3.5" /> Manage
                  </Button>
                )}
              </div>
              {editLocked ? (
                <p className="text-muted-foreground text-xs">
                  Editing is locked once results are released.
                </p>
              ) : showEditClasses ? (
                tenantId && (
                  <div className="space-y-3">
                    <ClassMultiSelect
                      tenantId={tenantId}
                      value={draftClassIds}
                      onChange={setDraftClassIds}
                      disabled={savingClasses}
                      placeholder="Add classes..."
                    />
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={cancelEditClasses}
                        disabled={savingClasses}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleSaveClassIds(draftClassIds)}
                        disabled={savingClasses}
                      >
                        {savingClasses ? "Saving..." : "Save"}
                      </Button>
                    </div>
                  </div>
                )
              ) : (exam.classIds ?? []).length === 0 ? (
                <p className="text-muted-foreground text-xs">No classes assigned.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {(exam.classIds ?? []).map((cid) => {
                    const cls = tenantClasses.find((c) => c.id === cid);
                    return (
                      <span
                        key={cid}
                        className="bg-muted inline-flex items-center rounded-full px-2 py-0.5 text-xs"
                      >
                        {cls?.name ?? cid}
                      </span>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="max-w-xl">
            <CardContent className="space-y-4 p-5">
              <h3 className="font-medium">Grading Configuration</h3>
              <dl className="grid gap-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Auto Grade</dt>
                  <dd>{exam.gradingConfig.autoGrade ? "Yes" : "No"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Allow Rubric Edit</dt>
                  <dd>{exam.gradingConfig.allowRubricEdit ? "Yes" : "No"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Allow Manual Override</dt>
                  <dd>{exam.gradingConfig.allowManualOverride ? "Yes" : "No"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Require Override Reason</dt>
                  <dd>{exam.gradingConfig.requireOverrideReason ? "Yes" : "No"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Auto-release Results</dt>
                  <dd>{exam.gradingConfig.releaseResultsAutomatically ? "Yes" : "No"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Linked Space</dt>
                  <dd>
                    {exam.linkedSpaceId ? (
                      <span className="text-blue-600 dark:text-blue-400">
                        {exam.linkedSpaceTitle || exam.linkedSpaceId}
                      </span>
                    ) : (
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0"
                        onClick={() => setShowSpacePicker(true)}
                      >
                        Link a Space
                      </Button>
                    )}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Space Picker Dialog (Phase 1.2) */}
      <Dialog open={showSpacePicker} onOpenChange={setShowSpacePicker}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Link to a Space</DialogTitle>
            <DialogDescription>
              Select a published space to link to this exam. Students will see it as a study
              resource.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {allSpaces.length === 0 ? (
              <p className="text-muted-foreground py-4 text-center text-sm">
                No published spaces available.
              </p>
            ) : (
              allSpaces.map((space) => (
                <button
                  key={space.id}
                  onClick={() => handleLinkSpace(space.id)}
                  disabled={linkingSpace}
                  className="hover:bg-muted flex w-full items-center gap-3 rounded-md border p-3 text-left disabled:opacity-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{space.title}</p>
                    {space.subject && (
                      <p className="text-muted-foreground text-xs">{space.subject}</p>
                    )}
                  </div>
                  <LinkIcon className="text-muted-foreground h-4 w-4 flex-shrink-0" />
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Rubric Editor Sheet (Phase 1.3) */}
      <Sheet
        open={!!editingRubric}
        onOpenChange={(open) => {
          if (!open) setEditingRubric(null);
        }}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl" aria-describedby={undefined}>
          <SheetHeader>
            <SheetTitle>
              Edit Rubric — Q{questions.find((q) => q.id === editingRubric)?.order}
            </SheetTitle>
          </SheetHeader>
          {editingRubric && questions.find((q) => q.id === editingRubric) && (
            <div className="mt-4">
              <p className="text-muted-foreground mb-4 text-sm">
                {questions.find((q) => q.id === editingRubric)!.text}
              </p>
              <RubricEditor
                rubric={questions.find((q) => q.id === editingRubric)!.rubric}
                onSave={(rubric) => handleSaveQuestionRubric(editingRubric, rubric)}
              />
            </div>
          )}
        </SheetContent>
      </Sheet>

      {tenantId && exam && (
        <ExamMetadataEditDialog
          open={showEditMeta}
          onOpenChange={setShowEditMeta}
          tenantId={tenantId}
          exam={exam}
          onSaved={() => refetch()}
        />
      )}
    </div>
  );
}
