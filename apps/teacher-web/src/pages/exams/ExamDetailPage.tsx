import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useCurrentTenantId } from "@levelup/shared-stores";
import { useExam, useSubmissions } from "@levelup/shared-hooks";
import {
  collection,
  getDocs,
  query,
  orderBy,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import {
  getFirebaseServices,
  callSaveExam,
  callGenerateReport,
  callExtractQuestions,
} from "@levelup/shared-services";
import type { ExamQuestion, UnifiedRubric } from "@levelup/shared-types";
import RubricEditor from "../../components/spaces/RubricEditor";
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
} from "lucide-react";
import { useSpaces } from "@levelup/shared-hooks";
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
} from "@levelup/shared-ui";

export default function ExamDetailPage() {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const tenantId = useCurrentTenantId();
  const { data: exam, isLoading, refetch } = useExam(tenantId, examId ?? null);
  const { data: submissions = [] } = useSubmissions(tenantId, { examId });
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [editingRubric, setEditingRubric] = useState<string | null>(null);
  const [showSpacePicker, setShowSpacePicker] = useState(false);
  const [linkingSpace, setLinkingSpace] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [reExtracting, setReExtracting] = useState<string | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, { text: string; maxMarks: number }>>(
    {}
  );
  const { data: allSpaces = [] } = useSpaces(tenantId, { status: "published" });

  useEffect(() => {
    if (!tenantId || !examId) return;
    const load = async () => {
      const { db } = getFirebaseServices();
      const colRef = collection(db, `tenants/${tenantId}/exams/${examId}/questions`);
      const q = query(colRef, orderBy("order", "asc"));
      const snap = await getDocs(q);
      setQuestions(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ExamQuestion));
    };
    load();
  }, [tenantId, examId]);

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
      // Reload questions
      const { db } = getFirebaseServices();
      const colRef = collection(db, `tenants/${tenantId}/exams/${examId}/questions`);
      const q = query(colRef, orderBy("order", "asc"));
      const snap = await getDocs(q);
      setQuestions(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ExamQuestion));
      refetch();
    } finally {
      setExtracting(false);
    }
  };

  const handleSaveQuestionRubric = async (questionId: string, rubric: UnifiedRubric) => {
    if (!tenantId || !examId) return;
    const { db } = getFirebaseServices();
    await updateDoc(doc(db, `tenants/${tenantId}/exams/${examId}/questions`, questionId), {
      rubric,
      updatedAt: serverTimestamp(),
    });
    setQuestions((prev) => prev.map((q) => (q.id === questionId ? { ...q, rubric } : q)));
    setEditingRubric(null);
  };

  const handleReExtractQuestion = async (questionNumber: string) => {
    if (!tenantId || !examId) return;
    setReExtracting(questionNumber);
    try {
      await callExtractQuestions({ tenantId, examId, mode: "single", questionNumber });
      // Reload questions
      const { db } = getFirebaseServices();
      const colRef = collection(db, `tenants/${tenantId}/exams/${examId}/questions`);
      const q = query(colRef, orderBy("order", "asc"));
      const snap = await getDocs(q);
      setQuestions(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ExamQuestion));
    } finally {
      setReExtracting(null);
    }
  };

  const handleSaveQuestionEdit = async (questionId: string) => {
    if (!tenantId || !examId) return;
    const edits = editValues[questionId];
    if (!edits) return;
    const { db } = getFirebaseServices();
    await updateDoc(doc(db, `tenants/${tenantId}/exams/${examId}/questions`, questionId), {
      text: edits.text,
      maxMarks: edits.maxMarks,
      updatedAt: serverTimestamp(),
    });
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
  };

  const handleConfirmAndPublish = async () => {
    if (!tenantId || !examId) return;
    await callSaveExam({ id: examId, tenantId, data: { status: "published" } });
    refetch();
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
                                  Rubric: {q.rubric?.scoringMode ?? "none"}
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
        <TabsContent value="settings" className="mt-4">
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
    </div>
  );
}
