import { useState, useMemo } from "react";
import { useAnnouncements, useSaveAnnouncement } from "@levelup/query";
import type { Announcement as DomainAnnouncement } from "@levelup/domain";
import {
  Button,
  Input,
  Label,
  Textarea,
  Badge,
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  PageHeader,
  Skeleton,
  DataTablePagination,
} from "@levelup/shared-ui";
import { Plus, Megaphone, Archive, Send, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { usePagination } from "../hooks/usePagination";

type AnnouncementStatus = "draft" | "published" | "archived";
type StatusTab = "all" | AnnouncementStatus;

type Announcement = DomainAnnouncement;

interface AnnouncementFormData {
  title: string;
  body: string;
  expiresAt: string;
}

const emptyForm: AnnouncementFormData = {
  title: "",
  body: "",
  expiresAt: "",
};

function formatTimestamp(ts: unknown): string {
  if (!ts) return "--";
  // Domain timestamps are ISO-8601 strings at rest (zTimestamp).
  if (typeof ts === "string") {
    const d = new Date(ts);
    return Number.isNaN(d.getTime()) ? "--" : d.toLocaleDateString();
  }
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
  const saveAnnouncement = useSaveAnnouncement();
  const [statusFilter, setStatusFilter] = useState<StatusTab>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<AnnouncementFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data, isLoading } = useAnnouncements({
    scope: "platform",
    status: statusFilter === "all" ? undefined : statusFilter,
  });

  const announcements = useMemo(
    () => (data as { items?: Announcement[] } | undefined)?.items ?? [],
    [data]
  );

  const { paginatedItems, currentPage, pageSize, totalItems, setCurrentPage, setPageSize } =
    usePagination(announcements, 20);

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
      expiresAt: a.expiresAt ? new Date(a.expiresAt as string).toISOString().split("T")[0] : "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
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
              expiresAt: formData.expiresAt || undefined,
            },
          }
        : {
            data: {
              title: formData.title.trim(),
              body: formData.body.trim(),
              scope: "platform" as const,
              status: "draft" as const,
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
    try {
      await saveAnnouncement.mutateAsync({ id, data: { status: newStatus } });
      toast.success(newStatus === "published" ? "Announcement published" : "Announcement archived");
    } catch (err) {
      toast.error("Failed to update status", {
        description: err instanceof Error ? err.message : "Please try again",
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await saveAnnouncement.mutateAsync({ id: deleteTarget.id, delete: true });
      setDeleteTarget(null);
      toast.success("Announcement deleted");
    } catch (err) {
      toast.error("Failed to delete announcement", {
        description: err instanceof Error ? err.message : "Please try again",
      });
    } finally {
      setDeleting(false);
    }
  };

  const statusTabs: StatusTab[] = ["all", "draft", "published", "archived"];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Announcements"
        description="Manage platform-wide announcements"
        actions={
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            New Announcement
          </Button>
        }
      />

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
                    <TableHead>Author</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead className="w-[200px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
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
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-20" />
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
                          <span className="text-sm">{a.authorName}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm tabular-nums">
                            {formatTimestamp(a.createdAt)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm tabular-nums">
                            {formatTimestamp(a.expiresAt)}
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
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive h-7 px-2"
                              onClick={() => setDeleteTarget(a)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Announcement" : "New Announcement"}</DialogTitle>
            <DialogDescription>
              {editingId
                ? "Update the announcement details."
                : "Create a new platform-wide announcement. It will be saved as a draft."}
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

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Announcement</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.title}&quot;? This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
