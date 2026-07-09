import type {
  UnifiedItem,
  QuestionPayload,
  MaterialPayload,
  MCQData,
  MCAQData,
  TrueFalseData,
  NumericalData,
  TextData,
  ParagraphData,
  CodeData,
  FillBlanksData,
  FillBlanksDDData,
  MatchingData,
  JumbledData,
  AudioData,
  ImageEvaluationData,
  GroupOptionsData,
  ChatAgentQuestionData,
  RichContentBlock,
  ItemAttachment,
} from "@levelup/shared-types";
import { Checkbox, RadioGroup, RadioGroupItem, RichTextViewer } from "@levelup/shared-ui";
import {
  CheckCircle2,
  Circle,
  ExternalLink,
  File,
  FileText,
  Image as ImageIcon,
  Mic,
  MessageCircle,
} from "lucide-react";

interface ItemPreviewProps {
  item: UnifiedItem;
}

export default function ItemPreview({ item }: ItemPreviewProps) {
  if (item.type === "question") {
    return <QuestionPreview item={item} />;
  }
  if (item.type === "material") {
    return <MaterialPreview item={item} />;
  }
  return (
    <p className="text-muted-foreground text-sm italic">
      Preview not available for type "{item.type}".
    </p>
  );
}

// ────────────────────────────────────────────
// Question preview
// ────────────────────────────────────────────

function QuestionPreview({ item }: { item: UnifiedItem }) {
  const payload = item.payload as QuestionPayload;
  const data = payload.questionData;

  return (
    <div className="space-y-3">
      <QuestionHeader payload={payload} attachments={item.attachments} />
      <QuestionTypeRenderer type={payload.questionType} data={data} />
      {payload.explanation && (
        <div className="bg-muted/50 border-subtle rounded-md border p-3 text-xs">
          <p className="text-fg-muted tracking-caps mb-1 font-bold uppercase">Explanation</p>
          <p className="whitespace-pre-wrap">{payload.explanation}</p>
        </div>
      )}
    </div>
  );
}

function QuestionHeader({
  payload,
  attachments,
}: {
  payload: QuestionPayload;
  attachments?: ItemAttachment[];
}) {
  const imageAttachments = (attachments ?? []).filter((a) => a.type === "image");
  return (
    <div className="space-y-2">
      {payload.title && <h4 className="text-sm font-semibold">{payload.title}</h4>}
      {payload.content && <div className="whitespace-pre-wrap text-sm">{payload.content}</div>}
      <div className="flex items-center gap-2">
        {payload.difficulty && (
          <span
            className={`rounded-pill inline-block px-2 py-0.5 text-[10px] font-medium uppercase ${
              payload.difficulty === "easy"
                ? "bg-success-subtle text-success"
                : payload.difficulty === "medium"
                  ? "bg-warning-subtle text-warning"
                  : "bg-error-subtle text-error"
            }`}
          >
            {payload.difficulty}
          </span>
        )}
        {payload.basePoints != null && payload.basePoints > 0 && (
          <span className="text-muted-foreground font-mono text-xs">{payload.basePoints} pts</span>
        )}
      </div>
      {imageAttachments.length > 0 && (
        <div
          className={`grid gap-2 ${imageAttachments.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}
        >
          {imageAttachments.map((img) => (
            <img
              key={img.id}
              src={img.url}
              alt={img.fileName}
              loading="lazy"
              className="max-h-48 w-full rounded-md border object-contain"
            />
          ))}
        </div>
      )}
    </div>
  );
}

function QuestionTypeRenderer({ type, data }: { type: string; data: unknown }) {
  switch (type) {
    case "mcq":
      return <MCQPreview data={data as MCQData} />;
    case "mcaq":
      return <MCAQPreview data={data as MCAQData} />;
    case "true-false":
      return <TrueFalsePreview data={data as TrueFalseData} />;
    case "numerical":
      return <NumericalPreview data={data as NumericalData} />;
    case "text":
      return <TextPreview data={data as TextData} />;
    case "paragraph":
      return <ParagraphPreview data={data as ParagraphData} />;
    case "code":
      return <CodePreview data={data as CodeData} />;
    case "fill-blanks":
      return <FillBlanksPreview data={data as FillBlanksData} />;
    case "fill-blanks-dd":
      return <FillBlanksDDPreview data={data as FillBlanksDDData} />;
    case "matching":
      return <MatchingPreview data={data as MatchingData} />;
    case "jumbled":
      return <JumbledPreview data={data as JumbledData} />;
    case "audio":
      return <AudioPreview data={data as AudioData} />;
    case "image_evaluation":
      return <ImageEvaluationPreview data={data as ImageEvaluationData} />;
    case "group-options":
      return <GroupOptionsPreview data={data as GroupOptionsData} />;
    case "chat_agent_question":
      return <ChatAgentPreview data={data as ChatAgentQuestionData} />;
    default:
      return (
        <p className="text-muted-foreground text-xs italic">Unsupported question type: {type}</p>
      );
  }
}

function MCQPreview({ data }: { data: MCQData }) {
  if (!data?.options?.length) {
    return <p className="text-muted-foreground text-xs italic">No options configured.</p>;
  }
  return (
    <RadioGroup value="" className="space-y-1.5">
      {data.options.map((opt) => (
        <label
          key={opt.id}
          className={`flex cursor-default items-start gap-2 rounded-md border p-2 text-sm ${
            opt.isCorrect ? "border-success/40 bg-success-subtle text-success" : ""
          }`}
        >
          <RadioGroupItem value={opt.id} disabled className="mt-0.5" />
          <span className="flex-1">{opt.text}</span>
          {opt.isCorrect && <CheckCircle2 className="text-success mt-0.5 h-4 w-4 flex-shrink-0" />}
        </label>
      ))}
    </RadioGroup>
  );
}

function MCAQPreview({ data }: { data: MCAQData }) {
  if (!data?.options?.length) {
    return <p className="text-muted-foreground text-xs italic">No options configured.</p>;
  }
  return (
    <div className="space-y-1.5">
      {data.options.map((opt) => (
        <label
          key={opt.id}
          className={`flex cursor-default items-start gap-2 rounded-md border p-2 text-sm ${
            opt.isCorrect ? "border-success/40 bg-success-subtle text-success" : ""
          }`}
        >
          <Checkbox checked={opt.isCorrect} disabled className="mt-0.5" />
          <span className="flex-1">{opt.text}</span>
          {opt.isCorrect && <CheckCircle2 className="text-success mt-0.5 h-4 w-4 flex-shrink-0" />}
        </label>
      ))}
    </div>
  );
}

function TrueFalsePreview({ data }: { data: TrueFalseData }) {
  return (
    <div className="flex gap-2">
      {[true, false].map((v) => (
        <div
          key={String(v)}
          className={`flex flex-1 items-center justify-center gap-2 rounded-md border p-3 text-sm ${
            data?.correctAnswer === v ? "border-success/40 bg-success-subtle text-success" : ""
          }`}
        >
          {data?.correctAnswer === v ? (
            <CheckCircle2 className="text-success h-4 w-4" />
          ) : (
            <Circle className="text-muted-foreground h-4 w-4" />
          )}
          <span>{v ? "True" : "False"}</span>
        </div>
      ))}
    </div>
  );
}

function NumericalPreview({ data }: { data: NumericalData }) {
  return (
    <div className="space-y-1.5">
      <input
        type="text"
        disabled
        placeholder="Numerical answer"
        className="bg-muted/50 w-full rounded-md border px-3 py-2 text-sm"
      />
      <div className="text-muted-foreground flex flex-wrap gap-3 font-mono text-xs">
        <span>
          <strong>Answer:</strong> {data?.correctAnswer ?? "—"}
          {data?.unit ? ` ${data.unit}` : ""}
        </span>
        {data?.tolerance != null && (
          <span>
            <strong>Tolerance:</strong> ±{data.tolerance}
          </span>
        )}
        {data?.decimalPlaces != null && (
          <span>
            <strong>Decimals:</strong> {data.decimalPlaces}
          </span>
        )}
      </div>
    </div>
  );
}

function TextPreview({ data }: { data: TextData }) {
  return (
    <div className="space-y-1.5">
      <input
        type="text"
        disabled
        placeholder="Short text answer"
        className="bg-muted/50 w-full rounded-md border px-3 py-2 text-sm"
        maxLength={data?.maxLength}
      />
      {(data?.correctAnswer || (data?.acceptableAnswers ?? []).length > 0) && (
        <div className="text-muted-foreground text-xs">
          <strong>Accepted:</strong>{" "}
          {[data.correctAnswer, ...(data.acceptableAnswers ?? [])].filter(Boolean).join(", ") ||
            "—"}
          {data.caseSensitive && <span className="ml-2 italic">(case-sensitive)</span>}
        </div>
      )}
    </div>
  );
}

function ParagraphPreview({ data }: { data: ParagraphData }) {
  return (
    <div className="space-y-1.5">
      <textarea
        disabled
        placeholder="Long-form answer (AI-evaluated)"
        rows={4}
        className="bg-muted/50 w-full rounded-md border px-3 py-2 text-sm"
      />
      <div className="text-muted-foreground flex flex-wrap gap-3 text-xs">
        {data?.minLength != null && (
          <span>
            <strong>Min:</strong> {data.minLength}
          </span>
        )}
        {data?.maxLength != null && (
          <span>
            <strong>Max:</strong> {data.maxLength}
          </span>
        )}
      </div>
      {data?.modelAnswer && (
        <div className="bg-muted/50 border-subtle rounded-md border p-2 text-xs">
          <p className="text-fg-muted tracking-caps mb-1 font-bold uppercase">Model Answer</p>
          <p className="whitespace-pre-wrap">{data.modelAnswer}</p>
        </div>
      )}
    </div>
  );
}

function CodePreview({ data }: { data: CodeData }) {
  return (
    <div className="space-y-2">
      <div className="bg-muted/50 flex items-center justify-between rounded-t-md border-x border-t px-3 py-1.5 text-xs">
        <span className="font-mono uppercase">{data?.language ?? "code"}</span>
        <span className="text-muted-foreground">read-only</span>
      </div>
      <pre className="bg-ink-900 text-paper-100 -mt-2 overflow-x-auto rounded-b-md border p-3 text-xs">
        <code>{data?.starterCode ?? "// no starter code"}</code>
      </pre>
      {(data?.testCases ?? []).length > 0 && (
        <div className="space-y-1">
          <p className="text-fg-muted tracking-caps text-xs font-bold uppercase">
            Test cases ({data.testCases.length})
          </p>
          {data.testCases.slice(0, 3).map((tc) => (
            <div key={tc.id} className="rounded border p-2 text-xs">
              <div className="font-mono">
                <span className="text-muted-foreground">in:</span> {tc.input}
              </div>
              <div className="font-mono">
                <span className="text-muted-foreground">out:</span> {tc.expectedOutput}
              </div>
              {tc.isHidden && <span className="text-muted-foreground italic">(hidden)</span>}
            </div>
          ))}
          {data.testCases.length > 3 && (
            <p className="text-muted-foreground text-xs italic">
              +{data.testCases.length - 3} more
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function FillBlanksPreview({ data }: { data: FillBlanksData }) {
  if (!data?.textWithBlanks) {
    return <p className="text-muted-foreground text-xs italic">No text configured.</p>;
  }
  // Replace {{blank-id}} or [[id]] with input slots
  const blanks = data.blanks ?? [];
  const parts = data.textWithBlanks.split(/(\{\{[^}]+\}\}|\[\[[^\]]+\]\])/g);
  let blankIdx = 0;
  return (
    <div className="space-y-2">
      <div className="text-sm leading-relaxed">
        {parts.map((part, i) => {
          if (/^\{\{.*\}\}$/.test(part) || /^\[\[.*\]\]$/.test(part)) {
            const blank = blanks[blankIdx++];
            return (
              <span
                key={i}
                className="bg-muted/50 mx-1 inline-block min-w-[80px] rounded border-b-2 border-dashed px-2 py-0.5 text-center text-xs"
                title={blank?.correctAnswer}
              >
                {blank?.correctAnswer ?? "____"}
              </span>
            );
          }
          return <span key={i}>{part}</span>;
        })}
      </div>
    </div>
  );
}

function FillBlanksDDPreview({ data }: { data: FillBlanksDDData }) {
  if (!data?.textWithBlanks) {
    return <p className="text-muted-foreground text-xs italic">No text configured.</p>;
  }
  const blanks = data.blanks ?? [];
  const parts = data.textWithBlanks.split(/(\{\{[^}]+\}\}|\[\[[^\]]+\]\])/g);
  let blankIdx = 0;
  return (
    <div className="space-y-2">
      <div className="text-sm leading-relaxed">
        {parts.map((part, i) => {
          if (/^\{\{.*\}\}$/.test(part) || /^\[\[.*\]\]$/.test(part)) {
            const blank = blanks[blankIdx++];
            const correct = blank?.options.find((o) => o.id === blank.correctOptionId);
            return (
              <span
                key={i}
                className="bg-success-subtle border-success/40 text-success mx-1 inline-block min-w-[80px] rounded border px-2 py-0.5 text-center text-xs"
              >
                {correct?.text ?? "____"}
              </span>
            );
          }
          return <span key={i}>{part}</span>;
        })}
      </div>
      {blanks.length > 0 && (
        <div className="text-muted-foreground text-xs">
          <strong>Word bank:</strong>{" "}
          {Array.from(new Set(blanks.flatMap((b) => b.options.map((o) => o.text)))).join(", ")}
        </div>
      )}
    </div>
  );
}

function MatchingPreview({ data }: { data: MatchingData }) {
  if (!data?.pairs?.length) {
    return <p className="text-muted-foreground text-xs italic">No pairs configured.</p>;
  }
  return (
    <div className="space-y-1.5">
      {data.pairs.map((pair) => (
        <div key={pair.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
          <span className="bg-muted flex-1 rounded px-2 py-1">{pair.left}</span>
          <span className="text-muted-foreground text-xs">↔</span>
          <span className="bg-success-subtle border-success/40 flex-1 rounded border px-2 py-1">
            {pair.right}
          </span>
        </div>
      ))}
    </div>
  );
}

function JumbledPreview({ data }: { data: JumbledData }) {
  if (!data?.items?.length) {
    return <p className="text-muted-foreground text-xs italic">No items configured.</p>;
  }
  const ordered = (data.correctOrder ?? [])
    .map((id) => data.items.find((it) => it.id === id))
    .filter((it): it is { id: string; text: string } => !!it);
  const items = ordered.length > 0 ? ordered : data.items;
  return (
    <div className="space-y-1.5">
      <p className="text-fg-muted tracking-caps text-xs font-bold uppercase">Correct order</p>
      {items.map((it, idx) => (
        <div
          key={it.id}
          className="bg-success-subtle border-success/40 flex items-center gap-2 rounded-md border p-2 text-sm"
        >
          <span className="bg-success/20 text-success rounded-pill flex h-6 w-6 items-center justify-center font-mono text-xs font-semibold">
            {idx + 1}
          </span>
          <span className="flex-1">{it.text}</span>
        </div>
      ))}
    </div>
  );
}

function AudioPreview({ data }: { data: AudioData }) {
  return (
    <div className="rounded-md border p-3">
      <div className="flex items-center gap-2 text-sm">
        <Mic className="text-muted-foreground h-4 w-4" />
        <span>Student records audio response</span>
      </div>
      <div className="text-muted-foreground mt-1 flex flex-wrap gap-3 text-xs">
        {data?.maxDurationSeconds != null && (
          <span>
            <strong>Max:</strong> {data.maxDurationSeconds}s
          </span>
        )}
        {data?.language && (
          <span>
            <strong>Language:</strong> {data.language}
          </span>
        )}
      </div>
    </div>
  );
}

function ImageEvaluationPreview({ data }: { data: ImageEvaluationData }) {
  return (
    <div className="space-y-2">
      <div className="bg-muted/30 flex flex-col items-center gap-2 rounded-md border border-dashed p-4 text-center">
        <ImageIcon className="text-muted-foreground h-6 w-6" />
        <p className="text-muted-foreground text-xs">
          Student uploads up to {data?.maxImages ?? 1} image(s)
        </p>
      </div>
      {data?.instructions && (
        <p className="text-muted-foreground text-xs">
          <strong>Instructions:</strong> {data.instructions}
        </p>
      )}
    </div>
  );
}

function GroupOptionsPreview({ data }: { data: GroupOptionsData }) {
  if (!data?.groups?.length) {
    return <p className="text-muted-foreground text-xs italic">No groups configured.</p>;
  }
  const itemMap = new Map(data.items.map((it) => [it.id, it.text]));
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {data.groups.map((group) => (
        <div key={group.id} className="rounded-md border p-2">
          <p className="tracking-caps mb-1.5 text-xs font-semibold uppercase">{group.name}</p>
          <div className="space-y-1">
            {group.correctItems.map((itemId) => (
              <div
                key={itemId}
                className="bg-success-subtle border-success/40 rounded border px-2 py-1 text-xs"
              >
                {itemMap.get(itemId) ?? itemId}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ChatAgentPreview({ data }: { data: ChatAgentQuestionData }) {
  return (
    <div className="space-y-2">
      <div className="bg-muted/30 flex items-center gap-2 rounded-md border p-3 text-sm">
        <MessageCircle className="text-muted-foreground h-4 w-4" />
        <span>Conversational agent task</span>
      </div>
      {(data?.objectives ?? []).length > 0 && (
        <div className="text-xs">
          <p className="text-fg-muted tracking-caps mb-1 font-bold uppercase">Objectives</p>
          <ul className="list-disc space-y-0.5 pl-5">
            {data.objectives.map((o, i) => (
              <li key={i}>{o}</li>
            ))}
          </ul>
        </div>
      )}
      {(data?.conversationStarters ?? []).length > 0 && (
        <div className="text-xs">
          <p className="text-fg-muted tracking-caps mb-1 font-bold uppercase">Starters</p>
          <ul className="list-disc space-y-0.5 pl-5">
            {data.conversationStarters!.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}
      {data?.maxTurns != null && (
        <p className="text-muted-foreground text-xs">
          <strong>Max turns:</strong> {data.maxTurns}
        </p>
      )}
    </div>
  );
}

// ────────────────────────────────────────────
// Material preview
// ────────────────────────────────────────────

function MaterialPreview({ item }: { item: UnifiedItem }) {
  const payload = item.payload as MaterialPayload;
  return (
    <div className="space-y-3">
      <MaterialContent payload={payload} title={item.title} content={item.content} />
      {item.attachments && item.attachments.length > 0 && (
        <MaterialAttachments attachments={item.attachments} />
      )}
    </div>
  );
}

function MaterialContent({
  payload,
  title,
  content: itemContent,
}: {
  payload: MaterialPayload;
  title?: string;
  content?: string;
}) {
  switch (payload.materialType) {
    case "text":
    case "story":
      return <TextMaterialPreview content={payload.content ?? itemContent ?? ""} title={title} />;
    case "video":
      return <VideoMaterialPreview url={payload.url} duration={payload.duration} title={title} />;
    case "pdf":
      return (
        <PDFMaterialPreview url={payload.url} title={title} downloadable={payload.downloadable} />
      );
    case "link":
      return <LinkMaterialPreview url={payload.url} title={title} />;
    case "interactive":
      return <InteractiveMaterialPreview url={payload.url} title={title} />;
    case "rich":
      return <RichMaterialPreview richContent={payload.richContent} title={title} />;
    default:
      return <p className="text-muted-foreground text-xs italic">Unsupported material type.</p>;
  }
}

function TextMaterialPreview({ content, title }: { content: string; title?: string }) {
  if (!content) {
    return <p className="text-muted-foreground text-xs italic">No content yet.</p>;
  }
  const isHtml = content.startsWith("<") || content.includes("<p>") || content.includes("<h");
  return (
    <div>
      {title && <h4 className="mb-2 text-sm font-semibold">{title}</h4>}
      {isHtml ? (
        <RichTextViewer content={content} className="prose prose-sm max-w-none" />
      ) : (
        <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm">{content}</div>
      )}
    </div>
  );
}

function VideoMaterialPreview({
  url,
  duration,
  title,
}: {
  url?: string;
  duration?: number;
  title?: string;
}) {
  if (!url) {
    return <p className="text-muted-foreground text-xs italic">No video URL provided.</p>;
  }
  const youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
  return (
    <div>
      {title && <h4 className="mb-2 text-sm font-semibold">{title}</h4>}
      {youtubeMatch ? (
        <div className="aspect-video overflow-hidden rounded-md">
          <iframe
            src={`https://www.youtube.com/embed/${youtubeMatch[1]}`}
            className="h-full w-full"
            allowFullScreen
            title={title || "Video preview"}
          />
        </div>
      ) : (
        <video src={url} controls className="w-full rounded-md" />
      )}
      {duration && (
        <p className="text-muted-foreground mt-1 text-xs">
          Duration: {Math.floor(duration / 60)}m {duration % 60}s
        </p>
      )}
    </div>
  );
}

function PDFMaterialPreview({
  url,
  title,
  downloadable,
}: {
  url?: string;
  title?: string;
  downloadable?: boolean;
}) {
  if (!url) {
    return <p className="text-muted-foreground text-xs italic">No PDF URL provided.</p>;
  }
  return (
    <div>
      {title && <h4 className="mb-2 text-sm font-semibold">{title}</h4>}
      <div className="overflow-hidden rounded-md border" style={{ height: "400px" }}>
        <iframe src={url} className="h-full w-full" title={title || "PDF preview"} />
      </div>
      {downloadable && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary mt-2 inline-flex items-center gap-1 text-xs hover:underline"
        >
          <File className="h-3 w-3" /> Download
        </a>
      )}
    </div>
  );
}

function LinkMaterialPreview({ url, title }: { url?: string; title?: string }) {
  if (!url) {
    return <p className="text-muted-foreground text-xs italic">No URL provided.</p>;
  }
  return (
    <div>
      {title && <h4 className="mb-2 text-sm font-semibold">{title}</h4>}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-brand hover:bg-brand-subtle border-subtle duration-fast ease-standard inline-flex items-center gap-2 rounded-md border p-3 text-sm transition-colors"
      >
        <ExternalLink className="h-4 w-4" />
        <span className="truncate">{url}</span>
      </a>
    </div>
  );
}

function InteractiveMaterialPreview({ url, title }: { url?: string; title?: string }) {
  if (!url) {
    return <p className="text-muted-foreground text-xs italic">No interactive URL.</p>;
  }
  return (
    <div>
      {title && <h4 className="mb-2 text-sm font-semibold">{title}</h4>}
      <div className="overflow-hidden rounded-md border" style={{ height: "400px" }}>
        <iframe
          src={url}
          className="h-full w-full"
          sandbox="allow-scripts allow-same-origin"
          title={title || "Interactive preview"}
        />
      </div>
    </div>
  );
}

function RichMaterialPreview({
  richContent,
  title,
}: {
  richContent?: RichContentBlock;
  title?: string;
}) {
  if (!richContent) {
    return <p className="text-muted-foreground text-xs italic">No rich content yet.</p>;
  }
  return (
    <article className="space-y-2">
      {richContent.coverImage && (
        <img
          src={richContent.coverImage}
          alt={richContent.title || title || "Cover"}
          loading="lazy"
          className="max-h-48 w-full rounded-md object-cover"
        />
      )}
      {(richContent.title || title) && (
        <h4 className="text-base font-semibold">{richContent.title || title}</h4>
      )}
      {richContent.subtitle && (
        <p className="text-muted-foreground text-sm">{richContent.subtitle}</p>
      )}
      {richContent.author && (
        <p className="text-muted-foreground text-xs">
          By {richContent.author.name}
          {richContent.readingTime ? ` · ${richContent.readingTime} min read` : ""}
        </p>
      )}
      <div className="space-y-2">
        {richContent.blocks?.map((block) => {
          switch (block.type) {
            case "heading":
              return (
                <h5 key={block.id} className="mt-2 text-sm font-semibold">
                  {block.content}
                </h5>
              );
            case "paragraph":
              return (
                <p key={block.id} className="text-sm leading-relaxed">
                  {block.content}
                </p>
              );
            case "image":
              return (
                <img
                  key={block.id}
                  src={block.content}
                  alt={
                    ((block.metadata as Record<string, unknown>)?.caption as string) ||
                    "Content image"
                  }
                  loading="lazy"
                  className="max-h-64 w-full rounded-md border object-contain"
                />
              );
            case "code":
              return (
                <pre
                  key={block.id}
                  className="bg-ink-900 text-paper-100 overflow-x-auto rounded p-2 text-xs"
                >
                  <code>{block.content}</code>
                </pre>
              );
            case "quote":
              return (
                <blockquote
                  key={block.id}
                  className="border-border text-muted-foreground border-l-4 pl-3 text-sm italic"
                >
                  {block.content}
                </blockquote>
              );
            case "list": {
              const items: string[] =
                ((block.metadata as Record<string, unknown>)?.items as string[]) ??
                (block.content ? block.content.split("\n").filter(Boolean) : []);
              const isOrdered = (block.metadata as Record<string, unknown>)?.listType === "ordered";
              const Tag = isOrdered ? "ol" : "ul";
              return (
                <Tag
                  key={block.id}
                  className={`${isOrdered ? "list-decimal" : "list-disc"} space-y-0.5 pl-5 text-sm`}
                >
                  {items.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </Tag>
              );
            }
            case "divider":
              return <hr key={block.id} className="border-border" />;
            default:
              return (
                <p key={block.id} className="text-sm">
                  {block.content}
                </p>
              );
          }
        })}
      </div>
      {richContent.tags && richContent.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1">
          {richContent.tags.map((t) => (
            <span key={t} className="bg-muted rounded-full px-2 py-0.5 text-xs">
              {t}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}

function MaterialAttachments({ attachments }: { attachments: ItemAttachment[] }) {
  return (
    <div className="space-y-1">
      <p className="text-fg-muted tracking-caps text-xs font-bold uppercase">Attachments</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {attachments.map((att) => {
          if (att.type === "image") {
            return (
              <img
                key={att.id}
                src={att.url}
                alt={att.fileName}
                loading="lazy"
                className="max-h-32 w-full rounded-md border object-contain"
              />
            );
          }
          if (att.type === "audio") {
            return (
              <div key={att.id} className="rounded-md border p-2">
                <p className="mb-1 truncate text-xs">{att.fileName}</p>
                <audio controls src={att.url} className="w-full" />
              </div>
            );
          }
          return (
            <a
              key={att.id}
              href={att.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:bg-muted/50 flex items-center gap-2 rounded-md border p-2 text-xs"
            >
              <FileText className="h-3.5 w-3.5" />
              <span className="flex-1 truncate">{att.fileName}</span>
            </a>
          );
        })}
      </div>
    </div>
  );
}
