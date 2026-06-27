import { useState } from "react";
import { useCurrentTenantId } from "@/sdk/identity";
import { useAcademicSessions, useSaveAcademicSession } from "@levelup/query";
import type { AcademicSession } from "@levelup/shared-types";
import {
  Button,
  Input,
  Label,
  Badge,
  Switch,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@levelup/shared-ui";
import { Plus, Pencil, Calendar, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { TableSkeleton } from "../components/skeletons/TableSkeleton";
import { SessionRolloverDialog } from "../components/sessions/SessionRolloverDialog";

function formatDate(timestamp: unknown): string {
  if (!timestamp) return "—";
  const ts = timestamp as { seconds?: number; toDate?: () => Date };
  if (ts.toDate) return ts.toDate().toLocaleDateString();
  if (ts.seconds) return new Date(ts.seconds * 1000).toLocaleDateString();
  return String(timestamp);
}

/** Convert a timestamp-like value (ISO string at rest, or Firestore Timestamp) to a YYYY-MM-DD string. */
function toISODate(timestamp: unknown): string {
  if (!timestamp) return "";
  if (typeof timestamp === "string") return timestamp.split("T")[0];
  const ts = timestamp as { seconds?: number; toDate?: () => Date };
  if (ts.toDate) return ts.toDate().toISOString().split("T")[0];
  if (ts.seconds) return new Date(ts.seconds * 1000).toISOString().split("T")[0];
  return "";
}

export default function AcademicSessionPage() {
  const tenantId = useCurrentTenantId();
  const { data, isLoading } = useAcademicSessions({});
  const sessions = (data as { items?: AcademicSession[] } | undefined)?.items;
  const saveSession = useSaveAcademicSession();

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [rolloverOpen, setRolloverOpen] = useState(false);
  const [rolloverSession, setRolloverSession] = useState<AcademicSession | null>(null);
  const [selectedSession, setSelectedSession] = useState<AcademicSession | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    startDate: "",
    endDate: "",
    isCurrent: false,
  });

  const currentSession = sessions?.find((s) => s.isCurrent);

  const handleCreate = async () => {
    if (!tenantId || !formData.name || !formData.startDate || !formData.endDate) return;
    if (new Date(formData.endDate) <= new Date(formData.startDate)) {
      toast.error("End date must be after start date");
      return;
    }
    try {
      await saveSession.mutateAsync({
        data: {
          name: formData.name,
          startDate: formData.startDate,
          endDate: formData.endDate,
          isCurrent: formData.isCurrent,
        },
      });
      setCreateOpen(false);
      setFormData({ name: "", startDate: "", endDate: "", isCurrent: false });
      toast.success("Session created");
    } catch (err) {
      toast.error("Failed to create session", {
        description: err instanceof Error ? err.message : "Please try again",
      });
    }
  };

  const handleEdit = async () => {
    if (!tenantId || !selectedSession) return;
    if (
      formData.startDate &&
      formData.endDate &&
      new Date(formData.endDate) <= new Date(formData.startDate)
    ) {
      toast.error("End date must be after start date");
      return;
    }
    try {
      await saveSession.mutateAsync({
        id: selectedSession.id,
        data: {
          name: formData.name || selectedSession.name,
          startDate: formData.startDate || toISODate(selectedSession.startDate),
          endDate: formData.endDate || toISODate(selectedSession.endDate),
          isCurrent: formData.isCurrent,
        },
      });
      setEditOpen(false);
      setSelectedSession(null);
      toast.success("Session updated");
    } catch (err) {
      toast.error("Failed to update session", {
        description: err instanceof Error ? err.message : "Please try again",
      });
    }
  };

  const handleSetCurrent = async (session: AcademicSession) => {
    if (!tenantId) return;
    try {
      await saveSession.mutateAsync({
        id: session.id,
        data: {
          name: session.name,
          startDate: toISODate(session.startDate),
          endDate: toISODate(session.endDate),
          isCurrent: true,
        },
      });
      toast.success("Session set as current");
    } catch (err) {
      toast.error("Failed to set current session", {
        description: err instanceof Error ? err.message : "Please try again",
      });
    }
  };

  const openEdit = (session: AcademicSession) => {
    setSelectedSession(session);
    const startDate = session.startDate as unknown as { seconds?: number; toDate?: () => Date };
    const endDate = session.endDate as unknown as { seconds?: number; toDate?: () => Date };
    const toISODate = (ts: typeof startDate) => {
      if (ts?.toDate) return ts.toDate().toISOString().split("T")[0];
      if (ts?.seconds) return new Date(ts.seconds * 1000).toISOString().split("T")[0];
      return "";
    };
    setFormData({
      name: session.name,
      startDate: toISODate(startDate),
      endDate: toISODate(endDate),
      isCurrent: session.isCurrent,
    });
    setEditOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Academic Sessions</h1>
          <p className="text-muted-foreground text-sm">Manage academic years and sessions</p>
        </div>
        <Button
          onClick={() => {
            setFormData({ name: "", startDate: "", endDate: "", isCurrent: false });
            setCreateOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          New Session
        </Button>
      </div>

      {/* Current Session Card */}
      {currentSession && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-4 w-4" />
              Current Session
            </CardTitle>
            <CardDescription>Active academic session</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{currentSession.name}</p>
                <p className="text-muted-foreground text-sm">
                  {formatDate(currentSession.startDate)} — {formatDate(currentSession.endDate)}
                </p>
              </div>
              <Badge variant="default">Active</Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sessions Table */}
      {isLoading ? (
        <TableSkeleton columns={6} />
      ) : !sessions?.length ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <h3 className="text-lg font-semibold">No academic sessions</h3>
          <p className="text-muted-foreground mt-1 text-sm">
            Create your first academic session to organize your school year
          </p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead>Current</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell className="font-medium">{session.name}</TableCell>
                    <TableCell>{formatDate(session.startDate)}</TableCell>
                    <TableCell>{formatDate(session.endDate)}</TableCell>
                    <TableCell>
                      {session.isCurrent ? (
                        <Badge variant="default">Current</Badge>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs"
                          onClick={() => handleSetCurrent(session)}
                          disabled={saveSession.isPending}
                        >
                          Set as current
                        </Button>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={session.status === "active" ? "default" : "secondary"}>
                        {session.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setRolloverSession(session);
                            setRolloverOpen(true);
                          }}
                          title="Rollover session"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(session)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Create Session Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Academic Session</DialogTitle>
            <DialogDescription>Add a new academic year or term.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Session Name</Label>
              <Input
                placeholder="e.g. 2025-2026"
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData((p) => ({ ...p, startDate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData((p) => ({ ...p, endDate: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={formData.isCurrent}
                onCheckedChange={(checked) => setFormData((p) => ({ ...p, isCurrent: checked }))}
              />
              <Label>Set as current session</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={
                saveSession.isPending || !formData.name || !formData.startDate || !formData.endDate
              }
            >
              {saveSession.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Session Rollover Dialog */}
      {rolloverSession && tenantId && (
        <SessionRolloverDialog
          open={rolloverOpen}
          onOpenChange={setRolloverOpen}
          sourceSession={rolloverSession}
          tenantId={tenantId}
        />
      )}

      {/* Edit Session Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Academic Session</DialogTitle>
            <DialogDescription>Update session details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Session Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData((p) => ({ ...p, startDate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData((p) => ({ ...p, endDate: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={formData.isCurrent}
                onCheckedChange={(checked) => setFormData((p) => ({ ...p, isCurrent: checked }))}
              />
              <Label>Set as current session</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={saveSession.isPending}>
              {saveSession.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
