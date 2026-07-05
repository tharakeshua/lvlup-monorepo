import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listTenantAuditLog, type TenantAuditLogEntry } from "../../sdk/reads-tenant";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
  Badge,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@levelup/shared-ui";
import { ScrollText } from "lucide-react";

const PAGE_SIZE = 20;

const ACTION_LABELS: Record<string, string> = {
  tenant_created: "Tenant Created",
  tenant_updated: "Tenant Updated",
  tenant_deactivated: "Tenant Deactivated",
  tenant_reactivated: "Tenant Reactivated",
  user_created: "User Created",
  users_bulk_imported: "Users Bulk Imported",
};

function formatTimestamp(ts: TenantAuditLogEntry["createdAt"]): string {
  if (!ts) return "—";
  // Canonical callable views carry ISO strings; legacy rows carried Timestamps.
  const legacy = ts as unknown as { seconds?: number; toDate?: () => Date };
  const d =
    typeof ts === "string"
      ? new Date(ts)
      : (legacy.toDate?.() ?? (legacy.seconds ? new Date(legacy.seconds * 1000) : null));
  if (!d || Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TenantAuditLogCard({ tenantId }: { tenantId: string }) {
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [page, setPage] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ["platform", "tenantAuditLog", tenantId, actionFilter, page],
    queryFn: () => listTenantAuditLog(tenantId, actionFilter, PAGE_SIZE),
    staleTime: 30 * 1000,
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <ScrollText className="h-4 w-4" />
            Audit Log
          </CardTitle>
          <Select
            value={actionFilter}
            onValueChange={(v) => {
              setActionFilter(v);
              setPage(0);
            }}
          >
            <SelectTrigger className="h-8 w-44 text-xs">
              <SelectValue placeholder="All Actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              {Object.entries(ACTION_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-2 w-2 rounded-full" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : !data?.entries.length ? (
          <div className="py-8 text-center">
            <ScrollText className="text-muted-foreground/50 mx-auto h-8 w-8" />
            <p className="text-muted-foreground mt-2 text-sm">No audit log entries yet</p>
          </div>
        ) : (
          <>
            <div className="divide-border space-y-0 divide-y">
              {data.entries.map((entry) => (
                <div key={entry.id} className="flex items-start gap-3 py-2.5">
                  <span className="bg-primary/60 mt-1.5 h-2 w-2 shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">
                        {ACTION_LABELS[entry.action] ?? entry.action}
                      </p>
                      <Badge variant="outline" className="text-[10px]">
                        {entry.action.split("_")[0]}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground truncate text-xs">
                      by {entry.actorEmail}
                      {entry.metadata?.displayName ? ` — ${entry.metadata.displayName}` : ""}
                      {entry.metadata?.role ? ` (${entry.metadata.role})` : ""}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {formatTimestamp(entry.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            {data.hasMore && (
              <div className="mt-3 flex justify-center">
                <p className="text-muted-foreground text-xs">Showing first {PAGE_SIZE} entries</p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
