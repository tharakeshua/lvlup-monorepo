import { useState } from "react";
import { useCurrentTenantId } from "@/sdk/identity";
import { useTeachers, useSaveTeacher, useApiError } from "@levelup/query";
import {
  Button,
  Input,
  Label,
  Switch,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Skeleton,
  Badge,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@levelup/shared-ui";
import { toast } from "sonner";
import { Shield, Search, UserCog } from "lucide-react";
import StaffTab from "../components/staff/StaffTab";
import { pageItems } from "@/lib/utils";

interface TeacherDoc {
  id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  subjects?: string[];
  classIds?: string[];
  status: string;
  authUid?: string;
  permissions?: Record<string, boolean>;
}

const TEACHER_PERMISSION_LABELS: Record<string, string> = {
  canCreateExams: "Create Exams",
  canEditRubrics: "Edit Rubrics",
  canManuallyGrade: "Manually Grade",
  canViewAllExams: "View All Exams",
  canCreateSpaces: "Create Spaces",
  canManageContent: "Manage Content",
  canViewAnalytics: "View Analytics",
  canConfigureAgents: "Configure AI Agents",
};

export default function StaffPage() {
  const tenantId = useCurrentTenantId();
  const { handleError } = useApiError();
  const { data: teachersData, isLoading } = useTeachers({});
  const teachers = pageItems<TeacherDoc>(teachersData);

  const [activeTab, setActiveTab] = useState<"teachers" | "staff">("teachers");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingTeacher, setEditingTeacher] = useState<TeacherDoc | null>(null);
  const [permissionForm, setPermissionForm] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const saveTeacher = useSaveTeacher();

  const filteredTeachers = teachers.filter((t) => {
    const name = t.name ?? `${t.firstName ?? ""} ${t.lastName ?? ""}`;
    return (
      name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.email?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
    );
  });

  const openPermissionEditor = (teacher: TeacherDoc) => {
    // NOTE: teacher permissions live on the membership and are not surfaced by
    // the @levelup/query teacher view — pre-fill with sensible defaults.
    const perms = teacher.permissions ?? {};
    setPermissionForm({
      canCreateExams: perms.canCreateExams ?? true,
      canEditRubrics: perms.canEditRubrics ?? true,
      canManuallyGrade: perms.canManuallyGrade ?? true,
      canViewAllExams: perms.canViewAllExams ?? false,
      canCreateSpaces: perms.canCreateSpaces ?? false,
      canManageContent: perms.canManageContent ?? false,
      canViewAnalytics: perms.canViewAnalytics ?? false,
      canConfigureAgents: perms.canConfigureAgents ?? false,
    });
    setEditingTeacher(teacher);
  };

  const handleSavePermissions = async () => {
    if (!tenantId || !editingTeacher) return;
    setSaving(true);
    try {
      await saveTeacher.mutateAsync({
        id: editingTeacher.id,
        data: {
          firstName: editingTeacher.firstName ?? "",
          lastName: editingTeacher.lastName ?? "",
          permissions: {
            permissions: permissionForm,
          },
        },
      });
      setEditingTeacher(null);
      toast.success("Permissions updated");
    } catch (err) {
      handleError(err, "Failed to update permissions");
    } finally {
      setSaving(false);
    }
  };

  const enabledPermCount = (teacher: TeacherDoc): number => {
    if (!teacher.permissions) return 0;
    return Object.entries(teacher.permissions).filter(([k, v]) => k.startsWith("can") && v === true)
      .length;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Staff & Permissions</h1>
        <p className="text-muted-foreground text-sm">Manage teacher permissions and staff roles</p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "teachers" | "staff")}>
        <TabsList className="grid w-full max-w-xs grid-cols-2">
          <TabsTrigger value="teachers">Teachers</TabsTrigger>
          <TabsTrigger value="staff">Staff</TabsTrigger>
        </TabsList>

        <TabsContent value="teachers" className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
              <Input
                className="pl-9"
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredTeachers.length === 0 ? (
            <div className="rounded-lg border border-dashed p-12 text-center">
              <UserCog className="text-muted-foreground mx-auto h-8 w-8" />
              <h3 className="mt-2 text-lg font-semibold">No teachers found</h3>
              <p className="text-muted-foreground mt-1 text-sm">
                Add teachers via the Users page to manage their permissions here
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTeachers.map((teacher) => {
                const name =
                  teacher.name ?? `${teacher.firstName ?? ""} ${teacher.lastName ?? ""}`.trim();
                const permCount = enabledPermCount(teacher);

                return (
                  <div
                    key={teacher.id}
                    className="bg-card flex items-center justify-between rounded-lg border p-4 transition-shadow hover:shadow-sm"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{name || "Unnamed"}</p>
                        <Badge variant={teacher.status === "active" ? "default" : "secondary"}>
                          {teacher.status}
                        </Badge>
                      </div>
                      <div className="text-muted-foreground mt-1 flex gap-4 text-sm">
                        {teacher.email && <span>{teacher.email}</span>}
                        {teacher.subjects && teacher.subjects.length > 0 && (
                          <span>{teacher.subjects.join(", ")}</span>
                        )}
                        <span>
                          {permCount}/{Object.keys(TEACHER_PERMISSION_LABELS).length} permissions
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openPermissionEditor(teacher)}
                    >
                      <Shield className="mr-1 h-4 w-4" />
                      Permissions
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Permission Editor Dialog */}
          <Dialog open={!!editingTeacher} onOpenChange={(open) => !open && setEditingTeacher(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  Edit Permissions —{" "}
                  {editingTeacher?.name ??
                    `${editingTeacher?.firstName ?? ""} ${editingTeacher?.lastName ?? ""}`.trim()}
                </DialogTitle>
                <DialogDescription>
                  Toggle individual permissions for this teacher
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {Object.entries(TEACHER_PERMISSION_LABELS).map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between">
                    <Label htmlFor={key}>{label}</Label>
                    <Switch
                      id={key}
                      checked={permissionForm[key] ?? false}
                      onCheckedChange={(checked) =>
                        setPermissionForm((p) => ({ ...p, [key]: checked }))
                      }
                    />
                  </div>
                ))}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingTeacher(null)}>
                  Cancel
                </Button>
                <Button onClick={handleSavePermissions} disabled={saving}>
                  {saving ? "Saving..." : "Save Permissions"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="staff" className="space-y-4">
          <StaffTab tenantId={tenantId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
