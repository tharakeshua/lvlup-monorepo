import type { CodeData } from "@levelup/shared-types";

interface CodeAnswererProps {
  data: CodeData;
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export default function CodeAnswerer({ data, value, onChange, disabled }: CodeAnswererProps) {
  const testCases = data?.testCases ?? [];
  const code = value ?? data.starterCode ?? "";

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-muted-foreground text-xs font-medium uppercase">
          {data?.language ?? "code"}
        </span>
        {testCases.length > 0 && (
          <span className="text-muted-foreground text-xs">
            {testCases.filter((tc) => !tc.isHidden).length} visible test case(s)
          </span>
        )}
      </div>
      <textarea
        value={code}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        rows={12}
        spellCheck={false}
        className="border-input focus-visible:ring-ring w-full resize-y rounded-md border bg-zinc-900 px-3 py-2 font-mono text-sm leading-relaxed text-zinc-100 focus:outline-none focus-visible:ring-2 disabled:opacity-60 dark:bg-zinc-950"
      />
      {testCases.filter((tc) => !tc.isHidden).length > 0 && (
        <div className="mt-2 space-y-1">
          <p className="text-xs font-medium">Test Cases:</p>
          {testCases
            .filter((tc) => !tc.isHidden)
            .map((tc) => (
              <div key={tc.id} className="bg-muted/50 rounded border p-2 font-mono text-xs">
                {tc.description && <p className="text-muted-foreground mb-1">{tc.description}</p>}
                <p>Input: {tc.input}</p>
                <p>Expected: {tc.expectedOutput}</p>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
