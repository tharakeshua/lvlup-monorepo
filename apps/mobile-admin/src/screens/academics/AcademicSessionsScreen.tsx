/**
 * AcademicSessionsScreen — academic-year sessions + create + rollover.
 *
 * Design: docs/rebuild-spec/design/build/prototypes/admin/academic-sessions.card.html
 * Route:  /admin/academics/sessions
 * Data:   useAcademicSessions() + useSaveAcademicSession() (create/edit) +
 *         useRolloverSession() (clone current → next year, optionally copying
 *         classes/teachers and promoting students).
 *
 * Defensive reads (soft-miss to empty until identity callables deploy).
 */
import { useMemo, useState } from "react";
import { Switch, Text, View } from "react-native";
import { useAcademicSessions, useRolloverSession, useSaveAcademicSession } from "@levelup/query";

import {
  Badge,
  Button,
  Card,
  EmptyState,
  Icon,
  ListRow,
  Modal,
  Screen,
  SectionHeader,
  Skeleton,
  StatTile,
  TextField,
  TopBar,
} from "../../components";
import { colors } from "../../theme";
import { isHardError } from "../../lib/query-status";
import { fmtDate, listOf, statusBadge, str } from "./_shared";

interface SessionRow {
  id?: string;
  name?: string;
  startDate?: unknown;
  endDate?: unknown;
  isCurrent?: boolean;
  status?: string;
}

function ToggleRow({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <View className="flex-row items-center justify-between py-1">
      <Text className="font-ui text-text-primary text-sm">{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: colors.brand, false: colors.borderStrong }}
      />
    </View>
  );
}

export default function AcademicSessionsScreen() {
  const sessionsQ = useAcademicSessions({});
  const saveSession = useSaveAcademicSession();
  const rollover = useRolloverSession();

  const sessions = useMemo(() => listOf<SessionRow>(sessionsQ.data), [sessionsQ.data]);
  const current = sessions.find((s) => s.isCurrent) ?? sessions[0];
  const active = sessions.filter((s) => str(s.status, "active") !== "archived").length;

  // create form
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // rollover form
  const [showRollover, setShowRollover] = useState(false);
  const [roName, setRoName] = useState("");
  const [roStart, setRoStart] = useState("");
  const [roEnd, setRoEnd] = useState("");
  const [copyClasses, setCopyClasses] = useState(true);
  const [copyTeachers, setCopyTeachers] = useState(true);
  const [promote, setPromote] = useState(true);

  const datesBad = (a: string, b: string) => a !== "" && b !== "" && b <= a;

  const onCreate = async () => {
    if (!name.trim()) return;
    try {
      await saveSession.mutateAsync({
        name: name.trim(),
        startDate: startDate.trim() || undefined,
        endDate: endDate.trim() || undefined,
        status: "active",
      } as never);
      setShowCreate(false);
      setName("");
      setStartDate("");
      setEndDate("");
    } catch {
      // keep form open; mutation exposes its own error state.
    }
  };

  const onRollover = async () => {
    if (!roName.trim() || datesBad(roStart, roEnd)) return;
    try {
      await rollover.mutateAsync({
        sourceSessionId: str(current?.id) || undefined,
        name: roName.trim(),
        startDate: roStart.trim() || undefined,
        endDate: roEnd.trim() || undefined,
        copyClasses,
        copyTeachers,
        promoteStudents: promote,
      } as never);
      setShowRollover(false);
    } catch {
      // keep dialog open; mutation exposes its own error state.
    }
  };

  return (
    <Screen scroll>
      <TopBar
        title="Sessions"
        subtitle="Academic years"
        right={
          <Button size="sm" leadingIcon="plus" onPress={() => setShowCreate(true)}>
            New
          </Button>
        }
      />

      <View className="flex-row flex-wrap gap-3">
        <View className="min-w-[46%] flex-1">
          <StatTile
            label="Sessions"
            value={sessionsQ.isLoading ? "…" : String(sessions.length)}
            icon="calendar"
          />
        </View>
        <View className="min-w-[46%] flex-1">
          <StatTile
            label="Active"
            value={sessionsQ.isLoading ? "…" : String(active)}
            icon="check-circle"
          />
        </View>
      </View>

      {/* current session */}
      {current && (
        <Card className="gap-3">
          <SectionHeader title="Current session" />
          <View className="gap-1">
            <View className="flex-row items-center gap-2">
              <Icon name="calendar-check" size={18} />
              <Text className="font-display text-text-primary text-lg font-semibold">
                {str(current.name, "—")}
              </Text>
              <Badge variant="success">Current</Badge>
            </View>
            <Text className="font-ui text-text-muted text-sm">
              {fmtDate(current.startDate)} → {fmtDate(current.endDate)}
            </Text>
          </View>
          <Button
            variant="secondary"
            leadingIcon="refresh-cw"
            onPress={() => setShowRollover(true)}
          >
            Roll over to next year
          </Button>
        </Card>
      )}

      <Card className="gap-1">
        <SectionHeader title="All sessions" />

        {sessionsQ.isLoading ? (
          <View className="gap-2 py-2">
            <Skeleton variant="rect" />
            <Skeleton variant="rect" />
          </View>
        ) : isHardError(sessionsQ) ? (
          <EmptyState
            icon="alert-triangle"
            title="Couldn't load sessions"
            body="Something went wrong reading academic sessions."
            action={
              <Button size="sm" variant="secondary" onPress={() => sessionsQ.refetch()}>
                Retry
              </Button>
            }
          />
        ) : sessions.length === 0 ? (
          <EmptyState
            icon="calendar"
            title="No sessions yet"
            body="Create an academic year to organize classes and exams."
            action={
              <Button size="sm" onPress={() => setShowCreate(true)}>
                Create a session
              </Button>
            }
          />
        ) : (
          sessions.map((s, i) => {
            const sb = statusBadge(s.isCurrent ? "active" : (s.status ?? "archived"));
            return (
              <ListRow
                key={str(s.id) || String(i)}
                title={str(s.name, "Untitled session")}
                subtitle={`${fmtDate(s.startDate)} → ${fmtDate(s.endDate)}`}
                leading={<Icon name="calendar" size={18} />}
                trailing={
                  <Badge variant={s.isCurrent ? "success" : sb.variant}>
                    {s.isCurrent ? "Current" : sb.label}
                  </Badge>
                }
                chevron={false}
              />
            );
          })
        )}
      </Card>

      {/* create-session modal */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="New session"
        footer={
          <>
            <Button variant="ghost" size="sm" onPress={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              loading={saveSession.isPending}
              disabled={!name.trim() || datesBad(startDate, endDate)}
              onPress={onCreate}
            >
              Create
            </Button>
          </>
        }
      >
        <View className="gap-3">
          <TextField
            label="Session name"
            placeholder="e.g. 2026–2027"
            value={name}
            onChangeText={setName}
            required
          />
          <View className="flex-row gap-3">
            <View className="flex-1">
              <TextField
                label="Start (YYYY-MM-DD)"
                placeholder="2026-06-01"
                value={startDate}
                onChangeText={setStartDate}
              />
            </View>
            <View className="flex-1">
              <TextField
                label="End (YYYY-MM-DD)"
                placeholder="2027-05-31"
                value={endDate}
                onChangeText={setEndDate}
              />
            </View>
          </View>
          {datesBad(startDate, endDate) && (
            <Text className="font-ui text-status-error text-xs">
              End date must be after the start date.
            </Text>
          )}
        </View>
      </Modal>

      {/* rollover modal */}
      <Modal
        open={showRollover}
        onClose={() => setShowRollover(false)}
        title="Roll over session"
        footer={
          <>
            <Button variant="ghost" size="sm" onPress={() => setShowRollover(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              loading={rollover.isPending}
              disabled={!roName.trim() || datesBad(roStart, roEnd)}
              onPress={onRollover}
            >
              Roll over
            </Button>
          </>
        }
      >
        <View className="gap-3">
          <Text className="font-ui text-text-muted text-sm">
            Clone {str(current?.name, "the current session")} into a new academic year.
          </Text>
          <TextField
            label="New session name"
            placeholder="e.g. 2026–2027"
            value={roName}
            onChangeText={setRoName}
            required
          />
          <View className="flex-row gap-3">
            <View className="flex-1">
              <TextField
                label="Start"
                placeholder="2026-06-01"
                value={roStart}
                onChangeText={setRoStart}
              />
            </View>
            <View className="flex-1">
              <TextField
                label="End"
                placeholder="2027-05-31"
                value={roEnd}
                onChangeText={setRoEnd}
              />
            </View>
          </View>
          {datesBad(roStart, roEnd) && (
            <Text className="font-ui text-status-error text-xs">
              End date must be after the start date.
            </Text>
          )}
          <View className="border-border-subtle gap-1 rounded-md border p-3">
            <ToggleRow label="Copy classes" value={copyClasses} onValueChange={setCopyClasses} />
            <ToggleRow
              label="Copy teacher assignments"
              value={copyTeachers}
              onValueChange={setCopyTeachers}
            />
            <ToggleRow label="Promote students" value={promote} onValueChange={setPromote} />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
