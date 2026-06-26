import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useStudents, useApiError } from "@levelup/shared-hooks";
import { callSaveStudent } from "@levelup/shared-services";
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
  Skeleton,
} from "@levelup/shared-ui";
import { Check, Loader2, Search, X } from "lucide-react";
import type { Student } from "@levelup/shared-types";

interface EnrollStudentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  classId: string;
  className: string;
}

export default function EnrollStudentDialog({
  open,
  onOpenChange,
  tenantId,
  classId,
  className,
}: EnrollStudentDialogProps) {
  const queryClient = useQueryClient();
  const { handleError } = useApiError();
  const { data: allStudents = [], isLoading } = useStudents(tenantId);

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) {
      setSearch("");
      setSelected(new Set());
    }
  }, [open]);

  const eligible = useMemo(() => {
    return allStudents.filter(
      (s) => !(s.classIds ?? []).includes(classId) && s.status !== "archived",
    );
  }, [allStudents, classId]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return eligible;
    return eligible.filter(
      (s) =>
        (s.displayName ?? "").toLowerCase().includes(term) ||
        (s.rollNumber ?? "").toLowerCase().includes(term) ||
        (s.admissionNumber ?? "").toLowerCase().includes(term),
    );
  }, [eligible, search]);

  const mutation = useMutation({
    mutationFn: async () => {
      const targets = Array.from(selected)
        .map((id) => allStudents.find((s) => s.id === id))
        .filter((s): s is Student => Boolean(s));

      for (const student of targets) {
        const nextClassIds = Array.from(
          new Set([...(student.classIds ?? []), classId]),
        );
        await callSaveStudent({
          id: student.id,
          tenantId,
          data: { classIds: nextClassIds },
        });
      }
      return targets.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["tenants", tenantId, "students"] });
      queryClient.invalidateQueries({ queryKey: ["tenants", tenantId, "classes"] });
      toast.success(
        `Enrolled ${count} student${count === 1 ? "" : "s"} in ${className}`,
      );
      onOpenChange(false);
    },
    onError: (err) => handleError(err, "Failed to enroll students"),
  });

  const toggle = (studentId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80vh] max-w-2xl flex-col">
        <DialogHeader>
          <DialogTitle>Enroll students into {className}</DialogTitle>
          <DialogDescription>
            Pick existing students from your tenant to add to this class.
          </DialogDescription>
        </DialogHeader>

        <div className="relative mt-2">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            type="text"
            placeholder="Search by name, roll no., or admission no..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {selected.size > 0 && (
          <div className="flex flex-wrap gap-1.5 border-b py-2">
            {Array.from(selected).map((id) => {
              const s = allStudents.find((stu) => stu.id === id);
              if (!s) return null;
              return (
                <Badge key={id} variant="secondary" className="gap-1 pr-1">
                  {s.displayName ?? s.rollNumber ?? s.uid}
                  <button
                    type="button"
                    onClick={() => toggle(id)}
                    className="hover:bg-muted-foreground/20 ml-0.5 rounded p-0.5"
                    aria-label="Remove from selection"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              );
            })}
          </div>
        )}

        <div className="-mx-1 flex-1 overflow-y-auto px-1">
          {isLoading ? (
            <div className="space-y-2 py-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 rounded" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              {eligible.length === 0
                ? "All students are already enrolled in this class."
                : "No matches"}
            </p>
          ) : (
            <ul className="divide-y">
              {filtered.map((s) => {
                const isSelected = selected.has(s.id);
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => toggle(s.id)}
                      className="hover:bg-muted flex w-full items-center gap-3 px-2 py-2 text-left"
                    >
                      <span className="border-input flex h-4 w-4 items-center justify-center rounded border">
                        {isSelected && <Check className="h-3 w-3" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {s.displayName ?? s.uid}
                        </p>
                        <p className="text-muted-foreground truncate text-xs">
                          Roll: {s.rollNumber ?? "—"}
                          {s.admissionNumber ? ` · Adm: ${s.admissionNumber}` : ""}
                          {s.grade ? ` · Grade ${s.grade}` : ""}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={selected.size === 0 || mutation.isPending}
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Enrolling...
              </>
            ) : (
              `Enroll ${selected.size || ""} student${selected.size === 1 ? "" : "s"}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
