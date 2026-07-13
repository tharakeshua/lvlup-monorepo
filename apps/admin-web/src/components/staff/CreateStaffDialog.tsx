import { useState } from "react";
import { useCreateOrgUser, useApiError } from "@levelup/query";
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
} from "@levelup/shared-ui";
import { toast } from "sonner";

const STAFF_PERMISSION_LABELS: Record<string, string> = {
  canManageUsers: "Manage Users",
  canManageClasses: "Manage Classes",
  canViewAnalytics: "View Analytics",
  canExportData: "Export Data",
  canManageSettings: "Manage Settings",
  canManageBilling: "Manage Billing",
};

interface CreateStaffDialogProps {
  tenantId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export default function CreateStaffDialog({
  tenantId: _tenantId,
  open,
  onOpenChange,
  onCreated,
}: CreateStaffDialogProps) {
  const { handleError } = useApiError();
  const createOrgUser = useCreateOrgUser();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });
  const [permissions, setPermissions] = useState<Record<string, boolean>>({
    canManageUsers: false,
    canManageClasses: false,
    canViewAnalytics: false,
    canExportData: false,
    canManageSettings: false,
    canManageBilling: false,
  });

  const resetForm = () => {
    setForm({ firstName: "", lastName: "", email: "", phone: "" });
    setPermissions({
      canManageUsers: false,
      canManageClasses: false,
      canViewAnalytics: false,
      canExportData: false,
      canManageSettings: false,
      canManageBilling: false,
    });
  };

  const handleCreate = async () => {
    if (!form.firstName || !form.lastName || !form.email) {
      toast.error("First name, last name, and email are required");
      return;
    }

    setSaving(true);
    try {
      await createOrgUser.mutateAsync({
        role: "staff",
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone || undefined,
      });
      toast.success(`Staff member ${form.firstName} ${form.lastName} created`);
      resetForm();
      onOpenChange(false);
      onCreated();
    } catch (err) {
      handleError(err, "Failed to create staff member");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) resetForm();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Staff Member</DialogTitle>
          <DialogDescription>
            Create a new administrative staff member for your school
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name *</Label>
              <Input
                id="firstName"
                value={form.firstName}
                onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))}
                placeholder="John"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name *</Label>
              <Input
                id="lastName"
                value={form.lastName}
                onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))}
                placeholder="Doe"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              placeholder="john@school.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              type="tel"
              value={form.phone}
              onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              placeholder="+91 98765 43210"
            />
          </div>
          <div className="space-y-3">
            <Label className="text-sm font-medium">Permissions</Label>
            {Object.entries(STAFF_PERMISSION_LABELS).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between">
                <Label htmlFor={`perm-${key}`} className="text-sm font-normal">
                  {label}
                </Label>
                <Switch
                  id={`perm-${key}`}
                  checked={permissions[key] ?? false}
                  onCheckedChange={(checked) => setPermissions((p) => ({ ...p, [key]: checked }))}
                />
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              resetForm();
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={saving}>
            {saving ? "Creating..." : "Create Staff"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
