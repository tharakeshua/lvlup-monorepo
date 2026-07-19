import { cn } from "../../lib/utils";
import { Target, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "../ui/card";

export interface StudyGoalCardProps {
  title: string;
  targetType: string;
  targetCount: number;
  currentCount: number;
  startDate: string;
  endDate: string;
  completed: boolean;
  className?: string;
}

const typeLabels: Record<string, string> = {
  spaces: "spaces",
  story_points: "sections",
  items: "items",
  exams: "exams",
  minutes: "minutes",
};

export function StudyGoalCard({
  title,
  targetType,
  targetCount,
  currentCount,
  endDate,
  completed,
  className,
}: StudyGoalCardProps) {
  const progress = targetCount > 0 ? Math.min(100, (currentCount / targetCount) * 100) : 0;
  const daysLeft = Math.max(0, Math.ceil((new Date(endDate).getTime() - Date.now()) / 86400000));

  return (
    <Card
      className={cn("transition-all", completed && "ring-1 ring-green-500/30", className)}
      role="article"
      aria-label={`Study goal: ${title}, ${completed ? "completed" : `${Math.round(progress)}% complete, ${daysLeft} days left`}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            {completed ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <Target className="text-primary h-4 w-4" />
            )}
            <h4 className="font-medium">{title}</h4>
          </div>
          {!completed && <span className="text-muted-foreground text-xs">{daysLeft}d left</span>}
        </div>

        <div className="mt-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {currentCount} / {targetCount} {typeLabels[targetType] ?? targetType}
            </span>
            <span className="font-medium">{Math.round(progress)}%</span>
          </div>
          <div
            className="bg-muted mt-1.5 h-2 overflow-hidden rounded-full"
            role="progressbar"
            aria-valuenow={Math.round(progress)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${title}: ${currentCount} of ${targetCount} ${typeLabels[targetType] ?? targetType}`}
          >
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                completed ? "bg-green-500" : "bg-primary"
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
