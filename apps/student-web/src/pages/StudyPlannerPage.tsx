import { useState } from "react";
import { useCurrentUser } from "@levelup/shared-stores";
import { useStudyGoals, useStudentSummary, useSaveStudyGoal } from "@levelup/query";
import type { UserId, StudentProgressSummary, StudyGoal } from "@levelup/domain";
import {
  StudyGoalCard,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  FadeIn,
  AnimatedList,
  AnimatedListItem,
  EmptyState,
} from "@levelup/shared-ui";
import {
  Target,
  Plus,
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  BookOpen,
} from "lucide-react";

function WeekCalendarStrip({
  goals,
  onDayClick,
  selectedDay,
}: {
  goals: Array<{ endDate: string; title: string }>;
  onDayClick: (date: string | null) => void;
  selectedDay: string | null;
}) {
  const today = new Date();
  const days: Date[] = [];
  // Start from Monday of current week
  const startOfWeek = new Date(today);
  const dayOfWeek = today.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  startOfWeek.setDate(today.getDate() + mondayOffset);

  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    days.push(d);
  }

  const goalsByDate = new Map<string, number>();
  for (const g of goals) {
    const d = g.endDate;
    goalsByDate.set(d, (goalsByDate.get(d) ?? 0) + 1);
  }

  const todayStr = today.toISOString().split("T")[0];
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Weekly calendar">
      {days.map((day, i) => {
        const dateStr = day.toISOString().split("T")[0];
        const goalCount = goalsByDate.get(dateStr) ?? 0;
        const isToday = dateStr === todayStr;
        const isSelected = dateStr === selectedDay;

        return (
          <button
            key={dateStr}
            onClick={() => onDayClick(isSelected ? null : dateStr)}
            className={`flex min-w-[3.5rem] flex-col items-center gap-1 rounded-lg border px-3 py-2 text-xs transition-colors ${
              isSelected
                ? "border-primary bg-primary/5 text-primary"
                : isToday
                  ? "border-primary/50 bg-primary/5"
                  : "hover:bg-muted"
            }`}
            aria-label={`${dayNames[i]}, ${day.getDate()} — ${goalCount} goals due`}
            aria-pressed={isSelected}
          >
            <span className="font-medium">{dayNames[i]}</span>
            <span className={`text-lg font-bold ${isToday ? "text-primary" : ""}`}>
              {day.getDate()}
            </span>
            {goalCount > 0 && (
              <div className="flex gap-0.5">
                {Array.from({ length: Math.min(goalCount, 3) }).map((_, j) => (
                  <div key={j} className="bg-primary h-1.5 w-1.5 rounded-full" aria-hidden="true" />
                ))}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default function StudyPlannerPage() {
  const user = useCurrentUser();
  const tenantId = useCurrentTenantId();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const {
    data: goalsData,
    isLoading: goalsLoading,
    refetch,
  } = useStudyGoals({ includeCompleted: true });
  const goals = (
    goalsData as { pages?: Array<{ items?: StudyGoal[] }> } | undefined
  )?.pages?.flatMap((p) => p.items ?? []);
  const { data: summaryData } = useStudentSummary((user?.uid ?? "") as UserId);
  const summary = (summaryData as { studentSummary?: StudentProgressSummary } | undefined)
    ?.studentSummary;

  const activeGoals = goals?.filter((g) => !g.completed) ?? [];
  const completedGoals = goals?.filter((g) => g.completed) ?? [];
  const displayGoals = selectedDay
    ? activeGoals.filter((g) => g.endDate === selectedDay)
    : activeGoals;

  // Weekly summary stats
  const thisWeekGoals = activeGoals.filter((g) => {
    const end = new Date(g.endDate);
    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 86400000);
    return end <= weekFromNow;
  });

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Target className="text-primary h-6 w-6" aria-hidden="true" />
              Study Planner
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Set goals and track your learning progress
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1">
                <Plus className="h-4 w-4" />
                New Goal
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Study Goal</DialogTitle>
              </DialogHeader>
              <NewGoalForm
                onCreated={() => {
                  setDialogOpen(false);
                  refetch();
                }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </FadeIn>

      {/* Weekly Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-full">
              <Target className="text-primary h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activeGoals.length}</p>
              <p className="text-muted-foreground text-xs">Active Goals</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
              <CalendarIcon className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{thisWeekGoals.length}</p>
              <p className="text-muted-foreground text-xs">Due This Week</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{completedGoals.length}</p>
              <p className="text-muted-foreground text-xs">Completed</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats */}
      {summary && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">This Session</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex items-center gap-2">
                <BookOpen className="text-muted-foreground h-4 w-4" />
                <div>
                  <p className="text-sm font-medium">
                    {summary.levelup.completedSpaces}/{summary.levelup.totalSpaces}
                  </p>
                  <p className="text-muted-foreground text-xs">Spaces Completed</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="text-muted-foreground h-4 w-4" />
                <div>
                  <p className="text-sm font-medium">{summary.levelup.streakDays} days</p>
                  <p className="text-muted-foreground text-xs">Current Streak</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="text-muted-foreground h-4 w-4" />
                <div>
                  <p className="text-sm font-medium">{summary.autograde.completedExams} exams</p>
                  <p className="text-muted-foreground text-xs">Exams Completed</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Weekly Calendar */}
      {activeGoals.length > 0 && (
        <FadeIn delay={0.05}>
          <WeekCalendarStrip
            goals={activeGoals}
            onDayClick={setSelectedDay}
            selectedDay={selectedDay}
          />
        </FadeIn>
      )}

      {/* Active Goals */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Active Goals</h2>
          {selectedDay && (
            <button
              onClick={() => setSelectedDay(null)}
              className="text-primary text-xs hover:underline"
            >
              Clear filter
            </button>
          )}
        </div>
        {goalsLoading ? (
          <div className="grid gap-3 md:grid-cols-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-28 rounded-lg" />
            ))}
          </div>
        ) : displayGoals.length === 0 ? (
          <EmptyState
            icon={Target}
            title="No active goals"
            description="Create a study goal to start tracking your learning progress!"
          />
        ) : (
          <AnimatedList className="grid gap-3 md:grid-cols-2">
            {displayGoals.map((goal) => (
              <AnimatedListItem key={goal.id}>
                <StudyGoalCard
                  title={goal.title}
                  targetType={goal.targetType}
                  targetCount={goal.targetCount}
                  currentCount={goal.currentCount}
                  startDate={goal.startDate}
                  endDate={goal.endDate}
                  completed={goal.completed}
                />
              </AnimatedListItem>
            ))}
          </AnimatedList>
        )}
      </div>

      {/* Completed Goals */}
      {completedGoals.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold">Completed</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {completedGoals.slice(0, 6).map((goal) => (
              <StudyGoalCard
                key={goal.id}
                title={goal.title}
                targetType={goal.targetType}
                targetCount={goal.targetCount}
                currentCount={goal.currentCount}
                startDate={goal.startDate}
                endDate={goal.endDate}
                completed={goal.completed}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function NewGoalForm({ onCreated }: { onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [targetType, setTargetType] = useState("spaces");
  const [targetCount, setTargetCount] = useState("");
  const [endDate, setEndDate] = useState("");
  const [dateError, setDateError] = useState("");
  const { mutateAsync: saveGoal, isPending: saving } = useSaveStudyGoal();

  const today = new Date().toISOString().split("T")[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !targetCount || !endDate) return;

    // Validate end date is after today
    if (endDate <= today) {
      setDateError("Due date must be in the future");
      return;
    }
    setDateError("");

    // Server derives tenant/user from auth and computes currentCount/completed.
    await saveGoal({
      data: {
        title,
        targetType,
        targetCount: parseInt(targetCount, 10),
        startDate: new Date().toISOString().split("T")[0],
        endDate,
      },
    });
    onCreated();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="goal-title">Goal Title</Label>
        <Input
          id="goal-title"
          placeholder="e.g., Complete Math spaces this week"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="target-type">Type</Label>
          <Select value={targetType} onValueChange={setTargetType}>
            <SelectTrigger id="target-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="spaces">Spaces</SelectItem>
              <SelectItem value="story_points">Sections</SelectItem>
              <SelectItem value="items">Items</SelectItem>
              <SelectItem value="exams">Exams</SelectItem>
              <SelectItem value="minutes">Minutes</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="target-count">Target</Label>
          <Input
            id="target-count"
            type="number"
            min={1}
            placeholder="e.g., 5"
            value={targetCount}
            onChange={(e) => setTargetCount(e.target.value)}
            required
          />
        </div>
      </div>
      <div>
        <Label htmlFor="end-date">Due Date</Label>
        <Input
          id="end-date"
          type="date"
          value={endDate}
          onChange={(e) => {
            setEndDate(e.target.value);
            setDateError("");
          }}
          min={today}
          required
        />
        {dateError && <p className="text-destructive mt-1 text-xs">{dateError}</p>}
      </div>
      <Button type="submit" disabled={saving} className="w-full">
        {saving ? "Creating..." : "Create Goal"}
      </Button>
    </form>
  );
}
