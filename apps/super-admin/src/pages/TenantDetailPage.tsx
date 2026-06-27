import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useTenant } from "@levelup/query";
import type { Tenant } from "@levelup/domain";
import {
  Button,
  StatusBadge,
  StatCard,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Skeleton,
  Alert,
  AlertDescription,
  AlertTitle as AlertTitleComp,
} from "@levelup/shared-ui";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Users,
  GraduationCap,
  ClipboardList,
  BookOpen,
  Building2,
  AlertCircle,
  Mail,
  Phone,
  User,
  Globe,
} from "lucide-react";
import { TenantSubscriptionCard } from "../components/tenant-detail/TenantSubscriptionCard";
import { TenantLifecycleCard } from "../components/tenant-detail/TenantLifecycleCard";
import { TenantDataExportCard } from "../components/tenant-detail/TenantDataExportCard";
import { EditTenantDialog } from "../components/tenant-detail/EditTenantDialog";
import { DeleteTenantDialog } from "../components/tenant-detail/DeleteTenantDialog";
import { TenantAuditLogCard } from "../components/tenant-detail/TenantAuditLogCard";

export default function TenantDetailPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  // useTenant(tenantOverride) → getTenant callable; data is `unknown`, cast to
  // the domain-compatible Tenant shape consumed by the detail UI + child cards.
  const { data, isLoading, isError, error, refetch } = useTenant(tenantId);
  const tenant = data as Tenant | undefined;

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-4 w-16" />
          <div className="space-y-1.5">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="space-y-2 p-4">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="mt-2 h-7 w-12" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="space-y-3 p-6">
                <Skeleton className="h-5 w-24" />
                {Array.from({ length: 4 }).map((_, j) => (
                  <Skeleton key={j} className="h-4 w-full" />
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-4">
        <Link
          to="/tenants"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Tenants
        </Link>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitleComp>Failed to load tenant</AlertTitleComp>
          <AlertDescription className="flex items-center gap-2">
            {error instanceof Error ? error.message : "An unexpected error occurred."}
            <Button variant="link" className="h-auto p-0" onClick={() => refetch()}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!tenant || !tenantId) {
    return (
      <div className="space-y-4">
        <Link
          to="/tenants"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Tenants
        </Link>
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <div className="bg-muted flex h-12 w-12 items-center justify-center rounded-full">
            <Building2 className="text-muted-foreground h-6 w-6" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">Tenant not found</h3>
          <p className="text-muted-foreground mt-1 text-sm">
            This tenant may have been deleted or the ID is invalid.
          </p>
          <Button variant="outline" className="mt-4" asChild>
            <Link to="/tenants">View All Tenants</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <Link
          to="/tenants"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Tenants
        </Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{tenant.name}</h1>
              <StatusBadge
                status={
                  tenant.status as "active" | "trial" | "suspended" | "expired" | "deactivated"
                }
              >
                {tenant.status}
              </StatusBadge>
            </div>
            <p className="text-muted-foreground text-sm">
              <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">
                {tenant.tenantCode}
              </code>
              <span className="mx-2">&middot;</span>
              {tenant.contactEmail}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
            </Button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Students" value={tenant.stats?.totalStudents ?? 0} icon={Users} />
        <StatCard label="Teachers" value={tenant.stats?.totalTeachers ?? 0} icon={GraduationCap} />
        <StatCard label="Exams" value={tenant.stats?.totalExams ?? 0} icon={ClipboardList} />
        <StatCard label="Spaces" value={tenant.stats?.totalSpaces ?? 0} icon={BookOpen} />
      </div>

      {/* Subscription + Contact */}
      <div className="grid gap-4 md:grid-cols-2">
        <TenantSubscriptionCard tenant={tenant} tenantId={tenantId} />
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contact Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { icon: Mail, label: "Email", value: tenant.contactEmail },
                { icon: Phone, label: "Phone", value: tenant.contactPhone ?? "--" },
                { icon: User, label: "Contact Person", value: tenant.contactPerson ?? "--" },
                { icon: Globe, label: "Website", value: tenant.website ?? "--" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3 text-sm">
                  <div className="bg-muted flex h-8 w-8 shrink-0 items-center justify-center rounded-md">
                    <item.icon className="text-muted-foreground h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-muted-foreground text-xs">{item.label}</p>
                    <p className="truncate font-medium">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Features */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Features</CardTitle>
        </CardHeader>
        <CardContent>
          {tenant.features && Object.keys(tenant.features).length > 0 ? (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
              {Object.entries(tenant.features).map(([key, enabled]) => (
                <div
                  key={key}
                  className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                    enabled
                      ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-800/50 dark:bg-emerald-950/30"
                      : "bg-muted/40 border-transparent"
                  }`}
                >
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${enabled ? "bg-emerald-500" : "bg-muted-foreground/30"}`}
                  />
                  <span className={enabled ? "font-medium" : "text-muted-foreground"}>
                    {key
                      .replace(/([A-Z])/g, " $1")
                      .replace("Enabled", "")
                      .trim()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No features configured.</p>
          )}
        </CardContent>
      </Card>

      {/* Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            {[
              { label: "Gemini Key Set", value: tenant.settings?.geminiKeySet ? "Yes" : "No" },
              { label: "Default AI Model", value: tenant.settings?.defaultAiModel ?? "--" },
              { label: "Timezone", value: tenant.settings?.timezone ?? "--" },
              { label: "Locale", value: tenant.settings?.locale ?? "--" },
            ].map((item) => (
              <div
                key={item.label}
                className="bg-muted/40 flex items-center justify-between rounded-lg px-4 py-3"
              >
                <span className="text-muted-foreground text-sm">{item.label}</span>
                <span className="text-sm font-medium">{item.value}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Lifecycle + Export */}
      <div className="grid gap-4 md:grid-cols-2">
        <TenantLifecycleCard tenant={tenant} tenantId={tenantId} />
        <TenantDataExportCard tenantId={tenantId} />
      </div>

      {/* Audit Log */}
      <TenantAuditLogCard tenantId={tenantId} />

      {/* Dialogs */}
      <EditTenantDialog
        tenant={tenant}
        tenantId={tenantId}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
      <DeleteTenantDialog
        tenant={tenant}
        tenantId={tenantId}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </div>
  );
}
