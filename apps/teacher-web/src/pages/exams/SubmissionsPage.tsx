import { useState, useRef, useMemo, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  useExam,
  useSubmissions,
  useStudents,
  useClasses,
  useReleaseResults,
} from "@levelup/query";
import { useAuthSession } from "../../sdk/session";
import { ref, uploadBytes } from "firebase/storage";
import { getFirebaseServices, callUploadAnswerSheets } from "@levelup/shared-services";
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
  uploaded: "text-blue-500",
  ocr_processing: "text-blue-500 animate-spin",
  scouting: "text-blue-500 animate-spin",
  scouting_complete: "text-green-500",
  grading: "text-purple-500 animate-spin",
  grading_partial: "text-purple-500",
  grading_complete: "text-green-500",
  ready_for_review: "text-orange-500",
  reviewed: "text-green-600",
  failed: "text-red-500",
  manual_review_needed: "text-red-500",
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
  // currentTenantId is retained: the kept shared-services callUploadAnswerSheets
  // and the Storage upload path still need it.
  const tenantId = useAuthSession((s) => s.currentTenantId);
  const firebaseUser = useAuthSession((s) => s.firebaseUser);
  const { data: examData } = useExam(examId ?? "");
  const exam = examData as Exam | undefined;
  const { data: submissionsData, refetch } = useSubmissions({ examId });
  const submissions = useMemo(() => asArray<Submission>(submissionsData), [submissionsData]);
  const { data: classesData } = useClasses();
  const allClasses = useMemo(() => asArray<ClassRow>(classesData), [classesData]);
  const releaseResults = useReleaseResults();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [classId, setClassId] = useState("");
  const [studentId, setStudentId] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  // Only show classes assigned to this exam.
  const examClasses = useMemo(
    () => allClasses.filter((c) => exam?.classIds?.includes(c.id)),
    [allClasses, exam?.classIds]
  );
  const { data: studentsData } = useStudents(classId ? { classId } : undefined);
  const students = useMemo(
    () =>
      asArray<{ id: string; rollNumber?: string; firstName?: string; lastName?: string }>(
        studentsData
      ),
    [studentsData]
  );

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

  const handleUploadSubmission = async () => {
    if (!tenantId || !examId || !firebaseUser) return;
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
    setUploading(true);
    try {
      const { storage } = getFirebaseServices();
      const storagePaths: string[] = [];
      for (const file of selectedFiles) {
        const path = `tenants/${tenantId}/submissions/${examId}/${Date.now()}_${file.name}`;
        const storageRef = ref(storage, path);
        await uploadBytes(storageRef, file);
        storagePaths.push(path);
      }

      await callUploadAnswerSheets({
        tenantId,
        examId,
        studentId,
        classId,
        imageUrls: storagePaths,
      });

      setStudentId("");
      setSelectedFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      refetch();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
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
          <h1 className="text-xl font-bold">Submissions</h1>
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
              className="bg-blue-600 text-white hover:bg-blue-700"
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
              <p className="text-lg font-bold">{stats.total}</p>
              <p className="text-muted-foreground text-[10px]">Total</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <FileCheck className="mx-auto mb-1 h-4 w-4 text-green-500" />
              <p className="text-lg font-bold">{stats.graded}</p>
              <p className="text-muted-foreground text-[10px]">Graded</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <Loader2 className="mx-auto mb-1 h-4 w-4 text-blue-500" />
              <p className="text-lg font-bold">{stats.inProgress}</p>
              <p className="text-muted-foreground text-[10px]">In Progress</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <Eye className="mx-auto mb-1 h-4 w-4 text-amber-500" />
              <p className="text-lg font-bold">{stats.needsReview}</p>
              <p className="text-muted-foreground text-[10px]">Needs Review</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <BarChart3 className="text-primary mx-auto mb-1 h-4 w-4" />
              <p className="text-lg font-bold">
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
          {examClasses.length === 0 ? (
            <div className="flex items-start gap-2 rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-300">
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
            className="hover:border-primary hover:bg-muted/50 cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors"
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
            <div className="flex items-start gap-2 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/20 dark:text-red-400">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="break-all">{uploadError}</span>
            </div>
          )}
          <Button
            onClick={handleUploadSubmission}
            disabled={
              uploading ||
              selectedFiles.length === 0 ||
              !classId ||
              !studentId ||
              examClasses.length === 0
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
            const statusColor = PIPELINE_COLORS[sub.pipelineStatus] ?? "text-gray-500";

            return (
              <Link
                key={sub.id}
                to={`/exams/${examId}/submissions/${sub.id}`}
                className="bg-card block overflow-hidden rounded-lg border transition-shadow hover:shadow-sm"
              >
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <StatusIcon className={`h-5 w-5 ${statusColor}`} />
                    <div>
                      <p className="text-sm font-medium">{sub.studentName}</p>
                      <p className="text-muted-foreground text-xs">
                        Roll: {sub.rollNumber}
                        {sub.classId && ` | Class: ${sub.classId}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-muted-foreground text-xs capitalize">
                      {sub.pipelineStatus.replace(/_/g, " ")}
                    </span>
                    <div className="text-right">
                      <p className="text-sm font-semibold">
                        {sub.summary?.totalScore ?? "-"}/
                        {sub.summary?.maxScore ?? exam?.totalMarks ?? "-"}
                      </p>
                      {sub.summary?.percentage != null && (
                        <p className="text-muted-foreground text-xs">
                          {Math.round(sub.summary.percentage)}%{" "}
                          {sub.summary.grade && `(${sub.summary.grade})`}
                        </p>
                      )}
                    </div>
                    {sub.resultsReleased && (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
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
                        <span className="text-[10px] font-medium text-purple-600 dark:text-purple-400">
                          {
                            (sub as Submission & { gradingProgress?: { percentComplete?: number } })
                              .gradingProgress!.percentComplete
                          }
                          %
                        </span>
                      </div>
                      <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                        <div
                          className="h-full rounded-full bg-purple-500 transition-all duration-500"
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
              className={`h-1 flex-1 rounded-full transition-colors ${
                isComplete ? "bg-green-500" : isCurrent ? "bg-primary animate-pulse" : "bg-muted"
              }`}
            />
            <span
              className={`whitespace-nowrap text-[9px] ${
                isComplete
                  ? "text-green-600 dark:text-green-400"
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
