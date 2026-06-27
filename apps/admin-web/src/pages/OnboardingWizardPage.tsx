import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCurrentTenantId, useCurrentTenant } from "@/sdk/identity";
import { useSaveTenant, useSaveAcademicSession, useSaveClass, useApiError } from "@levelup/query";
import type { Tenant } from "@levelup/shared-types";
import {
  Button,
  Input,
  Label,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@levelup/shared-ui";
import { toast } from "sonner";
import { Check, ChevronRight, School, CalendarDays, GraduationCap, Copy } from "lucide-react";

const STEPS = [
  { id: "school", label: "School Info", icon: School },
  { id: "academic", label: "Academic Session", icon: CalendarDays },
  { id: "class", label: "First Class", icon: GraduationCap },
  { id: "done", label: "All Set!", icon: Check },
] as const;

type StepId = (typeof STEPS)[number]["id"];

export default function OnboardingWizardPage() {
  const navigate = useNavigate();
  const tenantId = useCurrentTenantId();
  const tenant = useCurrentTenant().data as Tenant | undefined;
  const { handleError } = useApiError();
  const saveTenant = useSaveTenant();
  const saveAcademicSession = useSaveAcademicSession();
  const saveClass = useSaveClass();
  const [currentStep, setCurrentStep] = useState<StepId>("school");
  const [saving, setSaving] = useState(false);

  // School form state
  const [schoolForm, setSchoolForm] = useState({
    name: tenant?.name ?? "",
    contactEmail: tenant?.contactEmail ?? "",
    contactPhone: tenant?.contactPhone ?? "",
    website: "",
  });

  // Academic session form state
  const [sessionForm, setSessionForm] = useState({
    name: new Date().getFullYear() + "-" + (new Date().getFullYear() + 1),
    startDate: "",
    endDate: "",
  });

  // Class form state
  const [classForm, setClassForm] = useState({
    name: "",
    grade: "",
    section: "",
  });

  const [copied, setCopied] = useState(false);

  const stepIndex = STEPS.findIndex((s) => s.id === currentStep);

  const handleSchoolSave = async () => {
    if (!tenantId) return;
    if (!schoolForm.name || !schoolForm.contactEmail) {
      toast.error("Please fill in school name and email");
      return;
    }
    setSaving(true);
    try {
      // NOTE: `website` is not part of the saveTenant contract — it is collected
      // for display only and not persisted.
      const data: Record<string, string> = {
        name: schoolForm.name,
        contactEmail: schoolForm.contactEmail,
      };
      if (schoolForm.contactPhone) data.contactPhone = schoolForm.contactPhone;
      await saveTenant.mutateAsync({ data });
      await markStepComplete("school");
      setCurrentStep("academic");
      toast.success("School info saved");
    } catch (err) {
      handleError(err, "Failed to save school info");
    } finally {
      setSaving(false);
    }
  };

  const handleSessionSave = async () => {
    if (!tenantId) return;
    if (!sessionForm.name) {
      toast.error("Please enter a session name");
      return;
    }
    if (!sessionForm.startDate || !sessionForm.endDate) {
      toast.error("Please enter start and end dates");
      return;
    }
    setSaving(true);
    try {
      await saveAcademicSession.mutateAsync({
        data: {
          name: sessionForm.name,
          startDate: sessionForm.startDate,
          endDate: sessionForm.endDate,
          isCurrent: true,
        },
      });
      await markStepComplete("academic");
      setCurrentStep("class");
      toast.success("Academic session created");
    } catch (err) {
      handleError(err, "Failed to create academic session");
    } finally {
      setSaving(false);
    }
  };

  const handleClassSave = async () => {
    if (!tenantId) return;
    if (!classForm.name || !classForm.grade) {
      toast.error("Please enter class name and grade");
      return;
    }
    setSaving(true);
    try {
      await saveClass.mutateAsync({
        data: {
          name: classForm.name,
          grade: classForm.grade,
          section: classForm.section || undefined,
        },
      });
      await markStepComplete("class");
      setCurrentStep("done");
      toast.success("First class created! Setup complete.");
    } catch (err) {
      handleError(err, "Failed to create class");
    } finally {
      setSaving(false);
    }
  };

  const markStepComplete = async (_step: string) => {
    // NOTE: onboarding-progress persistence is not exposed by the @levelup/query
    // saveTenant contract (no `onboarding` field) — step state is tracked in
    // local component state only for this session.
  };

  const handleFinish = async () => {
    navigate("/");
  };

  const handleSkipToStep = (targetStep: StepId) => {
    const targetIndex = STEPS.findIndex((s) => s.id === targetStep);
    if (targetIndex <= stepIndex) {
      setCurrentStep(targetStep);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8 py-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Welcome to Auto-LevelUp</h1>
        <p className="text-muted-foreground mt-2">Let's set up your school in a few simple steps</p>
      </div>

      {/* Progress stepper */}
      <div className="flex items-center justify-center gap-2">
        {STEPS.map((step, idx) => {
          const StepIcon = step.icon;
          const isActive = step.id === currentStep;
          const isComplete = idx < stepIndex;
          return (
            <div key={step.id} className="flex items-center gap-2">
              <button
                onClick={() => handleSkipToStep(step.id)}
                disabled={idx > stepIndex}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : isComplete
                      ? "bg-primary/10 text-primary cursor-pointer"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                <StepIcon className="h-4 w-4" />
                <span className="hidden sm:inline">{step.label}</span>
              </button>
              {idx < STEPS.length - 1 && <ChevronRight className="text-muted-foreground h-4 w-4" />}
            </div>
          );
        })}
      </div>

      {/* Step content */}
      <Card>
        {currentStep === "school" && (
          <>
            <CardHeader>
              <CardTitle>School Information</CardTitle>
              <CardDescription>Tell us about your school or institution</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="school-name">School Name *</Label>
                <Input
                  id="school-name"
                  value={schoolForm.name}
                  onChange={(e) => setSchoolForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g., Springfield Academy"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-email">Contact Email *</Label>
                <Input
                  id="contact-email"
                  type="email"
                  value={schoolForm.contactEmail}
                  onChange={(e) => setSchoolForm((p) => ({ ...p, contactEmail: e.target.value }))}
                  placeholder="admin@school.edu"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="contact-phone">Phone</Label>
                  <Input
                    id="contact-phone"
                    value={schoolForm.contactPhone}
                    onChange={(e) => setSchoolForm((p) => ({ ...p, contactPhone: e.target.value }))}
                    placeholder="+91 98765 43210"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    value={schoolForm.website}
                    onChange={(e) => setSchoolForm((p) => ({ ...p, website: e.target.value }))}
                    placeholder="https://school.edu"
                  />
                </div>
              </div>
              <div className="flex justify-end pt-4">
                <Button onClick={handleSchoolSave} disabled={saving}>
                  {saving ? "Saving..." : "Continue"}
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </>
        )}

        {currentStep === "academic" && (
          <>
            <CardHeader>
              <CardTitle>Academic Session</CardTitle>
              <CardDescription>Create your first academic session (school year)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="session-name">Session Name *</Label>
                <Input
                  id="session-name"
                  value={sessionForm.name}
                  onChange={(e) => setSessionForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g., 2026-2027"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="start-date">Start Date</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={sessionForm.startDate}
                    onChange={(e) => setSessionForm((p) => ({ ...p, startDate: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end-date">End Date</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={sessionForm.endDate}
                    onChange={(e) => setSessionForm((p) => ({ ...p, endDate: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex justify-between pt-4">
                <Button variant="ghost" onClick={() => setCurrentStep("school")}>
                  Back
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setCurrentStep("class")}>
                    Skip
                  </Button>
                  <Button onClick={handleSessionSave} disabled={saving}>
                    {saving ? "Creating..." : "Continue"}
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </>
        )}

        {currentStep === "class" && (
          <>
            <CardHeader>
              <CardTitle>Create Your First Class</CardTitle>
              <CardDescription>Add a class to start organizing students</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="class-name">Class Name *</Label>
                <Input
                  id="class-name"
                  value={classForm.name}
                  onChange={(e) => setClassForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g., Class 10-A"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="grade">Grade *</Label>
                  <Input
                    id="grade"
                    value={classForm.grade}
                    onChange={(e) => setClassForm((p) => ({ ...p, grade: e.target.value }))}
                    placeholder="e.g., 10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="section">Section</Label>
                  <Input
                    id="section"
                    value={classForm.section}
                    onChange={(e) => setClassForm((p) => ({ ...p, section: e.target.value }))}
                    placeholder="e.g., A"
                  />
                </div>
              </div>
              <div className="flex justify-between pt-4">
                <Button variant="ghost" onClick={() => setCurrentStep("academic")}>
                  Back
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setCurrentStep("done")}>
                    Skip
                  </Button>
                  <Button onClick={handleClassSave} disabled={saving}>
                    {saving ? "Creating..." : "Finish Setup"}
                    <Check className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </>
        )}

        {currentStep === "done" && (
          <>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <CardTitle>You're All Set!</CardTitle>
              <CardDescription>
                Your school is ready. Share your tenant code with staff and students.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="mx-auto max-w-sm">
                <Label>Your Tenant Code</Label>
                <div className="mt-1 flex gap-2">
                  <Input
                    value={tenant?.tenantCode ?? ""}
                    className="bg-muted text-center font-mono text-lg"
                    readOnly
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      navigator.clipboard.writeText(tenant?.tenantCode ?? "");
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                      toast.success("Tenant code copied!");
                    }}
                    aria-label="Copy tenant code"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-muted-foreground mt-2 text-xs">
                  Staff and students use this code to join your school
                </p>
              </div>
              <div className="flex justify-center pt-4">
                <Button size="lg" onClick={handleFinish}>
                  Go to Dashboard
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
