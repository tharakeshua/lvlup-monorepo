import { useState, useEffect } from "react";
import { useEvaluationSettings, useSaveEvaluationSettings, useApiError } from "@levelup/query";
import type { EvaluationSettings } from "@levelup/shared-types";
import { Save, Settings } from "lucide-react";
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
  Input,
  sonnerToast,
} from "@levelup/shared-ui";

interface EvaluationSettingsWithFields extends EvaluationSettings {
  autoGrade?: boolean;
  requireOverrideReason?: boolean;
  releaseResultsAutomatically?: boolean;
  defaultStrictness?: string;
}

export default function EvaluationSettingsPanel() {
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
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.7);
  const [autoApproveThreshold, setAutoApproveThreshold] = useState(0.9);

  useEffect(() => {
    if (settings) {
      setAutoGrade(settings.autoGrade ?? true);
      setRequireOverrideReason(settings.requireOverrideReason ?? true);
      setReleaseResultsAutomatically(settings.releaseResultsAutomatically ?? false);
      setDefaultStrictness(settings.defaultStrictness ?? "moderate");
      setConfidenceThreshold(settings.confidenceConfig?.confidenceThreshold ?? 0.7);
      setAutoApproveThreshold(settings.confidenceConfig?.autoApproveThreshold ?? 0.9);
    }
  }, [settings]);

  const handleSave = async () => {
    if (!settings?.id) return;
    setSaving(true);
    try {
      await saveSettings.mutateAsync({
        id: settings.id,
        confidenceConfig: {
          confidenceThreshold,
          autoApproveThreshold,
          requireReviewForPartialCredit:
            settings.confidenceConfig?.requireReviewForPartialCredit ?? true,
        },
        autoGrade,
        requireOverrideReason,
        releaseResultsAutomatically,
        defaultStrictness,
      } as never);
      sonnerToast.success("Evaluation settings saved");
    } catch (err) {
      handleError(err, "Failed to save evaluation settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-xl space-y-4">
      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center gap-2">
            <Settings className="text-muted-foreground h-5 w-5" />
            <h2 className="font-display text-lg font-semibold">Evaluation Behavior</h2>
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

      <Card>
        <CardContent className="space-y-4 p-5">
          <h2 className="font-display text-lg font-semibold">Confidence Thresholds</h2>
          <p className="text-muted-foreground text-xs">
            Wired to evaluation settings API where supported. Some teacher toggles above are
            best-effort until the contract adds dedicated fields.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Review below</Label>
              <Input
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={confidenceThreshold}
                onChange={(e) => setConfidenceThreshold(Number(e.target.value) || 0.7)}
                className="mt-1 font-mono"
              />
            </div>
            <div>
              <Label>Auto-approve above</Label>
              <Input
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={autoApproveThreshold}
                onChange={(e) => setAutoApproveThreshold(Number(e.target.value) || 0.9)}
                className="mt-1 font-mono"
              />
            </div>
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
          {saving ? "Saving..." : "Save Evaluation Settings"}
        </Button>
      )}
    </div>
  );
}
