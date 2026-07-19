import * as React from "react";
import { useState, useEffect, useRef, useCallback, useLayoutEffect } from "react";
import type { Currency, Space, SpaceType, SpaceAccessType } from "@levelup/domain";
import {
  Save,
  ImageIcon,
  X,
  Link as LinkIcon,
  Info,
  Tag,
  ShoppingBag,
  Users,
  ClipboardList,
  Sparkles,
  CheckCircle2,
  Loader2,
  RotateCcw,
  TriangleAlert,
} from "lucide-react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Input,
  Label,
  Textarea,
  Switch,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@levelup/shared-ui";
import { callUploadTenantAsset } from "@levelup/shared-services/auth";
import { sonnerToast as toast } from "@levelup/shared-ui";

const SPACE_TYPES: { value: SpaceType; label: string; description: string }[] = [
  {
    value: "learning",
    label: "Learning",
    description: "Lessons and learning materials with optional practice.",
  },
  {
    value: "practice",
    label: "Practice",
    description: "Self-paced exercises and drills.",
  },
  {
    value: "assessment",
    label: "Assessment",
    description: "Graded tests, quizzes, or exams.",
  },
  {
    value: "resource",
    label: "Resource",
    description: "A library of supporting materials and references.",
  },
  {
    value: "hybrid",
    label: "Hybrid",
    description: "A mix of learning, practice, and assessment.",
  },
];

const ACCESS_TYPES: { value: SpaceAccessType; label: string; description: string }[] = [
  {
    value: "class_assigned",
    label: "Class Assigned",
    description: "Visible only to specific classes you assign this space to.",
  },
  {
    value: "tenant_wide",
    label: "Tenant Wide",
    description: "Visible to every class and student in your organization.",
  },
  {
    value: "public_store",
    label: "Public Store",
    description: "Listed on the public store for anyone to discover and enroll.",
  },
];

const CURRENCIES: readonly Currency[] = ["USD", "INR"];

const MAX_THUMB_SIZE = 2 * 1024 * 1024;
const ALLOWED_IMG_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

interface Props {
  space: Space;
  onSave: (data: SpaceSettingsDraft) => Promise<boolean>;
  saving: boolean;
}

/** Form-friendly major-unit price; converted to canonical Money at the boundary. */
export type SpaceSettingsDraft = Omit<Partial<Space>, "price"> & {
  price?: number;
  currency?: string;
};

function FieldHelp({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground mt-1 text-xs">{children}</p>;
}

interface AutoResizeTextareaProps extends Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  "rows"
> {
  value: string;
  minRows?: number;
  maxRows?: number;
}

const AutoResizeTextarea = React.forwardRef<HTMLTextAreaElement, AutoResizeTextareaProps>(
  ({ value, minRows = 3, maxRows = 12, className, ...rest }, forwardedRef) => {
    const innerRef = useRef<HTMLTextAreaElement | null>(null);

    const setRefs = useCallback(
      (node: HTMLTextAreaElement | null) => {
        innerRef.current = node;
        if (typeof forwardedRef === "function") forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      },
      [forwardedRef]
    );

    useLayoutEffect(() => {
      const el = innerRef.current;
      if (!el) return;
      const style = window.getComputedStyle(el);
      const lineHeight = parseFloat(style.lineHeight) || 20;
      const paddingY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) || 0;
      const borderY = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth) || 0;
      const minH = lineHeight * minRows + paddingY + borderY;
      const maxH = lineHeight * maxRows + paddingY + borderY;
      el.style.height = "auto";
      const next = Math.min(Math.max(el.scrollHeight, minH), maxH);
      el.style.height = `${next}px`;
      el.style.overflowY = el.scrollHeight > maxH ? "auto" : "hidden";
    }, [value, minRows, maxRows]);

    return (
      <Textarea
        ref={setRefs}
        value={value}
        className={className}
        // Keep rows undefined; height is driven by the effect above.
        {...rest}
      />
    );
  }
);
AutoResizeTextarea.displayName = "AutoResizeTextarea";

const DESCRIPTION_MAX = 600;
const STORE_DESCRIPTION_MAX = 1200;

function isValidHttpUrl(value: string): boolean {
  if (!value.trim()) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function SectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Info;
  title: string;
  description: string;
}) {
  return (
    <CardHeader className="pb-4">
      <CardTitle className="font-display flex items-center gap-2 text-base font-semibold">
        <Icon className="text-fg-muted h-4 w-4" />
        {title}
      </CardTitle>
      <CardDescription className="text-xs">{description}</CardDescription>
    </CardHeader>
  );
}

export default function SpaceSettingsPanel({ space, onSave, saving }: Props) {
  const [title, setTitle] = useState(space.title);
  const [description, setDescription] = useState(space.description ?? "");
  const [thumbnailUrl, setThumbnailUrl] = useState(space.thumbnailUrl ?? "");
  const [thumbnailMode, setThumbnailMode] = useState<"upload" | "url">("upload");
  const [thumbUploading, setThumbUploading] = useState(false);
  const thumbInputRef = useRef<HTMLInputElement>(null);
  const [type, setType] = useState<SpaceType>(space.type);
  const [subject, setSubject] = useState(space.subject ?? "");
  const [labels, setLabels] = useState(space.labels?.join(", ") ?? "");
  const [accessType, setAccessType] = useState<SpaceAccessType>(space.accessType);
  const [allowRetakes, setAllowRetakes] = useState(space.allowRetakes ?? false);
  const [maxRetakes, setMaxRetakes] = useState(space.maxRetakes ?? 3);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(space.defaultTimeLimitMinutes ?? 0);
  const [showCorrectAnswers, setShowCorrectAnswers] = useState(space.showCorrectAnswers ?? true);
  // Store listing fields
  const [publishedToStore, setPublishedToStore] = useState(space.publishedToStore ?? false);
  const [price, setPrice] = useState(space.price ? space.price.amountMinor / 100 : 0);
  const [currency, setCurrency] = useState<Currency>(space.price?.currency ?? "USD");
  const [storeDescription, setStoreDescription] = useState(space.storeDescription ?? "");
  const [storeThumbnailUrl, setStoreThumbnailUrl] = useState(space.storeThumbnailUrl ?? "");
  const [saveAttempted, setSaveAttempted] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    setTitle(space.title);
    setDescription(space.description ?? "");
    setThumbnailUrl(space.thumbnailUrl ?? "");
    setType(space.type);
    setSubject(space.subject ?? "");
    setLabels(space.labels?.join(", ") ?? "");
    setAccessType(space.accessType);
    setAllowRetakes(space.allowRetakes ?? false);
    setMaxRetakes(space.maxRetakes ?? 3);
    setTimeLimitMinutes(space.defaultTimeLimitMinutes ?? 0);
    setShowCorrectAnswers(space.showCorrectAnswers ?? true);
    setPublishedToStore(space.publishedToStore ?? false);
    setPrice(space.price ? space.price.amountMinor / 100 : 0);
    setCurrency(space.price?.currency ?? "USD");
    setStoreDescription(space.storeDescription ?? "");
    setStoreThumbnailUrl(space.storeThumbnailUrl ?? "");
    setSaveAttempted(false);
    setSaveFailed(false);
  }, [space]);

  const uploadThumbnail = useCallback(
    async (file: File) => {
      if (!ALLOWED_IMG_TYPES.has(file.type)) {
        toast.error("Only PNG, JPEG, and WebP images are allowed");
        return;
      }
      if (file.size > MAX_THUMB_SIZE) {
        toast.error("Image must be under 2MB");
        return;
      }
      setThumbUploading(true);
      try {
        const { uploadUrl, publicUrl } = await callUploadTenantAsset({
          tenantId: space.tenantId,
          assetType: "banner",
          contentType: file.type,
        });
        const xhr = new XMLHttpRequest();
        await new Promise<void>((resolve, reject) => {
          xhr.addEventListener("load", () =>
            xhr.status >= 200 && xhr.status < 300
              ? resolve()
              : reject(new Error(`Upload failed: ${xhr.status}`))
          );
          xhr.addEventListener("error", () => reject(new Error("Upload failed")));
          xhr.open("PUT", uploadUrl);
          xhr.setRequestHeader("Content-Type", file.type);
          xhr.send(file);
        });
        setThumbnailUrl(publicUrl);
        toast.success("Thumbnail uploaded");
      } catch (err) {
        toast.error("Failed to upload thumbnail", {
          description: err instanceof Error ? err.message : "Please try again",
        });
      } finally {
        setThumbUploading(false);
      }
    },
    [space.tenantId]
  );

  const draft = React.useMemo<SpaceSettingsDraft>(
    () => ({
      title,
      description: description || undefined,
      thumbnailUrl: thumbnailUrl || undefined,
      type,
      subject: subject || undefined,
      labels: labels
        ? labels
            .split(",")
            .map((l) => l.trim())
            .filter(Boolean)
        : undefined,
      accessType,
      allowRetakes,
      maxRetakes: allowRetakes ? maxRetakes : undefined,
      defaultTimeLimitMinutes: timeLimitMinutes || undefined,
      showCorrectAnswers,
      publishedToStore,
      price: publishedToStore ? price : undefined,
      currency: publishedToStore ? currency : undefined,
      storeDescription: publishedToStore ? storeDescription || undefined : undefined,
      storeThumbnailUrl: publishedToStore
        ? storeThumbnailUrl || thumbnailUrl || undefined
        : undefined,
    }),
    [
      accessType,
      allowRetakes,
      currency,
      description,
      labels,
      maxRetakes,
      price,
      publishedToStore,
      showCorrectAnswers,
      storeDescription,
      storeThumbnailUrl,
      subject,
      thumbnailUrl,
      timeLimitMinutes,
      title,
      type,
    ]
  );

  const initialDraft = React.useMemo<SpaceSettingsDraft>(
    () => ({
      title: space.title,
      description: space.description || undefined,
      thumbnailUrl: space.thumbnailUrl || undefined,
      type: space.type,
      subject: space.subject || undefined,
      labels: space.labels?.length ? space.labels : undefined,
      accessType: space.accessType,
      allowRetakes: space.allowRetakes ?? false,
      maxRetakes: space.allowRetakes ? space.maxRetakes : undefined,
      defaultTimeLimitMinutes: space.defaultTimeLimitMinutes || undefined,
      showCorrectAnswers: space.showCorrectAnswers ?? true,
      publishedToStore: space.publishedToStore ?? false,
      price: space.publishedToStore ? (space.price?.amountMinor ?? 0) / 100 : undefined,
      currency: space.publishedToStore ? (space.price?.currency ?? "USD") : undefined,
      storeDescription: space.publishedToStore ? space.storeDescription || undefined : undefined,
      storeThumbnailUrl: space.publishedToStore
        ? space.storeThumbnailUrl || space.thumbnailUrl || undefined
        : undefined,
    }),
    [space]
  );

  const validationErrors = React.useMemo(() => {
    const errors: Record<string, string> = {};
    if (!title.trim()) errors.title = "Add a title before saving.";
    if (!Number.isInteger(timeLimitMinutes) || timeLimitMinutes < 0) {
      errors.timeLimit = "Use a whole number of minutes, or 0 for no limit.";
    }
    if (allowRetakes && (!Number.isInteger(maxRetakes) || maxRetakes < 1)) {
      errors.maxRetakes = "Retakes must be a whole number of at least 1.";
    }
    if (publishedToStore && (!Number.isFinite(price) || price < 0)) {
      errors.price = "Price cannot be negative.";
    }
    if (!isValidHttpUrl(thumbnailUrl)) {
      errors.thumbnailUrl = "Use a valid http or https image URL.";
    }
    if (!isValidHttpUrl(storeThumbnailUrl)) {
      errors.storeThumbnailUrl = "Use a valid http or https image URL.";
    }
    return errors;
  }, [
    allowRetakes,
    maxRetakes,
    price,
    publishedToStore,
    storeThumbnailUrl,
    thumbnailUrl,
    timeLimitMinutes,
    title,
  ]);

  const isDirty = JSON.stringify(draft) !== JSON.stringify(initialDraft);
  const isValid = Object.keys(validationErrors).length === 0;

  useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  const handleReset = () => {
    setTitle(space.title);
    setDescription(space.description ?? "");
    setThumbnailUrl(space.thumbnailUrl ?? "");
    setType(space.type);
    setSubject(space.subject ?? "");
    setLabels(space.labels?.join(", ") ?? "");
    setAccessType(space.accessType);
    setAllowRetakes(space.allowRetakes ?? false);
    setMaxRetakes(space.maxRetakes ?? 3);
    setTimeLimitMinutes(space.defaultTimeLimitMinutes ?? 0);
    setShowCorrectAnswers(space.showCorrectAnswers ?? true);
    setPublishedToStore(space.publishedToStore ?? false);
    setPrice(space.price ? space.price.amountMinor / 100 : 0);
    setCurrency(space.price?.currency ?? "USD");
    setStoreDescription(space.storeDescription ?? "");
    setStoreThumbnailUrl(space.storeThumbnailUrl ?? "");
    setSaveAttempted(false);
    setSaveFailed(false);
  };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaveAttempted(true);
    setSaveFailed(false);
    if (!isValid || !isDirty) return;
    const saved = await onSave(draft);
    setSaveFailed(!saved);
    if (saved) {
      setLastSavedAt(new Date());
      setSaveAttempted(false);
    }
  };

  const selectedTypeMeta = SPACE_TYPES.find((t) => t.value === type);
  const selectedAccessMeta = ACCESS_TYPES.find((a) => a.value === accessType);

  return (
    <form onSubmit={handleSave} className="max-w-3xl space-y-6 pb-24" noValidate>
      {saveFailed && (
        <Alert variant="destructive">
          <TriangleAlert className="h-4 w-4" />
          <AlertTitle>Settings were not saved</AlertTitle>
          <AlertDescription>
            Your changes are still in this form. Check your connection, then try again.
          </AlertDescription>
        </Alert>
      )}

      {/* Basics */}
      <Card>
        <SectionHeader
          icon={Info}
          title="Basics"
          description="Core information students will see when they open this space."
        />
        <CardContent className="space-y-5">
          <div>
            <Label htmlFor="space-title" className="text-fg-secondary">
              Title
            </Label>
            <Input
              id="space-title"
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value.slice(0, 200));
                setSaveFailed(false);
              }}
              className="mt-1.5"
              placeholder="e.g. Algebra I — Semester 1"
              maxLength={200}
              required
              aria-invalid={saveAttempted && Boolean(validationErrors.title)}
              aria-describedby={
                saveAttempted && validationErrors.title ? "space-title-error" : undefined
              }
            />
            {saveAttempted && validationErrors.title ? (
              <p id="space-title-error" className="text-destructive mt-1 text-xs" role="alert">
                {validationErrors.title}
              </p>
            ) : (
              <FieldHelp>
                The headline name for this space. Shown on cards, breadcrumbs, and student
                dashboards.
              </FieldHelp>
            )}
          </div>

          <div>
            <Label htmlFor="space-type" className="text-fg-secondary">
              Type
            </Label>
            <Select value={type} onValueChange={(v) => setType(v as SpaceType)}>
              <SelectTrigger id="space-type" className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SPACE_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldHelp>
              {selectedTypeMeta?.description ?? "Choose how this space will be primarily used."}
            </FieldHelp>
          </div>

          <div>
            <Label htmlFor="space-subject" className="text-fg-secondary">
              Subject
            </Label>
            <Input
              id="space-subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Mathematics"
              className="mt-1.5"
            />
            <FieldHelp>
              The academic subject this space covers. Used for filtering and discovery.
            </FieldHelp>
          </div>

          <div>
            <Label htmlFor="space-description" className="text-fg-secondary">
              Description
            </Label>
            <AutoResizeTextarea
              id="space-description"
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, DESCRIPTION_MAX))}
              minRows={3}
              maxRows={10}
              maxLength={DESCRIPTION_MAX}
              className="mt-1.5 resize-none leading-relaxed"
              placeholder="Briefly describe what students will learn or do in this space."
            />
            <div className="mt-1 flex items-start justify-between gap-3">
              <FieldHelp>
                A short overview of this space's goals and content. Visible to teachers and assigned
                students.
              </FieldHelp>
              <span
                className={`shrink-0 font-mono text-xs ${
                  description.length > DESCRIPTION_MAX - 50
                    ? "text-warning"
                    : "text-muted-foreground"
                }`}
                aria-live="polite"
              >
                {description.length}/{DESCRIPTION_MAX}
              </span>
            </div>
          </div>

          {/* Thumbnail */}
          <div>
            <Label className="text-fg-secondary">Thumbnail Image</Label>
            <FieldHelp>
              A cover image shown on space cards and listings. Recommended 16:9, PNG/JPEG/WebP, up
              to 2MB.
            </FieldHelp>
            <div className="mt-2 flex items-center gap-2">
              <Button
                type="button"
                variant={thumbnailMode === "upload" ? "default" : "outline"}
                size="sm"
                onClick={() => setThumbnailMode("upload")}
                className="min-h-11 sm:min-h-9"
              >
                <ImageIcon className="mr-1 h-3.5 w-3.5" /> Upload
              </Button>
              <Button
                type="button"
                variant={thumbnailMode === "url" ? "default" : "outline"}
                size="sm"
                onClick={() => setThumbnailMode("url")}
                className="min-h-11 sm:min-h-9"
              >
                <LinkIcon className="mr-1 h-3.5 w-3.5" /> URL
              </Button>
            </div>

            {thumbnailUrl && (
              <div className="relative mt-3 inline-block">
                <img
                  src={thumbnailUrl}
                  alt="Thumbnail preview"
                  className="bg-muted h-24 w-40 rounded-lg border object-cover"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  onClick={() => setThumbnailUrl("")}
                  className="absolute -right-3 -top-3 h-11 w-11 rounded-full"
                  aria-label="Remove thumbnail"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            <div className="mt-3">
              {thumbnailMode === "upload" ? (
                <>
                  <input
                    ref={thumbInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadThumbnail(file);
                    }}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => thumbInputRef.current?.click()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const file = e.dataTransfer.files[0];
                      if (file) uploadThumbnail(file);
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    className="hover:border-brand focus-visible:ring-ring duration-fast ease-standard w-full cursor-pointer rounded-lg border-2 border-dashed p-4 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                  >
                    {thumbUploading ? (
                      <p className="text-muted-foreground text-sm">Uploading...</p>
                    ) : (
                      <>
                        <ImageIcon className="text-muted-foreground mx-auto h-6 w-6" />
                        <p className="mt-1 text-sm">Drop image here or click to browse</p>
                        <p className="text-muted-foreground text-xs">PNG, JPEG, WebP — max 2MB</p>
                      </>
                    )}
                  </button>
                </>
              ) : (
                <>
                  <Input
                    type="url"
                    value={thumbnailUrl}
                    onChange={(e) => setThumbnailUrl(e.target.value)}
                    placeholder="https://example.com/image.jpg"
                    aria-invalid={Boolean(validationErrors.thumbnailUrl)}
                    aria-describedby={
                      validationErrors.thumbnailUrl ? "thumbnail-url-error" : undefined
                    }
                  />
                  {validationErrors.thumbnailUrl && (
                    <p
                      id="thumbnail-url-error"
                      className="text-destructive mt-1 text-xs"
                      role="alert"
                    >
                      {validationErrors.thumbnailUrl}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Access */}
      <Card>
        <SectionHeader
          icon={Users}
          title="Access"
          description="Control who can see and enroll in this space."
        />
        <CardContent>
          <div>
            <Label htmlFor="space-access" className="text-fg-secondary">
              Access Type
            </Label>
            <Select value={accessType} onValueChange={(v) => setAccessType(v as SpaceAccessType)}>
              <SelectTrigger id="space-access" className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACCESS_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldHelp>
              {selectedAccessMeta?.description ??
                "Choose how broadly this space should be available."}
            </FieldHelp>
          </div>
        </CardContent>
      </Card>

      {/* Assessment behavior */}
      <Card>
        <SectionHeader
          icon={ClipboardList}
          title="Assessment behavior"
          description="Defaults applied to timed tests, quizzes, and graded story points in this space."
        />
        <CardContent className="space-y-5">
          <div>
            <Label htmlFor="space-time-limit" className="text-fg-secondary">
              Default time limit
            </Label>
            <div className="mt-1.5 flex items-center gap-2">
              <Input
                id="space-time-limit"
                type="number"
                value={timeLimitMinutes}
                onChange={(e) => setTimeLimitMinutes(Number(e.target.value))}
                min={0}
                className="w-32"
                aria-invalid={Boolean(validationErrors.timeLimit)}
                aria-describedby={validationErrors.timeLimit ? "space-time-limit-error" : undefined}
              />
              <span className="text-muted-foreground text-sm">minutes</span>
            </div>
            <FieldHelp>
              Time students have to complete a graded attempt. Set to <code>0</code> for no limit.
            </FieldHelp>
            {validationErrors.timeLimit && (
              <p id="space-time-limit-error" className="text-destructive mt-1 text-xs" role="alert">
                {validationErrors.timeLimit}
              </p>
            )}
          </div>

          <div className="border-t pt-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <Label htmlFor="allow-retakes" className="text-fg-secondary cursor-pointer">
                  Allow retakes
                </Label>
                <FieldHelp>
                  When enabled, students can re-attempt assessments in this space up to the limit
                  below.
                </FieldHelp>
              </div>
              <Switch checked={allowRetakes} onCheckedChange={setAllowRetakes} id="allow-retakes" />
            </div>

            {allowRetakes && (
              <div className="mt-4">
                <Label htmlFor="space-max-retakes" className="text-fg-secondary">
                  Maximum retakes
                </Label>
                <Input
                  id="space-max-retakes"
                  type="number"
                  value={maxRetakes}
                  onChange={(e) => setMaxRetakes(Number(e.target.value))}
                  min={1}
                  className="mt-1.5 w-32"
                  aria-invalid={Boolean(validationErrors.maxRetakes)}
                  aria-describedby={
                    validationErrors.maxRetakes ? "space-max-retakes-error" : undefined
                  }
                />
                <FieldHelp>
                  The total number of attempts a student is allowed (the first attempt counts).
                </FieldHelp>
                {validationErrors.maxRetakes && (
                  <p
                    id="space-max-retakes-error"
                    className="text-destructive mt-1 text-xs"
                    role="alert"
                  >
                    {validationErrors.maxRetakes}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="border-t pt-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <Label htmlFor="show-correct-answers" className="text-fg-secondary cursor-pointer">
                  Show correct answers after submission
                </Label>
                <FieldHelp>
                  When enabled, students see the correct answers and explanations once they submit.
                </FieldHelp>
              </div>
              <Switch
                checked={showCorrectAnswers}
                onCheckedChange={setShowCorrectAnswers}
                id="show-correct-answers"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Labels & taxonomy */}
      <Card>
        <SectionHeader
          icon={Tag}
          title="Labels & taxonomy"
          description="Tags used for searching, filtering, and organizing content."
        />
        <CardContent>
          <div>
            <Label htmlFor="space-labels" className="text-fg-secondary">
              Labels
            </Label>
            <Input
              id="space-labels"
              type="text"
              value={labels}
              onChange={(e) => setLabels(e.target.value)}
              placeholder="e.g. algebra, semester-1, honors"
              className="mt-1.5"
            />
            <FieldHelp>
              Comma-separated tags. Useful for grouping spaces in search and reports.
            </FieldHelp>
          </div>
        </CardContent>
      </Card>

      {/* Store listing */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="font-display flex items-center gap-2 text-base font-semibold">
                <ShoppingBag className="text-fg-muted h-4 w-4" />
                Store listing
              </CardTitle>
              <CardDescription className="mt-1 text-xs">
                Publish this space to the public store so anyone can discover and enroll.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={publishedToStore}
                onCheckedChange={(checked) => {
                  setPublishedToStore(checked);
                  if (checked) setAccessType("public_store");
                }}
                id="published-to-store"
              />
              <Label
                htmlFor="published-to-store"
                className="text-fg-secondary cursor-pointer text-sm"
              >
                {publishedToStore ? "Listed" : "Not listed"}
              </Label>
            </div>
          </div>
        </CardHeader>

        {publishedToStore && (
          <CardContent className="space-y-5 border-t pt-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="space-price" className="text-fg-secondary">
                  Price
                </Label>
                <Input
                  id="space-price"
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  min={0}
                  step={0.01}
                  className="mt-1.5"
                  aria-invalid={Boolean(validationErrors.price)}
                  aria-describedby={validationErrors.price ? "space-price-error" : undefined}
                />
                <FieldHelp>
                  The amount charged per enrollment. Set to <code>0</code> to list as free.
                </FieldHelp>
                {validationErrors.price && (
                  <p id="space-price-error" className="text-destructive mt-1 text-xs" role="alert">
                    {validationErrors.price}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="space-currency" className="text-fg-secondary">
                  Currency
                </Label>
                <Select value={currency} onValueChange={(value) => setCurrency(value as Currency)}>
                  <SelectTrigger id="space-currency" className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldHelp>The currency the price is charged in.</FieldHelp>
              </div>
            </div>

            <div>
              <Label htmlFor="store-description" className="text-fg-secondary">
                Store description
              </Label>
              <AutoResizeTextarea
                id="store-description"
                value={storeDescription}
                onChange={(e) =>
                  setStoreDescription(e.target.value.slice(0, STORE_DESCRIPTION_MAX))
                }
                placeholder="A compelling pitch for prospective learners — what they'll learn and why it's worth their time."
                minRows={4}
                maxRows={14}
                maxLength={STORE_DESCRIPTION_MAX}
                className="mt-1.5 resize-none leading-relaxed"
              />
              <div className="mt-1 flex items-start justify-between gap-3">
                <FieldHelp>
                  Marketing copy shown on the public store listing. Defaults to the space
                  description if left empty.
                </FieldHelp>
                <span
                  className={`shrink-0 font-mono text-xs ${
                    storeDescription.length > STORE_DESCRIPTION_MAX - 100
                      ? "text-warning"
                      : "text-muted-foreground"
                  }`}
                  aria-live="polite"
                >
                  {storeDescription.length}/{STORE_DESCRIPTION_MAX}
                </span>
              </div>
            </div>

            <div>
              <Label htmlFor="store-thumbnail-url" className="text-fg-secondary">
                Store thumbnail URL
              </Label>
              <Input
                id="store-thumbnail-url"
                type="url"
                value={storeThumbnailUrl}
                onChange={(e) => setStoreThumbnailUrl(e.target.value)}
                placeholder="https://example.com/cover.jpg"
                className="mt-1.5"
                aria-invalid={Boolean(validationErrors.storeThumbnailUrl)}
                aria-describedby={
                  validationErrors.storeThumbnailUrl ? "store-thumbnail-url-error" : undefined
                }
              />
              <FieldHelp>
                Optional cover image for the store listing. If empty, the space thumbnail is used.
              </FieldHelp>
              {validationErrors.storeThumbnailUrl && (
                <p
                  id="store-thumbnail-url-error"
                  className="text-destructive mt-1 text-xs"
                  role="alert"
                >
                  {validationErrors.storeThumbnailUrl}
                </p>
              )}
            </div>

            <div className="bg-muted/40 flex items-start gap-2 rounded-md border p-3 text-xs">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <p className="text-muted-foreground">
                Listings only become visible publicly after the space is also{" "}
                <strong>published</strong>.
              </p>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Sticky save bar */}
      <div className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky bottom-0 -mx-1 flex flex-col gap-3 border-t px-1 py-3 backdrop-blur sm:flex-row sm:items-center sm:justify-end">
        <div className="mr-auto text-xs" role="status" aria-live="polite">
          {isDirty ? (
            <p className="text-warning font-medium">Unsaved changes</p>
          ) : lastSavedAt ? (
            <p className="text-success flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              Saved at {lastSavedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>
          ) : (
            <p className="text-muted-foreground">
              Changes apply to all teachers and students of this space.
            </p>
          )}
        </div>
        {isDirty && (
          <Button
            type="button"
            variant="ghost"
            onClick={handleReset}
            disabled={saving}
            className="min-h-11 sm:min-h-9"
          >
            <RotateCcw className="h-4 w-4" />
            Discard changes
          </Button>
        )}
        <Button
          type="submit"
          disabled={saving || !isDirty || !isValid}
          className="min-h-11 sm:min-h-9"
        >
          {saving ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="mr-1 h-4 w-4" aria-hidden="true" />
          )}
          {saving ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </form>
  );
}
