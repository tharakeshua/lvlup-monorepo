import { useState } from "react";
import { useApiError, useDeactivateTenant, useReactivateTenant } from "@levelup/query";
import { sonnerToast as toast } from "@levelup/shared-ui";
import type { Tenant } from "@levelup/domain";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@levelup/shared-ui";
import { Power, PowerOff } from "lucide-react";

interface Props {
  tenant: Tenant;
  tenantId: string;
}

export function TenantLifecycleCard({ tenant, tenantId }: Props) {
  const { handleError } = useApiError();
  const [deactivateOpen, setDeactivateOpen] = useState(false);

  // Lifecycle hooks auto-invalidate tenant + membership queries on settle.
  // GAP: the deactivate/reactivate contract responds { tenantId, status } — it
  // does NOT return a suspended/reactivated membership count, so the toast no
  // longer reports one.
  const deactivate = useDeactivateTenant();
  const reactivate = useReactivateTenant();

  const handleDeactivate = (onDone?: () => void) => {
    deactivate.mutate(
      { tenantOverride: tenantId },
      {
        onSuccess: () => {
          toast.success("Tenant deactivated");
          onDone?.();
        },
        onError: (err: unknown) => handleError(err, "Failed to deactivate tenant"),
      }
    );
  };

  const handleReactivate = () => {
    reactivate.mutate(
      { tenantOverride: tenantId },
      {
        onSuccess: () => toast.success("Tenant reactivated"),
        onError: (err: unknown) => handleError(err, "Failed to reactivate tenant"),
      }
    );
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tenant Lifecycle</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-sm">
            {tenant.status === "deactivated"
              ? "Reactivating will restore all suspended memberships."
              : "Deactivating will suspend all user memberships. Data is preserved."}
          </p>
          {tenant.status === "deactivated" ? (
            <Button
              variant="outline"
              onClick={handleReactivate}
              disabled={reactivate.isPending}
              className="gap-2"
            >
              <Power className="h-4 w-4" />
              {reactivate.isPending ? "Reactivating..." : "Reactivate Tenant"}
            </Button>
          ) : (
            <Button
              variant="destructive"
              onClick={() => setDeactivateOpen(true)}
              disabled={deactivate.isPending || tenant.status === "deactivated"}
              className="gap-2"
            >
              <PowerOff className="h-4 w-4" />
              {deactivate.isPending ? "Deactivating..." : "Deactivate Tenant"}
            </Button>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deactivateOpen} onOpenChange={setDeactivateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Tenant?</AlertDialogTitle>
            <AlertDialogDescription>
              This will suspend all user memberships for <strong>{tenant.name}</strong>. Users will
              lose access until the tenant is reactivated. Data will be preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={deactivate.isPending}
              onClick={() => {
                handleDeactivate(() => setDeactivateOpen(false));
              }}
            >
              {deactivate.isPending ? "Deactivating..." : "Confirm Deactivation"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
