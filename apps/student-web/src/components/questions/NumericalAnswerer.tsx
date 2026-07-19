import type { NumericalData } from "@levelup/shared-types";

interface NumericalAnswererProps {
  data: NumericalData;
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export default function NumericalAnswerer({
  data,
  value = "",
  onChange,
  disabled,
}: NumericalAnswererProps) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        step={data.decimalPlaces ? Math.pow(10, -data.decimalPlaces) : "any"}
        placeholder="Enter your answer"
        className="border-input focus-visible:ring-ring flex-1 rounded-md border px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 disabled:opacity-60"
      />
      {data.unit && <span className="text-muted-foreground text-sm">{data.unit}</span>}
    </div>
  );
}
