import { useCurrentUser, useCurrentTenantId } from "@levelup/shared-stores";
import { Badge, Card, CardContent, Skeleton, EmptyState } from "@levelup/shared-ui";
import type { SpaceProgress } from "@levelup/shared-types";
import { BookOpen } from "lucide-react";
import { useLinkedStudents } from "../hooks/useLinkedStudents";
import { useStudentNames } from "../hooks/useStudentNames";
import { useChildProgress } from "../hooks/useChildProgress";
import { useSpaceNames } from "../hooks/useSpaceNames";
import { getStudentDisplayName } from "../lib/helpers";

function SpaceProgressSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading content">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="space-y-3">
          <Skeleton className="h-6 w-32" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, j) => (
              <Skeleton key={j} className="h-36 rounded-lg" />
            ))}
          </div>
        </div>
      ))}
      <span className="sr-only">Loading...</span>
    </div>
  );
}

export default function SpaceProgressPage() {
  const user = useCurrentUser();
  const tenantId = useCurrentTenantId();
  const { data: linkedStudents, isLoading: studentsLoading } = useLinkedStudents(
    tenantId,
    user?.uid ?? null
  );
  const studentIds = linkedStudents?.map((s) => s.uid) ?? [];
  const {
    data: progressList,
    isLoading: progressLoading,
    isError,
  } = useChildProgress(tenantId, studentIds.length > 0 ? studentIds : undefined);

  const { data: studentNames } = useStudentNames(tenantId, studentIds);

  const uniqueSpaceIds = [...new Set(progressList?.map((p) => p.spaceId).filter(Boolean) ?? [])];
  const { data: spaceNames } = useSpaceNames(tenantId, uniqueSpaceIds);

  // Build a name lookup from linked students membership data
  const studentNameFromMembership = (studentId: string): string => {
    const membership = linkedStudents?.find((s) => s.uid === studentId);
    if (membership) {
      return getStudentDisplayName(studentNames, membership);
    }
    if (studentNames?.[studentId] && studentNames[studentId] !== "Unknown") {
      return studentNames[studentId]!;
    }
    return `Student ${studentId.slice(0, 8)}`;
  };

  // Group progress by student
  const byStudent = progressList?.reduce(
    (acc, prog) => {
      const key = prog.userId;
      if (!acc[key]) acc[key] = [];
      acc[key].push(prog);
      return acc;
    },
    {} as Record<string, SpaceProgress[]>
  );

  const isLoading = studentsLoading || (studentIds.length > 0 && progressLoading);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Space Progress</h1>
        <p className="text-muted-foreground text-sm">
          Track your children's learning progress across spaces
        </p>
      </div>

      {isLoading ? (
        <SpaceProgressSkeleton />
      ) : isError ? (
        <EmptyState
          icon={BookOpen}
          title="Could not load progress"
          description="Something went wrong loading space progress. Try refreshing the page."
        />
      ) : !progressList?.length ? (
        <EmptyState
          icon={BookOpen}
          title="No progress data yet"
          description="Progress will appear here as your children start learning"
        />
      ) : (
        <div className="space-y-6">
          {Object.entries(byStudent ?? {}).map(([studentId, progressItems]) => (
            <div key={studentId} className="space-y-3">
              <h2 className="text-lg font-semibold">{studentNameFromMembership(studentId)}</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {progressItems.map((prog) => (
                  <Card key={prog.id} className="transition-shadow hover:shadow-sm">
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-medium">
                            {spaceNames?.[prog.spaceId] ?? `Space ${prog.spaceId.slice(0, 12)}`}
                          </h3>
                          <Badge
                            variant={
                              prog.status === "completed"
                                ? "default"
                                : prog.status === "in_progress"
                                  ? "secondary"
                                  : "outline"
                            }
                            className="mt-1"
                          >
                            {prog.status.replace(/_/g, " ")}
                          </Badge>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold">{Math.round(prog.percentage)}%</p>
                          <p className="text-muted-foreground text-xs">
                            {prog.pointsEarned}/{prog.totalPoints} pts
                          </p>
                        </div>
                      </div>
                      <div className="mt-3">
                        <div
                          className="bg-muted h-2 w-full rounded-full"
                          role="progressbar"
                          aria-valuenow={Math.round(prog.percentage)}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`Progress: ${Math.round(prog.percentage)}%`}
                        >
                          <div
                            className={`h-2 rounded-full transition-all ${
                              prog.status === "completed" ? "bg-success" : "bg-info"
                            }`}
                            style={{
                              width: `${Math.min(100, prog.percentage)}%`,
                            }}
                          />
                        </div>
                      </div>
                      {prog.storyPoints && (
                        <div className="text-muted-foreground mt-3 text-xs">
                          {
                            Object.values(prog.storyPoints).filter(
                              (sp) => sp.status === "completed"
                            ).length
                          }
                          /{Object.values(prog.storyPoints).length} story points completed
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
