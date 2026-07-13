interface QuotaUsageCardProps {
  label: string;
  current: number;
  max: number | undefined;
}

function getUsageColor(ratio: number): string {
  if (ratio > 0.9) return "bg-red-500";
  if (ratio > 0.7) return "bg-amber-500";
  return "bg-primary";
}

function getUsageTextColor(ratio: number): string {
  if (ratio > 0.9) return "text-red-600 dark:text-red-400";
  if (ratio > 0.7) return "text-amber-600 dark:text-amber-400";
  return "text-muted-foreground";
}

export default function QuotaUsageCard({ label, current, max }: QuotaUsageCardProps) {
  const isUnlimited = max === undefined || max === null;
  const ratio = isUnlimited ? 0 : max > 0 ? current / max : 0;
  const percentage = Math.min(ratio * 100, 100);

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span
          className={`text-xs ${isUnlimited ? "text-muted-foreground" : getUsageTextColor(ratio)}`}
        >
          {current}
          {isUnlimited ? "" : ` / ${max}`}
        </span>
      </div>
      {isUnlimited ? (
        <div className="flex items-center gap-1.5">
          <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
            <div className="bg-primary/30 h-full w-1/4 rounded-full" />
          </div>
          <span className="text-muted-foreground text-[10px]">Unlimited</span>
        </div>
      ) : (
        <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
          <div
            className={`h-full rounded-full transition-all ${getUsageColor(ratio)}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}
    </div>
  );
}
