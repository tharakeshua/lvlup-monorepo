import { useState } from "react";
import { Link } from "react-router-dom";
import {
  useClasses,
  useSaveClass,
  useTeachers,
  useStudents,
  useSaveStudent,
  useBulkUpdateStatus,
} from "@levelup/query";
import type { Class, Teacher, Student } from "@levelup/shared-types";
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
  Badge,
  Checkbox,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  EntityPicker,
  DataTablePagination,
  SortableTableHead,
} from "@levelup/shared-ui";
import type { EntityPickerItem } from "@levelup/shared-ui";
import { Plus, Search, Pencil, Archive, Users, GraduationCap, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { TableSkeleton } from "../components/skeletons/TableSkeleton";
import { usePagination } from "../hooks/usePagination";
import { useSort } from "../hooks/useSort";
import { pageItems } from "@/lib/utils";

const GRADES = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];

const SECTIONS = ["A", "B", "C", "D", "E", "F"];

interface ClassFormData {
  name: string;
  grade: string;
  section: string;
}

export default function ClassesPage() {
  const classesQuery = useClasses({});
  const classes = pageItems<Class>(classesQuery.data);
  const isLoading = classesQuery.isLoading;
  const teachers = pageItems<Teacher>(useTeachers({}).data);
  const students = pageItems<Student>(useStudents({}).data);
  const saveClass = useSaveClass();
  const saveStudent = useSaveStudent();
  const bulkUpdateStatus = useBulkUpdateStatus();

  const [searchQuery, setSearchQuery] = useState("");
  const [gradeFilter, setGradeFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [assignTeachersOpen, setAssignTeachersOpen] = useState(false);
  const [assignStudentsOpen, setAssignStudentsOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [formData, setFormData] = useState<ClassFormData>({ name: "", grade: "", section: "" });
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  // Bulk selection state
  const [selectedClassIds, setSelectedClassIds] = useState<Set<string>>(new Set());
  const [bulkStatusConfirmOpen, setBulkStatusConfirmOpen] = useState(false);
  const [bulkStatusAction, setBulkStatusAction] = useState<"active" | "archived">("archived");
  const [bulkStatusProcessing, setBulkStatusProcessing] = useState(false);

  const filtered = classes?.filter((c) => {
    if (c.status === "archived") return false;
    if (gradeFilter !== "all" && c.grade !== gradeFilter) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.grade?.toLowerCase().includes(q) ||
      c.section?.toLowerCase().includes(q)
    );
  });

  const teacherItems: EntityPickerItem[] = (teachers ?? []).map((t: Teacher) => ({
    id: t.id,
    label:
      [t.firstName, t.lastName].filter(Boolean).join(" ") ||
      t.displayName ||
      t.email ||
      t.uid.slice(0, 12),
    description: t.subjects?.join(", ") || t.designation || undefined,
  }));

  const { sortedItems: sortedFiltered, currentSort, handleSort } = useSort(filtered ?? []);
  const { paginatedItems, currentPage, pageSize, totalItems, setCurrentPage, setPageSize } =
    usePagination(sortedFiltered, 25);

  const studentItems: EntityPickerItem[] = (students ?? []).map((s: Student) => ({
    id: s.id,
    label:
      [s.firstName, s.lastName].filter(Boolean).join(" ") || s.rollNumber || s.uid.slice(0, 12),
    description: s.grade
      ? `Grade ${s.grade}${s.rollNumber ? ` - ${s.rollNumber}` : ""}`
      : undefined,
  }));

  const allOnPageSelected =
    paginatedItems.length > 0 && paginatedItems.every((cls) => selectedClassIds.has(cls.id));

  const handleToggleClass = (id: string) => {
    setSelectedClassIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleAllClasses = (checked: boolean) => {
    if (checked && paginatedItems.length > 0) {
      setSelectedClassIds(new Set(paginatedItems.map((cls) => cls.id)));
    } else {
      setSelectedClassIds(new Set());
    }
  };

  const openBulkStatusConfirm = (action: "active" | "archived") => {
    setBulkStatusAction(action);
    setBulkStatusConfirmOpen(true);
  };

  const handleBulkStatusUpdate = async () => {
    setBulkStatusProcessing(true);
    try {
      const entityIds = Array.from(selectedClassIds);
      await bulkUpdateStatus.mutateAsync({
        entityType: "class",
        entityIds,
        newStatus: bulkStatusAction,
      });
      setSelectedClassIds(new Set());
      setBulkStatusConfirmOpen(false);
      toast.success(
        `${entityIds.length} class(es) ${bulkStatusAction === "archived" ? "archived" : "activated"}`
      );
    } catch (err) {
      toast.error("Failed to update status", {
        description: err instanceof Error ? err.message : "Please try again",
      });
    } finally {
      setBulkStatusProcessing(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.name || !formData.grade) return;
    try {
      await saveClass.mutateAsync({
        name: formData.name,
        grade: formData.grade,
        section: formData.section || undefined,
      });
      setCreateOpen(false);
      setFormData({ name: "", grade: "", section: "" });
      toast.success("Class created");
    } catch (err) {
      toast.error("Failed to create class", {
        description: err instanceof Error ? err.message : "Please try again",
      });
    }
  };

  const handleEdit = async () => {
    if (!selectedClass) return;
    try {
      await saveClass.mutateAsync({
        classId: selectedClass.id,
        name: formData.name || undefined,
        grade: formData.grade || undefined,
        section: formData.section || undefined,
      });
      setEditOpen(false);
      setSelectedClass(null);
      toast.success("Class updated");
    } catch (err) {
      toast.error("Failed to update class", {
        description: err instanceof Error ? err.message : "Please try again",
      });
    }
  };

  const handleArchive = async () => {
    if (!selectedClass) return;
    try {
      await saveClass.mutateAsync({ classId: selectedClass.id, status: "archived" });
      setArchiveOpen(false);
      setSelectedClass(null);
      toast.success("Class archived");
    } catch (err) {
      toast.error("Failed to archive class", {
        description: err instanceof Error ? err.message : "Please try again",
      });
    }
  };

  const handleAssignTeachers = async () => {
    if (!selectedClass) return;
    try {
      await saveClass.mutateAsync({
        classId: selectedClass.id,
        teacherIds: selectedTeacherIds,
      });
      setAssignTeachersOpen(false);
      setSelectedClass(null);
      toast.success("Teachers assigned");
    } catch (err) {
      toast.error("Failed to assign teachers", {
        description: err instanceof Error ? err.message : "Please try again",
      });
    }
  };

  const handleAssignStudents = async () => {
    if (!selectedClass) return;
    try {
      const classId = selectedClass.id;

      // Find students currently in this class and compute additions/removals
      const currentStudentsInClass = (students ?? []).filter((s: Student) =>
        s.classIds?.includes(classId)
      );
      const currentIds = new Set(currentStudentsInClass.map((s: Student) => s.id));
      const selectedSet = new Set(selectedStudentIds);

      // Students to add this class to
      const toAdd = selectedStudentIds.filter((id) => !currentIds.has(id));
      // Students to remove this class from
      const toRemove = currentStudentsInClass
        .filter((s: Student) => !selectedSet.has(s.id))
        .map((s: Student) => s.id);

      const updates: Promise<unknown>[] = [];

      for (const studentId of toAdd) {
        const student = (students ?? []).find((s: Student) => s.id === studentId);
        const newClassIds = [...(student?.classIds ?? []), classId];
        updates.push(saveStudent.mutateAsync({ studentId, classIds: newClassIds }));
      }

      for (const studentId of toRemove) {
        const student = (students ?? []).find((s: Student) => s.id === studentId);
        const newClassIds = (student?.classIds ?? []).filter((id) => id !== classId);
        updates.push(saveStudent.mutateAsync({ studentId, classIds: newClassIds }));
      }

      await Promise.all(updates);
      setAssignStudentsOpen(false);
      setSelectedClass(null);
      toast.success("Students assigned");
    } catch (err) {
      toast.error("Failed to assign students", {
        description: err instanceof Error ? err.message : "Please try again",
      });
    }
  };

  const openEdit = (cls: Class) => {
    setSelectedClass(cls);
    setFormData({ name: cls.name, grade: cls.grade, section: cls.section ?? "" });
    setEditOpen(true);
  };

  const openArchive = (cls: Class) => {
    setSelectedClass(cls);
    setArchiveOpen(true);
  };

  const openAssignTeachers = (cls: Class) => {
    setSelectedClass(cls);
    setSelectedTeacherIds(cls.teacherIds ?? []);
    setAssignTeachersOpen(true);
  };

  const openAssignStudents = (cls: Class) => {
    setSelectedClass(cls);
    // Derive enrolled student IDs from Student.classIds[] (source of truth)
    const enrolled = (students ?? [])
      .filter((s: Student) => s.classIds?.includes(cls.id))
      .map((s: Student) => s.id);
    setSelectedStudentIds(enrolled);
    setAssignStudentsOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Classes & Sections</h1>
          <p className="text-muted-foreground text-sm">Manage your school's classes and sections</p>
        </div>
        <Button
          onClick={() => {
            setFormData({ name: "", grade: "", section: "" });
            setCreateOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Create Class
        </Button>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Search classes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={gradeFilter} onValueChange={setGradeFilter}>
          <SelectTrigger className="w-full md:w-40">
            <SelectValue placeholder="All Grades" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Grades</SelectItem>
            {GRADES.map((g) => (
              <SelectItem key={g} value={g}>
                Grade {g}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <TableSkeleton columns={8} />
      ) : !filtered?.length ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <h3 className="text-lg font-semibold">No classes yet</h3>
          <p className="text-muted-foreground mt-1 text-sm">
            Create your first class to get started
          </p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allOnPageSelected}
                      onCheckedChange={(checked) => handleToggleAllClasses(!!checked)}
                      aria-label="Select all classes on page"
                    />
                  </TableHead>
                  <SortableTableHead sortKey="name" currentSort={currentSort} onSort={handleSort}>
                    Name
                  </SortableTableHead>
                  <SortableTableHead sortKey="grade" currentSort={currentSort} onSort={handleSort}>
                    Grade
                  </SortableTableHead>
                  <SortableTableHead
                    sortKey="section"
                    currentSort={currentSort}
                    onSort={handleSort}
                  >
                    Section
                  </SortableTableHead>
                  <TableHead>Teachers</TableHead>
                  <TableHead>Students</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedItems.map((cls) => (
                  <TableRow
                    key={cls.id}
                    className={selectedClassIds.has(cls.id) ? "bg-muted/50" : undefined}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedClassIds.has(cls.id)}
                        onCheckedChange={() => handleToggleClass(cls.id)}
                        aria-label={`Select ${cls.name}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      <Link
                        to={`/classes/${cls.id}`}
                        className="hover:text-primary hover:underline"
                      >
                        {cls.name}
                      </Link>
                    </TableCell>
                    <TableCell>{cls.grade}</TableCell>
                    <TableCell>{cls.section || "\u2014"}</TableCell>
                    <TableCell>
                      <button
                        onClick={() => openAssignTeachers(cls)}
                        className="hover:text-primary inline-flex items-center gap-1 text-sm"
                        aria-label={`Assign teachers to ${cls.name}`}
                      >
                        <GraduationCap className="h-3.5 w-3.5" />
                        {cls.teacherIds?.length ?? 0}
                      </button>
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => openAssignStudents(cls)}
                        className="hover:text-primary inline-flex items-center gap-1 text-sm"
                        aria-label={`Assign students to ${cls.name}`}
                      >
                        <Users className="h-3.5 w-3.5" />
                        {cls.studentCount ?? 0}
                      </button>
                    </TableCell>
                    <TableCell>
                      <Badge variant={cls.status === "active" ? "default" : "secondary"}>
                        {cls.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(cls)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openArchive(cls)}>
                          <Archive className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DataTablePagination
            totalItems={totalItems}
            pageSize={pageSize}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      )}

      {/* Floating Bulk Action Bar */}
      {selectedClassIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
          <div className="bg-background flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg">
            <span className="text-sm font-medium">{selectedClassIds.size} selected</span>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => openBulkStatusConfirm("archived")}
            >
              <Archive className="mr-2 h-3.5 w-3.5" /> Archive Selected
            </Button>
            <Button size="sm" variant="outline" onClick={() => openBulkStatusConfirm("active")}>
              <RotateCcw className="mr-2 h-3.5 w-3.5" /> Activate Selected
            </Button>
          </div>
        </div>
      )}

      {/* Bulk Status Confirmation Dialog */}
      <AlertDialog open={bulkStatusConfirmOpen} onOpenChange={setBulkStatusConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {bulkStatusAction === "archived" ? "Archive" : "Activate"} {selectedClassIds.size}{" "}
              class(es)?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will {bulkStatusAction === "archived" ? "archive" : "activate"} the selected
              classes.
              {bulkStatusAction === "archived"
                ? " Archived classes will be hidden from active views."
                : " Activated classes will appear in active views."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkStatusProcessing}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkStatusUpdate} disabled={bulkStatusProcessing}>
              {bulkStatusProcessing
                ? "Processing..."
                : bulkStatusAction === "archived"
                  ? "Archive"
                  : "Activate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Class Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Class</DialogTitle>
            <DialogDescription>Add a new class to your school.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="class-name">Class Name</Label>
              <Input
                id="class-name"
                placeholder="e.g. Mathematics 10A"
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Grade</Label>
                <Select
                  value={formData.grade}
                  onValueChange={(v) => setFormData((p) => ({ ...p, grade: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select grade" />
                  </SelectTrigger>
                  <SelectContent>
                    {GRADES.map((g) => (
                      <SelectItem key={g} value={g}>
                        Grade {g}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Section</Label>
                <Select
                  value={formData.section}
                  onValueChange={(v) => setFormData((p) => ({ ...p, section: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select section" />
                  </SelectTrigger>
                  <SelectContent>
                    {SECTIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        Section {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={saveClass.isPending || !formData.name || !formData.grade}
            >
              {saveClass.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Class Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Class</DialogTitle>
            <DialogDescription>Update class details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-class-name">Class Name</Label>
              <Input
                id="edit-class-name"
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Grade</Label>
                <Select
                  value={formData.grade}
                  onValueChange={(v) => setFormData((p) => ({ ...p, grade: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select grade" />
                  </SelectTrigger>
                  <SelectContent>
                    {GRADES.map((g) => (
                      <SelectItem key={g} value={g}>
                        Grade {g}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Section</Label>
                <Select
                  value={formData.section}
                  onValueChange={(v) => setFormData((p) => ({ ...p, section: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select section" />
                  </SelectTrigger>
                  <SelectContent>
                    {SECTIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        Section {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={saveClass.isPending}>
              {saveClass.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archive Confirmation */}
      <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Class</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to archive &quot;{selectedClass?.name}&quot;? This will hide the
              class from active views.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive} disabled={saveClass.isPending}>
              {saveClass.isPending ? "Archiving..." : "Archive"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Assign Teachers Dialog */}
      <Dialog open={assignTeachersOpen} onOpenChange={setAssignTeachersOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Teachers</DialogTitle>
            <DialogDescription>
              Select teachers to assign to {selectedClass?.name}.
            </DialogDescription>
          </DialogHeader>
          <EntityPicker
            items={teacherItems}
            selected={selectedTeacherIds}
            onChange={setSelectedTeacherIds}
            placeholder="Select teachers..."
            searchPlaceholder="Search teachers..."
            emptyText="No teachers found."
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignTeachersOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAssignTeachers} disabled={saveClass.isPending}>
              {saveClass.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Students Dialog */}
      <Dialog open={assignStudentsOpen} onOpenChange={setAssignStudentsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Students</DialogTitle>
            <DialogDescription>
              Select students to assign to {selectedClass?.name}.
            </DialogDescription>
          </DialogHeader>
          <EntityPicker
            items={studentItems}
            selected={selectedStudentIds}
            onChange={setSelectedStudentIds}
            placeholder="Select students..."
            searchPlaceholder="Search students..."
            emptyText="No students found."
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignStudentsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAssignStudents} disabled={saveStudent.isPending}>
              {saveStudent.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
