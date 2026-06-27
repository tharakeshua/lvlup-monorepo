import { useState } from "react";
import { useCurrentTenantId, useCurrentTenant } from "@/sdk/identity";
import { useEvaluationSettings, useSaveEvaluationSettings, useSaveTenant } from "@levelup/query";
import type { EvaluationSettings, Tenant } from "@levelup/shared-types";
import {
  Input,
  Button,
  Label,
  Switch,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Skeleton,
} from "@levelup/shared-ui";
import { toast } from "sonner";
import { Copy, Check } from "lucide-react";
import LogoUploader from "../components/settings/LogoUploader";

type SettingsTab = "tenant" | "evaluation" | "api" | "branding";

export default function SettingsPage() {
  const tenantId = useCurrentTenantId();
  const tenant = useCurrentTenant().data as Tenant | undefined;
  const [activeTab, setActiveTab] = useState<SettingsTab>("tenant");
  const { data: evalData, isLoading: evalLoading } = useEvaluationSettings();
  const evalSettings = evalData as EvaluationSettings[] | undefined;
  const saveTenant = useSaveTenant();
  const saveEvaluationSettings = useSaveEvaluationSettings();

  // School info editing state
  const [isEditingSchool, setIsEditingSchool] = useState(false);
  const [schoolForm, setSchoolForm] = useState({
    name: "",
    contactEmail: "",
    contactPhone: "",
  });
  const [savingSchool, setSavingSchool] = useState(false);

  // Evaluation settings editing state
  const [editingEvalId, setEditingEvalId] = useState<string | null>(null);
  const [evalForm, setEvalForm] = useState<{
    enabledDimensions: { id: string; name: string; enabled: boolean }[];
    showStrengths: boolean;
    showKeyTakeaway: boolean;
  }>({ enabledDimensions: [], showStrengths: false, showKeyTakeaway: false });
  const [savingEval, setSavingEval] = useState(false);

  // Copy-to-clipboard state
  const [copied, setCopied] = useState(false);

  // Branding state
  const [isEditingBranding, setIsEditingBranding] = useState(false);
  const [brandingForm, setBrandingForm] = useState({
    primaryColor: "",
    accentColor: "",
    logoUrl: "",
  });
  const [savingBranding, setSavingBranding] = useState(false);

  // API key state
  const [apiKeyDialogOpen, setApiKeyDialogOpen] = useState(false);
  const [apiKeyValue, setApiKeyValue] = useState("");
  const [savingApiKey, setSavingApiKey] = useState(false);
  const [removingApiKey, setRemovingApiKey] = useState(false);

  const startEditSchool = () => {
    setSchoolForm({
      name: tenant?.name ?? "",
      contactEmail: tenant?.contactEmail ?? "",
      contactPhone: tenant?.contactPhone ?? "",
    });
    setIsEditingSchool(true);
  };

  const handleSaveSchool = async () => {
    if (!tenantId) return;

    // Validate email
    if (schoolForm.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(schoolForm.contactEmail)) {
      toast.error("Invalid email format");
      return;
    }

    // Validate phone (basic)
    if (schoolForm.contactPhone && !/^[\d\s\-+()]+$/.test(schoolForm.contactPhone)) {
      toast.error("Invalid phone number format");
      return;
    }

    setSavingSchool(true);
    try {
      await saveTenant.mutateAsync({
        data: {
          name: schoolForm.name || undefined,
          contactEmail: schoolForm.contactEmail || undefined,
          contactPhone: schoolForm.contactPhone || undefined,
        },
      });
      setIsEditingSchool(false);
      toast.success("School info updated");
    } catch (err) {
      toast.error("Failed to update school info", {
        description: err instanceof Error ? err.message : "Please try again",
      });
    } finally {
      setSavingSchool(false);
    }
  };

  const startEditEval = (setting: EvaluationSettings) => {
    setEditingEvalId(setting.id);
    setEvalForm({
      enabledDimensions: (setting.enabledDimensions ?? []).map((d) => ({ ...d })),
      showStrengths: setting.displaySettings?.showStrengths ?? false,
      showKeyTakeaway: setting.displaySettings?.showKeyTakeaway ?? false,
    });
  };

  const handleSaveEval = async () => {
    if (!tenantId || !editingEvalId) return;
    setSavingEval(true);
    try {
      const current = evalSettings?.find((s) => s.id === editingEvalId);
      await saveEvaluationSettings.mutateAsync({
        id: editingEvalId,
        data: {
          enabledDimensions: evalForm.enabledDimensions,
          displaySettings: {
            showStrengths: evalForm.showStrengths,
            showKeyTakeaway: evalForm.showKeyTakeaway,
            prioritizeByImportance: current?.displaySettings?.prioritizeByImportance ?? false,
          },
        },
      });
      setEditingEvalId(null);
      toast.success("Evaluation settings saved");
    } catch (err) {
      toast.error("Failed to save evaluation settings", {
        description: err instanceof Error ? err.message : "Please try again",
      });
    } finally {
      setSavingEval(false);
    }
  };

  const handleSetApiKey = async () => {
    if (!tenantId || !apiKeyValue.trim()) return;
    setSavingApiKey(true);
    try {
      await saveTenant.mutateAsync({
        data: { geminiApiKey: apiKeyValue.trim() },
      });
      setApiKeyValue("");
      setApiKeyDialogOpen(false);
      toast.success("API key updated");
    } catch (err) {
      toast.error("Failed to update API key", {
        description: err instanceof Error ? err.message : "Please try again",
      });
    } finally {
      setSavingApiKey(false);
    }
  };

  const handleRemoveApiKey = async () => {
    if (!tenantId) return;
    setRemovingApiKey(true);
    try {
      await saveTenant.mutateAsync({
        data: { geminiApiKey: "" },
      });
      toast.success("API key removed");
    } catch (err) {
      toast.error("Failed to remove API key", {
        description: err instanceof Error ? err.message : "Please try again",
      });
    } finally {
      setRemovingApiKey(false);
    }
  };

  const startEditBranding = () => {
    setBrandingForm({
      primaryColor: tenant?.branding?.primaryColor ?? "",
      accentColor: tenant?.branding?.accentColor ?? "",
      logoUrl: tenant?.branding?.logoUrl ?? tenant?.logoUrl ?? "",
    });
    setIsEditingBranding(true);
  };

  const handleSaveBranding = async () => {
    if (!tenantId) return;
    // Validate hex colors
    const hexRegex = /^#([0-9A-Fa-f]{6})$/;
    if (brandingForm.primaryColor && !hexRegex.test(brandingForm.primaryColor)) {
      toast.error("Primary color must be a valid hex color (e.g., #3B82F6)");
      return;
    }
    if (brandingForm.accentColor && !hexRegex.test(brandingForm.accentColor)) {
      toast.error("Accent color must be a valid hex color (e.g., #10B981)");
      return;
    }
    setSavingBranding(true);
    try {
      await saveTenant.mutateAsync({
        data: {
          branding: {
            primaryColor: brandingForm.primaryColor || undefined,
            accentColor: brandingForm.accentColor || undefined,
            logoUrl: brandingForm.logoUrl || undefined,
          },
        },
      });
      setIsEditingBranding(false);
      toast.success("Branding updated");
    } catch (err) {
      toast.error("Failed to update branding", {
        description: err instanceof Error ? err.message : "Please try again",
      });
    } finally {
      setSavingBranding(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm">Manage your school's configuration</p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as SettingsTab)}>
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="tenant">Settings</TabsTrigger>
          <TabsTrigger value="evaluation">Evaluation</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="api">API Keys</TabsTrigger>
        </TabsList>

        <TabsContent value="tenant">
          <div className="space-y-4">
            <div className="bg-card rounded-lg border p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-semibold">School Information</h3>
                {!isEditingSchool ? (
                  <Button variant="link" size="sm" onClick={startEditSchool}>
                    Edit
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setIsEditingSchool(false)}>
                      Cancel
                    </Button>
                    <Button size="sm" onClick={handleSaveSchool} disabled={savingSchool}>
                      {savingSchool ? "Saving..." : "Save"}
                    </Button>
                  </div>
                )}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>School Name</Label>
                  <Input
                    type="text"
                    value={isEditingSchool ? schoolForm.name : (tenant?.name ?? "")}
                    onChange={(e) => setSchoolForm((p) => ({ ...p, name: e.target.value }))}
                    readOnly={!isEditingSchool}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tenant Code</Label>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      defaultValue={tenant?.tenantCode ?? ""}
                      className="bg-muted font-mono"
                      readOnly
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        navigator.clipboard.writeText(tenant?.tenantCode ?? "");
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                        toast.success("Tenant code copied!");
                      }}
                      aria-label="Copy tenant code"
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Contact Email</Label>
                  <Input
                    type="email"
                    value={isEditingSchool ? schoolForm.contactEmail : (tenant?.contactEmail ?? "")}
                    onChange={(e) => setSchoolForm((p) => ({ ...p, contactEmail: e.target.value }))}
                    readOnly={!isEditingSchool}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Contact Phone</Label>
                  <Input
                    type="text"
                    value={isEditingSchool ? schoolForm.contactPhone : (tenant?.contactPhone ?? "")}
                    onChange={(e) => setSchoolForm((p) => ({ ...p, contactPhone: e.target.value }))}
                    readOnly={!isEditingSchool}
                  />
                </div>
              </div>
            </div>

            <div className="bg-card rounded-lg border p-6">
              <h3 className="mb-4 font-semibold">Subscription</h3>
              <dl className="grid gap-4 text-sm md:grid-cols-3">
                <div>
                  <dt className="text-muted-foreground">Plan</dt>
                  <dd className="mt-1 font-semibold capitalize">
                    {tenant?.subscription?.plan ?? "--"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Max Students</dt>
                  <dd className="mt-1 font-semibold">
                    {tenant?.subscription?.maxStudents ?? "Unlimited"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Max Teachers</dt>
                  <dd className="mt-1 font-semibold">
                    {tenant?.subscription?.maxTeachers ?? "Unlimited"}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="evaluation">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground text-sm">
                Configure evaluation feedback rubrics and dimension settings
              </p>
            </div>

            {evalLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : !evalSettings?.length ? (
              <div className="rounded-lg border border-dashed p-12 text-center">
                <h3 className="text-lg font-semibold">No evaluation settings configured</h3>
                <p className="text-muted-foreground mt-1 text-sm">
                  A default configuration will be created automatically
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {evalSettings.map((setting) => (
                  <div
                    key={setting.id}
                    className="bg-card rounded-lg border p-4 transition-shadow hover:shadow-sm"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{setting.name}</h3>
                          {setting.isDefault && (
                            <span className="bg-primary/10 text-primary inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium">
                              Default
                            </span>
                          )}
                        </div>
                        {setting.description && (
                          <p className="text-muted-foreground mt-1 text-sm">
                            {setting.description}
                          </p>
                        )}
                      </div>
                      {editingEvalId === setting.id ? (
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => setEditingEvalId(null)}>
                            Cancel
                          </Button>
                          <Button size="sm" onClick={handleSaveEval} disabled={savingEval}>
                            {savingEval ? "Saving..." : "Save"}
                          </Button>
                        </div>
                      ) : (
                        <Button variant="link" size="sm" onClick={() => startEditEval(setting)}>
                          Edit
                        </Button>
                      )}
                    </div>

                    {editingEvalId === setting.id ? (
                      <div className="mt-3 space-y-3">
                        <div>
                          <Label>Dimensions</Label>
                          <div className="mt-1 flex flex-wrap gap-2">
                            {evalForm.enabledDimensions.map((dim, idx) => (
                              <Button
                                key={dim.id}
                                variant={dim.enabled ? "default" : "secondary"}
                                size="sm"
                                className="h-auto px-2 py-0.5 text-xs"
                                onClick={() => {
                                  const updated = [...evalForm.enabledDimensions];
                                  updated[idx] = { ...dim, enabled: !dim.enabled };
                                  setEvalForm((p) => ({
                                    ...p,
                                    enabledDimensions: updated,
                                  }));
                                }}
                              >
                                {dim.name}
                              </Button>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-4">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={evalForm.showStrengths}
                              onCheckedChange={(checked) =>
                                setEvalForm((p) => ({ ...p, showStrengths: checked }))
                              }
                            />
                            <Label>Show strengths</Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={evalForm.showKeyTakeaway}
                              onCheckedChange={(checked) =>
                                setEvalForm((p) => ({ ...p, showKeyTakeaway: checked }))
                              }
                            />
                            <Label>Show key takeaway</Label>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {setting.enabledDimensions?.map((dim) => (
                            <span
                              key={dim.id}
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                dim.enabled
                                  ? "bg-primary/10 text-primary"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {dim.name}
                            </span>
                          ))}
                        </div>
                        <div className="text-muted-foreground mt-2 flex gap-4 text-xs">
                          <span>
                            Show strengths: {setting.displaySettings?.showStrengths ? "Yes" : "No"}
                          </span>
                          <span>
                            Show takeaway: {setting.displaySettings?.showKeyTakeaway ? "Yes" : "No"}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="branding">
          <div className="space-y-4">
            <div className="bg-card rounded-lg border p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-semibold">School Branding</h3>
                {!isEditingBranding ? (
                  <Button variant="link" size="sm" onClick={startEditBranding}>
                    Edit
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setIsEditingBranding(false)}>
                      Cancel
                    </Button>
                    <Button size="sm" onClick={handleSaveBranding} disabled={savingBranding}>
                      {savingBranding ? "Saving..." : "Save"}
                    </Button>
                  </div>
                )}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {tenantId && (
                  <div className="md:col-span-2">
                    <LogoUploader
                      tenantId={tenantId}
                      currentLogoUrl={tenant?.branding?.logoUrl ?? tenant?.logoUrl ?? ""}
                      onUploaded={(url) => {
                        setBrandingForm((p) => ({ ...p, logoUrl: url }));
                        if (!isEditingBranding) {
                          // Auto-save logo URL when uploaded outside edit mode
                          saveTenant
                            .mutateAsync({
                              data: {
                                branding: {
                                  primaryColor: tenant?.branding?.primaryColor || undefined,
                                  accentColor: tenant?.branding?.accentColor || undefined,
                                  logoUrl: url || undefined,
                                },
                              },
                            })
                            .catch(() => {
                              // Error handled by upload component
                            });
                        }
                      }}
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Primary Color</Label>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      value={
                        isEditingBranding
                          ? brandingForm.primaryColor
                          : (tenant?.branding?.primaryColor ?? "")
                      }
                      onChange={(e) =>
                        setBrandingForm((p) => ({ ...p, primaryColor: e.target.value }))
                      }
                      readOnly={!isEditingBranding}
                      placeholder="#3B82F6"
                    />
                    {(isEditingBranding
                      ? brandingForm.primaryColor
                      : tenant?.branding?.primaryColor) && (
                      <div
                        className="h-10 w-10 rounded-md border"
                        style={{
                          backgroundColor: isEditingBranding
                            ? brandingForm.primaryColor
                            : tenant?.branding?.primaryColor,
                        }}
                      />
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Accent Color</Label>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      value={
                        isEditingBranding
                          ? brandingForm.accentColor
                          : (tenant?.branding?.accentColor ?? "")
                      }
                      onChange={(e) =>
                        setBrandingForm((p) => ({ ...p, accentColor: e.target.value }))
                      }
                      readOnly={!isEditingBranding}
                      placeholder="#10B981"
                    />
                    {(isEditingBranding
                      ? brandingForm.accentColor
                      : tenant?.branding?.accentColor) && (
                      <div
                        className="h-10 w-10 rounded-md border"
                        style={{
                          backgroundColor: isEditingBranding
                            ? brandingForm.accentColor
                            : tenant?.branding?.accentColor,
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Live Branding Preview */}
              {(() => {
                const previewPrimary = isEditingBranding
                  ? brandingForm.primaryColor
                  : (tenant?.branding?.primaryColor ?? "");
                const previewAccent = isEditingBranding
                  ? brandingForm.accentColor
                  : (tenant?.branding?.accentColor ?? "");
                const previewLogo = isEditingBranding
                  ? brandingForm.logoUrl
                  : (tenant?.branding?.logoUrl ?? tenant?.logoUrl ?? "");
                if (!previewPrimary && !previewAccent && !previewLogo) return null;
                return (
                  <div className="bg-card mt-6 rounded-lg border p-4">
                    <h4 className="text-muted-foreground mb-3 text-sm font-medium">Preview</h4>
                    <div className="overflow-hidden rounded-lg border">
                      {/* Mock header */}
                      <div
                        className="flex items-center gap-3 px-4 py-3"
                        style={{ backgroundColor: previewPrimary || "hsl(var(--primary))" }}
                      >
                        {previewLogo ? (
                          <img
                            src={previewLogo}
                            alt="Logo preview"
                            loading="lazy"
                            decoding="async"
                            className="h-8 w-8 rounded bg-white/20 object-cover"
                          />
                        ) : (
                          <div className="h-8 w-8 rounded bg-white/20" />
                        )}
                        <span className="text-sm font-semibold text-white">
                          {tenant?.name ?? "School Name"}
                        </span>
                      </div>
                      {/* Mock content */}
                      <div className="bg-background space-y-3 p-4">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: previewAccent || "hsl(var(--primary))" }}
                          />
                          <div className="bg-muted h-3 w-32 rounded" />
                        </div>
                        <div className="flex gap-2">
                          <div
                            className="rounded px-3 py-1.5 text-xs font-medium text-white"
                            style={{ backgroundColor: previewPrimary || "hsl(var(--primary))" }}
                          >
                            Primary Button
                          </div>
                          <div
                            className="rounded border px-3 py-1.5 text-xs font-medium"
                            style={{
                              color: previewAccent || "hsl(var(--primary))",
                              borderColor: previewAccent || "hsl(var(--primary))",
                            }}
                          >
                            Accent Button
                          </div>
                        </div>
                        <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                          <div
                            className="h-full w-3/5 rounded-full"
                            style={{
                              backgroundColor:
                                previewAccent || previewPrimary || "hsl(var(--primary))",
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="api">
          <div className="space-y-4">
            <div className="bg-card rounded-lg border p-6">
              <h3 className="mb-4 font-semibold">Gemini API Key</h3>
              <p className="text-muted-foreground mb-4 text-sm">
                Configure the Google Gemini API key used for AI grading and chat features.
              </p>
              {apiKeyDialogOpen ? (
                <div className="space-y-3">
                  <Input
                    type="password"
                    value={apiKeyValue}
                    onChange={(e) => setApiKeyValue(e.target.value)}
                    placeholder="Enter Gemini API key..."
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={handleSetApiKey}
                      disabled={savingApiKey || !apiKeyValue.trim()}
                    >
                      {savingApiKey ? "Saving..." : "Save Key"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setApiKeyDialogOpen(false);
                        setApiKeyValue("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="border-input bg-muted text-muted-foreground flex h-10 items-center rounded-md border px-3 text-sm">
                      {tenant?.settings?.geminiKeySet ? "••••••••••••••••" : "No key configured"}
                    </div>
                  </div>
                  <Button onClick={() => setApiKeyDialogOpen(true)}>
                    {tenant?.settings?.geminiKeySet ? "Update Key" : "Set Key"}
                  </Button>
                  {tenant?.settings?.geminiKeySet && (
                    <Button
                      variant="destructive"
                      onClick={handleRemoveApiKey}
                      disabled={removingApiKey}
                    >
                      {removingApiKey ? "Removing..." : "Remove"}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
