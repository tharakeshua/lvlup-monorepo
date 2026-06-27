/**
 * ReportsScreen — generate & review tenant PDF reports.
 *
 * Design: docs/rebuild-spec/design/build/prototypes/admin/reports.card.html
 * Route:  /admin/insights/reports
 * Data:   useLearningInsights() — the tenant insight stream rendered as the
 *         "report list" (recent reportable signals). The desktop builder
 *         (exam/student/class scope pickers + signed-PDF download) is heavy and
 *         picker-driven, so on mobile the report TYPES are shown as a catalog and
 *         the actual build/download "continues on web" (matches the §5 partial
 *         state in the prototype). `useInsights` is the per-student variant.
 *
 * Reads soft-miss to empty until the analytics callables deploy (GATE-B).
 */
import { useMemo } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useLearningInsights } from "@levelup/query";

import {
  Alert,
  Button,
  Card,
  EmptyState,
  Icon,
  ListRow,
  Screen,
  SectionHeader,
  Skeleton,
  TopBar,
} from "../../components";
import { routes } from "../../lib/routes";
import { isHardError } from "../../lib/query-status";
import { flattenPages, humanize, shortDate, type InsightRow } from "./_insights-utils";

interface ReportType {
  key: string;
  icon: string;
  title: string;
  body: string;
}
const REPORT_TYPES: ReportType[] = [
  {
    key: "exam",
    icon: "file-check",
    title: "Exam summary",
    body: "Scores, pass rate & question analysis for a graded exam.",
  },
  {
    key: "progress",
    icon: "graduation-cap",
    title: "Student progress",
    body: "One learner's space completion, mastery & streak history.",
  },
  {
    key: "class",
    icon: "school",
    title: "Class performance",
    body: "Average scores, completion & at-risk roster for a class.",
  },
];

export default function ReportsScreen() {
  const router = useRouter();
  const insightsQ = useLearningInsights({});
  const insights = useMemo<InsightRow[]>(
    () => flattenPages<InsightRow>(insightsQ.data),
    [insightsQ.data]
  );

  return (
    <Screen scroll>
      <TopBar title="Reports" subtitle="Generate & download PDF reports" />

      {/* Build on web — the scope pickers + signed-PDF download are web-heavy */}
      <Alert variant="info" icon="info" title="Build reports on web">
        Pick a scope, generate, and download signed PDFs from the web console. Report types are
        listed below.
      </Alert>

      {/* Report-type catalog */}
      <Card className="gap-2">
        <SectionHeader title="Report types" subtitle="What you can generate" />
        {REPORT_TYPES.map((rt) => (
          <ListRow
            key={rt.key}
            title={rt.title}
            subtitle={rt.body}
            leading={<Icon name={rt.icon} size={18} />}
            trailing={<Icon name="external-link" size={16} />}
            onPress={() => router.push(routes.insights())}
          />
        ))}
        <View className="pt-1">
          <Button
            variant="secondary"
            size="sm"
            leadingIcon="external-link"
            onPress={() => router.push(routes.insights())}
          >
            Open builder on web
          </Button>
        </View>
      </Card>

      {/* Recent reportable signals (the insight "report list") */}
      <Card className="gap-2">
        <SectionHeader title="Recent signals" subtitle="Reportable insights from this tenant" />
        {insightsQ.isLoading ? (
          <View className="gap-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </View>
        ) : isHardError(insightsQ) ? (
          <EmptyState
            icon="alert-triangle"
            title="Couldn't load signals"
            body="Try again in a moment."
          />
        ) : insights.length === 0 ? (
          <EmptyState
            icon="file-text"
            title="No reportable signals yet"
            body="Signals appear once exams are graded and analytics runs."
          />
        ) : (
          insights
            .slice(0, 20)
            .map((n, i) => (
              <ListRow
                key={n.id ?? `${n.title}-${i}`}
                title={n.title ?? humanize(n.type) ?? "Signal"}
                subtitle={n.actionEntityTitle ?? n.description ?? undefined}
                leading={<Icon name="file-text" size={18} />}
                trailing={
                  n.createdAt ? (
                    <Text className="text-2xs text-text-muted">{shortDate(n.createdAt)}</Text>
                  ) : undefined
                }
                chevron={false}
              />
            ))
        )}
      </Card>

      <Text className="text-2xs text-text-muted px-1 pb-2">
        Reporting is part of the Analytics feature. PDF generation & download continue on web.
      </Text>
    </Screen>
  );
}
