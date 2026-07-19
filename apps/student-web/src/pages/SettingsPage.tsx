import { useState, useEffect, useCallback } from "react";
import { useCurrentUser, useCurrentTenantId } from "@levelup/shared-stores";
import {
  Button,
  Switch,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
  ThemeToggle,
} from "@levelup/shared-ui";
import { Bell, Loader2, Check, Palette } from "lucide-react";
import { sonnerToast as toast } from "@levelup/shared-ui";
import {
  useNotificationPreferences,
  DEFAULT_PREFS,
  type NotificationPreferences,
} from "../hooks/useNotificationPreferences";
import { useSaveNotificationPreferences } from "../hooks/useSaveNotificationPreferences";

function SettingsPrefsSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading content">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center justify-between">
          <div className="space-y-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-5 w-9 rounded-full" />
        </div>
      ))}
      <span className="sr-only">Loading...</span>
    </div>
  );
}

export default function SettingsPage() {
  const user = useCurrentUser();
  const tenantId = useCurrentTenantId();
  const userId = user?.uid ?? null;

  const { data: savedPrefs, isLoading: prefsLoading } = useNotificationPreferences(
    tenantId,
    userId
  );
  const saveMutation = useSaveNotificationPreferences();

  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_PREFS);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (savedPrefs) {
      setPrefs(savedPrefs);
      setIsDirty(false);
    }
  }, [savedPrefs]);

  const updatePref = useCallback((key: keyof NotificationPreferences, value: boolean) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  }, []);

  const handleSave = () => {
    if (!tenantId || !userId) return;
    saveMutation.mutate(
      { tenantId, userId, prefs },
      {
        onSuccess: () => {
          setIsDirty(false);
          toast.success("Preferences saved successfully");
        },
        onError: () => {
          toast.error("Failed to save preferences. Please try again.");
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm">
          Manage your profile and notification preferences
        </p>
      </div>

      {/* Notification Preferences */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4" aria-hidden="true" />
              <CardTitle className="text-base">Notification Preferences</CardTitle>
            </div>
            {isDirty && (
              <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? (
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                ) : saveMutation.isSuccess && !isDirty ? (
                  <Check className="mr-2 h-3 w-3" />
                ) : null}
                Save Changes
              </Button>
            )}
          </div>
          <CardDescription>Choose how and when you receive notifications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {prefsLoading ? (
            <SettingsPrefsSkeleton />
          ) : (
            <>
              {/* Channels */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium">Notification Channels</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Email Notifications</p>
                      <p className="text-muted-foreground text-xs">
                        Receive notifications via email
                      </p>
                    </div>
                    <Switch
                      checked={prefs.emailNotifs}
                      onCheckedChange={(v) => updatePref("emailNotifs", v)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Push Notifications</p>
                      <p className="text-muted-foreground text-xs">
                        Receive browser push notifications
                      </p>
                    </div>
                    <Switch
                      checked={prefs.pushNotifs}
                      onCheckedChange={(v) => updatePref("pushNotifs", v)}
                    />
                  </div>
                </div>
              </div>

              {/* Notification Types */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium">Notification Types</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Exam Results</p>
                      <p className="text-muted-foreground text-xs">
                        When your exam results are released
                      </p>
                    </div>
                    <Switch
                      checked={prefs.examResults}
                      onCheckedChange={(v) => updatePref("examResults", v)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Achievement Alerts</p>
                      <p className="text-muted-foreground text-xs">
                        When you earn a new achievement or badge
                      </p>
                    </div>
                    <Switch
                      checked={prefs.achievementAlerts}
                      onCheckedChange={(v) => updatePref("achievementAlerts", v)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Leaderboard Updates</p>
                      <p className="text-muted-foreground text-xs">
                        When your rank changes on the leaderboard
                      </p>
                    </div>
                    <Switch
                      checked={prefs.leaderboardUpdates}
                      onCheckedChange={(v) => updatePref("leaderboardUpdates", v)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Streak Reminders</p>
                      <p className="text-muted-foreground text-xs">
                        Daily reminders to maintain your learning streak
                      </p>
                    </div>
                    <Switch
                      checked={prefs.streakReminders}
                      onCheckedChange={(v) => updatePref("streakReminders", v)}
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4" aria-hidden="true" />
            <CardTitle className="text-base">Appearance</CardTitle>
          </div>
          <CardDescription>Customize your visual experience</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Theme</p>
              <p className="text-muted-foreground text-xs">Switch between light and dark mode</p>
            </div>
            <ThemeToggle />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
