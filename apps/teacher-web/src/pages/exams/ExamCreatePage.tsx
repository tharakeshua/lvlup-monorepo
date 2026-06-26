import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useCurrentTenantId, useAuthStore } from "@levelup/shared-stores";
import { useSpaces, useApiError } from "@levelup/shared-hooks";
import { getFirebaseServices, callSaveExam } from "@levelup/shared-services";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
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

export default function ExamCreatePage() {
  const navigate = useNavigate();
  const tenantId = useCurrentTenantId();
  const firebaseUser = useAuthStore((s) => s.firebaseUser);
  const [step, setStep] = useState<WizardStep>("metadata");
  const [saving, setSaving] = useState(false);
  const { handleError } = useApiError();

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

  // Linked Space (optional)
  const [linkedSpaceId, setLinkedSpaceId] = useState("");
  const { data: publishedSpaces = [] } = useSpaces(tenantId, { status: "published" });

  // Upload
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);
  const [uploadedPaths, setUploadedPaths] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stepIndex = STEPS.findIndex((s) => s.value === step);

  const validateMetadata = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!title.trim()) newErrors.title = "Title is required";
    if (!subject.trim()) newErrors.subject = "Subject is required";
    if (totalMarks <= 0) newErrors.totalMarks = "Total marks must be greater than 0";
    if (passingMarks < 0) newErrors.passingMarks = "Passing marks cannot be negative";
    if (passingMarks > totalMarks) newErrors.passingMarks = "Passing marks cannot exceed total marks";
    if (duration <= 0) newErrors.duration = "Duration must be greater than 0";
    if (classIds.length === 0) newErrors.classIds = "Select at least one class";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleUploadFiles = async () => {
    if (!tenantId || files.length === 0) return;
    setUploading(true);
    try {
      const { storage } = getFirebaseServices();
      const urls: string[] = [];
      const paths: string[] = [];
      for (const file of files) {
        const path = `tenants/${tenantId}/question-papers/${Date.now()}_${file.name}`;
        const storageRef = ref(storage, path);
        const snap = await uploadBytes(storageRef, file);
        const url = await getDownloadURL(snap.ref);
        urls.push(url);
        paths.push(path);
      }
      setUploadedUrls(urls);
      setUploadedPaths(paths);
      setStep("review");
    } catch (err) {
      handleError(err, "Failed to upload files");
    } finally {
      setUploading(false);
    }
  };

  const handlePublish = async () => {
    if (!tenantId || !firebaseUser) return;
    setSaving(true);
    try {
      const result = await callSaveExam({
        tenantId,
        data: {
          title,
          subject,
          topics: topics.split(",").map((t) => t.trim()).filter(Boolean),
          classIds,
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
          questionPaperImages: uploadedPaths.length > 0 ? uploadedPaths : undefined,
          linkedSpaceId: linkedSpaceId || undefined,
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
        <h1 className="text-xl font-bold">Create Exam</h1>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2 overflow-x-auto">
        {STEPS.map((s, idx) => (
          <div key={s.value} className="flex items-center gap-2 shrink-0">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${
                idx < stepIndex
                  ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                  : idx === stepIndex
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {idx < stepIndex ? <Check className="h-4 w-4" /> : idx + 1}
            </div>
            <span
              className={`text-sm hidden sm:inline ${
                idx === stepIndex ? "font-medium" : "text-muted-foreground"
              }`}
            >
              {s.label}
            </span>
            {idx < STEPS.length - 1 && (
              <div className="mx-2 h-px w-8 bg-border" />
            )}
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
            {errors.title && (
              <p className="text-xs text-destructive mt-1">{errors.title}</p>
            )}
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
              {errors.subject && (
                <p className="text-xs text-destructive mt-1">{errors.subject}</p>
              )}
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
                <p className="text-xs text-destructive mt-1">{errors.totalMarks}</p>
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
                <p className="text-xs text-destructive mt-1">{errors.passingMarks}</p>
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
                <p className="text-xs text-destructive mt-1">{errors.duration}</p>
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
            {errors.classIds && (
              <p className="text-destructive mt-1 text-xs">{errors.classIds}</p>
            )}
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
                    {s.title}{s.subject ? ` (${s.subject})` : ""}
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
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click(); } }}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const droppedFiles = Array.from(e.dataTransfer.files);
              setFiles(droppedFiles);
            }}
            className="cursor-pointer rounded-lg border-2 border-dashed p-8 text-center hover:border-primary hover:bg-muted/50 transition-colors"
            aria-label="Upload question paper files"
          >
            <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium">
              Click to upload or drag and drop
            </p>
            <p className="text-xs text-muted-foreground">
              PDF or image files
            </p>
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
                <Badge key={i} variant="secondary">{f.name}</Badge>
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
          <div className="rounded-lg border bg-card p-5 space-y-3">
            <h3 className="font-medium">Review Exam Details</h3>
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
                <dd>{totalMarks}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Passing</dt>
                <dd>{passingMarks}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Duration</dt>
                <dd>{duration} min</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Question Paper</dt>
                <dd>
                  {uploadedUrls.length > 0
                    ? `${uploadedUrls.length} image(s) uploaded`
                    : "None"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Linked Space</dt>
                <dd>
                  {linkedSpaceId
                    ? publishedSpaces.find((s) => s.id === linkedSpaceId)?.title ?? linkedSpaceId
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
          <div className="rounded-lg border bg-green-50 dark:bg-green-950/30 p-5">
            <h3 className="font-medium text-green-800 dark:text-green-300">Ready to Create</h3>
            <p className="mt-1 text-sm text-green-700 dark:text-green-400">
              The exam will be created as a{" "}
              {uploadedUrls.length > 0 ? '"question paper uploaded"' : '"draft"'}{" "}
              exam. You can add questions, edit rubrics, and publish it later.
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep("review")}>
              Back
            </Button>
            <Button
              onClick={handlePublish}
              disabled={saving}
              className="bg-green-600 hover:bg-green-700 text-white"
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
