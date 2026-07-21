import { useState, useMemo } from "react";
import { useParents, useSaveParent, useStudents, useApiError } from "@levelup/query";
import type { Parent } from "@levelup/shared-types";
import {
  Button,
  Input,
  Label,
  Badge,
  Card,
  CardContent,
  Skeleton,
  sonnerToast,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbPage,
} from "@levelup/shared-ui";
import { Users, UserPlus, Mail, Phone, Pencil, Search } from "lucide-react";

// ── helpers ─────────────────────────────────────────────────────────────────

/** Normalize a query hook result (bare array | PageResponse | infinite query) → array. */
function asArray<T>(d: unknown): T[] {
  if (Array.isArray(d)) return d as T[];
  if (d && typeof d === "object") {
    const o = d as { items?: T[]; pages?: { items?: T[] }[] };
    if (Array.isArray(o.items)) return o.items;
    if (Array.isArray(o.pages)) return o.pages.flatMap((p) => p.items ?? []);
  }
  return [];
}

function fullName(p: { firstName?: string; lastName?: string; displayName?: string }): string {
  if (p.displayName) return p.displayName;
  return [p.firstName, p.lastName].filter(Boolean).join(" ") || "—";
}

// ── types ────────────────────────────────────────────────────────────────────

interface StudentRow {
  id: string;
  uid?: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
}

type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  studentIds: string[];
};

const EMPTY_FORM: FormState = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  studentIds: [],
};

// ── component ─────────────────────────────────────────────────────────────────

export default function ParentsPage() {
  const {
    data: parentsData,
    isLoading: parentsLoading,
    isError: parentsError,
    error: parentsErr,
    refetch,
  } = useParents();

  const { data: studentsData } = useStudents();

  const saveParent = useSaveParent();
  const { handleError } = useApiError();

  const parents = useMemo(() => asArray<Parent>(parentsData), [parentsData]);
  const students = useMemo(() => asArray<StudentRow>(studentsData), [studentsData]);

  // build a lookup map: studentId → display name
  const studentMap = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const s of students) {
      map[s.id] = fullName(s);
    }
    return map;
  }, [students]);

  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [studentSearch, setStudentSearch] = useState("");

  const filtered = useMemo(
    () =>
      parents.filter((p) => {
        const q = search.toLowerCase();
        return (
          fullName(p).toLowerCase().includes(q) ||
          (p.email ?? "").toLowerCase().includes(q) ||
          (p.phone ?? "").includes(q)
        );
      }),
    [parents, search]
  );

  const filteredStudents = useMemo(
    () =>
      students.filter((s) =>
        fullName(s).toLowerCase().includes(studentSearch.toLowerCase())
      ),
    [students, studentSearch]
  );

  // ── sheet handlers ──────────────────────────────────────────────────────────

  const handleOpenCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setStudentSearch("");
    setSheetOpen(true);
  };

  const handleOpenEdit = (parent: Parent) => {
    setEditingId(parent.id);
    setForm({
      firstName: parent.firstName,
      lastName: parent.lastName,
      email: parent.email ?? "",
      phone: parent.phone ?? "",
      studentIds: [...(parent.studentIds ?? [])],
    });
    setStudentSearch("");
    setSheetOpen(true);
  };

  const toggleStudent = (studentId: string) => {
    setForm((prev) => ({
      ...prev,
      studentIds: prev.studentIds.includes(studentId)
        ? prev.studentIds.filter((id) => id !== studentId)
        : [...prev.studentIds, studentId],
    }));
  };

  const handleSave = async () => {
    if (!form.firstName.trim() || !form.lastName.trim()) return;

    try {
      await saveParent.mutateAsync({
        id: editingId ?? undefined,
        data: {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim() || undefined,
          phone: form.phone.trim() || undefined,
          studentIds: form.studentIds,
        },
      });
      sonnerToast.success(editingId ? "Parent updated" : "Parent created");
      setSheetOpen(false);
    } catch (err) {
      handleError(err, "Failed to save parent");
    }
  };

  // ── loading state ───────────────────────────────────────────────────────────

  if (parentsLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  // ── error state ─────────────────────────────────────────────────────────────

  if (parentsError) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
        <Users className="text-muted-foreground h-8 w-8" />
        <p className="font-display mt-3 text-lg">Failed to load parents</p>
        <p className="text-muted-foreground mt-1 max-w-md text-center text-sm">
          {(parentsErr as { message?: string } | null)?.message ??
            "Could not load parent records. Please retry."}
        </p>
        <Button onClick={() => void refetch()} size="sm" variant="outline" className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  // ── main render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>Parents</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold">Parents</h1>
          <p className="text-muted-foreground text-sm">
            Manage parent accounts and their linked children
          </p>
        </div>
        <Button onClick={handleOpenCreate} size="sm" className="gap-1.5">
          <UserPlus className="h-3.5 w-3.5" />
          New Parent
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="text-muted-foreground absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email or phone…"
          className="pl-9"
        />
      </div>

      {/* Empty state */}
      {!filtered.length ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
          <Users className="text-muted-foreground h-8 w-8" />
          <p className="text-muted-foreground mt-2 text-sm">
            {search ? "No parents match your search." : "No parents yet. Add one to get started."}
          </p>
          {!search && (
            <Button onClick={handleOpenCreate} size="sm" variant="outline" className="mt-4 gap-1.5">
              <UserPlus className="h-3.5 w-3.5" />
              New Parent
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((parent) => {
            const linkedNames = (parent.studentIds ?? [])
              .map((id) => studentMap[id])
              .filter(Boolean);
            const displayCount = 3;
            const shown = linkedNames.slice(0, displayCount);
            const overflow = linkedNames.length - displayCount;

            return (
              <Card key={parent.id} className="shadow-e1">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    {/* Avatar + name */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="bg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-medium">
                        {(parent.firstName?.[0] ?? "").toUpperCase() ||
                          (parent.displayName?.[0] ?? "P").toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{fullName(parent)}</p>
                        <div className="text-muted-foreground mt-0.5 flex flex-col gap-0.5 text-xs">
                          {parent.email && (
                            <span className="flex items-center gap-1 truncate">
                              <Mail className="h-3 w-3 shrink-0" />
                              {parent.email}
                            </span>
                          )}
                          {parent.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3 shrink-0" />
                              {parent.phone}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Edit button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 shrink-0 text-xs"
                      onClick={() => handleOpenEdit(parent)}
                    >
                      <Pencil className="h-3 w-3" />
                      Edit
                    </Button>
                  </div>

                  {/* Linked children chips */}
                  {linkedNames.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {shown.map((name, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {name}
                        </Badge>
                      ))}
                      {overflow > 0 && (
                        <Badge variant="outline" className="text-xs">
                          +{overflow} more
                        </Badge>
                      )}
                    </div>
                  ) : (
                    <p className="text-muted-foreground mt-3 text-xs">No children linked</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create / Edit Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="font-display">
              {editingId ? "Edit Parent" : "New Parent"}
            </SheetTitle>
          </SheetHeader>

          <div className="mt-4 space-y-4">
            {/* Name row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>First name</Label>
                <Input
                  value={form.firstName}
                  onChange={(e) => setForm((prev) => ({ ...prev, firstName: e.target.value }))}
                  placeholder="e.g., Priya"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Last name</Label>
                <Input
                  value={form.lastName}
                  onChange={(e) => setForm((prev) => ({ ...prev, lastName: e.target.value }))}
                  placeholder="e.g., Sharma"
                  className="mt-1"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <Label>Email</Label>
              <div className="relative mt-1">
                <Mail className="text-muted-foreground absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2" />
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="parent@example.com"
                  className="pl-9"
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <Label>Phone</Label>
              <div className="relative mt-1">
                <Phone className="text-muted-foreground absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2" />
                <Input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="+91 98765 43210"
                  className="pl-9"
                />
              </div>
            </div>

            {/* Linked children */}
            <div>
              <Label>Linked children</Label>
              <p className="text-muted-foreground mb-1.5 mt-0.5 text-xs">
                Select students to link to this parent
              </p>

              {/* selected chips */}
              {form.studentIds.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {form.studentIds.map((id) => (
                    <Badge
                      key={id}
                      variant="secondary"
                      className="cursor-pointer gap-1 text-xs"
                      onClick={() => toggleStudent(id)}
                    >
                      {studentMap[id] ?? id}
                      <span className="text-muted-foreground text-[10px]">×</span>
                    </Badge>
                  ))}
                </div>
              )}

              {/* search within students */}
              <div className="relative">
                <Search className="text-muted-foreground absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2" />
                <Input
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="Search students…"
                  className="h-8 pl-8 text-sm"
                />
              </div>

              {/* student list */}
              <div className="border-subtle mt-1 max-h-48 overflow-y-auto rounded-md border">
                {filteredStudents.length === 0 ? (
                  <p className="text-muted-foreground px-3 py-4 text-center text-xs">
                    {studentSearch ? "No students match your search." : "No students available."}
                  </p>
                ) : (
                  filteredStudents.map((student) => {
                    const selected = form.studentIds.includes(student.id);
                    return (
                      <button
                        key={student.id}
                        type="button"
                        onClick={() => toggleStudent(student.id)}
                        className={`hover:bg-muted flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                          selected ? "bg-muted/60 font-medium" : ""
                        }`}
                      >
                        <span
                          className={`border-primary flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${
                            selected ? "bg-primary text-primary-foreground" : ""
                          }`}
                        >
                          {selected ? "✓" : ""}
                        </span>
                        {fullName(student)}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 border-t pt-4">
              <Button
                onClick={() => void handleSave()}
                disabled={
                  saveParent.isPending || !form.firstName.trim() || !form.lastName.trim()
                }
              >
                {saveParent.isPending ? "Saving…" : editingId ? "Update" : "Create"}
              </Button>
              <Button variant="outline" onClick={() => setSheetOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
