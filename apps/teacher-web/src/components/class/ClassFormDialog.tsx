import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useSaveClass, useApiError } from "@levelup/query";
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
import type { Class } from "@levelup/shared-types";

interface ClassFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  /** When provided, dialog opens in edit mode for this class. */
  editing?: Class | null;
  /** Called with the saved class id after a successful save. */
  onSaved?: (classId: string) => void;
}

export default function ClassFormDialog({
  open,
  onOpenChange,
  tenantId,
  editing,
  onSaved,
}: ClassFormDialogProps) {
  const isEdit = !!editing;
  const { handleError } = useApiError();
  const saveClass = useSaveClass();

  const [name, setName] = useState("");
  const [grade, setGrade] = useState("");
  const [section, setSection] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setGrade(editing?.grade ?? "");
    setSection(editing?.section ?? "");
    setErrors({});
  }, [open, editing]);

  const mutation = useMutation({
    mutationFn: async () => {
      const trimmedName = name.trim();
      const trimmedGrade = grade.trim();
      const trimmedSection = section.trim();
      // Tenant is applied server-side from claims; useSaveClass auto-invalidates.
      return saveClass.mutateAsync({
        id: editing?.id,
        data: {
          name: trimmedName,
          grade: trimmedGrade,
          section: trimmedSection || undefined,
        },
      });
    },
    onSuccess: (result) => {
      toast.success(isEdit ? "Class updated" : "Class created");
      onSaved?.((result as { id: string }).id);
      onOpenChange(false);
    },
    onError: (err) =>
      handleError(err, isEdit ? "Failed to update class" : "Failed to create class"),
  });

  const validate = () => {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = "Name is required";
    if (!grade.trim()) next.grade = "Grade is required";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="shadow-e3 max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">
            {isEdit ? "Edit Class" : "Create Class"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the class name, grade, or section."
              : "Add a new class for your tenant. You can enroll students after creation."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="class-name" className="text-fg-secondary">
              Class Name
            </Label>
            <Input
              id="class-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Grade 10 — Section A"
              className="mt-1"
              autoFocus
            />
            {errors.name && <p className="text-error mt-1 text-sm">{errors.name}</p>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="class-grade" className="text-fg-secondary">
                Grade
              </Label>
              <Input
                id="class-grade"
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                placeholder="10"
                className="mt-1"
              />
              {errors.grade && <p className="text-error mt-1 text-sm">{errors.grade}</p>}
            </div>
            <div>
              <Label htmlFor="class-section" className="text-fg-secondary">
                Section (optional)
              </Label>
              <Input
                id="class-section"
                value={section}
                onChange={(e) => setSection(e.target.value)}
                placeholder="A"
                className="mt-1"
              />
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
                <Loader2 className="h-4 w-4 animate-spin" /> {isEdit ? "Saving..." : "Creating..."}
              </>
            ) : isEdit ? (
              "Save Changes"
            ) : (
              "Create Class"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
