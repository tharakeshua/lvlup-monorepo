/**
 * DataExportScreen — export the academy's records as JSON or CSV.
 *
 * Design: docs/rebuild-spec/design/build/prototypes/admin/data-export.card.html
 * Route:  /admin/more/data-export
 * Data:   useExportTenantData() (mutation). There's no export-history read hook in
 *         this lane's contract, so the screen surfaces the most-recent export
 *         result (download link / status) returned by the mutation itself.
 */
import { useMemo, useState } from "react";
import { Linking, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useExportTenantData } from "@levelup/query";

import {
  Alert,
  Badge,
  Button,
  Card,
  Chip,
  Icon,
  ListRow,
  Screen,
  SectionHeader,
  TopBar,
} from "../../components";
import { fmtDate, listOf, pickStr } from "./_shared";

const SCOPES = [
  { key: "students", label: "Students", icon: "graduation-cap" },
  { key: "teachers", label: "Teachers", icon: "users" },
  { key: "classes", label: "Classes", icon: "school" },
  { key: "spaces", label: "Content spaces", icon: "layers" },
  { key: "exams", label: "Exams", icon: "file-text" },
  { key: "submissions", label: "Submissions", icon: "inbox" },
  { key: "analytics", label: "Analytics", icon: "bar-chart-3" },
] as const;

type Format = "json" | "csv";

export default function DataExportScreen() {
  const router = useRouter();
  const exportMut = useExportTenantData();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [format, setFormat] = useState<Format>("json");

  const toggle = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const canExport = selected.size > 0 && !exportMut.isPending;

  const onExport = () => {
    if (selected.size === 0) return;
    exportMut.mutate({ scopes: Array.from(selected), format });
  };

  // The mutation result may be a single export descriptor or a list of them.
  const result = exportMut.data;
  const history = useMemo(() => {
    const list = listOf(result);
    if (list.length > 0) return list;
    return result && typeof result === "object" ? [result as Record<string, unknown>] : [];
  }, [result]);

  return (
    <Screen scroll>
      <TopBar
        title="Data export"
        subtitle="Export this academy's records"
        onBack={() => router.back()}
      />

      {/* Scope selection */}
      <Card className="gap-3">
        <SectionHeader title="Select data to export" subtitle="Choose one or more collections" />
        <View className="flex-row flex-wrap gap-2">
          {SCOPES.map((s) => (
            <Chip
              key={s.key}
              active={selected.has(s.key)}
              leadingIcon={s.icon}
              onPress={() => toggle(s.key)}
            >
              {s.label}
            </Chip>
          ))}
        </View>
        {selected.size === 0 ? (
          <Text className="text-2xs text-text-muted">
            Select at least one collection to continue.
          </Text>
        ) : null}
      </Card>

      {/* Format */}
      <Card className="gap-3">
        <SectionHeader title="Format" />
        <View className="flex-row gap-2">
          {(["json", "csv"] as Format[]).map((f) => (
            <Chip key={f} active={format === f} onPress={() => setFormat(f)}>
              {f.toUpperCase()}
            </Chip>
          ))}
        </View>
        <Button
          variant="primary"
          block
          leadingIcon="download"
          loading={exportMut.isPending}
          disabled={!canExport}
          onPress={onExport}
        >
          {exportMut.isPending ? "Preparing export…" : "Export"}
        </Button>
      </Card>

      {exportMut.isError ? (
        <Alert variant="error" title="Export failed">
          We couldn't prepare this export. Your daily quota may be used up, or the academy may be
          suspended. Try again later.
        </Alert>
      ) : null}

      {/* Result / history */}
      {history.length > 0 ? (
        <Card className="gap-1">
          <SectionHeader title="Export history" />
          {history.map((h, i) => {
            const status = (pickStr(h, "status") ?? "ready").toLowerCase();
            const url = pickStr(h, "downloadUrl", "url", "link");
            const fmt = (pickStr(h, "format") ?? format).toUpperCase();
            const when =
              fmtDate(
                (h as Record<string, unknown>).createdAt ?? (h as Record<string, unknown>).expiresAt
              ) ?? undefined;
            const ready = status === "ready" || status === "complete" || !!url;
            return (
              <ListRow
                key={pickStr(h, "id", "exportId") ?? `exp-${i}`}
                title={`${fmt} export`}
                subtitle={[when, pickStr(h, "size")].filter(Boolean).join(" · ") || undefined}
                leading={<Icon name="file-archive" size={18} />}
                trailing={
                  <Badge variant={ready ? "success" : status === "failed" ? "error" : "info"}>
                    {ready ? "Ready" : status === "failed" ? "Failed" : "Preparing"}
                  </Badge>
                }
                chevron={false}
                onPress={url ? () => void Linking.openURL(url) : undefined}
              />
            );
          })}
        </Card>
      ) : null}

      <Text className="text-2xs text-text-muted px-1 pb-2">
        Exports are scoped to this academy and expire after a short window. Large exports may take a
        few minutes to prepare.
      </Text>
    </Screen>
  );
}
