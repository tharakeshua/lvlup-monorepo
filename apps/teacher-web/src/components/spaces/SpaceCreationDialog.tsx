import { useEffect, useMemo, useState } from "react";
import type { SpaceAccessType } from "@levelup/domain";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@levelup/shared-ui";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ClipboardCheck,
  Layers3,
  Loader2,
  Route,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { SPACE_TEMPLATES, type SpaceTemplate, type SpaceTemplateId } from "./space-authoring-model";

export interface SpaceCreationDraft {
  template: SpaceTemplate;
  title: string;
  subject?: string;
  description?: string;
  accessType: SpaceAccessType;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (draft: SpaceCreationDraft) => Promise<void>;
}

const TEMPLATE_ICONS = {
  blank: Layers3,
  "guided-course": Route,
  "practice-set": Sparkles,
  assessment: ClipboardCheck,
} as const;

const ACCESS_OPTIONS: Array<{
  value: SpaceAccessType;
  label: string;
  description: string;
}> = [
  {
    value: "class_assigned",
    label: "Assigned classes",
    description: "Only students in classes you choose can access it.",
  },
  {
    value: "tenant_wide",
    label: "Whole organization",
    description: "All students and teachers in your organization can discover it.",
  },
  {
    value: "public_store",
    label: "Public store",
    description: "Prepare it for public discovery and enrollment.",
  },
];

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "The space could not be created. Check your connection and try again.";
}

export default function SpaceCreationDialog({ open, onOpenChange, onCreate }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [templateId, setTemplateId] = useState<SpaceTemplateId>("guided-course");
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [accessType, setAccessType] = useState<SpaceAccessType>("class_assigned");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const template = useMemo(
    () => SPACE_TEMPLATES.find((candidate) => candidate.id === templateId)!,
    [templateId]
  );

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setTemplateId("guided-course");
    setTitle("");
    setSubject("");
    setDescription("");
    setAccessType("class_assigned");
    setSubmitting(false);
    setError(null);
  }, [open]);

  const handleContinue = () => {
    setAccessType(template.accessType);
    setError(null);
    setStep(2);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError("Add a title so you can recognize this space.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onCreate({
        template,
        title: cleanTitle,
        subject: subject.trim() || undefined,
        description: description.trim() || undefined,
        accessType,
      });
    } catch (creationError) {
      setError(getErrorMessage(creationError));
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !submitting && onOpenChange(nextOpen)}>
      <DialogContent className="max-h-[min(90vh,52rem)] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <div className="mb-2 flex items-center gap-2" aria-label={`Step ${step} of 2`}>
            {[1, 2].map((stepNumber) => (
              <div key={stepNumber} className="flex flex-1 items-center gap-2">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    stepNumber <= step
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                  aria-current={stepNumber === step ? "step" : undefined}
                >
                  {stepNumber < step ? <Check className="h-3.5 w-3.5" /> : stepNumber}
                </span>
                <span className="text-muted-foreground hidden text-xs font-medium sm:inline">
                  {stepNumber === 1 ? "Choose a starting point" : "Name and access"}
                </span>
                {stepNumber === 1 && <span className="bg-border h-px flex-1" aria-hidden="true" />}
              </div>
            ))}
          </div>
          <DialogTitle className="font-display text-xl">
            {step === 1 ? "How do you want to begin?" : "Make the space yours"}
          </DialogTitle>
          <DialogDescription>
            {step === 1
              ? "Templates create a useful structure you can freely rename, reorder, or remove."
              : `You chose ${template.name}. Add the details students and colleagues will see.`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          {step === 1 ? (
            <RadioGroup
              value={templateId}
              onValueChange={(value) => setTemplateId(value as SpaceTemplateId)}
              className="grid gap-3 py-4 sm:grid-cols-2"
              aria-label="Space template"
            >
              {SPACE_TEMPLATES.map((candidate) => {
                const Icon = TEMPLATE_ICONS[candidate.id];
                const selected = candidate.id === templateId;
                return (
                  <Label
                    key={candidate.id}
                    htmlFor={`template-${candidate.id}`}
                    className={`focus-within:ring-ring flex min-h-44 cursor-pointer flex-col rounded-xl border p-4 transition-[border-color,box-shadow,transform] focus-within:ring-2 focus-within:ring-offset-2 hover:-translate-y-0.5 ${
                      selected
                        ? "border-primary bg-primary/5 shadow-e2"
                        : "border-subtle bg-card hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="bg-surface-sunken text-brand flex h-10 w-10 items-center justify-center rounded-lg">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <RadioGroupItem
                        id={`template-${candidate.id}`}
                        value={candidate.id}
                        aria-label={candidate.name}
                      />
                    </div>
                    <span className="text-muted-foreground mt-4 text-[0.6875rem] font-semibold uppercase tracking-wider">
                      {candidate.eyebrow}
                    </span>
                    <span className="font-display mt-1 text-base font-semibold">
                      {candidate.name}
                    </span>
                    <span className="text-muted-foreground mt-1 text-xs leading-relaxed">
                      {candidate.description}
                    </span>
                    <span className="text-fg-secondary mt-auto pt-3 text-xs font-medium">
                      {candidate.starterStoryPoints.length === 0
                        ? "No starter story points"
                        : `${candidate.starterStoryPoints.length} starter story points`}
                    </span>
                  </Label>
                );
              })}
            </RadioGroup>
          ) : (
            <div className="space-y-5 py-5">
              {error && (
                <Alert variant="destructive">
                  <TriangleAlert className="h-4 w-4" />
                  <AlertTitle>Creation paused</AlertTitle>
                  <AlertDescription>
                    <p>{error}</p>
                    <p className="mt-1">Your entries are still here. You can retry when ready.</p>
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_15rem]">
                <div className="space-y-5">
                  <div>
                    <Label htmlFor="new-space-title">
                      Space title <span aria-hidden="true">*</span>
                    </Label>
                    <Input
                      id="new-space-title"
                      value={title}
                      onChange={(event) => setTitle(event.target.value.slice(0, 200))}
                      placeholder="e.g. Fractions in the real world"
                      className="mt-1.5 text-base"
                      autoFocus
                      required
                      maxLength={200}
                      aria-invalid={Boolean(error && !title.trim())}
                    />
                  </div>

                  <div>
                    <Label htmlFor="new-space-subject">Subject</Label>
                    <Input
                      id="new-space-subject"
                      value={subject}
                      onChange={(event) => setSubject(event.target.value)}
                      placeholder="e.g. Mathematics"
                      className="mt-1.5 text-base"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <Label htmlFor="new-space-description">Student-facing summary</Label>
                      <span className="text-muted-foreground font-mono text-xs">
                        {description.length}/600
                      </span>
                    </div>
                    <Textarea
                      id="new-space-description"
                      value={description}
                      onChange={(event) => setDescription(event.target.value.slice(0, 600))}
                      placeholder="What will students learn or be able to do?"
                      className="mt-1.5 min-h-24 resize-y text-base"
                      maxLength={600}
                    />
                  </div>

                  <div>
                    <Label htmlFor="new-space-access">Initial access</Label>
                    <Select
                      value={accessType}
                      onValueChange={(value) => setAccessType(value as SpaceAccessType)}
                    >
                      <SelectTrigger id="new-space-access" className="mt-1.5 min-h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ACCESS_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-muted-foreground mt-1.5 text-xs">
                      {ACCESS_OPTIONS.find((option) => option.value === accessType)?.description}
                    </p>
                  </div>
                </div>

                <aside className="bg-surface-sunken h-fit rounded-xl border p-4">
                  <div className="text-brand flex items-center gap-2">
                    <BookOpen className="h-4 w-4" aria-hidden="true" />
                    <p className="text-xs font-semibold uppercase tracking-wider">Starting plan</p>
                  </div>
                  <p className="font-display mt-3 font-semibold">{template.name}</p>
                  <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                    {template.bestFor}
                  </p>
                  {template.starterStoryPoints.length > 0 ? (
                    <ol className="mt-4 space-y-2">
                      {template.starterStoryPoints.map((storyPoint, index) => (
                        <li key={storyPoint.title} className="flex items-start gap-2 text-xs">
                          <span className="bg-background mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border font-mono text-[0.625rem]">
                            {index + 1}
                          </span>
                          <span>{storyPoint.title}</span>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="text-muted-foreground mt-4 text-xs">
                      A completely empty canvas will be created.
                    </p>
                  )}
                </aside>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:justify-between">
            {step === 1 ? (
              <>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="button" onClick={handleContinue}>
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setError(null);
                    setStep(1);
                  }}
                  disabled={submitting}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
                <Button type="submit" disabled={submitting || !title.trim()}>
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                  )}
                  {submitting ? "Creating your space…" : "Create space"}
                </Button>
              </>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
