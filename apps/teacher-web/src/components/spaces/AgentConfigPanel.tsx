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

interface AgentConfig {
  id: string;
  type: "evaluator" | "tutor";
  name: string;
  model?: string;
  systemPrompt?: string;
  enabled: boolean;
}

/** Loose view over the `@levelup/query` AgentView (fields are `unknown` at the seam). */
interface AgentView {
  id: string;
  type?: "evaluator" | "tutor";
  name?: string;
  modelOverride?: string;
  systemPrompt?: string;
  isActive?: boolean;
}

/** SDK AgentView → the panel's local `enabled`/`model` shape. */
function toConfig(v: AgentView): AgentConfig {
  return {
    id: v.id,
    type: v.type ?? "evaluator",
    name: v.name ?? "",
    model: v.modelOverride,
    systemPrompt: v.systemPrompt,
    enabled: v.isActive ?? true,
  };
}

interface AgentConfigPanelProps {
  spaceId: string;
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

  const handleAddAgent = async (type: "evaluator" | "tutor") => {
    if (!spaceId) return;
    try {
      const newAgent: Omit<AgentConfig, "id"> = {
        type,
        name: type === "evaluator" ? "AI Evaluator" : "AI Tutor",
        model: "gpt-4",
        systemPrompt: "",
        enabled: true,
      };
      const res = (await saveAgent.mutateAsync({
        spaceId,
        data: {
          type: newAgent.type,
          name: newAgent.name,
          modelOverride: newAgent.model,
          systemPrompt: newAgent.systemPrompt,
          isActive: newAgent.enabled,
        },
      })) as { id: string };
      setAgents((prev) => [...prev, { id: res.id, ...newAgent }]);
      sonnerToast.success(`${type === "evaluator" ? "Evaluator" : "Tutor"} agent added`);
    } catch (err) {
      handleError(err, "Failed to add agent");
    }
  };

  const handleSaveAgent = async (agent: AgentConfig) => {
    if (!spaceId) return;
    setSaving(agent.id);
    try {
      await saveAgent.mutateAsync({
        id: agent.id,
        spaceId,
        data: {
          type: agent.type,
          name: agent.name,
          modelOverride: agent.model,
          systemPrompt: agent.systemPrompt,
          isActive: agent.enabled,
        },
      });
      sonnerToast.success("Agent configuration saved");
    } catch (err) {
      handleError(err, "Failed to save agent");
    } finally {
      setSaving(null);
    }
  };

  const handleDeleteAgent = async (agentId: string) => {
    if (!spaceId) return;
    const agent = agents.find((a) => a.id === agentId);
    if (!agent) return;
    try {
      // Soft-delete via the save callable's `deleted` convention; `type`/`name`
      // are required by the strict request schema even when deleting.
      await saveAgent.mutateAsync({
        id: agentId,
        spaceId,
        data: { type: agent.type, name: agent.name, deleted: true },
      });
      setAgents((prev) => prev.filter((a) => a.id !== agentId));
      sonnerToast.success("Agent removed");
    } catch (err) {
      handleError(err, "Failed to remove agent");
    }
  };

  const updateAgent = (id: string, updates: Partial<AgentConfig>) => {
    setAgents((prev) => prev.map((a) => (a.id === id ? { ...a, ...updates } : a)));
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold">Agent Configuration</h2>
          <p className="text-muted-foreground text-sm">
            Configure AI evaluators and tutors for this space
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => handleAddAgent("evaluator")}>
            <Plus className="h-3.5 w-3.5" /> Add Evaluator
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
            Add an evaluator or tutor to enable AI-powered features
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="bg-card border-subtle shadow-e1 space-y-3 rounded-lg border p-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bot className="text-primary h-4 w-4" />
                  <Badge variant={agent.type === "evaluator" ? "default" : "secondary"}>
                    {agent.type}
                  </Badge>
                  <div className="flex items-center gap-1.5">
                    <Switch
                      checked={agent.enabled}
                      onCheckedChange={(v) => updateAgent(agent.id, { enabled: v })}
                      id={`enabled-${agent.id}`}
                    />
                    <Label
                      htmlFor={`enabled-${agent.id}`}
                      className="text-fg-secondary cursor-pointer text-xs"
                    >
                      Enabled
                    </Label>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    onClick={() => handleSaveAgent(agent)}
                    disabled={saving === agent.id}
                  >
                    <Save className="h-3 w-3" />
                    {saving === agent.id ? "Saving..." : "Save"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteAgent(agent.id)}
                    className="text-muted-foreground hover:text-destructive h-8 w-8"
                    aria-label="Delete agent"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label className="text-fg-secondary text-xs">Name</Label>
                  <Input
                    type="text"
                    value={agent.name}
                    onChange={(e) => updateAgent(agent.id, { name: e.target.value })}
                    className="mt-1 h-8"
                  />
                </div>
                <div>
                  <Label className="text-fg-secondary text-xs">Model</Label>
                  <Select
                    value={agent.model}
                    onValueChange={(v) => updateAgent(agent.id, { model: v })}
                  >
                    <SelectTrigger className="mt-1 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gpt-4">GPT-4</SelectItem>
                      <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                      <SelectItem value="claude-sonnet">Claude Sonnet</SelectItem>
                      <SelectItem value="claude-opus">Claude Opus</SelectItem>
                      <SelectItem value="gemini-pro">Gemini Pro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-fg-secondary text-xs">System Prompt</Label>
                <Textarea
                  value={agent.systemPrompt}
                  onChange={(e) => updateAgent(agent.id, { systemPrompt: e.target.value })}
                  rows={3}
                  placeholder={
                    agent.type === "evaluator"
                      ? "Instructions for how this evaluator should grade student responses..."
                      : "Instructions for how this tutor should help students..."
                  }
                  className="mt-1"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
