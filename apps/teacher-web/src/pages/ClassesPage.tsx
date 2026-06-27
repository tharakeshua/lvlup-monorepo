import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { useClasses, useSaveClass, useApiError } from "@levelup/query";
import { useAuthSession } from "../sdk/session";
import { toast } from "sonner";
import {
  Button,
  Input,
  StatusBadge,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  Skeleton,
  Switch,
  Label,
  ConfirmDialog,
} from "@levelup/shared-ui";
import { Plus, Search, Pencil, Archive, ArchiveRestore, BookOpen } from "lucide-react";
import type { Class } from "@levelup/shared-types";
import ClassFormDialog from "../components/class/ClassFormDialog";

export default function ClassesPage() {
  const tenantId = useAuthSession((s) => s.currentTenantId);
  const { data: classData, isLoading, error } = useClasses();
  const classes = ((classData as { items?: Class[] } | undefined)?.items ?? []) as Class[];
  const saveClass = useSaveClass();
  const { handleError } = useApiError();

  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Class | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Class | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return classes
      .filter((c) => (showArchived ? true : c.status !== "archived"))
      .filter((c) => {
        if (!term) return true;
        return (
          c.name.toLowerCase().includes(term) ||
          (c.grade ?? "").toLowerCase().includes(term) ||
          (c.section ?? "").toLowerCase().includes(term)
        );
      });
  }, [classes, search, showArchived]);

  // Tenant scoping is server-side via claims; useSaveClass auto-invalidates the
  // class list on settle (no manual queryClient invalidation needed).
  const archiveMutation = useMutation({
    mutationFn: (params: { classId: string; status: "active" | "archived" }) =>
      saveClass.mutateAsync({ id: params.classId, data: { status: params.status } }),
    onSuccess: (_data, variables) => {
      toast.success(variables.status === "archived" ? "Class archived" : "Class restored");
    },
    onError: (err) => handleError(err, "Failed to update class status"),
  });

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (cls: Class) => {
    setEditing(cls);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Classes</h1>
          <p className="text-muted-foreground text-sm">
            Manage classes, enrolment and roster ({classes.length} total)
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> Create Class
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            type="text"
            placeholder="Search by name, grade, or section..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch id="show-archived" checked={showArchived} onCheckedChange={setShowArchived} />
          <Label htmlFor="show-archived" className="text-sm">
            Show archived
          </Label>
        </div>
      </div>

      {error ? (
        <div className="border-destructive/50 bg-destructive/10 flex flex-col items-center justify-center rounded-lg border py-16">
          <p className="text-destructive text-sm">
            Failed to load classes. Please try again later.
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
          <BookOpen className="text-muted-foreground h-10 w-10" />
          <p className="text-muted-foreground mt-3 text-sm">
            {search || showArchived ? "No classes match your filter" : "No classes yet"}
          </p>
          {!search && (
            <Button className="mt-4" onClick={openCreate}>
              <Plus className="h-4 w-4" /> Create your first class
            </Button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead>Section</TableHead>
                <TableHead>Students</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((cls) => (
                <TableRow
                  key={cls.id}
                  className={cls.status === "archived" ? "opacity-60" : undefined}
                >
                  <TableCell className="font-medium">
                    <Link to={`/classes/${cls.id}`} className="hover:text-primary hover:underline">
                      {cls.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{cls.grade}</TableCell>
                  <TableCell className="text-muted-foreground">{cls.section ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{cls.studentCount ?? 0}</TableCell>
                  <TableCell>
                    <StatusBadge status={cls.status} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(cls)}
                        aria-label={`Edit ${cls.name}`}
                      >
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </Button>
                      {cls.status === "archived" ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            archiveMutation.mutate({ classId: cls.id, status: "active" })
                          }
                          disabled={archiveMutation.isPending}
                          aria-label={`Restore ${cls.name}`}
                        >
                          <ArchiveRestore className="h-3.5 w-3.5" /> Restore
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setArchiveTarget(cls)}
                          aria-label={`Archive ${cls.name}`}
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
        <ClassFormDialog
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
        title="Archive class?"
        description={
          archiveTarget
            ? `"${archiveTarget.name}" will be hidden from default views. Existing exams and submissions are preserved. You can restore it later.`
            : ""
        }
        confirmLabel="Archive"
        variant="danger"
        onConfirm={() => {
          if (archiveTarget) {
            archiveMutation.mutate({
              classId: archiveTarget.id,
              status: "archived",
            });
            setArchiveTarget(null);
          }
        }}
      />
    </div>
  );
}
