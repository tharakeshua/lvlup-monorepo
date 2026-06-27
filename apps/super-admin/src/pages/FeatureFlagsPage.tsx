import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useApiError, useSaveTenant } from "@levelup/query";
import { getTenantsWithFlags, type TenantFlags } from "../sdk/reads-config";
import { sonnerToast as toast } from "@levelup/shared-ui";
import { ToggleLeft, ToggleRight, Save, Check, Building2, AlertCircle } from "lucide-react";
import {
  Button,
  SearchInput,
  StatusBadge,
  PageHeader,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
  Alert,
  AlertDescription,
  AlertTitle,
  DataTablePagination,
} from "@levelup/shared-ui";
import { usePagination } from "../hooks/usePagination";

const KNOWN_FLAGS = [
  { key: "autoGradeEnabled", label: "AutoGrade", description: "Automated exam grading system" },
  { key: "levelUpEnabled", label: "LevelUp Spaces", description: "Interactive learning spaces" },
  { key: "scannerAppEnabled", label: "Scanner App", description: "Mobile exam scanning" },
  { key: "aiChatEnabled", label: "AI Chat Tutor", description: "AI-powered student chat tutoring" },
  { key: "aiGradingEnabled", label: "AI Grading", description: "AI-powered answer evaluation" },
  { key: "analyticsEnabled", label: "Analytics", description: "Advanced analytics dashboards" },
  { key: "parentPortalEnabled", label: "Parent Portal", description: "Parent dashboard access" },
  { key: "bulkImportEnabled", label: "Bulk Import", description: "CSV/Excel bulk data import" },
  { key: "apiAccessEnabled", label: "API Access", description: "External API access" },
] as const;

type _FlagKey = (typeof KNOWN_FLAGS)[number]["key"];

function useTenantsWithFlags() {
  return useQuery<TenantFlags[]>({
    queryKey: ["platform", "tenantFlags"],
    queryFn: getTenantsWithFlags,
    staleTime: 30 * 1000,
  });
}

export default function FeatureFlagsPage() {
  const queryClient = useQueryClient();
  const { handleError } = useApiError();
  const { data: tenants, isLoading, isError, error, refetch } = useTenantsWithFlags();
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingChanges, setPendingChanges] = useState<Record<string, Record<string, boolean>>>({});
  const [savedTenants, setSavedTenants] = useState<Set<string>>(new Set());

  // WRITE goes through the real `saveTenant` callable (NOT a gap). The gap read
  // (`["platform","tenantFlags"]`) is invalidated here per-call, since the hook's
  // own invalidation targets `tenantKeys`, not our custom feature-flag key.
  const saveTenantMut = useSaveTenant();

  const filtered = useMemo(() => {
    return (tenants ?? []).filter((t) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return t.tenantName.toLowerCase().includes(q) || t.tenantCode.toLowerCase().includes(q);
    });
  }, [tenants, searchQuery]);

  const { paginatedItems, currentPage, pageSize, totalItems, setCurrentPage, setPageSize } =
    usePagination(filtered);

  const toggleFlag = (tenantId: string, flagKey: string, currentFlags: Record<string, boolean>) => {
    const pending = pendingChanges[tenantId] ?? { ...currentFlags };
    const newValue = !pending[flagKey];
    setPendingChanges((prev) => ({
      ...prev,
      [tenantId]: { ...pending, [flagKey]: newValue },
    }));
  };

  const saveTenant = (tenantId: string, originalFlags: Record<string, boolean>) => {
    const flags = pendingChanges[tenantId] ?? originalFlags;
    saveTenantMut.mutate(
      { id: tenantId, data: { features: flags } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["platform", "tenantFlags"] });
          setPendingChanges((prev) => {
            const next = { ...prev };
            delete next[tenantId];
            return next;
          });
          setSavedTenants((prev) => new Set(prev).add(tenantId));
          toast.success("Feature flags saved");
          setTimeout(() => {
            setSavedTenants((prev) => {
              const next = new Set(prev);
              next.delete(tenantId);
              return next;
            });
          }, 2000);
        },
        onError: (err: unknown) => {
          handleError(err, "Failed to update feature flags");
        },
      }
    );
  };

  const hasPendingChanges = (tenantId: string) => {
    return tenantId in pendingChanges;
  };

  const getEffectiveFlags = (tenant: TenantFlags): Record<string, boolean> => {
    return pendingChanges[tenant.tenantId] ?? tenant.flags;
  };

  const flagSummary = KNOWN_FLAGS.map((flag) => {
    const enabled = tenants?.filter((t) => t.flags[flag.key] === true).length ?? 0;
    const total = tenants?.length ?? 0;
    return { ...flag, enabled, total };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Feature Flags"
        description="Manage tenant-level feature toggles across the platform"
      />

      {isError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Failed to load data</AlertTitle>
          <AlertDescription className="flex items-center gap-2">
            {(error as Error)?.message ?? "An unexpected error occurred."}
            <Button variant="link" className="h-auto p-0" onClick={() => refetch()}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Flag Overview</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {flagSummary.map((flag) => {
              const pct = flag.total > 0 ? Math.round((flag.enabled / flag.total) * 100) : 0;
              return (
                <div
                  key={flag.key}
                  className="bg-card flex items-center justify-between rounded-lg border px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{flag.label}</p>
                    <p className="text-muted-foreground truncate text-xs">{flag.description}</p>
                  </div>
                  <div className="ml-3 flex shrink-0 items-center gap-2">
                    <div className="bg-muted h-1.5 w-12 overflow-hidden rounded-full">
                      <div
                        className="bg-primary h-full rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-muted-foreground w-8 text-right font-mono text-xs tabular-nums">
                      {flag.enabled}/{flag.total}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <SearchInput
        placeholder="Search tenants by name or code..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        containerClassName="max-w-sm"
      />

      {/* Tenant Flag Cards */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="space-y-3 p-5">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, j) => (
                    <Skeleton key={j} className="h-10 w-full rounded-lg" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !paginatedItems.length ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <div className="bg-muted flex h-12 w-12 items-center justify-center rounded-full">
            <Building2 className="text-muted-foreground h-6 w-6" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">No tenants found</h3>
          <p className="text-muted-foreground mt-1 text-sm">
            {searchQuery
              ? "Try adjusting your search criteria."
              : "No tenants have been created yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {paginatedItems.map((tenant) => {
            const effectiveFlags = getEffectiveFlags(tenant);
            const isPending = hasPendingChanges(tenant.tenantId);
            const isSaved = savedTenants.has(tenant.tenantId);

            return (
              <Card
                key={tenant.tenantId}
                className={`transition-all ${isPending ? "ring-primary/20 shadow-sm ring-2" : ""}`}
              >
                <CardContent className="p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{tenant.tenantName}</h3>
                          <StatusBadge
                            status={
                              tenant.status as
                                | "active"
                                | "trial"
                                | "suspended"
                                | "expired"
                                | "deactivated"
                            }
                          >
                            {tenant.status}
                          </StatusBadge>
                        </div>
                        <p className="text-muted-foreground mt-0.5 font-mono text-xs">
                          {tenant.tenantCode}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isSaved && (
                        <span className="animate-in fade-in flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                          <Check className="h-3.5 w-3.5" /> Saved
                        </span>
                      )}
                      {isPending && (
                        <Button
                          size="sm"
                          onClick={() => saveTenant(tenant.tenantId, tenant.flags)}
                          disabled={saveTenantMut.isPending}
                          className="gap-1.5"
                        >
                          <Save className="h-3.5 w-3.5" />
                          {saveTenantMut.isPending ? "Saving..." : "Save Changes"}
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {KNOWN_FLAGS.map((flag) => {
                      const isEnabled = effectiveFlags[flag.key] === true;
                      return (
                        <button
                          key={flag.key}
                          type="button"
                          onClick={() => toggleFlag(tenant.tenantId, flag.key, tenant.flags)}
                          className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-sm transition-all ${
                            isEnabled
                              ? "border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 dark:border-emerald-800/50 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/50"
                              : "border-muted bg-muted/20 hover:bg-muted/40"
                          }`}
                        >
                          {isEnabled ? (
                            <ToggleRight className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <ToggleLeft className="text-muted-foreground/50 h-5 w-5 shrink-0" />
                          )}
                          <div className="min-w-0">
                            <span
                              className={`block truncate ${isEnabled ? "font-medium" : "text-muted-foreground"}`}
                            >
                              {flag.label}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <DataTablePagination
        totalItems={totalItems}
        pageSize={pageSize}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        onPageSizeChange={setPageSize}
      />
    </div>
  );
}
