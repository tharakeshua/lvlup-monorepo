import { useState, useEffect } from "react";
import { useAuthStore, useCurrentUser } from "@levelup/shared-stores";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getPlatformConfig, savePlatformConfig, type PlatformConfig } from "../sdk/reads-config";
import { sonnerToast as toast } from "@levelup/shared-ui";
import {
  Button,
  Input,
  Label,
  Switch,
  Textarea,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  LogoutButton,
  PageHeader,
  Skeleton,
  Alert,
  AlertDescription,
  AlertTitle,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@levelup/shared-ui";
import { Shield, Bell, LogOut, Globe, ToggleLeft, Save, AlertCircle } from "lucide-react";

function usePlatformConfig() {
  return useQuery<PlatformConfig>({
    queryKey: ["platform", "config"],
    queryFn: getPlatformConfig,
    staleTime: 60 * 1000,
  });
}

const DEFAULT_FEATURE_FLAGS: { key: string; label: string; description: string }[] = [
  {
    key: "autoGradeEnabled",
    label: "Auto Grade",
    description: "Enable exam creation and auto-grading",
  },
  {
    key: "levelUpEnabled",
    label: "Learning Spaces",
    description: "Enable learning spaces and activities",
  },
  { key: "aiGradingEnabled", label: "AI Grading", description: "Enable AI-powered auto-grading" },
  { key: "aiChatEnabled", label: "AI Chat / Tutoring", description: "Enable AI tutoring chat" },
  {
    key: "analyticsEnabled",
    label: "Analytics",
    description: "Enable analytics and report generation",
  },
  {
    key: "parentPortalEnabled",
    label: "Parent Portal",
    description: "Enable parent access portal",
  },
  { key: "bulkImportEnabled", label: "Bulk Import", description: "Enable bulk student import" },
];

export default function SettingsPage() {
  const { logout } = useAuthStore();
  const user = useCurrentUser();
  const queryClient = useQueryClient();
  const { data: config, isLoading, isError, error, refetch } = usePlatformConfig();

  const [announcement, setAnnouncement] = useState("");
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [defaultFeatures, setDefaultFeatures] = useState<Record<string, boolean>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [maintenanceConfirmOpen, setMaintenanceConfirmOpen] = useState(false);

  useEffect(() => {
    if (config) {
      setAnnouncement(config.announcement ?? "");
      setMaintenanceMode(config.maintenanceMode ?? false);
      setDefaultFeatures(config.defaultFeatures ?? {});
      setIsDirty(false);
    }
  }, [config]);

  const saveConfig = useMutation({
    mutationFn: () =>
      savePlatformConfig({
        announcement: announcement || null,
        maintenanceMode,
        defaultFeatures,
        defaultPlan: config?.defaultPlan ?? "trial",
        maxTenantsAllowed: config?.maxTenantsAllowed ?? null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform", "config"] });
      setIsDirty(false);
      toast.success("Settings saved successfully");
    },
    onError: (err: Error) => {
      toast.error(`Failed to save settings: ${err.message}`);
    },
  });

  const toggleFeature = (key: string) => {
    setDefaultFeatures((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
    setIsDirty(true);
  };

  const handleAnnouncementChange = (value: string) => {
    setAnnouncement(value);
    setIsDirty(true);
  };

  const handleMaintenanceModeChange = (value: boolean) => {
    if (value) {
      setMaintenanceConfirmOpen(true);
    } else {
      setMaintenanceMode(false);
      setIsDirty(true);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Settings"
        description="Global configuration for the LevelUp platform"
        actions={
          !isLoading ? (
            <Button
              onClick={() => saveConfig.mutate()}
              disabled={!isDirty || saveConfig.isPending}
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              {saveConfig.isPending ? "Saving..." : "Save Settings"}
            </Button>
          ) : undefined
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

      {isLoading ? (
        <div className="space-y-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-40" />
                <Skeleton className="mt-1 h-3 w-64" />
              </CardHeader>
              <CardContent className="space-y-4">
                {Array.from({ length: 3 }).map((_, j) => (
                  <Skeleton key={j} className="h-10 w-full" />
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          {/* Platform Announcement */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2.5">
                <div className="bg-primary/10 flex h-8 w-8 items-center justify-center rounded-lg">
                  <Bell className="text-primary h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-base">Platform Announcement</CardTitle>
                  <CardDescription>Broadcast a message to all tenants</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                placeholder="Enter announcement text (leave empty for none)..."
                value={announcement}
                onChange={(e) => handleAnnouncementChange(e.target.value)}
                rows={3}
                className="resize-none"
              />
              <p className="text-muted-foreground text-xs">
                {announcement
                  ? "Announcement will be visible to all tenant admins."
                  : "No active announcement."}
              </p>
            </CardContent>
          </Card>

          {/* Default Features for New Tenants */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2.5">
                <div className="bg-primary/10 flex h-8 w-8 items-center justify-center rounded-lg">
                  <ToggleLeft className="text-primary h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-base">Default Features for New Tenants</CardTitle>
                  <CardDescription>
                    Configure default enabled features when creating tenants
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="divide-border divide-y">
                {DEFAULT_FEATURE_FLAGS.map((flag) => (
                  <div
                    key={flag.key}
                    className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                  >
                    <div>
                      <p className="text-sm font-medium">{flag.label}</p>
                      <p className="text-muted-foreground text-xs">{flag.description}</p>
                    </div>
                    <Switch
                      checked={defaultFeatures[flag.key] ?? true}
                      onCheckedChange={() => toggleFeature(flag.key)}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* System Configuration */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2.5">
                <div className="bg-primary/10 flex h-8 w-8 items-center justify-center rounded-lg">
                  <Globe className="text-primary h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-base">System Configuration</CardTitle>
                  <CardDescription>Global platform settings</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <p className="text-sm font-medium">Maintenance Mode</p>
                  <p className="text-muted-foreground text-xs">
                    When enabled, non-admin users will see a maintenance page
                  </p>
                </div>
                <Switch checked={maintenanceMode} onCheckedChange={handleMaintenanceModeChange} />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-sm">Default Plan</Label>
                  <Input value={config?.defaultPlan ?? "trial"} readOnly className="bg-muted/50" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Max Tenants Allowed</Label>
                  <Input
                    value={config?.maxTenantsAllowed ?? "Unlimited"}
                    readOnly
                    className="bg-muted/50"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Admin Account */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2.5">
                <div className="bg-primary/10 flex h-8 w-8 items-center justify-center rounded-lg">
                  <Shield className="text-primary h-4 w-4" />
                </div>
                <CardTitle className="text-base">Admin Account</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold">
                    {(user?.displayName || user?.email || "A").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{user?.displayName || "Super Admin"}</p>
                    <p className="text-muted-foreground text-xs">{user?.email}</p>
                  </div>
                </div>
                <LogoutButton
                  onLogout={logout}
                  className="hover:bg-accent inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </LogoutButton>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <AlertDialog open={maintenanceConfirmOpen} onOpenChange={setMaintenanceConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enable Maintenance Mode?</AlertDialogTitle>
            <AlertDialogDescription>
              This will prevent all non-admin users from accessing the platform. They will see a
              maintenance page instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setMaintenanceMode(true);
                setIsDirty(true);
                setMaintenanceConfirmOpen(false);
              }}
            >
              Enable Maintenance Mode
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
