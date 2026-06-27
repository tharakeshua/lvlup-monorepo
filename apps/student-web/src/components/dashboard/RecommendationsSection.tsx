import { Link } from "react-router-dom";
import { useLearningInsights, useDismissInsight } from "@levelup/query";
import type { LearningInsight, InsightId, UserId } from "@levelup/domain";
import { Lightbulb, BookOpen, Flame, Trophy, AlertTriangle, TrendingUp, X } from "lucide-react";

const INSIGHT_CONFIG: Record<string, { icon: typeof Lightbulb; color: string; bg: string }> = {
  weak_topic_recommendation: { icon: Lightbulb, color: "text-orange-600", bg: "bg-orange-50" },
  exam_preparation: { icon: BookOpen, color: "text-primary", bg: "bg-primary/10" },
  streak_encouragement: { icon: Flame, color: "text-destructive", bg: "bg-destructive/10" },
  improvement_celebration: { icon: Trophy, color: "text-yellow-600", bg: "bg-yellow-50" },
  at_risk_intervention: { icon: AlertTriangle, color: "text-purple-600", bg: "bg-purple-50" },
  cross_system_correlation: {
    icon: TrendingUp,
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10",
  },
};

function InsightCard({
  insight,
  onDismiss,
}: {
  insight: LearningInsight;
  onDismiss: (id: string) => void;
}) {
  const config = INSIGHT_CONFIG[insight.type] ?? INSIGHT_CONFIG.weak_topic_recommendation;
  const Icon = config.icon;

  const actionHref =
    insight.actionType === "practice_space" && insight.actionEntityId
      ? `/spaces/${insight.actionEntityId}`
      : insight.actionType === "review_exam" && insight.actionEntityId
        ? `/exams/${insight.actionEntityId}/results`
        : undefined;

  return (
    <div className={`rounded-lg border p-4 ${config.bg}`}>
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 ${config.color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-sm font-medium">{insight.title}</h4>
            <button
              onClick={() => onDismiss(insight.id)}
              className="flex-shrink-0 rounded p-0.5 hover:bg-black/5"
              title="Dismiss"
            >
              <X className="text-muted-foreground h-3.5 w-3.5" />
            </button>
          </div>
          <p className="text-muted-foreground mt-0.5 text-xs">{insight.description}</p>
          {actionHref && (
            <Link
              to={actionHref}
              className="bg-background/80 hover:bg-background mt-2 inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium"
            >
              {insight.actionType === "practice_space" ? "Start Practicing" : "View"}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export default function RecommendationsSection({ studentId }: { studentId: string }) {
  const { data: insightsPage, isLoading } = useLearningInsights({
    studentId: studentId as UserId,
  });
  const insights = (
    insightsPage as { pages?: Array<{ items?: LearningInsight[] }> } | undefined
  )?.pages
    ?.flatMap((p) => p.items ?? [])
    .filter((i) => !i.dismissedAt);
  const dismissMutation = useDismissInsight();

  if (isLoading) {
    return (
      <div>
        <h2 className="mb-3 text-lg font-semibold">Recommendations</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {[1, 2].map((i) => (
            <div key={i} className="bg-muted h-24 animate-pulse rounded-lg border" />
          ))}
        </div>
      </div>
    );
  }

  if (!insights || insights.length === 0) return null;

  // Sort by priority: high > medium > low
  const sorted = [...insights].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return (order[a.priority] ?? 2) - (order[b.priority] ?? 2);
  });

  return (
    <div>
      <h2 className="mb-3 text-lg font-semibold">Recommendations</h2>
      <div className="grid gap-3 md:grid-cols-2">
        {sorted.map((insight) => (
          <InsightCard
            key={insight.id}
            insight={insight}
            onDismiss={(id) => dismissMutation.mutate({ insightId: id as InsightId })}
          />
        ))}
      </div>
    </div>
  );
}
