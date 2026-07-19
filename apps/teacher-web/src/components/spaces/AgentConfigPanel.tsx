import { useState, useEffect } from "react";
import { useApiError, useSaveAgent, useRepos } from "@levelup/query";
import {
  sonnerToast,
  Button,
  Input,
  Label,
  Textarea,
  Switch,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Badge,
} from "@levelup/shared-ui";
import { Bot, Plus, Trash2, Save } from "lucide-react";

type AgentType = "evaluator" | "tutor" | "interviewer";
type ModelPolicyId = "conversation.fast" | "conversation.quality" | "evaluation.quality";

interface AgentConfig {
  id: string;
  type: AgentType;
  name: string;
  modelPolicyId: ModelPolicyId;
  publicDescription?: string;
  identity?: string;
  systemPrompt?: string;
  openingMessage?: string;
  supportedLanguages: string[];
  defaultLanguage?: string;
  maxConversationTurns?: number;
  rules: string[];
  evaluationObjectives: string[];
  strictness?: number;
  feedbackStyle?: string;
  temperatureOverride?: number;
  enabled: boolean;
  version: number;
}

/** Loose view over the query AgentView; canonical fields are normalized below. */
interface AgentView {
  id: string;
  type?: AgentType;
  name?: string;
  modelPolicyId?: ModelPolicyId;
  publicDescription?: string;
  identity?: string;
  systemPrompt?: string;
  openingMessage?: string;
  supportedLanguages?: string[];
  defaultLanguage?: string;
  maxConversationTurns?: number;
  rules?: string[];
  evaluationObjectives?: string[];
  strictness?: number;
  feedbackStyle?: string;
  temperatureOverride?: number;
  isActive?: boolean;
  version?: number;
}

function defaultPolicy(type: AgentType): ModelPolicyId {
  return type === "evaluator" ? "evaluation.quality" : "conversation.quality";
}

/** SDK AgentView → local editing state, including a safe legacy default. */
function toConfig(v: AgentView): AgentConfig {
  const type = v.type ?? "tutor";
  return {
    id: v.id,
    type,
    name: v.name ?? "",
    modelPolicyId: v.modelPolicyId ?? defaultPolicy(type),
    publicDescription: v.publicDescription,
    identity: v.identity,
    systemPrompt: v.systemPrompt,
    openingMessage: v.openingMessage,
    supportedLanguages: v.supportedLanguages ?? [],
    defaultLanguage: v.defaultLanguage,
    maxConversationTurns: v.maxConversationTurns,
    rules: v.rules ?? [],
    evaluationObjectives: v.evaluationObjectives ?? [],
    strictness: v.strictness,
    feedbackStyle: v.feedbackStyle,
    temperatureOverride: v.temperatureOverride,
    enabled: v.isActive ?? true,
    version: v.version ?? 1,
  };
}

interface AgentConfigPanelProps {
  spaceId: string;
}

function lines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export default function AgentConfigPanel({ spaceId }: AgentConfigPanelProps) {
  const { handleError } = useApiError();
  const { agentRepo } = useRepos();
  const saveAgent = useSaveAgent();
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (!spaceId) return;
    let cancelled = false;
    (async () => {
      try {
        const page = (await agentRepo.list({ spaceId })) as { items: AgentView[] };
        if (!cancelled) setAgents((page?.items ?? []).map(toConfig));
      } catch (err) {
        if (!cancelled) handleError(err, "Failed to load agents");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [spaceId, agentRepo, handleError]);

  const requestData = (agent: Omit<AgentConfig, "id" | "version">, deleted = false) => ({
    type: agent.type,
    name: agent.name.trim(),
    publicDescription: agent.publicDescription || undefined,
    identity: agent.identity || undefined,
    isActive: deleted ? false : agent.enabled,
    systemPrompt: agent.systemPrompt || undefined,
    openingMessage: agent.openingMessage || undefined,
    supportedLanguages: agent.supportedLanguages,
    defaultLanguage: agent.defaultLanguage || undefined,
    maxConversationTurns: agent.maxConversationTurns,
    rules: agent.rules,
    evaluationObjectives: agent.type === "evaluator" ? agent.evaluationObjectives : undefined,
    strictness: agent.strictness,
    feedbackStyle: agent.feedbackStyle || undefined,
    modelPolicyId: agent.modelPolicyId,
    temperatureOverride: agent.temperatureOverride,
    ...(deleted ? { deleted: true as const } : {}),
  });

  const handleAddAgent = async (type: AgentType) => {
    if (!spaceId) return;
    const newAgent: Omit<AgentConfig, "id" | "version"> = {
      type,
      name:
        type === "evaluator"
          ? "AI Evaluator"
          : type === "interviewer"
            ? "AI Interviewer"
            : "AI Tutor",
      modelPolicyId: defaultPolicy(type),
      publicDescription: "",
      identity: "",
      systemPrompt: "",
      openingMessage: type === "interviewer" ? "Let’s begin the interview when you are ready." : "",
      supportedLanguages: [],
      defaultLanguage: "",
      maxConversationTurns: undefined,
      rules: [],
      evaluationObjectives: [],
      enabled: true,
      temperatureOverride: undefined,
    };
    try {
      const res = (await saveAgent.mutateAsync({
        spaceId,
        data: requestData(newAgent),
      })) as { id: string; version: number };
      setAgents((prev) => [...prev, { id: res.id, version: res.version, ...newAgent }]);
      sonnerToast.success(`${type[0]!.toUpperCase()}${type.slice(1)} agent added`);
    } catch (err) {
      handleError(err, "Failed to add agent");
    }
  };

  const handleSaveAgent = async (agent: AgentConfig) => {
    if (!spaceId) return;
    setSaving(agent.id);
    try {
      const { id: _id, version, ...body } = agent;
      void _id;
      const result = (await saveAgent.mutateAsync({
        id: agent.id,
        expectedVersion: version,
        spaceId,
        data: requestData(body),
      })) as { version: number };
      updateAgent(agent.id, { version: result.version });
      sonnerToast.success("Agent configuration saved");
    } catch (err) {
      handleError(err, "Failed to save agent");
    } finally {
      setSaving(null);
    }
  };

  const handleDeactivateAgent = async (agent: AgentConfig) => {
    if (!spaceId) return;
    setSaving(agent.id);
    try {
      const { id: _id, version, ...body } = agent;
      void _id;
      const result = (await saveAgent.mutateAsync({
        id: agent.id,
        expectedVersion: version,
        spaceId,
        data: requestData(body, true),
      })) as { version: number };
      updateAgent(agent.id, { enabled: false, version: result.version });
      sonnerToast.success("Agent deactivated; prior conversations remain auditable");
    } catch (err) {
      handleError(err, "Failed to deactivate agent");
    } finally {
      setSaving(null);
    }
  };

  const updateAgent = (id: string, updates: Partial<AgentConfig>) => {
    setAgents((prev) => prev.map((agent) => (agent.id === id ? { ...agent, ...updates } : agent)));
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="bg-surface-sunken border-subtle h-24 animate-pulse rounded-lg border"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">Agent Configuration</h2>
          <p className="text-muted-foreground text-sm">
            Configure tutor, interviewer, and evaluator policies for this space.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => handleAddAgent("evaluator")}>
            <Plus className="h-3.5 w-3.5" /> Add Evaluator
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleAddAgent("interviewer")}>
            <Plus className="h-3.5 w-3.5" /> Add Interviewer
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleAddAgent("tutor")}>
            <Plus className="h-3.5 w-3.5" /> Add Tutor
          </Button>
        </div>
      </div>

      {agents.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
          <Bot className="text-fg-muted h-8 w-8" />
          <p className="font-display mt-2 text-lg">No agents configured yet</p>
          <p className="text-muted-foreground mt-1 text-xs">
            Add an interviewer before creating a chat-agent assessment.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="bg-card border-subtle shadow-e1 space-y-3 rounded-lg border p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Bot className="text-primary h-4 w-4" />
                  <Badge variant={agent.type === "evaluator" ? "default" : "secondary"}>
                    {agent.type}
                  </Badge>
                  <span className="text-muted-foreground text-xs">v{agent.version}</span>
                  <div className="flex items-center gap-1.5">
                    <Switch
                      checked={agent.enabled}
                      onCheckedChange={(enabled) => updateAgent(agent.id, { enabled })}
                      id={`enabled-${agent.id}`}
                    />
                    <Label
                      htmlFor={`enabled-${agent.id}`}
                      className="text-fg-secondary cursor-pointer text-xs"
                    >
                      Active
                    </Label>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    onClick={() => handleSaveAgent(agent)}
                    disabled={saving === agent.id}
                  >
                    <Save className="h-3 w-3" /> {saving === agent.id ? "Saving..." : "Save"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeactivateAgent(agent)}
                    disabled={saving === agent.id || !agent.enabled}
                    className="text-muted-foreground hover:text-destructive h-8 w-8"
                    aria-label="Deactivate agent"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label className="text-fg-secondary text-xs">Name</Label>
                  <Input
                    value={agent.name}
                    onChange={(event) => updateAgent(agent.id, { name: event.target.value })}
                    className="mt-1 h-8"
                  />
                </div>
                <div>
                  <Label className="text-fg-secondary text-xs">Model policy</Label>
                  <Select
                    value={agent.modelPolicyId}
                    onValueChange={(modelPolicyId) =>
                      updateAgent(agent.id, { modelPolicyId: modelPolicyId as ModelPolicyId })
                    }
                  >
                    <SelectTrigger className="mt-1 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {agent.type === "evaluator" ? (
                        <SelectItem value="evaluation.quality">Evaluation quality</SelectItem>
                      ) : (
                        <>
                          <SelectItem value="conversation.fast">Conversation fast</SelectItem>
                          <SelectItem value="conversation.quality">Conversation quality</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-fg-secondary text-xs">Learner-safe description</Label>
                <Input
                  value={agent.publicDescription ?? ""}
                  onChange={(event) =>
                    updateAgent(agent.id, { publicDescription: event.target.value })
                  }
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-fg-secondary text-xs">Persona identity</Label>
                <Input
                  value={agent.identity ?? ""}
                  onChange={(event) => updateAgent(agent.id, { identity: event.target.value })}
                  className="mt-1"
                  placeholder="Optional authoring persona identity"
                />
              </div>
              <div>
                <Label className="text-fg-secondary text-xs">System prompt</Label>
                <Textarea
                  value={agent.systemPrompt ?? ""}
                  onChange={(event) => updateAgent(agent.id, { systemPrompt: event.target.value })}
                  rows={3}
                  className="mt-1"
                  placeholder="Authoring-only persona instructions"
                />
              </div>
              <div>
                <Label className="text-fg-secondary text-xs">Opening message</Label>
                <Textarea
                  value={agent.openingMessage ?? ""}
                  onChange={(event) =>
                    updateAgent(agent.id, { openingMessage: event.target.value })
                  }
                  rows={2}
                  className="mt-1"
                  placeholder="Optional static learner-safe opening message"
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <div>
                  <Label className="text-fg-secondary text-xs">
                    Supported languages (one per line)
                  </Label>
                  <Textarea
                    value={agent.supportedLanguages.join("\n")}
                    onChange={(event) =>
                      updateAgent(agent.id, { supportedLanguages: lines(event.target.value) })
                    }
                    rows={3}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-fg-secondary text-xs">Default language</Label>
                  <Input
                    value={agent.defaultLanguage ?? ""}
                    onChange={(event) =>
                      updateAgent(agent.id, { defaultLanguage: event.target.value })
                    }
                    className="mt-1"
                    placeholder="e.g. en"
                  />
                  <Label className="text-fg-secondary mt-3 block text-xs">
                    Maximum conversation turns
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    value={agent.maxConversationTurns ?? ""}
                    onChange={(event) =>
                      updateAgent(agent.id, {
                        maxConversationTurns:
                          event.target.value === "" ? undefined : Number(event.target.value),
                      })
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-fg-secondary text-xs">Rules (one per line)</Label>
                  <Textarea
                    value={agent.rules.join("\n")}
                    onChange={(event) =>
                      updateAgent(agent.id, { rules: lines(event.target.value) })
                    }
                    rows={3}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-fg-secondary text-xs">Feedback style</Label>
                  <Input
                    value={agent.feedbackStyle ?? ""}
                    onChange={(event) =>
                      updateAgent(agent.id, { feedbackStyle: event.target.value })
                    }
                    className="mt-1"
                  />
                  <Label className="text-fg-secondary mt-3 block text-xs">Strictness</Label>
                  <Input
                    type="number"
                    value={agent.strictness ?? ""}
                    onChange={(event) =>
                      updateAgent(agent.id, {
                        strictness:
                          event.target.value === "" ? undefined : Number(event.target.value),
                      })
                    }
                    className="mt-1"
                  />
                  <Label className="text-fg-secondary mt-3 block text-xs">
                    Temperature override
                  </Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={agent.temperatureOverride ?? ""}
                    onChange={(event) =>
                      updateAgent(agent.id, {
                        temperatureOverride:
                          event.target.value === "" ? undefined : Number(event.target.value),
                      })
                    }
                    className="mt-1"
                  />
                </div>
              </div>
              {agent.type === "evaluator" && (
                <div>
                  <Label className="text-fg-secondary text-xs">
                    Evaluator persona objectives (one per line)
                  </Label>
                  <Textarea
                    value={agent.evaluationObjectives.join("\n")}
                    onChange={(event) =>
                      updateAgent(agent.id, { evaluationObjectives: lines(event.target.value) })
                    }
                    rows={3}
                    className="mt-1"
                    placeholder="Reusable evaluator-persona goals, not item-specific private objectives"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
