import { useState, useRef, useMemo, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  useExam,
  useSubmissions,
  useStudents,
  useClasses,
  useReleaseResults,
  useUploadAnswerSheets,
  useUploadImage,
} from "@levelup/query";
import { asExamId, asStudentId, asClassId } from "@levelup/domain";
import { useAuthSession } from "../../sdk/session";
import type { Exam, Submission } from "@levelup/shared-types";
import {
  ArrowLeft,
  Upload,
  Loader2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Eye,
  Send,
  FileCheck,
  BarChart3,
  Users,
  Download,
  Info,
} from "lucide-react";
import {
  Button,
  Label,
  Badge,
  Card,
  CardContent,
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@levelup/shared-ui";

const PIPELINE_ICONS: Record<string, React.ElementType> = {
  uploaded: Clock,
  ocr_processing: Loader2,
  scouting: Loader2,
  scouting_complete: CheckCircle2,
  grading: Loader2,
  grading_partial: Clock,
  grading_complete: CheckCircle2,
  ready_for_review: Eye,
  reviewed: CheckCircle2,
  failed: AlertCircle,
  manual_review_needed: AlertCircle,
};

const PIPELINE_COLORS: Record<string, string> = {
  uploaded: "text-info",
  ocr_processing: "text-info animate-spin",
  scouting: "text-info animate-spin",
  scouting_complete: "text-success",
  grading: "text-info animate-spin",
  grading_partial: "text-info",
  grading_complete: "text-success",
  ready_for_review: "text-warning",
  reviewed: "text-success",
  failed: "text-error",
  manual_review_needed: "text-error",
};

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

interface ClassRow {
  id: string;
  name: string;
}

export default function SubmissionsPage() {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  // The Storage upload path is now server-owned (v1 requestUploadUrl) and the
  // answer-sheet write goes through the claims-scoped v1 useUploadAnswerSheets —
  // neither needs a client-supplied tenantId, so it is no longer read here.
  const firebaseUser = useAuthSession((s) => s.firebaseUser);
  const { data: examData } = useExam(examId ?? "");
  const exam = examData as Exam | undefined;
  // Rubric-completion GATE (ARCHITECTURE-PLAN §3.4): answer-sheet upload is
  // grading-eligible ONLY once Pass-2 rubric generation completes, recorded on the
  // exam as `questionPaper.rubricsGeneratedAt` (typed optional on the domain schema;
  // not yet on the shared-types Exam, so read via a narrow cast). The server also
  // rejects uploads with FAILED_PRECONDITION when it's absent — this is the matching
  // client gate so teachers see it before hitting an error.
  const rubricsReady = !!(exam?.questionPaper as { rubricsGeneratedAt?: unknown } | undefined)
    ?.rubricsGeneratedAt;
  const gateBlocked = !!exam && !rubricsReady;
  const { data: submissionsData, refetch } = useSubmissions({ examId });
  const submissions = useMemo(() => asArray<Submission>(submissionsData), [submissionsData]);
  const { data: classesData } = useClasses();
  const allClasses = useMemo(() => asArray<ClassRow>(classesData), [classesData]);
  const releaseResults = useReleaseResults();
  const uploadAnswerSheets = useUploadAnswerSheets();
  const uploadImage = useUploadImage();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const [classId, setClassId] = useState("");
  const [studentId, setStudentId] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  // When a submission already exists for the picked student, the server rejects the
  // upload (FAILED_PRECONDITION / meta.reason='submission_exists') so released results
  // are never silently overwritten. We stash the already-uploaded storage paths here
  // and prompt the teacher to confirm an explicit replace (no re-upload needed).
  const [replacePrompt, setReplacePrompt] = useState<{
    studentId: string;
    classId: string;
    imageUrls: string[];
    resultsReleased: boolean;
    pipelineStatus: string;
  } | null>(null);

  // Only show classes assigned to this exam.
  const examClasses = useMemo(
    () => allClasses.filter((c) => exam?.classIds?.includes(c.id)),
    [allClasses, exam?.classIds]
  );
  const classNameById = useMemo(
    () => Object.fromEntries(allClasses.map((c) => [c.id, c.name])),
    [allClasses]
  );
  const { data: studentsData } = useStudents(classId ? { classId } : undefined);
  const { data: allStudentsData } = useStudents();
  const students = useMemo(
    () =>
      asArray<{ id: string; rollNumber?: string; firstName?: string; lastName?: string }>(
        studentsData
      ),
    [studentsData]
  );
  const allStudents = useMemo(
    () =>
      asArray<{
        id: string;
        rollNumber?: string;
        firstName?: string;
        lastName?: string;
        displayName?: string;
        admissionNumber?: string;
      }>(allStudentsData),
    [allStudentsData]
  );
  const studentById = useMemo(
    () => Object.fromEntries(allStudents.map((s) => [s.id, s])),
    [allStudents]
  );

  const getSubmissionStudentLabel = (sub: Submission) => {
    const student = studentById[sub.studentId];
    return (
      sub.studentName ||
      student?.displayName ||
      `${student?.firstName ?? ""} ${student?.lastName ?? ""}`.trim() ||
      sub.studentId
    );
  };

  const getSubmissionDetails = (sub: Submission) => {
    const student = studentById[sub.studentId];
    const classLabel = sub.classId ? (classNameById[sub.classId] ?? sub.classId) : "—";
    const roll = sub.rollNumber || student?.rollNumber || "—";
    const admission = student?.admissionNumber;
    return { classLabel, roll, admission };
  };

  // Reset student selection when class changes.
  useEffect(() => {
    setStudentId("");
  }, [classId]);

  // Auto-pick the only class if there's exactly one.
  useEffect(() => {
    if (!classId && examClasses.length === 1) {
      setClassId(examClasses[0].id);
    }
  }, [classId, examClasses]);

  /**
   * Send the answer-sheet write. On a re-upload for a student who already has a
   * submission the server returns FAILED_PRECONDITION with meta.reason
   * 'submission_exists' — we surface that as an explicit replace confirmation instead
   * of a silent no-op (the old bug) or a raw error. `replace:true` overwrites the
   * existing submission and re-runs grading.
   */
  const submitAnswerSheets = async (args: {
    studentId: string;
    classId: string;
    imageUrls: string[];
    replace?: boolean;
  }) => {
    if (!examId) return;
    setUploadError(null);
    setUploadNotice(null);
    setUploading(true);
    try {
      const res = await uploadAnswerSheets.mutateAsync({
        examId: asExamId(examId),
        studentId: asStudentId(args.studentId),
        classId: asClassId(args.classId),
        imageUrls: args.imageUrls,
        ...(args.replace ? { replace: true } : {}),
      });
      // Honest outcome: replaced (grading restarted) vs created.
      const replaced = (res as { replaced?: boolean } | undefined)?.replaced === true;
      setUploadNotice(
        replaced
          ? "Answer sheets replaced — the previous grade was cleared and re-grading has started."
          : "Answer sheets uploaded — grading has started."
      );
      setReplacePrompt(null);
      setStudentId("");
      setSelectedFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      refetch();
    } catch (err) {
      const apiErr = err as {
        code?: string;
        message?: string;
        meta?: {
          reason?: string;
          resultsReleased?: boolean;
          pipelineStatus?: string;
        };
      };
      if (apiErr?.meta?.reason === "submission_exists") {
        // Existing submission — offer an explicit replace (paths already uploaded).
        setReplacePrompt({
          studentId: args.studentId,
          classId: args.classId,
          imageUrls: args.imageUrls,
          resultsReleased: apiErr.meta.resultsReleased === true,
          pipelineStatus: apiErr.meta.pipelineStatus ?? "",
        });
      } else {
        setUploadError(err instanceof Error ? err.message : "Upload failed");
      }
    } finally {
      setUploading(false);
    }
  };

  const handleUploadSubmission = async () => {
    if (!examId || !firebaseUser) return;
    if (selectedFiles.length === 0) {
      setUploadError("Pick at least one file.");
      return;
    }
    if (!classId) {
      setUploadError("Select a class.");
      return;
    }
    if (!studentId) {
      setUploadError("Select a student.");
      return;
    }

    setUploadError(null);
    setUploadNotice(null);
    setReplacePrompt(null);
    setUploading(true);
    try {
      // Each answer sheet is PUT to a server-owned, scoped path via v1
      // requestUploadUrl; the returned paths feed the uploadAnswerSheets write.
      const storagePaths: string[] = [];
      for (const file of selectedFiles) {
        const path = await uploadImage.mutateAsync({
          kind: "answer-sheet",
          examId: asExamId(examId),
          studentId: asStudentId(studentId),
          classId: asClassId(classId),
          contentType: file.type || "application/octet-stream",
          body: file,
        });
        storagePaths.push(path);
      }
      await submitAnswerSheets({ studentId, classId, imageUrls: storagePaths });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
      setUploading(false);
    }
  };

  // The legacy code flipped `resultsReleased` per-submission via a Firestore batch;
  // the SDK's authoritative verb is the exam-level `releaseResults` callable
  // (v1.autograde.releaseResults). It releases this exam's reviewed results
  // server-side (the per-submission flag is set by the callable).
  const handleReleaseResults = async () => {
    if (!examId) return;
    try {
      await releaseResults.mutateAsync({ examId });
      refetch();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Failed to release results");
    }
  };

  const handleExportCSV = () => {
    if (submissions.length === 0) return;

    // Build CSV header
    const headers = [
      "Student Name",
      "Roll Number",
      "Class",
      "Pipeline Status",
      "Total Score",
      "Max Score",
      "Percentage",
      "Grade",
    ];

    // Build rows
    const rows = submissions.map((sub) => [
      sub.studentName ?? "",
      sub.rollNumber ?? "",
      sub.classId ?? "",
      sub.pipelineStatus.replace(/_/g, " "),
      sub.summary?.totalScore?.toString() ?? "",
      sub.summary?.maxScore?.toString() ?? "",
      sub.summary?.percentage != null ? Math.round(sub.summary.percentage).toString() : "",
      sub.summary?.grade ?? "",
    ]);

    // Escape CSV values
    const escapeCsv = (val: string) => {
      if (val.includes(",") || val.includes('"') || val.includes("\n")) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    };

    const csv = [
      headers.map(escapeCsv).join(","),
      ...rows.map((row) => row.map(escapeCsv).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${exam?.title ?? "exam"}-results.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const reviewedSubs = submissions.filter(
    (s) => s.pipelineStatus === "reviewed" || s.pipelineStatus === "grading_complete"
  );
  const unreleasedReviewed = reviewedSubs.filter((s) => !s.resultsReleased);

  // Summary stats
  const stats = useMemo(() => {
    const total = submissions.length;
    const graded = submissions.filter((s) =>
      ["grading_complete", "ready_for_review", "reviewed"].includes(s.pipelineStatus)
    ).length;
    const needsReview = submissions.filter((s) =>
      ["ready_for_review", "manual_review_needed", "grading_partial"].includes(s.pipelineStatus)
    ).length;
    const inProgress = submissions.filter((s) =>
      ["uploaded", "ocr_processing", "scouting", "scouting_complete", "grading"].includes(
        s.pipelineStatus
      )
    ).length;
    const scores = submissions
      .filter((s) => s.summary?.percentage != null)
      .map((s) => s.summary!.percentage);
    const avgScore =
      scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    return { total, graded, needsReview, inProgress, avgScore };
  }, [submissions]);

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
            <BreadcrumbLink asChild>
              <Link to={`/exams/${examId}`}>{exam?.title ?? "Exam"}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Submissions</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(`/exams/${examId}`)}
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="font-display text-xl font-semibold">Submissions</h1>
          <p className="text-muted-foreground text-sm">
            {exam?.title} &middot; {submissions.length} submissions
          </p>
        </div>
        <div className="flex items-center gap-2">
          {submissions.length > 0 && (
            <Button onClick={handleExportCSV} variant="outline" size="sm">
              <Download className="h-3.5 w-3.5" /> Export CSV
            </Button>
          )}
          {unreleasedReviewed.length > 0 && (
            <Button
              onClick={() => handleReleaseResults()}
              disabled={releaseResults.isPending}
              size="sm"
              className="bg-brand text-fg-on-accent hover:bg-brand-hover"
            >
              <Send className="h-3.5 w-3.5" /> Release All Results ({unreleasedReviewed.length})
            </Button>
          )}
        </div>
      </div>

      {/* Summary Stats */}
      {submissions.length > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Card>
            <CardContent className="p-3 text-center">
              <Users className="text-muted-foreground mx-auto mb-1 h-4 w-4" />
              <p className="font-mono text-lg font-bold">{stats.total}</p>
              <p className="text-muted-foreground text-[10px]">Total</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <FileCheck className="text-success mx-auto mb-1 h-4 w-4" />
              <p className="font-mono text-lg font-bold">{stats.graded}</p>
              <p className="text-muted-foreground text-[10px]">Graded</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <Loader2 className="text-info mx-auto mb-1 h-4 w-4" />
              <p className="font-mono text-lg font-bold">{stats.inProgress}</p>
              <p className="text-muted-foreground text-[10px]">In Progress</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <Eye className="text-warning mx-auto mb-1 h-4 w-4" />
              <p className="font-mono text-lg font-bold">{stats.needsReview}</p>
              <p className="text-muted-foreground text-[10px]">Needs Review</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <BarChart3 className="text-primary mx-auto mb-1 h-4 w-4" />
              <p className="font-mono text-lg font-bold">
                {stats.avgScore != null ? `${stats.avgScore}%` : "—"}
              </p>
              <p className="text-muted-foreground text-[10px]">Avg Score</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Upload new submission */}
      <Card>
        <CardContent className="space-y-4 p-5">
          <h3 className="font-medium">Upload Answer Sheet</h3>
          {gateBlocked && (
            <div className="border-warning/30 bg-warning-subtle text-warning flex items-start gap-2 rounded border p-3 text-xs">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Rubrics are still being generated — finish extraction first. Answer sheets can't be
                uploaded until every question has a rubric.{" "}
                <Link to={`/exams/${examId}`} className="font-medium underline underline-offset-2">
                  Generate missing rubrics on the exam page
                </Link>
                .
              </span>
            </div>
          )}
          {examClasses.length === 0 ? (
            <div className="border-warning/30 bg-warning-subtle text-warning flex items-start gap-2 rounded border p-3 text-xs">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                This exam has no classes assigned. Add classes on the exam page before uploading
                submissions.
              </span>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs">Class</Label>
                <Select value={classId} onValueChange={setClassId}>
                  <SelectTrigger className="mt-1 h-8">
                    <SelectValue placeholder="Select a class" />
                  </SelectTrigger>
                  <SelectContent>
                    {examClasses.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Student</Label>
                <Select value={studentId} onValueChange={setStudentId} disabled={!classId}>
                  <SelectTrigger className="mt-1 h-8">
                    <SelectValue
                      placeholder={
                        !classId
                          ? "Pick a class first"
                          : students.length === 0
                            ? "No students in this class"
                            : "Select a student"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {students.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.rollNumber ? `${s.rollNumber} — ` : ""}
                        {`${s.firstName ?? ""} ${s.lastName ?? ""}`.trim() || s.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const droppedFiles = Array.from(e.dataTransfer.files);
              setSelectedFiles(droppedFiles);
              // Update the file input programmatically isn't possible but track state
            }}
            className="hover:border-primary hover:bg-muted/50 duration-fast ease-standard cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors"
          >
            <Upload className="text-muted-foreground mx-auto h-6 w-6" />
            <p className="mt-1 text-sm font-medium">Click to upload or drag and drop</p>
            <p className="text-muted-foreground text-xs">PDF or image files</p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf"
              onChange={(e) => setSelectedFiles(Array.from(e.target.files ?? []))}
              className="hidden"
            />
          </div>
          {selectedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedFiles.map((f, i) => (
                <Badge key={i} variant="secondary">
                  {f.name}
                </Badge>
              ))}
            </div>
          )}
          {uploadError && (
            <div className="border-error/30 bg-error-subtle text-error flex items-start gap-2 rounded border p-2 text-xs">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="break-all">{uploadError}</span>
            </div>
          )}
          {uploadNotice && (
            <div className="border-success/30 bg-success-subtle text-success flex items-start gap-2 rounded border p-2 text-xs">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{uploadNotice}</span>
            </div>
          )}
          {replacePrompt && (
            <div className="border-warning/40 bg-warning-subtle text-warning flex flex-col gap-2 rounded border p-3 text-xs">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {replacePrompt.resultsReleased ? (
                    <>
                      This student's results were already <strong>released</strong>. Replacing will{" "}
                      <strong>discard the released grade</strong> and re-grade the new answer sheets
                      — the student will lose access until you review and release again.
                    </>
                  ) : (
                    <>
                      This student already has a submission for this exam
                      {replacePrompt.pipelineStatus
                        ? ` (${replacePrompt.pipelineStatus.replace(/_/g, " ")})`
                        : ""}
                      . Replacing will overwrite it with the new answer sheets and re-run grading.
                    </>
                  )}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() =>
                    submitAnswerSheets({
                      studentId: replacePrompt.studentId,
                      classId: replacePrompt.classId,
                      imageUrls: replacePrompt.imageUrls,
                      replace: true,
                    })
                  }
                  disabled={uploading}
                  size="sm"
                  className="bg-error text-fg-on-accent hover:bg-error/90"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Replacing...
                    </>
                  ) : (
                    <>Replace submission</>
                  )}
                </Button>
                <Button
                  onClick={() => setReplacePrompt(null)}
                  disabled={uploading}
                  variant="outline"
                  size="sm"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
          <Button
            onClick={handleUploadSubmission}
            disabled={
              uploading ||
              selectedFiles.length === 0 ||
              !classId ||
              !studentId ||
              examClasses.length === 0 ||
              gateBlocked
            }
            size="sm"
          >
            {uploading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading...
              </>
            ) : (
              <>
                <Upload className="h-3.5 w-3.5" /> Upload
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Submission list */}
      <div className="space-y-2">
        {submissions.length === 0 ? (
          <p className="text-muted-foreground py-12 text-center text-sm">
            No submissions yet. Upload answer sheets above.
          </p>
        ) : (
          submissions.map((sub: Submission) => {
            const StatusIcon = PIPELINE_ICONS[sub.pipelineStatus] ?? Clock;
            const statusColor = PIPELINE_COLORS[sub.pipelineStatus] ?? "text-fg-muted";
            const studentLabel = getSubmissionStudentLabel(sub);
            const { classLabel, roll, admission } = getSubmissionDetails(sub);

            return (
              <Link
                key={sub.id}
                to={`/exams/${examId}/submissions/${sub.id}`}
                className="bg-card border-subtle shadow-e1 hover:shadow-e2 duration-fast ease-standard block overflow-hidden rounded-lg border transition-shadow"
              >
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <StatusIcon className={`h-5 w-5 ${statusColor}`} />
                    <div>
                      <p className="text-sm font-medium">{studentLabel}</p>
                      <p className="text-muted-foreground text-xs">
                        Roll: {roll} · Class: {classLabel}
                        {admission ? ` · Adm: ${admission}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-muted-foreground text-xs capitalize">
                      {sub.pipelineStatus.replace(/_/g, " ")}
                    </span>
                    <div className="text-right">
                      <p className="font-mono text-sm font-semibold">
                        {sub.summary?.totalScore ?? "-"}/
                        {sub.summary?.maxScore ?? exam?.totalMarks ?? "-"}
                      </p>
                      {sub.summary?.percentage != null && (
                        <p className="text-muted-foreground font-mono text-xs">
                          {Math.round(sub.summary.percentage)}%{" "}
                          {sub.summary.grade && `(${sub.summary.grade})`}
                        </p>
                      )}
                    </div>
                    {sub.resultsReleased && (
                      <span className="rounded-pill bg-success-subtle text-success px-2 py-0.5 text-[10px] font-medium">
                        Released
                      </span>
                    )}
                  </div>
                </div>
                {/* Pipeline progress bar for active grading */}
                {sub.pipelineStatus === "grading" &&
                  (sub as Submission & { gradingProgress?: { percentComplete?: number } })
                    .gradingProgress?.percentComplete != null && (
                    <div className="px-4 pb-3">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-muted-foreground text-[10px]">
                          Grading in progress
                        </span>
                        <span className="text-info font-mono text-[10px] font-medium">
                          {
                            (sub as Submission & { gradingProgress?: { percentComplete?: number } })
                              .gradingProgress!.percentComplete
                          }
                          %
                        </span>
                      </div>
                      <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                        <div
                          className="bg-info duration-base ease-standard h-full rounded-full transition-all"
                          style={{
                            width: `${(sub as Submission & { gradingProgress?: { percentComplete?: number } }).gradingProgress!.percentComplete}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                {/* Pipeline step indicator for non-terminal states */}
                {[
                  "uploaded",
                  "ocr_processing",
                  "scouting",
                  "scouting_complete",
                  "grading",
                ].includes(sub.pipelineStatus) && (
                  <div className="px-4 pb-3">
                    <PipelineSteps status={sub.pipelineStatus} />
                  </div>
                )}
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}

const PIPELINE_STEP_ORDER = ["uploaded", "scouting", "grading", "review"] as const;
const PIPELINE_STEP_LABELS: Record<string, string> = {
  uploaded: "Upload",
  scouting: "Mapping",
  grading: "Grading",
  review: "Review",
};

function pipelineStepIndex(status: string): number {
  if (status === "uploaded") return 0;
  if (status === "ocr_processing" || status === "scouting") return 1;
  if (status === "scouting_complete" || status === "grading") return 2;
  return 3;
}

function PipelineSteps({ status }: { status: string }) {
  const currentIdx = pipelineStepIndex(status);

  return (
    <div className="flex items-center gap-1">
      {PIPELINE_STEP_ORDER.map((step, idx) => {
        const isComplete = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        return (
          <div key={step} className="flex flex-1 items-center gap-1">
            <div
              className={`duration-fast ease-standard h-1 flex-1 rounded-full transition-colors ${
                isComplete ? "bg-success" : isCurrent ? "bg-primary animate-pulse" : "bg-muted"
              }`}
            />
            <span
              className={`whitespace-nowrap text-[9px] ${
                isComplete
                  ? "text-success"
                  : isCurrent
                    ? "text-primary font-medium"
                    : "text-muted-foreground"
              }`}
            >
              {PIPELINE_STEP_LABELS[step]}
            </span>
          </div>
        );
      })}
    </div>
  );
}
