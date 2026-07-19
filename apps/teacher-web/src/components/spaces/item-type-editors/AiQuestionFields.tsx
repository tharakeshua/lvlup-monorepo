import type { AudioData, CodeData, ImageEvaluationData } from "@levelup/shared-types";
import { Button, Input, Label, Textarea } from "@levelup/shared-ui";
import type { ChatAgentAuthoringData } from "../item-authoring-model";

export type CodeAuthoringData = CodeData & { modelAnswer?: string };
export type AudioAuthoringData = AudioData & {
  promptAudioUrl?: string;
  modelAnswer?: string;
};
export type ImageAuthoringData = ImageEvaluationData & { modelAnswer?: string };
export type ChatAuthoringData = ChatAgentAuthoringData;

export function CodeModelSolutionFields({
  data,
  onChange,
}: {
  data: CodeAuthoringData;
  onChange: (updates: Partial<CodeAuthoringData>) => void;
}) {
  return (
    <div>
      <Label htmlFor="code-model-solution">Model Solution</Label>
      <Textarea
        id="code-model-solution"
        value={data.modelAnswer ?? ""}
        onChange={(event) => onChange({ modelAnswer: event.target.value || undefined })}
        rows={4}
        className="mt-1 font-mono"
        placeholder="Optional reference solution used by evaluation"
      />
    </div>
  );
}

export function AudioEvaluationFields({
  data,
  onChange,
}: {
  data: AudioAuthoringData;
  onChange: (updates: Partial<AudioAuthoringData>) => void;
}) {
  return (
    <>
      <div className="sm:col-span-2">
        <Label htmlFor="audio-prompt-url">Prompt Audio URL</Label>
        <Input
          id="audio-prompt-url"
          type="url"
          value={data.promptAudioUrl ?? ""}
          onChange={(event) => onChange({ promptAudioUrl: event.target.value || undefined })}
          placeholder="https://..."
          className="mt-1"
        />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="audio-model-answer">Model Answer</Label>
        <Textarea
          id="audio-model-answer"
          value={data.modelAnswer ?? ""}
          onChange={(event) => onChange({ modelAnswer: event.target.value || undefined })}
          rows={2}
          className="mt-1"
        />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="audio-evaluation-guidance">Evaluation Guidance</Label>
        <Textarea
          id="audio-evaluation-guidance"
          value={data.evaluationGuidance ?? ""}
          onChange={(event) => onChange({ evaluationGuidance: event.target.value || undefined })}
          rows={2}
          className="mt-1"
        />
      </div>
    </>
  );
}

export function ImageEvaluationAnswerFields({
  data,
  onChange,
}: {
  data: ImageAuthoringData;
  onChange: (updates: Partial<ImageAuthoringData>) => void;
}) {
  return (
    <>
      <div>
        <Label htmlFor="image-model-answer">Model Answer</Label>
        <Textarea
          id="image-model-answer"
          value={data.modelAnswer ?? ""}
          onChange={(event) => onChange({ modelAnswer: event.target.value || undefined })}
          rows={2}
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="image-evaluation-guidance">Evaluation Guidance</Label>
        <Textarea
          id="image-evaluation-guidance"
          value={data.evaluationGuidance ?? ""}
          onChange={(event) => onChange({ evaluationGuidance: event.target.value || undefined })}
          rows={2}
          className="mt-1"
        />
      </div>
    </>
  );
}

export function ChatAgentAnswerFields({
  data,
  onChange,
}: {
  data: ChatAuthoringData;
  onChange: (updates: Partial<ChatAuthoringData>) => void;
}) {
  const privateObjectives = data.privateEvaluationObjectives ?? [];
  const updatePrivateObjective = (index: number, updates: Record<string, string | undefined>) => {
    onChange({
      privateEvaluationObjectives: privateObjectives.map((objective, current) =>
        current === index ? { ...objective, ...updates } : objective
      ),
    });
  };
  return (
    <div className="space-y-4 border-t pt-4">
      <p className="text-fg-secondary text-sm font-medium">Private evaluation key</p>
      <div>
        <Label htmlFor="chat-model-answer">Model Answer</Label>
        <Textarea
          id="chat-model-answer"
          value={data.modelAnswer ?? ""}
          onChange={(event) => onChange({ modelAnswer: event.target.value || undefined })}
          rows={2}
          className="mt-1"
          placeholder="Optional reference response; visible only to authorized authors/evaluation."
        />
      </div>
      <div>
        <Label htmlFor="chat-evaluation-guidance">Evaluation Guidance</Label>
        <Textarea
          id="chat-evaluation-guidance"
          value={data.evaluationGuidance ?? ""}
          onChange={(event) => onChange({ evaluationGuidance: event.target.value || undefined })}
          rows={2}
          className="mt-1"
          placeholder="Private evaluator guidance."
        />
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Label>Private evaluation objectives</Label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              onChange({
                privateEvaluationObjectives: [
                  ...privateObjectives,
                  {
                    id: `private_objective_${privateObjectives.length + 1}`,
                    rubricDimensionId: "",
                    description: "",
                  },
                ],
              })
            }
          >
            Add private objective
          </Button>
        </div>
        {privateObjectives.map((objective, index) => (
          <div
            key={`${objective.id}-${index}`}
            className="bg-surface-sunken space-y-2 rounded-md p-3"
          >
            <div className="grid gap-2 sm:grid-cols-2">
              <Input
                value={objective.id}
                onChange={(event) => updatePrivateObjective(index, { id: event.target.value })}
                placeholder="Objective ID"
                aria-label={`Private objective ${index + 1} ID`}
              />
              <Input
                value={objective.rubricDimensionId}
                onChange={(event) =>
                  updatePrivateObjective(index, { rubricDimensionId: event.target.value })
                }
                placeholder="Rubric dimension ID"
                aria-label={`Private objective ${index + 1} rubric dimension ID`}
              />
            </div>
            <Textarea
              value={objective.description}
              onChange={(event) =>
                updatePrivateObjective(index, { description: event.target.value })
              }
              rows={2}
              placeholder="What evidence should this objective assess?"
              aria-label={`Private objective ${index + 1} description`}
            />
            <Input
              value={objective.evidenceRequirement ?? ""}
              onChange={(event) =>
                updatePrivateObjective(index, {
                  evidenceRequirement: event.target.value || undefined,
                })
              }
              placeholder="Optional evidence requirement"
              aria-label={`Private objective ${index + 1} evidence requirement`}
            />
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-destructive"
              onClick={() =>
                onChange({
                  privateEvaluationObjectives: privateObjectives.filter(
                    (_, current) => current !== index
                  ),
                })
              }
            >
              Remove objective
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
