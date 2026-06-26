import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { callSaveStudent } from "@levelup/shared-services";
import { useApiError, useClasses } from "@levelup/shared-hooks";
import { toast } from "sonner";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@levelup/shared-ui";
import { Check, ChevronsUpDown, Loader2, X } from "lucide-react";
import type { Student } from "@levelup/shared-types";

interface StudentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  /** When provided, dialog opens in edit mode. */
  editing?: Student | null;
}

export default function StudentFormDialog({
  open,
  onOpenChange,
  tenantId,
  editing,
}: StudentFormDialogProps) {
  const isEdit = !!editing;
  const queryClient = useQueryClient();
  const { handleError } = useApiError();
  const { data: allClasses = [] } = useClasses(tenantId);
  const classes = useMemo(
    () => allClasses.filter((c) => c.status === "active"),
    [allClasses],
  );

  const [uid, setUid] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [admissionNumber, setAdmissionNumber] = useState("");
  const [grade, setGrade] = useState("");
  const [section, setSection] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [classIds, setClassIds] = useState<string[]>([]);
  const [classPickerOpen, setClassPickerOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setUid(editing?.uid ?? "");
    setRollNumber(editing?.rollNumber ?? "");
    setAdmissionNumber(editing?.admissionNumber ?? "");
    setGrade(editing?.grade ?? "");
    setSection(editing?.section ?? "");
    setDateOfBirth(editing?.dateOfBirth ?? "");
    setClassIds(editing?.classIds ?? []);
    setErrors({});
  }, [open, editing]);

  const selectedClasses = useMemo(
    () => classes.filter((c) => classIds.includes(c.id)),
    [classes, classIds],
  );

  const toggleClass = (classId: string) => {
    setClassIds((prev) =>
      prev.includes(classId) ? prev.filter((id) => id !== classId) : [...prev, classId],
    );
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (isEdit && editing) {
        return callSaveStudent({
          id: editing.id,
          tenantId,
          data: {
            rollNumber: rollNumber.trim() || undefined,
            admissionNumber: admissionNumber.trim() || undefined,
            grade: grade.trim() || undefined,
            section: section.trim() || undefined,
            dateOfBirth: dateOfBirth || undefined,
            classIds,
          },
        });
      }
      return callSaveStudent({
        tenantId,
        data: {
          uid: uid.trim(),
          rollNumber: rollNumber.trim() || undefined,
          admissionNumber: admissionNumber.trim() || undefined,
          grade: grade.trim() || undefined,
          section: section.trim() || undefined,
          dateOfBirth: dateOfBirth || undefined,
          classIds: classIds.length > 0 ? classIds : undefined,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenants", tenantId, "students"] });
      queryClient.invalidateQueries({ queryKey: ["tenants", tenantId, "classes"] });
      toast.success(isEdit ? "Student updated" : "Student created");
      onOpenChange(false);
    },
    onError: (err) =>
      handleError(err, isEdit ? "Failed to update student" : "Failed to create student"),
  });

  const validate = () => {
    const next: Record<string, string> = {};
    if (!isEdit && !uid.trim()) {
      next.uid = "Firebase Auth UID is required (link existing user)";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Student" : "Create Student"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update student details and class enrolment."
              : "Link an existing Firebase Auth user to a new student profile. Bulk import or invite flow is the right path for new accounts."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {!isEdit && (
            <div>
              <Label htmlFor="student-uid">Firebase Auth UID</Label>
              <Input
                id="student-uid"
                value={uid}
                onChange={(e) => setUid(e.target.value)}
                placeholder="paste the user's Firebase Auth UID"
                className="mt-1 font-mono text-xs"
                autoFocus
              />
              <p className="text-muted-foreground mt-1 text-xs">
                The student must already have a Firebase Auth account. Use Bulk Import to
                provision new accounts.
              </p>
              {errors.uid && (
                <p className="text-destructive mt-1 text-xs">{errors.uid}</p>
              )}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="student-roll">Roll Number</Label>
              <Input
                id="student-roll"
                value={rollNumber}
                onChange={(e) => setRollNumber(e.target.value)}
                placeholder="e.g. 23"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="student-admission">Admission Number</Label>
              <Input
                id="student-admission"
                value={admissionNumber}
                onChange={(e) => setAdmissionNumber(e.target.value)}
                placeholder="e.g. ADM2026-001"
                className="mt-1"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="student-grade">Grade</Label>
              <Input
                id="student-grade"
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                placeholder="10"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="student-section">Section</Label>
              <Input
                id="student-section"
                value={section}
                onChange={(e) => setSection(e.target.value)}
                placeholder="A"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="student-dob">Date of birth</Label>
              <Input
                id="student-dob"
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label>Classes</Label>
            <div className="mt-1 space-y-2">
              <Popover open={classPickerOpen} onOpenChange={setClassPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={classPickerOpen}
                    className="w-full justify-between font-normal"
                  >
                    <span className="text-muted-foreground">
                      {classIds.length === 0
                        ? "No classes selected"
                        : `${classIds.length} selected`}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-1" align="start">
                  <div className="max-h-56 overflow-y-auto">
                    {classes.length === 0 ? (
                      <p className="text-muted-foreground py-3 text-center text-xs">
                        No active classes
                      </p>
                    ) : (
                      classes.map((cls) => {
                        const isSelected = classIds.includes(cls.id);
                        return (
                          <button
                            key={cls.id}
                            type="button"
                            onClick={() => toggleClass(cls.id)}
                            className="hover:bg-muted flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm"
                          >
                            <span className="border-input flex h-4 w-4 items-center justify-center rounded border">
                              {isSelected && <Check className="h-3 w-3" />}
                            </span>
                            <span className="flex-1 truncate">{cls.name}</span>
                            <span className="text-muted-foreground text-xs">
                              Grade {cls.grade}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </PopoverContent>
              </Popover>
              {selectedClasses.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedClasses.map((cls) => (
                    <Badge key={cls.id} variant="secondary" className="gap-1 pr-1">
                      {cls.name}
                      <button
                        type="button"
                        onClick={() => toggleClass(cls.id)}
                        className="hover:bg-muted-foreground/20 ml-0.5 rounded p-0.5"
                        aria-label={`Remove ${cls.name}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
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
                <Loader2 className="h-4 w-4 animate-spin" />{" "}
                {isEdit ? "Saving..." : "Creating..."}
              </>
            ) : isEdit ? (
              "Save Changes"
            ) : (
              "Create Student"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
