import type { ChangeEvent } from "react";
import type { ItemAttachment, QuestionPayload, UnifiedItem } from "@levelup/shared-types";
import { Badge } from "@levelup/shared-ui";
import { CheckCircle2, FileAudio, ImagePlus, MessageCircle, Paperclip } from "lucide-react";
import ItemPreview from "./ItemPreview";
import { itemPreviewType } from "./student-preview-model";

type Data = Record<string, unknown>;

interface StudentPreviewItemProps {
  item: UnifiedItem;
  answer: unknown;
  onAnswer: (answer: unknown) => void;
  disabled?: boolean;
  showAnswers?: boolean;
}

const text = (value: unknown): string => (typeof value === "string" ? value : "");
const array = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
const record = (value: unknown): Record<string, string> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, string>)
    : {};
const rows = (value: unknown): Data[] =>
  Array.isArray(value)
    ? value.filter((entry): entry is Data => Boolean(entry && typeof entry === "object"))
    : [];

function AnswerReveal({ payload }: { payload: QuestionPayload }) {
  const data = (payload.questionData ?? {}) as Data;
  const type = itemPreviewType({ type: "question", payload } as UnifiedItem);
  let answer = "";
  if (type === "mcq" || type === "mcaq") {
    answer = rows(data["options"])
      .filter((option) => option["isCorrect"] === true)
      .map((option) => String(option["text"] ?? option["id"] ?? ""))
      .join(", ");
  } else if (type === "true-false") {
    answer = data["correctAnswer"] === true ? "True" : "False";
  } else if (type === "numerical" || type === "text") {
    answer = String(data["correctAnswer"] ?? "");
  } else if (type === "fill-blanks") {
    answer = rows(data["blanks"])
      .map((blank) => String(blank["correctAnswer"] ?? ""))
      .filter(Boolean)
      .join(", ");
  } else if (type === "fill-blanks-dd") {
    answer = rows(data["blanks"])
      .map((blank) => {
        const option = rows(blank["options"]).find(
          (candidate) => candidate["id"] === blank["correctOptionId"]
        );
        return String(option?.["text"] ?? "");
      })
      .filter(Boolean)
      .join(", ");
  } else if (type === "matching") {
    answer = rows(data["pairs"])
      .map((pair) => `${String(pair["left"] ?? "")} → ${String(pair["right"] ?? "")}`)
      .join("; ");
  } else if (type === "jumbled") {
    const items = rows(data["items"]);
    answer = array(data["correctOrder"])
      .map((id) => String(items.find((item) => item["id"] === id)?.["text"] ?? id))
      .join(" → ");
  } else {
    answer = String(
      data["modelAnswer"] ?? data["evaluationGuidance"] ?? "Author-reviewed response"
    );
  }
  return (
    <aside className="border-success/40 bg-success-subtle rounded-md border p-3 text-sm">
      <p className="text-success mb-1 flex items-center gap-1.5 font-semibold">
        <CheckCircle2 className="h-4 w-4" aria-hidden />
        Authoring answer key
      </p>
      <p className="whitespace-pre-wrap">{answer || "No answer key configured."}</p>
      {payload.explanation && (
        <p className="text-muted-foreground mt-2 whitespace-pre-wrap">{payload.explanation}</p>
      )}
    </aside>
  );
}

function Attachments({ attachments }: { attachments?: ItemAttachment[] }) {
  if (!attachments?.length) return null;
  return (
    <section aria-labelledby="preview-attachments" className="space-y-2">
      <h4
        id="preview-attachments"
        className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide"
      >
        <Paperclip className="h-3.5 w-3.5" aria-hidden /> Attachments
      </h4>
      <div className="grid gap-2 sm:grid-cols-2">
        {attachments.map((attachment) =>
          attachment.type === "image" ? (
            <img
              key={attachment.id}
              src={attachment.url}
              alt={attachment.fileName}
              loading="lazy"
              decoding="async"
              className="max-h-64 w-full rounded-md border object-contain"
            />
          ) : (
            <a
              key={attachment.id}
              href={attachment.url}
              target="_blank"
              rel="noreferrer"
              className="hover:bg-muted focus-visible:ring-brand flex min-h-11 items-center gap-2 rounded-md border p-3 text-sm focus-visible:outline-none focus-visible:ring-2"
            >
              <Paperclip className="h-4 w-4" aria-hidden />
              <span className="truncate">{attachment.fileName}</span>
            </a>
          )
        )}
      </div>
    </section>
  );
}

function ChoiceInput({
  data,
  multiple,
  answer,
  onAnswer,
  disabled,
}: {
  data: Data;
  multiple: boolean;
  answer: unknown;
  onAnswer: (answer: unknown) => void;
  disabled?: boolean;
}) {
  const options = rows(data["options"]);
  const selected = multiple ? array(answer) : [text(answer)];
  return (
    <fieldset className="space-y-2">
      <legend className="sr-only">{multiple ? "Select all answers" : "Select one answer"}</legend>
      {options.map((option, index) => {
        const id = String(option["id"] ?? index);
        const checked = selected.includes(id);
        return (
          <label
            key={id}
            className="hover:bg-muted focus-within:ring-brand flex min-h-11 cursor-pointer items-start gap-3 rounded-md border p-3 focus-within:ring-2"
          >
            <input
              type={multiple ? "checkbox" : "radio"}
              name={multiple ? undefined : "preview-choice"}
              checked={checked}
              disabled={disabled}
              onChange={(event) => {
                if (!multiple) return onAnswer(id);
                onAnswer(
                  event.target.checked
                    ? [...selected.filter(Boolean), id]
                    : selected.filter((v) => v !== id)
                );
              }}
              className="mt-0.5 h-4 w-4"
            />
            <span>
              <span className="sr-only">Option {index + 1}: </span>
              {String(option["text"] ?? "")}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}

function FillBlankInput({
  data,
  dropdown,
  answer,
  onAnswer,
  disabled,
}: {
  data: Data;
  dropdown: boolean;
  answer: unknown;
  onAnswer: (answer: unknown) => void;
  disabled?: boolean;
}) {
  const values = record(answer);
  const blanks = rows(data["blanks"]);
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm leading-relaxed">{String(data["textWithBlanks"] ?? "")}</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {blanks.map((blank, index) => {
          const id = String(blank["id"] ?? `blank-${index + 1}`);
          return (
            <label key={id} className="space-y-1 text-sm">
              <span className="font-medium">Blank {index + 1}</span>
              {dropdown ? (
                <select
                  value={values[id] ?? ""}
                  disabled={disabled}
                  onChange={(event) => onAnswer({ ...values, [id]: event.target.value })}
                  className="bg-background focus-visible:ring-brand min-h-11 w-full rounded-md border px-3 focus-visible:outline-none focus-visible:ring-2"
                >
                  <option value="">Choose an answer</option>
                  {rows(blank["options"]).map((option) => (
                    <option key={String(option["id"])} value={String(option["id"])}>
                      {String(option["text"] ?? "")}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={values[id] ?? ""}
                  disabled={disabled}
                  onChange={(event) => onAnswer({ ...values, [id]: event.target.value })}
                  className="focus-visible:ring-brand min-h-11 w-full rounded-md border px-3 focus-visible:outline-none focus-visible:ring-2"
                />
              )}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function QuestionControl({
  type,
  data,
  answer,
  onAnswer,
  disabled,
}: {
  type: string;
  data: Data;
  answer: unknown;
  onAnswer: (answer: unknown) => void;
  disabled?: boolean;
}) {
  const inputClass =
    "min-h-11 w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";
  switch (type) {
    case "mcq":
      return (
        <ChoiceInput
          data={data}
          multiple={false}
          answer={answer}
          onAnswer={onAnswer}
          disabled={disabled}
        />
      );
    case "mcaq":
      return (
        <ChoiceInput data={data} multiple answer={answer} onAnswer={onAnswer} disabled={disabled} />
      );
    case "true-false":
      return (
        <fieldset className="grid grid-cols-2 gap-3">
          <legend className="sr-only">Choose true or false</legend>
          {[true, false].map((value) => (
            <label
              key={String(value)}
              className="focus-within:ring-brand flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md border focus-within:ring-2"
            >
              <input
                type="radio"
                name="preview-true-false"
                checked={answer === value}
                disabled={disabled}
                onChange={() => onAnswer(value)}
              />
              {value ? "True" : "False"}
            </label>
          ))}
        </fieldset>
      );
    case "numerical":
      return (
        <label className="space-y-1 text-sm">
          <span className="font-medium">
            Numerical answer {data["unit"] ? `(${String(data["unit"])})` : ""}
          </span>
          <input
            type="number"
            inputMode="decimal"
            value={text(answer)}
            disabled={disabled}
            onChange={(event) => onAnswer(event.target.value)}
            className={inputClass}
          />
        </label>
      );
    case "text":
      return (
        <label className="space-y-1 text-sm">
          <span className="font-medium">Short answer</span>
          <input
            value={text(answer)}
            maxLength={finiteNumber(data["maxLength"])}
            disabled={disabled}
            onChange={(event) => onAnswer(event.target.value)}
            className={inputClass}
          />
        </label>
      );
    case "paragraph":
      return (
        <label className="space-y-1 text-sm">
          <span className="font-medium">Long answer</span>
          <textarea
            rows={8}
            value={text(answer)}
            maxLength={finiteNumber(data["maxLength"])}
            disabled={disabled}
            onChange={(event) => onAnswer(event.target.value)}
            className={inputClass}
          />
        </label>
      );
    case "code":
      return (
        <label className="space-y-1 text-sm">
          <span className="font-mono font-medium">
            {String(data["language"] ?? "Code")} response
          </span>
          <textarea
            rows={12}
            spellCheck={false}
            value={answer === undefined ? String(data["starterCode"] ?? "") : text(answer)}
            disabled={disabled}
            onChange={(event) => onAnswer(event.target.value)}
            className={`${inputClass} bg-ink-900 text-paper-100 font-mono`}
          />
        </label>
      );
    case "fill-blanks":
      return (
        <FillBlankInput
          data={data}
          dropdown={false}
          answer={answer}
          onAnswer={onAnswer}
          disabled={disabled}
        />
      );
    case "fill-blanks-dd":
      return (
        <FillBlankInput
          data={data}
          dropdown
          answer={answer}
          onAnswer={onAnswer}
          disabled={disabled}
        />
      );
    case "matching": {
      const values = record(answer);
      const pairs = rows(data["pairs"]);
      return (
        <fieldset className="space-y-3">
          <legend className="sr-only">Match each item</legend>
          {pairs.map((pair, index) => {
            const id = String(pair["id"] ?? index);
            return (
              <label key={id} className="grid gap-2 text-sm sm:grid-cols-2 sm:items-center">
                <span className="bg-muted rounded-md p-3">{String(pair["left"] ?? "")}</span>
                <select
                  value={values[id] ?? ""}
                  disabled={disabled}
                  onChange={(event) => onAnswer({ ...values, [id]: event.target.value })}
                  className={inputClass}
                >
                  <option value="">Choose a match</option>
                  {pairs.map((candidate) => (
                    <option key={String(candidate["id"])} value={String(candidate["id"])}>
                      {String(candidate["right"] ?? "")}
                    </option>
                  ))}
                </select>
              </label>
            );
          })}
        </fieldset>
      );
    }
    case "jumbled": {
      const items = rows(data["items"]);
      const ordered = array(answer).length
        ? array(answer)
        : items.map((item) => String(item["id"]));
      const move = (index: number, delta: number) => {
        const next = [...ordered];
        const target = index + delta;
        if (target < 0 || target >= next.length) return;
        [next[index], next[target]] = [next[target]!, next[index]!];
        onAnswer(next);
      };
      return (
        <ol className="space-y-2">
          {ordered.map((id, index) => (
            <li key={id} className="flex min-h-11 items-center gap-2 rounded-md border p-2">
              <span className="w-6 text-center font-mono text-sm">{index + 1}</span>
              <span className="flex-1 text-sm">
                {String(items.find((item) => item["id"] === id)?.["text"] ?? id)}
              </span>
              <button
                type="button"
                disabled={disabled || index === 0}
                onClick={() => move(index, -1)}
                className="min-h-9 px-2 disabled:opacity-40"
                aria-label={`Move item ${index + 1} up`}
              >
                ↑
              </button>
              <button
                type="button"
                disabled={disabled || index === ordered.length - 1}
                onClick={() => move(index, 1)}
                className="min-h-9 px-2 disabled:opacity-40"
                aria-label={`Move item ${index + 1} down`}
              >
                ↓
              </button>
            </li>
          ))}
        </ol>
      );
    }
    case "audio":
      return (
        <label className="border-subtle focus-within:ring-brand flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed p-4 text-sm focus-within:ring-2">
          <FileAudio className="h-6 w-6" aria-hidden />
          <span>{text(answer) || "Record or choose an audio response"}</span>
          <input
            type="file"
            accept="audio/*"
            capture
            disabled={disabled}
            className="sr-only"
            onChange={(event) => onAnswer(event.target.files?.[0]?.name ?? "")}
          />
        </label>
      );
    case "image_evaluation":
      return (
        <label className="border-subtle focus-within:ring-brand flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed p-4 text-sm focus-within:ring-2">
          <ImagePlus className="h-6 w-6" aria-hidden />
          <span>
            {array(answer).length
              ? `${array(answer).length} image(s) selected`
              : "Choose image response(s)"}
          </span>
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={disabled}
            className="sr-only"
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              onAnswer(Array.from(event.target.files ?? []).map((file) => file.name))
            }
          />
        </label>
      );
    case "group-options": {
      const values = record(answer);
      const groups = rows(data["groups"]);
      return (
        <fieldset className="space-y-3">
          <legend className="sr-only">Assign every option to a group</legend>
          {rows(data["items"]).map((item) => {
            const id = String(item["id"]);
            return (
              <label key={id} className="grid gap-2 text-sm sm:grid-cols-2 sm:items-center">
                <span>{String(item["text"] ?? "")}</span>
                <select
                  value={values[id] ?? ""}
                  disabled={disabled}
                  onChange={(event) => onAnswer({ ...values, [id]: event.target.value })}
                  className={inputClass}
                >
                  <option value="">Choose a group</option>
                  {groups.map((group) => (
                    <option key={String(group["id"])} value={String(group["id"])}>
                      {String(group["name"] ?? "")}
                    </option>
                  ))}
                </select>
              </label>
            );
          })}
        </fieldset>
      );
    }
    case "chat_agent_question":
      return (
        <label className="space-y-2 text-sm">
          <span className="flex items-center gap-2 font-medium">
            <MessageCircle className="h-4 w-4" aria-hidden /> Conversation response
          </span>
          <textarea
            rows={6}
            value={text(answer)}
            disabled={disabled}
            placeholder="Draft the student’s conversation. Preview does not contact the AI agent."
            onChange={(event) => onAnswer(event.target.value)}
            className={inputClass}
          />
        </label>
      );
    default:
      return (
        <p role="alert" className="text-error text-sm">
          Unsupported question type: {type}
        </p>
      );
  }
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export default function StudentPreviewItem({
  item,
  answer,
  onAnswer,
  disabled,
  showAnswers,
}: StudentPreviewItemProps) {
  if (item.type === "material") {
    return (
      <article aria-label={`${itemPreviewType(item)} learning material`}>
        <ItemPreview item={item} />
      </article>
    );
  }

  const payload = item.payload as QuestionPayload;
  const data = (payload.questionData ?? {}) as Data;
  const type = itemPreviewType(item);
  const title = item.title ?? payload.title;
  const content = item.content ?? payload.content;
  return (
    <article className="space-y-5" aria-labelledby={`preview-item-${item.id}`}>
      <header className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="capitalize">
            {type.replace(/[-_]/g, " ")}
          </Badge>
          {(item.difficulty ?? payload.difficulty) && (
            <Badge variant="outline" className="capitalize">
              {item.difficulty ?? payload.difficulty}
            </Badge>
          )}
          {payload.basePoints ? (
            <Badge variant="secondary">{payload.basePoints} points</Badge>
          ) : null}
        </div>
        {title && (
          <h2 id={`preview-item-${item.id}`} className="font-display text-xl font-semibold">
            {title}
          </h2>
        )}
        <p className="max-w-reading whitespace-pre-wrap leading-relaxed">{content}</p>
      </header>
      <Attachments attachments={item.attachments} />
      <QuestionControl
        type={type}
        data={data}
        answer={answer}
        onAnswer={onAnswer}
        disabled={disabled}
      />
      {showAnswers && <AnswerReveal payload={payload} />}
    </article>
  );
}
