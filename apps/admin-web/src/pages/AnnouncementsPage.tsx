import { useState, useMemo } from "react";
import { useCurrentTenantId } from "@/sdk/identity";
import { useClasses, useAnnouncements, useSaveAnnouncement } from "@levelup/query";
import type { Class } from "@levelup/shared-types";
import { pageItems } from "@/lib/utils";
import {
  Button,
  Input,
  Label,
  Textarea,
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  PageHeader,
  Skeleton,
  Checkbox,
  DataTablePagination,
} from "@levelup/shared-ui";
import { Plus, Megaphone, Archive, Send, Pencil, Info } from "lucide-react";
import { toast } from "sonner";
import { usePagination } from "../hooks/usePagination";

type AnnouncementStatus = "draft" | "published" | "archived";
type StatusTab = "all" | AnnouncementStatus;

interface Announcement {
  id: string;
  title: string;
  body: string;
  scope: string;
  status: AnnouncementStatus;
  authorName: string;
  publishedAt?: string | null;
  expiresAt?: string | null;
  createdAt?: unknown;
  targetRoles?: string[];
  targetClassIds?: string[];
}

const AVAILABLE_ROLES = ["teacher", "student", "parent"] as const;

interface AnnouncementFormData {
  title: string;
  body: string;
  expiresAt: string;
  targetRoles: string[];
  targetClassIds: string[];
}

const emptyForm: AnnouncementFormData = {
  title: "",
  body: "",
  expiresAt: "",
  targetRoles: [],
  targetClassIds: [],
};

function formatTimestamp(ts: unknown): string {
  if (!ts) return "--";
  if (typeof ts === "string") return new Date(ts).toLocaleDateString();
  const record = ts as { seconds?: number };
  if (typeof record.seconds === "number") {
    return new Date(record.seconds * 1000).toLocaleDateString();
  }
  return "--";
}

function statusBadgeVariant(status: AnnouncementStatus) {
  switch (status) {
    case "draft":
      return "secondary" as const;
    case "published":
      return "default" as const;
    case "archived":
      return "outline" as const;
  }
}

export default function AnnouncementsPage() {
  const tenantId = useCurrentTenantId();
  const { data: classesData } = useClasses({});
  const classes = pageItems<Class>(classesData);
  const saveAnnouncement = useSaveAnnouncement();
  const [statusFilter, setStatusFilter] = useState<StatusTab>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<AnnouncementFormData>(emptyForm);
  const [saving, setSaving] = useState(false);

  // Platform announcements (read-only)
  const { data: platformData, isLoading: platformLoading } = useAnnouncements({
    scope: "platform",
    status: "published",
  });

  // Tenant announcements
  const { data: tenantData, isLoading: tenantLoading } = useAnnouncements({
    scope: "tenant",
    status: statusFilter === "all" ? undefined : statusFilter,
  });

  const platformAnnouncements = useMemo(
    () => (platformData as { items?: Announcement[] } | undefined)?.items ?? [],
    [platformData]
  );

  const tenantAnnouncements = useMemo(
    () => (tenantData as { items?: Announcement[] } | undefined)?.items ?? [],
    [tenantData]
  );

  const { paginatedItems, currentPage, pageSize, totalItems, setCurrentPage, setPageSize } =
    usePagination(tenantAnnouncements, 20);

  const openCreate = () => {
    setEditingId(null);
    setFormData(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (a: Announcement) => {
    setEditingId(a.id);
    setFormData({
      title: a.title,
      body: a.body,
      expiresAt:
        typeof a.expiresAt === "string" ? new Date(a.expiresAt).toISOString().split("T")[0] : "",
      targetRoles: a.targetRoles ?? [],
      targetClassIds: a.targetClassIds ?? [],
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!tenantId) return;
    if (!formData.title.trim() || !formData.body.trim()) {
      toast.error("Title and body are required");
      return;
    }
    setSaving(true);
    try {
      const request = editingId
        ? {
            id: editingId,
            data: {
              title: formData.title.trim(),
              body: formData.body.trim(),
              targetRoles: formData.targetRoles.length ? formData.targetRoles : undefined,
              targetClassIds: formData.targetClassIds.length ? formData.targetClassIds : undefined,
              expiresAt: formData.expiresAt || undefined,
            },
          }
        : {
            data: {
              title: formData.title.trim(),
              body: formData.body.trim(),
              scope: "tenant",
              status: "draft",
              targetRoles: formData.targetRoles.length ? formData.targetRoles : undefined,
              targetClassIds: formData.targetClassIds.length ? formData.targetClassIds : undefined,
              expiresAt: formData.expiresAt || undefined,
            },
          };
      await saveAnnouncement.mutateAsync(request);
      setDialogOpen(false);
      setEditingId(null);
      setFormData(emptyForm);
      toast.success(editingId ? "Announcement updated" : "Announcement created");
    } catch (err) {
      toast.error("Failed to save announcement", {
        description: err instanceof Error ? err.message : "Please try again",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: AnnouncementStatus) => {
    if (!tenantId) return;
    try {
      await saveAnnouncement.mutateAsync({ id, data: { status: newStatus } });
      toast.success(newStatus === "published" ? "Announcement published" : "Announcement archived");
    } catch (err) {
      toast.error("Failed to update status", {
        description: err instanceof Error ? err.message : "Please try again",
      });
    }
  };

  const toggleRole = (role: string) => {
    setFormData((prev) => ({
      ...prev,
      targetRoles: prev.targetRoles.includes(role)
        ? prev.targetRoles.filter((r) => r !== role)
        : [...prev.targetRoles, role],
    }));
  };

  const toggleClassId = (classId: string) => {
    setFormData((prev) => ({
      ...prev,
      targetClassIds: prev.targetClassIds.includes(classId)
        ? prev.targetClassIds.filter((c) => c !== classId)
        : [...prev.targetClassIds, classId],
    }));
  };

  const statusTabs: StatusTab[] = ["all", "draft", "published", "archived"];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Announcements"
        description="Manage announcements for your organization"
        actions={
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            New Announcement
          </Button>
        }
      />

      {/* Platform Notices */}
      {(platformLoading || platformAnnouncements.length > 0) && (
        <div className="space-y-3">
          <div className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
            <Info className="h-4 w-4" />
            Platform Notices
          </div>
          {platformLoading ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <Card key={i}>
                  <CardHeader className="pb-2">
                    <Skeleton className="h-5 w-40" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="mt-1 h-4 w-3/4" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {platformAnnouncements.map((a) => (
                <Card
                  key={a.id}
                  className="border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/30"
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">{a.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground line-clamp-3 whitespace-pre-line text-sm">
                      {a.body}
                    </p>
                    <p className="text-muted-foreground mt-2 text-xs">
                      {formatTimestamp(a.createdAt)} &middot; {a.authorName}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tenant Announcements */}
      <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusTab)}>
        <TabsList>
          {statusTabs.map((tab) => (
            <TabsTrigger key={tab} value={tab} className="capitalize">
              {tab}
            </TabsTrigger>
          ))}
        </TabsList>

        {statusTabs.map((tab) => (
          <TabsContent key={tab} value={tab}>
            <div className="bg-card rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Author</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-[180px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenantLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Skeleton className="h-5 w-48" />
                          <Skeleton className="mt-1.5 h-3 w-64" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-5 w-16 rounded-full" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-20" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-20" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-8 w-32" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : !paginatedItems.length ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-48">
                        <div className="flex flex-col items-center justify-center text-center">
                          <div className="bg-muted flex h-12 w-12 items-center justify-center rounded-full">
                            <Megaphone className="text-muted-foreground h-6 w-6" />
                          </div>
                          <h3 className="mt-3 text-sm font-semibold">No announcements found</h3>
                          <p className="text-muted-foreground mt-1 max-w-sm text-xs">
                            {statusFilter !== "all"
                              ? "No announcements match this status filter."
                              : "Create your first announcement to get started."}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedItems.map((a) => (
                      <TableRow key={a.id} className="group">
                        <TableCell>
                          <div>
                            <p className="font-medium">{a.title}</p>
                            <p className="text-muted-foreground line-clamp-1 text-xs">{a.body}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusBadgeVariant(a.status)}>{a.status}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {a.targetRoles?.length ? (
                              a.targetRoles.map((r) => (
                                <Badge key={r} variant="outline" className="text-xs capitalize">
                                  {r}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-muted-foreground text-xs">Everyone</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{a.authorName}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm tabular-nums">
                            {formatTimestamp(a.createdAt)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {a.status === "draft" && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2"
                                  onClick={() => openEdit(a)}
                                >
                                  <Pencil className="mr-1 h-3 w-3" />
                                  Edit
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-green-600 hover:text-green-700"
                                  onClick={() => handleStatusChange(a.id, "published")}
                                >
                                  <Send className="mr-1 h-3 w-3" />
                                  Publish
                                </Button>
                              </>
                            )}
                            {a.status === "published" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-amber-600 hover:text-amber-700"
                                onClick={() => handleStatusChange(a.id, "archived")}
                              >
                                <Archive className="mr-1 h-3 w-3" />
                                Archive
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <DataTablePagination
                totalItems={totalItems}
                pageSize={pageSize}
                currentPage={currentPage}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
              />
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* Create / Edit Dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(o) => {
          if (!o) {
            setDialogOpen(false);
            setEditingId(null);
            setFormData(emptyForm);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Announcement" : "New Announcement"}</DialogTitle>
            <DialogDescription>
              {editingId
                ? "Update the announcement details."
                : "Create a new announcement for your organization. It will be saved as a draft."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="ann-title">Title *</Label>
              <Input
                id="ann-title"
                placeholder="Announcement title"
                value={formData.title}
                onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ann-body">Body *</Label>
              <Textarea
                id="ann-body"
                placeholder="Write the announcement body..."
                value={formData.body}
                onChange={(e) => setFormData((p) => ({ ...p, body: e.target.value }))}
                rows={5}
                maxLength={5000}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ann-expires">Expiry Date (optional)</Label>
              <Input
                id="ann-expires"
                type="date"
                value={formData.expiresAt}
                onChange={(e) => setFormData((p) => ({ ...p, expiresAt: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Target Roles (optional)</Label>
              <p className="text-muted-foreground text-xs">Leave unchecked to send to everyone.</p>
              <div className="flex flex-wrap gap-4 pt-1">
                {AVAILABLE_ROLES.map((role) => (
                  <label
                    key={role}
                    className="flex cursor-pointer items-center gap-2 text-sm capitalize"
                  >
                    <Checkbox
                      checked={formData.targetRoles.includes(role)}
                      onCheckedChange={() => toggleRole(role)}
                    />
                    {role}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Target Classes (optional)</Label>
              <p className="text-muted-foreground text-xs">
                Leave unchecked to send to all classes.
              </p>
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
                {classes?.length ? (
                  classes.map((c) => (
                    <label
                      key={c.id}
                      className="hover:bg-muted flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm"
                    >
                      <Checkbox
                        checked={formData.targetClassIds.includes(c.id)}
                        onCheckedChange={() => toggleClassId(c.id)}
                      />
                      {c.name}
                      {c.grade && (
                        <span className="text-muted-foreground text-xs">
                          Grade {c.grade}
                          {c.section ? ` - ${c.section}` : ""}
                        </span>
                      )}
                    </label>
                  ))
                ) : (
                  <p className="text-muted-foreground py-2 text-center text-xs">
                    No classes available
                  </p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                setEditingId(null);
                setFormData(emptyForm);
              }}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !formData.title.trim() || !formData.body.trim()}
            >
              {saving ? "Saving..." : editingId ? "Update" : "Create Draft"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
