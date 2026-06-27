import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useStudents, useSaveStudent, useApiError } from "@levelup/query";
import { useAuthSession } from "../sdk/session";
import { toast } from "sonner";
import { Archive, ArchiveRestore, Pencil, Plus, Search, Users } from "lucide-react";
import {
  Button,
  ConfirmDialog,
  Input,
  Skeleton,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@levelup/shared-ui";
import type { Student } from "@levelup/shared-types";
import StudentFormDialog from "../components/student/StudentFormDialog";

export default function StudentsPage() {
  const tenantId = useAuthSession((s) => s.currentTenantId);
  const { data: studentData, isLoading, error } = useStudents();
  const students = ((studentData as { items?: Student[] } | undefined)?.items ?? []) as Student[];
  const saveStudent = useSaveStudent();
  const { handleError } = useApiError();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Student | null>(null);

  const filtered = students.filter(
    (s) =>
      (s.displayName ?? "").toLowerCase().includes(search.toLowerCase()) ||
      s.uid.toLowerCase().includes(search.toLowerCase()) ||
      (s.rollNumber ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (s.admissionNumber ?? "").toLowerCase().includes(search.toLowerCase())
  );

  // Tenant scoping is server-side via claims; useSaveStudent auto-invalidates the
  // student list on settle.
  const archiveMutation = useMutation({
    mutationFn: (params: { student: Student; status: "active" | "archived" }) =>
      saveStudent.mutateAsync({ id: params.student.id, data: { status: params.status } }),
    onSuccess: (_data, variables) => {
      toast.success(variables.status === "archived" ? "Student archived" : "Student restored");
    },
    onError: (err) => handleError(err, "Failed to update student"),
  });

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (student: Student) => {
    setEditing(student);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Students</h1>
          <p className="text-muted-foreground text-sm">
            Students enrolled in your classes ({students.length} total)
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> Create Student
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
        <Input
          type="text"
          placeholder="Search by name, roll number, or admission number..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {error ? (
        <div className="border-destructive/50 bg-destructive/10 flex flex-col items-center justify-center rounded-lg border py-16">
          <p className="text-destructive text-sm">
            Failed to load students. Please try again later.
          </p>
        </div>
      ) : isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
          <Users className="text-muted-foreground h-10 w-10" />
          <p className="text-muted-foreground mt-3 text-sm">
            {search ? "No students match your search" : "No students yet"}
          </p>
          {!search && (
            <Button className="mt-4" onClick={openCreate}>
              <Plus className="h-4 w-4" /> Create your first student
            </Button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Roll Number</TableHead>
                <TableHead>Admission No.</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead>Section</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((student) => (
                <TableRow
                  key={student.id}
                  className={student.status === "archived" ? "opacity-60" : undefined}
                >
                  <TableCell className="font-medium">
                    {student.displayName ?? student.uid}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{student.rollNumber ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {student.admissionNumber ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{student.grade ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{student.section ?? "—"}</TableCell>
                  <TableCell>
                    <StatusBadge status={student.status} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(student)}
                        aria-label={`Edit ${student.displayName ?? student.uid}`}
                      >
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </Button>
                      {student.status === "archived" ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => archiveMutation.mutate({ student, status: "active" })}
                          disabled={archiveMutation.isPending}
                          aria-label={`Restore ${student.displayName ?? student.uid}`}
                        >
                          <ArchiveRestore className="h-3.5 w-3.5" /> Restore
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setArchiveTarget(student)}
                          aria-label={`Archive ${student.displayName ?? student.uid}`}
                        >
                          <Archive className="h-3.5 w-3.5" /> Archive
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {tenantId && (
        <StudentFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          tenantId={tenantId}
          editing={editing}
        />
      )}

      <ConfirmDialog
        open={!!archiveTarget}
        onOpenChange={(open) => {
          if (!open) setArchiveTarget(null);
        }}
        title="Archive student?"
        description={
          archiveTarget
            ? `${archiveTarget.displayName ?? archiveTarget.uid} will be hidden from default views. Existing submissions and class enrolments are preserved.`
            : ""
        }
        confirmLabel="Archive"
        variant="danger"
        onConfirm={() => {
          if (archiveTarget) {
            archiveMutation.mutate({ student: archiveTarget, status: "archived" });
            setArchiveTarget(null);
          }
        }}
      />
    </div>
  );
}
