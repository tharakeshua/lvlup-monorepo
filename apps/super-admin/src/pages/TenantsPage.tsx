import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useApiError, useTenants, useSaveTenant } from "@levelup/query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  sonnerToast as toast,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Input,
  SearchInput,
  StatusBadge,
  PageHeader,
  Skeleton,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Alert,
  AlertDescription,
  AlertTitle,
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormDescription,
  DataTablePagination,
  SortableTableHead,
} from "@levelup/shared-ui";
import { Plus, Building2, AlertCircle, ExternalLink } from "lucide-react";
import { usePagination } from "../hooks/usePagination";
import { useSort } from "../hooks/useSort";

/**
 * Slim super-admin list row, mirroring the `listTenants` projection
 * (TenantSummarySchema). NOTE: the list projection has NO contactEmail and uses
 * `slug` (not `tenantCode`); counts are flat `totalStudents`/`totalTeachers`
 * rather than a nested `stats`/`subscription` object.
 */
interface TenantSummaryRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  plan?: string;
  totalStudents?: number;
  totalTeachers?: number;
  createdAt?: string;
}

const createTenantSchema = z.object({
  name: z.string().min(1, "Organization name is required"),
  tenantCode: z
    .string()
    .min(1, "Tenant code is required")
    .regex(/^[A-Z0-9-]+$/, "Uppercase letters, numbers, and hyphens only"),
  contactEmail: z.string().email("Valid email address required"),
  contactPerson: z.string().optional(),
  plan: z.enum(["trial", "basic", "premium", "enterprise"]),
});
type CreateTenantFormValues = z.infer<typeof createTenantSchema>;

export default function TenantsPage() {
  const { handleError } = useApiError();
  const { data, isLoading, isError, error, refetch } = useTenants();
  // useTenants → listTenants (paginated PageBag). Surface the first page's items.
  const tenants = (data as { items?: TenantSummaryRow[] } | undefined)?.items;
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);

  const form = useForm<CreateTenantFormValues>({
    resolver: zodResolver(createTenantSchema),
    defaultValues: { name: "", tenantCode: "", contactEmail: "", contactPerson: "", plan: "trial" },
  });

  // useSaveTenant auto-invalidates tenant queries on settle.
  // GAP: the saveTenant contract `data` does NOT accept `tenantCode`,
  // `contactPerson`, or a nested `subscription` object — only a flat `plan` plus
  // name/contactEmail/etc. The code + contact person collected here cannot be
  // persisted through this callable (provisioning likely needs a dedicated
  // create-tenant callable). Only name/contactEmail/plan are sent.
  const createTenant = useSaveTenant();

  const onCreate = (values: CreateTenantFormValues) => {
    createTenant.mutate(
      {
        data: {
          name: values.name,
          contactEmail: values.contactEmail,
          plan: values.plan,
        },
      },
      {
        onSuccess: () => {
          setCreateOpen(false);
          form.reset();
          toast.success("Tenant created successfully");
        },
        onError: (err: unknown) => handleError(err, "Failed to create tenant"),
      }
    );
  };

  const statuses = ["all", "active", "trial", "suspended", "expired"];

  const filtered = useMemo(() => {
    return (tenants ?? [])
      .filter((t) => {
        if (statusFilter !== "all" && t.status !== statusFilter) return false;
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return t.name.toLowerCase().includes(q) || t.slug?.toLowerCase().includes(q);
      })
      .map((t) => ({
        ...t,
        _userCount: (t.totalStudents ?? 0) + (t.totalTeachers ?? 0),
        _plan: t.plan ?? "",
      }));
  }, [tenants, statusFilter, searchQuery]);

  const { sortedItems, currentSort, handleSort } = useSort(filtered);
  const { paginatedItems, currentPage, pageSize, totalItems, setCurrentPage, setPageSize } =
    usePagination(sortedItems);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tenants"
        description="Manage all registered organizations"
        actions={
          <Button
            onClick={() => {
              form.reset();
              setCreateOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Tenant
          </Button>
        }
      />

      {isError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Failed to load data</AlertTitle>
          <AlertDescription className="flex items-center gap-2">
            {error instanceof Error ? error.message : "An unexpected error occurred."}
            <Button variant="link" className="h-auto p-0" onClick={() => refetch()}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <SearchInput
          placeholder="Search by name, code, or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          containerClassName="flex-1"
        />
        <div className="bg-muted/30 flex gap-1 rounded-lg border p-1">
          {statuses.map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? "default" : "ghost"}
              size="sm"
              onClick={() => setStatusFilter(s)}
              className="h-7 px-3 text-xs capitalize"
            >
              {s}
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-lg border">
        <Table>
          <TableCaption className="sr-only">List of registered tenants</TableCaption>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <SortableTableHead sortKey="name" currentSort={currentSort} onSort={handleSort}>
                Name
              </SortableTableHead>
              <SortableTableHead sortKey="slug" currentSort={currentSort} onSort={handleSort}>
                Code
              </SortableTableHead>
              <SortableTableHead sortKey="_plan" currentSort={currentSort} onSort={handleSort}>
                Plan
              </SortableTableHead>
              <SortableTableHead sortKey="_userCount" currentSort={currentSort} onSort={handleSort}>
                Users
              </SortableTableHead>
              <SortableTableHead sortKey="status" currentSort={currentSort} onSort={handleSort}>
                Status
              </SortableTableHead>
              <TableHead className="w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="mt-1.5 h-3 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-10" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-10" />
                  </TableCell>
                </TableRow>
              ))
            ) : !paginatedItems.length ? (
              <TableRow>
                <TableCell colSpan={6} className="h-48">
                  <div className="flex flex-col items-center justify-center text-center">
                    <div className="bg-muted flex h-12 w-12 items-center justify-center rounded-full">
                      <Building2 className="text-muted-foreground h-6 w-6" />
                    </div>
                    <h3 className="mt-3 text-sm font-semibold">No tenants found</h3>
                    <p className="text-muted-foreground mt-1 max-w-sm text-xs">
                      {searchQuery || statusFilter !== "all"
                        ? "Try adjusting your search or filter criteria."
                        : "Create your first tenant to get started."}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginatedItems.map((tenant) => (
                <TableRow key={tenant.id} className="group">
                  <TableCell>
                    <div>
                      <p className="font-medium">{tenant.name}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">
                      {tenant.slug}
                    </code>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm capitalize">{tenant.plan ?? "--"}</span>
                  </TableCell>
                  <TableCell>
                    <span className="tabular-nums">{tenant._userCount}</span>
                  </TableCell>
                  <TableCell>
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
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="touch-device:opacity-100 h-7 px-2 opacity-0 transition-opacity focus-visible:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
                      asChild
                    >
                      <Link to={`/tenants/${tenant.id}`}>
                        View <ExternalLink className="ml-1 h-3 w-3" />
                      </Link>
                    </Button>
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

      {/* Create Tenant Dialog */}
      <Dialog open={createOpen} onOpenChange={(o) => !o && setCreateOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Tenant</DialogTitle>
            <DialogDescription>Add a new organization to the platform</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onCreate)} className="space-y-4 py-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Organization Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Springfield High School" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tenantCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tenant Code *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. SPRINGFIELD-HS"
                        {...field}
                        onChange={(e) =>
                          field.onChange(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))
                        }
                      />
                    </FormControl>
                    <FormDescription>Uppercase letters, numbers, and hyphens only</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="contactEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Email *</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="admin@school.edu" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="contactPerson"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Person</FormLabel>
                    <FormControl>
                      <Input placeholder="John Smith" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="plan"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subscription Plan</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="trial">Trial</SelectItem>
                        <SelectItem value="basic">Basic</SelectItem>
                        <SelectItem value="premium">Premium</SelectItem>
                        <SelectItem value="enterprise">Enterprise</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateOpen(false)}
                  disabled={createTenant.isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createTenant.isPending}>
                  {createTenant.isPending ? "Creating..." : "Create Tenant"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
