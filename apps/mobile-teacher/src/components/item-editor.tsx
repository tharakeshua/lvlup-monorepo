/**
 * Item editor component suite (CC-7 question-creation lane).
 *
 * Exports:
 *   CommonItemFields       — shared fields for all item types
 *   McqEditor              — MCQ / MCAQ
 *   TrueFalseEditor        — True/False
 *   NumericalEditor        — Numerical
 *   TextShortEditor        — Short answer
 *   ParagraphEditor        — Long answer / paragraph
 *   CodeEditorPayload      — Code (language, starter, test cases)
 *   FillBlanksEditor       — Fill in the blanks
 *   FillBlanksDdEditor     — Fill in the blanks drag & drop
 *   MatchingEditor         — Matching pairs
 *   JumbledEditor          — Jumbled / reorder
 *   AudioEditor            — Audio response
 *   ImageEvalEditor        — Image evaluation
 *   GroupOptionsEditor     — Group options
 *   ChatAgentEditor        — Chat-agent question
 *   QuestionPayloadEditor  — Router → correct editor by questionType
 *   MaterialPayloadEditor  — Placeholder for material types
 */
import { Pressable, Switch, Text, View } from "react-native";
import {
  qfAddBlank,
  qfAddBlankDd,
  qfAddGroup,
  qfAddGroupItem,
  qfAddOption,
  qfAddPair,
  qfAddPoolOption,
  qfAddTestCase,
  qfAddToken,
  qfRemoveBlank,
  qfRemoveBlankDd,
  qfRemoveGroup,
  qfRemoveGroupItem,
  qfRemoveOption,
  qfRemovePair,
  qfRemovePoolOption,
  qfRemoveTestCase,
  qfRemoveToken,
  qfRenameGroup,
  qfUpdateBlank,
  qfUpdateGroupItem,
  qfUpdateOption,
  qfUpdatePair,
  qfUpdatePoolOption,
  qfUpdateTestCase,
  qfUpdateToken,
  qfMoveOptionUp,
  qfMoveOptionDown,
  qfMovePairUp,
  qfMovePairDown,
  qfMoveTokenUp,
  qfMoveTokenDown,
} from "@levelup/query";

import { Button, Card, Divider, IconButton } from "./primitives";
import { TextField } from "./forms";
import { colors } from "../theme";

// ─── helpers ────────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: string }) {
  return (
    <Text className="text-text-secondary mb-1 text-xs font-semibold uppercase tracking-wide">
      {children}
    </Text>
  );
}

function RowError({ message }: { message?: string }) {
  if (!message) return null;
  return <Text className="text-error mt-0.5 text-xs">{message}</Text>;
}

function RadioDot({ selected }: { selected: boolean }) {
  return (
    <View
      className="h-5 w-5 items-center justify-center rounded-full border"
      style={{
        borderColor: selected ? colors.brand : colors.textMuted,
        backgroundColor: "transparent",
      }}
    >
      {selected && (
        <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colors.brand }} />
      )}
    </View>
  );
}

function CheckboxBox({ checked }: { checked: boolean }) {
  return (
    <View
      className="h-5 w-5 items-center justify-center rounded-sm border"
      style={{
        borderColor: checked ? colors.brand : colors.textMuted,
        backgroundColor: checked ? colors.brand : "transparent",
      }}
    >
      {checked && (
        <Text className="text-xs font-bold" style={{ color: colors.textOnAccent }}>
          ✓
        </Text>
      )}
    </View>
  );
}

type ChipSelectProps = {
  options: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
};
function ChipSelect({ options, value, onChange }: ChipSelectProps) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            className="rounded-full border px-3 py-1.5"
            style={{
              borderColor: active ? colors.brand : colors.textMuted,
              backgroundColor: active ? colors.brand : "transparent",
            }}
          >
            <Text
              className="text-sm font-semibold"
              style={{ color: active ? colors.textOnAccent : colors.textSecondary }}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── CommonItemFields ────────────────────────────────────────────────────────

export type CommonItemFieldsProps = {
  title: string;
  onTitleChange: (v: string) => void;
  prompt: string;
  onPromptChange: (v: string) => void;
  difficulty: string;
  onDifficultyChange: (v: string) => void;
  basePoints: number;
  onPointsChange: (v: number) => void;
  explanation: string;
  onExplanationChange: (v: string) => void;
  blooms?: string;
  onBloomsChange?: (v: string) => void;
  topics?: string;
  onTopicsChange?: (v: string) => void;
  labels?: string;
  onLabelsChange?: (v: string) => void;
};

export function CommonItemFields({
  title,
  onTitleChange,
  prompt,
  onPromptChange,
  difficulty,
  onDifficultyChange,
  basePoints,
  onPointsChange,
  explanation,
  onExplanationChange,
  blooms,
  onBloomsChange,
  topics,
  onTopicsChange,
  labels,
  onLabelsChange,
}: CommonItemFieldsProps) {
  const difficultyOptions = [
    { label: "Easy", value: "easy" },
    { label: "Medium", value: "medium" },
    { label: "Hard", value: "hard" },
  ];

  return (
    <View className="gap-4">
      <TextField
        label="Title"
        required
        value={title}
        onChangeText={onTitleChange}
        placeholder="Enter question title"
      />
      <TextField
        label="Prompt / Content"
        value={prompt}
        onChangeText={onPromptChange}
        placeholder="Enter the question text or content"
        multiline
      />
      <View className="gap-1.5">
        <Text className="font-ui text-text-secondary text-sm font-semibold">Difficulty</Text>
        <ChipSelect options={difficultyOptions} value={difficulty} onChange={onDifficultyChange} />
      </View>
      <TextField
        label="Base Points"
        value={String(basePoints)}
        onChangeText={(v) => onPointsChange(Number(v) || 0)}
        keyboardType="numeric"
        placeholder="1"
      />
      <TextField
        label="Explanation (shown after answer)"
        value={explanation}
        onChangeText={onExplanationChange}
        placeholder="Optional explanation shown to student after answering"
        multiline
      />
      {onBloomsChange != null && (
        <TextField
          label="Bloom's Level"
          value={blooms ?? ""}
          onChangeText={onBloomsChange}
          placeholder="e.g. Remember, Understand, Apply…"
        />
      )}
      {onTopicsChange != null && (
        <TextField
          label="Topics (comma-separated)"
          value={topics ?? ""}
          onChangeText={onTopicsChange}
          placeholder="e.g. algebra, geometry"
        />
      )}
      {onLabelsChange != null && (
        <TextField
          label="Labels (comma-separated)"
          value={labels ?? ""}
          onChangeText={onLabelsChange}
          placeholder="e.g. exam-2025, revision"
        />
      )}
    </View>
  );
}

// ─── McqEditor ───────────────────────────────────────────────────────────────

export type McqEditorProps = {
  payload: Record<string, unknown>;
  onChange: (p: Record<string, unknown>) => void;
  multi?: boolean;
};

type McqOption = { id: string; text: string; isCorrect?: boolean };

export function McqEditor({ payload, onChange, multi = false }: McqEditorProps) {
  const options = (payload.options as McqOption[] | undefined) ?? [];
  const minSelections = (payload.minSelections as number | undefined) ?? 1;
  const maxSelections = (payload.maxSelections as number | undefined) ?? options.length;

  return (
    <View className="gap-3">
      <SectionLabel>Options</SectionLabel>
      {options.map((opt, idx) => (
        <Card key={opt.id} className="gap-2 p-3">
          <View className="flex-row items-center gap-2">
            <Pressable
              onPress={() =>
                onChange(
                  qfUpdateOption(payload, opt.id, {
                    isCorrect: multi ? !opt.isCorrect : true,
                  })
                )
              }
              hitSlop={8}
            >
              {multi ? (
                <CheckboxBox checked={!!opt.isCorrect} />
              ) : (
                <Pressable
                  onPress={() => {
                    const updated = options.map((o) => ({ ...o, isCorrect: o.id === opt.id }));
                    onChange({ ...payload, options: updated });
                  }}
                  hitSlop={8}
                >
                  <RadioDot selected={!!opt.isCorrect} />
                </Pressable>
              )}
            </Pressable>
            <View className="flex-1">
              <TextField
                value={opt.text}
                onChangeText={(v) => onChange(qfUpdateOption(payload, opt.id, { text: v }))}
                placeholder={`Option ${idx + 1}`}
              />
            </View>
            <IconButton
              icon="chevron-up"
              size="sm"
              label="Move up"
              onPress={() => onChange(qfMoveOptionUp(payload, opt.id))}
              disabled={idx === 0}
            />
            <IconButton
              icon="chevron-down"
              size="sm"
              label="Move down"
              onPress={() => onChange(qfMoveOptionDown(payload, opt.id))}
              disabled={idx === options.length - 1}
            />
            <IconButton
              icon="trash-2"
              size="sm"
              variant="danger"
              label="Remove option"
              onPress={() => onChange(qfRemoveOption(payload, opt.id))}
            />
          </View>
        </Card>
      ))}
      <Button variant="secondary" size="sm" onPress={() => onChange(qfAddOption(payload))}>
        + Add option
      </Button>
      {multi && (
        <>
          <Divider />
          <View className="flex-row gap-3">
            <View className="flex-1">
              <TextField
                label="Min selections"
                value={String(minSelections)}
                onChangeText={(v) => onChange({ ...payload, minSelections: Number(v) || 1 })}
                keyboardType="numeric"
              />
            </View>
            <View className="flex-1">
              <TextField
                label="Max selections"
                value={String(maxSelections)}
                onChangeText={(v) =>
                  onChange({ ...payload, maxSelections: Number(v) || options.length })
                }
                keyboardType="numeric"
              />
            </View>
          </View>
        </>
      )}
    </View>
  );
}

// ─── TrueFalseEditor ─────────────────────────────────────────────────────────

export type TrueFalseEditorProps = {
  payload: Record<string, unknown>;
  onChange: (p: Record<string, unknown>) => void;
};

export function TrueFalseEditor({ payload, onChange }: TrueFalseEditorProps) {
  const correct = payload.correctAnswer as boolean | undefined;

  return (
    <View className="gap-2">
      <SectionLabel>Correct answer</SectionLabel>
      {([true, false] as const).map((val) => (
        <Pressable
          key={String(val)}
          onPress={() => onChange({ ...payload, correctAnswer: val })}
          className="flex-row items-center gap-3 rounded-lg border p-3"
          style={{
            borderColor: correct === val ? colors.brand : colors.textMuted,
            backgroundColor: correct === val ? `${colors.brand}12` : "transparent",
          }}
        >
          <RadioDot selected={correct === val} />
          <Text
            className="text-base font-semibold"
            style={{ color: correct === val ? colors.brand : colors.textSecondary }}
          >
            {val ? "True" : "False"}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

// ─── NumericalEditor ─────────────────────────────────────────────────────────

export type NumericalEditorProps = {
  payload: Record<string, unknown>;
  onChange: (p: Record<string, unknown>) => void;
};

export function NumericalEditor({ payload, onChange }: NumericalEditorProps) {
  return (
    <View className="gap-3">
      <TextField
        label="Correct answer"
        value={String(payload.correctAnswer ?? "")}
        onChangeText={(v) => onChange({ ...payload, correctAnswer: Number(v) })}
        keyboardType="numeric"
        placeholder="0"
      />
      <TextField
        label="Tolerance (±)"
        value={String(payload.tolerance ?? "")}
        onChangeText={(v) => onChange({ ...payload, tolerance: Number(v) })}
        keyboardType="numeric"
        placeholder="0"
        hint="Accepted range: answer ± tolerance"
      />
      <TextField
        label="Unit (optional)"
        value={String(payload.unit ?? "")}
        onChangeText={(v) => onChange({ ...payload, unit: v })}
        placeholder="e.g. kg, m/s, °C"
      />
    </View>
  );
}

// ─── TextShortEditor ─────────────────────────────────────────────────────────

export type TextShortEditorProps = {
  payload: Record<string, unknown>;
  onChange: (p: Record<string, unknown>) => void;
};

export function TextShortEditor({ payload, onChange }: TextShortEditorProps) {
  return (
    <View className="gap-3">
      <TextField
        label="Model answer"
        value={String(payload.modelAnswer ?? "")}
        onChangeText={(v) => onChange({ ...payload, modelAnswer: v })}
        placeholder="Expected short answer"
        multiline
      />
      <TextField
        label="Max length (characters, optional)"
        value={String(payload.maxLength ?? "")}
        onChangeText={(v) => onChange({ ...payload, maxLength: v ? Number(v) : undefined })}
        keyboardType="numeric"
        placeholder="e.g. 200"
      />
    </View>
  );
}

// ─── ParagraphEditor ─────────────────────────────────────────────────────────

export type ParagraphEditorProps = {
  payload: Record<string, unknown>;
  onChange: (p: Record<string, unknown>) => void;
};

export function ParagraphEditor({ payload, onChange }: ParagraphEditorProps) {
  return (
    <View className="gap-3">
      <TextField
        label="Model answer / evaluation guidance"
        value={String(payload.modelAnswer ?? "")}
        onChangeText={(v) => onChange({ ...payload, modelAnswer: v })}
        placeholder="Describe the ideal response and grading criteria"
        multiline
      />
      <View className="flex-row gap-3">
        <View className="flex-1">
          <TextField
            label="Min words (optional)"
            value={String(payload.minWords ?? "")}
            onChangeText={(v) => onChange({ ...payload, minWords: v ? Number(v) : undefined })}
            keyboardType="numeric"
            placeholder="e.g. 50"
          />
        </View>
        <View className="flex-1">
          <TextField
            label="Max words (optional)"
            value={String(payload.maxWords ?? "")}
            onChangeText={(v) => onChange({ ...payload, maxWords: v ? Number(v) : undefined })}
            keyboardType="numeric"
            placeholder="e.g. 500"
          />
        </View>
      </View>
    </View>
  );
}

// ─── CodeEditorPayload ───────────────────────────────────────────────────────

export type CodeEditorPayloadProps = {
  payload: Record<string, unknown>;
  onChange: (p: Record<string, unknown>) => void;
};

type TestCase = { id: string; input: string; output: string };

const LANGUAGES = [
  { label: "Python", value: "python" },
  { label: "JavaScript", value: "javascript" },
  { label: "Java", value: "java" },
  { label: "C++", value: "cpp" },
  { label: "Go", value: "go" },
  { label: "Rust", value: "rust" },
];

export function CodeEditorPayload({ payload, onChange }: CodeEditorPayloadProps) {
  const testCases = (payload.testCases as TestCase[] | undefined) ?? [];
  const language = (payload.language as string | undefined) ?? "python";

  return (
    <View className="gap-4">
      <View className="gap-1.5">
        <SectionLabel>Language</SectionLabel>
        <ChipSelect
          options={LANGUAGES}
          value={language}
          onChange={(v) => onChange({ ...payload, language: v })}
        />
      </View>
      <TextField
        label="Starter code"
        value={String(payload.starterCode ?? "")}
        onChangeText={(v) => onChange({ ...payload, starterCode: v })}
        placeholder="# starter code shown to student"
        multiline
      />
      <TextField
        label="Model answer (optional)"
        value={String(payload.modelAnswer ?? "")}
        onChangeText={(v) => onChange({ ...payload, modelAnswer: v })}
        placeholder="Reference solution (not shown to student)"
        multiline
      />
      <View className="gap-2">
        <SectionLabel>Test cases</SectionLabel>
        {testCases.map((tc, idx) => (
          <Card key={idx} className="gap-2 p-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-text-secondary text-sm font-semibold">Case {idx + 1}</Text>
              <IconButton
                icon="trash-2"
                size="sm"
                variant="danger"
                label="Remove test case"
                onPress={() => onChange(qfRemoveTestCase(payload, idx))}
              />
            </View>
            <TextField
              label="Input"
              value={tc.input}
              onChangeText={(v) => onChange(qfUpdateTestCase(payload, idx, { input: v }))}
              placeholder="stdin or function argument"
              multiline
            />
            <TextField
              label="Expected output"
              value={tc.output}
              onChangeText={(v) => onChange(qfUpdateTestCase(payload, idx, { output: v }))}
              placeholder="expected stdout or return value"
              multiline
            />
          </Card>
        ))}
        <Button variant="secondary" size="sm" onPress={() => onChange(qfAddTestCase(payload))}>
          + Add test case
        </Button>
      </View>
    </View>
  );
}

// ─── FillBlanksEditor ────────────────────────────────────────────────────────

export type FillBlanksEditorProps = {
  payload: Record<string, unknown>;
  onChange: (p: Record<string, unknown>) => void;
};

type FillBlank = { id: string; correctAnswer: string; acceptableAnswers?: string[] };

export function FillBlanksEditor({ payload, onChange }: FillBlanksEditorProps) {
  const blanks = (payload.blanks as FillBlank[] | undefined) ?? [];

  return (
    <View className="gap-4">
      <TextField
        label="Template"
        value={String(payload.template ?? "")}
        onChangeText={(v) => onChange({ ...payload, template: v })}
        placeholder="The ___1___ jumped over the ___2___ fox."
        multiline
        hint="Mark blank positions as ___id___ (e.g. ___1___, ___2___)"
      />
      <View className="gap-2">
        <SectionLabel>Blanks</SectionLabel>
        {blanks.map((blank, idx) => (
          <Card key={blank.id} className="gap-2 p-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-text-secondary text-sm font-semibold">
                Blank {idx + 1} (id: {blank.id})
              </Text>
              <IconButton
                icon="trash-2"
                size="sm"
                variant="danger"
                label="Remove blank"
                onPress={() => onChange(qfRemoveBlank(payload, blank.id))}
              />
            </View>
            <TextField
              label="Correct answer"
              value={blank.correctAnswer}
              onChangeText={(v) => onChange(qfUpdateBlank(payload, blank.id, { correctAnswer: v }))}
              placeholder="Expected answer"
            />
            <TextField
              label="Acceptable answers (comma-separated, optional)"
              value={(blank.acceptableAnswers ?? []).join(", ")}
              onChangeText={(v) =>
                onChange(
                  qfUpdateBlank(payload, blank.id, {
                    acceptableAnswers: v
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                )
              }
              placeholder="e.g. quick, fast, speedy"
            />
          </Card>
        ))}
        <Button variant="secondary" size="sm" onPress={() => onChange(qfAddBlank(payload))}>
          + Add blank
        </Button>
      </View>
    </View>
  );
}

// ─── FillBlanksDdEditor ──────────────────────────────────────────────────────

export type FillBlanksDdEditorProps = {
  payload: Record<string, unknown>;
  onChange: (p: Record<string, unknown>) => void;
};

type FillBlankDd = { id: string; correctAnswer: string };
export function FillBlanksDdEditor({ payload, onChange }: FillBlanksDdEditorProps) {
  const blanks = (payload.blanks as FillBlankDd[] | undefined) ?? [];
  const pool = (payload.optionPool as string[] | undefined) ?? [];

  return (
    <View className="gap-4">
      <TextField
        label="Template"
        value={String(payload.template ?? "")}
        onChangeText={(v) => onChange({ ...payload, template: v })}
        placeholder="The ___1___ jumped over the ___2___ fox."
        multiline
        hint="Mark blank positions as ___id___ (e.g. ___1___, ___2___)"
      />
      <View className="gap-2">
        <SectionLabel>Blank answers</SectionLabel>
        {blanks.map((blank, idx) => (
          <Card key={blank.id} className="gap-2 p-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-text-secondary text-sm font-semibold">Blank {idx + 1}</Text>
              <IconButton
                icon="trash-2"
                size="sm"
                variant="danger"
                label="Remove blank"
                onPress={() => onChange(qfRemoveBlankDd(payload, blank.id))}
              />
            </View>
            <TextField
              label="Correct answer"
              value={blank.correctAnswer}
              onChangeText={(v) =>
                onChange({
                  ...payload,
                  blanks: blanks.map((b) => (b.id === blank.id ? { ...b, correctAnswer: v } : b)),
                })
              }
              placeholder="Expected answer for this blank"
            />
          </Card>
        ))}
        <Button variant="secondary" size="sm" onPress={() => onChange(qfAddBlankDd(payload))}>
          + Add blank
        </Button>
      </View>
      <View className="gap-2">
        <SectionLabel>Option pool</SectionLabel>
        {pool.map((opt, idx) => (
          <View key={idx} className="flex-row items-center gap-2">
            <View className="flex-1">
              <TextField
                value={opt}
                onChangeText={(v) => onChange(qfUpdatePoolOption(payload, idx, v))}
                placeholder={`Pool option ${idx + 1}`}
              />
            </View>
            <IconButton
              icon="trash-2"
              size="sm"
              variant="danger"
              label="Remove pool option"
              onPress={() => onChange(qfRemovePoolOption(payload, idx))}
            />
          </View>
        ))}
        <Button
          variant="secondary"
          size="sm"
          onPress={() => onChange(qfAddPoolOption(payload, ""))}
        >
          + Add pool option
        </Button>
      </View>
    </View>
  );
}

// ─── MatchingEditor ──────────────────────────────────────────────────────────

export type MatchingEditorProps = {
  payload: Record<string, unknown>;
  onChange: (p: Record<string, unknown>) => void;
};

type MatchingPair = { left: string; right: string };

export function MatchingEditor({ payload, onChange }: MatchingEditorProps) {
  const pairs = (payload.pairs as MatchingPair[] | undefined) ?? [];

  return (
    <View className="gap-3">
      <SectionLabel>Matching pairs</SectionLabel>
      {pairs.map((pair, idx) => (
        <Card key={idx} className="gap-2 p-3">
          <View className="flex-row items-center justify-between">
            <Text className="text-text-secondary text-sm font-semibold">Pair {idx + 1}</Text>
            <View className="flex-row items-center gap-1">
              <IconButton
                icon="chevron-up"
                size="sm"
                label="Move up"
                onPress={() => onChange(qfMovePairUp(payload, idx))}
                disabled={idx === 0}
              />
              <IconButton
                icon="chevron-down"
                size="sm"
                label="Move down"
                onPress={() => onChange(qfMovePairDown(payload, idx))}
                disabled={idx === pairs.length - 1}
              />
              <IconButton
                icon="trash-2"
                size="sm"
                variant="danger"
                label="Remove pair"
                onPress={() => onChange(qfRemovePair(payload, idx))}
              />
            </View>
          </View>
          <View className="flex-row gap-2">
            <View className="flex-1">
              <TextField
                label="Left"
                value={pair.left}
                onChangeText={(v) => onChange(qfUpdatePair(payload, idx, { left: v }))}
                placeholder="Left item"
              />
            </View>
            <View className="flex-1">
              <TextField
                label="Right"
                value={pair.right}
                onChangeText={(v) => onChange(qfUpdatePair(payload, idx, { right: v }))}
                placeholder="Right match"
              />
            </View>
          </View>
        </Card>
      ))}
      <Button variant="secondary" size="sm" onPress={() => onChange(qfAddPair(payload))}>
        + Add pair
      </Button>
    </View>
  );
}

// ─── JumbledEditor ───────────────────────────────────────────────────────────

export type JumbledEditorProps = {
  payload: Record<string, unknown>;
  onChange: (p: Record<string, unknown>) => void;
};

export function JumbledEditor({ payload, onChange }: JumbledEditorProps) {
  const tokens = (payload.tokens as string[] | undefined) ?? [];

  return (
    <View className="gap-3">
      <Text className="text-text-muted text-xs">
        The correct order is the current visual order top-to-bottom.
      </Text>
      <SectionLabel>Tokens (correct order)</SectionLabel>
      {tokens.map((token, idx) => (
        <View key={idx} className="flex-row items-center gap-2">
          <Text className="text-text-muted w-5 text-right text-sm">{idx + 1}.</Text>
          <View className="flex-1">
            <TextField
              value={token}
              onChangeText={(v) => onChange(qfUpdateToken(payload, idx, v))}
              placeholder={`Token ${idx + 1}`}
            />
          </View>
          <IconButton
            icon="chevron-up"
            size="sm"
            label="Move up"
            onPress={() => onChange(qfMoveTokenUp(payload, idx))}
            disabled={idx === 0}
          />
          <IconButton
            icon="chevron-down"
            size="sm"
            label="Move down"
            onPress={() => onChange(qfMoveTokenDown(payload, idx))}
            disabled={idx === tokens.length - 1}
          />
          <IconButton
            icon="trash-2"
            size="sm"
            variant="danger"
            label="Remove token"
            onPress={() => onChange(qfRemoveToken(payload, idx))}
          />
        </View>
      ))}
      <Button variant="secondary" size="sm" onPress={() => onChange(qfAddToken(payload, ""))}>
        + Add token
      </Button>
    </View>
  );
}

// ─── AudioEditor ─────────────────────────────────────────────────────────────

export type AudioEditorProps = {
  payload: Record<string, unknown>;
  onChange: (p: Record<string, unknown>) => void;
};

export function AudioEditor({ payload, onChange }: AudioEditorProps) {
  return (
    <View className="gap-3">
      <TextField
        label="Max duration (seconds)"
        value={String(payload.maxDurationSeconds ?? "")}
        onChangeText={(v) =>
          onChange({ ...payload, maxDurationSeconds: v ? Number(v) : undefined })
        }
        keyboardType="numeric"
        placeholder="e.g. 120"
      />
      <TextField
        label="Evaluation guidance (optional)"
        value={String(payload.modelAnswer ?? "")}
        onChangeText={(v) => onChange({ ...payload, modelAnswer: v })}
        placeholder="Criteria for evaluating the audio response"
        multiline
      />
    </View>
  );
}

// ─── ImageEvalEditor ─────────────────────────────────────────────────────────

export type ImageEvalEditorProps = {
  payload: Record<string, unknown>;
  onChange: (p: Record<string, unknown>) => void;
};

export function ImageEvalEditor({ payload, onChange }: ImageEvalEditorProps) {
  return (
    <View className="gap-3">
      <TextField
        label="Max images (1–10)"
        value={String(payload.maxImages ?? "")}
        onChangeText={(v) =>
          onChange({ ...payload, maxImages: v ? Math.min(10, Math.max(1, Number(v))) : undefined })
        }
        keyboardType="numeric"
        placeholder="1"
      />
      <TextField
        label="Instructions / evaluation criteria"
        value={String(payload.modelAnswer ?? "")}
        onChangeText={(v) => onChange({ ...payload, modelAnswer: v })}
        placeholder="Describe what the student should capture and how it will be evaluated"
        multiline
      />
    </View>
  );
}

// ─── GroupOptionsEditor ──────────────────────────────────────────────────────

export type GroupOptionsEditorProps = {
  payload: Record<string, unknown>;
  onChange: (p: Record<string, unknown>) => void;
};

type GroupItem = { id: string; text: string; group: string };

export function GroupOptionsEditor({ payload, onChange }: GroupOptionsEditorProps) {
  const groups = (payload.groups as string[] | undefined) ?? [];
  const items = (payload.items as GroupItem[] | undefined) ?? [];

  return (
    <View className="gap-4">
      <View className="gap-2">
        <SectionLabel>Groups</SectionLabel>
        {groups.map((group, index) => (
          <View key={`${group}-${index}`} className="flex-row items-center gap-2">
            <View className="flex-1">
              <TextField
                value={group}
                onChangeText={(v) => onChange(qfRenameGroup(payload, group, v))}
                placeholder="Group name"
              />
            </View>
            <IconButton
              icon="trash-2"
              size="sm"
              variant="danger"
              label="Remove group"
              onPress={() => onChange(qfRemoveGroup(payload, group))}
            />
          </View>
        ))}
        <Button variant="secondary" size="sm" onPress={() => onChange(qfAddGroup(payload, ""))}>
          + Add group
        </Button>
      </View>
      <Divider />
      <View className="gap-2">
        <SectionLabel>Items</SectionLabel>
        {items.map((item, idx) => (
          <Card key={item.id} className="gap-2 p-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-text-secondary text-sm font-semibold">Item {idx + 1}</Text>
              <IconButton
                icon="trash-2"
                size="sm"
                variant="danger"
                label="Remove item"
                onPress={() => onChange(qfRemoveGroupItem(payload, item.id))}
              />
            </View>
            <TextField
              label="Text"
              value={item.text}
              onChangeText={(v) => onChange(qfUpdateGroupItem(payload, item.id, { text: v }))}
              placeholder="Item text"
            />
            <View className="gap-1.5">
              <Text className="font-ui text-text-secondary text-xs font-semibold">Group</Text>
              <View className="flex-row flex-wrap gap-1.5">
                {groups.map((g) => {
                  const active = item.group === g;
                  return (
                    <Pressable
                      key={g}
                      onPress={() => onChange(qfUpdateGroupItem(payload, item.id, { group: g }))}
                      className="rounded-full border px-2.5 py-1"
                      style={{
                        borderColor: active ? colors.brand : colors.textMuted,
                        backgroundColor: active ? colors.brand : "transparent",
                      }}
                    >
                      <Text
                        className="text-xs font-semibold"
                        style={{ color: active ? colors.textOnAccent : colors.textSecondary }}
                      >
                        {g || `Group ${groups.indexOf(g) + 1}`}
                      </Text>
                    </Pressable>
                  );
                })}
                {groups.length === 0 && (
                  <Text className="text-text-muted text-xs">Add groups above first</Text>
                )}
              </View>
            </View>
          </Card>
        ))}
        <Button variant="secondary" size="sm" onPress={() => onChange(qfAddGroupItem(payload, ""))}>
          + Add item
        </Button>
      </View>
    </View>
  );
}

// ─── ChatAgentEditor ─────────────────────────────────────────────────────────

export type ChatAgentEditorProps = {
  payload: Record<string, unknown>;
  onChange: (p: Record<string, unknown>) => void;
};

/**
 * Mobile teacher deliberately does not offer a partial chat-agent form. The
 * canonical assessment has public objectives, agent/policy FKs, completion
 * policy, rubric links, and a private answer key; a legacy two-field editor
 * could silently destroy that split. Keep direct routes read-only instead.
 */
export function ChatAgentEditor({ payload }: ChatAgentEditorProps) {
  return (
    <Card className="gap-2 border-amber-300 bg-amber-50">
      <Text className="text-text-primary font-semibold">Author in Teacher Web</Text>
      <Text className="text-text-secondary text-sm">
        Chat-agent assessments are read-only on mobile. Their interviewer, turn policy, rubric, and
        private answer key must be edited in Teacher Web so no partial schema is saved.
      </Text>
      {typeof payload.scenario === "string" && payload.scenario ? (
        <Text className="text-text-muted text-xs">Scenario: {payload.scenario}</Text>
      ) : null}
    </Card>
  );
}

// ─── QuestionPayloadEditor ───────────────────────────────────────────────────

export type QuestionPayloadEditorProps = {
  questionType: string;
  payload: Record<string, unknown>;
  onChange: (p: Record<string, unknown>) => void;
};

export function QuestionPayloadEditor({
  questionType,
  payload,
  onChange,
}: QuestionPayloadEditorProps) {
  switch (questionType) {
    case "mcq":
      return <McqEditor payload={payload} onChange={onChange} multi={false} />;
    case "mcaq":
      return <McqEditor payload={payload} onChange={onChange} multi={true} />;
    case "true-false":
      return <TrueFalseEditor payload={payload} onChange={onChange} />;
    case "numerical":
      return <NumericalEditor payload={payload} onChange={onChange} />;
    case "text":
      return <TextShortEditor payload={payload} onChange={onChange} />;
    case "paragraph":
      return <ParagraphEditor payload={payload} onChange={onChange} />;
    case "code":
      return <CodeEditorPayload payload={payload} onChange={onChange} />;
    case "fill-blanks":
      return <FillBlanksEditor payload={payload} onChange={onChange} />;
    case "fill-blanks-dd":
      return <FillBlanksDdEditor payload={payload} onChange={onChange} />;
    case "matching":
      return <MatchingEditor payload={payload} onChange={onChange} />;
    case "jumbled":
      return <JumbledEditor payload={payload} onChange={onChange} />;
    case "audio":
      return <AudioEditor payload={payload} onChange={onChange} />;
    case "image_evaluation":
      return <ImageEvalEditor payload={payload} onChange={onChange} />;
    case "group-options":
      return <GroupOptionsEditor payload={payload} onChange={onChange} />;
    case "chat_agent_question":
      return <ChatAgentEditor payload={payload} onChange={onChange} />;
    default:
      return null;
  }
}

// ─── MaterialPayloadEditor ───────────────────────────────────────────────────

export type MaterialPayloadEditorProps = {
  materialType?: string;
  payload: Record<string, unknown>;
  onChange: (p: Record<string, unknown>) => void;
};

export function MaterialPayloadEditor({ materialType }: MaterialPayloadEditorProps) {
  return (
    <Card className="items-center gap-2 py-6">
      <Text className="text-text-secondary text-sm font-semibold">
        Material editor — {materialType ?? "unknown"}
      </Text>
      <Text className="text-text-muted text-center text-xs">
        Rich material authoring for "{materialType ?? "unknown"}" is available on the web app.
        {"\n"}Use teacher.levelup.app to add or edit this content type.
      </Text>
    </Card>
  );
}
