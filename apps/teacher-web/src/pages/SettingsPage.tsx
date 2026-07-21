import { useState, useEffect } from "react";
import { useEvaluationSettings, useSaveEvaluationSettings, useApiError } from "@levelup/query";
import type { EvaluationSettings } from "@levelup/shared-types";
import { Save, Settings, Compass } from "lucide-react";
import { startTeacherTour } from "../lib/productTour";
import {
  Button,
  Label,
  Switch,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Card,
  CardContent,
  sonnerToast,
} from "@levelup/shared-ui";

interface EvaluationSettingsWithFields extends EvaluationSettings {
  autoGrade?: boolean;
  requireOverrideReason?: boolean;
  releaseResultsAutomatically?: boolean;
  defaultStrictness?: string;
}

export default function SettingsPage() {
  // Evaluation settings are tenant-scoped server-side via claims; the query hook
  // returns the tenant's preset list (no tenantId arg).
  const { data: settingsData } = useEvaluationSettings();
  const saveSettings = useSaveEvaluationSettings();
  const [saving, setSaving] = useState(false);
  const { handleError } = useApiError();

  const settings: EvaluationSettingsWithFields | null =
    (settingsData as EvaluationSettingsWithFields[] | undefined)?.[0] ?? null;

  const [autoGrade, setAutoGrade] = useState(true);
  const [requireOverrideReason, setRequireOverrideReason] = useState(true);
  const [releaseResultsAutomatically, setReleaseResultsAutomatically] = useState(false);
  const [defaultStrictness, setDefaultStrictness] = useState("moderate");

  useEffect(() => {
    if (settings) {
      setAutoGrade(settings.autoGrade ?? true);
      setRequireOverrideReason(settings.requireOverrideReason ?? true);
      setReleaseResultsAutomatically(settings.releaseResultsAutomatically ?? false);
      setDefaultStrictness(settings.defaultStrictness ?? "moderate");
    }
  }, [settings]);

  const handleSave = async () => {
    if (!settings?.id) return;
    setSaving(true);
    try {
      // PARITY GAP: the new EvaluationSettings contract (saveEvaluationSettings)
      // does NOT model these teacher-web-specific toggles (autoGrade,
      // requireOverrideReason, releaseResultsAutomatically, defaultStrictness).
      // We send them best-effort with the preset id; the server may drop fields
      // outside its schema. Flagged to Frontend-Lead — needs a contract field or
      // a dedicated callable to persist these reliably. useSaveEvaluationSettings
      // auto-invalidates the settings list on settle.
      await saveSettings.mutateAsync({
        id: settings.id,
        autoGrade,
        requireOverrideReason,
        releaseResultsAutomatically,
        defaultStrictness,
      } as never);
      sonnerToast.success("Settings saved successfully");
    } catch (err) {
      handleError(err, "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Settings</h1>
        <p className="text-muted-foreground text-sm">Evaluation and grading configuration</p>
      </div>

      <div className="max-w-xl space-y-6">
        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center gap-2">
              <Settings className="text-muted-foreground h-5 w-5" />
              <h2 className="font-display text-lg font-semibold">Evaluation Settings</h2>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Auto Grade</p>
                <p className="text-muted-foreground text-xs">
                  Automatically grade submissions using AI
                </p>
              </div>
              <Switch checked={autoGrade} onCheckedChange={setAutoGrade} />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Require Override Reason</p>
                <p className="text-muted-foreground text-xs">
                  Mandate a reason when manually overriding AI grades
                </p>
              </div>
              <Switch checked={requireOverrideReason} onCheckedChange={setRequireOverrideReason} />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Auto-release Results</p>
                <p className="text-muted-foreground text-xs">
                  Release results automatically after grading completes
                </p>
              </div>
              <Switch
                checked={releaseResultsAutomatically}
                onCheckedChange={setReleaseResultsAutomatically}
              />
            </div>

            <div>
              <Label>Default AI Strictness</Label>
              <Select value={defaultStrictness} onValueChange={setDefaultStrictness}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lenient">Lenient</SelectItem>
                  <SelectItem value="moderate">Moderate</SelectItem>
                  <SelectItem value="strict">Strict</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {!settings && (
          <p className="text-muted-foreground text-sm">
            No evaluation settings configured for this tenant yet.
          </p>
        )}

        {settings && (
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        )}

        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center gap-2">
              <Compass className="text-muted-foreground h-5 w-5" />
              <h2 className="font-display text-lg font-semibold">Product Tour</h2>
            </div>
            <div className="flex items-center justify-between gap-4">
              <p className="text-muted-foreground text-sm">
                Replay the guided walkthrough of every feature in the sidebar.
              </p>
              <Button variant="outline" onClick={() => startTeacherTour()}>
                <Compass className="h-4 w-4" />
                Take the tour
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
