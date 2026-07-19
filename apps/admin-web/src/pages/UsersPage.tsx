import { useState } from "react";
import { useCurrentTenantId } from "@/sdk/identity";
import {
  useTeachers,
  useStudents,
  useParents,
  useClasses,
  useSaveStudent,
  useSaveTeacher,
  useSaveParent,
  useCreateOrgUser,
  useBulkImportStudents,
  useBulkImportTeachers,
  useBulkUpdateStatus,
} from "@levelup/query";
import type { Teacher, Student, Parent, Class } from "@levelup/shared-types";
import {
  Button,
  Input,
  Label,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  EntityPicker,
  BulkImportDialog,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@levelup/shared-ui";
import type { EntityPickerItem } from "@levelup/shared-ui";
import { Search, Upload, UserPlus, Archive, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { usePagination } from "../hooks/usePagination";
import { TeachersTab } from "../components/users/TeachersTab";
import { StudentsTab } from "../components/users/StudentsTab";
import { ParentsTab } from "../components/users/ParentsTab";
import { pageItems } from "@/lib/utils";

type UserTab = "teachers" | "students" | "parents";

export default function UsersPage() {
  const tenantId = useCurrentTenantId();
  const { data: teachersData, isLoading: teachersLoading } = useTeachers({});
  const { data: studentsData, isLoading: studentsLoading } = useStudents({});
  const { data: parentsData, isLoading: parentsLoading } = useParents({});
  const { data: classesData } = useClasses({});
  const teachers = pageItems<Teacher>(teachersData);
  const students = pageItems<Student>(studentsData);
  const parents = pageItems<Parent>(parentsData);
  const classes = pageItems<Class>(classesData);
  const saveStudent = useSaveStudent();
  const saveTeacher = useSaveTeacher();
  const saveParent = useSaveParent();
  const createOrgUser = useCreateOrgUser();
  const bulkImportStudents = useBulkImportStudents();
  const bulkImportTeachers = useBulkImportTeachers();
  const bulkUpdateStatus = useBulkUpdateStatus();

  const [activeTab, setActiveTab] = useState<UserTab>("teachers");
  const [searchQuery, setSearchQuery] = useState("");

  // Create dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [createRole, setCreateRole] = useState<"teacher" | "student" | "parent">("teacher");
  const [createForm, setCreateForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    rollNumber: "",
    classId: "",
    subjects: "",
    designation: "",
  });
  const [creating, setCreating] = useState(false);

  // Bulk import state
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [bulkImportTeachersOpen, setBulkImportTeachersOpen] = useState(false);

  // Assignment dialog state
  const [assignClassOpen, setAssignClassOpen] = useState(false);
  const [assignEntity, setAssignEntity] = useState<{
    id: string;
    type: "teacher" | "student";
    currentClassIds: string[];
  } | null>(null);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);

  // Link parent dialog state
  const [linkParentOpen, setLinkParentOpen] = useState(false);
  const [linkStudentId, setLinkStudentId] = useState<string | null>(null);
  const [selectedParentIds, setSelectedParentIds] = useState<string[]>([]);

  // Edit parent dialog state
  const [editParentOpen, setEditParentOpen] = useState(false);
  const [editParentId, setEditParentId] = useState<string | null>(null);
  const [editParentForm, setEditParentForm] = useState({ firstName: "", lastName: "", phone: "" });
  const [savingParent, setSavingParent] = useState(false);

  // Selection state for bulk status operations
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<Set<string>>(new Set());
  const [bulkStatusConfirmOpen, setBulkStatusConfirmOpen] = useState(false);
  const [bulkStatusAction, setBulkStatusAction] = useState<"active" | "archived">("archived");
  const [bulkStatusProcessing, setBulkStatusProcessing] = useState(false);

  const classItems: EntityPickerItem[] = (classes ?? []).map((c) => ({
    id: c.id,
    label: c.name,
    description: `Grade ${c.grade}${c.section ? ` - ${c.section}` : ""}`,
  }));

  const parentItems: EntityPickerItem[] = (parents ?? []).map((p) => ({
    id: p.id,
    label: [p.firstName, p.lastName].filter(Boolean).join(" ") || p.email || p.id.slice(0, 16),
  }));

  // Filter helpers
  const filteredTeachers = teachers?.filter((t: Teacher) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.firstName?.toLowerCase().includes(q) ||
      t.lastName?.toLowerCase().includes(q) ||
      t.displayName?.toLowerCase().includes(q) ||
      t.email?.toLowerCase().includes(q) ||
      t.subjects?.some((s) => s.toLowerCase().includes(q)) ||
      t.designation?.toLowerCase().includes(q)
    );
  });

  const filteredStudents = students?.filter((s: Student) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.firstName?.toLowerCase().includes(q) ||
      s.lastName?.toLowerCase().includes(q) ||
      s.displayName?.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q) ||
      s.rollNumber?.toLowerCase().includes(q) ||
      s.grade?.toLowerCase().includes(q)
    );
  });

  const filteredParents = parents?.filter((p: Parent) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.firstName?.toLowerCase().includes(q) ||
      p.lastName?.toLowerCase().includes(q) ||
      p.displayName?.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q)
    );
  });

  const teacherPagination = usePagination(filteredTeachers ?? [], 25);
  const studentPagination = usePagination(filteredStudents ?? [], 25);
  const parentPagination = usePagination(filteredParents ?? [], 25);

  // Selection helpers
  const currentSelectedIds = activeTab === "teachers" ? selectedTeacherIds : selectedStudentIds;
  const currentSelectedCount = currentSelectedIds.size;

  const handleToggleStudent = (id: string) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleAllStudents = (checked: boolean) => {
    if (checked && studentPagination.paginatedItems.length > 0) {
      setSelectedStudentIds(new Set(studentPagination.paginatedItems.map((s) => s.id)));
    } else {
      setSelectedStudentIds(new Set());
    }
  };

  const handleToggleTeacher = (id: string) => {
    setSelectedTeacherIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleAllTeachers = (checked: boolean) => {
    if (checked && teacherPagination.paginatedItems.length > 0) {
      setSelectedTeacherIds(new Set(teacherPagination.paginatedItems.map((t) => t.id)));
    } else {
      setSelectedTeacherIds(new Set());
    }
  };

  const openBulkStatusConfirm = (action: "active" | "archived") => {
    setBulkStatusAction(action);
    setBulkStatusConfirmOpen(true);
  };

  const handleBulkStatusUpdate = async () => {
    if (!tenantId) return;
    setBulkStatusProcessing(true);
    try {
      const entityType = activeTab === "teachers" ? ("teacher" as const) : ("student" as const);
      const entityIds = Array.from(currentSelectedIds);
      await bulkUpdateStatus.mutateAsync({ entityType, ids: entityIds, status: bulkStatusAction });
      if (activeTab === "teachers") setSelectedTeacherIds(new Set());
      else setSelectedStudentIds(new Set());
      setBulkStatusConfirmOpen(false);
      toast.success(
        `${entityIds.length} ${entityType}(s) ${bulkStatusAction === "archived" ? "archived" : "activated"}`
      );
    } catch (err) {
      toast.error("Failed to update status", {
        description: err instanceof Error ? err.message : "Please try again",
      });
    } finally {
      setBulkStatusProcessing(false);
    }
  };

  // Handlers
  const handleCreate = async () => {
    if (!tenantId) return;
    setCreating(true);
    try {
      await createOrgUser.mutateAsync({
        role: createRole,
        firstName: createForm.firstName,
        lastName: createForm.lastName,
        email: createForm.email || undefined,
        phone: createForm.phone || undefined,
        rollNumber: createRole === "student" ? createForm.rollNumber || undefined : undefined,
        classIds: createForm.classId ? [createForm.classId] : undefined,
        subjects:
          createRole === "teacher" && createForm.subjects
            ? createForm.subjects.split(",").map((s) => s.trim())
            : undefined,
      });
      setCreateOpen(false);
      setCreateForm({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        rollNumber: "",
        classId: "",
        subjects: "",
        designation: "",
      });
      toast.success("User created");
    } catch (err) {
      toast.error("Failed to create user", {
        description: err instanceof Error ? err.message : "Please try again",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleBulkImport = async (rows: Record<string, string>[]) => {
    try {
      // NOTE: the @levelup/query bulkImportStudents contract (strict) only accepts
      // firstName/lastName/email/rollNumber/section/grade/admissionNumber/classIds —
      // className + parent-linkage columns from the old import are no longer supported.
      const importRows = rows.map((row) => {
        const classId = row["classId"] ?? row["class_id"];
        return {
          firstName: row["firstName"] ?? row["first_name"] ?? "",
          lastName: row["lastName"] ?? row["last_name"] ?? "",
          rollNumber: row["rollNumber"] ?? row["roll_number"] ?? undefined,
          email: row["email"] ?? undefined,
          section: row["section"] ?? undefined,
          classIds: classId ? [classId] : undefined,
        };
      });
      await bulkImportStudents.mutateAsync({ rows: importRows });
      toast.success("Students imported");
    } catch (err) {
      toast.error("Failed to import students", {
        description: err instanceof Error ? err.message : "Please try again",
      });
    }
  };

  const handleBulkImportTeachers = async (rows: Record<string, string>[]) => {
    try {
      const importRows = rows.map((row) => ({
        firstName: row["firstName"] ?? row["first_name"] ?? "",
        lastName: row["lastName"] ?? row["last_name"] ?? "",
        email: row["email"] ?? undefined,
        subjects: row["subjects"]
          ? row["subjects"]
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : undefined,
        department: row["designation"] ?? row["department"] ?? undefined,
      }));
      await bulkImportTeachers.mutateAsync({ rows: importRows });
      toast.success("Teachers imported");
    } catch (err) {
      toast.error("Failed to import teachers", {
        description: err instanceof Error ? err.message : "Please try again",
      });
    }
  };

  const openAssignClass = (
    entityId: string,
    type: "teacher" | "student",
    currentClassIds: string[]
  ) => {
    setAssignEntity({ id: entityId, type, currentClassIds });
    setSelectedClassIds(currentClassIds);
    setAssignClassOpen(true);
  };

  const handleAssignClass = async () => {
    if (!tenantId || !assignEntity) return;
    try {
      if (assignEntity.type === "teacher") {
        const teacher = teachers?.find((t) => t.id === assignEntity.id);
        await saveTeacher.mutateAsync({
          id: assignEntity.id,
          data: {
            firstName: teacher?.firstName ?? "",
            lastName: teacher?.lastName ?? "",
            classIds: selectedClassIds,
          },
        });
      } else {
        const student = students?.find((s) => s.id === assignEntity.id);
        await saveStudent.mutateAsync({
          id: assignEntity.id,
          data: {
            firstName: student?.firstName ?? "",
            lastName: student?.lastName ?? "",
            classIds: selectedClassIds,
          },
        });
      }
      setAssignClassOpen(false);
      setAssignEntity(null);
      toast.success("Classes assigned");
    } catch (err) {
      toast.error("Failed to assign classes", {
        description: err instanceof Error ? err.message : "Please try again",
      });
    }
  };

  const openLinkParent = (studentId: string, currentParentIds: string[]) => {
    setLinkStudentId(studentId);
    setSelectedParentIds(currentParentIds);
    setLinkParentOpen(true);
  };

  const handleLinkParent = async () => {
    if (!tenantId || !linkStudentId) return;
    try {
      const student = students?.find((s) => s.id === linkStudentId);
      await saveStudent.mutateAsync({
        id: linkStudentId,
        data: {
          firstName: student?.firstName ?? "",
          lastName: student?.lastName ?? "",
          parentIds: selectedParentIds,
        },
      });
      setLinkParentOpen(false);
      setLinkStudentId(null);
      toast.success("Parent linked");
    } catch (err) {
      toast.error("Failed to link parent", {
        description: err instanceof Error ? err.message : "Please try again",
      });
    }
  };

  const openEditParent = (p: Parent) => {
    setEditParentId(p.id);
    setEditParentForm({
      firstName: p.firstName ?? "",
      lastName: p.lastName ?? "",
      phone: p.phone ?? "",
    });
    setEditParentOpen(true);
  };

  const handleEditParent = async () => {
    if (!tenantId || !editParentId) return;
    setSavingParent(true);
    try {
      await saveParent.mutateAsync({
        id: editParentId,
        data: {
          firstName: editParentForm.firstName,
          lastName: editParentForm.lastName,
          phone: editParentForm.phone || undefined,
        },
      });
      setEditParentOpen(false);
      setEditParentId(null);
      toast.success("Parent updated");
    } catch (err) {
      toast.error("Failed to update parent", {
        description: err instanceof Error ? err.message : "Please try again",
      });
    } finally {
      setSavingParent(false);
    }
  };

  const isLoading =
    activeTab === "teachers"
      ? teachersLoading
      : activeTab === "students"
        ? studentsLoading
        : parentsLoading;

  const openCreateForTab = () => {
    setCreateRole(
      activeTab === "teachers" ? "teacher" : activeTab === "students" ? "student" : "parent"
    );
    setCreateForm({
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      rollNumber: "",
      classId: "",
      subjects: "",
      designation: "",
    });
    setCreateOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-muted-foreground text-sm">Manage teachers, students, and parents</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {activeTab === "students" && (
            <Button variant="outline" onClick={() => setBulkImportOpen(true)}>
              <Upload className="mr-2 h-4 w-4" /> Bulk Import
            </Button>
          )}
          {activeTab === "teachers" && (
            <Button variant="outline" onClick={() => setBulkImportTeachersOpen(true)}>
              <Upload className="mr-2 h-4 w-4" /> Import Teachers
            </Button>
          )}
          <Button onClick={openCreateForTab}>
            <UserPlus className="mr-2 h-4 w-4" />
            Add{" "}
            {activeTab === "teachers" ? "Teacher" : activeTab === "students" ? "Student" : "Parent"}
          </Button>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          setActiveTab(v as UserTab);
          setSearchQuery("");
          setSelectedStudentIds(new Set());
          setSelectedTeacherIds(new Set());
        }}
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="teachers">Teachers ({teachers?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="students">Students ({students?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="parents">Parents ({parents?.length ?? 0})</TabsTrigger>
        </TabsList>

        <div className="relative mt-4">
          <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder={`Search ${activeTab}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <TabsContent value="teachers">
          <TeachersTab
            isLoading={isLoading}
            filteredTeachers={filteredTeachers}
            pagination={teacherPagination}
            onAssignClass={openAssignClass}
            selectedIds={selectedTeacherIds}
            onToggle={handleToggleTeacher}
            onToggleAll={handleToggleAllTeachers}
          />
        </TabsContent>

        <TabsContent value="students">
          <StudentsTab
            isLoading={studentsLoading}
            filteredStudents={filteredStudents}
            pagination={studentPagination}
            classes={classes}
            onAssignClass={openAssignClass}
            onLinkParent={openLinkParent}
            selectedIds={selectedStudentIds}
            onToggle={handleToggleStudent}
            onToggleAll={handleToggleAllStudents}
          />
        </TabsContent>

        <TabsContent value="parents">
          <ParentsTab
            isLoading={parentsLoading}
            filteredParents={filteredParents}
            pagination={parentPagination}
            students={students}
            onEditParent={openEditParent}
          />
        </TabsContent>
      </Tabs>

      {/* Floating Bulk Action Bar */}
      {(activeTab === "teachers" || activeTab === "students") && currentSelectedCount > 0 && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
          <div className="bg-background flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg">
            <span className="text-sm font-medium">{currentSelectedCount} selected</span>
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
              {bulkStatusAction === "archived" ? "Archive" : "Activate"} {currentSelectedCount}{" "}
              {activeTab === "teachers" ? "teacher" : "student"}(s)?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will {bulkStatusAction === "archived" ? "archive" : "activate"} the selected{" "}
              {activeTab === "teachers" ? "teachers" : "students"}.
              {bulkStatusAction === "archived"
                ? " Archived items will be hidden from active views."
                : " Activated items will appear in active views."}
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

      {/* Create User Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Add{" "}
              {createRole === "teacher"
                ? "Teacher"
                : createRole === "student"
                  ? "Student"
                  : "Parent"}
            </DialogTitle>
            <DialogDescription>Create a new user account and profile.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name</Label>
                <Input
                  value={createForm.firstName}
                  onChange={(e) => setCreateForm((p) => ({ ...p, firstName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Last Name</Label>
                <Input
                  value={createForm.lastName}
                  onChange={(e) => setCreateForm((p) => ({ ...p, lastName: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm((p) => ({ ...p, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                value={createForm.phone}
                onChange={(e) => setCreateForm((p) => ({ ...p, phone: e.target.value }))}
              />
            </div>
            {createRole === "student" && (
              <>
                <div className="space-y-2">
                  <Label>Roll Number</Label>
                  <Input
                    value={createForm.rollNumber}
                    onChange={(e) => setCreateForm((p) => ({ ...p, rollNumber: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Class</Label>
                  <Select
                    value={createForm.classId}
                    onValueChange={(v) => setCreateForm((p) => ({ ...p, classId: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes?.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            {createRole === "teacher" && (
              <div className="space-y-2">
                <Label>Subjects (comma-separated)</Label>
                <Input
                  placeholder="Math, Science, English"
                  value={createForm.subjects}
                  onChange={(e) => setCreateForm((p) => ({ ...p, subjects: e.target.value }))}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={creating || !createForm.firstName || !createForm.lastName}
            >
              {creating ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Class Dialog */}
      <Dialog open={assignClassOpen} onOpenChange={setAssignClassOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign to Classes</DialogTitle>
            <DialogDescription>Select classes for this {assignEntity?.type}.</DialogDescription>
          </DialogHeader>
          <EntityPicker
            items={classItems}
            selected={selectedClassIds}
            onChange={setSelectedClassIds}
            placeholder="Select classes..."
            searchPlaceholder="Search classes..."
            emptyText="No classes found."
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignClassOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAssignClass}
              disabled={saveTeacher.isPending || saveStudent.isPending}
            >
              {saveTeacher.isPending || saveStudent.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link Parent Dialog */}
      <Dialog open={linkParentOpen} onOpenChange={setLinkParentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link Parents</DialogTitle>
            <DialogDescription>Select parent(s) to link with this student.</DialogDescription>
          </DialogHeader>
          <EntityPicker
            items={parentItems}
            selected={selectedParentIds}
            onChange={setSelectedParentIds}
            placeholder="Select parents..."
            searchPlaceholder="Search parents..."
            emptyText="No parents found."
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkParentOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleLinkParent} disabled={saveStudent.isPending}>
              {saveStudent.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Parent Dialog */}
      <Dialog open={editParentOpen} onOpenChange={setEditParentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Parent</DialogTitle>
            <DialogDescription>Update parent information.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name</Label>
                <Input
                  value={editParentForm.firstName}
                  onChange={(e) => setEditParentForm((p) => ({ ...p, firstName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Last Name</Label>
                <Input
                  value={editParentForm.lastName}
                  onChange={(e) => setEditParentForm((p) => ({ ...p, lastName: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                value={editParentForm.phone}
                onChange={(e) => setEditParentForm((p) => ({ ...p, phone: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditParentOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditParent} disabled={savingParent}>
              {savingParent ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Import Students Dialog */}
      <BulkImportDialog
        open={bulkImportOpen}
        onOpenChange={setBulkImportOpen}
        title="Bulk Import Students"
        description="Upload a CSV file to import students. Required columns: firstName, lastName, rollNumber."
        requiredColumns={["firstName", "lastName", "rollNumber"]}
        optionalColumns={[
          "email",
          "phone",
          "classId",
          "className",
          "section",
          "parentFirstName",
          "parentLastName",
          "parentEmail",
          "parentPhone",
        ]}
        onSubmit={handleBulkImport}
        validateRow={(row, index) => {
          const errors = [];
          if (!row["firstName"]?.trim())
            errors.push({ rowIndex: index, field: "firstName", message: "firstName is required" });
          if (!row["lastName"]?.trim())
            errors.push({ rowIndex: index, field: "lastName", message: "lastName is required" });
          if (!row["rollNumber"]?.trim())
            errors.push({
              rowIndex: index,
              field: "rollNumber",
              message: "rollNumber is required",
            });
          return errors;
        }}
      />

      {/* Bulk Import Teachers Dialog */}
      <BulkImportDialog
        open={bulkImportTeachersOpen}
        onOpenChange={setBulkImportTeachersOpen}
        title="Bulk Import Teachers"
        description="Upload a CSV file to import teachers. Required columns: firstName, lastName, email."
        requiredColumns={["firstName", "lastName", "email"]}
        optionalColumns={["subjects", "designation"]}
        onSubmit={handleBulkImportTeachers}
        validateRow={(row, index) => {
          const errors = [];
          if (!row["firstName"]?.trim())
            errors.push({ rowIndex: index, field: "firstName", message: "firstName is required" });
          if (!row["lastName"]?.trim())
            errors.push({ rowIndex: index, field: "lastName", message: "lastName is required" });
          if (!row["email"]?.trim())
            errors.push({ rowIndex: index, field: "email", message: "email is required" });
          return errors;
        }}
      />
    </div>
  );
}
