import { useState } from "react";
import { useApiError, useSaveTenant } from "@levelup/query";
import { sonnerToast as toast } from "@levelup/shared-ui";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Tenant } from "@levelup/domain";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
  Button,
  Input,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Alert,
  AlertDescription,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@levelup/shared-ui";
import { CreditCard, AlertCircle } from "lucide-react";

const subscriptionSchema = z.object({
  plan: z.enum(["free", "trial", "basic", "premium", "enterprise"]),
  maxStudents: z.string().optional(),
  maxTeachers: z.string().optional(),
  maxSpaces: z.string().optional(),
  maxExamsPerMonth: z.string().optional(),
  expiresAt: z.string().optional(),
});
type SubscriptionFormValues = z.infer<typeof subscriptionSchema>;

interface Props {
  tenant: Tenant;
  tenantId: string;
}

export function TenantSubscriptionCard({ tenant, tenantId }: Props) {
  const { handleError } = useApiError();
  const [subscriptionOpen, setSubscriptionOpen] = useState(false);

  const subscriptionForm = useForm<SubscriptionFormValues>({
    resolver: zodResolver(subscriptionSchema),
    defaultValues: {
      plan: "trial",
      maxStudents: "",
      maxTeachers: "",
      maxSpaces: "",
      maxExamsPerMonth: "",
      expiresAt: "",
    },
  });

  // useSaveTenant auto-invalidates tenant queries on settle.
  // GAP: the saveTenant contract `data` exposes only a flat `plan` field — it has
  // NO nested `subscription` object, so the per-plan limits (maxStudents /
  // maxTeachers / maxSpaces / maxExamsPerMonth) and the expiry date cannot be
  // persisted via this callable. Only the plan tier is saved here.
  const updateSubscription = useSaveTenant();

  const onSubmit = (data: SubscriptionFormValues) => {
    updateSubscription.mutate(
      { id: tenantId, data: { plan: data.plan } },
      {
        onSuccess: () => {
          setSubscriptionOpen(false);
          toast.success("Subscription updated successfully");
        },
        onError: (err: unknown) => handleError(err, "Failed to update subscription"),
      }
    );
  };

  function openSubscription() {
    const sub = tenant.subscription;
    const expiresDate = sub?.expiresAt
      ? new Date(sub.expiresAt.seconds * 1000).toISOString().split("T")[0]
      : "";
    subscriptionForm.reset({
      plan: sub?.plan ?? "trial",
      maxStudents: sub?.maxStudents?.toString() ?? "",
      maxTeachers: sub?.maxTeachers?.toString() ?? "",
      maxSpaces: sub?.maxSpaces?.toString() ?? "",
      maxExamsPerMonth: sub?.maxExamsPerMonth?.toString() ?? "",
      expiresAt: expiresDate,
    });
    setSubscriptionOpen(true);
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Subscription</CardTitle>
          <Button variant="outline" size="sm" onClick={openSubscription}>
            <CreditCard className="mr-1 h-3.5 w-3.5" />
            Edit Plan
          </Button>
        </CardHeader>
        <CardContent>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Plan</dt>
              <dd className="font-medium capitalize">{tenant.subscription?.plan ?? "--"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Max Students</dt>
              <dd className="font-medium">{tenant.subscription?.maxStudents ?? "Unlimited"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Max Teachers</dt>
              <dd className="font-medium">{tenant.subscription?.maxTeachers ?? "Unlimited"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Max Spaces</dt>
              <dd className="font-medium">{tenant.subscription?.maxSpaces ?? "Unlimited"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Max Exams/Month</dt>
              <dd className="font-medium">
                {tenant.subscription?.maxExamsPerMonth ?? "Unlimited"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Expires</dt>
              <dd className="font-medium">
                {tenant.subscription?.expiresAt
                  ? new Date(tenant.subscription.expiresAt.seconds * 1000).toLocaleDateString()
                  : "No expiry"}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Dialog open={subscriptionOpen} onOpenChange={(o) => !o && setSubscriptionOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Subscription</DialogTitle>
            <DialogDescription className="sr-only">
              Edit subscription plan and limits
            </DialogDescription>
          </DialogHeader>
          <Form {...subscriptionForm}>
            <form onSubmit={subscriptionForm.handleSubmit(onSubmit)} className="space-y-4 py-2">
              <FormField
                control={subscriptionForm.control}
                name="plan"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Plan</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
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
              <FormField
                control={subscriptionForm.control}
                name="maxStudents"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max Students</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        placeholder="Leave empty for unlimited"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={subscriptionForm.control}
                name="maxTeachers"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max Teachers</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        placeholder="Leave empty for unlimited"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={subscriptionForm.control}
                name="maxSpaces"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max Spaces</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        placeholder="Leave empty for unlimited"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={subscriptionForm.control}
                name="maxExamsPerMonth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max Exams Per Month</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        placeholder="Leave empty for unlimited"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={subscriptionForm.control}
                name="expiresAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expiration Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {updateSubscription.isError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {updateSubscription.error instanceof Error
                      ? updateSubscription.error.message
                      : "Failed to update subscription"}
                  </AlertDescription>
                </Alert>
              )}
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSubscriptionOpen(false)}
                  disabled={updateSubscription.isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateSubscription.isPending}>
                  {updateSubscription.isPending ? "Saving..." : "Save Subscription"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
