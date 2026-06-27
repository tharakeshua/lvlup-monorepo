/**
 * QuestionView — renders any of the 15 UnifiedItem question types as a controlled
 * input (value/onChange). Never shows an answer key pre-submit (the server strips
 * answer-bearing fields from learner reads anyway). When `showResult` is set it
 * paints a correctness banner and, where the graded `result.correctAnswer` is
 * supplied, marks the right choice.
 *
 * Value shapes by questionType:
 *   mcq → optionId(string) · mcaq → optionId[] · true-false → boolean
 *   numerical/text/paragraph/code/audio/image_evaluation/chat_agent_question → string
 *   fill-blanks/fill-blanks-dd → { [blankId]: string }
 *   matching → { [left]: right } · group-options → { [itemId]: group }
 *   jumbled → number[] (token order)
 */
import { Linking, Pressable, Text, TextInput, View } from "react-native";

import { colors } from "../theme";
import { cx } from "./cx";
import { Icon } from "./Icon";
import { Badge } from "./data";
import { Chip } from "./data";
import { ContentRenderer } from "./containers";
import { asArray, asString, getBasePoints, getPrompt, getQuestionData } from "./item-data";
import type { QuestionViewProps } from "./_types";

type Dict = Record<string, unknown>;
type McqOption = { id: string; text: string; imageUrl?: string };

const inputBase =
  "rounded-md border border-border-strong bg-surface px-3 py-2.5 font-ui text-base text-text-primary";

export function QuestionView({
  item,
  questionData,
  value,
  onChange,
  disabled,
  showResult,
  result,
  className,
}: QuestionViewProps) {
  const data = getQuestionData(item, questionData);
  const qType = asString(data?.questionType, "mcq");
  const prompt = getPrompt(item, data);
  const points = getBasePoints(item, data);

  return (
    <View className={cx("gap-4", className)}>
      {/* header */}
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <View className="mb-2 flex-row items-center gap-2">
            <Badge variant="brand">{LABELS[qType] ?? qType}</Badge>
            {points != null && (
              <Text className="font-ui text-text-muted text-xs">{points} pts</Text>
            )}
          </View>
          {prompt ? <ContentRenderer body={prompt} math /> : null}
        </View>
      </View>

      {/* result banner */}
      {showResult && result && (
        <View
          className={cx(
            "flex-row items-center gap-2 rounded-md p-3",
            result.correct ? "bg-green-200/50" : "bg-red-200/50"
          )}
        >
          <Icon
            name={result.correct ? "check-circle" : "alert-triangle"}
            size={18}
            color={result.correct ? colors.success : colors.error}
          />
          <Text
            className={cx(
              "font-ui flex-1 text-sm font-semibold",
              result.correct ? "text-success" : "text-error"
            )}
          >
            {result.correct ? "Correct" : "Not quite"}
            {result.earnedPoints != null ? ` · ${result.earnedPoints} pts` : ""}
          </Text>
        </View>
      )}

      {/* body */}
      <QuestionBody
        qType={qType}
        data={data ?? {}}
        value={value}
        onChange={onChange}
        disabled={disabled || showResult}
        showResult={showResult}
        result={result}
      />

      {showResult && result?.feedback ? (
        <Text className="font-ui text-text-muted text-sm italic">{result.feedback}</Text>
      ) : null}
    </View>
  );
}

const LABELS: Record<string, string> = {
  mcq: "Multiple choice",
  mcaq: "Select all",
  "true-false": "True / False",
  numerical: "Numeric",
  text: "Short answer",
  paragraph: "Long answer",
  code: "Code",
  "fill-blanks": "Fill the blanks",
  "fill-blanks-dd": "Fill the blanks",
  matching: "Matching",
  jumbled: "Reorder",
  audio: "Audio",
  image_evaluation: "Image answer",
  "group-options": "Group",
  chat_agent_question: "Conversation",
};

interface BodyProps {
  qType?: string;
  data: Dict;
  value: unknown;
  onChange?: (v: unknown) => void;
  disabled?: boolean;
  showResult?: boolean;
  result?: QuestionViewProps["result"];
}

function QuestionBody({ qType, data, value, onChange, disabled, showResult, result }: BodyProps) {
  switch (qType) {
    case "mcq":
      return (
        <SingleChoice
          data={data}
          value={value}
          onChange={onChange}
          disabled={disabled}
          showResult={showResult}
          result={result}
        />
      );
    case "mcaq":
      return <MultiChoice data={data} value={value} onChange={onChange} disabled={disabled} />;
    case "true-false":
      return <TrueFalse value={value} onChange={onChange} disabled={disabled} />;
    case "numerical":
      return (
        <FreeText
          value={value}
          onChange={onChange}
          disabled={disabled}
          keyboardType="numeric"
          unit={asString(data.unit)}
        />
      );
    case "text":
      return <FreeText value={value} onChange={onChange} disabled={disabled} />;
    case "paragraph":
    case "image_evaluation":
    case "chat_agent_question":
    case "audio":
      return (
        <Composite
          data={data}
          qType={qType}
          value={value}
          onChange={onChange}
          disabled={disabled}
        />
      );
    case "code":
      return <CodeAnswer data={data} value={value} onChange={onChange} disabled={disabled} />;
    case "fill-blanks":
    case "fill-blanks-dd":
      return (
        <FillBlanks
          data={data}
          value={value}
          onChange={onChange}
          disabled={disabled}
          dropdown={qType === "fill-blanks-dd"}
        />
      );
    case "matching":
      return <Matching data={data} value={value} onChange={onChange} disabled={disabled} />;
    case "jumbled":
      return <Jumbled data={data} value={value} onChange={onChange} disabled={disabled} />;
    case "group-options":
      return <GroupOptions data={data} value={value} onChange={onChange} disabled={disabled} />;
    default:
      return <FreeText value={value} onChange={onChange} disabled={disabled} />;
  }
}

// --- option row -------------------------------------------------------------
function OptionRow({
  opt,
  selected,
  multi,
  state,
  disabled,
  onPress,
}: {
  opt: McqOption;
  selected: boolean;
  multi?: boolean;
  state?: "correct" | "incorrect";
  disabled?: boolean;
  onPress: () => void;
}) {
  const border =
    state === "correct"
      ? "border-success bg-green-200/40"
      : state === "incorrect"
        ? "border-error bg-red-200/40"
        : selected
          ? "border-brand bg-brand-subtle"
          : "border-border-strong bg-surface";
  const markShape = multi ? "rounded" : "rounded-full";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={cx("flex-row items-center gap-3 rounded-md border p-3", border)}
    >
      <View
        className={cx(
          "h-5 w-5 items-center justify-center border-2",
          markShape,
          selected ? "border-brand bg-brand" : "border-border-strong"
        )}
      >
        {selected && (
          <Icon
            name={multi ? "check" : "circle"}
            size={multi ? 13 : 8}
            color={colors.textOnAccent}
            strokeWidth={3}
          />
        )}
      </View>
      <Text className="font-ui text-text-primary flex-1 text-base">{opt.text}</Text>
      {state === "correct" && <Icon name="check" size={16} color={colors.success} />}
    </Pressable>
  );
}

function SingleChoice({ data, value, onChange, disabled, showResult, result }: BodyProps) {
  const options = asArray<McqOption>(data.options);
  const correctId = showResult ? asString((result as Dict | undefined)?.correctAnswer) : "";
  return (
    <View className="gap-2">
      {options.map((opt) => {
        const selected = value === opt.id;
        let state: "correct" | "incorrect" | undefined;
        if (showResult) {
          if (correctId && opt.id === correctId) state = "correct";
          else if (selected) state = result?.correct ? "correct" : "incorrect";
        }
        return (
          <OptionRow
            key={opt.id}
            opt={opt}
            selected={selected}
            state={state}
            disabled={disabled}
            onPress={() => onChange?.(opt.id)}
          />
        );
      })}
    </View>
  );
}

function MultiChoice({ data, value, onChange, disabled }: BodyProps) {
  const options = asArray<McqOption>(data.options);
  const selected = asArray<string>(value);
  const toggle = (id: string) => {
    const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
    onChange?.(next);
  };
  return (
    <View className="gap-2">
      {options.map((opt) => (
        <OptionRow
          key={opt.id}
          opt={opt}
          selected={selected.includes(opt.id)}
          multi
          disabled={disabled}
          onPress={() => toggle(opt.id)}
        />
      ))}
    </View>
  );
}

function TrueFalse({
  value,
  onChange,
  disabled,
}: Pick<BodyProps, "value" | "onChange" | "disabled">) {
  return (
    <View className="flex-row gap-3">
      {[
        { label: "True", val: true, icon: "check" },
        { label: "False", val: false, icon: "x" },
      ].map((o) => {
        const on = value === o.val;
        return (
          <Pressable
            key={o.label}
            onPress={() => onChange?.(o.val)}
            disabled={disabled}
            className={cx(
              "flex-1 flex-row items-center justify-center gap-2 rounded-md border p-3.5",
              on ? "border-brand bg-brand-subtle" : "border-border-strong bg-surface"
            )}
          >
            <Icon name={o.icon} size={18} color={on ? colors.brand : colors.textMuted} />
            <Text
              className={cx(
                "font-ui text-base font-semibold",
                on ? "text-brand" : "text-text-secondary"
              )}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function FreeText({
  value,
  onChange,
  disabled,
  keyboardType,
  unit,
}: Pick<BodyProps, "value" | "onChange" | "disabled"> & {
  keyboardType?: "numeric" | "default";
  unit?: string;
}) {
  return (
    <View className="flex-row items-center gap-2">
      <TextInput
        value={asString(value)}
        onChangeText={onChange}
        editable={!disabled}
        keyboardType={keyboardType}
        placeholder="Your answer"
        placeholderTextColor={colors.textMuted}
        className={cx(inputBase, "flex-1")}
      />
      {unit ? <Text className="font-ui text-text-muted text-base">{unit}</Text> : null}
    </View>
  );
}

function Composite({ data, qType, value, onChange, disabled }: BodyProps & { qType: string }) {
  const images = asArray<string>(data.referenceImageUrls);
  const audioUrl = asString(data.promptAudioUrl);
  const instructions = asString(data.agentInstructions);
  return (
    <View className="gap-3">
      {qType === "audio" && audioUrl ? (
        <Pressable
          onPress={() => Linking.openURL(audioUrl).catch(() => {})}
          className="rounded-pill bg-brand-subtle flex-row items-center gap-2 self-start px-3 py-2"
        >
          <Icon name="play" size={16} color={colors.brand} />
          <Text className="font-ui text-brand text-sm font-semibold">Play prompt</Text>
        </Pressable>
      ) : null}
      {qType === "image_evaluation" && images.length > 0 ? (
        <View className="gap-2">
          {images.map((u, i) => (
            <Pressable
              key={i}
              onPress={() => Linking.openURL(u).catch(() => {})}
              className="flex-row items-center gap-2"
            >
              <Icon name="image" size={16} color={colors.textMuted} />
              <Text className="font-ui text-info text-sm underline" numberOfLines={1}>
                Reference image {i + 1}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {qType === "chat_agent_question" && instructions ? (
        <View className="bg-surface-sunken rounded-md p-3">
          <Text className="font-ui text-text-secondary text-sm">{instructions}</Text>
        </View>
      ) : null}
      <TextInput
        value={asString(value)}
        onChangeText={onChange}
        editable={!disabled}
        multiline
        placeholder={qType === "chat_agent_question" ? "Type your response…" : "Write your answer…"}
        placeholderTextColor={colors.textMuted}
        style={{ minHeight: 120, textAlignVertical: "top" }}
        className={cx(inputBase)}
      />
    </View>
  );
}

function CodeAnswer({ data, value, onChange, disabled }: BodyProps) {
  const language = asString(data.language);
  const starter = asString(data.starterCode);
  const text = value == null ? starter : asString(value);
  return (
    <View className="gap-1.5">
      {language ? <Text className="text-text-muted font-mono text-xs">{language}</Text> : null}
      <TextInput
        value={text}
        onChangeText={onChange}
        editable={!disabled}
        multiline
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="// your code"
        placeholderTextColor={colors.textMuted}
        style={{ minHeight: 160, textAlignVertical: "top" }}
        className="bg-ink-900 text-paper-100 rounded-md p-3 font-mono text-sm"
      />
    </View>
  );
}

function FillBlanks({
  data,
  value,
  onChange,
  disabled,
  dropdown,
}: BodyProps & { dropdown?: boolean }) {
  const template = asString(data.template);
  const blanks = asArray<{ id: string }>(data.blanks);
  const pool = asArray<string>(data.optionPool);
  const answers = (value as Dict | undefined) ?? {};
  const set = (id: string, v: string) => onChange?.({ ...answers, [id]: v });
  return (
    <View className="gap-3">
      {template ? <ContentRenderer body={template} /> : null}
      {blanks.map((b, i) => (
        <View key={b.id ?? i} className="gap-1.5">
          <Text className="font-ui text-text-muted text-xs font-semibold">Blank {i + 1}</Text>
          {dropdown ? (
            <View className="flex-row flex-wrap gap-2">
              {pool.map((opt) => (
                <Chip
                  key={opt}
                  active={answers[b.id] === opt}
                  onPress={disabled ? undefined : () => set(b.id, opt)}
                >
                  {opt}
                </Chip>
              ))}
            </View>
          ) : (
            <TextInput
              value={asString(answers[b.id])}
              onChangeText={(t) => set(b.id, t)}
              editable={!disabled}
              placeholder="Answer"
              placeholderTextColor={colors.textMuted}
              className={inputBase}
            />
          )}
        </View>
      ))}
    </View>
  );
}

function Matching({ data, value, onChange, disabled }: BodyProps) {
  const pairs = asArray<{ left: string; right: string }>(data.pairs);
  const rights = pairs.map((p) => p.right);
  const answers = (value as Dict | undefined) ?? {};
  const set = (left: string, right: string) => onChange?.({ ...answers, [left]: right });
  return (
    <View className="gap-3">
      {pairs.map((p, i) => (
        <View key={i} className="border-border-subtle bg-surface gap-1.5 rounded-md border p-3">
          <Text className="font-ui text-text-primary text-base font-semibold">{p.left}</Text>
          <View className="flex-row flex-wrap gap-2">
            {rights.map((r) => (
              <Chip
                key={r}
                active={answers[p.left] === r}
                onPress={disabled ? undefined : () => set(p.left, r)}
              >
                {r}
              </Chip>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

function Jumbled({ data, value, onChange, disabled }: BodyProps) {
  const tokens = asArray<string>(data.tokens);
  const order = asArray<number>(value);
  const remaining = tokens.map((_, i) => i).filter((i) => !order.includes(i));
  const add = (i: number) => onChange?.([...order, i]);
  const removeAt = (pos: number) => onChange?.(order.filter((_, p) => p !== pos));
  return (
    <View className="gap-3">
      <Text className="font-ui text-text-muted text-xs font-semibold">Your order</Text>
      <View
        style={{ minHeight: 48 }}
        className="border-border-strong bg-surface-sunken flex-row flex-wrap gap-2 rounded-md border border-dashed p-2"
      >
        {order.length === 0 ? (
          <Text className="font-ui text-text-muted text-sm">
            Tap tokens below to build your answer
          </Text>
        ) : (
          order.map((tokIdx, pos) => (
            <Chip
              key={pos}
              active
              removable
              onPress={disabled ? undefined : () => removeAt(pos)}
              onRemove={() => removeAt(pos)}
            >
              {tokens[tokIdx]}
            </Chip>
          ))
        )}
      </View>
      {remaining.length > 0 && (
        <View className="flex-row flex-wrap gap-2">
          {remaining.map((i) => (
            <Chip key={i} onPress={disabled ? undefined : () => add(i)}>
              {tokens[i]}
            </Chip>
          ))}
        </View>
      )}
    </View>
  );
}

function GroupOptions({ data, value, onChange, disabled }: BodyProps) {
  const groups = asArray<string>(data.groups);
  const items = asArray<{ id: string; text: string }>(data.items);
  const answers = (value as Dict | undefined) ?? {};
  const set = (id: string, g: string) => onChange?.({ ...answers, [id]: g });
  return (
    <View className="gap-3">
      {items.map((it) => (
        <View key={it.id} className="border-border-subtle bg-surface gap-1.5 rounded-md border p-3">
          <Text className="font-ui text-text-primary text-base">{it.text}</Text>
          <View className="flex-row flex-wrap gap-2">
            {groups.map((g) => (
              <Chip
                key={g}
                active={answers[it.id] === g}
                onPress={disabled ? undefined : () => set(it.id, g)}
              >
                {g}
              </Chip>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}
