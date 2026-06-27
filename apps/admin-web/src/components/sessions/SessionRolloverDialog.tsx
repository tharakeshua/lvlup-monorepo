import { useState } from "react";
import type { AcademicSession } from "@levelup/shared-types";
import { useRolloverSession } from "@levelup/query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Input,
  Label,
  Checkbox,
  Badge,
} from "@levelup/shared-ui";
import { toast } from "sonner";

function formatSessionDate(timestamp: unknown): string {
  if (!timestamp) return "\u2014";
  const ts = timestamp as { seconds?: number; toDate?: () => Date };
  if (ts.toDate) return ts.toDate().toLocaleDateString();
  if (ts.seconds) return new Date(ts.seconds * 1000).toLocaleDateString();
  return String(timestamp);
}

interface SessionRolloverDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceSession: AcademicSession;
  tenantId: string;
}

export function SessionRolloverDialog({
  open,
  onOpenChange,
  sourceSession,
}: SessionRolloverDialogProps) {
  const rolloverSession = useRolloverSession();
  const [formData, setFormData] = useState({
    name: "",
    startDate: "",
    endDate: "",
  });
  const [copyClasses, setCopyClasses] = useState(true);
  const [copyTeacherAssignments, setCopyTeacherAssignments] = useState(true);
  const [promoteStudents, setPromoteStudents] = useState(false);
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async () => {
    if (!formData.name || !formData.startDate || !formData.endDate) return;

    if (new Date(formData.endDate) <= new Date(formData.startDate)) {
      toast.error("End date must be after start date");
      return;
    }

    setProcessing(true);
    try {
      // Tenant-implicit (claims-scoped); the mutation handles cache invalidation.
      const result = (await rolloverSession.mutateAsync({
        sourceSessionId: sourceSession.id,
        newSession: {
          name: formData.name,
          startDate: formData.startDate,
          endDate: formData.endDate,
        },
        copyClasses,
        copyTeacherAssignments,
        promoteStudents,
      })) as {
        classesCreated?: number;
        teacherAssignments?: number;
        studentsPromoted?: number;
        studentsUnassigned?: number;
      };

      const summaryParts: string[] = [];
      if ((result.classesCreated ?? 0) > 0)
        summaryParts.push(`${result.classesCreated} classes copied`);
      if ((result.teacherAssignments ?? 0) > 0)
        summaryParts.push(`${result.teacherAssignments} teacher assignments`);
      if ((result.studentsPromoted ?? 0) > 0)
        summaryParts.push(`${result.studentsPromoted} students promoted`);
      if ((result.studentsUnassigned ?? 0) > 0)
        summaryParts.push(`${result.studentsUnassigned} students unassigned`);

      toast.success("Session rollover complete", {
        description: summaryParts.length > 0 ? summaryParts.join(", ") : "New session created",
      });

      onOpenChange(false);
      setFormData({ name: "", startDate: "", endDate: "" });
    } catch (err) {
      toast.error("Rollover failed", {
        description: err instanceof Error ? err.message : "Please try again",
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Session Rollover</DialogTitle>
          <DialogDescription>
            Create a new academic session based on the source session.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Source Session Info */}
          <div className="bg-muted/50 rounded-lg border p-3">
            <p className="text-muted-foreground text-xs font-medium">Source Session</p>
            <div className="mt-1 flex items-center gap-2">
              <span className="font-semibold">{sourceSession.name}</span>
              {sourceSession.isCurrent && (
                <Badge variant="default" className="text-xs">
                  Current
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground mt-0.5 text-xs">
              {formatSessionDate(sourceSession.startDate)} &mdash;{" "}
              {formatSessionDate(sourceSession.endDate)}
            </p>
          </div>

          {/* New Session Fields */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>New Session Name</Label>
              <Input
                placeholder="e.g. 2026-2027"
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData((p) => ({ ...p, startDate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData((p) => ({ ...p, endDate: e.target.value }))}
                />
              </div>
            </div>
          </div>

          {/* Options */}
          <div className="space-y-3">
            <p className="text-sm font-medium">Rollover Options</p>
            <div className="flex items-center gap-3">
              <Checkbox
                id="copy-classes"
                checked={copyClasses}
                onCheckedChange={(checked) => {
                  setCopyClasses(!!checked);
                  if (!checked) {
                    setCopyTeacherAssignments(false);
                    setPromoteStudents(false);
                  }
                }}
              />
              <Label htmlFor="copy-classes" className="font-normal">
                Copy classes to new session
              </Label>
            </div>
            <div className="flex items-center gap-3 pl-6">
              <Checkbox
                id="copy-teachers"
                checked={copyTeacherAssignments}
                onCheckedChange={(checked) => setCopyTeacherAssignments(!!checked)}
                disabled={!copyClasses}
              />
              <Label htmlFor="copy-teachers" className="font-normal">
                Copy teacher assignments
              </Label>
            </div>
            <div className="flex items-center gap-3 pl-6">
              <Checkbox
                id="promote-students"
                checked={promoteStudents}
                onCheckedChange={(checked) => setPromoteStudents(!!checked)}
                disabled={!copyClasses}
              />
              <Label htmlFor="promote-students" className="font-normal">
                Promote students (increment grade, reassign to new classes)
              </Label>
            </div>
          </div>

          {/* Preview Summary */}
          <div className="bg-muted/30 rounded-lg border p-3 text-sm">
            <p className="font-medium">What will happen:</p>
            <ul className="text-muted-foreground mt-1 list-inside list-disc space-y-0.5">
              <li>
                A new session &quot;{formData.name || "..."}&quot; will be created and set as
                current
              </li>
              {copyClasses && <li>Active classes from the source session will be duplicated</li>}
              {copyTeacherAssignments && (
                <li>Teacher assignments will be preserved in new classes</li>
              )}
              {promoteStudents && (
                <li>Students will be promoted to the next grade and reassigned</li>
              )}
              {!copyClasses && <li>No classes will be copied</li>}
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={processing}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={processing || !formData.name || !formData.startDate || !formData.endDate}
          >
            {processing ? "Processing..." : "Start Rollover"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
