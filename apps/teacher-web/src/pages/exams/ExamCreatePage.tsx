import { useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useSpaces, useApiError, useSaveExam, useUploadImage } from "@levelup/query";
import { asClassId, asSpaceId, asExamId } from "@levelup/domain";
import { useAuthSession } from "../../sdk/session";
import { ArrowLeft, ArrowRight, Upload, Check, Loader2, LinkIcon } from "lucide-react";
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Badge,
} from "@levelup/shared-ui";
import ClassMultiSelect from "../../components/exam/ClassMultiSelect";

type WizardStep = "metadata" | "upload" | "review" | "publish";

const STEPS: { value: WizardStep; label: string }[] = [
  { value: "metadata", label: "Exam Details" },
  { value: "upload", label: "Upload Question Paper" },
  { value: "review", label: "Review" },
  { value: "publish", label: "Publish" },
];

interface SpaceRow {
  id: string;
  title: string;
  subject?: string;
}

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

export default function ExamCreatePage() {
  const navigate = useNavigate();
  // currentTenantId is retained only for the class picker; the server now owns
  // the Storage upload path (v1 requestUploadUrl) and exam writes go through the
  // claims-scoped v1 useSaveExam hook — neither needs a client-supplied tenantId.
  const tenantId = useAuthSession((s) => s.currentTenantId);
  const firebaseUser = useAuthSession((s) => s.firebaseUser);
  const [step, setStep] = useState<WizardStep>("metadata");
  const [saving, setSaving] = useState(false);
  const { handleError } = useApiError();
  const saveExam = useSaveExam();
  const uploadImage = useUploadImage();

  // Metadata
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [topics, setTopics] = useState("");
  const [totalMarks, setTotalMarks] = useState(100);
  const [passingMarks, setPassingMarks] = useState(40);
  const [duration, setDuration] = useState(60);
  const [classIds, setClassIds] = useState<string[]>([]);

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Linked Space (optional) — query hooks are claims-scoped (no tenantId arg).
  const [linkedSpaceId, setLinkedSpaceId] = useState("");
  const { data: spacesData } = useSpaces({ status: "published" });
  const publishedSpaces = useMemo(() => asArray<SpaceRow>(spacesData), [spacesData]);

  // Upload
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadedPaths, setUploadedPaths] = useState<string[]>([]);
  // The draft exam is created server-side up front so question-paper uploads get
  // a server-owned, exam-scoped path (v1 requestUploadUrl requires an examId).
  const [examId, setExamId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stepIndex = STEPS.findIndex((s) => s.value === step);

  const validateMetadata = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!title.trim()) newErrors.title = "Title is required";
    if (!subject.trim()) newErrors.subject = "Subject is required";
    if (totalMarks <= 0) newErrors.totalMarks = "Total marks must be greater than 0";
    if (passingMarks < 0) newErrors.passingMarks = "Passing marks cannot be negative";
    if (passingMarks > totalMarks)
      newErrors.passingMarks = "Passing marks cannot exceed total marks";
    if (duration <= 0) newErrors.duration = "Duration must be greater than 0";
    if (classIds.length === 0) newErrors.classIds = "Select at least one class";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /** The exam metadata payload — shared by the draft-create and publish saves. */
  const buildExamData = () => ({
    title,
    subject,
    topics: topics
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    classIds: classIds.map(asClassId),
    totalMarks,
    passingMarks,
    duration,
    examDate: new Date().toISOString(),
    gradingConfig: {
      autoGrade: true,
      allowRubricEdit: true,
      allowManualOverride: true,
      requireOverrideReason: true,
      releaseResultsAutomatically: false,
    },
    linkedSpaceId: linkedSpaceId ? asSpaceId(linkedSpaceId) : undefined,
  });

  const handleUploadFiles = async () => {
    if (files.length === 0) return;
    setUploading(true);
    try {
      // Create (or reuse) the draft exam so each question-paper upload gets a
      // server-owned, exam-scoped path via v1 requestUploadUrl.
      let id = examId;
      if (!id) {
        const draft = await saveExam.mutateAsync({ data: buildExamData() });
        id = draft.id;
        setExamId(id);
      }
      const paths: string[] = [];
      for (const file of files) {
        const path = await uploadImage.mutateAsync({
          kind: "question-paper",
          examId: asExamId(id),
          contentType: file.type || "application/octet-stream",
          body: file,
        });
        paths.push(path);
      }
      setUploadedPaths(paths);
      setStep("review");
    } catch (err) {
      handleError(err, "Failed to upload files");
    } finally {
      setUploading(false);
    }
  };

  const handlePublish = async () => {
    if (!firebaseUser) return;
    setSaving(true);
    try {
      const result = await saveExam.mutateAsync({
        // If a draft was already created during upload, update it in place;
        // otherwise create it fresh (server assigns the id).
        ...(examId ? { id: asExamId(examId) } : {}),
        data: {
          ...buildExamData(),
          questionPaperImages: uploadedPaths.length > 0 ? uploadedPaths : undefined,
        },
      });
      navigate(`/exams/${result.id}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/exams")} aria-label="Go back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-display text-xl font-semibold">Create Exam</h1>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2 overflow-x-auto">
        {STEPS.map((s, idx) => (
          <div key={s.value} className="flex shrink-0 items-center gap-2">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${
                idx < stepIndex
                  ? "bg-success-subtle text-success"
                  : idx === stepIndex
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {idx < stepIndex ? <Check className="h-4 w-4" /> : idx + 1}
            </div>
            <span
              className={`hidden text-sm sm:inline ${
                idx === stepIndex ? "font-medium" : "text-muted-foreground"
              }`}
            >
              {s.label}
            </span>
            {idx < STEPS.length - 1 && <div className="bg-border mx-2 h-px w-8" />}
          </div>
        ))}
      </div>

      {/* Step: Metadata */}
      {step === "metadata" && (
        <div className="max-w-xl space-y-4">
          <div>
            <Label>Exam Title</Label>
            <Input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Mid-Term Mathematics"
              className="mt-1"
            />
            {errors.title && <p className="text-destructive mt-1 text-xs">{errors.title}</p>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Subject</Label>
              <Input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Mathematics"
                className="mt-1"
              />
              {errors.subject && <p className="text-destructive mt-1 text-xs">{errors.subject}</p>}
            </div>
            <div>
              <Label>Topics (comma-separated)</Label>
              <Input
                type="text"
                value={topics}
                onChange={(e) => setTopics(e.target.value)}
                placeholder="Algebra, Geometry"
                className="mt-1"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label>Total Marks</Label>
              <Input
                type="number"
                value={totalMarks}
                onChange={(e) => setTotalMarks(Number(e.target.value))}
                className="mt-1"
              />
              {errors.totalMarks && (
                <p className="text-destructive mt-1 text-xs">{errors.totalMarks}</p>
              )}
            </div>
            <div>
              <Label>Passing Marks</Label>
              <Input
                type="number"
                value={passingMarks}
                onChange={(e) => setPassingMarks(Number(e.target.value))}
                className="mt-1"
              />
              {errors.passingMarks && (
                <p className="text-destructive mt-1 text-xs">{errors.passingMarks}</p>
              )}
            </div>
            <div>
              <Label>Duration (min)</Label>
              <Input
                type="number"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="mt-1"
              />
              {errors.duration && (
                <p className="text-destructive mt-1 text-xs">{errors.duration}</p>
              )}
            </div>
          </div>
          <div>
            <Label>Classes</Label>
            <div className="mt-1">
              <ClassMultiSelect
                tenantId={tenantId}
                value={classIds}
                onChange={setClassIds}
                placeholder="Select one or more classes..."
              />
            </div>
            {errors.classIds && <p className="text-destructive mt-1 text-xs">{errors.classIds}</p>}
          </div>
          <div>
            <Label className="flex items-center gap-1.5">
              <LinkIcon className="h-3.5 w-3.5" /> Link to Space (optional)
            </Label>
            <Select
              value={linkedSpaceId || "__none__"}
              onValueChange={(v) => setLinkedSpaceId(v === "__none__" ? "" : v)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {publishedSpaces.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.title}
                    {s.subject ? ` (${s.subject})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={() => {
              if (validateMetadata()) setStep("upload");
            }}
          >
            Next <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Step: Upload */}
      {step === "upload" && (
        <div className="max-w-xl space-y-4">
          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const droppedFiles = Array.from(e.dataTransfer.files);
              setFiles(droppedFiles);
            }}
            className="border-strong bg-surface-sunken duration-fast ease-standard hover:border-brand hover:bg-brand-subtle cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors"
            aria-label="Upload question paper files"
          >
            <Upload className="text-muted-foreground mx-auto h-8 w-8" />
            <p className="mt-2 text-sm font-medium">Click to upload or drag and drop</p>
            <p className="text-muted-foreground text-xs">PDF or image files</p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              className="hidden"
            />
          </div>
          {files.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {files.map((f, i) => (
                <Badge key={i} variant="secondary">
                  {f.name}
                </Badge>
              ))}
            </div>
          )}
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep("metadata")}>
              Back
            </Button>
            {files.length > 0 ? (
              <Button onClick={handleUploadFiles} disabled={uploading}>
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Uploading...
                  </>
                ) : (
                  <>
                    Upload & Continue <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            ) : (
              <Button variant="outline" onClick={() => setStep("review")}>
                Skip (no question paper) <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Step: Review */}
      {step === "review" && (
        <div className="max-w-xl space-y-4">
          <div className="bg-card border-subtle shadow-e1 space-y-3 rounded-lg border p-5">
            <h3 className="font-display font-medium">Review Exam Details</h3>
            <dl className="grid gap-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Title</dt>
                <dd className="font-medium">{title}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subject</dt>
                <dd>{subject}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Total Marks</dt>
                <dd className="font-mono">{totalMarks}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Passing</dt>
                <dd className="font-mono">{passingMarks}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Duration</dt>
                <dd className="font-mono">{duration} min</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Question Paper</dt>
                <dd>
                  {uploadedPaths.length > 0 ? `${uploadedPaths.length} image(s) uploaded` : "None"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Linked Space</dt>
                <dd>
                  {linkedSpaceId
                    ? (publishedSpaces.find((s) => s.id === linkedSpaceId)?.title ?? linkedSpaceId)
                    : "None"}
                </dd>
              </div>
            </dl>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep("upload")}>
              Back
            </Button>
            <Button onClick={() => setStep("publish")}>
              Continue to Publish <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step: Publish */}
      {step === "publish" && (
        <div className="max-w-xl space-y-4">
          <div className="bg-success-subtle border-subtle rounded-lg border p-5">
            <h3 className="text-success font-medium">Ready to Create</h3>
            <p className="text-success mt-1 text-sm">
              The exam will be created as a{" "}
              {uploadedPaths.length > 0 ? '"question paper uploaded"' : '"draft"'} exam. You can add
              questions, edit rubrics, and publish it later.
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep("review")}>
              Back
            </Button>
            <Button
              onClick={handlePublish}
              disabled={saving}
              className="bg-success text-fg-on-accent hover:bg-success/90"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Creating...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" /> Create Exam
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
