import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useApiError, useSaveExam } from "@levelup/query";
import { asExamId, asClassId } from "@levelup/domain";
import { toast } from "sonner";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@levelup/shared-ui";
import { Loader2 } from "lucide-react";
import type { Exam, FirestoreTimestamp } from "@levelup/shared-types";
import ClassMultiSelect from "./ClassMultiSelect";

interface ExamMetadataEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  exam: Exam;
  onSaved?: () => void;
}

function tsToDateInput(ts: FirestoreTimestamp | undefined): string {
  if (!ts) return "";
  try {
    const d = ts.toDate();
    if (Number.isNaN(d.getTime())) return "";
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  } catch {
    return "";
  }
}

export default function ExamMetadataEditDialog({
  open,
  onOpenChange,
  tenantId,
  exam,
  onSaved,
}: ExamMetadataEditDialogProps) {
  const { handleError } = useApiError();
  const saveExam = useSaveExam();
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [topics, setTopics] = useState("");
  const [totalMarks, setTotalMarks] = useState(0);
  const [passingMarks, setPassingMarks] = useState(0);
  const [duration, setDuration] = useState(0);
  const [examDate, setExamDate] = useState("");
  const [classIds, setClassIds] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setTitle(exam.title);
    setSubject(exam.subject);
    setTopics((exam.topics ?? []).join(", "));
    setTotalMarks(exam.totalMarks);
    setPassingMarks(exam.passingMarks);
    setDuration(exam.duration);
    setExamDate(tsToDateInput(exam.examDate));
    setClassIds(exam.classIds ?? []);
    setErrors({});
  }, [open, exam]);

  const mutation = useMutation({
    mutationFn: async () => {
      return saveExam.mutateAsync({
        id: asExamId(exam.id),
        data: {
          title: title.trim(),
          subject: subject.trim(),
          topics: topics
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          totalMarks,
          passingMarks,
          duration,
          classIds: classIds.map(asClassId),
          examDate: examDate ? new Date(examDate).toISOString() : undefined,
        },
      });
    },
    onSuccess: () => {
      toast.success("Exam updated");
      onSaved?.();
      onOpenChange(false);
    },
    onError: (err) => handleError(err, "Failed to update exam"),
  });

  const validate = () => {
    const next: Record<string, string> = {};
    if (!title.trim()) next.title = "Title is required";
    if (!subject.trim()) next.subject = "Subject is required";
    if (totalMarks <= 0) next.totalMarks = "Total marks must be greater than 0";
    if (passingMarks < 0) next.passingMarks = "Passing marks cannot be negative";
    if (passingMarks > totalMarks) next.passingMarks = "Passing marks cannot exceed total marks";
    if (duration <= 0) next.duration = "Duration must be greater than 0";
    if (classIds.length === 0) next.classIds = "Select at least one class";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Exam</DialogTitle>
          <DialogDescription>
            Update exam metadata. Class changes won't retroactively grade existing submissions for
            newly added classes.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="exam-title">Title</Label>
            <Input
              id="exam-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1"
            />
            {errors.title && <p className="text-destructive mt-1 text-xs">{errors.title}</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="exam-subject">Subject</Label>
              <Input
                id="exam-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="mt-1"
              />
              {errors.subject && <p className="text-destructive mt-1 text-xs">{errors.subject}</p>}
            </div>
            <div>
              <Label htmlFor="exam-topics">Topics (comma-separated)</Label>
              <Input
                id="exam-topics"
                value={topics}
                onChange={(e) => setTopics(e.target.value)}
                placeholder="Algebra, Geometry"
                className="mt-1"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="exam-total">Total Marks</Label>
              <Input
                id="exam-total"
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
              <Label htmlFor="exam-passing">Passing Marks</Label>
              <Input
                id="exam-passing"
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
              <Label htmlFor="exam-duration">Duration (min)</Label>
              <Input
                id="exam-duration"
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
            <Label htmlFor="exam-date">Exam Date</Label>
            <Input
              id="exam-date"
              type="date"
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label>Classes</Label>
            <div className="mt-1">
              <ClassMultiSelect
                tenantId={tenantId}
                value={classIds}
                onChange={setClassIds}
                placeholder="Select classes..."
              />
            </div>
            {errors.classIds && <p className="text-destructive mt-1 text-xs">{errors.classIds}</p>}
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending}>
            {mutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
