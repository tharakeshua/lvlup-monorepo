import { useState } from "react";
import { useStaff, useSaveStaff, useApiError } from "@levelup/query";
import {
  Button,
  Input,
  Label,
  Switch,
  Badge,
  Skeleton,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@levelup/shared-ui";
import { toast } from "sonner";
import { Search, UserCog, Plus, Shield } from "lucide-react";
import CreateStaffDialog from "./CreateStaffDialog";

interface StaffDoc {
  id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  department?: string;
  status: string;
  authUid?: string;
  staffPermissions?: Record<string, boolean>;
}

const STAFF_PERMISSION_LABELS: Record<string, string> = {
  canManageUsers: "Manage Users",
  canManageClasses: "Manage Classes",
  canViewAnalytics: "View Analytics",
  canExportData: "Export Data",
  canManageSettings: "Manage Settings",
  canManageBilling: "Manage Billing",
};

interface StaffTabProps {
  tenantId: string | null;
}

export default function StaffTab({ tenantId }: StaffTabProps) {
  const { handleError } = useApiError();
  const { data: staffData, isLoading } = useStaff({});
  const staffList = (staffData as { items?: StaffDoc[] } | undefined)?.items ?? [];
  const saveStaff = useSaveStaff();

  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffDoc | null>(null);
  const [permissionForm, setPermissionForm] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  const filteredStaff = staffList.filter((s) => {
    const name = s.name ?? `${s.firstName ?? ""} ${s.lastName ?? ""}`;
    return (
      name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.email?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
    );
  });

  const openPermissionEditor = (staff: StaffDoc) => {
    // NOTE: staff permissions live on the membership and are not surfaced by the
    // @levelup/query staff view — pre-fill with the saved values if present.
    const perms = staff.staffPermissions ?? {};
    setPermissionForm({
      canManageUsers: perms.canManageUsers ?? false,
      canManageClasses: perms.canManageClasses ?? false,
      canViewAnalytics: perms.canViewAnalytics ?? false,
      canExportData: perms.canExportData ?? false,
      canManageSettings: perms.canManageSettings ?? false,
      canManageBilling: perms.canManageBilling ?? false,
    });
    setEditingStaff(staff);
  };

  const handleSavePermissions = async () => {
    if (!tenantId || !editingStaff) return;
    setSaving(true);
    try {
      await saveStaff.mutateAsync({
        id: editingStaff.id,
        data: {
          firstName: editingStaff.firstName ?? "",
          lastName: editingStaff.lastName ?? "",
          staffPermissions: permissionForm,
        },
      });
      setEditingStaff(null);
      toast.success("Staff permissions updated");
    } catch (err) {
      handleError(err, "Failed to update permissions");
    } finally {
      setSaving(false);
    }
  };

  const enabledPermCount = (staff: StaffDoc): number => {
    if (!staff.staffPermissions) return 0;
    return Object.entries(staff.staffPermissions).filter(
      ([k, v]) => k.startsWith("can") && v === true
    ).length;
  };

  const handleCreated = () => {
    // @levelup/query mutations invalidate the staff list automatically.
  };

  return (
    <>
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            className="pl-9"
            placeholder="Search staff by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-1 h-4 w-4" />
          Add Staff
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : filteredStaff.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <UserCog className="text-muted-foreground mx-auto h-8 w-8" />
          <h3 className="mt-2 text-lg font-semibold">No staff members</h3>
          <p className="text-muted-foreground mt-1 text-sm">
            Add administrative staff members to help manage your school
          </p>
          <Button className="mt-4" onClick={() => setShowCreateDialog(true)}>
            <Plus className="mr-1 h-4 w-4" />
            Add Staff
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredStaff.map((staff) => {
            const name = staff.name ?? `${staff.firstName ?? ""} ${staff.lastName ?? ""}`.trim();
            const permCount = enabledPermCount(staff);

            return (
              <div
                key={staff.id}
                className="bg-card flex items-center justify-between rounded-lg border p-4 transition-shadow hover:shadow-sm"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{name || "Unnamed"}</p>
                    <Badge variant={staff.status === "active" ? "default" : "secondary"}>
                      {staff.status}
                    </Badge>
                  </div>
                  <div className="text-muted-foreground mt-1 flex gap-4 text-sm">
                    {staff.email && <span>{staff.email}</span>}
                    {staff.department && <span>{staff.department}</span>}
                    <span>
                      {permCount}/{Object.keys(STAFF_PERMISSION_LABELS).length} permissions
                    </span>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => openPermissionEditor(staff)}>
                  <Shield className="mr-1 h-4 w-4" />
                  Permissions
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Permission Editor Dialog */}
      <Dialog open={!!editingStaff} onOpenChange={(open) => !open && setEditingStaff(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Edit Permissions —{" "}
              {editingStaff?.name ??
                `${editingStaff?.firstName ?? ""} ${editingStaff?.lastName ?? ""}`.trim()}
            </DialogTitle>
            <DialogDescription>
              Toggle individual permissions for this staff member
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {Object.entries(STAFF_PERMISSION_LABELS).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between">
                <Label htmlFor={`staff-${key}`}>{label}</Label>
                <Switch
                  id={`staff-${key}`}
                  checked={permissionForm[key] ?? false}
                  onCheckedChange={(checked) =>
                    setPermissionForm((p) => ({ ...p, [key]: checked }))
                  }
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingStaff(null)}>
              Cancel
            </Button>
            <Button onClick={handleSavePermissions} disabled={saving}>
              {saving ? "Saving..." : "Save Permissions"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {tenantId && (
        <CreateStaffDialog
          tenantId={tenantId}
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onCreated={handleCreated}
        />
      )}
    </>
  );
}
